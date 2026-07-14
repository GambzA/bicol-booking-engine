"""Payment recording and refund engine.

Payments never modify a booking's charges (subtotal/tax/billable-items/total) --
they only reduce the outstanding balance. A refund is a brand-new PaymentRecord
with a negative amount linked back to the payment it refunds (``refunded_payment_id``),
never an edit to the original -- both rows stay immutable audit history.
"""
import secrets
import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.property_portal import PaymentRecord, PaymentRecordStatus, PaymentTransaction, PaymentMethod, Booking
from app.services.pricing import money, ZERO

# Statuses that count toward a booking's net paid balance. Refund rows carry a
# negative amount, so summing PAID + REFUNDED together nets the balance down.
NET_PAID_STATUSES = (PaymentRecordStatus.PAID, PaymentRecordStatus.REFUNDED)


def _status_value(s) -> str:
    return s.value if hasattr(s, "value") else s


async def generate_payment_number(db: AsyncSession) -> str:
    prefix = f"PAY-{date.today():%Y%m%d}-"
    for _ in range(12):
        candidate = prefix + secrets.token_hex(2).upper()
        exists_row = (await db.execute(
            select(PaymentRecord.id).where(PaymentRecord.payment_number == candidate)
        )).scalar_one_or_none()
        if exists_row is None:
            return candidate
    raise HTTPException(status_code=500, detail="Could not generate a unique payment number")


async def resolve_payment_method(
    db: AsyncSession, hotel_id: uuid.UUID, method_id: Optional[uuid.UUID], require_enabled: bool = True
) -> Optional[PaymentMethod]:
    if method_id is None:
        return None
    pm = (await db.execute(
        select(PaymentMethod).where(
            PaymentMethod.id == method_id,
            PaymentMethod.hotel_id == hotel_id,
            PaymentMethod.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if pm is None:
        raise HTTPException(status_code=422, detail="Selected payment method is not available.")
    if require_enabled and not pm.is_enabled:
        raise HTTPException(status_code=422, detail="Selected payment method is not enabled.")
    return pm


async def booking_net_paid(db: AsyncSession, booking_id: uuid.UUID) -> Decimal:
    total = (await db.execute(
        select(func.coalesce(func.sum(PaymentRecord.amount), 0)).where(
            PaymentRecord.booking_id == booking_id,
            PaymentRecord.status.in_(NET_PAID_STATUSES),
        )
    )).scalar() or 0
    return money(Decimal(str(total)))


async def booking_has_refund(db: AsyncSession, booking_id: uuid.UUID) -> bool:
    return (await db.execute(
        select(PaymentRecord.id)
        .where(PaymentRecord.booking_id == booking_id, PaymentRecord.status == PaymentRecordStatus.REFUNDED)
        .limit(1)
    )).scalar_one_or_none() is not None


def payment_status(total: Decimal, net_paid: Decimal, has_refund: bool) -> str:
    if net_paid >= total:
        return "paid"
    if net_paid > ZERO:
        return "partially_paid"
    return "refunded" if has_refund else "unpaid"


async def record_payment(
    db: AsyncSession,
    hotel_id: uuid.UUID,
    user_id: uuid.UUID,
    booking: Booking,
    payment_method_id: uuid.UUID,
    amount: Decimal,
    payment_date: Optional[date],
    reference_number: Optional[str],
    notes: Optional[str],
) -> PaymentRecord:
    pm = await resolve_payment_method(db, hotel_id, payment_method_id, require_enabled=True)
    if pm is None:
        raise HTTPException(status_code=422, detail="A payment method is required.")

    total = money(Decimal(booking.total_amount))
    net_paid = await booking_net_paid(db, booking.id)
    outstanding = max(total - net_paid, ZERO)
    amount = money(amount)
    if amount <= ZERO:
        raise HTTPException(status_code=422, detail="Payment amount must be greater than zero.")
    if amount > outstanding:
        raise HTTPException(status_code=422, detail="Payment amount cannot exceed the outstanding balance.")

    record = PaymentRecord(
        hotel_id=hotel_id,
        booking_id=booking.id,
        payment_number=await generate_payment_number(db),
        amount=amount,
        payment_date=payment_date or date.today(),
        payment_method_id=pm.id,
        payment_method_name_snapshot=pm.name,
        reference_number=reference_number,
        notes=notes,
        status=PaymentRecordStatus.PAID,
        recorded_by_user_id=user_id,
    )
    db.add(record)
    await db.flush()
    db.add(PaymentTransaction(
        payment_record_id=record.id,
        transaction_type="manual_payment_recorded",
        status=_status_value(PaymentRecordStatus.PAID),
        amount=amount,
        reference_number=reference_number,
        remarks=notes,
    ))
    return record


async def refund_payment(
    db: AsyncSession,
    hotel_id: uuid.UUID,
    user_id: uuid.UUID,
    original: PaymentRecord,
    amount: Optional[Decimal],
    reference_number: Optional[str],
    notes: Optional[str],
) -> PaymentRecord:
    if original.hotel_id != hotel_id:
        raise HTTPException(status_code=404, detail="Payment not found")
    if original.status != PaymentRecordStatus.PAID:
        raise HTTPException(status_code=422, detail="Only a paid payment can be refunded.")

    already_refunded_raw = (await db.execute(
        select(func.coalesce(func.sum(PaymentRecord.amount), 0)).where(
            PaymentRecord.refunded_payment_id == original.id,
        )
    )).scalar() or 0
    already_refunded = money(-Decimal(str(already_refunded_raw)))
    refundable_remaining = money(Decimal(original.amount) - already_refunded)
    if refundable_remaining <= ZERO:
        raise HTTPException(status_code=422, detail="This payment has already been fully refunded.")

    refund_amount = money(amount) if amount is not None else refundable_remaining
    if refund_amount <= ZERO:
        raise HTTPException(status_code=422, detail="Refund amount must be greater than zero.")
    if refund_amount > refundable_remaining:
        raise HTTPException(status_code=422, detail="Refund amount cannot exceed the remaining refundable amount.")

    refund = PaymentRecord(
        hotel_id=hotel_id,
        booking_id=original.booking_id,
        payment_number=await generate_payment_number(db),
        amount=money(-refund_amount),
        payment_date=date.today(),
        payment_method_id=original.payment_method_id,
        payment_method_name_snapshot=original.payment_method_name_snapshot,
        reference_number=reference_number,
        notes=notes,
        status=PaymentRecordStatus.REFUNDED,
        recorded_by_user_id=user_id,
        refunded_payment_id=original.id,
    )
    db.add(refund)
    await db.flush()
    db.add(PaymentTransaction(
        payment_record_id=refund.id,
        transaction_type="refund_completed",
        status=_status_value(PaymentRecordStatus.REFUNDED),
        amount=refund_amount,
        reference_number=reference_number,
        remarks=notes,
    ))
    return refund
