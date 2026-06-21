import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.platform_admin import PlatformAdmin
from app.repositories.audit_log import AuditLogRepository

router = APIRouter(prefix="/audit-logs", tags=["admin-audit"])


@router.get("")
async def list_audit_logs(
    hotel_id: Optional[uuid.UUID] = Query(None),
    admin_id: Optional[uuid.UUID] = Query(None),
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_admin),
):
    repo = AuditLogRepository(db)
    items, total = await repo.list_with_filters(
        hotel_id=hotel_id,
        admin_id=admin_id,
        entity_type=entity_type,
        entity_id=entity_id,
        page=page,
        page_size=page_size,
    )
    pagination = {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }
    return {
        **pagination,
        "items": [
            {
                "id": str(e.id),
                "admin_id": str(e.admin_id) if e.admin_id else None,
                "hotel_id": str(e.hotel_id) if e.hotel_id else None,
                "action": e.action,
                "entity_type": e.entity_type,
                "entity_id": e.entity_id,
                "remarks": e.remarks,
                "before_state": e.before_state,
                "after_state": e.after_state,
                "extra": e.extra,
                "created_at": e.created_at.isoformat(),
            }
            for e in items
        ],
    }
