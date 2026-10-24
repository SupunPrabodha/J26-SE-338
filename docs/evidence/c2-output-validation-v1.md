# C2 actual-output validation and local reference evaluation

Prepared 2026-10-23 against C2 checkpoint `170151c26ee13c2fcb9b3a1801204ca87b735a74`.
This correction is an uncommitted patch prepared in an isolated checkout. It has
not been applied to the user's Windows application. No participant text, survey
exports, credentials, model weights or historical evaluation artifacts were used.
The user's reported 116 submissions have **not** been evaluated here.

## What this implements

`run_preprocessing_pipeline()` now attaches `validation_summary`, computed from
the actual returned records. Each record has ordinal-position checks; each rule
has a description, a source path and a callable source function. The C2 demo
shows stage counts, per-record outcomes, reasons and editor paths, and downloads
only this text-free diagnostic object. Reset/edit/logout invalidate it together
with the associated result. Legacy saved snapshots may have no report; the UI
then says so rather than inventing passes.

The existing quality/privacy decisions, masking outputs, English Presidio model,
Language ID, normalization, tokenization and release-policy meaning are preserved.
Validation diagnostics **do not override the existing release policy**. In
particular, integrity failures are visible but this increment does not implement
the pending final dataset-release gate. `release_ready` remains the existing
automated-prerequisite result, never human approval.

## Rules and denominators

Policy definitions are in `services/preprocessing/validation.py`, ruleset
`c2-output-validation-v1`. They are a bounded C2 specification, not certification
against a universal anonymization or linguistic-tokenization standard.

| Stage | Actual output checks | What a pass does not establish |
|---|---|---|
| Anonymization | No supported email/mobile/student-ID pattern remains; existing review flag | Detection of every name, location or indirect identifier |
| Quality | Existing PASS/REVIEW/REJECT outcome and fixed issue codes | Meaning or diagnostic validity |
| Language evidence | Existing provisional evidence/abstention status | Correct language label |
| Normalization | NFC; canonical whitespace; NFC chunks and case preserved; placeholder sequence preserved | Independent semantic validation or paragraph-format preservation |
| Tokenization | Ordered exact code-point offsets; grapheme boundaries; complete non-whitespace coverage exactly once; intact placeholders | Linguistic morphology or correct downstream model tokens |

For each stage, `checked = pass + fail + review`; pass means **every applicable
stage rule passed**. `pass_rate_percent = 100 * pass / checked`. Not-evaluated
records are separate. Empty/unusable source text is not counted as successful
normalization/tokenization. Zero checked records gives JSON null / “Not measured”.
An uncertainty flag is reported as REVIEW, not a correctly detected language.
All displayed rates are **policy/integrity compliance, not accuracy**.

## Reference-based accuracy: separate local command

`scripts/c2_validate_outputs.py` accepts a local JSON document:

```json
{
  "reference_status": "unreviewed",
  "cases": [
    {
      "text": "My name is Nimal.",
      "gold_pii": [{"start": 11, "end": 16, "entity_type": "PERSON"}],
      "gold_language": "english"
    },
    {"text": "I feel tired.", "gold_pii": [], "gold_language": "english"},
    {"text": "Another answer without reference labels."}
  ]
}
```

These examples are fictional. One case is **one answer record, not one student**.
Preserve submission grouping separately; do not interpret multiple answers as
independent participants. Input order plus file SHA-256 identifies report rows
without exporting participant/input IDs. Distinct input text count is reported;
repeated records are not silently deduplicated or presented as independent data.

- `gold_pii` absent: PII accuracy is NOT_MEASURED for that record. Explicit `[]`
  means a reviewed negative reference; never substitute it for missing annotation.
- PII spans are zero-based half-open **Unicode code-point** offsets in the original
  input. Canonical types: PERSON, LOCATION, EMAIL, PHONE, STUDENT_ID. Incorrect
  type or boundary is FP plus FN, even if masking covers the same characters.
- The evaluator verifies that the runtime selector's trace reproduces actual
  masked output before reporting original-offset precision/recall/F1. Trace
  mismatch refuses a score. It reports misses, partial masks and extra masking.
- `gold_language` absent: no language accuracy denominator. Allowed target labels
  are sinhala, english, romanized-si, code-mixed. Labels describe intended answer
  language, fixed before inference; masking-induced loss of evidence is not
  corrected by changing reference labels after seeing predictions.
- Language results include all-labelled-record accuracy, abstentions, confusion
  counts, per-language scores and macro F1 over classes with defined denominators.
  PII results are sliced by entity and reference language where supplied.
- Missing/undefined metric denominators are null, not 100%. Negative-only PII
  cases can have exact-record agreement while entity F1 remains undefined.
- Reference status is a **declaration**, not proof of independent human review.
  Accepted declarations: unreviewed, author_reviewed, independent_review_declared.
  This program cannot establish consent, label correctness or reviewer independence.

From the repository root, using a **fresh** output directory:

```powershell
.\.venv\Scripts\python.exe scripts\run.py scripts.c2_validate_outputs --input tests\fixtures\synthetic\c2-validation-benchmark.json --output-dir artifacts\c2-evidence\validation-demo-new --strategy presidio
```

This writes `report.md` and `report.json` with source/input hashes, declared label
provenance, dependency versions, stage counts, rule/code locations and optional
reference scores. No input texts, output texts, input IDs, detected values or gold
spans are exported. Existing output directories are refused. The source file and
input stay unchanged. Run approved participant evaluation only in the restricted
local workflow; do not upload survey text or identifying gold to public systems.

For unlabelled records this command provides output-check rates only. It cannot
produce a defensible detection accuracy simply because 116 submissions exist.
Prepare/freeze references through the agreed review workflow and evaluate them
without tuning against the reserved evaluation set. The small supplied fixture
is an engineering demonstration, not a new research benchmark.

## Contracts and scope

One optional `validation_summary` is added to the existing two C2 demo responses.
New models use the C2Demo namespace. Authoritative Python contracts, JSON Schema,
both affected OpenAPI documents and TypeScript are generated together. Existing
mock/route/schema protection remains exact except for an explicit assertion of
this optional nullable addition; all previous fields/requirements must match.

No annotation-vocabulary approval, annotation agreement, adjudication, model
training, DVC release, C3 fixes, CI exceptions, commits or pushes are included.
Previous method-selection reports remain historical evidence with their original
sample sizes and limitations; they are not relabelled as current validation.

## Verification

Baseline affected Python checks: **175 passed, 2 known xfailed**. Added fault
injection tests deliberately corrupt offsets, Unicode boundaries, placeholders,
negation and content, and expose structured PII with a false-safe flag. Evaluation
tests use hand-counted TP/FP/FN, a missed name, an abstention, explicit negatives,
unlabelled cases, trace mismatch and overwrite protection.

Final verification results are recorded in the delivery guide accompanying the
patch. No Docker check is claimed: Docker is unavailable in this environment.
Actual browser verification was blocked by a missing Chromium binary and a
truncated browser-download archive. Frontend tests are jsdom tests, not a real
browser walkthrough. The Next.js build reported an existing dependency security
advisory; an unchanged-command retry completed with the warning. Dependency
security upgrades remain outside this scoped correction and are recommended
before deployment.

## Applied Windows checkout verification — 2026-10-23

The preparation-environment notes above are historical. The supplied
`C2_Output_Validation_v1.patch` has now been applied to the existing Windows
checkout on `feature/c2-anonymization-pipeline`, HEAD
`170151c26ee13c2fcb9b3a1801204ca87b735a74`. `APPLY_WITH_LOCAL_CODEX.txt` and
`START_HERE.md` were read. `git apply --check` passed; normal `git apply` succeeded
without conflicts, rejects, resets or overwrites. All **32 applied files initially
matched PATCH_MANIFEST.json SHA-256 values** exactly. Existing staged state was
empty and remains empty; pre-existing tracked/untracked edits are preserved,
including the user's text-processing test edit. No account, volume, cohort or
participant-data import, migration, commit or push was performed.

Two patch-local Windows portability defects were found and corrected:

- New reference-evaluator tests used default-encoding `read_text()`. On this
  Windows setup the UTF-8 Sinhala fixture was misread, producing 2/5 instead of
  the expected 4/5 language matches. Explicit UTF-8 reads corrected the test
  input; **no gold labels, Language ID rules or fixture texts changed**.
- CLI provenance keys used platform-native backslashes. `Path.as_posix()` now
  produces portable source locations, matching the documented/tested paths.

Actual browser inspection also found the new seven-column table squeezing words
on a narrow screen. The diagnostic component alone now uses a minimum-width table
inside the existing horizontal scroll container, with a labelled keyboard-focusable
region. A matching focused accessibility assertion was added. No masking,
language, quality/privacy, annotation or release-policy change was made.

### Actual checks

| Check | Outcome |
| --- | --- |
| Affected Python command below, after portability corrections | **268 passed, 17 known expected failures**, 93.45s; one existing TestClient deprecation warning |
| Initial full frontend `npm test` | **89 passed**, seven files |
| Final affected frontend tests after responsive correction | **54 passed**, validation/demo files |
| `npm run lint`, `npm run typecheck` | Passed |
| Python schema/OpenAPI drift and `npm run contracts:check` | Passed |
| Scoped Ruff check/format on nine affected Python files | Passed; final two corrected files also checked/formatted |
| Repository privacy checks, CI structure, `git diff --check` | Passed; hosted Actions not run |
| Docker build/up, affected services only | Passed; preprocessing, orchestrator and counsellor-dashboard healthy; unrelated services/volumes retained |
| Existing authenticated Docker demo smoke | Passed: **45 live executions**, strict validation, logout and log privacy |
| Protected checkpoint parity | **45/45** across 15 fictional inputs and all three strategies; original record outputs, language/normalization/tokens, quality/privacy summaries and release/blocking fields unchanged |
| Current Python versus Docker Presidio responses | **15/15 exact response matches**, including actual diagnostic summaries |

Commands run at repository root:

```powershell
.venv\Scripts\python.exe -m pytest tests/unit/test_c2_output_validation.py tests/unit/test_c2_validation_evaluation.py tests/unit/test_c2_text_processing.py tests/unit/test_c2_contextual_detection.py tests/unit/test_c2_role_kinship.py tests/unit/test_c2_relationship.py tests/integration/test_c2_demo.py tests/integration/test_c2_annotation.py tests/integration/test_c2_submissions.py tests/contract/test_contracts.py --tb=short -ra
npm test
npm run lint
npm run typecheck
npm test -- tests/frontend/c2-validation.test.tsx tests/frontend/c2-demo.test.tsx
.venv\Scripts\python.exe scripts/run.py scripts.generate_contracts --check
npm run contracts:check
.venv\Scripts\python.exe -X utf8 scripts/check_repository.py
.venv\Scripts\python.exe scripts/check_ci.py
docker compose build preprocessing orchestrator counsellor-dashboard
docker compose up -d --no-deps --wait preprocessing orchestrator counsellor-dashboard
.venv\Scripts\python.exe scripts/c2_demo_smoke.py
git diff --check
```

After the table correction, only counsellor-dashboard was rebuilt/refreshed.
The protected comparison used an existing isolated pre-patch snapshot whose
pipeline/detector/language/text/quality/privacy sources were checked against HEAD.
The first local HTTP comparison helper compared internal dataclasses with wire
models and therefore mismatched contract metadata; it was corrected to compare
complete actual API response models. No application behaviour was changed to make
that helper pass. Local helpers and aggregate evidence remain ignored, not new
runtime dependencies.

### Real browser, downloads and stale responses

Actual Edge browser checks passed at **http://localhost:3001/c2-demo**:
authenticated fictional execution; returned counts and NOT_MEASURED accuracy;
expanded rule source locations; actual `c2-run-validation.json` download exactly
equal to the returned validation object, without input/anonymized text; desktop
1366px and mobile 390px at scale 1, no page overflow and a horizontally scrollable
mobile table. Screenshots were actually inspected.

Reset and input edits clear validation/results immediately. Both were tested
while a successful **real local HTTP response** was held and subsequently released;
stale data did not reappear. No simulated successful result or progress was used.
Final local browser report/screenshots/download are ignored at
`.local/c2-demo-browser-2302c3bd-b552-41b6-9e19-e47bdc29e2e8/`.

### Local fictional evaluator results and boundaries

The supplied six-case fixture was executed locally with Presidio:

```powershell
.venv\Scripts\python.exe scripts/run.py scripts.c2_validate_outputs --input tests/fixtures/synthetic/c2-validation-benchmark.json --output-dir artifacts/c2-evidence/output-validation/local-patch-v1-windows --strategy presidio
```

Actual five-labelled/one-unlabelled results: typed PII **TP/FP/FN = 1/0/1**, F1
**66.67%**, recall **50%**, **one entirely exposed entity**; Language ID **4/5 =
80%**, one abstention. References are unreviewed synthetic development fixtures;
these results measure neither the user's survey data nor general system accuracy.
Supported anonymization diagnostics can pass despite the known missed name.

A separate six-case copy with all gold fields removed was evaluated at
`artifacts/c2-evidence/output-validation/local-unlabelled-v1/`: both PII and
Language ID status **NOT_MEASURED**, F1/accuracy **null**. No missing gold was
converted into a reviewed negative. Earlier local output paths were not overwritten.
Aggregate protected parity: `artifacts/c2-evidence/output-validation/protected-patch-v1.json`.

No real survey responses were read, uploaded or evaluated. The previously
documented **Next.js 16.4.0 security advisory remains unresolved**; this local
Docker build succeeded without emitting that warning, and no dependency/lockfile
upgrade was made. No security resolution is claimed. Known PERSON/LOCATION misses,
Language ID uncertainty and existing expected failures remain. Diagnostic pass
rates, reference agreement and human release authorization stay separate.
# Current residual-output supplement (2026-10-24)

The original v1 results below are historical. The current working tree adds
`c2-output-validation-v1.1+residual-output-v1`: an output-only complementary
privacy safeguard, with separate FAIL/REVIEW rules and existing release-gate
blocking. `release_policy_unchanged` is now false for new responses because these
checks strengthen enforcement. Accuracy remains NOT_MEASURED for unlabelled runs;
normalization/tokenization integrity is separate. See
[residual-output method, misses, false alarms and checks](c2-residual-output-v1.md).
No historical scores or candidate rejection decisions were overwritten.
