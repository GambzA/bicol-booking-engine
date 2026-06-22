from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.models.billing import Invoice, Payment, CommissionStatement, CommissionAdjustment, InvoiceStatus
from app.repositories.base import BaseRepository


class InvoiceRepository(BaseRepository[Invoice]):
    model = Invoice

    async def generate_number(self) -> str:
        year = datetime.now(timezone.utc).year
        result = await self.session.execute(
            select(func.count(Invoice.id)).where(Invoice.invoice_number.like(f"INV-{year}-%"))
        )
        count = (result.scalar() or 0) + 1
        return f"INV-{year}-{count:06d}"

    async def list_with_filters(
        self,
        hotel_id: object | None = None,
        status: InvoiceStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Invoice], int]:
        stmt = select(Invoice).options(selectinload(Invoice.hotel)).where(Invoice.deleted_at.is_(None))
        count_stmt = select(func.count()).select_from(Invoice).where(Invoice.deleted_at.is_(None))

        if hotel_id:
            stmt = stmt.where(Invoice.hotel_id == hotel_id)
            count_stmt = count_stmt.where(Invoice.hotel_id == hotel_id)
        if status:
            stmt = stmt.where(Invoice.status == status)
            count_stmt = count_stmt.where(Invoice.status == status)

        total = (await self.session.execute(count_stmt)).scalar() or 0
        offset = (page - 1) * page_size
        items = list((await self.session.execute(stmt.order_by(Invoice.created_at.desc()).offset(offset).limit(page_size))).scalars().all())
        return items, total

    async def mark_overdue(self) -> int:
        from sqlalchemy import update
        today = date.today()
        result = await self.session.execute(
            update(Invoice)
            .where(Invoice.status == InvoiceStatus.SENT, Invoice.due_date < today)
            .values(status=InvoiceStatus.OVERDUE)
        )
        return result.rowcount


class PaymentRepository(BaseRepository[Payment]):
    model = Payment

    async def list_with_filters(
        self,
        hotel_id: object | None = None,
        invoice_id: object | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Payment], int]:
        stmt = select(Payment).options(selectinload(Payment.hotel))
        count_stmt = select(func.count()).select_from(Payment)

        if hotel_id:
            stmt = stmt.where(Payment.hotel_id == hotel_id)
            count_stmt = count_stmt.where(Payment.hotel_id == hotel_id)
        if invoice_id:
            stmt = stmt.where(Payment.invoice_id == invoice_id)
            count_stmt = count_stmt.where(Payment.invoice_id == invoice_id)

        total = (await self.session.execute(count_stmt)).scalar() or 0
        offset = (page - 1) * page_size
        items = list((await self.session.execute(stmt.order_by(Payment.created_at.desc()).offset(offset).limit(page_size))).scalars().all())
        return items, total


class CommissionStatementRepository(BaseRepository[CommissionStatement]):
    model = CommissionStatement

    async def get_by_id(self, id: object) -> CommissionStatement | None:
        result = await self.session.execute(
            select(CommissionStatement)
            .options(
                selectinload(CommissionStatement.hotel),
                selectinload(CommissionStatement.adjustments),
            )
            .where(CommissionStatement.id == id)
        )
        return result.scalar_one_or_none()

    async def list_with_filters(
        self,
        hotel_id: object | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[CommissionStatement], int]:
        stmt = select(CommissionStatement).options(
            selectinload(CommissionStatement.hotel),
            selectinload(CommissionStatement.adjustments),
        )
        count_stmt = select(func.count()).select_from(CommissionStatement)

        if hotel_id:
            stmt = stmt.where(CommissionStatement.hotel_id == hotel_id)
            count_stmt = count_stmt.where(CommissionStatement.hotel_id == hotel_id)

        total = (await self.session.execute(count_stmt)).scalar() or 0
        offset = (page - 1) * page_size
        items = list((await self.session.execute(stmt.order_by(CommissionStatement.created_at.desc()).offset(offset).limit(page_size))).scalars().all())
        return items, total

    async def sum_adjustments(self, statement_id: object) -> Decimal:
        result = await self.session.execute(
            select(func.coalesce(func.sum(CommissionAdjustment.amount), 0))
            .where(CommissionAdjustment.statement_id == statement_id)
        )
        return Decimal(str(result.scalar() or 0))
