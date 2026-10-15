"""Frozen synthetic development evaluation of provisional Language ID rules."""

import argparse
import json
from collections import Counter
from dataclasses import asdict
from pathlib import Path

from preprocessing.language_id import VERSION
from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline

# Language gold is fixed before running; uncertain predictions are abstentions,
# not relabelled correct language detections. No participant material is used.
CASES = {
    "sinhala": (
        "විභාග නිසා මට බයයි.",
        "මම අද මහන්සියි.",
        "මගේ නම නිමල් පෙරේරා.",
        "අද හොඳ දවසක්. 🙂",
        "මට උදව් අවශ්‍යයි.",
        "ක්‍රියා කිරීම අපහසුයි.",
    ),
    "english": (
        "I feel worried about exams.",
        "Our studies are difficult today.",
        "My name is Jane Miller.",
        "Examinations exhaust everyone.",
        "Sleep matters.",
        "I am tired but talking helps. 🙂",
    ),
    "romanized-si": (
        "Mata exams gana dukai.",
        "mage nama neluni mt exam gna byi",
        "mge nngi senali",
        "oya kohomada inne",
        "ape grp leader supun",
        "mata hari mahansiyi nisa gedara inne",
    ),
    "code-mixed": (
        "මට I feel worried about exams.",
        "Mata exams gana dukai but I feel tired.",
        "මට exams pressure තියෙනවා.",
        "Mage nama Nimal Perera. I feel tired.",
        "අද workload වැඩියි.",
        "I am worried nisa mata bayai.",
    ),
    "unknown": ("", "[PERSON] [LOCATION]", "123 🙂", "தமிழ்", "こんにちは"),
    "uncertain": ("OK", "Aparna Supun", "bonjour salut monde", "I I I"),
}


def evaluate():
    rows = []
    slices = {}
    for expected, texts in CASES.items():
        counts = Counter()
        for index, text in enumerate(texts):
            result = run_preprocessing_pipeline(
                [PipelineInput("synthetic", text)], strategy="presidio"
            )
            record = result.records[0]
            prediction = record.language_identification
            matched = prediction.language == expected
            abstained = expected not in {"unknown", "uncertain"} and prediction.uncertain
            counts["records"] += 1
            counts["correct"] += int(matched)
            counts["uncertain_or_unknown"] += int(prediction.uncertain)
            counts["abstentions"] += int(abstained)
            counts["wrong_confident_labels"] += int(not matched and not prediction.uncertain)
            rows.append(
                {
                    "case_id": f"{expected}-{index}",
                    "expected_language": expected,
                    "prediction": asdict(prediction),
                    "correct": matched,
                    "quality_status": record.quality_status,
                    "requires_privacy_review": record.requires_privacy_review,
                    "release_ready": result.release_ready,
                }
            )
        slices[expected] = dict(counts)
    return {
        "method": VERSION,
        "strategy": "presidio",
        "records": len(rows),
        "evidence_status": "synthetic_development_not_independent_validation",
        "source_text_and_detected_values_excluded": True,
        "language_slices": slices,
        "cases": rows,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    directory = parser.parse_args().output_dir
    directory.mkdir(parents=True, exist_ok=True)
    destination = directory / "report.json"
    if destination.exists():
        raise SystemExit("Refusing to overwrite existing evidence")
    report = evaluate()
    destination.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "method": report["method"],
                "records": report["records"],
                "language_slices": report["language_slices"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
