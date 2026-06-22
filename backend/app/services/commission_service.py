import uuid
from decimal import Decimal
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.constants import AuditAction
from app.core.exceptions import NotFoundError, ConflictError
from app.models.billing import CommissionStatement, CommissionStatementStatus, CommissionAdjustment
from app.repositories.billing import CommissionStatementRepository
from app.repositories.subscription import PropertySubscriptionRepository
from app.services.audit_service import log_audit


class CommissionService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = CommissionStatementRepository(session)
        self.sub_repo = PropertySubscriptionRepository(session)

    async def list_statements(
        self,
        hotel_id: uuid.UUID | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[CommissionStatement], int, dict]:
        items, total = await self.repo.list_with_filters(hotel_id=hotel_id, page=page, page_size=page_size)
        return items, total, self.repo.paginate(total, page, page_size)

    async def get_statement(self, statement_id: uuid.UUID) -> CommissionStatement:
        stmt = await self.repo.get_by_id(statement_id)
        if not stmt:
            raise NotFoundError("Commission statement not found.")
        return stmt

    async def create_statement(
        self,
        admin_id: uuid.UUID,
        hotel_id: uuid.UUID,
        period_type: str,
        period_start: date,
        period_end: date,
        total_booking_revenue: Decimal,
        eligible_booking_revenue: Decimal,
    ) -> CommissionStatement:
        sub = await self.sub_repo.get_by_hotel_id(hotel_id)
        commission_pct = sub.plan.commission_percentage if sub else Decimal("0.00")
        total_due = (eligible_booking_revenue * commission_pct / Decimal("100")).quantize(Decimal("0.01"))

        statement = await self.repo.create({
            "hotel_id": hotel_id,
            "period_type": period_type,
            "period_start": period_start,
            "period_end": period_end,
            "total_booking_revenue": total_booking_revenue,
            "eligible_booking_revenue": eligible_booking_revenue,
            "commission_percentage": commission_pct,
            "total_commission_due": total_due,
            "created_by": admin_id,
        })
        await log_audit(
            self.session,
            action=AuditAction.COMMISSION_CALCULATED,
            entity_type="commission_statement",
            entity_id=str(statement.id),
            hotel_id=hotel_id,
            admin_id=admin_id,
            after_state={"period": f"{period_start} - {period_end}", "total_due": str(total_due)},
        )
        await self.session.commit()
        return await self.get_statement(statement.id)

    async def add_adjustment(
        self,
        admin_id: uuid.UUID,
        statement_id: uuid.UUID,
        amount: Decimal,
        reason: str,
    ) -> CommissionAdjustment:
        stmt = await self.get_statement(statement_id)
        if stmt.status == CommissionStatementStatus.FINALIZED:
            raise ConflictError("Cannot adjust a finalized commission statement.")

        adj = CommissionAdjustment(
            statement_id=statement_id,
            hotel_id=stmt.hotel_id,
            amount=amount,
            reason=reason,
            approved_by=admin_id,
        )
        self.session.add(adj)
        await self.session.flush()

        await log_audit(
            self.session,
            action=AuditAction.COMMISSION_ADJUSTED,
            entity_type="commission_adjustment",
            entity_id=str(adj.id),
            hotel_id=stmt.hotel_id,
            admin_id=admin_id,
            after_state={"amount": str(amount), "reason": reason},
        )
        await self.session.commit()
        return adj

    async def finalize_statement(self, admin_id: uuid.UUID, statement_id: uuid.UUID) -> CommissionStatement:
        stmt = await self.get_statement(statement_id)
        if stmt.status == CommissionStatementStatus.FINALIZED:
            raise ConflictError("Statement is already finalized.")
        await self.repo.update(stmt, {"status": CommissionStatementStatus.FINALIZED})
        await log_audit(
            self.session,
            action=AuditAction.COMMISSION_FINALIZED,
            entity_type="commission_statement",
            entity_id=str(statement_id),
            hotel_id=stmt.hotel_id,
            admin_id=admin_id,
        )
        await self.session.commit()
        return await self.get_statement(statement_id)

    async def net_amount(self, statement_id: uuid.UUID) -> Decimal:
        stmt = await self.get_statement(statement_id)
        adjustment_total = await self.repo.sum_adjustments(statement_id)
        return stmt.total_commission_due + adjustment_total
