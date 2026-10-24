"""Experimental local GLiNER replacement for PERSON/LOCATION; not a runtime default."""

import hashlib
import math
import os
import unicodedata
from dataclasses import dataclass
from importlib.metadata import version
from pathlib import Path

from preprocessing.span_evaluation import PLACEHOLDERS, EntitySpan, render

MODEL_ID = "urchade/gliner_multi-v2.1"
MODEL_REVISION = "443d26d654e0324125a96bebd8e796c14ff2efe6"
WEIGHTS_SHA256 = "2100142f31627531497850659dcb3821c99d5e71c08a8e01a98e4b11ef32a199"
LABELS = {"person": "PERSON", "location": "LOCATION"}
THRESHOLD = 0.5
CONFIGURATION_VERSION = "gliner-multilingual-candidate-v1"


def structured_spans(text):
    """Use the actual existing structured recognizers; no English NLP entity union."""
    from presidio_analyzer import Pattern, PatternRecognizer
    from presidio_analyzer.predefined_recognizers import PhoneRecognizer

    from preprocessing.anonymization import PHONE_PATTERN, STUDENT_ID_PATTERN
    from preprocessing.presidio_anonymization import _OfflineEmailRecognizer

    recognizers = (
        _OfflineEmailRecognizer(),
        PhoneRecognizer(),
        PatternRecognizer(
            supported_entity="PHONE_NUMBER",
            patterns=[
                Pattern(name="sri_lankan_mobile_number", regex=PHONE_PATTERN.pattern, score=0.85)
            ],
        ),
        PatternRecognizer(
            supported_entity="STUDENT_ID",
            patterns=[
                Pattern(name="synthetic_student_id", regex=STUDENT_ID_PATTERN.pattern, score=0.85)
            ],
        ),
    )
    aliases = {"EMAIL_ADDRESS": "EMAIL", "PHONE_NUMBER": "PHONE", "STUDENT_ID": "STUDENT_ID"}
    result = []
    for recognizer in recognizers:
        for span in recognizer.analyze(text, entities=list(aliases)):
            result.append(EntitySpan(span.start, span.end, aliases[span.entity_type]))
    return tuple(sorted(set(result)))


@dataclass(frozen=True)
class MultilingualResult:
    anonymized_text: str
    spans: tuple[EntitySpan, ...]
    transformations: tuple[str, ...]
    configuration_version: str = CONFIGURATION_VERSION


class MultilingualCandidate:
    def __init__(self, model, structured=structured_spans, *, threshold=THRESHOLD):
        if (
            isinstance(threshold, bool)
            or not isinstance(threshold, (int, float))
            or not math.isfinite(threshold)
            or not 0 < threshold < 1
        ):
            raise ValueError("Experimental threshold must be finite and between zero and one.")
        self.threshold = threshold
        self.model, self.structured = model, structured

    @classmethod
    def from_local(cls, snapshot, threads=4):
        """Load only pinned safetensors locally; forbid downloads/hosted inference."""
        folder = Path(snapshot)
        weights = folder / "model.safetensors"
        if not weights.is_file() or not (folder / "gliner_config.json").is_file():
            raise RuntimeError("Pinned local model snapshot is incomplete.")
        digest = hashlib.sha256()
        with weights.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != WEIGHTS_SHA256:
            raise RuntimeError("Pinned model weight integrity check failed.")
        if version("gliner") != "0.2.24":
            raise RuntimeError("Use the pinned experimental GLiNER package.")
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
        os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
        os.environ["DO_NOT_TRACK"] = "1"
        import torch
        from gliner import GLiNER

        torch.set_num_threads(threads)
        torch.manual_seed(0)
        model = GLiNER.from_pretrained(
            str(folder), local_files_only=True, map_location="cpu", strict=True
        )
        model.eval()
        return cls(model)

    def detect(self, text):
        if not isinstance(text, str):
            raise ValueError("Candidate input must be text.")
        protected = [match.span() for match in PLACEHOLDERS.finditer(text)]
        structured = self.structured(text)
        # Structured identifiers have priority; replacing NER never replaces these rules.
        selected = []
        for span in structured:
            if not any(span.start < end and span.end > start for start, end in protected):
                selected.append(span)
        predictions = self.model.predict_entities(
            text, list(LABELS), threshold=self.threshold, flat_ner=True
        )
        validated = []
        for item in predictions:
            start, end, score, label = (item.get(key) for key in ("start", "end", "score", "label"))
            if (
                type(start) is not int
                or type(end) is not int
                or not 0 <= start < end <= len(text)
                or label not in LABELS
                or not isinstance(score, (int, float))
                or not math.isfinite(score)
                or not 0 <= score <= 1
                or item.get("text") != text[start:end]
            ):
                raise RuntimeError("Candidate returned invalid original-text entity metadata.")
            if score >= self.threshold:
                validated.append((score, EntitySpan(start, end, LABELS[label])))
        for _, span in sorted(
            validated, key=lambda pair: (-pair[0], -(pair[1].end - pair[1].start), pair[1].start)
        ):
            if any(span.start < end and span.end > start for start, end in protected):
                continue
            if any(span.start < other.end and span.end > other.start for other in selected):
                continue
            selected.append(span)
        return tuple(sorted(selected))

    def anonymize(self, text):
        spans = self.detect(text)
        # Raw model spans remain available to offline scoring. Rendering must fail
        # safely rather than leave orphaned vowel marks/joiners or expand spans.
        for span in spans:
            for boundary in (span.start, span.end):
                splits_mark = boundary < len(text) and (
                    unicodedata.category(text[boundary]).startswith("M")
                    or text[boundary] in "\u200c\u200d"
                )
                splits_joiner = boundary > 0 and text[boundary - 1] in "\u200c\u200d"
                if splits_mark or splits_joiner:
                    raise RuntimeError(
                        "Candidate mask boundary would split a Unicode mark or joiner."
                    )
        return MultilingualResult(
            anonymized_text=render(text, spans),
            spans=spans,
            transformations=tuple(
                sorted({"candidate:" + span.entity_type.lower() for span in spans})
            ),
        )
