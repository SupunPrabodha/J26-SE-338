# Bootstrap verification — 2026-10-07

Component: C1 shared development foundation for C1–C4.
Commit: the commit introducing this record; obtain it with `git log -1 --format=%H -- docs/evidence/bootstrap-verification.md`.
Environment: Windows/PowerShell, Docker Desktop Linux containers. All fixtures were disposable and synthetic. No academic source documents were copied into Git.

## Implemented architecture and major files

- `services/orchestrator/{main,auth,workflow,worker,manage}.py`: consent, sessions, RBAC/resource checks, assignments, durable jobs, withdrawal, retention and staff seed.
- `services/{preprocessing,nlp,xai}/main.py`: deterministic development-only service entry points.
- `packages/contracts/src/research_contracts/__init__.py`: authoritative contracts; 25 generated JSON Schema documents, four OpenAPI documents, 48 valid/invalid examples and generated TypeScript declarations. Credential examples intentionally omit fixed passwords.
- `packages/python-common/src/research_common/`: configuration, database boundaries, safe logs/errors, internal authentication and mock implementations.
- `apps/student-portal`, `apps/counsellor-dashboard`, `packages/typescript-common`: fixture-only intake, secure counsellor shell, same-origin cookie client and shared safety/error UI.
- `infrastructure/database/migrations/`: initial tables and append-only audit triggers. `docker-compose.yml` and Dockerfiles define nine services and digest-pinned bases.
- `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, PR/evidence/ADR templates, setup/architecture/security/API guides and ownership/handoff documents.
- `research/`: owner workspaces, templates, configuration and DVC preparation, with no dataset/model/explainer/research results.
- `.github/workflows/ci.yml`: synthetic checks, dependency audits, image builds and container integration, with no deployment.

## Runtime and ports

| Item | Observed version / exposure |
|---|---|
| Host Python | 3.12.6 |
| Host Node / project-local verification Node | 22.12.0 / 22.23.3; global installation unchanged |
| Host npm | 10.9.0 |
| Docker / Compose | 29.3.1 / v5.1.1 |
| Python container | 3.12.15 |
| Node container | 22.23.3 |
| PostgreSQL | 17.11; internal 5432 only |
| Redis | 8.10.2; internal 6379 only |
| Student / counsellor / C1 | loopback 3000 / 3001 / 8000 |
| C2 / C3 / C4 | internal 8000 each, no host mapping |

## Verification commands and observed results

The commands below were executed during the bootstrap, using explicit `.venv` executables and the project-local Node PATH for host frontend checks where needed.

| Command / check | Observed result |
|---|---|
| `git status --short --branch` before edits | Clean, exactly feature/c1-project-bootstrap |
| `python scripts/bootstrap_dev.py` | Generated ignored random local secrets; printed no values |
| `uv lock`, `uv sync --frozen`, hashed runtime export | Successful; direct dependencies and transitive lockfiles pinned |
| `python scripts/run.py pytest` | **58 passed**, one non-failing Starlette TestClient/httpx deprecation warning; final complete run 19.54 seconds |
| `ruff check .` | Passed |
| `ruff format --check .` | Passed |
| `python scripts/run.py scripts.generate_contracts --check` | Passed |
| `npm run contracts:check` | Passed |
| `npm run lint` | Passed |
| `npm run typecheck` | Both workspaces passed; Next route types are generated explicitly |
| `npm test` | **5 passed**, one test file |
| `npm run build` | Both host Next.js application builds passed |
| `npm ci` in frontend image builds | Passed using committed workspace lockfile |
| `npm audit` | **0 known vulnerabilities** after replacing the vulnerable lint dependency chain |
| `pip-audit --disable-pip --no-deps -r requirements.lock` | **No known vulnerabilities found** |
| `docker compose config --quiet` | Passed without printing interpolated secrets |
| `docker compose build` | All service/frontend images built; final frontends use standalone runtime output |
| `docker compose up -d --wait --wait-timeout 180` | All nine services became healthy |
| `docker compose exec -T orchestrator alembic upgrade head` | Passed; initial PostgreSQL startup also applied both migrations on a new volume |
| `docker compose exec -T orchestrator alembic check` | No new upgrade operations detected |
| Disposable migration tests | Empty upgrade, metadata comparison and downgrade/upgrade passed |
| PostgreSQL audit mutation probe | UPDATE and DELETE rejected; transactions rolled back |
| `python scripts/compose_smoke.py` | Passed: four API health/ready/version sets, PostgreSQL, Redis, worker probe, full mock workflow, concurrent idempotency, assigned review, human actions, withdrawal, logout, both frontend HTTP/API proxies and container-log privacy |
| `python scripts/check_ci.py` | YAML structure, pinned action references, mandatory commands and cleanup step passed |
| `python scripts/check_repository.py` | Candidate-file, known local-secret and frontend privacy checks passed |
| `git diff --check` | Passed |

## Authentication, permissions and persistence

Five-minute HS256 JWTs have minimal claims and are validated against current account/session status. Argon2 protects synthetic staff passwords. HttpOnly cookies, strict SameSite, Origin/header CSRF checks, hashed rotating refresh tokens, family replay revocation, logout and rate limits are implemented. Independent short-lived service audiences/keys and Redis token/status checks guard internal endpoints. Future OIDC integration is documented; no university provider is configured.

STUDENT can act only on its own consent/case. COUNSELLOR needs a live assignment and current consent. ADMIN can assign but cannot view sensitive review payloads. RESEARCHER has no case access and no artefact endpoint until releases are approved. SERVICE can call only its own internal audience.

PostgreSQL separates access, consent/identity linkage, pseudonymous workflow, review and audit tables. Constraints enforce roles/states, foreign keys, unique idempotency, one case per consent and one job/task per case. Audit triggers prevent ordinary updates/deletes. This is logical application isolation; the development database owner remains a privileged trust boundary.

## Workflow and privacy evidence

The fixture-only intake and C2 reject arbitrary text. Missing, invalid, expired, withdrawn and wrong-purpose consent are blocked. Consent is checked before each stage and final publication. Malformed responses, mismatched context, timeouts and downstream failures cannot create review tasks. The three-attempt queue has dead-letter/manual-resolution behavior and crash-lease handling. Concurrent identical submissions were verified against PostgreSQL to return one case.

Withdrawal cancels queued work, deletes derived evidence and assignments, and denies subsequent counsellor access even when task metadata exists. The student may retain a minimal status/withdrawal receipt. Retention removes synthetic evidence after the configured interval. No raw text is persisted in the job/database; only fixture IDs are queued. Automated and container-log checks found no fixture text, generated passwords or signing secrets in the checked logs.

## Limitations and intentionally unimplemented research

- No coverage percentage, penetration-test result, clinical conclusion, model performance, explanation faithfulness, usability score or participant result is claimed.
- GitHub-hosted CI has not run because this task does not push. Local structural validation and the underlying commands were executed. No full browser automation or human accessibility/UAT study was performed.
- The TestClient dependency emits one deprecation warning about future httpx2 migration. Current tests pass; no warning was suppressed.
- Local HTTP/cookies, local identity, database-owner credentials and shared Redis are development boundaries. Institutional TLS/OIDC/least-privilege operations require a separately reviewed deployment.
- OpenTelemetry API spans are prepared without an SDK/exporter. DVC is prepared but not installed/initialized and has no remote or dataset.
- Student sessions/consents last one hour. Evidence retention is 24 hours, with minimal audit/status metadata retained for development. These are not approved participant retention periods.
- C2 owns real anonymization/preprocessing, dataset/annotation/release work. C3 owns training, models/calibration and comparative evaluation. C4 owns real LIME/SHAP/counterfactual/faithfulness methods, final dashboard/UI design and usability/UAT. None is implemented or claimed here.
- Source conflicts and their TAF-preserving resolutions are recorded in `docs/governance/source-review.md`.

No screenshots were captured. Normal post-verification shutdown uses `docker compose down`, preserving the development volume. The final Git SHA and shutdown/working-tree confirmation are reported in the handoff response.

## Secret-configuration review — 2026-10-07

The reported Redis environment entry in the original bootstrap commit contained a Compose variable reference, not a literal password. No usable hardcoded credential was identified in the reviewed tracked Compose, Dockerfile, script, source, documentation, CI or example configuration files. GitGuardian's finding cannot be confirmed resolved until its hosted check reruns.

Redis now uses an explicit YAML environment mapping. All password/signing/service-secret substitutions are required and fail when unset or empty. Example credential fields are blank; both bootstrap wrappers use the shared generator, which creates independent random values without printing them and preserves an existing `.env`. The repository scan now rejects literal Compose environment credentials, literal URL passwords and nonblank example secrets.

After these changes: **61 Python tests passed** (one existing TestClient deprecation warning), **5 frontend tests passed**, and lint, formatting, TypeScript, contract drift, repository and CI-structure checks passed. Three added tests cover generation without output, preservation of existing credentials and rejection of literal configuration credentials without disclosing values. Compose configuration was validated with `--quiet` to avoid exposing expanded credentials; `docker compose up --build` succeeded and all nine services were healthy. PostgreSQL schema comparison and the complete container smoke test passed. Generated local files remain ignored. GitGuardian and GitHub-hosted CI were not executed locally.
