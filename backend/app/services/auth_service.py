from datetime import UTC, datetime

from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expires_at,
    verify_password,
)
from app.domain.models import User
from app.domain.schemas import UserRead
from app.repositories.token_repository import TokenRepository
from app.repositories.user_repository import UserRepository


class AuthService:
    def __init__(self, user_repo: UserRepository, token_repo: TokenRepository) -> None:
        self.user_repo = user_repo
        self.token_repo = token_repo

    async def register(self, username: str, email: str, password: str) -> UserRead:
        if await self.user_repo.get_by_username(username):
            raise ConflictError("Username already taken")
        if await self.user_repo.get_by_email(email):
            raise ConflictError("Email already registered")
        now = datetime.now(UTC)
        user = User(
            username=username,
            email=email,
            hashed_password=hash_password(password),
            created_at=now,
            updated_at=now,
        )
        user = await self.user_repo.create(user)
        return UserRead.model_validate(user)

    async def login(self, username: str, password: str) -> tuple[str, str]:
        user = await self.user_repo.get_by_username(username)
        if not user or not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Invalid credentials")
        access_token = create_access_token(user.id)
        raw_refresh = generate_refresh_token()
        await self.token_repo.create_token(
            user.id, hash_refresh_token(raw_refresh), refresh_token_expires_at()
        )
        return access_token, raw_refresh

    async def refresh(self, raw_refresh_token: str) -> tuple[str, str]:
        token_hash = hash_refresh_token(raw_refresh_token)
        token = await self.token_repo.get_valid(token_hash)
        if not token:
            raise UnauthorizedError("Invalid or expired refresh token")
        await self.token_repo.revoke(token_hash)
        access_token = create_access_token(token.user_id)
        new_raw = generate_refresh_token()
        await self.token_repo.create_token(
            token.user_id, hash_refresh_token(new_raw), refresh_token_expires_at()
        )
        return access_token, new_raw

    async def logout(self, raw_refresh_token: str) -> None:
        token_hash = hash_refresh_token(raw_refresh_token)
        await self.token_repo.revoke(token_hash)
