from datetime import date, timedelta

from fastapi import APIRouter, Depends

from app.api.deps import get_analytics_service, get_current_user
from app.domain.enums import ResourceType
from app.domain.models import User
from app.domain.schemas import AnalyticsSummary
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get(
    "/summary",
    response_model=AnalyticsSummary,
    summary="Get aggregated analytics summary",
    description="Returns pre-aggregated data for all six chart types. Default: last 12 months.",
)
async def get_summary(
    date_from: date | None = None,
    date_to: date | None = None,
    resource_type: ResourceType | None = None,
    current_user: User = Depends(get_current_user),
    svc: AnalyticsService = Depends(get_analytics_service),
) -> AnalyticsSummary:
    today = date.today()
    effective_to = date_to or today
    effective_from = date_from or (today - timedelta(days=365))
    return await svc.get_summary(current_user.id, effective_from, effective_to, resource_type)
