"""Bounded local synthetic-only pilot import; never imports participant responses."""

import argparse
import hashlib
import json
import os
from dataclasses import asdict
from pathlib import Path

from dotenv import dotenv_values
from preprocessing.language_id import VERSION
from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.span_evaluation import SELECTION_VERSION
from preprocessing.text_processing import NORMALIZATION_METHOD, TOKENIZATION_METHOD
from research_common.config import settings
from research_common.database import Account, engine
from research_contracts import C2CustomDemoResponse, C2DemoRecord
from sqlalchemy import select
from sqlalchemy.orm import Session

from orchestrator.c2_annotation import SCHEMA, VOCABULARY
from orchestrator.c2_annotation_store import (
    AnnotationRecord,
    AnnotationSlot,
    AnnotationSubmission,
    SubmissionAnswer,
    SubmissionAssignment,
)

DATASET = "J26-SE-338-C2-synthetic-survey-1000-v1"
LANGUAGES = ("sinhala", "english", "romanized_sinhala", "code_mixed")


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=True).encode()).hexdigest()


def load_pilot(folder):
    metadata = json.loads((folder / "schema_and_provenance.json").read_text(encoding="utf-8"))
    if metadata.get("dataset_id") != DATASET:
        raise ValueError("Only the explicitly authorized synthetic dataset is accepted")
    source = folder / "submissions_1000.jsonl"
    rows = [json.loads(line) for line in source.read_text(encoding="utf-8").splitlines()]
    # Fixed selection, not gate-based cherry-picking. English deliberately covers absent Q10.
    selected = []
    for language in LANGUAGES:
        row = next(
            row
            for row in rows
            if row["intended_language"] == language
            and (
                language != "english"
                or row["answers"][-1]["answer_status"] == "OPTIONAL_UNANSWERED"
            )
        )
        if row["source_type"] != "SYNTHETIC" or row.get("participant_identity") is not None:
            raise ValueError("Synthetic provenance required")
        if [answer["question_id"] for answer in row["answers"]] != [f"Q{i}" for i in range(4, 11)]:
            raise ValueError("Expected exactly Q4 through Q10 in order")
        for answer in row["answers"]:
            if answer["record_id"] != row["submission_id"] + "-" + answer["question_id"]:
                raise ValueError("Source record identity mismatch")
            if answer["required"] != (answer["question_id"] != "Q10"):
                raise ValueError("Required-question metadata mismatch")
            text = answer["answer_text"]
            if text is not None and (not isinstance(text, str) or len(text) > 4000):
                raise ValueError("Invalid synthetic answer")
        selected.append(row)
    return selected, {
        "dataset_id": DATASET,
        "source_file_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "metadata_sha256": digest(metadata),
        "generator_version": metadata["version"],
    }


def import_pilot(db, rows, provenance, actors):
    if len(set(actors)) != 2:
        raise ValueError("Two distinct existing accounts required")
    accounts = [db.get(Account, actor) for actor in actors]
    if any(
        account is None or not account.enabled or account.role not in {"COUNSELLOR", "ADMIN"}
        for account in accounts
    ):
        raise ValueError("Authorized existing development accounts required")
    if (
        len(rows) != 4
        or provenance.get("dataset_id") != DATASET
        or any(row.get("source_type") != "SYNTHETIC" for row in rows)
    ):
        raise ValueError("Only the four-submission synthetic pilot is allowed")
    if len({row["submission_id"] for row in rows}) != 4:
        raise ValueError("Duplicate submission IDs")
    for row in rows:
        if row.get("participant_identity") is not None:
            raise ValueError("Participant input is not allowed")
        if [answer["question_id"] for answer in row["answers"]] != [f"Q{i}" for i in range(4, 11)]:
            raise ValueError("Expected exactly Q4 through Q10")
        for answer in row["answers"]:
            if answer["record_id"] != row["submission_id"] + "-" + answer["question_id"]:
                raise ValueError("Source record identity mismatch")
            if answer["required"] != (answer["question_id"] != "Q10"):
                raise ValueError("Required-question metadata mismatch")
            value = answer["answer_text"]
            if value is not None and (not isinstance(value, str) or len(value) > 4000):
                raise ValueError("Invalid answer text")
    inputs = [
        PipelineInput(answer["record_id"], answer["answer_text"])
        for row in rows
        for answer in row["answers"]
        if answer["answer_text"] is not None
    ]
    batch = run_preprocessing_pipeline(inputs, strategy="presidio")
    checked = {output.record_id: output for output in batch.records}
    pipeline = "|".join((SELECTION_VERSION, VERSION, NORMALIZATION_METHOD, TOKENIZATION_METHOD))
    report = {
        "submissions": len(rows),
        "positions": 7 * len(rows),
        "available": 0,
        "withheld": 0,
        "optional_unanswered": 0,
        "missing_required": 0,
        "issue_counts": {},
        "batch_quality": batch.quality_summary,
        "batch_privacy": batch.privacy_summary,
        "source": provenance,
        "decisions": "automated_prerequisites_not_human_approval",
    }
    for row in rows:
        sid = row["submission_id"]
        version = digest(
            {
                "source_row": row,
                "source": provenance,
                "pipeline": pipeline,
                "schema": SCHEMA,
                "vocabulary": VOCABULARY,
                "pilot_batch": [r["submission_id"] for r in rows],
            }
        )
        existing = db.get(AnnotationSubmission, sid)
        if existing:
            assigned = set(
                db.scalars(
                    select(SubmissionAssignment.actor_id).where(
                        SubmissionAssignment.submission_id == sid
                    )
                )
            )
            if existing.submission_version != version or assigned != set(actors):
                raise ValueError(
                    "Frozen submission/version or assignments conflict; nothing overwritten"
                )
            raise ValueError("Pilot already imported; existing history preserved")
        db.add(
            AnnotationSubmission(
                submission_id=sid,
                submission_version=version,
                provenance={
                    **provenance,
                    "source_row_sha256": digest(row),
                    "form_version": row["form_version"],
                },
            )
        )
        db.flush()
        for slot, actor in enumerate(actors, 1):
            db.add(SubmissionAssignment(submission_id=sid, actor_id=actor, slot=slot))
        for answer in row["answers"]:
            qid, rid, source = answer["question_id"], answer["record_id"], answer["answer_text"]
            reasons, record_id = [], None
            if source is None or not source.strip():
                state = "OPTIONAL_UNANSWERED" if qid == "Q10" else "MISSING_REQUIRED"
            else:
                result = run_preprocessing_pipeline(
                    [PipelineInput(rid, source)], strategy="presidio"
                )
                output = checked[rid]
                reasons = list(dict.fromkeys([*output.quality_issues, *result.blocking_reasons]))
                eligible = (
                    output.quality_status == "PASS"
                    and not output.requires_privacy_review
                    and result.release_ready
                )
                state = "AVAILABLE" if eligible else "WITHHELD"
                if eligible:
                    snapshot = C2CustomDemoResponse(
                        language_hint="unsure",
                        strategy="presidio",
                        records=[C2DemoRecord(original_text=source, **asdict(result.records[0]))],
                        quality_summary=result.quality_summary,
                        privacy_summary=result.privacy_summary,
                        release_ready=result.release_ready,
                        blocking_reasons=result.blocking_reasons,
                    ).model_dump(mode="json")
                    record_id = rid
                    db.add(
                        AnnotationRecord(
                            record_id=rid,
                            record_version=digest({"snapshot": snapshot, "submission": version}),
                            pipeline_version=pipeline,
                            annotation_schema_version=SCHEMA,
                            vocabulary_version=VOCABULARY,
                            snapshot=snapshot,
                        )
                    )
                    db.flush()
                    for slot, actor in enumerate(actors, 1):
                        db.add(AnnotationSlot(record_id=rid, actor_id=actor, slot=slot))
            report[
                {
                    "AVAILABLE": "available",
                    "WITHHELD": "withheld",
                    "OPTIONAL_UNANSWERED": "optional_unanswered",
                    "MISSING_REQUIRED": "missing_required",
                }[state]
            ] += 1
            for reason in reasons:
                report["issue_counts"][reason] = report["issue_counts"].get(reason, 0) + 1
            db.add(
                SubmissionAnswer(
                    submission_id=sid,
                    question_id=qid,
                    question_text=answer["question_text"],
                    source_record_id=rid,
                    state=state,
                    record_id=record_id,
                    blocking_reasons=reasons,
                )
            )
    db.flush()
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--source", type=Path)
    source.add_argument("--manifest", type=Path, help="Locally frozen four-row synthetic pilot")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--freeze-only",
        action="store_true",
        help="Write four-row ignored local manifest without database writes",
    )
    args = parser.parse_args()
    if settings().environment != "development" or args.output.exists():
        raise SystemExit("Development only; use a fresh evidence path")
    if args.source:
        rows, provenance = load_pilot(args.source)
    else:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        rows, provenance = manifest["rows"], manifest["provenance"]
    if args.freeze_only:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps({"rows": rows, "provenance": provenance}, ensure_ascii=False),
            encoding="utf-8",
        )
        print("Frozen four synthetic submissions; no database writes")
        return
    private = {**dotenv_values(".env"), **os.environ}
    with Session(engine()) as db:
        actors = [
            db.scalar(
                select(Account.id).where(Account.username == private.get(f"DEV_{role}_USERNAME"))
            )
            for role in ("COUNSELLOR", "ADMIN")
        ]
        report = import_pilot(db, rows, provenance, actors)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        db.commit()
        args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                key: report[key]
                for key in (
                    "submissions",
                    "positions",
                    "available",
                    "withheld",
                    "optional_unanswered",
                    "missing_required",
                )
            }
        )
    )


if __name__ == "__main__":
    main()
