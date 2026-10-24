"""Authenticated, non-persistent gateway to the C2 synthetic demo."""

import httpx
from fastapi import APIRouter, Depends, Request
from pydantic import ValidationError
from research_common.config import settings
from research_common.service_auth import service_token
from research_common.web import SafeError
from research_contracts import (
    C2CustomDemoRequest,
    C2CustomDemoResponse,
    C2DemoCatalogue,
    C2DemoRequest,
    C2DemoResponse,
    ErrorCode,
    Role,
)

from orchestrator import auth
from orchestrator.c2_annotation import router as annotation_router


def development_demo():
    if settings().environment != "development":
        raise SafeError(ErrorCode.NOT_FOUND, 404)


demo_routes = APIRouter(
    prefix="/api/v1/c2-demo",
    dependencies=[Depends(development_demo), Depends(auth.require_role(Role.COUNSELLOR))],
)


def forward(request, route, response_type, body=None):
    try:
        config = settings()
        # Only the opt-in C2 model needs a bounded cold-load budget; shared C1
        # service defaults and baseline request timeouts remain unchanged.
        timeout = (
            300 if getattr(body, "strategy", None) == "gliner" else config.service_timeout_seconds
        )
        with httpx.Client(timeout=timeout, follow_redirects=False) as client:
            response = client.request(
                "POST" if body is not None else "GET",
                config.preprocessing_url + "/internal/v1/c2-demo/" + route,
                headers={
                    "Authorization": "Bearer " + service_token("preprocessing"),
                    "X-Correlation-ID": str(request.state.correlation_id),
                },
                **({"json": body.model_dump()} if body is not None else {}),
            )
        if response.status_code != 200:
            raise SafeError(ErrorCode.DOWNSTREAM_FAILED, 502)
        result = response_type.model_validate(response.json())
        if isinstance(body, C2DemoRequest) and (
            result.scenario.scenario_id != body.scenario_id or result.strategy != body.strategy
        ):
            raise SafeError(ErrorCode.DOWNSTREAM_FAILED, 502)
        if isinstance(body, C2CustomDemoRequest) and (
            result.language_hint != body.language_hint
            or result.strategy != body.strategy
            or len(result.records) != 1
            or result.records[0].original_text != body.text
        ):
            raise SafeError(ErrorCode.DOWNSTREAM_FAILED, 502)
        return result
    except httpx.TimeoutException:
        raise SafeError(ErrorCode.DOWNSTREAM_TIMEOUT, 502) from None
    except (httpx.HTTPError, ValidationError, ValueError):
        raise SafeError(ErrorCode.DOWNSTREAM_FAILED, 502) from None


@demo_routes.get("/scenarios", response_model=C2DemoCatalogue)
def scenarios(request: Request):
    return forward(request, "scenarios", C2DemoCatalogue)


@demo_routes.post("/runs", response_model=C2DemoResponse)
def run(body: C2DemoRequest, request: Request):
    return forward(request, "runs", C2DemoResponse, body)


@demo_routes.post("/custom-runs", response_model=C2CustomDemoResponse)
def custom_run(body: C2CustomDemoRequest, request: Request):
    return forward(request, "custom-runs", C2CustomDemoResponse, body)


# Aggregate only C2 routes; preserve the existing demo's counsellor authorization.
router = APIRouter()
router.include_router(demo_routes)
router.include_router(annotation_router)
