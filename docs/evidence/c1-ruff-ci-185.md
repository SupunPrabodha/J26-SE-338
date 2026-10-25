# Ruff CI failure: 185 findings — 2026-10-25

This is a new verification run, separate from the historical results in
[completed-review and CI evidence](c1-completed-reviews-ci.md).
The reported workflow revision is `e0174836c4637f3d7b87972bd0e5c099cef197c8`.
The inspected local branch was `feature/c1-consent-orchestration`, HEAD
`033c71c`, with a clean working tree before this increment. No branch change,
staging, commit, push, reset or merge was performed.

## Cause and scope

The pinned Ruff **0.16.10** on **Python 3.12.12** reproduced **185 errors**, with
**152 initially safely fixable**, in ten C3 Python sources and the newly merged
DAPT Colab notebook. This is distinct from the earlier 63-finding repair.
The initial codes/counts were I001:12, F401:17, UP015:27, E741:5, UP035:23,
UP006:65, F541:15, B006:1, B033:13, F841:2, UP045:3, B905:1 and F811:1.
Format checking also failed on 11 files, including Python fenced examples in
`research/c3-model-experiments/model-exp-docs/chat_history.md`.

The failing lint command explains why Bash did not reach the remaining commands
in that step. The unconditional container cleanup is not evidence of a Docker
failure. The workflow and lint rules have not been weakened or changed.

## Fixes and research preservation

`ruff check . --fix` applied only safe fixes. Cascading fixes resolved **175**
findings and left ten for manual review; no `--unsafe-fixes` was used.
Changes include imports/annotations, redundant read modes, constant f-strings,
duplicate set members and formatter output. Formatting is extensive where the
incoming file contained long literal collections; values and split logic remain.

Manual changes:

- Rename ambiguous `l` comprehension variables to `line` in the notebook and
  `split_corpus.py`.
- Replace the mutable `run_collection` default list with `None` and create the
  same default locally. An explicitly supplied empty list still stays empty.
- Preserve the unused validation-size calculation under `_n_val`.
- Make `zip(..., strict=False)` explicit, preserving its previous behavior.
- Keep `trainer.train()` execution while dropping its unused return binding.
- Remove the empty `extract_comments_from_url` stub immediately overwritten by
  the existing implemented function; keep that implementation and return shape.

No C1 runtime, auth, consent, contracts, migration, dependency manifest or workflow
file changed. No training, scraping, model or dataset download was executed.
Recorded metrics, figures, model settings and research results were not edited.
Notebook outputs, execution counts, metadata, cell count and shell training
commands were checked against before-edit copies and preserved.

An AST comparison of all ten Python files matched computations after explicitly
normalizing imports, annotations and the reviewed transformations above. Changed
notebook code cells also matched under those normalizations. This is a bounded
review aid, not proof of model quality or a new research evaluation.

The Markdown changes format only Python fenced examples, plus the first newline
used by Ruff's newline detection. Reference prose and quoted material were not
rewritten. Existing line endings outside the changed examples were preserved to
avoid introducing unrelated whitespace errors. No exclusion or noqa was added.

New `tests/unit/test_c3_lint_regressions.py` has three default/explicit-selection
collector cases and a deterministic synthetic split case checking 19/1 partition
counts, disjointness, conservation, word totals and repeatability. Collection is
stubbed, and the split uses only disposable synthetic fixtures in pytest temp.
Optional ML libraries and training are not required by these checks.

## Commands and actual results

The existing isolated locked CI environment was reused, preserving the shared
research `.venv` and its optional packages. No dependency synchronization or
package changes were necessary.

```powershell
$taskPython = (Resolve-Path '.local/c1-ci-review-c9d15160c74a452fa345c7536a247cd8/ci-python/Scripts/python.exe').Path
& $taskPython --version
& $taskPython -m ruff --version
& $taskPython -m ruff check . --output-format json --output-file .local/c1-ruff-current.json
& $taskPython -m ruff check . --fix --output-format concise
& $taskPython -m ruff format . --quiet
# Manual changes described above, then:
& $taskPython -m ruff check .
& $taskPython -m ruff format --check . --output-format concise
& $taskPython scripts/run.py pytest tests/unit/test_c3_lint_regressions.py --basetemp=.local/pytest-ruff-focused-20261025-b
& $taskPython scripts/run.py pytest --basetemp=.local/pytest-ruff-full-20261025-c
& $taskPython scripts/run.py scripts.generate_contracts --check
& $taskPython scripts/check_repository.py
& $taskPython scripts/check_ci.py
docker compose config --quiet
docker compose exec -T orchestrator alembic current
docker compose exec -T orchestrator alembic check
& $taskPython scripts/compose_smoke.py
git diff --check
git diff --cached --name-only
git status --short --branch
```

| Check | Actual result |
| --- | --- |
| Ruff lint | Zero findings; all checks passed. |
| Ruff formatting | **175 files already formatted**, including this added evidence note. |
| Focused synthetic regressions | **4 passed, 0.12 s.** |
| Complete backend suite, including migration/security/contracts/integration tests | **249 passed, 121.69 s.** One upstream Starlette/httpx deprecation warning; no failed or skipped tests. |
| Contract generation/drift | Contract artifacts verified. |
| Candidate-file/privacy scan | Passed. |
| CI structure check | Passed; this does not execute hosted Actions. |
| Compose config and service health | Config valid; all nine existing containers healthy. |
| Current database schema | Head `f310c1000004`; no new upgrade operations detected. |
| Existing real-container synthetic smoke | PASS: service health, PostgreSQL/Redis/worker, mock C1–C4 workflow, concurrent idempotency, assignment, protected review save/read/replay, disposal, withdrawal/retention, logout, frontend proxies and log privacy. |
| Whitespace/staging | `git diff --check` passes; staging empty. |

Before-edit copies, the 185-finding JSON and semantic/notebook review summaries
are retained in ignored `.local/ruff-ci-56eee7a72aa94717b210255cf58c9294/`.
Temporary directories are fresh; existing temp folders and permissions were not
changed. Database volumes and original records were preserved. The smoke adds
only its normal synthetic development fixtures; containers were not reset.

## Limits and handoff

This run verifies the previously failing Python block and the existing container
integration, not a hosted GitHub Actions run. Windows executed the exact pinned
Python/Ruff versions; the Ubuntu runner itself was not reproduced. The production
images were reused because changed C3 offline files are not copied into the
platform Docker image and no platform runtime/build inputs changed. Frontend
builds/tests and dependency audits were not rerun in this Python-only increment;
their earlier evidence remains historical. Real C2–C4 integration, research
evaluation and institutional/deployment approval are not established here.

Suggested review commit message: `fix(ci): resolve merged C3 Ruff lint and format failures`.
Changes remain uncommitted for review.
