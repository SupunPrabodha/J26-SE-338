# C2 GLiNER and output-validation checkpoint

2026-10-25. Scoped from `170151c26ee13c2fcb9b3a1801204ca87b735a74` on
`feature/c2-anonymization-pipeline`. This is an experimental local demonstration,
not validated multilingual anonymization or permission to release a dataset.

## Active implementation and prerequisites

The custom demo executes `gliner-name-labels-v4-location-context-demo-v2`:
`urchade/gliner_multi-v2.1`, revision
`443d26d654e0324125a96bebd8e796c14ff2efe6`, weight SHA-256
`2100142f31627531497850659dcb3821c99d5e71c08a8e01a98e4b11ef32a199`.
Labels are `person name` and `location name`, threshold **0.7**, flat decoding,
four CPU threads, seed zero. Original-offset Unicode word splitting preserves
marks/joiners. Existing structured email, phone and student-ID recognizers have
priority; bounded contextual grammar supplements names/locations without unioning
English NER. Only non-overlapping sentence-context LOCATION predictions supplement
whole-text output. No name/place lists are used by these adapters.

The index includes only the reusable `combine`/metric and Unicode utilities from
mixed study modules (`generalization_v3`, `multilingual_evaluation`,
`multilingual_calibration`). Their excluded experiment runners and named fixture
pools remain locally in the working tree. Active function bodies are unchanged.
Matching utility tests are selected separately from rejected-study tests.
The English spaCy model remains necessary for existing contextual corroboration.
Pinned experimental requirements and the explicit Docker overlay are required;
weights, backbone and Linux environment remain ignored read-only local mounts.
See [deployment/model provenance](c2-gliner-demo-v4.md) for preparation commands.

Global Regex and baseline dependency defaults remain unchanged. Explicit Presidio
API requests remain available. Missing dependencies/models fail explicitly with
no fallback. C2-only transport deadlines are 300/310 seconds for cold loading.
All GLiNER runs retain `experimental_anonymizer_not_release_validated` blocking,
existing quality/privacy checks and required human approval.

Output validation reports actual policy/integrity outcomes, not accuracy. Missing
reference labels remain **NOT_MEASURED**. The complementary output auditor is
separate from the masking selector: supported structured residue/identifying
fields FAIL; unresolved contexts/type disagreements REVIEW. Both block release.
No signal does **not** establish absence of PII.

## Measured evidence and remaining failures

The historical **53-case** anonymization comparison is preserved in the existing
[anonymization milestone](c2-anonymization-milestone.md); it is not a score for
this new runtime. Collected-response totals are not evaluation counts.

- [v4 name-label comparison](c2-generalization-v4.md): 132 weighted development
  records, 110 unique texts; PERSON/LOCATION TP/FP/FN 85/9/15, F1 .8763.
  This synthetic evidence is not independent validation; retention criteria failed.
- [v5 LOCATION pilot](c2-paragraph-context-v5.md): 34 development cases, typed
  PERSON/LOCATION F1 .7397 → .8052; separate then-frozen 16-case evaluation
  .6875 → .8000. These inspected cases are now development evidence. Two supplied
  paragraphs were tested, not four. Romanized relationship names can remain
  exposed without a residual signal.
- [v6 audit](c2-location-correction-audit-v6.md): 48 frozen cases including two
  separately reported reused controls; primary 46 new texts have 64 gold spans.
  TP/FP/FN 36/14/28 → 37/16/27; F1 .6316 → .6325. One new correct LOCATION,
  two new false LOCATION spans (suffix boundary and a PERSON typed LOCATION),
  zero lost exact-correct spans. Unnecessary characters 55 → 57. All 16 Romanized
  references remained exposed. This fails no-new-false-spans/no-extra-masking
  criteria; the checkpoint preserves the explicitly experimental configuration,
  not a claim that those accuracy criteria pass. Structured PII was not newly
  measured in v6. References are AI-proposed synthetic labels, not independent
  human/expert gold. Casing families are not independent samples.
- [residual-output evaluation](c2-residual-output-v1.md) reports its misses and
  false alarms separately; REVIEW is not correct entity detection.
- [output validation](c2-output-validation-v1.md) preserves original diagnostic,
  reference-evaluator and browser/download evidence. Existing Next.js security
  advisory and model-tokenizer warnings remain unresolved.

## Selected-snapshot verification

Verified in detached `.local/c2-checkpoint-snapshot`, based on `170151c`, with
only the selected patch applied. Excluded study modules/fixtures/runners were
unavailable there. Existing locked dependencies were reused; no dependency upgrade
or fresh model download. The seven partially selected utility/test files preserve
their full excluded working-tree content locally. AST checks confirm every
selected utility function/class is identical to its working-tree implementation.

| Check on selected snapshot | Actual outcome |
|---|---|
| Full Python suite | **864 passed, 22 existing xfailed**, one Starlette/httpx deprecation warning, 128.92 s |
| Frontend tests | **93 passed**, eight files |
| Frontend lint / typecheck | Passed |
| Python/JSON Schema/OpenAPI and TypeScript drift | Passed |
| Historical/optional-response and unrelated-contract compatibility | Passed in full Python suite |
| Scoped C2 Ruff / format | Passed; 80 Python files formatted |
| Repository privacy / CI structure | Passed; hosted Actions not yet observed |
| Selected platform / GLiNER / counsellor-dashboard Docker builds | Passed under separate test tags; existing services/volumes not recreated |
| Actual selected Python → selected Docker → live authenticated dashboard proxy | **5/5 complete responses identical** on each execution path, including both reported paragraphs and combined structured identifiers |
| Missing model in isolated Docker child | Safe **503**, no result/fallback |
| Live C2 Docker smoke | **60 scenario executions** plus ten explicit-Presidio custom checks; authorization, safe validation, logout and text/secret-free logs passed |
| Unauthorized / invalid custom request | **401 / 422**, no input echo, successful responses `no-store` |
| Staged whitespace | `git diff --cached --check` passed |

All five experimental parity cases blocked release, with accuracy NOT_MEASURED.
These executions verify configuration/parity, **not a new accuracy benchmark**.
The selected Docker first cold inference took **176.21 s**, warm cases
0.62–3.09 s; Python first case including loading 25.93 s, warm 0.68–2.97 s.
No new memory benchmark was performed. Offline tokenizer byte-fallback,
regex-pattern and missing-max-length warnings remain visible.

The existing desktop/mobile browser, download and Reset/edit stale-response
verification documented in v5/output-validation is reused: selected frontend
implementation bytes match the verified working files. No new visual inspection
is claimed for this checkpoint. New authenticated requests went through the real
dashboard route, gateway and live model, not just an HTTP health response.

The first isolated Python run had **1 failed / 863 passed / 22 xfailed**:
`test_loader_disabled_without_explicit_switch` read private environment-dependent
settings. Its fixture now supplies a disposable development settings object; the
corrected full run above passed without a private `.env`. An initial parity
helper selected historical v1 response metadata and correctly failed; selecting
the already-saved matching v2 evidence resolved that helper error without changing
runtime output or expected labels. The staged whitespace check also found and
removed one trailing blank line in the new output-validation document.

Repository-wide Ruff remains **FAILED with 63 unchanged C3 findings**:
I001 10, F401 10, E402 17, UP015 1, UP035 6, UP006 15, UP045 2, F541 2.
All are under `research/c3-model-experiments`; no C3 source or CI rule is changed.
This may keep hosted CI red. It is not described as a passing repository-wide lint
check. Existing Next.js advisory remains unresolved; no new security audit or
dependency-remediation claim is made.

Commands run from the isolated snapshot (Windows interpreter/dependencies reused
from the original checkout):

```powershell
D:\J26-SE-338\.venv\Scripts\python.exe -m pytest -p no:cacheprovider --basetemp=D:/J26-SE-338/.local/c2-checkpoint-pytest-final --junitxml=D:/J26-SE-338/.local/c2-checkpoint-selection/pytest-final.xml --maxfail=3
npm test
npm run lint
npm run typecheck
D:\J26-SE-338\.venv\Scripts\python.exe scripts/run.py scripts.generate_contracts --check
npm run contracts:check
D:\J26-SE-338\.venv\Scripts\python.exe -X utf8 scripts/check_repository.py
D:\J26-SE-338\.venv\Scripts\python.exe scripts/check_ci.py
D:\J26-SE-338\.venv\Scripts\python.exe -m ruff check .
D:\J26-SE-338\.venv\Scripts\python.exe -m ruff check services/preprocessing services/orchestrator/demo.py packages/contracts/src tests/unit/test_c2* tests/integration/test_c2_demo.py scripts/c2_prepare_gliner_docker.py scripts/c2_prepare_gliner_environment.py scripts/c2_residual_evaluate.py scripts/c2_validate_outputs.py
D:\J26-SE-338\.venv\Scripts\python.exe -m ruff format --check services/preprocessing services/orchestrator/demo.py packages/contracts/src tests/unit/test_c2* tests/integration/test_c2_demo.py scripts/c2_prepare_gliner_docker.py scripts/c2_prepare_gliner_environment.py scripts/c2_residual_evaluate.py scripts/c2_validate_outputs.py
docker build -t j26-c2-checkpoint-platform:20261025 -f infrastructure/docker/python.Dockerfile .
docker build -t j26-c2-checkpoint-dashboard:20261025 --build-arg APP=counsellor-dashboard -f infrastructure/docker/frontend.Dockerfile .
```

The thin test GLiNER image uses the selected platform tag as its FROM, with the
same checked-in overlay environment; model/dependency mounts are read-only.
Ignored disposable verification harnesses (no participant inputs):

```powershell
.local\c2-gliner-cpu-env\Scripts\python.exe -X utf8 .local/c2-checkpoint-inference.py
.venv\Scripts\python.exe -X utf8 .local/c2-checkpoint-docker-inference.py
.venv\Scripts\python.exe -X utf8 .local/c2-checkpoint-api.py
.venv\Scripts\python.exe -X utf8 scripts/c2_demo_smoke.py
```

The C2 smoke client's timeout alone was aligned with the existing 310-second
experimental proxy budget. Shared service timeouts/policies are unchanged.
Supporting results/hashes remain ignored in `.local/c2-checkpoint-selection`.
Historical offline-study links/commands refer to retained local investigation
material; those rejected-study runners are intentionally outside this checkpoint.

## Scope exclusions

Rejected model/calibration/training experiments and annotation packs, `.local`
helpers, generated reports/artifacts, model weights/caches, the 1,000-submission
cohort, participant material, credentials/environment files and unrelated changes
are excluded. Existing committed annotation/authentication/consent/review and
C3/C4 implementation are preserved. Earlier documentation consolidation and local
test deletions/annotation-dependent additions are not part of this checkpoint.

Local demo: **http://localhost:3001/c2-demo**, development configuration and
existing authorized counsellor session required. No annotation agreement,
adjudication, expert approval or released dataset is asserted.
