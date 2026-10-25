"""Check research import wiring without datasets, training or optional ML installations."""

import ast
import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from unittest.mock import patch

import pytest

SOURCE = Path(__file__).resolve().parents[2] / "research/c3-model-experiments/src"


@pytest.mark.parametrize("filename", ["baseline_models.py", "transformer_trainer.py"])
def test_research_local_dependencies_resolve_from_another_directory(
    tmp_path, monkeypatch, filename
):
    # Only external import surfaces are stubbed. Local data_loader/metrics are the real files.
    names = {
        "pandas": [],
        "numpy": [],
        "matplotlib": [],
        "matplotlib.pyplot": [],
        "sklearn": [],
        "sklearn.metrics": [
            "accuracy_score",
            "brier_score_loss",
            "classification_report",
            "confusion_matrix",
            "precision_recall_fscore_support",
        ],
        "sklearn.model_selection": ["train_test_split"],
        "sklearn.calibration": ["CalibratedClassifierCV"],
        "sklearn.feature_extraction": [],
        "sklearn.feature_extraction.text": ["TfidfVectorizer"],
        "sklearn.linear_model": ["LogisticRegression"],
        "sklearn.pipeline": ["Pipeline"],
        "sklearn.svm": ["LinearSVC"],
    }
    stubs = {name: ModuleType(name) for name in names}
    for name, attributes in names.items():
        for attribute in attributes:
            setattr(stubs[name], attribute, object())
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "path", sys.path.copy())
    with patch.dict(sys.modules, stubs):
        spec = importlib.util.spec_from_file_location("research_import_probe", SOURCE / filename)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        assert str(SOURCE) in sys.path
        # Resolve the relocated function-local imports without executing training/data functions.
        tree = ast.parse((SOURCE / filename).read_text())
        for function in (node for node in tree.body if isinstance(node, ast.FunctionDef)):
            for node in function.body:
                if isinstance(node, ast.ImportFrom) and node.module in {"metrics", "data_loader"}:
                    exec(
                        compile(
                            ast.Module(body=[node], type_ignores=[]), str(SOURCE / filename), "exec"
                        ),
                        module.__dict__,
                    )
                    assert Path(sys.modules[node.module].__file__).resolve().parent == SOURCE
