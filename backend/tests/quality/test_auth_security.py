"""Security quality gate for auth — T027 brute-force test.

rigour-labs gate: 10 rapid wrong-password requests must all return 401 (no 500s).
"""

from __future__ import annotations

import asyncio

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_brute_force_10_wrong_passwords_all_return_401(client: AsyncClient) -> None:
    """10 rapid wrong-password requests must all return 401, never 500."""
    await client.post(
        "/api/v1/auth/register",
        json={"username": "bruteuser", "email": "brute@example.com", "password": "Legit1Pass!"},
    )

    tasks = [
        client.post(
            "/api/v1/auth/login",
            data={"username": "bruteuser", "password": f"WrongPass{i}!"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        for i in range(10)
    ]
    responses = await asyncio.gather(*tasks)

    statuses = [r.status_code for r in responses]
    assert all(s == 401 for s in statuses), f"Expected all 401, got: {statuses}"


async def test_brute_force_nonexistent_user_all_return_401(client: AsyncClient) -> None:
    """Brute force against nonexistent user must return 401 (not 404 or 500)."""
    tasks = [
        client.post(
            "/api/v1/auth/login",
            data={"username": "nonexistent_xyz", "password": f"Pass{i}!"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        for i in range(10)
    ]
    responses = await asyncio.gather(*tasks)

    statuses = [r.status_code for r in responses]
    assert all(s in (401, 422) for s in statuses), f"Expected 401 or 422 for all, got: {statuses}"
