from datetime import date
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.hotel import Hotel, HotelStatus
from app.models.billing import Invoice, InvoiceStatus, InvoiceType
from app.models.subscription import PropertySubscription, SubscriptionStatus


class PlatformReportsService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def overview(self) -> dict:
        total_hotels = (await self.session.execute(
            select(func.count(Hotel.id)).where(Hotel.deleted_at.is_(None))
        )).scalar() or 0

        active_hotels = (await self.session.execute(
            select(func.count(Hotel.id)).where(Hotel.status == HotelStatus.ACTIVE, Hotel.deleted_at.is_(None))
        )).scalar() or 0

        suspended_hotels = (await self.session.execute(
            select(func.count(Hotel.id)).where(Hotel.status == HotelStatus.SUSPENDED, Hotel.deleted_at.is_(None))
        )).scalar() or 0

        active_subs = (await self.session.execute(
            select(func.count(PropertySubscription.id))
            .where(PropertySubscription.status == SubscriptionStatus.ACTIVE)
        )).scalar() or 0

        overdue_count = (await self.session.execute(
            select(func.count(Invoice.id)).where(Invoice.status == InvoiceStatus.OVERDUE, Invoice.deleted_at.is_(None))
        )).scalar() or 0

        overdue_amount = (await self.session.execute(
            select(func.coalesce(func.sum(Invoice.total_amount), 0))
            .where(Invoice.status == InvoiceStatus.OVERDUE, Invoice.deleted_at.is_(None))
        )).scalar() or Decimal("0.00")

        return {
            "total_properties": total_hotels,
            "active_properties": active_hotels,
            "suspended_properties": suspended_hotels,
            "active_subscriptions": active_subs,
            "overdue_invoices_count": overdue_count,
            "overdue_invoices_amount": str(overdue_amount),
        }

    async def revenue(self, period_start: date, period_end: date) -> dict:
        paid_subscription = (await self.session.execute(
            select(func.coalesce(func.sum(Invoice.subscription_amount), 0))
            .where(
                Invoice.status == InvoiceStatus.PAID,
                Invoice.type == InvoiceType.SUBSCRIPTION,
                Invoice.paid_at >= period_start,
                Invoice.paid_at <= period_end,
                Invoice.deleted_at.is_(None),
            )
        )).scalar() or Decimal("0.00")

        paid_commission = (await self.session.execute(
            select(func.coalesce(func.sum(Invoice.commission_amount), 0))
            .where(
                Invoice.status == InvoiceStatus.PAID,
                Invoice.type == InvoiceType.COMMISSION,
                Invoice.paid_at >= period_start,
                Invoice.paid_at <= period_end,
                Invoice.deleted_at.is_(None),
            )
        )).scalar() or Decimal("0.00")

        return {
            "period_start": str(period_start),
            "period_end": str(period_end),
            "subscription_revenue": str(paid_subscription),
            "commission_revenue": str(paid_commission),
            "total_revenue": str(Decimal(str(paid_subscription)) + Decimal(str(paid_commission))),
        }
