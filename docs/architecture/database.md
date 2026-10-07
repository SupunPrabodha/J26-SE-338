# Database and migrations

PostgreSQL 17 is the integration database. SQLite is used only for fast disposable tests; it is not evidence of PostgreSQL locking behavior. Alembic revisions are `da6bd1560a9f` (tables/constraints/indexes) and `e2985e1a1001` (append-only audit triggers).

Logical boundaries:

| Prefix | Contents |
|---|---|
| access_ | Synthetic accounts, JWT session/revocation and hashed refresh state |
| linkage_ | Consent ownership, one-to-one case/consent mapping, idempotency fingerprints, withdrawals |
| workflow_ | Pseudonymous cases, fixture-only jobs, retention actions |
| review_ | Assignments, tasks and human actions |
| audit_ | Minimal lifecycle evidence with no payload text and no identity FK |

UUID identifiers, UTC timestamps, role/state/attempt checks, unique idempotency keys, one job/task per case, foreign keys and query indexes enforce common invariants. No destructive FK cascades are configured. Audit updates/deletes are rejected by database triggers; a database administrator can still alter/drop those triggers, so this is not a cryptographic tamper-evidence claim.

Startup applies migrations before serving requests and seeds environment-supplied synthetic staff accounts. Manual migration: `docker compose exec orchestrator alembic upgrade head`. Seed: `docker compose exec orchestrator python -m orchestrator.manage seed`. Schema check: use local tests or a disposable database with `alembic check`.

Coordinate one migration head with C1. Test upgrade, downgrade/upgrade, constraints and metadata drift before merging. Review downgrade for data loss; only use it on disposable fixtures. The explicit development reset scripts remove this Compose project's volumes after an opt-in flag. Normal shutdown is `docker compose down` and preserves PostgreSQL data.

Synthetic derived evidence is deleted after 24 hours or withdrawal. Minimal case/status/audit/review-action metadata is retained to support debugging and revocation. No approved participant retention policy is implied; production retention/deletion of identity and audit data remains an institutional governance decision.
