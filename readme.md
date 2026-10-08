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

Bootstrap creates gitignored `.env` with random development credentials and preserves existing files. Privately read `DEV_COUNSELLOR_USERNAME` and `DEV_COUNSELLOR_PASSWORD` for dashboard login. Use separate browser profiles for student and counsellor because localhost apps share cookies.

Record synthetic consent, select a fixed fixture, submit and refresh its status. The worker runs C2 → C3 → C4 and creates an assigned review task only after all stages succeed. Sign in as the designated synthetic counsellor, refresh tasks, start review and record completion. Withdrawal cancels pending work, removes evidence/assignment and blocks further review.

## Ports

| Service | Host URL/port | Internal port |
|---|---|---|
| Student portal | http://localhost:3000 | 3000 |
| Counsellor shell | http://localhost:3001 | 3001 |
| Orchestrator API/docs | http://localhost:8000/docs | 8000 |
| Preprocessing / NLP / XAI | Not exposed | each 8000 |
| PostgreSQL | Not exposed | 5432 |
| Redis | Not exposed | 6379 |
| Worker | No HTTP port | none |

All host bindings are loopback-only. Each API has `/health`, `/ready` and `/version`. Internal services intentionally do not expose suggested ports 8001–8003.

## Verification

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

Authentication uses short-lived signed JWTs, Argon2 staff passwords, HttpOnly cookies, rotating hashed refresh tokens, revocation, CSRF checks and login rate limits. Authorization checks both roles and ownership/assignment; ADMIN cannot read sensitive case content. Researcher access is denied until an approved artefact/aggregate API exists. Identity/linkage tables never enter C2–C4 payloads. See [auth design](docs/security/authentication.md), [RBAC](docs/security/rbac.md), [logging](docs/security/logging.md) and [SECURITY](SECURITY.md).

This is a localhost HTTP prototype with a local identity adapter and logical database separation, not a hardened institutional deployment. OpenTelemetry API spans have no exporter. Reliability metrics are NOT_EVALUATED. Student session/consent lasts one hour; synthetic evidence retention is 24 hours. Audit metadata remains for development traceability. DVC preparation includes no dataset or remote. Browser reload loses the portal's in-memory case reference. UI accessibility is a basic engineering foundation, not a completed C4 usability study.

## Member handoff

See [exact branch commands and member start](docs/setup/member-start.md), [mock replacement](docs/setup/mock-replacement.md), [contract guide](docs/api/contracts.md), [database/migrations](docs/architecture/database.md), [consent states](docs/architecture/consent-states.md), [workflow states](docs/architecture/workflow-states.md), [CONTRIBUTING](CONTRIBUTING.md) and [troubleshooting](docs/setup/troubleshooting.md). The finalized TAF governs scope; recorded proposal differences do not transfer ownership.
