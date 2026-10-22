# Component 1 PP1 demonstration page

> **Historical implementation note, superseded on 2026-10-21.** The form-based `/demo`
> described below was refactored into a read-only owner-scoped requirements checklist.
> Only `/` now contains student consent/submission controls. Use the current
> [checklist mapping, verification and demonstration sequence](c1-demo-checklist.md).
> Results and design statements below describe the earlier implementation, not the
> current checklist; they are retained as historical evidence.

Date: 2026-10-21 (Asia/Colombo). Branch `feature/c1-consent-orchestration`, baseline
`8a9d773`; working tree was clean before this task. Changes are left unstaged and uncommitted.

## Scope and implementation

The route is **http://localhost:3000/demo** within the existing student portal. C1 owns
the architecture, consent, permissions, orchestration and lifecycle demonstration. C2–C4
appear only as dependencies. Their service entry points still call `mock_app`; no real
anonymizer, NLP model or explainer is presented as live. Local authentication is a development
provider. Screening support requires authorized human interpretation and does not replace
professional counselling.

| Files | Purpose |
|---|---|
| `apps/student-portal/app/demo/page.tsx` | Dedicated C1 route |
| `apps/student-portal/app/page.tsx` | Root route delegates to shared lifecycle UI |
| `apps/student-portal/components/student-lifecycle.tsx` | Extracted existing consent/submission/withdrawal implementation; demo navigation, observation state and polling |
| `apps/student-portal/components/demo-panels.tsx` | Provider boundaries, current snapshot, static workflow reference and recorded evidence presentation |
| `apps/student-portal/components/c1-evidence.ts` | Explicit allowlist of sanitized historical C1 evidence with source/date/revision limitations |
| `packages/typescript-common/src/api.ts` | Optional AbortSignal propagated through requests and existing refresh/retry flow |
| `packages/typescript-common/src/styles.css` | Responsive demo sections and text-based state presentation |
| `tests/frontend/c1-demo.test.tsx` | Sixteen focused demo and polling regression cases |
| `scripts/pp1_browser.mjs` | Optional `--demo` mode reuses the existing isolated Edge browser harness |
| `readme.md`, this note | Startup link, demonstration instructions and verification evidence |

Both `/` and `/demo` render the same lifecycle implementation; no business logic or
authentication system was duplicated. The complete student demo stays mounted at `/demo`.
Section anchors do not navigate to another route. No browser persistence was added.
Reload/session-loss limitations remain visible. The root-page link advises starting the
demo before consent because navigation does not transfer an active case.

## Runtime observations and authorization

The existing owner-only `GET /api/v1/consents/{id}/lifecycle` provides consent, optional
case state, disposal reason and explicit-withdrawal time. Existing submission/withdrawal
responses are also successful observations. The page records browser receipt time, not
an invented stage execution time. It does not collect stage durations or completion
percentages. The static workflow reference is collapsed and explicitly not a trace.

Polling is enabled only on the demo for ACTIVE, unexpired, undisposed cases in RECEIVED,
CONSENT_VERIFIED, PREPROCESSING, INFERENCE or EXPLANATION. It waits two seconds between
completed observations, permits at most 15 automatic lifecycle reads per window and gives
each automatic request an eight-second deadline. The existing auth helper can perform
one refresh/retry when an access token expires. A successful explicit Refresh status
restarts the observation window.

Polling pauses during mutations/confirmation. It stops on unmount, expiry, failed refresh,
authorization loss, disposal, FAILED, WITHDRAWAL_REQUESTED, READY_FOR_REVIEW, UNDER_REVIEW
or COMPLETED. Later review transitions are retrieved manually. Cleanup aborts an in-flight
read; a cancellation guard also prevents late responses overwriting withdrawal. Failed
refreshes preserve the last successful timestamp and label old lifecycle values stale.
401 ends actions; 403/404 mark access unavailable and stop automatic reads. No fabricated
withdrawal receipt is shown on denial.

The handoff links to the configured counsellor URL, `http://localhost:3001`, without tokens
or case IDs. It explicitly instructs separate browser profiles because localhost ports
share cookies. Opening a new tab alone does not isolate roles. Counsellor assignment,
fresh consent and authorization remain enforced by the existing backend.

No backend, shared wire contract, generated schema, migration or provider code changed.
There is no new public audit endpoint, arbitrary file reader, database browser or research
execution control. Historical evidence is a curated TypeScript constant, not a raw-file API.
The page excludes C3 benchmark scores and C2/C4 research controls.

## Verification executed for this change

| Check | Result |
|---|---|
| Frontend tests | **32 passed** across four files: 16 existing plus 16 demo cases |
| Frontend lint and TypeScript | Passed for both applications |
| Python JSON Schema/OpenAPI and TypeScript drift | Passed |
| Repository candidate-file/frontend privacy scan | Passed |
| `git diff --check` | Passed |
| Bootstrap and Compose configuration | Existing `.env` preserved; configuration valid |
| Student production Docker build | Passed; `/` and `/demo` generated |
| Existing development stack | All nine containers healthy after update; database volume retained |
| Edge 155.0.4283.62 | **Seven browser scenarios passed** at desktop 1366×1000 and mobile 390×844 viewport sizes |
| Existing Docker synthetic smoke | Passed: four-service health/version, PostgreSQL/Redis, C1–C4 workflow, concurrent idempotency, assigned human review, withdrawal/access revocation, retention-first withdrawal receipts, logout, frontend proxies and log privacy |

The new tests exercise rejection, valid fixture submission, intermediate state display,
withdrawal cancellation/success, retention versus explicit withdrawal, terminal/error
states, stale-refresh recovery, 401/403/404 denial, polling budget, in-flight cancellation
and late-response fencing. An initial test failed because its text selector matched three
historical-date disclosures; the selector was corrected and all 32 tests then passed.

Browser scenarios: rejection and home navigation; mobile pre-submission withdrawal with
dialog focus/cancel return; fresh submission reaching READY_FOR_REVIEW through actual
responses; authorized review START/COMPLETE; post-review withdrawal and reviewer access
revocation; ended session; recorded evidence and stale-refresh presentation. No deliberate
service delay was introduced. Stale UI was exercised using an injected browser 503 response,
not a real provider outage. Session end was induced by logout, not a one-hour wait.

Sanitized PNGs and aggregate `report.json` are retained in ignored
`.local/c1-demo-browser-c410b11f-0b27-4b39-91d1-97229c45c4b5/`.
Desktop, mobile and processing-complete captures were visually inspected; horizontal
overflow assertions passed. There are eleven screenshots including modal, withdrawal,
review, session-end, stale-response and recorded-evidence views. No populated credential
fields or network traces were captured. Browser profile contents remain private/ignored.

Read-only Ruff checking of the pulled C3 research still reports **63 pre-existing findings**
(imports, unused symbols, typing modernization and redundant syntax). This remains a
repository CI blocker; no C3 files or lint rules were changed. Frontend lint passes.
No full Python test, migration, PostgreSQL race or performance rerun was necessary for
this frontend-only increment. Historical results displayed on the page remain dated
recorded evidence, not new measurements or proof of current research completeness.

Commands used (repository root, PowerShell; check each exit code):

```powershell
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
npm test
npm run lint
npm run typecheck
npm run contracts:check
.\.venv\Scripts\python.exe -B scripts/run.py scripts.generate_contracts --check
.\.venv\Scripts\python.exe scripts/check_repository.py
.\.venv\Scripts\ruff.exe check --no-cache --statistics research/c3-model-experiments
git diff --check
```

The Ruff command above is expected to fail on the existing findings; it is listed to make
the limitation reproducible, not as a passing result.

## Startup and panel sequence

Start Docker Desktop with Linux containers. Python 3.12 and Node 22 must be on PATH; the
optional local Node PATH line above uses the existing ignored runtime in this workspace.

```powershell
cd F:\Reserch\J26-SE-338
python scripts/bootstrap_dev.py
docker compose config --quiet
docker compose build student-portal
docker compose up -d --no-build --wait --wait-timeout 180
docker compose ps
.\.local\node-runtime\node_modules\node\bin\node.exe scripts/pp1_browser.mjs --demo
.\.venv\Scripts\python.exe scripts/compose_smoke.py
```

The targeted build reuses existing images. On a fresh checkout, use
`docker compose up -d --build --wait --wait-timeout 180` instead. The final two commands are
optional synthetic verification runs; simply opening the demo does not execute them.

Confirmed routes: student `http://localhost:3000/`, C1 demo `http://localhost:3000/demo`,
counsellor `http://localhost:3001/`; API docs configured at `http://localhost:8000/docs`.
Privately use the existing `.env` counsellor credentials; do not show them during a panel
recording. All these services were already running when this task began, so they are left
running for review. Stop when desired with `docker compose down`, without `-v`.

1. Open `/demo`; explain C1 scope, development identity and mock dependencies.
2. Record rejection and show that submission stays disabled.
3. In a fresh isolated student context, accept, open/cancel withdrawal and then confirm
   pre-submission withdrawal; show the receipt.
4. In another fresh context, accept and submit one built-in fixture. Keep this page mounted.
   Show the returned state and observation time; explain that fast stages can be missed.
5. Use a separate counsellor profile to review the assigned task and record supported actions.
   Refresh the student snapshot to observe the human-review state.
6. Withdraw from the owner page; refresh the counsellor list and show access removal.
7. Expand recorded C1 evidence and explain source, date, denominator and exclusions.

## Remaining visibility and evaluation gaps

There is no authorized chronological audit/transition API, full provenance response,
live retry/lease inspector or aggregated provider-health panel in this increment. The
snapshot cannot prove every intermediate transition or its timing. Case recovery after
reload/session loss is still unavailable. Provider labels require review when service
implementations change. Historical evidence is deliberately not automatically refreshed.
Full accessibility, cross-browser, participant usability, clinical validity and production
security evaluations are not established by these engineering checks.
