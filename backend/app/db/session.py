"""
DevResolve Database Engine & Session Management

Supports PostgreSQL (asyncpg) with full connection pooling,
with automatic fallback to SQLite (aiosqlite) when running locally without Docker.
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# ── Resilient Database URL Resolution ─────────────────────────────
db_url = settings.DATABASE_URL.strip() if settings.DATABASE_URL else ""
if not db_url:
    db_url = "sqlite+aiosqlite:///./devresolve.db"

# ── Engine Configuration ──────────────────────────────────────────
if db_url.startswith("sqlite"):
    engine = create_async_engine(
        db_url,
        connect_args={"check_same_thread": False},
        echo=settings.DB_ECHO,
    )
else:
    engine = create_async_engine(
        db_url,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_recycle=settings.DB_POOL_RECYCLE,
        echo=settings.DB_ECHO,
        pool_pre_ping=True,
    )

# ── Session Factory ───────────────────────────────────────────────
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# ── Base Model ────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass

# ── FastAPI Dependency ────────────────────────────────────────────
async def get_db() -> AsyncSession:
    """
    FastAPI dependency yielding an async database session with automatic cleanup.
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
