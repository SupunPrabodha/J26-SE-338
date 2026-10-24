# C1 application visual design — 2026-10-24

Branch `feature/c1-consent-orchestration`, unchanged base HEAD `2dee860`. This is visual and
interaction work in the existing applications, preserving the preceding uncommitted privacy,
assignment, session and FR09 implementation. No backend permission, contract, database,
migration, token lifetime, C2–C4 research code or stored value was changed. Nothing was staged,
committed, pushed, reset, merged or switched. Existing volumes and records remain.

## References actually consulted

Official guidance was browsed before designing, on 2026-10-24:

- [IBM Carbon shell](https://www.carbondesignsystem.com/building-blocks/core/components/ui-shell-left-panel/guidelines):
  persistent secondary navigation fixed beneath a shared header; coherent shell and shallow hierarchy.
- [Microsoft Fluent navigation](https://fluent2.microsoft.design/components/web/react/core/nav/usage/):
  concise, scannable labels, consistent ordering and task-focused navigation.
- [Microsoft Fluent dialogs](https://fluent2.microsoft.design/components/web/react/core/dialog/usage):
  focused secondary tasks, labelled dismissal and a persistent header above a scrolling body.
- [Ant Design tables](https://ant.design/components/table/): readable column structure,
  separate actions, filtered data and bounded pagination/scrolling.
- [Ant Design dropdowns](https://ant.design/components/dropdown/): compact contextual account actions.

These are pattern references for an original design, not imported component packages or
screens copied from those systems. No icon library was installed in this checkout; the
shared small code-native SVG outline set replaces inconsistent circles/arrows in navigation
without adding a dependency. No external fonts, image assets or tracking requests were added.

## Delivered design

The staff rail is 250px, fixed flush left below the 72px header, with independent scrolling,
outline icons, a visible active indicator and concise navigation groups. Its forest palette
is `#103B32` / hover `#194C40` / active `#246351`; canvas `#F5F7F8`, text `#172B27`.
The header brand and rail align. The mobile drawer retains native modality, keyboard support,
focus restoration and closing on navigation. Student content keeps its bounded reading width.

Role-aware navigation omits admin routes for counsellors/researchers and case-workspace links
for researchers. Backend authorization remains authoritative. The directory uses the same
staff frame and its existing research authentication realm; a directory login grants no
additional case, dataset or administration access.

A neutral account icon, actual role and click dropdown replace full-width staff session
panels. No name/email/avatar identity is fabricated. Arrow keys, Escape, outside pointer,
focus restoration, disabled/busy states and the existing logout callbacks are supported.
Actual authentication failures and revocation remain visible and clear protected data.

The compact line “Screening support only · Mock data” links to **About this prototype**.
The small labelled dialog retains diagnosis/treatment, counselling replacement, emergency,
human interpretation and fictional-data boundaries. The complete student consent/privacy
notice remains available before consent, with essential data-use guidance beside input.
Repeated banner/header/sidebar/footer warnings are removed. The footer identifies the workspace.

Shared tokens, readable table text, form alignment, restrained surfaces, semantic status
styles and subtle transitions apply across student, demo, counsellor, admin and directory
pages. Partial requirements are amber, missing red, approval dependencies purple, recorded
or unexercised evidence neutral and verified evidence green. Text labels remain present;
colour alone does not communicate state. The six privacy groups, owner scope, distinct
implementation/evidence dimensions and all requirement mappings remain unchanged.

The run's status facts now form a compact summary. Case identifiers and Details actions have
separate space; full identifiers remain in authorized dialogs/native details. Administrative
workflow/disposal/job labels are human-readable without changing API enums. Operational
charts still use actual restricted data and retain definitions, UTC scope, exact-count tables,
empty states and source-case filters. No research metric is invented. C4 chart limitations
remain visible, with longer explanation/provider details under a disclosure. Saved review
retrieval and immutable recording are unchanged.

Reduced-motion preferences disable transitions/animations. No artificial load time, scroll
reveal or new training/dataset/evaluation-on-load behaviour exists.

## Changed files for this increment

- `packages/typescript-common/src/ui.tsx`: outline icons, compact disclosure, account menu,
  role-aware shared shell, readable labels/status badges.
- `packages/typescript-common/src/styles.css`: shared palette, typography, forest rail,
  header/menu/drawer, tables/filters, statuses and responsive presentation.
- Staff `app/page.tsx`, `app/admin/page.tsx`, `app/research/page.tsx`,
  `components/admin-console.tsx`, `operational-charts.tsx`, `explanation-availability.tsx`:
  shared account callbacks, compact UI, readable statuses and identifier details.
- Student `components/student-lifecycle.tsx`, `demo-checklist.tsx`: compact session/run facts,
  evidence hierarchy and explicit status styling. Consent/idempotency/polling logic unchanged.
- `tests/frontend/visual-shell.test.tsx`: seven new regression cases. Existing
  `shells.test.tsx`, `admin-evidence.test.tsx`, `role-administration.test.tsx` now assert the
  accessible disclosure/account/human-readable presentation while retaining denial checks.
- `scripts/pp1_browser.mjs`, `session_browser.mjs`: operate the actual account dropdown,
  await ready editor fields, inspect polished shells and retain safe screenshots.
- `scripts/compose_smoke.py`: verify the required visible screening-support/mock-data
  disclosure instead of the removed repeated footer wording. Other smoke checks are retained.
- This evidence note, README link and dated link from the preceding privacy increment.

Before-edit copies of touched UI/browser files were retained in ignored
`.local/visual-design-before-20261024-a/`. No previous uncommitted work was reverted.

## Verification

Frontend: **79 tests passed** across 11 files, including the seven new interaction cases.
Both applications passed TypeScript; frontend/script lint passed. Python security and
contract suites: **33 passed** (5 contract, 18 auth, 3 secret-configuration, 7 session tests).
Python and TypeScript contract drift, scoped C1 Ruff/formatting, repository candidate-file/
privacy scan and `git diff --check` passed. Both frontend production images built successfully.

The first Python invocation incorrectly named `tests/contracts`; it collected no tests and
is not counted as a pass. The corrected invocation below used `tests/contract` and a fresh
temporary directory. Early browser attempts are not passing evidence: one expected raw enum
text after labels became readable, and another attempted to fill an editor before its field
was mounted. The browser helper now waits for an enabled field. A browser-test counsellor
left disabled by that interruption was restored through the existing ADMIN API using its
private ignored fixture file; no other staff record was changed by that restoration.

Final production browser walkthrough **passed in 61.059 seconds**, Edge `155.0.4283.62`,
with **75 privacy-checked screenshots** and `report.json` retained only in ignored
`.local/c1-visual-browser-eac32b8b-9aac-4fe2-a770-ad620955b9f9/`.
It exercised accepted/rejected consent, pending/accepted/unconfirmed/rejected submissions,
same-key recovery, evidence and prototype dialogs, account keyboard dismissal/logout,
manual assignment, saved-review retrieval, reassignment, staff disable/revocation/re-enable,
directory boundaries, all six admin routes on desktop/mobile, sidebar positioning under
scroll, mobile drawer navigation, reduced motion, withdrawal/disposal/access denial,
stale evidence and multiple-run ownership. The final builds include the semantic disabled/
expired/rejected/mock badge styles and collapsed secondary operator details.

A separate all-admin-route run passed in **10.459 seconds**, with 25 captures in
`.local/c1-visual-browser-53ecef9a-e754-48e1-b220-55d8ffc69a34/`.
Desktop navigation, saved-review, compact checklist and mobile drawer screenshots were
visually inspected, in addition to geometry/focus assertions. Representative computed text
contrast: active navigation **7.05:1**, navigation text **10.41–12.40:1**, secondary body text
**5.69:1**. These exceed 4.5:1 for the measured pairs, not a claim of complete WCAG compliance.

Native headless Edge pointer delivery produced no DOM pointer/click events for one staff
re-enable action after another profile's revocation closed its modal. The harness first
checks visibility/obstruction, then uses explicit CDP user-gesture activation of the same
enabled button only if no native click occurred in that re-enable stage. This was recorded
in the successful report; it is not a duplicate request or a backend authorization shortcut.
Other representative menu, dialog, editor and navigation controls used native pointer and
keyboard input. Manual cross-profile pointer re-enabling remains a browser-automation limit.
Earlier protocol timeout and rate-limited attempts are not passing evidence; rate limits,
token settings and authorization were never relaxed. The isolated editor reopen/restore
check passed, retaining its local helper under `.local/` rather than adding another app.

All nine services were healthy and the final Docker smoke passed: PostgreSQL/Redis,
worker/C1–C4 mock workflow, concurrent idempotency, assignment/chart parity, review
save/read/replay, withdrawal and retention disposal, subsequent access denial, logout,
frontend proxies and container log privacy. Its first attempt found an obsolete footer
copy assertion; the updated assertion requires both pieces of the new visible compact
disclosure. The corrected final smoke passed.

| Layout comparison | Before (previous privacy increment) | After (this increment) |
| --- | --- | --- |
| Admin staff | `.local/c1-privacy-ui-browser-d7e38fe9-6e3f-4a02-bf49-4259e2af2f93/privacy-admin-staff-desktop.png` | `.local/c1-visual-browser-eac32b8b-9aac-4fe2-a770-ad620955b9f9/privacy-admin-staff-desktop.png` |
| Mobile navigation | Same prior directory, `privacy-mobile-navigation-drawer.png` | Same current directory, `privacy-mobile-navigation-drawer.png` |
| Counsellor saved review | Same prior directory, `counsellor-saved-review-desktop.png` | Same current directory, `counsellor-saved-review-desktop.png` |
| Owner checklist | Same prior directory, `demo-consent-observed.png` | Same current directory, `demo-consent-observed.png` |

Comparisons are different synthetic runs, not identical dataset snapshots or pixel benchmarks.
Interpretation text is masked in retained screenshots; no credential-bearing screenshots or
network traces were retained. Pending/503/422/lost-response scenarios use controlled browser
injections; no real service outage was induced. No natural one-hour expiry was awaited.

Earlier 207-backend/72-frontend and five-minute session results in `c1-privacy-ui.md` are
historical, not current-run totals. No database/locking code changed, so the full backend and
dedicated PostgreSQL locking evaluator were not rerun for this presentation increment.
This is functional/browser engineering evidence, not C4 usability or clinical evaluation.

Controlled session browser check **passed**, reported scenario elapsed **5.282 seconds**,
in `.local/c1-session-browser-80d005c8-4d23-413a-aadf-326918ebec07/report.json`.
It removed only access cookies in isolated test contexts (not server JWT expiry or a natural
five-minute wait), observed 401 `AUTH_REQUIRED`, successful refresh and retried 200 responses,
student `/`/`/demo` continuity, application isolation, manual assignment, review save/read,
withdrawal/disposal and account-menu logout surviving reload. No configured lifetime or
consent gate changed. The first controlled attempt opened the account control while it was
intentionally disabled during queue refresh; its helper now waits for that refresh to finish.
That failed attempt is not counted as a pass. Browser/server UTC skew was approximately 0.516s.

Commands executed from the repository root in PowerShell, checking exit codes:

```powershell
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
npm test -- --maxWorkers=1
npm run lint
npm run typecheck
npm run contracts:check
.venv/Scripts/python.exe scripts/run.py pytest tests/security tests/contract -q --basetemp=.local/pytest-c1-visual-20261024-b
.venv/Scripts/python.exe scripts/run.py pytest tests/security tests/contract --collect-only -q
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
.venv/Scripts/python.exe -m ruff check services/orchestrator packages/contracts/src
.venv/Scripts/python.exe -m ruff format --check services/orchestrator packages/contracts/src
.venv/Scripts/python.exe -m ruff check scripts/compose_smoke.py
.venv/Scripts/python.exe -m ruff format --check scripts/compose_smoke.py
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
docker compose -f docker-compose.yml -f docker-compose.demo.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.demo.yml build student-portal counsellor-dashboard
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --no-build --wait --wait-timeout 180
node scripts/pp1_browser.mjs --polished --staff-file .local/staff-13e7e44063dd46a689ecb45184e68d71.env
node scripts/session_browser.mjs --manual --quick-expiry
.venv/Scripts/python.exe scripts/compose_smoke.py
git diff --check
git status --short --branch
git diff --cached --name-only
```

Use a fresh pytest basetemp when repeating. The private staff-file path is local to this
workspace; provision a separate synthetic counsellor with the existing local operator helper
when running elsewhere. Never print credentials, notes or browser traces. Existing app
startup is unchanged: preserve `.env` and run the manual-demo Compose override above.

Remaining boundaries: HTTP localhost/TLS, storage encryption, institutional notice/policy
approval, development identity, real C2–C4 integration and formal accessibility/human evaluation
remain outside this visual increment. Wide administrative tables intentionally scroll inside
their labelled region on small screens; no columns or identifiers were removed to hide them.
