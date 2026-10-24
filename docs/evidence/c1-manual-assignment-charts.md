# Manual C1 assignment and safe operational charts — 2026-10-24

Branch `feature/c1-consent-orchestration`, HEAD `2dee860`. Earlier uncommitted role/workspace
work and unrelated C3 results are preserved. Nothing was staged, committed, pushed, merged,
reset or switched. Existing development records/volumes and merged migrations are preserved.
Only disposable synthetic fixtures are used. This is non-diagnostic screening support with
counsellor-assisted human interpretation; it does not replace professional counselling.

## Actual policy and connected processing gates

The prior increment already supplied exclusive assignment/reassignment, staff management,
separate role cookies, an immutable saved-review workflow and protected admin pages. Those
features are reused. Normal Compose and Settings still default to `DESIGNATED_DEVELOPMENT`:
after successful processing, the usable designated development counsellor receives a grant.
No unrestricted shared review queue existed. Consent acceptance never granted access.

The new **explicit manual-demo override** is `docker-compose.demo.yml`. It sets
`ASSIGNMENT_POLICY=MANUAL` for both orchestrator and worker. The current verified stack uses
that override: new processed cases await admin assignment. Existing grants are not modified.
The ignored `.env` and its credentials are unchanged. Starting with normal Compose later
restores its configured default for new tasks; it does not reassign stored cases.

| Step | Exact implementation and persisted effect |
| --- | --- |
| Consent decision | `services/orchestrator/main.py:record_consent` creates Consent only; no Case, Job or Review |
| Fixture submission | `main.py:submit` validates the built-in text, ownership, matching active consent and idempotency; creates Case, CaseLink and Job |
| C2 → C3 → C4 | `workflow.py:process_job` / `stage` and `call_service`; request context and authoritative response models are validated before publication |
| Review readiness | `process_job`'s `finish` stores permitted provider results/provenance and creates Review only after the three stages succeed |
| Assignment | `administration.py:allocation_case`, `assign_case`, `assignment_version`, `lock_staff`; existing Assignment rows, case/consent/staff lock ordering and safe audit receipts |
| Protected review | `main.py:authorized_review` checks role, current assignment, consent/retention and fresh account/session; existing record/action APIs persist human choices |
| Owner receipt | `demo.py:evidence` checks the actual Assignment row, task, supported state, valid consent and validated provenance; FR07 remains unverified while awaiting assignment |

Only eligible unexpired, consent-valid cases in READY_FOR_REVIEW, UNDER_REVIEW or COMPLETED
with a persisted Review can be assigned. Exclusive replacement deletes old grants and grants
one usable counsellor; clearing returns the case to awaiting assignment. Matching retries
are no-ops after guards; a stale different assignment digest returns 409. Reassignment
revokes old counsellor requests immediately on the server. UI snapshots clear on the next
refresh/denial; no instantaneous push update is claimed.

In-progress and completed cases can be reassigned for continuity/read access. Their review
state, action authors and immutable record author/content do not change. The new counsellor
may continue an incomplete review or read a completed record while authorized; they cannot
overwrite the saved record. Reassignment does not restart processing or claim follow-up was
performed. Withdrawal/disposal denies assignment/review and removes derived review contents.

## Roles, pages and ownership

| Role | Permitted | Excluded |
| --- | --- | --- |
| Student | Own consent, submission, lifecycle, withdrawal and owner checklist | Staff/admin analytics, foreign cases and counselling contents |
| Counsellor | Assigned consent-valid case evidence, actions and saved record | Unassigned/disposed cases, staff management and admin charts |
| Admin | Staff, eligible assignment, allowlisted audit and safe operational aggregates | Intake text, predictions, explanations, identity mappings and private review contents |
| Locally authorized researcher | Protected component-directory metadata | Cases, datasets, annotation, admin functions and model execution |
| Service | Existing audience-authenticated internal function | Browser roles and other service audiences |

There is no annotator grant or approved annotation API. Components are not roles. No public
privileged signup is added. Staff mutation still revokes sessions and protects the last
usable admin. Existing role namespaces, bounded expiry and refresh replay/revocation remain.

Confirmed pages: student `http://localhost:3000/`, read-only `:3000/demo`, counsellor
`http://localhost:3001/` and `/?state=COMPLETED`, admin `/admin/overview`, `/admin/assignments`,
`/admin/staff`, `/admin` (audit), `/admin/operations`, `/admin/retention`; directory `/research`.
All business data comes from protected APIs. Static shells expose no protected data before
authentication. Operations and retention remain read-only.

The assignment table now includes submission time, processing readiness, separate assignment
status, permitted staff display label, human-review status, last assignment change and action.
Staff labels are opaque **Counsellor <reference prefix>** pseudonyms, never login handles or
invented personal names. Last change is the most recent persisted allowlisted assignment audit
time, including clear; it is not case.updated_at. Existing reference search, filters, bounded
pages, confirmation dialogs, saved-review navigation and mobile tables are reused.

## Charts and exact metric definitions

No chart library is installed or added. Accessible HTML/CSS bars use real returned counts,
text labels and expandable exact-count tables. Loading/error/empty states, focus styles,
responsive layout and existing reduced-motion rules are preserved; bars do not animate
invented progress. The admin Overview cards retain an explicitly separate all-record scope.

GET `/api/v1/admin/analytics` is ADMIN-only and uses the same `administration.CaseFilters`
as GET `/admin/cases`. Bounds: aware since-inclusive/until-exclusive instants, at most 366
days; interval day/week; validated UUID-prefix/workflow/assignment/disposal/eligibility filters.
The UI selects 7/28/90 calendar days, daily or Monday-start weekly UTC buckets, workflow state,
assignment and case-reference prefix. The source table receives the exact same range/filters.
Parent overview refresh preserves selected chart filters. Tables have 20-item pagination.

| Chart | Actual source and unit |
| --- | --- |
| Cases by stored workflow state | SQL GROUP BY Case.status over filtered Case IDs; each case counted once, including safe disposed metadata |
| Human-review status | Same returned case-state counts grouped into awaiting review, in progress, completed, disposed or not review-ready; no clinical assessment inferred |
| Submissions by day/week | SQL daily UTC counts of Case.created_at, optionally combined into Monday-start weeks; one persisted case per submission, not consent decisions, retries or events |
| Active assigned workload | Assignment joined to usable COUNSELLOR, current consent and unexpired review-ready/in-progress case; filtered by the same submission range; completed work excluded |

Workload counts **case/counsellor pairs**: legacy additive multi-grants can count one case
for several staff. New exclusive assignment has one grant. Top 20 counsellors plus an Other
aggregate preserve totals without unbounded staff output. No active pairs means an honest
empty chart. UTC day/week edge buckets may be partial; zero buckets represent no observed
submissions, not invented data. Range, unit and last-updated time are visible. Separate API
snapshots may differ if a case changes between requests; no atomic multi-request snapshot
is claimed. Refresh to reconcile an actively changing system.

Aggregates contain counts, states, UTC bucket times and permitted staff pseudonyms only.
Disposal retains minimal case counts but removes active workload and protected derived content.
No intake/model/review payloads or student identity joins are projected into charts.

## C4 preservation and unavailable chart inputs

Inspected `services/{preprocessing,nlp,xai}/main.py`: all three currently instantiate
`mock_app`. The active contracts allow mock versions. The C4 research directory contains
templates/configuration, not a connected human web page; existing files are unchanged.
C3 offline experiments are also preserved and are not the running C1 provider.

Current `InferenceResponse` has one fixed uncalibrated fixture confidence, not per-class
probabilities. `ExplanationResponse` has fixed textual evidence, MOCK_FIXED_FIXTURE/mock-1,
null faithfulness/stability/counterfactual and no signed attribution values or target class.
The authorized counsellor view therefore says **Explanation values unavailable from current
provider** and lists actual method/model/explainer versions. No probability, LIME/SHAP,
comparison or reliability chart is fabricated. No C4 algorithm or research file is modified.
Real C2–C4 provider contracts and function-specific authorization must be integrated before
those chart types or web links can be supplied. Opening pages never trains/releases data.

## Files and compatibility

New: `docker-compose.demo.yml`, `services/orchestrator/analytics.py`,
`apps/counsellor-dashboard/components/{operational-charts,explanation-availability}.tsx`,
`tests/integration/test_admin_analytics.py`, `tests/frontend/operational-charts.test.tsx`.
Updated: `services/orchestrator/{administration,main}.py`, staff `components/admin-console.tsx`
and `app/page.tsx`, shared `styles.css`, central `research_contracts/__init__.py`, generated
JSON Schema/OpenAPI/TypeScript, `tests/frontend/role-administration.test.tsx`,
`scripts/{assignment_checks,compose_smoke}.py`, `scripts/pp1_browser.mjs` and linked guidance.

Additive `/admin/analytics` response models: AdminAnalytics, CaseStatusCount, SubmissionCount,
WorkloadCount. StaffSummary adds required display_name. AdminCaseSummary adds optional
last_assignment_at and defaulted human_review_status. Existing case-list query parameters
remain; optional since/until are additive. Strict consumers must regenerate/review before
merging. No C2–C4 request/response changes or service-local contracts. **No schema migration**:
existing timestamps/audit/assignment rows suffice; `f310c1000003` remains the head.

## Verification actually executed

| Check | Actual result |
| --- | --- |
| Initial affected staff/contract compatibility | 20 passed |
| First new analytics/manual tests | 8 passed; an additional bounded-workload test was then added |
| Full backend, including all new tests, security/contracts/withdrawal | **207 passed in 119.64 seconds** |
| Full frontend, including chart filters/refresh/session failures and unavailable C4 values | **62 passed** across nine files |
| Frontend lint / TypeScript | Passed |
| Affected Python Ruff / formatting | Passed |
| Python and TypeScript contract drift | Passed |
| Repository candidate/privacy scan / git diff check | Passed |
| PostgreSQL assignment/staff/chart harness | **5 passed**, including UTC aggregate/table parity and exclusive upper boundary |
| Existing PostgreSQL reliability/migration harness | **13 passed**, isolated schema; development records preserved |
| Development schema / Compose validation | No new upgrade operations; `f310c1000003 (head)`; manual configuration valid |
| Docker production builds/startup | Passed; nine services healthy using explicit manual override |
| Connected Docker smoke | Passed with manual assignment, service processing, chart totals, review, withdrawal/disposal, logout and log privacy |
| Final manual browser | **Passed in 27.727 seconds**, 16 scenarios and 38 sanitized screenshots; desktop/mobile and reduced motion |

Tests also verify last assignment timestamps, actual owner FR07 receipt before/after assignment,
admin/student/researcher denial, disposed-case aggregates, disabled/expired staff exclusion,
legacy multi-grant workload bounds and unchanged immutable review semantics. Passing cases
are scenario evidence, not percentages or complete security/research evaluation.

Initial lint caught React ref/effect handling and TypeScript caught an optional display field;
both were corrected before passing checks/builds. One manual-browser attempt assigned the
case but tried opening a stale queue before its refresh completed. The harness now waits
for the actual case button. That failed attempt is not counted as passing evidence.
Full-repository Ruff has the previously recorded 63 unrelated C3 findings; no global clean
lint claim is made. No training, dataset release, clinical/usability study or performance
benchmark was executed. Natural five-minute session verification from the preceding
[role increment](c1-role-assignment.md) is historical evidence, not a new timed run here.

Final browser directory:
`.local/c1-manual-charts-browser-cb978e9c-233f-4cb5-85b9-dad425f89abe/`.
Its `report.json` records actual checks/time. Reviewed desktop/mobile images include
`manual-awaiting-assignment.png`, `manual-assignment-saved.png`,
`admin-active-workload-desktop.png`, `admin-charts-filtered-desktop.png`,
`admin-charts-mobile.png`, `demo-awaiting-assignment.png` and
`counsellor-assigned-review.png`. The active-workload capture asserts one actual filtered
assignment pair before review completion; after completion it correctly shows no active work.
Chart source-table total and daily/weekly switching were checked in the browser. Horizontal
body-width checks passed at 1366px/390px; wide tables scroll within labeled focusable regions.
Review contents are withheld during retained captures and filled credential fields are never
captured. Retain only reviewed sanitized images/aggregate reports, never profile folders.
The initial failed directory is
`.local/c1-manual-charts-browser-b0910d76-9bce-44cb-bba4-0f65faacd8f5/`;
the intervening passing 28.459-second run preceded the positive-workload capture. Neither
is substituted for the final report. Ended-session behavior here is induced by logout,
not a natural one-hour expiry. Stale-state 503 is injected in the browser, not a service outage.

### Reproducible verification commands

Use a fresh pytest temporary path on repeats; existing folders/permissions were not changed.

```powershell
.venv/Scripts/python.exe scripts/run.py pytest tests/integration/test_admin_analytics.py -o addopts='' -q --basetemp=.local/pytest-c1-analytics-20261024-a
.venv/Scripts/python.exe scripts/run.py pytest -o addopts='' -q --basetemp=.local/pytest-c1-manual-charts-full-20261024-a
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
npm test -- --maxWorkers=1
npm run lint
npm run typecheck
.venv/Scripts/python.exe -m ruff check services/orchestrator packages/contracts/src scripts/assignment_checks.py scripts/compose_smoke.py tests/integration/test_admin_analytics.py
.venv/Scripts/python.exe -m ruff format --check services/orchestrator packages/contracts/src scripts/assignment_checks.py scripts/compose_smoke.py tests/integration/test_admin_analytics.py
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
npm run contracts:check
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
.venv/Scripts/python.exe scripts/run_evaluation.py assignment
.venv/Scripts/python.exe scripts/run_evaluation.py postgres
docker compose exec -T orchestrator alembic check
docker compose exec -T orchestrator alembic current
docker compose -f docker-compose.yml -f docker-compose.demo.yml config --quiet
.venv/Scripts/python.exe scripts/compose_smoke.py
node scripts/pp1_browser.mjs --manual --staff-file .local/<private-staff-file>.env
git diff --check
git status --short --branch
git diff --cached --name-only
```

PostgreSQL evaluators verify their generated schema before migrations/disposable downgrade
and cleanup; no reset/downgrade is performed on the development schema.

## Startup and role walkthrough

Preserve the existing `.env`. On a fresh checkout only, run `./scripts/bootstrap-dev.ps1`
first. For this manual demonstration:

```powershell
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build --wait --wait-timeout 180
docker compose -f docker-compose.yml -f docker-compose.demo.yml ps
```

1. Student profile: open `/` and `/demo` at port 3000. Record a decision; show no review task.
   Submit a fixed fixture and select the owner run. Processing must complete; FR07 remains
   unverified until actual assignment.
2. Counsellor profile: sign in at port 3001 with existing private local credentials. The
   new unassigned case is absent; knowing a reference is insufficient for access.
3. Admin profile: sign in at `/admin/overview`, confirm MANUAL policy. In `/admin/assignments`,
   search the new case, inspect readiness/timestamps, select an active counsellor and confirm.
   The owner checklist can now observe its safe assignment-backed review-task receipt.
4. Admin overview: filter charts by that case. Observe one submission and one active workload
   pair; switch daily/weekly and expand exact-count tables. Counts after completion exclude
   that case from active workload.
5. Counsellor: refresh queue, open/start review, enter a fictional SYNTHETIC: observation and
   permitted follow-up category, save, refresh/sign in and reopen, then complete. The C4
   unavailable-values message explains why no numeric explanation chart exists.
6. Admin: reassign to another active local counsellor. Old access is denied; the new counsellor
   can reopen the existing immutable record with original attribution. To create an additional
   synthetic account privately, use `.venv/Scripts/python.exe scripts/provision_staff.py --role
   COUNSELLOR` and read its ignored returned file only in the editor. Never publish credentials.
7. Student: confirm withdrawal. Refresh both counsellor queues; protected contents disappear.
   Admin retains only permitted disposal/count receipts; owner checklist retains no review text.

Remaining gaps: institutional allocation/notice/retention/research-access approval; real
identity/TLS/at-rest controls; real C2–C4 APIs/web views and measured explanation inputs;
broader security/evaluation/usability work. No approved clinical result is claimed.

Suggested logical commit groups, none created: (1) manual-demo assignment metadata and safe
aggregate APIs with central generated contracts/tests; (2) connected charts/assignment and
honest C4 availability UI with frontend regressions; (3) Docker/browser/PostgreSQL evidence,
traceability and startup guidance. Review these with the earlier unstaged role-workspace work.
