import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.hotel import HotelStatus, PropertyType
from app.models.platform_admin import PlatformAdmin
from app.services.property_service import PropertyService

router = APIRouter(prefix="/properties", tags=["admin-properties"])


class CreatePropertyRequest(BaseModel):
    # Basic
    hotel_name: str
    property_type: PropertyType = PropertyType.HOTEL
    contact_email: EmailStr
    business_name: Optional[str] = None
    description: Optional[str] = None
    # Contact
    contact_person: Optional[str] = None
    mobile_number: Optional[str] = None
    telephone_number: Optional[str] = None
    # Location
    country: str = "Philippines"
    province: Optional[str] = None
    city: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Owner account
    owner_first_name: str
    owner_last_name: str
    owner_email: EmailStr
    owner_mobile: Optional[str] = None
    # Settings
    default_currency: str = "PHP"
    timezone: str = "Asia/Manila"
    language: str = "en"
    # Media
    banner_image_url: Optional[str] = None
    logo_url: Optional[str] = None


class UpdatePropertyRequest(BaseModel):
    name: Optional[str] = None
    business_name: Optional[str] = None
    property_type: Optional[PropertyType] = None
    description: Optional[str] = None
    contact_person: Optional[str] = None
    mobile_number: Optional[str] = None
    telephone_number: Optional[str] = None
    country: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    default_currency: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    banner_image_url: Optional[str] = None
    logo_url: Optional[str] = None


class ActionRequest(BaseModel):
    reason: str


@router.get("")
async def list_properties(
    status: Optional[HotelStatus] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    svc = PropertyService(db)
    items, total = await svc.list_hotels(status=status, search=search, page=page, page_size=page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "items": [_hotel_summary(h) for h in items],
    }


@router.post("", status_code=201)
async def create_property(
    body: CreatePropertyRequest,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    hotel, username, temp_password = await PropertyService(db).create_hotel(
        admin_id=admin.id,
        hotel_name=body.hotel_name,
        contact_email=body.contact_email,
        property_type=body.property_type,
        business_name=body.business_name,
        description=body.description,
        contact_person=body.contact_person,
        mobile_number=body.mobile_number,
        telephone_number=body.telephone_number,
        country=body.country,
        province=body.province,
        city=body.city,
        address_line_1=body.address_line_1,
        address_line_2=body.address_line_2,
        postal_code=body.postal_code,
        latitude=body.latitude,
        longitude=body.longitude,
        owner_first_name=body.owner_first_name,
        owner_last_name=body.owner_last_name,
        owner_email=body.owner_email,
        owner_mobile=body.owner_mobile,
        default_currency=body.default_currency,
        timezone=body.timezone,
        language=body.language,
        banner_image_url=body.banner_image_url,
        logo_url=body.logo_url,
    )
    return {
        **_hotel_detail(hotel),
        "credentials": {"username": username, "email": body.owner_email, "temporary_password": temp_password},
    }


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
        "business_name": h.business_name,
        "slug": h.slug,
        "property_type": h.property_type.value if h.property_type else "hotel",
        "email": h.email,
        "contact_person": h.contact_person,
        "mobile_number": h.mobile_number,
        "city": h.city,
        "province": h.province,
        "country": h.country,
        "logo_url": h.logo_url,
        "banner_image_url": h.banner_image_url,
        "status": h.status.value,
        "is_active": h.is_active,
        "created_at": h.created_at.isoformat(),
        "subscription": _sub_summary(sub) if sub else None,
    }


def _hotel_detail(h) -> dict:
    base = _hotel_summary(h)
    base.update({
        "description": h.description,
        "telephone_number": h.telephone_number,
        "address_line_1": h.address_line_1,
        "address_line_2": h.address_line_2,
        "postal_code": h.postal_code,
        "latitude": float(h.latitude) if h.latitude is not None else None,
        "longitude": float(h.longitude) if h.longitude is not None else None,
        "default_currency": h.default_currency,
        "timezone": h.timezone,
        "language": h.language,
        "users": [
            {
                "id": str(u.id),
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "full_name": u.full_name,
                "mobile_number": u.mobile_number,
                "username": u.username,
                "role": u.role.value,
            }
            for u in (h.users or [])
        ],
        "photos": [
            {"id": str(p.id), "url": p.url, "caption": p.caption, "sort_order": p.sort_order}
            for p in (h.photos or [])
        ],
    })
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
        "plan": {
            "id": str(sub.plan.id),
            "name": sub.plan.name,
            "monthly_fee": str(sub.plan.monthly_fee),
            "annual_fee": str(sub.plan.annual_fee),
            "commission_percentage": str(sub.plan.commission_percentage),
            "trial_period_days": sub.plan.trial_period_days,
        } if sub.plan else None,
    }
