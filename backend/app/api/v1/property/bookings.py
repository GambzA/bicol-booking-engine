import uuid
import secrets
from collections import Counter
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, exists
from sqlalchemy.orm import selectinload, joinedload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.property_portal import (
    Accommodation, Guest, Booking, BookingRoom, BookingRoomGuest, BookingStatus, BookingSource,
    BookingNightlyRate, BookingStatusHistory, BookingTax, PaymentRecord, PaymentRecordStatus,
    PaymentTransaction, PaymentMethod, BillableItem, BookingBillableItem, BookingCharge,
    RatePlan, RatePlanAccommodation, Promotion, PromotionAccommodation, PromotionRatePlan,
    Package, PackageAccommodation,
)
from app.services.pricing import (
    compute_quote, count_available_units, validate_occupancy, validate_dates,
    money, PricingError, Quote, ACTIVE_BOOKING_STATUSES,
)
from app.services.taxes import compute_taxes, added_tax_total, load_active_taxes
from app.services.billable_items import (
    compute_billable_item_line, load_eligible_items, taxable_total as billable_taxable_total,
    grand_total_of as billable_grand_total,
)
from app.services.payments import (
    resolve_payment_method, record_payment as create_payment_record, payment_status as compute_payment_status,
)
from app.services.booking_charges import (
    room_charge_rows, tax_charge_row, billable_item_charge_row, charges_total,
    adjust_charge as adjust_charge_row, MANUAL_CATEGORIES, ADJUST_CATEGORIES,
)
from app.core.constants import AuditAction
from app.services.audit_service import log_audit

router = APIRouter(prefix="/bookings", tags=["property-bookings"])

# Statuses the property owner can set from the UI (spec lifecycle).
ASSIGNABLE_STATUSES = {
    BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN,
    BookingStatus.CHECKED_OUT, BookingStatus.CANCELLED, BookingStatus.NO_SHOW,
}
VALID_SOURCES = {s.value for s in BookingSource}
ZERO = Decimal("0.00")


# ─── Request models ─────────────────────────────────────────────────────────

class AvailabilitySearchBody(BaseModel):
    check_in_date: date
    check_out_date: date
    num_adults: int = 1
    children_ages: list[int] = []


class QuoteBody(BaseModel):
    accommodation_id: uuid.UUID
    check_in_date: date
    check_out_date: date
    num_adults: int = 1
    children_ages: list[int] = []
    rate_plan_id: Optional[uuid.UUID] = None
    promotion_id: Optional[uuid.UUID] = None
    package_id: Optional[uuid.UUID] = None


class OccupantInput(BaseModel):
    full_name: Optional[str] = None
    age: Optional[int] = None  # required for children, ignored for adults


class RoomInput(BaseModel):
    accommodation_id: uuid.UUID
    rate_plan_id: Optional[uuid.UUID] = None
    promotion_id: Optional[uuid.UUID] = None
    package_id: Optional[uuid.UUID] = None
    adults: list[OccupantInput] = []
    children: list[OccupantInput] = []


class BillableItemInput(BaseModel):
    billable_item_id: uuid.UUID
    quantity: Optional[int] = None  # only meaningful for fixed_amount / per_quantity types


class BookingCreate(BaseModel):
    guest_id: uuid.UUID
    check_in_date: date
    check_out_date: date
    booking_source: Optional[str] = None
    notes: Optional[str] = None
    status: str = "confirmed"  # "pending" or "confirmed"
    payment_method_id: Optional[uuid.UUID] = None
    rooms: list[RoomInput] = Field(min_length=1)
    billable_items: list[BillableItemInput] = []


class StatusUpdateBody(BaseModel):
    status: str
    note: Optional[str] = None


class PaymentBody(BaseModel):
    amount: Decimal = Field(gt=0)
    payment_date: Optional[date] = None
    payment_method_id: uuid.UUID
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class ManualChargeBody(BaseModel):
    category: str
    description: str
    amount: Decimal = Field(gt=0)
    notes: Optional[str] = None


class AdjustChargeBody(BaseModel):
    amount: Optional[Decimal] = Field(default=None, gt=0)
    category: str = "adjustment"
    description: Optional[str] = None
    notes: Optional[str] = None


# ─── Helpers ────────────────────────────────────────────────────────────────

def _status_value(s) -> str:
    return s.value if hasattr(s, "value") else s


def _compute_deposit(pm: PaymentMethod, total: Decimal) -> tuple[bool, Decimal]:
    """Deposit snapshot for a booking, from the method's pay-at-property config."""
    if pm is None or pm.method_type != "pay_at_property" or not pm.deposit_required:
        return False, ZERO
    if pm.deposit_type == "percentage" and pm.deposit_value is not None:
        return True, money(total * Decimal(pm.deposit_value) / Decimal("100"))
    if pm.deposit_type == "fixed" and pm.deposit_value is not None:
        return True, money(min(Decimal(pm.deposit_value), total))
    return True, ZERO


def _clean_name(name: Optional[str]) -> Optional[str]:
    if name is None:
        return None
    stripped = name.strip()
    return stripped or None


def _quote_dict(q: Quote) -> dict:
    return {
        "nights": q.nights,
        "num_adults": q.num_adults,
        "num_children": q.num_children,
        "base_amount": str(q.base_amount),
        "additional_adult_amount": str(q.additional_adult_amount),
        "children_amount": str(q.children_amount),
        "accommodation_subtotal": str(q.accommodation_subtotal),
        "discount_amount": str(q.discount_amount),
        "package_amount": str(q.package_amount),
        "taxes_fees_amount": str(q.taxes_fees_amount),
        "total_amount": str(q.total_amount),
        "rate_plan_id": str(q.rate_plan_id) if q.rate_plan_id else None,
        "rate_plan_name": q.rate_plan_name,
        "promotion_id": str(q.promotion_id) if q.promotion_id else None,
        "promotion_name": q.promotion_name,
        "package_id": str(q.package_id) if q.package_id else None,
        "package_name": q.package_name,
        "nightly": [
            {
                "date": n.date.isoformat(),
                "room_rate": str(n.room_rate),
                "additional_adult_amount": str(n.additional_adult_amount),
                "children_amount": str(n.children_amount),
                "night_total": str(n.night_total),
            }
            for n in q.nightly
        ],
    }


# Eager-load path for a full booking detail (container + rooms + children).
def _detail_options():
    return (
        joinedload(Booking.guest),
        selectinload(Booking.rooms).joinedload(BookingRoom.accommodation),
        selectinload(Booking.rooms).selectinload(BookingRoom.guests),
        selectinload(Booking.rooms).selectinload(BookingRoom.nightly_rates),
        selectinload(Booking.status_history),
        selectinload(Booking.payments).selectinload(PaymentRecord.transactions),
        selectinload(Booking.payments).joinedload(PaymentRecord.recorded_by),
        selectinload(Booking.taxes),
        selectinload(Booking.billable_items),
        selectinload(Booking.charges).joinedload(BookingCharge.created_by),
    )


async def _load_detail(db: AsyncSession, booking_id: uuid.UUID) -> Booking:
    return (await db.execute(
        select(Booking).where(Booking.id == booking_id).options(*_detail_options())
    )).unique().scalar_one()


async def _get_or_404(db: AsyncSession, booking_id: uuid.UUID, hotel_id: uuid.UUID) -> Booking:
    b = (await db.execute(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.hotel_id == hotel_id,
            Booking.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if b is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    return b


async def _generate_booking_number(db: AsyncSession) -> str:
    prefix = f"BK-{date.today():%Y%m%d}-"
    for _ in range(12):
        candidate = prefix + secrets.token_hex(2).upper()
        exists_row = (await db.execute(
            select(Booking.id).where(Booking.booking_number == candidate)
        )).scalar_one_or_none()
        if exists_row is None:
            return candidate
    raise HTTPException(status_code=500, detail="Could not generate a unique booking number")


def _serialize_transaction(t: PaymentTransaction) -> dict:
    return {
        "id": str(t.id),
        "transaction_type": t.transaction_type,
        "status": t.status,
        "amount": str(t.amount),
        "external_transaction_id": t.external_transaction_id,
        "reference_number": t.reference_number,
        "remarks": t.remarks,
        "created_at": t.created_at.isoformat(),
    }


def _serialize_payment(p: PaymentRecord) -> dict:
    return {
        "id": str(p.id),
        "payment_number": p.payment_number,
        "amount": str(p.amount),
        "payment_date": p.payment_date.isoformat(),
        "method": p.method,
        "payment_method_id": str(p.payment_method_id) if p.payment_method_id else None,
        "payment_method_name": p.payment_method_name_snapshot or p.method,
        "reference_number": p.reference_number,
        "notes": p.notes,
        "status": _status_value(p.status),
        "recorded_by_name": p.recorded_by.full_name if p.recorded_by else None,
        "refunded_payment_id": str(p.refunded_payment_id) if p.refunded_payment_id else None,
        "created_at": p.created_at.isoformat(),
        "transactions": [_serialize_transaction(t) for t in p.transactions],
    }


def _serialize_charge(c: BookingCharge) -> dict:
    return {
        "id": str(c.id),
        "booking_room_id": str(c.booking_room_id) if c.booking_room_id else None,
        "category": c.category,
        "description": c.description,
        "quantity": c.quantity,
        "unit_price": str(c.unit_price),
        "amount": str(c.amount),
        "charge_date": c.charge_date.isoformat(),
        "source_type": c.source_type,
        "source_id": str(c.source_id) if c.source_id else None,
        "adjusts_charge_id": str(c.adjusts_charge_id) if c.adjusts_charge_id else None,
        "created_by_name": c.created_by.full_name if c.created_by else None,
        "notes": c.notes,
        "created_at": c.created_at.isoformat(),
    }


def _serialize_room(room: BookingRoom, primary_name: Optional[str]) -> dict:
    acc = room.accommodation
    return {
        "id": str(room.id),
        "display_order": room.display_order,
        "accommodation_id": str(room.accommodation_id),
        "accommodation_name": acc.name if acc else None,
        "accommodation_type": acc.accommodation_type.value if acc else None,
        "num_adults": room.num_adults,
        "num_children": room.num_children,
        "num_guests": room.num_guests,
        "rate_plan_id": str(room.rate_plan_id) if room.rate_plan_id else None,
        "rate_plan_name": room.rate_plan_name_snapshot,
        "promotion_id": str(room.promotion_id) if room.promotion_id else None,
        "promotion_name": room.promotion_name_snapshot,
        "discount_type": room.discount_type_snapshot,
        "discount_value": str(room.discount_value_snapshot) if room.discount_value_snapshot is not None else None,
        "package_id": str(room.package_id) if room.package_id else None,
        "package_name": room.package_name_snapshot,
        "package_amount": str(room.package_amount),
        "base_amount": str(room.base_amount),
        "additional_adult_amount": str(room.additional_adult_amount),
        "children_amount": str(room.children_amount),
        "discount_amount": str(room.discount_amount),
        "taxes_fees_amount": str(room.taxes_fees_amount),
        "subtotal_amount": str(room.subtotal_amount),
        "total_amount": str(room.total_amount),
        "guests": [
            {
                "id": str(g.id),
                "occupant_type": g.occupant_type,
                "name": g.full_name or primary_name,
                "is_named": g.full_name is not None,
                "age": g.age,
            }
            for g in room.guests
        ],
        "nightly_rates": [
            {
                "date": n.date.isoformat(),
                "room_rate": str(n.room_rate),
                "additional_adult_amount": str(n.additional_adult_amount),
                "children_amount": str(n.children_amount),
                "night_total": str(n.night_total),
            }
            for n in room.nightly_rates
        ],
    }


def _serialize_detail(b: Booking) -> dict:
    primary_name = b.guest.full_name if b.guest else None
    rooms = list(b.rooms)

    net_paid_statuses = {"paid", "refunded"}
    total = Decimal(b.total_amount)
    total_paid = money(sum((Decimal(p.amount) for p in b.payments if _status_value(p.status) in net_paid_statuses), Decimal("0")))
    has_refund = any(_status_value(p.status) == "refunded" for p in b.payments)
    # No floor at zero: a charge-side refund/adjustment can drop the total
    # below what's already been paid, and the spec wants that surfaced as a
    # negative Balance Due (a credit owed to the guest), not clamped to 0.
    outstanding = total - total_paid

    def _sum(attr: str) -> Decimal:
        return sum((Decimal(getattr(r, attr)) for r in rooms), Decimal("0"))

    return {
        "id": str(b.id),
        "booking_number": b.booking_number,
        "status": _status_value(b.status),
        "booking_source": b.booking_source,
        "guest_id": str(b.guest_id),
        "guest_name": primary_name,
        "guest_email": b.guest.email if b.guest else None,
        "guest_mobile": b.guest.mobile_number if b.guest else None,
        "check_in_date": b.check_in_date.isoformat(),
        "check_out_date": b.check_out_date.isoformat(),
        "nights": (b.check_out_date - b.check_in_date).days,
        "num_guests": b.num_guests,
        "rooms_count": len(rooms),
        "notes": b.notes,
        "payment_method_id": str(b.payment_method_id) if b.payment_method_id else None,
        "payment_method_name": b.payment_method_name_snapshot,
        "deposit_required": b.deposit_required,
        "deposit_amount": str(b.deposit_amount),
        "rooms": [_serialize_room(r, primary_name) for r in rooms],
        # stay-level aggregates (summed across rooms)
        "base_amount": str(_sum("base_amount")),
        "additional_adult_amount": str(_sum("additional_adult_amount")),
        "children_amount": str(_sum("children_amount")),
        "discount_amount": str(_sum("discount_amount")),
        "package_amount": str(_sum("package_amount")),
        "taxes_fees_amount": str(_sum("taxes_fees_amount")),
        "subtotal_amount": str(_sum("subtotal_amount")),
        # net (pre-tax) booking subtotal = sum of room totals; tax lines + total
        "net_amount": str(b.subtotal_amount),
        "tax_total": str(b.tax_total),
        "taxes": [
            {
                "id": str(t.id),
                "tax_id": str(t.tax_id) if t.tax_id else None,
                "name": t.name_snapshot,
                "tax_type": t.tax_type_snapshot,
                "rate": str(t.rate_snapshot),
                "calculation_method": t.calculation_method_snapshot,
                "application_scope": t.application_scope_snapshot,
                "amount": str(t.calculated_amount),
                "is_included": t.is_included,
            }
            for t in b.taxes
        ],
        "billable_items_amount": str(b.billable_items_amount),
        "billable_items": [
            {
                "id": str(i.id),
                "billable_item_id": str(i.billable_item_id) if i.billable_item_id else None,
                "name": i.name_snapshot,
                "category": i.category_snapshot,
                "pricing_type": i.pricing_type_snapshot,
                "unit_price": str(i.unit_price_snapshot),
                "quantity": i.quantity,
                "is_taxable": i.is_taxable_snapshot,
                "amount": str(i.calculated_amount),
            }
            for i in b.billable_items
        ],
        "charges": [_serialize_charge(c) for c in sorted(b.charges, key=lambda c: (c.display_order, c.created_at))],
        "total_amount": str(total),
        # payment summary
        "payment_summary": {
            "booking_total": str(total),
            "deposit_required": b.deposit_required,
            "deposit_amount": str(b.deposit_amount),
            "total_paid": str(total_paid),
            "outstanding_balance": str(outstanding),
            "payment_status": compute_payment_status(total, total_paid, has_refund),
        },
        "timeline": [
            {
                "id": str(h.id),
                "from_status": h.from_status,
                "to_status": h.to_status,
                "note": h.note,
                "created_at": h.created_at.isoformat(),
            }
            for h in b.status_history
        ],
        "payments": [_serialize_payment(p) for p in b.payments],
        "created_at": b.created_at.isoformat(),
        "updated_at": b.updated_at.isoformat(),
    }


# ─── Availability search ────────────────────────────────────────────────────

@router.post("/availability-search")
async def availability_search(
    body: AvailabilitySearchBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        validate_dates(body.check_in_date, body.check_out_date)
    except PricingError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if body.num_adults < 1:
        raise HTTPException(status_code=422, detail="At least one adult is required.")

    hotel_id = user.hotel_id
    accommodations = list((await db.execute(
        select(Accommodation).where(
            Accommodation.hotel_id == hotel_id,
            Accommodation.is_active.is_(True),
            Accommodation.deleted_at.is_(None),
        ).order_by(Accommodation.name)
    )).scalars().all())

    # Active offerings, loaded once and filtered per accommodation in Python.
    rate_plans = list((await db.execute(
        select(RatePlan)
        .options(selectinload(RatePlan.accommodations))
        .where(RatePlan.hotel_id == hotel_id, RatePlan.is_active.is_(True), RatePlan.deleted_at.is_(None))
        .order_by(RatePlan.display_order, RatePlan.name)
    )).scalars().all())
    promotions = list((await db.execute(
        select(Promotion)
        .options(selectinload(Promotion.accommodation_links))
        .where(Promotion.hotel_id == hotel_id, Promotion.is_active.is_(True), Promotion.deleted_at.is_(None))
        .order_by(Promotion.name)
    )).scalars().all())
    packages = list((await db.execute(
        select(Package)
        .options(selectinload(Package.accommodations))
        .where(Package.hotel_id == hotel_id, Package.is_active.is_(True), Package.deleted_at.is_(None))
        .order_by(Package.display_order, Package.name)
    )).scalars().all())

    today = date.today()
    rp_by_acc = {rp.id: {a.accommodation_id for a in rp.accommodations} for rp in rate_plans}
    promo_by_acc = {p.id: {a.accommodation_id for a in p.accommodation_links} for p in promotions}
    pkg_by_acc = {pk.id: {a.accommodation_id for a in pk.accommodations} for pk in packages}

    results = []
    for acc in accommodations:
        try:
            validate_occupancy(acc, body.num_adults, len(body.children_ages))
        except PricingError:
            continue
        available = await count_available_units(db, acc, body.check_in_date, body.check_out_date)
        if available < 1:
            continue
        try:
            base_quote = await compute_quote(
                db, acc, body.check_in_date, body.check_out_date,
                body.num_adults, body.children_ages, booking_date=today,
            )
        except PricingError:
            continue

        applicable_rate_plans = [
            {"id": str(rp.id), "name": rp.name, "pricing_method": rp.pricing_method}
            for rp in rate_plans if acc.id in rp_by_acc.get(rp.id, set())
        ]
        applicable_promotions = []
        for p in promotions:
            if acc.id not in promo_by_acc.get(p.id, set()):
                continue
            if p.stay_start_date and body.check_in_date < p.stay_start_date:
                continue
            if p.stay_end_date and body.check_out_date.toordinal() - 1 > p.stay_end_date.toordinal():
                continue
            if p.booking_start_date and today < p.booking_start_date:
                continue
            if p.booking_end_date and today > p.booking_end_date:
                continue
            applicable_promotions.append({
                "id": str(p.id), "name": p.name,
                "discount_type": p.discount_type, "discount_value": str(p.discount_value),
            })
        applicable_packages = [
            {"id": str(pk.id), "name": pk.name, "pricing_type": pk.pricing_type, "price_value": str(pk.price_value)}
            for pk in packages if acc.id in pkg_by_acc.get(pk.id, set())
        ]

        results.append({
            "accommodation_id": str(acc.id),
            "name": acc.name,
            "accommodation_type": acc.accommodation_type.value,
            "available_units": available,
            "base_rate": str(acc.base_rate),
            "base_occupancy": acc.base_occupancy,
            "max_occupancy": acc.max_occupancy,
            "max_adults": acc.max_adults,
            "max_children": acc.max_children,
            "nights": base_quote.nights,
            "estimated_total": str(base_quote.total_amount),
            "rate_plans": applicable_rate_plans,
            "promotions": applicable_promotions,
            "packages": applicable_packages,
        })

    return {
        "check_in_date": body.check_in_date.isoformat(),
        "check_out_date": body.check_out_date.isoformat(),
        "nights": (body.check_out_date - body.check_in_date).days,
        "num_adults": body.num_adults,
        "num_children": len(body.children_ages),
        "results": results,
    }


# ─── Live quote ─────────────────────────────────────────────────────────────

@router.post("/quote")
async def quote_booking(
    body: QuoteBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    acc = (await db.execute(
        select(Accommodation).where(
            Accommodation.id == body.accommodation_id,
            Accommodation.hotel_id == user.hotel_id,
            Accommodation.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if acc is None:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    try:
        q = await compute_quote(
            db, acc, body.check_in_date, body.check_out_date,
            body.num_adults, body.children_ages,
            rate_plan_id=body.rate_plan_id, promotion_id=body.promotion_id, package_id=body.package_id,
        )
    except PricingError as e:
        raise HTTPException(status_code=422, detail=str(e))

    available = await count_available_units(db, acc, body.check_in_date, body.check_out_date)
    result = _quote_dict(q)
    result["available_units"] = available
    return result


# ─── List ───────────────────────────────────────────────────────────────────

@router.get("")
async def list_bookings(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    check_in_from: Optional[date] = Query(None),
    check_in_to: Optional[date] = Query(None),
    sort: str = Query("check_in", regex="^(check_in|check_out|booking_date|guest)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hotel_id = user.hotel_id

    paid_subq = (
        select(func.coalesce(func.sum(PaymentRecord.amount), 0))
        .where(
            PaymentRecord.booking_id == Booking.id,
            PaymentRecord.status.in_((PaymentRecordStatus.PAID, PaymentRecordStatus.REFUNDED)),
        )
        .correlate(Booking)
        .scalar_subquery()
    )
    has_refund_subq = exists(
        select(PaymentRecord.id).where(
            PaymentRecord.booking_id == Booking.id,
            PaymentRecord.status == PaymentRecordStatus.REFUNDED,
        )
    )

    base_where = [Booking.hotel_id == hotel_id, Booking.deleted_at.is_(None)]
    if status:
        base_where.append(Booking.status == status)
    if check_in_from:
        base_where.append(Booking.check_in_date >= check_in_from)
    if check_in_to:
        base_where.append(Booking.check_in_date <= check_in_to)
    if payment_status == "unpaid":
        base_where.append(paid_subq <= 0)
        base_where.append(~has_refund_subq)
    elif payment_status == "partially_paid":
        base_where.append(paid_subq > 0)
        base_where.append(paid_subq < Booking.total_amount)
    elif payment_status == "paid":
        base_where.append(paid_subq >= Booking.total_amount)
    elif payment_status == "refunded":
        base_where.append(paid_subq <= 0)
        base_where.append(has_refund_subq)

    if search:
        pattern = f"%{search.strip()}%"
        acc_match = exists(
            select(BookingRoom.id)
            .join(Accommodation, BookingRoom.accommodation_id == Accommodation.id)
            .where(BookingRoom.booking_id == Booking.id, Accommodation.name.ilike(pattern))
        )
        search_clause = or_(
            Booking.booking_number.ilike(pattern),
            func.concat(Guest.first_name, " ", Guest.last_name).ilike(pattern),
            acc_match,
        )
    else:
        search_clause = None

    q = (
        select(Booking, paid_subq.label("total_paid"), has_refund_subq.label("has_refund"))
        .join(Guest, Booking.guest_id == Guest.id)
        .options(
            joinedload(Booking.guest),
            selectinload(Booking.rooms).joinedload(BookingRoom.accommodation),
        )
        .where(*base_where)
    )
    if search_clause is not None:
        q = q.where(search_clause)

    if sort == "check_in":
        q = q.order_by(Booking.check_in_date.desc())
    elif sort == "check_out":
        q = q.order_by(Booking.check_out_date.desc())
    elif sort == "booking_date":
        q = q.order_by(Booking.created_at.desc())
    else:  # guest
        q = q.order_by(Guest.first_name, Guest.last_name)

    count_q = (
        select(func.count(func.distinct(Booking.id)))
        .select_from(Booking)
        .join(Guest, Booking.guest_id == Guest.id)
        .where(*base_where)
    )
    if search_clause is not None:
        count_q = count_q.where(search_clause)
    total = (await db.execute(count_q)).scalar() or 0

    rows = (await db.execute(
        q.offset((page - 1) * page_size).limit(page_size)
    )).unique().all()

    items = []
    for b, total_paid, has_refund in rows:
        total_paid = Decimal(str(total_paid or 0))
        booking_total = Decimal(b.total_amount)
        rooms = list(b.rooms)
        first_acc = rooms[0].accommodation.name if rooms and rooms[0].accommodation else None
        if first_acc and len(rooms) > 1:
            accommodation_summary = f"{first_acc} +{len(rooms) - 1}"
        else:
            accommodation_summary = first_acc
        items.append({
            "id": str(b.id),
            "booking_number": b.booking_number,
            "guest_name": b.guest.full_name if b.guest else None,
            "accommodation_summary": accommodation_summary,
            "rooms_count": len(rooms),
            "check_in_date": b.check_in_date.isoformat(),
            "check_out_date": b.check_out_date.isoformat(),
            "nights": (b.check_out_date - b.check_in_date).days,
            "status": _status_value(b.status),
            "payment_status": compute_payment_status(booking_total, total_paid, bool(has_refund)),
            "total_amount": str(booking_total),
            "total_paid": str(total_paid),
            "booking_source": b.booking_source,
            "created_at": b.created_at.isoformat(),
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": max(1, -(-total // page_size)),
    }


# ─── Detail ─────────────────────────────────────────────────────────────────

@router.get("/{booking_id}")
async def get_booking(
    booking_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    b = (await db.execute(
        select(Booking)
        .where(
            Booking.id == booking_id,
            Booking.hotel_id == user.hotel_id,
            Booking.deleted_at.is_(None),
        )
        .options(*_detail_options())
    )).unique().scalar_one_or_none()
    if b is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    return _serialize_detail(b)


# ─── Create + confirm ───────────────────────────────────────────────────────

@router.post("")
async def create_booking(
    body: BookingCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hotel_id = user.hotel_id

    if body.status not in ("pending", "confirmed"):
        raise HTTPException(status_code=422, detail="Status must be 'pending' or 'confirmed'.")
    if body.booking_source is not None and body.booking_source not in VALID_SOURCES:
        raise HTTPException(status_code=422, detail=f"Invalid booking_source: {body.booking_source}")

    try:
        validate_dates(body.check_in_date, body.check_out_date)
    except PricingError as e:
        raise HTTPException(status_code=422, detail=str(e))

    guest = (await db.execute(
        select(Guest).where(
            Guest.id == body.guest_id, Guest.hotel_id == hotel_id, Guest.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if guest is None:
        raise HTTPException(status_code=422, detail="A valid guest is required before confirmation.")

    # Load and validate every referenced accommodation up front.
    acc_ids = {r.accommodation_id for r in body.rooms}
    accs = list((await db.execute(
        select(Accommodation).where(
            Accommodation.id.in_(acc_ids),
            Accommodation.hotel_id == hotel_id,
            Accommodation.is_active.is_(True),
            Accommodation.deleted_at.is_(None),
        )
    )).scalars().all())
    acc_map = {a.id: a for a in accs}
    for r in body.rooms:
        if r.accommodation_id not in acc_map:
            raise HTTPException(status_code=422, detail="One of the selected accommodations is not available.")

    # Availability: rooms of the same accommodation must fit within free units.
    required = Counter(r.accommodation_id for r in body.rooms)
    for aid, need in required.items():
        acc = acc_map[aid]
        available = await count_available_units(db, acc, body.check_in_date, body.check_out_date)
        if available < need:
            raise HTTPException(
                status_code=422,
                detail=f"Only {available} unit(s) of '{acc.name}' available for these dates; {need} requested.",
            )

    payment_method = await resolve_payment_method(db, hotel_id, body.payment_method_id)

    booking_number = await _generate_booking_number(db)
    status = BookingStatus(body.status)

    b = Booking(
        hotel_id=hotel_id,
        guest_id=guest.id,
        booking_number=booking_number,
        check_in_date=body.check_in_date,
        check_out_date=body.check_out_date,
        num_guests=0,
        total_amount=ZERO,
        status=status,
        booking_source=body.booking_source,
        notes=body.notes,
        payment_method_id=payment_method.id if payment_method else None,
        payment_method_name_snapshot=payment_method.name if payment_method else None,
    )
    db.add(b)
    await db.flush()

    grand_total = ZERO
    total_guests = 0
    total_adults = 0
    total_children = 0
    used_rate_plan_ids: set[uuid.UUID] = set()
    all_charges: list[BookingCharge] = []
    charge_order = 0
    charge_date = date.today()
    for idx, r in enumerate(body.rooms):
        acc = acc_map[r.accommodation_id]
        adults = len(r.adults)
        children_ages: list[int] = []
        for c in r.children:
            if c.age is None:
                raise HTTPException(status_code=422, detail="Each child occupant requires an age.")
            children_ages.append(c.age)

        try:
            q = await compute_quote(
                db, acc, body.check_in_date, body.check_out_date,
                adults, children_ages,
                rate_plan_id=r.rate_plan_id, promotion_id=r.promotion_id, package_id=r.package_id,
            )
        except PricingError as e:
            raise HTTPException(status_code=422, detail=f"{acc.name}: {e}")

        room = BookingRoom(
            booking_id=b.id,
            accommodation_id=acc.id,
            display_order=idx,
            num_adults=adults,
            num_children=len(children_ages),
            num_guests=adults + len(children_ages),
            rate_plan_id=q.rate_plan_id,
            rate_plan_name_snapshot=q.rate_plan_name,
            promotion_id=q.promotion_id,
            promotion_name_snapshot=q.promotion_name,
            discount_type_snapshot=q.promotion_discount_type,
            discount_value_snapshot=q.promotion_discount_value,
            package_id=q.package_id,
            package_name_snapshot=q.package_name,
            package_amount=q.package_amount,
            base_amount=q.base_amount,
            additional_adult_amount=q.additional_adult_amount,
            children_amount=q.children_amount,
            discount_amount=q.discount_amount,
            taxes_fees_amount=q.taxes_fees_amount,
            subtotal_amount=q.accommodation_subtotal,
            total_amount=q.total_amount,
        )
        db.add(room)
        await db.flush()

        order = 0
        for a in r.adults:
            db.add(BookingRoomGuest(
                booking_room_id=room.id, occupant_type="adult",
                full_name=_clean_name(a.full_name), age=None, display_order=order,
            ))
            order += 1
        for c in r.children:
            db.add(BookingRoomGuest(
                booking_room_id=room.id, occupant_type="child",
                full_name=_clean_name(c.full_name), age=c.age, display_order=order,
            ))
            order += 1

        for n in q.nightly:
            db.add(BookingNightlyRate(
                booking_room_id=room.id,
                date=n.date,
                room_rate=n.room_rate,
                additional_adult_amount=n.additional_adult_amount,
                children_amount=n.children_amount,
                night_total=n.night_total,
            ))

        for row in room_charge_rows(room, acc.name):
            charge = BookingCharge(booking_id=b.id, charge_date=charge_date, display_order=charge_order, **row)
            db.add(charge)
            all_charges.append(charge)
            charge_order += 1

        grand_total += q.total_amount
        total_guests += adults + len(children_ages)
        total_adults += adults
        total_children += len(children_ages)
        if q.rate_plan_id is not None:
            used_rate_plan_ids.add(q.rate_plan_id)

    net_subtotal = money(grand_total)
    nights = (body.check_out_date - body.check_in_date).days

    # Billable items: booking-level charges, validated against the accommodations
    # and rate plans actually used by this booking's rooms.
    eligible_items = await load_eligible_items(
        db, hotel_id, set(acc_map.keys()), used_rate_plan_ids, require_stage="booking"
    )
    eligible_map = {item.id: item for item in eligible_items}
    billable_lines = []
    for bi in body.billable_items:
        item = eligible_map.get(bi.billable_item_id)
        if item is None:
            raise HTTPException(status_code=422, detail="One of the selected billable items is not available for this booking.")
        billable_lines.append(compute_billable_item_line(
            item, bi.quantity, nights, total_guests, total_adults, total_children, net_subtotal,
        ))
    for order, line in enumerate(billable_lines):
        bi_row = BookingBillableItem(
            booking_id=b.id,
            billable_item_id=line.billable_item_id,
            name_snapshot=line.name,
            category_snapshot=line.category,
            pricing_type_snapshot=line.pricing_type,
            unit_price_snapshot=line.unit_price,
            quantity=line.quantity,
            is_taxable_snapshot=line.is_taxable,
            calculated_amount=line.amount,
            display_order=order,
        )
        db.add(bi_row)
        await db.flush()
        charge = BookingCharge(
            booking_id=b.id, charge_date=charge_date, display_order=charge_order,
            **billable_item_charge_row(bi_row),
        )
        db.add(charge)
        all_charges.append(charge)
        charge_order += 1
    billable_items_total = billable_grand_total(billable_lines)
    taxable_billable = billable_taxable_total(billable_lines)

    # Reservation-level taxes over the taxable base = room subtotal + taxable billable items.
    taxable_base = money(net_subtotal + taxable_billable)
    active_taxes = await load_active_taxes(db, hotel_id)
    tax_lines = compute_taxes(
        active_taxes, taxable_base, nights, total_guests, total_adults, total_children
    )
    for order, line in enumerate(tax_lines):
        tax_row = BookingTax(
            booking_id=b.id,
            tax_id=line.tax_id,
            name_snapshot=line.name,
            tax_type_snapshot=line.tax_type,
            rate_snapshot=line.rate,
            calculation_method_snapshot=line.calculation_method,
            application_scope_snapshot=line.application_scope,
            calculated_amount=line.amount,
            is_included=line.is_included,
            display_order=order,
        )
        db.add(tax_row)
        await db.flush()
        charge = BookingCharge(
            booking_id=b.id, charge_date=charge_date, display_order=charge_order,
            **tax_charge_row(tax_row),
        )
        db.add(charge)
        all_charges.append(charge)
        charge_order += 1
    tax_total = added_tax_total(tax_lines)

    b.subtotal_amount = net_subtotal
    b.billable_items_amount = billable_items_total
    b.tax_total = tax_total
    b.total_amount = charges_total(all_charges)
    b.num_guests = total_guests

    # Deposit snapshot from a pay-at-property method (over the tax-inclusive total).
    if payment_method is not None:
        deposit_required, deposit_amount = _compute_deposit(payment_method, b.total_amount)
        b.deposit_required = deposit_required
        b.deposit_amount = deposit_amount

    db.add(BookingStatusHistory(
        booking_id=b.id,
        from_status=None,
        to_status=status.value,
        note="Booking created",
        changed_by_user_id=user.id,
    ))

    await db.commit()
    return _serialize_detail(await _load_detail(db, b.id))


# ─── Status change ──────────────────────────────────────────────────────────

@router.patch("/{booking_id}/status")
async def update_status(
    booking_id: uuid.UUID,
    body: StatusUpdateBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        new_status = BookingStatus(body.status)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid status: {body.status}")
    if new_status not in ASSIGNABLE_STATUSES:
        raise HTTPException(status_code=422, detail=f"Status '{body.status}' cannot be assigned manually.")

    b = await _get_or_404(db, booking_id, user.hotel_id)
    old_status = b.status
    old_value = _status_value(old_status)
    if old_value == new_status.value:
        raise HTTPException(status_code=422, detail="Booking is already in that status.")

    b.status = new_status
    db.add(BookingStatusHistory(
        booking_id=b.id,
        from_status=old_value,
        to_status=new_status.value,
        note=body.note,
        changed_by_user_id=user.id,
    ))
    await db.commit()
    return _serialize_detail(await _load_detail(db, booking_id))


# ─── Record payment ─────────────────────────────────────────────────────────

@router.post("/{booking_id}/payments")
async def record_payment(
    booking_id: uuid.UUID,
    body: PaymentBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    b = await _get_or_404(db, booking_id, user.hotel_id)
    record = await create_payment_record(
        db, user.hotel_id, user.id, b,
        body.payment_method_id, body.amount, body.payment_date,
        body.reference_number, body.notes,
    )
    await log_audit(
        db, action=AuditAction.PAYMENT_CREATED, entity_type="payment_record", entity_id=str(record.id),
        hotel_id=user.hotel_id, user_id=user.id,
        after_state={"booking_id": str(b.id), "amount": str(body.amount)},
    )
    await db.commit()
    return _serialize_detail(await _load_detail(db, booking_id))


# ─── Add billable item (post-confirmation) ─────────────────────────────────

@router.post("/{booking_id}/billable-items")
async def add_billable_item(
    booking_id: uuid.UUID,
    body: BillableItemInput,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a billable item line to an existing booking (represents adding a
    charge at check-in, during the stay, or at check-out -- there are no
    dedicated screens for those stages yet, so this endpoint covers all of
    them from the Booking Detail page). Does not retroactively recompute the
    booking's already-snapshotted taxes; the line's amount is simply added."""
    b = (await db.execute(
        select(Booking)
        .where(Booking.id == booking_id, Booking.hotel_id == user.hotel_id, Booking.deleted_at.is_(None))
        .options(selectinload(Booking.rooms))
    )).scalar_one_or_none()
    if b is None:
        raise HTTPException(status_code=404, detail="Booking not found")

    accommodation_ids = {r.accommodation_id for r in b.rooms}
    rate_plan_ids = {r.rate_plan_id for r in b.rooms if r.rate_plan_id is not None}
    nights = (b.check_out_date - b.check_in_date).days
    total_adults = sum(r.num_adults for r in b.rooms)
    total_children = sum(r.num_children for r in b.rooms)
    total_guests = total_adults + total_children

    eligible = await load_eligible_items(db, user.hotel_id, accommodation_ids, rate_plan_ids, require_stage=None)
    eligible_map = {item.id: item for item in eligible}
    item = eligible_map.get(body.billable_item_id)
    if item is None:
        raise HTTPException(status_code=422, detail="This billable item is not available for this booking.")

    line = compute_billable_item_line(
        item, body.quantity, nights, total_guests, total_adults, total_children, b.subtotal_amount,
    )
    next_order = (await db.execute(
        select(func.count(BookingBillableItem.id)).where(BookingBillableItem.booking_id == b.id)
    )).scalar() or 0
    bi_row = BookingBillableItem(
        booking_id=b.id,
        billable_item_id=line.billable_item_id,
        name_snapshot=line.name,
        category_snapshot=line.category,
        pricing_type_snapshot=line.pricing_type,
        unit_price_snapshot=line.unit_price,
        quantity=line.quantity,
        is_taxable_snapshot=line.is_taxable,
        calculated_amount=line.amount,
        display_order=next_order,
    )
    db.add(bi_row)
    await db.flush()

    next_charge_order = (await db.execute(
        select(func.count(BookingCharge.id)).where(BookingCharge.booking_id == b.id)
    )).scalar() or 0
    charge = BookingCharge(
        booking_id=b.id, charge_date=date.today(), display_order=next_charge_order,
        **billable_item_charge_row(bi_row),
    )
    db.add(charge)

    b.billable_items_amount = money(b.billable_items_amount + line.amount)
    b.total_amount = money(b.total_amount + charge.amount)

    await log_audit(
        db, action=AuditAction.CHARGE_ADDED, entity_type="booking_charge", entity_id=None,
        hotel_id=user.hotel_id, user_id=user.id,
        after_state={"booking_id": str(b.id), "category": "billable_item", "amount": str(charge.amount)},
    )
    await db.commit()
    return _serialize_detail(await _load_detail(db, booking_id))


# ─── Manual charges + adjustments (Booking Charges ledger) ─────────────────

@router.post("/{booking_id}/charges")
async def add_manual_charge(
    booking_id: uuid.UUID,
    body: ManualChargeBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Manual, ad-hoc ledger entries (damage fee, cleaning fee, misc.) not
    tied to a Billable Item catalog entry."""
    if body.category not in MANUAL_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"category must be one of {sorted(MANUAL_CATEGORIES)}")
    b = await _get_or_404(db, booking_id, user.hotel_id)

    next_order = (await db.execute(
        select(func.count(BookingCharge.id)).where(BookingCharge.booking_id == b.id)
    )).scalar() or 0
    amount = money(body.amount)
    charge = BookingCharge(
        booking_id=b.id,
        category=body.category,
        description=body.description.strip(),
        quantity=1,
        unit_price=amount,
        amount=amount,
        charge_date=date.today(),
        created_by_user_id=user.id,
        notes=body.notes,
        display_order=next_order,
    )
    db.add(charge)
    b.total_amount = money(b.total_amount + amount)

    await log_audit(
        db, action=AuditAction.CHARGE_ADDED, entity_type="booking_charge", entity_id=None,
        hotel_id=user.hotel_id, user_id=user.id,
        after_state={"booking_id": str(b.id), "category": body.category, "amount": str(amount)},
    )
    await db.commit()
    return _serialize_detail(await _load_detail(db, booking_id))


@router.post("/{booking_id}/charges/{charge_id}/adjust")
async def adjust_booking_charge(
    booking_id: uuid.UUID,
    charge_id: uuid.UUID,
    body: AdjustChargeBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Reduce or reverse an existing charge by posting a new negative-amount
    row linked back to it via ``adjusts_charge_id`` -- the original charge is
    never edited or deleted."""
    b = await _get_or_404(db, booking_id, user.hotel_id)
    original = (await db.execute(
        select(BookingCharge).where(BookingCharge.id == charge_id, BookingCharge.booking_id == b.id)
    )).scalar_one_or_none()
    if original is None:
        raise HTTPException(status_code=404, detail="Charge not found")

    next_order = (await db.execute(
        select(func.count(BookingCharge.id)).where(BookingCharge.booking_id == b.id)
    )).scalar() or 0
    charge = await adjust_charge_row(
        db, user.id, original, body.amount, body.category, body.description, body.notes,
        display_order=next_order,
    )
    b.total_amount = money(b.total_amount + charge.amount)

    await log_audit(
        db, action=AuditAction.CHARGE_ADJUSTED, entity_type="booking_charge", entity_id=str(charge.id),
        hotel_id=user.hotel_id, user_id=user.id,
        after_state={"adjusts_charge_id": str(original.id), "amount": str(charge.amount)},
    )
    await db.commit()
    return _serialize_detail(await _load_detail(db, booking_id))


# ─── Soft delete ────────────────────────────────────────────────────────────

@router.delete("/{booking_id}")
async def delete_booking(
    booking_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    b = await _get_or_404(db, booking_id, user.hotel_id)
    b.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}
