from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.constants import AuditAction
from app.core.exceptions import UnauthorizedError
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.repositories.platform_admin import PlatformAdminRepository, AdminRefreshTokenRepository
from app.services.audit_service import log_audit


class AdminAuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.admin_repo = PlatformAdminRepository(session)
        self.token_repo = AdminRefreshTokenRepository(session)

    async def login(self, email: str, password: str) -> dict:
        admin = await self.admin_repo.get_by_email(email)
        if not admin or not verify_password(password, admin.hashed_password):
            raise UnauthorizedError("Invalid email or password.")
        if not admin.is_active:
            raise UnauthorizedError("Account is inactive.")

        result = await self._issue_tokens(admin)
        await log_audit(
            self.session,
            action=AuditAction.ADMIN_LOGIN,
            entity_type="platform_admin",
            entity_id=str(admin.id),
            admin_id=admin.id,
        )
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

        admin = await self.admin_repo.get_by_id(record.admin_id)
        if not admin or not admin.is_active:
            raise UnauthorizedError("Admin not found or inactive.")

        await self.token_repo.delete(record)
        result = await self._issue_tokens(admin)
        await self.session.commit()
        return result

    async def logout(self, refresh_token: str) -> None:
        record = await self.token_repo.get_by_token(refresh_token)
        if record:
            await self.token_repo.delete(record)
            await self.session.commit()

    async def _issue_tokens(self, admin: object) -> dict:
        payload = {"sub": str(admin.id), "type": "admin"}
        access_token = create_access_token(payload)
        refresh_token = create_refresh_token({"sub": str(admin.id), "type": "admin"})
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        await self.token_repo.create({
            "admin_id": admin.id,
            "token": refresh_token,
            "expires_at": expires_at,
        })

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "admin": {
                "id": str(admin.id),
                "email": admin.email,
                "full_name": admin.full_name,
            },
        }
