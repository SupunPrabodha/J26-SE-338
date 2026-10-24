"""Shared bounded-context merge and exact-span accounting from study v3.

Fixture pools and rejected experiment runners are excluded from this checkpoint.
"""

from preprocessing.contextual_detection import detect_contextual
from preprocessing.multilingual_calibration import splits_boundary
from preprocessing.multilingual_evaluation import aggregate
from preprocessing.span_evaluation import PLACEHOLDERS, EntitySpan, score_spans


def combine(text, predicted, contextual=None):
    """Offline replacement + shared grammar; never union English NER output.

    Structured identifiers win. Context fields replace overlapping unstructured
    predictions in their parsed field/introduction only; adjacent spans remain.
    No predicted spans are expanded or aligned to reference annotations.
    """
    contextual = detect_contextual(text) if contextual is None else contextual
    result = list(predicted)
    protected = [m.span() for m in PLACEHOLDERS.finditer(text)]
    for field in contextual:
        if any(field.start < b and field.end > a for a, b in protected):
            continue
        overlaps = [s for s in result if s.start < field.end and s.end > field.context_start]
        if any(s.entity_type not in {"PERSON", "LOCATION"} for s in overlaps):
            continue
        result = [s for s in result if s not in overlaps]
        for old in overlaps:
            if old.start < field.context_start:
                result.append(EntitySpan(old.start, field.context_start, old.entity_type))
            if old.end > field.end:
                result.append(EntitySpan(field.end, old.end, old.entity_type))
        result.append(EntitySpan(field.start, field.end, field.entity_type))
    return tuple(sorted(set(result)))


def summarize(rows):
    def metrics(items, entity=None):
        return aggregate(
            [
                score_spans(
                    tuple(s for s in r["gold"] if entity is None or s.entity_type == entity),
                    tuple(s for s in r["predicted"] if entity is None or s.entity_type == entity),
                )
                for r in items
            ]
        )

    return dict(
        cases=len(rows),
        overall=metrics(rows),
        by_language={
            lang: dict(cases=len(sub := [r for r in rows if r["language"] == lang]), **metrics(sub))
            for lang in sorted({r["language"] for r in rows})
        },
        by_entity={
            e: metrics(rows, e) for e in ("PERSON", "LOCATION", "EMAIL", "PHONE", "STUDENT_ID")
        },
        by_language_entity={
            lang: {
                e: metrics([r for r in rows if r["language"] == lang], e)
                for e in ("PERSON", "LOCATION")
            }
            for lang in sorted({r["language"] for r in rows})
        },
        incorrect_type_exact_boundary=sum(
            1
            for r in rows
            for g in r["gold"]
            if any(
                (p.start, p.end) == (g.start, g.end) and p.entity_type != g.entity_type
                for p in r["predicted"]
            )
        ),
        unsafe_boundaries=sum(
            any(splits_boundary(r["text"], b) for s in r["predicted"] for b in (s.start, s.end))
            for r in rows
        ),
    )
