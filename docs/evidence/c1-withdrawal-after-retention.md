# C1 step 1: record owner withdrawal after retention

Date: 2026-10-07 (Asia/Colombo). Branch: `feature/c1-consent-orchestration`.
Baseline: `d5699d326bb14785df48b3610c97f65d72708a03`. Changes are left uncommitted for review.

## Objective and source traceability

Ensure an authenticated case owner's explicit withdrawal updates consent and records minimal evidence even when retention has already disposed of the case. Preserve case authorization, idempotency and denial of further processing/review.

Sources reviewed from the supplied local documents: finalized TAF pp7–8 (C1 consent, orchestration, audit and retention ownership), Master Research Context section 6.1 and privacy/ethical boundaries, and C1 proposal IT23187450 p23 (withdrawal and minimal proof), p27 FR-02/FR-10/FR-11 (consent gates, withdrawal propagation and audit). These support the scope; receipt-based idempotency is an implementation decision. No source documents are copied into Git and no ethics approval or participant validation is claimed.

## Files and implementation

| Exact file | Change |
|---|---|
| `services/orchestrator/main.py` | Check the existing withdrawal receipt under the case lock, rather than using case WITHDRAWN status as proof of an owner decision. Lock linked consent, set it WITHDRAWN, call idempotent disposal and atomically persist the first receipt/audit event. |
| `tests/integration/test_withdrawal.py` | Four combinations of active/elapsed consent and retention-before/after withdrawal; same-key and new-key repeats; single receipt/audit/disposal; cancelled job and resubmission denial. |
| `scripts/compose_smoke.py` | Complete a synthetic workflow, expire that case, run retention, then send concurrent withdrawals against PostgreSQL. Check consent, identical receipts, one withdrawal/retention record and one audit event of each type, revoked review access and blocked resubmission. |
| `docs/architecture/consent-states.md` | Document explicit withdrawal after disposal or consent expiry and the authentication/idempotency rules. |
| `docs/evidence/c1-withdrawal-after-retention.md` | Scope, commands, expected and actual results, limitations and handoff. |

Before the fix, the new regression suite produced **2 failed, 2 passed**: retained cases returned HTTP 200 but consent remained ACTIVE or effectively EXPIRED. After the fix, all four pass. Requests repeated with either the first key or a new key return the same case receipt; the first key is retained and events are not duplicated.

No wire-contract, migration, C2–C4 mock or frontend implementation changes are required. No new log fields or consent contents are emitted. The workflow's existing WITHDRAWN state still covers disposed cases; a withdrawal receipt identifies an explicit owner decision.

## Commands and expected/observed results

Run from the repository root in PowerShell. The local Node PATH below uses the existing ignored Node 22.23.3 installation; an already compatible Node 22 installation also works.

```powershell
.\.venv\Scripts\ruff.exe check .
.\.venv\Scripts\ruff.exe format --check .
.\.venv\Scripts\python.exe scripts/run.py pytest tests/integration/test_withdrawal.py
.\.venv\Scripts\python.exe scripts/run.py pytest
.\.venv\Scripts\python.exe scripts/run.py scripts.generate_contracts --check
.\.venv\Scripts\python.exe scripts/check_repository.py
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
$env:NEXT_TELEMETRY_DISABLED = '1'
npm run lint
npm run typecheck
npm test
npm run contracts:check
docker compose config --quiet
docker compose build orchestrator
docker compose up -d --no-build --wait --wait-timeout 180
.\.venv\Scripts\python.exe scripts/compose_smoke.py
docker compose down
git diff --check
```

| Check | Expected output / observed result |
|---|---|
| Focused regression | 4 passed; observed after fix |
| Full Python suite | 65 passed; observed in 27.17 seconds, including existing contract, security, migration and workflow tests |
| Ruff | All checks passed; 102 files already formatted |
| Python and TypeScript contract drift | Exit 0, artifacts unchanged |
| Frontend lint/typecheck | Exit 0; both apps typechecked |
| Frontend tests | 5 passed |
| Repository privacy/prohibited-file scan | Passed |
| Compose config/build/start | Exit 0; all nine services healthy |
| Container smoke | JSON result PASS, including retention before concurrent owner withdrawals and single withdrawal receipt/audit event |
| Diff whitespace check | Exit 0 |

The full Python suite emits one pre-existing Starlette TestClient/httpx deprecation warning. No warning was suppressed. The smoke test prints only check names/results; expanded Compose configuration, payloads and credentials must not be retained as evidence.

## Evidence, limits and handoff

Retain this note, the code/test diff, aggregate test counts and the smoke PASS check list. The regression uses controlled synthetic expiry timestamps so the owner session is still valid. Default evidence retention (24 hours) exceeds the student session lifetime (one hour); recovery after account/session expiry is a separate future task. These tests do not establish participant retention policy or clinical/research performance.

SQLite tests verify sequential behavior; the PostgreSQL smoke verifies two concurrent requests in the retained-case scenario. This is not exhaustive concurrency or load evaluation. Hosted CI, full browser automation, UAT and participant evaluation were not run. C2–C4 remain development-only mocks; all outputs remain non-diagnostic, counsellor-assisted screening support.

Proposed commit message after review: `fix(c1): record withdrawal after retention cleanup`.
No commit, push or merge is performed in this step. Stop here for the owner's verification.

