# Data Model: Home Resource Consumption Tracker

**Phase**: 1 — Design
**Date**: 2026-06-05

---

## Entities

### User

Represents a registered household account. All other entities are owned by a user.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Generated server-side (uuid4) |
| username | VARCHAR(64) | UNIQUE, NOT NULL | Login identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Contact address |
| hashed_password | VARCHAR(255) | NOT NULL | bcrypt, cost ≥ 12 |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Soft-disable account |
| created_at | TIMESTAMPTZ | NOT NULL | Set on insert |
| updated_at | TIMESTAMPTZ | NOT NULL | Updated via `onupdate` trigger |

**Table name**: `users`

**Validation rules**:
- `username`: 3–64 characters, alphanumeric + underscore + hyphen
- `email`: valid RFC 5321 email format
- `password` (at registration): ≥ 8 characters, ≥ 1 uppercase, ≥ 1 lowercase, ≥ 1 digit
- `hashed_password` MUST NOT appear in any Pydantic response schema

---

### Bill

A single confirmed utility invoice record. Scoped to a user and a resource type.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Generated server-side (uuid4) |
| user_id | UUID | FK → users.id, NOT NULL | Owner; all queries filter by this |
| resource_type | VARCHAR(20) | NOT NULL | Enum: ELECTRICITY, GAS, WATER |
| bill_date | DATE | NOT NULL | Date printed on the bill |
| period_start | DATE | NOT NULL | Billing period start |
| period_end | DATE | NOT NULL | Billing period end |
| amount_consumed | NUMERIC(12,4) | NOT NULL | kWh or m³ |
| unit | VARCHAR(20) | NOT NULL | Enum: KWH, CUBIC_METER |
| amount_paid | NUMERIC(12,4) | NOT NULL | In local currency |
| currency | CHAR(3) | NOT NULL | ISO 4217 code, e.g. EUR |
| raw_text | TEXT | NULLABLE | OCR / LLM extracted text |
| source_file_path | TEXT | NULLABLE | Local path to uploaded file |
| deleted_at | TIMESTAMPTZ | NULLABLE | NULL = active; set = soft-deleted |
| created_at | TIMESTAMPTZ | NOT NULL | Set on insert |
| updated_at | TIMESTAMPTZ | NOT NULL | Updated via `onupdate` trigger |

**Table name**: `bills`

**Validation rules**:
- `period_end` MUST be after `period_start`
- `amount_consumed` MUST be > 0
- `amount_paid` MUST be ≥ 0
- `unit` must match resource_type: ELECTRICITY → KWH; GAS/WATER → CUBIC_METER
- All repository queries MUST include `WHERE deleted_at IS NULL` unless explicitly fetching deleted records

**Indexes**:
- `(user_id, resource_type, bill_date)` — primary query pattern for predictions and analytics
- `(user_id, deleted_at)` — filtered list queries

---

### Prediction

A forecast record generated for a specific user, resource type, and horizon.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Generated server-side (uuid4) |
| user_id | UUID | FK → users.id, NOT NULL | Owner |
| resource_type | VARCHAR(20) | NOT NULL | Enum: ELECTRICITY, GAS, WATER |
| generated_at | TIMESTAMPTZ | NOT NULL | When prediction was produced |
| horizon_months | SMALLINT | NOT NULL | 1, 2, or 3 |
| predicted_consumption | NUMERIC(12,4) | NOT NULL | Central estimate |
| predicted_cost | NUMERIC(12,4) | NOT NULL | Central cost estimate |
| confidence_interval_lower | NUMERIC(12,4) | NOT NULL | 90% CI lower bound |
| confidence_interval_upper | NUMERIC(12,4) | NOT NULL | 90% CI upper bound |
| model_version | VARCHAR(64) | NOT NULL | e.g. `linear_regression_v1` |
| created_at | TIMESTAMPTZ | NOT NULL | Set on insert |

**Table name**: `predictions`

**Validation rules**:
- `horizon_months` must be 1, 2, or 3
- `confidence_interval_lower` ≤ `predicted_consumption` ≤ `confidence_interval_upper`

---

### RefreshToken

Persisted refresh token state for session rotation.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Generated server-side (uuid4) |
| user_id | UUID | FK → users.id, NOT NULL | Owner |
| token_hash | VARCHAR(255) | UNIQUE, NOT NULL | SHA-256 of raw 64-byte token |
| expires_at | TIMESTAMPTZ | NOT NULL | 30 days from issue |
| revoked | BOOLEAN | NOT NULL, DEFAULT FALSE | Set TRUE on rotation or logout |
| created_at | TIMESTAMPTZ | NOT NULL | Set on insert |

**Table name**: `refresh_tokens`

**Validation rules**:
- A token is valid only if `revoked = FALSE` AND `expires_at > NOW()`
- On `/auth/refresh`: old token is atomically set `revoked = TRUE` before new token pair is issued

---

## Enumerations

Stored as VARCHAR in PostgreSQL (not native ENUM) to simplify Alembic migrations.

```python
class ResourceType(str, Enum):
    ELECTRICITY = "ELECTRICITY"
    GAS = "GAS"
    WATER = "WATER"

class Unit(str, Enum):
    KWH = "KWH"
    CUBIC_METER = "CUBIC_METER"
```

---

## Entity Relationships

```
User ──< Bill          (one user → many bills)
User ──< Prediction    (one user → many predictions)
User ──< RefreshToken  (one user → many refresh tokens)
```

No many-to-many relationships exist. All relationships are simple parent-child with `user_id` as the scoping key.

---

## Pydantic Schema Hierarchy

Schema inheritance follows the pattern below to avoid field duplication (DRY):

```
BillBase         (shared readable fields)
  └── BillCreate (adds file upload fields; excludes id/timestamps)
  └── BillRead   (adds id, user_id, created_at, updated_at)

UserBase
  └── UserCreate (adds password field)
  └── UserRead   (adds id, is_active, created_at; NEVER includes hashed_password)

PredictionRead   (all fields; no Create schema — predictions are generated, not submitted)

TokenResponse    (access_token, token_type, expires_in, refresh_token)
```

---

## State Transitions

### Bill lifecycle

```
[uploaded] → [parsed: preview shown] → [confirmed: persisted]
                                     ↘ [rejected: discarded, not persisted]
[persisted] → [soft-deleted: deleted_at set, invisible in queries]
```

### RefreshToken lifecycle

```
[issued: revoked=FALSE] → [rotated: revoked=TRUE, new token issued]
                        → [expired: expires_at < NOW()]
                        → [revoked on logout: revoked=TRUE]
```

---

## Migration Strategy

- Tool: Alembic with async SQLAlchemy engine
- One migration file per feature branch (`YYYYMMDD_description.py`)
- Initial migration creates all four tables in a single revision
- `alembic upgrade head` is run automatically on container startup (via FastAPI lifespan)
- All migrations include a correct `downgrade()` implementation

---

## Analytics Aggregation Notes

Analytics queries are the only place where raw SQL via `text()` is permitted (for performance). All other queries use SQLAlchemy ORM constructs.

Key aggregation patterns:
- `monthly_consumption`: `date_trunc('month', bill_date)` GROUP BY month + resource_type
- `price_per_unit`: `SUM(amount_paid) / SUM(amount_consumed)` per month + resource_type
- `year_over_year`: Two CTEs — current year vs previous year, joined on resource_type
- `cumulative_cost_ytd`: Window function `SUM(amount_paid) OVER (PARTITION BY resource_type ORDER BY month)`
