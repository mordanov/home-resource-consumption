from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import ResourceType
from app.domain.models import Prediction
from app.repositories.base import BaseRepository


class PredictionRepository(BaseRepository[Prediction]):
    model = Prediction

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db)

    async def create_prediction(self, prediction: Prediction) -> Prediction:
        return await self.create(prediction)

    async def list_latest(self, user_id: UUID, resource_type: ResourceType) -> list[Prediction]:
        result = await self.db.execute(
            select(Prediction)
            .where(
                Prediction.user_id == user_id,
                Prediction.resource_type == resource_type.value,
            )
            .order_by(Prediction.generated_at.desc())
            .limit(10)
        )
        return list(result.scalars().all())
