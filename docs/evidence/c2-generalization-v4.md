# C2 generalization v4 — PERSON label specificity, offline development probe

2026-10-24. Branch `feature/c2-anonymization-pipeline`, HEAD
`170151c26ee13c2fcb9b3a1801204ca87b735a74`, current working tree preserved.
**Neither candidate qualifies; no runtime, API, dashboard or policy change.**
This continues [generalization v3](c2-generalization-v3.md); it does not restart
that comparison or overwrite its evidence.

## Cause: person references versus personal names

C2's [annotation policy](c2-pii-annotation-guide.md) excludes pronouns, roles and
introductory words from PERSON. The v3 GLiNER prompt was simply `person`.
Targeted local inference recovered the missing scores/decoder metadata for 20
already-inspected development cases, including all 12 ordinary negatives masked
by the v3 combination and eight positive controls. No aggregate baseline/model
comparison was rerun. The audit records original half-open Unicode code-point
offsets, labels, scores and boundary checks without text or detected values.

Representative model outputs **before C2 overlap selection**:

| Ordinary synthetic input | Predicted PERSON span | Score |
|---|---|---:|
| `Our supervisor is helpful.` | `[0,14)` (`Our supervisor`) | .844150 |
| `I feel worried about exams.` | `[0,1)` (`I`) | .777781 |
| `මම අද මහන්සියි.` | `[0,2)` (`මම`) | .847185 |
| `මම හෙට එන්නම්.` | `[0,2)` (`මම`) | .853956 |
| `Our supervisor හොඳයි.` | `[0,14)` (`Our supervisor`) | .879231 |

Each listed span has safe Unicode boundaries. Flat and nested decoding returned
the same spans in this targeted audit: C2 is not mis-mapping token offsets,
inventing the pronoun, or selecting a wrong competing entity to produce these
errors. GLiNER's decoder greedily selects model spans by score, then the adapter
preserves structured identifiers, placeholders and contextual fields. The JSON
key `raw` means nested decoded model output before C2 selection, **not raw logits
or every rejected pre-decoder span**. No unmeasured claim about all model logits
is made.

The shared explanation supported by these observations is semantic overbreadth:
the model labels references to people, while the privacy task requires names.
Changing only label prompts below removes these English and Sinhala errors,
supporting that explanation. This is not proof of the model's internal reasoning.
Other errors have distinct causes: three Romanized ordinary negatives had no
GLiNER prediction and were introduced by the shared contextual grammar. Those
are not cured by relabelling the model. Title-inclusive positive spans also show
boundary-policy mismatch; the existing grammar can sometimes repair them.

Scores are not calibrated privacy probabilities. A threshold chosen to exclude
every sampled negative (up to .879231) would also remove at least the inspected
title-inclusive positive `Dr. මලිති` (.875339) at the raw-model stage; grammar may
recover it, but this sample does not establish a generally safe cutoff. No score
threshold search, confidence inflation, pronoun blacklist, name list, source
casing conversion or example exception was implemented.

## One predeclared label correction

Actual experimental change: `person name` → PERSON and `location name` → LOCATION,
replacing the two broad GLiNER prompts, at the unchanged **0.7** threshold.
Original text, offsets, model weights, UnicodeWordSplitter, structured recognizers
and existing overlap/placeholder logic are preserved. `NameLabelModel` maps only
returned schema labels; it never changes a prediction's text, score or bounds.
Two outputs from the same inference are compared: name-label model alone, and
name-label model plus the unchanged v3 shared grammar. No English NER union.

Model revision remains `443d26d654e0324125a96bebd8e796c14ff2efe6` of
`urchade/gliner_multi-v2.1`; the existing loader verifies safetensors SHA-256
`2100142f31627531497850659dcb3821c99d5e71c08a8e01a98e4b11ef32a199`.
Existing CPU environment: GLiNER 0.2.24, torch 2.6.0+cpu, transformers 4.57.3;
English grammar dependency spaCy 3.8.16/en_core_web_sm 3.8.0, Presidio 2.2.364.
Four CPU threads, local cached weights/backbone only, no downloads/hosted inference
or training. Main dependencies and runtime registration remain unchanged.

Before new-label inference, `protocol.json` fixed the prompts, threshold and
criteria: retain every current-runtime **and v3-combination** correct exact span;
no increase in misses or unnecessary masking in any language relative to either;
preserve ordinary negatives; remove the investigated pronoun/role false positives;
retain structured spans, placeholders and Unicode integrity. A pre-inference
implementation audit corrected reference-summary boundary checking to use actual
text rather than an empty placeholder. The first protocol is preserved as
`protocol-preflight-original.json`; no labels/configurations/criteria changed.

All 132 original v3 cases are now **development evidence**, including the former
evaluation pool. Labels/text are reused unchanged and hash-checked against the
existing freeze. There are **110 unique texts and 22 repeated case entries**:
18 original/lowercase duplicates and four structured-control cross-pool repeats.
Case-weighted references contain 100 PERSON/LOCATION spans plus 24 structured
spans; inference is deduplicated to 110 calls, then results are mapped back to
every original case. The report also provides deduplicated sensitivity scores.
References remain AI-authored fictional proposals, not independent human gold;
no reviewer identity, independence or adjudication is invented.

## Actual development comparison

PERSON/LOCATION only; the previous configuration scores reuse saved predictions.
REVIEW/blocking is not a true positive and no cases are excluded for those states.

| Configuration | TP / FP / FN | Precision | Recall | F1 | Fully exposed | Unnecessary characters |
|---|---|---:|---:|---:|---:|---:|
| Current runtime | 60 / 34 / 40 | .6383 | .6000 | .6186 | 31 | 260 |
| v3 GLiNER alone | 71 / 26 / 29 | .7320 | .7100 | .7208 | 19 | 122 |
| v3 GLiNER + grammar | 87 / 20 / 13 | .8131 | .8700 | .8406 | 12 | 130 |
| Name labels alone | 68 / 12 / 32 | .8500 | .6800 | .7556 | 25 | 49 |
| Name labels + grammar | 85 / 9 / 15 | .9043 | .8500 | .8763 | 15 | 74 |

The model-only narrower labels preserve **all 24 ordinary negative cases** and
remove the investigated English/Sinhala false positives. But 17 current-correct
case spans and 19 v3-combination-correct case spans are lost (including repeated
casing entries), so that configuration fails recall/retention.

The grammar combination retains all current-runtime-correct spans, but loses
two v3-combination-correct entries: the identical original/lowercase versions of
`mage girlfriend oshadi.`. Previously the model masked the name; the narrower
prompt leaves it exposed. This is **one unique lost name/context**, not two
independent failures. No name was hardcoded to rescue it.

Combined name-label results by language:

| Language | Cases | PERSON/LOCATION gold | TP / FP / FN | Precision | Recall | F1 |
|---|---:|---:|---|---:|---:|---:|
| English | 38 | 30 | 30 / 3 / 0 | .9091 | 1.0000 | .9524 |
| Sinhala | 18 | 10 | 10 / 0 / 0 | 1.0000 | 1.0000 | 1.0000 |
| Romanized Sinhala | 38 | 30 | 15 / 5 / 15 | .7500 | .5000 | .6000 |
| Code-mixed | 38 | 30 | 30 / 1 / 0 | .9677 | 1.0000 | .9836 |

These small synthetic slices do not establish language support. All **15**
remaining combined exact misses are entirely exposed Romanized entities;
there are zero partial masks. The corresponding deduplicated exposure count
is nine. The shared grammar still falsely masks four ordinary negative entries
(three Romanized, one mixed). Romanized unnecessary characters increase **50→66**
relative to the v3 combination, despite overall unnecessary masking improving.
Complete per-entity/language counts and failure IDs are in the aggregate report.

Each new configuration preserves all 24 structured reference spans (8 email,
8 phone, 8 student-ID entries using repeated control values), protected placeholders
and safe Unicode boundaries. These are regression controls, not comprehensive
structured-PII accuracy. No privacy policy is bypassed or weakened.

**Decision: keep both configurations offline; no candidate selected for fresh
evaluation.** The predeclared retention, language-sliced miss and ordinary-text
criteria fail. A fresh reserved set is therefore not generated or inspected;
it must be separately frozen after a future candidate qualifies, with related
names/casing/templates grouped and reference provenance recorded. No retuning on
the former evaluation pool is misrepresented as held-out validation.

The concrete blocker is Romanized name/context recall plus contextual false
masking, even after the broad-label semantic errors are removed. The label change
is a useful offline result, not sufficient evidence to replace the working runtime.
Representative independently reviewed references and evidence for reliable name
boundaries are still needed; aggregate F1 improvement alone does not satisfy the
preservation criteria or authorize release.

## Artifacts, commands and verification

New ignored directory:
`artifacts/c2-evidence/anonymization/generalization-v4/`

- `raw-score-audit.json`: 20 targeted original-label cases, scores and original
  offsets from flat/nested decoded output; no text/detected values.
- `protocol*.json`: pre-inference freeze and preserved preflight revision.
- `development-results.json`: every outcome, duplicate sensitivity, criteria,
  losses and actual new-label timings; no text/detected values.
- `comparison.json`, `report.md`: all reused/new configurations, per-entity and
  language tables, deduplicated scores and explicit failed criteria.
- `source-reuse-check.json`: all **51** previously hashed preprocessing source
  files unchanged, frozen v3 evidence unchanged, index empty.

Reproduction from the repository root (completed freeze/results refuse overwrite):

```powershell
.venv\Scripts\python.exe scripts/run.py preprocessing.name_label_evaluation_v4 freeze
.local\c2-gliner-cpu-env\Scripts\python.exe scripts/c2_name_label_candidate_v4.py
.venv\Scripts\python.exe scripts/run.py scripts.c2_name_label_report_v4
.venv\Scripts\python.exe -m pytest tests/unit/test_c2_name_label_candidate_v4.py -q -p no:cacheprovider
.venv\Scripts\python.exe -m ruff check services/preprocessing/name_label_candidate_v4.py services/preprocessing/name_label_evaluation_v4.py scripts/c2_name_label_candidate_v4.py scripts/c2_name_label_report_v4.py tests/unit/test_c2_name_label_candidate_v4.py
.venv\Scripts\python.exe -X utf8 scripts/check_repository.py
git diff --check
```

The actual inference entry point was `.local/c2-v4-run.py`, using the same import
setup now preserved in the reusable runner. The supplementary score probe is
`.local/c2-v4-score-probe.py`; it was executed only for missing metadata, not used
to restart v3 scoring. Helpers remain ignored. No further inference was repeated
to rename entry points or render reports.

New-label model first-pass load **21.29 s**, median **259.46 ms**, p95 **327.72 ms**,
maximum **2613.44 ms** for the 110 unique inputs. Combined end-to-end timing and
new peak memory were not measured; these are not warmed production benchmarks.
Existing tokenizer byte-fallback/regex/max-length warnings remain unresolved.

**5 new focused tests passed**, with the existing Starlette/httpx deprecation
warning. They verify label mapping without text/score/offset mutation, structured
priority, placeholder protection, safe failure on invalid metadata, exact typed
loss accounting, unchanged references and duplicates. They are not accuracy tests.
Scoped Ruff/formatting and repository privacy checks passed. Initial lint findings
(import spacing and ambiguous local variable) were corrected without altering the
frozen inference code. `git diff --check` passed after final documentation edits
(existing Language ID CRLF notice only).

The v3 **198 passed / 16 existing expected failures** remain applicable to the
unchanged runtime; no full-suite rerun, container rebuild or UI/API execution was
needed for this rejected offline prompt experiment. No adoption/Docker/UI success
is claimed. Actual runtime masking, privacy/release enforcement, dashboards,
accounts and drafts remain untouched. No participant-data access, training, C3
change, staging, commit or push occurred. See [quality/privacy evidence](c2-quality-privacy-v1.md)
and [output-validation limits](c2-output-validation-v1.md).
