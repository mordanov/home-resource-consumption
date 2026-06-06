# T084: Final Security Review

**Date**: 2026-06-06  
**Reviewer**: security-architect  
**Scope**: Full backend `backend/app/` — Phase 9 sign-off  

---

## Security Review Result

### Decision
**APPROVED WITH RESIDUAL RISKS**

All Blocker and High issues are resolved. Three residual risks (Medium and Low) are documented with owners below.

---

## Check Results

### ✅ hashed_password absent from all response schemas

All `*Read` schemas verified:
- `UserRead(UserBase)` — fields: `id`, `username`, `email`, `is_active`, `created_at`
- `BillRead(BillBase)` — no user credentials
- `PredictionRead(BaseModel)` — no user credentials

`grep hashed_password backend/app/domain/schemas.py` → **0 results**

### ✅ No secrets in source code

`grep -r "sk-" backend/app/` → **0 results**  
`OPENAI_API_KEY` loaded from `settings.OPENAI_API_KEY` (pydantic-settings env var) only.  
`JWT_SECRET_KEY` loaded from env only. No hardcoded keys in any file.

### ✅ JWT_SECRET_KEY startup validation enforced (after T025 fix)

```python
if len(v.encode()) < 32:
    raise ValueError("JWT_SECRET_KEY must be at least 256 bits (32 bytes)")
```

Empty string and strings < 32 bytes both fail startup. Confirmed.

### ✅ No f-strings inside text() SQL calls (after T025 fix)

`grep -rn "text(f" backend/app/` → **0 results**  
Analytics queries use `_RT_FILTER` module-level constant with string concatenation.  
All other queries use SQLAlchemy ORM parameterised expressions.

### ✅ No SQL string interpolation

`grep -rn 'f".*SELECT|f".*WHERE'` → **0 results**  
`grep -rn 'execute(f"'` → **0 results**  
All queries use bound parameters (`:user_id`, `:date_from`, etc.).

### ✅ Data isolation: Bills and Predictions scoped by user_id

Every query against `Bill` and `Prediction` tables filters by `user_id`:
- `BillRepository.list_paginated()` — `Bill.user_id == user_id`
- `BillRepository.list_for_user_and_type()` — `Bill.user_id == user_id`
- `BillRepository.get_active()` — `Bill.user_id == user_id`
- `PredictionRepository.list_latest()` — `Prediction.user_id == user_id`
- `AnalyticsService` SQL queries — `WHERE user_id = :user_id` in every CTE

### ✅ File upload: MIME validation before processing

```python
_ALLOWED_MIME = {"application/pdf", "image/jpeg", "image/png"}
...
if mime not in _ALLOWED_MIME:
    raise ParseError(...)   # before any PyMuPDF/pytesseract/OpenAI call
```

Size check also precedes processing. Compliant.

### ✅ LLM integration: API key not logged or returned

`OPENAI_API_KEY` only referenced as `settings.OPENAI_API_KEY` in the constructor.  
OpenAI errors are caught and re-raised as `ParseError` with a safe message.  
`ParseError` handler returns RFC 7807 `exc.detail` only — no API errors verbatim.

### ✅ LLM response validated by Pydantic before persistence

`LLMParserService._parse_response()` validates via `BillPreview(**data, ...)` with `ValidationError` catch.  
Raw LLM JSON never passed directly to SQLAlchemy. Compliant.

### ✅ PDF export: 24-month window enforced

`ExportService._validate_date_range()` raises `DateRangeExceededError` before any PDF generation.  
Handler returns RFC 7807 `400 Bad Request`.

### ✅ Error responses: no internal detail leakage

All exception handlers in `main.py` return controlled `ProblemDetail` bodies.  
No traceback, DB schema path, or file system paths in error responses.

### ✅ CORS: no wildcard

`CORS_ORIGINS` defaults to `["http://localhost:3000", "http://localhost"]` — no `"*"`.  
`allow_origins` is wired from `settings.CORS_ORIGINS`.

### ✅ Jinja2 autoescaping enabled for HTML templates

```python
env = Environment(
    loader=PackageLoader("app", "templates"),
    autoescape=select_autoescape(["html"]),
)
```

XSS risk in PDF HTML template mitigated.

### ✅ source_file_path not user-injectable for file operations

`BillPreview.source_file_path` is accepted in the confirm body schema but is **not passed** to the `Bill()` ORM constructor in `confirm()`. The field stored in the DB for `source_file_path` is always `None` for confirmed bills (no upload path saved). The `cleanup_uploaded_file` path comes from DB only, so there is no user-controlled path reaching `os.remove()`.

---

## Residual Risks

| ID | Risk | Severity | Owner | Due |
|---|---|---|---|---|
| ~~R-003~~ | ~~No rate limiting on `/api/v1/auth/login`~~ | ~~Medium~~ | devops | **RESOLVED** — Nginx `limit_req_zone` 10r/m burst=5 applied in nginx.conf |
| R-004 | `ParseError` from LLM ValidationError leaks Pydantic schema field names | **Low** | backend | v2 |
| R-005 | Username timing oracle — bcrypt skipped for unknown usernames | **Low** | backend | v2 |

### R-003 — RESOLVED

DevOps applied `limit_req_zone $binary_remote_addr zone=login_zone:10m rate=10r/m` with `burst=5 nodelay` on `location = /api/v1/auth/login` in `nginx/nginx.conf`. Returns 429 when limit exceeded. Verified in nginx.conf lines 17-20, 55-56.

### R-004 Detail

The message `"LLM response validation failed: 1 validation error for BillPreview\nresource_type\n  ..."` is returned to the client. This reveals Pydantic schema field names. Mitigation: strip ValidationError detail in ParseError message: `raise ParseError("Bill data extraction failed — check the uploaded file")`.

### R-005 Detail

When a username does not exist, `verify_password` is not called (short-circuits). An attacker can time the difference to enumerate valid usernames. For a single-household self-hosted deployment this is very low practical risk.

---

## Security Tests Required

| Test | Status |
|---|---|
| Login wrong password → 401, no token | T027 ✅ |
| Expired access token → 401 | T026 ✅ |
| Refresh token replay after logout → 401 | T026 ✅ |
| Brute-force 10 wrong passwords → all 401 | T027 quality gate ✅ (requires stack) |
| `hashed_password` absent from responses | T026 ✅ |
| File upload wrong MIME → 422 | T045 ✅ |
| Cross-user data isolation | T045 ✅ |
| JWT_SECRET_KEY < 32 bytes → startup fails | T027 quality gate — **ADD** |

---

## Sign-off

**APPROVED WITH RESIDUAL RISKS** — all Blocker and High findings resolved. R-003 (rate limiting) resolved by DevOps. Two Low residual risks remain: R-004 (ParseError field name leakage) and R-005 (username timing oracle) — both acceptable for a single-household self-hosted deployment and tracked for v2.
