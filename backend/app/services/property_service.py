import re
import secrets
import string
import uuid
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.constants import AuditAction
from app.core.exceptions import NotFoundError, ConflictError
from app.core.security import hash_password
from app.models.hotel import Hotel, HotelStatus, PropertyType, PropertyPhoto
from app.models.subscription import PropertySubscription
from app.models.user import User, UserRole
from app.repositories.hotel import HotelRepository
from app.repositories.user import UserRepository
from app.services.audit_service import log_audit


def _slugify(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s-]+", "-", slug).strip("-")
    return slug or "hotel"


def _generate_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        # ensure at least one of each category
        if (
            any(c.islower() for c in pwd)
            and any(c.isupper() for c in pwd)
            and any(c.isdigit() for c in pwd)
        ):
            return pwd


def _make_username(email: str) -> str:
    base = email.split("@")[0].lower()
    return re.sub(r"[^a-z0-9_]", "_", base)


class PropertyService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.hotel_repo = HotelRepository(session)
        self.user_repo = UserRepository(session)

    async def list_hotels(
        self,
        status: HotelStatus | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Hotel], int]:
        stmt = (
            select(Hotel)
            .options(selectinload(Hotel.subscription).selectinload(PropertySubscription.plan))
            .where(Hotel.deleted_at.is_(None))
        )
        count_stmt = select(func.count()).select_from(Hotel).where(Hotel.deleted_at.is_(None))

        if status:
            stmt = stmt.where(Hotel.status == status)
            count_stmt = count_stmt.where(Hotel.status == status)
        if search:
            from sqlalchemy import or_
            like = f"%{search}%"
            stmt = stmt.where(or_(Hotel.name.ilike(like), Hotel.email.ilike(like)))
            count_stmt = count_stmt.where(or_(Hotel.name.ilike(like), Hotel.email.ilike(like)))

        total = (await self.session.execute(count_stmt)).scalar() or 0
        offset = (page - 1) * page_size
        items = list((await self.session.execute(
            stmt.order_by(Hotel.created_at.desc()).offset(offset).limit(page_size)
        )).scalars().all())
        return items, total

    async def get_hotel(self, hotel_id: uuid.UUID) -> Hotel:
        result = await self.session.execute(
            select(Hotel)
            .options(
                selectinload(Hotel.subscription).selectinload(PropertySubscription.plan),
                selectinload(Hotel.users),
                selectinload(Hotel.photos),
            )
            .where(Hotel.id == hotel_id, Hotel.deleted_at.is_(None))
        )
        hotel = result.scalar_one_or_none()
        if not hotel:
            raise NotFoundError("Property not found.")
        return hotel

    async def create_hotel(
        self,
        admin_id: uuid.UUID,
        # Basic
        hotel_name: str,
        contact_email: str,
        property_type: PropertyType = PropertyType.HOTEL,
        business_name: str | None = None,
        description: str | None = None,
        # Contact
        contact_person: str | None = None,
        mobile_number: str | None = None,
        telephone_number: str | None = None,
        # Location
        country: str = "Philippines",
        province: str | None = None,
        city: str | None = None,
        address_line_1: str | None = None,
        address_line_2: str | None = None,
        postal_code: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        # Owner account
        owner_first_name: str = "",
        owner_last_name: str = "",
        owner_email: str = "",
        owner_mobile: str | None = None,
        # Settings
        default_currency: str = "PHP",
        timezone: str = "Asia/Manila",
        language: str = "en",
        # Media
        banner_image_url: str | None = None,
        logo_url: str | None = None,
    ) -> tuple[Hotel, str, str]:
        """Returns (hotel, username, temporary_password)."""
        if await self.hotel_repo.get_by_email(contact_email):
            raise ConflictError("A property with this contact email already exists.")
        if await self.user_repo.get_by_email(owner_email):
            raise ConflictError("An account with this owner email already exists.")

        base_slug = _slugify(hotel_name)
        slug, counter = base_slug, 1
        while await self.hotel_repo.get_by_slug(slug):
            slug = f"{base_slug}-{counter}"
            counter += 1

        # Username uniqueness
        base_username = _make_username(owner_email)
        username, uc = base_username, 1
        while (await self.session.execute(
            select(User).where(User.username == username)
        )).scalar_one_or_none():
            username = f"{base_username}{uc}"
            uc += 1

        temp_password = _generate_password()
        owner_full_name = f"{owner_first_name} {owner_last_name}".strip()

        hotel = await self.hotel_repo.create({
            "name": hotel_name,
            "business_name": business_name,
            "slug": slug,
            "property_type": property_type,
            "description": description,
            "email": contact_email,
            "contact_person": contact_person,
            "mobile_number": mobile_number,
            "telephone_number": telephone_number,
            "country": country,
            "province": province,
            "city": city,
            "address_line_1": address_line_1,
            "address_line_2": address_line_2,
            "postal_code": postal_code,
            "latitude": Decimal(str(latitude)) if latitude is not None else None,
            "longitude": Decimal(str(longitude)) if longitude is not None else None,
            "default_currency": default_currency,
            "timezone": timezone,
            "language": language,
            "banner_image_url": banner_image_url,
            "logo_url": logo_url,
            "status": HotelStatus.ACTIVE,
        })

        await self.user_repo.create({
            "hotel_id": hotel.id,
            "email": owner_email,
            "first_name": owner_first_name,
            "last_name": owner_last_name,
            "full_name": owner_full_name,
            "mobile_number": owner_mobile,
            "username": username,
            "hashed_password": hash_password(temp_password),
            "role": UserRole.OWNER,
        })

        await log_audit(
            self.session,
            action=AuditAction.PROPERTY_CREATED,
            entity_type="hotel",
            entity_id=str(hotel.id),
            hotel_id=hotel.id,
            admin_id=admin_id,
            after_state={"name": hotel_name, "email": contact_email, "owner": owner_email},
        )
        hotel_id = hotel.id
        await self.session.commit()
        return await self.get_hotel(hotel_id), username, temp_password

    async def update_hotel(self, admin_id: uuid.UUID, hotel_id: uuid.UUID, data: dict) -> Hotel:
        hotel = await self._get_or_404(hotel_id)
        before = {"name": hotel.name, "email": hotel.email}
        await self.hotel_repo.update(hotel, data)
        await log_audit(
            self.session,
            action=AuditAction.PROPERTY_UPDATED,
            entity_type="hotel",
            entity_id=str(hotel_id),
            hotel_id=hotel_id,
            admin_id=admin_id,
            before_state=before,
            after_state=data,
        )
        await self.session.commit()
        return await self.get_hotel(hotel_id)

    async def suspend_hotel(self, admin_id: uuid.UUID, hotel_id: uuid.UUID, reason: str) -> Hotel:
        hotel = await self._get_or_404(hotel_id)
        before_status = hotel.status.value
        await self.hotel_repo.update(hotel, {"status": HotelStatus.SUSPENDED, "is_active": False})
        await log_audit(
            self.session,
            action=AuditAction.PROPERTY_SUSPENDED,
            entity_type="hotel",
            entity_id=str(hotel_id),
            hotel_id=hotel_id,
            admin_id=admin_id,
            before_state={"status": before_status},
            after_state={"status": HotelStatus.SUSPENDED.value},
            remarks=reason,
        )
        await self.session.commit()
        return await self.get_hotel(hotel_id)

    async def reactivate_hotel(self, admin_id: uuid.UUID, hotel_id: uuid.UUID, reason: str) -> Hotel:
        hotel = await self._get_or_404(hotel_id)
        await self.hotel_repo.update(hotel, {"status": HotelStatus.ACTIVE, "is_active": True})
        await log_audit(
            self.session,
            action=AuditAction.PROPERTY_REACTIVATED,
            entity_type="hotel",
            entity_id=str(hotel_id),
            hotel_id=hotel_id,
            admin_id=admin_id,
            remarks=reason,
        )
        await self.session.commit()
        return await self.get_hotel(hotel_id)

    async def deactivate_hotel(self, admin_id: uuid.UUID, hotel_id: uuid.UUID, reason: str) -> None:
        hotel = await self._get_or_404(hotel_id)
        await self.hotel_repo.update(hotel, {"status": HotelStatus.DEACTIVATED, "is_active": False})
        await self.hotel_repo.soft_delete(hotel)
        await log_audit(
            self.session,
            action=AuditAction.PROPERTY_DEACTIVATED,
            entity_type="hotel",
            entity_id=str(hotel_id),
            hotel_id=hotel_id,
            admin_id=admin_id,
            remarks=reason,
        )
        await self.session.commit()

    async def _get_or_404(self, hotel_id: uuid.UUID) -> Hotel:
        hotel = await self.hotel_repo.get_by_id(hotel_id)
        if not hotel:
            raise NotFoundError("Property not found.")
        return hotel
