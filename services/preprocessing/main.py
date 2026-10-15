from fastapi import Depends
from research_common.mocks import mock_app
from research_common.service_auth import service_auth
from research_contracts import (
    C2CustomDemoRequest,
    C2CustomDemoResponse,
    C2DemoCatalogue,
    C2DemoRequest,
    C2DemoResponse,
)

from preprocessing.demo import catalogue, development_demo, execute, execute_custom

app = mock_app("preprocessing")

demo_dependencies = [Depends(development_demo), Depends(service_auth("preprocessing"))]


@app.get(
    "/internal/v1/c2-demo/scenarios", response_model=C2DemoCatalogue, dependencies=demo_dependencies
)
def demo_scenarios():
    return catalogue()


@app.post(
    "/internal/v1/c2-demo/runs", response_model=C2DemoResponse, dependencies=demo_dependencies
)
def demo_run(body: C2DemoRequest):
    return execute(body)


@app.post(
    "/internal/v1/c2-demo/custom-runs",
    response_model=C2CustomDemoResponse,
    dependencies=demo_dependencies,
)
def demo_custom_run(body: C2CustomDemoRequest):
    return execute_custom(body)
