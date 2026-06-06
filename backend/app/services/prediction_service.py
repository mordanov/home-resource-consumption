from datetime import UTC, datetime
from uuid import UUID

from app.core.exceptions import InsufficientDataError
from app.domain.enums import ResourceType
from app.domain.models import Prediction
from app.domain.schemas import PredictionRead
from app.repositories.bill_repository import BillRepository
from app.repositories.prediction_repository import PredictionRepository
from app.services.ml.base_predictor import BasePredictor

MIN_BILLS = 3


class PredictionService:
    def __init__(
        self,
        bill_repo: BillRepository,
        prediction_repo: PredictionRepository,
        predictor: BasePredictor,
    ) -> None:
        self.bill_repo = bill_repo
        self.prediction_repo = prediction_repo
        self.predictor = predictor

    async def predict(
        self, user_id: UUID, resource_type: ResourceType, horizon: int
    ) -> list[PredictionRead]:
        bills = await self.bill_repo.list_for_user_and_type(user_id, resource_type)
        if len(bills) < MIN_BILLS:
            raise InsufficientDataError(needed=MIN_BILLS, have=len(bills))
        self.predictor.fit(bills)
        now = datetime.now(UTC)
        saved = []
        for h in range(1, horizon + 1):
            r = self.predictor.predict(h)
            pred = Prediction(
                user_id=user_id,
                resource_type=resource_type.value,
                generated_at=now,
                horizon_months=h,
                predicted_consumption=float(r.predicted_consumption),
                predicted_cost=float(r.predicted_cost),
                confidence_interval_lower=float(r.confidence_interval_lower),
                confidence_interval_upper=float(r.confidence_interval_upper),
                model_version=r.model_version,
                created_at=now,
            )
            await self.prediction_repo.create_prediction(pred)
            saved.append(PredictionRead.model_validate(pred))
        return saved
