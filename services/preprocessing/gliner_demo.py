"""Opt-in development demo of the evaluated v4 name-label + context variant.

No English NER union, fallback, training or hosted inference. Runtime output uses
the same adapter and bounded contextual overlap algorithm as recorded v4.
"""

import os
from dataclasses import dataclass
from functools import lru_cache
from threading import Lock

from preprocessing.generalization_v3 import combine
from preprocessing.multilingual_calibration import UnicodeWordSplitter, splits_boundary
from preprocessing.multilingual_candidate import MultilingualCandidate
from preprocessing.name_label_candidate_v4 import candidate
from preprocessing.span_evaluation import render

VERSION = "gliner-name-labels-v4-context-demo-v1"
LOCK = Lock()


@dataclass(frozen=True)
class DemoResult:
    anonymized_text: str
    transformations: tuple[str, ...]
    requires_review: bool


@lru_cache(maxsize=1)
def load_candidate():
    from research_common.config import settings

    if (
        settings().environment != "development"
        or os.environ.get("C2_GLINER_DEMO_ENABLED") != "true"
    ):
        raise RuntimeError("Experimental demo unavailable")
    loaded = MultilingualCandidate.from_local(
        os.environ.get("C2_GLINER_MODEL_PATH", ".local/c2-gliner-model")
    )
    loaded.model.data_processor.words_splitter = UnicodeWordSplitter()
    return candidate(loaded.model)


def anonymize_gliner_demo(text):
    from preprocessing.anonymization import RESIDUAL_RISK_PATTERN
    from preprocessing.person_context import requires_context_review, requires_unresolved_review

    # Serialize loading and inference; do not cache text/predictions across runs.
    with LOCK:
        model = load_candidate()
        spans = combine(text, model.detect(text))
    if any(splits_boundary(text, edge) for span in spans for edge in (span.start, span.end)):
        raise RuntimeError("Unsafe experimental output boundary")
    if any(a.end > b.start for a, b in zip(spans, spans[1:], strict=False)):
        raise RuntimeError("Invalid experimental output overlap")
    masked = render(text, spans)
    return DemoResult(
        masked,
        tuple(sorted({VERSION + ":" + s.entity_type.lower() for s in spans})),
        bool(RESIDUAL_RISK_PATTERN.search(masked))
        or requires_context_review(masked)
        or requires_unresolved_review(text),
    )
