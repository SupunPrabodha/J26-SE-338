# C2 anonymization milestone verification

Verified locally on 2026-10-11 on `feature/c2-anonymization-pipeline`. No commit, push, merge or branch change was performed. The pre-existing `pyproject.toml`, `uv.lock` and `requirements.lock` edits were preserved; the fixed Presidio archive source and hashed export were not changed. No academic documents, participant data, datasets, model weights or fixture text artifacts were introduced. Shared contracts, service mocks, migrations and unrelated components were preserved.

Implementation changes:

- `services/preprocessing/anonymization.py`: mask through the common original-offset trace, preserving safe output shape and ordered rules while protecting existing placeholders.
- `services/preprocessing/presidio_anonymization.py`: explicit missing-model failure, deterministic overlap resolution and shared mask rendering; offline bundled suffix validation retains email rules without runtime fetches.
- `services/preprocessing/anonymization_comparison.py`: clarify legacy count scope and denominator policy; point to measured span evaluation.
- `services/preprocessing/anonymization_evaluation.py` and `evaluation_gate.py`: fix zero/zero F1; replace the misleading residual-PII summary field with `missing_placeholder_count`; document retained legacy threshold semantics.
- `services/preprocessing/span_evaluation.py`: common typed original spans and exact/coverage metrics, including Hybrid offset mapping, repetition and overlap handling.
- `services/preprocessing/synthetic_benchmark.py`: in-memory development/held-out generator, four languages, PII and wellbeing negatives, related variants kept together.
- `services/preprocessing/benchmark_report.py`: actual aggregate comparison/report generation, isolated cold starts, production warm timing, versions and source/benchmark fingerprints.
- `services/preprocessing/pipeline.py`: explicit strategy selection with Regex default; every candidate goes through existing quality and privacy gates.
- `tests/unit/test_c2_span_evaluation.py`: regression and integration cases for F1, empty inputs, coverage, overlap, repeated values/placeholders, Hybrid offsets, missing model, offline domain validation and release blocking for every strategy.
- `tests/unit/test_c2_anonymization_evaluation.py` and `test_c2_evaluation_gate.py`: summary-field callers updated.
- `research/c2-dataset-pipeline/anonymization-comparison.md`: reproduction, scope, methodology, compatibility and selection documentation.
- This verification note.

Commands and observed outcomes (repository root, locked local environment):

| Exact command | Result |
|---|---|
| `.\.venv\Scripts\python.exe scripts/run.py preprocessing.benchmark_report --output artifacts/c2-anonymization --repetitions 20` | PASS: actual aggregate JSON and supervisor Markdown generated for all three candidates; 53 held-out cases, 45 gold entities, 1,060 warmed calls per candidate |
| `.\.venv\Scripts\python.exe scripts/run.py pytest tests/unit -k c2 --tb=short` | PASS: 108 passed, 15 deselected at the checkpoint before the final offline-email regression; final full suite covers that added case |
| `.\.venv\Scripts\python.exe scripts/run.py pytest --tb=short` | PASS: 174 passed; one existing Starlette TestClient/httpx deprecation warning |
| `.\.venv\Scripts\python.exe -m ruff check .` | PASS |
| `.\.venv\Scripts\python.exe -m ruff format --check .` | PASS |
| `.\.venv\Scripts\python.exe scripts/run.py scripts.generate_contracts --check` | PASS: schema/OpenAPI drift absent |
| `npm run contracts:check` | PASS: TypeScript contract drift absent |
| `.\.venv\Scripts\python.exe scripts/check_repository.py` | PASS: candidate-file/privacy/configuration checks |
| `.\.venv\Scripts\python.exe scripts/check_ci.py` | PASS: CI structure and pinned actions; hosted CI not executed |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS: both frontends |
| `npm test` | PASS: 5 tests |
| `git diff --check` | PASS |
| `docker info --format '{{.ServerVersion}}'` | PASS: engine 29.8.0 after approved sandbox retry |
| `docker compose ps --format json` | Initially empty: stack was not running |
| `docker compose up --build --wait` | PASS: local builds and all nine services healthy; stack remains running |
| `.\.venv\Scripts\python.exe scripts/compose_smoke.py` | PASS: health/readiness, PostgreSQL, Redis, worker, full mock workflow, idempotency, assignment, human action, withdrawal/retention, logout, frontends and log privacy |

The additional C2 Docker smoke command uses stdin to preserve Python string quoting on Windows:

```powershell
@'
from preprocessing.pipeline import PipelineInput, run_preprocessing_pipeline
from preprocessing.span_evaluation import evaluate_detection, render
from preprocessing.hybrid_anonymization import anonymize_with_hybrid
from preprocessing.presidio_anonymization import _OfflineEmailRecognizer
text = 'Email synthetic.long.fixture@example.com. Alice studies in Colombo.'
assert render(text, evaluate_detection(text, 'hybrid')) == anonymize_with_hybrid(text).anonymized_text
assert _OfflineEmailRecognizer().extract.suffix_list_urls == ()
for strategy in ('regex', 'presidio', 'hybrid'):
    good = run_preprocessing_pipeline([PipelineInput('synthetic', 'Contact fixture@example.com.')], strategy=strategy)
    blocked = run_preprocessing_pipeline([PipelineInput('synthetic', 'Unresolved marker @.')], strategy=strategy)
    assert good.release_ready
    assert not blocked.release_ready and 'privacy_review_required' in blocked.blocking_reasons
print('C2 Docker strategies, original offsets, offline domain validation and privacy gates: PASS')
'@ | docker compose exec -T preprocessing python -
```

Initial verification failures were corrected or rerun honestly: PowerShell did not expand a pytest filename wildcard (replaced with `-k c2`); one existing gate-summary assertion used the renamed field (updated); the sandbox blocked pytest temp/cache access and Vitest process spawning (approved retries passed); the first Docker smoke had no running orchestrator (stack started); the first one-line C2 Docker command lost quotes (stdin command above used). Restricted Docker networking exposed suffix refresh fallback warnings; explicit offline validation now avoids those requests without relaxing email validation or gates.

Measured recommendation: Presidio is the provisional further-evaluation candidate with exact-span F1 0.8095, compared with Regex 0.7111 and Hybrid 0.6863. Hybrid masks more gold characters but also more ordinary text. Production selection remains pending; Regex remains default. The small synthetic benchmark, remaining missed entities and English-only model do not justify deployment claims, complete anonymity or zero re-identification risk. Human review and approved research thresholds remain necessary. No implementation/check blocker remains after the successful local checks; hosted CI and independent research validation were not performed.

Reports are ignored local artifacts: `artifacts/c2-anonymization/results.json` and `artifacts/c2-anonymization/comparison.md`. Read the generated report for runtime measurements, language/entity/family denominators, versions, benchmark identifier and working-source fingerprints.
