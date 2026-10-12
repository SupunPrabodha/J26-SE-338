# Reproducing the C2 anonymization comparison

For a clearer research selection report, introducing the tools and presenting precision, recall and F1 as percentages:

```powershell
.\.venv\Scripts\python.exe scripts/run.py preprocessing.benchmark_report --pdf-from-results artifacts/c2-anonymization/results.json --selection-summary --output artifacts/c2-anonymization/selection-report
```

This creates `artifacts/c2-anonymization/selection-report/comparison.pdf`. It explains the provisional choice, alternatives, language/entity evidence, masking tradeoffs and limitations in three main pages, with a supporting provenance/runtime page. Percentage and runtime rounding affects presentation only; the original JSON is preserved and embedded exactly. F1 is labelled as a balanced detection score, not general accuracy or anonymity. No measurement runs during conversion. The detailed report remains separate.

To convert the **existing** recorded results into a research-panel PDF without measuring again:

```powershell
.\.venv\Scripts\python.exe scripts/run.py preprocessing.benchmark_report --pdf-from-results artifacts/c2-anonymization/results.json --output artifacts/c2-anonymization
```

This creates `artifacts/c2-anonymization/comparison.pdf` and leaves `results.json` and `comparison.md` untouched. It uses recorded metrics, timings, versions, benchmark ID and measurement fingerprints, rather than inspecting today's environment or Git revision. Numbers are not rounded during conversion. The original JSON is embedded byte-for-byte as `results.json`, with its SHA256 printed in the PDF. Only the current aggregate schema is accepted; unknown fixture/span fields, invalid metrics and missing candidates are rejected. Presidio is labelled the provisional recommendation; production selection remains pending and Regex remains default. The English PDF has repeated table headers, page numbers, comparisons, masking errors, runtime, rationale, limitations and reproduction instructions. Future normal benchmark runs now automatically create PDF alongside JSON/Markdown; **do not run the measurement command merely to export a PDF**.

PDF dependencies are pinned through uv: ReportLab and pypdf for generation/attachment, with PyMuPDF in the development group for page rendering and verification. The hashed requirements export retains the fixed Presidio archive source. Updating these dependencies does not alter the historical requirements hash in the measured JSON. Verification details are in [PDF export evidence](../../docs/evidence/c2-pdf-export.md).

Run from the repository root with the existing locked environment:

```powershell
.\.venv\Scripts\python.exe scripts/run.py preprocessing.benchmark_report --output artifacts/c2-anonymization --repetitions 20
```

This command requires all three candidates and the installed English `en_core_web_sm` model. Missing dependencies or a missing model fail the command; no candidate is skipped, scores are never substituted, and no automatic model download occurs. Install dependencies using the repository setup instructions; preserve the fixed Presidio archive source and hashed requirements export.

Presidio's email patterns and domain validation are retained, with `tldextract` explicitly using its locked bundled public suffix snapshot (`suffix_list_urls=()`, no cache). This prevents network refreshes or host cache differences from affecting cold-start measurement; it does not disable domain validation. The dependency version is included in the generated report.

Outputs are [aggregate JSON](../../artifacts/c2-anonymization/results.json) and [supervisor comparison report](../../artifacts/c2-anonymization/comparison.md). These local artifacts are ignored. The report is generated from the actual run and includes overall, language, entity and template-family denominators, masking errors, cold/warm timing, environment/model versions, benchmark ID, revision and working-source fingerprints. No fixture text, individual IDs, span details or detected values are written to either output. Synthetic fixtures are generated in memory and discarded. The generator source contains synthetic templates, not a collected dataset.

The benchmark has 8 development and 53 held-out cases (English 14; Sinhala, Romanized Sinhala and code-mixed 13 each), with 45 held-out gold entities. Template families stay in one split. Do not tune against the held-out set: create a new independent benchmark version for subsequent selection. The existing recognizers were not tuned to improve these held-out scores. The challenge set tests structured identifiers, repeated values, protected placeholders, multiword names/locations, spelling variants and ordinary wellbeing words following broad Sinhala `මම` and English `I am` patterns. Overlap resolution has separate controlled synthetic unit coverage. This small hand-authored benchmark is not participant validation.

`preprocessing.span_evaluation.evaluate_detection(text, strategy)` is the common controlled evaluation interface. It returns entity types and half-open character offsets on the **original** input. Production wrappers discard these traces and retain their existing safe result shapes. Hybrid maps unmodified characters across variable-length Regex placeholders. Presidio resolves overlaps by confidence, length, offset and type, and masks the selected spans. Existing placeholders are protected. Regex retains its ordered pattern semantics, including known false masking; this milestone measures those limitations rather than tuning on held-out examples.

Exact typed spans determine TP/FP/FN. Masking coverage uses character unions, so overlapping gold annotations do not double-count characters. Missed gold PII means no characters in that gold span were masked; partial means some but not all. Unnecessary masking counts masked characters outside gold spans. Completely wrong detections have F1 zero. Undefined precision/recall use 1, with denominators reported; empty gold/predictions have F1 1. Legacy empty count evaluations have exact-match rate 1 but the existing evaluation gate rejects empty evaluations. Legacy placeholder metrics remain explicitly count-based. Summary fields now use `missing_placeholder_count`, replacing `residual_pii_count`; inspected callers were local unit tests. The legacy `maximum_residual_pii` threshold/check name is retained for compatibility and documented as checking missing placeholder counts, not verified residual PII. No shared contract changes or migrations are required.

Pipeline selection is explicit: `run_preprocessing_pipeline(records, strategy="regex")`, with `presidio` and `hybrid` also supported. Regex remains the default. All strategies use the existing data-quality and release-privacy gates. Outstanding review flags, residual structured identifiers, rejected quality records and empty releases block release. The service mock and shared C1 contracts remain intact; no research implementation is relabelled as a deployed service contribution.

The first measured run favored Presidio by exact-span F1 (0.8095 versus Regex 0.7111 and Hybrid 0.6863). Hybrid had fewer unmasked gold characters (36 versus 83 and 58) but more unnecessarily masked ordinary characters (87 versus 39 and 27). Presidio is the provisional candidate for further evaluation. Production selection remains pending because of language limitations, remaining misses and limited evidence. Read the regenerated report for current measured runtimes and all denominators. Authorized humans must review release and approve research thresholds; these results do not establish complete anonymity or zero re-identification risk.
