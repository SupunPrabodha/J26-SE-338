# C2 follow-up: remove regressing LOCATION sentence supplement

2026-10-25, feature branch `feature/c2-anonymization-pipeline`.
Checkpoint **`52be4bbebe1176228149e3e714e3b26600e02d4b` was already committed
and pushed** before the instruction arrived. This is a separate corrective
commit; that history and all historical evidence are preserved.

## Minimal active change

`gliner_demo.anonymize_gliner_demo` again executes only
`combine(text, model.detect(text))`. Removed the sentence-window import/call;
restored metadata/transformations version **`gliner-name-labels-v4-context-demo-v1`**.
The UI technical details now describe whole-text inference. The experiment's
`gliner_context_windows.py`, its tests and v5/v6 reports remain available offline;
its header now accurately says offline. No detector rule, name/place list,
threshold, model, overlap algorithm, structured recognizer or default was changed.

Unchanged: `urchade/gliner_multi-v2.1`, revision
`443d26d654e0324125a96bebd8e796c14ff2efe6`; weights SHA-256
`2100142f31627531497850659dcb3821c99d5e71c08a8e01a98e4b11ef32a199`;
labels `person name` / `location name`, threshold **0.7**, Unicode-safe original
offsets, flat decoding, seed zero, four CPU threads. Bounded shared contextual
grammar and structured email/phone/student-ID priority remain. Global Regex
default, custom demo GLiNER default, explicit Presidio access, authentication,
explicit load/inference errors with no fallback and human-approval requirements
remain unchanged.

Residual auditing and existing privacy/quality policies remain active. Every
experimental GLiNER run is still blocked by
`experimental_anonymizer_not_release_validated`; no gate is cleared to display
PASS. Missing arbitrary names/places can still have **no residual signal**.
Per-run accuracy remains NOT_MEASURED; integrity checks are not accuracy.

## Why withdraw the addition

Reuse [v6 audit](c2-location-correction-audit-v6.md) unchanged: 48 frozen records,
46 new texts plus two separately reported reused controls. Primary PERSON/LOCATION
typed-span counts:

| Recorded configuration | TP | FP | FN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| Preceding whole-text v1, restored | 36 | 14 | 28 | .7200 | .5625 | .6316 |
| Withdrawn sentence LOCATION v2 | 37 | 16 | 27 | .6981 | .5781 | .6325 |

The supplement gained one exact LOCATION but added two false LOCATION spans:
a Sinhala grammatical suffix included in a location, and a person's name typed
LOCATION. Unnecessary masked characters increased 55 → 57. Withdrawing it removes
those two additions **and withdraws the one gained correct location**. It restores
baseline behavior, not unrestricted Sinhala/location accuracy. All 16 Romanized
references remain exposed in the recorded audit. Existing baseline false masks,
suffix/type errors and PERSON/LOCATION misses remain; no reference was relabelled.
These are inspected synthetic development/audit cases with AI-proposed labels,
not independent validation or new held-out results. The historical 53-case
benchmark is unchanged and was not rerun. Collected corpus totals are not used
as evaluation counts.

## Verification against the recorded preceding baseline

The correction was checked in detached `.local/c2-location-followup-snapshot`,
based on `52be4bb`, without excluded working-tree experiments.

- **48/48 saved-prediction replays** match the recorded v6 `previous` spans and
  rendering. This reuses raw whole-text predictions through the actual adapter,
  contextual merge and masking path; it is not 48 fresh model calls or an accuracy
  comparison rerun. Labels/scores/offsets were not edited.
- **Seven actual pinned-model Python runs** match the preceding baseline: four
  saved v1 complete responses (English, ordinary Sinhala, code-mixed structured
  identifiers, combined name/location/contacts) and three v6 diagnostics (the
  two affected Sinhala records and a Romanized relationship miss). The latter
  retain unresolved names/locations rather than expected-output substitutions.
  All seven block release; all seven happen to have no residual-review signal,
  demonstrating that non-detection is not verified anonymity.
- **157 affected Python tests passed**, one existing Starlette/httpx warning.
  Test coverage includes absence of window inference calls, preceding version,
  Unicode boundaries, structured recognizers/placeholders, pipeline/privacy gates,
  complementary residual FAIL/REVIEW, safe errors and authenticated routes.
- **56 affected frontend tests passed**; frontend lint/typecheck and scoped
  Ruff/format passed. No expected output was changed to hide a detection failure;
  the former sentence-addition test now asserts its explicitly withdrawn behavior.
- The previous exact selected snapshot's **864 passed / 22 xfailed**, contract
  drift/compatibility and repository checks are reused for unchanged areas.
  No full unrelated suite or accuracy comparison was restarted. Contracts,
  dependencies, normalization/tokenization, Language ID and policies are unchanged.
  Existing 63 unrelated C3 lint findings, Next.js advisory and tokenizer warnings
  remain unresolved; no CI/test rules were weakened.

### Deployed result

- Built platform/experimental preprocessing and counsellor-dashboard images from
  the isolated selected source. Recreated **only preprocessing and
  counsellor-dashboard** using the existing explicit GLiNER overlay. Both healthy;
  orchestrator/source was unchanged and not restarted. Accounts, saved drafts,
  finals, databases, volumes and unrelated services were preserved.
- **Seven actual authenticated dashboard-proxy → gateway → Docker preprocessing
  responses match the selected Python responses exactly**, including output,
  transformations, v1 configuration, quality/privacy/gates, Language ID,
  normalization/tokenization and diagnostics. Strategy omitted executes GLiNER;
  all seven remain experimental-release-blocked. Unauthenticated request: 401;
  successful responses: no-store. No fallback or expected-text replacement.
- **Actual Edge browser PASS** on all seven cases. Inspected desktop 1366px and
  mobile 390px screenshots at device/page scale 1.0: no horizontal page overflow,
  actual Before/After and blocking results visible. Technical details disclose
  whole-text inference and the offline experiment. Reset and edit each invalidate
  an actual successful HTTP response held at the client; no stale result returns.
  Browser report/captures remain ignored at
  `.local/c2-demo-browser-36018be5-9196-4bcb-887a-0ce7385d229c/`.

The deliberate regression withdrawal does not make the failing Sinhala record
correctly anonymized: its formerly false LOCATION masks disappear and its original
identifiers remain exposed. Ordinary Sinhala remains unchanged; the protected
English and structured identifiers retain prior masking. Quality/privacy checks
can pass despite open-ended detector misses; the separate experimental release
block remains. This is restored baseline parity, not improved generalization or
anonymity certification. No new held-out evaluation or memory benchmark was run.

## Commands and local evidence

From the isolated snapshot, using existing locked dependencies:

```powershell
D:\J26-SE-338\.venv\Scripts\python.exe -m pytest tests/unit/test_c2_gliner_demo.py tests/unit/test_c2_gliner_context_windows.py tests/unit/test_c2_multilingual_candidate.py tests/unit/test_c2_name_label_candidate_v4.py tests/unit/test_c2_pipeline.py tests/unit/test_c2_privacy_gate.py tests/unit/test_c2_residual_privacy.py tests/unit/test_c2_output_validation.py tests/integration/test_c2_demo.py -p no:cacheprovider --basetemp=D:/J26-SE-338/.local/c2-location-followup-pytest --maxfail=2
npm test -- tests/frontend/c2-demo.test.tsx tests/frontend/c2-validation.test.tsx
npm run lint
npm run typecheck
D:\J26-SE-338\.venv\Scripts\python.exe -m ruff check services/preprocessing/gliner_demo.py services/preprocessing/gliner_context_windows.py tests/unit/test_c2_gliner_demo.py
D:\J26-SE-338\.venv\Scripts\python.exe -m ruff format --check services/preprocessing/gliner_demo.py services/preprocessing/gliner_context_windows.py tests/unit/test_c2_gliner_demo.py
```

Ignored disposable synthetic verification harnesses, from repository root:

```powershell
.local\c2-gliner-cpu-env\Scripts\python.exe -X utf8 .local/c2-location-followup-verify.py
.venv\Scripts\python.exe .local/c2-location-followup-deploy.py
.venv\Scripts\python.exe -X utf8 .local/c2-location-followup-api.py
node .local/c2-location-followup-browser.mjs
git diff --cached --check
```

Saved hashes and parity results are local under
`.local/c2-location-followup-results`; original v6 evidence remains byte-for-byte
unchanged under `artifacts/c2-evidence/anonymization/location-audit-v6`.
No participant inputs, model downloads/training, annotation/emoji work or
unrelated staging is included. Excluded experiments and pre-existing edits remain
locally intact. Local demo: **http://localhost:3001/c2-demo**.
