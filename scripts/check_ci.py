"""Local structural CI validation; hosted execution is separately reported."""

import re
from pathlib import Path

import yaml

workflow = yaml.load(Path(".github/workflows/ci.yml").read_text(), Loader=yaml.BaseLoader)
assert workflow["permissions"] == {"contents": "read"}
assert "pull_request" in workflow["on"]
steps = workflow["jobs"]["checks"]["steps"]
for step in steps:
    if "uses" in step:
        assert re.fullmatch(r"[\w.-]+/[\w.-]+@(?:v\d+\.\d+\.\d+|[0-9a-f]{40})", step["uses"])
commands = "\n".join(step.get("run", "") for step in steps)
for required in [
    "uv sync --frozen",
    "ruff check",
    "pytest",
    "generate_contracts --check",
    "npm ci",
    "npm run lint",
    "npm run typecheck",
    "npm test",
    "compose config --quiet",
    "compose build",
    "alembic upgrade head",
    "compose_smoke.py",
    "compose down",
]:
    assert required in commands, required
assert steps[-1]["if"] == "always()"
print(
    "CI YAML structure, pinned action references and required checks verified; hosted run not executed."
)
