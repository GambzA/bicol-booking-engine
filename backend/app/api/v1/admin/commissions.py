import uuid
from datetime import date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.billing import PeriodType
from app.models.platform_admin import PlatformAdmin
from app.services.commission_service import CommissionService

router = APIRouter(prefix="/commissions", tags=["admin-commissions"])


class CreateStatementRequest(BaseModel):
    hotel_id: uuid.UUID
    period_type: PeriodType
    period_start: date
    period_end: date
    total_booking_revenue: Decimal
    eligible_booking_revenue: Decimal


class AddAdjustmentRequest(BaseModel):
    amount: Decimal
    reason: str


@router.get("")
async def list_statements(
    hotel_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    items, total, pagination = await CommissionService(db).list_statements(hotel_id=hotel_id, page=page, page_size=page_size)
    return {**pagination, "items": [_stmt_out(s) for s in items]}


@router.post("", status_code=201)
async def create_statement(
    body: CreateStatementRequest,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    stmt = await CommissionService(db).create_statement(
        admin_id=admin.id,
        hotel_id=body.hotel_id,
        period_type=body.period_type.value,
        period_start=body.period_start,
        period_end=body.period_end,
        total_booking_revenue=body.total_booking_revenue,
        eligible_booking_revenue=body.eligible_booking_revenue,
    )
    return _stmt_out(stmt)


@router.get("/{statement_id}")
async def get_statement(
    statement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    svc = CommissionService(db)
    stmt = await svc.get_statement(statement_id)
    net = await svc.net_amount(statement_id)
    return {**_stmt_out(stmt), "net_commission_due": str(net)}


@router.post("/{statement_id}/adjustments", status_code=201)
async def add_adjustment(
    statement_id: uuid.UUID,
    body: AddAdjustmentRequest,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    adj = await CommissionService(db).add_adjustment(admin.id, statement_id, body.amount, body.reason)
    return {
        "id": str(adj.id),
        "statement_id": str(adj.statement_id),
        "amount": str(adj.amount),
        "reason": adj.reason,
        "approved_by": str(adj.approved_by),
        "created_at": adj.created_at.isoformat(),
    }


@router.post("/{statement_id}/finalize")
async def finalize_statement(
    statement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    stmt = await CommissionService(db).finalize_statement(admin.id, statement_id)
    return _stmt_out(stmt)


def _stmt_out(s) -> dict:
    return {
        "id": str(s.id),
        "hotel_id": str(s.hotel_id),
        "period_type": s.period_type.value,
        "period_start": str(s.period_start),
        "period_end": str(s.period_end),
        "total_booking_revenue": str(s.total_booking_revenue),
        "eligible_booking_revenue": str(s.eligible_booking_revenue),
        "commission_percentage": str(s.commission_percentage),
        "total_commission_due": str(s.total_commission_due),
        "status": s.status.value,
        "invoice_id": str(s.invoice_id) if s.invoice_id else None,
        "created_at": s.created_at.isoformat(),
        "adjustments": [
            {"id": str(a.id), "amount": str(a.amount), "reason": a.reason, "created_at": a.created_at.isoformat()}
            for a in (s.adjustments or [])
        ],
    }
