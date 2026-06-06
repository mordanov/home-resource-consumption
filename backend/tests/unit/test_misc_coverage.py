"""Unit tests to close coverage gaps in chart_renderer, prediction_service,
export_service, exceptions, and workers/tasks."""

from __future__ import annotations

import os
import tempfile
import uuid
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_monthly_point(month: str, value: float, resource_type: str = "ELECTRICITY"):
    from app.domain.enums import ResourceType
    from app.domain.schemas import MonthlyDataPoint

    return MonthlyDataPoint(
        month=month,
        value=Decimal(str(value)),
        resource_type=ResourceType(resource_type),
    )


# ---------------------------------------------------------------------------
# ChartRenderer
# ---------------------------------------------------------------------------


class TestChartRenderer:
    def test_render_consumption_trend_returns_svg(self) -> None:
        from app.services.chart_renderer import ChartRenderer

        renderer = ChartRenderer()
        points = [
            _make_monthly_point("2024-01", 100.0),
            _make_monthly_point("2024-02", 120.0),
            _make_monthly_point("2024-01", 50.0, "GAS"),
        ]
        svg = renderer.render_consumption_trend(points)
        assert svg.strip().startswith("<")
        assert "svg" in svg.lower()

    def test_render_consumption_trend_empty_data(self) -> None:
        from app.services.chart_renderer import ChartRenderer

        renderer = ChartRenderer()
        svg = renderer.render_consumption_trend([])
        assert "svg" in svg.lower()

    def test_render_monthly_cost_returns_svg(self) -> None:
        from app.services.chart_renderer import ChartRenderer

        renderer = ChartRenderer()
        points = [
            _make_monthly_point("2024-01", 45.0),
            _make_monthly_point("2024-02", 55.0),
            _make_monthly_point("2024-01", 30.0, "GAS"),
        ]
        svg = renderer.render_monthly_cost(points)
        assert "svg" in svg.lower()

    def test_render_monthly_cost_empty_data(self) -> None:
        from app.services.chart_renderer import ChartRenderer

        renderer = ChartRenderer()
        svg = renderer.render_monthly_cost([])
        assert "svg" in svg.lower()


# ---------------------------------------------------------------------------
# PredictionService
# ---------------------------------------------------------------------------


def _make_mock_bill(bill_date: date, amount_consumed: float = 100.0):
    bill = MagicMock()
    bill.id = uuid.uuid4()
    bill.user_id = uuid.uuid4()
    bill.resource_type = "ELECTRICITY"
    bill.bill_date = bill_date
    bill.amount_consumed = Decimal(str(amount_consumed))
    bill.amount_paid = Decimal("45.00")
    bill.deleted_at = None
    return bill


def _make_prediction_result(horizon: int = 1):
    result = MagicMock()
    result.predicted_consumption = Decimal("220.0")
    result.predicted_cost = Decimal("50.0")
    result.confidence_interval_lower = Decimal("200.0")
    result.confidence_interval_upper = Decimal("240.0")
    result.model_version = "linear-v1"
    return result


@pytest.mark.asyncio
async def test_prediction_service_raises_insufficient_data_when_fewer_than_3_bills() -> None:
    from app.core.exceptions import InsufficientDataError
    from app.domain.enums import ResourceType
    from app.services.prediction_service import PredictionService

    bill_repo = MagicMock()
    bill_repo.list_for_user_and_type = AsyncMock(return_value=[_make_mock_bill(date.today())])
    prediction_repo = MagicMock()
    predictor = MagicMock()

    service = PredictionService(bill_repo, prediction_repo, predictor)

    with pytest.raises(InsufficientDataError) as exc_info:
        await service.predict(uuid.uuid4(), ResourceType.ELECTRICITY, horizon=1)

    assert exc_info.value.needed == 3
    assert exc_info.value.have == 1


@pytest.mark.asyncio
async def test_prediction_service_returns_predictions_for_each_horizon() -> None:
    from app.domain.enums import ResourceType
    from app.services.prediction_service import PredictionService

    today = date.today()
    bills = [_make_mock_bill(today - timedelta(days=i * 30), 100.0 + i * 10) for i in range(6)]

    bill_repo = MagicMock()
    bill_repo.list_for_user_and_type = AsyncMock(return_value=bills)

    prediction_repo = MagicMock()
    prediction_repo.create_prediction = AsyncMock()

    predictor = MagicMock()
    predictor.fit = MagicMock()
    predictor.predict = MagicMock(side_effect=_make_prediction_result)

    service = PredictionService(bill_repo, prediction_repo, predictor)

    with patch("app.services.prediction_service.PredictionRead.model_validate") as mock_validate:
        mock_validate.return_value = MagicMock()
        results = await service.predict(uuid.uuid4(), ResourceType.ELECTRICITY, horizon=3)

    assert len(results) == 3
    assert predictor.fit.call_count == 1
    assert predictor.predict.call_count == 3
    assert prediction_repo.create_prediction.call_count == 3


# ---------------------------------------------------------------------------
# ExportService — _validate_date_range
# ---------------------------------------------------------------------------


def test_export_service_validate_date_range_raises_when_exceeded() -> None:
    from app.core.exceptions import DateRangeExceededError
    from app.services.export_service import ExportService

    analytics = MagicMock()
    chart_renderer = MagicMock()
    service = ExportService(analytics, chart_renderer)

    date_from = date(2022, 1, 1)
    date_to = date(2024, 6, 1)  # > 24 months

    with pytest.raises(DateRangeExceededError):
        service._validate_date_range(date_from, date_to)


def test_export_service_validate_date_range_passes_for_valid_range() -> None:
    from app.services.export_service import ExportService

    analytics = MagicMock()
    chart_renderer = MagicMock()
    service = ExportService(analytics, chart_renderer)

    date_from = date(2024, 1, 1)
    date_to = date(2024, 12, 31)

    service._validate_date_range(date_from, date_to)  # must not raise


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


def test_forbidden_error_message() -> None:
    from app.core.exceptions import ForbiddenError

    err = ForbiddenError("not allowed")
    assert "not allowed" in str(err)
    assert err.detail == "not allowed"


def test_forbidden_error_default() -> None:
    from app.core.exceptions import ForbiddenError

    err = ForbiddenError()
    assert "Forbidden" in str(err)


def test_file_too_large_error() -> None:
    from app.core.exceptions import FileTooLargeError

    err = FileTooLargeError(max_mb=10)
    assert "10" in str(err)
    assert err.max_mb == 10


def test_date_range_exceeded_error() -> None:
    from app.core.exceptions import DateRangeExceededError

    err = DateRangeExceededError(max_months=24)
    assert "24" in str(err)
    assert err.max_months == 24


# ---------------------------------------------------------------------------
# workers/tasks
# ---------------------------------------------------------------------------


def test_cleanup_uploaded_file_removes_existing_file() -> None:
    from app.workers.tasks import cleanup_uploaded_file

    with tempfile.NamedTemporaryFile(delete=False) as f:
        path = f.name

    assert os.path.isfile(path)
    cleanup_uploaded_file(path)
    assert not os.path.isfile(path)


def test_cleanup_uploaded_file_is_noop_for_nonexistent_path() -> None:
    from app.workers.tasks import cleanup_uploaded_file

    cleanup_uploaded_file("/tmp/nonexistent_file_that_does_not_exist_abc123.txt")


def test_cleanup_uploaded_file_handles_oserror(tmp_path) -> None:
    from app.workers.tasks import cleanup_uploaded_file

    path = str(tmp_path / "test.txt")
    (tmp_path / "test.txt").write_text("data")

    with patch("os.remove", side_effect=OSError("permission denied")):
        cleanup_uploaded_file(path)  # must not raise


# ---------------------------------------------------------------------------
# BillService — confirm and get_paginated (no file I/O)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_bill_service_confirm_creates_bill_and_returns_read() -> None:
    from app.domain.enums import ResourceType, Unit
    from app.domain.schemas import BillPreview
    from app.services.bill_service import BillService

    bill_repo = MagicMock()
    created_bill = MagicMock()
    created_bill.id = uuid.uuid4()
    created_bill.user_id = uuid.uuid4()
    created_bill.resource_type = "ELECTRICITY"
    created_bill.bill_date = date.today()
    created_bill.period_start = date.today() - timedelta(days=30)
    created_bill.period_end = date.today()
    created_bill.amount_consumed = Decimal("250.0")
    created_bill.unit = "KWH"
    created_bill.amount_paid = Decimal("45.0")
    created_bill.currency = "EUR"
    created_bill.raw_text = "bill text"
    created_bill.source_file_path = None
    created_bill.deleted_at = None
    created_bill.created_at = None
    created_bill.updated_at = None
    bill_repo.create = AsyncMock(return_value=created_bill)

    parser_factory = MagicMock()
    service = BillService(bill_repo, parser_factory)

    preview = BillPreview(
        resource_type=ResourceType.ELECTRICITY,
        bill_date=date.today(),
        period_start=date.today() - timedelta(days=30),
        period_end=date.today(),
        amount_consumed=Decimal("250.0"),
        unit=Unit.KWH,
        amount_paid=Decimal("45.0"),
        currency="EUR",
        raw_text="bill text",
    )

    with patch("app.services.bill_service.BillRead.model_validate") as mock_validate:
        mock_validate.return_value = MagicMock()
        result = await service.confirm(preview, uuid.uuid4())

    assert result is not None
    bill_repo.create.assert_called_once()


@pytest.mark.asyncio
async def test_bill_service_get_paginated_returns_bills() -> None:
    from app.domain.enums import ResourceType
    from app.services.bill_service import BillService

    mock_bill = MagicMock()
    bill_repo = MagicMock()
    bill_repo.list_paginated = AsyncMock(return_value=([mock_bill], 1))

    parser_factory = MagicMock()
    service = BillService(bill_repo, parser_factory)

    with patch("app.services.bill_service.BillRead.model_validate") as mock_validate:
        mock_validate.return_value = MagicMock()
        bills, total = await service.get_paginated(
            user_id=uuid.uuid4(),
            resource_type=ResourceType.ELECTRICITY,
            date_from=None,
            date_to=None,
            page=1,
            size=20,
        )

    assert total == 1
    assert len(bills) == 1


@pytest.mark.asyncio
async def test_bill_service_get_by_id_raises_not_found() -> None:
    from app.core.exceptions import ResourceNotFoundError
    from app.services.bill_service import BillService

    bill_repo = MagicMock()
    bill_repo.get_active = AsyncMock(return_value=None)

    service = BillService(bill_repo, MagicMock())

    with pytest.raises(ResourceNotFoundError):
        await service.get_by_id(uuid.uuid4(), uuid.uuid4())


@pytest.mark.asyncio
async def test_bill_service_delete_raises_not_found() -> None:
    from app.core.exceptions import ResourceNotFoundError
    from app.services.bill_service import BillService

    bill_repo = MagicMock()
    bill_repo.get_active = AsyncMock(return_value=None)

    service = BillService(bill_repo, MagicMock())

    with pytest.raises(ResourceNotFoundError):
        await service.delete(uuid.uuid4(), uuid.uuid4())
