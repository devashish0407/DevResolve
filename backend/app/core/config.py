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
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

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
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    DEFAULT_LLM_PROVIDER: str = "openai"  # openai | anthropic | google
    DEFAULT_LLM_MODEL: str = "gpt-4o"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536

    # ── GitHub & Google OAuth ────────────────────────────────────
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"

    # ── Mail Protocols / Email Alerts ─────────────────────────────
    SUPPORT_NOTIFICATION_EMAIL: str = "devashish0716@gmail.com"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "alerts@devresolve.io"
    SMTP_FROM_NAME: str = "DevResolve Support Desk"
    SMTP_TLS: bool = True

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
        env_file = [".env", "../.env"]
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
