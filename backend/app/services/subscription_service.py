import uuid
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.constants import AuditAction
from app.core.exceptions import NotFoundError, ConflictError
from app.models.subscription import SubscriptionPlan, PropertySubscription, SubscriptionStatus, BillingCycle
from app.repositories.subscription import SubscriptionPlanRepository, PropertySubscriptionRepository
from app.repositories.hotel import HotelRepository
from app.services.audit_service import log_audit


class SubscriptionPlanService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = SubscriptionPlanRepository(session)

    async def list_plans(self, include_inactive: bool = False) -> list[SubscriptionPlan]:
        return await self.repo.list_all(include_inactive=include_inactive)

    async def get_plan(self, plan_id: uuid.UUID) -> SubscriptionPlan:
        plan = await self.repo.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("Subscription plan not found.")
        return plan

    async def create_plan(self, admin_id: uuid.UUID, data: dict) -> SubscriptionPlan:
        plan = await self.repo.create(data)
        await log_audit(
            self.session,
            action=AuditAction.PLAN_CREATED,
            entity_type="subscription_plan",
            entity_id=str(plan.id),
            admin_id=admin_id,
            after_state={"name": data.get("name")},
        )
        await self.session.commit()
        return plan

    async def update_plan(self, admin_id: uuid.UUID, plan_id: uuid.UUID, data: dict) -> SubscriptionPlan:
        plan = await self.get_plan(plan_id)
        await self.repo.update(plan, data)
        await log_audit(
            self.session,
            action=AuditAction.PLAN_UPDATED,
            entity_type="subscription_plan",
            entity_id=str(plan_id),
            admin_id=admin_id,
            after_state=data,
        )
        await self.session.commit()
        return plan

    async def disable_plan(self, admin_id: uuid.UUID, plan_id: uuid.UUID) -> None:
        plan = await self.get_plan(plan_id)
        await self.repo.soft_delete(plan)
        await log_audit(
            self.session,
            action=AuditAction.PLAN_DISABLED,
            entity_type="subscription_plan",
            entity_id=str(plan_id),
            admin_id=admin_id,
        )
        await self.session.commit()


class PropertySubscriptionService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.sub_repo = PropertySubscriptionRepository(session)
        self.plan_repo = SubscriptionPlanRepository(session)
        self.hotel_repo = HotelRepository(session)

    async def assign_plan(
        self,
        admin_id: uuid.UUID,
        hotel_id: uuid.UUID,
        plan_id: uuid.UUID,
        billing_cycle: BillingCycle,
        start_date: date,
    ) -> PropertySubscription:
        if not await self.hotel_repo.get_by_id(hotel_id):
            raise NotFoundError("Property not found.")
        plan = await self.plan_repo.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("Subscription plan not found.")
        if await self.sub_repo.get_by_hotel_id(hotel_id):
            raise ConflictError("Property already has an active subscription. Update it instead.")

        trial_end = start_date + timedelta(days=plan.trial_period_days) if plan.trial_period_days > 0 else None
        next_billing = (start_date + timedelta(days=plan.trial_period_days)) if trial_end else start_date
        status = SubscriptionStatus.TRIAL if trial_end else SubscriptionStatus.ACTIVE

        sub = await self.sub_repo.create({
            "hotel_id": hotel_id,
            "plan_id": plan_id,
            "status": status,
            "billing_cycle": billing_cycle,
            "start_date": start_date,
            "trial_end_date": trial_end,
            "next_billing_date": next_billing,
        })
        await log_audit(
            self.session,
            action=AuditAction.SUBSCRIPTION_CREATED,
            entity_type="property_subscription",
            entity_id=str(sub.id),
            hotel_id=hotel_id,
            admin_id=admin_id,
            after_state={"plan": plan.name, "billing_cycle": billing_cycle.value, "status": status.value},
        )
        await self.session.commit()
        return sub

    async def update_subscription(self, admin_id: uuid.UUID, hotel_id: uuid.UUID, data: dict) -> PropertySubscription:
        sub = await self.sub_repo.get_by_hotel_id(hotel_id)
        if not sub:
            raise NotFoundError("No subscription found for this property.")
        before = {"status": sub.status.value, "plan_id": str(sub.plan_id)}
        await self.sub_repo.update(sub, data)
        await log_audit(
            self.session,
            action=AuditAction.SUBSCRIPTION_UPDATED,
            entity_type="property_subscription",
            entity_id=str(sub.id),
            hotel_id=hotel_id,
            admin_id=admin_id,
            before_state=before,
            after_state=data,
        )
        await self.session.commit()
        return sub

    async def cancel_subscription(self, admin_id: uuid.UUID, hotel_id: uuid.UUID) -> PropertySubscription:
        sub = await self.sub_repo.get_by_hotel_id(hotel_id)
        if not sub:
            raise NotFoundError("No subscription found for this property.")
        await self.sub_repo.update(sub, {"status": SubscriptionStatus.CANCELLED})
        await log_audit(
            self.session,
            action=AuditAction.SUBSCRIPTION_CANCELLED,
            entity_type="property_subscription",
            entity_id=str(sub.id),
            hotel_id=hotel_id,
            admin_id=admin_id,
        )
        await self.session.commit()
        return sub
