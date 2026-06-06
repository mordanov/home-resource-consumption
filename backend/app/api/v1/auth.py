from fastapi import APIRouter, Cookie, Depends, Response
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import get_auth_service, get_current_user
from app.core.config import settings
from app.core.exceptions import UnauthorizedError
from app.domain.models import User
from app.domain.schemas import TokenResponse, UserCreate, UserRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_NAME = "refresh_token"
_COOKIE_OPTS: dict[str, object] = {
    "httponly": True,
    "secure": True,
    "samesite": "strict",
    "max_age": settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    "path": "/api/v1/auth",
}


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(_COOKIE_NAME, token, **_COOKIE_OPTS)  # type: ignore[arg-type]


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(_COOKIE_NAME, path="/api/v1/auth")


@router.post(
    "/register",
    response_model=UserRead,
    status_code=201,
    summary="Register a new user",
    description="Creates a new user account. Returns the created user (no password).",
    responses={409: {"description": "Username or email already taken"}},
)
async def register(
    body: UserCreate,
    svc: AuthService = Depends(get_auth_service),
) -> UserRead:
    return await svc.register(body.username, body.email, body.password)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and obtain tokens",
    description="Returns a JWT access token and sets an HttpOnly refresh token cookie.",
    responses={401: {"description": "Invalid credentials"}},
)
async def login(
    response: Response,
    form: OAuth2PasswordRequestForm = Depends(),
    svc: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    access_token, raw_refresh = await svc.login(form.username, form.password)
    _set_refresh_cookie(response, raw_refresh)
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    description="Issues a new access token using the HttpOnly refresh token cookie.",
    responses={401: {"description": "Invalid or expired refresh token"}},
)
async def refresh_token(
    response: Response,
    refresh_token_cookie: str | None = Cookie(default=None, alias=_COOKIE_NAME),
    svc: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    if not refresh_token_cookie:
        raise UnauthorizedError("Missing refresh token")
    access_token, new_raw = await svc.refresh(refresh_token_cookie)
    _set_refresh_cookie(response, new_raw)
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/logout",
    status_code=204,
    summary="Logout and revoke refresh token",
    description="Revokes the current refresh token cookie.",
)
async def logout(
    response: Response,
    refresh_token_cookie: str | None = Cookie(default=None, alias=_COOKIE_NAME),
    svc: AuthService = Depends(get_auth_service),
) -> None:
    if refresh_token_cookie:
        await svc.logout(refresh_token_cookie)
    _clear_refresh_cookie(response)


@router.get(
    "/me",
    response_model=UserRead,
    summary="Get current user profile",
    description="Returns the authenticated user's profile.",
    responses={401: {"description": "Not authenticated"}},
)
async def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)
