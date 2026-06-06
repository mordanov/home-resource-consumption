import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import router as v1_router
from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    DateRangeExceededError,
    FileTooLargeError,
    ForbiddenError,
    InsufficientDataError,
    ParseError,
    ResourceNotFoundError,
    UnauthorizedError,
)

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    if len(settings.JWT_SECRET_KEY.encode()) < 32:
        raise RuntimeError(
            "JWT_SECRET_KEY must be at least 256 bits (32 bytes). "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    import subprocess
    subprocess.run(["alembic", "upgrade", "head"], check=True)
    logger.info("database.migrated")
    yield


app = FastAPI(
    title="Home Resource Consumption Tracker",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next: object) -> object:
    request_id = str(uuid.uuid4())
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id, path=request.url.path)
    from starlette.responses import Response
    response: Response = await call_next(request)  # type: ignore[operator]
    response.headers["X-Request-ID"] = request_id
    return response


def _problem(status: int, title: str, detail: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"type": "about:blank", "title": title, "status": status, "detail": detail},
        media_type="application/problem+json",
    )


@app.exception_handler(ResourceNotFoundError)
async def not_found_handler(request: Request, exc: ResourceNotFoundError) -> JSONResponse:
    return _problem(404, "Not Found", str(exc))


@app.exception_handler(ConflictError)
async def conflict_handler(request: Request, exc: ConflictError) -> JSONResponse:
    return _problem(409, "Conflict", exc.detail)


@app.exception_handler(UnauthorizedError)
async def unauthorized_handler(request: Request, exc: UnauthorizedError) -> JSONResponse:
    return _problem(401, "Unauthorized", exc.detail)


@app.exception_handler(ForbiddenError)
async def forbidden_handler(request: Request, exc: ForbiddenError) -> JSONResponse:
    return _problem(403, "Forbidden", exc.detail)


@app.exception_handler(InsufficientDataError)
async def insufficient_data_handler(
    request: Request, exc: InsufficientDataError
) -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content={
            "type": "about:blank",
            "title": "Insufficient Data",
            "status": 409,
            "detail": str(exc),
            "bills_needed": exc.bills_needed,
        },
        media_type="application/problem+json",
    )


@app.exception_handler(FileTooLargeError)
async def file_too_large_handler(request: Request, exc: FileTooLargeError) -> JSONResponse:
    return _problem(413, "Payload Too Large", str(exc))


@app.exception_handler(ParseError)
async def parse_error_handler(request: Request, exc: ParseError) -> JSONResponse:
    return _problem(422, "Unprocessable Entity", exc.detail)


@app.exception_handler(DateRangeExceededError)
async def date_range_handler(request: Request, exc: DateRangeExceededError) -> JSONResponse:
    return _problem(400, "Bad Request", str(exc))


@app.get("/api/v1/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(v1_router, prefix="/api/v1")
