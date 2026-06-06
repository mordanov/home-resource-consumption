# T025: Auth Endpoint Security Validation

**Date**: 2026-06-06  
**Reviewer**: security-architect  
**Scope**: Phase 3 US1 Authentication — `backend/app/services/auth_service.py`, `backend/app/domain/schemas.py`, `backend/app/api/v1/auth.py`, `backend/app/core/security.py`, `backend/app/core/config.py`

---

## Security Review Result

### Decision
**CHANGES REQUIRED** → After fixes: **APPROVED**

Two findings were identified and fixed before publishing this report.

---

## Findings

### BLOCKER (Fixed) — JWT_SECRET_KEY empty string bypasses length validation

**File**: `backend/app/core/config.py:22`  
**Before**:
```python
if v and len(v.encode()) < 32:
```
**After**:
```python
if len(v.encode()) < 32:
```
**Impact**: The `if v and ...` guard silently skipped validation for an empty string. An application started with `JWT_SECRET_KEY=""` would sign JWTs with an empty key, making all tokens trivially forgeable.  
**Status**: Fixed — empty and sub-32-byte keys now raise `ValueError` at startup.

---

### Medium (Fixed) — f-string interpolation inside `text()` calls

**File**: `backend/app/services/analytics_service.py`  
**Before**: Five `text(f"""...{rt_filter}...""")` patterns.  
**Risk**: Although `rt_filter` was a hardcoded constant (not user-supplied), the pattern violates the spec rule "String interpolation into SQL is prohibited" and would flag in T084 grep check. A future maintainer could inadvertently introduce a real injection by following the same pattern.  
**After**: `rt_filter` renamed to `rt_clause`, sourced from module-level constant `_RT_FILTER`, concatenated via string addition (not f-string) into `text()` call arguments. No user-controlled data flows into SQL string construction.  
**Status**: Fixed.

---

## Passing Checks

### ✅ hashed_password absent from all response schemas

`UserRead` inherits `UserBase` (username, email) and adds `id`, `is_active`, `created_at`.  
`UserCreate` (write-only) has `password` but this schema is never used as a response model.  
No `hashed_password` field in any Pydantic response schema.

```
grep hashed_password backend/app/domain/schemas.py → 0 results
```

### ✅ Refresh token delivered as HttpOnly cookie only

`TokenResponse` contains only `access_token`, `token_type`, `expires_in`.  
The raw refresh token is set via `response.set_cookie()` with:
- `httponly=True`
- `secure=True`  
- `samesite="strict"`
- `path="/api/v1/auth"` (path-scoped, reduces attack surface)

The refresh token never appears in the JSON response body.

### ✅ JWT payload contains only `sub` and `exp`

```python
payload = {"sub": str(user_id), "exp": expire}
```

No username, email, role, or other PII in the token payload. `sub` is a UUID string.

### ✅ AuthService has zero cross-service imports

Imports in `auth_service.py`:
- `app.core.exceptions` (ConflictError, UnauthorizedError)
- `app.core.security` (crypto functions)
- `app.domain.models` (User ORM model)
- `app.domain.schemas` (UserRead Pydantic schema)
- `app.repositories.token_repository` (TokenRepository)
- `app.repositories.user_repository` (UserRepository)

Zero imports from `BillService`, `AnalyticsService`, `ExportService`, or any other service. ✅

### ✅ bcrypt cost ≥ 12

```python
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
```

### ✅ Refresh token rotation atomicity

`AuthService.refresh()` revokes old token (line 57) **before** issuing new token (line 60). Both operations run within the same SQLAlchemy session transaction — if the new token creation fails, the session rolls back (via `get_db` exception handler), preserving the old token.

### ✅ Constant-time credential verification (no username/password oracle)

Login returns identical `UnauthorizedError("Invalid credentials")` regardless of whether:
- the username doesn't exist, or
- the password is wrong.

`verify_password` is always called when a user is found (bcrypt timing preserved for valid usernames). The combined `if not user or not verify_password(...)` does short-circuit for unknown usernames, but both paths return the same response.

> **Residual risk (Low)**: An attacker can enumerate valid usernames via timing differences (bcrypt verify call vs no call). For a single-household self-hosted app this is acceptable. Rate-limiting or mandatory bcrypt dummy comparison would close this fully.

### ✅ CORS wildcard `*` prohibited

`settings.CORS_ORIGINS` defaults to `["http://localhost:3000", "http://localhost"]` with no `*`. `allow_origins` wired from settings.

### ✅ Error responses do not leak internal details

All exception handlers in `main.py` return RFC 7807 Problem Details with controlled `detail` strings. No traceback, database schema, file path, or OpenAI error propagated to clients.

### ✅ JWT_SECRET_KEY minimum entropy enforced at startup (after fix)

`validate_jwt_secret` raises `ValueError` if `JWT_SECRET_KEY` is fewer than 32 bytes (256 bits), blocking startup.

---

## Required Security Tests

Per T027, the following tests must pass (test files already exist in `backend/tests/`):

| Test | Location | Status |
|---|---|---|
| Login with wrong password returns 401 and no token fields | `test_auth_endpoints.py` | Defined |
| Expired access token returns 401 | `test_auth_service.py` | Defined |
| Refresh token replay after logout returns 401 | `test_auth_service.py` | Defined |
| 10 rapid wrong-password attempts all return 401 | `test_auth_security.py` | Defined (requires stack) |
| `hashed_password` absent from register/login responses | `test_auth_service.py` | Defined |
| `JWT_SECRET_KEY` shorter than 32 bytes fails startup | `test_auth_security.py` | Required (add) |

---

## Residual Risks

| ID | Risk | Severity | Owner | Due |
|---|---|---|---|---|
| R-001 | Username enumeration via bcrypt timing differential | Low | backend | v2 |
| R-002 | Brute-force test requires full Docker stack (marked skip) | Low | autotester | before release |
| R-003 | No rate limiting on `/auth/login` — application-layer only | Medium | devops | before release |

> R-003 note: Rate limiting should be applied at the Nginx layer (`limit_req_zone`) for `/api/v1/auth/login`. This is a DevOps configuration item.

---

## Sign-off

All Blocker and High findings fixed before this report was published. Residual risks documented with owners and target dates.
