from fastapi import APIRouter, Depends, Query

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
    description=(
        "Returns predictions for 1-3 months. Requires at least 3 historical bills.\n\n"
        "**model** options: `linear_regression` (default), `moving_average`\n\n"
        "**Linear regression params**: `ci_quantile` (0.01-0.49, default 0.05), "
        "`n_resamples` (10-500, default 100)\n\n"
        "**Moving average params**: `window` (1-12, default 3), `alpha` (0.01-0.99, default 0.7)"
    ),
    responses={409: {"description": "Insufficient historical data"}},
)
async def get_predictions(
    resource_type: ResourceType,
    horizon: int = Query(default=1, ge=1, le=3),
    model: str = Query(default="linear_regression", pattern="^(linear_regression|moving_average)$"),
    ci_quantile: float = Query(default=0.05, ge=0.01, le=0.49),
    n_resamples: int = Query(default=100, ge=10, le=500),
    window: int = Query(default=3, ge=1, le=12),
    alpha: float = Query(default=0.7, ge=0.01, le=0.99),
    current_user: User = Depends(get_current_user),
    svc: PredictionService = Depends(get_prediction_service),
) -> list[PredictionRead]:
    return await svc.predict(
        current_user.id,
        resource_type,
        horizon,
        model=model,
        ci_quantile=ci_quantile,
        n_resamples=n_resamples,
        window=window,
        alpha=alpha,
    )
