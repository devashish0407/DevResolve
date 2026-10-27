"""Health check endpoint — always available, no auth required."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health", summary="Health check")
async def health_check():
    """
    Returns service status. Used by load balancers,
    monitoring, and deployment readiness probes.
    """
    return {
        "status": "healthy",
        "service": "devresolve-api",
        "version": "0.1.0",
    }
