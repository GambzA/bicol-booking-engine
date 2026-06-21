import re
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.models.user import UserRole
from app.repositories.hotel import HotelRepository
from app.repositories.user import UserRepository, RefreshTokenRepository


def _slugify(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s-]+", "-", slug).strip("-")
    return slug or "hotel"


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.hotel_repo = HotelRepository(session)
        self.user_repo = UserRepository(session)
        self.token_repo = RefreshTokenRepository(session)

    async def register(self, hotel_name: str, email: str, full_name: str, password: str) -> dict:
        if await self.hotel_repo.get_by_email(email):
            raise ConflictError("A hotel account with this email already exists.")
        if await self.user_repo.get_by_email(email):
            raise ConflictError("An account with this email already exists.")

        base_slug = _slugify(hotel_name)
        slug, counter = base_slug, 1
        while await self.hotel_repo.get_by_slug(slug):
            slug = f"{base_slug}-{counter}"
            counter += 1

        hotel = await self.hotel_repo.create({"name": hotel_name, "slug": slug, "email": email})
        user = await self.user_repo.create({
            "hotel_id": hotel.id,
            "email": email,
            "full_name": full_name,
            "hashed_password": hash_password(password),
            "role": UserRole.OWNER,
        })

        result = await self._issue_tokens(user)
        await self.session.commit()
        return result

    async def login(self, email: str, password: str) -> dict:
        user = await self.user_repo.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Invalid email or password.")
        if not user.is_active:
            raise UnauthorizedError("Account is inactive.")

        result = await self._issue_tokens(user)
        await self.session.commit()
        return result

    async def refresh(self, refresh_token: str) -> dict:
        record = await self.token_repo.get_by_token(refresh_token)
        if not record:
            raise UnauthorizedError("Invalid refresh token.")
        if record.expires_at < datetime.now(timezone.utc):
            await self.token_repo.delete(record)
            await self.session.commit()
            raise UnauthorizedError("Refresh token expired.")

        user = await self.user_repo.get_by_id(record.user_id)
        if not user or not user.is_active:
            raise UnauthorizedError("User not found or inactive.")

        await self.token_repo.delete(record)
        result = await self._issue_tokens(user)
        await self.session.commit()
        return result

    async def logout(self, refresh_token: str) -> None:
        record = await self.token_repo.get_by_token(refresh_token)
        if record:
            await self.token_repo.delete(record)
            await self.session.commit()

    async def _issue_tokens(self, user: object) -> dict:
        payload = {
            "sub": str(user.id),
            "hotel_id": str(user.hotel_id),
            "role": user.role.value,
        }
        access_token = create_access_token(payload)
        refresh_token = create_refresh_token({"sub": str(user.id)})
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        await self.token_repo.create({
            "user_id": user.id,
            "token": refresh_token,
            "expires_at": expires_at,
        })

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role.value,
                "hotel_id": str(user.hotel_id),
            },
        }
