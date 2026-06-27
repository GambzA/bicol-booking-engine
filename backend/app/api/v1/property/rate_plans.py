import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import joinedload, selectinload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.property_portal import (
    RatePlan, RatePlanAccommodation, RatePlanInclusion, Accommodation,
)

router = APIRouter(prefix="/rate-plans", tags=["property-rate-plans"])

VALID_PRICING_METHODS = {"fixed_price", "fixed_amount", "percentage"}


class RatePlanAccommodationInput(BaseModel):
    accommodation_id: uuid.UUID
    pricing_value: Decimal


class RatePlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True
    pricing_method: str = "fixed_price"
    display_order: int = 0
    accommodations: list[RatePlanAccommodationInput] = []
    inclusions: list[str] = []


class RatePlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    pricing_method: Optional[str] = None
    display_order: Optional[int] = None
    accommodations: Optional[list[RatePlanAccommodationInput]] = None
    inclusions: Optional[list[str]] = None


def _serialize(rp: RatePlan, include_details: bool = False) -> dict:
    data: dict = {
        "id": str(rp.id),
        "name": rp.name,
        "description": rp.description,
        "is_active": rp.is_active,
        "pricing_method": rp.pricing_method,
        "display_order": rp.display_order,
        "created_at": rp.created_at.isoformat(),
        "updated_at": rp.updated_at.isoformat(),
    }
    if include_details:
        data["accommodations"] = [
            {
                "id": str(rpa.id),
                "accommodation_id": str(rpa.accommodation_id),
                "accommodation_name": rpa.accommodation.name if rpa.accommodation else None,
                "pricing_value": str(rpa.pricing_value),
            }
            for rpa in rp.accommodations
        ]
        data["inclusions"] = [inc.inclusion_type for inc in rp.inclusions]
    return data


async def _get_or_404(
    db: AsyncSession,
    rate_plan_id: uuid.UUID,
    hotel_id: uuid.UUID,
) -> RatePlan:
    rp = (await db.execute(
        select(RatePlan).where(
            RatePlan.id == rate_plan_id,
            RatePlan.hotel_id == hotel_id,
            RatePlan.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if rp is None:
        raise HTTPException(status_code=404, detail="Rate plan not found")
    return rp


def _validate_pricing_values(
    pricing_method: str,
    accommodation_inputs: list[RatePlanAccommodationInput],
) -> None:
    for acc_input in accommodation_inputs:
        v = acc_input.pricing_value
        abs_v = abs(v)
        if pricing_method == "fixed_price":
            if v <= 0:
                raise HTTPException(
                    status_code=422,
                    detail=f"Fixed price must be greater than zero (accommodation {acc_input.accommodation_id})",
                )
        else:
            if abs_v == 0:
                raise HTTPException(
                    status_code=422,
                    detail=f"Adjustment value must not be zero (accommodation {acc_input.accommodation_id})",
                )
            if pricing_method == "percentage" and abs_v > 100:
                raise HTTPException(
                    status_code=422,
                    detail=f"Percentage adjustment cannot exceed 100% (accommodation {acc_input.accommodation_id})",
                )


async def _validate_accommodations(
    db: AsyncSession,
    hotel_id: uuid.UUID,
    accommodation_inputs: list[RatePlanAccommodationInput],
) -> None:
    for acc_input in accommodation_inputs:
        acc = (await db.execute(
            select(Accommodation).where(
                Accommodation.id == acc_input.accommodation_id,
                Accommodation.hotel_id == hotel_id,
                Accommodation.deleted_at.is_(None),
            )
        )).scalar_one_or_none()
        if acc is None:
            raise HTTPException(
                status_code=422,
                detail=f"Accommodation {acc_input.accommodation_id} not found or does not belong to this hotel",
            )


@router.get("")
async def list_rate_plans(
    search: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hotel_id = user.hotel_id
    base_where = [
        RatePlan.hotel_id == hotel_id,
        RatePlan.deleted_at.is_(None),
    ]
    if search:
        base_where.append(RatePlan.name.ilike(f"%{search}%"))
    if active is not None:
        base_where.append(RatePlan.is_active == active)

    total = (await db.execute(
        select(func.count(RatePlan.id)).where(*base_where)
    )).scalar() or 0

    plans = list((await db.execute(
        select(RatePlan)
        .where(*base_where)
        .order_by(RatePlan.display_order, RatePlan.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all())

    items = []
    for rp in plans:
        count = (await db.execute(
            select(func.count(RatePlanAccommodation.id)).where(
                RatePlanAccommodation.rate_plan_id == rp.id
            )
        )).scalar() or 0
        items.append({**_serialize(rp), "accommodation_count": count})

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/{rate_plan_id}")
async def get_rate_plan(
    rate_plan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rp = (await db.execute(
        select(RatePlan)
        .where(
            RatePlan.id == rate_plan_id,
            RatePlan.hotel_id == user.hotel_id,
            RatePlan.deleted_at.is_(None),
        )
        .options(
            selectinload(RatePlan.accommodations).joinedload(RatePlanAccommodation.accommodation),
            selectinload(RatePlan.inclusions),
        )
    )).scalar_one_or_none()
    if rp is None:
        raise HTTPException(status_code=404, detail="Rate plan not found")
    return _serialize(rp, include_details=True)


@router.post("")
async def create_rate_plan(
    body: RatePlanCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.pricing_method not in VALID_PRICING_METHODS:
        raise HTTPException(status_code=422, detail=f"Invalid pricing_method: {body.pricing_method}")
    if not body.accommodations:
        raise HTTPException(status_code=422, detail="At least one accommodation is required")

    _validate_pricing_values(body.pricing_method, body.accommodations)
    await _validate_accommodations(db, user.hotel_id, body.accommodations)

    rp = RatePlan(
        hotel_id=user.hotel_id,
        name=body.name,
        description=body.description,
        is_active=body.is_active,
        pricing_method=body.pricing_method,
        display_order=body.display_order,
    )
    db.add(rp)
    await db.flush()

    for acc_input in body.accommodations:
        db.add(RatePlanAccommodation(
            rate_plan_id=rp.id,
            accommodation_id=acc_input.accommodation_id,
            pricing_value=acc_input.pricing_value,
        ))

    for inclusion_type in body.inclusions:
        db.add(RatePlanInclusion(rate_plan_id=rp.id, inclusion_type=inclusion_type))

    await db.commit()
    await db.refresh(rp)
    return _serialize(rp)


@router.put("/{rate_plan_id}")
async def update_rate_plan(
    rate_plan_id: uuid.UUID,
    body: RatePlanUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rp = await _get_or_404(db, rate_plan_id, user.hotel_id)
    updates = body.model_dump(exclude_unset=True)

    if "pricing_method" in updates and updates["pricing_method"] not in VALID_PRICING_METHODS:
        raise HTTPException(status_code=422, detail=f"Invalid pricing_method: {updates['pricing_method']}")

    for field in ("name", "description", "is_active", "pricing_method", "display_order"):
        if field in updates:
            setattr(rp, field, updates[field])

    if body.accommodations is not None:
        if not body.accommodations:
            raise HTTPException(status_code=422, detail="At least one accommodation is required")
        effective_method = updates.get("pricing_method", rp.pricing_method)
        _validate_pricing_values(effective_method, body.accommodations)
        await _validate_accommodations(db, user.hotel_id, body.accommodations)
        await db.execute(
            delete(RatePlanAccommodation).where(RatePlanAccommodation.rate_plan_id == rp.id)
        )
        for acc_input in body.accommodations:
            db.add(RatePlanAccommodation(
                rate_plan_id=rp.id,
                accommodation_id=acc_input.accommodation_id,
                pricing_value=acc_input.pricing_value,
            ))

    if body.inclusions is not None:
        await db.execute(
            delete(RatePlanInclusion).where(RatePlanInclusion.rate_plan_id == rp.id)
        )
        for inclusion_type in body.inclusions:
            db.add(RatePlanInclusion(rate_plan_id=rp.id, inclusion_type=inclusion_type))

    await db.commit()
    await db.refresh(rp)
    return _serialize(rp)


@router.patch("/{rate_plan_id}/toggle")
async def toggle_rate_plan_active(
    rate_plan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rp = await _get_or_404(db, rate_plan_id, user.hotel_id)
    rp.is_active = not rp.is_active
    await db.commit()
    await db.refresh(rp)
    return _serialize(rp)


@router.delete("/{rate_plan_id}")
async def delete_rate_plan(
    rate_plan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rp = await _get_or_404(db, rate_plan_id, user.hotel_id)
    rp.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}
