# C2 annotation and validation UI checkpoint — 27 October 2026

Parent: `e39fe98ed2678468d095ab5a3f4f8b35e719ef2e` on
`feature/c2-anonymization-pipeline`. This checkpoint adds only verified active
annotation/demo presentation, matching frontend tests and documentation. It does
not repeat the already committed detector, preprocessing or persistence work.

## Included behavior and prerequisites

- Shared authenticated annotation workspace with searchable server-authorized
  frozen item IDs, own saved status/progress, Previous/Next, safe disabled states
  and unsaved-edit protection for selection, reload, sign-out and page exit.
- `/c2-demo/annotation/annotator-1` and `/annotator-2` re-export the same page;
  neither URL assigns identity or permissions. Separate accounts need separate
  browser sessions. Emotion/Wellbeing are prominent; unchanged required Language
  and Code-mixing choices remain in Additional labels, without prefill.
- Existing revision APIs, account-owned drafts, immutable finals, peer-label
  hiding and privacy withholding are preserved. The legacy standalone-queue UI
  shortcut is removed. Backend endpoints and stored records are unchanged.
- Automated checks omit only the redundant standalone NO_SIGNAL badge. The
  table's No signal counts, structured checks, FAIL/REVIEW findings, unavailable
  states and exported JSON retain the actual backend values and release status.
- Active CSS only is selected from the mixed working stylesheet. Superseded
  selector/radio/popup styling is preserved unstaged. Active cascade order is
  retained. No new dependencies are required.

Prerequisites already in history: contextual preprocessing `65e4db3`/`c2adc30`,
grouped annotation persistence/migrations/contracts `170151c`, GLiNER and output
validation `52be4bb`, withdrawal of regressing LOCATION supplementation `65bd7d3`,
and residual/demo cleanup `e39fe98`. No duplicate source, contract generation or
migration is needed for this UI-only increment.

## Exact selected snapshot checks

Verification checkout: `.local/c2-checkpoint-selected-20261027`, detached at the
parent and populated from the explicitly staged patch. Its Git index tree was
compared with the root selection. Excluded experiments/data/helpers were not
copied. Locked dependencies installed there with
`npm ci --offline --ignore-scripts --no-audit --no-fund` (258 packages).

Commands ran from that isolated checkout using the existing root Python venv:

| Check | Actual outcome |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed, both workspaces |
| `npm test` | 112 passed, eight frontend files |
| `npm run contracts:check` | Passed |
| `npm run build --workspace @j26/counsellor-dashboard` | Passed on unchanged retry; existing security advisory retained below |
| `python scripts/run.py pytest tests/integration/test_c2_annotation.py tests/integration/test_c2_submissions.py tests/unit/test_c2_pipeline.py tests/unit/test_c2_privacy_gate.py tests/unit/test_c2_residual_privacy.py tests/unit/test_c2_text_processing.py tests/unit/test_c2_gliner_demo.py tests/contract -p no:cacheprovider --basetemp=.verification-temp --junitxml=verification-python.xml --tb=short` | 145 passed, one expected failure; existing Starlette/httpx deprecation |
| `python -m ruff check services/preprocessing` | Passed |
| `python -m ruff format --check services/preprocessing` | Passed, 40 files |
| `python scripts/run.py scripts.generate_contracts --check` | Passed |
| `python -X utf8 scripts/check_repository.py` | Passed |
| `python scripts/check_ci.py` | Passed; hosted CI not run |
| `git diff --cached --check` | Passed before final review |

Production route smoke used the isolated dashboard on port 3101, then stopped it.
`/c2-demo`, `/c2-demo/annotation` and both annotator entry routes returned HTTP 200.
This confirms route/build availability, not authenticated workflow correctness.
Authentication, persistence and release checks are exercised by the tests above;
the matching prior actual two-session/browser evidence remains in
[submission pilot evidence](c2-submission-annotation-pilot-v1.md). No fresh
authenticated browser or expensive model inference was performed for this commit.
The current selected CSS excludes unused historical selectors; the active
styles and TSX match that previous desktop/mobile verification.

## Environmental checks and existing advisory

The selected-snapshot Docker build was attempted but could not connect:
`open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.`
Docker Desktop was not started/restarted, and no container or volume was changed.
Prior relevant Docker/browser results are reused as recorded evidence, not claimed
as a fresh selected-snapshot Docker pass. The direct production build/smoke above
completed independently.

Next.js 16.4.0 initially terminated the build after its existing known-security-
vulnerability upgrade reminder. Retrying the identical command succeeded while
still warning that this version is affected. Upgrade remains recommended; no
dependencies, security checks or CI rules were changed or bypassed. This checkpoint
does not establish a clean dependency audit. The Next start smoke also reported
its existing standalone-output deployment recommendation; route smoke succeeded.
No full Python suite, broad evaluation, training or Docker rebuild completed here.

## Limits and excluded work

GLiNER remains experimental at threshold 0.7 with the pinned v4 name-label
configuration; the withdrawn sentence-context LOCATION addition remains offline.
The global pipeline default stays Regex. Sinhala/Romanized PERSON/LOCATION misses,
false masks and bounded residual-audit gaps remain documented in the existing
[GLiNER](c2-gliner-demo-v4.md), [output validation](c2-output-validation-v1.md)
and [quality/privacy](c2-quality-privacy-v1.md) evidence. NO_SIGNAL is not verified
anonymity; test passes are not accuracy. Language ID v1.2, normalization,
tokenization, privacy policies and release blocking are unchanged.

Vocabulary remains provisional, not expert-approved. Account separation is not
independent human annotation. Agreement, adjudication and controlled release are
pending. All verification uses disposable synthetic fixtures; saved live records
were neither reset nor modified by checkpoint verification.

Excluded and preserved locally: offline GLiNER/calibration/training/fastText
studies and tools, generated PDF/JSON/CSV evidence, weights/caches, PII annotation
preparation experiments, unrelated earlier Python/test edits, superseded UI CSS,
the mixed residual-study documentation rewrite, and other unselected evidence.
No `.local` helpers, environment files, credentials, participant records or
generated cohort are included. No push is authorized by this checkpoint.
