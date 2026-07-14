import uuid
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.constants import AuditAction
from app.models.user import User
from app.models.property_portal import Accommodation, InventoryAdjustment
from app.services.inventory import (
    VALID_ADJUSTMENT_REASONS, daterange, reserved_by_date, net_adjustment_by_date,
    sellable as calc_sellable, available as calc_available, validate_adjustment,
)
from app.services.audit_service import log_audit

router = APIRouter(prefix="/inventory", tags=["property-inventory"])

MAX_RANGE_DAYS = 90


class AdjustmentCreate(BaseModel):
    accommodation_ids: list[uuid.UUID] = Field(min_length=1)
    start_date: date
    end_date: date
    adjustment_value: int
    reason: str
    notes: Optional[str] = None


class AdjustmentUpdate(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    adjustment_value: Optional[int] = None
    reason: Optional[str] = None
    notes: Optional[str] = None


class PreviewBody(BaseModel):
    accommodation_ids: list[uuid.UUID] = Field(min_length=1)
    start_date: date
    end_date: date
    adjustment_value: int


async def _acc_or_404(db: AsyncSession, accommodation_id: uuid.UUID, hotel_id: uuid.UUID) -> Accommodation:
    a = (await db.execute(
        select(Accommodation).where(
            Accommodation.id == accommodation_id,
            Accommodation.hotel_id == hotel_id,
            Accommodation.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=404, detail="Accommodation not found")
    return a


async def _load_accommodations(db: AsyncSession, hotel_id: uuid.UUID, accommodation_id: Optional[uuid.UUID]) -> list[Accommodation]:
    where = [Accommodation.hotel_id == hotel_id, Accommodation.deleted_at.is_(None), Accommodation.is_active.is_(True)]
    if accommodation_id is not None:
        where.append(Accommodation.id == accommodation_id)
    return list((await db.execute(
        select(Accommodation).where(*where).order_by(Accommodation.name)
    )).scalars().all())


def _clamp_range(date_from: Optional[date], date_to: Optional[date]) -> tuple[date, date]:
    today = date.today()
    start = date_from or today
    end = date_to or (start + timedelta(days=29))
    if end < start:
        end = start
    if (end - start).days > MAX_RANGE_DAYS - 1:
        end = start + timedelta(days=MAX_RANGE_DAYS - 1)
    return start, end


def _serialize_adjustment(a: InventoryAdjustment) -> dict:
    return {
        "id": str(a.id),
        "accommodation_id": str(a.accommodation_id),
        "accommodation_name": a.accommodation.name if a.accommodation else None,
        "start_date": a.start_date.isoformat(),
        "end_date": a.end_date.isoformat(),
        "adjustment_value": a.adjustment_value,
        "reason": a.reason,
        "notes": a.notes,
        "created_by_name": a.created_by.full_name if a.created_by else None,
        "created_at": a.created_at.isoformat(),
    }


@router.get("")
async def get_inventory(
    accommodation_id: Optional[uuid.UUID] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start, end = _clamp_range(date_from, date_to)
    accommodations = await _load_accommodations(db, user.hotel_id, accommodation_id)
    acc_ids = [a.id for a in accommodations]
    dates = daterange(start, end)

    reserved = await reserved_by_date(db, acc_ids, start, end)
    net_adj = await net_adjustment_by_date(db, acc_ids, start, end)

    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "dates": [d.isoformat() for d in dates],
        "accommodations": [
            {
                "id": str(a.id),
                "name": a.name,
                "total_units": a.num_units,
                "days": [
                    {
                        "date": d.isoformat(),
                        "total_units": a.num_units,
                        "reserved": reserved.get((a.id, d), 0),
                        "adjustments": net_adj.get((a.id, d), 0),
                        "sellable": calc_sellable(a.num_units, net_adj.get((a.id, d), 0)),
                        "available": calc_available(a.num_units, net_adj.get((a.id, d), 0), reserved.get((a.id, d), 0)),
                    }
                    for d in dates
                ],
            }
            for a in accommodations
        ],
    }


@router.get("/adjustments")
async def list_adjustments(
    accommodation_id: Optional[uuid.UUID] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    where = [InventoryAdjustment.hotel_id == user.hotel_id, InventoryAdjustment.deleted_at.is_(None)]
    if accommodation_id is not None:
        where.append(InventoryAdjustment.accommodation_id == accommodation_id)
    if date_from is not None:
        where.append(InventoryAdjustment.end_date >= date_from)
    if date_to is not None:
        where.append(InventoryAdjustment.start_date <= date_to)
    rows = list((await db.execute(
        select(InventoryAdjustment)
        .options(joinedload(InventoryAdjustment.accommodation), joinedload(InventoryAdjustment.created_by))
        .where(*where)
        .order_by(InventoryAdjustment.start_date.desc(), InventoryAdjustment.created_at.desc())
    )).scalars().all())
    return {"items": [_serialize_adjustment(a) for a in rows]}


@router.post("/adjustments/preview")
async def preview_adjustment(
    body: PreviewBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.end_date < body.start_date:
        raise HTTPException(status_code=422, detail="End date must be on or after start date.")
    dates = daterange(body.start_date, body.end_date)
    results = []
    for acc_id in body.accommodation_ids:
        a = await _acc_or_404(db, acc_id, user.hotel_id)
        reserved = await reserved_by_date(db, [a.id], body.start_date, body.end_date)
        net_adj = await net_adjustment_by_date(db, [a.id], body.start_date, body.end_date)
        results.append({
            "accommodation_id": str(a.id),
            "accommodation_name": a.name,
            "days": [
                {
                    "date": d.isoformat(),
                    "sellable_before": calc_sellable(a.num_units, net_adj.get((a.id, d), 0)),
                    "sellable_after": calc_sellable(a.num_units, net_adj.get((a.id, d), 0) + body.adjustment_value),
                    "available_before": calc_available(a.num_units, net_adj.get((a.id, d), 0), reserved.get((a.id, d), 0)),
                    "available_after": calc_available(a.num_units, net_adj.get((a.id, d), 0) + body.adjustment_value, reserved.get((a.id, d), 0)),
                }
                for d in dates
            ],
        })
    return {"accommodations": results}


@router.post("/adjustments")
async def create_adjustment(
    body: AdjustmentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.reason not in VALID_ADJUSTMENT_REASONS:
        raise HTTPException(status_code=422, detail=f"Invalid reason: {body.reason}")
    if body.end_date < body.start_date:
        raise HTTPException(status_code=422, detail="End date must be on or after start date.")
    if body.adjustment_value == 0:
        raise HTTPException(status_code=422, detail="Adjustment value cannot be zero.")

    created: list[InventoryAdjustment] = []
    for acc_id in body.accommodation_ids:
        a = await _acc_or_404(db, acc_id, user.hotel_id)
        await validate_adjustment(db, a, body.start_date, body.end_date, body.adjustment_value)
        adj = InventoryAdjustment(
            hotel_id=user.hotel_id,
            accommodation_id=a.id,
            start_date=body.start_date,
            end_date=body.end_date,
            adjustment_value=body.adjustment_value,
            reason=body.reason,
            notes=body.notes,
            created_by_user_id=user.id,
        )
        db.add(adj)
        created.append(adj)

    await log_audit(
        db, action=AuditAction.INVENTORY_ADJUSTED, entity_type="inventory_adjustment", entity_id=None,
        hotel_id=user.hotel_id, user_id=user.id,
        after_state={"accommodation_ids": [str(i) for i in body.accommodation_ids], "value": body.adjustment_value,
                     "start": body.start_date.isoformat(), "end": body.end_date.isoformat()},
    )
    await db.commit()
    for adj in created:
        await db.refresh(adj)
    ids = [adj.id for adj in created]
    rows = list((await db.execute(
        select(InventoryAdjustment)
        .options(joinedload(InventoryAdjustment.accommodation), joinedload(InventoryAdjustment.created_by))
        .where(InventoryAdjustment.id.in_(ids))
    )).scalars().all())
    return {"items": [_serialize_adjustment(a) for a in rows]}


@router.put("/adjustments/{adjustment_id}")
async def update_adjustment(
    adjustment_id: uuid.UUID,
    body: AdjustmentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    adj = (await db.execute(
        select(InventoryAdjustment).where(
            InventoryAdjustment.id == adjustment_id,
            InventoryAdjustment.hotel_id == user.hotel_id,
            InventoryAdjustment.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if adj is None:
        raise HTTPException(status_code=404, detail="Adjustment not found")

    start = body.start_date if body.start_date is not None else adj.start_date
    end = body.end_date if body.end_date is not None else adj.end_date
    value = body.adjustment_value if body.adjustment_value is not None else adj.adjustment_value
    reason = body.reason if body.reason is not None else adj.reason
    if reason not in VALID_ADJUSTMENT_REASONS:
        raise HTTPException(status_code=422, detail=f"Invalid reason: {reason}")
    if value == 0:
        raise HTTPException(status_code=422, detail="Adjustment value cannot be zero.")

    a = await _acc_or_404(db, adj.accommodation_id, user.hotel_id)
    await validate_adjustment(db, a, start, end, value, exclude_adjustment_id=adj.id)

    adj.start_date = start
    adj.end_date = end
    adj.adjustment_value = value
    adj.reason = reason
    if body.notes is not None:
        adj.notes = body.notes

    await log_audit(
        db, action=AuditAction.INVENTORY_ADJUSTED, entity_type="inventory_adjustment", entity_id=str(adj.id),
        hotel_id=user.hotel_id, user_id=user.id,
        after_state={"value": value, "start": start.isoformat(), "end": end.isoformat()},
    )
    await db.commit()
    adj = (await db.execute(
        select(InventoryAdjustment)
        .options(joinedload(InventoryAdjustment.accommodation), joinedload(InventoryAdjustment.created_by))
        .where(InventoryAdjustment.id == adj.id)
    )).scalar_one()
    return _serialize_adjustment(adj)


@router.delete("/adjustments/{adjustment_id}")
async def delete_adjustment(
    adjustment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    adj = (await db.execute(
        select(InventoryAdjustment).where(
            InventoryAdjustment.id == adjustment_id,
            InventoryAdjustment.hotel_id == user.hotel_id,
            InventoryAdjustment.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if adj is None:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    await db.delete(adj)
    await log_audit(
        db, action=AuditAction.INVENTORY_ADJUSTMENT_REMOVED, entity_type="inventory_adjustment", entity_id=str(adjustment_id),
        hotel_id=user.hotel_id, user_id=user.id,
    )
    await db.commit()
    return {"ok": True}
