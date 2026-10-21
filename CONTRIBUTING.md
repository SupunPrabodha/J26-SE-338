# Contributing

Use `main` → `develop` → `feature/<component>-<description>`. Main is the stable baseline; integration happens through reviewed PRs into develop. Never commit directly to main or develop. Example: `git switch develop`, `git pull origin develop`, `git switch -c feature/c2-pipeline-foundation`.

Use Conventional Commits: `feat(c2): add synthetic token alignment`, `fix(c1): reject expired consent`, `docs(c4): describe faithfulness protocol`. Keep research claims separate from software verification.

Before a PR, run the commands in [README](readme.md), include synthetic evidence, and describe privacy, contracts, migrations and rollback. No real participant material in commits, issues, screenshots, logs or CI. Do not invent account handles for CODEOWNERS.

Shared contracts live in `packages/contracts/src/research_contracts`. Propose changes with examples and consumer impact; obtain all affected owners' review. Regenerate schemas, OpenAPI and TypeScript, then run drift/contract/integration tests. Breaking changes need a new major schema and API version; do not relax an existing contract silently.

For a database change, coordinate with C1, create an Alembic revision after the current head, inspect generated operations, test empty upgrade and downgrade/upgrade on disposable data, and document rollback. Never edit an already merged migration. Avoid divergent heads; coordinate sequencing before merging.

Replace mocks at the assigned service boundary using [member-start](docs/setup/member-start.md). Keep negative integration tests and synthetic CI; real dataset runs belong in approved private infrastructure after ethics and release approval.
