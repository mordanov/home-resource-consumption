from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import ResourceType
from app.domain.models import Bill
from app.repositories.base import BaseRepository


class BillRepository(BaseRepository[Bill]):
    model = Bill

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db)

    async def list_paginated(
        self,
        user_id: UUID,
        resource_type: ResourceType | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Bill], int]:
        base_q = select(Bill).where(Bill.user_id == user_id, Bill.deleted_at.is_(None))
        if resource_type:
            base_q = base_q.where(Bill.resource_type == resource_type.value)
        if date_from:
            base_q = base_q.where(Bill.bill_date >= date_from)
        if date_to:
            base_q = base_q.where(Bill.bill_date <= date_to)

        count_q = select(func.count()).select_from(base_q.subquery())
        total: int = (await self.db.scalar(count_q)) or 0

        offset = (page - 1) * size
        items_q = base_q.order_by(Bill.bill_date.desc()).offset(offset).limit(size)
        result = await self.db.execute(items_q)
        return list(result.scalars().all()), total

    async def list_for_user_and_type(
        self, user_id: UUID, resource_type: ResourceType
    ) -> list[Bill]:
        result = await self.db.execute(
            select(Bill)
            .where(
                Bill.user_id == user_id,
                Bill.resource_type == resource_type.value,
                Bill.deleted_at.is_(None),
            )
            .order_by(Bill.bill_date.asc())
        )
        return list(result.scalars().all())

    async def get_active(self, obj_id: UUID, user_id: UUID) -> Bill | None:
        result = await self.db.execute(
            select(Bill).where(
                Bill.id == obj_id,
                Bill.user_id == user_id,
                Bill.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()
