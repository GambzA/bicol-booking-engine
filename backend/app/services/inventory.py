"""Accommodation-level inventory availability (by date).

Availability is managed only at the accommodation level -- never per unit.
For each accommodation and date:

    Sellable Inventory = Total Units (num_units) + net Inventory Adjustments
    Available Units     = Sellable Inventory - Reserved Units

Reserved is derived live from active bookings (nothing to sync -- creating,
cancelling, or modifying a booking changes what this query returns), so the
booking-integration requirements fall out for free. Adjustments are signed
range rows in ``inventory_adjustments``; the per-date net is the sum of all
rows whose [start_date, end_date] covers that date.
"""
import uuid
from datetime import date, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.property_portal import (
    Accommodation, Booking, BookingRoom, InventoryAdjustment,
)
from app.services.pricing import ACTIVE_BOOKING_STATUSES

VALID_ADJUSTMENT_REASONS = {
    "maintenance", "renovation", "operational", "event_hold", "overbooking_buffer", "other",
}


def daterange(start: date, end: date) -> list[date]:
    """Inclusive list of dates from start to end."""
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


async def reserved_by_date(
    db: AsyncSession,
    accommodation_ids: list[uuid.UUID],
    start: date,
    end: date,
    exclude_booking_id: Optional[uuid.UUID] = None,
) -> dict[tuple[uuid.UUID, date], int]:
    """Count of active BookingRooms of each accommodation occupying each night
    in [start, end] (inclusive). Each booked room holds one unit for every night
    check_in <= night < check_out."""
    if not accommodation_ids:
        return {}
    q = (
        select(BookingRoom.accommodation_id, Booking.check_in_date, Booking.check_out_date)
        .join(Booking, BookingRoom.booking_id == Booking.id)
        .where(
            BookingRoom.accommodation_id.in_(accommodation_ids),
            Booking.deleted_at.is_(None),
            Booking.status.in_(ACTIVE_BOOKING_STATUSES),
            Booking.check_out_date > start,
            Booking.check_in_date <= end,
        )
    )
    if exclude_booking_id is not None:
        q = q.where(Booking.id != exclude_booking_id)
    rows = list((await db.execute(q)).all())

    counts: dict[tuple[uuid.UUID, date], int] = {}
    for acc_id, ci, co in rows:
        night = max(ci, start)
        last = min(co - timedelta(days=1), end)
        while night <= last:
            counts[(acc_id, night)] = counts.get((acc_id, night), 0) + 1
            night += timedelta(days=1)
    return counts


async def net_adjustment_by_date(
    db: AsyncSession,
    accommodation_ids: list[uuid.UUID],
    start: date,
    end: date,
    exclude_adjustment_id: Optional[uuid.UUID] = None,
) -> dict[tuple[uuid.UUID, date], int]:
    """Per-date signed sum of adjustment_value for each accommodation, over any
    adjustment row whose [start_date, end_date] overlaps [start, end]."""
    if not accommodation_ids:
        return {}
    q = select(InventoryAdjustment).where(
        InventoryAdjustment.accommodation_id.in_(accommodation_ids),
        InventoryAdjustment.deleted_at.is_(None),
        InventoryAdjustment.start_date <= end,
        InventoryAdjustment.end_date >= start,
    )
    if exclude_adjustment_id is not None:
        q = q.where(InventoryAdjustment.id != exclude_adjustment_id)
    adjustments = list((await db.execute(q)).scalars().all())

    net: dict[tuple[uuid.UUID, date], int] = {}
    for adj in adjustments:
        lo = max(adj.start_date, start)
        hi = min(adj.end_date, end)
        d = lo
        while d <= hi:
            net[(adj.accommodation_id, d)] = net.get((adj.accommodation_id, d), 0) + adj.adjustment_value
            d += timedelta(days=1)
    return net


def sellable(total_units: int, net_adj: int) -> int:
    return max(0, total_units + net_adj)


def available(total_units: int, net_adj: int, reserved: int) -> int:
    return max(0, sellable(total_units, net_adj) - reserved)


async def validate_adjustment(
    db: AsyncSession,
    accommodation: Accommodation,
    start: date,
    end: date,
    value: int,
    exclude_adjustment_id: Optional[uuid.UUID] = None,
) -> None:
    """Reject an adjustment that would push sellable inventory below zero on any
    date in its range (spec: sellable inventory cannot be reduced below zero)."""
    if end < start:
        raise HTTPException(status_code=422, detail="End date must be on or after start date.")
    existing = await net_adjustment_by_date(
        db, [accommodation.id], start, end, exclude_adjustment_id=exclude_adjustment_id
    )
    for d in daterange(start, end):
        net = existing.get((accommodation.id, d), 0) + value
        if accommodation.num_units + net < 0:
            raise HTTPException(
                status_code=422,
                detail=f"Adjustment would reduce sellable inventory below zero on {d.isoformat()}.",
            )
