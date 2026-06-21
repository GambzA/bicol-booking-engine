from sqlalchemy import select
from app.models.hotel import Hotel
from app.repositories.base import BaseRepository


class HotelRepository(BaseRepository[Hotel]):
    model = Hotel

    async def get_by_slug(self, slug: str) -> Hotel | None:
        result = await self.session.execute(
            select(Hotel).where(Hotel.slug == slug, Hotel.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Hotel | None:
        result = await self.session.execute(
            select(Hotel).where(Hotel.email == email, Hotel.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()
