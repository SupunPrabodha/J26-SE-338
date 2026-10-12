# C2 recorded-results PDF export

The exporter reads the existing aggregate JSON and does not execute the benchmark. Convert from the repository root:

```powershell
.\.venv\Scripts\python.exe scripts/run.py preprocessing.benchmark_report --pdf-from-results artifacts/c2-anonymization/results.json --output artifacts/c2-anonymization
```

Output: `artifacts/c2-anonymization/comparison.pdf`. The existing JSON and Markdown are preserved. Future normal measurement runs automatically export PDF alongside their new JSON/Markdown; no measurement run was performed for this PDF task.

The PDF includes overall, language, entity and template-family comparisons, masking errors and character denominators, cold/warm runtime, rationale, limitations, original measurement reproduction command, benchmark identifier, code/diff/source/requirements fingerprints and original model/dependency/environment versions. Numbers are not rounded during conversion. The original JSON bytes are embedded as `results.json`; the printed input SHA256 is `37fddf1aebcf9929e8503adf477e9e4c7bbcf1f65bede611e8d8bd40fc1a5a90`. Historical measurement hashes remain historical: adding exporter dependencies must not replace them with today's hashes.

Presidio is the provisional recommendation for further evaluation. Production selection remains pending; Regex remains the current default. No complete-anonymity or zero-risk claim is made. This PDF contains only aggregate synthetic evaluation evidence, with no fixture text or detected values.

Implementation:

- `services/preprocessing/pdf_report.py`: current aggregate-schema allowlist and validation, ReportLab landscape A4 tables with repeated headers, page numbering and safe text escaping; pypdf embeds original JSON bytes.
- `services/preprocessing/benchmark_report.py`: conversion-only CLI path before any measurement and automatic PDF generation after normal reporting.
- `tests/unit/test_c2_pdf_report.py`: six tests covering no benchmark invocation, source JSON/Markdown preservation, exact numeric/provenance content and attachment, page margins/numbers, rejection of fixture fields/nonfinite scores/missing candidates, and source overwrite protection.
- `pyproject.toml`, `uv.lock`, `requirements.lock`: pinned `reportlab==5.0.1`, `pypdf==6.20.0`, development `pymupdf==1.28.2`, and regenerated hashed export. The existing Presidio security archive URL, commit and subdirectory remain unchanged. Other locked package versions were preserved.
- `research/c2-dataset-pipeline/anonymization-comparison.md`: documented conversion command and provenance rules.

Dependency commands completed successfully (uv was located in the existing environment, not on PATH):

```powershell
.\.venv\Scripts\uv.exe add reportlab==5.0.1 pypdf==6.20.0
.\.venv\Scripts\uv.exe add --dev pymupdf==1.28.2
.\.venv\Scripts\uv.exe export --frozen --format requirements-txt --output-file requirements.lock --quiet
```

Verification outcomes:

| Command / check | Observed result |
|---|---|
| Conversion command above | PASS: seven-page PDF generated from existing results |
| `.\.venv\Scripts\python.exe scripts/run.py pytest tests/unit/test_c2_pdf_report.py --tb=short` | PASS: 6 tests after approved temp-directory retry |
| `.\.venv\Scripts\python.exe scripts/run.py pytest --tb=short` | PASS: 180 tests, one existing Starlette TestClient/httpx deprecation warning |
| `.\.venv\Scripts\python.exe -m ruff check .` | PASS |
| `.\.venv\Scripts\python.exe -m ruff format --check .` | PASS |
| `.\.venv\Scripts\python.exe scripts/check_repository.py` | PASS |
| `.\.venv\Scripts\python.exe scripts/check_ci.py` | PASS: hosted CI not run |
| `.\.venv\Scripts\python.exe scripts/run.py scripts.generate_contracts --check` | PASS: JSON Schema/OpenAPI drift absent |
| `npm run contracts:check` | PASS: TypeScript drift absent |
| `git diff --check` | PASS |
| `.\.venv\Scripts\uv.exe lock --check` | PASS: 105 packages resolved; lock consistent |
| `docker compose up --build --wait` | PASS: hash-enforced Python installation, fixed Presidio archive wheel build and all nine services healthy |
| `.\.venv\Scripts\python.exe scripts/compose_smoke.py` | PASS: full repository workflow, storage, gates, retention, frontends and container-log privacy |
| `docker compose cp artifacts/c2-anonymization/results.json preprocessing:/tmp/c2-results.json` | PASS: existing aggregate evidence copied locally |
| `docker compose exec -T preprocessing python -m preprocessing.benchmark_report --pdf-from-results /tmp/c2-results.json --output /tmp/c2-pdf` | PASS: container-side conversion without measurement |
| Container PDF inspection | PASS: seven pages, byte-identical JSON attachment and original Windows measurement provenance retained on Linux |
| PyMuPDF rendering and text-boundary assertions | PASS: all seven final pages rendered at 108 DPI; all text inside margins; page numbers correct |
| Visual page inspection | PASS: every final page inspected; no clipping, broken rows or missing repeated headers; narrow header refined before final export |
| `PdfReader(pdf).attachments['results.json'][0] == source.read_bytes()` | PASS: exact original JSON attachment |

PDF and rendered page previews (`artifacts/c2-anonymization/page-01.png` through `page-07.png`) remain ignored local artifacts. The first sandboxed focused pytest attempt had four passes and two temporary-directory permission errors; the approved retry passed all six. uv cache access also required an approved retry. No failures were hidden or thresholds relaxed. Frontend lint/typecheck/tests were not rerun for this PDF-only change; hosted CI was not run. No commit, push or branch change was performed.

The local Docker stack remains running. No local exporter or verification blocker remains.

## Plain-English selection report (2026-10-12)

Added `preprocessing.selection_pdf` and the `--selection-summary` conversion option. The new file is `artifacts/c2-anonymization/selection-report/comparison.pdf`: three main pages explaining the tools, benchmark, percentage precision/recall/F1, choice rationale, masking tradeoffs, language/entity evidence and limitations; one supporting runtime/provenance page. The existing detailed PDF was preserved after an attempted overwrite was denied. No benchmark was rerun. The recorded JSON checksum remains `37fddf1aebcf9929e8503adf477e9e4c7bbcf1f65bede611e8d8bd40fc1a5a90`, and its exact bytes are embedded in the new PDF. Rounding to two decimal places affects presentation only; F1 is not labelled as general accuracy or anonymity.

```powershell
.\.venv\Scripts\python.exe scripts/run.py preprocessing.benchmark_report --pdf-from-results artifacts/c2-anonymization/results.json --selection-summary --output artifacts/c2-anonymization/selection-report
```

Observed checks: seven PDF regression tests passed, including a new no-measurement percentage-report case. Ruff lint/format, repository checks and `git diff --check` passed. All four final pages were rendered and visually inspected; pagination and exact JSON attachment were verified. The first layout had a single-line spill onto a fifth page; the text was shortened, regenerated and inspected again. No new dependencies or contract changes were required. Full Python, frontend and Docker suites were not rerun for this report-presentation-only update. No commits or branch changes were made.
