# Database and migrations

PostgreSQL 17 is the integration database. SQLite is used only for fast disposable tests; it is not evidence of PostgreSQL locking behavior. Alembic revisions are `da6bd1560a9f` (tables/constraints/indexes) and `e2985e1a1001` (append-only audit triggers).

Logical boundaries:

The existing revisions `f310c1000001` and `f310c1000002` follow the bootstrap head.
The first adds one receipt per consent before submission and a disposal reason, marking
existing disposal rows `LEGACY_DISPOSAL` without guessing their cause. The second adds
nullable case provenance, an audit trace reference and an observed policy deadline.
Existing audit rows are not rewritten; append-only triggers remain installed.
Old rows keep null provenance/trace/deadline values. No published migration is changed.
Downgrading these revisions loses the new fields/receipts and is tested only in disposable
databases. Do not downgrade the preserved development volume for verification.

| Prefix | Contents |
|---|---|
| access_ | Synthetic accounts, JWT session/revocation and hashed refresh state |
| linkage_ | Consent ownership, one-to-one case/consent mapping, idempotency fingerprints, withdrawals |
| workflow_ | Pseudonymous cases, fixture-only jobs, retention actions |
| review_ | Assignments, tasks, human actions and protected interpretation/follow-up records |
| audit_ | Minimal lifecycle evidence with no payload text and no identity FK |

UUID identifiers, UTC timestamps, role/state/attempt checks, unique idempotency keys, one job/task per case, foreign keys and query indexes enforce common invariants. No destructive FK cascades are configured. Audit updates/deletes are rejected by database triggers; a database administrator can still alter/drop those triggers, so this is not a cryptographic tamper-evidence claim.

Startup applies migrations before serving requests and seeds environment-supplied synthetic staff accounts. Manual migration: `docker compose exec orchestrator alembic upgrade head`. Seed: `docker compose exec orchestrator python -m orchestrator.manage seed`. Schema check: use local tests or a disposable database with `alembic check`.

Coordinate one migration head with C1. Test upgrade, downgrade/upgrade, constraints and metadata drift before merging. Review downgrade for data loss; only use it on disposable fixtures. The explicit development reset scripts remove this Compose project's volumes after an opt-in flag. Normal shutdown is `docker compose down` and preserves PostgreSQL data.

Synthetic derived evidence is deleted after 24 hours or withdrawal. Minimal case/status/audit/review-action metadata is retained to support debugging and revocation. No approved participant retention policy is implied; production retention/deletion of identity and audit data remains an institutional governance decision.

Revision `f310c1000003` adds `review_records` without modifying merged migrations or
existing rows. One immutable record per task stores the author's internal account FK,
bounded synthetic interpretation, allowlisted follow-up category, request key and timestamps.
Only assigned counsellors can read it through the separately protected record endpoint.
It is not part of task lists, admin APIs, service payloads or student demo responses.
Withdrawal/retention deletes the entire record in the same case-locked transaction that
clears derived evidence and assignment. Consent expiry blocks access immediately; physical
deletion follows withdrawal or the existing 24-hour retention sweep. Only safe audit metadata
survives. Application administrators cannot read records; database operators remain trusted.
There is no encryption-at-rest claim. Downgrade drops this table and loses its records;
verification runs downgrade only in a newly generated, verified disposable schema.

Revision `f310c1000004` adds `access_sessions.remembered` (non-null, server default false)
and nullable `absolute_expires_at`. Existing sessions keep their expiry, revocation, hashes
and family IDs and remain ordinary sessions. A remembered session requires a future
absolute deadline at runtime; refresh preserves it. No existing migration is edited.
Startup upgraded the preserved PostgreSQL volume; before/after aggregate counts matched
for accounts, sessions, consent, cases and review records before new verification fixtures.
Legacy-session migration and metadata drift are also checked in disposable tests.
Downgrading loses the new metadata and must never be used to verify the retained volume.
