"""Experimental sentence-context helper; LOCATION-only augmentation is active.

Original-text slices only, unchanged model labels/threshold. An additive probe
keeps baseline spans, abstains on overlapping alternatives, and protects existing
placeholders. This is not a second independent residual-PII verifier.
"""

import regex

from preprocessing.multilingual_calibration import splits_boundary
from preprocessing.span_evaluation import PLACEHOLDERS, EntitySpan

VERSION = "c2-gliner-sentence-context-probe-v1"
BREAK = regex.compile(r"(?<=[.!?])[ \t\r\n]+|[\r\n]+")
TITLE_END = regex.compile(r"(?i)(?<!\p{L})(?:Ms|Mr|Mrs|Dr)\.$")


def sentence_windows(text):
    start = 0
    for match in BREAK.finditer(text):
        if TITLE_END.search(text[start : match.start()]):
            continue
        if start < match.start():
            yield start, match.start()
        start = match.end()
    if start < len(text):
        yield start, len(text)


def window_predictions(text, model):
    """Return scored original-offset model predictions; no rewriting or gold use."""
    found = []
    for start, end in sentence_windows(text):
        for item in model.predict_entities(
            text[start:end], ["person name", "location name"], threshold=0.7, flat_ner=True
        ):
            first, last = start + item["start"], start + item["end"]
            if (
                not 0 <= first < last <= len(text)
                or text[first:last] != item["text"]
                or any(splits_boundary(text, edge) for edge in (first, last))
            ):
                raise RuntimeError("Unsafe sentence-context prediction")
            found.append(
                (
                    item["score"],
                    EntitySpan(
                        first,
                        last,
                        {"person name": "PERSON", "location name": "LOCATION"}[item["label"]],
                    ),
                )
            )
    return tuple(found)


def augment(text, baseline, predictions):
    """Keep baseline coverage/types. Conflicting window predictions abstain."""
    selected = list(baseline)
    protected = [match.span() for match in PLACEHOLDERS.finditer(text)]
    for score, span in sorted(predictions, key=lambda pair: (-pair[0], pair[1].start, pair[1].end)):
        if score < 0.7 or any(span.start < end and span.end > start for start, end in protected):
            continue
        if any(span.start < other.end and span.end > other.start for other in selected):
            continue
        selected.append(span)
    return tuple(sorted(set(selected)))


def augment_locations(text, baseline, predictions):
    """Development-derived narrow probe; whole-text PERSON predictions unchanged."""
    return augment(
        text, baseline, ((score, s) for score, s in predictions if s.entity_type == "LOCATION")
    )
