# Tasks: Home Resource Consumption Tracker

**Input**: Design documents from `specs/001-resource-consumption-tracker/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.md ✓

## Agent Labels

Tasks include an agent role label so `run-agents.sh` agents can filter their work:

- `[DEVOPS]` — Docker, Nginx, CI/CD, environment, migrations-on-startup
- `[BACKEND]` — FastAPI, services, repositories, domain models, Alembic migrations
- `[FRONTEND]` — React pages, components, Zustand, React Query, Axios
- `[DESIGNER]` — Interaction state specs, accessibility checklist (must precede frontend phases)
- `[SECURITY]` — Auth security hardening, threat checks, gate validation
- `[TESTER]` — Unit tests, integration tests, quality-gate tests
- `[ARCHITECT]` — ADRs, interface contracts review, cross-cutting decisions
- `[REVIEWER]` — Code review checkpoints

## Format: `[ID] [P?] [Story?] [AGENT] Description → file path`

- **[P]**: Can run in parallel (no dependency on an incomplete sibling task)
- **[Story]**: Which user story (US1–US6); omit in Setup and Foundation phases
- **[AGENT]**: Which `run-agents.sh` agent owns this task

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project skeleton, Docker Compose, environment, Nginx — must complete before any agent touches application code.

- [ ] T001 [DEVOPS] Create repository root directory structure: `backend/`, `frontend/`, `nginx/`, `.env.example` → `/`
- [ ] T002 [DEVOPS] Write `docker-compose.yml` with services `db` (postgres:16), `backend` (port 8000), `frontend` (port 3000), `nginx` (port 80); add health-checks for `db` (pg_isready) and `backend` (GET `/api/v1/health`); backend/frontend declare `depends_on: db: condition: service_healthy` → `docker-compose.yml`
- [ ] T003 [DEVOPS] Write `docker-compose.test.yml` (`test` profile) with isolated `db-test` PostgreSQL service for integration and quality-gate tests → `docker-compose.test.yml`
- [ ] T004 [DEVOPS] Write Nginx config: proxy `/api/` → `backend:8000`, `/` → `frontend:3000`; set `proxy_buffering off` and `proxy_read_timeout 60s` on `/api/v1/exports/` for streaming PDF; set `proxy_read_timeout 30s` on `/api/v1/bills/upload` for LLM latency → `nginx/nginx.conf`
- [ ] T005 [DEVOPS] Write `.env.example` with all required env vars (`DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `MAX_UPLOAD_SIZE_MB`, `CORS_ORIGINS`, `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `UPLOAD_DIR`) with safe placeholder values and generation hint for `JWT_SECRET_KEY` → `.env.example`
- [ ] T006 [DEVOPS] Write `backend/Dockerfile`: `python:3.12-slim` base, install system deps (`tesseract-ocr`, `libmagic1`, `libpango-1.0-0`, `libcairo2` for WeasyPrint), copy `pyproject.toml`, `pip install`, copy `app/`, set entrypoint to run `alembic upgrade head && uvicorn app.main:app` → `backend/Dockerfile`
- [ ] T007 [DEVOPS] Write `frontend/Dockerfile`: `node:20-alpine` build stage + `nginx:alpine` serve stage; `npm ci && npm run build`; serve `dist/` → `frontend/Dockerfile`
- [ ] T008 [BACKEND] Initialise Python project: `pyproject.toml` with `[project]` metadata, `[tool.ruff]`, `[tool.mypy]` (`strict = true`), `[tool.pytest.ini_options]` (`asyncio_mode = "auto"`, `testpaths = ["tests"]`); pin all dependencies from plan.md research → `backend/pyproject.toml`

**Checkpoint**: `docker compose build` completes without error. Directory structure matches plan.md.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend infrastructure that ALL user story agents depend on. No user story work begins until this phase is complete.

**⚠️ CRITICAL**: This phase BLOCKS all backend and frontend user story tasks.

- [ ] T009 [BACKEND] Create `backend/app/core/config.py`: `pydantic-settings` `Settings` class loading all env vars; expose singleton `settings` instance → `backend/app/core/config.py`
- [ ] T010 [BACKEND] Create `backend/app/core/database.py`: async SQLAlchemy engine (`asyncpg`), `async_sessionmaker`, `get_db` async generator dependency; pool_size=5, max_overflow=10 → `backend/app/core/database.py`
- [ ] T011 [BACKEND] Create `backend/app/core/exceptions.py`: typed domain exceptions — `ResourceNotFoundError`, `ConflictError`, `UnauthorizedError`, `ForbiddenError`, `InsufficientDataError`, `FileTooLargeError`, `ParseError`, `DateRangeExceededError` → `backend/app/core/exceptions.py`
- [ ] T012 [BACKEND] Create `backend/app/core/security.py`: `hash_password(plain: str) -> str` (bcrypt cost ≥ 12), `verify_password(plain, hashed) -> bool`, `create_access_token(user_id: UUID) -> str` (JWT HS256, 15 min), `decode_access_token(token: str) -> UUID`, `generate_refresh_token() -> str` (64-byte secrets.token_urlsafe), `hash_refresh_token(raw: str) -> str` (SHA-256) → `backend/app/core/security.py`
- [ ] T013 [BACKEND] Create `backend/app/domain/enums.py`: `ResourceType(str, Enum)` with ELECTRICITY/GAS/WATER; `Unit(str, Enum)` with KWH/CUBIC_METER → `backend/app/domain/enums.py`
- [ ] T014 [BACKEND] Create `backend/app/domain/models.py`: SQLAlchemy ORM models `User`, `Bill` (with `deleted_at: TIMESTAMPTZ NULLABLE`), `Prediction`, `RefreshToken`; all PKs `UUID` default `uuid4`; all tables have `created_at` / `updated_at` `TIMESTAMPTZ` with `onupdate`; monetary/consumption fields `NUMERIC(12,4)` → `backend/app/domain/models.py`
- [ ] T015 [BACKEND] Create `backend/app/domain/schemas.py`: Pydantic v2 schemas with inheritance hierarchy — `UserBase → UserCreate (+ password) → UserRead (no hashed_password)`; `BillBase → BillCreate → BillRead → BillPreview`; `PredictionRead`; `TokenResponse`; `PaginatedResponse[T]`; RFC 7807 `ProblemDetail` → `backend/app/domain/schemas.py`
- [ ] T016 [BACKEND] Create `backend/app/repositories/base.py`: generic async CRUD base `BaseRepository[ModelT]` with `get_by_id(id, user_id) -> ModelT | None`, `list(user_id, **filters) -> list[ModelT]`, `create(obj) -> ModelT`, `update(obj) -> ModelT`, `soft_delete(id, user_id) -> None`; all methods accept `user_id` and scope queries by it → `backend/app/repositories/base.py`
- [ ] T017 [BACKEND] Create `backend/app/main.py`: FastAPI app factory with lifespan (run `alembic upgrade head` on startup); register `/api/v1` router; add CORS middleware (origins from `settings.CORS_ORIGINS`); add `structlog` JSON logging middleware with request-id injection; add RFC 7807 exception handlers for each domain exception type; add `GET /api/v1/health` returning `{"status": "ok"}` → `backend/app/main.py`
- [ ] T018 [DEVOPS] Create Alembic environment: `alembic init backend/alembic`; configure `env.py` to use async SQLAlchemy engine and import all ORM models; write initial migration `20260605_initial_schema.py` creating all four tables (`users`, `bills`, `predictions`, `refresh_tokens`) with correct column types and indexes; include `downgrade()` → `backend/alembic/`
- [ ] T019 [ARCHITECT] Write ADR-001 (JWT + refresh token rotation over session cookies), ADR-002 (WeasyPrint over headless browser), ADR-003 (PyMuPDF + pytesseract over cloud OCR), ADR-004 (scikit-learn LinearRegression as ML baseline), ADR-005 (on-the-fly model training vs pre-trained serving) → `backend/docs/adr/`

**Checkpoint**: `alembic upgrade head` succeeds against a fresh `db` container. `GET /api/v1/health` returns 200.

---

## Phase 2b: UX Design (Blocking Prerequisites for all Frontend Phases)

**Purpose**: Interaction state specs and accessibility checklist for all seven pages. The Designer agent produces these artifacts before frontend implementation of each page begins. Backend work in Phase 3 can proceed in parallel.

**⚠️ CRITICAL**: No frontend page implementation may begin until the corresponding component-behavior and accessibility guidance for that page is complete.

- [ ] T019b [DESIGNER] Produce interaction state specs for auth pages in `docs/ux/component-behavior.md`: Login form (field validation timing, submit-loading state, error display), Register form (password strength indicator states, confirm-password match feedback, submit-loading state); specify HeroUI component variants and disabled/error/focus states for each control → `frontend/docs/ux/component-behavior.md`
- [ ] T019c [P] [DESIGNER] Produce interaction state specs for Upload page in `docs/ux/component-behavior.md`: drag-and-drop zone (idle / drag-over / file-accepted / file-rejected states), upload+parse progress indicator (spinner with estimated time message), parsed-data preview card (field layout, editable vs read-only), confirm/discard button states → `frontend/docs/ux/component-behavior.md`
- [ ] T019d [P] [DESIGNER] Produce interaction state specs for Bills, Predictions, Analysis, and Export in `docs/ux/component-behavior.md`: bill table filter chips + date pickers (applied vs cleared state), bill detail modal open/close/delete-confirm flow, prediction card variants (loading / data / insufficient-data), chart legend toggle behavior, per-chart PNG export button placement, export modal date-range validation feedback (>24 month error inline) → `frontend/docs/ux/component-behavior.md`
- [ ] T019e [DESIGNER] Produce `docs/ux/accessibility-checklist.md`: route-by-route checklist covering keyboard tab order and focus management for all interactive controls; visible focus ring specification; ARIA labels for file input, resource-type selector, chart toggle controls, and confidence-interval display; non-color trend indicators (arrow + label, not color alone); error messages tied to input fields (not just toasts); color contrast targets for chart data series and text → `frontend/docs/ux/accessibility-checklist.md`

**Checkpoint**: `docs/ux/component-behavior.md` and `docs/ux/accessibility-checklist.md` exist and cover all seven pages. Frontend phases T028–T077 may now proceed.

---

## Phase 3: User Story 1 — Secure Account Access (Priority: P1) 🎯 MVP

**Goal**: Full authentication cycle — register, login, token refresh, logout, profile retrieval; frontend login/register pages; all other routes protected.

**Independent Test**: Register a new user, log in, call `GET /auth/me`, refresh the token, log out, confirm the refresh token is revoked in DB.

### Backend — US1

- [ ] T020 [US1] [BACKEND] Create `backend/app/repositories/user_repository.py`: `UserRepository` extending `BaseRepository[User]` with `get_by_username(username) -> User | None`, `get_by_email(email) -> User | None`; no `user_id` filter on these two methods (pre-auth lookups) → `backend/app/repositories/user_repository.py`
- [ ] T021 [US1] [BACKEND] Create `backend/app/repositories/token_repository.py`: `TokenRepository` with `create(user_id, token_hash, expires_at) -> RefreshToken`, `get_valid(token_hash) -> RefreshToken | None` (where `revoked=False AND expires_at > NOW()`), `revoke(token_hash) -> None` → `backend/app/repositories/token_repository.py`
- [ ] T022 [US1] [BACKEND] Create `backend/app/services/auth_service.py`: `AuthService` with `register(username, email, password) -> UserRead` (check duplicate username/email → raise `ConflictError`; hash password; persist User), `login(username, password) -> tuple[str, str]` (verify credentials → raise `UnauthorizedError`; create access+refresh token pair; store refresh token hash), `refresh(raw_refresh_token) -> tuple[str, str]` (verify token; atomically revoke old token; issue new pair), `logout(raw_refresh_token) -> None`; imports ONLY from `auth` domain — zero imports from `BillService`, `AnalyticsService`, `ExportService` → `backend/app/services/auth_service.py`
- [ ] T023 [US1] [BACKEND] Create `backend/app/api/deps.py`: `get_db` session dependency; `get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)) -> User` (decode JWT, load user, raise 401 if invalid); `get_auth_service`, `get_bill_service`, `get_prediction_service`, `get_analytics_service`, `get_export_service` factory dependencies → `backend/app/api/deps.py`
- [ ] T024 [US1] [BACKEND] Create `backend/app/api/v1/auth.py`: `POST /auth/register` (201, UserRead), `POST /auth/login` (200, TokenResponse + Set-Cookie HttpOnly refresh_token), `POST /auth/refresh` (200, TokenResponse, reads refresh_token cookie), `POST /auth/logout` (204, revokes cookie), `GET /auth/me` (200, UserRead); all endpoints have OpenAPI `summary`, `description`, response examples → `backend/app/api/v1/auth.py`
- [ ] T025 [US1] [SECURITY] Validate auth endpoint security: `hashed_password` absent from all response schemas (grep `UserRead` and all its parents); refresh token cookie flags (`HttpOnly; Secure; SameSite=Strict`) set in `/auth/login` and `/auth/refresh`; JWT payload contains only `sub` and `exp`; `AuthService` has zero cross-service imports → `backend/app/services/auth_service.py` + `backend/app/domain/schemas.py`

### Tests — US1

- [ ] T026 [P] [US1] [TESTER] Write unit tests for `AuthService`: register with duplicate username → 409; register with duplicate email → 409; login with wrong password → 401; expired access token decoded → raises exception; refresh token rotation revokes old token; `hashed_password` never returned from `register` or `login` → `backend/tests/unit/test_auth_service.py`
- [ ] T027 [P] [US1] [TESTER] Write integration tests for auth endpoints: full register → login → GET /auth/me → refresh → logout cycle; brute-force quality gate (10 wrong-password POST requests all return 401, no 500) → `backend/tests/integration/test_auth_endpoints.py` + `backend/tests/quality/test_auth_security.py`

### Frontend — US1

- [ ] T028 [P] [US1] [FRONTEND] Scaffold React project: `npm create vite@latest frontend -- --template react-ts`; install HeroUI, TanStack Query v5, Zustand, Axios, Recharts, React Router v6; configure `tsconfig.json` with `strict: true`; set up Vite proxy to backend for dev → `frontend/`
- [ ] T029 [US1] [FRONTEND] Create `frontend/src/lib/queryKeys.ts`: export all React Query key constants used across the app (auth, bills, predictions, analytics) → `frontend/src/lib/queryKeys.ts`
- [ ] T030 [US1] [FRONTEND] Create `frontend/src/lib/axios.ts`: configured Axios instance with `baseURL=/api/v1`; single response interceptor — on 401: call `POST /auth/refresh` (cookie sent automatically), update Zustand store with new access token, retry original request; if refresh 401 → clear auth state + redirect to `/login`; single in-flight refresh promise to prevent concurrent refresh storms → `frontend/src/lib/axios.ts`
- [ ] T031 [US1] [FRONTEND] Create `frontend/src/store/authStore.ts`: Zustand store with `{ accessToken: string | null, user: UserRead | null, setTokens(token, user): void, clearAuth(): void }`; access token stored in-memory ONLY — no localStorage, no sessionStorage → `frontend/src/store/authStore.ts`
- [ ] T032 [US1] [FRONTEND] Create `frontend/src/components/ProtectedRoute.tsx`: redirects to `/login` if `authStore.accessToken` is null; otherwise renders `<Outlet />` → `frontend/src/components/ProtectedRoute.tsx`
- [ ] T033 [US1] [FRONTEND] Create `frontend/src/App.tsx`: React Router v6 routes tree — public: `/login`, `/register`; protected (wrapped in `<ProtectedRoute>`): `/`, `/upload`, `/bills`, `/predictions`, `/analysis`; wrap in `QueryClientProvider` and HeroUI `<NextUIProvider>` → `frontend/src/App.tsx`
- [ ] T034 [US1] [FRONTEND] Create `frontend/src/pages/LoginPage.tsx`: username + password fields (HeroUI `<Input>`); "Sign in" button; link to `/register`; on submit call `POST /auth/login`; store access token in Zustand; redirect to `/`; show HeroUI toast on error using RFC 7807 `detail` field → `frontend/src/pages/LoginPage.tsx`
- [ ] T035 [US1] [FRONTEND] Create `frontend/src/pages/RegisterPage.tsx`: username, email, password, confirm-password fields; client-side password strength indicator (≥ 8 chars, uppercase, lowercase, digit); on submit call `POST /auth/register`; redirect to `/login` on success; show toast on error → `frontend/src/pages/RegisterPage.tsx`
- [ ] T036 [US1] [FRONTEND] Create `frontend/src/components/Layout.tsx`: navbar with app title, navigation links (Dashboard, Bills, Predictions, Analysis), logout button (calls `POST /auth/logout`, clears Zustand, redirects to `/login`); wraps all protected pages via `<Outlet />` → `frontend/src/components/Layout.tsx`

**Checkpoint**: Register → Login → Dashboard redirect → Logout flow works end-to-end. All routes redirect unauthenticated users to `/login`.

---

## Phase 4: User Story 2 — Upload and Parse a Utility Bill (Priority: P1)

**Goal**: Upload a PDF or image bill, LLM extracts structured fields, user reviews preview and confirms to save; data isolated by user.

**Independent Test**: Upload a sample electricity PDF, confirm the preview shows correct period/consumption/amount, confirm save, verify bill appears in `GET /bills/` scoped to the uploading user only.

### Backend — US2

- [ ] T037 [US2] [BACKEND] Create `backend/app/repositories/bill_repository.py`: `BillRepository` extending `BaseRepository[Bill]` with all queries filtering `WHERE deleted_at IS NULL AND user_id = :user_id`; `list_paginated(user_id, resource_type?, date_from?, date_to?, page, size) -> tuple[list[Bill], int]`; `soft_delete(id, user_id)` sets `deleted_at = NOW()` → `backend/app/repositories/bill_repository.py`
- [ ] T038 [US2] [BACKEND] Create `backend/app/services/parser/base_parser.py`: abstract `BaseParser` with `async def parse(text: str) -> BillPreview` (abstract); all concrete parsers must implement this method → `backend/app/services/parser/base_parser.py`
- [ ] T039 [US2] [BACKEND] Create `backend/app/services/parser/llm_parser.py`: `LLMParserService(BaseParser)` — calls OpenAI Chat Completions with `response_format={"type": "json_schema", "json_schema": {...}}` matching `BillPreview` schema; system prompt describes field semantics; temperature=0; validates response with Pydantic; raises `ParseError` on schema mismatch; all functions ≤ 30 lines → `backend/app/services/parser/llm_parser.py`
- [ ] T040 [US2] [BACKEND] Create `backend/app/services/parser/parser_factory.py`: `ParserFactory.get(resource_type: ResourceType) -> BaseParser`; currently returns `LLMParserService` for all types; designed for extension without modifying existing code (OCP) → `backend/app/services/parser/parser_factory.py`
- [ ] T041 [US2] [BACKEND] Create `backend/app/services/bill_service.py`: `BillService` with `upload_and_parse(file: UploadFile, resource_type, user_id) -> BillPreview` (validate MIME type + size; extract text via PyMuPDF for PDF or pytesseract for image; call parser factory; return preview — do NOT persist), `confirm(preview: BillPreview, user_id) -> BillRead` (validate with Pydantic; persist via `BillRepository`; save file to `UPLOAD_DIR`); injected `BillRepository` and `ParserFactory` → `backend/app/services/bill_service.py`
- [ ] T042 [US2] [BACKEND] Create `backend/app/api/v1/bills.py`: `POST /bills/upload` (multipart/form-data: file + resource_type → 200 BillPreview or 413/422); `POST /bills/confirm` (JSON BillPreview body → 201 BillRead); `GET /bills/` (paginated + filtered → 200 PaginatedResponse[BillRead]); `GET /bills/{id}` (→ 200 BillRead or 404); `DELETE /bills/{id}` (→ 204 or 404); all endpoints protected via `get_current_user`; all have OpenAPI docs → `backend/app/api/v1/bills.py`
- [ ] T043 [US2] [BACKEND] Create `backend/app/workers/tasks.py`: background task `cleanup_uploaded_file(file_path: str)` — delete file from `UPLOAD_DIR` when a bill is soft-deleted; triggered from `DELETE /bills/{id}` as a FastAPI `BackgroundTask` → `backend/app/workers/tasks.py`

### Tests — US2

- [ ] T044 [P] [US2] [TESTER] Write unit tests for `LLMParserService` (mock OpenAI): valid response → returns correct `BillPreview`; malformed JSON response → raises `ParseError`; missing required field → raises `ParseError`; achieve ≥ 90% branch coverage on `llm_parser.py` → `backend/tests/unit/test_llm_parser.py`
- [ ] T045 [P] [US2] [TESTER] Write integration test for bill upload: upload synthetic PDF (created in fixture) → assert 200 BillPreview with correct fields; call confirm → assert 201 BillRead; call `GET /bills/` as same user → bill present; call `GET /bills/` as different user → bill absent (data isolation) → `backend/tests/integration/test_bill_endpoints.py`

### Frontend — US2

- [ ] T046 [US2] [FRONTEND] Create `frontend/src/components/UploadZone.tsx`: HeroUI drag-and-drop file input accepting PDF/JPEG/PNG; shows file name and size on selection; `resource_type` selector (HeroUI `<Select>`); "Upload & Parse" button disabled during processing; progress spinner while awaiting parse response → `frontend/src/components/UploadZone.tsx`
- [ ] T047 [US2] [FRONTEND] Create `frontend/src/pages/UploadPage.tsx`: renders `<UploadZone>`; on parse success displays `BillPreview` fields (period, consumption, amount paid) in a review card; "Confirm & Save" button calls `POST /bills/confirm`; React Query `useMutation` with `onError` → HeroUI toast with RFC 7807 `detail`; on success → toast + navigate to `/bills` → `frontend/src/pages/UploadPage.tsx`

**Checkpoint**: Upload a real or synthetic PDF, review parsed preview, confirm save, verify bill in history. A second user cannot see the first user's bills.

---

## Phase 5: User Story 3 — Browse and Manage Bill History (Priority: P2)

**Goal**: Paginated, filterable bill table; bill detail modal; soft-delete from UI.

**Independent Test**: Seed 10 bills across resource types and date ranges; filter by "Gas"; verify only gas bills shown; click a row to open detail; delete one bill; verify it disappears from list.

### Backend — US3 (endpoints already created in T042; this phase adds remaining gaps)

- [ ] T048 [US3] [BACKEND] Verify `BillRepository.list_paginated` handles all filter combinations: no filters, resource_type only, date range only, both; add `order_by bill_date DESC` → `backend/app/repositories/bill_repository.py`

### Frontend — US3

- [ ] T049 [P] [US3] [FRONTEND] Create `frontend/src/components/BillTable.tsx`: HeroUI `<Table>` with columns (date, resource type, period, consumed, paid, currency); sortable on date/consumed/paid; row click emits `onRowClick(bill)` callback; pagination controls (page/size) using React Query `keepPreviousData` → `frontend/src/components/BillTable.tsx`
- [ ] T050 [US3] [FRONTEND] Create `frontend/src/pages/BillsPage.tsx`: resource type filter chips + date-range pickers; renders `<BillTable>` with React Query fetching `GET /bills/`; "Export PDF" button opens `<ExportModal>` (built in US6 — use disabled placeholder for now); React Query `useMutation` for delete with confirmation dialog; `onError` → HeroUI toast; empty state: "No bills found. Upload your first bill." with CTA → `frontend/src/pages/BillsPage.tsx`
- [ ] T051 [US3] [FRONTEND] Create bill detail modal component `frontend/src/components/BillDetailModal.tsx`: HeroUI `<Modal>` showing all `BillRead` fields; "Delete" button triggers delete mutation with confirm dialog → `frontend/src/components/BillDetailModal.tsx`

**Checkpoint**: Bills page loads, filters work, detail modal opens, delete removes the row.

---

## Phase 6: User Story 4 — View Consumption Forecasts (Priority: P2)

**Goal**: Per-resource ML predictions for 1/2/3 month horizons with confidence intervals; clear error when data insufficient.

**Independent Test**: Seed ≥ 3 electricity bills; call `GET /predictions/ELECTRICITY?horizon=1`; assert response includes `predicted_consumption`, `predicted_cost`, `confidence_interval_lower`, `confidence_interval_upper`, `model_version`; seed 1 gas bill and call gas prediction → assert 409 with `bills_needed` in body.

### Backend — US4

- [ ] T052 [US4] [BACKEND] Create `backend/app/services/ml/base_predictor.py`: abstract `BasePredictor` with `def fit(bills: list[Bill]) -> None` (abstract) and `def predict(horizon_months: int) -> PredictionResult` (abstract); `PredictionResult` dataclass with central estimate, cost, lower/upper CI, model_version → `backend/app/services/ml/base_predictor.py`
- [ ] T053 [US4] [BACKEND] Create `backend/app/services/ml/feature_engineering.py`: `build_features(bills: list[Bill]) -> pd.DataFrame` — lag features (last 3 periods), sin/cos month encoding (circular seasonality), days-in-billing-period, price-per-unit column → `backend/app/services/ml/feature_engineering.py`
- [ ] T054 [US4] [BACKEND] Create `backend/app/services/ml/predictor.py`: `LinearRegressionPredictor(BasePredictor)` — `ModelTrainer` inner class fits `LinearRegression`; `ModelPredictor` inner class generates predictions with bootstrapped residual 90% CI (100 resamples); `model_version = "linear_regression_v1"`; minimum 3 bills enforced before fit; all methods ≤ 30 lines → `backend/app/services/ml/predictor.py`
- [ ] T055 [US4] [BACKEND] Create `backend/app/repositories/prediction_repository.py`: `PredictionRepository` with `create(prediction) -> Prediction`, `list_latest(user_id, resource_type) -> list[Prediction]` → `backend/app/repositories/prediction_repository.py`
- [ ] T056 [US4] [BACKEND] Create `backend/app/api/v1/predictions.py`: `GET /predictions/{resource_type}?horizon=1` — load user's bills for resource type; if < 3 raise `InsufficientDataError(needed=3 - count)`; fit predictor; store `Prediction` record; return `PredictionRead`; RFC 7807 error on insufficient data includes `bills_needed` count in `detail` → `backend/app/api/v1/predictions.py`

### Tests — US4

- [ ] T057 [P] [US4] [TESTER] Write unit tests for `LinearRegressionPredictor`: synthetic dataset with known upward trend must produce prediction within 15% of true value; confidence interval lower ≤ prediction ≤ upper; fewer than 3 bills raises error → `backend/tests/unit/test_predictor.py`

### Frontend — US4

- [ ] T058 [P] [US4] [FRONTEND] Create `frontend/src/components/PredictionCard.tsx`: HeroUI card showing resource type, predicted consumption + unit, predicted cost + currency, confidence range displayed as a text range (e.g., "270–320 kWh"); model version in small footer text; "Insufficient data" variant with guidance message and bill count needed → `frontend/src/components/PredictionCard.tsx`
- [ ] T059 [US4] [FRONTEND] Create `frontend/src/pages/PredictionsPage.tsx`: horizon selector (HeroUI `<Tabs>` or `<Select>`: 1 / 2 / 3 months); renders three `<PredictionCard>` components (one per resource type) fetching `GET /predictions/{resource_type}?horizon=N` in parallel via React Query; handles 409 → "Insufficient data" state with bill count from error detail; loading skeletons per card → `frontend/src/pages/PredictionsPage.tsx`

**Checkpoint**: Predictions page shows correct cards for resources with ≥ 3 bills; shows guidance for resources with fewer.

---

## Phase 7: User Story 5 — Analyse Consumption Trends (Priority: P3)

**Goal**: Six analytics charts pre-aggregated server-side; global date-range and resource type filters; per-chart PNG export; empty states.

**Independent Test**: Seed 12 months of electricity + gas + water bills; call `GET /analytics/summary`; assert all five data arrays populated with correct shapes and values; verify `year_over_year.change_pct` is correct for a known dataset.

### Backend — US5

- [ ] T060 [US5] [BACKEND] Create `backend/app/services/analytics_service.py`: `AnalyticsService` with single `get_summary(user_id, date_from, date_to, resource_type?) -> AnalyticsSummary` method; use SQLAlchemy `text()` with bound parameters for aggregations: `monthly_consumption` (GROUP BY month + resource_type), `monthly_cost` (same), `price_per_unit` (SUM(paid)/SUM(consumed) per month), `year_over_year` (two CTEs), `cumulative_cost_ytd` (window SUM); no aggregation logic in the HTTP layer → `backend/app/services/analytics_service.py`
- [ ] T061 [US5] [BACKEND] Create `backend/app/api/v1/analytics.py`: `GET /analytics/summary?date_from&date_to&resource_type` → 200 `AnalyticsSummary` JSON; default date range = last 12 months; OpenAPI docs with example response → `backend/app/api/v1/analytics.py`

### Tests — US5

- [ ] T062 [P] [US5] [TESTER] Write unit tests for `AnalyticsService`: seed 12 months of bills per resource type; assert `monthly_consumption` has 12 entries per resource; assert `year_over_year.change_pct` matches manual calculation; assert empty arrays returned when no bills exist (not errors) → `backend/tests/unit/test_analytics_service.py`
- [ ] T063 [P] [US5] [TESTER] Write performance benchmark test: seed 100 bills; `pytest-benchmark` assert `AnalyticsService.get_summary` completes in < 200ms → `backend/tests/quality/test_analytics_perf.py`

### Frontend — US5

- [ ] T064 [P] [US5] [FRONTEND] Create `frontend/src/components/charts/ConsumptionTrendChart.tsx`: Recharts `<LineChart>` — one line per resource type, X = month, Y = consumed units; resource type toggle; `canvas.toBlob` PNG export button → `frontend/src/components/charts/ConsumptionTrendChart.tsx`
- [ ] T065 [P] [US5] [FRONTEND] Create `frontend/src/components/charts/MonthlyCostChart.tsx`: Recharts `<BarChart>` stacked — one bar per month split by resource type; PNG export button → `frontend/src/components/charts/MonthlyCostChart.tsx`
- [ ] T066 [P] [US5] [FRONTEND] Create `frontend/src/components/charts/PricePerUnitChart.tsx`: Recharts `<LineChart>` — price/unit per resource over time; PNG export button → `frontend/src/components/charts/PricePerUnitChart.tsx`
- [ ] T067 [P] [US5] [FRONTEND] Create `frontend/src/components/charts/YearOverYearChart.tsx`: Recharts `<BarChart>` grouped — current vs previous year per resource; percentage change label; PNG export button → `frontend/src/components/charts/YearOverYearChart.tsx`
- [ ] T068 [P] [US5] [FRONTEND] Create `frontend/src/components/charts/CumulativeCostChart.tsx`: Recharts `<AreaChart>` — running YTD total spend; PNG export button → `frontend/src/components/charts/CumulativeCostChart.tsx`
- [ ] T069 [P] [US5] [FRONTEND] Create `frontend/src/components/charts/ConsumptionHeatmap.tsx`: month-grid heatmap (12 cells, colour intensity = consumption level); resource type toggle (default electricity); PNG export button → `frontend/src/components/charts/ConsumptionHeatmap.tsx`
- [ ] T070 [US5] [FRONTEND] Create `frontend/src/pages/AnalysisPage.tsx`: global date-range picker (default last 12 months) + resource type toggle chips at top; renders all six chart components; fetches `GET /analytics/summary` with React Query; passes filtered data slices to each chart; "Export Full Report" PDF button opens `<ExportModal>` (US6) pre-filled with current filter state; empty state per chart when < 2 data points → `frontend/src/pages/AnalysisPage.tsx`

**Checkpoint**: Analysis page renders all 6 charts with seeded data; PNG export downloads from each chart; date-range filter updates all charts.

---

## Phase 8: User Story 6 — Export Consumption Report as PDF (Priority: P3)

**Goal**: Stream a PDF containing cover page, summary, per-resource tables with embedded SVG charts, and ML predictions; filterable by resource type and date range.

**Independent Test**: Seed ≥ 1 bill per resource type; call `GET /exports/report.pdf?date_from=2025-01-01&date_to=2026-06-05`; assert response `Content-Type: application/pdf`; assert body starts with `%PDF` magic bytes; assert body length > 0.

### Backend — US6

- [ ] T071 [US6] [BACKEND] Create `backend/app/services/export_service.py`: `ReportSpec` dataclass (user_id, date_from, date_to, resource_types); `ExportService` with constructor injection of `AnalyticsService` and `ChartRenderer`; `generate(spec: ReportSpec) -> bytes` — render Jinja2 template with analytics data and SVG charts; call WeasyPrint; enforce 24-month max window (raise `DateRangeExceededError`); zero HTTP objects in this class (SRP) → `backend/app/services/export_service.py`
- [ ] T072 [US6] [BACKEND] Create `backend/app/services/chart_renderer.py`: `ChartRenderer` with `render_consumption_trend(data) -> str` (SVG), `render_monthly_cost(data) -> str` (SVG) — Matplotlib `Agg` backend; output as SVG string via `io.StringIO`; no file I/O; each renderer function ≤ 30 lines → `backend/app/services/chart_renderer.py`
- [ ] T073 [US6] [BACKEND] Create `backend/app/templates/report.html`: Jinja2 HTML template — cover page (report title, user name, date range, generation timestamp), summary section (total spent + consumed per resource), per-resource sections (consumption table, inline SVG chart, ML predictions with CI), footer with page numbers; WeasyPrint-compatible CSS (paged media `@page`, `break-before`) → `backend/app/templates/report.html`
- [ ] T074 [US6] [BACKEND] Create `backend/app/api/v1/exports.py`: `GET /exports/report.pdf?resource_type&date_from&date_to` — validate date params; check 24-month window; build `ReportSpec`; call `ExportService.generate`; return `StreamingResponse(iter([pdf_bytes]), media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=\"report.pdf\""})` → `backend/app/api/v1/exports.py`

### Tests — US6

- [ ] T075 [P] [US6] [TESTER] Write integration test for PDF export: seed 3 bills (one per resource type); `GET /exports/report.pdf?date_from=...&date_to=...`; assert status 200; assert `Content-Type: application/pdf`; assert body starts with `%PDF`; assert `len(body) > 0`; test 400 on > 24 month range → `backend/tests/integration/test_export_endpoint.py`

### Frontend — US6

- [ ] T076 [US6] [FRONTEND] Create `frontend/src/components/ExportModal.tsx`: HeroUI `<Modal>` with date-range pickers and resource type multi-select checkboxes (default all selected); "Download PDF" button — constructs query string and triggers `<a href="/api/v1/exports/report.pdf?..." download>` browser download; loading state on button; `onError` → toast with RFC 7807 `detail` → `frontend/src/components/ExportModal.tsx`
- [ ] T077 [US6] [FRONTEND] Wire `<ExportModal>` into `BillsPage.tsx` "Export PDF" button (replace placeholder added in T050) and into `AnalysisPage.tsx` "Export Full Report" button pre-filled with current date-range filter state → `frontend/src/pages/BillsPage.tsx` + `frontend/src/pages/AnalysisPage.tsx`

**Checkpoint**: Export modal opens, selects date range, triggers PDF download; response is a valid PDF with content.

---

## Phase 9: Dashboard Polish & Cross-Cutting Concerns

**Purpose**: Dashboard page, README, quality gates, final code review.

- [ ] T078 [FRONTEND] Create `frontend/src/pages/DashboardPage.tsx`: three summary resource cards (HeroUI `<Card>`) — last bill date, last consumed, last paid, trend arrow (↑↓ vs previous bill); consumption line chart (Recharts `<LineChart>`) with per-resource toggle; "Upload Bill" CTA button → `/upload`; React Query fetches `GET /bills/?size=1` per resource type for summary data and `GET /analytics/summary` for chart; empty state when no bills → `frontend/src/pages/DashboardPage.tsx`
- [ ] T079 [DEVOPS] Write `README.md` at repo root: prerequisites (Docker, Docker Compose), one-command startup (`docker compose up`), required env vars table with placeholder values, link to OpenAPI docs at `http://localhost/api/v1/docs`, rollback procedure (docker compose down → alembic downgrade -1 → docker compose up) → `README.md`
- [ ] T080 [P] [DEVOPS] Validate `docker compose build --no-cache` succeeds for all services; fix any layer caching issues → `docker-compose.yml` + `backend/Dockerfile` + `frontend/Dockerfile`
- [ ] T081 [P] [BACKEND] Run `mypy --strict backend/app` and resolve all type errors → `backend/app/`
- [ ] T082 [P] [BACKEND] Run `ruff check backend/app` and resolve all warnings; run `ruff format backend/app` → `backend/app/`
- [ ] T083 [P] [TESTER] Run full test suite and verify coverage: overall ≥ 85%, `services/` ≥ 90%, `repositories/` ≥ 85%, `api/` ≥ 80%; add missing tests as needed → `backend/tests/`
- [ ] T084 [SECURITY] Final security review: confirm no `hashed_password` in any response by grepping all `*Read` schemas; confirm no secrets in source code (`grep -r "sk-" backend/`); confirm brute-force test passes; confirm all SQL uses parameterised queries (grep for f-strings inside `text()` calls) → `backend/app/`
- [ ] T085 [REVIEWER] Code review checkpoint: verify no function > 30 lines in `backend/app/services/`; verify `AuthService` imports (zero cross-service imports); verify all React Query mutations have `onError` handlers; verify no direct `fetch()` calls in frontend → `backend/app/services/` + `frontend/src/`
- [ ] T086 [TESTER] Run full integration test suite against local Docker Compose stack; fix any test failures before sign-off → `backend/tests/integration/` + `backend/tests/quality/`

**Checkpoint**: All Selena and rigour-labs quality gates pass. `docker compose up --build` starts cleanly. All tests green.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup          → No dependencies
Phase 2: Foundation     → Requires Phase 1 completion (BLOCKS all story phases)
Phase 3: US1 Auth       → Requires Phase 2
Phase 4: US2 Upload     → Requires Phase 2 + Phase 3 (needs get_current_user)
Phase 5: US3 History    → Requires Phase 4 (bills must exist)
Phase 6: US4 Forecast   → Requires Phase 4 (bills must exist for ML)
Phase 7: US5 Analytics  → Requires Phase 4 (bills must exist for aggregations)
Phase 8: US6 Export     → Requires Phase 5 + Phase 6 + Phase 7 (PDF contains all data)
Phase 9: Polish         → Requires all story phases
```

### User Story Dependencies

```
US1 (Auth)       ← Blocks US2, US3, US4, US5, US6 (all need authenticated user)
US2 (Upload)     ← Blocks US3, US4, US5, US6 (all need bills to exist)
US3 (History)    ← Independent of US4/US5/US6 after US2
US4 (Forecast)   ← Independent of US3/US5/US6 after US2
US5 (Analytics)  ← Independent of US3/US4/US6 after US2
US6 (Export)     ← Requires US4 (predictions in PDF) + US5 (analytics data for PDF)
```

### Parallel Opportunities by Agent

Once Phase 2 is complete, agents can work in parallel:

```
[BACKEND] Phase 3: T020–T025 (auth service + endpoints)
[FRONTEND] Phase 3: T028–T036 (login/register/layout) ← can start in parallel with backend US1
```

After US1 backend endpoints are live (T024):

```
[BACKEND] T037–T043 (US2 bill service)       ← starts immediately
[FRONTEND] T028–T036 (US1 frontend)          ← can continue in parallel
[TESTER] T026–T027 (US1 tests)               ← starts immediately
```

After US2 backend is live (T042):

```
[BACKEND] T048 (US3) + T052–T056 (US4) + T060–T061 (US5) ← all parallelizable
[FRONTEND] T046–T047 (US2 frontend) + T049–T051 (US3 frontend) ← parallelizable
[TESTER] T044–T045 (US2 tests) ← starts immediately
```

---

## Parallel Execution Examples

### Phase 3 Backend Parallel Launch (after Phase 2 complete)

```bash
# These can run in parallel (different files):
Task: T020 - UserRepository in backend/app/repositories/user_repository.py
Task: T021 - TokenRepository in backend/app/repositories/token_repository.py
Task: T022 - AuthService in backend/app/services/auth_service.py  # after T020+T021
Task: T026 - Unit tests for AuthService (mock dependencies)
```

### Phase 4 Backend Parallel Launch (after T024 live)

```bash
Task: T037 - BillRepository
Task: T038 - BaseParser
Task: T039 - LLMParserService  # after T038
Task: T044 - LLMParser unit tests (mock OpenAI)  # after T039
```

### Phase 7 Frontend Parallel Launch (all 6 charts independent)

```bash
Task: T064 - ConsumptionTrendChart
Task: T065 - MonthlyCostChart
Task: T066 - PricePerUnitChart
Task: T067 - YearOverYearChart
Task: T068 - CumulativeCostChart
Task: T069 - ConsumptionHeatmap
# All 6 launch in parallel — different files, no shared dependencies
```

---

## Implementation Strategy

### MVP First (US1 + US2 only)

1. Phase 1: Setup
2. Phase 2: Foundation
3. Phase 3: US1 (Auth)
4. Phase 4: US2 (Bill Upload)
5. **STOP and VALIDATE**: register, upload a bill, confirm it saves — core value delivered
6. Demo to stakeholder

### Incremental Delivery

| Sprint | Stories | Deliverable |
|---|---|---|
| 1 | US1 + US2 | Auth + bill upload — core value, demoable |
| 2 | US3 + US4 | Bill history + predictions — daily use value |
| 3 | US5 + US6 | Analytics + PDF export — insight + reporting |
| 4 | Polish | Quality gates pass, README, CI/CD |

### Agent Team Execution with run-agents.sh

```bash
# Start all agents
bash run-agents.sh

# Agent task routing:
# [DEVOPS]    → T001-T008, T018, T079-T080
# [ARCHITECT] → T019 (ADRs)
# [DESIGNER]  → T019b, T019c, T019d, T019e (component-behavior + accessibility-checklist)
# [BACKEND]   → T009-T017, T020-T025, T037-T043, T048, T052-T056, T060-T061, T071-T074
# [FRONTEND]  → T028-T036, T046-T047, T049-T051, T058-T059, T064-T070, T076-T077, T078
# [SECURITY]  → T025, T084
# [TESTER]    → T026-T027, T044-T045, T057, T062-T063, T075, T083, T086
# [REVIEWER]  → T085
```

---

## Notes

- `[P]` tasks operate on different files and have no dependency on incomplete sibling tasks in the same phase
- Each user story phase is an independently demoable increment
- All backend tasks assume the working directory is the repository root
- All agent tasks reference the agent markdown files in `agents/` — agents are launched via `run-agents.sh`
- The `[SECURITY]` agent should be consulted before merging Phase 3 (auth) to main
- The `[REVIEWER]` checkpoint at T085 is a blocking gate before Phase 9 sign-off
- Test tasks are included per the quality gates defined in the project constitution (`constitution.md`)
