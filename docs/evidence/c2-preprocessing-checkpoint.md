# C2 contextual anonymization and preprocessing checkpoint

Prepared 2026-10-15 on `feature/c2-anonymization-pipeline`, parent
`65e4db35c775dafa6bd9939b2cf56fc1e291da51`. This checkpoint is a provisional
synthetic engineering baseline; anonymization is incomplete and human release
approval remains required. No model is trained/promoted and global Regex default
is unchanged.

The active contextual/predicate/title/role/kinship/location corrections and
review-only relationship signal are preserved. Language ID v1.2 distinguishes
supported mixed-language evidence from Sinhala in two scripts, retaining v1.1
Romanized introductions. Processing order is Anonymize → existing Quality →
Language ID → NFC/whitespace Normalize → grapheme-word Tokenize. Annotation,
dataset validation and versioned release remain pending. Quality/privacy release
gates operate independently of derived language/text results.

Stage reports: [Language ID](c2-language-id-v1.md),
[normalization](c2-normalization-v1.md), [tokenization](c2-tokenization-v1.md).
See [category policy](c2-language-category-policy.md),
[anonymization provenance](c2-contextual-runtime-v1.md),
[quality/privacy milestone](c2-data-quality-milestone.md) and
[demo walkthrough](c2-demo-page.md). Demo: http://localhost:3001/c2-demo.
Private development counsellor sign-in uses existing authorization; credentials
are not printed or committed.

## Selected snapshot verification

The index was initially empty. Explicit file paths were staged and exported with
`git checkout-index --all --prefix=D:/J26-SE-338/.local/c2-checkpoint-verified/`.
Dependencies were installed there using `npm ci --offline --ignore-scripts`.
Checks below ran against this isolated index snapshot, excluding accumulated
offline experiments. Local dependency environment: Python 3.12.10, spaCy 3.8.16,
en_core_web_sm 3.8.0, Presidio 2.2.364, regex 2026.9.29.

| Command (snapshot root unless stated) | Actual result |
| --- | --- |
| `D:\J26-SE-338\.venv\Scripts\python.exe -m pytest` | 736 passed, 22 expected failures, 94.28 s; one existing TestClient deprecation |
| `npm test` | 65 passed, including 49 C2 tests; reused after only enum/browser-verifier changes |
| `npm run lint` | Passed after final browser-verifier update |
| `npm run typecheck` | Passed with final generated contracts |
| `npm run contracts:check` | Passed |
| Python contract drift/compatibility | Passed in full pytest above |
| `python -X utf8 scripts/check_repository.py` | Passed; default Windows cp1252 invocation failed decoding Unicode, UTF-8 invocation resolves environment issue |
| `python scripts/check_ci.py` | Passed; hosted Actions not executed |
| `python -m ruff check` with explicit staged Python paths | Passed |
| `python -m ruff check . --output-format concise` | 63 existing C3 findings, including 17 E402; no C3/CI edits or rule changes |
| `git diff --cached --check` | Passed before final commit review |

The first snapshot test caught three dependent generated schemas missing the
v1.2 method enum. They were included and the suite rerun. Actual browser execution
then caught the new mixed-script reason missing from the shared reason enum;
this was corrected at the shared source, all artifacts regenerated, a demo-contract
regression added, and the final full suite/type/drift/browser checks rerun.
No tests or gold labels were weakened.

## Real Docker/dashboard verification

At workspace root:

```text
docker compose build preprocessing orchestrator counsellor-dashboard
docker compose up -d preprocessing orchestrator counsellor-dashboard
.venv\Scripts\python.exe scripts/c2_demo_smoke.py
node scripts/c2_demo_browser.mjs .local/c2-checkpoint-browser-inputs.json
```

Docker was initially stopped; it was started and affected builds completed.
Authenticated smoke passes 45 scenario executions plus custom inputs, strict
validation, no-store, logout and text/secret log checks. Selected coverage verifier
executed on 59 fixtures: local/Docker equality and span/render integrity both true.
Its import uses the existing equivalent Unicode boundary helper in committed
contextual tests, avoiding an excluded experimental calibration dependency;
the original working-file import is preserved outside this commit.

Edge 155.0.4283.45 real browser checks pass: private C2 sign-in; actual normal,
empty, review and mixed-script runs; Before/After, normalized text/tokens/offsets,
actual quality/privacy/gates; one visible outcome notification; real 422 error;
Reset/logout; desktop 1366 and mobile 390, scale 1 / default 100% zoom. Desktop
and mobile screenshots were visually inspected. The compact summary has no
evidence-context card/artifact paths and hides counts for one record.
Local ignored browser evidence: `.local/c2-demo-browser-f1b6db0a-2886-47c6-984e-70fdd0972f2c`.
The four browser input cases are development smoke, not a language accuracy set.

## Measured results and remaining limits

Language ID unchanged frozen 33: language matches 15/24, seven abstentions,
two wrong labels, nine controls correct. Added category development: 12/15 →
15/15; reused short development: 32/33 unchanged. Mixed evidence lost during
anonymization and English quoting Romanized markers remain errors. These are
reused/inspected synthetic cases, not independent validation.
Normalization matches 16/16 frozen expected strings, zero operational preservation
errors. Tokenization: 75 TP / 0 FP / 0 FN, zero offset/boundary/content errors on
the same 16-case development pack. Whitespace-only references were actually run;
other alternatives documented in stage reports were reviewed only.

PII remains incomplete: informal unintroduced Sinhala/Romanized names and
locations can be missed; relationship names can have wrong entity types or
remain exposed despite review blocking. REVIEW is not successful detection.
See existing strict expected-failure tests and active evidence. No universal
privacy-safe, semantic-preservation accuracy or best-performing claim is made.

## Scope and exclusions

Included: active C2 runtime dependencies, additive C2 shared contracts and required
generated schemas/OpenAPI/TypeScript, authenticated demo integration, C2 page and
stepper, matching synthetic regression fixtures/tests, reusable verification and
stage evidence. Shared API cancellation/header options preserve existing defaults;
dashboard navigation/style edits are restricted to the C2 link/selectors.

Excluded and preserved: GLiNER/calibration/training/annotation/rejected-title and
Presidio experiments, their reports/data/weights, `.local` helpers/screenshots,
ignored aggregate run artifacts, CI investigation, annotation-derived extra
student-ID tests and unrelated work. No participant data, real credentials,
environment files or C3 source are staged. Required generated contract artifacts
are included for drift consistency; generated datasets/run outputs are excluded.

## Exact included paths

- `apps/counsellor-dashboard/app/c2-demo/PipelineStepper.tsx`
- `apps/counsellor-dashboard/app/c2-demo/demo.css`
- `apps/counsellor-dashboard/app/c2-demo/page.tsx`
- `apps/counsellor-dashboard/app/globals.css`
- `apps/counsellor-dashboard/app/page.tsx`
- `docs/evidence/c2-demo-page.md`
- `docs/evidence/c2-honorific-role-v2.md`
- `docs/evidence/c2-language-category-policy.md`
- `docs/evidence/c2-language-id-v1.md`
- `docs/evidence/c2-language-short-phrase-v1.md`
- `docs/evidence/c2-location-case-v1.md`
- `docs/evidence/c2-normalization-v1.md`
- `docs/evidence/c2-pii-coverage-v1.md`
- `docs/evidence/c2-preprocessing-checkpoint.md`
- `docs/evidence/c2-role-kinship-v3.md`
- `docs/evidence/c2-romanized-predicate-v1.md`
- `docs/evidence/c2-student-id-selection-v1.md`
- `docs/evidence/c2-text-preparation-v1.md`
- `docs/evidence/c2-tokenization-v1.md`
- `packages/contracts/json-schema/v1/C2CustomDemoRequest.json`
- `packages/contracts/json-schema/v1/C2CustomDemoResponse.json`
- `packages/contracts/json-schema/v1/C2DemoCatalogue.json`
- `packages/contracts/json-schema/v1/C2DemoLanguageIdentification.json`
- `packages/contracts/json-schema/v1/C2DemoPrivacySummary.json`
- `packages/contracts/json-schema/v1/C2DemoQualityPolicy.json`
- `packages/contracts/json-schema/v1/C2DemoQualitySummary.json`
- `packages/contracts/json-schema/v1/C2DemoRecord.json`
- `packages/contracts/json-schema/v1/C2DemoRequest.json`
- `packages/contracts/json-schema/v1/C2DemoResponse.json`
- `packages/contracts/json-schema/v1/C2DemoScenario.json`
- `packages/contracts/openapi/orchestrator.v1.json`
- `packages/contracts/openapi/preprocessing.v1.json`
- `packages/contracts/src/research_contracts/__init__.py`
- `packages/typescript-common/src/api.ts`
- `packages/typescript-common/src/contracts.d.ts`
- `packages/typescript-common/src/ui.tsx`
- `scripts/c2_contextual_verify.py`
- `scripts/c2_demo_browser.mjs`
- `scripts/c2_demo_smoke.py`
- `scripts/c2_language_categories_evaluate.py`
- `scripts/c2_language_id_evaluate.py`
- `scripts/c2_language_short_evaluate.py`
- `scripts/c2_pii_coverage_verify.py`
- `scripts/c2_preparation_evaluate.py`
- `scripts/generate_contracts.py`
- `services/orchestrator/demo.py`
- `services/orchestrator/main.py`
- `services/preprocessing/anonymization.py`
- `services/preprocessing/contextual_detection.py`
- `services/preprocessing/demo.py`
- `services/preprocessing/language_id.py`
- `services/preprocessing/location_case.py`
- `services/preprocessing/main.py`
- `services/preprocessing/person_context.py`
- `services/preprocessing/person_context_regressions.py`
- `services/preprocessing/pii_coverage.py`
- `services/preprocessing/pipeline.py`
- `services/preprocessing/presidio_anonymization.py`
- `services/preprocessing/privacy_gate.py`
- `services/preprocessing/quality_fixtures.py`
- `services/preprocessing/role_kinship_regressions.py`
- `services/preprocessing/romanized_predicate.py`
- `services/preprocessing/span_evaluation.py`
- `services/preprocessing/text_processing.py`
- `tests/fixtures/synthetic/c2-demo.json`
- `tests/fixtures/synthetic/c2-role-review.json`
- `tests/fixtures/synthetic/c2-text-processing.json`
- `tests/frontend/c2-demo.test.tsx`
- `tests/integration/test_c2_demo.py`
- `tests/unit/test_c2_anonymization.py`
- `tests/unit/test_c2_demo_person_samples.py`
- `tests/unit/test_c2_demo_romanized_diagnostics.py`
- `tests/unit/test_c2_language_id.py`
- `tests/unit/test_c2_location_case.py`
- `tests/unit/test_c2_person_context.py`
- `tests/unit/test_c2_relationship.py`
- `tests/unit/test_c2_role_kinship.py`
- `tests/unit/test_c2_romanized_predicate.py`
- `tests/unit/test_c2_text_processing.py`
