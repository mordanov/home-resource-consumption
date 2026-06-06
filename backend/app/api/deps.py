from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import UnauthorizedError
from app.core.security import decode_access_token
from app.domain.models import User
from app.repositories.bill_repository import BillRepository
from app.repositories.prediction_repository import PredictionRepository
from app.repositories.token_repository import TokenRepository
from app.repositories.user_repository import UserRepository
from app.services.analytics_service import AnalyticsService
from app.services.auth_service import AuthService
from app.services.bill_service import BillService
from app.services.ml.predictor import LinearRegressionPredictor
from app.services.parser.parser_factory import ParserFactory
from app.services.prediction_service import PredictionService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    user_id = decode_access_token(token)
    result = await db.get(User, user_id)
    if result is None or not result.is_active:
        raise UnauthorizedError("User not found or inactive")
    return result


def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(UserRepository(db), TokenRepository(db))


def get_bill_service(db: AsyncSession = Depends(get_db)) -> BillService:
    return BillService(BillRepository(db), ParserFactory())


def get_prediction_service(db: AsyncSession = Depends(get_db)) -> PredictionService:
    predictor = LinearRegressionPredictor()
    return PredictionService(BillRepository(db), PredictionRepository(db), predictor)


def get_analytics_service(db: AsyncSession = Depends(get_db)) -> AnalyticsService:
    return AnalyticsService(db)


def get_export_service(db: AsyncSession = Depends(get_db)) -> object:
    from app.services.chart_renderer import ChartRenderer
    from app.services.export_service import ExportService
    analytics = AnalyticsService(db)
    return ExportService(analytics, ChartRenderer())
