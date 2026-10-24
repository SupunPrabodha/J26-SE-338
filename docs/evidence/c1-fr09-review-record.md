# C1 FR09 review recording and session/withdrawal verification

Provenance update (2026-10-24): the previously uncommitted increment described below is now
in `2dee860`. [Current workspace verification](c1-workspace-verification.md) covers the improved
queue and saved-review reopening. Older results below remain historical execution evidence.

Date: **2026-10-23 (Asia/Colombo)**. Branch: `feature/c1-consent-orchestration`.
Starting tree was clean at `091281f`; earlier checklist/session work is already in that
commit. This increment remains uncommitted. No branch switch, reset, push or merge.

## Requirement and implementation boundary

Re-read IT23187450 section 5, pp27–28. FR09 requires human review status, interpretation
and follow-up without an autonomous clinical decision. Before this increment, only
START_REVIEW and COMPLETE_REVIEW were present. C1 now records a human-authored synthetic
interpretation and an allowlisted non-diagnostic follow-up category. It does not generate
advice, contact anyone, schedule follow-up or implement C4 explanation/dashboard research.
Screening support is counsellor-assisted and does not replace professional counselling.
Source requirements remain subject to approved stakeholder validation.

| Area | Files | Behaviour |
| --- | --- | --- |
| Central contracts | `packages/contracts/src/research_contracts/__init__.py`, generated JSON Schema/OpenAPI and `packages/typescript-common/src/contracts.d.ts` | New ReviewRecordRequest/CounsellorReviewRecord; optional demo save-receipt timestamp |
| Persistence | `packages/python-common/src/research_common/database.py`, `infrastructure/database/migrations/versions/f310c1000003_review_records.py` | One immutable record per task; additive table, existing rows preserved |
| Protected API | `services/orchestrator/main.py` | GET/POST record endpoint; existing assigned-counsellor/consent/case locks; role denial, validation and consistent replay |
| Disposal | `services/orchestrator/workflow.py`, `demo.py` | Delete record on withdrawal/retention; disposal confirmation also checks record absence; safe saved receipt only |
| Counsellor shell | `apps/counsellor-dashboard/app/page.tsx` | Bounded synthetic interpretation, category, save and protected retrieval; clear content after failed access/logout |
| Checklist | `apps/student-portal/components/checklist-rules.ts` | FR09.c live receipt, FR09.d capability, FR09.e recorded tests; no note/category exposure |
| Regressions | `tests/integration/test_review_records.py`, `tests/frontend/review-record.test.tsx`, updated `pp1-behaviour.test.tsx` | Role/state/replay/validation/policy/privacy and UI tests |
| Runtime verification | `scripts/postgres_checks.py`, `synthetic_runtime.py`, `compose_smoke.py`, `session_browser.mjs` | Actual PostgreSQL races, schema verification, Docker privacy/disposal and two-profile browser continuity |
| Documentation | README, API/database/audit/source-review docs, requirements audit and checklist evidence | Scope, policy, compatibility, commands and limitations |

### State, privacy and compatibility decisions

- First save only in UNDER_REVIEW; read while the task remains authorized and consent-valid.
  Missing record returns JSON null. Initial save before start or after completion returns 409.
- One record per task. Same actor and normalized content returns the existing record with
  either the original or another UUID key; changed actor/content returns 409. Concurrent
  requests serialize on the case, then consent. Replay rechecks current policy first.
- No edit/delete endpoint. Existing status actions remain compatible: legacy completion
  without a record is allowed and cannot be mistaken for a saved-record receipt. Existing
  completed tasks are not backfilled. Follow-up categories do not prove follow-up occurred.
- Interpretation starts with SYNTHETIC:, includes a nonblank observation, and is bounded to
  2,000 characters. This marker is a development input boundary, not anonymization or a
  guarantee that arbitrary text is non-identifying. Use fictional data only.
- Unassigned counsellors receive 404; student/admin/researcher roles receive 403. The record
  endpoint returns no actor identity or idempotency key. Task lists/details remain unchanged.
- HUMAN_REVIEW / RECORD_SAVED audit stores safe metadata only, never interpretation or category.
  Student demo returns only a timestamp receipt, including a historical receipt after disposal.
  A receipt does not prove clinical quality or current content availability.
- Withdrawal/retention deletes interpretation, category, actor FK and request key together.
  Consent expiry blocks read/write immediately; deletion follows withdrawal or the existing
  24-hour retention sweep. Minimal audit/status metadata remains under development policy.
- Only the new migration was added. Startup applied it to the preserved development volume.
  Downgrade destroys the new table; it was tested only in a unique disposable schema, never
  in the development schema. Database operators remain trusted; no encryption-at-rest claim.
- New API/models are additive. Demo consumers with strict response validators must regenerate
  for the optional receipt field. C2–C4 service contracts and authentication code are unchanged.

## Session continuity and withdrawal

The prior fix is present in the starting commit: namespaced proxy cookies, shared renewal,
cross-tab Web Locks, /auth/me renewal and one original-request retry. The retained October 22
317.017-second run is historical evidence, not a result of this run. Access lifetime remains
300 seconds; refresh 3,600 seconds; student owner and consent have a fixed one-hour deadline.
Refresh cannot extend consent. Staff refresh retains its existing rolling-hour policy.

Current-run baseline: **60 tests passed** across authentication/session, consent lifecycle,
withdrawal and demo evidence. They cover before-submission withdrawal, processed/reviewed
cases, repetition, cancellation, subsequent review denial and withdrawal after retention.
No additional defect was demonstrated in that existing workflow. New record disposal was
added so FR09 content obeys the same policy.

The new suite independently exercises saved-record withdrawal after completed review,
repeat withdrawal, retention, elapsed and exact-boundary consent expiry, rejected/pending/
invalid consent, wrong purpose/version and later read/replay denial. PostgreSQL tests
verify single-row/single-receipt saves and withdrawal versus replay under actual locks.

## Executed verification

| Check | Actual result |
| --- | --- |
| Baseline session/auth/consent/withdrawal/demo | 60 passed |
| Focused new record tests plus migration test | 26 passed |
| Full backend including security, contract and withdrawal | 164 passed; one existing Starlette/httpx deprecation warning |
| Frontend | 48 passed (six files), including three new FR09 tests |
| Frontend lint / TypeScript | Passed |
| Python / TypeScript contract drift | Passed |
| Affected Python Ruff check / format | Passed |
| PostgreSQL harness | 13 passed, including additive migration round trip and two record race checks |
| Development schema | `f310c1000003 (head)`; Alembic check reported no new upgrade operations |
| Docker | Orchestrator and both frontend images built; nine services healthy; Compose configuration valid |
| Docker smoke | Passed: workflow/idempotency/review, FR09 save/read/replay/receipt, content deletion, retention then repeat withdrawal, logout, frontend proxies and log privacy |
| Controlled browser access-cookie expiry | Passed in 6.895 seconds; this is not natural expiry evidence |
| Real-clock browser | Passed in **317.247 seconds** (5 minutes 17 seconds), including natural access expiry, FR09 save/read, safe student receipt, review completion, withdrawal/disposal and logout |
| Repository privacy/prohibited-file scan | Passed in UTF-8 mode |

The initial sandboxed frontend test run failed to start Vitest workers and ran no tests.
Rerunning with one worker outside that sandbox passed. Initial lint caught a missing browser
global declaration in the harness; using window.HTMLTextAreaElement fixed it and lint passed.
Automatic approval review initially blocked the PostgreSQL downgrade test until isolation
was verifiable. The harness now asserts actual current_schema() against its freshly created
UUID schema before any migrations and again immediately before downgrade. Alembic uses that
same cached engine; approval then succeeded and the checks passed. No shared-schema downgrade
was attempted. Existing test folders and permissions were preserved.

### Commands

Run from the repository root. Use fresh uniquely named basetemp paths on repeats.

```powershell
.venv/Scripts/python.exe scripts/run.py pytest tests/security/test_session_continuity.py tests/security/test_auth.py tests/integration/test_withdrawal.py tests/integration/test_consent_lifecycle.py tests/integration/test_demo_evidence.py -o addopts='' -q --basetemp=.local/pytest-fr09-baseline-20261023-a
.venv/Scripts/python.exe scripts/run.py pytest tests/integration/test_review_records.py tests/integration/test_lifecycle_migration.py -o addopts='' -q --basetemp=.local/pytest-fr09-records-20261023-a
.venv/Scripts/python.exe scripts/run.py pytest -o addopts='' -q --basetemp=.local/pytest-fr09-full-20261023-a
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
npm run contracts:types
npm test -- --maxWorkers=1
npm run lint
npm run typecheck
npm run contracts:check
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
.venv/Scripts/python.exe -m ruff check services/orchestrator packages/contracts/src packages/python-common/src tests/integration/test_review_records.py infrastructure/database/migrations/versions/f310c1000003_review_records.py scripts/postgres_checks.py scripts/synthetic_runtime.py scripts/compose_smoke.py
.venv/Scripts/python.exe -m ruff format --check services/orchestrator packages/contracts/src packages/python-common/src tests/integration/test_review_records.py infrastructure/database/migrations/versions/f310c1000003_review_records.py scripts/postgres_checks.py scripts/synthetic_runtime.py scripts/compose_smoke.py
docker compose build orchestrator student-portal counsellor-dashboard
docker compose up -d --no-build --wait --wait-timeout 180
docker compose config --quiet
docker compose exec -T orchestrator alembic check
docker compose exec -T orchestrator alembic current
.venv/Scripts/python.exe scripts/run_evaluation.py postgres
.venv/Scripts/python.exe scripts/compose_smoke.py
node scripts/session_browser.mjs --quick-expiry
node scripts/session_browser.mjs
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
git diff --check
```

Retain `.local/c1-postgres.json` (aggregate only) and the ignored browser reports/screenshots.
Controlled-expiry report: `.local/c1-session-browser-711687a2-3fe7-4b35-b60d-2bf03240ae6f/report.json`.
Real-clock report: `.local/c1-session-browser-856bb2a7-5d96-4377-9c09-031867a25b81/report.json`;
safe checklist screenshot: `session-after-refresh-review.png` in that directory. Separate
counsellor/student browser contexts and two student tabs were exercised; an additional
same-context counsellor login confirmed cookie selection isolation. The harness waited at
least 310 seconds without modifying production expiry settings. The report's
`expiry_wait_seconds=315.404` includes post-wait assertions, not idle waiting alone.
Observed student request: 401 AUTH_REQUIRED -> /auth/me 401 -> /auth/refresh 200 -> retry 200.
The second student tab recovered via /auth/me 200 without another rotation. Browser UTC was
2026-10-23T08:38:29.505Z; coarse HTTP Date was Fri, 23 Oct 2026 08:38:28 GMT (approximate
difference -1.502 seconds including transport/header precision). No five-minute clock
discrepancy was observed. The new controls were exercised after renewal; the earlier
five-minute failure was not reproduced in this run. Full-hour natural expiry was not awaited.
Never retain credentials, browser profiles or unrestricted logs in Git or shared evidence.

## Demonstration and remaining gaps

1. Keep the existing ignored .env and database volume. Start/rebuild with Docker Compose.
2. Student `/` and `/demo` share a browser profile; use a separate counsellor profile.
3. Create synthetic consent, submit a built-in fixture and select the current checklist run.
4. Counsellor opens the assigned task and starts human review. Enter a fictional observation
   beginning SYNTHETIC:, choose a follow-up category and save. Refresh tasks to retrieve it.
5. Complete review separately. Refresh the checklist: FR09.c shows only a saved receipt;
   capability and dated regression evidence remain separate. Then withdraw as student.
6. Refresh counsellor tasks to demonstrate revoked access; the checklist confirms disposal
   and retains only historical action receipts. Do not present these as clinical results.

Remaining work: approved operational policies/notice, real identity/TLS deployment, editing
or longitudinal follow-up if required after stakeholder validation, human task/usability
evaluation and C4 final dashboard research. Category recording does not implement messaging,
appointments, treatment or emergency intervention. Full-hour natural expiry and distributed
soak testing are not claimed. Modern Web Locks support remains required. Existing C3 lint
findings are outside this increment; affected C1 checks are the scope of this verification.

Suggested reviewable commit groups (not created):

1. `feat(c1): record protected counsellor interpretation and follow-up` — contracts, migration,
   backend/disposal, regression tests and PostgreSQL/smoke checks.
2. `feat(c1): expose review recording and safe checklist receipts` — existing shell, checklist,
   frontend tests and browser verification.
3. `docs(c1): record FR09 session and withdrawal verification` — source/requirement mapping,
   API/policy documentation and this actual evidence.
