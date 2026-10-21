import json
import logging
import time
from uuid import UUID, uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from opentelemetry import trace
from redis import Redis
from research_contracts import ErrorCode, HealthResponse, ServiceError, VersionResponse, now
from sqlalchemy import text
from starlette.exceptions import HTTPException

from research_common.config import settings
from research_common.database import engine

logger = logging.getLogger("research.safe")


class SafeError(Exception):
    def __init__(self, code: ErrorCode, status: int = 400):
        self.code, self.status = code, status


def redis_client():
    return Redis.from_url(
        settings().redis_url.get_secret_value(),
        decode_responses=True,
        socket_timeout=2,
        socket_connect_timeout=2,
    )


def safe_log(service, correlation, status, duration, error_code=None):
    # Allowlist only: never serialize requests, exceptions, paths or arbitrary extras.
    logger.info(
        json.dumps(
            {
                "timestamp": now().isoformat(),
                "service_name": service,
                "service_version": "0.1.0",
                "correlation_id": str(correlation),
                "event_type": "http_completed",
                "status": status,
                "duration_ms": round(duration, 2),
                "error_code": error_code,
            }
        )
    )


def create_app(name: str, database: bool = False):
    app = FastAPI(
        title=f"{name} — SYNTHETIC DEVELOPMENT ONLY",
        version="0.1.0",
        responses={
            code: {"model": ServiceError}
            for code in (400, 401, 403, 404, 409, 422, 429, 500, 502, 503)
        },
    )

    def error(request, code, status):
        request.state.error_code = code
        body = ServiceError(error_code=code, correlation_id=request.state.correlation_id)
        return JSONResponse(body.model_dump(mode="json"), status_code=status)

    @app.middleware("http")
    async def boundary(request: Request, call_next):
        started = time.monotonic()
        try:
            correlation = UUID(request.headers.get("x-correlation-id", ""))
        except ValueError:
            correlation = uuid4()
        request.state.correlation_id = correlation
        with trace.get_tracer("j26.platform").start_as_current_span("http.request") as span:
            span.set_attribute("service.name", name)
            span.set_attribute("correlation_id", str(correlation))
            try:
                response = await call_next(request)
            except Exception:
                response = error(request, ErrorCode.INTERNAL_ERROR, 500)
        response.headers["x-correlation-id"] = str(correlation)
        response.headers["cache-control"] = "no-store"
        response.headers["x-content-type-options"] = "nosniff"
        safe_log(
            name,
            correlation,
            response.status_code,
            (time.monotonic() - started) * 1000,
            getattr(request.state, "error_code", None),
        )
        return response

    @app.exception_handler(SafeError)
    async def safe_error(request, exc):
        return error(request, exc.code, exc.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return error(request, ErrorCode.CONTRACT_INVALID, 422)

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        return error(
            request,
            ErrorCode.NOT_FOUND if exc.status_code == 404 else ErrorCode.FORBIDDEN,
            exc.status_code,
        )

    @app.get("/health", response_model=HealthResponse)
    def health():
        return HealthResponse(service_name=name, status="ok")

    @app.get("/ready", response_model=HealthResponse)
    def ready():
        try:
            redis_client().ping()
            if database:
                with engine().connect() as connection:
                    connection.execute(text("SELECT version_num FROM alembic_version"))
            settings()
        except Exception:
            raise SafeError(ErrorCode.DEPENDENCY_UNAVAILABLE, 503) from None
        return HealthResponse(service_name=name, status="ok")

    @app.get("/version", response_model=VersionResponse)
    def version():
        return VersionResponse(
            service_name=name,
            mode="SYNTHETIC_DEVELOPMENT_ONLY" if database else "MOCK_SYNTHETIC_DEVELOPMENT_ONLY",
        )

    return app
