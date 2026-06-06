from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import RefreshToken
from app.repositories.base import BaseRepository


class TokenRepository(BaseRepository[RefreshToken]):
    model = RefreshToken

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db)

    async def create_token(
        self, user_id: UUID, token_hash: str, expires_at: datetime
    ) -> RefreshToken:
        token = RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        return await self.create(token)

    async def get_valid(self, token_hash: str) -> RefreshToken | None:
        now = datetime.now(UTC)
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked.is_(False),
                RefreshToken.expires_at > now,
            )
        )
        return result.scalar_one_or_none()

    async def revoke(self, token_hash: str) -> None:
        token = await self.db.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        if token:
            token.revoked = True
            await self.db.flush()
