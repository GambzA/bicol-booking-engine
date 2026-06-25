from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.property_portal import (
    Accommodation, Booking, BookingStatus, GuestPayment, GuestPaymentStatus,
)

router = APIRouter(prefix="/dashboard", tags=["property-dashboard"])


@router.get("")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hotel_id = user.hotel_id
    today = date.today()

    total_bookings = (await db.execute(
        select(func.count(Booking.id)).where(
            Booking.hotel_id == hotel_id,
            Booking.deleted_at.is_(None),
        )
    )).scalar() or 0

    todays_checkins = (await db.execute(
        select(func.count(Booking.id)).where(
            Booking.hotel_id == hotel_id,
            Booking.check_in_date == today,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
            Booking.deleted_at.is_(None),
        )
    )).scalar() or 0

    todays_checkouts = (await db.execute(
        select(func.count(Booking.id)).where(
            Booking.hotel_id == hotel_id,
            Booking.check_out_date == today,
            Booking.status == BookingStatus.CHECKED_IN,
            Booking.deleted_at.is_(None),
        )
    )).scalar() or 0

    upcoming_arrivals = (await db.execute(
        select(func.count(Booking.id)).where(
            Booking.hotel_id == hotel_id,
            Booking.check_in_date > today,
            Booking.status == BookingStatus.CONFIRMED,
            Booking.deleted_at.is_(None),
        )
    )).scalar() or 0

    upcoming_departures = (await db.execute(
        select(func.count(Booking.id)).where(
            Booking.hotel_id == hotel_id,
            Booking.check_out_date > today,
            Booking.status == BookingStatus.CHECKED_IN,
            Booking.deleted_at.is_(None),
        )
    )).scalar() or 0

    month_start = today.replace(day=1)
    monthly_revenue = (await db.execute(
        select(func.coalesce(func.sum(Booking.total_amount), 0)).where(
            Booking.hotel_id == hotel_id,
            Booking.check_in_date >= month_start,
            Booking.check_in_date <= today,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
            Booking.deleted_at.is_(None),
        )
    )).scalar() or Decimal("0.00")

    total_accommodations = (await db.execute(
        select(func.count(Accommodation.id)).where(
            Accommodation.hotel_id == hotel_id,
            Accommodation.is_active.is_(True),
            Accommodation.deleted_at.is_(None),
        )
    )).scalar() or 0

    currently_occupied = (await db.execute(
        select(func.count(Booking.id)).where(
            Booking.hotel_id == hotel_id,
            Booking.check_in_date <= today,
            Booking.check_out_date > today,
            Booking.status == BookingStatus.CHECKED_IN,
            Booking.deleted_at.is_(None),
        )
    )).scalar() or 0

    occupancy_rate = (
        round(currently_occupied / total_accommodations * 100, 1)
        if total_accommodations > 0
        else 0
    )

    outstanding_payments = (await db.execute(
        select(func.coalesce(func.sum(GuestPayment.amount), 0)).where(
            GuestPayment.hotel_id == hotel_id,
            GuestPayment.status == GuestPaymentStatus.PENDING,
        )
    )).scalar() or Decimal("0.00")

    recent_rows = list((await db.execute(
        select(Booking)
        .options(selectinload(Booking.guest), selectinload(Booking.accommodation))
        .where(Booking.hotel_id == hotel_id, Booking.deleted_at.is_(None))
        .order_by(Booking.created_at.desc())
        .limit(10)
    )).scalars().all())

    return {
        "total_bookings": total_bookings,
        "todays_checkins": todays_checkins,
        "todays_checkouts": todays_checkouts,
        "upcoming_arrivals": upcoming_arrivals,
        "upcoming_departures": upcoming_departures,
        "monthly_revenue": str(monthly_revenue),
        "occupancy_rate": occupancy_rate,
        "outstanding_payments": str(outstanding_payments),
        "recent_bookings": [
            {
                "id": str(b.id),
                "booking_number": b.booking_number,
                "guest_name": b.guest.full_name,
                "accommodation_name": b.accommodation.name,
                "check_in_date": str(b.check_in_date),
                "check_out_date": str(b.check_out_date),
                "total_amount": str(b.total_amount),
                "status": b.status.value,
                "created_at": b.created_at.isoformat(),
            }
            for b in recent_rows
        ],
    }
