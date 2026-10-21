# Workflow state model

RECEIVED → CONSENT_VERIFIED → PREPROCESSING → INFERENCE → EXPLANATION → READY_FOR_REVIEW → UNDER_REVIEW → COMPLETED.

Any processing state can fail to FAILED. A bounded retry goes FAILED → RECEIVED → CONSENT_VERIFIED and repeats deterministic stages. Withdrawal from any non-withdrawn state goes WITHDRAWAL_REQUESTED → WITHDRAWN. COMPLETED can still be withdrawn. WITHDRAWN is terminal. No FAILED → READY_FOR_REVIEW shortcut exists. Only assigned counsellors can move READY_FOR_REVIEW → UNDER_REVIEW → COMPLETED.

`services/orchestrator/workflow.py:TRANSITIONS` is the executable transition table. A queue lease is not workflow consent. Every stage rechecks consent, including final publication. Repeated idempotency keys return the existing owned workflow; changed payloads under a key conflict. Contract failures are not retried; transient timeouts/service failures are bounded at three attempts. Dead letters require manual investigation/new consent and case; do not edit database state to bypass gates.

Claiming locks at most one case with `FOR UPDATE OF workflow_cases SKIP LOCKED LIMIT 1`,
then locks its job. Processing and disposal take the case lock before consent/job work;
exhausted-lease handling follows the same case-first rule. The claim transaction owns
resetting an interrupted workflow to RECEIVED. A second executor for the same attempt
cannot reset an executor that has already started.

The lease is 90 seconds and attempt count is the fencing value. Stages check status,
attempt and deadline before execution and check the deadline again after the operation.
Equality is expired. A stale executor exits without changing the current job or publishing.
Lease expiry during publication rolls back its case evidence and review task. Recovery
claims increment attempts; three attempts is the hard bound. Terminal jobs clear leases.

Remote calls still hold case/consent locks, using the configured adapter timeout. Withdrawal
may wait for that bounded operation. Publication that committed before withdrawal acquired
the lock is disposed before withdrawal returns; no later stale publication is accepted.
This is application/transaction verification, not cancellation of an already transmitted
remote request. Real C2–C4 APIs need their own withdrawal, deletion and idempotency agreements.
Retries are immediate on a later worker poll; exponential backoff, jitter and operational
replay authorization remain future work. See the PostgreSQL harness and its limitations in
[evaluation evidence](../evidence/c1-lifecycle-evaluation.md).
