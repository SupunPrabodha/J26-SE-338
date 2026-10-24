"""Evaluate complementary output triage separately from anonymizer accuracy."""

import hashlib
import json
from collections import Counter
from pathlib import Path

from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.privacy_gate import assess_release
from preprocessing.residual_privacy import SOURCE, VERSION, assess_output

FIXTURE = Path("tests/fixtures/synthetic/c2-residual-output-v1.json")
DIRECTORY = Path("artifacts/c2-evidence/anonymization/residual-output-v1")


def main():
    DIRECTORY.mkdir(parents=True, exist_ok=True)
    output = DIRECTORY / "report.json"
    if output.exists():
        raise SystemExit("Existing residual evidence preserved")
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    rows = []
    for case in fixture["cases"]:
        signals = assess_output(case["text"])
        gate = assess_release(
            ("record_id", "anonymized_text"),
            [
                dict(
                    record_id="synthetic",
                    anonymized_text=case["text"],
                    requires_privacy_review=False,
                )
            ],
        )
        rows.append(
            dict(
                id=case["id"],
                language=case["language"],
                residual=case["residual"],
                type_disagreement=case.get("type_disagreement", False),
                unobservable_type_error=case.get("unobservable_type_error", False),
                signals=[s.__dict__ for s in signals],
                blocked=not gate.passed,
            )
        )
    positives = [r for r in rows if r["residual"]]
    negatives = [
        r
        for r in rows
        if not r["residual"] and not r["type_disagreement"] and not r["unobservable_type_error"]
    ]
    live = []
    # Actual local execution, not reconstructed from selected masking spans.
    for strategy in ("regex", "presidio", "hybrid"):
        for index, text in enumerate(
            (
                "Name: Elara Voss",
                "Location: Keswick",
                "My name is Jane Miller.",
                "mge nama neluni",
                "මගේ නම නිමල් පෙරේරා.",
                "මම කොළඹ ජීවත් වෙමි.",
                "Mata exams gana dukai.",
                "මම අද මහන්සියි.",
                "Contact demo@example.com, 0771234567, IT12345678.",
                "ape grp leader supun. eyge girlfriend neluni . ey hrim npurui",
            )
        ):
            result = run_preprocessing_pipeline(
                [PipelineInput("synthetic", text)], strategy=strategy
            )
            record = result.records[0]
            live.append(
                dict(
                    index=index,
                    strategy=strategy,
                    signals=[s.__dict__ for s in assess_output(record.anonymized_text)],
                    quality=record.quality_status.value,
                    privacy_review=record.requires_privacy_review,
                    release_ready=result.release_ready,
                    blocking_reasons=result.blocking_reasons,
                    validation=result.validation_summary,
                )
            )
    summary = dict(
        cases=len(rows),
        unique_texts=len({r["text"] for r in fixture["cases"]}),
        residual_cases=len(positives),
        residual_signal_hits=sum(bool(r["signals"]) for r in positives),
        residual_misses=[r["id"] for r in positives if not r["signals"]],
        confirmed_FAIL_cases=sum(
            any(s["status"] == "FAIL" for s in r["signals"]) for r in positives
        ),
        review_only_cases=sum(
            bool(r["signals"]) and not any(s["status"] == "FAIL" for s in r["signals"])
            for r in positives
        ),
        ordinary_negative_cases=len(negatives),
        false_alarms=[r["id"] for r in negatives if r["signals"]],
        false_FAILs=[
            r["id"] for r in negatives if any(s["status"] == "FAIL" for s in r["signals"])
        ],
        language_counts=dict(Counter(r["language"] for r in rows)),
    )
    data = dict(
        method=VERSION,
        provenance=fixture["provenance"],
        fixture_sha256=hashlib.sha256(FIXTURE.read_bytes()).hexdigest(),
        source_sha256=hashlib.sha256(Path(SOURCE).read_bytes()).hexdigest(),
        summary=summary,
        outcomes=rows,
        actual_pipeline_executions=live,
        accuracy_scope="Record-level residual triage on proposed output labels, NOT anonymizer entity accuracy. Review is not a detected/masked entity. No independent validation.",
    )
    with output.open("x", encoding="utf-8") as target:
        json.dump(data, target, indent=2)
    (DIRECTORY / "report.md").write_text(
        "# Residual-output audit v1\n\n"
        + json.dumps(summary, indent=2)
        + "\n\n30 actual Python pipeline runs; no text or detected values in aggregate evidence. Triage is separate from anonymizer span accuracy. See docs/evidence/c2-residual-output-v1.md for limitations.\n",
        encoding="utf-8",
    )
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
