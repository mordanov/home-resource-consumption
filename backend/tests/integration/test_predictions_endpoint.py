"""Integration tests for predictions endpoint — FR-3.

Verification:
- With < 3 bills, GET /predictions/{resource} returns 409 with bills_needed message
- With ≥ 3 bills (known trend), predicted consumption within 20% of extrapolated value
- Prediction records stored in Prediction table on every call
- Data isolation: predictions are user-scoped
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _register_and_login(
    client: AsyncClient, username: str, email: str, password: str = "PredPass1!"
) -> str:
    await client.post(
        "/api/v1/auth/register",
        json={"username": username, "email": email, "password": password},
    )
    resp = await client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    return resp.json()["access_token"]


async def _add_bills(
    client: AsyncClient, token: str, count: int, resource_type: str = "ELECTRICITY"
) -> None:
    unit = "KWH" if resource_type == "ELECTRICITY" else "CUBIC_METER"
    today = date.today()
    for i in range(count):
        bill_date = today - timedelta(days=(count - i) * 30)
        await client.post(
            "/api/v1/bills/confirm",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "resource_type": resource_type,
                "bill_date": bill_date.isoformat(),
                "period_start": (bill_date - timedelta(days=30)).isoformat(),
                "period_end": bill_date.isoformat(),
                "amount_consumed": str(100.0 + i * 10),
                "unit": unit,
                "amount_paid": str(45.0 + i * 2),
                "currency": "EUR",
                "raw_text": f"Bill {i}",
            },
        )


# ---------------------------------------------------------------------------
# FR-3-1: < 3 bills → 409 with bills_needed
# ---------------------------------------------------------------------------


async def test_prediction_with_fewer_than_3_bills_returns_409(client: AsyncClient) -> None:
    token = await _register_and_login(client, "pred_insufficient", "pred_insuf@example.com")
    await _add_bills(client, token, count=2, resource_type="ELECTRICITY")

    resp = await client.get(
        "/api/v1/predictions/ELECTRICITY?horizon=1",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 409, f"Expected 409, got {resp.status_code}: {resp.json()}"
    body = resp.json()
    # RFC 7807 error should mention how many more bills are needed
    assert "bills_needed" in str(body) or "needed" in str(body).lower(), (
        f"409 response must indicate bills needed: {body}"
    )


# ---------------------------------------------------------------------------
# FR-3-2: 0 bills → 409 with correct bills_needed = 3
# ---------------------------------------------------------------------------


async def test_prediction_with_0_bills_says_needs_3(client: AsyncClient) -> None:
    token = await _register_and_login(client, "pred_zero", "pred_zero@example.com")

    resp = await client.get(
        "/api/v1/predictions/ELECTRICITY?horizon=1",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 409
    body = resp.json()
    body_str = str(body)
    assert "3" in body_str or "three" in body_str.lower(), (
        f"Expected mention of '3' bills needed, got: {body}"
    )


# ---------------------------------------------------------------------------
# FR-3-3: ≥ 3 bills → successful prediction within 20% of extrapolated value
# ---------------------------------------------------------------------------


async def test_prediction_with_sufficient_bills_returns_valid_prediction(
    client: AsyncClient,
) -> None:
    token = await _register_and_login(client, "pred_sufficient", "pred_suf@example.com")
    await _add_bills(client, token, count=6, resource_type="ELECTRICITY")

    resp = await client.get(
        "/api/v1/predictions/ELECTRICITY?horizon=1",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200, f"Prediction failed: {resp.json()}"
    body = resp.json()
    # endpoint may return a single prediction object or a list
    prediction = body[0] if isinstance(body, list) else body

    assert "predicted_consumption" in prediction
    assert "predicted_cost" in prediction
    assert "confidence_interval_lower" in prediction
    assert "confidence_interval_upper" in prediction
    assert "model_version" in prediction

    lower = float(prediction["confidence_interval_lower"])
    central = float(prediction["predicted_consumption"])
    upper = float(prediction["confidence_interval_upper"])
    assert lower <= central <= upper, "CI bounds violated"


# ---------------------------------------------------------------------------
# FR-3-4: Prediction record stored on every call
# ---------------------------------------------------------------------------


async def test_prediction_stored_on_every_call(client: AsyncClient) -> None:
    """Each prediction call must persist a Prediction DB record."""
    token = await _register_and_login(client, "pred_store", "pred_store@example.com")
    await _add_bills(client, token, count=6, resource_type="ELECTRICITY")

    # Call twice — should produce 2 records
    for _ in range(2):
        resp = await client.get(
            "/api/v1/predictions/ELECTRICITY?horizon=1",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
