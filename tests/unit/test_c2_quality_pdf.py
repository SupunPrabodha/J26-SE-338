"""Conversion tests use aggregate synthetic test metadata, not fixture executions."""

import copy
import json
import sys

import pymupdf
import pytest
from preprocessing import quality_pdf
from pypdf import PdfReader


@pytest.fixture
def recorded_evidence():
    statuses = {"PASS": 0, "REVIEW": 2, "REJECT": 0}
    return {
        "evaluation_scope": "disposable_synthetic_policy_regressions",
        "independent_research_validation": False,
        "policy": {"short_text_review_below": 5, "comparison_case_insensitive": False},
        "policy_status": "development_only_not_research_approved",
        "scenario_count": 1,
        "scenario_language_counts": {"english": 1},
        "execution_count": 1,
        "records_evaluated_including_strategy_repeats": 2,
        "matched_executions": 1,
        "failed_executions": 0,
        "status_counts": statuses,
        "issue_counts": {"duplicate_text": 2},
        "blocking_reason_counts": {"data_quality_review_required": 1},
        "automated_gate_passed_executions": 0,
        "automated_gate_blocked_executions": 1,
        "outcomes": [
            {
                "category": "synthetic_duplicate",
                "language_slice": "english",
                "strategy": "quality_only",
                "scope": "quality_gate_only",
                "records": 2,
                "expected_status_counts": statuses.copy(),
                "observed_status_counts": statuses.copy(),
                "expected_issue_counts": {"duplicate_text": 2},
                "observed_issue_counts": {"duplicate_text": 2},
                "expected_blocking_reasons": ["data_quality_review_required"],
                "observed_blocking_reasons": ["data_quality_review_required"],
                "expected_automated_gate_passed": False,
                "observed_automated_gate_passed": False,
                "expectations_matched": True,
            }
        ],
        "privacy_note": "Aggregate synthetic test evidence only.",
        "release_policy": {
            "synthetic_only": True,
            "approved_private_remote": None,
            "human_release_required": True,
            "dataset_version": None,
        },
        "revision": "1" * 40,
        "quality_source_sha256": "2" * 64,
        "policy_sha256": "3" * 64,
        "release_policy_sha256": "4" * 64,
        "environment": {"python": "synthetic-python", "platform": "synthetic-platform"},
        "reproduction_command": "synthetic historical verification command",
    }


def test_conversion_never_executes_fixtures_and_preserves_source(
    tmp_path, recorded_evidence, monkeypatch
):
    from preprocessing import quality_report

    def forbidden_run(*args, **kwargs):
        raise AssertionError("PDF conversion attempted to execute fixtures")

    monkeypatch.setattr(quality_report, "run_synthetic_checks", forbidden_run)
    source, output = tmp_path / "results.json", tmp_path / "quality-report.pdf"
    raw = json.dumps(recorded_evidence, indent=2).encode() + b"\n"
    source.write_bytes(raw)
    monkeypatch.setattr(
        sys, "argv", ["quality_pdf", "--results", str(source), "--output", str(output)]
    )
    quality_pdf.main()
    assert source.read_bytes() == raw
    assert PdfReader(output).attachments["results.json"][0] == raw
    with pymupdf.open(output) as document:
        text = "\n".join(page.get_text() for page in document)
        assert "fewer than 5" in text
        assert "Case-insensitive text comparison: False" in text
        assert "synthetic historical verification command" in text
        assert "synthetic-platform" in text
        assert "Not independent research validation" in text
        assert "not release authorization" in text
        assert recorded_evidence["quality_source_sha256"] in text
        for index, page in enumerate(document):
            assert f"Page {index + 1} of {len(document)}" in page.get_text()
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    for span in line["spans"]:
                        x0, y0, x1, y1 = span["bbox"]
                        assert 30 <= x0 < x1 <= page.rect.width - 30
                        assert 15 <= y0 < y1 <= page.rect.height - 15


@pytest.mark.parametrize("location", ["root", "outcome", "policy"])
def test_fixture_or_identifier_fields_are_rejected(recorded_evidence, location):
    target = {
        "root": recorded_evidence,
        "outcome": recorded_evidence["outcomes"][0],
        "policy": recorded_evidence["policy"],
    }[location]
    target["record_id"] = "excluded-disposable-record"
    with pytest.raises(ValueError, match="structure") as error:
        quality_pdf.load_quality_results(json.dumps(recorded_evidence))
    assert "excluded-disposable-record" not in str(error.value)


def test_inconsistent_denominators_and_research_claims_fail(recorded_evidence):
    broken = copy.deepcopy(recorded_evidence)
    broken["execution_count"] = 99
    with pytest.raises(ValueError, match="denominators"):
        quality_pdf.load_quality_results(json.dumps(broken))
    recorded_evidence["independent_research_validation"] = True
    with pytest.raises(ValueError, match="synthetic"):
        quality_pdf.load_quality_results(json.dumps(recorded_evidence))


def test_mismatched_observations_are_reported_without_inventing_pass(tmp_path, recorded_evidence):
    row = recorded_evidence["outcomes"][0]
    row["observed_issue_counts"] = {"very_short_text": 2}
    row["expectations_matched"] = False
    recorded_evidence["matched_executions"] = 0
    recorded_evidence["failed_executions"] = 1
    recorded_evidence["issue_counts"] = {"very_short_text": 2}
    source, output = tmp_path / "results.json", tmp_path / "report.pdf"
    source.write_text(json.dumps(recorded_evidence), encoding="utf-8")
    quality_pdf.export_quality_pdf(source, output)
    text = "\n".join(page.extract_text() for page in PdfReader(output).pages)
    assert "NO" in text
    assert "very_short_text" in text


def test_output_cannot_overwrite_input(tmp_path, recorded_evidence):
    source = tmp_path / "results.json"
    source.write_text(json.dumps(recorded_evidence), encoding="utf-8")
    with pytest.raises(ValueError, match="must differ"):
        quality_pdf.export_quality_pdf(source, source)


def test_duplicate_json_keys_are_rejected():
    with pytest.raises(ValueError, match="Duplicate"):
        quality_pdf.load_quality_results('{"records":0,"records":1}')
