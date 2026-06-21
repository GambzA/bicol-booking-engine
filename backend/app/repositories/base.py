from datetime import datetime, timezone
from typing import Any, Generic, Type, TypeVar
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    model: Type[ModelT]

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, id: Any) -> ModelT | None:
        stmt = select(self.model).where(self.model.id == id)
        if hasattr(self.model, "deleted_at"):
            stmt = stmt.where(self.model.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, data: dict) -> ModelT:
        instance = self.model(**data)
        self.session.add(instance)
        await self.session.flush()
        return instance

    async def update(self, instance: ModelT, data: dict) -> ModelT:
        for key, value in data.items():
            setattr(instance, key, value)
        await self.session.flush()
        return instance

    async def soft_delete(self, instance: ModelT) -> None:
        instance.deleted_at = datetime.now(timezone.utc)
        await self.session.flush()

    def paginate(self, total: int, page: int, page_size: int) -> dict:
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size,
        }
