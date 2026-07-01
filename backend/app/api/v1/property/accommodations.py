import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.property_portal import (
    Accommodation, AccommodationChildPolicy, AccommodationType,
    AccommodationUnitAvailability, AccommodationRateOverride, Booking, BookingRoom, BookingStatus,
)

router = APIRouter(prefix="/accommodations", tags=["property-accommodations"])


class ChildPolicyIn(BaseModel):
    min_age: int
    max_age: int
    charge_type: str
    charge_value: Optional[Decimal] = None
    sort_order: int = 0


class AccommodationCreate(BaseModel):
    name: str
    accommodation_type: str = "room"
    description: Optional[str] = None
    num_units: int = 1
    base_occupancy: int = 1
    max_occupancy: int = 2
    max_adults: Optional[int] = None
    max_children: Optional[int] = None
    base_rate: Decimal
    weekend_rate: Optional[Decimal] = None
    additional_adult_fee: Decimal = Decimal("0.00")
    additional_adult_requires_extra_bed: bool = False
    extra_bed_fee: Optional[Decimal] = None
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    unit_prefix: Optional[int] = None
    amenities: Optional[list[Any]] = None
    images: Optional[list[Any]] = None
    child_policies: list[ChildPolicyIn] = []


class AccommodationUpdate(BaseModel):
    name: Optional[str] = None
    accommodation_type: Optional[str] = None
    description: Optional[str] = None
    num_units: Optional[int] = None
    base_occupancy: Optional[int] = None
    max_occupancy: Optional[int] = None
    max_adults: Optional[int] = None
    max_children: Optional[int] = None
    base_rate: Optional[Decimal] = None
    weekend_rate: Optional[Decimal] = None
    additional_adult_fee: Optional[Decimal] = None
    additional_adult_requires_extra_bed: Optional[bool] = None
    extra_bed_fee: Optional[Decimal] = None
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    unit_prefix: Optional[int] = None
    amenities: Optional[list[Any]] = None
    images: Optional[list[Any]] = None
    child_policies: Optional[list[ChildPolicyIn]] = None


def _serialize_child_policy(p: AccommodationChildPolicy) -> dict:
    return {
        "id": str(p.id),
        "min_age": p.min_age,
        "max_age": p.max_age,
        "charge_type": p.charge_type,
        "charge_value": str(p.charge_value) if p.charge_value is not None else None,
        "sort_order": p.sort_order,
    }


def _serialize(a: Accommodation) -> dict:
    return {
        "id": str(a.id),
        "name": a.name,
        "accommodation_type": a.accommodation_type.value,
        "description": a.description,
        "num_units": a.num_units,
        "base_occupancy": a.base_occupancy,
        "max_occupancy": a.max_occupancy,
        "max_adults": a.max_adults,
        "max_children": a.max_children,
        "base_rate": str(a.base_rate),
        "weekend_rate": str(a.weekend_rate) if a.weekend_rate is not None else None,
        "additional_adult_fee": str(a.additional_adult_fee),
        "additional_adult_requires_extra_bed": a.additional_adult_requires_extra_bed,
        "extra_bed_fee": str(a.extra_bed_fee) if a.extra_bed_fee is not None else None,
        "is_active": a.is_active,
        "check_in_time": a.check_in_time,
        "check_out_time": a.check_out_time,
        "unit_prefix": a.unit_prefix,
        "amenities": a.amenities or [],
        "images": a.images or [],
        "child_policies": [_serialize_child_policy(p) for p in (a.child_policies or [])],
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
    }


async def _get_or_404(
    db: AsyncSession,
    accommodation_id: uuid.UUID,
    hotel_id: uuid.UUID,
) -> Accommodation:
    a = (await db.execute(
        select(Accommodation)
        .options(selectinload(Accommodation.child_policies))
        .where(
            Accommodation.id == accommodation_id,
            Accommodation.hotel_id == hotel_id,
            Accommodation.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=404, detail="Accommodation not found")
    return a


@router.get("")
async def list_accommodations(
    search: Optional[str] = Query(None),
    accommodation_type: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hotel_id = user.hotel_id
    base_where = [
        Accommodation.hotel_id == hotel_id,
        Accommodation.deleted_at.is_(None),
    ]
    if search:
        base_where.append(Accommodation.name.ilike(f"%{search}%"))
    if accommodation_type:
        base_where.append(Accommodation.accommodation_type == accommodation_type)
    if active is not None:
        base_where.append(Accommodation.is_active == active)

    total = (await db.execute(
        select(func.count(Accommodation.id)).where(*base_where)
    )).scalar() or 0

    items = list((await db.execute(
        select(Accommodation)
        .options(selectinload(Accommodation.child_policies))
        .where(*base_where)
        .order_by(Accommodation.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all())

    return {
        "items": [_serialize(a) for a in items],
        "total": total,
        "page": page,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/availability")
async def get_availability(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hotel_id = user.hotel_id
    today = date.today()
    if start_date is None:
        start_date = today
    if end_date is None:
        end_date = today + timedelta(days=29)
    if (end_date - start_date).days > 90:
        end_date = start_date + timedelta(days=89)

    accommodations = list((await db.execute(
        select(Accommodation)
        .where(
            Accommodation.hotel_id == hotel_id,
            Accommodation.is_active.is_(True),
            Accommodation.deleted_at.is_(None),
        )
        .order_by(Accommodation.name)
    )).scalars().all())

    # Each booked room occupies one unit of its accommodation.
    bookings = list((await db.execute(
        select(BookingRoom.accommodation_id, Booking.check_in_date, Booking.check_out_date)
        .join(Booking, BookingRoom.booking_id == Booking.id)
        .where(
            Booking.hotel_id == hotel_id,
            Booking.deleted_at.is_(None),
            Booking.status.in_([
                BookingStatus.PENDING,
                BookingStatus.PENDING_PAYMENT,
                BookingStatus.CONFIRMED,
                BookingStatus.CHECKED_IN,
            ]),
            Booking.check_out_date > start_date,
            Booking.check_in_date < end_date + timedelta(days=1),
        )
    )).all())

    date_list: list[date] = [
        start_date + timedelta(days=i)
        for i in range((end_date - start_date).days + 1)
    ]

    booked: dict[str, dict[date, int]] = {
        str(a.id): {d: 0 for d in date_list} for a in accommodations
    }

    for b in bookings:
        acc_id = str(b.accommodation_id)
        if acc_id not in booked:
            continue
        b_start = max(b.check_in_date, start_date)
        b_end = min(b.check_out_date, end_date + timedelta(days=1))
        d = b_start
        while d < b_end:
            if d in booked[acc_id]:
                booked[acc_id][d] += 1
            d += timedelta(days=1)

    return {
        "start_date": str(start_date),
        "end_date": str(end_date),
        "dates": [str(d) for d in date_list],
        "accommodations": [
            {
                "id": str(a.id),
                "name": a.name,
                "accommodation_type": a.accommodation_type.value,
                "num_units": a.num_units,
                "availability": {
                    str(d): {
                        "booked": booked[str(a.id)][d],
                        "available": max(0, a.num_units - booked[str(a.id)][d]),
                    }
                    for d in date_list
                },
            }
            for a in accommodations
        ],
    }


@router.post("")
async def create_accommodation(
    body: AccommodationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        acc_type = AccommodationType(body.accommodation_type)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid accommodation_type: {body.accommodation_type}")

    accommodation = Accommodation(
        hotel_id=user.hotel_id,
        name=body.name,
        accommodation_type=acc_type,
        description=body.description,
        num_units=body.num_units,
        base_occupancy=body.base_occupancy,
        max_occupancy=body.max_occupancy,
        max_adults=body.max_adults,
        max_children=body.max_children,
        base_rate=body.base_rate,
        weekend_rate=body.weekend_rate,
        additional_adult_fee=body.additional_adult_fee,
        additional_adult_requires_extra_bed=body.additional_adult_requires_extra_bed,
        extra_bed_fee=body.extra_bed_fee,
        check_in_time=body.check_in_time,
        check_out_time=body.check_out_time,
        unit_prefix=body.unit_prefix,
        amenities=body.amenities,
        images=body.images or [],
    )
    db.add(accommodation)
    await db.flush()

    for i, policy in enumerate(body.child_policies):
        db.add(AccommodationChildPolicy(
            accommodation_id=accommodation.id,
            min_age=policy.min_age,
            max_age=policy.max_age,
            charge_type=policy.charge_type,
            charge_value=policy.charge_value,
            sort_order=policy.sort_order if policy.sort_order else i,
        ))

    await db.commit()
    await db.refresh(accommodation)
    await db.execute(
        select(AccommodationChildPolicy)
        .where(AccommodationChildPolicy.accommodation_id == accommodation.id)
    )
    return _serialize(await _get_or_404(db, accommodation.id, user.hotel_id))


class UnitAvailabilityRecord(BaseModel):
    unit_number: int
    date: date
    is_available: bool


@router.get("/{accommodation_id}/unit-availability")
async def get_unit_availability(
    accommodation_id: uuid.UUID,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = await _get_or_404(db, accommodation_id, user.hotel_id)
    today = date.today()
    if start_date is None:
        start_date = today
    if end_date is None:
        end_date = today + timedelta(days=9)
    if (end_date - start_date).days > 29:
        end_date = start_date + timedelta(days=29)
    if end_date < start_date:
        end_date = start_date

    date_list: list[date] = [
        start_date + timedelta(days=i)
        for i in range((end_date - start_date).days + 1)
    ]

    records = list((await db.execute(
        select(AccommodationUnitAvailability).where(
            AccommodationUnitAvailability.accommodation_id == accommodation_id,
            AccommodationUnitAvailability.date >= start_date,
            AccommodationUnitAvailability.date <= end_date,
        )
    )).scalars().all())

    lookup: dict[int, dict[str, bool]] = {}
    for r in records:
        lookup.setdefault(r.unit_number, {})[str(r.date)] = r.is_available

    return {
        "accommodation_id": str(a.id),
        "name": a.name,
        "num_units": a.num_units,
        "start_date": str(start_date),
        "end_date": str(end_date),
        "dates": [str(d) for d in date_list],
        "units": [
            {
                "unit_number": u,
                "availability": {
                    str(d): lookup.get(u, {}).get(str(d), True)
                    for d in date_list
                },
            }
            for u in range(1, a.num_units + 1)
        ],
        "unit_prefix": a.unit_prefix,
    }


@router.put("/{accommodation_id}/unit-availability")
async def set_unit_availability(
    accommodation_id: uuid.UUID,
    body: list[UnitAvailabilityRecord],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = await _get_or_404(db, accommodation_id, user.hotel_id)

    for record in body:
        if record.unit_number < 1 or record.unit_number > a.num_units:
            raise HTTPException(
                status_code=422,
                detail=f"unit_number {record.unit_number} out of range (1-{a.num_units})",
            )
        existing = (await db.execute(
            select(AccommodationUnitAvailability).where(
                AccommodationUnitAvailability.accommodation_id == accommodation_id,
                AccommodationUnitAvailability.unit_number == record.unit_number,
                AccommodationUnitAvailability.date == record.date,
            )
        )).scalar_one_or_none()
        if existing:
            existing.is_available = record.is_available
        else:
            db.add(AccommodationUnitAvailability(
                accommodation_id=accommodation_id,
                unit_number=record.unit_number,
                date=record.date,
                is_available=record.is_available,
            ))

    await db.commit()
    return {"ok": True, "updated": len(body)}


class RateCalendarRecord(BaseModel):
    date: date
    rate: Decimal


class DeleteRateOverridesBody(BaseModel):
    dates: list[date]


@router.get("/{accommodation_id}/rate-calendar")
async def get_rate_calendar(
    accommodation_id: uuid.UUID,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = await _get_or_404(db, accommodation_id, user.hotel_id)
    today = date.today()
    if start_date is None:
        start_date = today
    if end_date is None:
        end_date = today + timedelta(days=29)
    if (end_date - start_date).days > 29:
        end_date = start_date + timedelta(days=29)
    if end_date < start_date:
        end_date = start_date

    date_list: list[date] = [
        start_date + timedelta(days=i)
        for i in range((end_date - start_date).days + 1)
    ]

    records = list((await db.execute(
        select(AccommodationRateOverride).where(
            AccommodationRateOverride.accommodation_id == accommodation_id,
            AccommodationRateOverride.date >= start_date,
            AccommodationRateOverride.date <= end_date,
        )
    )).scalars().all())

    override_map: dict[date, Decimal] = {r.date: r.rate for r in records}

    def default_rate(d: date) -> Decimal:
        if d.weekday() >= 5 and a.weekend_rate is not None:
            return a.weekend_rate
        return a.base_rate

    return {
        "accommodation_id": str(a.id),
        "name": a.name,
        "base_rate": str(a.base_rate),
        "weekend_rate": str(a.weekend_rate) if a.weekend_rate is not None else None,
        "start_date": str(start_date),
        "end_date": str(end_date),
        "dates": [str(d) for d in date_list],
        "rates": {
            str(d): str(override_map[d]) if d in override_map else str(default_rate(d))
            for d in date_list
        },
        "overridden_dates": [str(d) for d in override_map],
    }


@router.put("/{accommodation_id}/rate-calendar")
async def set_rate_calendar(
    accommodation_id: uuid.UUID,
    body: list[RateCalendarRecord],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _get_or_404(db, accommodation_id, user.hotel_id)
    for record in body:
        existing = (await db.execute(
            select(AccommodationRateOverride).where(
                AccommodationRateOverride.accommodation_id == accommodation_id,
                AccommodationRateOverride.date == record.date,
            )
        )).scalar_one_or_none()
        if existing:
            existing.rate = record.rate
        else:
            db.add(AccommodationRateOverride(
                accommodation_id=accommodation_id,
                date=record.date,
                rate=record.rate,
            ))
    await db.commit()
    return {"ok": True, "updated": len(body)}


@router.delete("/{accommodation_id}/rate-calendar")
async def delete_rate_overrides(
    accommodation_id: uuid.UUID,
    body: DeleteRateOverridesBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _get_or_404(db, accommodation_id, user.hotel_id)
    await db.execute(
        delete(AccommodationRateOverride).where(
            AccommodationRateOverride.accommodation_id == accommodation_id,
            AccommodationRateOverride.date.in_(body.dates),
        )
    )
    await db.commit()
    return {"ok": True}


@router.get("/{accommodation_id}")
async def get_accommodation(
    accommodation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = await _get_or_404(db, accommodation_id, user.hotel_id)
    return _serialize(a)


@router.put("/{accommodation_id}")
async def update_accommodation(
    accommodation_id: uuid.UUID,
    body: AccommodationUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = await _get_or_404(db, accommodation_id, user.hotel_id)
    updates = body.model_dump(exclude_unset=True)

    if "accommodation_type" in updates:
        try:
            updates["accommodation_type"] = AccommodationType(updates["accommodation_type"])
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid accommodation_type: {updates['accommodation_type']}")

    new_policies = updates.pop("child_policies", None)

    for key, value in updates.items():
        setattr(a, key, value)

    if new_policies is not None:
        await db.execute(
            delete(AccommodationChildPolicy).where(
                AccommodationChildPolicy.accommodation_id == accommodation_id
            )
        )
        for i, policy in enumerate(new_policies):
            db.add(AccommodationChildPolicy(
                accommodation_id=accommodation_id,
                min_age=policy["min_age"],
                max_age=policy["max_age"],
                charge_type=policy["charge_type"],
                charge_value=policy.get("charge_value"),
                sort_order=policy.get("sort_order", i),
            ))

    await db.commit()
    return _serialize(await _get_or_404(db, accommodation_id, user.hotel_id))


@router.patch("/{accommodation_id}/toggle")
async def toggle_active(
    accommodation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = await _get_or_404(db, accommodation_id, user.hotel_id)
    a.is_active = not a.is_active
    await db.commit()
    await db.refresh(a)
    return _serialize(a)


@router.delete("/{accommodation_id}")
async def delete_accommodation(
    accommodation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = await _get_or_404(db, accommodation_id, user.hotel_id)

    booking_count = (await db.execute(
        select(func.count(Booking.id)).where(
            Booking.accommodation_id == accommodation_id,
            Booking.deleted_at.is_(None),
        )
    )).scalar() or 0

    if booking_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: this accommodation has {booking_count} booking(s). Remove all bookings first.",
        )

    await db.delete(a)
    await db.commit()
    return {"ok": True}
