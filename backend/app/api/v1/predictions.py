from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, get_prediction_service
from app.domain.enums import ResourceType
from app.domain.models import User
from app.domain.schemas import PredictionRead
from app.services.prediction_service import PredictionService

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.get(
    "/{resource_type}",
    response_model=list[PredictionRead],
    summary="Get ML consumption predictions",
    description="Returns predictions for 1-3 months. Requires at least 3 historical bills.",
    responses={409: {"description": "Insufficient historical data"}},
)
async def get_predictions(
    resource_type: ResourceType,
    horizon: int = 1,
    current_user: User = Depends(get_current_user),
    svc: PredictionService = Depends(get_prediction_service),
) -> list[PredictionRead]:
    return await svc.predict(current_user.id, resource_type, horizon)
