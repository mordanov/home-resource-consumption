import re
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.domain.enums import ResourceType, Unit

PASSWORD_PATTERN = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$")


class ProblemDetail(BaseModel):
    type: str = "about:blank"
    title: str
    status: int
    detail: str
    instance: str | None = None


class PaginatedResponse[T](BaseModel):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int


# ── User ──────────────────────────────────────────────────────────────────────


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")
    email: EmailStr


class UserCreate(UserBase):
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not PASSWORD_PATTERN.match(v):
            raise ValueError(
                "Password must be ≥8 chars with at least 1 uppercase, 1 lowercase, 1 digit"
            )
        return v


class UserRead(UserBase):
    id: UUID
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Bill ──────────────────────────────────────────────────────────────────────


class BillBase(BaseModel):
    resource_type: ResourceType
    bill_date: date
    period_start: date
    period_end: date
    amount_consumed: Decimal = Field(..., gt=0, decimal_places=4)
    unit: Unit
    amount_paid: Decimal = Field(..., ge=0, decimal_places=4)
    currency: str = Field(..., min_length=3, max_length=3)

    @field_validator("period_end")
    @classmethod
    def validate_period(cls, v: date, info: object) -> date:
        data = getattr(info, "data", {})
        period_start = data.get("period_start")
        if period_start and v <= period_start:
            raise ValueError("period_end must be after period_start")
        return v


class BillCreate(BillBase):
    raw_text: str | None = None
    source_file_path: str | None = None


class BillRead(BillBase):
    id: UUID
    user_id: UUID
    raw_text: str | None = None
    source_file_path: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BillPreview(BillBase):
    raw_text: str | None = None


# ── Prediction ────────────────────────────────────────────────────────────────


class PredictionRead(BaseModel):
    id: UUID
    user_id: UUID
    resource_type: ResourceType
    generated_at: datetime
    horizon_months: int = Field(..., ge=1, le=3)
    predicted_consumption: Decimal
    predicted_cost: Decimal
    confidence_interval_lower: Decimal
    confidence_interval_upper: Decimal
    model_version: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Auth ──────────────────────────────────────────────────────────────────────


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginRequest(BaseModel):
    username: str
    password: str


# ── Analytics ─────────────────────────────────────────────────────────────────


class MonthlyDataPoint(BaseModel):
    month: str
    resource_type: ResourceType
    value: Decimal


class YearOverYearPoint(BaseModel):
    resource_type: ResourceType
    current_year: Decimal
    previous_year: Decimal
    change_pct: Decimal | None = None


class CumulativeCostPoint(BaseModel):
    month: str
    resource_type: ResourceType
    cumulative_cost: Decimal


class AnalyticsSummary(BaseModel):
    monthly_consumption: list[MonthlyDataPoint]
    monthly_cost: list[MonthlyDataPoint]
    price_per_unit: list[MonthlyDataPoint]
    year_over_year: list[YearOverYearPoint]
    cumulative_cost_ytd: list[CumulativeCostPoint]
