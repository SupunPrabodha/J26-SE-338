# Contract-first integration

Authoritative Python models: `packages/contracts/src/research_contracts/__init__.py`. Exported JSON Schema Draft 2020-12: `packages/contracts/json-schema/v1`. Service OpenAPI 3.1: `packages/contracts/openapi`. Generated frontend declarations: `packages/typescript-common/src/contracts.d.ts`. Valid/invalid examples: `packages/contracts/examples/v1.json`.

Manual-demo/chart extension: ADMIN-only GET `/api/v1/admin/analytics` returns AdminAnalytics
with bounded case-state counts, UTC day/week submission buckets and active assignment-pair
workload. Its CaseFilters are shared with `/admin/cases`, which adds optional aware
`since` inclusive / `until` exclusive. Analytics requires a positive range <=366 days,
defaults to seven UTC calendar days and restricts interval to day/week. Workload returns
top 20 staff plus Other; completed/disposed/expired work and unusable staff are excluded.
StaffSummary adds required pseudonymous `display_name`; AdminCaseSummary adds optional
`last_assignment_at` and defaulted `human_review_status`. Regenerate strict consumers.
No C2–C4 wire change or migration. See [definitions and verification](../evidence/c1-manual-assignment-charts.md).

Current role-workspace increment: see [assignment/staff contracts and runtime evidence](../evidence/c1-role-assignment.md).
New ADMIN-only GET `/api/v1/admin/overview`, `/admin/staff`, `/admin/cases` and POST
`/admin/staff/{id}`, `/admin/cases/{id}/assignment` use shared models. Lists are bounded
to 20 items with offset <=10000 and validated UUID-prefix/state/role filters. Staff writes
carry `expected_updated_at`; exclusive assignment writes carry `expected_version` and a
counsellor UUID or null. Stale different writes return 409; matching repeats recheck policy.
Responses project administrative metadata, never review/identity contents. Legacy
`/cases/{id}/assign` remains an additive 204 grant, now completed-task eligibility checked.
GET `/component-routes` permits ADMIN/COUNSELLOR/RESEARCHER to read only actual mock-provider
route metadata. No connected C2–C4 web path, research data access or annotation API is added.
`STAFF_ADMINISTRATION` extends the event union; strict consumers must regenerate. All new
schemas, OpenAPI and TypeScript are generated together. No database migration is required.

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
# C1 workspace additions — 2026-10-24

`GET /api/v1/review-queue` requires COUNSELLOR. It accepts `state` (READY_FOR_REVIEW,
UNDER_REVIEW or COMPLETED), offset 0–10000 and limit 1–20. It returns ReviewQueuePage:
assigned case/task references, processing state, submitted/updated times and actual review
action/save timestamps. It returns no interpretation or identity linkage. Existing task,
record and action endpoints retain their behavior and recheck current case policy.

`GET /api/v1/admin/audit-events` requires ADMIN on every request. Optional filters are
case UUID, AdminEventType, inclusive aware `since`/`until` instants and an opaque bounded
cursor. Limit is 1–50 (UI uses 25). Pagination is descending event time then UUID; it avoids
offset drift when new rows arrive. Filters must be preserved across cursor pages. Unknown
stored event/outcome pairs are excluded, not exported verbatim. Invalid cursors, reversed
dates, unrecognized filters and invalid UUIDs are rejected safely.

AdminAuditPage contains allowlisted receipt fields, response `observed_at`, and optional
selected-case operations: current workflow state, safe failure code, disposal reason and
validated permitted provenance. Event `occurred_at` is persistence time; optional policy
expiry is a separate deadline. Provenance is withheld if consent/case policy disallows it.
No notes, text, consent contents, actor/session IDs or linkage records are projected.

`ADMIN_EVIDENCE_ACCESS` extends LifecycleAuditEvent; storage uses the existing audit table.
No migration or existing-row mutation is required. JSON Schema, OpenAPI and TypeScript are
regenerated centrally. Strict event-union consumers must update to accept this new safe type;
owner DemoReceipt types and C2–C4 service schemas remain unchanged. Coordinate consumer
review before merge. The admin API is metadata-only; ADMIN has no review-content privilege.
