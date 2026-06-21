from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    hotel_name: str
    email: EmailStr
    full_name: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


@router.post("/register", status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService(db).register(body.hotel_name, body.email, body.full_name, body.password)


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService(db).login(body.email, body.password)


@router.post("/refresh")
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService(db).refresh(body.refresh_token)


@router.post("/logout", status_code=204)
async def logout(body: LogoutRequest, db: AsyncSession = Depends(get_db)):
    await AuthService(db).logout(body.refresh_token)
