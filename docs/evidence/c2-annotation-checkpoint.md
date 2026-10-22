# C2 grouped submission annotation checkpoint

Prepared 2026-10-22 on `feature/c2-anonymization-pipeline`, parent
`c2adc3083dfc8a4a7702bca8d724b55919750c34`. Provisional synthetic engineering
checkpoint only: independent human annotation, expert-approved vocabulary,
agreement, adjudication, final dataset validation and controlled release are
not completed. Existing anonymization limitations remain.

## Scope and shutdown recovery

The requested commit did not exist after the laptop shutdown; HEAD remained the
parent above. The explicit 38-file index selection, isolated export and locked
frontend dependency installation survived. All **352 selected-tree source files**
matched their index blob hashes, with no missing/changed files. No unrelated
staging existed when selection began; accumulated excluded edits were preserved.
This verification document is the only subsequent addition to the selected tree.

The earlier isolated Python process had no recoverable final result. It was
rerun once; unfinished frontend checks were completed. Previously confirmed
Python contract drift, CI structure and scoped Ruff checks were reused for the
unchanged snapshot. One C2 mock-compatibility test indentation issue had been
corrected with Ruff formatting before selection; its assertions were preserved.

## Selected snapshot verification

Export: `.local/c2-annotation-selected-20261022/`, using `git checkout-index`
without branch changes. No excluded experiments, local helpers, cohort,
participant material, environment file or generated evaluation artifacts were
copied into that export. Dependencies: existing Python environment plus
`npm ci --offline --ignore-scripts --no-audit --no-fund` inside the export
(258 locked packages). No runtime dependency/lock changes.

Commands below ran from that isolated snapshot unless noted:

| Command | Actual outcome |
| --- | --- |
| `D:\J26-SE-338\.venv\Scripts\python.exe -m pytest --tb=short -ra --junitxml=.local/selected-snapshot-python-resume.xml` | **757 passed, 22 expected failures**, 131.97s; one existing TestClient deprecation warning |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed, both workspaces |
| `npm test` | **84 passed**, six files, including seven grouped-submission UI tests |
| `npm run contracts:check` | Passed |
| `D:\J26-SE-338\.venv\Scripts\python.exe scripts/run.py scripts.generate_contracts --check` | Passed; shared JSON Schema/OpenAPI drift |
| `D:\J26-SE-338\.venv\Scripts\python.exe scripts/check_ci.py` | Passed; hosted CI not run |
| Scoped `ruff check` / `ruff format --check` over all 12 selected Python files | Passed; all 12 formatted |
| `D:\J26-SE-338\.venv\Scripts\python.exe -X utf8 scripts/check_repository.py` with Git work tree explicitly set to the export | Passed; checked selected candidate files and frontend privacy restrictions |
| `git diff --cached --check` at repository root | Passed before final review |

The full Python run exercises both migrations on fresh disposable SQLite,
Q4–Q10 ordering, six required questions and absent optional Q10, duplicate/privacy
withholding, completion semantics, two explicit account assignments, rejection
of an unassigned third account, stale versions, draft recovery, immutable finals,
peer hiding and old mock compatibility. Protected masking, quality/privacy and
release controls are included in the full suite. The 22 expected failures retain
known name/relationship false masks/misses, quoted-language ambiguity and an
existing Hybrid overmask; they are not corrected detections.

Repository-wide Ruff's previously recorded **63 C3 findings**, including 17 E402,
remain unresolved. No C3 or CI edits/rule changes. Scoped C2 Ruff passes.

## Reused real execution evidence

Runtime/UI files selected here match the files that passed recorded local
Docker and browser verification; no subsequent runtime changes were selected.
These checks were **not rerun after shutdown**, avoiding unnecessary rebuilds,
service restarts or additional immutable test finals:

- Both affected Docker images built; additive PostgreSQL migrations started.
- Four synthetic survey submissions/28 positions imported, with **27 available
  answers and one unanswered optional Q10**, no quality/privacy exclusions in
  this pilot. Duplicate/privacy exclusion paths separately tested; policies
  never bypassed. The other 996 submissions are not imported or committed.
- Authenticated API smoke verified same frozen versions assigned to two distinct
  existing accounts, persisted draft, peer hiding, final lock and unchanged text.
- Existing demo smoke passed 45 actual executions, validation/logout/log privacy.
- Final Edge 155.0.4283.62 browser check passed Q5–Q10 clicks/editability, both
  directions of answer/submission navigation, deliberately disabled boundaries,
  Q4 read-only notice and unchanged final snapshot, English Q5 draft/reload,
  text unchanged by language labels, untouched labels blank and peer hiding.
  Desktop 1160px layout and mobile 390px were checked; screenshots inspected.

Reports/screenshots remain ignored locally; see the
[pilot report](c2-submission-annotation-pilot-v1.md) for exact commands and paths.
Saved smoke labels are automated synthetic test decisions, not independent human
gold. Existing drafts/finals and assignments are preserved. No participant data
or live database modifications were needed to verify this selected snapshot.

## Included source and dependencies

- C2 UI: `apps/counsellor-dashboard/app/c2-demo/PipelineStepper.tsx`, demo
  `page.tsx`, and annotation `page.tsx`, `SubmissionWorkbench.tsx`, `annotation.css`.
- C2 backend: `services/orchestrator/demo.py`, `c2_annotation.py`,
  `c2_annotation_store.py`, `c2_submission_import.py`.
- Additive migrations: `c2a100000001_synthetic_annotation.py` and
  `c2a100000002_submission_annotation.py`; existing C1 tables/auth logic unchanged.
- Shared contract source, orchestrator OpenAPI, TypeScript declarations and ten
  `C2Annotation*` JSON Schemas. No service-local contract definitions.
- Integration tests: `test_c2_annotation.py`, `test_c2_submissions.py`, compatible
  update to `test_c2_demo.py`; frontend `c2-annotation.test.tsx` and
  `c2-submissions.test.tsx`. Small disposable fixtures are inline/test-only or
  reuse already committed synthetic fixtures; the generated cohort is excluded.
- Reusable `scripts/c2_annotation_smoke.py` and `scripts/c2_submission_smoke.py`.
- Evidence: dataset-annotation plan, separate independent-PII plan (documentation
  only, not its experimental tooling), current quality/privacy consolidation,
  synthetic annotation report, submission pilot report, demo walkthrough,
  annotation scope/source-review note, and this checkpoint record.

## Exclusions and completion boundary

No preprocessing detection changes are included: they already exist in the parent.
Excluded work stays in the working tree: GLiNER/calibration/rejected training and
titled-name candidates, offline PII preparation/annotation studies, experimental
regression/evaluation helpers, prior coverage-verifier/student-ID test edits,
unrelated Language ID/normalization/tokenization documentation edits and CI-run
investigation. `.local` helpers, datasets/cohort, weights, reports/artifacts,
credentials/environment files, participant records and unrelated member code
are excluded. Generated **contracts** are included as required API source artifacts;
generated evaluation reports/data are not.

Two distinct authenticated accounts establish account separation only. Vocabulary
is provisional/demo-only. Review/quarantine is not correct anonymization, and
automated readiness is not human release approval. Agreement/adjudication and
versioned dataset release remain pending. This checkpoint authorizes no push.
