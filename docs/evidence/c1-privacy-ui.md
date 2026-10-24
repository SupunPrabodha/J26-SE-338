# C1 infrastructure privacy demonstration — 2026-10-24

Later visual increment: [forest navigation, compact account/disclosure and current verification](c1-visual-design.md).
The results below remain evidence for the privacy increment, not test results for that later redesign.

Branch: `feature/c1-consent-orchestration`, base HEAD `2dee860`. This increment preserves
the existing unstaged staff/assignment, contracts, session, FR09 and C3 work. Nothing was
staged, committed, pushed, merged, reset or switched. Existing records and volumes remain.
Results below belong to this increment; earlier notes remain historical evidence.

## Scope and delivered behaviour

Open `http://localhost:3000/demo`: **Infrastructure Privacy and Security — Component 1**.
Six compact groups show implementation separately from selected-run evidence. Each group
shows counts of its different subcheck outcomes; a mixed group never receives a blanket
pass. All 39 existing subchecks remain reachable in dialogs or the secondary reliability
view. The historical evaluation view preserves original dates, methodology and limitations.
No completion percentage, artificial timing, research execution or new consent form exists.

Implementation vocabulary: **Implemented / Partial / Missing / External approval dependency**.
Evidence vocabulary: **Verified in selected run / Not exercised / Failed / Unavailable or
stale / Recorded configuration evidence**. Recorded tests are additionally labelled
**Recorded test evidence** as their source; they never verify the selected run. Implementation
is explicitly mapped independently of missing events. Group implementation is Partial when
its subchecks differ. FR04.b is Partial because only mock integration is connected; it is
not mislabeled as an institutional approval dependency.

Student `/` announces Recording consent / Submitting text / Refreshing status / Recording
withdrawal with indeterminate progress, `aria-busy`, polite announcements and a synchronous
duplicate-request guard. Acceptance and rejection are distinct. Submission acceptance is
retained if the following status fetch fails. An uncertain submission keeps its payload and
idempotency key for retry; a definite validation rejection is shown separately. Actual
server states determine workflow labels; no percentage or elapsed prediction is synthesized.

Desktop staff navigation is fixed at the left viewport edge below the fixed header, with
shared height/width variables, independent sidebar scrolling and correctly offset content.
Student width is preserved. Mobile uses a labelled native-dialog drawer that closes on
navigation, restores focus and disappears on authorization loss. There is one StaffFrame
per staff page. Tables, filters, operational charts and primary review controls stay inline.

Shared AppDialog supplies native modality, labelled title/Close, initial focus, focus return,
bounded internal scrolling and reduced-motion support. Requirement details, receipts, dated
evaluation, safe audit references, assignment/staff editors and provider metadata use it.
Dirty editors prompt within the same dialog; confirmations do not stack modals. Pending
changes disable close; detected access loss clears protected dialogs without a discard prompt.
Open staff dialogs recheck their existing protected resource immediately, on focus and every
10 seconds, bounded to 20 successful observations. A failed check or exhausted window clears
the protected view. Detection is polling-based, not instantaneous server push; server checks
still apply to every read/mutation. The owner observer retains its existing 3-second/20-read
window and 8-second request deadline. Stale/failed refresh closes its details and clears live
data. Explicit refresh is required after the bounded window ends.

## Requirements, implementation and evidence

Source: finalized TAF pp7–8; Master Research Context; IT23187450 section 5 pp27–28, freshly
read from the user-supplied local files. These are proposed requirements, not stakeholder
approval or completed evaluation. UI suffixes decompose the source requirements. TAF
ownership prevails; source documents are reference evidence and remain outside Git.

| Group / requirements | Implementation in current development scope | Selected-run evidence / separate verification | Remaining gap |
| --- | --- | --- | --- |
| Consent and purpose — FR01, FR02, NFR03 | Active/purpose/version/expiry guards implemented; notice approval is External approval dependency | Persisted choice/blocking receipts only when present; invalid-state and exact-expiry cases are recorded regression evidence | Institutional notice/purpose and stakeholder approval; one choice is not all negative cases |
| Pseudonymous identification — FR03, NFR01 | Partial: cases and separate linkage exist; infrastructure isolation has bounded development scope | Case receipt proves creation only; adapter/privacy tests separately recorded | Real identity deployment and privacy evaluation; UUID is not complete anonymization; C2 owns anonymization research |
| Authentication, roles, assignment — FR07, FR08, FR09.d/e, NFR02 | Session, RBAC, ownership, assigned review implemented; TLS Missing; at-rest evidence External approval dependency | Authorized owner read/task receipt; negative security tests separately recorded; no admin/counsellor content in owner response | HTTP localhost, development identity; PostgreSQL/Docker do not establish encryption at rest |
| Controlled orchestration/provenance — FR04, FR05, NFR05 | C1 adapters and validation implemented; real integration Partial | Persisted validated case correlation/version outcome when consent permits; contract regressions separately recorded | C2–C4 current contract services are mocks; no real dataset/model/faithfulness result inferred |
| Withdrawal/retention — FR10 | Implemented for synthetic development policy | Explicit withdrawal and disposal state are separate checks; later denial verified separately in tests/browser | Institutional retention policy and operational deletion assurance |
| Audit/accountability — FR11, FR12, NFR04, safe FR09 receipts | Safe audit/admin and FR09 save/read implemented; audit evaluation Partial | Owner sees allowlisted receipts only; ADMIN interface verified separately, never inferred from an owner event | Broader coverage/reconstruction evaluation; save does not prove interpretation quality or actual follow-up |
| Secondary reliability — FR06, NFR06 | Implemented bounded retry/idempotency infrastructure | Current backend suite and smoke; live replay/failure only when observed | No claim every failure scenario occurred in selected run |
| Secondary evaluation — NFR07–10 | Performance/deployment/human evaluation Partial; NFR08 measured modifiability experiment Missing | Dated historic measurements/configuration, not current-run metrics; human completion is a receipt | Full proposal latency, clean deployment timing, measured architecture change, human usability/clinical evaluation |

FR12 implementation was inspected in `administration.py`, `operations.py`, `analytics.py`
and ADMIN routes; existing assignment/staff revocation and safe audit tests ran in the full
suite. FR09 was inspected in protected review endpoints/models and `test_review_records.py`:
one immutable synthetic interpretation/category can be saved and retrieved by the assigned
counsellor, with consent/retention enforcement. Student evidence exposes only save/start/end
receipts. Purpose/version checks reuse existing consent guards; no contracts, database
migrations, token settings, server permissions or C2–C4 research internals changed here.

## Files changed by this increment

- `packages/typescript-common/src/ui.tsx`, `styles.css`: shared frame, dialog, protected-dialog
  observation, withdrawal dialog, responsive layout, progress and reduced-motion styles.
- Student `components/checklist-rules.ts`, `demo-checklist.tsx`, `demo-panels.tsx`,
  `student-lifecycle.tsx`: explicit status mapping, six groups/details, evidence views and
  consent/submission progress with accepted/unconfirmed recovery.
- Staff `components/admin-console.tsx`, `app/page.tsx`, `app/admin/page.tsx`,
  `app/research/page.tsx`: existing editors and safe metadata in protected dialogs.
- `tests/frontend/privacy-progress-dialogs.test.tsx` (9 new regressions); an additional
  `admin-evidence.test.tsx` regression covers provenance disposal. Existing
  `c1-demo.test.tsx`, `review-record.test.tsx`, `consent-lifecycle.test.tsx` updated for actual
  status vocabulary and dialog interaction. Existing authorization/polling checks retained.
- `scripts/pp1_browser.mjs`, `session_browser.mjs`: interact with visible dialogs, exercise
  manual assignment and validate actual production browser behaviour. No credentials logged.
- This note, checklist dated correction, source-review correction and README link.

## Verification of this increment

Full backend: **207 passed in 135.43 seconds**, with fresh temporary directory
`.local/pytest-c1-privacy-ui-full-20261024-a`. Frontend: **72 passed**, 10 files, including
ten new progress/status/dirty-dialog/access-loss/drawer regressions. Frontend lint,
both application TypeScript checks, affected C1 Ruff and formatting, Python/TypeScript
contract drift, repository candidate-file/privacy scan and `git diff --check` passed.
Both frontend production images built successfully. All nine Compose services were healthy;
existing synthetic Docker smoke passed workflow, manual assignment, review/withdrawal,
concurrent idempotency, frontend proxies and log privacy. No schema/locking code changed;
the dedicated PostgreSQL locking evaluator was not rerun for this presentation increment.
`alembic check` found no new upgrade operations and `alembic current` reported
`f310c1000003 (head)` on the retained PostgreSQL development schema.
The smoke was repeated after the final successful browser run and passed, including review
record save/read/replay, disposal and log exclusion. Final Git checks confirmed the same
`2dee860` HEAD, expected feature branch, empty index and preserved dirty/untracked work.
`.env` and browser artifacts remain ignored and are not tracked.

Natural session browser verification **passed in 321.969 seconds**, including **at least 310
seconds of actual wall-clock waiting**, concurrent student `/` and `/demo` access, separate counsellor context,
manual assignment, review save/read/completion, refresh, withdrawal and logout. Browser/server
UTC skew was approximately 1.26 seconds. Retained ignored report:
`.local/c1-session-browser-c64ba356-f8d2-47b4-903b-d2eced315330/report.json`.
The report's `expiry_wait_seconds=315.965` measures from the start of the wait through the
subsequent verification actions; it is not a measurement of idle waiting alone.
This run preceded the final dialog-body keyboard tabindex, FR04.b label adjustment and
admin provider-dialog disposal recheck and breakpoint race fix;
authentication code and expiry settings were identical. Access JWT/cookie: **300 seconds**;
refresh/cookie: **3600 seconds**; student owner/consent: **one hour from owner creation**;
synthetic evidence retention: **24 hours**. Refresh does not extend owner/consent expiry.
Cookies remain namespaced, host-only localhost, `/api/v1`, HttpOnly, SameSite=Strict, with
Secure false for the existing HTTP-localhost deployment. No security settings were weakened.

Final production browser privacy verification **passed in 66.805 seconds**, Edge
`155.0.4283.62`, with **59 privacy-checked screenshots** retained in ignored
`.local/c1-privacy-ui-browser-d7e38fe9-6e3f-4a02-bf49-4259e2af2f93/` alongside `report.json`.
This run used the final production builds, including both bounded defects fixed during
verification. It exercised acceptance/rejection, held consent/submission, accepted-then-503,
lost-response same-key/same-case retry, 422 rejection, six-group evidence, manual assignment,
FR09 save/reopen, reassignment denial, staff disable/session revocation/re-enable, read-only
operations/directory, all six admin routes at 1920px/390px, fixed sidebar under scroll,
mobile drawer navigation, native Escape/Tab/focus restoration, dirty edit preservation,
reduced motion, withdrawal, open admin provenance clearing on disposal, review access denial,
logout, owner-run isolation and injected stale evidence. Opening evidence did not execute
research or evaluations. Actual service processing used C2–C4 development mocks.

Selected retained screenshots (same directory):

| View | Screenshot |
| --- | --- |
| Compact six-group privacy page | `demo-consent-observed.png` |
| Evidence dialog | `privacy-evidence-dialog-desktop.png` |
| Staff overview, flush-left fixed sidebar and operational charts | `privacy-admin-overview-desktop.png` |
| Mobile overview | `privacy-admin-overview-mobile.png` |
| Mobile keyboard-accessible navigation | `privacy-mobile-navigation-drawer.png` |
| Dirty assignment editor / confirmation | `assignment-editor-desktop.png`, `assignment-discard-prompt.png` |
| Accepted submission with unavailable status | `submission-accepted-status-unavailable.png` |
| Pending reduced-motion progress / uncertain retry | `submission-pending-reduced-motion.png`, `submission-unconfirmed-retry.png` |
| Withdrawal and withheld provenance | `demo-withdrawal-observed.png`, `admin-after-withdrawal.png` |

All six admin routes additionally have `privacy-admin-<overview|staff|assignments|audit|operations|retention>-<desktop|mobile>.png`.
Screenshots were inspected for desktop layout and mobile drawer; safe capture refuses filled
credential fields and masks the fictional saved interpretation. No screenshot is a research
or usability outcome. The final report's route-loop check is named `admin_retention_mobile_navigation`
because that is the last loop stage; all twelve route captures/assertions executed.

Earlier browser harness attempts are not passing verification:
the consent assertion initially ran before the owner-session probe reached the consent POST,
and native Escape delivery required complete Windows virtual-key codes. The target is
explicitly brought to the foreground for keyboard checks. Trusted pointer events are used
so dirty-dialog Escape has real browser user activation. Rapid repeat attempts also hit
the existing login/session rate limit; no limit was cleared or relaxed. A late mobile
breakpoint event could close a just-opened drawer; only entering desktop mode now closes it,
with an explicit regression test.
No real service outage, training or dataset release was induced. Pending requests and the
503/422/lost-response cases are explicitly controlled browser injections; the uncertain case
lets the real backend accept before losing its response and compares the retried case/key
internally without printing request contents.

Commands executed from the repository root, PowerShell (check each exit code):

```powershell
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
.venv/Scripts/python.exe scripts/run.py pytest -o addopts='' -q --basetemp=.local/pytest-c1-privacy-ui-full-20261024-a
npm test -- --maxWorkers=1
npm run lint
npm run typecheck
npm run contracts:check
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
.venv/Scripts/python.exe -m ruff check services/orchestrator packages/contracts/src scripts/assignment_checks.py scripts/compose_smoke.py tests/integration/test_admin_analytics.py
.venv/Scripts/python.exe -m ruff format --check services/orchestrator packages/contracts/src scripts/assignment_checks.py scripts/compose_smoke.py tests/integration/test_admin_analytics.py
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
docker compose -f docker-compose.yml -f docker-compose.demo.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.demo.yml build student-portal counsellor-dashboard
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --no-build --wait --wait-timeout 180
docker compose exec -T orchestrator alembic check
docker compose exec -T orchestrator alembic current
.venv/Scripts/python.exe scripts/compose_smoke.py
node scripts/session_browser.mjs --manual
node scripts/pp1_browser.mjs --privacy --staff-file .local/staff-13e7e44063dd46a689ecb45184e68d71.env
git diff --check
git status --short --branch
git diff --cached --name-only
```

Use a fresh unique pytest directory on repeats. The staff file above is an existing ignored
local fixture, not a repository secret/example. Provision an additional synthetic counsellor
with `scripts/provision_staff.py --role COUNSELLOR` if repeating elsewhere; pass its returned
private file path. Never display its contents, network traces, raw text, notes or credentials.
Repository-wide research Ruff and dependency audits were not repeated; the scoped C1 checks
above do not certify unrelated C3 changes. This is functional smoke, not a usability study.

## Short PP1 sequence

Preserve `.env` and volumes. Start the manual demonstration with:

```powershell
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build --wait --wait-timeout 180
```

1. Student profile: open port 3000 `/` and `/demo`. Record a synthetic decision, explicitly
   select its run and inspect Consent and purpose. Contrast a persisted event with external
   notice approval and separately recorded invalid-purpose/version/expiry tests.
2. Submit the built-in fictional fixture. Observe real returned workflow states and routing
   provenance; explain that fast mock stages may finish between snapshots. Pending progress
   is indeterminate. Unexercised retries/denials remain unexercised.
3. Separate admin profile, port 3001 `/admin/assignments`: assign the processed case to an
   active counsellor, review the single confirmation and save. Show fixed navigation,
   restricted audit and database-backed operational charts without opening counselling text.
4. Separate counsellor profile, port 3001 `/`: open the assigned case, start review, save a
   fictional SYNTHETIC interpretation/permitted category, reopen it and complete. Student
   audit group shows only safe receipts. No diagnosis, advice or executed follow-up is claimed.
5. Withdraw on student `/`; refresh owner evidence and counsellor queue. Show disposal and
   denied access. If the roughly one-minute observer window ended, explicitly Refresh evidence;
   that stale window is distinct from session logout. Demonstrate rejection/pre-case withdrawal
   using a separate synthetic run, never reuse another owner's case.
6. Open secondary recorded evaluation details with their dates and limitations. Explain HTTP,
   absent storage-encryption evidence, approval dependencies and C2–C4 mock boundaries.

Screening support only, counsellor-assisted and human-in-the-loop. The system does not
replace professional counselling. Institutional notice, identity, allocation/retention policy,
TLS and storage-encryption evidence remain external work; C2–C4 real research APIs/results
and formal human/security/performance evaluation remain separate. No green label hides them.
