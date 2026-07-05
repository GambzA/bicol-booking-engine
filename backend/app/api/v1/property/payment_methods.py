import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.property_portal import PaymentMethod, PaymentMethodBankAccount

router = APIRouter(prefix="/payment-methods", tags=["property-payment-methods"])

VALID_METHOD_TYPES = {"bank_transfer", "pay_at_property"}
VALID_DEPOSIT_TYPES = {"fixed", "percentage"}


class BankAccountInput(BaseModel):
    account_name: str
    bank_name: str
    account_number: str
    branch: Optional[str] = None
    swift_code: Optional[str] = None
    iban: Optional[str] = None
    qr_image_url: Optional[str] = None
    instructions: Optional[str] = None
    is_default: bool = False


class PaymentMethodCreate(BaseModel):
    method_type: str
    name: str
    is_enabled: bool = False
    display_order: int = 0
    instructions: Optional[str] = None
    deposit_required: bool = False
    deposit_type: Optional[str] = None
    deposit_value: Optional[Decimal] = None
    bank_accounts: list[BankAccountInput] = []


class PaymentMethodUpdate(BaseModel):
    name: Optional[str] = None
    is_enabled: Optional[bool] = None
    display_order: Optional[int] = None
    instructions: Optional[str] = None
    deposit_required: Optional[bool] = None
    deposit_type: Optional[str] = None
    deposit_value: Optional[Decimal] = None
    bank_accounts: Optional[list[BankAccountInput]] = None


def _serialize_bank(a: PaymentMethodBankAccount) -> dict:
    return {
        "id": str(a.id),
        "account_name": a.account_name,
        "bank_name": a.bank_name,
        "account_number": a.account_number,
        "branch": a.branch,
        "swift_code": a.swift_code,
        "iban": a.iban,
        "qr_image_url": a.qr_image_url,
        "instructions": a.instructions,
        "is_default": a.is_default,
        "display_order": a.display_order,
    }


def _serialize(pm: PaymentMethod, include_details: bool = False) -> dict:
    data: dict = {
        "id": str(pm.id),
        "method_type": pm.method_type,
        "name": pm.name,
        "is_enabled": pm.is_enabled,
        "display_order": pm.display_order,
        "instructions": pm.instructions,
        "deposit_required": pm.deposit_required,
        "deposit_type": pm.deposit_type,
        "deposit_value": str(pm.deposit_value) if pm.deposit_value is not None else None,
        "created_at": pm.created_at.isoformat(),
        "updated_at": pm.updated_at.isoformat(),
    }
    if include_details:
        data["bank_accounts"] = [_serialize_bank(a) for a in pm.bank_accounts]
    else:
        data["bank_account_count"] = len(pm.bank_accounts) if pm.bank_accounts is not None else 0
    return data


async def _get_or_404(db: AsyncSession, method_id: uuid.UUID, hotel_id: uuid.UUID) -> PaymentMethod:
    pm = (await db.execute(
        select(PaymentMethod)
        .where(
            PaymentMethod.id == method_id,
            PaymentMethod.hotel_id == hotel_id,
            PaymentMethod.deleted_at.is_(None),
        )
        .options(selectinload(PaymentMethod.bank_accounts))
    )).scalar_one_or_none()
    if pm is None:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return pm


def _validate_deposit(deposit_required: bool, deposit_type: Optional[str], deposit_value: Optional[Decimal]) -> None:
    if not deposit_required:
        return
    if deposit_type not in VALID_DEPOSIT_TYPES:
        raise HTTPException(status_code=422, detail="A valid deposit type (fixed or percentage) is required.")
    if deposit_value is None or deposit_value < 0:
        raise HTTPException(status_code=422, detail="Deposit value must be zero or greater.")
    if deposit_type == "percentage" and deposit_value > 100:
        raise HTTPException(status_code=422, detail="Percentage deposit cannot exceed 100%.")


def _normalize_defaults(accounts: list[BankAccountInput]) -> None:
    """Keep at most one default; if none marked and accounts exist, default the first."""
    seen_default = False
    for a in accounts:
        if a.is_default and not seen_default:
            seen_default = True
        elif a.is_default:
            a.is_default = False
    if accounts and not seen_default:
        accounts[0].is_default = True


async def _enabled_count(db: AsyncSession, hotel_id: uuid.UUID, exclude_id: Optional[uuid.UUID] = None) -> int:
    q = select(func.count(PaymentMethod.id)).where(
        PaymentMethod.hotel_id == hotel_id,
        PaymentMethod.deleted_at.is_(None),
        PaymentMethod.is_enabled.is_(True),
    )
    if exclude_id is not None:
        q = q.where(PaymentMethod.id != exclude_id)
    return (await db.execute(q)).scalar() or 0


@router.get("")
async def list_payment_methods(
    active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    where = [PaymentMethod.hotel_id == user.hotel_id, PaymentMethod.deleted_at.is_(None)]
    if active is not None:
        where.append(PaymentMethod.is_enabled == active)
    methods = list((await db.execute(
        select(PaymentMethod)
        .options(selectinload(PaymentMethod.bank_accounts))
        .where(*where)
        .order_by(PaymentMethod.display_order, PaymentMethod.name)
    )).scalars().all())
    return {"items": [_serialize(pm) for pm in methods]}


@router.get("/{method_id}")
async def get_payment_method(
    method_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pm = await _get_or_404(db, method_id, user.hotel_id)
    return _serialize(pm, include_details=True)


@router.post("")
async def create_payment_method(
    body: PaymentMethodCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.method_type not in VALID_METHOD_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid method_type: {body.method_type}")
    if not body.name.strip():
        raise HTTPException(status_code=422, detail="Payment method name is required.")
    _validate_deposit(body.deposit_required, body.deposit_type, body.deposit_value)

    if body.method_type == "bank_transfer" and body.is_enabled and not body.bank_accounts:
        raise HTTPException(status_code=422, detail="Add at least one bank account before enabling Bank Transfer.")

    _normalize_defaults(body.bank_accounts)

    pm = PaymentMethod(
        hotel_id=user.hotel_id,
        method_type=body.method_type,
        name=body.name.strip(),
        is_enabled=body.is_enabled,
        display_order=body.display_order,
        instructions=body.instructions,
        deposit_required=body.deposit_required if body.method_type == "pay_at_property" else False,
        deposit_type=body.deposit_type if body.method_type == "pay_at_property" else None,
        deposit_value=body.deposit_value if body.method_type == "pay_at_property" else None,
    )
    db.add(pm)
    await db.flush()

    if body.method_type == "bank_transfer":
        for i, a in enumerate(body.bank_accounts):
            db.add(PaymentMethodBankAccount(
                payment_method_id=pm.id, display_order=i,
                account_name=a.account_name, bank_name=a.bank_name, account_number=a.account_number,
                branch=a.branch, swift_code=a.swift_code, iban=a.iban,
                qr_image_url=a.qr_image_url, instructions=a.instructions, is_default=a.is_default,
            ))

    await db.commit()
    pm = await _get_or_404(db, pm.id, user.hotel_id)
    return _serialize(pm, include_details=True)


@router.put("/{method_id}")
async def update_payment_method(
    method_id: uuid.UUID,
    body: PaymentMethodUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pm = await _get_or_404(db, method_id, user.hotel_id)
    updates = body.model_dump(exclude_unset=True)

    if "name" in updates and not (updates["name"] or "").strip():
        raise HTTPException(status_code=422, detail="Payment method name is required.")

    eff_required = updates.get("deposit_required", pm.deposit_required)
    eff_type = updates.get("deposit_type", pm.deposit_type)
    eff_value = updates.get("deposit_value", pm.deposit_value)
    if pm.method_type == "pay_at_property":
        _validate_deposit(eff_required, eff_type, eff_value)

    # Determine the resulting bank-account set for the enable guard.
    resulting_accounts = body.bank_accounts if body.bank_accounts is not None else pm.bank_accounts
    eff_enabled = updates.get("is_enabled", pm.is_enabled)
    if pm.method_type == "bank_transfer" and eff_enabled and not resulting_accounts:
        raise HTTPException(status_code=422, detail="Add at least one bank account before enabling Bank Transfer.")

    # Guard: cannot disable the last enabled method.
    if "is_enabled" in updates and pm.is_enabled and not updates["is_enabled"]:
        if await _enabled_count(db, user.hotel_id, exclude_id=pm.id) == 0:
            raise HTTPException(status_code=422, detail="At least one payment method must remain enabled.")

    for field in ("name", "is_enabled", "display_order", "instructions"):
        if field in updates:
            setattr(pm, field, updates[field].strip() if field == "name" else updates[field])
    if pm.method_type == "pay_at_property":
        for field in ("deposit_required", "deposit_type", "deposit_value"):
            if field in updates:
                setattr(pm, field, updates[field])
        if not pm.deposit_required:
            pm.deposit_type = None
            pm.deposit_value = None

    if body.bank_accounts is not None and pm.method_type == "bank_transfer":
        _normalize_defaults(body.bank_accounts)
        await db.execute(delete(PaymentMethodBankAccount).where(PaymentMethodBankAccount.payment_method_id == pm.id))
        for i, a in enumerate(body.bank_accounts):
            db.add(PaymentMethodBankAccount(
                payment_method_id=pm.id, display_order=i,
                account_name=a.account_name, bank_name=a.bank_name, account_number=a.account_number,
                branch=a.branch, swift_code=a.swift_code, iban=a.iban,
                qr_image_url=a.qr_image_url, instructions=a.instructions, is_default=a.is_default,
            ))

    await db.commit()
    pm = await _get_or_404(db, pm.id, user.hotel_id)
    return _serialize(pm, include_details=True)


@router.patch("/{method_id}/toggle")
async def toggle_payment_method(
    method_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pm = await _get_or_404(db, method_id, user.hotel_id)
    if not pm.is_enabled:
        if pm.method_type == "bank_transfer" and not pm.bank_accounts:
            raise HTTPException(status_code=422, detail="Add at least one bank account before enabling Bank Transfer.")
        pm.is_enabled = True
    else:
        if await _enabled_count(db, user.hotel_id, exclude_id=pm.id) == 0:
            raise HTTPException(status_code=422, detail="At least one payment method must remain enabled.")
        pm.is_enabled = False
    await db.commit()
    pm = await _get_or_404(db, pm.id, user.hotel_id)
    return _serialize(pm, include_details=True)


@router.delete("/{method_id}")
async def delete_payment_method(
    method_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pm = await _get_or_404(db, method_id, user.hotel_id)
    if pm.is_enabled and await _enabled_count(db, user.hotel_id, exclude_id=pm.id) == 0:
        raise HTTPException(status_code=422, detail="At least one payment method must remain enabled.")
    pm.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}
