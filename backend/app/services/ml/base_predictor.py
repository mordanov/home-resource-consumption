from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal

from app.domain.models import Bill


@dataclass
class PredictionResult:
    predicted_consumption: Decimal
    predicted_cost: Decimal
    confidence_interval_lower: Decimal
    confidence_interval_upper: Decimal
    model_version: str


class BasePredictor(ABC):
    @abstractmethod
    def fit(self, bills: list[Bill]) -> None:
        """Train on historical bills."""

    @abstractmethod
    def predict(self, horizon_months: int) -> PredictionResult:
        """Generate prediction for the given horizon (months ahead)."""
