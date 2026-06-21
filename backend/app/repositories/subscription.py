from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.subscription import SubscriptionPlan, PropertySubscription, SubscriptionStatus
from app.repositories.base import BaseRepository


class SubscriptionPlanRepository(BaseRepository[SubscriptionPlan]):
    model = SubscriptionPlan

    async def list_all(self, include_inactive: bool = False) -> list[SubscriptionPlan]:
        stmt = select(SubscriptionPlan).where(SubscriptionPlan.deleted_at.is_(None))
        if not include_inactive:
            stmt = stmt.where(SubscriptionPlan.is_active.is_(True))
        result = await self.session.execute(stmt.order_by(SubscriptionPlan.created_at.desc()))
        return list(result.scalars().all())


class PropertySubscriptionRepository(BaseRepository[PropertySubscription]):
    model = PropertySubscription

    async def get_by_hotel_id(self, hotel_id: object) -> PropertySubscription | None:
        result = await self.session.execute(
            select(PropertySubscription)
            .options(selectinload(PropertySubscription.plan))
            .where(PropertySubscription.hotel_id == hotel_id)
        )
        return result.scalar_one_or_none()

    async def list_by_status(self, status: SubscriptionStatus) -> list[PropertySubscription]:
        result = await self.session.execute(
            select(PropertySubscription)
            .options(selectinload(PropertySubscription.plan))
            .where(PropertySubscription.status == status)
        )
        return list(result.scalars().all())
