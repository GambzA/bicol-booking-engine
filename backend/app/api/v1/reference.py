import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.models.reference import ReferenceCountry, ReferenceStateProvince, ReferenceCity

router = APIRouter(prefix="/reference", tags=["reference"])


@router.get("/countries")
async def list_countries(db: AsyncSession = Depends(get_db)):
    rows = list((await db.execute(
        select(ReferenceCountry)
        .where(ReferenceCountry.is_active.is_(True))
        .order_by(ReferenceCountry.country_name)
    )).scalars().all())
    return [
        {
            "id": str(c.id),
            "iso2_code": c.iso2_code,
            "iso3_code": c.iso3_code,
            "country_name": c.country_name,
            "phone_code": c.phone_code,
            "currency_code": c.currency_code,
            "nationality": c.nationality,
            "continent": c.continent,
        }
        for c in rows
    ]


@router.get("/countries/{country_id}/states")
async def list_states(country_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    rows = list((await db.execute(
        select(ReferenceStateProvince)
        .where(
            ReferenceStateProvince.country_id == country_id,
            ReferenceStateProvince.is_active.is_(True),
        )
        .order_by(ReferenceStateProvince.state_name)
    )).scalars().all())
    return [
        {"id": str(s.id), "state_code": s.state_code, "state_name": s.state_name, "type": s.type}
        for s in rows
    ]


@router.get("/states/{state_id}/cities")
async def list_cities(state_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    rows = list((await db.execute(
        select(ReferenceCity)
        .where(
            ReferenceCity.state_province_id == state_id,
            ReferenceCity.is_active.is_(True),
        )
        .order_by(ReferenceCity.city_name)
    )).scalars().all())
    return [
        {
            "id": str(c.id),
            "city_name": c.city_name,
            "latitude": str(c.latitude) if c.latitude is not None else None,
            "longitude": str(c.longitude) if c.longitude is not None else None,
            "timezone": c.timezone,
        }
        for c in rows
    ]


@router.get("/cities/search")
async def search_cities(
    q: str = Query(..., min_length=2),
    country_id: uuid.UUID = Query(None),
    db: AsyncSession = Depends(get_db),
):
    filters = [
        ReferenceCity.is_active.is_(True),
        func.lower(ReferenceCity.city_name).contains(q.lower()),
    ]
    if country_id:
        filters.append(ReferenceCity.country_id == country_id)
    rows = list((await db.execute(
        select(ReferenceCity)
        .where(*filters)
        .order_by(ReferenceCity.city_name)
        .limit(50)
    )).scalars().all())
    return [
        {"id": str(c.id), "city_name": c.city_name, "country_id": str(c.country_id)}
        for c in rows
    ]
