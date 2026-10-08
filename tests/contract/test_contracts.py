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


def test_no_service_local_contract_definitions():
    for path in Path("services").rglob("*.py"):
        assert "BaseModel" not in path.read_text(encoding="utf-8"), path
