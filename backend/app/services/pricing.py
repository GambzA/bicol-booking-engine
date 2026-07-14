"""Booking pricing engine.

Single source of truth for stay pricing, shared by availability search, live
quoting, and booking confirmation (snapshot generation). All money math uses
Decimal and is quantized to 2 places at the boundaries.

Per-night build-up:
    room rate (override -> weekend -> base)
      -> rate-plan adjustment (if a rate plan covers the accommodation)
      -> + additional-adult charge (adults beyond base_occupancy)
      -> + child charges (matched against accommodation child policies)
Stay-level:
    accommodation subtotal = sum of nights
      -> - promotion discount (if a valid promotion applies)
      -> + package amount (packages are not discounted)
      -> + taxes & fees (0 until tax configuration exists)
"""
import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.property_portal import (
    Accommodation, AccommodationChildPolicy, AccommodationRateOverride,
    Booking, BookingRoom, BookingStatus, InventoryAdjustment,
    RatePlan, RatePlanAccommodation, Promotion, PromotionAccommodation, PromotionRatePlan,
    Package, PackageAccommodation,
)

ZERO = Decimal("0.00")

# Statuses that still occupy inventory.
ACTIVE_BOOKING_STATUSES = [
    BookingStatus.PENDING,
    BookingStatus.PENDING_PAYMENT,
    BookingStatus.CONFIRMED,
    BookingStatus.CHECKED_IN,
]


def money(value) -> Decimal:
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@dataclass
class NightLine:
    date: date
    room_rate: Decimal
    additional_adult_amount: Decimal
    children_amount: Decimal
    night_total: Decimal


@dataclass
class Quote:
    nights: int
    num_adults: int
    num_children: int
    base_amount: Decimal
    additional_adult_amount: Decimal
    children_amount: Decimal
    accommodation_subtotal: Decimal
    discount_amount: Decimal
    package_amount: Decimal
    taxes_fees_amount: Decimal
    total_amount: Decimal
    nightly: list[NightLine] = field(default_factory=list)
    rate_plan_id: Optional[uuid.UUID] = None
    rate_plan_name: Optional[str] = None
    promotion_id: Optional[uuid.UUID] = None
    promotion_name: Optional[str] = None
    promotion_discount_type: Optional[str] = None
    promotion_discount_value: Optional[Decimal] = None
    package_id: Optional[uuid.UUID] = None
    package_name: Optional[str] = None


class PricingError(Exception):
    """Raised when a quote cannot be produced (bad occupancy/dates/etc.)."""


def validate_dates(check_in: date, check_out: date) -> None:
    if check_out <= check_in:
        raise PricingError("Check-out date must be after the check-in date.")


def validate_occupancy(accommodation: Accommodation, adults: int, children: int) -> None:
    if adults < 1:
        raise PricingError("At least one adult is required.")
    total = adults + children
    if total > accommodation.max_occupancy:
        raise PricingError(
            f"Total occupancy ({total}) exceeds the maximum of {accommodation.max_occupancy} for this accommodation."
        )
    # 0/None means "not configured" (the accommodation form stores 0 when left blank),
    # so only enforce these caps when a positive limit is set.
    if accommodation.max_adults and adults > accommodation.max_adults:
        raise PricingError(f"Number of adults ({adults}) exceeds the maximum of {accommodation.max_adults}.")
    if accommodation.max_children and children > accommodation.max_children:
        raise PricingError(f"Number of children ({children}) exceeds the maximum of {accommodation.max_children}.")


def _room_rate(accommodation: Accommodation, override_map: dict, d: date) -> Decimal:
    if d in override_map:
        return Decimal(override_map[d])
    if d.weekday() >= 5 and accommodation.weekend_rate is not None:
        return Decimal(accommodation.weekend_rate)
    return Decimal(accommodation.base_rate)


def _apply_rate_plan(room_rate: Decimal, method: str, pricing_value: Decimal) -> Decimal:
    if method == "fixed_price":
        result = Decimal(pricing_value)
    elif method == "fixed_amount":
        result = room_rate + Decimal(pricing_value)
    elif method == "percentage":
        result = room_rate * (Decimal("1") + Decimal(pricing_value) / Decimal("100"))
    else:
        result = room_rate
    return result if result > ZERO else ZERO


def _child_charge(room_rate: Decimal, age: int, policies: list[AccommodationChildPolicy]) -> Decimal:
    for p in policies:
        if p.min_age <= age <= p.max_age:
            if p.charge_type == "free":
                return ZERO
            if p.charge_type == "fixed_amount":
                return Decimal(p.charge_value or 0)
            if p.charge_type == "percentage_of_base_rate":
                return room_rate * Decimal(p.charge_value or 0) / Decimal("100")
            return ZERO
    return ZERO


async def _load_override_map(db: AsyncSession, accommodation_id: uuid.UUID, start: date, end: date) -> dict:
    rows = (await db.execute(
        select(AccommodationRateOverride).where(
            AccommodationRateOverride.accommodation_id == accommodation_id,
            AccommodationRateOverride.date >= start,
            AccommodationRateOverride.date < end,
        )
    )).scalars().all()
    return {r.date: r.rate for r in rows}


async def _load_child_policies(db: AsyncSession, accommodation_id: uuid.UUID) -> list[AccommodationChildPolicy]:
    return list((await db.execute(
        select(AccommodationChildPolicy)
        .where(AccommodationChildPolicy.accommodation_id == accommodation_id)
        .order_by(AccommodationChildPolicy.sort_order)
    )).scalars().all())


async def _resolve_rate_plan(
    db: AsyncSession, hotel_id: uuid.UUID, accommodation_id: uuid.UUID, rate_plan_id: Optional[uuid.UUID]
) -> Optional[tuple[RatePlan, Decimal]]:
    if not rate_plan_id:
        return None
    rp = (await db.execute(
        select(RatePlan).where(
            RatePlan.id == rate_plan_id, RatePlan.hotel_id == hotel_id,
            RatePlan.deleted_at.is_(None), RatePlan.is_active.is_(True),
        )
    )).scalar_one_or_none()
    if rp is None:
        raise PricingError("Selected rate plan is not available.")
    rpa = (await db.execute(
        select(RatePlanAccommodation).where(
            RatePlanAccommodation.rate_plan_id == rate_plan_id,
            RatePlanAccommodation.accommodation_id == accommodation_id,
        )
    )).scalar_one_or_none()
    if rpa is None:
        raise PricingError("Selected rate plan does not apply to this accommodation.")
    return rp, Decimal(rpa.pricing_value)


async def _resolve_promotion(
    db: AsyncSession, hotel_id: uuid.UUID, accommodation_id: uuid.UUID,
    promotion_id: Optional[uuid.UUID], rate_plan_id: Optional[uuid.UUID],
    check_in: date, check_out: date, booking_date: date,
) -> Optional[Promotion]:
    if not promotion_id:
        return None
    promo = (await db.execute(
        select(Promotion).where(
            Promotion.id == promotion_id, Promotion.hotel_id == hotel_id,
            Promotion.deleted_at.is_(None), Promotion.is_active.is_(True),
        )
    )).scalar_one_or_none()
    if promo is None:
        raise PricingError("Selected promotion is not available.")

    linked_acc = (await db.execute(
        select(func.count(PromotionAccommodation.id)).where(
            PromotionAccommodation.promotion_id == promotion_id,
            PromotionAccommodation.accommodation_id == accommodation_id,
        )
    )).scalar() or 0
    if linked_acc == 0:
        raise PricingError("Selected promotion does not apply to this accommodation.")

    # If the promotion is scoped to specific rate plans, the chosen plan must match.
    rp_links = list((await db.execute(
        select(PromotionRatePlan.rate_plan_id).where(PromotionRatePlan.promotion_id == promotion_id)
    )).scalars().all())
    if rp_links:
        if rate_plan_id is None or rate_plan_id not in rp_links:
            raise PricingError("Selected promotion requires a specific rate plan.")

    if promo.stay_start_date and check_in < promo.stay_start_date:
        raise PricingError("Stay dates are outside the promotion's valid period.")
    if promo.stay_end_date and (check_out - timedelta(days=1)) > promo.stay_end_date:
        raise PricingError("Stay dates are outside the promotion's valid period.")
    if promo.booking_start_date and booking_date < promo.booking_start_date:
        raise PricingError("The promotion's booking window has not started.")
    if promo.booking_end_date and booking_date > promo.booking_end_date:
        raise PricingError("The promotion's booking window has ended.")
    return promo


async def _resolve_package(
    db: AsyncSession, hotel_id: uuid.UUID, accommodation_id: uuid.UUID, package_id: Optional[uuid.UUID]
) -> Optional[Package]:
    if not package_id:
        return None
    pkg = (await db.execute(
        select(Package).where(
            Package.id == package_id, Package.hotel_id == hotel_id,
            Package.deleted_at.is_(None), Package.is_active.is_(True),
        )
    )).scalar_one_or_none()
    if pkg is None:
        raise PricingError("Selected package is not available.")
    linked = (await db.execute(
        select(func.count(PackageAccommodation.id)).where(
            PackageAccommodation.package_id == package_id,
            PackageAccommodation.accommodation_id == accommodation_id,
        )
    )).scalar() or 0
    if linked == 0:
        raise PricingError("Selected package does not apply to this accommodation.")
    return pkg


def _package_amount(pkg: Package, nights: int, total_guests: int) -> Decimal:
    value = Decimal(pkg.price_value)
    if pkg.pricing_type == "per_night":
        return value * nights
    if pkg.pricing_type == "per_person":
        return value * total_guests
    return value  # per_stay


async def compute_quote(
    db: AsyncSession,
    accommodation: Accommodation,
    check_in: date,
    check_out: date,
    adults: int,
    children_ages: list[int],
    *,
    rate_plan_id: Optional[uuid.UUID] = None,
    promotion_id: Optional[uuid.UUID] = None,
    package_id: Optional[uuid.UUID] = None,
    booking_date: Optional[date] = None,
) -> Quote:
    """Produce a full price breakdown for one accommodation/selection."""
    validate_dates(check_in, check_out)
    children = len(children_ages)
    validate_occupancy(accommodation, adults, children)

    if booking_date is None:
        booking_date = date.today()

    hotel_id = accommodation.hotel_id
    override_map = await _load_override_map(db, accommodation.id, check_in, check_out)
    policies = await _load_child_policies(db, accommodation.id)
    rp_resolved = await _resolve_rate_plan(db, hotel_id, accommodation.id, rate_plan_id)
    promo = await _resolve_promotion(
        db, hotel_id, accommodation.id, promotion_id, rate_plan_id, check_in, check_out, booking_date
    )
    pkg = await _resolve_package(db, hotel_id, accommodation.id, package_id)

    extra_adults = max(0, adults - accommodation.base_occupancy)
    per_adult_fee = Decimal(accommodation.additional_adult_fee)
    if accommodation.additional_adult_requires_extra_bed and accommodation.extra_bed_fee is not None:
        per_adult_fee += Decimal(accommodation.extra_bed_fee)
    adult_amount_per_night = per_adult_fee * extra_adults

    nights_list: list[NightLine] = []
    base_total = ZERO
    adult_total = ZERO
    children_total = ZERO

    d = check_in
    while d < check_out:
        room_rate = _room_rate(accommodation, override_map, d)
        if rp_resolved is not None:
            room_rate = _apply_rate_plan(room_rate, rp_resolved[0].pricing_method, rp_resolved[1])
        room_rate = money(room_rate)

        night_children = sum((_child_charge(room_rate, age, policies) for age in children_ages), ZERO)
        night_children = money(night_children)
        night_adult = money(adult_amount_per_night)
        night_total = money(room_rate + night_adult + night_children)

        nights_list.append(NightLine(
            date=d, room_rate=room_rate, additional_adult_amount=night_adult,
            children_amount=night_children, night_total=night_total,
        ))
        base_total += room_rate
        adult_total += night_adult
        children_total += night_children
        d += timedelta(days=1)

    nights = len(nights_list)
    accommodation_subtotal = money(base_total + adult_total + children_total)

    discount_amount = ZERO
    if promo is not None:
        if promo.discount_type == "percentage":
            discount_amount = accommodation_subtotal * Decimal(promo.discount_value) / Decimal("100")
        else:  # fixed_amount
            discount_amount = Decimal(promo.discount_value)
        discount_amount = money(min(discount_amount, accommodation_subtotal))

    package_amount = money(_package_amount(pkg, nights, adults + children)) if pkg is not None else ZERO
    taxes_fees = ZERO
    total = money(accommodation_subtotal - discount_amount + package_amount + taxes_fees)

    return Quote(
        nights=nights,
        num_adults=adults,
        num_children=children,
        base_amount=money(base_total),
        additional_adult_amount=money(adult_total),
        children_amount=money(children_total),
        accommodation_subtotal=accommodation_subtotal,
        discount_amount=discount_amount,
        package_amount=package_amount,
        taxes_fees_amount=taxes_fees,
        total_amount=total,
        nightly=nights_list,
        rate_plan_id=rp_resolved[0].id if rp_resolved else None,
        rate_plan_name=rp_resolved[0].name if rp_resolved else None,
        promotion_id=promo.id if promo else None,
        promotion_name=promo.name if promo else None,
        promotion_discount_type=promo.discount_type if promo else None,
        promotion_discount_value=Decimal(promo.discount_value) if promo else None,
        package_id=pkg.id if pkg else None,
        package_name=pkg.name if pkg else None,
    )


async def count_available_units(
    db: AsyncSession,
    accommodation: Accommodation,
    check_in: date,
    check_out: date,
    exclude_booking_id: Optional[uuid.UUID] = None,
) -> int:
    """Minimum number of free units across every night of the stay.

    free(date) = num_units + net inventory adjustment(date) - units held by
    active bookings(date). Availability is accommodation-level and date-based;
    each booked room occupies one unit. The night of check_out is not occupied.
    """
    # Rooms of this accommodation held by bookings overlapping the stay window.
    booking_q = (
        select(Booking.check_in_date, Booking.check_out_date)
        .join(BookingRoom, BookingRoom.booking_id == Booking.id)
        .where(
            BookingRoom.accommodation_id == accommodation.id,
            Booking.deleted_at.is_(None),
            Booking.status.in_(ACTIVE_BOOKING_STATUSES),
            Booking.check_out_date > check_in,
            Booking.check_in_date < check_out,
        )
    )
    if exclude_booking_id is not None:
        booking_q = booking_q.where(Booking.id != exclude_booking_id)
    bookings = list((await db.execute(booking_q)).all())

    # Net signed inventory adjustments per night within the window.
    adjustments = list((await db.execute(
        select(InventoryAdjustment).where(
            InventoryAdjustment.accommodation_id == accommodation.id,
            InventoryAdjustment.deleted_at.is_(None),
            InventoryAdjustment.start_date < check_out,
            InventoryAdjustment.end_date >= check_in,
        )
    )).scalars().all())

    min_free = None
    d = check_in
    while d < check_out:
        booked = sum(1 for b in bookings if b.check_in_date <= d < b.check_out_date)
        net_adj = sum(a.adjustment_value for a in adjustments if a.start_date <= d <= a.end_date)
        sellable = max(0, accommodation.num_units + net_adj)
        free = sellable - booked
        min_free = free if min_free is None else min(min_free, free)
        d += timedelta(days=1)
    return max(0, min_free if min_free is not None else accommodation.num_units)
