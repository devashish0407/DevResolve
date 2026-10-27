"""
DevResolve Backend Configuration
Environment-based settings with validation using Pydantic.
Secrets are never exposed — loaded from .env or environment variables.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """
    Application settings with security-first defaults.
    All sensitive values loaded from environment variables.
    """

    # ── Application ──────────────────────────────────────────────
    APP_NAME: str = "DevResolve"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development | staging | production

    # ── Server ───────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173"]

    # ── Supabase ─────────────────────────────────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""  # Server-side only — never expose
    SUPABASE_JWT_SECRET: str = ""

    # ── Database ─────────────────────────────────────────────────
    # Connection string uses asyncpg for async operations.
    # Connection pooling is configured at the engine level.
    DATABASE_URL: str = ""
    DB_POOL_SIZE: int = 20          # Max persistent connections
    DB_MAX_OVERFLOW: int = 10       # Burst connections above pool size
    DB_POOL_TIMEOUT: int = 30       # Seconds to wait for a connection
    DB_POOL_RECYCLE: int = 1800     # Recycle connections every 30 min
    DB_ECHO: bool = False           # SQL logging (disable in prod)

    # ── LLM / AI ─────────────────────────────────────────────────
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    DEFAULT_LLM_PROVIDER: str = "openai"  # openai | anthropic | google
    DEFAULT_LLM_MODEL: str = "gpt-4o"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536

    # ── GitHub ───────────────────────────────────────────────────
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None

    # ── Security ─────────────────────────────────────────────────
    API_KEY_ENCRYPTION_KEY: str = ""  # Fernet key for encrypting stored API keys
    RATE_LIMIT_PER_MINUTE: int = 60
    MAX_UPLOAD_SIZE_MB: int = 50

    # ── Docker Sandbox ───────────────────────────────────────────
    SANDBOX_ENABLED: bool = False
    SANDBOX_TIMEOUT_SECONDS: int = 120
    SANDBOX_MEMORY_LIMIT: str = "512m"
    SANDBOX_CPU_LIMIT: float = 1.0
    SANDBOX_NETWORK_DISABLED: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
