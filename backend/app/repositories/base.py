from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import Base


class BaseRepository[ModelT: Base]:
    model: type[ModelT]

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, obj_id: UUID, user_id: UUID) -> ModelT | None:
        result = await self.db.execute(
            select(self.model).where(
                self.model.id == obj_id,  # type: ignore[attr-defined]
                self.model.user_id == user_id,  # type: ignore[attr-defined]
            )
        )
        return result.scalar_one_or_none()

    async def create(self, obj: ModelT) -> ModelT:
        now = datetime.now(UTC)
        if hasattr(obj, "created_at"):
            obj.created_at = now
        if hasattr(obj, "updated_at"):
            obj.updated_at = now
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def update(self, obj: ModelT) -> ModelT:
        if hasattr(obj, "updated_at"):
            obj.updated_at = datetime.now(UTC)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def soft_delete(self, obj_id: UUID, user_id: UUID) -> bool:
        obj = await self.get_by_id(obj_id, user_id)
        if obj is None:
            return False
        obj.deleted_at = datetime.now(UTC)  # type: ignore[attr-defined]
        obj.updated_at = datetime.now(UTC)  # type: ignore[attr-defined]
        await self.db.flush()
        return True
