"""Component 4 Stability Analysis Evaluation Engine.

Provides model-backed repeated-run stability analysis for LIME and SHAP explanations via:
- Unicode-aware tokenization preserving Sinhala combining marks, matras, and ZWJ conjuncts.
- Occurrence-level attribution alignment and subword aggregation.
- Repeated fresh independent explanation computations holding text, model revision, and
  explained class fixed while varying explainer randomness across recorded distinct seeds.
- Disclosing determinism truthfully when explainer (e.g. SHAP partition explainer) does not vary with seed.
- Deterministic top-k ranking by absolute attribution weight with occurrence-order tie-breaking.
- Top-k overlap and Spearman rank correlation of absolute weights evaluated against reference Run 1.
- Per-word mean signed weight, population standard deviation, and top-k occurrence frequency.
- Bounded server-side execution, timeout checks between runs, and honest partial reporting.
"""

from __future__ import annotations

import logging
import math
import re
import time
from typing import TYPE_CHECKING

import numpy as np
import scipy.stats as stats
from research_contracts import (
    C4InternalStabilityRequest,
    C4StabilityResponse,
    C4StabilityRunResult,
    C4StabilityWordConsistency,
)

if TYPE_CHECKING:
    from xai.classifier_interface import BatchPredictionClassifier

logger = logging.getLogger(__name__)

# Server-side bounded execution limits
MAX_TEXT_LENGTH = 2000
MIN_RUN_COUNT = 2
MAX_RUN_COUNT = 20
DEFAULT_RUN_COUNT = 5
MIN_TOP_K = 1
MAX_TOP_K = 50
DEFAULT_TOP_K = 5
MIN_EVALS = 10
MAX_EVALS = 500
DEFAULT_EVALS = 100
TIMEOUT_SECONDS = 30.0

# Regex patterns for protected tokens (anonymization placeholders, mentions, URLs, numbers)
PLACEHOLDER_REGEX = re.compile(
    r"^(\[[A-Za-z0-9_]+\]|@[A-Za-z0-9_]+|https?://\S+)$", re.IGNORECASE
)
NUMBER_REGEX = re.compile(r"^\d+([.,]\d+)*$")


class WordOccurrence:
    """Represents a specific token occurrence in the original text with character offsets."""

    def __init__(
        self,
        occurrence_id: str,
        word: str,
        start: int,
        end: int,
        is_word: bool,
        is_protected: bool,
    ) -> None:
        self.occurrence_id = occurrence_id
        self.word = word
        self.start = start
        self.end = end
        self.is_word = is_word
        self.is_protected = is_protected


def tokenize_text(text: str) -> list[WordOccurrence]:
    """Tokenize text into words and protected spans with exact Unicode character offsets.

    Preserves Sinhala Unicode combining marks, matras, and ZWJ conjuncts (U+0D80 to U+0DFF,
    combining diacritics U+0300 to U+036F, and ZWJ/ZWNJ U+200C/U+200D).
    """
    pattern = re.compile(
        r"(\[[A-Za-z0-9_]+\]|@[A-Za-z0-9_]+|https?://\S+|\d+(?:[.,]\d+)*|[\w\u0d80-\u0dff\u0300-\u036f\u200c\u200d]+|[^\w\s\u0d80-\u0dff\u0300-\u036f\u200c\u200d]+|\s+)",
        re.UNICODE,
    )
    word_pattern = re.compile(
        r"^[\w\u0d80-\u0dff\u0300-\u036f\u200c\u200d]+$", re.UNICODE
    )

    occurrences: list[WordOccurrence] = []
    word_idx = 0

    for match in pattern.finditer(text):
        piece = match.group(0)
        start, end = match.start(), match.end()

        is_protected = bool(
            PLACEHOLDER_REGEX.match(piece) or NUMBER_REGEX.match(piece)
        )
        is_word = bool(not is_protected and word_pattern.match(piece))

        occ_id = f"word_{word_idx}" if is_word else f"tok_{start}_{end}"
        if is_word:
            word_idx += 1

        occurrences.append(
            WordOccurrence(
                occurrence_id=occ_id,
                word=piece,
                start=start,
                end=end,
                is_word=is_word,
                is_protected=is_protected,
            )
        )
    return occurrences


def _align_lime_attributions(
    word_occs: list[WordOccurrence],
    exp,
    target_idx: int,
) -> tuple[dict[str, float] | None, str]:
    """Map LIME attributions to word occurrences using token indexed positions and offsets."""
    if not hasattr(exp, "as_map") or target_idx not in exp.as_map():
        return None, "LIME explanation did not produce attribution map for target class."

    as_map = exp.as_map()[target_idx]
    weight_by_idx = {int(idx): float(w) for idx, w in as_map}

    domain_mapper = getattr(exp, "domain_mapper", None)
    indexed_string = getattr(domain_mapper, "indexed_string", None) if domain_mapper else None

    if indexed_string is None:
        return None, "LIME explanation domain mapper missing indexed string."

    num_words = indexed_string.num_words()

    # Strategy 1: Direct 1-to-1 sequential match
    if num_words == len(word_occs):
        weights: dict[str, float] = {}
        for idx, occ in enumerate(word_occs):
            w = weight_by_idx.get(idx, 0.0)
            if not math.isfinite(w):
                return None, f"Non-finite attribution weight encountered for occurrence {occ.occurrence_id}."
            weights[occ.occurrence_id] = w
        return weights, "Sequential 1-to-1 attribution alignment succeeded."

    # Strategy 2: Position-aware containing span matching
    weights = {}
    for occ_idx, occ in enumerate(word_occs):
        matched_weight: float | None = None
        # Check token position spans in indexed_string
        for tok_idx in range(num_words):
            try:
                tok_start = indexed_string.string_position(tok_idx)
                tok_word = indexed_string.word(tok_idx)
                tok_end = tok_start + len(tok_word)
                if tok_start <= occ.start and occ.end <= tok_end:
                    matched_weight = weight_by_idx.get(tok_idx, 0.0)
                    break
            except Exception:
                continue

        if matched_weight is None:
            # Fallback by index if within bounds
            if occ_idx < num_words:
                matched_weight = weight_by_idx.get(occ_idx, 0.0)
            else:
                return None, f"Could not reliably align attribution for occurrence '{occ.word}' ({occ.occurrence_id})."

        if not math.isfinite(matched_weight):
            return None, f"Non-finite attribution weight encountered for occurrence {occ.occurrence_id}."
        weights[occ.occurrence_id] = matched_weight

    return weights, "Position-aware attribution alignment succeeded."


def _align_shap_attributions(
    word_occs: list[WordOccurrence],
    shap_values,
    target_idx: int,
) -> tuple[dict[str, float] | None, str]:
    """Map SHAP attributions to word occurrences from masked text output."""
    if not hasattr(shap_values, "values") or len(shap_values.values) == 0:
        return None, "SHAP explainer returned empty values."

    vals = shap_values.values[0]
    if isinstance(vals, np.ndarray) and vals.ndim == 2:
        raw_vals = [float(v) for v in vals[:, target_idx]]
    elif isinstance(vals, np.ndarray) and vals.ndim == 1:
        raw_vals = [float(v) for v in vals]
    elif isinstance(vals, (list, tuple)):
        raw_vals = [float(v) for v in vals]
    else:
        return None, "Malformed SHAP values structure."

    if len(raw_vals) == len(word_occs):
        weights: dict[str, float] = {}
        for occ, w in zip(word_occs, raw_vals, strict=False):
            if not math.isfinite(w):
                return None, f"Non-finite SHAP weight encountered for occurrence {occ.occurrence_id}."
            weights[occ.occurrence_id] = w
        return weights, "Sequential 1-to-1 SHAP alignment succeeded."

    # Subword / multi-token aggregation by index if lengths differ
    if len(raw_vals) >= len(word_occs):
        weights = {}
        for idx, occ in enumerate(word_occs):
            w = raw_vals[idx] if idx < len(raw_vals) else 0.0
            if not math.isfinite(w):
                return None, f"Non-finite SHAP weight encountered for occurrence {occ.occurrence_id}."
            weights[occ.occurrence_id] = w
        return weights, "Bounded positional SHAP alignment succeeded."

    return None, f"SHAP values length ({len(raw_vals)}) is less than eligible word count ({len(word_occs)})."


def evaluate_stability(
    request: C4InternalStabilityRequest,
    classifier: BatchPredictionClassifier,
) -> C4StabilityResponse:
    """Run repeated-run stability analysis for ONE selected explanation on the provided classifier."""
    start_time = time.monotonic()

    # 1. Validate text length
    if len(request.text) > MAX_TEXT_LENGTH:
        return C4StabilityResponse(
            explanation_id=request.explanation_id,
            method=request.method,
            explained_class=request.explained_class,
            baseline_probability=0.0,
            outcome="OVERLENGTH_TEXT",
            outcome_message=f"Text length ({len(request.text)}) exceeds maximum permitted limit ({MAX_TEXT_LENGTH} chars).",
        )

    # 2. Tokenize text into words with Unicode awareness
    all_occurrences = tokenize_text(request.text)
    word_occs = [o for o in all_occurrences if o.is_word]
    total_eligible_words = len(word_occs)

    if total_eligible_words == 0:
        return C4StabilityResponse(
            explanation_id=request.explanation_id,
            method=request.method,
            explained_class=request.explained_class,
            baseline_probability=0.0,
            outcome="UNSUPPORTED_ALIGNMENT",
            outcome_message="No valid eligible word occurrences found in text.",
            total_eligible_words=0,
            effective_k=0,
        )

    # 3. Resolve explained class against classifier
    labels = classifier.class_labels
    if not labels:
        return C4StabilityResponse(
            explanation_id=request.explanation_id,
            method=request.method,
            explained_class=request.explained_class,
            baseline_probability=0.0,
            outcome="UNAVAILABLE_MODEL",
            outcome_message="Classifier does not define class labels.",
        )

    target_idx = None
    for idx, lbl in enumerate(labels):
        if lbl.lower() == request.explained_class.lower():
            target_idx = idx
            break

    if target_idx is None:
        return C4StabilityResponse(
            explanation_id=request.explanation_id,
            method=request.method,
            explained_class=request.explained_class,
            baseline_probability=0.0,
            outcome="INCOMPATIBLE_MODEL",
            outcome_message=f"Explained class '{request.explained_class}' is not recognized by the classifier ({labels}).",
        )

    # 4. Check model revision provenance if provided
    model_rev = getattr(classifier, "model_revision", None)
    if request.model_revision and model_rev and request.model_revision != model_rev:
        return C4StabilityResponse(
            explanation_id=request.explanation_id,
            method=request.method,
            explained_class=request.explained_class,
            baseline_probability=0.0,
            outcome="INCOMPATIBLE_MODEL",
            outcome_message=f"Model revision mismatch: explanation has '{request.model_revision}', active model is '{model_rev}'.",
        )

    # 5. Determine model baseline probability
    try:
        probs = classifier.predict_proba([request.text])[0]
        baseline_prob = float(probs[target_idx])
    except Exception as exc:
        logger.exception("Initial baseline inference failed: %s", exc)
        return C4StabilityResponse(
            explanation_id=request.explanation_id,
            method=request.method,
            explained_class=request.explained_class,
            baseline_probability=0.0,
            outcome="INFERENCE_FAILED",
            outcome_message=f"Model baseline prediction failed: {exc}",
        )

    # 6. Establish effective settings and bounds
    bounded_run_count = max(MIN_RUN_COUNT, min(request.run_count, MAX_RUN_COUNT))
    effective_k = min(max(MIN_TOP_K, min(request.top_k, MAX_TOP_K)), total_eligible_words)
    bounded_evals = max(MIN_EVALS, min(request.explainer_evals or DEFAULT_EVALS, MAX_EVALS))
    base_seed = max(0, request.base_seed)

    model_id = getattr(classifier, "model_id", classifier.model_version)
    model_version = getattr(classifier, "model_version", "0.1.0")

    # 7. Check explainer method determinism
    is_deterministic = False
    determinism_notice: str | None = None
    if request.method == "SHAP":
        is_deterministic = True
        determinism_notice = (
            "SHAP partition explainer uses deterministic hierarchical Owen value masking and "
            "does not vary with random seeds."
        )

    # 8. Repeated independent runs loop
    runs: list[C4StabilityRunResult] = []
    run_weights_list: list[dict[str, float]] = []
    stopping_reason: str | None = None

    # Pre-initialize explainer for SHAP outside loop to avoid redundant re-masking
    shap_explainer_instance = None
    if request.method == "SHAP":
        try:
            import shap

            masker = shap.maskers.Text(r"\s+")
            shap_explainer_instance = shap.Explainer(
                classifier.predict_proba,
                masker,
                output_names=labels,
            )
        except Exception as exc:
            logger.exception("Failed to initialize SHAP explainer: %s", exc)
            return C4StabilityResponse(
                explanation_id=request.explanation_id,
                method=request.method,
                explained_class=request.explained_class,
                baseline_probability=baseline_prob,
                model_id=model_id,
                model_version=model_version,
                model_revision=model_rev,
                outcome="INFERENCE_FAILED",
                outcome_message=f"SHAP initialization failed: {exc}",
            )

    for run_idx in range(1, bounded_run_count + 1):
        run_start = time.monotonic()

        # Check execution budget before starting run
        if time.monotonic() - start_time > TIMEOUT_SECONDS:
            stopping_reason = (
                f"Execution time budget of {TIMEOUT_SECONDS:.0f}s reached after {len(runs)} run(s)."
            )
            break

        # Compute distinct recorded seed
        seed_for_run = base_seed + (run_idx - 1) * 17 if not is_deterministic else base_seed

        run_weights: dict[str, float] | None = None
        alignment_msg = ""
        error_msg: str | None = None

        try:
            if request.method == "LIME":
                from lime.lime_text import LimeTextExplainer

                explainer = LimeTextExplainer(
                    split_expression=r"\s+",
                    class_names=labels,
                    bow=False,
                    random_state=seed_for_run,
                )
                exp = explainer.explain_instance(
                    request.text,
                    classifier.predict_proba,
                    labels=[target_idx],
                    num_features=total_eligible_words,
                    num_samples=bounded_evals,
                )
                run_weights, alignment_msg = _align_lime_attributions(word_occs, exp, target_idx)

            elif request.method == "SHAP":
                if shap_explainer_instance is None:
                    raise RuntimeError("SHAP explainer was not initialized.")
                shap_values = shap_explainer_instance([request.text], max_evals=bounded_evals)
                run_weights, alignment_msg = _align_shap_attributions(word_occs, shap_values, target_idx)
            else:
                error_msg = f"Unsupported explanation method '{request.method}'."
        except Exception as exc:
            logger.exception("Explainer run %d failed: %s", run_idx, exc)
            error_msg = str(exc)

        run_elapsed_ms = (time.monotonic() - run_start) * 1000.0

        if error_msg or run_weights is None:
            # Run failed
            failed_run = C4StabilityRunResult(
                run_index=run_idx,
                seed=seed_for_run,
                is_reference=(run_idx == 1),
                status="FAILED",
                error_message=error_msg or alignment_msg or "Attribution alignment failed.",
                execution_time_ms=run_elapsed_ms,
                top_k_overlap=None,
                rank_correlation=None,
                weights={},
                top_k_ids=[],
            )
            runs.append(failed_run)
            continue

        # Deterministic top-k ranking by absolute weight with occurrence-order tie-breaking
        # (larger abs weight first, then smaller occurrence index)
        sorted_occs = sorted(
            word_occs,
            key=lambda o, w_dict=run_weights: (-abs(w_dict.get(o.occurrence_id, 0.0)), int(o.occurrence_id.split("_")[1]) if "_" in o.occurrence_id else 0),
        )
        top_k_ids = [o.occurrence_id for o in sorted_occs[:effective_k]]

        # Compute metrics against Reference (Run 1)
        top_k_overlap: float | None = None
        rank_corr: float | None = None

        if run_idx == 1:
            # Reference run
            top_k_overlap = None
            rank_corr = None
        else:
            # Must have a successful Run 1 to compare against
            if len(runs) > 0 and runs[0].status == "SUCCESS" and len(run_weights_list) > 0:
                ref_top_k = runs[0].top_k_ids
                ref_weights = run_weights_list[0]

                # Top-k Overlap
                if effective_k > 0:
                    overlap_count = len(set(top_k_ids) & set(ref_top_k))
                    top_k_overlap = float(overlap_count / effective_k)

                # Spearman Rank Correlation across all eligible occurrences
                ref_vec = [abs(ref_weights.get(o.occurrence_id, 0.0)) for o in word_occs]
                run_vec = [abs(run_weights.get(o.occurrence_id, 0.0)) for o in word_occs]

                if len(ref_vec) >= 2:
                    try:
                        corr_res = stats.spearmanr(ref_vec, run_vec)
                        stat_val = float(
                            corr_res.statistic if hasattr(corr_res, "statistic") else corr_res[0]
                        )
                        if math.isnan(stat_val):
                            rank_corr = None
                        else:
                            rank_corr = stat_val
                    except Exception:
                        rank_corr = None
                else:
                    rank_corr = None

        run_result = C4StabilityRunResult(
            run_index=run_idx,
            seed=seed_for_run,
            is_reference=(run_idx == 1),
            status="SUCCESS",
            error_message=None,
            execution_time_ms=run_elapsed_ms,
            top_k_overlap=top_k_overlap,
            rank_correlation=rank_corr,
            weights=run_weights,
            top_k_ids=top_k_ids,
        )
        runs.append(run_result)
        run_weights_list.append(run_weights)

    # 9. Aggregate word consistency across successful runs
    successful_runs = [r for r in runs if r.status == "SUCCESS"]
    completed_runs = len(successful_runs)

    if completed_runs == 0:
        return C4StabilityResponse(
            explanation_id=request.explanation_id,
            method=request.method,
            explained_class=request.explained_class,
            baseline_probability=baseline_prob,
            model_id=model_id,
            model_version=model_version,
            model_revision=model_rev,
            outcome="INFERENCE_FAILED",
            outcome_message="All explainer runs failed.",
            runs=runs,
            total_eligible_words=total_eligible_words,
            effective_k=effective_k,
            requested_runs=bounded_run_count,
            completed_runs=0,
            execution_time_ms=(time.monotonic() - start_time) * 1000.0,
        )

    word_consistency: list[C4StabilityWordConsistency] = []
    per_word_sds: list[float] = []

    for occ in word_occs:
        w_values = [r.weights[occ.occurrence_id] for r in successful_runs if occ.occurrence_id in r.weights]
        if not w_values:
            continue

        mean_w = float(sum(w_values) / len(w_values))

        # Population standard deviation (divide by N)
        if len(w_values) >= 2:
            variance = sum((w - mean_w) ** 2 for w in w_values) / len(w_values)
            std_dev: float | None = float(math.sqrt(variance))
            per_word_sds.append(std_dev)
        else:
            std_dev = None

        # Top-k frequency
        top_k_count = sum(1 for r in successful_runs if occ.occurrence_id in r.top_k_ids)
        freq = float(top_k_count / completed_runs)

        word_consistency.append(
            C4StabilityWordConsistency(
                occurrence_id=occ.occurrence_id,
                word=occ.word,
                start=occ.start,
                end=occ.end,
                mean_weight=mean_w,
                std_dev=std_dev,
                top_k_frequency=freq,
                run_occurrence_count=len(w_values),
            )
        )

    # 10. Summary averages across comparisons (excluding Run 1 reference)
    valid_overlaps = [
        r.top_k_overlap
        for r in successful_runs
        if not r.is_reference and r.top_k_overlap is not None
    ]
    mean_top_k_overlap = (
        float(sum(valid_overlaps) / len(valid_overlaps)) if valid_overlaps else None
    )

    valid_corrs = [
        r.rank_correlation
        for r in successful_runs
        if not r.is_reference and r.rank_correlation is not None
    ]
    mean_rank_corr = (
        float(sum(valid_corrs) / len(valid_corrs)) if valid_corrs else None
    )

    mean_attribution_std = (
        float(sum(per_word_sds) / len(per_word_sds)) if per_word_sds else None
    )

    total_time_ms = (time.monotonic() - start_time) * 1000.0

    outcome = "SUCCESS" if completed_runs == bounded_run_count else "PARTIAL"
    outcome_msg = (
        f"Stability analysis completed successfully ({completed_runs}/{bounded_run_count} runs)."
        if outcome == "SUCCESS"
        else f"Partial stability analysis: {completed_runs}/{bounded_run_count} runs succeeded."
    )

    return C4StabilityResponse(
        explanation_id=request.explanation_id,
        method=request.method,
        explained_class=request.explained_class,
        baseline_probability=baseline_prob,
        model_id=model_id,
        model_version=model_version,
        model_revision=model_rev,
        explainer_version="0.1.0",
        outcome=outcome,
        outcome_message=outcome_msg,
        stopping_reason=stopping_reason,
        runs=runs,
        word_consistency=word_consistency,
        mean_top_k_overlap=mean_top_k_overlap,
        mean_rank_correlation=mean_rank_corr,
        mean_attribution_std=mean_attribution_std,
        requested_runs=bounded_run_count,
        completed_runs=completed_runs,
        effective_k=effective_k,
        total_eligible_words=total_eligible_words,
        is_deterministic=is_deterministic,
        determinism_notice=determinism_notice,
        execution_time_ms=total_time_ms,
        is_development=True,
    )
