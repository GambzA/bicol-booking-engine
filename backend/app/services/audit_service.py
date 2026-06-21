import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog


async def log_audit(
    session: AsyncSession,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    hotel_id: uuid.UUID | None = None,
    admin_id: uuid.UUID | None = None,
    remarks: str | None = None,
    before_state: dict | None = None,
    after_state: dict | None = None,
    extra: dict | None = None,
) -> None:
    entry = AuditLog(
        admin_id=admin_id,
        hotel_id=hotel_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        remarks=remarks,
        before_state=before_state,
        after_state=after_state,
        extra=extra,
    )
    session.add(entry)
    await session.flush()
