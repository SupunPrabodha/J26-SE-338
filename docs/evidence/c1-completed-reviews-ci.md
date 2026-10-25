# Completed reviews, researcher access and CI repair — 2026-10-25

Branch `feature/c1-consent-orchestration`, HEAD `8b645c6`. The reported failure references
`960df379c393dc198005b09d72f63312dfafb5e5`; the current checkout was inspected independently.
The preceding persistent-navigation work was already uncommitted and is preserved.
Nothing was staged, committed, pushed, reset, merged or switched. Before-edit copies and
machine-readable checks for this increment are in ignored
`.local/c1-ci-review-c9d15160c74a452fa345c7536a247cd8/`.

## Completed reviews: findings and bounded fix

The queue API and protected record endpoints already enforce current role, assignment,
consent purpose/version/status/expiry, case expiry and disposal. No authorization or
deletion rule was relaxed. At the first metadata-only database inspection, the configured
counsellor had **three assigned COMPLETED cases**, **three saved records** and **three
explicit COMPLETE_REVIEW actions**. **All three completed cases had expired consent**.
There were also one READY_FOR_REVIEW and one UNDER_REVIEW assignment. The empty completed
list for those original cases was therefore expected. No private interpretation, linkage
or credential value was included in that inspection output. Remembered staff sessions
do not extend the student's fixed one-hour consent deadline or restore deleted content.

An independent frontend defect was confirmed: opening `/?state=COMPLETED` while signed out
correctly selected that initial filter, but successful login unconditionally replaced it
with the empty/all-cases filter. Login now retains `initialState` and resets offset to zero.
Initial queue reads also reset offset explicitly; the existing dropdown change already
resets pagination. The previous client-navigation fix for query-aware route keys remains.

The completed view now has an appropriate page heading, subtitle, toolbar, refresh label,
queue caption and empty-state explanation. It distinguishes processing completed, a saved
record and explicitly completed human review. The empty state describes current assignment,
consent, retention, withdrawal/disposal and reassignment exclusions without revealing
another person's cases. Completed records remain immutable/read-only under the existing
protected API. No new API fields, schema, migrations or clinical behaviour were introduced.

The API intentionally orders eligible tasks by task creation time and UUID, with bounded
offset pagination; this was not changed into a claim about review-completion recency.
Filters do not make expired/disposed/reassigned cases visible. Creating or saving a record
does not set COMPLETED: the existing explicit human action is required.

New frontend regressions cover signing in on the completed URL, correct wording, resetting
offset 20 to zero on a filter change, read-only reopening and refreshing a saved completed
record. The new backend scenario checks processing → start → save without completion →
explicit completion → repeated list/retrieve → foreign counsellor denial → owner withdrawal
→ list removal and protected-record denial. Existing expiry/reassignment/role tests remain.

Actual production Edge walkthrough: **PASS, 6.180 s** in
`.local/c1-completed-browser-032d340d-76f6-4ea6-b332-e2747bc49cf1/report.json`.
It created one new synthetic owner/case, assigned only that case, saved through the real
counsellor UI, explicitly completed, used the completed sidebar link, reopened read-only,
refreshed the list, reloaded the browser page at the completed URL and retrieved again.
After owner withdrawal through the UI, the case disappeared and the record endpoint returned
**404 NOT_FOUND**. No private review content, cookie values, credentials or traces are in
the report. An earlier harness run reached all retrieval checks but used `.danger` instead
of the existing `.danger-outline` withdrawal trigger; that selector was corrected in the
harness. This was not an application withdrawal defect. Synthetic test cases/receipts are
additional development fixtures; original expired consent was never extended or replaced.

## Researcher account

One usable local RESEARCHER account already existed. No account was duplicated, no password
or role/enabled flag was changed and no public privileged registration was added. Login and
landing are `http://localhost:3001/research`; profile is `/account?workspace=research`.
The existing private ignored credential file remains the source of the login handle and
password; its location and username are supplied to the requesting operator separately,
not published in tracked documentation. The account ID remains
`00f6b4dc-cb5f-4188-a1a9-cae432b88f89`.

Actual researcher/Remember-me Edge run: **PASS, 11.917 s** in
`.local/c1-remember-browser-940f653c-7b48-43d2-8bdd-10525b4c4c84/report.json`.
It verified working login, directory-only sidebar, own profile, checked session persistence
over actual process restarts, renewal after access-cookie removal, logout across restart
and the existing unchecked one-hour policy. Access remains 300 s; checked sessions remain
bounded by the original configured 604800 s absolute deadline. Browser admin/review requests
were denied with 401 because that realm's cookies were absent. Backend tests independently
authenticate as RESEARCHER and assert 403 for admin/staff/audit/review/owner-demo APIs.
Current C2–C4 entries are honestly labelled mocks with no connected research web pages.
No datasets, annotation access, private counselling access or research results are granted.
No new natural seven-day session observation is claimed.

## Dependency audit

The first audit reproduced three vulnerable dependency entries: **two high and one critical**,
not just the originally reported undici findings. Advisory applicability was inspected;
presence is not a claim that an exploit occurred in this checkout.

| Dependency | Before → after | Path/scope and rationale |
| --- | --- | --- |
| `undici` | **8.11.2 → 8.12.3** | `jsdom@30.1.2 → undici`, development/test tooling. The existing `^8.11.2` range accepts the patched release. EventSource memory use, SRI parsing and excessive content-encoding advisories affect versions below 8.12.2. No jsdom upgrade or broad override needed. |
| `zod` | **4.6.5 → 4.6.7** | `eslint-plugin-react-hooks@7.1.1 → zod`, also its `zod-validation-error` peer; development lint tooling. Compatible patch for the constrained-collection resource-use advisory; parent unchanged. |
| `next` / matching `@next/env` and SWC platform packages | **16.4.0 → 16.4.1** | Both application runtimes and shared UI peer. Minimum patched release for the three reported Next advisories; no unrelated Next minor/major update. React/react-dom remain 19.3.0. |
| Python `certifi` | **2026.7.22 → 2026.10.19** | Discovered by the required later Python audit, PYSEC-2026-4320. Targeted uv lock update and regenerated hashed `requirements.lock`; no other Python package version changed. Rebuilt Python images include the new certificate bundle. This is not deployment TLS implementation. |

Primary sources:
[undici EventSource](https://github.com/nodejs/undici/security/advisories/GHSA-4qv8-2p9j-2685),
[SRI](https://github.com/nodejs/undici/security/advisories/GHSA-f72v-6w45-q472),
[content encoding](https://github.com/nodejs/undici/security/advisories/GHSA-xjj6-f33q-929c),
[Next image optimization](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw),
[Server Actions](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r),
[typed-array cache](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr),
[Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5),
[certifi maintainer advisory](https://github.com/certifi/python-certifi/security/advisories/GHSA-6q48-6c7w-9gw2).

The dry-run audit-fix proposal was inspected, not applied with force. npm's peer resolver
attempted a newer react-dom incompatible with pinned React. The shared Next UI peer metadata
now explicitly includes the already-used `react-dom@19.3.0`, resolving that ambiguity without
upgrading React. Only Next's matching packages and the two vulnerable transitive npm
packages changed versions. All manifests/lockfile remain consistent. Audit severity,
workflow steps and ignores were not weakened.

Windows `npm.ps1` initially selected its adjacent Node 22.12.0 even though `node` on PATH
was 22.23.3. That preliminary install was not counted as CI-matching verification. Final
commands invoke Node **22.23.3** and npm CLI **10.9.9** explicitly, matching CI and the
production builder. The npm tool is installed only in ignored local tooling. Fresh `npm ci`
and registry audits succeed; retained final JSON reports **zero findings at all severities**.
The application Python requirements audit also reports no known vulnerabilities after
certifi was patched. These are dated lockfile audits, not a machine-wide security guarantee.

## Ruff and research preservation

Using the repository-pinned **Ruff 0.16.10** and unchanged rules, the current tree initially
had **63 lint findings** across seven C3 files, not the reported 185. Codes were I001 (10),
F401 (10), E402 (17), UP015 (1), UP035 (6), UP006 (15), UP045 (2), F541 (2).
Formatting initially failed on six files. Safe automatic fixes were reviewed; no unsafe
fix flag, broad noqa, exclusion or disabled rule was added.

The remaining E402 issues came from imports after `sys.path` setup or notebook setup/GPU
operations. Third-party imports are now at the top; research-local dependencies are imported
inside the functions that use them, after the existing module path setup. The transformer
notebook's late research imports moved into a following code cell, preserving execution
order. Remaining changes are unused imports, typing modernization, harmless constant
f-string/open-mode simplification and formatting. No training, dataset download, taxonomy,
sampling, model hyperparameter, evaluation formula, research metric or saved result changed.

The retained AST comparison confirms non-import computations are unchanged in all seven
files after normalizing annotations, docstrings and those harmless syntax changes.
Notebook outputs were preserved. Two new controlled import-smoke tests load the actual
research modules from another working directory and resolve the relocated local imports;
optional external ML import surfaces are stubbed, and no data/training function runs.
This is import-wiring verification, not new C3 model evaluation.

Final repository-wide lint has **zero findings**; all **157 Python/notebook files** pass
format checking. Historical C3 lint failures in earlier evidence remain historical.

## Local workflow-equivalent verification

For precise reproduction in this Windows workspace:

```powershell
$taskNode = (Resolve-Path '.local/node-runtime/node_modules/node/bin/node.exe').Path
$taskNpm = (Resolve-Path '.local/c1-ci-node-tools/node_modules/npm/bin/npm-cli.js').Path
$taskPython = (Resolve-Path '.local/c1-ci-review-c9d15160c74a452fa345c7536a247cd8/ci-python/Scripts/python.exe').Path
$env:PATH = (Split-Path $taskNode) + ';' + $env:PATH
```

The isolated Python environment uses **Python 3.12.12**, exact locked development packages
and uv **0.12.23**. It was created with `UV_PROJECT_ENVIRONMENT` and managed Python/cache
directories under `.local`, then `uv sync --frozen --python 3.12.12 --managed-python`.
The shared research environment is not used for final strict CI installation.

Environment-preservation correction: the initial frozen sync was run against the shared
`.venv` and removed 40 research packages outside the application's lockfile. This was an
unintended local side effect. All 40 were restored to their original exact versions and
verified using installed package metadata, including `torch==2.5.1+cu121` and
`torchvision==0.20.1+cu121` from the official PyTorch wheel index. An initial system-drive
cache space error and download timeout were handled by using an ignored workspace-drive
cache and a longer installer request timeout. No existing temporary folders were deleted
or system permissions changed. The other 38 packages were restored from PyPI. The final
metadata report is `research-environment-restoration.json` in the ignored evidence folder
above: 40 restored, zero remaining. Subsequent strict CI installation used the isolated
environment. This restored library packages only; no model weights, datasets or training
were downloaded or executed. The intended certifi security update remains in place.

| Actual command | Result / scope |
| --- | --- |
| `& $taskPython scripts/bootstrap_dev.py` | Existing ignored `.env` preserved. Docker-version probe passed; restricted host config read emitted a warning without credential output. |
| `& $taskPython -m ruff check .`; `& $taskPython -m ruff format --check .` | Pass, zero lint findings and 157 formatted files. |
| `& $taskPython scripts/run.py pytest --basetemp=.local/pytest-c1-ci-python31212-20261025-a` | **245 passed, 136.39 s** on Python 3.12.12. One upstream Starlette TestClient/httpx deprecation warning; no failing/skipped checks reported. Fresh temp directory; no permissions changed or old temp folders removed. |
| `& $taskPython scripts/run.py scripts.generate_contracts --check`; `scripts/check_repository.py`; `scripts/check_ci.py` through that interpreter | Pass contract artifacts, candidate/privacy scan and CI structure. No service-local contracts or prohibited generated files added. |
| `& $taskNode $taskNpm ci --no-fund` | Fresh dependency install succeeds using the unchanged CI installation method and final lockfile. |
| `& $taskNode $taskNpm run contracts:check`; `run lint`; `run typecheck`; `test` | Pass; final fresh-install run **90 frontend tests / 14 files, 12.39 s**. Both application type generators and TypeScript pass. |
| `& $taskNode $taskNpm audit --audit-level=high` | Pass, zero vulnerabilities. The original severity threshold remains. |
| `& $taskPython -m pip_audit --disable-pip --no-deps -r requirements.lock` | Pass, no known vulnerabilities after certifi update. |
| `docker compose config --quiet`; `docker compose build` | Pass; all Python service images and both production Next 16.4.1 builds. Python images rebuilt again after certifi update. |
| `docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --no-build --wait --wait-timeout 180` | Nine healthy containers; retained manual assignment policy and volumes. Using the demo override intentionally preserves the existing local policy instead of resetting it to the CI default. |
| Same Compose files with `down`, then `up -d --no-build --wait --wait-timeout 180` | Executed CI cleanup without `--volumes`, then restored the running demo. Before/after counts matched exactly: 285 accounts, 620 sessions, 305 consents, 147 cases, 11 review records. Synthetic verification fixtures are included in these post-test counts. |
| `docker compose exec -T orchestrator alembic upgrade head`; `alembic current`; `alembic check` | Pass, head `f310c1000004`, no new schema operations. No downgrade/reset of retained data. |
| `.venv/Scripts/python.exe scripts/run_evaluation.py postgres` | **13 passed**, isolated generated schema, cleaned by the established isolation-checked harness. Development tables/volume preserved. |
| `.venv/Scripts/python.exe scripts/compose_smoke.py` | **PASS**, final-container synthetic workflow, idempotency, assignment, saved review/replay, withdrawal/retention, logout, frontend proxies and log privacy. |
| `& $taskNode scripts/completed_reviews_browser.mjs`; `scripts/staff_session_browser.mjs --staff-file <existing-private-researcher-file>` | Actual Edge results and scope above; no passwords or private review content retained. |
| `git diff --check`; candidate-file scan; `git diff --cached --name-only` | Whitespace/privacy checks pass; staging remains empty. |

Host execution is Windows; the exact Ubuntu GitHub runner was not reproduced. Production
Docker builds/integration use Linux containers. No hosted Actions run for these uncommitted
changes exists, and no push was authorized. Production TLS/storage encryption, institutional
approval, actual C2–C4 integration and research evaluation remain outside these fixes.

## Changed files in this increment

The counsellor client, two application manifests/shared peer manifest/npm lock, certifi's
uv/hashed requirements locks, seven C3 source/notebook files, new completed-review frontend
tests, backend operations regression, controlled C3 import-smoke tests, a synthetic completed
browser harness and this evidence/README links. Existing persistent-navigation edits remain
separate and preserved. CI workflow, Ruff configuration, migrations, auth/consent enforcement
and C2–C4 research algorithms were not changed.
