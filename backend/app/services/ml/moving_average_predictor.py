from decimal import Decimal

from app.core.exceptions import InsufficientDataError
from app.domain.models import Bill
from app.services.ml.base_predictor import BasePredictor, PredictionResult

MIN_BILLS = 3
MODEL_VERSION = "moving_average_v1"


class MovingAveragePredictor(BasePredictor):
    """Simple weighted moving average predictor.

    Weights recent observations more heavily using an exponentially
    decaying scheme: weight[i] = alpha^(n-1-i) where i=0 is oldest.
    """

    def __init__(self, window: int = 3, alpha: float = 0.7) -> None:
        self._window = max(1, window)
        self._alpha = max(0.01, min(0.99, alpha))
        self._avg_consumption: float = 0.0
        self._avg_price: float = 0.0
        self._std_consumption: float = 0.0
        self._fitted = False

    def fit(self, bills: list[Bill]) -> None:
        if len(bills) < MIN_BILLS:
            raise InsufficientDataError(needed=MIN_BILLS, have=len(bills))
        sorted_bills = sorted(bills, key=lambda b: b.bill_date)
        window_bills = sorted_bills[-self._window :]
        n = len(window_bills)
        weights = [self._alpha ** (n - 1 - i) for i in range(n)]
        w_sum = sum(weights)
        consumptions = [float(b.amount_consumed) for b in window_bills]
        prices = [
            float(b.amount_paid) / float(b.amount_consumed) if float(b.amount_consumed) > 0 else 0.0
            for b in window_bills
        ]
        self._avg_consumption = sum(w * c for w, c in zip(weights, consumptions)) / w_sum
        self._avg_price = sum(w * p for w, p in zip(weights, prices)) / w_sum
        # std from full history for CI
        all_c = [float(b.amount_consumed) for b in sorted_bills]
        mean_c = sum(all_c) / len(all_c)
        variance = sum((c - mean_c) ** 2 for c in all_c) / len(all_c)
        self._std_consumption = variance**0.5
        self._fitted = True

    def predict(self, horizon_months: int) -> PredictionResult:
        if not self._fitted:
            raise RuntimeError("Call fit() before predict()")
        # MA prediction is flat (no trend extrapolation) — same value for each horizon
        central = max(0.0, self._avg_consumption)
        margin = self._std_consumption * 1.645  # 90% CI
        lower = max(0.0, central - margin)
        upper = central + margin
        cost = central * self._avg_price
        return PredictionResult(
            predicted_consumption=Decimal(str(round(central, 4))),
            predicted_cost=Decimal(str(round(cost, 4))),
            confidence_interval_lower=Decimal(str(round(lower, 4))),
            confidence_interval_upper=Decimal(str(round(upper, 4))),
            model_version=MODEL_VERSION,
        )
