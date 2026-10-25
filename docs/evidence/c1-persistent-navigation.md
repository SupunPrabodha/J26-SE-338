# C1 persistent workspace navigation — 2026-10-25

Branch `feature/c1-consent-orchestration`, starting HEAD `8b645c6`. The working tree was
clean at inspection. Existing functionality and records were preserved; no staging,
commit, push, branch switch, reset or database change occurred.

## Cause and change

Most internal navigation used plain HTML anchors, which requested new documents. Staff
pages also each owned their own StaffFrame/header/sidebar; even client navigation alone
would replace that page-owned shell. Student pages similarly owned duplicate navigation.

The two root Next layouts now own persistent StudentWorkspace/StaffWorkspace components.
Internal navigation, sidebar, profile menu, overview shortcuts and workspace logos use
Next Link with prefetch disabled. Logos return to their own application/workspace. Explicit
new-tab demonstration links, cross-application links and in-page anchors retain their
normal semantics. The implementation follows Next's
[shared layout](https://nextjs.org/docs/app/getting-started/layouts-and-pages) and
[client navigation](https://nextjs.org/docs/app/getting-started/linking-and-navigating) patterns.

The staff frame registration context publishes only current section, area, role label,
loading state and the active page's logout callback to the root chrome. It contains no
case, review record, intake, token or credential. Header/sidebar DOM nodes survive same-realm
route changes, including pending fresh access checks. Account controls are disabled during
those checks. A different realm cannot inherit the previous realm's authorized sidebar;
failed checks/logout remove it. These presentation flags never grant API/page access.
Each page keeps its existing authenticated requests, refresh handling and server RBAC.
Unloaded pages cannot replace the current page's shell registration during cleanup.

Admin section and account realm content are keyed explicitly so a reused route component
cannot carry staff/case/profile data into a different section or realm. The counsellor
client moved to `components/counsellor-workspace.tsx`; its thin server page validates the
`state=COMPLETED` query, passes the filter and keys content by it. The completed/all queue
links therefore work correctly through client navigation and browser history. This is
necessary because the old one-time `window.location.search` read assumed a document reload.

Only the page outlet has route-loading placeholders, with a status announcement, hidden
decorative skeletons and reduced-motion support. The shared shell remains interactive
where current access allows it. Native Link behaviour retains keyboard, modifier-key,
copy-link, open-tab and browser history semantics. No global click interception or token
storage was added. Shared UI declares the already-used Next 16.4.0 peer; npm lock metadata
matches, with no dependency version upgrade.

Student consent and case controls retain the existing in-memory lifecycle: leaving the
reflection page still discards its local control reference. Owner-scoped demo receipts
remain discoverable while that student's session is valid. Use the existing explicit
two-tab walkthrough when keeping those controls is required. Protected page contents are
not globally cached to make navigation appear fast. The non-diagnostic/human-in-the-loop
boundaries and C2–C4 ownership/provider labels are unchanged.

## Files

| Area | Files |
| --- | --- |
| Persistent root chrome and internal links | `packages/typescript-common/src/ui.tsx`; both application `app/layout.tsx`; shared package peer/lock metadata. |
| Content-only loading | Both `app/loading.tsx`; `packages/typescript-common/src/professional.css`. |
| Staff routes | `app/admin/[section]/page.tsx`, `app/admin/page.tsx`, `app/research/page.tsx`, `app/account/page.tsx`; `components/admin-console.tsx`, `admin-overview.tsx`, `account-profile.tsx`. |
| Counsellor query behaviour | Thin `apps/counsellor-dashboard/app/page.tsx`; extracted `components/counsellor-workspace.tsx`. Existing handlers/guards remain. |
| Student page bodies | `components/student-lifecycle.tsx`, `demo-checklist.tsx`: remove duplicate page-owned navigation/wrappers. |
| Tests | New `tests/frontend/persistent-navigation.test.tsx`; five existing frontend imports point to the extracted client component. |
| Browser/evidence | New `scripts/navigation_browser.mjs`, this note and README evidence link. |

## Actual verification

Host npm/browser commands use the installed local Node runtime:

```powershell
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
```

| Command | Result and scope |
| --- | --- |
| `npm test` | Final **88 passed / 13 files, 20.94 s**. The added tests assert exact header/sidebar node identity across a fresh same-realm page/check, denial cleanup, no cross-realm sidebar inheritance, and persistent student navigation. Existing auth/session/consent/review/privacy tests remain. |
| `npm run lint`; `npm run typecheck` | Passed frontend lint and both Next type generators/TypeScript checks. |
| `npm run contracts:check`; `.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check` | Passed. No API contracts, auth/session policy or migration changed. |
| `.venv/Scripts/python.exe scripts/check_repository.py`; `git diff --check` | Passed repository privacy/prohibited-file and whitespace checks. Browser profiles/reports remain ignored; no credential output retained. |
| `.venv/Scripts/python.exe scripts/run.py pytest tests/security/test_remembered_sessions.py tests/security/test_session_continuity.py tests/integration/test_withdrawal.py tests/contract -o addopts='' -q --basetemp=.local/pytest-c1-navigation-20261025-a` | **50 passed, 33.64 s**, affected session/security/withdrawal/contract checks. Fresh isolated pytest directory; existing temporary folders untouched. |
| `docker compose -f docker-compose.yml -f docker-compose.demo.yml build student-portal counsellor-dashboard` | Both production builds passed, including Next TypeScript and route generation. An initial directive-order error introduced during extraction was corrected before the successful build. |
| `docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --no-build --no-deps --wait --wait-timeout 120 student-portal counsellor-dashboard` | Both rebuilt frontends healthy; existing API/worker/DB/Redis containers and volumes preserved. |
| `.venv/Scripts/python.exe scripts/compose_smoke.py` | **PASS:** real-container mock workflow, manual assignment, review record save/read/replay, withdrawal/retention disposal, logout, both frontend proxies and safe logs. |
| `node scripts/navigation_browser.mjs --staff-file <existing-private-researcher-file>` | **PASS**, actual Edge client-navigation walkthrough; safe reports below. The harness prints no credential/cookie values or response bodies and does not modify staff accounts. |

The first production browser run passed in **11.652 s**, retaining
`.local/c1-navigation-browser-7c263d63-f078-43c5-93a0-c0e650227ed0/report.json` and two screenshots.
The extended run passed in **13.466 s**, retaining
`.local/c1-navigation-browser-cd00c930-4d5e-4a39-bed5-253a7077aadb/report.json` and three screenshots.
It verified the exact same document (`performance.timeOrigin` plus a retained window marker),
header node and sidebar node through all five admin sections, audit, profile/return,
Back/Forward, deliberately delayed page access checks, mobile drawer navigation/closure,
native Enter-key routing, counsellor completed/all query navigation, researcher
directory/profile, and student home/demo/history. A true document reload loses the marker;
a shell remount replaces the node reference, so a successful HTTP response alone cannot pass.

After the final workspace-local logo change, both images were rebuilt and started healthy.
The full browser walkthrough passed again in **11.037 s**, including an explicit logo click
returning to the admin overview with identical document/header/sidebar references. Final
report and three safe screenshots:
`.local/c1-navigation-browser-976a2eb0-9010-416a-878b-43480266ebd8/`.

Logout followed by history navigation did not restore the protected profile or sidebar.
Backend checks still enforce role/owner/assignment/consent after refresh. No new natural
five-minute or seven-day session test, benchmark, clinical result, accessibility
certification or production-readiness claim is made. This is C1 application navigation
engineering, not C4 research or institutional approval. Initial page opening, explicit
refresh, cross-application navigation and deliberate new tabs still load a document.
