"""
DevResolve Backend Configuration
Environment-based settings with validation using Pydantic.
Secrets are never exposed — loaded from .env or environment variables.
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional, Union, Any, List
import json


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
    ALLOWED_ORIGINS: Union[list[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: Any) -> list[str]:
        raw_list = []
        if isinstance(v, str):
            v_str = v.strip()
            if v_str.startswith("[") and v_str.endswith("]"):
                try:
                    raw_list = json.loads(v_str)
                except Exception:
                    pass
            if not raw_list:
                raw_list = [origin.strip() for origin in v_str.split(",") if origin.strip()]
        elif isinstance(v, (list, tuple, set)):
            raw_list = list(v)

        origins = set()
        for o in raw_list:
            if isinstance(o, str):
                cleaned = o.strip().rstrip("/")
                if cleaned:
                    origins.add(cleaned)
                    origins.add(cleaned + "/")
        # Always guarantee core production origins
        origins.add("https://dev-resolve-pi.vercel.app")
        origins.add("http://localhost:5173")
        origins.add("http://127.0.0.1:5173")
        return list(origins)

    @field_validator("FRONTEND_URL", mode="before")
    @classmethod
    def clean_frontend_url(cls, v: Any) -> str:
        if isinstance(v, str):
            return v.strip().rstrip("/")
        return "https://dev-resolve-pi.vercel.app"

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
    DEFAULT_LLM_PROVIDER: str = "groq"
    DEFAULT_LLM_MODEL: str = "qwen/qwen3.8-27b"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536

    # ── GitHub & Google OAuth ────────────────────────────────────
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    FRONTEND_URL: str = "https://dev-resolve-pi.vercel.app"
    BACKEND_URL: str = "https://devresolve-backend.onrender.com"

    # ── Mail Protocols / Email Alerts ─────────────────────────────
    SUPPORT_NOTIFICATION_EMAIL: str = "devashish0716@gmail.com"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = "devashish0716@gmail.com"
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "devashish0716@gmail.com"
    SMTP_FROM_NAME: str = "DevResolve Support Desk"
    SMTP_TLS: bool = True
    RESEND_API_KEY: Optional[str] = None

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
