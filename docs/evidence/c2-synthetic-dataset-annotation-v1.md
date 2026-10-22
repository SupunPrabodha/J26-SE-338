# C2 synthetic dataset annotation increment v1

Implemented uncommitted on feature/c2-anonymization-pipeline, 2026-10-15,
preserving parent checkpoint c2adc308 and existing working edits. This is a
development-only persistence/authorization demonstration, not expert-approved
labels, a completed gold-set study, measured agreement or dataset release.

Page: **http://localhost:3001/c2-demo/annotation**, linked from `/c2-demo`.
Scope follows [dataset annotation plan](c2-dataset-annotation-plan.md). The
separate [PII gold-set workflow](c2-independent-pii-annotation-plan.md) is unchanged.

## Actual implementation and versions

- C2-only browser page and existing eight-stage stepper. The original custom
  preprocessing demo stays ephemeral. Its Annotate stage stays pending because
  arbitrary custom text is not a saved annotation item.
- Shared schema `c2-dataset-annotation-v1`; vocabulary
  `c2-provisional-vocabulary-v1`, explicitly PROVISIONAL_DEMO_ONLY_NOT_EXPERT_APPROVED.
  Four single-label dimensions: language, code-mixing, emotion and wellbeing.
  Exact allowed values originate in `C2AnnotationLabels` in shared contracts;
  the server exports that vocabulary to the page. Proposal candidate groupings
  are retained: worry-or-fear, sleep-or-energy, concentration-or-motivation,
  coping-or-support. These choices are demo conventions, not taxonomy approval.
- Null/blank means unfinished. Neutral, uncertain, none and no-clear-indicator
  are distinct explicit choices. Drafts may be incomplete; FINAL requires all
  four allowed labels. No automatic suggestions or agreement scores are added.
- The queue prepares only server-owned catalogue scenarios through the existing
  authenticated preprocessing boundary, using Presidio and unchanged quality
  policy. Only a single PASS record with no privacy-review flag, passed privacy
  gate and `release_ready=True` is admitted. Short/empty/placeholder controls
  are excluded; actual unresolved-context quarantine was tested separately.
- Each admitted snapshot stores immutable actual preprocessing response, record
  hash, annotation schema/vocabulary versions and pipeline component versions.
  The pipeline version combines contextual span-selection, Language ID,
  normalization and tokenization versions. The record SHA-256 covers snapshot,
  pipeline/schema/vocabulary. Existing outputs are not replaced with expectations.
- PostgreSQL via existing SQLAlchemy 2.1.3, FastAPI 0.142.2 and Pydantic 2.13.5.
  No new runtime package. Migration `c2a100000001`, after `f310c1000002`, creates
  only `c2_annotation_records`, `c2_annotation_slots`, `c2_annotation_revisions`.
  SQLite/PostgreSQL triggers reject updates/deletes; drafts append new revisions,
  finals cannot be changed. Existing C1 tables/authentication code are unchanged.

## Authentication, ownership and independent visibility

Existing C1 login/session validation, CSRF and Account UUIDs are reused.
Annotation's development-only allowlist is existing COUNSELLOR and ADMIN roles;
the original demo remains COUNSELLOR-only. This does not create an annotator role,
new login system or production permission. Admins can sign in directly on the
annotation page without passing through the counsellor-only demo login.

The first save reserves one of two per-record account slots under a record lock.
Distinct server-verified account IDs are required: a second login session for the
same account cannot become the second annotator. Body-supplied actor IDs are
forbidden. Optimistic expected revisions and immutable version checks reject stale
saves; a third account cannot occupy a slot or see peer labels. Own complete
history remains visible; peer drafts are never returned, and a peer final is
returned only to a participating finalized account after both accounts finalize.
No disagreement is replaced or resolved automatically.

The existing seed supports one counsellor and one admin. Both existing accounts
successfully authenticated in Docker/browser verification, so **no auth dependency
blocked account-level separation in this environment**. Two actual independent
humans, dedicated annotator assignment, domain expertise and identity verification
are not established by accounts or automated smoke tests. Additional accounts
must be provisioned through existing authorized C1 administration, not a C2 role
dropdown or client-chosen identity. That remains a dependency for a human study.

## API and persistence

All endpoints are development-only, authenticated, safe-error and no-store:

| Endpoint | Behaviour |
| --- | --- |
| `POST /api/v1/c2-annotations/prepare` with `{}` | Idempotently stores eligible server-owned snapshots and returns queue/vocabulary; rejects arbitrary text/extra fields |
| `GET /api/v1/c2-annotations/{record_id}` | Own history, actual submission count/state, optional peer final only after both finalize |
| `POST /api/v1/c2-annotations/{record_id}/revisions` | Appends DRAFT/FINAL with required immutable versions, expected revision and typed label fields |

Request schemas originate in shared contracts. JSON Schema, OpenAPI and
TypeScript were generated together; unchanged preprocessing/mock schemas remain
unchanged. Existing legacy compatibility tests still compare all old mock schemas;
the separate additive C2Annotation family is excluded from that old-mock set.
Affected-owner contract review is still required before broader integration.

Storage is in the existing local PostgreSQL volume, never browser storage or Git.
There are no text/label-note logs, uploads, hosted inference or participant inputs.
Removing a browser page, logging out or restarting the gateway does not remove
saved revisions. Immutable finals deliberately have no reset/reassignment action
in this bounded increment. No export, adjudication or release endpoint exists.

Stepper states derive from backend snapshots and actual annotation state:
pending → draft saved → submitted/awaiting second → two submissions saved.
Only two saved finals complete Annotate for that item. Agreement NOT_EVALUATED,
adjudication PENDING, Validate/Versioned Release pending and human release required
remain explicit. Nested preprocessing `release_ready` means only its automated
prerequisites, not approval of the annotations/dataset.

## Actual verification

Commands run at repository root:

| Command | Actual outcome |
| --- | --- |
| `.venv\Scripts\python.exe -m pytest` | 975 passed, 24 existing expected failures, 148.21 s; one existing TestClient deprecation |
| `npm test -- tests/frontend/c2-annotation.test.tsx tests/frontend/c2-demo.test.tsx` | 61 passed: 12 annotation and 49 protected demo tests |
| `npm test` | 77 passed across five files |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed, both workspaces |
| `.venv\Scripts\python.exe scripts/run.py scripts.generate_contracts --check` | Passed; full suite also covers Python drift and compatibility |
| `npm run contracts:check` | Passed |
| `.venv\Scripts\python.exe -X utf8 scripts/check_repository.py` | Passed |
| `.venv\Scripts\python.exe scripts/check_ci.py` | Passed; hosted CI not run |
| Scoped Ruff check/format on new/changed C2 Python and migration files | Passed |
| `.venv\Scripts\python.exe -m ruff check . --statistics` | 63 existing C3 findings, including 17 E402; no C3/CI edits or rule weakening |
| `git diff --check` | Passed |

First checks caught a loading-effect lint violation, optional generated version
types, a password test referring to an input removed during submission, and the
legacy mock-schema test attempting to read new annotation schemas from HEAD.
These were corrected and final checks above passed. No protected masking/quality
expectations were relaxed. The tracked `services/preprocessing` runtime files
have no diff from c2adc308; full regression tests preserve its known limitations.

Real local commands:

```text
docker compose build orchestrator preprocessing counsellor-dashboard
docker compose up -d preprocessing orchestrator counsellor-dashboard
.venv\Scripts\python.exe scripts/c2_annotation_smoke.py --output artifacts/c2-evidence/dataset-annotation/synthetic-v1/docker-smoke.json
.venv\Scripts\python.exe scripts/c2_demo_smoke.py
node .local/c2-annotation-browser.mjs
```

Build and migration startup passed. Annotation smoke: four eligible records;
distinct existing accounts; draft persisted after actual gateway restart; peer
labels hidden until both finalize; incompatible final decisions preserved;
invalid labels rejected safely; finals locked; no text/secrets in logs. Existing
demo smoke passes 45 actual scenario executions, custom inputs, validation, logout
and log privacy. No benchmark or training experiment ran.

Edge 155.0.4283.45 verified separate isolated browser contexts, sign-in, partial
draft restored after actual page reload, hidden peer draft/first final, two
immutable final submissions with different emotion decisions, backend-driven
stepper, no browser storage and 390px layout at scale 1. Desktop and narrow
screenshots were visually inspected. Browser evidence is ignored locally at
`.local/c2-demo-browser-e56e919f-d4fc-400b-9459-a79963d33102`; helper source is an
ignored local CDP harness, not a shipped application dependency.

The smoke tests saved **automated synthetic test decisions**, not human-verified
research gold. They consumed the code-mixed and Sinhala item pairs. English and
Romanized pairs remain available for a manual demonstration; existing finals are
preserved. Reproduction requires unused item pairs and a fresh output path;
the smoke refuses to overwrite evidence and does not erase existing finals.

## Short PP1 walkthrough and remaining work

1. Open the page with development services/migrations running. Use private existing
   counsellor credentials; a second independent browser profile uses the existing
   admin account. Never share actual credentials in reports/screenshots.
2. Choose an eligible unfinalized item. Read immutable text and provisional notice.
   Save a partial draft, reload, reselect the item and inspect restored choices.
3. Complete all four dimensions and explicitly finalize. In the second session,
   verify peer labels remain hidden; independently save/finalize its choices.
4. Reload saved state in each session to inspect both finals and own revision
   history. Show that disagreements persist and agreement/adjudication/release
   are still pending. Do not present the test accounts as a human study.

Next increment: actual independent annotators and approved study protocol,
vocabulary/expert review, agreement before adjudication, preserved adjudication
and a separate human-assisted corpus workflow. The proposal's provisional
agreement target is not an achieved metric or release authorization. Only four
server-owned demonstration items are supplied; they are not a diverse gold study.
No participant ingestion, model training, C3/C4 research or C1 auth change occurred.

## Affected files

New C2 page `apps/counsellor-dashboard/app/c2-demo/annotation/page.tsx`;
existing demo navigation and `PipelineStepper.tsx`; C2 router aggregation in
`services/orchestrator/demo.py`; new `c2_annotation.py` / `c2_annotation_store.py`;
additive migration; shared contract source and seven generated C2Annotation
schemas, orchestrator OpenAPI and TypeScript; focused integration/frontend tests;
legacy C2 mock-scope compatibility assertion; `scripts/c2_annotation_smoke.py`;
this report and current demo documentation. All earlier uncommitted documentation,
offline experiments, PII workflow and unrelated edits remain preserved. No files
were staged and no commit/push was made.
