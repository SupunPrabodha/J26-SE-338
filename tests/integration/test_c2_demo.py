"""Real synthetic pipeline and C1 authentication across both demo boundaries."""

import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient
from orchestrator import demo as gateway
from preprocessing import demo
from preprocessing.main import app as preprocessing_app
from research_common.config import settings
from research_common.service_auth import service_token
from research_contracts import C2DemoRequest

ROOT = "/api/v1/c2-demo"
INTERNAL = "/internal/v1/c2-demo"


@pytest.mark.parametrize("hint", ["sinhala", "english", "romanized-si", "code-mixed", "unsure"])
def test_custom_actual_execution(reviewer, hint, caplog):
    from research_contracts import C2CustomDemoRequest

    body = {"text": "Fictional support: practice@example.com. 🙂", "language_hint": hint}
    with caplog.at_level("INFO", logger="research.safe"):
        response = reviewer.post(ROOT + "/custom-runs", json=body)
    assert response.status_code == 200
    assert response.json() == demo.execute_custom(C2CustomDemoRequest(**body)).model_dump(
        mode="json"
    )
    assert "[EMAIL]" in response.json()["records"][0]["anonymized_text"]
    assert response.headers["cache-control"] == "no-store"
    assert body["text"] not in caplog.text


@pytest.mark.parametrize(
    "change",
    [
        {"text": "x" * 1001},
        {"language_hint": "unknown"},
        {"strategy": "hybrid"},
        {"participant_id": "PRIVATE-SENTINEL"},
        {"text": 123},
    ],
)
def test_custom_safe_validation(reviewer, change):
    response = reviewer.post(
        ROOT + "/custom-runs",
        json={"text": "PRIVATE-SENTINEL", "language_hint": "unsure", **change},
    )
    assert response.status_code == 422
    assert "PRIVATE-SENTINEL" not in response.text


def test_custom_empty_quality(reviewer):
    response = reviewer.post(ROOT + "/custom-runs", json={"text": "", "language_hint": "unsure"})
    assert response.status_code == 200
    assert response.json()["records"][0]["quality_status"] == "REJECT"
    assert not response.json()["release_ready"]


def test_custom_authorization_and_internal_token(platform, accounts):
    client, _ = platform
    body = {"text": "", "language_hint": "unsure"}
    assert client.post(ROOT + "/custom-runs", json=body).status_code == 401
    _, username, password = accounts["RESEARCHER"]
    assert (
        client.post(
            "/api/v1/auth/login", json={"username": username, "password": password}
        ).status_code
        == 200
    )
    assert client.post(ROOT + "/custom-runs", json=body).status_code == 403
    with TestClient(preprocessing_app) as internal:
        assert internal.post(INTERNAL + "/custom-runs", json=body).status_code == 401


def test_custom_development_only(reviewer, monkeypatch):
    monkeypatch.setattr(gateway, "settings", lambda: SimpleNamespace(environment="production"))
    assert (
        reviewer.post(
            ROOT + "/custom-runs", json={"text": "", "language_hint": "unsure"}
        ).status_code
        == 404
    )


@pytest.fixture
def reviewer(platform, accounts, monkeypatch):
    client, _ = platform
    _, username, password = accounts["COUNSELLOR"]
    assert (
        client.post(
            "/api/v1/auth/login", json={"username": username, "password": password}
        ).status_code
        == 200
    )
    # In-process HTTP transport still exercises internal token verification and schemas.
    internal = TestClient(preprocessing_app)

    class Transport:
        def __init__(self, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def request(self, method, url, **kwargs):
            return internal.request(method, url, **kwargs)

    monkeypatch.setattr(gateway.httpx, "Client", Transport)
    yield client
    internal.close()


@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
def test_actual_pipeline_all_strategies(reviewer, strategy, caplog):
    with caplog.at_level("INFO", logger="research.safe"):
        response = reviewer.post(
            ROOT + "/runs", json={"scenario_id": "english", "strategy": strategy}
        )
    assert response.status_code == 200
    data = response.json()
    expected = demo.execute(C2DemoRequest(scenario_id="english", strategy=strategy)).model_dump(
        mode="json"
    )
    assert data == expected
    row = data["records"][0]
    assert "practice@example.com" in row["original_text"]
    assert "practice@example.com" not in row["anonymized_text"]
    assert row["transformations"]
    assert data["human_release_required"] is True
    assert data["independent_research_validation"] is False
    assert response.headers["cache-control"] == "no-store"
    assert "practice@example.com" not in caplog.text
    assert row["original_text"] not in caplog.text


def test_catalogue_and_default(reviewer):
    response = reviewer.get(ROOT + "/scenarios")
    assert response.status_code == 200
    data = response.json()
    assert data["default_strategy"] == "regex"
    assert data["language_labels_are_fixture_metadata"] is True
    assert len(data["scenarios"]) == len(demo.SCENARIOS)
    assert "original_text" not in response.text
    for scenario in data["scenarios"]:
        result = reviewer.post(ROOT + "/runs", json={"scenario_id": scenario["scenario_id"]})
        assert result.status_code == 200
        assert result.json()["strategy"] == "regex"
        assert len(result.json()["records"]) == scenario["record_count"]


@pytest.mark.parametrize(
    "scenario,status,reason",
    [
        ("short", "REVIEW", "data_quality_review_required"),
        ("placeholder-only", "REVIEW", "data_quality_review_required"),
        ("duplicate", "REVIEW", "data_quality_review_required"),
        ("masking-collision", "REVIEW", "data_quality_review_required"),
        ("empty", "REJECT", "data_quality_rejected"),
        ("empty-batch", None, "empty_batch"),
    ],
)
@pytest.mark.parametrize("strategy", ["regex", "presidio", "hybrid"])
def test_release_blocking(reviewer, scenario, status, reason, strategy):
    response = reviewer.post(ROOT + "/runs", json={"scenario_id": scenario, "strategy": strategy})
    assert response.status_code == 200
    data = response.json()
    assert data["release_ready"] is False
    assert reason in data["blocking_reasons"]
    if status:
        assert all(row["quality_status"] == status for row in data["records"])


@pytest.mark.parametrize(
    "body",
    [
        {"scenario_id": "unknown"},
        {"scenario_id": "english", "strategy": "unknown"},
        {"scenario_id": "english", "text": "PRIVATE-SENTINEL"},
        {"scenario_id": "english", "records": []},
        {"scenario_id": "english", "synthetic": True},
        {"scenario_id": 1},
        {},
    ],
)
def test_safe_input_errors(reviewer, body):
    response = reviewer.post(ROOT + "/runs", json=body)
    assert response.status_code == 422
    assert response.json()["error_code"] == "CONTRACT_INVALID"
    assert "PRIVATE-SENTINEL" not in response.text
    assert "detail" not in response.json()
    assert response.headers["cache-control"] == "no-store"


def test_browser_authorization(platform, accounts):
    client, _ = platform
    assert client.get(ROOT + "/scenarios").status_code == 401
    assert client.post(ROOT + "/runs", json={"scenario_id": "english"}).status_code == 401
    assert client.post("/api/v1/auth/student-session").status_code == 200
    assert client.get(ROOT + "/scenarios").status_code == 403
    for role in ("ADMIN", "RESEARCHER"):
        _, username, password = accounts[role]
        assert (
            client.post(
                "/api/v1/auth/login", json={"username": username, "password": password}
            ).status_code
            == 200
        )
        assert client.get(ROOT + "/scenarios").status_code == 403


def test_csrf_logout_and_revocation(reviewer):
    assert (
        reviewer.post(
            ROOT + "/runs",
            json={"scenario_id": "english"},
            headers={"Origin": "https://untrusted.invalid"},
        ).status_code
        == 403
    )
    assert reviewer.post("/api/v1/auth/logout").status_code == 204
    assert reviewer.get(ROOT + "/scenarios").status_code == 401


def test_internal_auth_and_validation(platform):
    with TestClient(preprocessing_app) as client:
        assert client.get(INTERNAL + "/scenarios").status_code == 401
        assert client.post(INTERNAL + "/runs", json={"scenario_id": "english"}).status_code == 401
        wrong = {"Authorization": "Bearer " + service_token("nlp")}
        assert client.get(INTERNAL + "/scenarios", headers=wrong).status_code == 401
        valid = {"Authorization": "Bearer " + service_token("preprocessing")}
        assert client.get(INTERNAL + "/scenarios", headers=valid).status_code == 200
        response = client.post(
            INTERNAL + "/runs",
            headers=valid,
            json={"scenario_id": "english", "text": "PRIVATE-SENTINEL"},
        )
        assert response.status_code == 422
        assert "PRIVATE-SENTINEL" not in response.text


def test_development_restriction_at_both_boundaries(reviewer, monkeypatch):
    # Settings already rejects non-development startup; also exercise route guards.
    monkeypatch.setattr(gateway, "settings", lambda: SimpleNamespace(environment="production"))
    monkeypatch.setattr(demo, "settings", lambda: SimpleNamespace(environment="production"))
    assert reviewer.get(ROOT + "/scenarios").status_code == 404
    assert reviewer.post(ROOT + "/runs", json={"scenario_id": "english"}).status_code == 404
    with TestClient(preprocessing_app) as client:
        assert client.get(INTERNAL + "/scenarios").status_code == 404
        assert client.post(INTERNAL + "/runs", json={"scenario_id": "english"}).status_code == 404


@pytest.mark.parametrize("failure", ["timeout", "malformed", "status", "exception", "mismatch"])
def test_safe_downstream_errors(reviewer, monkeypatch, failure):
    def broken(self, method, url, **kwargs):
        if failure == "timeout":
            raise httpx.ReadTimeout("PRIVATE-SENTINEL")
        if failure == "exception":
            raise RuntimeError("PRIVATE-SENTINEL")
        if failure == "mismatch":
            data = demo.execute(C2DemoRequest(scenario_id="short")).model_dump(mode="json")
            return httpx.Response(200, json=data)
        return httpx.Response(503 if failure == "status" else 200, text="PRIVATE-SENTINEL")

    monkeypatch.setattr(gateway.httpx.Client, "request", broken)
    response = reviewer.post(ROOT + "/runs", json={"scenario_id": "english"})
    assert response.status_code == (500 if failure == "exception" else 502)
    assert "PRIVATE-SENTINEL" not in response.text
    assert response.headers["cache-control"] == "no-store"


def test_existing_mock_contracts_unchanged():
    # Compare authoritative existing schemas to the committed pre-demo baseline.
    import subprocess

    from scripts.generate_contracts import artifacts

    for path, value in artifacts().items():
        if "/json-schema/" in path and not path.rsplit("/", 1)[-1].startswith(
            ("C2Demo", "C2CustomDemo", "C2Annotation")
        ):
            previous = subprocess.check_output(["git", "show", "HEAD:" + path])
            assert json.loads(previous) == value, path
        if "/openapi/" in path:
            previous = json.loads(subprocess.check_output(["git", "show", "HEAD:" + path]))
            for route, definition in previous["paths"].items():
                assert value["paths"][route] == definition, (path, route)
            for name, definition in previous["components"]["schemas"].items():
                assert value["components"]["schemas"][name] == definition, (path, name)


def test_demo_does_not_persist(reviewer):
    from research_common.database import Base, engine
    from sqlalchemy import func, select

    def counts():
        with engine().connect() as connection:
            return {
                table.name: connection.scalar(select(func.count()).select_from(table))
                for table in Base.metadata.sorted_tables
            }

    before = counts()
    assert reviewer.post(ROOT + "/runs", json={"scenario_id": "english"}).status_code == 200
    assert (
        reviewer.post(
            ROOT + "/custom-runs",
            json={"text": "Fictional practice@example.com", "language_hint": "unsure"},
        ).status_code
        == 200
    )
    assert counts() == before


def test_non_development_configuration_rejected(monkeypatch, platform):
    from pydantic import ValidationError
    from research_common.config import Settings

    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(ValidationError, match="development-only"):
        Settings()
    assert settings().environment == "development"
