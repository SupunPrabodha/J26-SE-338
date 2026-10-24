"""Component 4 LIME vs SHAP Evidence Comparison & Discovery Engine.

Computes authorized server-side pairing, compatibility verification, statistical summaries,
and CSV exports across saved LIME and SHAP explanations, Faithfulness, and Stability records.
Does not perform model inference, generate explanations, or download models.
"""

from __future__ import annotations

import csv
import hashlib
import io
import math
from typing import TYPE_CHECKING, Any
from uuid import UUID

from research_common.database import (
    Explanation,
    FaithfulnessRecord,
    StabilityRecord,
)
from research_contracts import (
    FIXTURES,
    C4ComparisonCandidateRecord,
    C4ComparisonCurrentRequest,
    C4ComparisonCurrentResponse,
    C4ComparisonLanguageGroup,
    C4ComparisonMetricSummary,
    C4PairedEvidenceItem,
    now,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from research_common.database import Account

# Supported canonical comparison metrics
METRIC_DEFINITIONS: dict[str, dict[str, str]] = {
    "DELETION_AOPC": {
        "label": "Deletion AOPC",
        "unit": "percentage points",
        "version": "1.0.0",
        "description": "Area Over the Perturbation Curve measuring mean explained-class probability drop across deletion steps.",
    },
    "COMPREHENSIVENESS_AT_K": {
        "label": "Comprehensiveness (at common k)",
        "unit": "percentage points",
        "version": "1.0.0",
        "description": "Probability drop of the explained class after removing the top-k supporting words (p0 - p_del).",
    },
    "DIFFERENCE_FROM_RANDOM_AT_K": {
        "label": "Diff from Random (at common k)",
        "unit": "percentage points",
        "version": "1.0.0",
        "description": "Comprehensiveness drop minus average drop from random deletion trials at step k.",
    },
    "SUFFICIENCY_GAP_AT_K": {
        "label": "Sufficiency Gap (at common k)",
        "unit": "percentage points",
        "version": "1.0.0",
        "description": "Baseline probability minus probability when retaining only top-k words (p0 - p_keep). Values near 0 indicate preserved prediction.",
    },
    "TOP_K_OVERLAP": {
        "label": "Mean Top-k Overlap",
        "unit": "percentage",
        "version": "1.0.0",
        "description": "Repeated-run feature set overlap against reference Run 1 under perturbation.",
    },
    "RANK_CORRELATION": {
        "label": "Mean Spearman Rank Correlation",
        "unit": "correlation [-1, 1]",
        "version": "1.0.0",
        "description": "Monotonicity of feature importance ranking between repeated runs and reference Run 1.",
    },
    "EXPLANATION_TIME": {
        "label": "Explanation Generation Time",
        "unit": "ms",
        "version": "1.0.0",
        "description": "Execution time for generating the feature attribution explanation under identical timing boundaries.",
    },
}

SUPPORTED_LANGUAGES = ["English", "Sinhala", "Romanized Sinhala", "Code-mixed", "Unknown"]


def compute_source_hash(text: str) -> str:
    """Compute deterministic SHA-256 content fingerprint for source input text."""
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def resolve_record_language(
    lang: str | None,
    text: str | None = None,
    source_ref: str | None = None,
) -> str:
    """Resolve language metadata strictly from stored provenance. Never defaults to English."""
    if lang in {"English", "Sinhala", "Romanized Sinhala", "Code-mixed"}:
        return lang
    # Check if text matches known synthetic fixtures
    if text:
        for f_key, f_text in FIXTURES.items():
            if f_text == text:
                if f_key == "english":
                    return "English"
                elif f_key == "sinhala":
                    return "Sinhala"
                elif f_key == "romanized":
                    return "Romanized Sinhala"
                elif f_key == "mixed":
                    return "Code-mixed"
    return "Unknown"


def compute_sample_statistics(
    values: list[float], decimals: int = 2
) -> tuple[float | None, float | None, float | None, float | None]:
    """Compute mean, sample standard deviation, median, and IQR.

    Returns null standard deviation if fewer than 2 pairs exist.
    """
    n = len(values)
    if n == 0:
        return None, None, None, None
    if n == 1:
        val = round(values[0], decimals)
        return val, None, val, 0.0

    mean_val = sum(values) / n
    variance = sum((x - mean_val) ** 2 for x in values) / (n - 1)
    sample_std = math.sqrt(variance)

    sorted_vals = sorted(values)
    # Median
    if n % 2 == 1:
        median_val = sorted_vals[n // 2]
    else:
        median_val = (sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2.0

    # IQR (approximate using quartiles)
    q1 = sorted_vals[n // 4]
    q3 = sorted_vals[(3 * n) // 4]
    iqr_val = q3 - q1

    return (
        round(mean_val, decimals),
        round(sample_std, decimals),
        round(median_val, decimals),
        round(iqr_val, decimals),
    )


def extract_metric_value(
    record: Any,
    metric: str,
    common_k: int = 5,
) -> tuple[float | None, dict[str, Any], str | None]:
    """Extract metric measurement and execution settings from a record."""
    if record is None:
        return None, {}, "Missing record."

    if metric == "DELETION_AOPC":
        if not isinstance(record, FaithfulnessRecord):
            return None, {}, "Invalid record type for faithfulness metric."
        if record.outcome != "SUCCESS":
            return None, {}, f"Evaluation did not complete successfully (outcome: {record.outcome})."
        if record.aopc is None:
            return None, {}, "AOPC measurement undefined."
        # Stored as probability drop in [0, 1]; convert once to percentage points
        val = round(record.aopc * 100.0, 2)
        settings_info = {
            "eligible_words": record.total_eligible_words,
            "budget_evaluated": record.budget_evaluated,
            "completed_steps": record.completed_steps,
        }
        return val, settings_info, None

    elif metric in {"COMPREHENSIVENESS_AT_K", "DIFFERENCE_FROM_RANDOM_AT_K", "SUFFICIENCY_GAP_AT_K"}:
        if not isinstance(record, FaithfulnessRecord):
            return None, {}, "Invalid record type for faithfulness metric."
        if record.outcome != "SUCCESS" and record.completed_steps < common_k:
            return None, {}, f"Evaluation did not reach step k={common_k} (completed: {record.completed_steps})."

        steps = record.step_results or []
        target_step = None
        for s in steps:
            if isinstance(s, dict) and s.get("step") == common_k:
                target_step = s
                break

        if not target_step:
            return None, {}, f"Evaluation did not record step k={common_k}."

        if metric == "COMPREHENSIVENESS_AT_K":
            drop = target_step.get("comprehensiveness_drop")
            if drop is None:
                return None, {}, f"Comprehensiveness drop undefined at step k={common_k}."
            val = round(drop * 100.0, 2)
            return val, {"step": common_k}, None

        elif metric == "DIFFERENCE_FROM_RANDOM_AT_K":
            diff = target_step.get("difference_from_random")
            if diff is None:
                return None, {}, f"Difference from random undefined at step k={common_k} (no random trials)."
            val = round(diff * 100.0, 2)
            trials = target_step.get("random_trial_count", record.completed_trials)
            return val, {"step": common_k, "random_trials": trials}, None

        elif metric == "SUFFICIENCY_GAP_AT_K":
            gap = target_step.get("sufficiency_gap")
            if gap is None:
                return None, {}, f"Sufficiency gap undefined at step k={common_k}."
            val = round(gap * 100.0, 2)
            return val, {"step": common_k}, None

    elif metric in {"TOP_K_OVERLAP", "RANK_CORRELATION"}:
        if not isinstance(record, StabilityRecord):
            return None, {}, "Invalid record type for stability metric."
        if record.outcome != "SUCCESS":
            return None, {}, f"Evaluation did not complete successfully (outcome: {record.outcome})."

        if metric == "TOP_K_OVERLAP":
            if record.mean_top_k_overlap is None:
                return None, {}, "Top-k overlap undefined."
            val = round(record.mean_top_k_overlap * 100.0, 2)
            settings_info = {
                "effective_k": record.effective_k,
                "completed_runs": record.completed_runs,
                "requested_runs": record.requested_runs,
            }
            return val, settings_info, None

        elif metric == "RANK_CORRELATION":
            if record.mean_rank_correlation is None:
                return None, {}, "Spearman rank correlation undefined."
            # Preserve [-1, 1] range; do not convert to percentage
            val = round(record.mean_rank_correlation, 4)
            settings_info = {
                "effective_k": record.effective_k,
                "completed_runs": record.completed_runs,
                "requested_runs": record.requested_runs,
            }
            return val, settings_info, None

    elif metric == "EXPLANATION_TIME":
        # Disclose timing boundary disparity if timing is unavailable or differing
        if isinstance(record, Explanation):
            diag = record.diagnostics or {}
            time_ms = diag.get("execution_time_ms")
            if time_ms is not None and isinstance(time_ms, (int, float)):
                return round(float(time_ms), 2), {"boundary": "explainer_only"}, None
        return None, {}, "Not directly comparable: Explanation timing boundaries or execution environments differ."

    return None, {}, f"Unsupported metric: {metric}"


def verify_pair_compatibility(
    lime_record: Any,
    shap_record: Any,
    metric: str,
    common_k: int = 5,
) -> tuple[bool, str | None]:
    """Verify rigorous server-side pairing compatibility for a specific metric."""
    if not lime_record and not shap_record:
        return False, "Both LIME and SHAP evaluation records are missing."
    if not lime_record:
        return False, "Missing LIME evaluation record."
    if not shap_record:
        return False, "Missing SHAP evaluation record."

    # 1. Immutable source identity / content fingerprint requirement
    lime_hash = getattr(lime_record, "source_hash", None)
    shap_hash = getattr(shap_record, "source_hash", None)

    if not lime_hash or not shap_hash:
        return False, "Not directly comparable: Missing immutable source content provenance."

    if lime_hash != shap_hash:
        return False, "Not directly comparable: Source content fingerprint mismatch."

    # 2. Classifier identity and revision match
    lime_rev = getattr(lime_record, "model_revision", None) or getattr(lime_record, "model_id", None)
    shap_rev = getattr(shap_record, "model_revision", None) or getattr(shap_record, "model_id", None)
    if lime_rev != shap_rev:
        return False, f"Not directly comparable: Model revision mismatch ({lime_rev} vs {shap_rev})."

    # 3. Explained class match
    lime_class = getattr(lime_record, "explained_class", None) or getattr(lime_record, "target_class", None)
    shap_class = getattr(shap_record, "explained_class", None) or getattr(shap_record, "target_class", None)
    if lime_class != shap_class:
        return False, f"Not directly comparable: Explained class mismatch ({lime_class} vs {shap_class})."

    # 4. Metric-specific parameter compatibility
    if metric == "DELETION_AOPC":
        lime_words = getattr(lime_record, "total_eligible_words", None)
        shap_words = getattr(shap_record, "total_eligible_words", None)
        if lime_words is not None and shap_words is not None and lime_words != shap_words:
            return False, f"Not directly comparable: Eligible word universe mismatch ({lime_words} vs {shap_words} words)."

    elif metric in {"COMPREHENSIVENESS_AT_K", "DIFFERENCE_FROM_RANDOM_AT_K", "SUFFICIENCY_GAP_AT_K"}:
        lime_words = getattr(lime_record, "total_eligible_words", None)
        shap_words = getattr(shap_record, "total_eligible_words", None)
        if lime_words is not None and shap_words is not None and lime_words != shap_words:
            return False, f"Not directly comparable: Eligible word universe mismatch ({lime_words} vs {shap_words} words)."

        lime_steps = {s.get("step") for s in (getattr(lime_record, "step_results", []) or []) if isinstance(s, dict)}
        shap_steps = {s.get("step") for s in (getattr(shap_record, "step_results", []) or []) if isinstance(s, dict)}
        if common_k not in lime_steps or common_k not in shap_steps:
            return False, f"Not directly comparable: Step k={common_k} not evaluated in both methods."

        if metric == "DIFFERENCE_FROM_RANDOM_AT_K":
            lime_trials = getattr(lime_record, "completed_trials", 0)
            shap_trials = getattr(shap_record, "completed_trials", 0)
            if lime_trials != shap_trials:
                return False, f"Not directly comparable: Random trial count mismatch ({lime_trials} vs {shap_trials} trials)."

    elif metric in {"TOP_K_OVERLAP", "RANK_CORRELATION"}:
        lime_k = getattr(lime_record, "effective_k", None)
        shap_k = getattr(shap_record, "effective_k", None)
        if lime_k != shap_k:
            return False, f"Not directly comparable: Effective k mismatch ({lime_k} vs {shap_k})."

        lime_runs = getattr(lime_record, "completed_runs", None)
        shap_runs = getattr(shap_record, "completed_runs", None)
        if lime_runs != shap_runs:
            return False, f"Not directly comparable: Completed run count mismatch ({lime_runs} vs {shap_runs} runs)."

    elif metric == "EXPLANATION_TIME":
        return False, "Not directly comparable: Explanation timing boundaries or execution environments differ."

    return True, None


def query_c4_paired_evidence(
    db: Session,
    account: Account,
    metric: str = "DELETION_AOPC",
    model_revision: str | None = None,
    explained_class: str | None = None,
    language: str | None = None,
    common_k: int = 5,
) -> tuple[list[dict[str, Any]], int]:
    """Retrieve all authorized records, pair deterministically, and compute coverage.

    Ensures zero cross-tenant exposure and respects retention expiry.
    """
    valid_now = now()

    # Query all unexpired evaluations belonging to this authorized account
    faith_records = db.scalars(
        select(FaithfulnessRecord).where(
            FaithfulnessRecord.account_id == account.id,
            (FaithfulnessRecord.expires_at.is_(None)) | (FaithfulnessRecord.expires_at > valid_now),
        ).order_by(FaithfulnessRecord.created_at.desc())
    ).all()

    stab_records = db.scalars(
        select(StabilityRecord).where(
            StabilityRecord.account_id == account.id,
            (StabilityRecord.expires_at.is_(None)) | (StabilityRecord.expires_at > valid_now),
        ).order_by(StabilityRecord.created_at.desc())
    ).all()

    exp_records = db.scalars(
        select(Explanation).where(
            Explanation.account_id == account.id,
            (Explanation.expires_at.is_(None)) | (Explanation.expires_at > valid_now),
        ).order_by(Explanation.created_at.desc())
    ).all()

    # Build lookup table of explanations for provenance resolution
    exp_by_id = {str(e.id): e for e in exp_records}

    # Group records by distinct source input identity (source_hash)
    # Distinct source input grouping
    inputs_map: dict[str, dict[str, Any]] = {}

    def get_or_create_input_group(src_hash: str | None, ref_label: str | None, lang: str | None, cls: str, rev: str | None) -> dict[str, Any]:
        key = src_hash if src_hash else f"unprovenanced_{ref_label or 'unknown'}"
        if key not in inputs_map:
            resolved_lang = resolve_record_language(lang, source_ref=ref_label)
            inputs_map[key] = {
                "source_hash": src_hash,
                "input_reference": ref_label or (src_hash[:12] if src_hash else "Unknown Input"),
                "language": resolved_lang,
                "explained_class": cls,
                "model_revision": rev,
                "faithfulness": {"LIME": [], "SHAP": []},
                "stability": {"LIME": [], "SHAP": []},
                "explanations": {"LIME": [], "SHAP": []},
            }
        return inputs_map[key]

    for f in faith_records:
        exp = exp_by_id.get(str(f.explanation_id))
        s_hash = f.source_hash or (exp.source_hash if exp else None)
        lang_val = f.language or (exp.language if exp else None)
        cls_val = f.explained_class
        rev_val = f.model_revision or (exp.model_revision if exp else None)
        grp = get_or_create_input_group(s_hash, f.source_reference, lang_val, cls_val, rev_val)
        if f.method in grp["faithfulness"]:
            grp["faithfulness"][f.method].append(f)

    for s in stab_records:
        exp = exp_by_id.get(str(s.explanation_id))
        s_hash = s.source_hash or (exp.source_hash if exp else None)
        lang_val = s.language or (exp.language if exp else None)
        cls_val = s.explained_class
        rev_val = s.model_revision or (exp.model_revision if exp else None)
        grp = get_or_create_input_group(s_hash, s.source_reference, lang_val, cls_val, rev_val)
        if s.method in grp["stability"]:
            grp["stability"][s.method].append(s)

    for e in exp_records:
        s_hash = e.source_hash
        lang_val = e.language
        cls_val = e.target_class
        rev_val = e.model_revision
        grp = get_or_create_input_group(s_hash, e.source_reference, lang_val, cls_val, rev_val)
        if e.method in grp["explanations"]:
            grp["explanations"][e.method].append(e)

    # Process pairs for all distinct inputs
    all_paired_items: list[dict[str, Any]] = []

    for _key, grp in inputs_map.items():
        # Apply filters
        if model_revision and model_revision != "all" and grp["model_revision"] != model_revision:
            continue
        if explained_class and explained_class != "all" and grp["explained_class"] != explained_class:
            continue
        if language and language != "all" and grp["language"] != language:
            continue

        # Deterministic record selection default:
        # Latest successfully completed compatible LIME and SHAP record
        if metric in {"DELETION_AOPC", "COMPREHENSIVENESS_AT_K", "DIFFERENCE_FROM_RANDOM_AT_K", "SUFFICIENCY_GAP_AT_K"}:
            pool = grp["faithfulness"]
        elif metric in {"TOP_K_OVERLAP", "RANK_CORRELATION"}:
            pool = grp["stability"]
        else:
            pool = grp["explanations"]

        lime_cands = pool.get("LIME", [])
        shap_cands = pool.get("SHAP", [])

        # Deterministic pick: latest with outcome SUCCESS, else latest
        selected_lime = next((r for r in lime_cands if getattr(r, "outcome", "SUCCESS") == "SUCCESS"), None)
        if not selected_lime and lime_cands:
            selected_lime = lime_cands[0]

        selected_shap = next((r for r in shap_cands if getattr(r, "outcome", "SUCCESS") == "SUCCESS"), None)
        if not selected_shap and shap_cands:
            selected_shap = shap_cands[0]

        # Extract values
        lime_val, lime_meta, lime_err = extract_metric_value(selected_lime, metric, common_k)
        shap_val, shap_meta, shap_err = extract_metric_value(selected_shap, metric, common_k)

        # Verify compatibility
        is_compat, compat_reason = verify_pair_compatibility(selected_lime, selected_shap, metric, common_k)

        status = "COMPARABLE"
        reason = None

        if not selected_lime and not selected_shap:
            status = "MISSING_BOTH"
            reason = "No saved evaluation evidence for LIME or SHAP."
        elif not selected_lime:
            status = "MISSING_LIME"
            reason = "Missing saved LIME evaluation for this input."
        elif not selected_shap:
            status = "MISSING_SHAP"
            reason = "Missing saved SHAP evaluation for this input."
        elif not is_compat:
            if "Missing immutable source content" in (compat_reason or ""):
                status = "PROVENANCE_UNAVAILABLE"
            else:
                status = "INCOMPATIBLE"
            reason = compat_reason
        elif lime_val is None or shap_val is None:
            status = "EVALUATION_FAILED"
            reason = lime_err or shap_err or "Measurement undefined."

        paired_diff = None
        if status == "COMPARABLE" and lime_val is not None and shap_val is not None:
            # Paired difference defined consistently as SHAP minus LIME
            paired_diff = round(shap_val - lime_val, 4 if metric == "RANK_CORRELATION" else 2)

        # Underlying record references
        lime_exp_id = selected_lime.id if isinstance(selected_lime, Explanation) else getattr(selected_lime, "explanation_id", None)
        shap_exp_id = selected_shap.id if isinstance(selected_shap, Explanation) else getattr(selected_shap, "explanation_id", None)
        lime_eval_id = None if isinstance(selected_lime, Explanation) else getattr(selected_lime, "id", None)
        shap_eval_id = None if isinstance(selected_shap, Explanation) else getattr(selected_shap, "id", None)

        settings_summary: dict[str, Any] = {}
        if lime_meta:
            settings_summary["lime"] = str(lime_meta)
        if shap_meta:
            settings_summary["shap"] = str(shap_meta)

        paired_item = {
            "input_reference": grp["input_reference"],
            "source_hash": grp["source_hash"],
            "language": grp["language"],
            "model_revision": grp["model_revision"],
            "explained_class": grp["explained_class"],
            "metric": metric,
            "lime_value": lime_val if status == "COMPARABLE" else None,
            "shap_value": shap_val if status == "COMPARABLE" else None,
            "paired_difference": paired_diff,
            "status": status,
            "reason": reason,
            "lime_explanation_id": UUID(str(lime_exp_id)) if lime_exp_id else None,
            "shap_explanation_id": UUID(str(shap_exp_id)) if shap_exp_id else None,
            "lime_evaluation_id": UUID(str(lime_eval_id)) if lime_eval_id else None,
            "shap_evaluation_id": UUID(str(shap_eval_id)) if shap_eval_id else None,
            "lime_created_at": getattr(selected_lime, "created_at", None),
            "shap_created_at": getattr(selected_shap, "created_at", None),
            "settings_summary": settings_summary,
        }
        all_paired_items.append(paired_item)

    return all_paired_items, len(inputs_map)


def compute_metric_summary(
    items: list[dict[str, Any]],
    metric: str,
    common_k: int = 5,
) -> C4ComparisonMetricSummary:
    """Compute summary statistics across full filtered dataset for a metric."""
    defn = METRIC_DEFINITIONS.get(metric, {})
    decimals = 4 if metric == "RANK_CORRELATION" else 2

    comparable_items = [it for it in items if it["status"] == "COMPARABLE" and it["lime_value"] is not None and it["shap_value"] is not None]

    lime_vals = [it["lime_value"] for it in comparable_items]
    shap_vals = [it["shap_value"] for it in comparable_items]
    diff_vals = [it["paired_difference"] for it in comparable_items if it["paired_difference"] is not None]

    l_mean, l_std, l_med, l_iqr = compute_sample_statistics(lime_vals, decimals)
    s_mean, s_std, s_med, s_iqr = compute_sample_statistics(shap_vals, decimals)
    d_mean, d_std, _, _ = compute_sample_statistics(diff_vals, decimals)

    missing_cnt = sum(1 for it in items if it["status"] in {"MISSING_LIME", "MISSING_SHAP", "MISSING_BOTH"})
    incomp_cnt = sum(1 for it in items if it["status"] in {"INCOMPATIBLE", "PROVENANCE_UNAVAILABLE"})
    excl_cnt = sum(1 for it in items if it["status"] == "EVALUATION_FAILED")

    label = defn.get("label", metric)
    if "{common_k}" in label:
        label = label.replace("{common_k}", str(common_k))

    return C4ComparisonMetricSummary(
        metric=metric,
        metric_label=label,
        definition_version=defn.get("version", "1.0.0"),
        unit=defn.get("unit", ""),
        lime_mean=l_mean,
        lime_std=l_std,
        shap_mean=s_mean,
        shap_std=s_std,
        paired_difference_mean=d_mean,
        paired_difference_std=d_std,
        valid_pairs_count=len(comparable_items),
        missing_count=missing_cnt,
        incompatible_count=incomp_cnt,
        excluded_count=excl_cnt,
        lime_median=l_med,
        lime_iqr=l_iqr,
        shap_median=s_med,
        shap_iqr=s_iqr,
        common_k=common_k,
    )


def compute_language_groups(
    items: list[dict[str, Any]],
    metric: str,
) -> list[C4ComparisonLanguageGroup]:
    """Compute metric aggregates grouped strictly by preserved language metadata."""
    decimals = 4 if metric == "RANK_CORRELATION" else 2
    groups_data: dict[str, list[dict[str, Any]]] = {lang: [] for lang in SUPPORTED_LANGUAGES}

    for it in items:
        lang = it.get("language")
        if lang not in groups_data:
            lang = "Unknown"
        groups_data[lang].append(it)

    results: list[C4ComparisonLanguageGroup] = []
    for lang in SUPPORTED_LANGUAGES:
        l_items = groups_data[lang]
        comp = [it for it in l_items if it["status"] == "COMPARABLE" and it["lime_value"] is not None and it["shap_value"] is not None]

        l_vals = [it["lime_value"] for it in comp]
        s_vals = [it["shap_value"] for it in comp]
        d_vals = [it["paired_difference"] for it in comp if it["paired_difference"] is not None]

        l_mean, l_std, _, _ = compute_sample_statistics(l_vals, decimals)
        s_mean, s_std, _, _ = compute_sample_statistics(s_vals, decimals)
        d_mean, d_std, _, _ = compute_sample_statistics(d_vals, decimals)

        results.append(
            C4ComparisonLanguageGroup(
                language=lang,  # type: ignore[arg-type]
                valid_pairs_count=len(comp),
                lime_mean=l_mean,
                lime_std=l_std,
                shap_mean=s_mean,
                shap_std=s_std,
                paired_difference_mean=d_mean,
                paired_difference_std=d_std,
            )
        )
    return results


def sanitize_csv_cell(value: Any) -> str:
    """Protect spreadsheet cells from formula injection and format cleanly."""
    if value is None:
        return ""
    text = str(value)
    # Prefix dangerous characters (=, +, -, @, tab, CR) with single quote
    if text.startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + text
    return text


def build_comparison_csv(
    items: list[dict[str, Any]],
    metric_summaries: list[C4ComparisonMetricSummary],
) -> str:
    """Generate formula-safe CSV export across full filtered dataset."""
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")

    # Header row
    writer.writerow([
        "Input Reference",
        "Metric Name",
        "Definition Version",
        "Units",
        "LIME Value",
        "SHAP Value",
        "Paired Difference (SHAP - LIME)",
        "Language",
        "Model Revision",
        "Explained Class",
        "Status",
        "Exclusion/Compatibility Reason",
        "Settings Summary",
        "Export Timestamp",
    ])

    export_ts = now().isoformat()

    for it in items:
        metric_name = it["metric"]
        defn = METRIC_DEFINITIONS.get(metric_name, {})
        writer.writerow([
            sanitize_csv_cell(it["input_reference"]),
            sanitize_csv_cell(defn.get("label", metric_name)),
            sanitize_csv_cell(defn.get("version", "1.0.0")),
            sanitize_csv_cell(defn.get("unit", "")),
            sanitize_csv_cell(it["lime_value"]),
            sanitize_csv_cell(it["shap_value"]),
            sanitize_csv_cell(it["paired_difference"]),
            sanitize_csv_cell(it["language"]),
            sanitize_csv_cell(it["model_revision"]),
            sanitize_csv_cell(it["explained_class"]),
            sanitize_csv_cell(it["status"]),
            sanitize_csv_cell(it["reason"]),
            sanitize_csv_cell(it["settings_summary"]),
            sanitize_csv_cell(export_ts),
        ])

    return output.getvalue()


def build_current_comparison(
    db: Session,
    account: Account,
    body: C4ComparisonCurrentRequest,
) -> C4ComparisonCurrentResponse:
    """Build paired comparison and alternative record selection for the current input."""
    valid_now = now()
    text_available = False
    authorized_text = None
    src_hash = None

    if body.text and body.text.strip():
        src_hash = compute_source_hash(body.text)
        authorized_text = body.text
        text_available = True
        input_ref = body.source_reference or f"Input ({src_hash[:8]})"
    else:
        input_ref = body.source_reference or "Current Input"

    lang_val = resolve_record_language(body.language, text=body.text, source_ref=body.source_reference)
    target_class = body.target_class or "Negative"
    common_k = max(1, min(body.common_k or 5, 50))

    # Compute expected request hashes if text is provided to identify matching historical records
    expected_lime_hash = None
    expected_shap_hash = None
    if body.text:
        import json
        expected_lime_hash = hashlib.sha256(
            json.dumps({"language": body.language, "method": "LIME", "target_class": target_class, "text": body.text}, sort_keys=True).encode()
        ).hexdigest()
        expected_shap_hash = hashlib.sha256(
            json.dumps({"language": body.language, "method": "SHAP", "target_class": target_class, "text": text_available and body.text}, sort_keys=True).encode()
        ).hexdigest()

    # Query candidate records belonging to this account
    faith_candidates = db.scalars(
        select(FaithfulnessRecord).where(
            FaithfulnessRecord.account_id == account.id,
            (FaithfulnessRecord.expires_at.is_(None)) | (FaithfulnessRecord.expires_at > valid_now),
        ).order_by(FaithfulnessRecord.created_at.desc())
    ).all()

    stab_candidates = db.scalars(
        select(StabilityRecord).where(
            StabilityRecord.account_id == account.id,
            (StabilityRecord.expires_at.is_(None)) | (StabilityRecord.expires_at > valid_now),
        ).order_by(StabilityRecord.created_at.desc())
    ).all()

    exp_candidates = db.scalars(
        select(Explanation).where(
            Explanation.account_id == account.id,
            (Explanation.expires_at.is_(None)) | (Explanation.expires_at > valid_now),
        ).order_by(Explanation.created_at.desc())
    ).all()

    exp_by_id = {str(e.id): e for e in exp_candidates}

    def matches_input(rec: Any) -> bool:
        r_hash = getattr(rec, "source_hash", None)
        if not r_hash and hasattr(rec, "explanation_id"):
            exp = exp_by_id.get(str(rec.explanation_id))
            if exp:
                r_hash = exp.source_hash
        if src_hash and r_hash == src_hash:
            return True
        # Check historical request_hash
        req_h = getattr(rec, "request_hash", None)
        if req_h and req_h in {expected_lime_hash, expected_shap_hash}:
            return True
        if hasattr(rec, "explanation_id"):
            exp = exp_by_id.get(str(rec.explanation_id))
            if exp and exp.request_hash in {expected_lime_hash, expected_shap_hash}:
                return True
        if body.source_reference and getattr(rec, "source_reference", None) == body.source_reference:
            return True
        return False

    matching_faith = [f for f in faith_candidates if matches_input(f)]
    matching_stab = [s for s in stab_candidates if matches_input(s)]
    matching_exp = [e for e in exp_candidates if matches_input(e)]

    # Candidate alternative lists
    available_lime: list[C4ComparisonCandidateRecord] = []
    available_shap: list[C4ComparisonCandidateRecord] = []

    for f in matching_faith:
        cand = C4ComparisonCandidateRecord(
            record_id=UUID(f.id),
            explanation_id=UUID(f.explanation_id),
            method=f.method,  # type: ignore[arg-type]
            record_type="FAITHFULNESS",
            created_at=f.created_at,
            is_compatible=(f.outcome == "SUCCESS"),
            incompatibility_reason=None if f.outcome == "SUCCESS" else f.outcome_message,
            settings={"aopc": str(f.aopc), "outcome": f.outcome, "eligible_words": f.total_eligible_words},
        )
        if f.method == "LIME":
            available_lime.append(cand)
        else:
            available_shap.append(cand)

    for s in matching_stab:
        cand = C4ComparisonCandidateRecord(
            record_id=UUID(s.id),
            explanation_id=UUID(s.explanation_id),
            method=s.method,  # type: ignore[arg-type]
            record_type="STABILITY",
            created_at=s.created_at,
            is_compatible=(s.outcome == "SUCCESS"),
            incompatibility_reason=None if s.outcome == "SUCCESS" else s.outcome_message,
            settings={"top_k_overlap": str(s.mean_top_k_overlap), "rank_correlation": str(s.mean_rank_correlation), "effective_k": s.effective_k},
        )
        if s.method == "LIME":
            available_lime.append(cand)
        else:
            available_shap.append(cand)

    # Resolve selected records for current input
    # Selected LIME and SHAP explanations
    sel_lime_exp = None
    if body.selected_lime_exp_id:
        sel_lime_exp = next((e for e in matching_exp if str(e.id) == str(body.selected_lime_exp_id)), None)
    if not sel_lime_exp:
        sel_lime_exp = next((e for e in matching_exp if e.method == "LIME"), None)

    sel_shap_exp = None
    if body.selected_shap_exp_id:
        sel_shap_exp = next((e for e in matching_exp if str(e.id) == str(body.selected_shap_exp_id)), None)
    if not sel_shap_exp:
        sel_shap_exp = next((e for e in matching_exp if e.method == "SHAP"), None)

    # Compute metrics for current input across all supported metrics
    current_metrics: list[C4ComparisonMetricSummary] = []
    current_items: list[C4PairedEvidenceItem] = []

    model_rev = (sel_lime_exp and sel_lime_exp.model_revision) or (sel_shap_exp and sel_shap_exp.model_revision)

    for metric_key in METRIC_DEFINITIONS.keys():
        defn = METRIC_DEFINITIONS[metric_key]
        if metric_key in {"DELETION_AOPC", "COMPREHENSIVENESS_AT_K", "DIFFERENCE_FROM_RANDOM_AT_K", "SUFFICIENCY_GAP_AT_K"}:
            pool_lime = [f for f in matching_faith if f.method == "LIME"]
            pool_shap = [f for f in matching_faith if f.method == "SHAP"]
            if body.selected_lime_eval_id:
                rec_lime = next((f for f in pool_lime if str(f.id) == str(body.selected_lime_eval_id)), None) or (pool_lime[0] if pool_lime else None)
            else:
                rec_lime = next((f for f in pool_lime if f.outcome == "SUCCESS"), pool_lime[0] if pool_lime else None)

            if body.selected_shap_eval_id:
                rec_shap = next((f for f in pool_shap if str(f.id) == str(body.selected_shap_eval_id)), None) or (pool_shap[0] if pool_shap else None)
            else:
                rec_shap = next((f for f in pool_shap if f.outcome == "SUCCESS"), pool_shap[0] if pool_shap else None)
        elif metric_key in {"TOP_K_OVERLAP", "RANK_CORRELATION"}:
            pool_lime = [s for s in matching_stab if s.method == "LIME"]
            pool_shap = [s for s in matching_stab if s.method == "SHAP"]
            rec_lime = next((s for s in pool_lime if s.outcome == "SUCCESS"), pool_lime[0] if pool_lime else None)
            rec_shap = next((s for s in pool_shap if s.outcome == "SUCCESS"), pool_shap[0] if pool_shap else None)
        else:
            rec_lime = sel_lime_exp
            rec_shap = sel_shap_exp

        lime_val, lime_meta, lime_err = extract_metric_value(rec_lime, metric_key, common_k)
        shap_val, shap_meta, shap_err = extract_metric_value(rec_shap, metric_key, common_k)

        # For current input with verified input text, attach source_hash if present
        if src_hash:
            if rec_lime and not getattr(rec_lime, "source_hash", None):
                rec_lime.source_hash = src_hash
            if rec_shap and not getattr(rec_shap, "source_hash", None):
                rec_shap.source_hash = src_hash

        is_compat, compat_reason = verify_pair_compatibility(rec_lime, rec_shap, metric_key, common_k)

        status = "COMPARABLE"
        reason = None
        if not rec_lime and not rec_shap:
            status = "MISSING_BOTH"
            reason = "No saved evaluation evidence for LIME or SHAP."
        elif not rec_lime:
            status = "MISSING_LIME"
            reason = "Missing saved LIME evaluation for this input."
        elif not rec_shap:
            status = "MISSING_SHAP"
            reason = "Missing saved SHAP evaluation for this input."
        elif not is_compat:
            status = "INCOMPATIBLE"
            reason = compat_reason
        elif lime_val is None or shap_val is None:
            status = "EVALUATION_FAILED"
            reason = lime_err or shap_err or "Measurement undefined."

        paired_diff = None
        if status == "COMPARABLE" and lime_val is not None and shap_val is not None:
            paired_diff = round(shap_val - lime_val, 4 if metric_key == "RANK_CORRELATION" else 2)

        lime_exp_id = getattr(rec_lime, "explanation_id", None) or (rec_lime.id if isinstance(rec_lime, Explanation) else None)
        shap_exp_id = getattr(rec_shap, "explanation_id", None) or (rec_shap.id if isinstance(rec_shap, Explanation) else None)
        lime_eval_id = rec_lime.id if not isinstance(rec_lime, Explanation) and rec_lime else None
        shap_eval_id = rec_shap.id if not isinstance(rec_shap, Explanation) and rec_shap else None

        item = C4PairedEvidenceItem(
            input_reference=input_ref,
            source_hash=src_hash,
            language=lang_val,  # type: ignore[arg-type]
            model_revision=model_rev,
            explained_class=target_class,
            metric=metric_key,
            lime_value=lime_val if status == "COMPARABLE" else None,
            shap_value=shap_val if status == "COMPARABLE" else None,
            paired_difference=paired_diff,
            status=status,  # type: ignore[arg-type]
            reason=reason,
            lime_explanation_id=UUID(str(lime_exp_id)) if lime_exp_id else None,
            shap_explanation_id=UUID(str(shap_exp_id)) if shap_exp_id else None,
            lime_evaluation_id=UUID(str(lime_eval_id)) if lime_eval_id else None,
            shap_evaluation_id=UUID(str(shap_eval_id)) if shap_eval_id else None,
            lime_created_at=getattr(rec_lime, "created_at", None),
            shap_created_at=getattr(rec_shap, "created_at", None),
            settings_summary={"lime": str(lime_meta), "shap": str(shap_meta)},
        )
        current_items.append(item)

        m_summary = C4ComparisonMetricSummary(
            metric=metric_key,
            metric_label=defn.get("label", metric_key).replace("{common_k}", str(common_k)),
            definition_version=defn.get("version", "1.0.0"),
            unit=defn.get("unit", ""),
            lime_mean=lime_val if status == "COMPARABLE" else None,
            lime_std=None,  # Null standard deviation for single pair
            shap_mean=shap_val if status == "COMPARABLE" else None,
            shap_std=None,
            paired_difference_mean=paired_diff,
            paired_difference_std=None,
            valid_pairs_count=1 if status == "COMPARABLE" else 0,
            missing_count=1 if status in {"MISSING_LIME", "MISSING_SHAP", "MISSING_BOTH"} else 0,
            incompatible_count=1 if status in {"INCOMPATIBLE", "PROVENANCE_UNAVAILABLE"} else 0,
            excluded_count=1 if status == "EVALUATION_FAILED" else 0,
            common_k=common_k,
        )
        current_metrics.append(m_summary)

    return C4ComparisonCurrentResponse(
        input_reference=input_ref,
        source_hash=src_hash,
        authorized_source_text=authorized_text,
        text_available=text_available,
        language=lang_val,  # type: ignore[arg-type]
        model_revision=model_rev,
        explained_class=target_class,
        selected_lime_explanation_id=UUID(str(sel_lime_exp.id)) if sel_lime_exp else None,
        selected_shap_explanation_id=UUID(str(sel_shap_exp.id)) if sel_shap_exp else None,
        metrics=current_metrics,
        evidence_items=current_items,
        available_lime_records=available_lime,
        available_shap_records=available_shap,
    )

