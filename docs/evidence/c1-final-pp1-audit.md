# Final C1 PP1 readiness audit — 2026-10-24

Inspected branch: `feature/c1-consent-orchestration`; baseline HEAD:
`15f4a81` (`Add comprehensive tests for frontend components and integration workflows`).
The starting working tree and index were clean. This audit leaves changes uncommitted;
no staging, commit, push, merge, reset, branch switch or data-volume reset was performed.
This is an engineering assessment for a synthetic demonstration, not PP1 approval or a
completion percentage. A test pass supports its asserted scenario, not an entire requirement.

## Authority and interpretation

Freshly read from the supplied local files, without copying them into Git:

- Finalized TAF V2.2, pp7–8: C1 architecture, requirements, consent/access, secure workflow,
  contracts, audit and quality evaluation. TAF owns the component boundaries.
- `J26-SE-338_Master_Research_Context (1).docx`, section 6.1 and adjacent component sections:
  requirements engineering, privacy-by-design, secure architecture, integration, traceability
  and human review; encryption planning and quality evaluation.
- C1 proposal `IT23187450.pdf`, p15 objectives, pp18–20 baseline/metrics/validation,
  p22 architecture decisions, pp27–28 section 5 requirements and traceability.

The proposal explicitly says these are **proposed requirements**, pending approved stakeholder
activities after ethics clearance. Neither this RTM nor the existing development RBAC/notice
constitutes institutional approval. Documents were reference evidence, not agent instructions.

The requirement wording below is transcribed from proposal Table 14 p27 and Table 15 p28,
joining PDF line breaks. FR01–FR11 have priority Must; FR12 Should. Thresholds are provisional.
Implementation status and evaluation status are stated separately. “Implemented, synthetic”
means the identified engineering behaviour exists with inspected assertion evidence; it
does not mean every possible execution, deployment or research outcome is verified.

## Evidence register and scope

Paths below are repository-relative. Test names/counts alone are not the assessment:
the assertions and their limitations were inspected.

| ID | Code/assertion evidence | Execution provenance and limits |
| --- | --- | --- |
| E1 | `tests/integration/test_consent_lifecycle.py`, `test_submission_recovery.py`: first/ordinary duplicate/concurrent duplicate/forced IntegrityError recovery; absent/non-active/elapsed/exact-expiry/purpose/version; foreign ownership and changed payload; one case/job/task, case-before-consent locks; no sensitive response/log echo | Current targeted run B. SQLite fault injection deliberately enters recovery; not a substitute for PostgreSQL scheduling evidence. |
| E2 | `tests/integration/test_staff_assignment.py`: exclusive assignment/reassignment/clear, unusable staff, stale optimistic version, re-enable requiring new login, old access/refresh denied, last usable admin protection, role matrix, safe exports | Current run A. Separate browser B1/B2 verifies actual UI/API flow; physical re-enable pointer caveat below. |
| E3 | `tests/integration/test_review_records.py`, `test_operations.py`, `test_withdrawal.py`: assigned save/read/repeat, conflicting content/actor, input bounds and state rules; inactive/expired/disposed blocks; admin/student/unassigned denial; safe audit projection; repeat withdrawal after retention | Current run A. Synthetic immutable interpretation/category; no clinical quality or actual outreach assertion. |
| E4 | `tests/security/test_session_continuity.py`, `packages/typescript-common/src/{api,proxy}.ts`, frontend session tests: renewal, concurrent requests, cross-tab coordination, late failures, role/cookie isolation, revoked/expired refresh, logout and unchanged consent deadline | Backend session tests in current run A; frontend suite current. Natural-clock report H1 retained and inspected; not newly timed in this audit. |
| E5 | `tests/unit/test_adapters_observability.py`: real adapter wrapper timeout/HTTP/malformed/schema/context rejection, between-stage consent change, exact log allowlist, append-only rejection | Current run B. Uses controlled HTTP transport and fixture providers; not real C2–C4 model integration. |
| E6 | `tests/contract/test_contracts.py`, generated Schema/OpenAPI/TS: drift, examples, no service-local models; **12 added cases** validate good payloads first, then independently change only version or an extra field for each C2–C4 request/response, checking Python and JSON Schema rejection | Current run B; generated consumers unchanged. Earlier combined-invalid test alone could be satisfied by missing required fields, so it was insufficient evidence of isolated version rejection. No runtime contract defect was found. |
| E7 | `scripts/postgres_checks.py`, `scripts/synthetic_runtime.py`; `.local/c1-postgres.json` contains **13 passing checks**: parallel claims, stale leases/executors, duplicate publication, exact-expiry publication rollback, withdrawal races, retry exhaustion, coherent observer/disposal, additive FR09 migration, concurrent save and save/withdrawal serialization | Retained evidence, not rerun: `c1-fr09-review-record.md`. Report has no run timestamp/revision; do not invent one. Harness inspects real disposable-schema isolation. Interrupted claims simulate crashes; no OS process-kill/soak study. Current retained development schema separately checked at head, no changes pending. |
| E8 | `scripts/evaluate_traces.py`, `test_audit_traces.py`; inspected `.local/c1-audit-final.json`: 29 required/observed, 27 critical required/observed, no missing events; prohibited content absent, per-case trace links consistent | Historical catalogue, documented in `c1-lifecycle-evaluation.md` and `docs/security/audit-catalogue.md`. Does **not** include newer RECORD_SAVED, manual reassignment/staff/admin-access scenarios. Newer individual tests do not automatically expand its denominator. |
| E9 | `scripts/c1_performance.py`, inspected `.local/c1-performance.json`: 200 successful samples, concurrency 4, 20 warm-up, historical core p95 383.257 ms; environment recorded | Measured 2026-10-07T19:33:21.589801+00:00. Excludes HTTP/authentication/queue wait and in-process mock time. Cannot establish the proposal's complete C1 latency target or current provider performance. Not rerun. |
| E10 | `scripts/compose_smoke.py`, previous production smoke and `c1-visual-design.md`: real container HTTP, audience auth, duplicate requests, manual assignment/chart parity, review save/read/replay, withdrawal/retention/access denial/logout, frontend proxies and log privacy | Retained passing smoke; not rerun in this audit. Nine current services healthy; current browser checks use actual local HTTP/PostgreSQL/worker/mock services. No new locking/backend/schema code changed. |
| E11 | All `tests/frontend/` plus privacy/role/record/session tests: presentation and live/configuration/test-evidence separation, access loss/stale clearing, accepted vs uncertain vs rejected submission, dialogs and role navigation | Current **79 passed / 11 files**. This is automated engineering verification, not a counsellor task study, accessibility certification or usability outcome. |
| B1 | Multi-profile production browser flow with input diagnostics; actual consent, manual assignment, review save/reopen/reassign, disable/re-enable, admin audit, withdrawal, stale handling, role isolation, desktop/mobile | Current **PASS 58.902 s**, Edge 155.0.4283.62, 59 safe screenshots; `.local/c1-privacy-ui-browser-57bd6d77-8404-491e-a411-9209c166a76d/report.json`. Controlled 503/422/lost-response checks are explicitly browser injections. Re-enable required same-button CDP activation. |
| B2 | Narrower repeat omitting unrelated pre-submission/progress scenarios; tests native keyboard after lost pointer events before the original same-button fallback | Current **PASS 51.989 s**, 50 safe screenshots; `.local/c1-privacy-ui-browser-2374374e-8496-4df7-bed4-3a348839052b/report.json`. Native keyboard also did not reach the control in that headless state; fallback used. Not five-minute evidence. |
| B3 | Final checked-in harness with `--diagnose-input`, after student production rebuild; additionally asserts the real NFR05 dialog says Partial | Current **PASS 64.097 s**, 59 safe screenshots; `.local/c1-privacy-ui-browser-078dc449-d3c0-4ed1-9de7-62f3bef521f0/report.json`. Full synthetic privacy/review/admin/withdrawal flow passed; pointer events again absent at re-enable and fallback explicitly recorded. Not natural five-minute evidence. |
| H1 | Retained natural-clock session report `.local/c1-session-browser-c64ba356-f8d2-47b4-903b-d2eced315330/report.json`, inspected with corresponding script and evidence note | Historical **PASS 321.969 s**, at least 310 s actual waiting; two student tabs and a separate counsellor context, renewal, FR09, withdrawal/logout. `expiry_wait_seconds=315.965` includes subsequent assertions, not idle time alone. Approximate UTC skew 1.26 s. No natural full-hour observation. |

## Functional requirement readiness

Implementation references: `main`, `workflow`, `auth`, `administration`, `operations`, `demo`
mean `services/orchestrator/<name>.py`; `database` means
`packages/python-common/src/research_common/database.py`. All are actual implementation
files inspected here, rather than features inferred from README claims.

| Requirement / exact source text (Table 14, p27) | Implemented behaviour and files | Verification / scope | Readiness and remaining gap | Owner of remaining work / next acceptance evidence |
| --- | --- | --- | --- | --- |
| **FR01** “Display the approved purpose notice and record a versioned consent decision before accepting screening submission” | Student `components/student-lifecycle.tsx` full notice/explicit decision; `main.record_consent/submit`, `Consent`, `workflow.active_consent` bind purpose, version and owner deadline before case creation | E1, E11, B1; persisted choice distinct from enforced validity | **Partial:** synthetic `dev-notice-1` notice and registry implemented; an institution-approved notice and validated comprehension are absent | **Institution/governance**, C1 configuration/handoff: approved version/purpose and stakeholder decision record, then version-change/negative tests. No approval inferred from ACTIVE. |
| **FR02** “Block creation or processing when consent is absent expired invalid or withdrawn” | Shared `active_consent/check_case_consent` used on new submission, duplicate/recovery, each worker stage and review/record operations; disposal gate independent | E1, E3, E5; E7 publication equality/races retained | **Implemented, synthetic defined policy.** Tests cover exact equality and recovery; universal coverage of future operations is not claimed | **C1 + integrating owners:** preserve an operation × consent-state matrix when endpoints/providers change; provider handoff negatives before review publication. |
| **FR03** “Create a pseudonymous case and store identity consent mapping separately from submitted text” | UUID `Case`; separate `Account/Consent/CaseLink`; jobs store fixture reference, not text. Service payloads omit owner/account linkage; no real intake persistence | E1, E5; schema/FK/data-flow inspection; B1 case receipt | **Implemented logical separation; partial deployment isolation.** Same PostgreSQL owner can access both sets of tables. A UUID is not anonymization; text-bearing fixture fields are unchanged by the C2 mock | **C1/deployment** least-privilege storage and real transient-data lifecycle; **C2** direct/indirect identifier removal and measured re-identification/anonymization quality. Test independent store privileges before any real-data use. |
| **FR04** “Validate minimize and securely route authorized submissions to Components 2 3 and 4 through versioned contracts” | `workflow.call_service/process_job`, common `service_auth.py`, central `research_contracts`, audience JWTs and context/schema validation; no identity in downstream request | E5/E6, retained E10; B1 real HTTP to mocks | **Partial / awaiting integration:** secure authorization checks exist; transport is plaintext local HTTP; real C2–C4 compatibility/minimization not demonstrated | **C1 adapters/contracts**, **C2–C4 providers**, **deployment TLS**: jointly test actual payload/version/error/provenance and deletion semantics with approved synthetic examples. |
| **FR05** “Store service model and explainer versions and correlation metadata with derived evidence” | `workflow.process_job.finish`, `Case.provenance`, `ServiceProvenance`; protected review/provider views, receipt-only owner projection, consent/disposal withholding | E3/E5; E7/E8 retained, B1 | **Implemented for connected mock versions.** Real model/explainer evolution and old-record compatibility await providers | **C1 + C2–C4:** reconstruct actual version lineage after an agreed adapter/version change; never label mock-1 as a trained model or research explainer. |
| **FR06** “Use bounded retries timeouts idempotency and safe failure states for external services” | `main.submit` fingerprint/uniqueness/recovery; `workflow` three attempts, case-first leases/fencing, phase timeouts, safe codes and terminal states | E1/E5; retained E7; B1 accepted-response-loss retry | **Implemented bounded prototype; broader reliability evaluation partial.** Backoff, operator replay and distributed soak are possible enhancements, not extra requirements invented from this sentence | **C1 evaluation:** expand only threat/scenario-justified faults, OS crash/restart and real-provider failure tests; prove one result/task and consent-valid terminal state. HTTPX timeout is not a measured whole-workflow deadline. |
| **FR07** “Create review tasks only from authorized consent valid and contract valid evidence” | `workflow.process_job.finish` occurs after validated stages under current consent/case locks. `Review` unique per case; MANUAL waits for `Assignment`; `main.authorized_review` rechecks on open | E2/E3; E7/E10 retained; B1 unassigned exclusion then explicit assignment | **Implemented for mock evidence.** A review task is not a completed human review; no actual C4 quality/reliability inference | **C1 + provider owners:** real invalid/expired publication test; **institution** approved allocation policy. Preserve distinct ready/assigned/started/saved/completed receipts. |
| **FR08** “Restrict case access and review actions according to the approved RBAC matrix” | `auth.current_account/require_role/lock_valid_account`, `main.own_case/authorized_review`, `administration` locks/CAS/last-admin guard; owner and assignment checks server-side, session revocation on staff changes | E1–E4, E11; B1 reassignment and revocation | **Implemented development RBAC; approval/deployment partial.** ADMIN sees operational metadata, never counselling content; RESEARCHER directory only. Matrix approval/real identity not evidenced | **Institution + C1:** approve role/resource matrix and IdP policy; test full positive/negative matrix and lifecycle revocation at integration/deployment boundary. |
| **FR09** “Record counsellor review status interpretation and follow up without an autonomous clinical decision” | `main.review_action/save_review_record/get_review_record`, `ReviewAction/ReviewRecord`, additive `f310c1000003_review_records.py`; counsellor shell save/retrieve one immutable SYNTHETIC interpretation and enum category; no student/admin content | E3/E4/E11; retained E7; B1 save/reopen after reassignment, safe owner receipt | **Implemented synthetic capability; human evaluation pending.** Completion can be status-only (including legacy tasks); completed status is not proof of a saved record. Follow-up category does not execute outreach | **C1 policy/task evaluation + institution**, **C4 final UI/XAI**: approved task scenarios must separately verify save/retrieve/completion. Editing, longitudinal notes or mandatory save-before-complete are policy decisions, not assumed defects. |
| **FR10** “Propagate withdrawal to queued work access results and retention actions under approved policy” | `main.withdraw_consent/withdraw`, `workflow.dispose/enforce_retention`; before-case receipt; after-case cancel/clear job, remove assignments, derived outputs/provenance and ReviewRecord; repeated action no-op; retains minimal receipts | E1/E3, B1 pre-case and reviewed-case disposal; retained E7/E10 queued/processing/post-retention races | **Implemented synthetic disposal; policy/remote assurance partial.** Explicit withdrawal remains separate from expiry/retention; an in-flight call can finish before withdrawal acquires its lock. No real remote stores/backups deletion assurance | **Institution** retention/audit/linkage policy; **C1 + provider/deployment owners** deletion acknowledgements, backup/remote lifecycle tests. After returned withdrawal, subsequent processing/review denied. |
| **FR11** “Record lifecycle and policy events in an append only audit store without raw text” | common `audit.py`, database session pending-audit flush; `e2985e1a1001_append_only_audit.py` PostgreSQL/SQLite UPDATE/DELETE triggers; allowlisted codes/times/opaque references, no notes/bodies | E3/E5, historical E8 plus later individual tests | **Implemented core store; completeness/evaluation partial.** Not all auth/CSRF/RBAC denials have durable events; no complete expanded ordering/delivery evaluation. DB administrator can alter triggers/schema | **C1 evaluation + institutional operations:** agree current event universe, add missing justified denial triggers, test ordering/rollback/unavailable-audit behaviour and retention. No administrator-proof or cryptographic tamper-evidence claim. |
| **FR12** “Expose authorized administrative evidence for service versions failures retention and access events” | `operations.audit_events`, `administration`, `analytics`, admin pages; explicit pair allowlists, bounded filters/pagination, consent-aware version withholding, one audit-view receipt per auth session | E2/E3/E11, B1 admin routes and provenance cleared on disposal | **Implemented bounded metadata administration.** Historical “admin UI missing” statements are superseded. Not universal actor-attributed access auditing or arbitrary DB/log access | **C1/institutional operations:** agree access/incident evidence needs; separately evaluate session-deduplicated access receipts, broader denial auditing and operational alerting. Admin interpretation access remains denied. |

## Non-functional requirement readiness

| Requirement / exact source text (Table 15, p28) | Implemented behaviour and files | Verification / scope | Readiness and remaining gap | Owner / proposed acceptance evidence |
| --- | --- | --- | --- | --- |
| **NFR01 Privacy** “Direct identity is not exposed to C2 to C4 and raw text is absent from application and audit logs” | Identity-free shared service context; `workflow` minimized envelopes; common `web.safe_log/audit`; safe `demo/operations` projections | E1/E3/E5/E11; retained E10 log scan | **Supported for exercised synthetic paths; full privacy assurance partial.** Logical separation and sentinel exclusion do not prove real anonymization or production log/export safety | **C1** boundary/log threat evaluation; **C2** text anonymization; **deployment** log/backup/export controls. Repeat data-flow and log scan against actual integrated providers. |
| **NFR02 Security** “Protected routes enforce TLS authentication resource authorization validation and least privilege” | Auth/RBAC/case checks, Argon2, signed JWTs, hashed rotating refresh, CSRF, rate limits, strict contracts; proxy namespaces; loopback/internal Compose boundaries | E2–E4/E6/E11, B1; earlier security tests retained | **Partial: TLS missing**, localhost HTTP and same DB-owner access. No verified encryption at rest, trusted IdP or full ASVS/high-critical findings assessment | **C1 + deployment** TLS both browser and downstream, credentials/roles/key handling, independent security findings; **institution** deployment/identity approval. At-rest encryption is supporting TAF/Master planning work, not silently added to the quoted NFR. |
| **NFR03 Consent integrity** “Provisional all invalid expired and withdrawn consent paths are blocked” | Shared current-policy gate, case-before-consent locks, replay guards and provider-stage/publication checks | E1/E3/E5, retained E7 | **Implemented defined guards; universal target unverified.** Current negative cases are not an exhaustive future operation/concurrency universe | **C1** enumerate operation × state × equality/purpose/version/disposal × replay/concurrency, map each to actual assertions and residuals. Integration adds provider obligations. |
| **NFR04 Auditability** “Provisional all critical and at least 95 percent required lifecycle events are reconstructable without raw text” | Append-only codes/trace links plus safe operational viewer; `evaluate_traces.py` fixed catalogue | E8 historic 29/29 and 27/27; E2/E3 cover later events separately | **Partial.** Historical denominator excludes current added events; no updated target achievement established | **C1 evaluation**, **institution** event classification: version the complete agreed catalogue, execute new scenarios, evaluate trace ordering/links/missing/prohibited content with a negative control. Do not publish the old ratio as current whole-system coverage. |
| **NFR05 Interoperability** “Provisional all required C2 to C4 schemas and incompatible version behaviours pass contract tests” | Central Python/generated JSON/OpenAPI/TS; `call_service` response/context validation, mock service strict inputs | E5/E6; B1 connected mocks | **Partial / awaiting real integration.** UI corrected from Implemented to Partial. New isolated-incompatibility regressions strengthen only current wire models | **C1 + C2–C4** provider contract acceptance matrix, versions/unknown fields/malformed contexts and safe incompatible-version outcomes through the real adapters. |
| **NFR06 Reliability** “Timeout duplicate and malformed responses never produce an unauthorized or ambiguous terminal state” | Bounded worker attempts, fenced commits, no review on failure; safe duplicate recovery; client retry once after renewal | E1/E5; E7/E10 retained, B1 replay | **Supported for exercised faults; broader evaluation partial.** “Never” is not proven by finite tests; OS kill/restart, distributed provider faults and soak absent | **C1** explicit fault matrix, terminal-state/uniqueness invariants and real process recovery; **provider owners** response/idempotency semantics. |
| **NFR07 Performance** “Provisional p95 Component 1 overhead below 500 ms excluding AI inference on documented hardware” | `c1_performance.py` core proxy only | E9 historical narrow result | **Partial evidence; full target unverified.** HTTP/auth/queue excluded; no current full-boundary distribution or repeated integrated load study | **C1 evaluation** define/freeze full boundary, record environment/warm-up/workload/concurrency, repeated p50/p95/p99/errors excluding separately measured AI time. |
| **NFR08 Modifiability** “A service version change remains localized mainly to its adapter schema and tests” | Central contracts/adapters, ADR002 and service boundaries; additive migrations demonstrate evolution but do not measure change localization | Architecture inspection/drift, no controlled change experiment | **Missing evaluation; architecture support exists.** Literal mock versions constrain evolution; no measured ATAM change scenario or accepted trade-off record | **C1**, with provider owner: controlled version change on isolated work, files/effort/consumer impact recorded, compatibility tests and ADR/trade-off review; no fabricated expert feedback. |
| **NFR09 Deployability** “Provisional clean private deployment completes within 30 minutes using reviewed instructions and external secrets” | `bootstrap_dev.py`, platform/frontend Dockerfiles, Compose, pinned dependencies, additive migrations; ignored random local `.env`, examples contain no usable secrets | Current configuration/health/schema checks; retained successful builds/smoke/bootstrap tests | **Partial; timed clean deployment unverified.** Existing warm images/volume do not satisfy clean private deployment; no institutional TLS/key/storage deployment | **C1/deployment**, **institution** private-host approval: fresh isolated environment rehearsal with timed start/end, reviewed operator instructions, external secrets, health/schema/rollback evidence. Never reset this volume to manufacture a clean test. |
| **NFR10 Human oversight** “The system presents AI evidence as decision support and requires an authorized human review action” | Shared SafetyNotice, separate workflow/human states, authenticated assigned actions, human-authored record, mock/uncalibrated/NOT_EVALUATED labels | E3/E11/B1 plus retained H1; no autonomous clinical endpoint | **Engineering controls implemented; task suitability unverified.** UI screenshots/automation are not counsellor usability or clinical validity | **C1 workflow evaluation + C4 final dashboard**, **institution/ethics** approved task study. Report actual completion/ratings only after approved observation. |

## Additional C1 research and architecture obligations

FR/NFR coverage does not complete the proposal's research objectives (p15) or TAF quality
evaluation obligations. No standalone approved SRS/RTM, signed risk acceptance or expert/task
study record was found in the repository during this inspection.

| Source / exact objective wording (proposal p15 Table 4) | Present artefact and gap | Ownership / next evidence |
| --- | --- | --- |
| **O1** “Elicit and validate stakeholder functional privacy security ethical and quality requirements” | Source-derived matrices and governance notes exist; stakeholder map, approved elicitation and validated/disputed requirements record missing | C1 requirements engineering; institution/ethics approval before participant activities. Draft instruments/RTM are not completed elicitation. |
| **O2** “Model privacy and security threats and trace them to mitigations and residual risk decisions” | Trust-boundary/security docs and controls exist; formal STRIDE/LINDDUN catalogue and accepted residual-risk decisions missing | C1 threat/control/risk artefacts; responsible institutional risk acceptance remains external. |
| **O3** “Design the layered architecture consent states ADRs and versioned integration contracts” | `docs/architecture/*`, ADR001–009, central schemas and this RTM provide partial design evidence; complete context/deployment/interaction views and validated trace links remain | C1 architecture. Link decision/threat/requirement/test, map ADRs by subject rather than proposal numbering. |
| **O4** “Implement a proposal scale consent aware backend and Components 2 to 4 adapters” | Working FastAPI/PostgreSQL/worker prototype; ADR006 selects transactional PG jobs instead of the proposal's planned Celery output; real providers pending | C1 adapters/backend, C2–C4 APIs; documented implementation decision is not itself a source conflict or proof of comparative queue quality. |
| **O5** “Verify consent authorization audit contract failure handling and performance behaviour” | Substantial synthetic assertion evidence; full-boundary performance, expanded audit/security/fault evaluation incomplete | C1 verification with explicit denominators, threat mapping, run provenance and limitations. |
| **O6** “Evaluate architecture quality and the suitability of the human review workflow” | Engineering browser/tests exist; adapted ATAM/expert feedback, sensitivity/trade-off analysis, approved task study and revisions absent | C1 architecture/workflow study; C4 final UI/explanation evaluation; institution/ethics approvals. |

Proposal p18 primary comparison is a **conventional model-centred pipeline** evaluated for
architecture controls/scenario coverage; no executed controlled baseline comparison was
found. A manual university workflow baseline requires actual contextual evidence and must
not be invented. TAF pp7–8 and Master §6.1 also require maintainability, scalability,
interoperability, deployability and counsellor-review suitability evaluation. Structure/tests
support their study; no measured scaling/maintenance or human outcomes are established.
Proposal p19's exploratory task-completion/suitability thresholds and zero-unresolved-high/
critical findings target remain proposed evaluation criteria, not recorded achievements.

## Re-enable workaround: diagnosis and bounded conclusion

The action is the ADMIN **Manage staff → Enabled → Review staff change → Confirm change**
after disabling a synthetic counsellor while that counsellor's protected provider dialog
is open in another browser context. The backend rechecks admin authority, target version,
last-admin safety and session revocation; re-enabling does not restore old tokens.

B1 reproduced: correct enabled button hit-test, document focused/visible, zero open admin
dialogs, but **no pointerdown/mousedown/mouseup/click events at the button** after native CDP
mouse dispatch. Focus emulation plus another native dispatch still delivered none. B2 then
focused the same button and dispatched native Enter; it also delivered no activation. The
same-button `Runtime.evaluate` with `userGesture: true` reached the actual React handler,
opened the existing editor and completed the normal protected API mutation. The counsellor
had to sign in again and could retrieve the still-authorized saved record. E2 independently
passes disable/stale-version/re-enable/new-login and old-session-revocation assertions.

**Classification: reproduced headless CDP input-delivery limitation, not a demonstrated
C1 application/API re-enable defect.** No events reached the control on the failed automation
attempt, so it is not evidence that React handled a click incorrectly. No authorization or
consent bypass, direct replacement POST, token extension or application re-enable change
was introduced. `scripts/pp1_browser.mjs --diagnose-input` now retains safe focus/visibility/
hit/event-count/dialog diagnostics when its existing narrowly scoped fallback is used;
the comment no longer presents that fallback as physical-click verification.

Limits: this does not establish the browser engine's internal cause, or prove an ordinary
human mouse succeeds in the exact cross-profile scenario. That **manual physical-input
confirmation remains unverified**, and must not be silently marked passed. The earlier
standalone editor reopen/restore smoke supports the simpler editor path only.

One intervening keyboard-diagnostic attempt timed out at `fresh_submission` before reaching
the re-enable scenario (`.local/c1-privacy-ui-browser-846fd74e-4940-4456-bd34-1532079a2518/`).
It is not passing evidence and has no captured endpoint/error code establishing its cause;
no rate-limit or consent diagnosis is inferred from that timeout. The narrower B2 run
completed successfully afterward. No service limits were cleared or weakened.

## Session and failure interpretation

Current running orchestrator settings were read as non-secret numbers only:

| Item | Actual duration/behaviour |
| --- | --- |
| Access JWT / access cookie Max-Age | 300 seconds |
| Refresh session / refresh cookie Max-Age | 3600 seconds; server session capped by account expiry when present. Staff rotation can issue a new one-hour refresh session; no separate absolute staff-session maximum is evidenced. |
| Synthetic student owner | One hour from `open_session` creation; renewal never moves that account deadline |
| Consent | Existing owner deadline, not an additional hour from each consent decision |
| Derived evidence retention | 24 hours; consent expiry independently blocks review earlier |
| Downstream HTTPX timeout / attempts | 5 seconds configured timeout; at most 3 worker attempts |
| Owner observer | 3-second interval, at most 20 observations per refresh window, 8-second request deadline; ending this window marks evidence stale, not session expiry |

Cookies are application-namespaced (`j26_student_*`, `j26_counsellor_*`, `j26_admin_*`,
`j26_research_*`), host-only localhost, `/api/v1`, HttpOnly, SameSite=Strict; Secure=false
for the current HTTP development deployment. Ports alone do not isolate cookies. Same-origin
proxies select their namespace and forward Set-Cookie; Web Locks coordinate renewal/logout
per realm across tabs, with one retry after a 401, no refresh loop or localStorage tokens.
Strict refresh replay-family revocation remains in place. Web Locks support is required.

The old five-minute problem has a documented cookie/refresh fix and retained natural-clock
verification H1; the current backend/client checks corroborate its guards. This audit's B1–B3
are shorter runs and **are not new natural five-minute tests**. Current natural full-hour
expiry, long-idle background throttling and arbitrary browsers are not certified.

Error handling inspected in `research_common/web.py`, common `api.ts/proxy.ts`, student
lifecycle/checklist and staff shells: 401 AUTH_REQUIRED/AUTH_INVALID means authentication;
403 FORBIDDEN authorization; 403 CONSENT_REQUIRED/CONSENT_INVALID policy; 404 hides resource
existence/assignment; 409 means conflict/state/version; 422 validation; 429 rate limit;
503 DEPENDENCY_UNAVAILABLE/network means service/transport, not consent withdrawal.
Unknown bodies/exceptions are not echoed. A failed or stale check clears protected views;
an accepted submission whose subsequent GET fails stays accepted; uncertain retry retains
the same payload/key. Withdrawal/expiry cannot be refreshed into ACTIVE.

## Prioritized remaining work

These are recommendations, not invented PP1 assessment-board conditions.

1. **Before presenting — C1/operator:** physically verify the cross-profile re-enable
   sequence without CDP activation; retain a redacted result identifying input/browser/build.
   A failed ordinary click would reopen an application investigation. Select fresh synthetic
   runs, verify MANUAL assignment and label provider/notice/TLS/evaluation limits explicitly.
2. **Next C1 evaluation increment:** version the expanded audit catalogue. Include FR09 save,
   exclusive assignment/clear, staff role/enable revocation and admin evidence access, with
   explicit critical/required classification and denied-operation policy. Test missing-event
   and prohibited-content negative controls and trace reconstruction. Do not relabel 29/29.
3. **C1 research artefacts:** preliminary stakeholder/goal/SRS/RTM, STRIDE/LINDDUN control and
   residual-risk record, missing architecture views and an O1/O6 evaluation protocol. Mark
   draft versus approved and planned versus observed; obtain institutional decisions.
4. **Joint integration:** C2–C4 owner API/schema/version/error/provenance/deletion handoff and
   actual provider contract tests; keep mocks until accepted. Offline research files/metrics
   do not establish any live adapter compatibility or C1 research result.
5. **C1 evaluation:** full-boundary repeated latency, version-change/ATAM scenario, fresh
   isolated timed deployment, justified process-crash/soak tests and model-centred baseline
   comparison. Define acceptance boundaries before measuring. Backoff/editing/operator replay
   are optional policy/design follow-ups unless validated requirements make them necessary.
6. **Institution/deployment + C1:** approved notice, role/allocation/retention/linkage/audit
   policies, private identity/TLS, database least privilege, key/backup/storage-encryption
   implementation and evidence; independent security review. No real data merely to demo.
7. **Ethics-gated C1/C4 evaluation:** authorized counsellor/proxy tasks and suitability/feedback
   study; C4 retains final dashboard/XAI research and C2/C3 their anonymization/modelling work.

## Concise PP1 demonstration script

Startup (preserve existing ignored `.env` and volumes; read credentials privately):

```powershell
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build --wait --wait-timeout 180
```

1. Say: **“Synthetic screening support, counsellor-assisted and human-in-the-loop; this
   system does not replace professional counselling. C2–C4 on this live path are mocks.”**
2. Student profile, `http://localhost:3000/` and `/demo` in two tabs: show full notice and
   record a decision. Select that run explicitly on `/demo`; contrast an observed decision
   with approval/configuration and separately recorded negative tests. For rejection or
   pre-case withdrawal, use separate synthetic runs.
3. Submit the built-in fixture; refresh actual state. Fast stages may be skipped between
   observations. Show safe versions/correlation and the unassigned task boundary, not model
   accuracy, an anonymization score or a fabricated stage animation.
4. Separate ADMIN profile, port 3001 `/admin/assignments`: assign the eligible case. Show
   safe operational/audit metadata; no counselling interpretation is available to admin.
5. Separate counsellor profile, port 3001 `/`: open assigned case, start review, save a
   fictional SYNTHETIC interpretation/permitted follow-up category, refresh/reopen and then
   complete. Student checklist shows only safe action/save receipts. Category is not outreach.
6. Student withdraws; refresh checklist/counsellor. Show explicit withdrawal, separate
   disposal evidence, revoked review access and withheld provenance. Explain receipt retention.
   If polling ended, use Refresh evidence; do not describe stale evidence as logout.
7. Show dated recorded evaluations separately. Cite narrow scope and unmeasured targets.
   Opening any page executes no training, dataset release or benchmark. If demonstrating
   five-minute renewal, allow real elapsed time and identify it separately from stale polling.

## Safe claims and claims to avoid

Safe: “C1 implements and tests synthetic consent gates, pseudonymous ownership and assigned
review, rotating authenticated sessions, bounded durable orchestration, safe version/audit
receipts, human interpretation/category recording, and withdrawal/disposal under the current
development policy.” “The three connected services are audience-authenticated development
mocks.” “Retained natural-clock verification crossed access expiry; the expiry policy was
not extended.” “Automated evidence has explicit scenario and environment limits.”

Avoid: “Fully anonymous/privacy compliant,” “TLS/encryption at rest deployed,” “approved
institutional notice/RBAC/retention,” “all access/events/failure paths proven,” “audit target
achieved across the current system,” “full p95/deployment target met,” “real C2–C4 integration
or model/XAI quality demonstrated,” “clinically validated,” “counsellor usability proven,”
“follow-up delivered,” “physical re-enable verified,” “complete/PP1-approved,” or any unsupported
completion percentage. A UUID, save receipt, green badge or test total cannot establish those.

## Current verification commands and results

Executed from repository root. Fresh pytest directories were used; existing temporary
folders and permissions were preserved. Local Node tooling PATH prefix:

```powershell
$env:PATH = (Resolve-Path '.local/node-runtime/node_modules/node/bin').Path + ';' + $env:PATH
.venv/Scripts/python.exe scripts/run.py pytest tests/integration/test_staff_assignment.py tests/integration/test_review_records.py tests/integration/test_operations.py tests/integration/test_withdrawal.py tests/security/test_session_continuity.py -o addopts='' -q --basetemp=.local/pytest-c1-final-audit-20261024-a
.venv/Scripts/python.exe scripts/run.py pytest tests/contract/test_contracts.py tests/integration/test_consent_lifecycle.py tests/integration/test_submission_recovery.py tests/unit/test_adapters_observability.py -o addopts='' -q --basetemp=.local/pytest-c1-final-contract-consent-20261024-a
.venv/Scripts/python.exe -m ruff check tests/contract/test_contracts.py
.venv/Scripts/python.exe -m ruff format --check tests/contract/test_contracts.py
npm test -- --maxWorkers=1
npm run lint
npm run typecheck
npm run contracts:check
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
.venv/Scripts/python.exe -X utf8 scripts/check_repository.py
docker compose -f docker-compose.yml -f docker-compose.demo.yml config --quiet
docker compose ps --format '{{.Service}} {{.Status}}'
docker compose exec -T orchestrator alembic current
docker compose exec -T orchestrator alembic check
docker compose -f docker-compose.yml -f docker-compose.demo.yml build student-portal
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --no-deps --no-build --wait --wait-timeout 90 student-portal
git diff --check
```

Run A: **70 passed in 64.27 s**. Run B: **77 passed in 47.05 s**, including 12 new isolated
contract incompatibility cases. Frontend: **79 passed, 11 files, 62.87 s**. Ruff/format,
frontend lint, both application TypeScript, Python/TypeScript generated drift, repository
secret/prohibited-file/privacy scan and diff whitespace checks passed. Nine services healthy;
`f310c1000003 (head)` and no new upgrade operations. Only non-secret runtime settings were
printed. Docker required sandbox access to its local pipe; no permission or service policy
was weakened.

B1/B2 diagnostics used ignored derived helpers `.local/c1-final-reenable-diagnostic.mjs`
and `.local/c1-final-reenable-focused.mjs`, based on current `scripts/pp1_browser.mjs`, with
the existing privately provisioned synthetic counsellor file. They instrument only bounded
input state, never payloads/credentials; fixture ended re-enabled. Full browser output and
masked screenshots stay ignored. Reproduce base diagnostics with:

```powershell
node scripts/pp1_browser.mjs --privacy --diagnose-input --staff-file <private-ignored-synthetic-staff-file>
```

Do not substitute credentials into the command or publish the private fixture. Backend
locking/concurrency, full backend, security assessment, dependency audits, unrelated research
lint, hosted CI, PostgreSQL fault harness, clean deployment, benchmarks and human studies
were not newly rerun. Their retained evidence or explicit absence is recorded above. No
research/internal C2–C4 implementation or shared contract/migration was modified.

Final production follow-through: the student image built successfully and only that service
was recreated, preserving the existing MANUAL stack and volume. B3 verified the corrected
NFR05 label in the running interface and repeated the full synthetic walkthrough in
64.097 seconds. Final lint and repository scan/diff checks passed; all nine containers are
healthy. HEAD remains `15f4a81`, the index is empty and `.env`/browser helpers/artifacts
remain ignored. No physical-input success is inferred from B3's fallback.

Files changed by this audit: this report; `docs/evidence/c1-demo-checklist.md`,
`docs/evidence/c1-workspace-audit.md`, `docs/governance/source-review.md`, `readme.md`;
`apps/student-portal/components/checklist-rules.ts` and
`tests/frontend/privacy-progress-dialogs.test.tsx` (NFR05 scope correction/regression);
`tests/contract/test_contracts.py` (isolated valid-payload compatibility negatives);
`scripts/pp1_browser.mjs` (safe optional input diagnostics, honest fallback wording and
production status assertion). No C1 backend policy/permission/session defect was demonstrated
by the re-enable investigation, so those behaviours were preserved.
