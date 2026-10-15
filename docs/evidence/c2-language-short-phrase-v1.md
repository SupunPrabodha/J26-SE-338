# C2 Language ID short introduction — development checkpoint

Before editing, actual `identify_language` and authenticated-boundary local
`execute_custom` reproduce `Mge nama [PERSON]` as uncertain. Both `mge` and `nama`
are already markers; lowercasing already handles case and `mge` abbreviation.
Removing placeholders leaves two words, below the three-token rule. Exact reason:
`insufficient_or_ambiguous_latin_evidence`. Local output is unchanged; quality
PASS, no privacy flag, automated gate passed. These gates are not language accuracy
or human release approval.

Predeclared candidate: a complete two-word `mage/mge/eyge nama` possessive-name
field at the beginning of anonymized text, with only ignored placeholders,
whitespace/punctuation/emoji afterwards. Require the two grammar words adjacent
in the original anonymized text; do not bridge an intervening placeholder.
Case-insensitive, no personal-name dictionary. Quoted fragments, near matches,
other shared marker pairs and weak English remain uncertain. Generic three-token
and distinct-marker criteria stay unchanged. Do not route or alter anonymization.

Before activation, compare 33 fixed new diagnostic cases (development only) with
the unchanged old 33-case Language ID evaluation. Acceptance: all 16 explicit
introduction positives get provisional Romanized Sinhala; no additional wrong
control labels or forced ambiguous controls; no frozen-case label regressions;
masking, normalization/tokens, quality/privacy/release fields identical. Retain
all failures, including existing English quoted-phrase false code-mixed detection.
This is grammar evidence, not calibrated confidence or independently reviewed
language annotation. All-caps acronym/borrowed-phrase ambiguity remains a limit.

Baseline source is frozen, ignored and hashed under
`artifacts/c2-evidence/language-id/short-phrase-v1/baseline_language_id.py`.
Candidate helper was initially unused by runtime pending these checks.

## Results and activation

The predeclared candidate met the bounded criteria and was activated as
`c2-rule-language-v1.1`. Only complete short introduction evidence is added;
the general three-word minimum is unchanged. The reported phrase now returns
`romanized-si`, `provisional`, reason
`explicit_romanized_name_introduction`, `uncertain=false`. That boolean means
the provisional rule matched, not calibrated confidence or privacy safety.

| New development diagnostics (33) | Before | After |
|---|---:|---:|
| Exact expected language/uncertainty labels | 16/33 | 32/33 |
| Explicit introduction positives classified Romanized | 0/16 | 16/16 |
| Language-case abstentions | 16 | 0 |
| Total unknown/uncertain (including controls) | 28 | 12 |
| Wrong provisional labels | 1 | 1 |

English negatives, shared words (`mama`, `nama`, other two-marker pairs), quoted
fragments, broken adjacency and near matches remain in the pack. The existing
English sentence `The phrase mge nama is quoted.` remains incorrectly code-mixed:
generic marker evidence does not recognize English metalinguistic quoting.
The desired English label is retained as a strict known-failure regression.
No difficult cases were removed, relabelled or hidden.

### Unchanged frozen evaluation, 33 reused development cases

| Intended language | Cases | Before matches | After matches | Before→after abstentions | Before→after wrong provisional labels |
|---|---:|---:|---:|---|---|
| Sinhala | 6 | 6 | 6 | 0→0 | 0→0 |
| English | 6 | 4 | 4 | 2→2 | 0→0 |
| Romanized Sinhala | 6 | 3 | 3 | 3→3 | 0→0 |
| Code-mixed | 6 | 2 | 2 | 2→2 | 2→2 |
| Unknown controls | 5 | 5 | 5 | n/a | 0→0 |
| Uncertain controls | 4 | 4 | 4 | n/a | 0→0 |

Language cases remain **15/24 matches, seven abstentions, two wrong provisional
labels**. Controls remain 9/9 correct; all 33 labels, reasons, statuses and
uncertainty values are unchanged except method/version metadata. These fixtures
and labels were not edited. The original report and its provenance stay intact.
The reported short naming phrase is not in that old frozen set, so the new
diagnostic improvement is reported separately rather than inflated into its score.
The two mixed→English errors still follow existing masking that removes Romanized
evidence. Weak phrases and detector-related evidence loss remain unresolved.

Aggregate evidence under `artifacts/c2-evidence/language-id/short-phrase-v1`:
`reproduction.json`, `candidate.json`, `runtime-diagnostics.json`,
`frozen-runtime/report.json`, `docker-parity/report.json`, `preservation.json`.
No submitted fixture text/detected values are in aggregate reports (the initial
reproduction records only the two grammar words to explain the threshold).
These are development/diagnostic measurements, not independent annotation or
research validation. No model search, download, training or threshold tuning.

Actual activated runtime agrees with all 33 offline candidate decisions. A
single local CPU pass measured total 0.6694 ms, mean 0.02028 ms and max 0.0788 ms
for Language ID alone on these short diagnostics; imports/model loading excluded.
This is wall-clock timing with scheduling noise, not a load benchmark or memory
measurement. Normalize/Tokenize implementation and previous measured evidence
are unchanged.

## Contracts and verification

Shared C2 Language ID contract adds the reason and accepts both v1/v1.1 method
values, defaulting to current v1.1. Schema/OpenAPI/TypeScript regenerated together.
This additive C2 change is identified for affected-member contract review; C1
mock/authentication workflows and service-local contracts were not edited.
Presidio still uses the existing English analyzer; global Regex default intact.

Focused Python: **195 passed, 2 expected failures**, 43.91s. Full Python:
**943 passed, 24 expected failures**, 104.04s, one existing TestClient deprecation
warning. Known Hybrid introductory overmasking and the new quoted-English
diagnostic remain visible. Frontend: **65 passed**; lint/typecheck, contract drift,
compatibility in full tests, repository/CI checks, scoped Ruff/format passed.
The previous 63 unrelated C3 global Ruff failures are reused, not hidden or fixed.

Docker rebuilt preprocessing/shared-contract image and frontend; affected
services restarted healthy. Actual Python/Docker parity passed 70 protected
contextual/contact cases. Stored all-three-strategy spans, transformation labels,
quality status and release/blocking results equal the prior checkpoint; anonymizer
source hashes are unchanged. The paired candidate experiment also verifies all
record fields other than Language ID, including normalized text, tokens/offsets,
and all quality/privacy/release fields remain identical on the 33 frozen cases.
Existing authenticated smoke passed 45 scenario executions, validation,
development/counsellor access, no-store, logout and body-log privacy checks.

Edge 155.0.4283.45 passed **77 real runs** (70 protected cases plus four short
introductions and three prior processing/empty/review fixtures), at clean-profile
100% desktop and 390px mobile scale. The reported phrase and all four live
introduction responses are explicitly checked as Romanized Sinhala. Actual
Before/After, normalized text, tokens and Unicode-code-point offset slices/table,
quality/privacy/release states, five implemented stages, three pending stages,
full-width downstream grouping, collapsed evidence, visible single outcome toast,
real HTTP 422 error toast, Reset/logout and no browser storage were verified.
Desktop correction and mobile screenshots were visually inspected under
`.local/c2-demo-browser-99b0b358-39f2-4e9a-b20f-2b655b027107`.

Decision: activate only this bounded short-phrase evidence extension. No loss of
previously correct frozen labels was measured. It does not improve the frozen
set's score or resolve generic Romanized/mixed evidence gaps, quoted-English
ambiguity, masking-related evidence loss or existing detector errors.

### Commands

```powershell
.venv\Scripts\python.exe scripts\run.py scripts.c2_language_short_evaluate --baseline artifacts/c2-evidence/language-id/short-phrase-v1/baseline_language_id.py --output artifacts/c2-evidence/language-id/short-phrase-v1/candidate.json
.venv\Scripts\python.exe scripts\run.py scripts.c2_language_id_evaluate --output-dir artifacts/c2-evidence/language-id/short-phrase-v1/frozen-runtime
.venv\Scripts\python.exe -m pytest tests/unit/test_c2_language_id.py tests/unit/test_c2_text_processing.py tests/integration/test_c2_demo.py tests/contract
.venv\Scripts\python.exe -m pytest
npm run lint
npm run typecheck
npm test
.venv\Scripts\python.exe scripts\run.py scripts.generate_contracts --check
npm run contracts:check
.venv\Scripts\python.exe -X utf8 scripts/check_repository.py
.venv\Scripts\python.exe scripts/check_ci.py
.venv\Scripts\ruff.exe check services/preprocessing/language_id.py scripts/c2_language_short_evaluate.py tests/unit/test_c2_language_id.py packages/contracts/src/research_contracts/__init__.py
.venv\Scripts\ruff.exe format --check services/preprocessing/language_id.py scripts/c2_language_short_evaluate.py tests/unit/test_c2_language_id.py packages/contracts/src/research_contracts/__init__.py
docker compose build preprocessing counsellor-dashboard
docker compose up -d --no-deps --wait preprocessing orchestrator counsellor-dashboard
.venv\Scripts\python.exe scripts\run.py scripts.c2_contextual_verify --output-dir artifacts/c2-evidence/language-id/short-phrase-v1/docker-parity --browser-inputs .local/c2-language-short-browser-inputs.json
.venv\Scripts\python.exe scripts\run.py scripts.c2_demo_smoke
node scripts/c2_demo_browser.mjs .local/c2-language-short-browser-inputs.json
git diff --check
```

Evidence tools refuse overwrites; use new output paths. Baseline snapshot is
ignored and hashed, no historical report changed. Browser inputs extend the
70 parity cases with four short-introduction cases plus the three existing
actual-response Normalize/Tokenize/review/empty fixtures. No responses are
substituted. UI remains the verified full-width layout; pending annotation,
validation and human/versioned release remain Pending. No commits or pushes.
