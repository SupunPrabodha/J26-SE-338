# C1 role workspaces and explicit assignment — 2026-10-24

Follow-on increment: [manual demo configuration, completed assignment columns and safe charts](c1-manual-assignment-charts.md).
The defaults and earlier 198/58 results below remain a dated record. The newer current-run
207/62 results, five PostgreSQL assignment/chart checks and manual browser evidence are
recorded separately. The manual override preserves existing assignments and credentials.

Branch `feature/c1-consent-orchestration`, baseline `2dee860`. This increment preserves
the earlier uncommitted workspace redesign and unrelated C3 results. Nothing was staged,
committed, pushed, merged, reset or switched. Development volumes and existing records
were preserved. This is synthetic, non-diagnostic screening support with counsellor-assisted
human interpretation; it does not replace professional counselling.

## Verified policy and delivered behavior

Before this increment the worker assigned the configured development counsellor only after
C2–C4 processing succeeded. Consent acceptance alone never granted access. Review APIs
already checked the COUNSELLOR role, assignment, consent and retention. There was no shared
unrestricted review queue. The legacy admin assignment endpoint granted an additional
counsellor; it did not perform exclusive reassignment. There was no connected staff-management
or assignment UI.

`ASSIGNMENT_POLICY=DESIGNATED_DEVELOPMENT` preserves automatic assignment to the configured
enabled, unexpired counsellor with local credentials. If unavailable, the task remains
awaiting assignment. `MANUAL` creates the same review task but leaves it awaiting assignment.
The default is unchanged; the ignored local `.env` was not modified. Restart/recreate the
orchestrator and worker after deliberately changing this configuration.

Assignment is an administration state derived from existing rows, separate from processing
and human-review states. Eligibility requires a persisted review task, READY_FOR_REVIEW,
UNDER_REVIEW or COMPLETED state, current matching active consent and an unexpired case.
The admin can assign exactly one usable counsellor, replace all prior grants, or clear grants.
Saved records remain immutable and reopen for the new authorized counsellor. Reassignment
does not transfer authorship or grant a right to overwrite an existing record.

Changes compare an observed assignment digest; stale different requests return 409, matching
retries are no-ops after fresh policy checks. Staff updates compare `expected_updated_at`;
matching requests are no-ops. Disabling or changing a staff role revokes all their existing
sessions. Re-enabling requires new sign-in; old sessions never revive. Disabling/demoting
the last usable admin is blocked. Expired or credential-less admins do not count as usable.
Existing grants for disabled staff remain visible and replaceable, but do not grant access.

## Permission matrix

| Principal | Permitted function | Excluded |
| --- | --- | --- |
| Student | Own consent, fixture submission, case status, withdrawal and read-only owner checklist | Foreign runs, assignments, staff, audit viewer and review contents |
| Counsellor | Assigned consent-valid case evidence, review actions and record save/read; protected component directory | Unassigned/disposed cases, admin changes, identity mappings |
| Admin | Staff roles/enabled state, eligible assignments, actual safe counts, read-only operations/retention and allowlisted audit; component directory | Counselling contents, review actions, identity mappings, arbitrary logs/queries/jobs |
| Locally authorized researcher | Metadata-only component directory | Case data, datasets, annotation, model execution and all administration |
| Service | Existing audience-authenticated internal function | Browser role privileges and other service audiences |

Components are ownership/service boundaries, not roles. No annotator role or approved
dataset/annotation route exists, so none is invented. Local RESEARCHER provisioning is an
operator grant to this directory only, not institutional research approval. Permissions are
enforced by backend dependencies and fresh case/account/session guards, not hidden links.
The Next.js shell itself contains no protected data before authentication.

## Connected pages and sources

All staff URLs below use `http://localhost:3001` and existing authentication. Sidebar sections
use the same admin session. Student `/` and `/demo` remain at port 3000.

| Page | Actual API/data source | Controls |
| --- | --- | --- |
| `/admin/overview` | GET `/api/v1/admin/overview` | Actual row counts, observation time, assignment policy and configured retention |
| `/admin/staff` | GET `/admin/staff`; POST `/admin/staff/{id}` | UUID-prefix/role/enabled filters, 20-row pages, role/access confirmation and session revocation |
| `/admin/assignments` | GET `/admin/cases?eligible_only=true`; GET `/admin/staff`; POST `/admin/cases/{id}/assignment` | Eligible/assigned/awaiting filters, recipient search/pages, safe details, confirmation and conflict detection |
| `/admin` | Existing GET `/admin/audit-events` | Allowlisted event/date/case filters, cursor pages and safe provenance/disposal receipts |
| `/admin/operations` | GET `/admin/cases`; GET `/admin/overview` | Workflow/job states, bounded attempts and safe failure codes; read-only |
| `/admin/retention` | GET `/admin/cases`; GET `/admin/overview` | Real case deadlines, disposal reasons and configured development policy; read-only |
| `/` / `/?state=COMPLETED` | Existing `/review-queue`, task/action/record APIs | Assigned queue, saved-record reopening and separate processing/review status |
| `/research` | GET `/component-routes`, with separate research cookie namespace | Protected directory of actual C2/C3/C4 mock provider boundaries |

Paths abbreviated in the table remain under `/api/v1`. Staff/case lists accept offset
0–10000, limit 1–20 and optional 4–36 character UUID-prefix search. All responses exclude
login handles, credentials, student-owner IDs, identity links, intake text, model payloads
and counselling contents. Staff IDs are administrative references required for assignment.
Operations show persisted state, not a fabricated live service-health measurement. Case
`updated_at` is not presented as an invented disposal timestamp.

There are **no connected C2–C4 human web pages** in this checkout. Their existing
`services/{preprocessing,nlp,xai}/main.py` still use deterministic mock applications.
The directory therefore publishes `INTERNAL_SERVICE_ONLY` and no web path. Internal
audience-bound APIs are not converted into public links. C3's independent offline research
is preserved and is not the running C1 provider. No training/release/benchmark runs on page load.

## Implementation and compatibility

- Backend: new `services/orchestrator/administration.py`; updated `auth.py`, `main.py`,
  `workflow.py`, `manage.py`, existing uncommitted `operations.py`.
- Configuration: `packages/python-common/src/research_common/config.py`, `.env.example`,
  `docker-compose.yml`. The new policy value is non-secret; generated credentials remain ignored.
- Central contracts: `packages/contracts/src/research_contracts/__init__.py`; regenerated
  orchestrator OpenAPI, TypeScript declarations and new JSON schemas for `StaffSummary`,
  `StaffPage`, `StaffUpdateRequest`, `AssignmentChangeRequest`, `AdminCaseSummary`,
  `AdminCasePage`, `AdminOverview`, `ComponentRoute`, `ComponentDirectory`; updated
  `LifecycleAuditEvent`/admin event union.
- Staff UI: `apps/counsellor-dashboard/components/admin-console.tsx`,
  `app/admin/[section]/page.tsx`, existing `app/admin/page.tsx`, `app/page.tsx`,
  `app/research/page.tsx`, `app/api/v1/[...path]/route.ts`.
- Shared UI/client: `packages/typescript-common/src/{ui.tsx,styles.css,api.ts,proxy.ts}`.
  Concise presentation label is **Demo data · Mock services**. Internal SYNTHETIC markers,
  provider metadata, fixture restrictions and full safety disclosures remain.
- Verification: `tests/integration/test_staff_assignment.py`,
  `tests/frontend/role-administration.test.tsx`, `tests/frontend/session-client.test.tsx`, `scripts/assignment_checks.py`,
  `scripts/run_evaluation.py`, `scripts/pp1_browser.mjs`; private local provisioning helper
  `scripts/provision_staff.py`. Linked guidance/evidence is updated alongside this note.

No schema or merged migration changed: existing Account, AuthSession, Assignment, Review
and audit rows suffice. Schema remains `f310c1000003`. New administration APIs are additive.
The legacy POST `/cases/{id}/assign` retains its 204 additive-grant behavior, now requiring
a usable counsellor and eligible completed-processing task; processing cases return 409.
Use the new exclusive endpoint for reassignment. Strict event-union consumers must regenerate
for STAFF_ADMINISTRATION and new assignment outcomes. C2–C4 wire formats are unchanged.

Case-sensitive operations lock case, then consent, then sorted staff accounts. Staff mutation
locks staff accounts in stable order, then sessions, and never acquires case locks. Review
rechecks account/session after domain locks. Login and refresh use account-before-session
ordering, so waiting refresh cannot issue a surviving session across a staff disable.
Existing refresh rotation, replay revocation, CSRF and expiry policies remain.

The directory selects `j26_research_access` / `j26_research_refresh` through `/research-auth/*`;
admin/student/counsellor namespaces remain separate. Existing backend canonical cookie
names, HttpOnly, host-only, Path=/api/v1 and SameSite=Strict attributes remain. Local HTTP
still has Secure=false. Namespaces prevent selection collisions, not same-origin compromise.
No tokens enter browser storage. Access is 300 seconds; refresh is 3600 seconds; student
owner/consent have the fixed one-hour deadline. Refresh never extends consent.

## Verification actually executed

| Check | Result |
| --- | --- |
| Pre-increment full backend/frontend baseline | 183 / 52 passed |
| New staff/assignment backend regressions | 15 passed; final focused repeat **15 passed in 17.28 seconds**, including explicit staff-change role denials |
| Full backend (security/contracts/withdrawal included) | **198 passed**, 146.21 seconds |
| Full frontend | **58 passed** across eight files, including separate admin/research proxy-cookie assertions |
| Frontend lint / both app TypeScript | Passed |
| Affected Python Ruff / format | Passed |
| Python and TypeScript contract drift | Passed |
| Repository privacy/prohibited-file scan, UTF-8 mode | Passed |
| New PostgreSQL assignment/staff races | **4 passed**, verified disposable schema |
| Existing PostgreSQL reliability/migration harness | **13 passed**, verified disposable schema |
| Existing database `alembic check` / `current` | No new upgrade operations; `f310c1000003 (head)` |
| Docker production builds / startup | Backend and both apps built; nine services healthy |
| Existing Docker end-to-end smoke | Passed, including idempotency, human review record, withdrawal, disposal, logout, proxies and log privacy |
| Final role browser walkthrough | **Passed in 24.973 seconds**, 14 scenarios, 33 sanitized desktop/mobile screenshots; reduced motion checked |
| Natural access-expiry walkthrough | **Passed in 318.507 seconds** (5 minutes 18 seconds), actual unchanged server lifetimes |

Backend regressions deliberately cover assigned/unassigned access, exclusive replacement,
clear/replay/conflict, manual/automatic policy, expired designated staff, invalid input,
last usable admin, role/session revocation and safe field/log boundaries. PostgreSQL races
cover both assignment/review orderings, competing admin disables and refresh against staff
disable. They are bounded scenarios, not a claim of exhaustive concurrency verification.

The earlier full-repository Ruff run has 63 pre-existing C3 findings. Those are preserved;
there is no clean global-lint claim. First frontend attempts found an ambiguous test selector,
corrected to the accessible button role. Two browser attempts checked an old queue before
its fetch completed; the harness now waits for refresh completion. Failed attempts are not
counted as passes. Aggregate reports and reviewed screenshots remain outside Git in `.local`.

Final role-browser artifacts:
`.local/c1-role-browser-3450614d-f544-458f-a7b3-429110ccd5b7/`.
`report.json` records actual scenarios and elapsed time. Retain only reviewed sanitized
images/aggregate reports, never browser profile directories. Useful screenshots are
`admin-overview-desktop.png`, `assignment-confirmation-desktop.png`,
`assignments-desktop.png`, `staff-disabled-desktop.png`, `staff-session-revoked.png`,
`reassigned-counsellor-saved-review.png`, `workflow-operations-desktop.png`,
`retention-overview-desktop.png`, `protected-component-directory.png` and
`assignments-mobile-reduced-motion.png`. Interpretation content is withheld during capture;
preceding browser assertions verify actual protected retrieval. Credentials are never captured.
Body-width checks passed at 1366px and 390px. Confirmation initial focus/cancel, disable/
re-enable with fresh sign-in, withdrawal/access removal and injected stale 503 also passed.

The first two role-browser attempts, retained as failed evidence, are
`.local/c1-role-browser-01bd514b-2fad-4092-8f12-1661ea465a38/` and
`.local/c1-role-browser-2886def6-6f6b-4161-b6b5-6cecfc2a3f3f/`. A subsequent 34.082-second
passing run preceded clearer report scenario names; the final 24.973-second run above
supersedes it. No product authorization was weakened to make the browser assertions pass.

Natural-expiry artifacts:
`.local/c1-session-browser-aca1ddb7-7efb-4569-983c-521529759c94/report.json`.
Separate student/counsellor profiles and same-profile student/checklist tabs continued
through actual five-minute expiry. A shared-profile counsellor check also preserved the
student role. Recorded safe sequence: 401 AUTH_REQUIRED, `/auth/me` 401,
`/auth/refresh` 200, original retry 200; the other student tab recovered after `/auth/me`
200 without another rotation. Counsellor refresh/reload, record save/read, safe owner
receipt, completion, withdrawal/disposal and logout passed. Browser UTC
`2026-10-24T03:23:39.209Z` and coarse server Date `03:23:38 GMT` differed by approximately
-1.203 seconds including HTTP Date/transport granularity. `expiry_wait_seconds=316.055`
includes post-wait assertions; the harness explicitly waits at least 310 seconds.
Timed admin/research renewal and natural one-hour expiry were not observed; shared-client
concurrency/revocation checks and the new PostgreSQL refresh race are separate evidence.

### Reproducible commands

Run commands separately and check exit codes. Use a fresh basetemp for repeats.

```powershell
.venv/Scripts/python.exe scripts/run.py pytest tests/integration/test_staff_assignment.py -o addopts='' -q --basetemp=.local/pytest-role-targeted-20261024-a
.venv/Scripts/python.exe scripts/run.py pytest -o addopts='' -q --basetemp=.local/pytest-role-full-20261024-a
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
npm test -- --maxWorkers=1
npm run lint
npm run typecheck
.venv/Scripts/python.exe -m ruff check services/orchestrator packages/contracts/src packages/python-common/src/research_common/config.py scripts/assignment_checks.py scripts/provision_staff.py scripts/run_evaluation.py tests/integration/test_staff_assignment.py
.venv/Scripts/python.exe -m ruff format --check services/orchestrator packages/contracts/src packages/python-common/src/research_common/config.py scripts/assignment_checks.py scripts/provision_staff.py scripts/run_evaluation.py tests/integration/test_staff_assignment.py
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
npm run contracts:check
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
docker compose build orchestrator student-portal counsellor-dashboard
docker compose up -d --no-build --wait --wait-timeout 180
docker compose config --quiet
docker compose exec -T orchestrator alembic check
docker compose exec -T orchestrator alembic current
.venv/Scripts/python.exe scripts/run_evaluation.py assignment
.venv/Scripts/python.exe scripts/run_evaluation.py postgres
.venv/Scripts/python.exe scripts/compose_smoke.py
node scripts/pp1_browser.mjs --roles --staff-file .local/<private-staff-file>.env
node scripts/session_browser.mjs
git diff --check
git status --short --branch
git diff --cached --name-only
```

The staff-file argument is the ignored path returned by provisioning, never a credential
value. PostgreSQL harnesses verify their UUID schema before migrations/downgrade; they do
not downgrade the preserved development schema. No temporary directory was deleted and
no system permissions were changed.

## Private provisioning and startup

For an existing checkout, preserve `.env` and the database volume. For a fresh checkout only,
`./scripts/bootstrap-dev.ps1` generates local secrets and preserves any existing file.

```powershell
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
.venv/Scripts/python.exe scripts/provision_staff.py --role COUNSELLOR
```

The last command creates one additional synthetic local account through the existing backend
and writes generated credentials to an exclusive ignored `.local/staff-<uuid>.env`; only its
path is printed. Read that file privately in the editor. Do not paste values into terminals,
screenshots, issues or Git. ADMIN/RESEARCHER provisioning is local-operator-only and requires
an intentional authorized grant. There is no public privileged signup, password reset or
account deletion UI. Existing seeded accounts and grants are not overwritten.

Use separate student, counsellor and admin profiles; keep `/` and `/demo` in the same student
profile. Sign into `/admin/overview`, inspect the configured policy and filter your fictional
case in Assignments. Confirm replacement to the second counsellor, refresh the old queue,
and reopen its saved record in the new counsellor profile. Disable/re-enable that staff
account to demonstrate session revocation and required re-login. Withdraw as student and
refresh both counsellor queues. Admin can inspect minimal disposal receipts, never review
content. Directory sign-in is deliberately separate and only grants route metadata.

The interface uses 160ms control transitions, 180ms non-critical card entrances and a
reduced-motion override. Forms/tables never await animation; no progress/timings are invented.
Counts/screenshots are development database snapshots, not collected participant statistics.

## Remaining boundaries

Institutional allocation/notice/retention/research-access approval, real identity/TLS/at-rest
controls and real C2–C4 integrations remain external dependencies. Research/annotation routes
must receive function-specific backend authorization before links are added. This is C1
access/administration scaffolding, not C4 explanation algorithms or final dashboard research.
No clinical/usability, distributed-soak or natural one-hour-expiry result is claimed. UI
snapshots clear/recheck on requests and refresh; they are not instantaneous push revocation.
The legacy additive grant API is retained for compatibility; document its semantics for clients.
