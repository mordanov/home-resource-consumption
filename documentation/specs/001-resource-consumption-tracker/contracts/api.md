# API Contracts: Home Resource Consumption Tracker

**Base URL**: `/api/v1`
**Auth**: `Authorization: Bearer <access_token>` on all endpoints except `/auth/register` and `/auth/login`
**Error format**: RFC 7807 `application/problem+json`
**Date**: 2026-06-05

---

## Authentication — `/api/v1/auth`

### POST `/auth/register`

Create a new user account.

**Request** (`application/json`):
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "StrongPass1!"
}
```

**Responses**:

| Status | Meaning |
|---|---|
| 201 | User created. Returns `UserRead`. |
| 409 | Username or email already registered. |
| 422 | Validation error (password policy, invalid email). |

**Response body (201)**:
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "username": "alice",
  "email": "alice@example.com",
  "is_active": true,
  "created_at": "2026-06-05T10:00:00Z"
}
```

---

### POST `/auth/login`

Authenticate and receive a token pair. Sets `HttpOnly` refresh-token cookie.

**Request** (`application/json`):
```json
{
  "username": "alice",
  "password": "StrongPass1!"
}
```

**Responses**:

| Status | Meaning |
|---|---|
| 200 | Login successful. Returns token pair. Sets `Set-Cookie: refresh_token=<token>; HttpOnly; Secure; SameSite=Strict`. |
| 401 | Invalid credentials. |

**Response body (200)**:
```json
{
  "access_token": "<JWT>",
  "token_type": "bearer",
  "expires_in": 900
}
```

---

### POST `/auth/refresh`

Rotate the refresh token and issue a new access token. Browser sends `refresh_token` cookie automatically.

**Request**: No body. Cookie `refresh_token` required.

**Responses**:

| Status | Meaning |
|---|---|
| 200 | New token pair issued. Old refresh token revoked. |
| 401 | Refresh token invalid, expired, or already revoked. |

**Response body (200)**: Same shape as `/auth/login` 200.

---

### POST `/auth/logout`

Revoke the refresh token and end the session.

**Request**: No body. `Authorization` header + `refresh_token` cookie required.

**Responses**:

| Status | Meaning |
|---|---|
| 204 | Token revoked. No body. |
| 401 | Not authenticated. |

---

### GET `/auth/me`

Return the current user's profile.

**Responses**:

| Status | Meaning |
|---|---|
| 200 | Returns `UserRead`. |
| 401 | Not authenticated. |

---

## Bills — `/api/v1/bills`

### POST `/bills/upload`

Upload a utility bill file and trigger LLM parsing. Returns a preview for user confirmation.

**Request** (`multipart/form-data`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | binary | Yes | PDF, JPEG, or PNG. Max `MAX_UPLOAD_SIZE_MB`. |
| `resource_type` | string | Yes | `ELECTRICITY`, `GAS`, or `WATER` |

**Responses**:

| Status | Meaning |
|---|---|
| 200 | Parsed preview returned (not yet saved). Returns `BillPreview`. |
| 409 | File parsed but data validation failed (e.g., missing required field). |
| 413 | File too large. |
| 422 | Invalid `resource_type` or unsupported file type. |

**Response body (200) — `BillPreview`**:
```json
{
  "resource_type": "ELECTRICITY",
  "bill_date": "2026-05-31",
  "period_start": "2026-05-01",
  "period_end": "2026-05-31",
  "amount_consumed": 312.5,
  "unit": "KWH",
  "amount_paid": 87.50,
  "currency": "EUR",
  "raw_text": "...extracted text..."
}
```

### POST `/bills/confirm`

Persist a parsed bill preview as a confirmed record.

**Request** (`application/json`): `BillPreview` body (same schema as upload response).

**Responses**:

| Status | Meaning |
|---|---|
| 201 | Bill created. Returns `BillRead`. |
| 422 | Validation error on submitted data. |

---

### GET `/bills/`

List bills for the current user with pagination and filtering.

**Query parameters**:

| Param | Type | Default | Notes |
|---|---|---|---|
| `resource_type` | string | — | Optional filter: ELECTRICITY, GAS, WATER |
| `date_from` | date | — | Optional ISO 8601 date |
| `date_to` | date | — | Optional ISO 8601 date |
| `page` | int | 1 | 1-based |
| `size` | int | 20 | Max 100 |

**Response (200)**:
```json
{
  "items": [ /* BillRead[] */ ],
  "total": 42,
  "page": 1,
  "size": 20,
  "pages": 3
}
```

---

### GET `/bills/{id}`

Retrieve a single bill by ID.

**Responses**:

| Status | Meaning |
|---|---|
| 200 | Returns `BillRead`. |
| 404 | Not found or not owned by current user. |

---

### DELETE `/bills/{id}`

Soft-delete a bill (sets `deleted_at`).

**Responses**:

| Status | Meaning |
|---|---|
| 204 | Deleted. No body. |
| 404 | Not found or not owned by current user. |

---

## Predictions — `/api/v1/predictions`

### GET `/predictions/{resource_type}`

Generate and return a prediction for the specified resource type.

**Path parameter**: `resource_type` — `ELECTRICITY`, `GAS`, or `WATER`

**Query parameters**:

| Param | Type | Default | Notes |
|---|---|---|---|
| `horizon` | int | 1 | 1, 2, or 3 |

**Responses**:

| Status | Meaning |
|---|---|
| 200 | Prediction generated. Returns `PredictionRead`. |
| 409 | Insufficient data. Body includes `bills_needed` count. |

**Response body (200)**:
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "resource_type": "ELECTRICITY",
  "generated_at": "2026-06-05T10:00:00Z",
  "horizon_months": 1,
  "predicted_consumption": 295.0,
  "predicted_cost": 82.60,
  "confidence_interval_lower": 270.0,
  "confidence_interval_upper": 320.0,
  "model_version": "linear_regression_v1"
}
```

**Response body (409)**:
```json
{
  "type": "https://resource-tracker/errors/insufficient-data",
  "title": "Insufficient historical data",
  "status": 409,
  "detail": "At least 3 electricity bills are required. You have 1. Upload 2 more to enable predictions.",
  "instance": "/api/v1/predictions/ELECTRICITY"
}
```

---

## Analytics — `/api/v1/analytics`

### GET `/analytics/summary`

Return pre-aggregated analytics for all chart views.

**Query parameters**:

| Param | Type | Default | Notes |
|---|---|---|---|
| `date_from` | date | 12 months ago | ISO 8601 date |
| `date_to` | date | today | ISO 8601 date |
| `resource_type` | string | all | Optional filter |

**Response (200)**:
```json
{
  "monthly_consumption": [
    { "month": "2026-01", "electricity": 320.5, "gas": 180.0, "water": 12.3 }
  ],
  "monthly_cost": [
    { "month": "2026-01", "electricity": 89.74, "gas": 201.60, "water": 43.05 }
  ],
  "price_per_unit": [
    { "month": "2026-01", "electricity": 0.28, "gas": 1.12, "water": 3.50 }
  ],
  "year_over_year": [
    {
      "resource": "ELECTRICITY",
      "current_year_total": 2100.0,
      "previous_year_total": 1950.0,
      "change_pct": 7.7
    }
  ],
  "cumulative_cost_ytd": [
    { "month": "2026-01", "cumulative": 142.0 }
  ]
}
```

---

## Exports — `/api/v1/exports`

### GET `/exports/report.pdf`

Generate and stream a PDF consumption report.

**Query parameters**:

| Param | Type | Default | Notes |
|---|---|---|---|
| `resource_type` | string | all | Optional filter |
| `date_from` | date | required | ISO 8601 date |
| `date_to` | date | required | ISO 8601 date |

**Responses**:

| Status | Meaning |
|---|---|
| 200 | PDF stream. `Content-Type: application/pdf`. `Content-Disposition: attachment; filename="report.pdf"`. |
| 400 | Date range exceeds 24 months. |
| 422 | Missing or invalid date parameters. |

---

## Error Response Schema (RFC 7807)

All non-2xx responses use `Content-Type: application/problem+json`:

```json
{
  "type": "https://resource-tracker/errors/<error-slug>",
  "title": "Human-readable title",
  "status": 404,
  "detail": "Specific detail message suitable for display.",
  "instance": "/api/v1/bills/abc-123"
}
```

Common error slugs: `not-found`, `unauthorized`, `forbidden`, `conflict`, `validation-error`, `insufficient-data`, `file-too-large`, `date-range-exceeded`.
