from datetime import UTC, date, datetime
from uuid import UUID

import pymupdf
import pytesseract
from fastapi import UploadFile
from PIL import Image

from app.core.config import settings
from app.core.exceptions import FileTooLargeError, ParseError
from app.domain.enums import ResourceType
from app.domain.models import Bill
from app.domain.schemas import BillPreview, BillRead, BillUpdate
from app.repositories.bill_repository import BillRepository
from app.services.parser.parser_factory import ParserFactory

_ALLOWED_MIME = {"application/pdf", "image/jpeg", "image/png"}


class BillService:
    def __init__(self, bill_repo: BillRepository, parser_factory: ParserFactory) -> None:
        self.bill_repo = bill_repo
        self.parser_factory = parser_factory

    async def upload_and_parse(
        self, file: UploadFile, resource_type: ResourceType, user_id: UUID
    ) -> BillPreview:
        content = await file.read()
        if len(content) > settings.max_upload_bytes:
            raise FileTooLargeError(settings.MAX_UPLOAD_SIZE_MB)
        mime = file.content_type or ""
        if mime not in _ALLOWED_MIME:
            raise ParseError(f"Unsupported file type: {mime}. Allowed: PDF, JPEG, PNG")
        text = self._extract_text(content, mime)
        parser = self.parser_factory.get(resource_type)
        preview = await parser.parse(text)
        return preview

    def _extract_text(self, content: bytes, mime: str) -> str:
        if mime == "application/pdf":
            return self._extract_pdf_text(content)
        return self._extract_image_text(content)

    def _extract_pdf_text(self, content: bytes) -> str:
        doc = pymupdf.open(stream=content, filetype="pdf")  # type: ignore[no-untyped-call]
        pages = [doc[i].get_text() for i in range(doc.page_count)]  # type: ignore[no-untyped-call]
        return "\n".join(pages)

    def _extract_image_text(self, content: bytes) -> str:
        import io

        image = Image.open(io.BytesIO(content))
        return str(pytesseract.image_to_string(image))

    async def confirm(self, preview: BillPreview, user_id: UUID) -> BillRead:
        now = datetime.now(UTC)
        bill = Bill(
            user_id=user_id,
            resource_type=preview.resource_type.value,
            bill_date=preview.bill_date,
            period_start=preview.period_start,
            period_end=preview.period_end,
            amount_consumed=float(preview.amount_consumed),
            unit=preview.unit.value,
            amount_paid=float(preview.amount_paid),
            currency=preview.currency,
            raw_text=preview.raw_text,
            created_at=now,
            updated_at=now,
        )
        await self.bill_repo.create(bill)
        return BillRead.model_validate(bill)

    async def get_paginated(
        self,
        user_id: UUID,
        resource_type: ResourceType | None,
        date_from: date | None,
        date_to: date | None,
        page: int,
        size: int,
    ) -> tuple[list[BillRead], int]:
        bills, total = await self.bill_repo.list_paginated(
            user_id,
            resource_type,
            date_from,
            date_to,
            page,
            size,
        )
        return [BillRead.model_validate(b) for b in bills], total

    async def get_by_id(self, bill_id: UUID, user_id: UUID) -> BillRead:
        from app.core.exceptions import ResourceNotFoundError

        bill = await self.bill_repo.get_active(bill_id, user_id)
        if not bill:
            raise ResourceNotFoundError("Bill", str(bill_id))
        return BillRead.model_validate(bill)

    async def update(self, bill_id: UUID, user_id: UUID, data: BillUpdate) -> BillRead:
        from app.core.exceptions import ResourceNotFoundError

        bill = await self.bill_repo.get_active(bill_id, user_id)
        if not bill:
            raise ResourceNotFoundError("Bill", str(bill_id))
        if data.resource_type is not None:
            bill.resource_type = data.resource_type.value
        if data.bill_date is not None:
            bill.bill_date = data.bill_date  # type: ignore[assignment]
        if data.period_start is not None:
            bill.period_start = data.period_start  # type: ignore[assignment]
        if data.period_end is not None:
            bill.period_end = data.period_end  # type: ignore[assignment]
        if data.amount_consumed is not None:
            bill.amount_consumed = float(data.amount_consumed)
        if data.unit is not None:
            bill.unit = data.unit.value
        if data.amount_paid is not None:
            bill.amount_paid = float(data.amount_paid)
        if data.currency is not None:
            bill.currency = data.currency
        await self.bill_repo.update(bill)
        return BillRead.model_validate(bill)

    async def delete(self, bill_id: UUID, user_id: UUID) -> str | None:
        from app.core.exceptions import ResourceNotFoundError

        bill = await self.bill_repo.get_active(bill_id, user_id)
        if not bill:
            raise ResourceNotFoundError("Bill", str(bill_id))
        file_path = bill.source_file_path
        await self.bill_repo.soft_delete(bill_id, user_id)
        return file_path
