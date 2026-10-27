"""
DevResolve Database Engine & Session Management

Design Principles:
─────────────────
• Connection pooling with overflow limits to prevent connection exhaustion
• Async sessions for non-blocking I/O under FastAPI
• Session-per-request pattern to ensure proper cleanup
• Pool recycling to prevent stale connections
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


# ── Async Engine ──────────────────────────────────────────────────
# Uses asyncpg driver for async PostgreSQL operations.
# Pool settings prevent the "connection pool exhausted" scenario
# that DevResolve is literally designed to help debug.

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=settings.DB_POOL_RECYCLE,
    echo=settings.DB_ECHO,
    pool_pre_ping=True,   # Verify connection health before use
)


# ── Session Factory ───────────────────────────────────────────────
# expire_on_commit=False prevents lazy-load issues after commit
# in async context.

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Base Model ────────────────────────────────────────────────────

class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


# ── Dependency ────────────────────────────────────────────────────

async def get_db() -> AsyncSession:
    """
    FastAPI dependency that yields a database session.
    Ensures proper cleanup via context manager.

    Usage:
        @router.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            ...
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
