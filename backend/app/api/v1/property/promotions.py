import uuid
from datetime import datetime, timezone, date
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
from app.models.property_portal import (
    Promotion, PromotionAccommodation, PromotionRatePlan,
    Accommodation, RatePlan,
)

router = APIRouter(prefix="/promotions", tags=["property-promotions"])

VALID_DISCOUNT_TYPES = {"percentage", "fixed_amount"}


class PromotionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True
    discount_type: str
    discount_value: Decimal
    stay_start_date: Optional[date] = None
    stay_end_date: Optional[date] = None
    booking_start_date: Optional[date] = None
    booking_end_date: Optional[date] = None
    promo_code: Optional[str] = None
    accommodation_ids: list[uuid.UUID]
    rate_plan_ids: list[uuid.UUID] = []


class PromotionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    discount_type: Optional[str] = None
    discount_value: Optional[Decimal] = None
    stay_start_date: Optional[date] = None
    stay_end_date: Optional[date] = None
    booking_start_date: Optional[date] = None
    booking_end_date: Optional[date] = None
    promo_code: Optional[str] = None
    accommodation_ids: Optional[list[uuid.UUID]] = None
    rate_plan_ids: Optional[list[uuid.UUID]] = None


def _serialize(promo: Promotion, include_details: bool = False) -> dict:
    data: dict = {
        "id": str(promo.id),
        "name": promo.name,
        "description": promo.description,
        "is_active": promo.is_active,
        "discount_type": promo.discount_type,
        "discount_value": str(promo.discount_value),
        "stay_start_date": promo.stay_start_date.isoformat() if promo.stay_start_date else None,
        "stay_end_date": promo.stay_end_date.isoformat() if promo.stay_end_date else None,
        "booking_start_date": promo.booking_start_date.isoformat() if promo.booking_start_date else None,
        "booking_end_date": promo.booking_end_date.isoformat() if promo.booking_end_date else None,
        "promo_code": promo.promo_code,
        "created_at": promo.created_at.isoformat(),
        "updated_at": promo.updated_at.isoformat(),
    }
    if include_details:
        data["accommodations"] = [
            {
                "id": str(link.accommodation_id),
                "name": link.accommodation.name if link.accommodation else None,
            }
            for link in promo.accommodation_links
        ]
        data["rate_plans"] = [
            {
                "id": str(link.rate_plan_id),
                "name": link.rate_plan.name if link.rate_plan else None,
            }
            for link in promo.rate_plan_links
        ]
    return data


async def _get_or_404(db: AsyncSession, promotion_id: uuid.UUID, hotel_id: uuid.UUID) -> Promotion:
    promo = (await db.execute(
        select(Promotion).where(
            Promotion.id == promotion_id,
            Promotion.hotel_id == hotel_id,
            Promotion.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if promo is None:
        raise HTTPException(status_code=404, detail="Promotion not found")
    return promo


def _validate_discount(discount_type: str, discount_value: Decimal) -> None:
    if discount_type not in VALID_DISCOUNT_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid discount_type: {discount_type}")
    if discount_value <= 0:
        raise HTTPException(status_code=422, detail="Discount value must be greater than zero")
    if discount_type == "percentage" and discount_value > 100:
        raise HTTPException(status_code=422, detail="Percentage discount cannot exceed 100%")


def _validate_date_range(start: Optional[date], end: Optional[date], label: str) -> None:
    if start and end and start > end:
        raise HTTPException(status_code=422, detail=f"{label} start date cannot be later than end date")


async def _validate_accommodation_ids(
    db: AsyncSession, hotel_id: uuid.UUID, accommodation_ids: list[uuid.UUID]
) -> None:
    for acc_id in accommodation_ids:
        acc = (await db.execute(
            select(Accommodation).where(
                Accommodation.id == acc_id,
                Accommodation.hotel_id == hotel_id,
                Accommodation.deleted_at.is_(None),
            )
        )).scalar_one_or_none()
        if acc is None:
            raise HTTPException(
                status_code=422,
                detail=f"Accommodation {acc_id} not found or does not belong to this hotel",
            )


async def _validate_rate_plan_ids(
    db: AsyncSession, hotel_id: uuid.UUID, rate_plan_ids: list[uuid.UUID]
) -> None:
    for rp_id in rate_plan_ids:
        rp = (await db.execute(
            select(RatePlan).where(
                RatePlan.id == rp_id,
                RatePlan.hotel_id == hotel_id,
                RatePlan.deleted_at.is_(None),
            )
        )).scalar_one_or_none()
        if rp is None:
            raise HTTPException(
                status_code=422,
                detail=f"Rate plan {rp_id} not found or does not belong to this hotel",
            )


async def _check_promo_code_unique(
    db: AsyncSession,
    hotel_id: uuid.UUID,
    promo_code: str,
    exclude_id: Optional[uuid.UUID] = None,
) -> None:
    q = select(Promotion).where(
        Promotion.hotel_id == hotel_id,
        Promotion.promo_code == promo_code,
        Promotion.deleted_at.is_(None),
    )
    if exclude_id:
        q = q.where(Promotion.id != exclude_id)
    existing = (await db.execute(q)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=422, detail=f"Promo code '{promo_code}' is already in use")


@router.get("")
async def list_promotions(
    search: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hotel_id = user.hotel_id
    base_where = [
        Promotion.hotel_id == hotel_id,
        Promotion.deleted_at.is_(None),
    ]
    if search:
        base_where.append(Promotion.name.ilike(f"%{search}%"))
    if active is not None:
        base_where.append(Promotion.is_active == active)

    total = (await db.execute(
        select(func.count(Promotion.id)).where(*base_where)
    )).scalar() or 0

    promos = list((await db.execute(
        select(Promotion)
        .where(*base_where)
        .order_by(Promotion.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all())

    items = []
    for promo in promos:
        count = (await db.execute(
            select(func.count(PromotionAccommodation.id)).where(
                PromotionAccommodation.promotion_id == promo.id
            )
        )).scalar() or 0
        items.append({**_serialize(promo), "accommodation_count": count})

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/{promotion_id}")
async def get_promotion(
    promotion_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    promo = (await db.execute(
        select(Promotion)
        .where(
            Promotion.id == promotion_id,
            Promotion.hotel_id == user.hotel_id,
            Promotion.deleted_at.is_(None),
        )
        .options(
            selectinload(Promotion.accommodation_links).joinedload(PromotionAccommodation.accommodation),
            selectinload(Promotion.rate_plan_links).joinedload(PromotionRatePlan.rate_plan),
        )
    )).scalar_one_or_none()
    if promo is None:
        raise HTTPException(status_code=404, detail="Promotion not found")
    return _serialize(promo, include_details=True)


@router.post("")
async def create_promotion(
    body: PromotionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _validate_discount(body.discount_type, body.discount_value)
    _validate_date_range(body.stay_start_date, body.stay_end_date, "Stay period")
    _validate_date_range(body.booking_start_date, body.booking_end_date, "Booking window")

    if not body.accommodation_ids:
        raise HTTPException(status_code=422, detail="At least one accommodation is required")

    await _validate_accommodation_ids(db, user.hotel_id, body.accommodation_ids)
    await _validate_rate_plan_ids(db, user.hotel_id, body.rate_plan_ids)

    if body.promo_code:
        await _check_promo_code_unique(db, user.hotel_id, body.promo_code)

    promo = Promotion(
        hotel_id=user.hotel_id,
        name=body.name,
        description=body.description,
        is_active=body.is_active,
        discount_type=body.discount_type,
        discount_value=body.discount_value,
        stay_start_date=body.stay_start_date,
        stay_end_date=body.stay_end_date,
        booking_start_date=body.booking_start_date,
        booking_end_date=body.booking_end_date,
        promo_code=body.promo_code or None,
    )
    db.add(promo)
    await db.flush()

    for acc_id in body.accommodation_ids:
        db.add(PromotionAccommodation(promotion_id=promo.id, accommodation_id=acc_id))

    for rp_id in body.rate_plan_ids:
        db.add(PromotionRatePlan(promotion_id=promo.id, rate_plan_id=rp_id))

    await db.commit()
    await db.refresh(promo)
    return _serialize(promo)


@router.put("/{promotion_id}")
async def update_promotion(
    promotion_id: uuid.UUID,
    body: PromotionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    promo = await _get_or_404(db, promotion_id, user.hotel_id)
    updates = body.model_dump(exclude_unset=True)

    effective_discount_type = updates.get("discount_type", promo.discount_type)
    effective_discount_value = updates.get("discount_value", promo.discount_value)
    _validate_discount(effective_discount_type, effective_discount_value)

    effective_stay_start = updates.get("stay_start_date", promo.stay_start_date)
    effective_stay_end = updates.get("stay_end_date", promo.stay_end_date)
    _validate_date_range(effective_stay_start, effective_stay_end, "Stay period")

    effective_booking_start = updates.get("booking_start_date", promo.booking_start_date)
    effective_booking_end = updates.get("booking_end_date", promo.booking_end_date)
    _validate_date_range(effective_booking_start, effective_booking_end, "Booking window")

    if "promo_code" in updates and updates["promo_code"]:
        await _check_promo_code_unique(db, user.hotel_id, updates["promo_code"], exclude_id=promotion_id)

    for field in (
        "name", "description", "is_active", "discount_type", "discount_value",
        "stay_start_date", "stay_end_date", "booking_start_date", "booking_end_date", "promo_code",
    ):
        if field in updates:
            setattr(promo, field, updates[field] or None if field == "promo_code" else updates[field])

    if body.accommodation_ids is not None:
        if not body.accommodation_ids:
            raise HTTPException(status_code=422, detail="At least one accommodation is required")
        await _validate_accommodation_ids(db, user.hotel_id, body.accommodation_ids)
        await db.execute(
            delete(PromotionAccommodation).where(PromotionAccommodation.promotion_id == promo.id)
        )
        for acc_id in body.accommodation_ids:
            db.add(PromotionAccommodation(promotion_id=promo.id, accommodation_id=acc_id))

    if body.rate_plan_ids is not None:
        await _validate_rate_plan_ids(db, user.hotel_id, body.rate_plan_ids)
        await db.execute(
            delete(PromotionRatePlan).where(PromotionRatePlan.promotion_id == promo.id)
        )
        for rp_id in body.rate_plan_ids:
            db.add(PromotionRatePlan(promotion_id=promo.id, rate_plan_id=rp_id))

    await db.commit()
    await db.refresh(promo)
    return _serialize(promo)


@router.patch("/{promotion_id}/toggle")
async def toggle_promotion_active(
    promotion_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    promo = await _get_or_404(db, promotion_id, user.hotel_id)
    promo.is_active = not promo.is_active
    await db.commit()
    await db.refresh(promo)
    return _serialize(promo)


@router.delete("/{promotion_id}")
async def delete_promotion(
    promotion_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    promo = await _get_or_404(db, promotion_id, user.hotel_id)
    promo.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}
