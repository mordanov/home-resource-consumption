"""Integration tests for bill upload endpoints — T045.

FR-1 / FR-2 verification:
- Upload synthetic PDF → BillPreview with correct fields (period_start, period_end,
  amount_consumed, amount_paid, user_id)
- Confirm preview → BillRead persisted in DB
- GET /bills/ as same user → bill present
- GET /bills/ as different user → bill absent (data isolation)
- DELETE /bills/{id} sets deleted_at (soft delete) → 204
- Deleted bill does not appear in subsequent GET /bills/
- Paginated listing filtered by resource_type
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def register_and_login(
    client: AsyncClient, username: str, email: str, password: str = "TestPass1!"
) -> str:
    """Register user and return access token."""
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


def make_synthetic_pdf() -> bytes:
    return (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n"
        b"   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
        b"4 0 obj\n<< /Length 82 >>\nstream\n"
        b"BT /F1 12 Tf 50 750 Td (Electricity Bill) Tj 0 -20 Td "
        b"(Period: 2025-01-01 to 2025-01-31) Tj ET\n"
        b"endstream\nendobj\n"
        b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
        b"xref\n0 6\n0000000000 65535 f \n"
        b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n0\n%%EOF\n"
    )


def make_bill_preview_payload(
    resource_type: str = "ELECTRICITY",
    amount_consumed: str = "250.0000",
    amount_paid: str = "45.0000",
) -> dict:
    today = date.today()
    return {
        "resource_type": resource_type,
        "bill_date": today.isoformat(),
        "period_start": (today - timedelta(days=30)).isoformat(),
        "period_end": today.isoformat(),
        "amount_consumed": amount_consumed,
        "unit": "KWH",
        "amount_paid": amount_paid,
        "currency": "EUR",
        "raw_text": "Extracted electricity bill text",
    }


# ---------------------------------------------------------------------------
# T045-1: Upload synthetic PDF → BillPreview with correct fields
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="Requires LLM mocking — upload endpoint calls real OpenAI")
async def test_upload_pdf_returns_bill_preview(client: AsyncClient) -> None:
    token = await register_and_login(client, "uploader1", "uploader1@example.com")

    pdf_bytes = make_synthetic_pdf()
    files = {"file": ("electricity_bill.pdf", pdf_bytes, "application/pdf")}
    data = {"resource_type": "ELECTRICITY"}

    resp = await client.post(
        "/api/v1/bills/upload",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
        data=data,
    )

    assert resp.status_code == 200, f"Upload failed: {resp.json()}"
    preview = resp.json()

    assert "resource_type" in preview
    assert "period_start" in preview
    assert "period_end" in preview
    assert "amount_consumed" in preview
    assert "amount_paid" in preview
    # hashed_password must never leak
    assert "hashed_password" not in str(preview)


# ---------------------------------------------------------------------------
# T045-2: Confirm bill preview → persisted BillRead
# ---------------------------------------------------------------------------


async def test_confirm_bill_preview_creates_bill(client: AsyncClient) -> None:
    token = await register_and_login(client, "confirmer1", "confirmer1@example.com")

    preview_payload = make_bill_preview_payload()
    confirm_resp = await client.post(
        "/api/v1/bills/confirm",
        headers={"Authorization": f"Bearer {token}"},
        json=preview_payload,
    )

    assert confirm_resp.status_code == 201, f"Confirm failed: {confirm_resp.json()}"
    bill = confirm_resp.json()
    assert "id" in bill
    assert bill["resource_type"] == "ELECTRICITY"
    assert "hashed_password" not in str(bill)


# ---------------------------------------------------------------------------
# T045-3: GET /bills/ shows bill for correct user
# ---------------------------------------------------------------------------


async def test_list_bills_shows_own_bills(client: AsyncClient) -> None:
    token = await register_and_login(client, "listuser1", "listuser1@example.com")

    # Create bill
    preview = make_bill_preview_payload()
    await client.post(
        "/api/v1/bills/confirm",
        headers={"Authorization": f"Bearer {token}"},
        json=preview,
    )

    # List
    list_resp = await client.get(
        "/api/v1/bills/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_resp.status_code == 200
    bills = list_resp.json()
    # PaginatedResponse or list
    items = bills.get("items", bills) if isinstance(bills, dict) else bills
    assert len(items) >= 1
    assert items[0]["resource_type"] == "ELECTRICITY"


# ---------------------------------------------------------------------------
# T045-4: DATA ISOLATION — GET /bills/ as different user never returns other user's bills
# ---------------------------------------------------------------------------


async def test_data_isolation_different_user_cannot_see_bills(client: AsyncClient) -> None:
    """User A's bills must never appear in User B's /bills/ response."""
    token_a = await register_and_login(client, "usera_iso", "usera@example.com")
    token_b = await register_and_login(client, "userb_iso", "userb@example.com")

    # User A uploads a bill
    preview = make_bill_preview_payload()
    create_resp = await client.post(
        "/api/v1/bills/confirm",
        headers={"Authorization": f"Bearer {token_a}"},
        json=preview,
    )
    assert create_resp.status_code == 201
    bill_id = create_resp.json()["id"]

    # User B must not see User A's bill in the list
    list_resp = await client.get(
        "/api/v1/bills/",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert list_resp.status_code == 200
    items = list_resp.json().get("items", [])
    bill_ids = [b["id"] for b in items]
    assert bill_id not in bill_ids, "User B can see User A's bill — data isolation violated"

    # User B cannot GET User A's bill by ID
    detail_resp = await client.get(
        f"/api/v1/bills/{bill_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert detail_resp.status_code == 404


# ---------------------------------------------------------------------------
# T045-5: DELETE soft-deletes bill → 204; deleted bill absent from listing
# ---------------------------------------------------------------------------


async def test_soft_delete_bill_returns_204_and_absent_from_list(client: AsyncClient) -> None:
    token = await register_and_login(client, "deleteuser1", "deleteuser1@example.com")

    # Create
    preview = make_bill_preview_payload()
    create_resp = await client.post(
        "/api/v1/bills/confirm",
        headers={"Authorization": f"Bearer {token}"},
        json=preview,
    )
    bill_id = create_resp.json()["id"]

    # Delete
    del_resp = await client.delete(
        f"/api/v1/bills/{bill_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_resp.status_code == 204

    # Verify absent from list
    list_resp = await client.get(
        "/api/v1/bills/",
        headers={"Authorization": f"Bearer {token}"},
    )
    items = list_resp.json().get("items", [])
    assert bill_id not in [b["id"] for b in items]


# ---------------------------------------------------------------------------
# T045-6: Filter by resource_type
# ---------------------------------------------------------------------------


async def test_list_bills_filter_by_resource_type(client: AsyncClient) -> None:
    token = await register_and_login(client, "filteruser1", "filteruser1@example.com")

    # Create electricity and gas bills
    for rt in ("ELECTRICITY", "GAS"):
        unit = "KWH" if rt == "ELECTRICITY" else "CUBIC_METER"
        preview = {
            **make_bill_preview_payload(resource_type=rt),
            "unit": unit,
        }
        await client.post(
            "/api/v1/bills/confirm",
            headers={"Authorization": f"Bearer {token}"},
            json=preview,
        )

    # Filter for GAS only
    list_resp = await client.get(
        "/api/v1/bills/?resource_type=GAS",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_resp.status_code == 200
    items = list_resp.json().get("items", list_resp.json())
    assert all(b["resource_type"] == "GAS" for b in items)
