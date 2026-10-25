# C1 student and administration visual redesign — 2026-10-25

Branch `feature/c1-consent-orchestration`, HEAD `15f4a81`. The preceding readiness audit,
NFR05 correction, contract regressions and documentation were already uncommitted at the
start and remain preserved. No staging, commit, push, merge, branch switch or reset occurred.
Before-edit copies of touched existing files are retained only in ignored
`.local/c1-professional-before-dbe6aa014985473fa00fea4244634e58/`.

## Delivered interface

The student application has an original illustrated introduction, forest/ivory/sage palette,
editorial heading, working consent/how-it-works anchor links, three short explanatory
principles and a structured reflection workspace. Consent, submission and status/withdrawal
retain the existing state and API behaviour. The consent anchor moves keyboard focus and
remains visible below the sticky navigation. On mobile the artwork becomes a separate
image panel, principles stack, and the steps remain compact. The `/demo` evidence page
uses a coordinated botanical header and tab styling; all independent implementation,
selected-run and historical-evidence labels remain.

Administration has a new overview introduction with decorative consent/access/traceability
art, direct links to real assignment and audit routes, eight icon-labelled **API-supplied**
counts, a separate assignment-policy panel and the existing filter-matched charts. No metric
was invented or animated into existence. Staff, assignment, audit, workflow and retention
pages share the refined cards, filters, tables, typography and fixed navigation. Long admin
tables have a 600px maximum scroll viewport and sticky column headers; source records,
filters and pagination are unchanged. Decorative orbit/node shapes are `aria-hidden` and
are not live workflow or test results.

The shared staff sign-in presentation now has a two-column illustrated introduction and
form, stacking on mobile. This also coordinates the existing counsellor/research shells;
it changes no account permissions or C2–C4 research work. All credential fields remain
inside the existing forms and are reset through existing handlers. No login values enter
artwork, screenshots or source. System fonts and local assets avoid external font/image
requests. Focus styles, reduced-motion handling and native dialogs remain intact.

This is C1 integration presentation, not a C4 final-dashboard research contribution,
usability study or clinical result. Synthetic/non-diagnostic disclosures, the full consent
notice and counsellor-assisted human authority remain visible or directly accessible.

## Files in this increment

| File | Change |
| --- | --- |
| `packages/typescript-common/src/ui.tsx` | Stateless ReflectionHero/ReflectionPrinciples/WorkspaceIllustration, related outline icons, staff-area attribute, shared illustrated sign-in. Existing auth/menu/dialog behaviours preserved. |
| `packages/typescript-common/src/professional.css` | New shared presentation layer: responsive hero, art, shapes, cards, overview metrics, table viewports, sign-in and evidence styling. Original base stylesheet preserved. |
| `apps/student-portal/app/globals.css`, `apps/counsellor-dashboard/app/globals.css` | Import the new layer after existing shared styles. |
| Both `app/layout.tsx` files | Appropriate Wellbeing student/staff page metadata. |
| `apps/student-portal/components/student-lifecycle.tsx` | New hero/principles/workspace layout and section anchors. Consent, requests, guards, retries and disposal handlers unchanged. |
| `apps/student-portal/components/demo-checklist.tsx` | Evidence header treatment and student theme wrapper; polling/status logic unchanged. |
| `apps/counsellor-dashboard/components/admin-overview.tsx` | Extracted overview presentation using existing AdminOverview values and OperationalCharts. |
| `apps/counsellor-dashboard/components/admin-console.tsx` | Render the new overview component inside the existing protected branch. |
| Both `public/images/wellbeing-garden.webp` assets | Original generated decorative artwork, self-hosted. |
| `infrastructure/docker/frontend.Dockerfile` | Copy the selected application's public assets into its existing standalone production image. |
| `scripts/pp1_browser.mjs` | Bring screenshot targets and the owner review-status check to the foreground before CDP operations. Preserves the preceding audit diagnostics and existing re-enable fallback. |
| This note, README, checklist presentation link | Current design/asset/verification evidence; earlier audit findings/results remain historical. |

No backend, authentication/session implementation, contract, generated contract consumer,
database schema, consent policy, retention policy or research implementation changed.

## Original artwork and saved paths

Created with the **built-in imagegen tool**, not the API/CLI fallback. No reference image,
participant data, existing photo or external stock image was used. The selected PNG was
visually inspected, then resized/encoded as WebP for asset delivery without changing its
depicted content. Each application serves a local copy at `/images/wellbeing-garden.webp`:

- `apps/student-portal/public/images/wellbeing-garden.webp`
- `apps/counsellor-dashboard/public/images/wellbeing-garden.webp`

Each is **1600 × 800 pixels, 120,872 bytes**. Original generated PNG remains outside the
repository under Codex's generated_images directory. Public images are deliberately
decorative (`alt=""`); essential notices, controls and evidence are HTML, not image text.

Final generation prompt:

> Use case: stylized-concept. Asset type: original editorial hero illustration for a professional university student wellbeing screening-support website. Create a sophisticated, calm, softly dimensional papercut / matte clay 3D illustration: an open cream journal on a curved sage-green garden terrace, a small terracotta cup, sculptural botanical leaves and gentle stepping-stone arches suggesting a reflective journey. Delicate warm natural light, tactile paper grain, understated premium editorial art direction, forest green, soft sage, warm ivory, muted apricot, small pale gold accent. Wide landscape composition, illustration clustered toward the center and right, clear softly colored negative space at left, balanced clean organic architecture, beautiful soft shadows and atmospheric depth. Image only, not a UI screenshot. No people, faces, medical symbols, diagnosis, wellness metrics, logos, letters, text or watermarks. Suitable as decorative artwork behind/alongside accessible HTML text; no essential information in image. Output a polished landscape bitmap.

## Actual verification

| Check | Current result / scope |
| --- | --- |
| Existing frontend regressions | **79 passed**, 11 files, 12.50 s. Consent gates, privacy/access, session handling, saved records, assignment and dialog regressions retained; no implementation-mirroring style unit tests added. |
| Lint / TypeScript | Passed; both applications typechecked. Final production builds also typechecked after the last CSS adjustment. |
| Python and TypeScript contract drift | Passed; no wire contract changes. |
| Repository secret/prohibited-file/frontend privacy scan; whitespace | Passed. Existing `.env`, local fixture credentials and browser artefacts remain ignored. |
| Production image builds | Both passed, including the new public-asset copy. Only the two frontend containers were recreated; existing backend services, settings, records and volume preserved. |
| Docker runtime | All nine services healthy; Compose configuration valid without printing expanded secrets. |
| Docker smoke | PASS: actual mock workflow, concurrent idempotency, configured assignment and chart/table parity, review save/read/replay, safe owner receipt, disposal/withdrawal/repeat withdrawal, access denial/logout, frontend proxies and container log privacy. Executed before the final table-height-only refinement; final browser flow below ran after it. |
| Final multi-profile production browser | **PASS 54.216 s**, Edge 155.0.4283.62, **75 privacy-checked screenshots**. Accepted/rejected/pending/uncertain submissions, manual allocation, saved review/reopen/reassignment, staff revocation/re-enable, role boundaries, admin evidence/provenance disposal, withdrawal, logout, stale state, six admin routes at desktop/mobile, dialogs/focus/drawer and reduced motion. Current C2–C4 processing remains mocked. |
| Final responsive preview | **PASS 3.943 s**, nine screenshots: student 1920/820/390px; admin sign-in and overview 1920/390px; evidence desktop/390px. Images loaded successfully; no page horizontal overflow. Consent anchor focus/visibility passed. Bounded source-case table scrolling and sticky header geometry passed. |

The first multi-profile attempt timed out on a CDP protocol request at `fresh_submission`
after manual assignment and workflow evidence. It is **not** counted as a pass:
`.local/c1-visual-browser-aff18650-ba9f-4da4-891f-00a444f21e39/`.
No endpoint/error code establishes an application/session/consent failure from that timeout.
After explicitly foregrounding capture/check targets, the final run completed. No token
lifetimes, permissions, server limits or consent guards were relaxed.

The existing headless re-enable limitation recurred in the passing report: the enabled,
unobscured button received no native CDP click, and the already documented same-button
user-gesture activation was used. That is not physical mouse verification or a backend
authorization bypass. See `c1-final-pp1-audit.md`; ordinary cross-profile physical input
confirmation remains outstanding. No new session or five-minute natural-expiry claim is
made by a 54-second design walkthrough; valid retained session evidence remains separate.

Representative measured text contrast: active staff navigation 7.05:1, other navigation
10.41–12.40:1, secondary body text 5.49:1. These are measured pairs, not full WCAG
certification. Desktop/mobile student, admin overview, sign-in and evidence screenshots
were visually inspected as well as checking geometry. No human usability study was run.

Retain ignored, masked screenshots/reports privately:

- Final workflow: `.local/c1-visual-browser-1f1dce7d-854b-4f10-b454-bd285689e088/report.json`.
- Final responsive/table check: `.local/pp1-browser-a0ddf204-4225-498e-be64-d12f8a9193a2/report.json`.
- Earlier responsive preview before the table-height refinement:
  `.local/pp1-browser-48b90da8-96ce-4439-aa18-b7b69df6ab6f/report.json`, PASS 4.861 s.

Useful final captures: `professional-student-1920.png`, `professional-student-390.png`,
`professional-admin-overview-1920.png`, `professional-admin-overview-390.png`,
`professional-admin-signin-1920.png`, `professional-admin-signin-390.png` in the final
responsive directory; each final admin route additionally has desktop/mobile captures in
the workflow directory. Capture refuses filled credential fields and masks interpretation
content. No network trace or unrestricted log was retained in Git.

Commands executed from the repository root (PowerShell):

```powershell
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
npm test -- --maxWorkers=1
npm run lint
npm run typecheck
npm run contracts:check
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
docker compose -f docker-compose.yml -f docker-compose.demo.yml build student-portal counsellor-dashboard
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --no-deps --no-build --wait --wait-timeout 120 student-portal counsellor-dashboard
.venv/Scripts/python.exe scripts/compose_smoke.py
node scripts/pp1_browser.mjs --polished --diagnose-input --staff-file .local/staff-13e7e44063dd46a689ecb45184e68d71.env
node .local/c1-professional-preview.mjs
node .local/c1-professional-preview-final.mjs
docker compose ps --format '{{.Service}} {{.Status}}'
docker compose -f docker-compose.yml -f docker-compose.demo.yml config --quiet
git diff --check
git status --short --branch
git diff --cached --name-only
```

The extra synthetic staff file is an existing ignored local fixture, not a public
configuration example. Preview helpers derive existing CDP/safe-capture functions and read
local credentials privately; the preview visits only public UI and authorized admin metadata.
No credentials should be copied into commands or evidence. Dedicated PostgreSQL concurrency,
full backend, dependency audits and research evaluation were not rerun for presentation-only
changes; no database/concurrency/backend code changed. This does not replace their retained
evidence or expand any research completion claim.

## Review the running result

- Student: `http://localhost:3000/`
- C1 evidence: `http://localhost:3000/demo`
- Administrator: `http://localhost:3001/admin/overview` (existing private ADMIN sign-in)

Refresh the browser to load the rebuilt assets. Use separate profiles for student, admin
and counsellor, with student `/` and `/demo` in one profile. Existing consent, assignment,
review, withdrawal and retention policy still apply. No cloud publication was performed.
