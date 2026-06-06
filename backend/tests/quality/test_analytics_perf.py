"""Performance benchmark for AnalyticsService — T063.

rigour-labs gate: pytest-benchmark asserts AnalyticsService.get_summary
completes in < 200ms for up to 100 bills.

Run with: pytest tests/quality/test_analytics_perf.py --benchmark-only
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest


def _import_analytics_service():
    try:
        from app.services.analytics_service import AnalyticsService  # type: ignore[import]

        return AnalyticsService
    except ModuleNotFoundError:
        pytest.skip("AnalyticsService not yet implemented")


def _make_100_monthly_rows() -> list:
    rows = []
    today = date.today()
    resource_types = ["ELECTRICITY", "GAS", "WATER"]

    for i in range(100):
        row = MagicMock()
        row.month = (today - timedelta(days=i * 10)).strftime("%Y-%m")
        row.resource_type = resource_types[i % 3]
        row.total_consumed = Decimal(str(100.0 + i * 2))
        row.total_paid = Decimal(str(45.0 + i))
        rows.append(row)

    return rows


# ---------------------------------------------------------------------------
# T063: Benchmark — 100 bills query completes in < 200ms
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="Requires AnalyticsService implementation — run after backend completes")
def test_analytics_summary_under_200ms(benchmark) -> None:
    """AnalyticsService.get_summary must respond in < 200ms for 100 bills."""
    import asyncio

    analytics_service_cls = _import_analytics_service()

    rows = _make_100_monthly_rows()
    mock_session = MagicMock()
    mock_result = MagicMock()
    mock_result.fetchall = MagicMock(return_value=rows)
    mock_session.execute = AsyncMock(return_value=mock_result)

    service = analytics_service_cls(db=mock_session)
    user_id = uuid.uuid4()

    async def run_summary():
        return await service.get_summary(
            user_id=user_id,
            date_from=date.today() - timedelta(days=365),
            date_to=date.today(),
        )

    def sync_run():
        return asyncio.get_event_loop().run_until_complete(run_summary())

    result = benchmark(sync_run)
    assert result is not None

    # Enforce 200ms gate (pytest-benchmark provides .stats.mean in seconds)
    mean_ms = benchmark.stats["mean"] * 1000
    assert mean_ms < 200, f"AnalyticsService.get_summary took {mean_ms:.1f}ms, limit 200ms"
