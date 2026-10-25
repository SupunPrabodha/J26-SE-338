# Staff entry, profile and directory UI — 2026-10-25

Branch `feature/c1-consent-orchestration`, baseline HEAD `8078419`.
The existing untracked `docs/handover/` document was preserved. Changes remain uncommitted;
nothing was staged, pushed, merged, reset or switched. Existing database records, volumes,
credentials and backend containers were preserved. Only the two frontend containers were
recreated from the final images. No account, role or credential was provisioned/changed.

## Findings and changes

The supplied screens showed a full-width content area, excessive space above a tall sign-in
card, a role error separated from the form, and an expired profile with scattered recovery
actions. These were presentation/recovery issues, not proof that consent had expired.

- Bound the staff entry/profile/directory content width, compact the page introduction and
  retain existing artwork in a balanced desktop sign-in card. Mobile prioritizes the form
  and hides the decorative image. Critical sign-in controls fit the tested viewport.
- Place authentication/role errors inside the sign-in panel and associate them with the
  form. Preserve role denial and the Completed filter. Disable credential fields during
  submission. Add an accessible, non-submit Show/Hide password control; no password is stored
  or exposed outside the existing input. Remember me remains unchecked by default.
- Put verbose access/session guidance in a disclosure while keeping device/session/consent
  limits visible. Keep prototype/non-diagnostic disclosure available.
- Replace the unstructured expired-profile state with a role-specific recovery card,
  primary workspace sign-in link and retry action. Distinguish authentication expiry,
  forbidden access, explicit logout and network/service failure. Protected values are still
  removed before revalidation and on access loss; focus rechecks and server guards remain.
- Split the authorized profile into account/session panels and a role-specific access note.
  Use safe existing fields only; no new profile API fields, credentials or counselling data.
- Give directory entries consistent component labels, honest Mock provider/Internal API only
  labels, scope summaries and protected provider details. Do not add nonexistent service web
  routes, research outputs, model timings or dataset access.
- Remove the researcher's duplicated directory navigation entry and use the account icon
  for profile navigation. Preserve persistent root headers/sidebars and internal Link routing.

## Files

| Area | Exact files |
| --- | --- |
| Shared sign-in/navigation and presentation | `packages/typescript-common/src/ui.tsx`, `packages/typescript-common/src/professional.css` |
| Profile and directory | `apps/counsellor-dashboard/components/account-profile.tsx`, `apps/counsellor-dashboard/app/research/page.tsx` |
| Consistent form-error placement on existing staff pages | `apps/counsellor-dashboard/components/counsellor-workspace.tsx`, `components/admin-console.tsx`, `app/admin/page.tsx` under the same app |
| Focused regression coverage | `tests/frontend/staff-entry-profile.test.tsx` — four new tests included in the full frontend total |
| New actual browser verification | `scripts/staff_entry_browser.mjs` |
| Existing browser selectors updated for the new controls/markup | `scripts/navigation_browser.mjs`, `scripts/staff_session_browser.mjs`, `scripts/completed_reviews_browser.mjs` |
| Screenshot guards for the password visibility control | Capture-enabled harnesses above plus `scripts/pp1_browser.mjs` and `scripts/session_browser.mjs` check password field names as well as input types |
| Evidence | This note; the preceding handover is unchanged |

The form now has a second button, so existing harnesses explicitly target the submit button.
The redesigned protected profile uses `.profile-grid` and `.profile-actions`; harnesses no
longer wait for removed `.account-profile`/`.demo-nav` elements. These selector updates do
not bypass the actual UI handlers or backend authorization. Screenshot guards reject
populated password inputs even when Show changes their type to text. The final guard-only
update passed frontend/script lint; older PP1/session walkthroughs were not rerun solely
for that stricter selector.

## Verification actually executed

Final host commands use Node **22.23.3**, npm **10.9.9** and the existing isolated locked
Python **3.12.12** environment. No dependency installation/sync or lockfile change was needed.

```powershell
$taskNode = (Resolve-Path '.local/node-runtime/node_modules/node/bin/node.exe').Path
$taskNpm = (Resolve-Path '.local/c1-ci-node-tools/node_modules/npm/bin/npm-cli.js').Path
$taskPython = (Resolve-Path '.local/c1-ci-review-c9d15160c74a452fa345c7536a247cd8/ci-python/Scripts/python.exe').Path
$env:PATH = (Split-Path $taskNode) + ';' + $env:PATH
```

| Command | Actual result and scope |
| --- | --- |
| `& $taskNode $taskNpm run lint` | Passed, including the new/updated browser harnesses. |
| `& $taskNode $taskNpm run typecheck` | Passed both applications; final production builds also passed TypeScript after subsequent presentation refinements. |
| `& $taskNode $taskNpm test -- --maxWorkers=1` | Final **94 passed / 15 files, 44.01 seconds**. Earlier runs of the same suite were separate, not added. Includes password-toggle/non-submit/busy semantics, form-associated errors, expired-profile recovery, network retry without false expiry, directory restrictions and unique researcher navigation. |
| `& $taskNode $taskNpm run contracts:check` | Passed TypeScript contract drift. |
| `& $taskPython scripts/run.py pytest tests/security/test_remembered_sessions.py tests/security/test_session_continuity.py tests/integration/test_withdrawal.py tests/contract --basetemp=.local/pytest-entry-ui-20261025-a` | **50 passed, 23.26 seconds**, one existing upstream Starlette/httpx deprecation warning. Fresh temp folder; no old folder deletion or permissions changes. |
| `& $taskPython scripts/run.py scripts.generate_contracts --check` | Contract artifacts verified. |
| `& $taskPython scripts/check_repository.py`; `scripts/check_ci.py` through that interpreter | Candidate/privacy and CI structure passed; hosted CI not executed. |
| `& $taskPython -m ruff check .`; `-m ruff format --check . --output-format concise` | Passed; 176 files formatted before this evidence note was added. No Python application changes. |
| `docker compose -f docker-compose.yml -f docker-compose.demo.yml build student-portal counsellor-dashboard` | Both final Next.js **16.4.1** production builds passed, including TypeScript. |
| Same Compose files with `up -d --no-build --no-deps --wait --wait-timeout 120 student-portal counsellor-dashboard` | Both final frontends healthy; API/worker/database/cache containers and volumes retained. MANUAL assignment policy unchanged. |
| `& $taskNode scripts/staff_entry_browser.mjs --staff-file <existing-private-researcher-file>` | Final **PASS, 4.182 seconds**, Edge **155.0.4283.62**, 12 named safe observations/checks and 11 screenshots. |
| `& $taskNode scripts/navigation_browser.mjs --staff-file <existing-private-researcher-file>` | Final **PASS, 7.929 seconds**, Edge155; 22 recorded checks/observations and three screenshots. Exact document/header/sidebar identities preserved across routes. |
| `& $taskPython scripts/compose_smoke.py` | PASS: service/PostgreSQL/Redis/worker health, mock C1–C4 workflow, concurrent idempotency, assignment, protected review/actions/save/read/replay, disposal/withdrawal/retention, logout, frontend proxies and log privacy. |
| `git diff --check`; `git diff --cached --name-only` | Whitespace checks pass; staging empty. |

Browser viewport checks cover **1440×900** sign-in/directory/authorized profile,
**1600×1000** unauthenticated profile and **390×844** mobile pages/provider dialog.
No horizontal overflow was observed; both tested desktop sign-in buttons were within the
viewport. Mobile research sign-in also had its submit control within the measured viewport.
Profile/directory pages scroll normally for their content. No fixed-height clipping is used.

The browser checks used the existing synthetic researcher to verify actual login/profile/
directory/provider-dialog/logout and wrong-role denial in the counsellor Completed entry.
Fields were checked empty before each screenshot; no credentials, network bodies, tokens or
private review text were retained. Screenshots of the authorized profile contain only its
existing minimal synthetic account/session metadata and remain private/ignored.

The first wider navigation attempt stopped after 12 successful persistent-layout checks
because it waited for the old `.account-profile` selector. After updating the selector, the
entire run passed, including admin/profile/Back/Forward/mobile/keyboard/counsellor Completed
query/research/student routes and logout/history revocation. This was a harness mismatch,
not an authentication or application-navigation failure. The page-specific browser walkthrough
had already passed independently. No application control was bypassed to make it pass.

Final retained browser artifacts:

- `.local/c1-staff-entry-browser-365bbf57-df1a-4294-99bc-9a870f0b8d01/report.json`
  and its 11 PNGs. Earlier visual review used the preceding 4.840-second report/screenshots;
  final repeat includes the duplicate-navigation/mobile-action refinement.
- `.local/c1-navigation-browser-678395e6-5062-464b-8aa9-0c67ec3d319c/report.json`
  and three PNGs.

## Limits and review

No backend auth policy, lifetime, consent/assignment/retention rule, shared API contract,
database schema, research algorithm or stored credential changed. No natural five-minute/
seven-day wait, complete backend suite, new registry audit, formal usability/accessibility
study, or hosted CI run is claimed for this UI increment. Earlier evidence retains its dates.
Current local HTTP/TLS, storage-encryption, real-provider and institutional-approval limits
remain. Browser coverage is current Edge, not a cross-browser certification.

The running demo now serves the final frontends. Refresh existing tabs once to load their
new build; subsequent internal navigation retains the shared shell. Use the existing
role-specific sign-ins; an ended session still requires valid sign-in. Researcher pages
remain metadata-only; no dataset/private-review permission was introduced.

Suggested review message: `feat(ui): refine staff sign-in profile and directory experience`.
All changes stay uncommitted; the preceding untracked handover is preserved.
