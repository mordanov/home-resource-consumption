from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://resource_user:resource_pass@db:5432/resource_tracker"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    MAX_UPLOAD_SIZE_MB: int = 20
    # Stored as a plain str so pydantic-settings never tries json.loads() on it.
    # Accepts either comma-separated ("http://a,http://b") or JSON array ("[...]").
    CORS_ORIGINS_RAW: str = "http://localhost:3000,http://localhost"
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    UPLOAD_DIR: str = "/app/uploads"

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        if len(v.encode()) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 256 bits (32 bytes)")
        return v

    @property
    def CORS_ORIGINS(self) -> list[str]:  # noqa: N802
        raw = self.CORS_ORIGINS_RAW.strip()
        if not raw:
            return ["http://localhost:3000", "http://localhost"]
        if raw.startswith("["):
            import json
            return list(json.loads(raw))
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024


settings = Settings()
