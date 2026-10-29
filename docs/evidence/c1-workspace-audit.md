# C1 requirement and interface audit — 2026-10-24

Later final audit at baseline `15f4a81`:
[exact source requirements, current/retained evidence, gap ownership and PP1 script](c1-final-pp1-audit.md).
It distinguishes bounded FR06 implementation from additional resilience evaluation and
marks NFR05 Partial while real providers await integration. Historical results below retain
their original scope; absent backoff or an editing UI is not automatically a source requirement.

Current FR07/FR08/FR12 follow-on evidence: [manual assignment and operational aggregate charts](c1-manual-assignment-charts.md).
It verifies consent-only absence of work, C2–C4 processing before assignment, persisted owner
assignment receipts, protected admin aggregates and honest unavailable C4 chart inputs.
It does not establish research performance, clinical quality or completed C4 chart research.

Follow-on trace: [role administration and explicit assignment](c1-role-assignment.md)
adds verified FR08/FR12 staff/assignment controls, protected provider directory and runtime
evidence. It preserves this earlier source audit and proposed-requirement status. FR07's
configured automatic policy is retained; manual awaiting-assignment is now also supported.
Institutional approval, real research integrations and comprehensive evaluation remain gaps.

Branch `feature/c1-consent-orchestration`, starting commit `2dee860`. The only initial
local change was an untracked C3 result directory; it was preserved and excluded from
this task. Nothing was staged, committed, pushed, merged, reset or switched. This report
supersedes earlier missing-interface findings, not the dates/results of prior evaluations.

## Sources and acceptance authority

Read AGENTS.md, CONTRIBUTING.md, README, architecture/authentication/RBAC/audit docs,
central contracts, current database migrations, worker/disposal/session code and FR09,
session and checklist evidence. Re-read supplied IT23187450.pdf pp15,27–28. Its section 5
explicitly describes **proposed** requirements pending approved stakeholder validation.
No new approval or participant evidence is implied by implementing them.

Finalized TAF and Master Context were unavailable at their previously supplied Downloads
paths, and no matching file was found in that directory. Existing source-review records
document their prior inspection. Those are historical references, not a new source read.
No standalone approved SRS, RTM, stakeholder-validation record or finalized institutional
notice was found among repository files. This matrix is an engineering trace, not a
substitute approval. Existing TAF ownership is preserved: C1 infrastructure/controls,
C2 preprocessing/datasets, C3 modelling, C4 XAI and final dashboard research.

Runtime provider source: `services/{preprocessing,nlp,xai}/main.py`, mock contracts and
`workflow.call_service`. They remain deterministic development mocks. Independent C3
offline research is not loaded into the live C1 workflow or modified by this task.

## Verified baseline and causes

Current baseline before edits: **164 backend tests passed**, **48 frontend tests passed**.
Full Ruff reproduced **63 pre-existing C3 findings**. No unrelated check was suppressed.
Docker Desktop was stopped and was started for local verification; volumes were preserved.

| Reported problem | Code-backed finding | Implemented response |
| --- | --- | --- |
| No audit-log interface | Audit rows, transaction handling, append-only triggers and trace tests existed, but no ADMIN evidence endpoint/page | Bounded ADMIN-only receipt API and `/admin` staff screen |
| Consent appears to grant counsellor access directly | Worker grants the designated development counsellor an assignment only after all stages succeed; protected reads also require role, assignment, live consent and retention checks. UI did not explain this route | Verified-session/assignment context and explicit routing information; existing server controls reused |
| Saved reviews hard to find | Protected GET/POST record endpoints and immutable database record existed; queue showed generic numbered tasks, no saved indicator/filter | Pseudonymous references, saved-record timestamps, state filters and pagination; reopen from queue after refresh/sign-in |
| Five-minute logout claims | Prior refresh fix exists, historical >5-minute evidence retained; current baseline session tests pass | Renewal architecture preserved; new admin client uses the same bounded architecture with separate cookies |
| Long, inconsistent screens | Checklist rendered every evidence paragraph as a large article; role/navigation hierarchy was weak | Shared light/navy/teal styling, compact navigation/notices, responsive queue/detail, bounded admin table, expandable checklist evidence |

No server authorization bypass was demonstrated in the inspected student/review flows.
Consent creation does not create a case, task, assignment or review record. Submission
creates one case/job; successful processing creates a task and designated assignment;
human actions create status receipts; optional FR09 save creates one final record.

## Functional requirement trace

Source for FR01–FR12: proposal p27; architectural ownership per recorded TAF C1 scope.
Status labels distinguish accessible synthetic functionality from governance/integration.
All listed tests are actual assertions; execution results are in the companion verification
note. A checklist badge is never used as proof of implementation.

| Requirement / acceptance | Backend + persistence | Protected API / UI | Test/assertion evidence | Classification and remaining gap |
| --- | --- | --- | --- | --- |
| FR01: notice version/purpose and decision before submission | `main.record_consent`, `Consent`; `active_consent` | `/consents`, student full notice/choice; acceptance not preselected | `test_consent_lifecycle.py`, frontend lifecycle; submission disabled without ACTIVE | Partially implemented: synthetic notice/registry accessible; approved operational notice/comprehension validation external |
| FR02: every invalid/elapsed/withdrawn path blocks processing | `active_consent`, `check_case_consent`, recovery and stage guards | submit/review/record operations; status/withdrawal UI | `test_submission_recovery.py`, `test_workflow.py`, `test_review_records.py`, exact-expiry tests | Implemented and accessible for tested synthetic states; real provider policy/deletion integration external |
| FR03: pseudonymous case, separate linkage | `Account`, `Consent`, `CaseLink`, `Case`, fixture-only Job | owner status/lifecycle; pseudonymous queue | schema/FK and identity-free adapter assertions | Partially implemented: logical tables share database owner; no physical trust-store separation or real-data storage claim |
| FR04: minimized, validated, versioned C2–C4 routing | `call_service`, `process_job`, audience service auth | internal v1 APIs, mock labels and disclosures | contract tests, service-auth and malformed/context mismatch tests, Compose workflow | External integration dependency: mock routing implemented; real C2/C3/C4 provider/research release absent |
| FR05: stored versions/correlation | `Case.provenance`, ServiceProvenance; disposal clears it | review evidence versions; filtered admin case operations; owner-safe provenance validation receipt | provenance validation/correlation and disposal assertions | Implemented and accessible for literal mock versions; actual evolving provider versions external |
| FR06: bounded timeout/retry/idempotency/safe failure | 3-attempt PG Job, leases/fencing, submission fingerprint/recovery | safe error codes and separate workflow states | failure injection, IntegrityError recovery, PG concurrency/lease tests | Partially implemented: tested narrow worker; no backoff/jitter, distributed soak or operator replay UI |
| FR07: authorized valid evidence before review task | `process_job.finish`, `Review`, `Assignment`, `authorized_review` | review-queue and task APIs / assigned queue | no task on failed/expired publication; assigned/unassigned and queue policy tests | Implemented and accessible; actual designated auto-assignment is development policy, not institution-approved allocation |
| FR08: role + resource authorization | current_account/require_role; CaseLink/Assignment; refreshed policy checks | owner APIs, counsellor task/record, ADMIN audit only; verified role/assignment shown | `test_auth.py`, operations role matrix, foreign-owner tests, session continuity | Implemented and accessible in synthetic scope; real identity, deployment TLS and comprehensive denial-audit coverage external/remaining |
| FR09: human status, interpretation/follow-up without clinical autonomy | ReviewAction, ReviewRecord; start/save/complete guards | existing record API; filtered queue and read-only saved record | `test_review_records.py`, new queue/relogin test, frontend record tests, browser reopen | Implemented and accessible: one immutable synthetic record; edits/longitudinal follow-up unimplemented unless subsequently required; no outreach or clinical suitability claim |
| FR10: propagate withdrawal to work/access/content | consent/withdrawal receipts, dispose, Retention; delete ReviewRecord, clear Job/Assignment/derived fields | pre/post-submission withdrawal + confirm dialog/status; denied review | lifecycle/withdrawal/record suites, PG races and Docker smoke | Implemented and accessible under current dev policy; full identity/audit retention policy and provider deletion agreements external |
| FR11: append-only lifecycle audit without text | audit.record/flush_pending, stable IDs, Audit, DB triggers | restricted allowlisted admin receipts; owner receipt view | append-only rejection tests, rollback/pending receipts, content exclusion, unknown status/event omission | Partially implemented: core events accessible; every denied request/order/transport alerting is not covered; no cryptographic tamper-evidence claim |
| FR12: authorized versions/failure/retention/access evidence | new operations.audit_events, existing Audit/Case/Retention; no new table | ADMIN `/admin/audit-events`, staff `/admin`; date/type/case filters + cursor | role denial, pagination/date bounds, allowlist/notes/identity absence, provenance withholding, logout | Implemented and accessible for scoped existing metadata. No arbitrary logs/query API; missing historical events remain missing |

## Quality requirement trace

Source: proposal p28. Proposed numerical targets are not accepted research outcomes.

| Requirement / acceptance | Implementation / persistence / API / UI | Actual assertion or evidence | Classification / remaining work |
| --- | --- | --- | --- |
| NFR01 privacy: identity excluded from providers, raw text absent from logs/audit | fixture jobs, linkage boundary, SafeError/logging middleware, explicit admin projections; no browser storage | adapter identity exclusion, audit/demo/admin content checks, Docker log scan | Partially implemented: synthetic evidence; real minimization/anonymization belongs to C2; DB operators trusted |
| NFR02 security: auth/resource least privilege + TLS | JWT/refresh sessions, CSRF, Argon2, RBAC, namespaced cookies; role screens | backend role matrix, session tests, browser boundaries | Partially implemented: HTTP localhost; no verified TLS or at-rest encryption; admin has no counselling access |
| NFR03 consent integrity: invalid/expired/withdrawn operations blocked | shared guards and case-before-consent locks; state models | expiry/recovery/withdrawal and race suites | Implemented and accessible for tested policies; approved notice and external service enforcement remain dependencies |
| NFR04 auditability: reconstruct critical events and proposed 95% target | existing append-only audit + safe admin viewer, new bounded ADMIN_EVIDENCE_ACCESS | historic 29-observation catalogue separately dated; new API/save/read assertions | Partially implemented; no new universal percentage, full expanded denominator or administrator-proof history claim |
| NFR05 interoperability: schemas, version rejection | central models/generated schemas/OpenAPI/TS; mock adapters | drift, invalid version/unknown field/context tests | Implemented for current mocks; strict consumers must regenerate new additive contracts; real versions awaiting integration |
| NFR06 reliability: safe outcomes on duplicates/timeouts/malformed data | worker fencing/idempotency, safe client retry and stale clearing | reliability tests, PG harness, network/late-401 concurrency tests | Partially implemented; distributed soak/backoff/process-kill evaluation remains |
| NFR07 performance: proposed p95 C1 overhead <500ms excluding AI | retained c1_performance.py narrow core proxy, no UI-generated timings | older 200-sample result retained with boundary/date limitations; no new benchmark | Partially evaluated; broad-boundary repeated load and target validation missing; expensive evaluation not rerun for UI work |
| NFR08 modifiability: version change localized | shared adapters/contracts/ADRs; additive operational endpoints | generation/drift and existing adapter tests | Missing research evaluation: controlled change experiment/ATAM analysis not completed |
| NFR09 deployability: proposed clean private setup <30min/external secrets | Docker/Compose/bootstrap ignored .env, migrations, health checks | actual current build/start/health/schema/smoke results in verification note | Partially implemented; no timed clean private TLS deployment study or cloud deployment |
| NFR10 human oversight: decision support + authorized human action | separate workflow/review states, FR09 authoring/read-only record, full safety notice | server state/action tests and three-role browser walkthrough | Implemented engineering controls; human task/usability/clinical evaluation external; C4 final dashboard ownership retained |

## Delivery boundary

New APIs reuse current auth/consent helpers and existing rows. No migration is required:
no persistence structure or merged migration changed. `ADMIN_EVIDENCE_ACCESS` is a new
safe event type in the existing audit table. Evidence reads are recorded once per
authenticated session; refresh rotation starts a new bounded session. Polling/filter/page
requests do not create per-request audit rows. These receipts do not expose actor identities
or establish complete security-denial auditing.

New queue endpoint has state/offset bounds, excludes unavailable consent/cases and rechecks
authorization on each item/open/action. Existing task list/detail/action/record APIs remain
compatible. The queue returns references and timestamps, not review text. Admin returns
only explicitly allowed event/outcome pairs, with current permitted provenance for a selected
case. Provenance is withheld after disposal/invalid consent; old versions are not invented.

See [implementation verification and demo instructions](c1-workspace-verification.md) for
exact changed files, actual current results, screenshots, commands and remaining limitations.
