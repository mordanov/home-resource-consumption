"""Shared pytest fixtures for unit, integration, and quality tests."""

from __future__ import annotations

# ── Settings override ────────────────────────────────────────────────────────
# Override settings before any app module is imported so tests never hit
# real external services or read an .env file from the repo root.
import os
from collections.abc import AsyncGenerator
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_resource_tracker"
)
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-at-least-32-bytes-long-for-tests")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-fake-key-for-unit-tests-only")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test-uploads")


# ── In-process test DB (SQLite async via aiosqlite) ──────────────────────────
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest_asyncio.fixture(scope="function")
async def db_engine():
    """Create an isolated in-memory SQLite engine per test function."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
    )
    # Import models lazily to avoid circular imports at collection time
    from app.domain.models import Base  # type: ignore[import]

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide a rollback-isolated async session per test."""
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session


# ── App client fixtures ──────────────────────────────────────────────────────


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """HTTPX async client wired to the FastAPI app with DB override."""
    from app.core.database import get_db  # type: ignore[import]
    from app.main import app  # type: ignore[import]

    async def override_get_db():  # type: ignore[return]
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ── Domain data factories ────────────────────────────────────────────────────


def make_user_data(
    username: str = "testuser",
    email: str = "test@example.com",
    password: str = "TestPass1!",
) -> dict:
    return {"username": username, "email": email, "password": password}


def make_bill_data(
    resource_type: str = "ELECTRICITY",
    bill_date: date | None = None,
    period_start: date | None = None,
    period_end: date | None = None,
    amount_consumed: float = 250.0,
    amount_paid: float = 45.00,
    currency: str = "EUR",
    unit: str = "KWH",
) -> dict:
    today = date.today()
    return {
        "resource_type": resource_type,
        "bill_date": (bill_date or today).isoformat(),
        "period_start": (period_start or (today - timedelta(days=30))).isoformat(),
        "period_end": (period_end or today).isoformat(),
        "amount_consumed": str(Decimal(str(amount_consumed))),
        "amount_paid": str(Decimal(str(amount_paid))),
        "currency": currency,
        "unit": unit,
    }


def make_bill_preview(
    resource_type: str = "ELECTRICITY",
    period_start: date | None = None,
    period_end: date | None = None,
    amount_consumed: float = 250.0,
    amount_paid: float = 45.00,
    currency: str = "EUR",
    unit: str = "KWH",
) -> dict:
    today = date.today()
    return {
        "resource_type": resource_type,
        "bill_date": today.isoformat(),
        "period_start": (period_start or (today - timedelta(days=30))).isoformat(),
        "period_end": (period_end or today).isoformat(),
        "amount_consumed": str(Decimal(str(amount_consumed))),
        "amount_paid": str(Decimal(str(amount_paid))),
        "currency": currency,
        "unit": unit,
        "raw_text": "Sample extracted text from PDF",
    }


def make_synthetic_pdf() -> bytes:
    """Return a minimal valid PDF as bytes for upload tests."""
    content = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n"
        b"   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
        b"4 0 obj\n<< /Length 44 >>\nstream\n"
        b"BT /F1 12 Tf 100 700 Td (Electricity Bill) Tj ET\n"
        b"endstream\nendobj\n"
        b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
        b"xref\n0 6\n0000000000 65535 f \n"
        b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n0\n%%EOF\n"
    )
    return content


# ── OpenAI mock helpers ──────────────────────────────────────────────────────


def make_openai_parse_response(bill_data: dict | None = None) -> MagicMock:
    """Build a mock OpenAI ChatCompletion response that returns bill JSON."""
    import json

    data = bill_data or {
        "resource_type": "ELECTRICITY",
        "bill_date": date.today().isoformat(),
        "period_start": (date.today() - timedelta(days=30)).isoformat(),
        "period_end": date.today().isoformat(),
        "amount_consumed": "250.0000",
        "unit": "KWH",
        "amount_paid": "45.0000",
        "currency": "EUR",
        "raw_text": "Extracted text",
    }
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = json.dumps(data)
    return mock_response
