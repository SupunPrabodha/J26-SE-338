# C2 residual-output privacy safeguard v1

2026-10-24; current working tree on `feature/c2-anonymization-pipeline`, HEAD
`170151c26ee13c2fcb9b3a1801204ca87b735a74`. Complements the completed
[v3](c2-generalization-v3.md)/[v4](c2-generalization-v4.md) model investigation.
GLiNER/name-label candidates remain offline; no masking/model/threshold change.

## Actual method and limits

`services/preprocessing/residual_privacy.py:assess_output`, version
`c2-residual-output-v1`, scans **actual anonymized text**. It never consumes
selected masking spans, gold labels, original text, NER predictions or expected
outputs. It does not rerun spaCy/Presidio/GLiNER or call `detect_contextual`.
Methods: existing structured release-policy regexes plus a separate deterministic
output-field/context audit, implemented with the existing `regex` dependency.

| Evidence on output | Result | Reason |
|---|---|---|
| Supported email, Sri Lankan mobile or two-letter/eight-digit ID remains | FAIL | `supported_structured_identifier_remains` |
| Lexical payload remains in a line/semicolon-delimited `Name:`, `Full Name:`, `Location:`, `Address:`, `නම:` or `ලිපිනය:` field | FAIL | `lexical_residue_in_explicit_identifying_field` |
| Naming/relationship or bounded locative context retains a lexical head, including a surname after a placeholder | REVIEW | `unresolved_lexical_content_in_identifying_context` |
| Explicit field/context expects PERSON but contains LOCATION, or vice versa | REVIEW | `identifying_context_placeholder_type_disagreement` |
| No supported signal | No additional review signal | `no_signal_not_verified_anonymity` in diagnostics |

Explicit identifying fields are a bounded export-policy invariant, not proof that
every lexical value is a name/place. Unstructured prose gets REVIEW rather than
a confident PII label. Contexts cover English/Romanized/Sinhala introductions,
possessive girlfriend/boyfriend apposition, English residence/`It is in` and the
existing Sinhala residence form. Function words delimit clauses; no entity-name,
place or pronoun blacklist is used. The checker never edits text or Unicode.

This is **complementary logic, not independent statistical NER verification**.
Structured syntax and some prose-context assumptions correlate with anonymization
rules. No independent model was adopted. Broad missed names/places without these
contexts still escape. A completely masked PERSON wrongly labelled `[LOCATION]`
cannot generally be discovered from output alone; only an explicit contradictory
field/context produces REVIEW. No signal is not a semantic-correctness pass,
complete anonymity or permission for human release.

## Enforcement and API compatibility

The pipeline assesses existing structural quality without changing its policy.
New output signals then set `requires_privacy_review`; the existing release gate
independently rescans actual output even when that flag is falsely clear.
Both FAIL and REVIEW prevent automated release. Quality can remain PASS while
privacy review is required and the release gate fails. Normalization/tokenization
checks remain separate and do not clear privacy signals. Existing empty-input,
duplicate, consent/authentication and human-release requirements remain intact.

Output validation publishes version
`c2-output-validation-v1.1+residual-output-v1`, five additional rule IDs with
safe reasons and the actual wrapper provenance
`services/preprocessing/validation.py:check_residual_output` (which calls the
versioned output auditor above). Structured FAIL diagnostics now also include a
safe explicit reason. Aggregate privacy issues include `residual_person_field`,
`residual_location_field`, `unresolved_person_context`,
`unresolved_location_context` and `placeholder_type_review`. No matched values,
text, spans or request bodies are logged/exported by this audit.

Shared demo contract changes, for affected-member review: the validation method
literal accepts both old v1 and new v1.1; source-function alternatives add
`check_residual_output`; `release_policy_unchanged` widens from literal true to
boolean. It is **false** for new results because release checks were strengthened.
No new required response field or request field. Existing v1 snapshots and older
responses without optional validation reports remain accepted. Consumers that
hardcode old response literals must use regenerated contracts; both orchestrator
and dashboard were rebuilt together. JSON Schema, both relevant OpenAPI files
and TypeScript were regenerated from shared source, never service-local copies.

The C2 UI's diagnostic notice now states that residual FAIL/REVIEW blocks release
and that a passed check only means no supported signal was found. Actual reasons
and rule locations remain expandable; per-run accuracy stays NOT_MEASURED.

## Separate residual-check evaluation

Fixture `tests/fixtures/synthetic/c2-residual-output-v1.json` contains **36 unique
fictional output controls, zero duplicates**. These are AI-authored proposed
output labels, not independently reviewed references. They are development
fault-injection controls, not an untouched generalization/held-out test. No
anonymizer predictions or selected spans are used as gold. No labels were changed
to hide a miss or false alarm.

| Slice | Cases | Residual-positive | Signalled | Missed | Ordinary negative | False alarms |
|---|---:|---:|---:|---:|---:|---:|
| English | 15 | 8 | 6 | 2 | 4 | 2 REVIEW |
| Sinhala | 7 | 5 | 3 | 2 | 2 | 0 |
| Romanized Sinhala | 7 | 5 | 3 | 2 | 2 | 0 |
| Code-mixed | 7 | 5 | 3 | 2 | 2 | 0 |
| Total | 36 | 23 | 15 | 8 | 10 | 2 REVIEW |

Of the 15 signalled positives, **9 are FAIL-level and 6 REVIEW-only**. The JSON
key `confirmed_FAIL_cases` counts the rule's FAIL status, not human-confirmed
entity truth. Record-level triage precision **15/17 = .8824**, recall
**15/23 = .6522**, F1 **.7500**, excluding three separately analysed type controls.
These are residual **triage** metrics, not anonymizer entity/span accuracy;
REVIEW is not a correctly detected or masked entity. FAIL-only coverage is 9/23.

Eight misses are open-ended names/places, two per language group; every miss is
retained in the report. False alarms: figurative `I live in hope.` and descriptive
`My name is unimportant.` trigger REVIEW. No false FAIL occurred in these ten
ordinary/fully-masked controls, which does not establish zero false positives.
Two explicit wrong-placeholder-type controls produce REVIEW and block release.
The third wrong-type control, `[LOCATION] called me.`, has no recoverable
type evidence in output and remains unsignalled. No exposed value exists in that
third control; it is an unobservable typing error, not a residual PII detection.
Partial-mask controls include lexical residue after PERSON/LOCATION placeholders.

Separately, **30 actual local pipeline runs** (10 synthetic inputs × Regex,
Presidio, Hybrid) exercised the auditor on real returned output. No expected text
was substituted and no historical model comparison was restarted. A further eight
authenticated Presidio browser/API cases matched the Python custom-demo response
exactly, including records, diagnostics, privacy/quality summaries and blocking.

Actual example: `Name: සඳලි පෙරේරා` remains exposed with current Presidio, quality
PASS; the new field rule returns FAIL, `requires_privacy_review=true`, privacy gate
FAILED and automated release blocked. This demonstrates detection limitation and
quarantine, **not successful masking**. `I live in hope.` demonstrates a disclosed
REVIEW false alarm with the same block. Protected introductions/residence,
ordinary `gana dukai` and combined email/phone/student-ID masking retain their
actual outputs. The NER candidate remains unpromoted.

## Checks, environment failures and reproduction

New ignored aggregate evidence:
`artifacts/c2-evidence/anonymization/residual-output-v1/report.json` and `report.md`.
They contain IDs, outcomes, rule reasons, hashes and live-run metadata, not text or
detected values. The fixture/source hashes are recorded. Evaluation command refuses
to overwrite completed results:

```powershell
.venv\Scripts\python.exe scripts/run.py scripts.c2_residual_evaluate
.venv\Scripts\python.exe scripts/run.py scripts.generate_contracts --check
npm run contracts:check
.venv\Scripts\python.exe -m pytest tests/unit/test_c2_residual_privacy.py tests/unit/test_c2_output_validation.py tests/contract -p no:cacheprovider --junitxml=artifacts/c2-residual-focused-compat-final.xml
npm run lint
npm run typecheck
npm test -- tests/frontend/c2-validation.test.tsx tests/frontend/c2-demo.test.tsx
.venv\Scripts\python.exe -X utf8 scripts/check_repository.py
.venv\Scripts\python.exe -X utf8 scripts/check_ci.py
git diff --check
```

- Full Python suite: **1043 passed, 24 existing expected failures**, one existing
  Starlette/httpx warning, 132.34 s. Command:
  `.venv\Scripts\python.exe -m pytest -p no:cacheprovider --basetemp=.local/c2-residual-pytest-elevated-20261024-v1 --junitxml=artifacts/c2-residual-output-v1-pytest-verified.xml --maxfail=3`.
  After that run, a safe structured-FAIL reason string and two compatibility tests
  were added; the final affected/contract run passed **51 tests**. The full-suite
  count is not falsely increased to include those later tests.
- The first contract-aware check correctly rejected missing new method/function
  literals. Shared source and all generated forms were updated, then the check
  passed; no validation was bypassed.
- Sandboxed full-suite attempts encountered `PermissionError: [WinError 5] Access
  is denied` for pytest temporary directories, including a new workspace directory.
  Interrupted attempts are not passes. The successful full run used approved
  execution outside the sandbox and a fresh disposable workspace test directory.
- Focused frontend: **54 passed**. Initial sandbox startup `Error: spawn EPERM`
  was resolved by approved execution outside the sandbox; no tool/test weakening.
- Frontend lint/typecheck, contract drift and historical-v1 compatibility, scoped
  Ruff/formatting, repository privacy and CI-structure checks passed. Hosted CI
  was not executed. Existing unrelated C3 findings were not changed or hidden.
- Docker initially returned pipe permission denied; approved local access worked.
  Built `preprocessing orchestrator counsellor-dashboard`, then
  `docker compose up -d --no-deps preprocessing orchestrator counsellor-dashboard`.
  After the final safe-reason edit, rebuilt/recreated preprocessing only. Other
  containers, databases, accounts and volumes were preserved.
- Real Edge desktop (1366px) and mobile (390px), 100% page scale: eight authenticated
  actual runs matched Python; FAIL/REVIEW, rules/provenance, NOT_MEASURED and Reset
  verified. Screenshots were inspected; no page overflow. Final evidence:
  `.local/c2-demo-browser-60fc989a-44e5-4298-a4fc-c70c61b9761d/report.json`;
  earlier inspected screenshots are in
  `.local/c2-demo-browser-7f060e9a-d155-4f26-83c6-8d092ff13aec/`.
  Browser uses a private existing development login, never prints credentials,
  saves participant data, creates accounts or changes roles.

Current local demo: **http://localhost:3001/c2-demo**. No new model, training,
participant access, C1/C3/C4 logic change, commit or push. Normalization/tokenization
integrity and human release approval remain distinct. See also
[output-validation provenance](c2-output-validation-v1.md) and
[existing quality/privacy evidence](c2-quality-privacy-v1.md).
