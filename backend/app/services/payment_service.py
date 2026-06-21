import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.constants import AuditAction
from app.core.exceptions import NotFoundError
from app.models.billing import Payment, InvoiceStatus
from app.repositories.billing import PaymentRepository, InvoiceRepository
from app.repositories.hotel import HotelRepository
from app.services.audit_service import log_audit


class PaymentService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = PaymentRepository(session)
        self.invoice_repo = InvoiceRepository(session)
        self.hotel_repo = HotelRepository(session)

    async def list_payments(
        self,
        hotel_id: uuid.UUID | None = None,
        invoice_id: uuid.UUID | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Payment], int, dict]:
        items, total = await self.repo.list_with_filters(hotel_id=hotel_id, invoice_id=invoice_id, page=page, page_size=page_size)
        return items, total, self.repo.paginate(total, page, page_size)

    async def record_payment(self, admin_id: uuid.UUID, data: dict) -> Payment:
        hotel_id = data.get("hotel_id")
        if not await self.hotel_repo.get_by_id(hotel_id):
            raise NotFoundError("Property not found.")

        invoice_id = data.get("invoice_id")
        if invoice_id:
            invoice = await self.invoice_repo.get_by_id(invoice_id)
            if not invoice:
                raise NotFoundError("Invoice not found.")

        payment = await self.repo.create({**data, "recorded_by": admin_id})

        if invoice_id and invoice:
            await self.invoice_repo.update(invoice, {"status": InvoiceStatus.PAID})
            from datetime import datetime, timezone
            await self.invoice_repo.update(invoice, {"paid_at": datetime.now(timezone.utc)})

        await log_audit(
            self.session,
            action=AuditAction.PAYMENT_RECORDED,
            entity_type="payment",
            entity_id=str(payment.id),
            hotel_id=hotel_id,
            admin_id=admin_id,
            after_state={"amount": str(data.get("amount")), "invoice_id": str(invoice_id) if invoice_id else None},
        )
        await self.session.commit()
        return payment
