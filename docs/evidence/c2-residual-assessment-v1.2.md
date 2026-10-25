# C2 demo and residual-validation checkpoint

2026-10-25. Active baseline `65bd7d3`; scoped UI/diagnostic increment.

## Active implementation

The demo has balanced Input text / Anonymized text cards, responsive stacking,
retained editable input, actual loading/error handling, Reset/edit invalidation,
compact GLiNER identification, compact read-only Language ID, normalized text,
tokens, collapsed token positions and compact deduplicated masked-entity badges.
Quality/privacy FAIL and REVIEW findings remain visible. No display of accuracy,
percentage pass rates, repeated technical disclosures or repeated release-only
panel in the ordinary demo. One development/synthetic notice remains.

The active model remains `urchade/gliner_multi-v2.1`, revision
`443d26d654e0324125a96bebd8e796c14ff2efe6`, name-label whole-text configuration
`gliner-name-labels-v4-context-demo-v1`, threshold 0.7. Masking, structured
recognizers, Unicode offsets, placeholders and global Regex default are unchanged.
The withdrawn sentence-context LOCATION addition remains offline. No model,
threshold, tokenizer, Language ID or annotation implementation is added here.

## Residual assessment and displayed counts

`validation.py` now reports `c2-output-validation-v1.2+residual-output-v1`.
The optional central shared `C2DemoRecordValidation.residual_assessment` reports
FAIL, REVIEW, NO_SIGNAL or NOT_EVALUATED, NOT_VERIFIED, existing output-auditor
method, safe rule IDs and reasons. Older reports without the field remain valid.
JSON Schema, OpenAPI and TypeScript are regenerated together. Annotation schemas
change transitively because they embed demo responses; no annotation workflow,
identity, database or migration change is required.

No supported PERSON/LOCATION output signal is NOT_EVALUATED at rule level rather
than PASS. The UI displays the actual NO_SIGNAL assessment as **No residual signal
detected**, separately from missing/unavailable, truly not-run, FAIL and REVIEW.
For display only, complete NO_SIGNAL assessments are separated from the backend's
not-evaluated bucket and included in the displayed Checked count. No original
object is mutated: raw backend counts, percentages, NOT_VERIFIED, rules/reasons
and accuracy_status=NOT_MEASURED remain unchanged in downloaded JSON.
Email, phone and student-ID pattern outcomes are displayed individually.

Downloads add only text-free execution provenance and actual `release_status`
(release_ready, every blocking reason and human_release_required). They never
export input/output text. Missing report/assessment/counts remain explicit, not
default zero/PASS. The stepper retains honest uncertainty and Pending release;
annotation consumers retain their existing release view.

## Release-policy review

`pipeline.py`, `privacy_gate.py`, `residual_privacy.py`, GLiNER inference and the
release-readiness calculation are unchanged from the committed baseline.
Actual residual FAIL/REVIEW still set the existing privacy-review flag and block
release. NO_SIGNAL is neither verified anonymity nor an automatic FAIL solely
because reference labels are absent. The experimental GLiNER blocker remains
unconditional; explicit model failures never fall back. Human release approval
remains required at final release. The existing report field
release_policy_unchanged=false is retained, not a new policy weakening.

## Reused live verification and limitations

Before selection, 16 actual Docker/API responses equalled actual Python outputs;
the browser additionally verified the late exact honorific diagnostic. Seven
protected preceding responses retained output, transformations, derived text,
tokens/offsets, quality and release results. Final presentation: five actual
fictional cases covered NO_SIGNAL, FAIL, REVIEW and empty output, unchanged raw
diagnostics and all release blockers in downloads. The explicit Presidio API was
used for real FAIL/REVIEW controls via disposable browser-only request strategy
instrumentation; no fixed result or expected text was injected. Desktop/mobile
screenshots and final no-wrap table headings were inspected. Reset clears results.
70 affected frontend tests, lint/typecheck and dashboard build passed. Backend
assessment/contract checks passed 64 tests; pipeline/integration checks and the
exact additive compatibility guard were verified. Selection checks below are
recorded separately and do not pretend that excluded experiments were tested.

No new residual detector is added. On the reused 36 proposed synthetic output
controls, the unchanged auditor misses 8/23 residual-positive records, with two
REVIEW false alarms among ten negatives. These are development triage results,
not independent anonymizer accuracy. Names/places can remain exposed despite
quality PASS and NO_SIGNAL. Known reported misses include Sinhala locations,
Romanized relationship names, a short English name and undelimited honorific
wording. No claim of complete anonymization or multilingual validation is made.
Agreement/adjudication/dataset release remain pending. Existing tokenizer,
Starlette deprecation and Next.js advisory limitations are not hidden.

## Verification of the selected snapshot

Verified in detached `.local/c2-demo-validation-checkpoint`, based on `65bd7d3`
with only the 25 explicitly selected files overlaid. Offline study files and
untracked helpers/fixtures are absent. Active combine/splitter/boundary functions
are AST-identical to the previously verified runtime, justifying reuse of the
actual GLiNER/API/browser evidence above without repeating model evaluation.

- Selected Python: **235 passed, 1 existing xfailed**, one existing Starlette
  deprecation warning. Covers masking, Unicode/placeholders, structural quality,
  residual FAIL/REVIEW/NO_SIGNAL, release blocking, authenticated routes and
  compatible contracts. No isolated check is reported as an accuracy benchmark.
- Selected frontend demo/validation: **70 passed**; lint/typecheck and TypeScript
  drift passed. Tests cover missing/unknown/not-run states, individual structured
  outcomes, lossless diagnostics/exported blockers, pending release, unchanged
  annotation consumers, duplicate submissions, errors, Reset and stale responses.
- Selected JSON Schema/OpenAPI drift, scoped Ruff and CI-structure checks passed.
  Repository checker initially failed under Windows cp1252 with UnicodeDecodeError;
  the explicit `-X utf8` run passed, without changing checker logic.
- The selected frontend built successfully with the pinned Dockerfile into
  `j26-c2-ui-checkpoint:verification`. No live backend/service restart, database
  operation or new model load was needed. The existing exact-matching live smoke
  and desktop/mobile checks are reused, not misrepresented as a new hosted run.
- Release-critical pipeline/privacy/auditor/inference sources are byte-identical
  to the committed baseline. Only diagnostic aggregation changes; no blocker or
  actual FAIL/REVIEW is converted into success. The exact optional schema and
  method additions are asserted in compatibility tests, with all other fields,
  routes and unrelated components still compared to HEAD.
- No full unrelated suite, broad threshold/model comparison, C3 lint edit,
  Language ID comparison, training, participant access or dependency update.

Commands run from the detached snapshot (Python executable from the existing
root `.venv`; no environment/secrets were copied):

```powershell
D:\J26-SE-338\.venv\Scripts\python.exe -m pytest tests/unit/test_c2_output_validation.py tests/unit/test_c2_residual_privacy.py tests/unit/test_c2_gliner_demo.py tests/unit/test_c2_pipeline.py tests/unit/test_c2_privacy_gate.py tests/unit/test_c2_text_processing.py tests/unit/test_c2_anonymization.py tests/unit/test_c2_presidio_anonymization.py tests/unit/test_c2_hybrid_anonymization.py tests/integration/test_c2_demo.py tests/contract -p no:cacheprovider --basetemp=D:/J26-SE-338/.local/c2-ui-selected-pytest --maxfail=2
npm test -- tests/frontend/c2-demo.test.tsx tests/frontend/c2-validation.test.tsx
npm run lint
npm run typecheck
npm run contracts:check
D:\J26-SE-338\.venv\Scripts\python.exe scripts/run.py scripts.generate_contracts --check
D:\J26-SE-338\.venv\Scripts\python.exe -m ruff check services/preprocessing/validation.py packages/contracts/src/research_contracts/__init__.py tests/unit/test_c2_output_validation.py tests/integration/test_c2_demo.py
D:\J26-SE-338\.venv\Scripts\python.exe -X utf8 scripts/check_repository.py
D:\J26-SE-338\.venv\Scripts\python.exe scripts/check_ci.py
docker build -t j26-c2-ui-checkpoint:verification --build-arg APP=counsellor-dashboard -f infrastructure/docker/frontend.Dockerfile .
```

Only active evidence sections are selected here; the full local mixed study
report, threshold comparisons, candidate implementations and other excluded work
remain preserved in the original worktree. No push is authorized for this checkpoint.
