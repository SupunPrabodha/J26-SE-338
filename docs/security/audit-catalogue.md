# C1 audit catalogue and reconstruction

Source: C1 proposal FR-05/06/07/08/09/10/11 and NFR-01/03/04/06; TAF C1 audit and architecture
evaluation ownership. The executable evaluator is `scripts/evaluate_traces.py`; actual
scenario execution is `tests/integration/test_audit_traces.py`.

| Event | Required trigger | Duplicate policy | Requirement |
|---|---|---|---|
| AUTH_LOGIN / AUTH_FAILURE | Student session creation or staff login; failed staff login/unknown refresh | Per attempt; existing endpoint rate limit applies | FR-08, NFR-02 |
| AUTH_REFRESH | Successful refresh rotation | Once per consumed refresh credential | FR-08 |
| SESSION_REVOKED | Reuse/expiry/invalid-account refresh revokes family | Once per family | FR-08 |
| AUTH_LOGOUT | A known refresh family is signed out | Once per family; no event for absent cookie | FR-08 |
| CONSENT_RECORDED | Accepted or rejected decision committed | Once per created consent record | FR-01/11 |
| CONSENT_EXPIRED | A processing/submission/review gate first detects elapsed consent or EXPIRED state | Once per consent | FR-02, NFR-03 |
| OPERATION_BLOCKED | Consent gate denies an operation or a disposed/expired case | Once per consent/state/operation, or disposed case/operation; missing record once per request/case and operation | FR-02/11 |
| SUBMISSION | New case and job committed | Once per created case | FR-03/06 |
| SUBMISSION_REPLAY | Matching authorized duplicate, concurrent match or IntegrityError recovery | First successful replay per case; status records that first path | FR-06 |
| WORKFLOW_TRANSITION | A valid state transition commits | Each real transition; retries can repeat states | FR-06/07/11 |
| JOB_CLAIM | Queued claim or expired lease recovered | Once per attempt, at most three | FR-06 |
| JOB_RETRY / JOB_TERMINAL | A worker failure requeues or permanently fails; exhausted interrupted lease | At most two retries, one terminal receipt per terminalization | FR-06, NFR-06 |
| ASSIGNMENT | Automatic designated assignment or new administrator grant | Once per inserted assignment | FR-07/08 |
| HUMAN_REVIEW | Authorized START_REVIEW or COMPLETE_REVIEW | Existing action idempotency key | FR-09 |
| WITHDRAWAL | Explicit owner withdrawal before/after submission, including after retention | One receipt/event per consent or linked case; repeats are no-ops | FR-10 |
| RETENTION | Derived evidence disposed by retention or withdrawal | One disposal receipt/event per case | FR-10/11 |

The policy deadline is `policy_expires_at`; `created_at` is when the guard detected expiry.
They must not be described as the same instant. A status read computes expiry but does not
create a policy enforcement receipt. Disposal may short-circuit the consent guard, producing
a blocked-disposal event rather than an expiry event. Pending receipts survive request
rollback through the shared session dependency. Worker failure handling recreates the
policy check in its committed failure transaction. If the audit database is unavailable,
durability cannot be promised; operational alerting remains required.

Event payloads contain allowlisted codes, opaque case/correlation/trace references and
timestamps, never text, identity mappings, consent content, credentials or review notes.
Trace IDs are UUIDv5-derived from random consent IDs and support restricted internal joins;
they are linkable pseudonymous metadata, not anonymous public analytics. Existing rows are
not backfilled. Case-derived provenance records actual mock versions, is labelled synthetic,
and is erased with derived evidence. Minimal audit/review receipts remain under the current
development policy. Institutional retention approval is outstanding.

Append-only database triggers reject application UPDATE/DELETE. Deterministic event IDs
use INSERT-on-conflict-do-nothing; no existing receipt is edited. A database administrator
can change the schema/triggers. This is not administrator-proof or cryptographic tamper resistance.

## Evaluated denominator

Each `(scenario, event, status)` tuple in CATALOGUE is one required observation. Repetition
does not increase the numerator. There are 29 observations, 27 marked critical:

| Scenario | Required | Critical |
|---|---:|---:|
| Explicit IntegrityError recovery | 1 | 1 |
| Success, duplicate, processing, assignment, human actions, withdrawal | 15 | 13 |
| Rejection | 1 | 1 |
| Pre-submission withdrawal and blocked submission | 2 | 2 |
| Expiry detection and blocked submission | 2 | 2 |
| Timeout retry and terminal failure | 2 | 2 |
| Interrupted attempt exhaustion | 1 | 1 |
| Session creation, rotation, family revocation, logout | 4 | 4 |
| Retention disposal | 1 | 1 |

The evaluator reports overall and critical observed/required ratios, missing tuples, stable
case trace links and prohibited-content checks. A negative test removes required events
and injects a prohibited field to ensure incomplete/unsafe evidence is rejected.
This is scenario-limited presence/link reconstruction, not proof of every possible event
ordering, every denied RBAC request, login failure variant or deployment-wide audit delivery.
Recovery tests separately assert case-before-consent locks and durable domain-row uniqueness.
Per-request authentication/CSRF/RBAC-denial audit coverage, broader event order validation,
log transport/alerting and production audit access policy remain follow-up work.
