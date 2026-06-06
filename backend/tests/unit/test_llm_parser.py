"""Unit tests for LLMParserService — T044.

FR-1 verification:
- Valid LLM response → returns correct BillPreview
- Malformed JSON response from LLM → raises ParseError
- Missing required field in LLM response → raises ParseError
- Achieves ≥ 90% branch coverage on llm_parser.py
- No live OpenAI calls in any test (all mocked)
"""
from __future__ import annotations

import json
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _import_llm_parser():
    try:
        from app.services.parser.llm_parser import LLMParserService  # type: ignore[import]
        return LLMParserService
    except ModuleNotFoundError:
        pytest.skip("LLMParserService not yet implemented")


def _import_parse_error():
    try:
        from app.core.exceptions import ParseError  # type: ignore[import]
        return ParseError
    except ModuleNotFoundError:
        pytest.skip("ParseError exception not yet implemented")


def _make_valid_response_content() -> str:
    """Valid response matching the _BILL_SCHEMA (no raw_text — LLM doesn't return it)."""
    today = date.today()
    return json.dumps({
        "resource_type": "ELECTRICITY",
        "bill_date": today.isoformat(),
        "period_start": (today - timedelta(days=30)).isoformat(),
        "period_end": today.isoformat(),
        "amount_consumed": 250.0,
        "unit": "KWH",
        "amount_paid": 45.0,
        "currency": "EUR",
    })


def _make_mock_openai_response(content: str) -> MagicMock:
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock()]
    mock_resp.choices[0].message.content = content
    return mock_resp


# ---------------------------------------------------------------------------
# T044-1: Valid LLM response → returns BillPreview with correct fields
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_valid_response_returns_bill_preview() -> None:
    LLMParserService = _import_llm_parser()
    mock_client = MagicMock()
    mock_client.chat = MagicMock()
    mock_client.chat.completions = MagicMock()
    mock_client.chat.completions.create = AsyncMock(
        return_value=_make_mock_openai_response(_make_valid_response_content())
    )

    with patch("openai.AsyncOpenAI", return_value=mock_client):
        service = LLMParserService()
        result = await service.parse("Sample electricity bill text here")

    assert result is not None
    assert result.resource_type == "ELECTRICITY" or str(result.resource_type) == "ELECTRICITY"
    assert result.amount_consumed is not None
    assert result.amount_paid is not None
    assert result.currency == "EUR"
    assert result.unit == "KWH" or str(result.unit) == "KWH"


# ---------------------------------------------------------------------------
# T044-2: Malformed JSON response → ParseError
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_malformed_json_raises_parse_error() -> None:
    LLMParserService = _import_llm_parser()
    ParseError = _import_parse_error()

    mock_client = MagicMock()
    mock_client.chat = MagicMock()
    mock_client.chat.completions = MagicMock()
    mock_client.chat.completions.create = AsyncMock(
        return_value=_make_mock_openai_response("this is not valid JSON }{")
    )

    with patch("openai.AsyncOpenAI", return_value=mock_client):
        service = LLMParserService()
        with pytest.raises(ParseError):
            await service.parse("Some bill text")


# ---------------------------------------------------------------------------
# T044-3: Missing required field → ParseError
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_missing_required_field_raises_parse_error() -> None:
    LLMParserService = _import_llm_parser()
    ParseError = _import_parse_error()

    # Missing amount_consumed and amount_paid
    incomplete_data = json.dumps({
        "resource_type": "ELECTRICITY",
        "bill_date": date.today().isoformat(),
        "currency": "EUR",
        # amount_consumed intentionally missing
        # amount_paid intentionally missing
    })

    mock_client = MagicMock()
    mock_client.chat = MagicMock()
    mock_client.chat.completions = MagicMock()
    mock_client.chat.completions.create = AsyncMock(
        return_value=_make_mock_openai_response(incomplete_data)
    )

    with patch("openai.AsyncOpenAI", return_value=mock_client):
        service = LLMParserService()
        with pytest.raises(ParseError):
            await service.parse("Some bill text")


# ---------------------------------------------------------------------------
# T044-4: OpenAI returns empty content → ParseError
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_empty_content_raises_parse_error() -> None:
    LLMParserService = _import_llm_parser()
    ParseError = _import_parse_error()

    mock_client = MagicMock()
    mock_client.chat = MagicMock()
    mock_client.chat.completions = MagicMock()
    mock_client.chat.completions.create = AsyncMock(
        return_value=_make_mock_openai_response("")
    )

    with patch("openai.AsyncOpenAI", return_value=mock_client):
        service = LLMParserService()
        with pytest.raises(ParseError):
            await service.parse("Some bill text")


# ---------------------------------------------------------------------------
# T044-5: OpenAI returns None content → ParseError
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_none_content_raises_parse_error() -> None:
    LLMParserService = _import_llm_parser()
    ParseError = _import_parse_error()

    mock_client = MagicMock()
    mock_client.chat = MagicMock()
    mock_client.chat.completions = MagicMock()
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock()]
    mock_resp.choices[0].message.content = None
    mock_client.chat.completions.create = AsyncMock(return_value=mock_resp)

    with patch("openai.AsyncOpenAI", return_value=mock_client):
        service = LLMParserService()
        with pytest.raises(ParseError):
            await service.parse("Some bill text")


# ---------------------------------------------------------------------------
# T044-6: Valid GAS bill response → returns correct resource type
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gas_bill_returns_correct_resource_type() -> None:
    LLMParserService = _import_llm_parser()

    today = date.today()
    gas_data = json.dumps({
        "resource_type": "GAS",
        "bill_date": today.isoformat(),
        "period_start": (today - timedelta(days=60)).isoformat(),
        "period_end": today.isoformat(),
        "amount_consumed": 85.5,
        "unit": "CUBIC_METER",
        "amount_paid": 120.0,
        "currency": "EUR",
    })

    mock_client = MagicMock()
    mock_client.chat = MagicMock()
    mock_client.chat.completions = MagicMock()
    mock_client.chat.completions.create = AsyncMock(
        return_value=_make_mock_openai_response(gas_data)
    )

    with patch("openai.AsyncOpenAI", return_value=mock_client):
        service = LLMParserService()
        result = await service.parse("Gas bill text here")

    # ResourceType is an enum; compare against enum value string
    assert result.resource_type.value == "GAS" or str(result.resource_type) in ("GAS", "ResourceType.GAS")
    assert result.unit.value == "CUBIC_METER" or str(result.unit) in ("CUBIC_METER", "Unit.CUBIC_METER")


# ---------------------------------------------------------------------------
# T044-7: Invalid resource_type value in response → ParseError
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_invalid_resource_type_raises_parse_error() -> None:
    LLMParserService = _import_llm_parser()
    ParseError = _import_parse_error()

    bad_data = json.dumps({
        "resource_type": "NUCLEAR",  # not a valid enum value
        "bill_date": date.today().isoformat(),
        "period_start": (date.today() - timedelta(days=30)).isoformat(),
        "period_end": date.today().isoformat(),
        "amount_consumed": 999.0,
        "unit": "KWH",
        "amount_paid": 500.0,
        "currency": "EUR",
        # Note: raw_text omitted — matches _BILL_SCHEMA (additionalProperties: false)
    })

    mock_client = MagicMock()
    mock_client.chat = MagicMock()
    mock_client.chat.completions = MagicMock()
    mock_client.chat.completions.create = AsyncMock(
        return_value=_make_mock_openai_response(bad_data)
    )

    with patch("openai.AsyncOpenAI", return_value=mock_client):
        service = LLMParserService()
        with pytest.raises(ParseError):
            await service.parse("Strange bill text")


# ---------------------------------------------------------------------------
# T044-8: No live OpenAI calls guard (meta-test)
# ---------------------------------------------------------------------------

def test_no_live_openai_key_used_in_tests() -> None:
    """OpenAI API key in tests must not be a real key."""
    import os

    api_key = os.environ.get("OPENAI_API_KEY", "")
    assert not api_key.startswith("sk-") or api_key == "sk-test-fake-key-for-unit-tests-only", (
        "Real OpenAI API key detected in test environment. "
        "Tests must use mocks, not live API calls."
    )
