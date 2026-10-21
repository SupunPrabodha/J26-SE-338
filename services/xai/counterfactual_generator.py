"""Component 4 Counterfactual Explanation Generator.

Provides bounded, model-backed counterfactual generation using token deletions and
configurable language-specific replacement rules. Reuses BatchPredictionClassifier
with CardiffNLP twitter-xlm-roberta-base-sentiment checkpoint.
"""

from __future__ import annotations

import logging
import re
import time
from typing import TYPE_CHECKING

import numpy as np
from research_contracts import (
    C4CounterfactualRequest,
    C4CounterfactualResponse,
    CounterfactualCandidate,
    EditOperation,
    TextSpanDiff,
)

if TYPE_CHECKING:
    from xai.classifier_interface import BatchPredictionClassifier

logger = logging.getLogger(__name__)

# Server-side bounded search limits
DEFAULT_MAX_CANDIDATES = 50
DEFAULT_MAX_EDITS = 2
DEFAULT_MAX_TEXT_LENGTH = 2000
DEFAULT_TIMEOUT_SECONDS = 10.0
INFERENCE_BATCH_SIZE = 32

# Regex patterns for protected tokens
PLACEHOLDER_REGEX = re.compile(
    r"^(\[[A-Za-z0-9_]+\]|@[A-Za-z0-9_]+|https?://\S+)$", re.IGNORECASE
)
NUMBER_REGEX = re.compile(r"^\d+([.,]\d+)*$")

# Language-specific replacement dictionaries for sentiment exploration
# Supported languages documented: English, Sinhala, Romanized Sinhala, Code-mixed
REPLACEMENTS_ENGLISH_TO_POSITIVE_OR_NEUTRAL: dict[str, list[str]] = {
    "overwhelmed": ["busy", "coping", "fine"],
    "stressed": ["managing", "calm", "relaxed"],
    "cannot": ["can"],
    "cant": ["can"],
    "can't": ["can"],
    "terrible": ["fine", "okay", "good"],
    "bad": ["okay", "good"],
    "hopeless": ["optimistic", "fine"],
    "depressed": ["fine", "hopeful"],
    "anxious": ["calm", "prepared"],
    "hate": ["like", "enjoy"],
    "fail": ["pass", "complete"],
    "failing": ["passing", "progressing"],
    "pressure": ["balance", "routine"],
    "exhausted": ["rested", "okay"],
    "hard": ["manageable", "fine"],
    "difficult": ["manageable", "doable"],
    "sad": ["okay", "content"],
    "worried": ["content", "calm"],
    "fear": ["confidence", "peace"],
    "struggling": ["learning", "managing"],
    "tired": ["rested", "ready"],
    "pain": ["relief", "comfort"],
    "crying": ["resting"],
    "nobody": ["someone", "everyone"],
    "nothing": ["something"],
    "never": ["sometimes", "always"],
    "awful": ["acceptable", "okay"],
    "horrible": ["manageable"],
    "worthless": ["valued", "capable"],
    "panic": ["calm", "focus"],
    "nervous": ["composed", "ready"],
}

REPLACEMENTS_ENGLISH_TO_NEGATIVE: dict[str, list[str]] = {
    "great": ["okay", "difficult"],
    "good": ["okay", "bad"],
    "happy": ["neutral", "sad"],
    "love": ["tolerate", "dislike"],
    "excellent": ["okay", "poor"],
    "relaxed": ["busy", "stressed"],
    "calm": ["busy", "worried"],
    "hopeful": ["uncertain", "hopeless"],
    "confident": ["uncertain", "worried"],
    "easy": ["demanding", "difficult"],
    "peaceful": ["tense", "neutral"],
    "passed": ["struggled", "failed"],
    "passing": ["struggling", "failing"],
    "fine": ["stressed", "overwhelmed"],
    "enjoy": ["dislike", "hate"],
}

REPLACEMENTS_ENGLISH_TO_NEUTRAL: dict[str, list[str]] = {
    "terrible": ["average", "normal"],
    "horrible": ["ordinary", "standard"],
    "great": ["average", "moderate"],
    "amazing": ["standard", "normal"],
    "overwhelmed": ["busy"],
    "stressed": ["occupied"],
    "depressed": ["neutral"],
}

REPLACEMENTS_SINHALA: dict[str, list[str]] = {
    "පීඩනයක්": ["සහනයක්", "පාලනයක්"],
    "පීඩනය": ["සහනය", "සාමාන්‍යය"],
    "බයයි": ["සන්සුන්", "සාමාන්‍යයි"],
    "අමාරුයි": ["පුළුවන්", "පහසුයි"],
    "බැහැ": ["පුළුවන්"],
    "නොහැකි": ["හැකි"],
    "දුකයි": ["සතුටුයි", "හොඳයි"],
    "නරකයි": ["හොඳයි"],
    "කාර්යබහුලයි": ["සැහැල්ලුයි"],
    "කණගාටුයි": ["සතුටුයි"],
    "වෙහෙසයි": ["සුවපහසුයි"],
}

REPLACEMENTS_ROMANIZED: dict[str, list[str]] = {
    "bayai": ["shape", "hodai"],
    "stress": ["shape", "cool", "normal"],
    "baha": ["puluwan"],
    "ba": ["puluwan"],
    "pressure": ["normal", "shape"],
    "amarui": ["puluwan", "lesiyi"],
    "aul": ["shape", "hodai"],
    "aulak": ["shape"],
    "awul": ["shape"],
    "karadara": ["shape", "hodai"],
    "dukka": ["hodai", "shape"],
    "mahansi": ["shape", "hodai"],
}


def _match_case(original: str, replacement: str) -> str:
    """Preserve title or upper case from the original token onto replacement."""
    if original.isupper():
        return replacement.upper()
    if original.istitle():
        return replacement.capitalize()
    return replacement


class TokenSpan:
    """Structured token or delimiter span within original text."""

    def __init__(self, text: str, is_word: bool, is_protected: bool) -> None:
        self.text = text
        self.is_word = is_word
        self.is_protected = is_protected


def tokenize_preserve(text: str) -> list[TokenSpan]:
    """Tokenize text into words, protected tokens, and punctuation/whitespace delimiters."""
    pattern = re.compile(
        r"(\[[A-Za-z0-9_]+\]|@[A-Za-z0-9_]+|https?://\S+|\w+|[^\w\s]+|\s+)",
        re.UNICODE,
    )
    tokens: list[TokenSpan] = []
    for match in pattern.finditer(text):
        piece = match.group(0)
        if PLACEHOLDER_REGEX.match(piece) or NUMBER_REGEX.match(piece):
            tokens.append(TokenSpan(piece, is_word=False, is_protected=True))
        elif re.match(r"^\w+$", piece, re.UNICODE):
            tokens.append(TokenSpan(piece, is_word=True, is_protected=False))
        else:
            tokens.append(TokenSpan(piece, is_word=False, is_protected=False))
    return tokens


def get_replacement_candidates(
    word: str, target_class: str, language: str | None
) -> list[str]:
    """Look up configurable language-specific replacement rules for a word."""
    lower_word = word.lower()
    results: list[str] = []

    # English rules
    if target_class in {"Positive", "Neutral"}:
        if lower_word in REPLACEMENTS_ENGLISH_TO_POSITIVE_OR_NEUTRAL:
            results.extend(
                [_match_case(word, r) for r in REPLACEMENTS_ENGLISH_TO_POSITIVE_OR_NEUTRAL[lower_word]]
            )
    if target_class == "Negative":
        if lower_word in REPLACEMENTS_ENGLISH_TO_NEGATIVE:
            results.extend(
                [_match_case(word, r) for r in REPLACEMENTS_ENGLISH_TO_NEGATIVE[lower_word]]
            )
    if target_class == "Neutral":
        if lower_word in REPLACEMENTS_ENGLISH_TO_NEUTRAL:
            results.extend(
                [_match_case(word, r) for r in REPLACEMENTS_ENGLISH_TO_NEUTRAL[lower_word]]
            )

    # Sinhala rules
    if lower_word in REPLACEMENTS_SINHALA:
        results.extend(REPLACEMENTS_SINHALA[lower_word])

    # Romanized Sinhala rules
    if lower_word in REPLACEMENTS_ROMANIZED:
        results.extend(
            [_match_case(word, r) for r in REPLACEMENTS_ROMANIZED[lower_word]]
        )

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for r in results:
        if r not in seen and r.lower() != lower_word:
            seen.add(r)
            unique.append(r)
    return unique


def build_candidate_text(
    token_spans: list[TokenSpan],
    edits: list[tuple[int, str | None]],
) -> tuple[str, list[EditOperation], list[TextSpanDiff]]:
    """Construct candidate text and detailed diff spans from a set of token edits."""
    edit_dict = {idx: repl for idx, repl in edits}
    reconstructed_pieces: list[str] = []
    diff_spans: list[TextSpanDiff] = []
    edit_operations: list[EditOperation] = []

    for idx, span in enumerate(token_spans):
        if idx in edit_dict:
            repl = edit_dict[idx]
            if repl is None:
                # Deletion
                edit_operations.append(
                    EditOperation(
                        op="delete",
                        index=idx,
                        original=span.text,
                        replacement=None,
                    )
                )
                diff_spans.append(
                    TextSpanDiff(
                        text=span.text,
                        type="deleted",
                        original_text=span.text,
                    )
                )
            else:
                # Replacement
                edit_operations.append(
                    EditOperation(
                        op="replace",
                        index=idx,
                        original=span.text,
                        replacement=repl,
                    )
                )
                reconstructed_pieces.append(repl)
                diff_spans.append(
                    TextSpanDiff(
                        text=repl,
                        type="replaced",
                        original_text=span.text,
                    )
                )
        else:
            # Unchanged
            reconstructed_pieces.append(span.text)
            diff_spans.append(
                TextSpanDiff(
                    text=span.text,
                    type="unchanged",
                    original_text=span.text,
                )
            )

    raw_text = "".join(reconstructed_pieces)
    clean_text = re.sub(r"  +", " ", raw_text).strip()
    return clean_text, edit_operations, diff_spans


def generate_counterfactuals(
    request: C4CounterfactualRequest,
    classifier: BatchPredictionClassifier,
) -> C4CounterfactualResponse:
    """Generate model-backed counterfactual candidates via bounded search."""
    start_time = time.perf_counter()
    target_class = request.target_class
    text = request.text.strip()

    search_limits: dict[str, int | float | str] = {
        "max_text_length": DEFAULT_MAX_TEXT_LENGTH,
        "max_edits": request.max_edits or DEFAULT_MAX_EDITS,
        "max_candidates": request.max_candidates or DEFAULT_MAX_CANDIDATES,
        "timeout_seconds": DEFAULT_TIMEOUT_SECONDS,
        "batch_size": INFERENCE_BATCH_SIZE,
    }

    class_labels = classifier.class_labels
    if target_class not in class_labels:
        return C4CounterfactualResponse(
            target_class=target_class,
            outcome="NO_COUNTERFACTUAL_FOUND",
            outcome_message=f"Target class '{target_class}' is not recognized by the classifier.",
            search_limits=search_limits,
            model_id=classifier.model_id,
            model_version=classifier.model_version,
            model_revision=classifier.model_revision,
        )

    # 1. Obtain verified original model prediction and probabilities
    orig_probs_raw = classifier.predict_proba([text])
    if len(orig_probs_raw) == 0:
        return C4CounterfactualResponse(
            target_class=target_class,
            outcome="UNAVAILABLE_MODEL",
            outcome_message="Classifier returned empty probabilities.",
            search_limits=search_limits,
            model_id=classifier.model_id,
            model_version=classifier.model_version,
            model_revision=classifier.model_revision,
        )

    orig_probs = {
        label: float(orig_probs_raw[0][i]) for i, label in enumerate(class_labels)
    }
    orig_predicted_idx = int(np.argmax(orig_probs_raw[0]))
    orig_predicted_class = class_labels[orig_predicted_idx]
    orig_target_prob = orig_probs.get(target_class, 0.0)

    # Check if text already predicts target class
    if orig_predicted_class == target_class:
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        return C4CounterfactualResponse(
            target_class=target_class,
            original_predicted_class=orig_predicted_class,
            original_probabilities=orig_probs,
            outcome="ALREADY_TARGET_CLASS",
            outcome_message=(
                f"The input text is already classified as '{target_class}' "
                f"with probability {orig_target_prob:.4f}. No edits needed."
            ),
            candidates=[],
            best_candidate=None,
            search_limits=search_limits,
            model_id=classifier.model_id,
            model_version=classifier.model_version,
            model_revision=classifier.model_revision,
            execution_time_ms=round(elapsed_ms, 2),
        )

    # 2. Tokenize and identify editable word positions
    token_spans = tokenize_preserve(text)
    editable_indices = [
        i for i, span in enumerate(token_spans) if span.is_word and not span.is_protected
    ]

    max_candidates_limit = int(request.max_candidates or DEFAULT_MAX_CANDIDATES)
    max_edits_allowed = min(int(request.max_edits or DEFAULT_MAX_EDITS), 3)

    # Candidate proposals: list of (edits_tuple, candidate_text, edit_ops, diff_spans)
    proposals: list[
        tuple[list[tuple[int, str | None]], str, list[EditOperation], list[TextSpanDiff]]
    ] = []
    seen_texts: set[str] = {text}

    # Generate 1-edit proposals: deletions and rule replacements
    for idx in editable_indices:
        if len(proposals) >= max_candidates_limit:
            break
        word = token_spans[idx].text

        # 1a. Deletion
        cand_text, edit_ops, diffs = build_candidate_text(token_spans, [(idx, None)])
        if cand_text and cand_text not in seen_texts:
            seen_texts.add(cand_text)
            proposals.append(([(idx, None)], cand_text, edit_ops, diffs))

        # 1b. Rule-based replacements
        replacements = get_replacement_candidates(word, target_class, request.language)
        for repl in replacements:
            if len(proposals) >= max_candidates_limit:
                break
            cand_text, edit_ops, diffs = build_candidate_text(token_spans, [(idx, repl)])
            if cand_text and cand_text not in seen_texts:
                seen_texts.add(cand_text)
                proposals.append(([(idx, repl)], cand_text, edit_ops, diffs))

    # Generate 2-edit proposals if search budget remains
    if max_edits_allowed >= 2 and len(proposals) < max_candidates_limit:
        for i_idx, i in enumerate(editable_indices):
            if len(proposals) >= max_candidates_limit:
                break
            for j in editable_indices[i_idx + 1 :]:
                if len(proposals) >= max_candidates_limit:
                    break
                # Pairwise deletion
                cand_text, edit_ops, diffs = build_candidate_text(
                    token_spans, [(i, None), (j, None)]
                )
                if cand_text and cand_text not in seen_texts:
                    seen_texts.add(cand_text)
                    proposals.append(([(i, None), (j, None)], cand_text, edit_ops, diffs))

                # 1 replacement + 1 deletion
                word_i = token_spans[i].text
                repls_i = get_replacement_candidates(word_i, target_class, request.language)
                for repl in repls_i[:2]:
                    if len(proposals) >= max_candidates_limit:
                        break
                    cand_text, edit_ops, diffs = build_candidate_text(
                        token_spans, [(i, repl), (j, None)]
                    )
                    if cand_text and cand_text not in seen_texts:
                        seen_texts.add(cand_text)
                        proposals.append(([(i, repl), (j, None)], cand_text, edit_ops, diffs))

    if not proposals:
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        return C4CounterfactualResponse(
            target_class=target_class,
            original_predicted_class=orig_predicted_class,
            original_probabilities=orig_probs,
            outcome="NO_COUNTERFACTUAL_FOUND",
            outcome_message="No candidate perturbations could be formed within search constraints.",
            candidates=[],
            best_candidate=None,
            search_limits=search_limits,
            model_id=classifier.model_id,
            model_version=classifier.model_version,
            model_revision=classifier.model_revision,
            execution_time_ms=round(elapsed_ms, 2),
        )

    # 3. Batch prediction of candidate probabilities
    candidate_texts = [p[1] for p in proposals]
    try:
        cand_probs_raw = classifier.predict_proba(candidate_texts)
    except Exception as exc:
        logger.exception("Batch candidate inference failed: %s", exc)
        return C4CounterfactualResponse(
            target_class=target_class,
            outcome="UNAVAILABLE_MODEL",
            outcome_message=f"Model inference failed during counterfactual evaluation: {exc}",
            search_limits=search_limits,
            model_id=classifier.model_id,
            model_version=classifier.model_version,
            model_revision=classifier.model_revision,
        )

    # 4. Verify candidates: predicted class must equal target_class
    successful_candidates: list[CounterfactualCandidate] = []

    for idx, (_edits, cand_text, edit_ops, diffs) in enumerate(proposals):
        probs = {
            label: float(cand_probs_raw[idx][j]) for j, label in enumerate(class_labels)
        }
        cand_pred_idx = int(np.argmax(cand_probs_raw[idx]))
        cand_pred_class = class_labels[cand_pred_idx]
        target_prob = probs.get(target_class, 0.0)
        target_delta = target_prob - orig_target_prob

        # Verify predicted class strictly matches requested target
        if cand_pred_class == target_class:
            successful_candidates.append(
                CounterfactualCandidate(
                    candidate_text=cand_text,
                    edits=edit_ops,
                    edit_count=len(edit_ops),
                    predicted_class=cand_pred_class,
                    probabilities=probs,
                    target_probability=round(target_prob, 4),
                    target_probability_delta=round(target_delta, 4),
                    diff_spans=diffs,
                    minimality_rank=1,
                    minimality_description=(
                        "Smallest edit distance found within this bounded search; not a global guarantee."
                    ),
                    verified=True,
                )
            )

    # 5. Rank successful candidates: fewest edits ascending, then target probability descending
    successful_candidates.sort(
        key=lambda c: (c.edit_count, -c.target_probability)
    )

    for rank, cand in enumerate(successful_candidates, start=1):
        cand.minimality_rank = rank

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    if not successful_candidates:
        return C4CounterfactualResponse(
            target_class=target_class,
            original_predicted_class=orig_predicted_class,
            original_probabilities=orig_probs,
            outcome="NO_COUNTERFACTUAL_FOUND",
            outcome_message=(
                f"Within the bounded search limit of {len(candidate_texts)} candidates "
                f"and max {max_edits_allowed} edits, no counterfactual perturbed the verified "
                f"predicted class to '{target_class}'."
            ),
            candidates=[],
            best_candidate=None,
            search_limits=search_limits,
            model_id=classifier.model_id,
            model_version=classifier.model_version,
            model_revision=classifier.model_revision,
            execution_time_ms=round(elapsed_ms, 2),
        )

    # Return top 10 ranked candidates
    best = successful_candidates[0]
    return C4CounterfactualResponse(
        target_class=target_class,
        original_predicted_class=orig_predicted_class,
        original_probabilities=orig_probs,
        outcome="SUCCESS",
        outcome_message=(
            f"Found {len(successful_candidates)} verified counterfactual candidate(s). "
            f"Smallest perturbation requires {best.edit_count} edit(s), shifting target "
            f"probability by {best.target_probability_delta:+.2%}."
        ),
        candidates=successful_candidates[:10],
        best_candidate=best,
        search_limits=search_limits,
        model_id=classifier.model_id,
        model_version=classifier.model_version,
        model_revision=classifier.model_revision,
        execution_time_ms=round(elapsed_ms, 2),
    )
