import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload, joinedload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.property_portal import (
    BillableItem, BillableItemAccommodation, BillableItemRatePlan, Accommodation, RatePlan,
)
from app.services.billable_items import VALID_CATEGORIES, VALID_PRICING_TYPES, load_eligible_items

router = APIRouter(prefix="/billable-items", tags=["property-billable-items"])


class BillableItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    pricing_type: str
    unit_price: Decimal
    is_taxable: bool = True
    is_active: bool = True
    display_order: int = 0
    applies_to_all_accommodations: bool = True
    applies_to_all_rate_plans: bool = True
    accommodation_ids: list[uuid.UUID] = []
    rate_plan_ids: list[uuid.UUID] = []
    available_at_booking: bool = True
    available_at_checkin: bool = True
    available_at_stay: bool = True
    available_at_checkout: bool = True


class BillableItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    pricing_type: Optional[str] = None
    unit_price: Optional[Decimal] = None
    is_taxable: Optional[bool] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None
    applies_to_all_accommodations: Optional[bool] = None
    applies_to_all_rate_plans: Optional[bool] = None
    accommodation_ids: Optional[list[uuid.UUID]] = None
    rate_plan_ids: Optional[list[uuid.UUID]] = None
    available_at_booking: Optional[bool] = None
    available_at_checkin: Optional[bool] = None
    available_at_stay: Optional[bool] = None
    available_at_checkout: Optional[bool] = None


def _serialize(item: BillableItem, include_details: bool = False) -> dict:
    data: dict = {
        "id": str(item.id),
        "name": item.name,
        "description": item.description,
        "category": item.category,
        "pricing_type": item.pricing_type,
        "unit_price": str(item.unit_price),
        "is_taxable": item.is_taxable,
        "is_active": item.is_active,
        "display_order": item.display_order,
        "applies_to_all_accommodations": item.applies_to_all_accommodations,
        "applies_to_all_rate_plans": item.applies_to_all_rate_plans,
        "available_at_booking": item.available_at_booking,
        "available_at_checkin": item.available_at_checkin,
        "available_at_stay": item.available_at_stay,
        "available_at_checkout": item.available_at_checkout,
        "created_at": item.created_at.isoformat(),
        "updated_at": item.updated_at.isoformat(),
    }
    if include_details:
        data["accommodations"] = [
            {"accommodation_id": str(l.accommodation_id), "accommodation_name": l.accommodation.name}
            for l in item.accommodation_links
        ]
        data["rate_plans"] = [
            {"rate_plan_id": str(l.rate_plan_id), "rate_plan_name": l.rate_plan.name}
            for l in item.rate_plan_links
        ]
    else:
        data["accommodation_count"] = len(item.accommodation_links)
        data["rate_plan_count"] = len(item.rate_plan_links)
    return data


async def _get_or_404(db: AsyncSession, item_id: uuid.UUID, hotel_id: uuid.UUID) -> BillableItem:
    item = (await db.execute(
        select(BillableItem)
        .where(
            BillableItem.id == item_id,
            BillableItem.hotel_id == hotel_id,
            BillableItem.deleted_at.is_(None),
        )
        .options(
            selectinload(BillableItem.accommodation_links).joinedload(BillableItemAccommodation.accommodation),
            selectinload(BillableItem.rate_plan_links).joinedload(BillableItemRatePlan.rate_plan),
        )
    )).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Billable item not found")
    return item


def _validate(category: str, pricing_type: str, unit_price: Decimal) -> None:
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"Invalid category: {category}")
    if pricing_type not in VALID_PRICING_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid pricing_type: {pricing_type}")
    if unit_price < 0:
        raise HTTPException(status_code=422, detail="Unit price cannot be negative.")


async def _validate_accommodation_ids(db: AsyncSession, hotel_id: uuid.UUID, ids: list[uuid.UUID]) -> None:
    for acc_id in ids:
        acc = (await db.execute(
            select(Accommodation).where(
                Accommodation.id == acc_id, Accommodation.hotel_id == hotel_id, Accommodation.deleted_at.is_(None),
            )
        )).scalar_one_or_none()
        if acc is None:
            raise HTTPException(status_code=422, detail=f"Accommodation {acc_id} not found or does not belong to this hotel")


async def _validate_rate_plan_ids(db: AsyncSession, hotel_id: uuid.UUID, ids: list[uuid.UUID]) -> None:
    for rp_id in ids:
        rp = (await db.execute(
            select(RatePlan).where(
                RatePlan.id == rp_id, RatePlan.hotel_id == hotel_id, RatePlan.deleted_at.is_(None),
            )
        )).scalar_one_or_none()
        if rp is None:
            raise HTTPException(status_code=422, detail=f"Rate plan {rp_id} not found or does not belong to this hotel")


@router.get("")
async def list_billable_items(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hotel_id = user.hotel_id
    base_where = [BillableItem.hotel_id == hotel_id, BillableItem.deleted_at.is_(None)]
    if search:
        base_where.append(BillableItem.name.ilike(f"%{search}%"))
    if category:
        base_where.append(BillableItem.category == category)
    if active is not None:
        base_where.append(BillableItem.is_active == active)

    total = (await db.execute(select(func.count(BillableItem.id)).where(*base_where))).scalar() or 0

    items = list((await db.execute(
        select(BillableItem)
        .options(selectinload(BillableItem.accommodation_links), selectinload(BillableItem.rate_plan_links))
        .where(*base_where)
        .order_by(BillableItem.display_order, BillableItem.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all())

    return {
        "items": [_serialize(i) for i in items],
        "total": total,
        "page": page,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/eligible")
async def list_eligible_billable_items(
    accommodation_ids: list[uuid.UUID] = Query(default=[]),
    rate_plan_ids: list[uuid.UUID] = Query(default=[]),
    stage: str = Query("booking"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Active items eligible for the given accommodations/rate plans. Defaults
    to the 'booking' stage (New Booking wizard); pass ``stage=all`` to skip
    stage filtering (the Booking Detail page's post-confirmation add flow,
    which has no dedicated check-in/stay/checkout screen to filter against)."""
    require_stage = stage if stage in ("booking", "checkin", "stay", "checkout") else None
    items = await load_eligible_items(
        db, user.hotel_id, set(accommodation_ids), set(rate_plan_ids), require_stage=require_stage
    )
    return {"items": [_serialize(i) for i in items]}


@router.get("/{item_id}")
async def get_billable_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = await _get_or_404(db, item_id, user.hotel_id)
    return _serialize(item, include_details=True)


@router.post("")
async def create_billable_item(
    body: BillableItemCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not body.name.strip():
        raise HTTPException(status_code=422, detail="Item name is required.")
    _validate(body.category, body.pricing_type, body.unit_price)
    if not body.applies_to_all_accommodations and not body.accommodation_ids:
        raise HTTPException(status_code=422, detail="Select at least one accommodation, or apply to all.")
    if not body.applies_to_all_rate_plans and not body.rate_plan_ids:
        raise HTTPException(status_code=422, detail="Select at least one rate plan, or apply to all.")
    await _validate_accommodation_ids(db, user.hotel_id, body.accommodation_ids)
    await _validate_rate_plan_ids(db, user.hotel_id, body.rate_plan_ids)

    item = BillableItem(
        hotel_id=user.hotel_id,
        name=body.name.strip(),
        description=body.description,
        category=body.category,
        pricing_type=body.pricing_type,
        unit_price=body.unit_price,
        is_taxable=body.is_taxable,
        is_active=body.is_active,
        display_order=body.display_order,
        applies_to_all_accommodations=body.applies_to_all_accommodations,
        applies_to_all_rate_plans=body.applies_to_all_rate_plans,
        available_at_booking=body.available_at_booking,
        available_at_checkin=body.available_at_checkin,
        available_at_stay=body.available_at_stay,
        available_at_checkout=body.available_at_checkout,
    )
    db.add(item)
    await db.flush()

    if not body.applies_to_all_accommodations:
        for acc_id in body.accommodation_ids:
            db.add(BillableItemAccommodation(billable_item_id=item.id, accommodation_id=acc_id))
    if not body.applies_to_all_rate_plans:
        for rp_id in body.rate_plan_ids:
            db.add(BillableItemRatePlan(billable_item_id=item.id, rate_plan_id=rp_id))

    await db.commit()
    item = await _get_or_404(db, item.id, user.hotel_id)
    return _serialize(item, include_details=True)


@router.put("/{item_id}")
async def update_billable_item(
    item_id: uuid.UUID,
    body: BillableItemUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = await _get_or_404(db, item_id, user.hotel_id)
    updates = body.model_dump(exclude_unset=True)

    if "name" in updates and not (updates["name"] or "").strip():
        raise HTTPException(status_code=422, detail="Item name is required.")

    effective_category = updates.get("category", item.category)
    effective_pricing_type = updates.get("pricing_type", item.pricing_type)
    effective_unit_price = updates.get("unit_price", item.unit_price)
    _validate(effective_category, effective_pricing_type, effective_unit_price)

    effective_all_acc = updates.get("applies_to_all_accommodations", item.applies_to_all_accommodations)
    effective_acc_ids = body.accommodation_ids if body.accommodation_ids is not None else [
        l.accommodation_id for l in item.accommodation_links
    ]
    if not effective_all_acc and not effective_acc_ids:
        raise HTTPException(status_code=422, detail="Select at least one accommodation, or apply to all.")

    effective_all_rp = updates.get("applies_to_all_rate_plans", item.applies_to_all_rate_plans)
    effective_rp_ids = body.rate_plan_ids if body.rate_plan_ids is not None else [
        l.rate_plan_id for l in item.rate_plan_links
    ]
    if not effective_all_rp and not effective_rp_ids:
        raise HTTPException(status_code=422, detail="Select at least one rate plan, or apply to all.")

    if body.accommodation_ids is not None:
        await _validate_accommodation_ids(db, user.hotel_id, body.accommodation_ids)
    if body.rate_plan_ids is not None:
        await _validate_rate_plan_ids(db, user.hotel_id, body.rate_plan_ids)

    for field in (
        "name", "description", "category", "pricing_type", "unit_price",
        "is_taxable", "is_active", "display_order",
        "applies_to_all_accommodations", "applies_to_all_rate_plans",
        "available_at_booking", "available_at_checkin", "available_at_stay", "available_at_checkout",
    ):
        if field in updates:
            setattr(item, field, updates[field].strip() if field == "name" else updates[field])

    if body.accommodation_ids is not None or "applies_to_all_accommodations" in updates:
        await db.execute(delete(BillableItemAccommodation).where(BillableItemAccommodation.billable_item_id == item.id))
        if not item.applies_to_all_accommodations:
            for acc_id in effective_acc_ids:
                db.add(BillableItemAccommodation(billable_item_id=item.id, accommodation_id=acc_id))

    if body.rate_plan_ids is not None or "applies_to_all_rate_plans" in updates:
        await db.execute(delete(BillableItemRatePlan).where(BillableItemRatePlan.billable_item_id == item.id))
        if not item.applies_to_all_rate_plans:
            for rp_id in effective_rp_ids:
                db.add(BillableItemRatePlan(billable_item_id=item.id, rate_plan_id=rp_id))

    await db.commit()
    item = await _get_or_404(db, item.id, user.hotel_id)
    return _serialize(item, include_details=True)


@router.patch("/{item_id}/toggle")
async def toggle_billable_item_active(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = await _get_or_404(db, item_id, user.hotel_id)
    item.is_active = not item.is_active
    await db.commit()
    item = await _get_or_404(db, item.id, user.hotel_id)
    return _serialize(item, include_details=True)


@router.delete("/{item_id}")
async def delete_billable_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = await _get_or_404(db, item_id, user.hotel_id)
    item.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}
