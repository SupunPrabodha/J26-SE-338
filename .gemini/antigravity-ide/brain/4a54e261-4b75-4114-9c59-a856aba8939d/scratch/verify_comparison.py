"""Scratch verification script for C4 Comparison feature.
Uses synthetic disposable fixtures only.
Does not commit or modify repository test suites.
"""

import sys
import math
from datetime import datetime, timezone, timedelta
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup imports
from research_common.database import (
    Base,
    Account,
    Explanation,
    FaithfulnessRecord,
    StabilityRecord,
)
from research_contracts import Role
from orchestrator.comparison import (
    compute_source_hash,
    compute_sample_statistics,
    query_c4_paired_evidence,
    compute_metric_summary,
    compute_language_groups,
    build_comparison_csv,
    build_current_comparison,
    sanitize_csv_cell,
    C4ComparisonCurrentRequest,
)

def main():
    print("--- Starting C4 Comparison Focused Verification ---")

    # 1. Verify Sample Statistics & N=1 Null SD behaviour
    print("\n[Check 1] Mathematical precision: Paired differences, mean, sample SD, and single-pair behaviour")
    mean_empty, std_empty, _, _ = compute_sample_statistics([])
    assert mean_empty is None and std_empty is None, "Empty list must yield None"

    mean_single, std_single, median_single, iqr_single = compute_sample_statistics([6.0])
    assert mean_single == 6.0, f"Mean must be 6.0, got {mean_single}"
    assert std_single is None, f"Sample SD with N=1 must be None (not 0.0), got {std_single}"
    assert median_single == 6.0

    # Pair 1: +6.0 pp, Pair 2: -10.0 pp -> Mean = -2.0 pp
    # Variance = ((6.0 - (-2.0))^2 + (-10.0 - (-2.0))^2) / 1 = 64 + 64 = 128
    # Sample SD = sqrt(128) = 11.3137...
    mean_two, std_two, median_two, iqr_two = compute_sample_statistics([6.0, -10.0])
    assert mean_two == -2.0, f"Mean must be -2.0, got {mean_two}"
    expected_sd = round(math.sqrt(128.0), 2)
    assert std_two == expected_sd, f"SD must be {expected_sd}, got {std_two}"
    print(f"[OK] Checked statistics: N=1 SD is {std_single}, N=2 mean={mean_two}, std={std_two}")

    # 2. Formula Injection Protection in CSV export
    print("\n[Check 2] CSV formula injection protection")
    assert sanitize_csv_cell("=1+1") == "'=1+1"
    assert sanitize_csv_cell("+cmd|'/C calc'!A0") == "'+cmd|'/C calc'!A0"
    assert sanitize_csv_cell("-2+3") == "'-2+3"
    assert sanitize_csv_cell("@SUM(1,2)") == "'@SUM(1,2)"
    assert sanitize_csv_cell("Normal Text") == "Normal Text"
    print("[OK] Checked formula injection escaping for '=', '+', '-', '@'")

    # 3. Setup in-memory SQLite database
    print("\n[Check 3] Backend Pairing, Provenance, Multi-Tenant Isolation, and Selection Rules")
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    now_utc = datetime.now(timezone.utc)
    future_exp = now_utc + timedelta(days=30)
    past_exp = now_utc - timedelta(days=1)

    # Accounts
    account_a = Account(
        id=str(uuid4()),
        username="counsellor_a",
        password_hash="mock_hash",
        role=Role.COUNSELLOR,
        created_at=now_utc,
    )
    account_b = Account(
        id=str(uuid4()),
        username="counsellor_b",
        password_hash="mock_hash",
        role=Role.COUNSELLOR,
        created_at=now_utc,
    )
    db.add_all([account_a, account_b])
    db.commit()

    # Synthetic text & immutable hash
    text_1 = "Synthetic student screening text one for emotional distress."
    hash_1 = compute_source_hash(text_1)

    text_2 = "Synthetic student screening text two for academic burnout."
    hash_2 = compute_source_hash(text_2)

    # 3.1 Account A: Input 1 has compatible LIME and SHAP faithfulness
    lime_exp_1 = Explanation(
        id=str(uuid4()),
        account_id=account_a.id,
        method="LIME",
        model_id="c3_multilingual_sentiment_v1",
        source_reference="case-101",
        source_hash=hash_1,
        language="English",
        target_class="Negative",
        model_revision="c3_multilingual_sentiment_v1",
        created_at=now_utc,
        expires_at=future_exp,
    )
    shap_exp_1 = Explanation(
        id=str(uuid4()),
        account_id=account_a.id,
        method="SHAP",
        model_id="c3_multilingual_sentiment_v1",
        source_reference="case-101",
        source_hash=hash_1,
        language="English",
        target_class="Negative",
        model_revision="c3_multilingual_sentiment_v1",
        created_at=now_utc,
        expires_at=future_exp,
    )
    db.add_all([lime_exp_1, shap_exp_1])
    db.flush()

    lime_faith_1 = FaithfulnessRecord(
        id=str(uuid4()),
        explanation_id=lime_exp_1.id,
        account_id=account_a.id,
        method="LIME",
        model_id="c3_multilingual_sentiment_v1",
        source_reference="case-101",
        source_hash=hash_1,
        language="English",
        explained_class="Negative",
        baseline_probability=0.85,
        model_revision="c3_multilingual_sentiment_v1",
        aopc=0.12,
        total_eligible_words=10,
        budget_evaluated=5,
        completed_steps=5,
        completed_trials=10,
        step_results=[{"step": 5, "comprehensiveness_drop": 0.15, "difference_from_random": 0.08, "sufficiency_gap": 0.04}],
        outcome="SUCCESS",
        created_at=now_utc,
        expires_at=future_exp,
    )
    shap_faith_1 = FaithfulnessRecord(
        id=str(uuid4()),
        explanation_id=shap_exp_1.id,
        account_id=account_a.id,
        method="SHAP",
        model_id="c3_multilingual_sentiment_v1",
        source_reference="case-101",
        source_hash=hash_1,
        language="English",
        explained_class="Negative",
        baseline_probability=0.85,
        model_revision="c3_multilingual_sentiment_v1",
        aopc=0.18,
        total_eligible_words=10,
        budget_evaluated=5,
        completed_steps=5,
        completed_trials=10,
        step_results=[{"step": 5, "comprehensiveness_drop": 0.22, "difference_from_random": 0.14, "sufficiency_gap": 0.03}],
        outcome="SUCCESS",
        created_at=now_utc,
        expires_at=future_exp,
    )
    db.add_all([lime_faith_1, shap_faith_1])

    # 3.2 Account A: Input 1 has repeated runs (deterministic selection test)
    # A second LIME run done slightly earlier with different metric value
    earlier_utc = now_utc - timedelta(minutes=10)
    lime_faith_1_earlier = FaithfulnessRecord(
        id=str(uuid4()),
        explanation_id=lime_exp_1.id,
        account_id=account_a.id,
        method="LIME",
        model_id="c3_multilingual_sentiment_v1",
        source_reference="case-101",
        source_hash=hash_1,
        language="English",
        explained_class="Negative",
        baseline_probability=0.85,
        model_revision="c3_multilingual_sentiment_v1",
        aopc=0.99, # Highly inflated older value
        total_eligible_words=10,
        budget_evaluated=5,
        completed_steps=5,
        completed_trials=10,
        outcome="SUCCESS",
        created_at=earlier_utc,
        expires_at=future_exp,
    )
    db.add(lime_faith_1_earlier)

    # 3.3 Account A: Input 2 has settings-mismatch (total eligible words mismatch: 10 vs 5)
    lime_exp_2 = Explanation(
        id=str(uuid4()),
        account_id=account_a.id,
        method="LIME",
        model_id="c3_multilingual_sentiment_v1",
        source_reference="case-102",
        source_hash=hash_2,
        language="Sinhala",
        target_class="Negative",
        model_revision="c3_multilingual_sentiment_v1",
        created_at=now_utc,
        expires_at=future_exp,
    )
    shap_exp_2 = Explanation(
        id=str(uuid4()),
        account_id=account_a.id,
        method="SHAP",
        model_id="c3_multilingual_sentiment_v1",
        source_reference="case-102",
        source_hash=hash_2,
        language="Sinhala",
        target_class="Negative",
        model_revision="c3_multilingual_sentiment_v1",
        created_at=now_utc,
        expires_at=future_exp,
    )
    db.add_all([lime_exp_2, shap_exp_2])
    db.flush()

    lime_faith_2 = FaithfulnessRecord(
        id=str(uuid4()),
        explanation_id=lime_exp_2.id,
        account_id=account_a.id,
        method="LIME",
        model_id="c3_multilingual_sentiment_v1",
        source_reference="case-102",
        source_hash=hash_2,
        language="Sinhala",
        explained_class="Negative",
        baseline_probability=0.85,
        model_revision="c3_multilingual_sentiment_v1",
        aopc=0.15,
        total_eligible_words=10,
        budget_evaluated=5,
        completed_steps=5,
        completed_trials=10,
        outcome="SUCCESS",
        created_at=now_utc,
        expires_at=future_exp,
    )
    shap_faith_2 = FaithfulnessRecord(
        id=str(uuid4()),
        explanation_id=shap_exp_2.id,
        account_id=account_a.id,
        method="SHAP",
        model_id="c3_multilingual_sentiment_v1",
        source_reference="case-102",
        source_hash=hash_2,
        language="Sinhala",
        explained_class="Negative",
        baseline_probability=0.85,
        model_revision="c3_multilingual_sentiment_v1",
        aopc=0.15,
        total_eligible_words=5, # Settings mismatch: eligible words!
        budget_evaluated=5,
        completed_steps=5,
        completed_trials=10,
        outcome="SUCCESS",
        created_at=now_utc,
        expires_at=future_exp,
    )
    db.add_all([lime_faith_2, shap_faith_2])

    # 3.4 Account A: Input 3 is expired (retention/withdrawal exclusion test)
    text_3 = "Synthetic student text three expired."
    hash_3 = compute_source_hash(text_3)
    lime_exp_3 = Explanation(
        id=str(uuid4()),
        account_id=account_a.id,
        method="LIME",
        model_id="c3_multilingual_sentiment_v1",
        source_reference="case-103",
        source_hash=hash_3,
        language="English",
        target_class="Negative",
        model_revision="c3_multilingual_sentiment_v1",
        created_at=now_utc - timedelta(days=2),
        expires_at=past_exp, # Expired!
    )
    db.add(lime_exp_3)

    # 3.5 Account B: Input 4 belongs to other account (cross-tenant isolation test)
    text_4 = "Synthetic text belonging to account B only."
    hash_4 = compute_source_hash(text_4)
    lime_exp_4 = Explanation(
        id=str(uuid4()),
        account_id=account_b.id,
        method="LIME",
        model_id="c3_multilingual_sentiment_v1",
        source_reference="case-104",
        source_hash=hash_4,
        language="English",
        target_class="Negative",
        model_revision="c3_multilingual_sentiment_v1",
        created_at=now_utc,
        expires_at=future_exp,
    )
    db.add(lime_exp_4)

    db.commit()

    # Query for Account A
    print("\n[Executing Query] query_c4_paired_evidence for Account A, metric=DELETION_AOPC")
    paired_items, distinct_count = query_c4_paired_evidence(
        db=db,
        account=account_a,
        metric="DELETION_AOPC",
    )

    # Check distinct inputs count: Input 1 and Input 2 in scope (Input 3 is expired, Input 4 is Account B)
    assert distinct_count == 2, f"Distinct inputs must be 2, got {distinct_count}"
    print(f"[OK] Distinct inputs counted correctly: {distinct_count} (repeated runs did not inflate count)")

    # Find Input 1 in paired_items
    item_1 = next((it for it in paired_items if it["input_reference"] == "case-101"), None)
    assert item_1 is not None, "Input 1 must be present"
    assert item_1["status"] == "COMPARABLE", f"Input 1 status must be COMPARABLE, got {item_1['status']}"
    # Check percentage point conversion: 0.12 -> 12.0 pp, 0.18 -> 18.0 pp
    assert item_1["lime_value"] == 12.0, f"Expected 12.0 pp, got {item_1['lime_value']}"
    assert item_1["shap_value"] == 18.0, f"Expected 18.0 pp, got {item_1['shap_value']}"
    # Paired diff: SHAP - LIME = 18.0 - 12.0 = +6.0 pp
    assert item_1["paired_difference"] == 6.0, f"Expected paired diff +6.0 pp, got {item_1['paired_difference']}"
    # Verify deterministic selection selected latest run (0.12), NOT earlier run (0.99)
    assert str(item_1["lime_evaluation_id"]) == str(lime_faith_1.id), "Latest run must be selected deterministically"
    print(f"[OK] Input 1 paired correctly: LIME={item_1['lime_value']} pp, SHAP={item_1['shap_value']} pp, Diff={item_1['paired_difference']} pp")

    # Find Input 2 in paired_items (settings mismatch)
    item_2 = next((it for it in paired_items if it["input_reference"] == "case-102"), None)
    assert item_2 is not None, "Input 2 must be present"
    assert item_2["status"] == "INCOMPATIBLE", f"Input 2 status must be INCOMPATIBLE, got {item_2['status']}"
    assert "Eligible word universe mismatch" in item_2["reason"], f"Incompatibility reason expected word universe mismatch, got: {item_2['reason']}"
    assert item_2["paired_difference"] is None, "Incompatible item must have null paired_difference"
    print(f"[OK] Input 2 settings-mismatch detected: status={item_2['status']}, reason='{item_2['reason']}'")

    # Check metric summary across Account A
    summary = compute_metric_summary(paired_items, "DELETION_AOPC")
    assert summary.valid_pairs_count == 1, f"Expected 1 valid pair, got {summary.valid_pairs_count}"
    assert summary.incompatible_count == 1, f"Expected 1 incompatible, got {summary.incompatible_count}"
    assert summary.paired_difference_mean == 6.0, f"Expected mean diff 6.0, got {summary.paired_difference_mean}"
    # Single pair -> Sample SD must be None
    assert summary.paired_difference_std is None, f"Expected sample SD None for N=1, got {summary.paired_difference_std}"
    print(f"[OK] Metric summary verified: valid_pairs={summary.valid_pairs_count}, mean_diff={summary.paired_difference_mean}, sd={summary.paired_difference_std}")

    # Check Language Grouping
    lang_groups = compute_language_groups(paired_items, "DELETION_AOPC")
    eng_group = next((g for g in lang_groups if g.language == "English"), None)
    assert eng_group is not None and eng_group.valid_pairs_count == 1
    sin_group = next((g for g in lang_groups if g.language == "Sinhala"), None)
    assert sin_group is not None and sin_group.valid_pairs_count == 0 # because incompatible
    print("[OK] Language grouping verified (English: 1 valid pair, Sinhala: 0 valid pairs)")

    # Check Cross-tenant isolation: Account B must see only Input 4, zero of Account A
    paired_items_b, distinct_b = query_c4_paired_evidence(db=db, account=account_b, metric="DELETION_AOPC")
    assert distinct_b == 1, f"Account B must see 1 input, got {distinct_b}"
    assert paired_items_b[0]["source_hash"] == hash_4, "Account B must see only its own input"
    print("[OK] Cross-tenant isolation verified: Account B cannot see any records of Account A")

    # Check Current Input Comparison endpoint logic
    req = C4ComparisonCurrentRequest(
        text=text_1,
        source_reference="case-101",
        language="English",
        target_class="Negative",
    )
    current_resp = build_current_comparison(db=db, account=account_a, body=req)
    assert current_resp.source_hash == hash_1
    assert len(current_resp.available_lime_records) >= 1
    assert len(current_resp.evidence_items) >= 1
    deletion_item = next((it for it in current_resp.evidence_items if it.metric == "DELETION_AOPC"), None)
    assert deletion_item is not None
    assert deletion_item.status == "COMPARABLE"
    assert deletion_item.paired_difference == 6.0
    print(f"[OK] Current Input comparison verified: hash={current_resp.source_hash[:8]}..., items={len(current_resp.evidence_items)}")

    # Check CSV Generation
    csv_out = build_comparison_csv(paired_items, [summary])
    assert "Input Reference" in csv_out
    assert "Deletion AOPC" in csv_out
    assert "case-101" in csv_out
    assert "case-102" in csv_out
    assert "Eligible word universe mismatch" in csv_out
    print("[OK] CSV export generation verified with all metadata and reasons")

    print("\n--- ALL FOCUSED VERIFICATION CHECKS PASSED (100%) ---")

if __name__ == "__main__":
    main()
