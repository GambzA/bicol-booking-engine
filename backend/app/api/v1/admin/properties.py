import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.hotel import HotelStatus
from app.models.platform_admin import PlatformAdmin
from app.services.property_service import PropertyService

router = APIRouter(prefix="/properties", tags=["admin-properties"])


class CreatePropertyRequest(BaseModel):
    hotel_name: str
    email: EmailStr
    owner_full_name: str
    owner_password: str
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None


class UpdatePropertyRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None


class ActionRequest(BaseModel):
    reason: str


@router.get("")
async def list_properties(
    status: Optional[HotelStatus] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    svc = PropertyService(db)
    items, total = await svc.list_hotels(status=status, search=search, page=page, page_size=page_size)
    from app.repositories.base import BaseRepository
    from app.models.hotel import Hotel
    repo = type('R', (), {'paginate': BaseRepository.paginate})()
    pagination = {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }
    return {**pagination, "items": [_hotel_summary(h) for h in items]}


@router.post("", status_code=201)
async def create_property(
    body: CreatePropertyRequest,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    hotel = await PropertyService(db).create_hotel(
        admin_id=admin.id,
        hotel_name=body.hotel_name,
        email=body.email,
        owner_full_name=body.owner_full_name,
        owner_password=body.owner_password,
        phone=body.phone,
        address=body.address,
        city=body.city,
    )
    return _hotel_summary(hotel)


@router.get("/{hotel_id}")
async def get_property(
    hotel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    hotel = await PropertyService(db).get_hotel(hotel_id)
    return _hotel_detail(hotel)


@router.patch("/{hotel_id}")
async def update_property(
    hotel_id: uuid.UUID,
    body: UpdatePropertyRequest,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    data = body.model_dump(exclude_none=True)
    hotel = await PropertyService(db).update_hotel(admin.id, hotel_id, data)
    return _hotel_summary(hotel)


@router.post("/{hotel_id}/suspend")
async def suspend_property(
    hotel_id: uuid.UUID,
    body: ActionRequest,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    hotel = await PropertyService(db).suspend_hotel(admin.id, hotel_id, body.reason)
    return _hotel_summary(hotel)


@router.post("/{hotel_id}/reactivate")
async def reactivate_property(
    hotel_id: uuid.UUID,
    body: ActionRequest,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    hotel = await PropertyService(db).reactivate_hotel(admin.id, hotel_id, body.reason)
    return _hotel_summary(hotel)


@router.post("/{hotel_id}/deactivate", status_code=204)
async def deactivate_property(
    hotel_id: uuid.UUID,
    body: ActionRequest,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    await PropertyService(db).deactivate_hotel(admin.id, hotel_id, body.reason)


def _hotel_summary(h) -> dict:
    sub = h.subscription if hasattr(h, "subscription") else None
    return {
        "id": str(h.id),
        "name": h.name,
        "slug": h.slug,
        "email": h.email,
        "phone": h.phone,
        "address": h.address,
        "city": h.city,
        "country": h.country,
        "status": h.status.value,
        "is_active": h.is_active,
        "created_at": h.created_at.isoformat(),
        "subscription": _sub_summary(sub) if sub else None,
    }


def _hotel_detail(h) -> dict:
    base = _hotel_summary(h)
    base["users"] = [
        {"id": str(u.id), "email": u.email, "full_name": u.full_name, "role": u.role.value}
        for u in (h.users or [])
    ]
    return base


def _sub_summary(sub) -> dict | None:
    if not sub:
        return None
    return {
        "id": str(sub.id),
        "status": sub.status.value,
        "billing_cycle": sub.billing_cycle.value,
        "start_date": str(sub.start_date),
        "next_billing_date": str(sub.next_billing_date),
        "trial_end_date": str(sub.trial_end_date) if sub.trial_end_date else None,
        "plan": {"id": str(sub.plan.id), "name": sub.plan.name} if sub.plan else None,
    }
