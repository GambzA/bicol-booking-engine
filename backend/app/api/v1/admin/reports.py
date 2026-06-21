from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.platform_admin import PlatformAdmin
from app.services.platform_reports import PlatformReportsService

router = APIRouter(prefix="/reports", tags=["admin-reports"])


@router.get("/overview")
async def platform_overview(
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    return await PlatformReportsService(db).overview()


@router.get("/revenue")
async def revenue_report(
    period_start: date = Query(...),
    period_end: date = Query(...),
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    return await PlatformReportsService(db).revenue(period_start, period_end)
