# C2 LOCATION correction audit v6

2026-10-24. Branch `feature/c2-anonymization-pipeline`, HEAD
`170151c26ee13c2fcb9b3a1801204ca87b735a74`, with existing uncommitted work
preserved. This audit changes **no runtime rule, threshold, model, fixture label,
UI or policy**. No services rebuilt/restarted, unrelated suites rerun, staging,
commits or pushes.

**Finding: the LOCATION extension does not generalize without regressions on
this audit.** It adds one correct LOCATION but also two incorrect LOCATION spans
on a Sinhala inflection case, including a person's name assigned LOCATION.
It loses no baseline-correct span, but retaining old spans is not sufficient to
prevent false masking or wrong types. The active experimental configuration is
left unchanged as requested; release blocking must not be treated as detection.

## Actual implementation and source audit

Active configuration is `gliner-name-labels-v4-location-context-demo-v2`.
Model `urchade/gliner_multi-v2.1`, revision
`443d26d654e0324125a96bebd8e796c14ff2efe6`; prompts `person name` and
`location name`, threshold **0.7** in both whole-text and window calls.
The v1 comparison reconstructs the immediate previous implementation as
`combine(text, model.detect(text))`, using the same loaded model, structured
recognizers, Unicode splitter and bounded grammar. It is not a comparison to
the old committed Regex/Presidio baseline at HEAD.

The actual current `anonymize_gliner_demo()` was executed, not a renamed candidate.
Recorded window predictions were mapped back to original code-point spans and
re-rendered; every render matched the actual runtime output. All repeated
whole-text raw predictions matched between configurations. Nine relevant source
hashes remained unchanged across the audit. Read-only Docker inspection confirmed
that five key deployed runtime files match the audited local files and the
experimental flag is enabled. These new 48 cases were executed locally in Python;
they were **not** newly rerun through Docker/browser. Prior deployment parity is
separate evidence, not a claim of 48 new browser executions.

Custom-code findings:

| Area | Actual finding |
|---|---|
| New `gliner_context_windows.py` extension | No person/place dictionary, names, reported paragraphs, Sinhala residence phrases or fixture IDs. Uses punctuation and four generic title abbreviations only. |
| New LOCATION merge | Type-specific: retains baseline spans and adds only model-predicted LOCATION; it does not suppress baseline PERSON. It is not an independent second detector. |
| Imported study modules | `generalization_v3.fixtures()` contains explicit synthetic person/place pools, and `multilingual_calibration.development_pool()` contains named diagnostics. These lists exist in imported files but are inside offline fixture functions; runtime masking calls `combine()`/Unicode helpers, not those fixture functions. They are not consulted as recognizer dictionaries. Mixing study helpers and runtime utilities in these modules complicates source review. |
| Existing `contextual_detection.py` | Wording-dependent introductions: `my name is`, `mage/mge/eyge nama`, Sinhala name introductions; restricted English `live/stay/reside in`; Sinhala `මම … ජීවත් වෙමි`; bounded numbered address fields. Clause words include `gana`, `dukai`, `duki`. These predate the LOCATION extension. |
| Existing `person_context.py` | Explicit title/role variants including `supervisior`, `grp leader`, `mage/mge nangi/nngi`; bounded grammar/function words, Romanized `ai/ui` suffix abstention, and English POS assistance. Relationship review recognizes selected `girlfriend/boyfriend` wording, not all relationships. |
| Existing `location_case.py` | Exact English `it is in` frame, English POS checks, a literal colour-word exclusion set, and a local lower/title-case field probe. This is a word list, but not a person/place-name list; it is not new in this correction. It can restrict generalization and is not language-independent. |
| Structured recognizers | Existing email/public-suffix, phone and student-ID syntax; no new ID syntax or name list. |
| Documentation inconsistency | The new helper's module header still says “Offline … not enabled in the demo.” That header is stale: `gliner_demo.py` imports and calls it. No attempt was made to conceal or fix it during this runtime-frozen audit. |

No runtime lookup of a hardcoded **entity-name or place-name list**, or
fixture-specific output branch, was found in the audited custom detection path.
This distinguishes the offline lists above from executed detection. This statement concerns C2 code,
not the pretrained model's unknowable memorized vocabulary/training exposure.

## Exact sentence construction and merge

1. Whole-text v4 detection runs first. Existing `combine()` applies bounded
   grammar; structured entities and existing placeholders have priority.
2. `sentence_windows()` splits on ASCII `.`, `!`, `?` followed by whitespace,
   or newlines. A pending split after case-insensitive `Ms.`, `Mr.`, `Mrs.` or
   `Dr.` is skipped. Separator whitespace is excluded from inference slices but
   preserved in the original text used for masking. No text normalization,
   translation, casing rewrite, name lookup or gold-label lookup occurs.
3. With at most one slice, no extra inference runs. Otherwise each unchanged
   original-text slice is inferred with the same two prompts, **0.7**, and
   `flat_ner=True`. Local offsets are shifted by the slice's original start.
   Substring/bounds and combining-mark/joiner boundaries are checked.
4. Only LOCATION window predictions reach augmentation. They are sorted by
   descending score, then original start and end. Baseline spans win every
   overlap regardless of relative confidence. Predictions touching protected
   placeholders or any selected span are skipped. Exact duplicates also overlap.
   The final deduplicated spans are sorted and rechecked for unsafe boundaries
   and overlap before rendering the original text.

This is not a full sentence tokenizer: semicolons, quotes, initials/other
abbreviations and Sinhala punctuation are not comprehensively parsed. It also
does not require agreement between whole-text and window predictions: new spans
may have been absent from whole-text output. The same model in a shorter context
is **not independent corroboration**. Both entity labels participate in flat
decoding, even though only LOCATION results are added; this can influence which
overlapping model prediction survives before the C2 merge.

## Frozen references and execution

Before inference, the audit froze 48 unique fictional records and labels:
12 per language, 32 positive records, 16 ordinary/placeholder controls, with
32 PERSON and 32 LOCATION references. Casing variants and Sinhala/Romanized
suffix variants stay grouped in this audit. Separable suffixes are excluded from
the proposed gold name/place span under the existing annotation guide; unsafe
root boundaries would fail preflight rather than be snapped.

Preflight found two exact previously inspected placeholder controls, which were
**retained and explicitly separated**. Primary results below use **46 newly
frozen texts**: 12 English, 12 Romanized Sinhala, 11 Sinhala and 11 code-mixed.
The other two records have no gold PII and are reported separately. No text was
changed or dropped after inference to improve a result. Casing variants are not
independent samples; human-independent reference review was not performed.
New text does not establish unseen entity vocabulary relative to model pretraining
or every earlier project fixture. All reference labels are AI-authored synthetic
proposals, not expert/adjudicated gold.

Fixture SHA-256:
`a13cbe222b57e638caf478ef7554e9abb851ab667f44b6b70cd14a87299a54d3`.
An initial audit-helper string-format syntax error and the duplicate-text
preflight were resolved **before any inference**; no runtime code or reference
labels were changed to obtain a passing evaluation. No tuning followed results.

## New-text detection results

Exact **typed** PERSON/LOCATION metrics, 64 gold entities on the 46 new texts:

| Runtime | TP | FP | FN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| Previous v1 | 36 | 14 | 28 | .7200 | .5625 | .6316 |
| Current v2 | 37 | 16 | 27 | .6981 | .5781 | .6325 |

Each language/entity has eight gold spans. Counts are TP/FP/FN. FP includes
incorrect types/bounds as well as ordinary-text masks; FN is an exact-span miss,
not necessarily a wholly exposed entity.

| Language / new records | Entity | Previous TP/FP/FN | Current TP/FP/FN | Previous → current F1 | Lost correct / new false spans |
|---|---|---|---|---|---|
| English / 12 | PERSON | 8/3/0 | 8/3/0 | .8421 → .8421 | 0 / 0 |
| English / 12 | LOCATION | 8/0/0 | 8/0/0 | 1.0000 → 1.0000 | 0 / 0 |
| Sinhala / 11 | PERSON | 4/4/4 | 4/4/4 | .5000 → .5000 | 0 / 0 |
| Sinhala / 11 | LOCATION | 2/3/6 | 3/5/5 | .3077 → .3750 | 0 / 2 |
| Romanized Sinhala / 12 | PERSON | 0/1/8 | 0/1/8 | .0000 → .0000 | 0 / 0 |
| Romanized Sinhala / 12 | LOCATION | 0/0/8 | 0/0/8 | .0000 → .0000 | 0 / 0 |
| Code-mixed / 11 | PERSON | 8/2/0 | 8/2/0 | .8889 → .8889 | 0 / 0 |
| Code-mixed / 11 | LOCATION | 6/1/2 | 6/1/2 | .8000 → .8000 | 0 / 0 |

Current PERSON predictions are unchanged in all records. The 16 Romanized gold
entities remain fully exposed across the different relationship wording and
casing families tested here. The new LOCATION supplement recovers none of them.
English casing families work on this small set; that does not establish casing
invariance for arbitrary entities/languages. Existing Sinhala/mixed inflection
boundary errors remain, alongside the new errors below.

Physical masking coverage on the **new 46 texts**, counting unioned spans across
entity types: fully exposed gold entities **22 → 19**, partly masked entities
**1 → 1**, unmasked gold characters **277 → 245**, and unnecessary characters
**55 → 57**. Fewer exposed characters does not make an incorrectly typed entity
an exact typed true positive. No baseline-correct span was lost; unsafe Unicode
boundaries stayed zero. Exact-boundary wrong-type errors rose **0 → 1**.

The two reused controls have **0 gold entities**, one existing false PERSON span
covering two characters in one code-mixed control, unchanged. Their empty-gold
rates are not evidence of accuracy. They are not pooled into the primary table.
Structured-PII accuracy was **not measured** in this audit (zero new positive
email/phone/student-ID references); prior preservation evidence is reused only.

## New scores and concrete regressions

All three added spans are from actual sentence-context predictions at **0.7**:

| Audit case | Original span / proposed reference | Added LOCATION score | Outcome |
|---|---|---:|---|
| `si-family-b-bare` | `[36,45)`, `තඹුත්තේගම`, gold LOCATION | .720378 | Correct added LOCATION |
| `si-family-a-at` | `[13,25)`, `ඇඹිලිපිටියදී`; gold root `[13,23)` | .806129 | Wrong boundary; masks grammatical suffix `දී` |
| `si-family-a-at` | `[26,39)`, `ඉඳුවර මල්වත්ත`, gold PERSON | .733148 | Wrong entity type: LOCATION |

The failed Sinhala clause is `ඇඹිලිපිටියදී ඉඳුවර මල්වත්ත හමුවුණා.`
The previous runtime left it exposed; current output is
`[LOCATION] [LOCATION] හමුවුණා.` Its second placeholder is wrongly typed and the
first removes the suffix. This is not an unsafe Unicode split: it is a semantic
span-boundary error relative to the frozen annotation policy. These errors come
from actual model window predictions, accepted without conflicts because the
whole-text baseline had no spans there. The merge does not invent the label or
trim it to gold. The suffix is part of the model's original word-level span.

The wrong predictions score **higher** than the newly correct .720378 location.
A higher cutoff is therefore not shown to fix this tradeoff; no threshold sweep,
suffix trimming, type override, word blacklist or new grammar was attempted.

## Previously inspected evidence remains separate

The prior [v5 study](c2-paragraph-context-v5.md) reported PERSON/LOCATION F1
.7397 → .8052 on its 34 development records and .6875 → .8000 on its then-frozen
16-record evaluation. Those cases have since been inspected and are development
evidence for any subsequent work. Their old saved predictions were not rerun or
pooled with the new audit to improve its score.

Previously reported Sinhala locations scored .830595 and .800410 in sentence
context versus .582579/.565403 diagnostic whole-text scores. These are **reused
measurements**, not new audit cases. The old Romanized relationship miss also
remains documented. This new audit contradicts any broader claim that v2 adds no
false masks in general; the earlier no-new-FP observation was limited to that
small pilot. Privacy REVIEW/blocking was never counted as entity detection.

## Evidence, commands and decision

Local ignored directory:
`artifacts/c2-evidence/anonymization/location-audit-v6/`:

- `frozen-fixtures.json`, `protocol.json`: pre-inference labels, hashes, provenance.
- `results.json`: both configurations, separate splits, whole-text raw spans and
  window-local raw spans/scores with original window-start offsets, final
  original-text spans, added/lost entities, timings and review signals;
  no fixture text/detected values in this aggregate result file.
- `deployed-source.json`: read-only deployed source fingerprints, no secrets.

```powershell
.venv\Scripts\python.exe -X utf8 .local/c2-location-audit-v6.py freeze
.local\c2-gliner-cpu-env\Scripts\python.exe -X utf8 .local/c2-location-audit-v6.py run
.venv\Scripts\python.exe .local/c2-location-audit-deployed.py
.venv\Scripts\python.exe -X utf8 .local/c2-location-audit-v6-summary.py
```

Freeze/run refuse overwriting completed evidence; no comparisons were tuned or
repeated after the new results were inspected. Existing tokenizer conversion,
regex-pattern and max-length warnings remain unresolved. No full suites, builds,
service restarts or unrelated checks were run. Only new ignored audit files and
this evidence document were written; all staged/unstaged runtime edits preserved.

**Conclusion:** the current supplement has a limited recall benefit but fails
the earlier no-new-false-spans/no-extra-masking criterion on this new set. PERSON
and Romanized LOCATION generalization remain particularly weak. No correction
or rollback was made during this audit. The live demo remains experimental and
release-blocked; absence of a residual signal does not establish anonymity.
