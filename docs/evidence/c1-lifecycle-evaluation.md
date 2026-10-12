# C1 lifecycle, audit, reliability and proxy evaluation

Date: 2026-10-08, Asia/Colombo. Branch: `feature/c1-consent-orchestration`.
This historical increment was developed from `112efa0` and is now committed as `c5a433b`
(`feat: Add synthetic trace evaluation and PostgreSQL race checks`). Earlier withdrawal
and recovery fixes are in `1be25b3` and `112efa0`. The verification below belongs to that
increment; it is not a new run of the later UI work. See the
[PP1 readiness report](c1-pp1-readiness.md) for the subsequent audit and UI verification.
Only fixed synthetic fixtures and existing C2–C4 mocks are used.
This is non-diagnostic screening support, interpreted by authorized counsellors. It does
not replace professional counselling or authorize autonomous intervention.

## Stage status and requirement traceability

| Stage / source | Implementation | Verification and bounded conclusion |
|---|---|---|
| 1: FR-01/02/10, NFR-03 | Owner withdrawal before submission; shared case withdrawal after submission; separate lifecycle response, receipts and disposal reason | `test_consent_lifecycle.py`, existing `test_withdrawal.py`, `test_submission_recovery.py`, workflow/security tests, PostgreSQL submit/withdraw race. Missing/non-active/expired/exact-boundary/purpose/version/foreign gates remain denied. Queued/processing/review withdrawal is exercised. |
| 2: FR-01/10, NFR-10 | Versioned voluntary notice; accept/reject, confirmation, pre/post withdrawal, separate consent/processing/disposal status; stable retry key | `tests/frontend/consent-lifecycle.test.tsx` and `shells.test.tsx`: nine frontend tests. Retention does not disable first explicit withdrawal. No browser storage introduced. No C4 redesign or usability-study claim. |
| 3: FR-05/08/11, NFR-01/04 | Expanded internal audit model, bounded receipts, rollback-safe blocked events, expiry deadline vs detection time, synthetic C2/C3/C4 provenance | `test_audit_traces.py`, append-only tests and `evaluate_traces.py`: 29/29 observations, 27/27 critical, no missing tuples, prohibited-content check and case trace links passed. This is the fixed catalogue, not all C1 scenarios. |
| 4: FR-06/07/10, NFR-06 | Case-first claims; LIMIT 1; attempt/lease fencing before/after stages; duplicate executor cannot reset active work; exhausted leases cleared | Nine PostgreSQL checks in `postgres_checks.py`, bounded timeouts and failure regressions. No duplicate review task or publication surviving completed withdrawal in these scenarios. |
| 5: NFR-07 proposal p28 | Reproducible PostgreSQL core timing harness with measured mock time subtracted | Retained 200-sample run described below. Narrower boundary than the proposal; does not establish full architecture performance compliance. |

Authority: finalized TAF pp7–8 > supplied Master Research Context C1 section 6.1 and privacy
boundaries > IT23187450 proposal pp27–28. The available master filename has suffix `(1)`.
Sources were read locally and not copied into Git. Requirements and targets are proposed;
no participant/stakeholder evaluation, approved notice, ethics clearance or completion
percentage is inferred. See [source review](../governance/source-review.md).

## Files and compatibility

| Files | Reason |
|---|---|
| `services/orchestrator/main.py`, `workflow.py`, `auth.py` | Lifecycle endpoints, guards/audit calls, provenance, case-first claiming and fencing; refresh/revocation/logout events |
| `packages/python-common/src/research_common/database.py`, new `audit.py` | Receipt/provenance/audit fields and bounded append-only writes, durable pending-event handling |
| `infrastructure/database/migrations/versions/f310c1000001_consent_lifecycle.py`, `f310c1000002_audit_provenance.py` | Additive persisted state; no merged migration edited |
| `packages/contracts/src/research_contracts/__init__.py` | New ConsentLifecycle, LifecycleAuditEvent and ServiceProvenance models |
| Three matching new files under `packages/contracts/json-schema/v1/`, `packages/contracts/openapi/orchestrator.v1.json`, `packages/typescript-common/src/contracts.d.ts` | Generated schema, endpoint documentation and consumers |
| `apps/student-portal/app/page.tsx` | Minimal student consent/disposal UI; counsellor shell unchanged |
| `tests/integration/test_consent_lifecycle.py`, `test_audit_traces.py`, `test_lifecycle_migration.py`; updated `test_submission_recovery.py`; `tests/frontend/consent-lifecycle.test.tsx` | New lifecycle, audit, migration and UI regression evidence; recovery now expects one bounded successful replay event while domain row counts stay fixed |
| `scripts/evaluate_traces.py`, `postgres_checks.py`, `c1_performance.py`, `synthetic_runtime.py`, `run_evaluation.py` | Reproducible scenario evaluation, isolated PostgreSQL schema, fixed providers, aggregate-only report runner |
| `readme.md`, `docs/api/contracts.md`, `docs/architecture/{consent-states,database,workflow-states}.md`, `docs/governance/source-review.md`, `docs/security/audit-catalogue.md`, this note | Scope, compatibility, lifecycle/locking decisions, event triggers, results, handoff and limitations |

All 25 pre-existing JSON schemas and the three mock OpenAPI documents were compared as
UTF-8 JSON against HEAD and are unchanged. The original AuditEvent, ConsentRecord,
PseudonymousCase and C2–C4 request/response contracts stay intact. New owner-only endpoints
reuse WithdrawalRequest and return ConsentLifecycle. Services import central Python models;
there are no service-local contract copies. See [contract impacts](../api/contracts.md).

The migration chain is `e2985e1a1001 → f310c1000001 → f310c1000002`. Existing disposal rows
become LEGACY_DISPOSAL; their cause is not guessed. New provenance/trace/deadline fields are
nullable for existing rows. Append-only audit rows are never backfilled. The temporary
disposal-reason backfill default is removed after migration; application writes provide
the actual cause. Empty upgrade, downgrade/base/upgrade, metadata and preserved-row upgrade
checks passed in disposable SQLite databases. PostgreSQL isolated-schema upgrade/schema
checks and the preserved development schema check passed. No downgrade/reset was run on
the development volume. A downgrade would discard new receipt/metadata fields; use only
on disposable data. Owners must review the additions before integration.

## Verification provenance

Before interruption, the recorded stage runs were 106 backend tests, nine frontend tests,
45 focused audit/recovery/unit tests, nine PostgreSQL checks, and later 118 backend tests.
The previous audit report had 29/29 and 27/27, but predated the final trace-link assertion.
These historical runs are not presented as newly executed checks.

The continuation newly executed:

| Check | Actual result |
|---|---|
| Full backend/security/contract suite | **118 passed**, 37.92 s; one existing Starlette/httpx deprecation warning |
| Frontend tests | **9 passed**, two files |
| Python lint/format; frontend lint/types | Passed after correcting interrupted mixed-line-ending formatting in three files |
| Python artifact drift, TypeScript drift, published-schema compatibility | Passed; 25 published schemas and three mock APIs unchanged |
| Repository secret/prohibited-file and frontend privacy scan | Passed |
| CI structure checker | Passed; hosted GitHub Actions not run |
| Bootstrap, Compose validation and image builds | Existing `.env` preserved; configuration valid; API/student production images built |
| Runtime | All nine services healthy after startup |
| PostgreSQL harness | **9 passed**, aggregate report refreshed; isolated schema removed, dev tables/volume preserved |
| Development schema | `alembic check`: no new operations; `alembic current`: `f310c1000002 (head)` |
| Docker smoke | PASS: C1–C4 synthetic workflow, concurrent idempotency, assigned review/human actions, retention then concurrent withdrawal, one receipt/event, access revocation/logout, both frontend HTTP/proxies, log privacy |
| Audit evaluator | **29/29 overall, 27/27 critical**, missing list empty; prohibited content absent and case trace links consistent |
| Final diff / ignored files | `git diff --check` passed; index empty; `.env` and all three aggregate reports confirmed ignored |
| Shutdown | `docker compose down` completed; no Compose services left running; `j26-se-338-dev_postgres-data` still exists |

The PostgreSQL harness exercises parallel claims, interrupted lease recovery/stale attempts,
duplicate execution, expiry exactly at final publication, withdrawal at PREPROCESSING and
READY_FOR_REVIEW, exhausted interrupted jobs, bounded timeout retries, and concurrent
submission/withdrawal. Barriers/events and observed database lock waits synchronize key races.
It simulates worker interruption by abandoning/expiring a claim, not by killing an OS process.
The submission race checks the permitted outcome; it does not prove every scheduler ordering.
Auth transport remains covered separately by security tests and the Docker smoke.

Reproduction from repository root (PowerShell; each command must succeed before continuing):

```powershell
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
$env:NEXT_TELEMETRY_DISABLED = '1'
.\.venv\Scripts\ruff.exe check .
.\.venv\Scripts\ruff.exe format --check .
$testTemp = Join-Path (Get-Location) ('.local/pytest-c1-' + [guid]::NewGuid().ToString('N'))
$env:C1_AUDIT_REPORT = '.local/c1-audit-final.json'
.\.venv\Scripts\python.exe scripts/run.py pytest --basetemp $testTemp --tb=short --show-capture=no
.\.venv\Scripts\python.exe scripts/run.py scripts.generate_contracts --check
.\.venv\Scripts\python.exe scripts/check_repository.py
.\.venv\Scripts\python.exe scripts/check_ci.py
npm test
npm run lint
npm run typecheck
npm run contracts:check
docker compose config --quiet
docker compose build orchestrator student-portal
docker compose up -d --no-build --wait --wait-timeout 180
.\.venv\Scripts\python.exe scripts/run_evaluation.py postgres
docker compose exec -T orchestrator alembic check
docker compose exec -T orchestrator alembic current
.\.venv\Scripts\python.exe scripts/compose_smoke.py
git diff --check
docker compose down
```

The PATH line uses this workspace's existing ignored Node 22.23.3 installation; omit it
when a compatible Node 22.22.2+ is already on PATH. Do not delete existing pytest folders.
The PostgreSQL runner mounts only `scripts/` read-only into a disposable local container,
creates a UUID-named evaluation schema, and removes only that schema afterward. It never
prints connection URLs, credentials or case payloads. Failure diagnostics are bounded to
error type/code location. `.local` reports and test databases remain ignored.

## Retained performance evidence — not rerun in the continuation

Report: `.local/c1-performance.json`, measured `2026-10-07T19:33:21.589801+00:00`
(2026-10-08 01:03:21 Asia/Colombo). It was inspected and preserved; the continuation did
not repeat an expensive measurement solely to reproduce it. It predates final audit-link/
logout refinements, so it is historical proxy evidence, not a fresh timing of every final byte.

| Setting / result | Retained value |
|---|---|
| Fixture | `english`, `synthetic-fixtures-1` |
| Warm-up / measured / concurrency | 20 / 200 / 4 |
| Success / errors | 200 / 0 (0% error rate) |
| C1 core p50 / p95 / p99 | 229.262 / 383.257 / 516.522 ms |
| Intake p50 / p95 / p99 | 37.656 / 56.275 / 322.983 ms |
| Worker excluding mock p50 / p95 / p99 | 192.992 / 318.265 / 441.998 ms |
| Observed batch throughput | 16.131 successful workflows/s |
| Combined measured phase wall time | 12.398845 s |
| Percentiles | Nearest rank |

Environment: Linux x86_64 under Docker Desktop/WSL2 `6.6.87.2-microsoft-standard-WSL2`,
Python 3.12.15, PostgreSQL 17.11, SQLAlchemy 2.1.3, FastAPI 0.142.2, Pydantic 2.13.5,
psycopg 3.3.6. The container saw 16 logical CPUs; `cpu.max` was `max 100000` and
`memory.max` was `max`. Those values do not establish unrestricted physical resources.
CPU model, physical RAM allocation and exclusive hardware use were not measured.
The retained run overlapped local verification; resource contention was not controlled.

Per-case latency sums validated submission-handler time through commit/response construction
and claim/process_job time through final commit, subtracting timed in-process mock endpoint
execution. Intake and worker batches execute separately. Claim polling is included; queue
wait between phases is excluded. Throughput divides successful workflows by the sum of the
two batch wall times; it includes mock execution and excludes setup/migrations/verification.
This is not wall-clock end-to-end latency and not an HTTP throughput measurement.

Proposal p28 NFR-07 provisionally says p95 C1 overhead below 500 ms excluding AI inference.
The retained proxy p95 is numerically below 500 ms, while p99 is above it. The proposal does
not authorize excluding JWT/CSRF/session work, HTTP transport, browser or queue costs, all
excluded here. Therefore this comparison does **not** demonstrate the broader target.
No real C2–C4 inference/network behavior, realistic load mix, sustained soak, repeated-run
uncertainty or participant performance evaluation is claimed.

Initial harness failures were preserved in the interrupted tool record: a report-parser
failure from Alembic stdout was corrected, and a later KeyError exposed an undrained warm-up
when SKIP LOCKED temporarily yielded no job. The runner now isolates migration output,
requires successful warm-up and polls claims with a five-second bound, including that wait
in timing. Failed runs were not accepted as measurements. The earlier diagnostic 214.641 ms
p95 is not substituted for the retained run. Optional future reproduction:

```powershell
.\.venv\Scripts\python.exe scripts/run_evaluation.py performance --samples 200 --warmup 20 --concurrency 4
```

Run only with the stack available; the command replaces the aggregate local report.

## Startup and synthetic PP1 demonstration

Python 3.12, compatible Node 22, npm and Docker Desktop with Linux containers are required.
In the current workspace, these exact PowerShell startup commands are supported:

```powershell
Set-Location 'F:\Reserch\J26-SE-338'
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
.\scripts\bootstrap-dev.ps1
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
```

Student: **http://localhost:3000**. Counsellor: **http://localhost:3001**.
API development docs: **http://localhost:8000/docs**. Bindings are loopback-only; there
are no host-exposed PostgreSQL/Redis/C2–C4 ports. Bootstrap generates a new ignored `.env`
only when absent and preserves an existing one. Startup migrates and seeds missing staff
accounts from `DEV_COUNSELLOR_USERNAME` / `DEV_COUNSELLOR_PASSWORD` (and admin equivalents).
Read those fields privately in the editor; never print, screenshot or publish them. Do
not invent a default username/password. Existing seeded accounts are not overwritten by
changing `.env`; arbitrary regeneration can break the preserved-volume configuration.
Use separate browser profiles for student and counsellor because localhost cookies are shared.

1. Show the synthetic/non-diagnostic notice and human-review boundary. The system does not
   replace professional counselling. Reject a decision and show submission remains disabled.
2. In a fresh student page/session, accept the versioned notice, withdraw before submission,
   confirm, and show explicit withdrawal with no case and disabled submission.
3. In another fresh student session, accept and submit a built-in fixed fixture. Refresh until
   READY_FOR_REVIEW. Do not paste participant text or show credentials in the demo.
4. In the separate counsellor profile, sign in using privately viewed development credentials,
   refresh assigned tasks, start review, and complete review. Explain the displayed evidence
   comes from fixed mocks and requires authorized human interpretation.
5. Return to the student page, withdraw with confirmation, and refresh counsellor tasks to show
   access revocation. For retention-before-withdrawal, show the automated smoke/evidence result;
   the UI does not provide a retention-clock control and normal retention is 24 hours.
6. Show aggregate audit/reliability reports and the performance boundary/limitations. Stop with
   `docker compose down` (never `-v`). Browser refresh loses in-memory owner references;
   there is no recovery identity flow in this task.

For safe failed-job inspection, use the existing local container tooling with an allowlisted
aggregate query, without inspecting fixture text, account/linkage tables or credentials:

```powershell
docker compose exec -T orchestrator python -c "import json; from sqlalchemy import select,func; from sqlalchemy.orm import Session; from research_common.database import engine,Job; db=Session(engine()); print(json.dumps([dict(status=s,attempts=a,count=n) for s,a,n in db.execute(select(Job.status,Job.attempts,func.count()).group_by(Job.status,Job.attempts))])); db.close()"
```

Investigation/replay remains operator-controlled. Do not manually reset state to bypass
consent; use a new authorized synthetic consent/case where appropriate. No admin dashboard
or automated dead-letter replay was added.

## Remaining work and suggested review groups

Remaining: institutional identity/TLS/deployment hardening; owner-access recovery design;
approved participant notice/retention and deletion of identity/audit metadata; real C2–C4
version contracts, downstream cancellation/deletion and idempotency; audit access policy,
all denial variants, event ordering and delivery monitoring; retry backoff/jitter and safe
operator replay; real process-kill/soak and distributed fault tests; full-boundary repeated
performance runs; architecture/ATAM, deployability, human-task and stakeholder evaluation.
FR-09 interpretation/follow-up and FR-12 operational UI remain incomplete. C4 owns the final
dashboard research. No live usability/browser automation, hosted CI, dependency audit or
institutional deployment rehearsal was newly run in this continuation.

Suggested logical commits, for user review only (none created):

1. `feat(c1): support pre-submission consent withdrawal` — lifecycle API/receipt migration,
   new response, generated consumers, minimal portal and regression tests.
2. `feat(c1): record bounded audit traces and synthetic provenance` — audit/provenance
   migration/models, policy/session events, evaluator and catalogue.
3. `fix(c1): fence worker publication and order job locks consistently` — claiming/fencing
   changes and PostgreSQL concurrency harness.
4. `test(c1): document synthetic performance and PP1 evidence` — performance runner,
   source mapping, retained aggregate summary, reproduction and demo guidance.

Shared files span groups; review and stage individual hunks rather than assuming automatic
file-level separation. Passing checks do not establish complete C1 research implementation.
