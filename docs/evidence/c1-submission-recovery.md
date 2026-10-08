# C1: consent validation during submission conflict recovery

Date: 2026-10-08 (Asia/Colombo). Branch: `feature/c1-consent-orchestration`.
Baseline: `1be25b3ea335b1284483fc977f30b9262d1e2364`. This change is uncommitted for review.

## Finding, implementation and traceability

The ordinary duplicate paths in `services/orchestrator/main.py::submit` called `check_case_consent`. The matching-request path after `IntegrityError` rolled back and checked ownership but returned without revalidating consent. Recovery now uses the same helper after `own_case`, preserving case-before-consent locking. No shared contracts, migrations or C2–C4 internals change.

Source mapping: finalized TAF pp7–8 and Master Research Context section 6.1 establish C1 consent/security orchestration ownership; C1 proposal IT23187450 p27 FR-02 and FR-06, and p28 NFR-03 cover consent rejection, safe idempotent recovery and consent integrity. This is a bounded follow-up to the requirements assessment, not a claim that all consent lifecycle requirements are complete.

Files changed: `services/orchestrator/main.py`, `tests/integration/test_submission_recovery.py`, `docs/architecture/consent-states.md`, this evidence note, and `docs/evidence/c1-withdrawal-after-retention.md`. The latter now identifies the existing withdrawal commit rather than describing its changes as uncommitted.

## Regression method and results

The focused tests hide exactly the two preflight duplicate lookups so the database attempts a duplicate insertion and raises a real uniqueness `IntegrityError`. They assert that the exception and rollback actually occurred. Policy changes happen after rollback, before recovery. Production consent and ownership guards are not stubbed.

Fourteen scenarios run through both ordinary duplicate and forced-recovery paths: valid, missing consent, five non-ACTIVE states, elapsed expiry, expiry equality, wrong purpose, wrong version, disposed/disposal-requested cases and case expiry. Additional cases cover an existing reviewable case, changed-payload conflicts on both paths, a foreign link at recovery and a foreign consent at intake.

Tests assert no additional case, link, job, review or audit rows; matching requests return the existing case. Invalid consent returns 403, changed fingerprints remain 409, foreign consent is 404 and an account-scoped recovery lookup cannot return a foreign link (409). Responses and captured application logs are checked for fixture text, token/signing values and identity-linkage values without printing those values.

Before the fix: **14 failed, 19 passed**. Thirteen unsafe recovery scenarios returned 202; the valid recovery test also failed because the consent lock/query was absent.
After the fix: **33 passed** in 6.72 seconds.
Full backend suite: **98 passed** in 26.08 seconds, including security, contracts, migrations, adapters and withdrawal.
One pre-existing Starlette TestClient/httpx deprecation warning remains.

## Exact verification commands

PowerShell from the repository root; each pytest run uses a new GUID path. No existing temporary directory was deleted and no system permissions were changed.

```powershell
$recoveryTemp = Join-Path (Get-Location) ('.local/pytest-recovery-after-' + [guid]::NewGuid().ToString('N'))
.\.venv\Scripts\python.exe scripts/run.py pytest tests/integration/test_submission_recovery.py --basetemp $recoveryTemp --tb=short
.\.venv\Scripts\ruff.exe check .
.\.venv\Scripts\ruff.exe format --check .
$recoveryTemp = Join-Path (Get-Location) ('.local/pytest-recovery-full-' + [guid]::NewGuid().ToString('N'))
.\.venv\Scripts\python.exe scripts/run.py pytest --basetemp $recoveryTemp
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
docker compose exec -T orchestrator alembic check
docker compose down
docker compose ps
docker volume ls --filter name=j26-se-338-dev_postgres-data
git diff --check
```

Ruff lint/format, frontend lint/typechecks, both contract drift checks, repository scan and diff checks passed. Frontend tests: **5 passed**. Compose config/build/start passed; all nine containers were healthy. PostgreSQL schema check: no new upgrade operations. Container smoke: **PASS**, including concurrent submission idempotency, full C1–C4 mock workflow, assigned review, concurrent withdrawal after retention, audit counts, logout, frontend proxies and container-log privacy. Containers were stopped afterward and the development database volume was preserved.

## Limits and evidence to retain

Retain this note, the code/test diff, aggregate results and the smoke PASS check list. Do not retain expanded configuration, credentials, payload dumps or unredacted logs.

The focused harness is fault injection over SQLite, not a reproduction of a naturally occurring PostgreSQL race. Its missing-consent case simulates a lookup miss because normal foreign keys prevent deletion of a referenced consent. The foreign-link scenario is controlled test state, not a supported ownership-transfer operation. SQL lock ordering is asserted in the harness; actual concurrent duplicate/withdrawal behavior is covered by the existing PostgreSQL smoke, which does not deliberately force the IntegrityError branch. No claim of exhaustive concurrency, load testing, hosted CI or participant evaluation is made.

All fixtures and services remain synthetic and development-only; outputs remain non-diagnostic screening support requiring authorized human interpretation. Existing session-expiry recovery and wider consent-lifecycle gaps remain outside this change.

Suggested commit message: `fix(c1): revalidate consent during submission recovery`.
No commit, push or merge was performed.

