# J26-SE-338

**Privacy-Preserving Sinhala-English NLP Framework for Student Mental Wellbeing Screening**

Shared development foundation for SLIIT IT4010. This is non-diagnostic screening support and counsellor decision support: authorized humans interpret all outputs. It does not diagnose, recommend treatment, replace counselling or perform autonomous emergency intervention.

**MOCK · SYNTHETIC · DEVELOPMENT ONLY.** Only the built-in fictional text fixtures are accepted. No participant data, dataset, trained model, anonymization algorithm, real explainer, study or research result is included.

## Architecture and ownership

| Area | Owner |
|---|---|
| C1: architecture, consent, identity/access, orchestration, audit and integration | Liyanage S. P. — IT23187450 |
| C2: ethical dataset engineering and code-mixed preprocessing | Wickramathilaka N. M. — IT23165434 |
| C3: bilingual NLP, emotion-aware modelling and wellbeing indicators | Ramanayake R. H. B. D. G. — IT23164130 |
| C4: XAI, faithfulness/counterfactual evaluation and final dashboard/UI research | Alahakoon A. W. A. C. N. — IT23163522 |

`apps/` contains two Next.js TypeScript shells. `services/` contains C1 and deterministic C2–C4 FastAPI mocks. `packages/contracts/` is the authoritative wire-model source plus generated JSON Schema/OpenAPI; `packages/python-common/` and `packages/typescript-common/` share infrastructure. `research/` reserves C2–C4 workspaces. `tests/`, `infrastructure/`, `scripts/`, `.github/` and `docs/` provide verification, local deployment and handoff.

The transactional PostgreSQL job worker implements the narrow asynchronous foundation; Redis provides service-token/rate-limit/health state. See [architecture](docs/architecture/overview.md), [trust boundaries](docs/architecture/trust-boundaries.md), [source conflicts](docs/governance/source-review.md) and [ADRs](docs/adr/).

The current C1 increment adds pre-submission withdrawal, separate consent/disposal status,
synthetic provenance, audit trace checks and PostgreSQL reliability evaluation. See
[C1 evidence, exact demo commands and remaining gaps](docs/evidence/c1-lifecycle-evaluation.md)
and the [audit catalogue](docs/security/audit-catalogue.md). Performance figures are a
mock-based core proxy, not end-to-end latency or completed research evaluation.

The [consolidated PP1 readiness report](docs/evidence/c1-pp1-readiness.md) links the
source-derived requirements audit, updated demonstration UI, current verification,
startup/demo sequence and remaining research gaps.

## Quick start

Prerequisites: Python 3.12, Node.js 22 LTS (22.22.2+ for host tooling; tested with 22.23.3), npm, Git, Docker and Compose with Linux containers. Container bases are pinned by digest. Dependencies are pinned in `pyproject.toml`, `uv.lock`, `requirements.lock`, `package.json` and `package-lock.json`.

PowerShell:
```powershell
./scripts/bootstrap-dev.ps1
docker compose up --build
```

Linux/macOS:
```sh
bash scripts/bootstrap-dev.sh
docker compose up --build
```

Bootstrap creates gitignored `.env` with random development credentials and preserves existing files. Privately read `DEV_COUNSELLOR_USERNAME` and `DEV_COUNSELLOR_PASSWORD` for dashboard login. Application cookies are isolated; separate browser profiles remain recommended for clear student/counsellor demo roles. Sign in again after upgrading from the legacy shared-cookie proxy.

For the **manual-assignment PP1 demo**, explicitly override both API and worker policy:

```powershell
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build --wait --wait-timeout 180
```

New processed cases then await admin assignment; existing grants are preserved. Normal
Compose retains the configured `DESIGNATED_DEVELOPMENT` default. See the
[manual assignment, chart definitions, actual verification and role walkthrough](docs/evidence/c1-manual-assignment-charts.md).
Admin `/admin/overview` now includes protected case-state, UTC submission and active-workload
charts with exact-count tables and matching source-case filters. The counsellor page states
which numeric explanation inputs are unavailable from the current mock provider.

Record synthetic consent, select a fixed fixture, submit and refresh its status. The worker runs C2 → C3 → C4 and creates a review task only after all stages succeed. Default `ASSIGNMENT_POLICY=DESIGNATED_DEVELOPMENT` assigns the usable designated counsellor; `MANUAL` leaves the task awaiting admin assignment. Sign in as the assigned synthetic counsellor, refresh tasks, start review, save a fictional interpretation and follow-up category, then record completion. Withdrawal cancels pending work, removes evidence/assignment and the saved review record, and blocks further review. See [FR09 verification and boundaries](docs/evidence/c1-fr09-review-record.md).

## Ports

| Service | Host URL/port | Internal port |
|---|---|---|
| Student portal | http://localhost:3000 | 3000 |
| C1 PP1 demonstration | http://localhost:3000/demo | 3000 |
| Counsellor shell | http://localhost:3001 | 3001 |
| Restricted admin evidence | http://localhost:3001/admin | 3001 |
| Admin overview/staff/assignments/operations/retention | http://localhost:3001/admin/overview | 3001 |
| Protected C2–C4 route directory | http://localhost:3001/research | 3001 |
| Orchestrator API/docs | http://localhost:8000/docs | 8000 |
| Preprocessing / NLP / XAI | Not exposed | each 8000 |
| PostgreSQL | Not exposed | 5432 |
| Redis | Not exposed | 6379 |
| Worker | No HTTP port | none |

All host bindings are loopback-only. Each API has `/health`, `/ready` and `/version`. Internal services intentionally do not expose suggested ports 8001–8003.

Open `/demo` as the read-only C1 requirements checklist and `/` as the only student
consent/submission/withdrawal form, in two tabs of the same browser profile. After recording
consent, refresh the checklist and explicitly select that run. It observes owner-scoped
server records with bounded polling, including consent before a case exists. Use a separate
browser profile for the counsellor application. Namespaced proxy cookies prevent role collisions. No tokens or
case references are stored in browser storage. Recorded tests and configuration are labelled
separately from live evidence. See the [checklist mapping and verification](docs/evidence/c1-demo-checklist.md).

## Verification

The [current visual design evidence](docs/evidence/c1-visual-design.md) documents the shared
forest-green staff shell, compact account/disclosure controls, clearer tables/statuses and
desktop/mobile verification. Existing consent, role, assignment and privacy behaviour is preserved.

The [C1 privacy demonstration increment](docs/evidence/c1-privacy-ui.md) records the compact
six-group `/demo`, independent implementation/current-run evidence statuses, accessible
dialogs, fixed staff navigation and honest consent/submission progress. It includes current
verification and a short PP1 sequence. Keep student `/` and `/demo` in one browser profile;
use separate admin and counsellor profiles and the explicit manual-demo Compose override.
Opening evidence never runs training, dataset release or benchmarks.

The [current C1 requirements audit](docs/evidence/c1-workspace-audit.md) maps all FR/NFRs
to code, persistence, APIs, UI and assertion evidence. The [workspace verification guide](docs/evidence/c1-workspace-verification.md)
records actual current results, safe screenshots, startup and role-by-role walkthrough.
The staff queue supports saved-review reopening and status filters; `/admin` uses ADMIN-only
operational receipts. Privately read `DEV_ADMIN_USERNAME` / `DEV_ADMIN_PASSWORD` from the
existing ignored `.env` for admin sign-in. Use separate browser profiles for each demo role.

The [role-workspace delivery and permission matrix](docs/evidence/c1-role-assignment.md)
records explicit assignment/reassignment, staff administration with session revocation,
actual database counts, read-only operations/retention, responsive sidebar pages and current
tests/screenshots. The protected directory labels the actual C2–C4 development mocks; no
human research pages are connected yet. Student `/demo` remains read-only.
To add one synthetic local staff account without exposing credentials:

```powershell
.venv/Scripts/python.exe scripts/provision_staff.py --role COUNSELLOR
```

Read the returned ignored `.local/staff-<uuid>.env` privately in your editor. The helper
prints only the path, uses the existing identity backend and preserves existing accounts.
ADMIN/RESEARCHER grants are local-operator-only; there is no public privileged registration.

Install local Python tools using `python -m venv .venv`, then the venv's Python with `-m pip install uv==0.12.23`, followed by the venv's `uv sync --frozen`. Activate the venv or use explicit executable paths from the [PowerShell](docs/setup/windows.md) / [Linux/macOS](docs/setup/linux-macos.md) guides.

```sh
ruff check .
ruff format --check .
python scripts/run.py pytest
python scripts/run.py scripts.generate_contracts --check
python scripts/check_repository.py
npm ci
npm run contracts:check
npm run lint
npm run typecheck
npm test
npm audit --audit-level=high
pip-audit --disable-pip --no-deps -r requirements.lock
docker compose config --quiet
docker compose build
docker compose up -d --wait --wait-timeout 180
docker compose ps
docker compose exec -T orchestrator alembic upgrade head
python scripts/compose_smoke.py
git diff --check
docker compose down
```

`--quiet` avoids printing secrets in expanded Compose configuration. Normal shutdown preserves the database volume. Explicit reset scripts are development-only and require a confirmation flag. Exact observed results and limitations are in [bootstrap verification](docs/evidence/bootstrap-verification.md).

## Security and limitations

Authentication uses short-lived signed JWTs, Argon2 staff passwords, HttpOnly cookies, rotating hashed refresh tokens, revocation, CSRF checks and login rate limits. Authorization checks both roles and ownership/assignment; ADMIN cannot read sensitive case content. Locally authorized researchers can read only the protected component directory; case/dataset/annotation access remains denied. Identity/linkage tables never enter C2–C4 payloads. See [auth design](docs/security/authentication.md), [RBAC](docs/security/rbac.md), [logging](docs/security/logging.md) and [SECURITY](SECURITY.md).

This is a localhost HTTP prototype with a local identity adapter and logical database separation, not a hardened institutional deployment. OpenTelemetry API spans have no exporter. Reliability metrics are NOT_EVALUATED. Student session/consent lasts one hour; synthetic evidence retention is 24 hours. Audit metadata remains for development traceability. DVC preparation includes no dataset or remote. Browser reload loses the portal's in-memory case reference. UI accessibility is a basic engineering foundation, not a completed C4 usability study.

## Member handoff

See [exact branch commands and member start](docs/setup/member-start.md), [mock replacement](docs/setup/mock-replacement.md), [contract guide](docs/api/contracts.md), [database/migrations](docs/architecture/database.md), [consent states](docs/architecture/consent-states.md), [workflow states](docs/architecture/workflow-states.md), [CONTRIBUTING](CONTRIBUTING.md) and [troubleshooting](docs/setup/troubleshooting.md). The finalized TAF governs scope; recorded proposal differences do not transfer ownership.
