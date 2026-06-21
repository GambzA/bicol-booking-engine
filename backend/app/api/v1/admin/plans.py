import uuid
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.platform_admin import PlatformAdmin
from app.services.subscription_service import SubscriptionPlanService

router = APIRouter(prefix="/plans", tags=["admin-plans"])


class PlanRequest(BaseModel):
    name: str
    monthly_fee: Decimal
    annual_fee: Decimal
    commission_percentage: Decimal
    trial_period_days: int = 0
    max_users: Optional[int] = None
    max_properties: Optional[int] = None
    features: Optional[list[str]] = None


class PlanUpdateRequest(BaseModel):
    name: Optional[str] = None
    monthly_fee: Optional[Decimal] = None
    annual_fee: Optional[Decimal] = None
    commission_percentage: Optional[Decimal] = None
    trial_period_days: Optional[int] = None
    max_users: Optional[int] = None
    max_properties: Optional[int] = None
    features: Optional[list[str]] = None
    is_active: Optional[bool] = None


@router.get("")
async def list_plans(
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    plans = await SubscriptionPlanService(db).list_plans(include_inactive=include_inactive)
    return {"items": [_plan_out(p) for p in plans]}


@router.post("", status_code=201)
async def create_plan(
    body: PlanRequest,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    plan = await SubscriptionPlanService(db).create_plan(admin.id, body.model_dump())
    return _plan_out(plan)


@router.get("/{plan_id}")
async def get_plan(
    plan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    plan = await SubscriptionPlanService(db).get_plan(plan_id)
    return _plan_out(plan)


@router.patch("/{plan_id}")
async def update_plan(
    plan_id: uuid.UUID,
    body: PlanUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    plan = await SubscriptionPlanService(db).update_plan(admin.id, plan_id, body.model_dump(exclude_none=True))
    return _plan_out(plan)


@router.delete("/{plan_id}", status_code=204)
async def disable_plan(
    plan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    await SubscriptionPlanService(db).disable_plan(admin.id, plan_id)


def _plan_out(p) -> dict:
    return {
        "id": str(p.id),
        "name": p.name,
        "monthly_fee": str(p.monthly_fee),
        "annual_fee": str(p.annual_fee),
        "commission_percentage": str(p.commission_percentage),
        "trial_period_days": p.trial_period_days,
        "max_users": p.max_users,
        "max_properties": p.max_properties,
        "features": p.features or [],
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat(),
    }
