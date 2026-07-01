import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import joinedload, selectinload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.property_portal import (
    Package, PackageAccommodation, PackageInclusion, Accommodation,
)

router = APIRouter(prefix="/packages", tags=["property-packages"])

VALID_PRICING_TYPES = {"per_stay", "per_night", "per_person"}


class PackageCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True
    pricing_type: str = "per_stay"
    price_value: Decimal
    display_order: int = 0
    accommodation_ids: list[uuid.UUID] = []
    inclusions: list[str] = []


class PackageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    pricing_type: Optional[str] = None
    price_value: Optional[Decimal] = None
    display_order: Optional[int] = None
    accommodation_ids: Optional[list[uuid.UUID]] = None
    inclusions: Optional[list[str]] = None


def _serialize(pkg: Package, include_details: bool = False) -> dict:
    data: dict = {
        "id": str(pkg.id),
        "name": pkg.name,
        "description": pkg.description,
        "is_active": pkg.is_active,
        "pricing_type": pkg.pricing_type,
        "price_value": str(pkg.price_value),
        "display_order": pkg.display_order,
        "created_at": pkg.created_at.isoformat(),
        "updated_at": pkg.updated_at.isoformat(),
    }
    if include_details:
        data["accommodations"] = [
            {
                "id": str(link.accommodation_id),
                "name": link.accommodation.name if link.accommodation else None,
            }
            for link in pkg.accommodations
        ]
        data["inclusions"] = [inc.inclusion_type for inc in pkg.inclusions]
    return data


async def _get_or_404(db: AsyncSession, package_id: uuid.UUID, hotel_id: uuid.UUID) -> Package:
    pkg = (await db.execute(
        select(Package).where(
            Package.id == package_id,
            Package.hotel_id == hotel_id,
            Package.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if pkg is None:
        raise HTTPException(status_code=404, detail="Package not found")
    return pkg


def _validate_pricing(pricing_type: str, price_value: Decimal) -> None:
    if pricing_type not in VALID_PRICING_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid pricing_type: {pricing_type}")
    if price_value <= 0:
        raise HTTPException(status_code=422, detail="Package price must be greater than zero")


async def _validate_accommodation_ids(
    db: AsyncSession, hotel_id: uuid.UUID, accommodation_ids: list[uuid.UUID]
) -> None:
    for acc_id in accommodation_ids:
        acc = (await db.execute(
            select(Accommodation).where(
                Accommodation.id == acc_id,
                Accommodation.hotel_id == hotel_id,
                Accommodation.deleted_at.is_(None),
            )
        )).scalar_one_or_none()
        if acc is None:
            raise HTTPException(
                status_code=422,
                detail=f"Accommodation {acc_id} not found or does not belong to this hotel",
            )


@router.get("")
async def list_packages(
    search: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hotel_id = user.hotel_id
    base_where = [
        Package.hotel_id == hotel_id,
        Package.deleted_at.is_(None),
    ]
    if search:
        base_where.append(Package.name.ilike(f"%{search}%"))
    if active is not None:
        base_where.append(Package.is_active == active)

    total = (await db.execute(
        select(func.count(Package.id)).where(*base_where)
    )).scalar() or 0

    packages = list((await db.execute(
        select(Package)
        .options(selectinload(Package.accommodations).joinedload(PackageAccommodation.accommodation))
        .where(*base_where)
        .order_by(Package.display_order, Package.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all())

    items = []
    for pkg in packages:
        items.append({
            **_serialize(pkg),
            "accommodation_count": len(pkg.accommodations),
            "accommodations": [
                {"accommodation_id": str(a.accommodation_id), "accommodation_name": a.accommodation.name}
                for a in pkg.accommodations
            ],
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/{package_id}")
async def get_package(
    package_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pkg = (await db.execute(
        select(Package)
        .where(
            Package.id == package_id,
            Package.hotel_id == user.hotel_id,
            Package.deleted_at.is_(None),
        )
        .options(
            selectinload(Package.accommodations).joinedload(PackageAccommodation.accommodation),
            selectinload(Package.inclusions),
        )
    )).scalar_one_or_none()
    if pkg is None:
        raise HTTPException(status_code=404, detail="Package not found")
    return _serialize(pkg, include_details=True)


@router.post("")
async def create_package(
    body: PackageCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _validate_pricing(body.pricing_type, body.price_value)
    if not body.accommodation_ids:
        raise HTTPException(status_code=422, detail="At least one accommodation is required")
    await _validate_accommodation_ids(db, user.hotel_id, body.accommodation_ids)

    pkg = Package(
        hotel_id=user.hotel_id,
        name=body.name,
        description=body.description,
        is_active=body.is_active,
        pricing_type=body.pricing_type,
        price_value=body.price_value,
        display_order=body.display_order,
    )
    db.add(pkg)
    await db.flush()

    for acc_id in body.accommodation_ids:
        db.add(PackageAccommodation(package_id=pkg.id, accommodation_id=acc_id))
    for inclusion_type in body.inclusions:
        db.add(PackageInclusion(package_id=pkg.id, inclusion_type=inclusion_type))

    await db.commit()
    await db.refresh(pkg)
    return _serialize(pkg)


@router.put("/{package_id}")
async def update_package(
    package_id: uuid.UUID,
    body: PackageUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pkg = await _get_or_404(db, package_id, user.hotel_id)
    updates = body.model_dump(exclude_unset=True)

    effective_type = updates.get("pricing_type", pkg.pricing_type)
    effective_value = updates.get("price_value", pkg.price_value)
    _validate_pricing(effective_type, effective_value)

    for field in ("name", "description", "is_active", "pricing_type", "price_value", "display_order"):
        if field in updates:
            setattr(pkg, field, updates[field])

    if body.accommodation_ids is not None:
        if not body.accommodation_ids:
            raise HTTPException(status_code=422, detail="At least one accommodation is required")
        await _validate_accommodation_ids(db, user.hotel_id, body.accommodation_ids)
        await db.execute(
            delete(PackageAccommodation).where(PackageAccommodation.package_id == pkg.id)
        )
        for acc_id in body.accommodation_ids:
            db.add(PackageAccommodation(package_id=pkg.id, accommodation_id=acc_id))

    if body.inclusions is not None:
        await db.execute(
            delete(PackageInclusion).where(PackageInclusion.package_id == pkg.id)
        )
        for inclusion_type in body.inclusions:
            db.add(PackageInclusion(package_id=pkg.id, inclusion_type=inclusion_type))

    await db.commit()
    await db.refresh(pkg)
    return _serialize(pkg)


@router.patch("/{package_id}/toggle")
async def toggle_package_active(
    package_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pkg = await _get_or_404(db, package_id, user.hotel_id)
    pkg.is_active = not pkg.is_active
    await db.commit()
    await db.refresh(pkg)
    return _serialize(pkg)


@router.delete("/{package_id}")
async def delete_package(
    package_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pkg = await _get_or_404(db, package_id, user.hotel_id)
    pkg.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}
