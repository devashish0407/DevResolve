"""
DevResolve — FastAPI Application Entry Point

This is the API gateway that sits between the React frontend
and all backend services (auth, RAG, AI agent, sandbox).

Architecture:
  React → HTTPS → FastAPI (this) → Services → Database / AI / Docker
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.routes import auth, projects, conversations, health
from app.db.session import engine, Base, db_url
import app.models.models  # ensure models are registered


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-initialize database tables in local development mode (SQLite)
    if db_url.startswith("sqlite"):
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
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
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Response-Time"],
    )

    # ── Request Tracing & Structured Audit ────────────────────
    from app.core.middleware import RequestTracingMiddleware
    app.add_middleware(RequestTracingMiddleware)

    # ── Routes ────────────────────────────────────────────────
    app.include_router(health.router, prefix="/api", tags=["Health"])
    app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
    app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
    app.include_router(
        conversations.router, prefix="/api/conversations", tags=["Conversations"]
    )

    return app


app = create_app()
