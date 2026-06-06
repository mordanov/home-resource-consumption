import math
from datetime import date
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile

from app.api.deps import get_bill_service, get_current_user
from app.domain.enums import ResourceType
from app.domain.models import User
from app.domain.schemas import BillPreview, BillRead, PaginatedResponse
from app.services.bill_service import BillService
from app.workers.tasks import cleanup_uploaded_file

router = APIRouter(prefix="/bills", tags=["bills"])


@router.post(
    "/upload",
    response_model=BillPreview,
    summary="Upload and parse a utility bill",
    description="Accepts a PDF or image file, extracts structured data via LLM, returns a preview.",
    responses={413: {"description": "File too large"}, 422: {"description": "Parse failed"}},
)
async def upload_bill(
    file: UploadFile = File(...),
    resource_type: ResourceType = Form(...),
    current_user: User = Depends(get_current_user),
    svc: BillService = Depends(get_bill_service),
) -> BillPreview:
    return await svc.upload_and_parse(file, resource_type, current_user.id)


@router.post(
    "/confirm",
    response_model=BillRead,
    status_code=201,
    summary="Confirm and save a parsed bill",
    description="Persists the reviewed bill data. Requires a valid BillPreview body.",
)
async def confirm_bill(
    preview: BillPreview,
    current_user: User = Depends(get_current_user),
    svc: BillService = Depends(get_bill_service),
) -> BillRead:
    return await svc.confirm(preview, current_user.id)


@router.get(
    "/",
    response_model=PaginatedResponse[BillRead],
    summary="List bills with pagination and filters",
)
async def list_bills(
    resource_type: ResourceType | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    size: int = 20,
    current_user: User = Depends(get_current_user),
    svc: BillService = Depends(get_bill_service),
) -> PaginatedResponse[BillRead]:
    items, total = await svc.get_paginated(
        current_user.id, resource_type, date_from, date_to, page, size
    )
    pages = math.ceil(total / size) if size else 0
    return PaginatedResponse(items=items, total=total, page=page, size=size, pages=pages)


@router.get(
    "/{bill_id}",
    response_model=BillRead,
    summary="Get a single bill by ID",
    responses={404: {"description": "Bill not found"}},
)
async def get_bill(
    bill_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: BillService = Depends(get_bill_service),
) -> BillRead:
    return await svc.get_by_id(bill_id, current_user.id)


@router.delete(
    "/{bill_id}",
    status_code=204,
    summary="Soft-delete a bill",
    responses={404: {"description": "Bill not found"}},
)
async def delete_bill(
    bill_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    svc: BillService = Depends(get_bill_service),
) -> None:
    file_path = await svc.delete(bill_id, current_user.id)
    if file_path:
        background_tasks.add_task(cleanup_uploaded_file, file_path)
