# C2 experimental GLiNER v4 demo — deployment verification

2026-10-24. Branch `feature/c2-anonymization-pipeline`, HEAD
`170151c26ee13c2fcb9b3a1801204ca87b735a74`; changes uncommitted.
The user explicitly authorized an **experimental demo option**, despite the
documented v4 retention/accuracy failures. This does not reverse historical
rejection decisions or qualify the model for dataset release.

**Current runtime update:** the separately evaluated LOCATION-only sentence
supplement is now `gliner-name-labels-v4-location-context-demo-v2`; see
[paragraph-context v5 evidence](c2-paragraph-context-v5.md) for its frozen
development/evaluation comparison and 34 actual Python/Docker/browser checks.
The sections below retain the original v1 integration measurements and
deployment history. PERSON misses and release restrictions remain; this update
does not replace earlier scores with new results or imply complete anonymization.

## Implemented configuration

- Demo strategy `gliner`, configuration
  `gliner-name-labels-v4-context-demo-v1` in response metadata and transformations.
  After successful real Docker inference, GLiNER became the C2 custom-demo
  default and the page selector was removed. Explicit Presidio API requests remain
  supported. Scenario/generic pipeline Regex defaults are unchanged.
- Model `urchade/gliner_multi-v2.1`, immutable revision
  `443d26d654e0324125a96bebd8e796c14ff2efe6`, weights SHA-256
  `2100142f31627531497850659dcb3821c99d5e71c08a8e01a98e4b11ef32a199`.
- Evaluated v4 prompts `person name`/`location name`, threshold **0.7**,
  UnicodeWordSplitter, seed 0, four CPU threads, flat decoding.
- Existing structured email/phone/student-ID recognizers retain priority.
  Existing placeholders remain protected. Name/location output replaces English
  NER, not a union. The same bounded contextual overlap function used in v4 is
  reused; its English POS/locative corroboration dependency is retained. No new
  grammar, word/name/place list or expected-output substitution.
- Original code-point offsets and Unicode boundaries are checked before masking;
  unsafe boundaries/overlaps fail closed. Per-process loading/inference serialized,
  model cached, no text/prediction cache or hosted inference.
- GLiNER 0.2.24, torch 2.6.0+cpu, transformers 4.57.3, tokenizers 0.22.1,
  huggingface-hub 0.36.0, numpy 2.2.6; experimental packages isolated from the
  unchanged baseline dependency lock. Linux installation and `pip check` passed.
- Explicit `C2_GLINER_DEMO_ENABLED=true` and development configuration required.
  Generic preprocessing cannot select this strategy without its demo-boundary flag.
  Browser/internal routes retain existing counsellor/session/service authentication.
- Unavailable/loading/inference errors return a safe non-success response with no
  records, model paths or detected values; never fallback. C2-only GLiNER gateway
  cold-load timeout is 300 s; shared/baseline service timeout remains unchanged.
  The C2-only Next route uses a 310 s transport deadline, preserving cookies,
  Origin and browser headers for the existing gateway authorization. It avoids
  Next's observed 30 s rewrite timeout without changing other routes/authentication.
- Residual auditing, structural quality and privacy/release gates remain active.
  All experimental executions additionally block automated release with
  `experimental_anonymizer_not_release_validated`, even if supported checks pass.
  Human approval and remaining annotation/adjudication/release stages are not
  fabricated. Accuracy for unlabelled page inputs remains NOT_MEASURED.

Shared contracts add the demo-only `gliner` enum alternative and optional
`anonymization_configuration` metadata; custom strategy defaults to GLiNER.
JSON Schema/OpenAPI/TypeScript generated together. No C1 authentication,
participant/consent/review logic or C3/C4 research changes.

## Completed verification

### Resumed checkpoint checks

- Actual Docker pipeline: **16/16 complete responses match prior real Python
  responses**, including exact anonymized text, transformations, quality,
  residual/privacy gates, Language ID, normalized text and token offsets.
  All 16 block release. Aggregate:
  `artifacts/c2-evidence/anonymization/gliner-demo-v4/docker-runtime.json`.
- Installed Linux versions: GLiNER 0.2.24, torch 2.6.0+cpu, transformers
  4.57.3, tokenizers 0.22.1, numpy 2.2.6, spaCy 3.8.16, en_core_web_sm 3.8.0.
- Affected Python: **179 passed, 1 existing expected failure**, one existing
  Starlette/httpx deprecation warning. Separate GLiNER-only timeout regression:
  **1 passed**. Baseline language/privacy tests now explicitly request Presidio;
  the new default is independently tested rather than silently loading a model
  in baseline unit tests.
- Frontend demo/validation: **56 passed**; new C2 proxy: **2 passed**.
  First run had one obsolete Presidio-label assertion, corrected for the
  authorized UI change. The proxy test initially used `.test.ts`, which this
  repository does not collect; renamed `.test.tsx` and actually executed.
- Frontend lint/typecheck, schema/TypeScript drift, scoped Ruff/format,
  repository privacy, CI structure and `git diff --check` passed.
- Only preprocessing, orchestrator and counsellor-dashboard rebuilt/recreated.
  No databases, accounts, volumes or unrelated containers deleted or recreated.
- **Actual Edge browser PASS**: 16 GLiNER page runs match full real Python
  responses; eight explicit Presidio API runs match baseline responses. No
  dropdown remains. All experimental runs block release; accuracy remains
  NOT_MEASURED for unlabelled input. Model/configuration and residual-rule
  provenance are present. Actual successful responses held at the client for
  testing cannot restore results after Reset or editing.
- Browser captures inspected at desktop 1366 px and mobile 390 px, scale/zoom
  1.0, with no horizontal overflow. Six synthetic screenshots and the browser
  report are local only:
  `.local/c2-demo-browser-3137601b-ac95-4e05-8a69-01e3f284a07a/`.
  No passwords or populated login fields appear in captures.
- Authenticated API with **strategy omitted** executes GLiNER, matching the
  Python response exactly (warm request **0.39 s**). Unauthenticated custom run
  returns 401; unexpected fields return 422 without echoing the input sentinel.
- Missing-model probe in a disposable container child process returns safe
  **503**, no records and no fallback. It does not change the running service's
  model path/cache. Earlier authenticated unavailable-model route tests retain
  safe gateway 502 behavior.
- The actual browser cold request completed successfully: preprocessing
  **171174.96 ms**, gateway **171237.39 ms**, correlation
  `9006cc2f-4df8-4f25-8da5-42e5cf890f9c`. This justifies the C2-only 300/310 s
  budgets. First request after service recreation can take almost three minutes
  on this bind-mounted Windows setup; no intermediate success is simulated.

Commands for the resumed checks:

```powershell
.venv\Scripts\python.exe -m pytest tests/unit/test_c2_gliner_demo.py tests/unit/test_c2_language_id.py tests/unit/test_c2_residual_privacy.py tests/integration/test_c2_demo.py -p no:cacheprovider --basetemp=.local/c2-gliner-default-20261024-a --maxfail=3
.venv\Scripts\python.exe -m pytest tests/integration/test_c2_demo.py::test_cold_load_budget_is_scoped_to_gliner -p no:cacheprovider --basetemp=.local/c2-gliner-timeout-20261024-a
npm test -- tests/frontend/c2-demo.test.tsx tests/frontend/c2-validation.test.tsx
npm test -- tests/frontend/c2-proxy.test.tsx
.venv\Scripts\python.exe -X utf8 .local/c2-gliner-docker-parity.py
node .local/c2-gliner-browser.mjs
.venv\Scripts\python.exe .local/c2-gliner-api-probe.py
.venv\Scripts\python.exe .local/c2-gliner-final-probes.py
```

The `.local` commands are disposable synthetic implementation-verification
harnesses, not committed release tooling or an independent accuracy benchmark.
The earlier full Python result below is reused; the full suite was not repeated
solely for this deployment/default increment. Affected suites and the new proxy
and budget checks were executed on the final changed paths.

### Earlier implementation verification (retained, not rerun in full)

- **16 actual local Python executions**, using the existing isolated GLiNER
  environment and actual new adapter/pipeline. All 12 sampled cases with recorded
  v4 outputs matched exactly, including lower/title/upper variants, Sinhala,
  Romanized and mixed text, places, negatives and structured identifiers.
  Four additional protected/combined synthetic cases executed. All experimental
  results blocked release. No completed full model comparison was restarted.
- Evidence: ignored
  `artifacts/c2-evidence/anonymization/gliner-demo-v4/python-runtime.json`:
  case IDs, output hashes, timings, transformations and gates without text/values.
  Disposable expected responses remain only in ignored `.local` browser fixtures.
- Full Python: **1052 passed, 24 existing expected failures**, one existing
  Starlette/httpx warning, 160.98 s. New tests cover demo-only restriction, actual
  span rendering, unsafe boundaries, safe load failure/no fallback and authorized
  route error handling. Compatibility tests retain exact unrelated contracts and
  explicitly allow only the authorized C2 enum/optional-field extensions.
- Focused frontend: **56 passed**. Selector sends the chosen strategy, reports
  executed configuration, clears completed results on change and never sends a
  fallback request on GLiNER failure. Existing session/reset/late-response tests
  remain in the affected suite. A wording-case assertion was corrected; no
  detector expectations were weakened.
- Frontend lint/typecheck, scoped Ruff/formatting, schema/TypeScript drift,
  repository privacy and CI structure checks passed. Hosted CI not run.
- Base platform/orchestrator and dashboard Docker images built successfully after
  Docker recovery. **GLiNER Docker inference and new browser execution are not
  yet verified.** Do not describe the new strategy as live until the below
  storage blocker is cleared and verification finishes.

Commands already completed:

```powershell
.local\c2-gliner-cpu-env\Scripts\python.exe -X utf8 .local/c2-gliner-runtime-python.py
.venv\Scripts\python.exe -m pytest -p no:cacheprovider --basetemp=.local/c2-gliner-full-20261024-a --junitxml=artifacts/c2-gliner-full.xml --maxfail=2
npm test -- tests/frontend/c2-demo.test.tsx tests/frontend/c2-validation.test.tsx
npm run lint
npm run typecheck
.venv\Scripts\python.exe scripts/run.py scripts.generate_contracts --check
npm run contracts:check
.venv\Scripts\python.exe -X utf8 scripts/check_repository.py
.venv\Scripts\python.exe -X utf8 scripts/check_ci.py
git diff --check
```

## Packaging and deployment history

### Resumed deployment diagnosis (2026-10-24)

Docker is responsive again, all existing services are healthy and C: has
approximately 4.98 GiB free. The failed request with correlation ID
`96fdde76-bb78-439d-ba69-7abca28a0a60` produced preprocessing
`503 DEPENDENCY_UNAVAILABLE` and orchestrator `502 DOWNSTREAM_FAILED`.
Inspection of the actual running preprocessing container confirmed image
`j26-platform:0.1.0-dev`, no `C2_GLINER_*` configuration, no model mounts,
and no installed `gliner` package. Direct loader execution raised
`RuntimeError: Experimental demo unavailable`. Thus the UI failure is an
undeployed experimental overlay, not evidence of an inference accuracy failure.
The isolated Linux environment was empty, with no installer running. Preparation
was resumed without overwriting source/model files. Two CPU wheel downloads
timed out on `download-r2.pytorch.org` (99.4 MB and 8.7 MB). The exact wheel
downloaded through the official primary `download.pytorch.org` host and passed
its official SHA-256:
`59e78aa0c690f70734e42670036d6b541930b8eabbaa18d94e090abf14cc4d91`.
The reusable installer now uses that pinned Linux CPython 3.12 x86-64 CPU wheel,
bounded download timeouts, optional inspected-environment resume and no optional
bytecode compilation. Installation and `pip check` completed successfully.

Real Docker inference then passed all 16 cases. An authenticated browser-route
cold request subsequently failed at **30.03 s**, HTTP 500 without a JSON response;
dashboard logs: `Failed to proxy .../api/v1/c2-demo/custom-runs`,
`Error: socket hang up`, `code: 'ECONNRESET'`. This is distinct from the original
missing-overlay 503. The C2-only proxy and bounded gateway budget above address
the observed cold-load transport mismatch. First loads on Windows bind mounts
remain substantially slower than warm inference; no fake progress or fallback.

The engine originally hung (`_ping: context deadline exceeded`). The user
explicitly approved a Docker Desktop restart. Graceful restart timed out; the
Docker WSL VM was shut down and hung Docker host processes ended, then Desktop
relaunched. Existing containers/volumes resumed healthy without deletion.

The CPU image installation then failed with
`OSError: [Errno 5] Input/output error` at 66.3/178.6 MB of the torch wheel.
Diagnosis: **C: only ~85 MB free**, D: ~159 GB free. Docker's sparse data disk
cannot grow on C:, even though Linux reports virtual free capacity. The build
ended with a Docker API EOF and control-plane failures. No disk/volume prune,
reset, source deletion, participant read or model download was performed.

Packaging was adjusted to avoid large Docker layers: a disposable installer
prepares a Linux virtual environment in ignored `.local/c2-gliner-linux-env` on
the workspace drive, then the opt-in image mounts it read-only. Temporary package
files also stay on the workspace drive. The model's Docker-only path configuration
is in `.local/c2-gliner-docker` with the verified existing weights hardlinked;
the original model/configuration is preserved. The backbone and weights are
read-only mounts, never committed or baked into images.

At the earlier pause, the attempted dependency installer was cancelled while Docker's API remained
stalled. Inspect whether any installer container exists before rerunning; do not
start duplicate installs. The user said they will free at least 5 GB on C: and
reply when ready; **that is not yet confirmation of free space**.

Latest read-only HTTP check before pausing:
`http://localhost:3001/c2-demo` **500**, `http://localhost:8000/ready` **503**.
Therefore the working demo is not currently verified healthy after the storage
failure, and GLiNER is not active in it. Restoring healthy baseline services is
the first step after space is available. No build/test command remains running.

## Historical resume checklist (completed/superseded above)

1. Confirm actual C: space and Docker control-plane health. Restore the existing
   baseline services without dependency/volume recreation. No need to rerun the
   passed Python/model comparison solely because the storage issue cleared.
2. Inspect any experimental installer state. Prepare the new Linux environment
   only once; preserve partial files for diagnosis rather than blindly replacing
   an existing non-empty directory.
3. Build/apply the thin opt-in overlay. Verify pinned installed versions and
   `pip check`, actual read-only mount accessibility and the weight hash.
4. Run `.local/c2-gliner-browser.mjs`: 16 actual GLiNER + eight Presidio baseline
   cases, compare complete responses to real Python output, inspect desktop/mobile,
   selected/executed backend, residual/gate results, Reset and selection clearing.
5. Verify missing-model/inference failure with a disposable container process,
   including safe authenticated API error, no fallback and no successful readiness.
6. Record actual outcomes here, including any Linux/Windows masking differences;
   do not change expectations merely to obtain parity.

Setup commands (after prerequisite checks, not all completed yet):

```powershell
# Already prepared; script refuses overwriting an existing snapshot.
.venv\Scripts\python.exe scripts/run.py scripts.c2_prepare_gliner_docker
# Pending; existing non-empty environment requires inspection first.
.venv\Scripts\python.exe scripts/c2_prepare_gliner_environment.py
# Only after inspecting a partial environment; preserves existing files:
.venv\Scripts\python.exe scripts/c2_prepare_gliner_environment.py --resume
docker compose build orchestrator counsellor-dashboard
docker compose -f docker-compose.yml -f docker-compose.c2-gliner.yml build preprocessing
docker compose -f docker-compose.yml -f docker-compose.c2-gliner.yml up -d --no-deps preprocessing orchestrator counsellor-dashboard
```

Local page: **http://localhost:3001/c2-demo**. Refresh after deployment; GLiNER is
the fixed experimental backend, with no tool dropdown. Use the same private
development counsellor sign-in. Do not enter participant data. Model/revision
details are expandable; returned configuration metadata identifies execution.
Standard Compose without the experimental overlay cannot execute the new custom
default; it must report unavailable, never silently use Presidio. Start this demo
with both Compose files. Explicit `strategy="presidio"` API requests still work.

## Limitations to demonstrate honestly

Transformers 4.57.3 emits a tokenizer-regex warning referring to a Mistral
discussion when loading this local GLiNER tokenizer. No tokenizer repair flag was
silently applied to the evaluated mDeBERTa-based configuration. All sampled
Windows/Linux responses match, but this warning is retained rather than claimed
resolved. The existing Next.js security advisory remains outside this bounded
C2 deployment change; no unrelated dependency upgrade was performed.

Prior [v4 development evidence](c2-generalization-v4.md) is unchanged: the combined
variant has PERSON/LOCATION P=.9043, R=.8500, F1=.8763 on the inspected weighted
development cases, with 15 entirely exposed Romanized entities and contextual
false masking. These are not unseen/independent validation or a release threshold.
The sampled relationship miss remains exposed in actual new Python execution;
the [residual auditor](c2-residual-output-v1.md) may review/block supported contexts,
which does not count as correctly detecting/masking the name. Absence of a residual
signal does not establish anonymity. Trained models remain offline. No training,
commits or pushes occurred.
