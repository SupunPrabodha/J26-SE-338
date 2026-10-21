import secrets
from pathlib import Path

from dotenv import dotenv_values

from scripts.bootstrap_dev import GENERATED_KEYS, create_environment
from scripts.check_repository import credential_configuration_violations


def test_bootstrap_generates_private_unique_secrets_without_output(tmp_path, capsys):
    (tmp_path / ".env.example").write_text(Path(".env.example").read_text())
    assert create_environment(tmp_path)
    values = dotenv_values(tmp_path / ".env")
    credentials = [values[key] for key in GENERATED_KEYS]
    assert all(value and len(value) >= 43 for value in credentials)
    assert len(set(credentials)) == len(credentials)
    assert capsys.readouterr().out == ""
    original = (tmp_path / ".env").read_bytes()
    assert not create_environment(tmp_path)
    assert (tmp_path / ".env").read_bytes() == original


def test_tracked_configuration_requires_external_credentials():
    assert credential_configuration_violations() == []


def test_scan_rejects_literal_credentials_without_reporting_values(tmp_path):
    value = secrets.token_urlsafe(36)
    (tmp_path / "docker-compose.yml").write_text(
        "services:\n  probe:\n    environment:\n      REDIS_PASSWORD: " + value + "\n"
    )
    (tmp_path / ".env.example").write_text("JWT_SECRET=" + value + "\n")
    violations = credential_configuration_violations(tmp_path)
    assert len(violations) == 2
    assert value not in str(violations)
