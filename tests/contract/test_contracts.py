import inspect
import json
from pathlib import Path

import pytest
import research_contracts as contracts
from jsonschema import Draft202012Validator, FormatChecker
from pydantic import ValidationError

from scripts.generate_contracts import artifacts


def test_generated_contract_drift():
    for path, expected in artifacts().items():
        assert json.loads(Path(path).read_text(encoding="utf-8")) == expected


def test_all_schemas_valid():
    for path in Path("packages/contracts/json-schema/v1").glob("*.json"):
        Draft202012Validator.check_schema(json.loads(path.read_text(encoding="utf-8")))


def test_examples():
    examples = json.loads(Path("packages/contracts/examples/v1.json").read_text(encoding="utf-8"))
    for entry in examples:
        schema = json.loads(
            Path(f"packages/contracts/json-schema/v1/{entry['contract']}.json").read_text(
                encoding="utf-8"
            )
        )
        valid = Draft202012Validator(schema, format_checker=FormatChecker()).is_valid(
            entry["payload"]
        )
        assert valid == entry["valid"], entry["contract"]


def test_all_contracts_reject_version_and_unknown_fields():
    for _name, cls in vars(contracts).items():
        if inspect.isclass(cls) and issubclass(cls, contracts.Contract):
            with pytest.raises(ValidationError):
                cls.model_validate(
                    {"schema_version": "9.0.0", "email": "forbidden-synthetic-field"}
                )


@pytest.mark.parametrize(
    "contract",
    [
        "PreprocessRequest",
        "PreprocessResponse",
        "InferenceRequest",
        "InferenceResponse",
        "ExplanationRequest",
        "ExplanationResponse",
    ],
)
@pytest.mark.parametrize("field,value", [("schema_version", "9.0.0"), ("unsupported_probe", True)])
def test_valid_service_payload_rejects_single_incompatibility(contract, field, value):
    # Start with valid data: missing required fields must not mask version/extra rejection.
    examples = json.loads(Path("packages/contracts/examples/v1.json").read_text(encoding="utf-8"))
    payload = next(e["payload"] for e in examples if e["contract"] == contract and e["valid"])
    model = getattr(contracts, contract)
    schema = json.loads(
        Path(f"packages/contracts/json-schema/v1/{contract}.json").read_text(encoding="utf-8")
    )
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    model.model_validate(payload)
    assert validator.is_valid(payload)
    changed = {**payload, field: value}
    with pytest.raises(ValidationError) as error:
        model.model_validate(changed)
    assert [item["loc"] for item in error.value.errors()] == [(field,)]
    assert not validator.is_valid(changed)


def test_no_service_local_contract_definitions():
    for path in Path("services").rglob("*.py"):
        assert "BaseModel" not in path.read_text(encoding="utf-8"), path
