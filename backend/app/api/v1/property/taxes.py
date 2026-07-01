import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.property_portal import Tax
from app.services.taxes import (
    MAX_TAX_PERCENTAGE, VALID_TAX_TYPES, VALID_CALC_METHODS, VALID_SCOPES,
    compute_taxes, added_tax_total, load_active_taxes,
)
from app.services.pricing import money

router = APIRouter(prefix="/taxes", tags=["property-taxes"])


class TaxCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tax_type: str = "percentage"
    rate: Decimal
    calculation_method: str = "exclusive"
    application_scope: str = "per_booking"
    is_active: bool = True
    display_order: int = 0


class TaxUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tax_type: Optional[str] = None
    rate: Optional[Decimal] = None
    calculation_method: Optional[str] = None
    application_scope: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class TaxPreviewBody(BaseModel):
    subtotal: Decimal = Field(ge=0)
    nights: int = Field(ge=0)
    num_adults: int = Field(ge=0)
    num_children: int = Field(ge=0)


def _serialize(tax: Tax) -> dict:
    return {
        "id": str(tax.id),
        "name": tax.name,
        "description": tax.description,
        "tax_type": tax.tax_type,
        "rate": str(tax.rate),
        "calculation_method": tax.calculation_method,
        "application_scope": tax.application_scope,
        "is_active": tax.is_active,
        "display_order": tax.display_order,
        "created_at": tax.created_at.isoformat(),
        "updated_at": tax.updated_at.isoformat(),
    }


def _validate(tax_type: str, rate: Decimal, calc: str, scope: str) -> None:
    if tax_type not in VALID_TAX_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid tax_type: {tax_type}")
    if calc not in VALID_CALC_METHODS:
        raise HTTPException(status_code=422, detail=f"Invalid calculation_method: {calc}")
    if scope not in VALID_SCOPES:
        raise HTTPException(status_code=422, detail=f"Invalid application_scope: {scope}")
    if rate < 0:
        raise HTTPException(status_code=422, detail="Tax rate cannot be negative.")
    if tax_type == "percentage" and rate > MAX_TAX_PERCENTAGE:
        raise HTTPException(status_code=422, detail=f"Percentage tax cannot exceed {MAX_TAX_PERCENTAGE}%.")


async def _get_or_404(db: AsyncSession, tax_id: uuid.UUID, hotel_id: uuid.UUID) -> Tax:
    tax = (await db.execute(
        select(Tax).where(
            Tax.id == tax_id,
            Tax.hotel_id == hotel_id,
            Tax.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if tax is None:
        raise HTTPException(status_code=404, detail="Tax not found")
    return tax


@router.get("")
async def list_taxes(
    search: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hotel_id = user.hotel_id
    base_where = [Tax.hotel_id == hotel_id, Tax.deleted_at.is_(None)]
    if search:
        base_where.append(Tax.name.ilike(f"%{search}%"))
    if active is not None:
        base_where.append(Tax.is_active == active)

    total = (await db.execute(
        select(func.count(Tax.id)).where(*base_where)
    )).scalar() or 0

    taxes = list((await db.execute(
        select(Tax)
        .where(*base_where)
        .order_by(Tax.display_order, Tax.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all())

    return {
        "items": [_serialize(t) for t in taxes],
        "total": total,
        "page": page,
        "pages": max(1, -(-total // page_size)),
    }


@router.post("/preview")
async def preview_taxes(
    body: TaxPreviewBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Compute the tax lines for a would-be booking, given its net subtotal and
    occupancy. Used by the New Booking wizard to show taxes live."""
    taxes = await load_active_taxes(db, user.hotel_id)
    num_guests = body.num_adults + body.num_children
    lines = compute_taxes(
        taxes, body.subtotal, body.nights, num_guests, body.num_adults, body.num_children
    )
    tax_total = added_tax_total(lines)
    return {
        "subtotal": str(money(body.subtotal)),
        "taxes": [
            {
                "tax_id": str(l.tax_id) if l.tax_id else None,
                "name": l.name,
                "tax_type": l.tax_type,
                "rate": str(l.rate),
                "calculation_method": l.calculation_method,
                "application_scope": l.application_scope,
                "amount": str(l.amount),
                "is_included": l.is_included,
            }
            for l in lines
        ],
        "tax_total": str(tax_total),
        "grand_total": str(money(body.subtotal + tax_total)),
    }


@router.get("/{tax_id}")
async def get_tax(
    tax_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tax = await _get_or_404(db, tax_id, user.hotel_id)
    return _serialize(tax)


@router.post("")
async def create_tax(
    body: TaxCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not body.name.strip():
        raise HTTPException(status_code=422, detail="Tax name is required.")
    _validate(body.tax_type, body.rate, body.calculation_method, body.application_scope)

    tax = Tax(
        hotel_id=user.hotel_id,
        name=body.name.strip(),
        description=body.description,
        tax_type=body.tax_type,
        rate=body.rate,
        calculation_method=body.calculation_method,
        application_scope=body.application_scope,
        is_active=body.is_active,
        display_order=body.display_order,
    )
    db.add(tax)
    await db.commit()
    await db.refresh(tax)
    return _serialize(tax)


@router.put("/{tax_id}")
async def update_tax(
    tax_id: uuid.UUID,
    body: TaxUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tax = await _get_or_404(db, tax_id, user.hotel_id)
    updates = body.model_dump(exclude_unset=True)

    if "name" in updates and not (updates["name"] or "").strip():
        raise HTTPException(status_code=422, detail="Tax name is required.")

    effective_type = updates.get("tax_type", tax.tax_type)
    effective_rate = updates.get("rate", tax.rate)
    effective_calc = updates.get("calculation_method", tax.calculation_method)
    effective_scope = updates.get("application_scope", tax.application_scope)
    _validate(effective_type, effective_rate, effective_calc, effective_scope)

    for field in ("name", "description", "tax_type", "rate", "calculation_method",
                  "application_scope", "is_active", "display_order"):
        if field in updates:
            value = updates[field]
            setattr(tax, field, value.strip() if field == "name" else value)

    await db.commit()
    await db.refresh(tax)
    return _serialize(tax)


@router.patch("/{tax_id}/toggle")
async def toggle_tax_active(
    tax_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tax = await _get_or_404(db, tax_id, user.hotel_id)
    tax.is_active = not tax.is_active
    await db.commit()
    await db.refresh(tax)
    return _serialize(tax)


@router.delete("/{tax_id}")
async def delete_tax(
    tax_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tax = await _get_or_404(db, tax_id, user.hotel_id)
    tax.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}
