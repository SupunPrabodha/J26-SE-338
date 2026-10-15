# C2 valid student-ID entity selection v1

2026-10-13, `feature/c2-anonymization-pipeline`, HEAD `aee9393`.
Small C2 selection correction only; ID syntax, recognizers, thresholds, installed
models, global Regex default and dashboard configuration remain unchanged.
No model search/training, commit, push, reset or branch change.

## Actual reproduced cause

The three previously inspected fictional contact cases all have a valid existing
student-ID match. The analyzer also returns a **broader containing PERSON** at
the same score **0.85**. The old selection favours the longer span. These actual
failures are **not coextensive alphabetical ties or missing ID matches**.

| Case ID | Old PERSON | Existing STUDENT_ID candidate | Corrected selection in that region |
|---|---|---|---|
| sinhala-development-09 | [0,23) | [13,23) | PERSON [0,13), STUDENT_ID [13,23) |
| romanized-development-09 | [13,29) | [19,29) | PERSON [13,19), STUDENT_ID [19,29) |
| code-mixed-development-09 | [0,27) | [17,27) | PERSON [0,17), STUDENT_ID [17,27) |

Both hypotheses were checked: coextensive score ties would favour PERSON under
the old alphabetical ordering, and focused tests cover them; actual dashboard
examples instead expose the length tie-break. Raw analyzer candidates, scores and
recognizer names are unchanged before/after. No text or detected values are logged.

## Deterministic general correction

`services/preprocessing/span_evaluation.py:select_presidio` retains the original
confidence/length/start/type selection for unrelated entities. It then overlays
an existing STUDENT_ID candidate only where it overlaps selected PERSON and its
exact offsets are a match from the unchanged `STUDENT_ID_PATTERN.finditer(text)`.
Thus context boundaries and existing syntax are checked, not merely an ID-shaped
substring. No name dictionary, casing veto or threshold adjustment is introduced.

- A coextensive valid ID/PERSON conflict resolves to STUDENT_ID.
- A broader selected PERSON is copied into residual prefix/suffix spans around
  STUDENT_ID. Covered characters are preserved, including neighbouring name regions.
- A partial PERSON/ID overlap preserves old PERSON coverage and completes the
  valid ID span. No originally masked characters are exposed.
- Protected placeholders remain protected; conflicts with EMAIL/PHONE/LOCATION
  or other selected entity types retain their previous decisions.
- Original analyzer result objects are not mutated. Ordering is deterministic
  by score/offsets, and permutation tests verify identical selected spans/types.

The residual PERSON fragments retain the original prediction's score/metadata;
they are coverage fragments, not newly validated person predictions. Ordinary
context incorrectly masked by the English model remains masked. This correction
does **not** claim to resolve multilingual over-masking or infer true name bounds.

`presidio_anonymization.py` already consumes this shared selection for masking,
entity counts and transformation labels; it needs no duplicate selection code.
The evaluation trace uses the same selection. Regex is unchanged; Hybrid uses
the existing Regex-first masking and corrected Presidio selection on residual text.

## Actual before/after and coverage

In each of the three cases:
- Before: EMAIL_ADDRESS, PERSON, PHONE_NUMBER; no selected STUDENT_ID.
- After: EMAIL_ADDRESS, PERSON, PHONE_NUMBER **and STUDENT_ID**; ID count 1 and
  `presidio:student-id` transformation present.
- Full covered-character sets are exactly equal: **zero lost masked characters**.
  Raw analyzer candidates, email/phone selections and recognition scores are equal.

Authenticated Docker custom runs exactly match current local Python on all **16**
verification inputs. All three reviewed structured-contact gold sets now match,
including STUDENT_ID. Existing working email, phone, isolated ID, English name and
Unicode/punctuation examples remain working. REVIEW/REJECT gate results, original
text, human-release requirement and no-store responses are verified.

Working URL: **http://localhost:3001/c2-demo**. The browser still sends Presidio;
GLiNER and trained candidates stay offline. The global anonymizer default is Regex.
Docker uses Presidio 2.2.364, spaCy 3.8.16 and en_core_web_sm 3.8.0 (`en`).
Only affected Python services were rebuilt; no unrelated components were edited.

## New evidence and commands

Separate ignored evidence:
`artifacts/c2-evidence/anonymization/student-id-selection-v1/`:
`before.json`, `after.json`, `comparison.json`, `docker-parity.json`.
These retain candidate/selected offsets/types/scores, source hashes, counts and
coverage comparisons only. Historical quality/anonymization scores, GLiNER studies,
trained-pilot reports and their rejected decisions were not overwritten or retuned.
Older reports describe their original selection version; future comparisons must
identify this new selection-source version explicitly.

Commands actually executed:

```powershell
.venv/Scripts/python.exe scripts/run.py scripts.c2_student_id_verify --output artifacts/c2-evidence/anonymization/student-id-selection-v1/before.json
# After the implementation correction:
.venv/Scripts/python.exe scripts/run.py scripts.c2_student_id_verify --output artifacts/c2-evidence/anonymization/student-id-selection-v1/after.json
.venv/Scripts/python.exe scripts/run.py pytest tests/unit/test_c2_student_id_selection.py -q -o addopts=
.venv/Scripts/python.exe scripts/run.py pytest -q -o addopts= --basetemp=.local/pytest-student-id-full --tb=short
.venv/Scripts/python.exe scripts/run.py pytest -q -o addopts= --basetemp=.local/pytest-student-id-full-final --tb=short
docker compose up -d --build --wait --no-deps preprocessing orchestrator
.venv/Scripts/python.exe scripts/run.py scripts.c2_dashboard_verify --output artifacts/c2-evidence/anonymization/student-id-selection-v1/docker-parity.json
node scripts/c2_demo_browser.mjs
.venv/Scripts/python.exe -m ruff check services/preprocessing/span_evaluation.py scripts/c2_student_id_verify.py tests/unit/test_c2_student_id_selection.py
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
npm run contracts:check
npm run lint
npm run typecheck
npm test -- tests/frontend/c2-demo.test.tsx
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
.venv/Scripts/python.exe scripts/run.py scripts.check_ci
git diff --check
```

Focused ID tests **23 passed**, including actual original contacts across all three
strategies, exact ties/different scores, shuffled result order, invalid/near-match
IDs, broader/partial overlaps, neighbours, unchanged non-PERSON overlaps, placeholders
and common runtime/evaluation/count/label selection. Frontend **32 passed**; lint,
both frontend typechecks, scoped Ruff, contract drift/compatibility, repository
privacy, CI structure and whitespace checks passed. The first full-suite collection
passed **466 tests with 9 existing xfails**; nine real-contact strategy tests were
added during that collection and passed separately, so a final full collection was
also run. Final full-suite outcome is recorded below.

Final full Python suite: **475 passed, 9 existing expected failures**, one existing
Starlette/httpx warning, 86.98 seconds. Repository-wide
`python -m ruff check . --output-format concise` still fails on **63 untouched C3
issues**: I001 10, F401 10, E402 17, UP015 1, UP035 6, UP006 15, UP045 2 and F541 2.
There are no findings outside `research/c3-model-experiments`. No unrelated file
or lint rule was changed. Scoped C2 Ruff passes. Aggregate lint evidence is
`student-id-selection-v1/repository-ruff.json`.

Docker build/service health passed. Local Edge 155.0.4283.45 verified actual
Before/After rendering, transformations (including corrected ID labels), batch counts,
ordered gate reasons, sign-in, Reset/logout, eight stages and 390px viewport on all
16 verification cases. Browser report/screenshots:
`.local/c2-demo-browser-53e2a25a-e7f1-415e-be09-15d678a50e76/`.
No credential screenshots or response/payload traces were retained.
The browser check was repeated with a corrected-ID screenshot:
`.local/c2-demo-browser-b098f765-74f9-47a1-be47-0e12a255fccc/`.
`desktop-corrected-student-id.png` was visually inspected and shows the actual
STUDENT_ID placeholder and transformation alongside the retained PERSON prefix,
phone/email placeholders and actual PASS/human-release notice.

Remaining failures: ordinary Romanized PERSON false masks; informal Supun/Senali
misses and broader Sinhala name errors; residual ordinary-context PERSON fragments
in these ID examples. Quality PASS remains a policy result, not NER correctness or
human release approval. No new semantic-quality check or multilingual-fix claim.
Changes remain uncommitted; other members' code and all prior edits preserved.
