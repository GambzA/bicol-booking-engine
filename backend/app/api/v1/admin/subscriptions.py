import uuid
from datetime import date
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.platform_admin import PlatformAdmin
from app.models.subscription import BillingCycle, SubscriptionStatus
from app.services.subscription_service import PropertySubscriptionService

router = APIRouter(prefix="/properties", tags=["admin-subscriptions"])


class AssignSubscriptionRequest(BaseModel):
    plan_id: uuid.UUID
    billing_cycle: BillingCycle
    start_date: date


class UpdateSubscriptionRequest(BaseModel):
    plan_id: uuid.UUID | None = None
    status: SubscriptionStatus | None = None
    billing_cycle: BillingCycle | None = None
    next_billing_date: date | None = None
    grace_period_days: int | None = None


@router.post("/{hotel_id}/subscription", status_code=201)
async def assign_subscription(
    hotel_id: uuid.UUID,
    body: AssignSubscriptionRequest,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    sub = await PropertySubscriptionService(db).assign_plan(
        admin.id, hotel_id, body.plan_id, body.billing_cycle, body.start_date
    )
    return _sub_out(sub)


@router.patch("/{hotel_id}/subscription")
async def update_subscription(
    hotel_id: uuid.UUID,
    body: UpdateSubscriptionRequest,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    sub = await PropertySubscriptionService(db).update_subscription(
        admin.id, hotel_id, body.model_dump(exclude_none=True)
    )
    return _sub_out(sub)


@router.delete("/{hotel_id}/subscription", status_code=204)
async def cancel_subscription(
    hotel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    await PropertySubscriptionService(db).cancel_subscription(admin.id, hotel_id)


def _sub_out(sub) -> dict:
    return {
        "id": str(sub.id),
        "hotel_id": str(sub.hotel_id),
        "plan_id": str(sub.plan_id),
        "status": sub.status.value,
        "billing_cycle": sub.billing_cycle.value,
        "start_date": str(sub.start_date),
        "trial_end_date": str(sub.trial_end_date) if sub.trial_end_date else None,
        "next_billing_date": str(sub.next_billing_date),
        "grace_period_days": sub.grace_period_days,
        "auto_suspend": sub.auto_suspend,
    }
