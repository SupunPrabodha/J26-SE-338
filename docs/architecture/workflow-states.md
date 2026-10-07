# Workflow state model

RECEIVED → CONSENT_VERIFIED → PREPROCESSING → INFERENCE → EXPLANATION → READY_FOR_REVIEW → UNDER_REVIEW → COMPLETED.

Any processing state can fail to FAILED. A bounded retry goes FAILED → RECEIVED → CONSENT_VERIFIED and repeats deterministic stages. Withdrawal from any non-withdrawn state goes WITHDRAWAL_REQUESTED → WITHDRAWN. COMPLETED can still be withdrawn. WITHDRAWN is terminal. No FAILED → READY_FOR_REVIEW shortcut exists. Only assigned counsellors can move READY_FOR_REVIEW → UNDER_REVIEW → COMPLETED.

`services/orchestrator/workflow.py:TRANSITIONS` is the executable transition table. A queue lease is not workflow consent. Every stage rechecks consent, including final publication. Repeated idempotency keys return the existing owned workflow; changed payloads under a key conflict. Contract failures are not retried; transient timeouts/service failures are bounded at three attempts. Dead letters require manual investigation/new consent and case; do not edit database state to bypass gates.
