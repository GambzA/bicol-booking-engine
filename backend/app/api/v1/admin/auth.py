from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.admin_auth import AdminAuthService

router = APIRouter(prefix="/auth", tags=["admin-auth"])


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminRefreshRequest(BaseModel):
    refresh_token: str


class AdminLogoutRequest(BaseModel):
    refresh_token: str


@router.post("/login")
async def login(body: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    return await AdminAuthService(db).login(body.email, body.password)


@router.post("/refresh")
async def refresh(body: AdminRefreshRequest, db: AsyncSession = Depends(get_db)):
    return await AdminAuthService(db).refresh(body.refresh_token)


@router.post("/logout", status_code=204)
async def logout(body: AdminLogoutRequest, db: AsyncSession = Depends(get_db)):
    await AdminAuthService(db).logout(body.refresh_token)
