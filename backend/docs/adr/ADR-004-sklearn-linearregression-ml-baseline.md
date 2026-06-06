# ADR-004: scikit-learn LinearRegression as the ML Baseline Predictor

**Status:** Accepted  
**Date:** 2026-06-06  
**Deciders:** Software Architect  
**Technical Story:** T019 — Phase 2 Foundation (FR-3)

---

## Context

The prediction service (FR-3) must forecast 1–3 months of resource consumption (electricity, gas, water) per user. The inputs are a user's historical bill records: consumption values, billing periods, and cost data.

Key constraints:
- **Minimum viable dataset**: at least 3 historical bills per resource type. Below this threshold, the endpoint returns `409` with a `bills_needed` count.
- **Typical dataset size**: a household accumulates 12–36 bills over 1–3 years. This is a small dataset.
- **Prediction horizon**: 1, 2, or 3 months ahead.
- **Output**: predicted consumption, predicted cost, 90% confidence interval, model version string.
- **Infrastructure**: no separate model-serving process; predictions run within the FastAPI backend container.

ML approaches evaluated:
1. **Linear Regression (scikit-learn)** — fit a line through historical consumption values with seasonality features.
2. **Gradient Boosting (scikit-learn `GradientBoostingRegressor`)** — ensemble of decision trees.
3. **Prophet (Meta)** — time series forecasting with seasonality and holiday effects.
4. **LSTM / neural network** — sequence model trained per user.

---

## Decision

**Use `sklearn.linear_model.LinearRegression` as the baseline predictor, with a clean abstraction (`BasePredictor`) that allows substituting `GradientBoostingRegressor` or any other sklearn-compatible estimator without changing callers.**

Feature vector per bill record:
- `month_index` — integer index of the bill's position in the time series (captures trend).
- `month_of_year` — integer 1–12 (captures annual seasonality: heating in winter, AC in summer).
- `days_in_period` — length of the billing period in days (normalises bi-monthly vs monthly bills).
- `price_per_unit_lag1` — price-per-unit from the previous bill (captures tariff trend).

Confidence interval: use `sklearn`'s residual standard error from the training set to compute a 90% prediction interval: `ŷ ± 1.645 * σ_residual`.

Model version string: `"linear_regression_v1"` — stored in each `Prediction` row for audit trail.

---

## Rationale

| Criterion | LinearRegression (chosen) | GradientBoosting | Prophet | LSTM |
|---|---|---|---|---|
| Minimum data needed | 3–5 samples | 20+ samples | 12+ samples | 50+ samples |
| Training time (3–36 rows) | < 1 ms | 10–50 ms | 500 ms–2 s | Minutes |
| Interpretability | Coefficients are human-readable | Feature importance, less interpretable | Trend/seasonality decomposition | Black box |
| Overfitting risk on small data | Low (linear) | High without regularisation | Medium | High |
| Dependency weight | Included in scikit-learn (~8 MB) | Included in scikit-learn | +50 MB (pystan compilation) | +TensorFlow/PyTorch ~500 MB |
| Confidence intervals | Residual SE (simple, sufficient) | Bootstrap (complex) | Built-in | Dropout sampling (complex) |
| Explainability to users | "Your usage trends up by X kWh/month" | Hard to explain | Trend + seasonality components | Not feasible |

With datasets of 3–36 rows, more complex models overfit without cross-validation folds, which are not statistically meaningful at this scale. `LinearRegression` is the appropriate choice: it generalises well to the expected data range, runs in microseconds, and produces interpretable coefficients that could be surfaced to users in future versions.

The `BasePredictor` abstraction (LSP — see ADR-004 companion class `app/services/ml/base_predictor.py`) ensures that upgrading to `GradientBoostingRegressor` or a user-specific hybrid is a one-class change with no caller modifications.

---

## Consequences

**Positive:**
- Prediction endpoint responds in < 10 ms (training + inference on 36 rows).
- No additional large ML dependencies; scikit-learn is already the most lightweight choice.
- Linear model coefficients can be logged per prediction for explainability and debugging.
- Easy to unit test: a synthetic monotone dataset must produce a prediction within 15% of the extrapolated trend (quality gate from speckit-v1).

**Negative / Trade-offs:**
- Linear regression cannot capture non-linear patterns (e.g., exponential tariff increases or sudden consumption spikes). For a household utility tracker with smooth annual seasonality, this is acceptable.
- The 90% confidence interval based on residual SE assumes homoscedastic errors. Real utility bills have heteroscedastic variance (higher variance in winter). This is acceptable for v1 — the interval is a useful UX signal, not a statistical guarantee.
- With only 3 bills (minimum threshold), the model has 3 data points and 4 features — the system is underdetermined. Implementation note: with < 5 bills, reduce the feature set to `[month_index, month_of_year]` only (drop `days_in_period` and `price_per_unit_lag1` if insufficient history for a lag feature).

**Quality gate (from speckit-v1):**
> Regression test: synthetic dataset with known trend must produce prediction within 15% of true value.

This gate is achievable with linear regression on a clean linear trend and is explicitly the reason for choosing this baseline.

**Upgrade path:**
The `BasePredictor` interface and `ParserFactory`-style `PredictorFactory` allow swapping to `GradientBoostingRegressor` (or any sklearn estimator) via a single line change in the factory. This will be relevant when users accumulate 20+ bills.

---

## Alternatives Rejected

- **GradientBoostingRegressor**: Superior accuracy on larger datasets but requires 20+ samples for reliable cross-validation. Included as a configurable option via `BasePredictor` for future use.
- **Prophet**: Designed for daily/weekly time series with hundreds of observations. Adds a 50 MB `pystan` dependency and a 500 ms+ training time per call. Rejected for v1 on dataset-size mismatch grounds.
- **LSTM/neural network**: Requires TensorFlow or PyTorch (~500 MB), GPU for fast training, and 50+ samples to avoid severe overfitting. Entirely inappropriate for a 3–36 row dataset.
- **SARIMA (statsmodels)**: Better seasonality modelling than linear regression, but requires 24+ observations for seasonal identification and `statsmodels` adds ~30 MB. Deferred.
