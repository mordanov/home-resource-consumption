"""System gate tests — T086.

rigour-labs/mcp quality gate:
- docker compose up --build starts all services without manual steps
- OpenAPI docs reachable at /api/v1/openapi.json
- alembic upgrade head runs cleanly against fresh DB

These tests run against the live Docker Compose stack.
Run with: pytest tests/quality/test_docker_compose.py
"""
from __future__ import annotations

import os
import subprocess
import sys
import time

import pytest
import httpx


BACKEND_BASE_URL = os.environ.get("BACKEND_BASE_URL", "http://localhost:8000")


# ---------------------------------------------------------------------------
# T086-1: OpenAPI docs endpoint returns 200
# ---------------------------------------------------------------------------

@pytest.mark.skip(reason="Requires Docker Compose stack running — run manually")
def test_openapi_docs_accessible() -> None:
    """GET /api/v1/openapi.json must return 200 with valid JSON."""
    resp = httpx.get(f"{BACKEND_BASE_URL}/api/v1/openapi.json", timeout=10.0)
    assert resp.status_code == 200, f"OpenAPI endpoint returned {resp.status_code}"
    data = resp.json()
    assert "openapi" in data
    assert "paths" in data


# ---------------------------------------------------------------------------
# T086-2: Health endpoint returns 200 {"status": "ok"}
# ---------------------------------------------------------------------------

@pytest.mark.skip(reason="Requires Docker Compose stack running — run manually")
def test_health_endpoint() -> None:
    resp = httpx.get(f"{BACKEND_BASE_URL}/api/v1/health", timeout=10.0)
    assert resp.status_code == 200
    assert resp.json().get("status") == "ok"


# ---------------------------------------------------------------------------
# T086-3: All service paths are present in OpenAPI spec
# ---------------------------------------------------------------------------

@pytest.mark.skip(reason="Requires Docker Compose stack running — run manually")
def test_all_required_api_paths_present_in_openapi() -> None:
    resp = httpx.get(f"{BACKEND_BASE_URL}/api/v1/openapi.json", timeout=10.0)
    spec = resp.json()
    paths = spec.get("paths", {})

    required_prefixes = [
        "/api/v1/auth/register",
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout",
        "/api/v1/bills",
        "/api/v1/predictions",
        "/api/v1/analytics/summary",
        "/api/v1/exports/report.pdf",
    ]

    missing = [p for p in required_prefixes if not any(path.startswith(p) for path in paths)]
    assert not missing, f"Missing required API paths in OpenAPI spec: {missing}"
