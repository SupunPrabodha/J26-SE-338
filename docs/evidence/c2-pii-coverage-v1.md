# C2 complete supported-PII coverage audit v1

Executed 2026-10-13 on `feature/c2-anonymization-pipeline`, leaving all work
uncommitted. No runtime rules, thresholds, contracts, defaults or UI changed.
The completed student-ID selection correction remains active. The title,
GLiNER and trained candidates remain offline. No training or model searches.

## Actual scope and registry

Runtime explicitly requests only **PERSON, LOCATION, EMAIL_ADDRESS, PHONE_NUMBER,
STUDENT_ID**. Selected spans drive masking, counts, transformations and evaluation.
Email/phone evaluation aliases are EMAIL/PHONE, matching their output placeholders.
The language hint is manual metadata; all runtime Presidio analysis uses English.

Executed configuration: Presidio analyzer 2.2.364, spaCy 3.8.16,
`en_core_web_sm` 3.8.0, existing offline email recognizer (bundled suffix list),
existing Sri Lankan mobile rule and student-ID rule. Global default is Regex;
the dashboard explicitly requests Presidio. LOCATION is a named-place NER label,
**not a complete postal/street-address recognizer**.

| Requested entity | Registered implementation | Verified scope / restriction |
|---|---|---|
| PERSON / LOCATION | SpacyRecognizer | English NER, unreliable on Sinhala/Romanized names/places |
| EMAIL_ADDRESS | OfflineEmailRecognizer | Actual example.com addresses, including dotted local parts; bundled suffix validation |
| PHONE_NUMBER | PhoneRecognizer plus existing PatternRecognizer | General library recognizer plus explicit Sri Lankan mobile syntax; this audit verifies fictional local and +94 formats only |
| STUDENT_ID | Existing PatternRecognizer | Existing `\b[A-Za-z]{2}\d{8}\b` syntax only; neither national IDs nor arbitrary passports |

The registry also contains these **unrequested** entities:
`CREDIT_CARD`, `US_BANK_NUMBER`, `US_DRIVER_LICENSE`, `US_ITIN`, `US_PASSPORT`,
`US_SSN`, `UK_NHS`, `CRYPTO`, `DATE_TIME`, `IBAN_CODE`, `IP_ADDRESS`,
`MEDICAL_LICENSE`, `MAC_ADDRESS`, `URL`. SpacyRecognizer advertises additional
`NRP`, `EMAIL`, `ORGANIZATION`, `AGE`, `ID` and `DATE_TIME` labels. Registry presence
does not enable them in this C2 pipeline; there are no corresponding requested
output labels. IP/MAC are network addresses, not physical addresses. This audit
does **not** establish recognition accuracy for any unrequested identifier.
There is no registered complete street-address or Sri Lankan national-ID rule.
Synthetic SSN/passport-like strings were not masked as those entity types.

## Actual entity-by-language results

59 fictional development diagnostics: individual entities, all five details
together, varied mobile/email/ID formats, lowercase names, Sinhala-script details
within mixed text, four ordinary negatives, street addresses, neighbouring spans,
placeholders and unsupported identifiers. Gold offsets are computed from original
literal fixtures and checked for Unicode boundaries; never used by runtime.

**W = verified working on these fixtures, P = partially working, F = failing.**
Fractions are exact typed spans / expected spans, not accuracy or validated
language support. P requires at least some correctly typed overlapping coverage;
masking a location as PERSON does not establish LOCATION detection.

| Entity | English | Sinhala | Romanized Sinhala | Code-mixed |
|---|---|---|---|---|
| PERSON | P, 3/5 | P, 0/3 | P, 2/3 | P, 3/4 |
| LOCATION (named places) | W, 3/3 | F, 0/3 | F, 0/3 | P, 3/4 |
| EMAIL_ADDRESS | W, 3/3 | W, 3/3 | W, 3/3 | W, 3/3 |
| PHONE_NUMBER | W, 3/3 | W, 3/3 | W, 3/3 | W, 3/3 |
| STUDENT_ID | W, 3/3 | W, 3/3 | W, 3/3 | W, 3/3 |
| Complete street address | F, 0/1 | F, 0/1 | F, 0/1 | F, 0/1 |

Sinhala PERSON predictions cover part of two names but match none exactly. Mixed
Latin-script names/places worked; added Sinhala-script names/places did not.
Romanized LOCATION has no correctly typed coverage; one combined location is
partly masked under PERSON. Addresses leave 16 / 16 / 9 / 2 gold characters
unmasked respectively; partial or wrong-type masking is not complete support.

Combined English actual output:
`My name is [PERSON]. I live in [LOCATION]. [EMAIL], [PHONE]; [STUDENT_ID]! 🙂`
All five transformations are returned. Screenshot and actual DOM checks confirm
Before/After, quality PASS, gate Passed and separate required human approval.
Other combined cases expose real misses; they are not replaced with expected text.

Ordinary English, Sinhala and mixed wellbeing fixtures stayed unchanged. The
Romanized `Mata exams gana dukai.` still masks `[11,21)` as PERSON (10 unnecessary
characters). `Ms. aprna`, lowercase `avira` and `supun` remain missed. Existing
Sinhala name boundaries remain wrong. Neighbouring PERSON/student-ID details keep
all gold characters covered; the PERSON prefix retains one adjacent space from
the original broader NER span. The student-ID label and structured spans are exact.
No fixture produced unsafe mark/joiner boundaries; punctuation and emoji survive.
Existing masking placeholders remain unchanged and correctly block release.

## Evidence and implementation decision

Local Regex, Presidio and Hybrid each ran the actual pipeline on all 59 cases.
Their actual output agrees with their respective masking traces. Raw Presidio
candidates (recognizer name, type, score, original offsets only) and selected
spans are retained in new ignored aggregate evidence. Existing configuration,
registration, ID precedence, structured coverage and trace/render agreement were
inspected; **no new runtime implementation defect was demonstrated**. Remaining
errors are NER predictions or missing address scope. No broad PERSON suppression,
threshold change, dictionary or fabricated semantic quality check was introduced.

New evidence: `artifacts/c2-evidence/anonymization/pii-coverage-v1/expanded/`
contains `report.json`, `report.md`, `classification-audit.json`, `final-report.md`.
The initial 56-case audit remains at the parent directory. Three harder name/place
cases were added transparently; earlier failures and expectations were preserved.
Initial coverage classification counted wrong-type masking as partial LOCATION;
`classification-audit.json` corrects that **audit classification**, using recorded
predictions without rerunning inference. Refer to this document/final-report for
the corrected table. No historical benchmark/model-study report was overwritten.
Aggregate reports omit fixture text and detected values. Synthetic diagnostics
are not independent validation. Quality PASS remains a policy result, not proof
that all PII was found, and gate success does not authorize human release.

## Actual commands and outcomes

```powershell
.venv/Scripts/python.exe scripts/run.py scripts.c2_pii_coverage_verify --output-dir artifacts/c2-evidence/anonymization/pii-coverage-v1 --browser-inputs .local/c2-pii-coverage-inputs.json
.venv/Scripts/python.exe scripts/run.py scripts.c2_pii_coverage_verify --output-dir artifacts/c2-evidence/anonymization/pii-coverage-v1/expanded --browser-inputs .local/c2-pii-coverage-expanded-inputs.json
.venv/Scripts/python.exe scripts/run.py pytest tests/unit/test_c2_pii_coverage.py tests/unit/test_c2_student_id_selection.py tests/unit/test_c2_titled_person.py -q -o addopts= --tb=short
.venv/Scripts/python.exe scripts/run.py pytest -q -o addopts= --basetemp=.local/pytest-pii-coverage-full --tb=short
.venv/Scripts/python.exe -m ruff check services/preprocessing/pii_coverage.py scripts/c2_pii_coverage_verify.py tests/unit/test_c2_pii_coverage.py
.venv/Scripts/python.exe -m ruff format --check services/preprocessing/pii_coverage.py scripts/c2_pii_coverage_verify.py tests/unit/test_c2_pii_coverage.py
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
.venv/Scripts/python.exe scripts/check_ci.py
npm run contracts:check
npm run lint
npm run typecheck
npm test -- --reporter=dot
git diff --check
```

Focused Python **141 passed**; full suite **593 passed, 9 xfailed** (88.76s),
existing Starlette/httpx warning; focused run also has an inaccessible-cache
warning. Scoped Ruff/format, contract drift/compatibility, repository/privacy,
CI structure, frontend lint/typecheck and **48 frontend tests** pass. Global Ruff
still has **63 existing C3 issues** and none elsewhere; no lint rules were weakened.

All 59 authenticated Docker responses equal local Python in full, preserve the
original input and return no-store. Private credentials stay inside the local
HTTP/browser process. `node .local/c2-coverage-browser.mjs` is a local copy of the
existing C2 browser smoke using the expanded input file: Edge 155.0.4283.45 verified
all 59 live results, quality/gates/counts/transformations, Reset/logout, eight
stages, limitations and narrow 390px Sinhala rendering. Browser report/screenshots:
`.local/c2-demo-browser-fd95c04a-c38d-4872-9ed9-e5fd990a6c26`.
The desktop combined-result screenshot was also visually inspected.
No rebuild was necessary because deployed runtime code did not change.

URL: **http://localhost:3001/c2-demo**. Sign in with the existing private local
development counsellor account. For reproduction choose a fresh `--output-dir`
and optional browser-inputs path; the tool refuses to overwrite existing evidence.
