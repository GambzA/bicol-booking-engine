import uuid
from datetime import date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.billing import InvoiceType, InvoiceStatus
from app.models.platform_admin import PlatformAdmin
from app.services.invoice_service import InvoiceService

router = APIRouter(prefix="/invoices", tags=["admin-invoices"])


class CreateInvoiceRequest(BaseModel):
    hotel_id: uuid.UUID
    type: InvoiceType
    billing_period_start: date
    billing_period_end: date
    due_date: date
    subscription_amount: Decimal = Decimal("0.00")
    commission_amount: Decimal = Decimal("0.00")
    tax_amount: Decimal = Decimal("0.00")
    notes: Optional[str] = None
    commission_statement_id: Optional[uuid.UUID] = None


class VoidRequest(BaseModel):
    reason: str


@router.get("")
async def list_invoices(
    hotel_id: Optional[uuid.UUID] = Query(None),
    status: Optional[InvoiceStatus] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    items, total, pagination = await InvoiceService(db).list_invoices(
        hotel_id=hotel_id, status=status, page=page, page_size=page_size
    )
    return {**pagination, "items": [_invoice_out(i) for i in items]}


@router.post("", status_code=201)
async def create_invoice(
    body: CreateInvoiceRequest,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    invoice = await InvoiceService(db).create_invoice(admin.id, body.model_dump())
    return _invoice_out(invoice)


@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    invoice = await InvoiceService(db).get_invoice(invoice_id)
    return _invoice_out(invoice)


@router.post("/{invoice_id}/send")
async def send_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    invoice = await InvoiceService(db).send_invoice(admin.id, invoice_id)
    return _invoice_out(invoice)


@router.post("/{invoice_id}/void")
async def void_invoice(
    invoice_id: uuid.UUID,
    body: VoidRequest,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    invoice = await InvoiceService(db).void_invoice(admin.id, invoice_id, body.reason)
    return _invoice_out(invoice)


@router.post("/{invoice_id}/mark-paid")
async def mark_paid(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    invoice = await InvoiceService(db).mark_paid(admin.id, invoice_id)
    return _invoice_out(invoice)


def _invoice_out(i) -> dict:
    return {
        "id": str(i.id),
        "invoice_number": i.invoice_number,
        "hotel_id": str(i.hotel_id),
        "type": i.type.value,
        "status": i.status.value,
        "billing_period_start": str(i.billing_period_start),
        "billing_period_end": str(i.billing_period_end),
        "due_date": str(i.due_date),
        "subscription_amount": str(i.subscription_amount),
        "commission_amount": str(i.commission_amount),
        "tax_amount": str(i.tax_amount),
        "total_amount": str(i.total_amount),
        "notes": i.notes,
        "sent_at": i.sent_at.isoformat() if i.sent_at else None,
        "paid_at": i.paid_at.isoformat() if i.paid_at else None,
        "voided_at": i.voided_at.isoformat() if i.voided_at else None,
        "commission_statement_id": str(i.commission_statement_id) if i.commission_statement_id else None,
        "created_at": i.created_at.isoformat(),
    }
