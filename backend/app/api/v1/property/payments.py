import uuid
from datetime import date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload, joinedload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.constants import AuditAction
from app.models.user import User
from app.models.property_portal import PaymentRecord, PaymentRecordStatus, PaymentTransaction, Booking, Guest
from app.services.payments import refund_payment as refund_payment_row
from app.services.pricing import money
from app.services.audit_service import log_audit

router = APIRouter(prefix="/payments", tags=["property-payments"])


class RefundBody(BaseModel):
    amount: Optional[Decimal] = Field(default=None, gt=0)
    reference_number: Optional[str] = None
    notes: Optional[str] = None


def _status_value(s) -> str:
    return s.value if hasattr(s, "value") else s


def _detail_options():
    return (
        joinedload(PaymentRecord.booking).joinedload(Booking.guest),
        joinedload(PaymentRecord.payment_method),
        joinedload(PaymentRecord.recorded_by),
        joinedload(PaymentRecord.refunded_payment),
        selectinload(PaymentRecord.transactions),
    )


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


def _serialize_row(p: PaymentRecord) -> dict:
    booking = p.booking
    guest = booking.guest if booking else None
    return {
        "id": str(p.id),
        "payment_number": p.payment_number,
        "booking_id": str(p.booking_id) if p.booking_id else None,
        "booking_number": booking.booking_number if booking else None,
        "guest_name": guest.full_name if guest else None,
        "payment_method_id": str(p.payment_method_id) if p.payment_method_id else None,
        "payment_method_name": p.payment_method_name_snapshot or p.method,
        "amount": str(p.amount),
        "status": _status_value(p.status),
        "payment_date": p.payment_date.isoformat(),
        "reference_number": p.reference_number,
        "recorded_by_name": p.recorded_by.full_name if p.recorded_by else None,
        "refunded_payment_id": str(p.refunded_payment_id) if p.refunded_payment_id else None,
        "created_at": p.created_at.isoformat(),
    }


async def _get_or_404(db: AsyncSession, payment_id: uuid.UUID, hotel_id: uuid.UUID) -> PaymentRecord:
    p = (await db.execute(
        select(PaymentRecord)
        .where(PaymentRecord.id == payment_id, PaymentRecord.hotel_id == hotel_id)
        .options(*_detail_options())
    )).unique().scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    return p


async def _serialize_detail(db: AsyncSession, p: PaymentRecord) -> dict:
    refunds = (await db.execute(
        select(PaymentRecord)
        .where(PaymentRecord.refunded_payment_id == p.id)
        .options(*_detail_options())
        .order_by(PaymentRecord.created_at)
    )).unique().scalars().all()
    already_refunded = money(-sum((Decimal(r.amount) for r in refunds), Decimal("0")))
    refundable_remaining = (
        money(Decimal(p.amount) - already_refunded) if p.status == PaymentRecordStatus.PAID else Decimal("0.00")
    )
    booking = p.booking

    return {
        **_serialize_row(p),
        "notes": p.notes,
        "transactions": [_serialize_transaction(t) for t in p.transactions],
        "refunded_payment": _serialize_row(p.refunded_payment) if p.refunded_payment else None,
        "refunds": [_serialize_row(r) for r in refunds],
        "refundable_remaining": str(max(refundable_remaining, Decimal("0.00"))),
        "booking": {
            "id": str(booking.id),
            "booking_number": booking.booking_number,
            "guest_name": booking.guest.full_name if booking.guest else None,
            "total_amount": str(booking.total_amount),
        } if booking else None,
    }


@router.get("")
async def list_payments(
    search: Optional[str] = Query(None),
    payment_method_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    sort: str = Query("payment_date", regex="^(payment_date|amount|guest_name|booking_number)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hotel_id = user.hotel_id
    # Booking.deleted_at is NULL both when the booking is live and when there's no
    # booking joined at all (outerjoin), so this excludes only payments whose booking
    # was soft-deleted -- the payment rows themselves are never hidden or destroyed.
    where = [PaymentRecord.hotel_id == hotel_id, Booking.deleted_at.is_(None)]
    if payment_method_id:
        where.append(PaymentRecord.payment_method_id == payment_method_id)
    if status:
        where.append(PaymentRecord.status == status)
    if date_from:
        where.append(PaymentRecord.payment_date >= date_from)
    if date_to:
        where.append(PaymentRecord.payment_date <= date_to)
    if search:
        pattern = f"%{search.strip()}%"
        where.append(or_(
            PaymentRecord.payment_number.ilike(pattern),
            PaymentRecord.reference_number.ilike(pattern),
            Booking.booking_number.ilike(pattern),
            func.concat(Guest.first_name, " ", Guest.last_name).ilike(pattern),
        ))

    base_q = (
        select(PaymentRecord)
        .outerjoin(Booking, PaymentRecord.booking_id == Booking.id)
        .outerjoin(Guest, Booking.guest_id == Guest.id)
        .where(*where)
    )

    total = (await db.execute(
        select(func.count()).select_from(base_q.with_only_columns(PaymentRecord.id).subquery())
    )).scalar() or 0

    q = base_q.options(
        joinedload(PaymentRecord.booking).joinedload(Booking.guest),
        joinedload(PaymentRecord.payment_method),
        joinedload(PaymentRecord.recorded_by),
    )
    if sort == "payment_date":
        q = q.order_by(PaymentRecord.payment_date.desc(), PaymentRecord.created_at.desc())
    elif sort == "amount":
        q = q.order_by(PaymentRecord.amount.desc())
    elif sort == "guest_name":
        q = q.order_by(Guest.first_name, Guest.last_name)
    else:  # booking_number
        q = q.order_by(Booking.booking_number)

    rows = (await db.execute(
        q.offset((page - 1) * page_size).limit(page_size)
    )).unique().scalars().all()

    return {
        "items": [_serialize_row(p) for p in rows],
        "total": total,
        "page": page,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/{payment_id}")
async def get_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = await _get_or_404(db, payment_id, user.hotel_id)
    return await _serialize_detail(db, p)


@router.post("/{payment_id}/refund")
async def refund_payment(
    payment_id: uuid.UUID,
    body: RefundBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    original = await _get_or_404(db, payment_id, user.hotel_id)
    refund = await refund_payment_row(
        db, user.hotel_id, user.id, original, body.amount, body.reference_number, body.notes,
    )
    await log_audit(
        db, action=AuditAction.PAYMENT_REFUNDED, entity_type="payment_record", entity_id=str(refund.id),
        hotel_id=user.hotel_id, user_id=user.id,
        after_state={"refunded_payment_id": str(original.id), "amount": str(refund.amount)},
    )
    await db.commit()
    refund = await _get_or_404(db, refund.id, user.hotel_id)
    return await _serialize_detail(db, refund)
