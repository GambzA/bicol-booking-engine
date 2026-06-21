import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.constants import AuditAction
from app.core.exceptions import NotFoundError, ConflictError
from app.models.billing import Invoice, InvoiceType, InvoiceStatus
from app.repositories.billing import InvoiceRepository
from app.services.audit_service import log_audit


class InvoiceService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = InvoiceRepository(session)

    async def list_invoices(
        self,
        hotel_id: uuid.UUID | None = None,
        status: InvoiceStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Invoice], int, dict]:
        items, total = await self.repo.list_with_filters(hotel_id=hotel_id, status=status, page=page, page_size=page_size)
        pagination = self.repo.paginate(total, page, page_size)
        return items, total, pagination

    async def get_invoice(self, invoice_id: uuid.UUID) -> Invoice:
        invoice = await self.repo.get_by_id(invoice_id)
        if not invoice:
            raise NotFoundError("Invoice not found.")
        return invoice

    async def create_invoice(self, admin_id: uuid.UUID, data: dict) -> Invoice:
        invoice_number = await self.repo.generate_number()
        sub = data.get("subscription_amount", Decimal("0.00"))
        comm = data.get("commission_amount", Decimal("0.00"))
        tax = data.get("tax_amount", Decimal("0.00"))
        total = Decimal(str(sub)) + Decimal(str(comm)) + Decimal(str(tax))

        invoice = await self.repo.create({
            **data,
            "invoice_number": invoice_number,
            "total_amount": total,
            "created_by": admin_id,
        })
        await log_audit(
            self.session,
            action=AuditAction.INVOICE_CREATED,
            entity_type="invoice",
            entity_id=str(invoice.id),
            hotel_id=data.get("hotel_id"),
            admin_id=admin_id,
            after_state={"invoice_number": invoice_number, "total": str(total)},
        )
        await self.session.commit()
        return invoice

    async def send_invoice(self, admin_id: uuid.UUID, invoice_id: uuid.UUID) -> Invoice:
        invoice = await self._get_or_404(invoice_id)
        if invoice.status not in (InvoiceStatus.DRAFT, InvoiceStatus.OVERDUE):
            raise ConflictError(f"Cannot send an invoice with status '{invoice.status.value}'.")
        await self.repo.update(invoice, {"status": InvoiceStatus.SENT, "sent_at": datetime.now(timezone.utc)})
        await log_audit(
            self.session,
            action=AuditAction.INVOICE_SENT,
            entity_type="invoice",
            entity_id=str(invoice_id),
            hotel_id=invoice.hotel_id,
            admin_id=admin_id,
        )
        await self.session.commit()
        return invoice

    async def void_invoice(self, admin_id: uuid.UUID, invoice_id: uuid.UUID, reason: str) -> Invoice:
        invoice = await self._get_or_404(invoice_id)
        if invoice.status == InvoiceStatus.PAID:
            raise ConflictError("Cannot void a paid invoice.")
        await self.repo.update(invoice, {"status": InvoiceStatus.VOID, "voided_at": datetime.now(timezone.utc)})
        await log_audit(
            self.session,
            action=AuditAction.INVOICE_VOIDED,
            entity_type="invoice",
            entity_id=str(invoice_id),
            hotel_id=invoice.hotel_id,
            admin_id=admin_id,
            remarks=reason,
        )
        await self.session.commit()
        return invoice

    async def mark_paid(self, admin_id: uuid.UUID, invoice_id: uuid.UUID) -> Invoice:
        invoice = await self._get_or_404(invoice_id)
        if invoice.status == InvoiceStatus.PAID:
            raise ConflictError("Invoice is already marked as paid.")
        await self.repo.update(invoice, {"status": InvoiceStatus.PAID, "paid_at": datetime.now(timezone.utc)})
        await log_audit(
            self.session,
            action=AuditAction.INVOICE_PAID,
            entity_type="invoice",
            entity_id=str(invoice_id),
            hotel_id=invoice.hotel_id,
            admin_id=admin_id,
        )
        await self.session.commit()
        return invoice

    async def _get_or_404(self, invoice_id: uuid.UUID) -> Invoice:
        invoice = await self.repo.get_by_id(invoice_id)
        if not invoice:
            raise NotFoundError("Invoice not found.")
        return invoice
