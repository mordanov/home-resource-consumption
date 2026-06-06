import json
from typing import cast

import openai
from openai.types.shared_params import ResponseFormatJSONSchema
from openai.types.shared_params.response_format_json_schema import JSONSchema
from pydantic import ValidationError

from app.core.config import settings
from app.core.exceptions import ParseError
from app.domain.schemas import BillPreview
from app.services.parser.base_parser import BaseParser

_BILL_SCHEMA = {
    "name": "bill_preview",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "resource_type": {"type": "string", "enum": ["ELECTRICITY", "GAS", "WATER"]},
            "bill_date": {"type": "string", "description": "ISO date YYYY-MM-DD"},
            "period_start": {"type": "string", "description": "ISO date YYYY-MM-DD"},
            "period_end": {"type": "string", "description": "ISO date YYYY-MM-DD"},
            "amount_consumed": {"type": "number", "description": "Quantity of resource consumed"},
            "unit": {"type": "string", "enum": ["KWH", "CUBIC_METER"]},
            "amount_paid": {"type": "number", "description": "Total amount paid"},
            "currency": {"type": "string", "description": "ISO 4217 currency code"},
        },
        "required": [
            "resource_type", "bill_date", "period_start", "period_end",
            "amount_consumed", "unit", "amount_paid", "currency",
        ],
        "additionalProperties": False,
    },
}

_SYSTEM_PROMPT = (
    "Extract utility bill data from the provided text. "
    "Return structured JSON matching the schema exactly. "
    "Dates must be ISO 8601 (YYYY-MM-DD). "
    "amount_consumed is the quantity used (kWh for electricity, m³ for gas/water). "
    "amount_paid is the total amount on the bill. "
    "If any required field cannot be determined, return a best estimate."
)


class LLMParserService(BaseParser):
    def __init__(self) -> None:
        self._client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def parse(self, text: str) -> BillPreview:
        response = await self._client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            temperature=0,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": text[:8000]},
            ],
            response_format=ResponseFormatJSONSchema(
                type="json_schema", json_schema=cast(JSONSchema, _BILL_SCHEMA)
            ),
        )
        raw = response.choices[0].message.content
        if not raw:
            raise ParseError("LLM returned empty response")
        return self._parse_response(raw, text)

    def _parse_response(self, raw: str, original_text: str) -> BillPreview:
        try:
            data = json.loads(raw)
            preview = BillPreview(**data, raw_text=original_text[:2000])
            return preview
        except (json.JSONDecodeError, ValidationError) as exc:
            raise ParseError(f"LLM response validation failed: {exc}") from exc
