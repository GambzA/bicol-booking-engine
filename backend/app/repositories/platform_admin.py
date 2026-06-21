from datetime import datetime, timezone
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.platform_admin import PlatformAdmin, AdminRefreshToken
from app.repositories.base import BaseRepository


class PlatformAdminRepository(BaseRepository[PlatformAdmin]):
    model = PlatformAdmin

    async def get_by_email(self, email: str) -> PlatformAdmin | None:
        result = await self.session.execute(
            select(PlatformAdmin).where(PlatformAdmin.email == email)
        )
        return result.scalar_one_or_none()

    async def count(self) -> int:
        from sqlalchemy import func
        result = await self.session.execute(select(func.count(PlatformAdmin.id)))
        return result.scalar() or 0


class AdminRefreshTokenRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, data: dict) -> AdminRefreshToken:
        token = AdminRefreshToken(**data)
        self.session.add(token)
        await self.session.flush()
        return token

    async def get_by_token(self, token: str) -> AdminRefreshToken | None:
        result = await self.session.execute(
            select(AdminRefreshToken).where(AdminRefreshToken.token == token)
        )
        return result.scalar_one_or_none()

    async def delete(self, token: AdminRefreshToken) -> None:
        await self.session.delete(token)
        await self.session.flush()

    async def delete_expired(self, admin_id: object) -> None:
        await self.session.execute(
            delete(AdminRefreshToken).where(
                AdminRefreshToken.admin_id == admin_id,
                AdminRefreshToken.expires_at < datetime.now(timezone.utc),
            )
        )
