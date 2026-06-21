from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.exceptions import UnauthorizedError
from app.core.security import decode_token
from app.repositories.user import UserRepository
from app.repositories.platform_admin import PlatformAdminRepository
from app.models.user import User
from app.models.platform_admin import PlatformAdmin

bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedError()
    except ValueError:
        raise UnauthorizedError()

    user = await UserRepository(db).get_by_id(user_id)
    if not user or not user.is_active:
        raise UnauthorizedError()
    return user


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> PlatformAdmin:
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "admin":
            raise UnauthorizedError()
        admin_id = payload.get("sub")
        if not admin_id:
            raise UnauthorizedError()
    except ValueError:
        raise UnauthorizedError()

    admin = await PlatformAdminRepository(db).get_by_id(admin_id)
    if not admin or not admin.is_active:
        raise UnauthorizedError()
    return admin
