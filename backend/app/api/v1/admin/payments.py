import uuid
from datetime import date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.platform_admin import PlatformAdmin
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["admin-payments"])


class RecordPaymentRequest(BaseModel):
    hotel_id: uuid.UUID
    invoice_id: Optional[uuid.UUID] = None
    amount: Decimal
    payment_date: date
    proof_of_payment_url: Optional[str] = None
    notes: Optional[str] = None


@router.get("")
async def list_payments(
    hotel_id: Optional[uuid.UUID] = Query(None),
    invoice_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    items, total, pagination = await PaymentService(db).list_payments(
        hotel_id=hotel_id, invoice_id=invoice_id, page=page, page_size=page_size
    )
    return {**pagination, "items": [_payment_out(p) for p in items]}


@router.post("", status_code=201)
async def record_payment(
    body: RecordPaymentRequest,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    payment = await PaymentService(db).record_payment(admin.id, body.model_dump())
    return _payment_out(payment)


def _payment_out(p) -> dict:
    return {
        "id": str(p.id),
        "hotel_id": str(p.hotel_id),
        "invoice_id": str(p.invoice_id) if p.invoice_id else None,
        "amount": str(p.amount),
        "payment_date": str(p.payment_date),
        "proof_of_payment_url": p.proof_of_payment_url,
        "notes": p.notes,
        "recorded_by": str(p.recorded_by),
        "created_at": p.created_at.isoformat(),
    }
