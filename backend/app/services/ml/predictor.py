import math
from decimal import Decimal
from typing import Any

import numpy as np
from sklearn.linear_model import LinearRegression

from app.core.exceptions import InsufficientDataError
from app.domain.models import Bill
from app.services.ml.base_predictor import BasePredictor, PredictionResult
from app.services.ml.feature_engineering import build_features

MIN_BILLS = 3
MODEL_VERSION = "linear_regression_v1"
_FEATURE_COLS = [
    "sin_month",
    "cos_month",
    "period_days",
    "price_per_unit",
    "lag_1",
    "lag_2",
]

_NDArray = np.ndarray[Any, np.dtype[Any]]


class _ModelTrainer:
    def __init__(self) -> None:
        self._model = LinearRegression()

    def fit(self, features: _NDArray, target: _NDArray) -> "_ModelTrainer":
        self._model.fit(features, target)
        return self

    def predict(self, features: _NDArray) -> _NDArray:
        result: _NDArray = self._model.predict(features)
        return result


class _ModelPredictor:
    def __init__(
        self,
        trainer: _ModelTrainer,
        residuals: _NDArray,
        n_resamples: int = 100,
        ci_quantile: float = 0.05,
    ) -> None:
        self._trainer = trainer
        self._residuals = residuals
        self._n_resamples = n_resamples
        self._ci_quantile = ci_quantile

    def predict_with_ci(self, features: _NDArray) -> tuple[float, float, float]:
        central = float(self._trainer.predict(features)[0])
        bootstrapped = [
            central + float(np.random.choice(self._residuals)) for _ in range(self._n_resamples)
        ]
        lower = float(np.quantile(bootstrapped, self._ci_quantile))
        upper = float(np.quantile(bootstrapped, 1 - self._ci_quantile))
        return central, lower, upper


class LinearRegressionPredictor(BasePredictor):
    def __init__(self, n_resamples: int = 100, ci_quantile: float = 0.05) -> None:
        self._n_resamples = n_resamples
        self._ci_quantile = ci_quantile
        self._trainer: _ModelTrainer | None = None
        self._predictor: _ModelPredictor | None = None
        self._last_row: dict[str, float] | None = None
        self._avg_price_per_unit: float = 0.0

    def fit(self, bills: list[Bill]) -> None:
        if len(bills) < MIN_BILLS:
            raise InsufficientDataError(needed=MIN_BILLS, have=len(bills))
        df = build_features(bills)
        if len(df) < 1:
            raise InsufficientDataError(needed=MIN_BILLS, have=len(bills))
        feature_cols = [c for c in _FEATURE_COLS if c in df.columns]
        features: _NDArray = df[feature_cols].to_numpy()
        target: _NDArray = df["amount_consumed"].to_numpy()
        trainer = _ModelTrainer().fit(features, target)
        residuals: _NDArray = target - trainer.predict(features)
        self._trainer = trainer
        self._predictor = _ModelPredictor(
            trainer, residuals, n_resamples=self._n_resamples, ci_quantile=self._ci_quantile
        )
        self._last_row = df.iloc[-1][feature_cols].to_dict()
        self._avg_price_per_unit = float(df["price_per_unit"].mean())

    def predict(self, horizon_months: int) -> PredictionResult:
        if self._predictor is None or self._last_row is None:
            raise RuntimeError("Call fit() before predict()")
        row = dict(self._last_row)
        month = int((row.get("month", 1) + horizon_months - 1) % 12) + 1
        row["sin_month"] = math.sin(2 * math.pi * month / 12)
        row["cos_month"] = math.cos(2 * math.pi * month / 12)
        features: _NDArray = np.array([[row.get(c, 0.0) for c in _FEATURE_COLS if c in row]])
        central, lower, upper = self._predictor.predict_with_ci(features)
        central = max(0.0, central)
        lower = max(0.0, lower)
        upper = max(lower, upper)
        cost = central * self._avg_price_per_unit
        return PredictionResult(
            predicted_consumption=Decimal(str(round(central, 4))),
            predicted_cost=Decimal(str(round(cost, 4))),
            confidence_interval_lower=Decimal(str(round(lower, 4))),
            confidence_interval_upper=Decimal(str(round(upper, 4))),
            model_version=MODEL_VERSION,
        )
