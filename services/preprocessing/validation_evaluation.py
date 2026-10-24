"""Local reference-based C2 evaluation. Missing gold never becomes a correct negative."""

from collections import Counter

from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.span_evaluation import ALIASES, EntitySpan, evaluate_detection, render

LANGUAGES = ("sinhala", "english", "romanized-si", "code-mixed")
ENTITIES = ("PERSON", "LOCATION", "EMAIL", "PHONE", "STUDENT_ID")


def validate_cases(cases):
    """Validate references before inference; exceptions never contain input values."""
    if not isinstance(cases, list) or not cases:
        raise ValueError("A non-empty cases list is required.")
    allowed = {"text", "gold_pii", "gold_language"}
    for index, case in enumerate(cases, 1):
        if (
            not isinstance(case, dict)
            or set(case) - allowed
            or not isinstance(case.get("text"), str)
        ):
            raise ValueError(f"Invalid fields in case position {index}.")
        if "gold_language" in case and case["gold_language"] not in LANGUAGES:
            raise ValueError(f"Invalid reference language at case position {index}.")
        if "gold_pii" not in case:
            continue
        spans = case["gold_pii"]
        if not isinstance(spans, list):
            raise ValueError(f"Explicit gold_pii list required at case position {index}.")
        seen = set()
        for span in spans:
            if not isinstance(span, dict) or set(span) != {"start", "end", "entity_type"}:
                raise ValueError(f"Invalid reference span at case position {index}.")
            start, end, entity = span["start"], span["end"], span["entity_type"]
            if (
                type(start) is not int
                or type(end) is not int
                or not 0 <= start < end <= len(case["text"])
                or entity not in ENTITIES
                or (start, end, entity) in seen
            ):
                raise ValueError(f"Invalid or duplicate reference span at case position {index}.")
            seen.add((start, end, entity))


def ratio(numerator, denominator):
    return numerator / denominator if denominator else None


def entity_rates(counts):
    tp, fp, fn = (counts.get(key, 0) for key in ("tp", "fp", "fn"))
    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": ratio(tp, tp + fp),
        "recall": ratio(tp, tp + fn),
        "f1": ratio(2 * tp, 2 * tp + fp + fn),
    }


def evaluate_cases(cases, *, strategy="presidio"):
    validate_cases(cases)
    batch = run_preprocessing_pipeline(
        [PipelineInput(f"evaluation-{index}", case["text"]) for index, case in enumerate(cases, 1)],
        strategy=strategy,
    )
    totals, entities = Counter(), {entity: Counter() for entity in ENTITIES}
    pii_languages = {language: Counter() for language in (*LANGUAGES, "unspecified")}
    confusion = {language: Counter() for language in LANGUAGES}
    pii_cases, language_cases, abstentions, exact = 0, 0, 0, 0
    views = []
    for index, (case, actual) in enumerate(zip(cases, batch.records, strict=True), 1):
        view = {"record_index": index, "pii_evaluated": False, "language_evaluated": False}
        if "gold_pii" in case:
            gold = {EntitySpan(**span) for span in case["gold_pii"]}
            # Same selector used by the runtime; verify its trace reproduces the
            # actual masked output before scoring original-offset typed spans.
            predicted = {
                EntitySpan(span.start, span.end, ALIASES.get(span.entity_type, span.entity_type))
                for span in evaluate_detection(case["text"], strategy)
            }
            if render(case["text"], tuple(predicted)) != actual.anonymized_text:
                raise ValueError(
                    f"Runtime/trace mismatch at case position {index}; no score emitted."
                )
            counts = {
                "tp": len(gold & predicted),
                "fp": len(predicted - gold),
                "fn": len(gold - predicted),
            }
            totals.update(counts)
            language_counts = pii_languages[case.get("gold_language", "unspecified")]
            language_counts.update(counts)
            language_counts["labelled_records"] += 1
            for entity in ENTITIES:
                entities[entity].update(
                    {
                        "tp": sum(span.entity_type == entity for span in gold & predicted),
                        "fp": sum(span.entity_type == entity for span in predicted - gold),
                        "fn": sum(span.entity_type == entity for span in gold - predicted),
                    }
                )
            covered = {position for span in predicted for position in range(span.start, span.end)}
            gold_chars = {position for span in gold for position in range(span.start, span.end)}
            totals["entirely_exposed_entities"] += sum(
                not covered.intersection(range(span.start, span.end)) for span in gold
            )
            totals["partially_masked_entities"] += sum(
                0 < len(covered.intersection(range(span.start, span.end))) < span.end - span.start
                for span in gold
            )
            totals["unnecessarily_masked_characters"] += len(covered - gold_chars)
            pii_cases += 1
            exact += gold == predicted
            view.update(pii_evaluated=True, exact_typed_spans=gold == predicted, **counts)
        if "gold_language" in case:
            expected, predicted_language = (
                case["gold_language"],
                actual.language_identification.language,
            )
            confusion[expected][predicted_language] += 1
            language_cases += 1
            abstentions += actual.language_identification.uncertain
            view.update(language_evaluated=True, language_match=expected == predicted_language)
        views.append(view)
    language_scores = {}
    for language in LANGUAGES:
        tp = confusion[language][language]
        fn = sum(confusion[language].values()) - tp
        fp = sum(counts[language] for other, counts in confusion.items() if other != language)
        language_scores[language] = {
            "support": sum(confusion[language].values()),
            **entity_rates({"tp": tp, "fp": fp, "fn": fn}),
        }
    f1_values = [row["f1"] for row in language_scores.values() if row["f1"] is not None]
    correct = sum(confusion[language][language] for language in LANGUAGES)
    return {
        "evaluation_method": "c2-labelled-output-evaluation-v1",
        "records_processed": len(cases),
        "distinct_input_texts": len({case["text"] for case in cases}),
        "anonymization": {
            "status": "MEASURED_AGAINST_REFERENCES" if pii_cases else "NOT_MEASURED",
            "labelled_records": pii_cases,
            "unlabelled_records": len(cases) - pii_cases,
            "gold_entities": totals["tp"] + totals["fn"],
            "exact_records": exact,
            "exact_record_match_rate": ratio(exact, pii_cases),
            **entity_rates(totals),
            "entirely_exposed_entities": totals["entirely_exposed_entities"],
            "partially_masked_entities": totals["partially_masked_entities"],
            "unnecessarily_masked_characters": totals["unnecessarily_masked_characters"],
            "by_entity": {entity: entity_rates(counts) for entity, counts in entities.items()},
            "by_language": {
                language: {"labelled_records": counts["labelled_records"], **entity_rates(counts)}
                for language, counts in pii_languages.items()
            },
        },
        "language_id": {
            "status": "MEASURED_AGAINST_REFERENCES" if language_cases else "NOT_MEASURED",
            "labelled_records": language_cases,
            "unlabelled_records": len(cases) - language_cases,
            "correct_records": correct,
            "accuracy": ratio(correct, language_cases),
            "abstentions": abstentions,
            "wrong_non_abstaining_records": language_cases - correct - abstentions,
            "macro_f1_present_classes": sum(f1_values) / len(f1_values) if f1_values else None,
            "classes_in_macro": len(f1_values),
            "by_language": language_scores,
            "confusion": {
                language: dict(sorted(counts.items())) for language, counts in confusion.items()
            },
        },
        "validation_summary": batch.validation_summary,
        "records": views,
        "release_ready": batch.release_ready,
        "human_release_required": True,
        "limitation": "Reference agreement, not certified anonymity or independent reference-label verification. Null means no denominator, never 100%. Normalization/tokenization rates are integrity compliance, not semantic accuracy.",
    }
