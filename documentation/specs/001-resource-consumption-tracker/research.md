# Research: Home Resource Consumption Tracker

**Phase**: 0 — Unknowns resolved before design
**Date**: 2026-06-05

---

## 1. Bill Text Extraction: PDF vs Image

**Decision**: PyMuPDF (`fitz`) for PDFs; pytesseract (wrapping Tesseract OCR) for JPEG/PNG images.

**Rationale**:
- PyMuPDF extracts embedded text from PDFs without rasterising, yielding clean, structured text in milliseconds even for multi-page bills.
- Tesseract is the de-facto open-source OCR engine with strong multi-language support. pytesseract is the standard Python wrapper. For image-based bills it is accurate enough for printed utility invoices when image quality is reasonable.
- Both libraries are well-maintained, containerisable, and have no per-call API cost.

**Alternatives considered**:
- Google Document AI / AWS Textract: higher accuracy but adds external API cost, network dependency, and vendor lock-in. Unsuitable for a self-hosted deployment.
- pdfplumber: also good for PDFs but returns less structured output for complex layouts than PyMuPDF.

---

## 2. LLM Bill Parsing: Structured Output Strategy

**Decision**: OpenAI Chat Completions API with JSON schema enforcement (`response_format: { type: "json_schema", json_schema: {...} }` available on `gpt-4o` / `gpt-4o-mini`).

**Rationale**:
- Raw OCR text from utility bills is noisy (whitespace artefacts, varied formats across providers). An LLM normalises dates, numbers, and currency formats reliably.
- JSON schema mode guarantees the response is valid, schema-conformant JSON — eliminating manual parsing and retries.
- `gpt-4o-mini` offers near-GPT-4 accuracy at a fraction of the cost for short extraction tasks.

**Prompt design principle**: System prompt describes the expected JSON schema plus field semantics; user message contains the raw extracted text only. Temperature = 0 for determinism.

**Alternatives considered**:
- Local LLMs (Ollama/Llama 3): possible but accuracy on structured extraction is significantly lower for small models without fine-tuning. Not suitable as the default; may be added as an optional provider in a future version.
- Regex-based extractors: brittle across the variety of bill formats from different utility companies.

---

## 3. ML Forecasting: Algorithm Selection

**Decision**: `LinearRegression` (scikit-learn) as the baseline model. `GradientBoostingRegressor` available as a configurable alternative via a `model_type` environment variable.

**Rationale**:
- With 3–24 monthly bills per resource type, a linear model is statistically appropriate. Overfitting risk from complex models is high on small datasets.
- scikit-learn's API is stable, well-documented, and ships in a small Docker layer. No GPU dependency.
- Training on-the-fly (at prediction request time) is acceptable at this data scale (<100 rows per resource type) — p95 training time <200ms on a single CPU core.

**Feature engineering decisions**:
- Month-of-year encoded as sin/cos pair (circular encoding preserves seasonality across year boundary).
- Days-in-billing-period normalises bi-monthly vs monthly resource types.
- Lagged consumption values (last 3 periods) added as features.
- Price-per-unit computed from amount_paid / amount_consumed.

**Confidence interval**: Bootstrapped residual intervals (100 resamples) — no distributional assumption, works at small sample sizes.

**Minimum data requirement**: 3 bills. Below this threshold the model is statistically unreliable; a `409 Conflict` is returned explaining how many bills are still needed.

**Alternatives considered**:
- Prophet (Meta): designed for time-series forecasting but heavy dependency (~300MB), overkill for 3–24 data points.
- ARIMA: requires stationarity testing and parameter selection — complexity without benefit at this scale.

---

## 4. PDF Report Generation: Library and Template Strategy

**Decision**: WeasyPrint for HTML-to-PDF rendering; Jinja2 for the HTML template; Matplotlib (Agg backend) for chart SVGs embedded inline.

**Rationale**:
- WeasyPrint renders HTML/CSS to PDF server-side. No headless browser (Playwright/Puppeteer) required, which would add significant container size and startup time.
- Jinja2 is already in the FastAPI dependency chain (used by Starlette for optional templating). Zero extra dependency.
- Matplotlib with `Agg` backend produces vector SVG output that WeasyPrint can embed inline — sharp at any PDF viewer zoom level.

**Alternatives considered**:
- ReportLab: programmatic PDF generation; highly verbose for complex layouts. Not worth the added code complexity vs. an HTML template.
- Headless Chrome (Playwright): accurate CSS rendering but ~150MB Docker layer increase and cold-start latency of 2–3 s.

---

## 5. Authentication: Token Strategy

**Decision**: Short-lived JWT access tokens (HS256, 15 min) paired with long-lived opaque refresh tokens (64 random bytes, stored as SHA-256 hash, 30-day expiry, rotated on every use). Refresh token delivered as `HttpOnly; Secure; SameSite=Strict` cookie.

**Rationale**:
- In-memory access tokens (stored in Zustand, never in `localStorage`) are safe from XSS.
- `HttpOnly` cookie for refresh tokens is safe from JavaScript access.
- Token rotation on every refresh limits the replay window to the period between two refresh calls.
- bcrypt at cost factor ≥ 12 is the current industry standard for password hashing.

**Alternatives considered**:
- Session cookies only: server-side session state would require a session store (Redis or DB table), adding infrastructure complexity. JWT is stateless and sufficient for a single-user app.
- Access token in cookie: would expose the JWT to CSRF risk. In-memory + `HttpOnly` refresh cookie is the safer split.

---

## 6. Async Database Access

**Decision**: SQLAlchemy 2.x with `asyncpg` driver for all PostgreSQL access. `async_sessionmaker` for session management.

**Rationale**:
- FastAPI is fully async; using a sync ORM would block the event loop under I/O.
- SQLAlchemy 2.x async support is mature and production-ready.
- `asyncpg` is the fastest Python PostgreSQL driver.

**Connection pool settings (defaults)**: pool_size=5, max_overflow=10 — appropriate for single-user self-hosted deployment.

---

## 7. File Upload Handling

**Decision**: FastAPI's built-in `UploadFile` (backed by `python-multipart`). Files are validated for MIME type and size before any processing. Source files stored to a local volume path (configurable via `UPLOAD_DIR` env var).

**Rationale**:
- Local storage is sufficient for a single-user self-hosted app. S3 or object storage can be swapped in by replacing the storage backend (injected via dependency).
- File path stored in `Bill.source_file_path` column. Deletion of the file on bill soft-delete is handled asynchronously.

**Alternatives considered**:
- S3/MinIO from day 1: adds operational complexity with no benefit for the target single-user deployment.

---

## 8. Structured Logging and Error Format

**Decision**: `structlog` for JSON-formatted structured logs. RFC 7807 Problem Details (`application/problem+json`) for all HTTP error responses.

**Rationale**:
- `structlog` integrates cleanly with FastAPI's middleware and produces machine-parseable JSON logs suitable for forwarding to any log aggregator.
- RFC 7807 is the standard for HTTP APIs; it gives clients a consistent error envelope with `type`, `title`, `status`, `detail`, and `instance` fields.

---

## 9. Testing Stack

**Decision**: pytest + pytest-anyio (async test support) + pytest-mock + pytest-benchmark + httpx (async test client for FastAPI).

**Rationale**:
- `anyio` is the async backend used by Starlette/FastAPI; `pytest-anyio` integrates it into pytest without configuration friction.
- `httpx` `AsyncClient` is the recommended FastAPI test client for async routes.
- `pytest-benchmark` covers the analytics p95 performance gate (< 200ms for ≤ 100 bills).

**Test database strategy**: A separate PostgreSQL database (`resource_tracker_test`) is spun up via the `test` Docker Compose profile. Alembic migrations are applied once per test session; each test that mutates data runs in a transaction that is rolled back at teardown (no per-test truncation needed).

---

## 10. Frontend State and Data Flow

**Decision**: Zustand for auth state (access token in-memory only). TanStack Query v5 (React Query) for all server data. Single Axios instance with a response interceptor for silent token refresh.

**Rationale**:
- Zustand is minimal (< 2KB), has no boilerplate, and is sufficient for the single cross-cutting piece of global state (the access token + user profile).
- React Query handles caching, background refetch, loading and error states out of the box — eliminates manual `useEffect`/`useState` data fetching.
- The single Axios interceptor pattern ensures token refresh logic is defined exactly once and applies to every request transparently.

---

## Resolved Unknowns Summary

| Unknown | Resolution |
|---|---|
| PDF extraction library | PyMuPDF (embedded text) + pytesseract (OCR for images) |
| LLM structured output | OpenAI JSON schema mode (`gpt-4o-mini` default) |
| ML algorithm | LinearRegression baseline; GradientBoosting via env var |
| Confidence interval method | Bootstrapped residuals |
| PDF generation | WeasyPrint + Jinja2 + Matplotlib SVG |
| Auth token storage | JWT in Zustand memory + HttpOnly cookie for refresh |
| DB driver | asyncpg via SQLAlchemy 2.x async |
| File storage | Local volume (path configurable) |
| Logging / error format | structlog JSON + RFC 7807 |
| Test async backend | pytest-anyio + httpx AsyncClient |
