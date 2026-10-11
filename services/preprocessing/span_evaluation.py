"""Original-offset masking traces. Only synthetic evaluation may retain these traces.

Production wrappers discard spans; no values or text are logged here.
Offsets are half-open Python Unicode character offsets, not UTF-8 bytes.
"""

import re
from dataclasses import dataclass

from preprocessing import anonymization as rules

PLACEHOLDERS = re.compile(r"\[(?:EMAIL|PHONE|STUDENT_ID|PERSON|LOCATION)\]")
ALIASES = {"EMAIL_ADDRESS": "EMAIL", "PHONE_NUMBER": "PHONE"}


@dataclass(frozen=True, order=True)
class EntitySpan:
    start: int
    end: int
    entity_type: str


def regex_trace(text: str):
    mapping = list(range(len(text)))
    spans = []
    transformations = []
    patterns = (
        (rules.EMAIL_PATTERN, "EMAIL", 0, "email"),
        (rules.PHONE_PATTERN, "PHONE", 0, "phone"),
        (rules.STUDENT_ID_PATTERN, "STUDENT_ID", 0, "student-id"),
        (rules.TITLED_NAME_PATTERN, "PERSON", 0, "person"),
        (rules.ENGLISH_NAME_PATTERN, "PERSON", 2, "person"),
        (rules.ENGLISH_SELF_NAME_PATTERN, "PERSON", 2, "person"),
        (rules.ROMANIZED_NAME_PATTERN, "PERSON", 2, "person"),
        (rules.SINHALA_NAME_PATTERN, "PERSON", 2, "person"),
        (rules.SINHALA_SELF_NAME_PATTERN, "PERSON", 2, "person"),
        (rules.ENGLISH_LOCATION_PATTERN, "LOCATION", 2, "location"),
    )
    for pattern, entity, group, label in patterns:
        protected = [m.span() for m in PLACEHOLDERS.finditer(text)]
        matches = [m.span(group) for m in pattern.finditer(text)]
        for start, end in reversed(matches):
            if any(start < b and end > a for a, b in protected):
                continue
            original = mapping[start:end]
            if not original or any(i is None for i in original):
                continue
            spans.append(EntitySpan(original[0], original[-1] + 1, entity))
            replacement = f"[{entity}]"
            text = text[:start] + replacement + text[end:]
            mapping[start:end] = [None] * len(replacement)
            transformations.append(f"mask:{label}")
    return text, tuple(dict.fromkeys(transformations)), tuple(sorted(spans))


def select_presidio(text: str):
    from preprocessing.presidio_anonymization import ENTITY_PLACEHOLDERS, _get_engines

    analyzer, _ = _get_engines()
    results = analyzer.analyze(text=text, language="en", entities=list(ENTITY_PLACEHOLDERS))
    protected = [m.span() for m in PLACEHOLDERS.finditer(text)]
    selected = []
    # Deterministic confidence-first overlap resolution; the same spans drive masking.
    for result in sorted(
        results, key=lambda r: (-r.score, -(r.end - r.start), r.start, r.entity_type)
    ):
        if any(result.start < b and result.end > a for a, b in protected):
            continue
        if any(result.start < r.end and result.end > r.start for r in selected):
            continue
        selected.append(result)
    return sorted(selected, key=lambda r: r.start)


def render(text: str, spans: tuple[EntitySpan, ...]) -> str:
    for span in sorted(spans, reverse=True):
        text = text[: span.start] + f"[{span.entity_type}]" + text[span.end :]
    return text


def evaluate_detection(text: str, strategy: str) -> tuple[EntitySpan, ...]:
    """Common interface returning only actual masking spans on original input."""
    if strategy == "regex":
        return regex_trace(text)[2]
    if strategy == "presidio":
        return tuple(
            EntitySpan(r.start, r.end, ALIASES.get(r.entity_type, r.entity_type))
            for r in select_presidio(text)
        )
    if strategy != "hybrid":
        raise ValueError("Unknown anonymization strategy")
    masked, _, regex_spans = regex_trace(text)
    # Map untouched characters after variable-length replacements to original offsets.
    mapping = []
    cursor = 0
    for span in regex_spans:
        mapping.extend(range(cursor, span.start))
        mapping.extend([None] * len(f"[{span.entity_type}]"))
        cursor = span.end
    mapping.extend(range(cursor, len(text)))
    additional = []
    for result in select_presidio(masked):
        offsets = mapping[result.start : result.end]
        if offsets and all(i is not None for i in offsets):
            additional.append(
                EntitySpan(
                    offsets[0], offsets[-1] + 1, ALIASES.get(result.entity_type, result.entity_type)
                )
            )
    return tuple(sorted((*regex_spans, *additional)))


def score_spans(gold, predicted):
    """Exact typed spans plus character-union masking coverage (overlap counted once).

    Undefined precision/recall = 1. F1 = 0 when both zero. Empty gold and
    prediction = 1 for all rates; always interpret alongside denominators.
    """
    gold, predicted = set(gold), set(predicted)
    tp = len(gold & predicted)
    fp, fn = len(predicted - gold), len(gold - predicted)
    precision = tp / len(predicted) if predicted else 1.0
    recall = tp / len(gold) if gold else 1.0
    covered = {i for s in predicted for i in range(s.start, s.end)}
    gold_chars = {i for s in gold for i in range(s.start, s.end)}
    return {
        "gold_entities": len(gold),
        "predicted_entities": len(predicted),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": precision,
        "recall": recall,
        "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
        "missed_gold_pii": sum(not covered.intersection(range(s.start, s.end)) for s in gold),
        "partial_masking": sum(
            0 < len(covered.intersection(range(s.start, s.end))) < s.end - s.start for s in gold
        ),
        "unmasked_gold_characters": len(gold_chars - covered),
        "gold_characters": len(gold_chars),
        "unnecessary_masked_characters": len(covered - gold_chars),
        "masked_characters": len(covered),
    }
