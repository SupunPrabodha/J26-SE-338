"""Exporter regressions use aggregate-only synthetic test evidence."""

import copy
import json
import sys

import pymupdf
import pytest
from preprocessing import benchmark_report
from preprocessing.pdf_report import COUNTS, RATES, export_pdf, validate_results
from pypdf import PdfReader


@pytest.fixture
def aggregate_results():
    metric = dict.fromkeys(COUNTS, 0) | dict.fromkeys(RATES, 1.0)
    strategy = {
        "overall": metric,
        "per_language": {
            k: metric | {"cases": 0} for k in ("english", "sinhala", "romanized", "code_mixed")
        },
        "per_entity": {
            k: metric.copy() for k in ("EMAIL", "PHONE", "STUDENT_ID", "PERSON", "LOCATION")
        },
        "per_family": {
            k: metric | {"cases": 0}
            for k in (
                "heldout-identifiers",
                "heldout-names-locations",
                "heldout-wellbeing-negatives",
            )
        },
        "runtime": {
            "cold_ms": 1.2345678901234567,
            "median_ms": 0.0123456789,
            "p95_ms": 0.025,
            "calls": 0,
            "repetitions": 20,
        },
    }
    return {
        "methodology": {
            "evaluation_scope": "disposable_synthetic_heldout",
            "metric_basis": "exact_typed_original_character_spans",
            "offsets": "half_open_unicode_characters",
            "zero_denominator_policy": "Synthetic test policy",
            "masking_coverage": "Synthetic test coverage",
            "model_languages": ["en"],
            "selection_policy": "Provisional only",
        },
        "benchmark_id": "c2-synthetic-v1-0000000000000000",
        "split_sizes": {"development": 0, "heldout": 0},
        "heldout_languages": dict.fromkeys(("english", "sinhala", "romanized", "code_mixed"), 0),
        "environment": {
            "python": "synthetic-test-python",
            "platform": "synthetic-test-platform",
            "processor": "synthetic-test-processor",
            "versions": dict.fromkeys(
                (
                    "presidio-analyzer",
                    "presidio-anonymizer",
                    "spacy",
                    "en-core-web-sm",
                    "tldextract",
                ),
                "0.0",
            ),
        },
        "revision": "0" * 40,
        "working_diff_sha256": "1" * 64,
        "preprocessing_source_sha256": "2" * 64,
        "requirements_sha256": "3" * 64,
        "strategies": {s: copy.deepcopy(strategy) for s in ("regex", "presidio", "hybrid")},
    }


def test_conversion_preserves_source_and_never_measures(tmp_path, aggregate_results, monkeypatch):
    source = tmp_path / "results.json"
    raw = json.dumps(aggregate_results, indent=2).encode() + b"\n"
    source.write_bytes(raw)
    markdown = tmp_path / "comparison.md"
    markdown.write_bytes(b"existing report")

    def forbidden_measure(*args, **kwargs):
        raise AssertionError("Conversion must not rerun benchmark")

    monkeypatch.setattr(benchmark_report, "measure", forbidden_measure)
    monkeypatch.setattr(benchmark_report, "anonymizer", forbidden_measure)
    monkeypatch.setattr(
        sys,
        "argv",
        ["benchmark_report", "--pdf-from-results", str(source), "--output", str(tmp_path)],
    )
    benchmark_report.main()
    pdf = tmp_path / "comparison.pdf"
    assert source.read_bytes() == raw
    assert markdown.read_bytes() == b"existing report"
    assert PdfReader(pdf).attachments["results.json"][0] == raw
    with pymupdf.open(pdf) as document:
        text = "\n".join(page.get_text() for page in document)
        assert "1.2345678901234567" in text
        assert aggregate_results["requirements_sha256"] in text
        assert "Provisional recommendation: Presidio" in text
        assert "Regex remains the current default" in text
        assert "synthetic-test-platform" in text
        for index, page in enumerate(document):
            assert f"Page {index + 1} of {len(document)}" in page.get_text()
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    for span in line["spans"]:
                        x0, y0, x1, y1 = span["bbox"]
                        assert 30 <= x0 < x1 <= page.rect.width - 30
                        assert 15 <= y0 < y1 <= page.rect.height - 15


@pytest.mark.parametrize("section", ["root", "metric", "strategy"])
def test_unknown_fields_cannot_embed_fixture_data(aggregate_results, section):
    target = {
        "root": aggregate_results,
        "metric": aggregate_results["strategies"]["regex"]["overall"],
        "strategy": aggregate_results["strategies"]["regex"],
    }[section]
    target["synthetic_text"] = "excluded disposable text"
    with pytest.raises(ValueError, match="structure"):
        validate_results(aggregate_results)


def test_nonfinite_scores_and_missing_candidate_rejected(aggregate_results):
    aggregate_results["strategies"]["regex"]["overall"]["f1"] = float("nan")
    with pytest.raises(ValueError, match="rate"):
        validate_results(aggregate_results)
    del aggregate_results["strategies"]["presidio"]
    with pytest.raises(ValueError, match="strategies"):
        validate_results(aggregate_results)


def test_converter_cannot_overwrite_source(tmp_path, aggregate_results):
    source = tmp_path / "results.json"
    source.write_text(json.dumps(aggregate_results), encoding="utf-8")
    with pytest.raises(ValueError, match="differ"):
        export_pdf(source, source)


def test_selection_summary_uses_percentages_without_measuring(
    tmp_path, aggregate_results, monkeypatch
):
    source = tmp_path / "results.json"
    raw = json.dumps(aggregate_results).encode()
    source.write_bytes(raw)

    def forbidden_measure(*args, **kwargs):
        raise AssertionError("Selection report must use recorded evidence")

    monkeypatch.setattr(benchmark_report, "measure", forbidden_measure)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "benchmark_report",
            "--pdf-from-results",
            str(source),
            "--selection-summary",
            "--output",
            str(tmp_path),
        ],
    )
    benchmark_report.main()
    pdf = PdfReader(tmp_path / "comparison.pdf")
    text = "\n".join(page.extract_text() for page in pdf.pages)
    assert "100.00%" in text
    assert "Why provisionally choose Presidio" in text
    assert "not a general accuracy" in text
    assert pdf.attachments["results.json"][0] == raw
    assert source.read_bytes() == raw
