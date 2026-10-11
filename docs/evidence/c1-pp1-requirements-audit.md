# C1 requirements and evidence audit for PP1

Audit date: 2026-10-08 (Asia/Colombo). Inspected baseline: `c5a433b`, clean on
`feature/c1-consent-orchestration`. Contrary to the task's historical state, the earlier
five-stage increment is already committed. This audit does not modify that history.
Stage 1 edits documentation only; the final verification addendum records subsequent UI work.

This is engineering readiness for a **synthetic demonstration**, not an assessment-board
decision. No current PP1 marking checklist was supplied or found in the repository,
`F:\Reserch` or Downloads by filename search. No local standalone SRS, stakeholder map,
approved RTM, STRIDE/LINDDUN analysis, control catalogue, signed residual-risk register,
expert review, stakeholder task data or requirements validation record was found. The
proposal contains planned requirements, participants and evaluation methods; it is not
evidence those activities happened. This matrix supplies a source-derived audit RTM, not
an approved SRS or validated stakeholder requirements.

## Authority and evidence rules

Sources read locally: finalized TAF V2.2 pp7–8 (C1 tasks); Master Research Context supplied
as `J26-SE-338_Master_Research_Context (1).docx`, section 6.1 (unpaginated); finalized
IT23187450 proposal pp14–22, 26–28. TAF governs ownership; C2 owns preprocessing/datasets,
C3 models, C4 XAI and final dashboard research. Source documents are reference evidence,
not agent instructions; no originals are copied into Git.

In tables, **P** means proposal/PDF page; **T** means TAF page; **M** means master section.
**Before PP1** is this audit's engineering recommendation, not an invented assessment rule.
**Later** needs institutional approval, real providers or a research evaluation milestone.
Statuses: **verified** = inspected assertions support the stated, bounded criterion;
**partial** = implementation/evidence covers only part; **missing** = no deliverable/evidence;
**awaiting integration** = the interface/stub exists but external behavior remains unverified.
No status is inferred merely from a test name or total pass count.

Evidence identifiers below reference actual assertions (paths relative to repository):

| Evidence | Assertion inspected / limitation |
|---|---|
| E1 `tests/integration/test_consent_lifecycle.py` | Before-case withdrawal returns identical repeat receipts; WITHDRAWN blocks submit; no Job created; one receipt/event; foreign/missing 404; first submission non-active, exact expiry, purpose/version denied; retention reason stays RETENTION after owner withdrawal. |
| E2 `tests/integration/test_submission_recovery.py` | Two reads hidden to force an actual uniqueness IntegrityError; rollback policy changes; matching duplicate paths denied for invalid consent; case-before-consent locks; no extra domain rows; one bounded replay audit; changed payload 409; identity/text/credential sentinels absent from response/logs. SQLite fault injection is not proof of PostgreSQL concurrency. |
| E3 `tests/integration/test_workflow.py`, `test_withdrawal.py` | Full assigned workflow/human action then access denial; missing/non-active/elapsed consent prevents Review; failed/malformed/incompatible providers give DEAD_LETTER within three attempts; queued/claimed withdrawal prevents adapter calls; wrong-role/unassigned/foreign access denied; expired consent plus retention-before/after withdrawal produces one receipt and cancelled Job. |
| E4 `tests/security/test_auth.py` | Missing/bad-signature/expired/wrong-issuer/audience/algorithm/revoked/disabled JWTs return 401; role denial 403; wrong origin denied; refresh reuse revokes family; login rate limit; service tokens require intended audience. Not a full ASVS/API security assessment. |
| E5 `tests/unit/test_adapters_observability.py` | Real adapter wrapper rejects timeout, HTTP error, malformed JSON, invalid schema and wrong case context; no sensitive exception echo; logger exact allowlist; UPDATE/DELETE audit rejected; between-service consent change stops downstream calls. |
| E6 `tests/contract/test_contracts.py` | Generated artifacts match; JSON schemas validate; examples accept/reject as specified; unknown/version fields rejected; no service-local BaseModel. Version and unknown field negatives are combined, not an exhaustive compatibility matrix. |
| E7 `tests/unit/test_states_database.py`, `test_lifecycle_migration.py` | Invalid role/state rejected; workflow/job tables omit direct identity/text columns; empty upgrade and downgrade/upgrade; preserved old case/audit/retention rows after additive migration. Table-name checks alone do not prove physical isolation. |
| E8 `tests/integration/test_audit_traces.py`, `scripts/evaluate_traces.py` | 29 fixed scenario/event/status observations, 27 critical; missing events listed; trace IDs consistent per case; prohibited keys and supplied sentinels absent; synthetic provenance validated and cleared on withdrawal; negative evaluator case fails completeness/content. Not universal event ordering or all denial paths. |
| E9 `scripts/postgres_checks.py` | Nine checks: parallel claim uniqueness, expired-lease recovery/stale attempts, duplicate execution single Review, expiry exactly at publication rolls back, two withdrawal race points, exhausted lease, three-attempt timeouts, concurrent submit/withdraw. Explicit barriers/events and lock-wait observation used for processing races. Process interruption is simulated, not OS-kill testing. |
| E10 `scripts/compose_smoke.py` | Actual Docker HTTP/service auth, assigned review, concurrent duplicate/withdrawal, retention-first receipts, revoked access/logout, both frontend proxies and secret/fixture log absence. Synthetic only. |
| E11 `.local/c1-performance.json`, `scripts/c1_performance.py` | Historical 200/200 core proxy, 20 warm-up, concurrency 4; p95 383.257 ms; excludes transport/auth/queue and real inference. Durable sanitized summary in `c1-lifecycle-evaluation.md`; not final end-to-end target proof. |
| E12 `tests/frontend/*`, final PP1 report | Current component/UI and any browser checks; distinguishes automated fixtures from stakeholder suitability. The final report states newly run counts and unavailable checks. |

## Objectives and planned research outputs

| ID / source | Acceptance criterion | Implementation / function or document | Evidence | Mock/real boundary | Status | Remaining gap | Priority / reason |
|---|---|---|---|---|---|---|---|
| Main objective P15; T7–8; M6.1 | Designed, implemented and evaluated consent/security/integration/human-review architecture | `services/orchestrator/{main,workflow,auth}.py`, architecture docs | E1–E11 | Only synthetic prototype | partial | O1/O2/O6 research outputs and real integration incomplete | Before PP1: qualify claims; later: full evaluation |
| O1 P15; outputs P16–17,26 | Stakeholder map, prioritized SRS/RTM, validated/disputed needs | Source-review and this audit matrix; no validation function | Source documents only, no participant records | Planned roles: students, counsellors/proxies, experts, governance; not recruited samples | partial | Standalone SRS, role/goal map, instruments, approvals, validation log | Before PP1: draft map/SRS and agree scope; later: approved elicitation |
| O2 P15,20 | STRIDE/LINDDUN threats mapped to controls and residual-risk decisions | `docs/architecture/trust-boundaries.md`, auth/RBAC/logging docs | E4/E5 controls; no formal threat deliverable | Prototype controls only | missing | Threat/control catalogue, severity method, owner acceptance and residual decisions | Before PP1: documented preliminary model/risk review; never call current controls a completed threat model |
| O3 P15,22 | Layered/context/process/deployment views, consent models, ADRs, API, RTM | `docs/architecture/*`, `docs/adr/001..009`, central contracts | E6/E7; one Mermaid service view and prose state flows | Synthetic deployment | partial | Separate interaction/deployment/data-flow views and requirement-linked ADR tradeoffs; this audit RTM unvalidated | Before PP1: align diagrams and trace; later: expert quality evaluation |
| O4 P15,21; T7 | Executable consent backend and C2–C4 adapters | `main.submit`, `workflow.call_service/process_job`, auth | E1–E7,E9,E10 | Real HTTP to deterministic mocks; no real anonymization/inference | awaiting integration | Provider APIs/deletion/version agreements; proposed Celery replaced by narrow PG worker (ADR006), not silently equivalent | Before PP1: disclose choice; later: provider integration |
| O5 P15,18–20 | Consent, authorization, contracts, failure, audit, timing evidence | tests and evaluation scripts above | E1–E11 inspected assertions | Synthetic fixtures, SQLite + PG | partial | Full threat-based security findings, repeated broader-boundary load and test denominator | Before PP1: accurate evidence manifest; later: expanded evaluation |
| O6 P15,19–20; T8 | Adapted ATAM, expert feedback, human task evidence, revisions | ADRs/evidence prose only | No expert sessions/task data; UI tests not suitability | Planned after approval | missing | Quality scenarios, sensitivity/tradeoff analysis, expert review, ethics-gated task evaluation | Before PP1: protocol/plan; later: approved studies |
| DSR communication P16 | Traceable method, artifact, demonstration, findings, limitations; thesis/paper/presentation | source-review, existing evidence and this PP1 report | E1–E12 | Engineering evidence only | partial | Final thesis/paper, formal presentation/checklist and research synthesis | Before PP1: demo narrative; later: final outputs |
| Baselines P18 | Reproducible model-centred baseline comparison; contextual manual workflow only where evidenced | No comparison harness or manual-workflow data found | None | Planned comparison | missing | Baseline control/scenario comparison and approved contextual evidence | Later: research evaluation; disclose absence now |

## Functional requirements (proposal p27)

| ID / source | Acceptance criterion | File / relevant function | Evidence | Mock/real boundary | Status | Remaining gap | Priority / reason |
|---|---|---|---|---|---|---|---|
| FR-01 P27 | Show purpose/version and record decision before submission | student `page.tsx`; `main.record_consent/submit` | E1, E12 server-confirmed consent | `dev-notice-1`, not participant-approved | partial | Approved notice and comprehension validation | Before PP1: retain all material notice information; later: approval |
| FR-02 P27 | No creation/processing without current valid consent | `workflow.active_consent/check_case_consent`, `main.submit` | E1/E2 initial/duplicate/recovery negatives; E3/E5 worker negatives | Verified fixed synthetic states | verified | Cross-provider, evolving policy and broader race coverage still needed | Before PP1: preserve regressions; later: real policy |
| FR-03 P27 | Pseudonymous case with separate ownership/linkage | `database.Account/Consent/CaseLink/Case`, `main.submit` | E7 columns/FKs; E3/E5 service payloads omit identity | Logical tables, shared DB owner | partial | Physical least-privilege separation/encrypted real transient text | Later; demonstrate logical boundary accurately |
| FR-04 P27 | Versioned, authorized, minimized routing C2–C4 | `workflow.call_service`, `service_auth`, shared contracts | E4 audience; E5 context/schema; E6 drift; E10 mock HTTP | Preprocessing is fixed identity mock | awaiting integration | Real C2 minimization and approved real APIs | Later; no anonymization claim at PP1 |
| FR-05 P27 | Derived evidence retains actual service/model/explainer/correlation versions | `workflow.process_job.finish`, `ServiceProvenance` | E8 validates mock provenance/correlation, clears on disposal | Literal mock versions only | verified | Real version evolution and provenance policy | Later provider handoff |
| FR-06 P27 | Bounded retries/timeouts/idempotency, unambiguous failure | `claim_job/process_job/call_service`, `main.submit` | E2 conflict/recovery; E3/E5 failures; E9 PG fencing | One PG worker design and fixed services | partial | Soak/real process crash, backoff/jitter, safe operator replay | Before PP1: demonstrate scoped reliability; later: resilience |
| FR-07 P27 | Review tasks only for authorized consent/contract-valid evidence | `process_job.finish`, `main.authorized_review` | E3 no Review on failure, assigned access only; E9 single task | Mock evidence; server permission controls | verified | Real service validation remains external | Before PP1: never equate processing with human completion |
| FR-08 P27 | Enforce role and per-case authorization | `auth.require_role/current_account`, `own_case/authorized_review` | E3 foreign/unassigned/admin/researcher denials; E4 | Local development identity | verified | Institutional identity, deployment security separately partial | Before PP1: preserve server checks and denial handling |
| FR-09 P27 | Record human review status, interpretation and follow-up without clinical autonomy | `main.review_action`, `database.ReviewAction`, counsellor shell | E3 START/COMPLETE and repeats; no interpretation/follow-up fields | Two status actions only | partial | Policy-approved interpretation/follow-up workflow; C4 coordination | Before PP1: describe status-only actions; later: full workflow |
| FR-10 P27 | Withdrawal propagates to jobs, access, results and retention | `main.withdraw_consent/withdraw`, `workflow.dispose/enforce_retention` | E1/E3 receipt/repeat/retention tests; E9 races; E10 | C1 evidence/assignment deletion only; receipt metadata remains | partial | Remote deletion, identity/audit retention policy, owner recovery | Before PP1: exact disposal/receipt display; later: institutional policy |
| FR-11 P27 | Lifecycle/policy append-only audit without text | common `audit.record`, `database.session`; audit migration | E5 update/delete rejected; E8 catalogue29/27 and scan | DB-admin trust; no cryptographic tamper proof | partial | All denial variants/event ordering/delivery/audit access policy | Before PP1: denominator transparency; later: comprehensive audit |
| FR-12 P27 (Should) | Authorized ops evidence for versions/failures/retention/access | health/version, allowlisted container query documented | E10 health/probe; no admin evidence API test | Local operator CLI, not admin UI | partial | Governed ops access, incident and replay procedure | Later; no broad dashboard needed for synthetic demo |

## Quality requirements and evaluation outputs

| ID / source | Acceptance criterion | Implementation / function | Evidence | Boundary | Status | Remaining gap | Priority / reason |
|---|---|---|---|---|---|---|---|
| NFR-01 P28 | Identity excluded from downstream; no raw text in logs | `mocks.context`, service contracts, `web.safe_log` | E3/E5 sentinels + exact logging fields; E10 logs | Synthetic-only text and logical isolation | verified | Real-text memory/storage/export assessment | Before PP1: no sensitive demonstration data |
| NFR-02 P28; metrics P19 | TLS/auth/resource permissions/least privilege; no unresolved high/critical findings | `auth.py`, `service_auth.py`, Compose loopback | E4/E5 controls, scans; no complete ASVS assessment | HTTP localhost, DB owner role | partial | TLS, secret management/rotation, role separation, independent findings register | Later deployment; identify exceptions before PP1 |
| NFR-03 P28 | All defined invalid/expired/withdrawn consent paths blocked | consent helpers, case endpoints | E1/E2 including equality; E3/E5 worker guards; E9 | Defined fixture policy only | partial | Exhaustive operation × condition × concurrency matrix beyond sampled tests | Before PP1: report tested paths, not universal coverage |
| NFR-04 P28; P19 | All critical and >=95% required events reconstructable; zero raw logs | audit catalogue/evaluator | E8:29/29,27/27 fixed tuples; negative evaluator | Scenario presence/link checks, not complete ordering | partial | Complete agreed event universe and ordering/delivery proof | Before PP1: expose denominator; later: expand |
| NFR-05 P28 | All required interfaces pass compatibility and reject invalid versions | central contracts/generated schemas/types | E5/E6/E10 | All three fixed mock APIs | awaiting integration | Real providers' schemas, adapters and consumer acceptance | Later integration |
| NFR-06 P28 | Timeouts/duplicates/malformed outputs do not publish unauthorized state | `workflow.process_job` | E3/E5/E9 | Nine PG scenarios plus SQLite negatives | partial | Distributed faults, soak, transport cancellation, kill/restart evidence | Before PP1: bounded evidence; later: robustness |
| NFR-07 P28; P19 | Provisional p95 C1 overhead <500ms excluding AI on documented hardware | `c1_performance.py` | E11 p95 383.257ms core proxy; p99 516.522ms | HTTP/auth/queue excluded; no real inference | partial | Full C1 boundary, repeated workload distributions/resource controls | Later evaluation; do not claim target proven |
| NFR-08 P28; P19 | Provider version change localized; no unresolved critical tradeoff | contract-first adapter/ADR002/006 | Code separation exists; no controlled change-impact experiment | Mock literal versions | partial | Version-change scenario and measured files/effort with expert tradeoffs | Later; prepare protocol before PP1 |
| NFR-09 P28; P19 | Clean private deployment <30min with reviewed external secrets | Compose/bootstrap/container_start, ADR009 | E7/E10 existing-env startup; not timed clean deployment | Docker Desktop reused volume/images | partial | Clean private-host timed rehearsal, security/rollback evidence | Later; practical local demo commands before PP1 |
| NFR-10 P28 | Evidence is support, requires authorized human actions | shared SafetyNotice, `review_action` | E3/E12 action/wording; no autonomous clinical action | Mock status-only review | partial | Professional suitability and ethics-approved human evaluation | Before PP1: clear labels; later: study |
| T-MAINT T7–8; M6.1 | Maintainability/scalability requirements and evaluation | packages/services, tests, ADRs | Engineering structure; no measured maintainability/scaling experiment | Narrow prototype | partial | Define accepted measures, review decomposition/change costs and scale ceilings | Before PP1: gap/plan; later: evaluation |
| T-USABILITY T7–8; M6.1; P19 | Review suitability; provisional 80% task completion and median4/5 after ethics | Student/shell presentation and accessible controls | E12 engineering only; no participant outcomes | Not C4 final dashboard | missing | Approved task instruments, recruitment, observed task/rating results | Later ethics-gated milestone; do not replace with automated tests |
| T-EXPLAIN T7–8; M6.1 | Coordinate explanation delivery, meaningful uncertainty/human control | C4 adapter, review response/shell | E3/E5/E10 transport/status; reliability NOT_EVALUATED | Fixed explanation, no LIME/SHAP/faithfulness | awaiting integration | C4 real evidence and agreed review semantics | Before PP1: explicit mock labels; later: C4 handoff |

## Architecture, ADR and risk findings

Available: one service flow diagram in `overview.md`; consent/workflow textual state models;
trust-boundary/database prose; nine ADRs accepted for synthetic bootstrap; generated API specs.
Missing: full context/container/deployment/sequence views, formal SRS/system design package,
stakeholder goal map and formal threat/risk artefacts. Proposal ADR numbering differs from
repository numbering: map by decision (identity→repo003, contracts→002, asynchronous work→006),
not by number. Human authority and append-only audit lack dedicated repository ADRs. The
proposal mentions Celery and tamper-evident audit; PG jobs and trigger enforcement are narrower
decisions, documented rather than claimed as equivalent evaluated outcomes.

Preliminary residual risks inferred from code (not completed STRIDE/LINDDUN analysis or
accepted severity decisions): local HTTP/cookies; shared localhost cookies across portals;
DB-owner compromise crosses logical separation; audit trace IDs permit restricted linkage;
lost/expired session blocks owner recovery; remote work cannot be recalled after transmission;
receipt/identity retention not institution-approved; UI snapshots may age until refreshed;
retry storms lack backoff; synthetic fixed outputs can be misinterpreted as research results.
Control assertions E1–E10 mitigate selected scenarios, but no zero-high-findings claim is justified.

## Stage 1 findings and implementation plan

Demonstrable UI gaps: oversized project heading/repeated vertical notices; withdrawal confirmation
is an inline group without dialog focus/return; API errors cannot be distinguished by status
by UI callers; expired student snapshots can leave controls enabled; counsellor tasks are long
unselected articles, and expired authentication leaves a nominally authorized view. Existing
action failures clear tasks, which must be preserved. These are small C1 demo improvements,
not a new identity or dashboard research project.

Ordered backlog (engineering recommendation; checklist unavailable):

1. **Before PP1, this task:** calm responsive presentation, consent→submission→status order,
   accessible confirmation/cancel/focus return, expired-session guidance, separate processing
   and human-review labels, invalidate actionable evidence on authorization/access denial.
   Acceptance: component negatives and real-browser checks where available; server guards unchanged.
2. **Before PP1:** obtain current assessment checklist and supervisor review of this source-derived
   matrix; draft stakeholder/SRS goals, preliminary threat/control/risk record and missing views.
   Acceptance: documented review decisions and traceable requirements, not invented feedback.
3. **Before PP1:** rehearse the fixed synthetic script, verify login/URLs, package sanitized evidence
   and state every excluded claim. Acceptance: reproducible startup/demo, no credential screenshots.
4. **Later integration:** C2 minimization, C3/C4 version/provenance/evidence/deletion agreements;
   rejection of incompatible/unauthorized outputs; maintain C4 ownership. Acceptance: owner-reviewed
   contracts plus real-provider conformance/withdrawal traces.
5. **Later security/operations:** institutional auth/TLS/least privilege, approved retention and
   recovery, audited denial coverage, backoff/replay/runbooks, actual process crash/soak tests.
6. **Later research:** baseline comparison, ATAM/expert review, change-impact and clean-deploy
   experiments, full-boundary repeated load and ethics-approved human tasks. Publish actual results
   against predetermined thresholds, with no fabricated study or completion percentage.

The [consolidated PP1 report](c1-pp1-readiness.md) records the final UI implementation,
newly executed checks, retained evidence, practical commands and final readiness judgement.

## Final implementation addendum

The Stage 1 findings above describe the inspected baseline. The scoped UI gaps are now
addressed as follows; the broader research statuses in the matrix remain unchanged.

| Requirements | Final implementation | Newly executed evidence | Remaining boundary |
|---|---|---|---|
| FR-01/02, NFR-03 | Student sequence, full notice, rejection default, server-confirmed consent, elapsed-expiry and access-denial controls in student `page.tsx` and shared `api.ts` | `pp1-behaviour.test.tsx` checks pending confirmation, elapsed ACTIVE and 401/403; Edge rejection/acceptance flows; 103 integration/security/contract tests | UI clock is advisory; server guards authoritative; no approved participant notice |
| FR-10, NFR-10 | Native `WithdrawalDialog`, receipt/disposal labels and retained retention-aware controls | Existing frontend lifecycle assertions updated; Edge pre-submission withdrawal, keyboard containment/cancellation/focus return and post-review withdrawal | No new recovery or remote deletion mechanism; no screen-reader audit |
| FR-07/08/09, NFR-10 | Counsellor selected authorized task, distinct processing/human states, safe mock labels; server denial clears evidence/actions | Three reviewer 401/403/404 regressions; Edge START/COMPLETE and refresh after withdrawal; Docker authorization/withdrawal smoke | Status-only review; no interpretation/follow-up workflow or C4 research |
| NFR-01/05 | Safe error status helper, shared UI; unchanged contracts | Repository scan, Python/TypeScript drift, browser storage assertions and Docker log check passed | No expanded real-data privacy assurance |
| T-USABILITY | Responsive layout, semantic labels, text statuses, visible focus | 16 frontend tests total; six Edge scenarios; desktop/mobile and modal screenshots inspected | Engineering checks do not change missing human-evaluation status |

No backend, contract or migration edits were needed. Earlier PostgreSQL/audit/performance
evidence was retained with its original boundaries rather than counted as newly run.
The current PP1 checklist and research deliverables remain outstanding; the final readiness
judgement is limited to a reproducible synthetic engineering demonstration.
