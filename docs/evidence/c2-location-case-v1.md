# C2 bounded LOCATION casing correction

## Continued PERSON/LOCATION relationship investigation — 2026-10-14

This continues the same investigation; the earlier casing checkpoint below is
retained unchanged. The interrupted attempt saved its code and aggregate report,
but its full-test process output could not be recovered after resuming. That check
was rerun. Docker was stopped on resume and restarted locally with no data reset.

Reported fictional text:
`ape grp leader supun. eyge girlfriend Neluni . ey hrim npurui`.
With identical surrounding text, actual baseline/raw selection was:

| Name spelling | Additional raw spaCy candidate | Actual output before and after this increment |
|---|---|---|
| Neluni | [38,44) LOCATION, 0.85 | `ape grp leader [PERSON]. eyge girlfriend [LOCATION] . ey hrim npurui` |
| neluni | [22,26) PERSON, 0.85 (pronoun) | `ape grp leader [PERSON]. [PERSON] girlfriend neluni . ey hrim npurui` |
| NELUNI | none | `ape grp leader [PERSON]. eyge girlfriend NELUNI . ey hrim npurui` |

The existing role recognizer correctly selects Supun at [15,20) PERSON, 0.85,
in all three. Raw candidates are from SpacyRecognizer for the incorrectly typed
name/pronoun; final selection previously had no supported girlfriend-name field
to correct them. These scores are framework weights, not accuracy probabilities.

The attempted broader possessive girlfriend/boyfriend masking adaptation is
**rejected and inactive**. It passed capitalized/all-uppercase variants but failed
the reported lowercase name in all three strategies: the existing English POS
tagger treated it as an adjective. A blanket override of adjective abstention
would remove protection for ordinary descriptions. No such override, threshold
change, name dictionary or global pronoun/entity suppression was introduced.
Rejected source is preserved locally as
`relationship-extension/rejected_person_context_v4.py`; its initial focused run
had 3 failures/10 passes. It has not been described as a working correction.

Two bounded changes are active:

1. Existing explicit name-introduction grammar now accepts `eyge nama` along with
   `mage/mge nama`. Existing original-offset selection consequently preserves the
   introductory pronoun and types the declared name PERSON. For example,
   `eyge nama aruni` previously selected [0,9) PERSON and produced `[PERSON] aruni`;
   it now selects [10,15) PERSON and produces `eyge nama [PERSON]`. Literal
   `My name is Eyge.` still masks the fictional name, so this is no global veto
   of that spelling. Multiword names use the unchanged bounded field grammar.
2. Direct possessive girlfriend/boyfriend appositions with a lexical continuation
   now create a **review-only** original-input signal. It survives even if NER
   masks the pronoun or labels the name LOCATION. Known placeholder/copy-style
   and copular descriptions do not create this signal. It does not invent PERSON
   spans, establish that every following word is a name, or claim universal
   relationship/residual-PII recognition.

For all three reported spellings, actual text/selected types above are retained,
but status is now REVIEW, requires_privacy_review=true, privacy FAILED and
automated release blocked. Ordered reasons: `data_quality_review_required`,
`privacy_review_required`, `release_privacy_gate_failed`. The main name-detection
failure therefore **remains unresolved**; the correction prevents its previously
unflagged automated release, not its misclassification/exposure. Quality's REVIEW
routing uses the existing privacy flag policy; no semantic quality rule or shared
API change. Human release approval remains required for every output.

Selector: `c2-contextual-fields-v1.1+c2-romanized-predicate-v1+c2-role-kinship-v3+c2-location-case-v1+c2-relationship-review-v1`.
Registry: `c2-contextual-fields-v1.1+c2-role-kinship-v3+c2-location-case-v1`.
Installed models/packages, all strategies/defaults, structured recognizers and
student-ID precedence are unchanged. No model search, download, training,
normalization, C3, shared-authentication or frontend-presentation change.

Joint evaluation contains 44 new synthetic development/diagnostic cases and 216
reused protected fixture executions. New names include Aruni, Darini, Vesara,
Ravina, Mirela and a multiword name, varied casing/relationship/explicit-name
contexts, ordinary descriptions, Sinhala-script names and four Romanized place
mentions. These are proposed synthetic annotations, not human-reviewed or
independent validation; no fresh-reserved or historical benchmark inference.

| All 260 fixture executions | Before | After |
|---|---:|---:|
| Exact typed/span true positives | 150 | 155 |
| Exact typed/span false positives | 43 | 37 |
| Exact typed/span misses | 64 | 59 |
| Fully exposed gold entities | 44 | 43 |
| Unmasked gold characters | 329 | 324 |
| Unnecessary masking characters | 310 | 252 |

No baseline-correct entity/coverage losses, no added declared negative masking,
no Unicode boundary defects or trace discrepancies. The six explicit `eyge nama`
development fields yield correct PERSON spans; gains in aggregate primarily remove
introductory/pronoun coverage. Existing correctly detected nearby names and the
earlier LOCATION casing correction remain protected. Nine newly added strict
xfails retain the desired name-only outputs for all three reported casings and
strategies; no existing golden expectation was weakened.

Generalization is inadequate outside explicit fields. The four `eyge gedara`
place diagnostics are covered by incorrect PERSON spans rather than correct
LOCATION labels. The Sinhala-script girlfriend name remains exposed. Ordinary
Romanized wording still sometimes acquires PERSON masks. Unsupported friend
mentions, pronouns outside parsed introductions, unpunctuated clauses, boundaries
and semantic/person-versus-place ambiguity remain failures. More ad hoc apposition
rules or casing transformations cannot establish general accuracy. A genuinely
improved detector needs richer domain-specific, human-adjudicated PERSON/LOCATION
annotations and separate evaluation; the rejected trained pilot and other historical
decisions remain unchanged. No further training or pack generation occurred here.

Evidence is appended under the same ignored folder:
`artifacts/c2-evidence/anonymization/location-case-v1/relationship-extension/`.
`report.json` is the earlier explicit-name diagnostic run; `final/report.json`
contains the accepted joint baseline comparison, raw recognizer candidates,
typed spans, masks/coverage, quality/review/gates and remaining failures.
`parity/report.json` compares complete actual authenticated responses, not simulated
results. Aggregates exclude fixture text and detected values.

Actual commands/outcomes after resuming:

```powershell
.venv/Scripts/python.exe scripts/run.py scripts.c2_relationship_evaluate --output-dir artifacts/c2-evidence/anonymization/location-case-v1/relationship-extension/final
.venv/Scripts/python.exe scripts/run.py pytest tests/unit/test_c2_relationship.py tests/unit/test_c2_location_case.py tests/unit/test_c2_role_kinship.py tests/unit/test_c2_person_context.py tests/unit/test_c2_contextual_detection.py tests/unit/test_c2_student_id_selection.py tests/unit/test_c2_romanized_predicate.py -q -o addopts= --tb=short
.venv/Scripts/python.exe scripts/run.py pytest -q -o addopts= --basetemp=.local/pytest-relationship-resumed --tb=short
npm run lint
npm run typecheck
npm test -- --reporter=dot
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
npm run contracts:check
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
.venv/Scripts/python.exe scripts/check_ci.py
docker compose up -d --build --wait --no-deps preprocessing orchestrator
.venv/Scripts/python.exe scripts/run.py scripts.c2_relationship_verify --output-dir artifacts/c2-evidence/anonymization/location-case-v1/relationship-extension/parity --browser-inputs .local/c2-relationship-final-browser-inputs.json
.venv/Scripts/python.exe scripts/run.py scripts.c2_demo_smoke
node scripts/c2_demo_browser.mjs .local/c2-relationship-final-browser-inputs.json
git diff --check
```

Use new output directories for reproduction. Joint evaluation had already
completed before interruption and was read, not rerun, on resume.
Focused: **232 passed/18 xfailed**. Full: **807 passed/22 xfailed**, 104.35s,
existing Starlette/httpx warning. Frontend lint/typecheck passed; first concurrent
test run had 48 passes/two 5-second timeouts (C2 stale-input and consent retry),
then isolated rerun passed **50/50** in 7.00s with unchanged tests/timeouts.
Both outcomes are retained. Contract drift/compatibility, repository/privacy,
CI structure, scoped Ruff check/format and diff whitespace passed. Global Ruff
was not rerun; previous C3 failures remain outside scope, and hosted CI was not run.

Docker services rebuilt healthy; **44 complete responses match Python**, originals
and no-store preserved, all three strategies have span/render and Unicode integrity.
C2 smoke's 45 catalogue runs/auth/validation/log-privacy checks passed. Actual Edge
155.0.4283.45 verified all 44 Before/After/gates, sign-in, Reset/logout, no storage
and narrow Sinhala. Corrected explicit-name and unresolved relationship screenshots
were actually inspected. Browser report:
`.local/c2-demo-browser-dc3f158b-6849-41ed-8c01-4e5cc9a572e3/report.json`.
Live URL remains **http://localhost:3001/c2-demo**.

Files changed in this continuation: contextual_detection.py, person_context.py,
span_evaluation.py, relationship_regressions.py, test_c2_relationship.py,
scripts/c2_relationship_evaluate.py, scripts/c2_relationship_verify.py,
C2 browser screenshot verification, this evidence document and c2-demo-page.md.
Scoped Ruff paths are those seven Python files. All accumulated edits, historical
reports and the rejected source are preserved; nothing staged, committed or pushed.

---

Current-tree baseline includes role/kinship v3, predicate and student-ID corrections
and privacy gates. No history, rejected candidate, runtime model, strategy default,
threshold, authentication, shared contract or other-member component changed.
Source text is never globally lowercased, title-cased, normalized or substituted.

## Reproduction and implementation

Actual identical-context baseline:

| Input | Raw analyzer provenance | Selected span | Output |
|---|---|---|---|
| `It is in malabe` | no entity | none | unchanged |
| `It is in Malabe` | SpacyRecognizer, LOCATION, 0.85 | [9,15) LOCATION | `It is in [LOCATION]` |
| `It is in MALABE` | no entity | none | unchanged |

The old explicit residence rules do not cover this sentence. This is an English
spaCy casing sensitivity, not a missing hardcoded place entry. A blind title-case
retry was rejected: ordinary `trouble`, `progress`, `pain`, `peace` and colour
states can acquire geographical labels when capitalized. Initial tests caught
an added `red` mask and an unstable emoji/tab-context probe before activation.

`location_case.py` now parses only the case-insensitive `It is in` grammar followed
by 1–4 ASCII lexical words and a sentence boundary. The installed English model
evaluates the **field only** in a fixed local locative frame. A lowercase-field
POS/function-word check abstains on common nouns, verbs, adverbs, determiners,
numbers and function words; ordinary colour-state complements also abstain.
The title-case field must be one exact LOC/GPE entity. No field is assumed to be
a location merely because it follows `in`; no place or participant-name dictionary
is used. The colour-state vocabulary is a contextual grammatical exclusion,
not a global NER veto. Existing model predictions are not suppressed.

The original source, casing, punctuation, whitespace, Sinhala marks, joiners and
emoji remain untouched. ASCII case conversion preserves field length; original
offsets are derived from the parser match, not rewritten-text offsets. Non-ASCII,
alphanumeric, placeholder and unbounded values are not probed. Outside text is
excluded from the diagnostic model frame, which stabilizes the same parsed grammar
without rewriting surrounding content. This is neither arbitrary address support
nor language identification. The manual language hint does not control detection.

Proposals enter existing shared contextual detection, so Regex, Presidio, Hybrid,
masking, counts, transformations and span evaluation agree. As with existing C2
contextual POS checks, these new proposals use the installed English model even
under Regex; the global Regex strategy default is unchanged.
Active selector adds `c2-location-case-v1`; registry entry is
`c2-contextual-fields-v1+c2-role-kinship-v3+c2-location-case-v1`.
Presidio 2.2.364, spaCy 3.8.16, en_core_web_sm 3.8.0 remain installed unchanged.
Rule weight 0.85 is inherited, not accuracy or a research-approved probability.

All three reported casing variants now produce `It is in [LOCATION]` using
original [9,15) offsets. Lower/upper raw candidates now come from the versioned
contextual recognizer; title case retains spaCy's LOCATION candidate as well.
Actual demo transformation: `presidio:location`. Quality PASS/privacy PASSED and
automated prerequisites passed do not establish complete detection; human release
approval remains required. Existing review/gate rules were not modified.

## Actual evaluation and unresolved detection

Fourteen place spellings × lower/title/upper = 42 proposed location cases;
22 lowercase ordinary-phrase negatives; 152 reused protected fixture executions.
Gold expectations remain unchanged, including all failures. This is synthetic
development evidence, not untouched held-out or independent research validation.
Previously inspected diagnostic cases remain development evidence. No historical
held-out benchmark, annotation reserved partition, model search or training ran.

| Measurement | Before | After |
|---|---:|---:|
| New locations exact typed/span | 13 / 42 | 21 / 42 |
| All tested exact true positives | 133 | 141 |
| All tested exact false positives | 25 | 24 |
| All tested exact misses | 43 | 35 |
| Fully exposed entities | 35 | 28 |
| Unmasked gold characters | 275 | 221 |
| Unnecessary masking characters | 193 | 193 |

No baseline-correct entity/coverage losses, no added declared negative masking,
no Unicode boundary defects or trace discrepancies. All 22 lowercase ordinary
phrases remain unchanged, including trouble, progress, pain, peace, danger,
control, doubt, school, hospital, colours and descriptive phrases.

| Place fixture | Lower | Title | Upper |
|---|---|---|---|
| Malabe | LOCATION | LOCATION | LOCATION |
| Jaffna | LOCATION | LOCATION | LOCATION |
| Nuwara Eliya | LOCATION | LOCATION | LOCATION |
| Ampara | LOCATION | LOCATION | LOCATION |
| New York | LOCATION | LOCATION | LOCATION |
| Hambantota | missed | LOCATION | missed |
| Kalutara | missed | PERSON (wrong type) | missed |
| Badulla | missed | missed | missed |
| Anuradhapura | missed | LOCATION | missed |
| Trincomalee | missed | LOCATION | missed |
| Polonnaruwa | missed | LOCATION | missed |
| Monaragala | missed | LOCATION | missed |
| Kandy | missed | PERSON (wrong type) | missed |
| Colombo | missed | LOCATION | missed |

Conservative common-noun exclusions also reject real places the English tagger
treats as nouns. This is deliberate abstention, not a claim these places contain
no PII. Wrong PERSON classifications and unknown places remain model limitations.
Existing title-case ordinary-word errors such as `It is in Trouble` are retained;
this increment prevents **additional** masking but does not globally replace NER.
Untested abstract states, places with ordinary-word names, other locative grammars,
arbitrary multilingual geography and complete addresses remain unresolved.
No review flag must be interpreted as universal privacy safety.

Evidence: `artifacts/c2-evidence/anonymization/location-case-v1/` (Git-ignored):
`development/report.json`, `parity/report.json`, `manifest.json`, `aggregate.md`.
Reports retain typed misses/wrong labels; aggregate measurements omit text/values.

## Exact checks

```powershell
.venv/Scripts/python.exe scripts/run.py scripts.c2_location_case_evaluate --output-dir artifacts/c2-evidence/anonymization/location-case-v1/development
.venv/Scripts/python.exe scripts/run.py pytest tests/unit/test_c2_location_case.py tests/unit/test_c2_role_kinship.py tests/unit/test_c2_person_context.py tests/unit/test_c2_contextual_detection.py tests/unit/test_c2_student_id_selection.py tests/unit/test_c2_romanized_predicate.py -q -o addopts= --tb=short
.venv/Scripts/python.exe scripts/run.py pytest -q -o addopts= --basetemp=.local/pytest-location-case-v1-final --tb=short
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
.venv/Scripts/python.exe scripts/check_ci.py
npm run lint
docker compose up -d --build --wait --no-deps preprocessing orchestrator
.venv/Scripts/python.exe scripts/run.py scripts.c2_location_case_verify --output-dir artifacts/c2-evidence/anonymization/location-case-v1/parity --browser-inputs .local/c2-location-case-v1-browser-inputs.json
node scripts/c2_demo_browser.mjs .local/c2-location-case-v1-browser-inputs.json
git diff --check
```

Use fresh output directories for reproduction; existing evidence is never overwritten.

Actual focused: **219 passed, 9 existing xfailed**; full Python **794 passed,
13 existing xfailed**, 95.57s, existing Starlette/httpx deprecation. No new xfails
or weakened protected expectations. Scoped Ruff check/format, contract drift,
full-suite compatibility, repository/privacy, CI structure and whitespace passed.
Frontend lint passed for the screenshot verification change. Frontend runtime,
typecheck/test inputs and contracts are unchanged; previous 50-test/typecheck
results are preserved, not claimed rerun here. No hosted CI run. Repository-wide
C3 Ruff failures remain outside scope; only scoped Ruff was rerun this increment.

Rebuilt preprocessing/orchestrator healthy; **64 complete authenticated responses
match Python** and preserve original/no-store. All three strategies have span/render
and Unicode integrity. Actual Edge **155.0.4283.45** verified Before/After,
transformations, quality/privacy/gates, Reset/logout, no storage and 390px Sinhala.
The lowercase correction screenshot was actually inspected. Browser report:
`.local/c2-demo-browser-9aa01018-b3a3-489a-bab6-d21496aa1f23/report.json`.
Live URL: **http://localhost:3001/c2-demo**; existing private development sign-in.

Scoped Ruff commands use these eight Python paths:

```text
services/preprocessing/location_case.py
services/preprocessing/location_case_regressions.py
services/preprocessing/contextual_detection.py
services/preprocessing/presidio_anonymization.py
services/preprocessing/span_evaluation.py
scripts/c2_location_case_evaluate.py
scripts/c2_location_case_verify.py
tests/unit/test_c2_location_case.py
```

Also changed: C2 browser verification screenshot condition, this document and
the current section in `c2-demo-page.md`. Other edits and historical reports
are preserved. No staging, commit, push, reset or branch change.
