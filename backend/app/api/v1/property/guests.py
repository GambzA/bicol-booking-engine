import uuid
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload, joinedload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.property_portal import Guest, Booking, Accommodation
from app.models.reference import ReferenceCountry

router = APIRouter(prefix="/guests", tags=["property-guests"])


class GuestCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state_province: Optional[str] = None
    postal_code: Optional[str] = None
    country_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None


class GuestUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state_province: Optional[str] = None
    postal_code: Optional[str] = None
    country_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None


def _serialize_booking(booking: Booking) -> dict:
    return {
        "id": str(booking.id),
        "booking_number": booking.booking_number,
        "accommodation_name": booking.accommodation.name if booking.accommodation else None,
        "check_in_date": booking.check_in_date.isoformat(),
        "check_out_date": booking.check_out_date.isoformat(),
        "status": booking.status.value if hasattr(booking.status, "value") else booking.status,
        "total_amount": str(booking.total_amount),
    }


def _serialize(
    guest: Guest,
    booking_count: int = 0,
    total_spent: Decimal = Decimal("0"),
    last_stay: Optional[date] = None,
    include_bookings: bool = False,
) -> dict:
    data: dict = {
        "id": str(guest.id),
        "first_name": guest.first_name,
        "last_name": guest.last_name,
        "full_name": guest.full_name,
        "email": guest.email,
        "mobile_number": guest.mobile_number,
        "date_of_birth": guest.date_of_birth.isoformat() if guest.date_of_birth else None,
        "nationality": guest.nationality,
        "address_line_1": guest.address_line_1,
        "address_line_2": guest.address_line_2,
        "city": guest.city,
        "state_province": guest.state_province,
        "postal_code": guest.postal_code,
        "country_id": str(guest.country_id) if guest.country_id else None,
        "country_name": guest.country.country_name if guest.country else None,
        "notes": guest.notes,
        "booking_count": booking_count,
        "total_spent": str(total_spent),
        "last_stay": last_stay.isoformat() if last_stay else None,
        "created_at": guest.created_at.isoformat(),
        "updated_at": guest.updated_at.isoformat(),
    }
    if include_bookings:
        data["bookings"] = [_serialize_booking(b) for b in guest.bookings]
    return data


async def _get_or_404(db: AsyncSession, guest_id: uuid.UUID, hotel_id: uuid.UUID) -> Guest:
    g = (await db.execute(
        select(Guest)
        .where(
            Guest.id == guest_id,
            Guest.hotel_id == hotel_id,
            Guest.deleted_at.is_(None),
        )
        .options(joinedload(Guest.country))
    )).scalar_one_or_none()
    if g is None:
        raise HTTPException(status_code=404, detail="Guest not found")
    return g


async def _booking_stats(
    db: AsyncSession, guest_id: uuid.UUID
) -> tuple[int, Decimal, Optional[date]]:
    row = (await db.execute(
        select(
            func.count(Booking.id),
            func.coalesce(func.sum(Booking.total_amount), 0),
            func.max(Booking.check_out_date),
        ).where(
            Booking.guest_id == guest_id,
            Booking.deleted_at.is_(None),
        )
    )).one()
    return int(row[0]), Decimal(str(row[1])), row[2]


async def _check_duplicate(
    db: AsyncSession,
    hotel_id: uuid.UUID,
    email: Optional[str],
    mobile_number: Optional[str],
    exclude_id: Optional[uuid.UUID] = None,
) -> Optional[Guest]:
    if not email and not mobile_number:
        return None
    conditions = []
    if email:
        conditions.append(Guest.email == email.strip().lower())
    if mobile_number:
        conditions.append(Guest.mobile_number == mobile_number.strip())
    q = select(Guest).where(
        Guest.hotel_id == hotel_id,
        Guest.deleted_at.is_(None),
        or_(*conditions),
    )
    if exclude_id:
        q = q.where(Guest.id != exclude_id)
    return (await db.execute(q)).scalars().first()


@router.get("")
async def list_guests(
    search: Optional[str] = Query(None),
    sort: str = Query("name", regex="^(name|created_at|last_stay)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hotel_id = user.hotel_id
    base_where = [
        Guest.hotel_id == hotel_id,
        Guest.deleted_at.is_(None),
    ]
    if search:
        pattern = f"%{search.strip()}%"
        base_where.append(
            or_(
                func.concat(Guest.first_name, " ", Guest.last_name).ilike(pattern),
                Guest.email.ilike(pattern),
                Guest.mobile_number.ilike(pattern),
            )
        )

    last_stay_subq = (
        select(func.max(Booking.check_out_date))
        .where(
            Booking.guest_id == Guest.id,
            Booking.deleted_at.is_(None),
        )
        .correlate(Guest)
        .scalar_subquery()
    )

    if sort == "last_stay":
        order_clause = [last_stay_subq.desc().nulls_last()]
    elif sort == "created_at":
        order_clause = [Guest.created_at.desc()]
    else:
        order_clause = [Guest.first_name, Guest.last_name]

    total = (await db.execute(
        select(func.count(Guest.id)).where(*base_where)
    )).scalar() or 0

    guests = list((await db.execute(
        select(Guest)
        .where(*base_where)
        .order_by(*order_clause)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .options(joinedload(Guest.country))
    )).scalars().all())

    items = []
    for g in guests:
        count, spent, last = await _booking_stats(db, g.id)
        items.append(_serialize(g, booking_count=count, total_spent=spent, last_stay=last))

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/{guest_id}")
async def get_guest(
    guest_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    g = (await db.execute(
        select(Guest)
        .where(
            Guest.id == guest_id,
            Guest.hotel_id == user.hotel_id,
            Guest.deleted_at.is_(None),
        )
        .options(
            selectinload(Guest.bookings).joinedload(Booking.accommodation),
            joinedload(Guest.country),
        )
    )).scalar_one_or_none()
    if g is None:
        raise HTTPException(status_code=404, detail="Guest not found")

    active_bookings = [b for b in g.bookings if b.deleted_at is None]
    active_bookings.sort(key=lambda b: b.check_in_date, reverse=True)
    g.bookings = active_bookings

    count = len(active_bookings)
    spent = sum(b.total_amount for b in active_bookings)
    last = max((b.check_out_date for b in active_bookings), default=None)

    return _serialize(g, booking_count=count, total_spent=Decimal(str(spent)), last_stay=last, include_bookings=True)


@router.post("")
async def create_guest(
    body: GuestCreate,
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not body.first_name.strip():
        raise HTTPException(status_code=422, detail="First name is required")
    if not body.last_name.strip():
        raise HTTPException(status_code=422, detail="Last name is required")

    email = body.email.strip().lower() if body.email else None
    mobile = body.mobile_number.strip() if body.mobile_number else None

    if not force:
        duplicate = await _check_duplicate(db, user.hotel_id, email, mobile)
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "A guest with this email or mobile number already exists.",
                    "existing": {
                        "id": str(duplicate.id),
                        "full_name": duplicate.full_name,
                        "email": duplicate.email,
                        "mobile_number": duplicate.mobile_number,
                    },
                },
            )

    g = Guest(
        hotel_id=user.hotel_id,
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        email=email,
        mobile_number=mobile,
        date_of_birth=body.date_of_birth,
        nationality=body.nationality,
        address_line_1=body.address_line_1,
        address_line_2=body.address_line_2,
        city=body.city,
        state_province=body.state_province,
        postal_code=body.postal_code,
        country_id=body.country_id,
        notes=body.notes,
    )
    db.add(g)
    await db.commit()
    g = (await db.execute(
        select(Guest).where(Guest.id == g.id).options(joinedload(Guest.country))
    )).scalar_one()
    return _serialize(g)


@router.put("/{guest_id}")
async def update_guest(
    guest_id: uuid.UUID,
    body: GuestUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    g = await _get_or_404(db, guest_id, user.hotel_id)
    updates = body.model_dump(exclude_unset=True)

    if "first_name" in updates and not updates["first_name"].strip():
        raise HTTPException(status_code=422, detail="First name is required")
    if "last_name" in updates and not updates["last_name"].strip():
        raise HTTPException(status_code=422, detail="Last name is required")

    email = updates.get("email")
    if email is not None:
        email = email.strip().lower() if email else None
        updates["email"] = email
    mobile = updates.get("mobile_number")
    if mobile is not None:
        mobile = mobile.strip() if mobile else None
        updates["mobile_number"] = mobile

    effective_email = updates.get("email", g.email)
    effective_mobile = updates.get("mobile_number", g.mobile_number)
    duplicate = await _check_duplicate(db, user.hotel_id, effective_email, effective_mobile, exclude_id=guest_id)
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "A guest with this email or mobile number already exists.",
                "existing": {
                    "id": str(duplicate.id),
                    "full_name": duplicate.full_name,
                    "email": duplicate.email,
                    "mobile_number": duplicate.mobile_number,
                },
            },
        )

    for field, value in updates.items():
        if field == "first_name":
            setattr(g, field, value.strip())
        elif field == "last_name":
            setattr(g, field, value.strip())
        else:
            setattr(g, field, value)

    await db.commit()
    await db.refresh(g)
    count, spent, last = await _booking_stats(db, g.id)
    return _serialize(g, booking_count=count, total_spent=spent, last_stay=last)


@router.delete("/{guest_id}")
async def delete_guest(
    guest_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    g = await _get_or_404(db, guest_id, user.hotel_id)
    g.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}
