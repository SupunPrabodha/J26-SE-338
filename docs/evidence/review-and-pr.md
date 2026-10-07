# Local review and proposed pull request

The authorized local commit message is `chore: bootstrap shared research platform`. No push, merge, branch-protection/visibility change or cloud deployment is part of this task.

Review after the bootstrap commit:

```sh
git status --short --branch
git log -1 --format=fuller
git show --stat --oneline HEAD
git diff HEAD^ HEAD
```

When the repository owner is ready to push:

```sh
git push -u origin feature/c1-project-bootstrap
```

Recommended PR base: `develop`.
Recommended title: **chore: bootstrap shared research platform**

Recommended description:

> Establish the shared synthetic development foundation before Components 2–4 begin research implementation. The monorepo provides two Next.js shells, four FastAPI services, consent-aware durable orchestration, development authentication, role/case authorization, PostgreSQL migrations, Redis, versioned shared contracts, deterministic mocks, privacy-safe logging, Docker and synthetic CI.
>
> Active purpose-matched consent gates each processing stage. Assigned counsellors can review only successfully completed synthetic workflows; withdrawal deletes derived evidence and revokes review access. No dataset, trained classifier, real anonymization/XAI method, participant study or final research dashboard is included. TAF ownership and proposal differences are documented.
>
> Validation: 58 Python tests and 5 frontend tests passed; Python/frontend lint, TypeScript and contract drift checks passed. All nine containers became healthy, migrations and schema checks passed, and the real-container smoke verified concurrent idempotency, the full C1–C4 workflow, review/withdrawal/logout, frontend proxies and log privacy. npm/Python dependency audits reported no known vulnerabilities. See docs/evidence/bootstrap-verification.md for commands and limitations. GitHub-hosted CI remains pending the push.
>
> Rollback: stop with docker compose down, preserving the synthetic development volume. Database downgrade/reset is for disposable data only and requires explicit operator action. No production deployment or real-data migration is introduced.
