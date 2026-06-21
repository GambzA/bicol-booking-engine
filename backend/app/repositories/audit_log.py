from sqlalchemy import select, func
from app.models.audit_log import AuditLog
from app.repositories.base import BaseRepository


class AuditLogRepository(BaseRepository[AuditLog]):
    model = AuditLog

    async def list_with_filters(
        self,
        hotel_id: object | None = None,
        admin_id: object | None = None,
        entity_type: str | None = None,
        entity_id: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[AuditLog], int]:
        stmt = select(AuditLog)
        count_stmt = select(func.count()).select_from(AuditLog)

        filters = []
        if hotel_id:
            filters.append(AuditLog.hotel_id == hotel_id)
        if admin_id:
            filters.append(AuditLog.admin_id == admin_id)
        if entity_type:
            filters.append(AuditLog.entity_type == entity_type)
        if entity_id:
            filters.append(AuditLog.entity_id == entity_id)

        if filters:
            from sqlalchemy import and_
            stmt = stmt.where(and_(*filters))
            count_stmt = count_stmt.where(and_(*filters))

        total = (await self.session.execute(count_stmt)).scalar() or 0
        offset = (page - 1) * page_size
        items = list((await self.session.execute(stmt.order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size))).scalars().all())
        return items, total
