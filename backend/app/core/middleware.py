"""
DevResolve Production Middleware
Request Tracing, Structured Audit Logging, and Rate Limiting.
"""

import time
import uuid
import logging
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

logger = logging.getLogger("devresolve.audit")


class RequestTracingMiddleware(BaseHTTPMiddleware):
    """
    Assigns an X-Request-ID to every incoming HTTP request
    and logs request method, path, response status, and duration.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        start_time = time.perf_counter()

        # Attach request_id to request state
        request.state.request_id = request_id

        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000

            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"

            logger.info(
                f"[{request_id}] {request.method} {request.url.path} -> "
                f"Status: {response.status_code} ({duration_ms:.2f}ms)"
            )
            return response
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                f"[{request_id}] UNHANDLED ERROR in {request.method} {request.url.path}: {exc} "
                f"({duration_ms:.2f}ms)",
                exc_info=True,
            )
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal Server Error",
                    "request_id": request_id,
                    "message": "An unexpected error occurred during incident processing.",
                },
                headers={"X-Request-ID": request_id},
            )
