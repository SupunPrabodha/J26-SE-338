# C2 synthetic submission annotation pilot v1

2026-10-22, uncommitted on `feature/c2-anonymization-pipeline`, HEAD
`c2adc3083dfc8a4a7702bca8d724b55919750c34` plus preserved working edits.
Page: **http://localhost:3001/c2-demo/annotation**.

## Frozen source and actual gate results

Only the supplied `J26-SE-338_C2_Synthetic_1000_v1` folder was read. No participant
responses or remote form were accessed. Selection was frozen before checking
outputs: first source-order submission per intended-language category, except
English selects the first with unanswered Q10. No search for gate-passing cases.
The other 996 submissions are not imported.

| Preserved submission ID | Generator intent, not a human label | Answered |
| --- | --- | ---: |
| SYN-5e2ea177157f4e13 | Sinhala | 7 |
| SYN-63d72edde7b84f57 | English | 6 |
| SYN-2e2daa52cf284f6b | Romanized Sinhala | 7 |
| SYN-0b5c5c7a2e7340a9 | Code-mixed | 7 |

One submission groups **Q4–Q10**, not ten answers. Q4–Q9 required, Q10 optional.
Source IDs, question IDs/text/order, form/generator versions and source hashes are
preserved. Source JSONL SHA-256:
`4470f7595c48d5c1b32067bfbdd272ddc79c6abb857a91c38d35e6e540e43e32`.
Frozen four-row manifest and aggregate reports remain Git-ignored under
`artifacts/c2-evidence/dataset-annotation/submission-pilot-v1/`.

The importer executes the unchanged Presidio pipeline on **all answered positions
together**, retaining cross-answer duplicate/masking-collision assessment. It also
executes the pipeline per answer for individual actual snapshots/privacy gates.
Eligibility requires batch record quality PASS/no privacy flag and individual
automated readiness. No detector, threshold or duplicate policy was weakened.

Actual pilot: **4 submissions, 28 positions; 27 PASS, 0 REVIEW, 0 REJECT;
27 available, 0 withheld, 1 OPTIONAL_UNANSWERED, 0 MISSING_REQUIRED**.
Batch privacy gate passed. This is not measured anonymization accuracy or complete
privacy certification. Generator metadata is not approval; the supplied NOT_RUN
gate fields are not trusted. Existing multilingual misses/false masks remain.
No independent PII gold labels were supplied for these survey answers.

Blocked/missing answers retain IDs and reasons but no answer text or label form
is returned. They keep the submission visibly incomplete. Absent optional Q10
has no annotation record/label requirement; answered Q10 requires annotation,
and privacy-blocked Q10 is never silently converted to absent. Dedicated synthetic
tests exercise duplicates, privacy review and missing required answers because
none of those exclusions occurred in this four-submission pilot.

## Persistence, assignment and versions

Additive migration `c2a100000002` follows `c2a100000001`: immutable submission,
answer-membership and assignment tables. Existing records, drafts and finals are
not rewritten. New tables also reject UPDATE/DELETE. Frozen versions include
source row/file hashes, pipeline/schema/vocabulary and pilot membership, which
matters for duplicate assessment. Re-import refuses overwrites/conflicts.

Every submission and eligible answer is explicitly assigned to the same two
distinct existing Account UUIDs resolved privately from development counsellor
and admin configuration. No authentication/role changes or accounts created.
Unassigned accounts receive no pilot entries and cannot GET/POST guessed answer
IDs; no first-save slot claiming for pilot records. Earlier standalone prototype
items remain separately collapsed with their saved history/workflow; they are
not assigned survey submissions or independent gold annotation.

Independent drafts append revisions; explicit answer FINAL is immutable. Peer
drafts/first finals stay hidden until both participants finalize that answer.
Progress counts current-account finals, not agreement. Schema
`c2-dataset-annotation-v1` and vocabulary `c2-provisional-vocabulary-v1` remain
demo-only, not expert-approved. Two accounts do not establish independent humans.
Agreement NOT_EVALUATED, adjudication PENDING, final dataset Validate/Versioned
Release pending and human approval required remain explicit.

## UI and additive contracts

- `GET /api/v1/c2-annotations/submissions`: current-account assignments/progress.
- `GET /api/v1/c2-annotations/submissions/{submission_id}`: ordered available,
  withheld and optional positions with own history/visibility-filtered peer final.
- Existing answer GET/revision endpoints enforce pilot assignment before access.
- Shared source adds answer/submission/queue contracts; annotation preprocessing
  accepts the existing catalogue or custom response rather than inventing a
  catalogue scenario for an imported answer. Schema/OpenAPI/TS regenerated together.

The page shows IDs/progress, numeric question order, Previous/Next answer and
submission controls. Language selection saves only a human label; text never
switches, translates or changes. Labels start blank. Unsaved navigation asks before
leaving; Save draft persists choices for reload. Requests are sequenced/cancelled;
expiry/logout clears protected state. No browser storage, analytics, hosted calls
or participant ingestion. Uncertainty/neutral/no-indicator differ from unfinished.

## Reproduction and PP1 walkthrough

Development services and migration must be running. Sign in directly at the URL
with the existing private counsellor account. Use a different browser profile for
the existing admin account; never publish credentials. Both select the same ID,
navigate questions, save/reload a partial draft, independently finalize one answer
and observe peer hiding/final locking. English Q10 requires no label. Agreement
and release stay pending.

```powershell
.venv\Scripts\python.exe scripts/run.py orchestrator.c2_submission_import --source "C:\Users\Neluni\Downloads\J26-SE-338_C2_Synthetic_1000_v1\J26-SE-338_C2_Synthetic_1000_v1" --freeze-only --output artifacts/c2-evidence/dataset-annotation/submission-pilot-v1/input.json
docker compose build orchestrator counsellor-dashboard
docker compose up -d --no-deps --wait orchestrator counsellor-dashboard
docker compose cp artifacts/c2-evidence/dataset-annotation/submission-pilot-v1/input.json orchestrator:/tmp/c2-submission-pilot-v1.json
docker compose exec -T orchestrator python -m orchestrator.c2_submission_import --manifest /tmp/c2-submission-pilot-v1.json --output /tmp/c2-submission-pilot-report-v1.json
docker compose cp orchestrator:/tmp/c2-submission-pilot-report-v1.json artifacts/c2-evidence/dataset-annotation/submission-pilot-v1/import-report.json
.venv\Scripts\python.exe scripts/c2_submission_smoke.py --output artifacts/c2-evidence/dataset-annotation/submission-pilot-v1/docker-smoke.json
```

Fresh evidence paths required. Existing database import refuses overwrite; do not
reset finals to replay. Actual API smoke saved **automated synthetic test finals**
on `SYN-0b5c5c7a2e7340a9-Q4`, preserving its draft. Browser smoke saved an automated
partial draft on English Q5. These are test decisions, not human research gold.

## Checks and limitations

- Focused Python: 225 passed, 2 expected failures across submission/annotation/demo,
  Language ID and text processing. Additional completion/contract check: 10 passed.
- Full frontend: **81 passed across six files**, including four new submission
  tests. Existing annotation/demo tests pass.
- Full Python after final backend changes: **980 passed, 24 expected failures**,
  149.24s; one existing TestClient deprecation warning. Known detector/language
  failures remain visible as expected failures, not declared corrected.
- Lint/typecheck, Python/TypeScript drift, repository/CI structure, scoped Ruff/
  format and whitespace checks passed. Hosted CI not run.
- Docker builds, additive migration, actual import and authenticated API smoke
  passed version/assignment equality, draft recovery, unchanged snapshots, peer
  hiding, final locking, optional Q10 and logout access checks.
- Actual Edge desktop 1366/mobile 390 scale-1 checks passed navigation, label-only
  changes, draft reload, independent visibility, optional Q10 and no overflow.
  Screenshots inspected. A duplicate unrelated pending stepper was removed,
  dashboard rebuilt and the actual browser check rerun successfully with exactly
  one relevant stepper. Edge `155.0.4283.62`; final ignored browser evidence:
  `.local/c2-demo-browser-80d7d9f1-e912-4880-9ffb-3e7d70037b93/`.
- Existing `.venv\Scripts\python.exe scripts/c2_demo_smoke.py` passed authenticated
  catalogue, **45 live executions**, strict input, logout and log privacy checks
  against the final local stack. No preprocessing source/defaults changed.

Exact check commands (repository root):

```powershell
.venv\Scripts\python.exe -m pytest tests/integration/test_c2_submissions.py tests/integration/test_c2_annotation.py tests/integration/test_c2_demo.py tests/unit/test_c2_language_id.py tests/unit/test_c2_text_processing.py -q --tb=short
.venv\Scripts\python.exe -m pytest tests/integration/test_c2_submissions.py tests/contract/test_contracts.py -q --tb=short
.venv\Scripts\python.exe -m pytest --tb=short -ra
npm test
npm run lint
npm run typecheck
.venv\Scripts\python.exe scripts/run.py scripts.generate_contracts --check
npm run contracts:check
.venv\Scripts\python.exe -X utf8 scripts/check_repository.py
.venv\Scripts\python.exe scripts/check_ci.py
.venv\Scripts\python.exe -m ruff check services/orchestrator/c2_annotation.py services/orchestrator/c2_annotation_store.py services/orchestrator/c2_submission_import.py infrastructure/database/migrations/versions/c2a100000002_submission_annotation.py tests/integration/test_c2_submissions.py scripts/c2_submission_smoke.py
.venv\Scripts\python.exe -m ruff format --check services/orchestrator/c2_annotation.py services/orchestrator/c2_annotation_store.py services/orchestrator/c2_submission_import.py infrastructure/database/migrations/versions/c2a100000002_submission_annotation.py tests/integration/test_c2_submissions.py scripts/c2_submission_smoke.py
git diff --check
```

Repository-wide `ruff check . --statistics` retains **63 existing C3 findings**,
including 17 E402. No C3 files/rules were changed. Scoped C2 checks pass.

Initial sandbox pytest-temp access/Vitest spawn EPERM were resolved by authorized
execution. Initial importer scenario validation failed; fixed by using actual
custom-response shape in shared annotation contract. An expiry test accidentally
allowed automatic refresh; corrected to expire refresh too. No protected outputs
or gold labels were weakened. Local browser harness is ignored, not a dependency.

## Files affected in this increment

`apps/counsellor-dashboard/app/c2-demo/annotation/page.tsx` and new
`SubmissionWorkbench.tsx`; C2 `c2_annotation.py` / `c2_annotation_store.py` and new
`c2_submission_import.py`; additive migration `c2a100000002_submission_annotation.py`;
shared contract source, generated C2Annotation schemas/OpenAPI/TypeScript;
`tests/integration/test_c2_submissions.py`, `tests/frontend/c2-submissions.test.tsx`
and the existing annotation frontend fixture/navigation helper;
`scripts/c2_submission_smoke.py`; this report and appended demo documentation.
The local manifest/browser harness/reports are ignored. All prior accumulated
work remains unstaged; branch/HEAD unchanged. No C1/C3/C4 logic changed, no account
created/role changed, and no commit or push performed.

Links: [prior annotation evidence](c2-synthetic-dataset-annotation-v1.md),
[dataset annotation plan](c2-dataset-annotation-plan.md),
[quality/privacy](c2-quality-privacy-v1.md),
[checkpoint/known preprocessing limits](c2-preprocessing-checkpoint.md).
Independent human annotation, approved vocabulary, agreement, adjudication,
leakage/final validation and controlled release remain unfinished.

## Interaction/layout correction — 2026-10-22

Reproduced before editing in actual Edge: Q5–Q10 were editable; Previous/Next
answer and submission navigation worked. The code-mixed pilot Q4 was already
FINAL and correctly disabled. Boundary buttons were intentionally disabled.
No navigation/authorization bypass was needed. Confusion came from missing
prominent final-state feedback, all unanswered/available rows looking alike,
large vertically stacked navigation panels, and an HTTP refetch/busy state on
every answer selection. Reproduction report remains ignored at
`.local/c2-demo-browser-5843e261-1653-477c-aae4-db8d1ae8ff10/`.

Frontend-only changes: `annotation/SubmissionWorkbench.tsx`, `annotation/page.tsx`,
new local `annotation/annotation.css`, and focused `tests/frontend/c2-submissions.test.tsx`.
1160px centered desktop layout, compact left assignment/question navigation,
right answer/form, mobile stacking, selected-question outline and separate
Pending/Draft/Finalized/Optional missing/Privacy hold badges. Quality-only holds
and missing required answers are identified separately. Required fields,
boundary controls, read-only finals and access errors now have specific guidance.
Final answers show **Finalized — read only** without unlocking any record.

Question changes use the already-loaded frozen submission instead of refetching
it; submission changes and explicit reload still fetch current server state.
Unsaved labels retain their navigation confirmation. Saves still use existing
revision/version checks and refresh the server result. Save/error notifications
are visible, dismissible role=status/role=alert messages from actual responses.
Technical pipeline/version details are expandable; release warnings stay visible.
No backend, shared contracts, assignment, privacy or preprocessing changes.

Affected checks only:

```powershell
npm test -- tests/frontend/c2-submissions.test.tsx tests/frontend/c2-annotation.test.tsx tests/frontend/c2-demo.test.tsx
npm run lint
npm run typecheck
docker compose build counsellor-dashboard
docker compose up -d --no-deps --wait counsellor-dashboard
node .local/c2-annotation-layout-browser.mjs
git diff --check
```

Actual results: **68 focused frontend tests passed** (seven submission tests),
lint/typecheck/build and whitespace checks passed. Existing backend/full-suite
evidence above reused; no full suites/model evaluation rerun for presentation.
New tests cover explicit final lock/notice, untouched blank labels, distinct
question states, local navigation, unsaved-change cancellation, one dismissible
save notification, safe access errors and expiry. No protected expectations relaxed.

Final actual browser PASS, Edge 155.0.4283.62, local evidence
`.local/c2-demo-browser-090f8eb1-0089-44fb-b333-41f30ddc6aec/`:
Q5–Q10 clicks/editability; both directions of submission and answer navigation;
disabled first/last boundaries; Q4 prominent read-only state and identical full
backend final snapshot before/after; unfinalized English Q5 draft/reload; unchanged
text after language selection; separate-account peer hiding; optional Q10.
Desktop column geometry/1160px maximum and 390px no-overflow layout checked;
desktop/mobile screenshots actually inspected. Browser smoke appended only an
explicit automated synthetic draft revision, never replaced/unlocked a final.
Assignments and all existing saved history remain intact; no commit/push.
