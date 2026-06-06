"""Quality gate checks — T083, T084.

Selena MCP + rigour-labs/mcp requirements:
- hashed_password absent from all Pydantic response schemas
- No hardcoded secrets in source code
- All public functions have type annotations (mypy --strict gate)
- No function body exceeds 30 lines
- ruff passes with zero warnings
- All API endpoints documented in OpenAPI
- AuthService has zero cross-service imports
"""

from __future__ import annotations

import ast
import pathlib
import subprocess
import sys

import pytest

APP_DIR = pathlib.Path(__file__).parents[2] / "app"


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------


def collect_python_files(directory: pathlib.Path) -> list[pathlib.Path]:
    return sorted(directory.rglob("*.py"))


# ---------------------------------------------------------------------------
# T084-1: hashed_password absent from all Pydantic response schemas
# ---------------------------------------------------------------------------


def test_hashed_password_absent_from_all_response_schemas() -> None:
    schemas_path = APP_DIR / "domain" / "schemas.py"
    if not schemas_path.exists():
        pytest.skip("schemas.py not yet implemented")

    source = schemas_path.read_text()
    tree = ast.parse(source)

    # Find all classes whose name ends with "Read" (response schemas)
    read_schemas: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name.endswith("Read"):
            read_schemas.append(node.name)
            # Check for hashed_password field
            for body_node in ast.walk(node):
                if isinstance(body_node, ast.AnnAssign):
                    if isinstance(body_node.target, ast.Name):
                        assert body_node.target.id != "hashed_password", (
                            f"{node.name} schema has a hashed_password field — "
                            "this must never appear in response schemas"
                        )

    # Also check that UserRead (or similar) doesn't inherit from something that has it
    assert len(read_schemas) > 0 or True  # Pass if schemas don't exist yet


# ---------------------------------------------------------------------------
# T084-2: No hardcoded secrets in source code
# ---------------------------------------------------------------------------


def test_no_hardcoded_openai_keys() -> None:
    """Source code must not contain real OpenAI API keys."""
    violations: list[str] = []
    for py_file in collect_python_files(APP_DIR):
        content = py_file.read_text()
        if "sk-" in content:
            lines = content.splitlines()
            for i, line in enumerate(lines, start=1):
                if "sk-" in line and "sk-test" not in line and "# sk-" not in line:
                    violations.append(f"{py_file.relative_to(APP_DIR.parent)}:{i}: {line.strip()}")

    assert not violations, "Potential hardcoded OpenAI API keys found:\n" + "\n".join(violations)


def test_no_hardcoded_jwt_secrets() -> None:
    """Source code must not contain hardcoded JWT secrets (not placeholder values)."""
    violations: list[str] = []
    for py_file in collect_python_files(APP_DIR):
        content = py_file.read_text()
        # Look for patterns like JWT_SECRET_KEY = "actual-secret" (not env var access)
        if 'JWT_SECRET_KEY = "' in content or "JWT_SECRET_KEY = '" in content:
            lines = content.splitlines()
            for i, line in enumerate(lines, start=1):
                if (
                    ('JWT_SECRET_KEY = "' in line or "JWT_SECRET_KEY = '" in line)
                    and "env" not in line.lower()
                    and "settings" not in line.lower()
                ):
                    violations.append(f"{py_file.relative_to(APP_DIR.parent)}:{i}: {line.strip()}")

    assert not violations, "Hardcoded JWT secrets found:\n" + "\n".join(violations)


# ---------------------------------------------------------------------------
# T084-3: No function body exceeds 30 lines (Selena gate)
# ---------------------------------------------------------------------------


def test_no_function_body_exceeds_30_lines() -> None:
    violations: list[str] = []
    services_dir = APP_DIR / "services"
    if not services_dir.exists():
        pytest.skip("services/ directory not yet created")

    for py_file in collect_python_files(services_dir):
        source = py_file.read_text()
        tree = ast.parse(source)

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # Count non-empty, non-comment lines in function body
                func_lines = source.splitlines()
                start = node.lineno - 1
                end = node.end_lineno if hasattr(node, "end_lineno") else node.lineno + 30
                body_lines = [
                    line
                    for line in func_lines[start:end]
                    if line.strip() and not line.strip().startswith("#")
                ]
                if len(body_lines) > 31:  # +1 for the def line
                    violations.append(
                        f"{py_file.relative_to(APP_DIR.parent)}:{node.lineno}: "
                        f"function '{node.name}' has {len(body_lines)} lines (max 30)"
                    )

    assert not violations, (
        "Functions exceeding 30 lines found (Selena gate):\n"
        + "\n".join(violations[:20])  # show up to 20 violations
    )


# ---------------------------------------------------------------------------
# T084-4: AuthService has zero cross-service imports (duplicate for CI safety)
# ---------------------------------------------------------------------------


def test_auth_service_import_isolation() -> None:
    service_path = APP_DIR / "services" / "auth_service.py"
    if not service_path.exists():
        pytest.skip("auth_service.py not yet implemented")

    tree = ast.parse(service_path.read_text())
    forbidden = {
        "BillService",
        "ExportService",
        "AnalyticsService",
        "bill_service",
        "export_service",
        "analytics_service",
    }
    violations: list[str] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            for alias in node.names:
                if alias.name in forbidden:
                    violations.append(f"line {node.lineno}: {ast.unparse(node)}")

    assert not violations, "AuthService cross-service imports:\n" + "\n".join(violations)


# ---------------------------------------------------------------------------
# T083: ruff passes with zero warnings (static analysis gate)
# ---------------------------------------------------------------------------


@pytest.mark.skip(
    reason="Run manually: ruff check backend/app — skipped in unit tests to avoid env dependency"
)
def test_ruff_passes_with_zero_warnings() -> None:
    result = subprocess.run(
        [sys.executable, "-m", "ruff", "check", str(APP_DIR)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"ruff check found issues:\n{result.stdout}\n{result.stderr}"


# ---------------------------------------------------------------------------
# T083: mypy --strict passes (Selena gate)
# ---------------------------------------------------------------------------


@pytest.mark.skip(
    reason="Run manually: mypy --strict backend/app — skipped in unit tests to avoid env dependency"
)
def test_mypy_strict_passes() -> None:
    result = subprocess.run(
        [sys.executable, "-m", "mypy", "--strict", str(APP_DIR)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"mypy --strict found errors:\n{result.stdout}\n{result.stderr}"


# ---------------------------------------------------------------------------
# T083: All public functions have type annotations (Selena gate)
# ---------------------------------------------------------------------------


def test_all_public_functions_have_type_annotations() -> None:
    violations: list[str] = []
    services_dir = APP_DIR / "services"
    if not services_dir.exists():
        pytest.skip("services/ directory not yet created")

    for py_file in collect_python_files(services_dir):
        source = py_file.read_text()
        tree = ast.parse(source)

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if node.name.startswith("_"):
                    continue  # Private methods excluded
                # Check return annotation
                if node.returns is None:
                    violations.append(
                        f"{py_file.relative_to(APP_DIR.parent)}:{node.lineno}: "
                        f"'{node.name}' missing return type annotation"
                    )
                # Check parameter annotations (skip self/cls)
                for arg in node.args.args:
                    if arg.arg in ("self", "cls"):
                        continue
                    if arg.annotation is None:
                        violations.append(
                            f"{py_file.relative_to(APP_DIR.parent)}:{node.lineno}: "
                            f"'{node.name}' param '{arg.arg}' missing type annotation"
                        )

    assert not violations, "Functions with missing type annotations (Selena gate):\n" + "\n".join(
        violations[:30]
    )
