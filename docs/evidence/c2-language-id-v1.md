# C2 Language ID evidence report

## Current checkpoint: c2-rule-language-v1.1

Purpose: describe language evidence after anonymization and existing quality
assessment, without configuring the English Presidio analyzer or granting release.
Current method uses Unicode script and fixed English/Romanized grammatical markers;
weak/unsupported inputs abstain. Version 1.1 adds only a complete, case-insensitive
`mage/mge/eyge nama` short-field exception. Placeholders provide no evidence;
the generic three-token minimum remains. Rule matches are provisional, not
calibrated confidence or validated multilingual anonymization.

Selection rationale: deterministic, offline, auditable and available without
models/downloads. [Official fastText documentation](https://fasttext.cc/docs/en/language-identification.html)
was reviewed; fastText was **not executed**, downloaded or compared numerically.
Actual comparison is v1 versus v1.1 on the same frozen labelled inputs and added
development diagnostics, not a tool-performance competition.

Fixture provenance: 33 unchanged synthetic development cases in
`scripts/c2_language_id_evaluate.py`, with manually specified language labels;
33 added short-phrase diagnostics in `scripts/c2_language_short_evaluate.py`.
None are participant text, independent annotations or untouched final tests.

| Evaluation | v1 | v1.1 |
|---|---|---|
| Frozen language cases | 15/24 matches, 7 abstentions, 2 wrong provisional labels | Unchanged |
| Frozen unknown/uncertain controls | 9/9 correct | Unchanged |
| Short diagnostic labels | 16/33 match; 16 language abstentions; 1 error | 32/33 match; 0 language abstentions; 1 error |
| Explicit short-introduction positives | 0/16 Romanized labels | 16/16 Romanized labels |

Remaining errors: English quoting Romanized markers can be incorrectly code-mixed;
two frozen mixed cases become English after existing masking removes Romanized
evidence. Short/spelling/loan-word/acronym ambiguities remain. These measured label
counts are separate from unit-test pass counts. Mean v1.1 stage wall time .02028 ms
on one 33-diagnostic CPU pass, max .0788 ms; no load/memory benchmark.

Reproduce current results with fresh output paths (reports refuse overwrites):

```powershell
.venv\Scripts\python.exe scripts\run.py scripts.c2_language_id_evaluate --output-dir artifacts/c2-evidence/language-id/reproduction-current
.venv\Scripts\python.exe scripts\run.py scripts.c2_language_short_evaluate --baseline artifacts/c2-evidence/language-id/short-phrase-v1/baseline_language_id.py --output artifacts/c2-evidence/language-id/reproduction-short.json
.venv\Scripts\python.exe -m pytest tests/unit/test_c2_language_id.py tests/integration/test_c2_demo.py
```

The second command requires the preserved local, ignored v1 source snapshot;
it is not a checked-in runtime dependency. Full comparison/provenance/checks are
in [short-phrase evidence](c2-language-short-phrase-v1.md). Separate stage reports:
[normalization](c2-normalization-v1.md), [tokenization](c2-tokenization-v1.md).
See [anonymization provenance](c2-anonymization-milestone.md),
[active contextual correction](c2-contextual-runtime-v1.md),
[active role/privacy limitations](c2-role-kinship-v3.md), and
[quality/privacy milestone](c2-data-quality-milestone.md). Historical v1 evidence
below is retained; no old aggregate reports or scores are overwritten.

## Historical v1 baseline record

Configuration frozen before evaluation: `c2-rule-language-v1`. No trained
classifier, downloads, hosted calls or dependency changes. Presidio remains
English `en_core_web_sm`; global Regex default and privacy/quality policies stay
unchanged. This is not automatic multilingual anonymization.

Execution: anonymize, complete existing batch quality assessment, then identify
language from the anonymized text. Known masking placeholders contribute no
evidence. Text, offsets, punctuation, combining marks and joiners are not changed.
Language ID is informational and never changes release blocking.

Criteria: Sinhala letters without Latin/other letters give provisional Sinhala.
Latin-only input needs at least three tokens and two distinct documented markers
from a language group. English markers include grammatical words (I/my/is/about)
and common wellbeing words; Romanized markers include mata/mt, mage/mge, ape,
eyge, nisa, gana/gena/gna, nama, duki/dukai, bayai/byi and common inflections.
The complete fixed sets are in `services/preprocessing/language_id.py`.
Both groups give provisional code-mixed. Sinhala plus supported English evidence
also gives code-mixed. Mixed script without English evidence remains uncertain;
Romanized transliteration beside Sinhala cannot establish English mixing.
Other scripts give unknown. Empty, numeric, emoji-only and placeholder-only
content give unknown. Weak Latin evidence gives uncertain, never English by
script alone. `uncertain=false` means these heuristic criteria were met, not a
calibrated probability or research validation. No numeric confidence is emitted.

Known limits: short English, spelling variants, borrowed words, unrelated Latin
languages sharing markers, names and quoted fragments can defeat these rules.
The evaluation is new synthetic development evidence, not an independent test.
Do not tune these criteria against the results silently.

API: additive optional `C2DemoRecord.language_identification` provides label,
status, reason, method and uncertainty. The legacy `language_hint` request field
defaults to `unsure` for compatibility and still never configures the analyzer.
The browser sends only text and Presidio strategy. Existing scenario metadata
remains fixture metadata. Shared schema/OpenAPI/TypeScript are regenerated together.

Page: http://localhost:3001/c2-demo. Sign in with the private local development
counsellor account, type fictional text, Run, inspect Before/After, quality/privacy
and read-only Language ID. Reset clears input and invalidates pending responses.
All eight stages remain visible. No intermediate backend events exist: only
overall processing is shown until the response, followed by confirmed executed
stages. REVIEW/REJECT/privacy blocking are distinct from execution completion.
Annotation and human release approval remain Pending.

## Actual development evaluation

Frozen 33 synthetic cases, evaluated once through current Presidio and the actual
pipeline. Expected labels describe the original fictional input. Masking can
remove evidence before Language ID; no rules or anonymization expectations were
changed after seeing results.

| Intended category | Cases | Matching labels | Unknown/uncertain abstentions | Wrong provisional labels |
|---|---:|---:|---:|---:|
| Sinhala | 6 | 6 | 0 | 0 |
| English | 6 | 4 | 2 | 0 |
| Romanized Sinhala | 6 | 3 | 3 | 0 |
| Code-mixed | 6 | 2 | 2 | 2 |
| Unknown/no supported evidence | 5 | 5 | 5 | 0 |
| Ambiguous/weak Latin evidence | 4 | 4 | 4 | 0 |

The last two rows are correct unknown/uncertain outcomes, not detected languages.
There are seven abstentions among 24 intended language cases and two incorrect
end-to-end provisional English labels. Separate original-text diagnostic probes
show both code-mixed errors are caused by existing anonymization removing the
Romanized evidence: the rules identify both originals as code-mixed, but identify
the surviving text as English. This increment intentionally does not fix that
anonymizer behaviour. A Romanized case also changes uncertain to unknown after
masking removes all letters. Short English, kinship/group-leader Romanized fields
and borrowed-English Sinhala examples remain uncertain. This is reused/curated
synthetic development evidence, not genuinely held-out research validation.

Aggregate reports (no fixture text/detected values):
`artifacts/c2-evidence/language-id/rule-baseline-v1/report.json` and
`original-language-diagnostics.json`. The reusable evaluation script contains the
fixed fictional cases; no weights or participant material are involved.

## Executed checks and reproduction

HEAD remains `65e4db35c775dafa6bd9939b2cf56fc1e291da51`; the current working
tree is the evaluated baseline. Presidio 2.2.364, spaCy 3.8.16 and
`en_core_web_sm` 3.8.0 are unchanged. No anonymizer rules, thresholds, quality
policies, privacy checks or release conditions were edited in this increment.

Commands from the repository root:

```powershell
.venv\Scripts\python.exe scripts\run.py scripts.c2_language_id_evaluate --output-dir artifacts/c2-evidence/language-id/rule-baseline-v1
.venv\Scripts\python.exe -m pytest tests/unit/test_c2_language_id.py tests/unit/test_c2_relationship.py tests/unit/test_c2_romanized_predicate.py tests/integration/test_c2_demo.py
.venv\Scripts\python.exe -m pytest
npm run lint
npm run typecheck
npm test
.venv\Scripts\python.exe scripts\run.py scripts.generate_contracts --check
npm run contracts:check
.venv\Scripts\python.exe -X utf8 scripts\check_repository.py
.venv\Scripts\python.exe scripts\check_ci.py
.venv\Scripts\ruff.exe check services/preprocessing/language_id.py services/preprocessing/pipeline.py packages/contracts/src/research_contracts/__init__.py tests/unit/test_c2_language_id.py scripts/c2_language_id_evaluate.py
.venv\Scripts\ruff.exe format --check services/preprocessing/language_id.py services/preprocessing/pipeline.py packages/contracts/src/research_contracts/__init__.py tests/unit/test_c2_language_id.py scripts/c2_language_id_evaluate.py
git diff --check
docker compose build preprocessing counsellor-dashboard
docker compose up -d --no-deps --wait preprocessing orchestrator counsellor-dashboard
.venv\Scripts\python.exe scripts\run.py scripts.c2_relationship_verify --output-dir artifacts/c2-evidence/language-id/rule-baseline-v1/docker-parity --browser-inputs .local/c2-language-id-browser-inputs.json
.venv\Scripts\python.exe scripts\run.py scripts.c2_contextual_verify --output-dir artifacts/c2-evidence/language-id/rule-baseline-v1/protected-docker-parity --browser-inputs .local/c2-language-id-protected-inputs.json
.venv\Scripts\python.exe scripts\run.py scripts.c2_demo_smoke
node scripts/c2_demo_browser.mjs .local/c2-language-id-browser-inputs.json
```

The browser-input file was extended in memory with the 33 fixed Language ID
cases before the 77-run check; the parity generator itself writes only its 44
joint cases. The separate protected browser file is reproducible directly from
the contextual verifier command. No helper source or credentials were committed.

The evaluation refuses to overwrite evidence: use a new output directory for
reproduction. Python focused: **121 passed, 9 xfailed**; full: **848 passed,
22 xfailed**, 105.90s, one existing TestClient deprecation warning. Frontend
focused initially **35 passed**, full after final tests **58 passed**. Lint,
typecheck, schema/OpenAPI/TypeScript drift, full-suite compatibility, scoped
Ruff/format, CI structure and diff whitespace checks passed. Repository check
initially failed under Windows cp1252; `-X utf8` passed without source edits.
Global `.venv\Scripts\ruff.exe check .` still fails with **63 existing C3 errors**;
C3 files and rules were preserved.

Docker build succeeded; all three affected services healthy. Actual authenticated
local-Python/Docker parity passed on 44 joint-entity cases. Existing smoke passed
45 scenario executions plus authorization, strict validation, logout and log
privacy checks. A second Python/Docker parity run passed all **70** reused
contextual/contact cases, including introduced names, residence, combined PII,
existing placeholders and structured entity types. Known detection failures
remain in the report; parity does not mean they were correctly anonymized.
Edge 155.0.4283.45 verified 77 actual runs (44 reused relationship
and 33 language cases), read-only Language ID/no dropdown, exact Before/After,
quality/privacy/gates, eight stages, Reset/logout/no browser storage and a 390px
Sinhala viewport. Desktop/narrow screenshots were visually inspected. The first
browser assertion failed because the smoke compared `romanized-si` to the UI's
readable `romanized si`; correcting the assertion passed, without altering results.
An initial diagnostic helper invocation used the module runner with `-c`, which
it does not support; running the in-memory diagnostic directly succeeded.

After the final connector CSS correction, the frontend was rebuilt/restarted and
Edge passed another **70** real protected-case runs. The final 390px screenshot
was visually inspected: pending connectors remain gray and confirmed completed
neighbouring stages use green connectors. Neither browser run fabricates results.
Reports/screenshots remain ignored under `.local/c2-demo-browser-*`.

Files affected in this increment: `services/preprocessing/language_id.py`,
`pipeline.py`; shared contract source and regenerated C2 schemas, both demo
OpenAPI documents and TypeScript declarations; C2 `page.tsx`/`demo.css`;
`tests/unit/test_c2_language_id.py`, `tests/frontend/c2-demo.test.tsx`;
`scripts/c2_language_id_evaluate.py`, `scripts/c2_demo_browser.mjs`; this document
and `docs/evidence/c2-demo-page.md`. Existing unrelated edits remain uncommitted
and unstaged; no commits, pushes, branch changes or historical report edits.

Remaining blockers: heuristic language generalization and anonymization removing
language evidence; known Sinhala/Romanized name misses, false masking and bounded
privacy-review coverage persist. Language ID does not grant release approval.
## Current v1.2 category checkpoint (2026-10-15)

See [frozen category policy](c2-language-category-policy.md). Mixed script is not
mixed language: Sinhala script plus recognized Romanized Sinhala markers, without
sufficient English evidence, now reports Sinhala with mixed-script evidence.
All pure-Latin rules and the v1.1 short introduction correction are unchanged.

| Unchanged frozen gold | Records | Matches before/after | Wrong labels before/after | Abstentions before/after |
| --- | ---: | ---: | ---: | ---: |
| Sinhala | 6 | 6/6 | 0/0 | 0/0 |
| English | 6 | 4/4 | 0/0 | 2/2 |
| Romanized Sinhala | 6 | 3/3 | 0/0 | 3/3 |
| Code-mixed | 6 | 2/2 | 2/2 | 2/2 |

Nine unknown/uncertain controls match in both versions. Language totals remain
15/24 matches, seven abstentions and two wrong labels. The two mixed cases lose
Romanized evidence during anonymization and become English; this stage analyses
anonymized text only. Frozen mixed examples with isolated borrowed English words
lack the required grammatical evidence under this policy. Their gold labels
remain unchanged and the failures are counted, not relabelled successes.

Added development diagnostics: 12/15 -> 15/15 matches, three Sinhala mixed-script
abstentions corrected, zero wrong labels. By category: Sinhala 1/4 -> 4/4;
English 1/1; Romanized 3/3; code-mixed 2/2; unknown/uncertain controls 5/5.
The supplied Sinhala-script sentence containing Latin `mata` now reports Sinhala,
reason `sinhala_language_with_romanized_mixed_script_evidence`.
The reused short set remains 32/33: all 16 Romanized naming phrases match;
English quoting Romanized words still incorrectly reports code-mixed.
Single shared/quoted markers remain a limitation. These are inspected development
cases, not independent validation or proof of multilingual support.

The evaluator asserts identical non-language record fields, normalized text,
tokens, quality/privacy summaries, release decisions and reasons for all 33
frozen before/after pipeline runs. No preservation regressions were observed.
Only v1.1 and v1.2 were executed in this increment; documented alternatives
below were not benchmarked. Runtime is a single CPU pass over 48 short diagnostic
inputs, excluding imports/model load; aggregate timings are recorded locally in
`artifacts/c2-evidence/language-id/category-v1.2/report.json`.

Reproduce with repository root and `services`, `packages/contracts/src`,
`packages/python-common/src` on PYTHONPATH:

```text
python -m scripts.c2_language_categories_evaluate --baseline .local/c2-language-v1.1.py --output artifacts/c2-evidence/language-id/category-v1.2-fresh/report.json
```

The baseline is the preserved pre-change local source snapshot; obtaining that
historical artifact is required for a fresh checkout comparison. Existing output
is never overwritten. The reports below preserve earlier measured evidence.


Measured v1.1/v1.2 diagnostic CPU timing (milliseconds, single pass):
{"before": {"calls": 48, "mean": 0.015520833333333333, "max": 0.0321}, "after": {"calls": 48, "mean": 0.0138, "max": 0.0261}}
