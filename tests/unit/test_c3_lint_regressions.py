"""Synthetic checks for manual lint fixes; never collect data or load models."""

import ast
import importlib.util
from pathlib import Path
from unittest.mock import Mock

import pytest

SOURCE = Path(__file__).resolve().parents[2] / "research/c3-model-experiments/src"


@pytest.mark.parametrize(
    "subreddits, expected", [(None, ["srilanka"]), ([], []), (["synthetic"], ["synthetic"])]
)
def test_collector_preserves_default_and_explicit_selection(tmp_path, subreddits, expected):
    # Compile the real function only, avoiding optional imports and network activity.
    tree = ast.parse((SOURCE / "reddit_collector.py").read_text(encoding="utf-8"))
    function = next(
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name == "run_collection"
    )
    fetch = Mock(return_value=[])
    namespace = {"Path": Path, "fetch_subreddit_posts": fetch}
    exec(
        compile(ast.Module(body=[function], type_ignores=[]), "reddit_collector.py", "exec"),
        namespace,
    )
    for attempt in range(2):
        namespace["run_collection"](tmp_path / f"synthetic-{attempt}.txt", subreddits=subreddits)
    assert [call.kwargs["subreddit"] for call in fetch.call_args_list] == expected * 2
    assert not list(tmp_path.glob("*.txt"))


def test_stratified_split_remains_deterministic_and_disjoint(tmp_path):
    spec = importlib.util.spec_from_file_location("synthetic_split", SOURCE / "split_corpus.py")
    module = importlib.util.module_from_spec(spec)
    # Keep pytest's capture stream intact; the module's CLI stdout setup is unrelated.
    tree = ast.parse((SOURCE / "split_corpus.py").read_text(encoding="utf-8"))
    tree.body = [node for node in tree.body if not isinstance(node, ast.If)]
    exec(compile(tree, str(SOURCE / "split_corpus.py"), "exec"), module.__dict__)
    fixture = [f"SYNTHETIC example {index}" for index in range(20)]
    source = tmp_path / "synthetic-input.txt"
    source.write_text("\n".join(fixture), encoding="utf-8")
    reports = []
    partitions = []
    for attempt in range(2):
        folder = tmp_path / str(attempt)
        report = module.stratified_split(
            source, folder / "train.txt", folder / "val.txt", folder / "audit.json"
        )
        train = (folder / "train.txt").read_text(encoding="utf-8").splitlines()
        val = (folder / "val.txt").read_text(encoding="utf-8").splitlines()
        assert len(train) == 19 and len(val) == 1
        assert set(train).isdisjoint(val)
        assert set(train + val) == set(fixture)
        assert report["partition_statistics"]["train"]["words"] == 57
        assert report["partition_statistics"]["val"]["words"] == 3
        reports.append(report["verification_checks"])
        partitions.append((train, val))
    assert partitions[0] == partitions[1]
    assert reports[0] == reports[1]
    assert reports[0]["leakage_check_passed"] and reports[0]["conservation_check_passed"]
