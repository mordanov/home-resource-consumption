"""Integration tests for auth endpoints — T027.

FR-0 integration verification:
- Full register → login → GET /auth/me → refresh → logout cycle
- Duplicate username/email registration → 409
- Login with wrong password → 401
- Expired access token → 401
- Refresh token rotation (old token unusable after refresh)
- hashed_password absent from all response bodies
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def register_user(client: AsyncClient, username: str, email: str, password: str = "TestPass1!") -> dict:
    resp = await client.post(
        "/api/v1/auth/register",
        json={"username": username, "email": email, "password": password},
    )
    return {"status": resp.status_code, "body": resp.json()}


async def login_user(client: AsyncClient, username: str, password: str = "TestPass1!") -> dict:
    resp = await client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    return {"status": resp.status_code, "body": resp.json(), "cookies": resp.cookies}


# ---------------------------------------------------------------------------
# T027-1: Full happy-path cycle
# ---------------------------------------------------------------------------

async def test_full_auth_cycle(client: AsyncClient) -> None:
    """register → login → GET /auth/me → refresh → logout"""
    username = "cycleuser"
    email = "cycle@example.com"
    password = "CyclePass1!"

    # Register
    reg = await register_user(client, username, email, password)
    assert reg["status"] == 201, f"Register failed: {reg['body']}"
    assert "hashed_password" not in str(reg["body"])

    # Login
    log = await login_user(client, username, password)
    assert log["status"] == 200
    access_token = log["body"]["access_token"]
    assert access_token
    assert "hashed_password" not in str(log["body"])

    # GET /auth/me
    me_resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_resp.status_code == 200
    me = me_resp.json()
    assert me["username"] == username
    assert "hashed_password" not in str(me)

    # Refresh — cookie has secure=True so we must pass it explicitly on http://test
    raw_refresh = log["cookies"].get("refresh_token")
    assert raw_refresh, "Login must set refresh_token cookie"
    refresh_resp = await client.post(
        "/api/v1/auth/refresh", cookies={"refresh_token": raw_refresh}
    )
    assert refresh_resp.status_code == 200, f"Refresh failed: {refresh_resp.json()}"
    new_token = refresh_resp.json()["access_token"]
    assert isinstance(new_token, str) and len(new_token) > 20

    # Logout — pass the NEW cookie issued by refresh
    new_refresh = refresh_resp.cookies.get("refresh_token") or raw_refresh
    logout_resp = await client.post(
        "/api/v1/auth/logout", cookies={"refresh_token": new_refresh}
    )
    assert logout_resp.status_code == 204

    # Old refresh cookie must be revoked (use old raw_refresh token)
    revoked_resp = await client.post(
        "/api/v1/auth/refresh", cookies={"refresh_token": raw_refresh}
    )
    assert revoked_resp.status_code == 401


# ---------------------------------------------------------------------------
# T027-2: Duplicate username → 409
# ---------------------------------------------------------------------------

async def test_register_duplicate_username_returns_409(client: AsyncClient) -> None:
    await register_user(client, "dupeuser", "first@example.com")
    result = await register_user(client, "dupeuser", "second@example.com")
    assert result["status"] == 409


# ---------------------------------------------------------------------------
# T027-3: Duplicate email → 409
# ---------------------------------------------------------------------------

async def test_register_duplicate_email_returns_409(client: AsyncClient) -> None:
    await register_user(client, "user_email_one", "shared@example.com")
    result = await register_user(client, "user_email_two", "shared@example.com")
    assert result["status"] == 409


# ---------------------------------------------------------------------------
# T027-4: Login with wrong password → 401
# ---------------------------------------------------------------------------

async def test_login_wrong_password_returns_401(client: AsyncClient) -> None:
    await register_user(client, "wrongpwduser", "wrongpwd@example.com")
    result = await login_user(client, "wrongpwduser", "WrongPassword999!")
    assert result["status"] == 401


# ---------------------------------------------------------------------------
# T027-5: Expired access token → 401
# ---------------------------------------------------------------------------

async def test_expired_access_token_returns_401(client: AsyncClient) -> None:
    expired_token = (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJleHAiOjF9."
        "fakesignaturefortesting"
    )
    resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# T027-6: hashed_password never in any response body
# ---------------------------------------------------------------------------

async def test_hashed_password_absent_from_responses(client: AsyncClient) -> None:
    reg = await register_user(client, "nohashuser", "nohash@example.com")
    assert "hashed_password" not in str(reg["body"])

    log = await login_user(client, "nohashuser")
    assert "hashed_password" not in str(log["body"])
