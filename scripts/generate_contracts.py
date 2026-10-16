"""Export contracts deterministically; --check rejects drift without writing."""

import inspect
import json
import sys
from pathlib import Path

import research_contracts as contracts
from orchestrator.main import app as orchestrator_app
from research_common.mocks import mock_app
from xai.main import app as xai_app

ROOT = Path(__file__).resolve().parents[1]


def artifacts():
    result = {}
    for name, value in vars(contracts).items():
        if (
            inspect.isclass(value)
            and issubclass(value, contracts.Contract)
            and value is not contracts.Contract
        ):
            schema = value.model_json_schema()
            schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
            schema["$id"] = f"https://j26.invalid/contracts/1.0.0/{name}.json"
            result[f"packages/contracts/json-schema/v1/{name}.json"] = schema
    for name, service in [
        ("orchestrator", orchestrator_app),
        ("preprocessing", mock_app("preprocessing")),
        ("nlp", mock_app("nlp")),
        ("xai", xai_app),
    ]:
        result[f"packages/contracts/openapi/{name}.v1.json"] = service.openapi()
    return result


def main():
    changed = []
    for path, value in artifacts().items():
        output = json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"
        destination = ROOT / path
        if "--check" in sys.argv:
            if not destination.exists() or destination.read_text(encoding="utf-8") != output:
                changed.append(path)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(output, encoding="utf-8")
    if changed:
        raise SystemExit("Contract drift: " + ", ".join(changed))
    print(
        "Contract artifacts verified." if "--check" in sys.argv else "Contract artifacts generated."
    )


if __name__ == "__main__":
    main()
