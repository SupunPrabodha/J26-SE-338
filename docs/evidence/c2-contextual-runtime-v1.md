# C2 contextual runtime correction v1 — 2026-10-13

Implemented runtime configuration **c2-contextual-fields-v1**, not a model
replacement. English spaCy/Presidio versions, thresholds, structured recognizers,
student-ID selection, global Regex default, quality policy and UI are unchanged.
The dashboard continues to request Presidio, now with the shared local contextual
recognizer. All previously rejected title/GLiNER/trained candidates remain offline.
No training, downloads, reserved inference, commits or branch changes occurred.

## Scoped checkpoint packaging

The subsequent local checkpoint commit contains the shared contextual runtime,
its existing student-ID selection prerequisite, self-contained contextual tests,
the intentional legacy test expectation changes and this documentation. The core
student-ID selection tests are included; fixture-pack-dependent contact tests
remain in the working tree with the preparation tools. Demo/frontend work,
experimental studies, annotation/preparation/evaluation tools, generated contracts
and ignored local artifacts are outside this scoped commit. Commands and aggregate
results below describe the verified full working tree; some evidence tools require
that remaining uncommitted C2 work. No generated data/weights or .local scripts
are included. The contextual test's Unicode boundary assertion is self-contained
so this checkpoint does not import an uncommitted calibration module.

Packaging verification: runtime file hashes match the verified manifest. The
self-contained test adjustment passes in the full working tree (82 passed,
1 known xfailed) and in an export of the exact staged checkpoint, without the
uncommitted demo/annotation/calibration modules (73 passed, 1 known xfailed).
The difference is nine fixture-pack-dependent student-ID tests kept unstaged.
Prior full-suite, frontend, contract and Docker/browser results remain applicable;
no accuracy or runtime change was made for packaging. Only source and this
documentation are committed; generated evidence remains local and ignored.

The selected snapshot's full Python suite also passes: **342 passed, 1 known
xfailed**, with the existing Starlette/httpx warning (38.59s). Run from the index
export with the installed workspace interpreter:
`D:/J26-SE-338/.venv/Scripts/python.exe scripts/run.py pytest -q -o addopts= --basetemp=D:/J26-SE-338/.local/pytest-context-index-full --tb=short`.
The same snapshot passes scoped Ruff/format and contract artifact drift. Runtime
and test blobs are identical to those verified in that export; later packaging
updates affect only this document. Cached whitespace and repository privacy
checks pass before committing.

## Implemented boundaries

`contextual_detection.py` returns original-text name/place/address character
offsets. Regex and a registered Presidio PERSON/LOCATION recognizer use this same
layer. Runtime selection and span evaluation share the same selected results;
counts/transformations come from those results, not gold annotations.

- Explicit names: case-insensitive `my name is`, `mage nama`, **`mge nama`**,
  `මගේ නම`, `මගෙ නම`; existing capitalized `I am` / `I'm` forms remain supported.
  Fields accept one to four Unicode letter tokens including combining marks,
  joiners, hyphens and apostrophes. Punctuation/newlines or documented clause
  markers terminate fields; a fifth unbounded word rejects the whole field.
- Clause markers are contextual delimiters (and/but/I/feel/feels/live/lives,
  mata/mt/mama/mage/mge/gana/dukai/duki, email/phone/call/contact/student,
  මට/මම/මගේ/මගෙ/නිසා/ගැන/සහ/ජීවත්). They are not a global veto on NER predictions.
  Introductory grammar is excluded from successful contextual fields, including
  false NER predictions on the introduction itself. An overlapping contextual
  field supplies the name-only span; neighbouring NER coverage outside that
  field/introduction is retained. Unrelated predictions remain active.
- The unrestricted **`මම + any next token`** Regex rule is removed. Bare Sinhala
  self statements are not automatically names. Explicit name introductions are
  needed by the new layer; this intentionally loses some previously masked names.
- Locations: capital-initial Latin values after live/stay/reside in, up to four
  words; Sinhala values in the bounded `මම … ජීවත් වෙමි` residence form. Token
  boundaries prevent embedded prefixes. Sinhala `ින්` / `ෙන්` endings are rejected
  by this contextual residence rule as adverbially ambiguous. Existing NER is
  retained: this is not a global LOCATION veto. Places with those endings may be
  missed; no universal morphology or semantic correctness claim is made.
- Numbered addresses: explicit `my [fictional] address is`, `mage/mge lipinaya`,
  `address:`, `මගේ ලිපිනය` or `ලිපිනය` fields. Only 1–5 digit numbers, optional
  Sinhala අංක, bounded street words and optional comma-separated locality words
  are supported; sentence punctuation/newline/end must terminate the field.
  This does not cover arbitrary addresses, apartment formats, postal codes or
  suffix/root inference. LOCATION is the existing output label for these fields.
- Structured email/phone/student-ID spans and existing placeholders have priority.
  No normalization or Unicode span snapping occurs. Titles are not newly enabled.

These are lexical context rules, not semantic verification. Ambiguous introductions,
unknown trailing prose, capitalized wellbeing words and place/common-word readings
still require review. Capitalized English `I am` remains a legacy ambiguity.
Source suffixes remain unchanged; grammatical-suffix stripping is not implemented.

## Actual reported cases

Actual **Presidio** before → after (original Unicode retained):

| Fictional input | Before | After |
|---|---|---|
| mge nama neluni | [PERSON] neluni | mge nama [PERSON] |
| My name is Jane Miller. | My name is [PERSON]. | My name is [PERSON]. |
| මගේ නම නිමල් පෙරේරා. | [PERSON] පෙරේරා. | මගේ නම [PERSON]. |
| මම අද මහන්සියි. | Unchanged | Unchanged |
| මම කොළඹ ජීවත් වෙමි. | Unchanged | මම [LOCATION] ජීවත් වෙමි. |

Regex previously masked only Jane/Nimal's first name token, incorrectly masked අද
in the ordinary Sinhala statement and labelled කොළඹ as PERSON. It now masks the
complete introduced names, preserves the ordinary statement and labels the
bounded residence value LOCATION. The dashboard renders the actual outputs.

Unseen-name regressions include Elora Venn, lowercase adira savin and Sinhala
ශ්‍රියා රුවිනි, with wellbeing clauses separated by punctuation/grammar boundaries.
They are new developer regression fixtures, not independently reviewed final tests.
Structured contact neighbours, marks/joiners, emoji and placeholders are tested.

## Measured improvements and losses

Final before/after evaluation: **115 inspected development diagnostics**, including
all 40 reviewed development records, the coverage fixtures and additional ordinary
residence/embedded-prefix negatives. Gold spans and original text were preserved.
Regex reference is read-only source at aee9393 (Regex had been unchanged); Presidio
reference disables only the new contextual registry/layer while retaining the
completed student-ID selection. All temporary registry/function changes are
restored with `finally`. No historical held-out or reserved inference.

| Strategy | Exact missed spans before → after | Unnecessary masking characters before → after |
|---|---|---|
| Regex | 74 → 51 | 29 → 0 |
| Presidio | 49 → 35 | 370 → 338 |
| Hybrid | 56 → 34 | 357 → 328 |

No baseline-correct **Presidio** gold entity was lost. Regex and Hybrid each lose
two formerly correct PERSON spans, `sinhala-person-2` and `lost-bare-self`: their
bare Sinhala statements lack explicit name introductions. Their gold PERSON
labels remain intact in the comparison. The original bare-self evaluation fixture
now has a strict known-failure test rather than a changed gold label. The unit
masking expectation intentionally changes to unchanged text. Two Sinhala explicit
introduction tests that now pass were removed from their old xfail lists.
No unsafe Unicode boundaries occur in the final diagnostic set; all three actual
pipeline outputs agree with their original-offset traces. Working structured
entities and student-ID precedence are preserved.

Supun/Senali informal expressions and `Ms. aprna` remain missed. Nimal Perera's
introduced name is correctly masked, but the separate ordinary `gana dukai` span
still becomes PERSON under English NER. No global suppression or dictionary was
introduced to hide this. Unintroduced Sinhala/Romanized names and locations remain
limited. Lowercase English place fields and adverbially ambiguous Sinhala place
forms are outside the new contextual rule's support. Ordinary live-in-hope/peace
and tested Sinhala adverbial residence expressions stay unchanged under actual
Presidio and Regex execution. Arbitrary address coverage is not established.

## New evidence and reproducible commands

Ignored local directory:
`artifacts/c2-evidence/anonymization/contextual-runtime-v1/`.
Final evidence: `final-comparison.json`, `final-report.md`, `manifest.json`,
`final-parity/report.json`. Initial 109-case and 66-case subruns remain alongside
them. Aggregate evidence contains types, offsets, counts and hashes, not fixture
text or detected values. Historical studies/reports retain their recorded results.
Reserved hash remains `9c300d16741afb0a97f982d8046700485bddd560ee0c548135f7dca2aa2d4794`.

```powershell
.venv/Scripts/python.exe scripts/run.py scripts.c2_contextual_evaluate --output artifacts/c2-evidence/anonymization/contextual-runtime-v1/final-comparison.json
.venv/Scripts/python.exe scripts/run.py pytest tests/unit/test_c2_contextual_detection.py tests/unit/test_c2_anonymization.py tests/unit/test_c2_anonymization_evaluation.py tests/unit/test_c2_presidio_development.py tests/unit/test_c2_demo_person_samples.py tests/unit/test_c2_demo_romanized_diagnostics.py tests/unit/test_c2_student_id_selection.py -q -o addopts= --basetemp=.local/pytest-context-focused-final --tb=short
.venv/Scripts/python.exe scripts/run.py pytest -q -o addopts= --basetemp=.local/pytest-context-final-bounded --tb=short
docker compose up -d --build --wait --no-deps preprocessing orchestrator
.venv/Scripts/python.exe scripts/run.py scripts.c2_contextual_verify --output-dir artifacts/c2-evidence/anonymization/contextual-runtime-v1/final-parity --browser-inputs .local/c2-contextual-final-browser-inputs.json
node .local/c2-context-final-browser.mjs
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
.venv/Scripts/python.exe scripts/check_ci.py
npm run contracts:check
npm run lint
npm run typecheck
npm test -- --reporter=dot
git diff --check
```

Use fresh output/basetemp paths to reproduce; evidence tools refuse overwrites.
The evaluation now also emits aggregate Markdown for fresh runs. The actual final
Markdown was derived from saved JSON without additional inference.

Focused **115 passed, 8 xfailed**; full Python **630 passed, 8 xfailed** (94.85s),
existing Starlette/httpx warning. Scoped Ruff check/format passed on the changed
C2 source/scripts/tests. Global Ruff retains **63 unrelated C3 issues**; no rules
were weakened. Contracts/drift/compatibility, repository/privacy, CI structure,
frontend lint/typecheck, **48 frontend tests** and whitespace checks passed.
Earlier focused/full attempts exposed the intended bare-self expectation change,
newly passing Sinhala tests and missing recognizer explanations; those were fixed
explicitly. A sandbox temp-directory failure was resolved using local basetemp.
An initial baseline helper failed comparing distinct EntitySpan classes; it was
fixed by losslessly transferring original offsets/types, before evidence was saved.

Both final affected services rebuilt and became healthy. **All 70 authenticated
Docker responses equal local Python**, preserve original text and return no-store.
Edge 155.0.4283.45 verified all 70 actual Before/After, transformations, quality
counts/gates/blocking reasons, eight stages, limitations, Reset/logout and 390px
Sinhala/emoji rendering. Browser report/screenshots:
`.local/c2-demo-browser-a282fcf8-c83c-4b9c-a777-aad3415c1492`.
Credentials remain private; no request text logs, browser storage or hosted inference.

Dashboard: **http://localhost:3001/c2-demo**. Sign in using the existing private
development counsellor account. Automated quality PASS/gate Passed does not certify
semantic anonymization correctness, authorize human release or prove zero privacy
risk. The new evidence is synthetic engineering regression evidence, not independent
research validation or completed multilingual support.
