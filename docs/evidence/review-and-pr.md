# Local review and proposed pull request

The authorized local commit message is `chore: bootstrap shared research platform`. No push, merge, branch-protection/visibility change or cloud deployment is part of this task.

Review after the bootstrap commit:

```sh
git status --short --branch
git log -1 --format=fuller
git show --stat --oneline HEAD
git diff HEAD^ HEAD
```

The bootstrap commit was amended after the secret-configuration review. Replace the previously published branch only if its remote head is still the reviewed original commit:

```sh
git push --force-with-lease=refs/heads/feature/c1-project-bootstrap:9d6bb8d0525bc39f59a0c17cce12e32b4ce8df8c origin feature/c1-project-bootstrap
```

Recommended PR base: `develop`.
Recommended title: **chore: bootstrap shared research platform**

Recommended description:

> Establish the shared synthetic development foundation before Components 2–4 begin research implementation. The monorepo provides two Next.js shells, four FastAPI services, consent-aware durable orchestration, development authentication, role/case authorization, PostgreSQL migrations, Redis, versioned shared contracts, deterministic mocks, privacy-safe logging, Docker and synthetic CI.
>
> Active purpose-matched consent gates each processing stage. Assigned counsellors can review only successfully completed synthetic workflows; withdrawal deletes derived evidence and revokes review access. No dataset, trained classifier, real anonymization/XAI method, participant study or final research dashboard is included. TAF ownership and proposal differences are documented.
>
> Validation: 61 Python tests and 5 frontend tests passed; Python/frontend lint, TypeScript and contract drift checks passed. All nine containers became healthy, migrations and schema checks passed, and the real-container smoke verified concurrent idempotency, the full C1–C4 workflow, review/withdrawal/logout, frontend proxies and log privacy. npm/Python dependency audits reported no known vulnerabilities during bootstrap verification. Blank example credentials, required Compose variables and secret-generation regression checks are included. See docs/evidence/bootstrap-verification.md for commands and limitations. Hosted CI and GitGuardian checks must rerun on the amended commit.
>
> Rollback: stop with docker compose down, preserving the synthetic development volume. Database downgrade/reset is for disposable data only and requires explicit operator action. No production deployment or real-data migration is introduced.
