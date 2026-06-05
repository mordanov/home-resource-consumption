# GitHub Speckit Prompt — Resource Consumption Tracker

## Feature Title
**Home Resource Consumption Tracker with Bill Parsing & ML Forecasting**

---

## Meta / Toolchain Instructions

```
tools:
  implementation: brainstorm-mcp
  quality_gates:
    - selena-mcp
    - rigour-labs/mcp
```

---

## Feature Overview

Build a full-stack web application that ingests utility bills (electricity, water, gas), extracts structured consumption and payment data via LLM (OpenAI API), persists it to a relational database, and predicts future resource usage over 1–3 months via a dedicated ML service.

The system must be clean, maintainable, and extensible. All code must strictly follow **SOLID**, **DRY**, and **KISS** principles.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend (API + ML) | Python 3.12 |
| Frontend | React.js with HeroUI component library |
| Database | PostgreSQL |
| Reverse Proxy | Nginx |
| LLM | OpenAI API (GPT-4o or GPT-4o-mini) |
| Containerisation | Docker + Docker Compose |

---

## Domain Model

### Resource Types
- `ELECTRICITY` — billed **monthly**
- `GAS` — billed **bi-monthly**
- `WATER` — billed **bi-monthly**

### Core Entities

```
User
  id: UUID (PK)
  username: Varchar(64) UNIQUE NOT NULL
  email: Varchar(255) UNIQUE NOT NULL
  hashed_password: Varchar(255) NOT NULL   # bcrypt
  is_active: Boolean DEFAULT TRUE
  created_at: Timestamp
  updated_at: Timestamp

Bill
  id: UUID (PK)
  user_id: UUID (FK → User.id)             # all bills are user-scoped
  resource_type: Enum[ELECTRICITY, GAS, WATER]
  bill_date: Date                          # date printed on the bill
  period_start: Date
  period_end: Date
  amount_consumed: Decimal                 # in kWh / m³
  unit: Enum[KWH, CUBIC_METER]
  amount_paid: Decimal                     # in EUR or local currency
  currency: Char(3)
  raw_text: Text                           # original OCR / extracted text
  source_file_path: Text                   # S3 or local path to uploaded PDF/image
  created_at: Timestamp
  updated_at: Timestamp

Prediction
  id: UUID (PK)
  user_id: UUID (FK → User.id)
  resource_type: Enum[ELECTRICITY, GAS, WATER]
  generated_at: Timestamp
  horizon_months: Int                      # 1, 2, or 3
  predicted_consumption: Decimal
  predicted_cost: Decimal
  confidence_interval_lower: Decimal
  confidence_interval_upper: Decimal
  model_version: Varchar(64)

RefreshToken
  id: UUID (PK)
  user_id: UUID (FK → User.id)
  token_hash: Varchar(255) UNIQUE NOT NULL # SHA-256 of raw token
  expires_at: Timestamp
  revoked: Boolean DEFAULT FALSE
  created_at: Timestamp
```

---

## Architecture

### Services (Docker Compose)

```
┌─────────────────────────────────────────────────────┐
│                     Nginx (Reverse Proxy)            │
│   /api/  → backend:8000    /  → frontend:3000        │
└──────────────────┬─────────────────┬────────────────┘
                   │                 │
          ┌────────▼────────┐  ┌────▼──────────┐
          │  FastAPI Backend │  │ React Frontend │
          │  (port 8000)     │  │ (port 3000)    │
          └────────┬─────────┘  └───────────────┘
                   │
        ┌──────────┼────────────────┬──────────┐
        │          │                │          │
   ┌────▼───┐  ┌───▼───┐  ┌────────▼─┐  ┌────▼────┐
   │  Bill  │  │  LLM  │  │   Auth   │  │   ML    │
   │  CRUD  │  │ Parser│  │  Service │  │ Service │
   │Service │  │Service│  │(JWT+bcrypt) │(Sklearn)│
   └────┬───┘  └───────┘  └──────────┘  └─────────┘
        │
   ┌────▼──────┐
   │ PostgreSQL │
   │ (port 5432)│
   └────────────┘
```

### Backend Package Layout (`/backend/app/`)

```
app/
├── main.py                     # FastAPI app factory
├── core/
│   ├── config.py               # Pydantic Settings (env vars)
│   ├── database.py             # SQLAlchemy engine + session
│   ├── security.py             # JWT encode/decode, bcrypt hashing
│   └── exceptions.py           # Domain exceptions
├── domain/
│   ├── enums.py                # ResourceType, Unit, Currency
│   ├── models.py               # SQLAlchemy ORM models (User, Bill, Prediction, RefreshToken)
│   └── schemas.py              # Pydantic request/response schemas
├── repositories/
│   ├── base.py                 # Generic CRUD repository (SOLID: OCP)
│   ├── user_repository.py
│   ├── bill_repository.py
│   ├── prediction_repository.py
│   └── token_repository.py
├── services/
│   ├── auth_service.py         # Register, login, refresh, logout
│   ├── bill_service.py         # Orchestrate bill ingestion
│   ├── export_service.py       # PDF report generation (WeasyPrint)
│   ├── analytics_service.py    # Aggregations for analysis charts
│   ├── parser/
│   │   ├── base_parser.py      # Abstract base (SOLID: LSP)
│   │   ├── llm_parser.py       # OpenAI extraction
│   │   └── parser_factory.py   # Factory by resource type
│   └── ml/
│       ├── base_predictor.py   # Abstract predictor interface
│       ├── predictor.py        # Sklearn implementation
│       └── feature_engineering.py
├── api/
│   ├── deps.py                 # DI: get_db, get_current_user, get_bill_service, etc.
│   └── v1/
│       ├── router.py
│       ├── auth.py             # POST /auth/register, /auth/login, /auth/refresh, /auth/logout
│       ├── bills.py            # POST /bills/upload, GET /bills/
│       ├── predictions.py      # GET /predictions/{resource}/{months}
│       ├── analytics.py        # GET /analytics/...
│       └── exports.py          # GET /exports/report.pdf
└── workers/
    └── tasks.py                # Background tasks (bill processing)
```

---

## Feature Requirements

### FR-0 — User Authentication

**Strategy:** JWT access token (short-lived, 15 min) + refresh token (long-lived, 30 days, stored in DB and rotated on use). Passwords hashed with **bcrypt** (cost factor ≥ 12). No SSO, OAuth, or social login.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Create new user account |
| `POST` | `/api/v1/auth/login` | Return access + refresh token pair |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh token, issue new access token |
| `POST` | `/api/v1/auth/logout` | Revoke refresh token |
| `GET` | `/api/v1/auth/me` | Return current user profile |

**Register request:**
```json
{ "username": "alice", "email": "alice@example.com", "password": "StrongPass1!" }
```

**Login response:**
```json
{
  "access_token": "<JWT>",
  "token_type": "bearer",
  "expires_in": 900,
  "refresh_token": "<opaque-token>"
}
```

**Token mechanics:**
- Access token: signed JWT (HS256), payload `{ "sub": "<user_id>", "exp": ... }`.
- Refresh token: 64-byte cryptographically random string; stored as SHA-256 hash in `RefreshToken` table with expiry and revocation flag.
- Refresh token rotation: on each `/auth/refresh` call, the old token is revoked and a new pair is issued.
- All endpoints except `/auth/register` and `/auth/login` require `Authorization: Bearer <access_token>` header.
- All bill and prediction data is scoped to `current_user.id` — a user can never access another user's records.

**Password policy (validated via Pydantic):**
- Minimum 8 characters
- At least one uppercase, one lowercase, one digit

**Frontend flows:**
- Login page (`/login`) and Register page (`/register`) — public routes, redirect to dashboard if already authenticated.
- Access token stored in memory (React context / Zustand); refresh token stored in `HttpOnly` cookie (set by backend on login).
- Axios interceptor silently refreshes the access token on 401 responses before retrying the original request.
- On logout, call `/auth/logout`, clear in-memory token, and redirect to `/login`.

**Quality Gates:**
- Unit tests: register with duplicate username/email returns `409`; login with wrong password returns `401`; expired access token returns `401`.
- Security check (rigour-labs): passwords never logged; `hashed_password` field never serialised in any response schema.
- Selena check: `AuthService` does not import from `BillService` or any domain service (no coupling).

---

### FR-1 — Bill Upload & Parsing


**Endpoint:** `POST /api/v1/bills/upload`

- Accept `multipart/form-data` with:
  - `file`: PDF or image (JPEG/PNG)
  - `resource_type`: `ELECTRICITY | GAS | WATER`
- Extract text from the uploaded file (use PyMuPDF for PDFs, pytesseract for images).
- Pass extracted text to `LLMParserService` which calls OpenAI Chat Completions with a structured prompt.
- OpenAI must return a **strict JSON schema** (function-calling / structured output) containing:
  ```json
  {
    "period_start": "YYYY-MM-DD",
    "period_end": "YYYY-MM-DD",
    "bill_date": "YYYY-MM-DD",
    "amount_consumed": 0.0,
    "unit": "KWH | CUBIC_METER",
    "amount_paid": 0.0,
    "currency": "EUR"
  }
  ```
- Validate parsed data with Pydantic. On validation failure, return `422` with actionable error.
- Persist as `Bill` record scoped to `current_user.id`. Return full bill DTO.

**Quality Gate (Selena + rigour-labs):**
- Unit tests for `LLMParserService` must mock OpenAI and achieve ≥ 90% branch coverage.
- Integration test: upload a synthetic PDF and assert DB row created with correct values.
- Lint: no broad `except Exception` — only typed exception handlers.

---

### FR-2 — Bill Listing & Detail

**Endpoints:**
- `GET /api/v1/bills/` — paginated list, filterable by `resource_type` and date range.
- `GET /api/v1/bills/{id}` — single bill detail.
- `DELETE /api/v1/bills/{id}` — soft delete (set `deleted_at`).

**Query params for list:** `resource_type`, `date_from`, `date_to`, `page`, `size` (default 20).

---

### FR-3 — ML Prediction Service

**Endpoint:** `GET /api/v1/predictions/{resource_type}?horizon=1` (horizon: 1, 2, or 3)

**ML approach:**
- Use **scikit-learn** (`LinearRegression` as baseline, with a toggle for `GradientBoostingRegressor`).
- Features per resource:
  - Historical consumption values (last N bills)
  - Month-of-year (seasonality)
  - Days in billing period
  - Price-per-unit trend
- Minimum data requirement: at least **3 historical bills** per resource type. If insufficient, return `409` with a clear message indicating how many more bills are needed.
- Store predictions in `Prediction` table on every call (for audit trail).
- Return prediction + 90% confidence interval + model version.

**Model lifecycle:**
- Models are trained on-the-fly (no pre-training step needed at this scale).
- `ModelTrainer` and `ModelPredictor` are separate classes (SRP).

**Quality Gate:**
- Regression test: synthetic dataset with known trend must produce prediction within 15% of true value.
- Schema validation on prediction response via pydantic model.

---

### FR-4 — Frontend Dashboard

**Stack:** React 18 + HeroUI + React Query + Recharts + Zustand (auth state)

**Auth context:** Access token stored in Zustand store (in-memory only). Refresh token delivered as `HttpOnly` cookie by the backend. Axios instance has a response interceptor that retries with a refreshed token on `401`. All routes except `/login` and `/register` are wrapped in a `<ProtectedRoute>` component.

**Pages / Views:**

#### 4a. Login Page (`/login`) — public
- Username + password fields, "Sign in" button.
- Link to `/register`.
- Redirect to `/` on success.

#### 4b. Register Page (`/register`) — public
- Username, email, password, confirm-password fields.
- Client-side password policy feedback (strength indicator).
- Redirect to `/login` on success.

#### 4c. Dashboard (Home `/`)
- Summary cards per resource type: last bill amount, last bill date, trend arrow (↑↓).
- Line chart: consumption over time per resource (toggle between resources).
- "Upload Bill" CTA button.

#### 4d. Bill Upload Page (`/upload`)
- Drag-and-drop file upload zone (PDF/image).
- `resource_type` selector (Electricity / Gas / Water).
- Progress indicator while parsing.
- Preview parsed result before confirming save.
- Toast notification on success / error.

#### 4e. Bills History Page (`/bills`)
- Filterable data table: resource type, date range.
- Sortable columns: date, consumed, paid.
- Row click → bill detail modal.
- "Export PDF" button → opens export modal (FR-5).

#### 4f. Predictions Page (`/predictions`)
- Horizon selector: 1 month / 2 months / 3 months.
- Per-resource prediction card: predicted consumption, predicted cost, confidence range (visualised as error bars on chart).
- "Insufficient data" state with guidance.

#### 4g. Analysis Page (`/analysis`) — see FR-6
- Global date-range filter + resource type toggle.
- Six charts: consumption trend, monthly cost (stacked bar), price/unit trend, year-over-year comparison, cumulative cost YTD, consumption heatmap.
- Per-chart PNG export.
- "Export Full Report" PDF button.

---

### FR-5 — PDF Export

**Endpoint:** `GET /api/v1/exports/report.pdf`

**Query params:** `resource_type` (optional, omit for all), `date_from`, `date_to`.

**Library:** **WeasyPrint** — renders an HTML template to PDF server-side. No headless browser needed.

**Report structure (one PDF per request):**
1. Cover page — report title, user name, date range, generation timestamp.
2. Summary section — total spent and total consumed per resource type within the date range.
3. Per-resource section (one per selected resource type):
   - Consumption over time table (bill date, period, consumed, paid, price/unit).
   - Consumption trend chart (rendered as SVG, embedded inline — use Matplotlib with `Agg` backend, output as SVG string).
   - Latest ML predictions (1/2/3 month horizon) with confidence intervals.
4. Footer — page numbers, app name.

**Implementation notes:**
- `ExportService` accepts a `ReportSpec` dataclass (date range, resource filter, user) — pure data, no HTTP concerns (SRP).
- HTML template lives in `app/templates/report.html` (Jinja2). `ExportService` renders the template then calls WeasyPrint.
- Charts are generated as inline SVG strings by `ChartRenderer` (separate class, injected into `ExportService`).
- Endpoint streams the PDF bytes with `StreamingResponse`, `Content-Disposition: attachment; filename="report.pdf"`, `Content-Type: application/pdf`.
- Max report window: 24 months. If `date_from`/`date_to` span exceeds this, return `400`.

**Frontend:**
- "Export PDF" button on Analysis page and Bills History page.
- Opens a date-range picker modal; resource type multi-select (default: all).
- On submit, triggers a direct browser download (`<a href="..." download>`).

**Quality Gates:**
- Integration test: generate a report with 3 seeded bills and assert the response is `application/pdf` with non-zero bytes.
- Selena: `ExportService` has no direct dependency on `request` or `response` objects.

---

### FR-6 — Analysis Page

**Frontend route:** `/analysis`

This is a read-only analytical view. All data is fetched from dedicated analytics endpoints that return pre-aggregated data — the frontend never computes aggregates itself.

**Backend endpoint:** `GET /api/v1/analytics/summary`

Returns a single JSON payload:
```json
{
  "monthly_consumption": [
    { "month": "2024-01", "electricity": 320.5, "gas": 180.0, "water": 12.3 }
  ],
  "monthly_cost": [ ... same shape ... ],
  "price_per_unit": [
    { "month": "2024-01", "electricity": 0.28, "gas": 1.12, "water": 3.50 }
  ],
  "year_over_year": [
    { "resource": "ELECTRICITY", "current_year_total": 2100.0, "previous_year_total": 1950.0, "change_pct": 7.7 }
  ],
  "cumulative_cost_ytd": [
    { "month": "2024-01", "cumulative": 142.0 },
    ...
  ]
}
```

**Charts on the Analysis page (Recharts):**

| Chart | Type | Description |
|---|---|---|
| Consumption over time | Multi-line chart | One line per resource; X = month, Y = consumed units |
| Monthly cost | Stacked bar chart | One bar per month split by resource type |
| Price per unit trend | Line chart | Price/unit per resource over time (highlights tariff changes) |
| Year-over-year comparison | Grouped bar chart | Current vs previous year, per resource |
| Cumulative cost (YTD) | Area chart | Running total spend for the current calendar year |
| Consumption heatmap | Calendar heatmap | Colour-coded cells per month; intensity = consumption level (electricity default, resource toggle) |

**UX details:**
- Global date-range filter at the top of the page (defaults to last 12 months).
- Resource type toggle (chips/pills): show all, or filter to one resource.
- Each chart has a small "Export chart as PNG" icon button (uses `canvas.toBlob` via Recharts `ref`).
- "Export Full Report" button links to the PDF export flow (FR-5) pre-filled with the current filter state.
- Empty state per chart: friendly illustration + "Upload more bills to see this chart" if fewer than 2 data points.

**Quality Gates:**
- Unit test `AnalyticsService`: assert correct aggregation for a seeded dataset with 12 months of bills.
- Selena: analytics endpoint must return in < 200ms for up to 100 bills (benchmark with `pytest-benchmark`).

---

### FR-7 — Configuration & Environment


All secrets and config via environment variables (12-factor app). Required env vars:

```
DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/resource_tracker
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
MAX_UPLOAD_SIZE_MB=20
CORS_ORIGINS=http://localhost:3000

# Auth
JWT_SECRET_KEY=<256-bit random secret>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
```

---

## Non-Functional Requirements

| Concern | Requirement |
|---|---|
| API response time | p95 < 300ms for list/detail/analytics; parse endpoint < 15s (LLM latency acceptable) |
| Bill upload size | Max 20 MB |
| CORS | Locked to configured origins |
| Auth | JWT + bcrypt; refresh token rotation; all data user-scoped |
| PDF export | Max 24-month window; streamed response |
| DB migrations | Alembic, with `upgrade` run on startup |
| Logging | Structured JSON logs (structlog), request IDs |
| Error responses | RFC 7807 Problem Details format |

---

## SOLID / DRY / KISS Guardrails (for Brainstorm MCP)

1. **SRP** — Each class has one reason to change. `LLMParserService` parses only; `BillService` orchestrates only; `BillRepository` persists only; `AuthService` handles auth only; `ExportService` handles PDF rendering only; `AnalyticsService` handles aggregations only.
2. **OCP** — `BaseParser` is an abstract class; new resource-specific parsers extend it without modifying existing code.
3. **LSP** — Any `BasePredictor` subclass must be substitutable without altering callers.
4. **ISP** — Repository interfaces are granular: `ReadableBillRepository`, `WritableBillRepository` if needed.
5. **DIP** — Services depend on abstract interfaces injected via FastAPI `Depends()`. `ExportService` receives `AnalyticsService` and `ChartRenderer` via constructor injection.
6. **DRY** — No duplicated Pydantic schemas for request/response; use inheritance. No duplicated DB session logic. `current_user` dependency defined once in `deps.py`, reused across all protected routers.
7. **KISS** — Avoid premature abstraction. Start with `LinearRegression`; don't build a model registry until needed. WeasyPrint renders a Jinja2 template — no PDF DSL needed.

---

## Quality Gates (Selena MCP + rigour-labs/mcp)

### Selena MCP Gates
- [ ] All public functions have type annotations (mypy strict mode passes).
- [ ] No function exceeds 30 lines (refactor into helpers if needed).
- [ ] All API endpoints documented in OpenAPI with example request/response.
- [ ] No hardcoded secrets anywhere in source.
- [ ] `hashed_password` field absent from all Pydantic response schemas.
- [ ] `AuthService` has zero imports from `BillService`, `ExportService`, or `AnalyticsService`.

### rigour-labs/mcp Gates
- [ ] Test coverage ≥ 85% overall; ≥ 90% for `services/` layer.
- [ ] All DB queries use parameterised statements (SQL injection check).
- [ ] `ruff` linter passes with zero warnings.
- [ ] Docker build succeeds with `--no-cache`.
- [ ] `alembic upgrade head` runs cleanly against a fresh DB.
- [ ] Integration test suite passes against a local Docker Compose stack.
- [ ] Auth security: brute-force test — 10 rapid wrong-password requests must all return `401` (no 500s, no DB errors).
- [ ] PDF export integration test: response is valid PDF (`%PDF` magic bytes present, non-zero length).

---

## Acceptance Criteria

```gherkin
Feature: User Authentication

  Scenario: Successful registration and login
    Given I register with username "alice", email "alice@example.com", password "StrongPass1!"
    When I POST to /auth/login with the same credentials
    Then the response contains an access_token and a refresh_token
    And the HTTP status is 200

  Scenario: Login with wrong password
    Given user "alice" exists
    When I POST to /auth/login with an incorrect password
    Then the HTTP status is 401
    And the response body contains no token fields

  Scenario: Token refresh rotation
    Given I have a valid refresh_token
    When I POST to /auth/refresh
    Then I receive a new access_token and a new refresh_token
    And the old refresh_token is revoked in the database

  Scenario: Data isolation between users
    Given user "alice" and user "bob" both have bills
    When "alice" calls GET /bills/
    Then she only sees her own bills, never bob's

Feature: Bill Upload and Parsing

  Scenario: Successful electricity bill upload
    Given I am authenticated as "alice"
    And I upload a valid electricity bill PDF
    When the system parses the bill using LLM
    Then a Bill record is created with correct period_start, period_end, amount_consumed and amount_paid
    And the bill is scoped to alice's user_id
    And the API returns HTTP 201 with the bill data

  Scenario: Insufficient data for prediction
    Given fewer than 3 electricity bills exist for the current user
    When I request a 1-month prediction for electricity
    Then the API returns HTTP 409
    And the response body explains how many more bills are required

  Scenario: ML prediction within acceptable range
    Given at least 6 monthly electricity bills with a clear upward trend
    When I request a 1-month prediction
    Then the predicted consumption is within 20% of the extrapolated trend value

Feature: PDF Export

  Scenario: Export full report for all resources
    Given I have at least 1 bill per resource type within the last 12 months
    When I GET /exports/report.pdf with no resource_type filter
    Then the response Content-Type is application/pdf
    And the response body starts with the PDF magic bytes %PDF
    And Content-Disposition is attachment

  Scenario: Export date range exceeds maximum
    When I request an export spanning more than 24 months
    Then the API returns HTTP 400 with a descriptive error

Feature: Analysis Page

  Scenario: Analytics endpoint returns aggregated data
    Given I have 12 months of electricity bills
    When I GET /analytics/summary
    Then monthly_consumption contains 12 entries for electricity
    And year_over_year contains a change_pct value for electricity
```

---

## Out of Scope (v1)

- SSO / OAuth / social login
- Email/push notifications
- Mobile responsive optimisation (desktop-first is acceptable)
- Real-time WebSocket updates
- CSV export
- Multi-tenancy / admin panel

---

## Suggested Implementation Order (for Brainstorm MCP)

1. Docker Compose scaffold + Postgres + Nginx config
2. FastAPI app factory + Alembic migrations + domain models (User, Bill, Prediction, RefreshToken)
3. `AuthService` + `/auth/*` endpoints + JWT middleware + unit tests
4. `get_current_user` dependency + protect all subsequent routes
5. `BillRepository` + `BillService` (CRUD only, no parsing)
6. `LLMParserService` + OpenAI integration + unit tests
7. `POST /bills/upload` endpoint end-to-end
8. ML feature engineering + `LinearRegression` predictor + `/predictions/{resource}` endpoint
9. `AnalyticsService` + `GET /analytics/summary` endpoint
10. `ChartRenderer` (Matplotlib SVG) + `ExportService` (WeasyPrint) + `/exports/report.pdf` endpoint
11. React frontend scaffold (React Query + HeroUI + Axios interceptor for token refresh)
12. Login / Register pages + auth context
13. Dashboard + Upload + Bills History pages
14. Predictions page
15. Analysis page (all 6 charts)
16. PDF export flow (date picker modal + browser download)
17. Quality gates pass (Selena + rigour-labs) → PR ready

