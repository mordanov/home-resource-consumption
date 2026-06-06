from __future__ import annotations

from collections.abc import Iterator
from datetime import date
from typing import TYPE_CHECKING, cast

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_user, get_export_service
from app.domain.enums import ResourceType
from app.domain.models import User
from app.services.export_service import ReportSpec

if TYPE_CHECKING:
    from app.services.export_service import ExportService

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get(
    "/report.pdf",
    summary="Download consumption report as PDF",
    description="Generates a PDF report with analytics and predictions. Max 24-month window.",
    responses={
        200: {"content": {"application/pdf": {}}},
        400: {"description": "Date range exceeds 24 months"},
    },
)
async def download_report(
    date_from: date,
    date_to: date,
    resource_type: list[ResourceType] | None = None,
    current_user: User = Depends(get_current_user),
    svc: object = Depends(get_export_service),
) -> StreamingResponse:
    types = resource_type or list(ResourceType)
    spec = ReportSpec(
        user_id=current_user.id,
        date_from=date_from,
        date_to=date_to,
        resource_types=types,
    )
    export_svc = cast("ExportService", svc)
    pdf_bytes = await export_svc.generate(spec)

    def _iter() -> Iterator[bytes]:
        yield pdf_bytes

    return StreamingResponse(
        _iter(),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="report.pdf"'},
    )
