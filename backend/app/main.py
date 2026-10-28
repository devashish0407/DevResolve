"""
DevResolve — FastAPI Application Entry Point

This is the API gateway that sits between the React frontend
and all backend services (auth, RAG, AI agent, sandbox).

Architecture:
  React → HTTPS → FastAPI (this) → Services → Database / AI / Docker
"""

import sys
import asyncio
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.routes import auth, projects, conversations, health
from app.db.session import engine, Base, db_url
import app.models.models  # ensure models are registered


def _sync_sqlite_schema(conn):
    Base.metadata.create_all(conn)
    from sqlalchemy import text
    for table_name, table in Base.metadata.tables.items():
        res = conn.execute(text(f"PRAGMA table_info({table_name})"))
        existing_cols = {row[1] for row in res.fetchall()}
        if not existing_cols:
            continue
        for col in table.columns:
            if col.name not in existing_cols:
                col_type = "TEXT"
                if str(col.type).startswith("INTEGER") or str(col.type).startswith("BOOLEAN"):
                    col_type = "INTEGER"
                elif str(col.type).startswith("FLOAT"):
                    col_type = "REAL"
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-initialize database tables and migrate missing columns in local development mode (SQLite)
    if db_url.startswith("sqlite"):
        async with engine.begin() as conn:
            await conn.run_sync(_sync_sqlite_schema)
    yield


# ── Application Factory ──────────────────────────────────────────

def create_app() -> FastAPI:
    """
    Factory pattern — makes testing easier by allowing
    different configurations per environment.
    """
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="AI-powered incident investigation engineer for developers",
        docs_url="/api/docs" if settings.DEBUG else None,
        redoc_url="/api/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Response-Time"],
    )

    # ── Request Tracing & Structured Audit ────────────────────
    from app.core.middleware import RequestTracingMiddleware
    app.add_middleware(RequestTracingMiddleware)

    from app.api.routes import auth, projects, conversations, health, integrations, notifications, rag, settings as ai_settings, tickets

    # ── Routes ────────────────────────────────────────────────
    app.include_router(health.router, prefix="/api", tags=["Health"])
    app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
    app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
    app.include_router(
        conversations.router, prefix="/api/conversations", tags=["Conversations"]
    )
    app.include_router(
        integrations.router, prefix="/api/integrations", tags=["Integrations & MCP"]
    )
    app.include_router(
        notifications.router, prefix="/api/notifications", tags=["Notifications"]
    )
    app.include_router(rag.router, prefix="/api/rag", tags=["RAG"])
    app.include_router(ai_settings.router, prefix="/api/settings", tags=["Settings & BYOK"])
    app.include_router(tickets.router, prefix="/api/tickets", tags=["Tickets & Support"])

    return app


app = create_app()
