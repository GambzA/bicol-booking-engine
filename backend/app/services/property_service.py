import re
import uuid
from datetime import timezone, datetime
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.constants import AuditAction
from app.core.exceptions import NotFoundError, ConflictError
from app.core.security import hash_password
from app.models.hotel import Hotel, HotelStatus
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
            like = f"%{search}%"
            from sqlalchemy import or_
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
        hotel_name: str,
        email: str,
        owner_full_name: str,
        owner_password: str,
        phone: str | None = None,
        address: str | None = None,
        city: str | None = None,
    ) -> Hotel:
        if await self.hotel_repo.get_by_email(email):
            raise ConflictError("A property with this email already exists.")
        if await self.user_repo.get_by_email(email):
            raise ConflictError("An account with this email already exists.")

        base_slug = _slugify(hotel_name)
        slug, counter = base_slug, 1
        while await self.hotel_repo.get_by_slug(slug):
            slug = f"{base_slug}-{counter}"
            counter += 1

        hotel = await self.hotel_repo.create({
            "name": hotel_name,
            "slug": slug,
            "email": email,
            "phone": phone,
            "address": address,
            "city": city,
            "status": HotelStatus.ACTIVE,
        })

        await self.user_repo.create({
            "hotel_id": hotel.id,
            "email": email,
            "full_name": owner_full_name,
            "hashed_password": hash_password(owner_password),
            "role": UserRole.OWNER,
        })

        await log_audit(
            self.session,
            action=AuditAction.PROPERTY_CREATED,
            entity_type="hotel",
            entity_id=str(hotel.id),
            hotel_id=hotel.id,
            admin_id=admin_id,
            after_state={"name": hotel_name, "email": email},
        )
        await self.session.commit()
        return hotel

    async def update_hotel(self, admin_id: uuid.UUID, hotel_id: uuid.UUID, data: dict) -> Hotel:
        hotel = await self._get_or_404(hotel_id)
        before = {"name": hotel.name, "email": hotel.email, "phone": hotel.phone, "address": hotel.address, "city": hotel.city}
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
        return hotel

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
        return hotel

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
        return hotel

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
