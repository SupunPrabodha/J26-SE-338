# Contract-first integration

Authoritative Python models: `packages/contracts/src/research_contracts/__init__.py`. Exported JSON Schema Draft 2020-12: `packages/contracts/json-schema/v1`. Service OpenAPI 3.1: `packages/contracts/openapi`. Generated frontend declarations: `packages/typescript-common/src/contracts.d.ts`. Valid/invalid examples: `packages/contracts/examples/v1.json`.

Contract coverage includes consent/decision, submission session, pseudonymous case, workflow request/execution, C2/C3/C4 requests/responses, review task/action, withdrawal, retention, safe audit, errors, health/version, login, account/assignment and fixture catalog. Enum values are shared. IDs use UUIDs; timestamps must have a timezone and are normalized to UTC. Unknown fields and incompatible schema versions are rejected. Nullable fields are explicit: unevaluated reliability is null, optional error_code defaults null. Defaults are documented in generated schemas, not inferred by consumers.

Version policy: v1 requires exactly `schema_version: 1.0.0`; omitted metadata takes documented v1 defaults. Breaking names, types, required fields or enum semantics require a new major endpoint/schema with a migration window and all-consumer tests. Even additive fields require review because `extra=forbid` intentionally rejects silent drift. Do not change a published schema in place.

Generate/check:

```sh
python scripts/run.py scripts.generate_contracts
npm run contracts:types
python scripts/run.py scripts.generate_contracts --check
npm run contracts:check
python scripts/run.py pytest tests/contract
```

OpenAPI is generated from the same request/response models used at runtime; drift tests compare checked-in documents byte-equivalently after canonical JSON generation. Tests also prohibit service-local BaseModel definitions. New examples should include invalid consent, incompatible versions and forbidden identity fields.

All protected public APIs use HttpOnly cookies; internal APIs use audience-specific Bearer tokens. `/health`, `/ready`, `/version`, `/docs` and `/openapi.json` are development diagnostic endpoints. Public business routes are under `/api/v1`; mocks under `/internal/v1`. Errors return a safe stable error_code, correlation_id and generic message, never submitted bodies or validation input.

## C1 lifecycle additions (unmerged)

`ConsentLifecycle` is a new response for owner-only GET `/consents/{id}/lifecycle` and
POST `/consents/{id}/withdraw`. It composes the unchanged ConsentRecord and PseudonymousCase
and adds explicit-withdrawal/disposal information. The POST reuses WithdrawalRequest.
Existing case withdrawal, submission, consent and C2–C4 wire schemas are unchanged.
The legacy case state WITHDRAWN continues to mean disposed; new clients should use the
lifecycle response to distinguish retention from an owner's decision.

`LifecycleAuditEvent` is a separate, expanded audit model; the published AuditEvent is
unchanged. `ServiceProvenance` is a new internal stored contract containing provider-returned
versions and case correlation, explicitly synthetic/development-only. It contains no text.
No Python consumer copies are generated: services import the authoritative Python package.
JSON Schema, orchestrator OpenAPI and TypeScript declarations are generated from it.
C2–C4 owners need no mock request/response changes, but must review real provider versions,
provenance retention and deletion propagation before replacing mocks. These development
literal versions deliberately do not accept an unreviewed real model version.
# FR09 additive review record (2026-10-23)

`GET /api/v1/review-tasks/{task_id}/record` returns `CounsellorReviewRecord` or JSON null
when the authorized task has no saved record. `POST` accepts `ReviewRecordRequest`.
Both require a currently assigned counsellor, active matching consent and an undisposed,
unexpired case. The student and admin roles cannot read or save records.

The first save requires `UNDER_REVIEW`. Interpretation must start with `SYNTHETIC:`,
contain a nonblank observation and be at most 2,000 characters. Follow-up is one of
`NO_FOLLOW_UP_PLANNED`, `DISCUSSION_OFFERED`, `FOLLOW_UP_REQUESTED`; these record a
human choice and do not perform outreach or clinical decisions. The request includes
a UUID idempotency key. The record is immutable: the same actor/content returns the
existing record even with a new key, including after completion; different actor/content
returns 409. Keys are scoped to a task, not a global request ledger. Every replay rechecks
authorization and consent. Creating a record after completion returns 409.

Existing START_REVIEW/COMPLETE_REVIEW contracts remain unchanged. Legacy status-only
completion remains supported and does not imply a review record exists. No record is
backfilled for older completed tasks. The demo adds only optional `review_record_saved_at`,
derived from a persisted safe audit receipt, never interpretation or follow-up contents.
Existing clients can omit the new optional field; strict response validators must regenerate
from the central contracts. Coordinate consumer review before merging. C2–C4 contracts are unchanged.
