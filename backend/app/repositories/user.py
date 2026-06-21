from datetime import datetime, timezone
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, RefreshToken
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(
            select(User).where(User.email == email, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()


class RefreshTokenRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, data: dict) -> RefreshToken:
        token = RefreshToken(**data)
        self.session.add(token)
        await self.session.flush()
        return token

    async def get_by_token(self, token: str) -> RefreshToken | None:
        result = await self.session.execute(
            select(RefreshToken).where(RefreshToken.token == token)
        )
        return result.scalar_one_or_none()

    async def delete(self, token: RefreshToken) -> None:
        await self.session.delete(token)
        await self.session.flush()

    async def delete_expired(self, user_id: object) -> None:
        await self.session.execute(
            delete(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.expires_at < datetime.now(timezone.utc),
            )
        )
