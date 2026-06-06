# ADR-005: On-the-Fly Model Training vs Pre-Trained Model Serving

**Status:** Accepted  
**Date:** 2026-06-06  
**Deciders:** Software Architect  
**Technical Story:** T019 — Phase 2 Foundation (FR-3)

---

## Context

Once the ML predictor (ADR-004) is decided (scikit-learn `LinearRegression`), a second architectural question arises: **when and where is the model trained?**

Two strategies are available:

1. **On-the-fly training**: Every time a user requests a prediction, fetch their historical bills from the database and train a new model instance on that user's data. Return the prediction immediately. Discard the model.
2. **Pre-trained model serving**: Train a model per user (or per user+resource_type) on a schedule or after each bill upload, serialise it (pickle/joblib), store it, and serve predictions from the stored model.

---

## Decision

**Train the model on-the-fly for every prediction request.**

On each `GET /api/v1/predictions/{resource_type}?horizon=N` call:
1. `PredictionService` fetches all non-deleted bills for `(user_id, resource_type)` from `BillRepository`.
2. If `len(bills) < 3`, raise `InsufficientDataError(bills_needed=3 - len(bills))` → HTTP 409.
3. `FeatureEngineer.build_matrix(bills)` constructs the feature matrix X and target vector y.
4. `ModelTrainer.train(X, y)` fits a new `LinearRegression` instance.
5. `ModelPredictor.predict(model, horizon)` computes `ŷ` and the 90% confidence interval.
6. The prediction is persisted to the `Prediction` table (audit trail).
7. The fitted model object is discarded.

The separation of `ModelTrainer` and `ModelPredictor` into distinct classes is maintained (SRP), enabling future adoption of a serving strategy without restructuring either class.

---

## Rationale

### Why on-the-fly is correct for v1

**Dataset characteristics eliminate the benefit of caching:**
- Each user has 3–36 bill records. A `LinearRegression.fit()` call on 36 rows with 4 features completes in < 1 ms on any modern CPU.
- Bills are infrequently uploaded (monthly or bi-monthly). Model freshness is not a concern: training from scratch on each prediction request always uses the latest data.
- The dataset fits entirely in memory; there is no I/O bottleneck for loading the training data.

**Pre-trained serving adds complexity without commensurate benefit at this scale:**

| Concern | On-the-fly (chosen) | Pre-trained serving |
|---|---|---|
| Model freshness | Always fresh (trained on current bills) | Stale until retrained trigger fires |
| Complexity | No serialisation, no storage, no cache invalidation | Requires pickle/joblib storage, cache invalidation on bill upload/delete, versioning |
| Failure modes | Training failure is synchronous — surfaces as a 500 immediately | Stale or missing model file causes silent degraded predictions |
| Infrastructure | None beyond DB | Persistent volume for model files or a model registry |
| Latency (36 rows) | < 5 ms total (fetch + train + predict) | < 1 ms (only inference) + async training overhead |
| Consistency | Always consistent (bills and model trained in same transaction scope) | Race condition if a bill is uploaded while a model is being served |

**The latency difference is negligible**: the bottleneck in this system is the LLM API call during bill upload (~3–10 s), not prediction (~5 ms). Optimising prediction latency from 5 ms to 1 ms has no user-visible impact.

**The data integrity argument is decisive**: training on-the-fly inside the request that reads the bills from DB eliminates the possibility of serving a prediction that doesn't reflect a recently uploaded or deleted bill.

---

## SRP Enforcement

Even though training is on-the-fly, `ModelTrainer` and `ModelPredictor` are separate classes:

```
app/services/ml/
├── base_predictor.py         # Abstract interface (LSP)
├── predictor.py              # Concrete: LinearRegression + GradientBoosting via config
└── feature_engineering.py   # FeatureEngineer: bills → (X, y)
```

`ModelTrainer.train(X, y) -> FittedModel` and `ModelPredictor.predict(model, horizon) -> PredictionResult` are separate methods. This separation means adopting pre-trained serving in v2 requires replacing only the `PredictionService` orchestration layer, not the training or inference logic.

---

## Consequences

**Positive:**
- Zero infrastructure beyond what already exists (DB, backend container).
- No model versioning, serialisation format, or storage path to manage.
- Predictions are always consistent with the current bill history; no cache invalidation logic needed.
- Fits the project mandate to avoid premature abstraction (KISS).

**Negative / Trade-offs:**
- If the user accumulates 500+ bills (unlikely at household scale), training time could grow to ~50 ms. This is still negligible but worth monitoring.
- The fitted model cannot be inspected post-hoc for debugging (it is discarded). Mitigated by storing `model_version` and the prediction output in the `Prediction` table for audit purposes.
- A burst of simultaneous prediction requests from the same user would train N identical models. For a single-user household app, this is not a concern. If multi-user load ever warrants optimisation, a short-lived per-user LRU cache with a TTL of 60 seconds can be added without changing the training/inference classes.

**When to revisit this decision:**
- If the user's bill dataset exceeds ~200 records per resource type per user.
- If prediction latency is identified as a bottleneck (profiling required first).
- If predictions need to be computed in a background worker and retrieved asynchronously (e.g., for batch pre-computation of a dashboard).

---

## Alternatives Rejected

- **Scheduled retraining (e.g., nightly Celery task)**: Requires Celery, a broker (Redis), and a model store. Unnecessary complexity for a 3–36 row dataset. Rejected.
- **Retraining on bill upload (background task)**: Trains a model immediately after each bill is saved and stores it as a pickle file. Introduces a write-path side effect that complicates bill upload testing and adds a persistent volume concern. The latency savings (< 5 ms per prediction request) do not justify the added complexity. Rejected.
- **Shared global model (one model for all users)**: A single model trained on aggregate data across all users would expose one user's consumption patterns to another user's predictions. Rejected on data isolation and accuracy grounds.
