"""Actual local pipeline, authenticated Docker and registry coverage audit."""

import argparse
import hashlib
import json
from dataclasses import asdict
from importlib.metadata import version
from pathlib import Path

import httpx
from dotenv import dotenv_values
from preprocessing.demo import execute_custom
from preprocessing.pii_coverage import cases
from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.presidio_anonymization import ENTITY_PLACEHOLDERS, _get_engines
from preprocessing.span_evaluation import SELECTION_VERSION, evaluate_detection, render, score_spans
from research_contracts import C2CustomDemoRequest

from tests.unit.test_c2_contextual_detection import splits_boundary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--browser-inputs", type=Path)
    args = parser.parse_args()
    output = args.output_dir / "report.json"
    if output.exists():
        raise SystemExit("Refusing to overwrite evidence.")
    analyzer, _ = _get_engines()
    registry = [
        dict(name=r.name, entities=r.supported_entities, language=r.supported_language)
        for r in analyzer.registry.recognizers
    ]
    fixtures = cases()
    environment = dotenv_values(".env")
    rows = []
    with httpx.Client(
        base_url="http://localhost:3001/api/v1",
        headers={"Origin": "http://localhost:3001", "X-Requested-With": "j26-browser"},
        timeout=30,
        trust_env=False,
    ) as client:
        response = client.post(
            "/auth/login",
            json={
                "username": environment["DEV_COUNSELLOR_USERNAME"],
                "password": environment["DEV_COUNSELLOR_PASSWORD"],
            },
        )
        if response.status_code != 200:
            raise SystemExit("Local development authorization unavailable.")
        try:
            for fixture in fixtures:
                body = C2CustomDemoRequest(
                    text=fixture.text, language_hint=fixture.language, strategy="presidio"
                )
                local = execute_custom(body).model_dump(mode="json")
                response = client.post("/c2-demo/custom-runs", json=body.model_dump())
                if response.status_code != 200:
                    raise SystemExit("Safe Docker execution failure.")
                remote = response.json()
                measurements = {}
                for strategy in ("regex", "presidio", "hybrid"):
                    spans = evaluate_detection(fixture.text, strategy)
                    result = run_preprocessing_pipeline(
                        [PipelineInput(fixture.case_id, fixture.text)], strategy=strategy
                    )
                    measurements[strategy] = dict(
                        spans=[asdict(s) for s in spans],
                        metrics=score_spans(fixture.gold, spans),
                        masking_matches_spans=result.records[0].anonymized_text
                        == render(fixture.text, spans),
                        unsafe_boundaries=sum(
                            splits_boundary(fixture.text, b)
                            for s in spans
                            for b in (s.start, s.end)
                        ),
                        quality_status=result.records[0].quality_status.value,
                        transformations=result.records[0].transformations,
                        release_ready=result.release_ready,
                        blocking_reasons=result.blocking_reasons,
                    )
                raw = analyzer.analyze(
                    text=fixture.text, language="en", entities=list(ENTITY_PLACEHOLDERS)
                )
                rows.append(
                    dict(
                        case_id=fixture.case_id,
                        language=fixture.language,
                        category=fixture.category,
                        gold=[asdict(s) for s in fixture.gold],
                        measurements=measurements,
                        analyzer_candidates=[
                            dict(
                                start=r.start,
                                end=r.end,
                                label=r.entity_type,
                                score=r.score,
                                recognizer=r.recognition_metadata.get("recognizer_name"),
                            )
                            for r in raw
                        ],
                        local_docker_equal=local == remote,
                        original_preserved=remote["records"][0]["original_text"] == fixture.text,
                        no_store=response.headers.get("cache-control") == "no-store",
                    )
                )
        finally:
            client.post("/auth/logout", json={})
    table = {}
    for language in ("english", "sinhala", "romanized-si", "code-mixed"):
        table[language] = {}
        for label in ("PERSON", "LOCATION", "EMAIL", "PHONE", "STUDENT_ID"):
            eligible = [
                r
                for r in rows
                if r["language"] == language
                and r["category"] in ("entity", "combined", "diagnostic")
            ]
            expected = [(r, s) for r in eligible for s in r["gold"] if s["entity_type"] == label]
            exact = sum(s in r["measurements"]["presidio"]["spans"] for r, s in expected)
            covered = sum(
                any(
                    p["start"] < s["end"] and p["end"] > s["start"]
                    for p in r["measurements"]["presidio"]["spans"]
                )
                for r, s in expected
            )
            typed_covered = sum(
                any(
                    p["entity_type"] == label and p["start"] < s["end"] and p["end"] > s["start"]
                    for p in r["measurements"]["presidio"]["spans"]
                )
                for r, s in expected
            )
            table[language][label] = dict(
                exact=exact,
                total=len(expected),
                at_least_partly_masked=covered,
                typed_at_least_partly_masked=typed_covered,
                status="not evaluated"
                if not expected
                else "verified working"
                if exact == len(expected)
                else "partially working"
                if typed_covered
                else "failing",
            )
    args.output_dir.mkdir(parents=True, exist_ok=True)
    report = dict(
        configuration="Presidio English en_core_web_sm plus offline email, Sri Lankan mobile and student-ID rules; student-ID selection v1; contextual configuration is identified by the registry and runtime_configuration; rejected explicit-title-v1/GLiNER/trained candidates remain offline",
        runtime_configuration=SELECTION_VERSION,
        packages={name: version(name) for name in ("presidio-analyzer", "spacy", "en-core-web-sm")},
        registry=registry,
        runtime_requested_entities=list(ENTITY_PLACEHOLDERS),
        coverage=table,
        cases=rows,
        source_hashes={
            name: hashlib.sha256(Path(name).read_bytes()).hexdigest()
            for name in (
                "services/preprocessing/span_evaluation.py",
                "services/preprocessing/presidio_anonymization.py",
                "services/preprocessing/pii_coverage.py",
            )
        },
    )
    with output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2, ensure_ascii=True)
    if args.browser_inputs:
        with args.browser_inputs.open("x", encoding="utf-8") as stream:
            json.dump(
                [dict(case_id=c.case_id, text=c.text, hint=c.language) for c in fixtures],
                stream,
                ensure_ascii=False,
            )
    print(
        json.dumps(
            dict(
                cases=len(rows),
                coverage=table,
                registry=registry,
                parity=all(r["local_docker_equal"] for r in rows),
                trace_integrity=all(
                    m["masking_matches_spans"] for r in rows for m in r["measurements"].values()
                ),
            )
        )
    )
    if not all(r["local_docker_equal"] and r["original_preserved"] and r["no_store"] for r in rows):
        raise SystemExit("Pipeline/Docker parity failed; inspect safe evidence.")


if __name__ == "__main__":
    main()
