import type { DemoEvidence } from "@j26/common/contracts";

export type Result = "Verified in selected run" | "Not exercised" | "Failed" | "Unavailable or stale" | "Recorded configuration evidence" | "Recorded test evidence" | "Unverified";
export type Implementation = "Implemented" | "Partial" | "Missing" | "Unverified" | "Not applicable";
export const implementations: Record<string, Implementation> = {
  "FR01.a": "Implemented", "FR01.b": "Not applicable",
  "FR02.a": "Implemented", "FR02.b": "Implemented", "FR03.a": "Implemented", "FR03.b": "Implemented",
  "FR04.a": "Implemented", "FR04.b": "Partial", "FR05": "Implemented",
  "FR06.a": "Implemented", "FR06.b": "Implemented", "FR06.c": "Implemented", "FR07": "Implemented",
  "FR08.a": "Implemented", "FR08.b": "Implemented",
  "FR09.a": "Implemented", "FR09.b": "Implemented", "FR09.c": "Implemented", "FR09.d": "Implemented", "FR09.e": "Implemented",
  "FR10.a": "Implemented", "FR10.b": "Implemented", "FR10.c": "Implemented",
  "FR11.a": "Implemented", "FR11.b": "Implemented", "FR12": "Implemented",
  "NFR01": "Implemented", "NFR02.a": "Implemented", "NFR02.b": "Missing", "NFR02.c": "Unverified",
  "NFR03": "Implemented", "NFR04": "Implemented", "NFR05": "Implemented", "NFR06": "Implemented",
  "NFR07": "Partial", "NFR08": "Not applicable", "NFR09": "Implemented", "NFR10.a": "Implemented", "NFR10.b": "Implemented",
};
export type Check = { id: string; implementation: Implementation; title: string; result: Result; source: "Live event" | "Configuration evidence" | "Recorded test evidence"; detail: string; missing: string; time?: string | null; approval?: string; readiness?: string; evaluation?: string };

export const privacyGroups = [
  { id: "consent", title: "Consent and purpose", description: "Purpose, notice version and expiry gate each operation.", ids: ["FR01.a", "FR01.b", "FR02.a", "FR02.b", "NFR03"] },
  { id: "identity", title: "Pseudonymous identification", description: "Case references and separate linkage records limit identity exposure.", ids: ["FR03.a", "FR03.b", "NFR01"] },
  { id: "access", title: "Authentication, roles and assignment", description: "An active session, role and case assignment are required for review.", ids: ["FR07", "FR08.a", "FR08.b", "FR09.d", "FR09.e", "NFR02.a", "NFR02.b", "NFR02.c"] },
  { id: "routing", title: "Controlled orchestration and provenance", description: "Versioned adapters validate service outcomes and preserve permitted versions.", ids: ["FR04.a", "FR04.b", "FR05", "NFR05"] },
  { id: "withdrawal", title: "Withdrawal and retention", description: "Owner withdrawal blocks processing and review; disposal is checked separately.", ids: ["FR10.a", "FR10.b", "FR10.c"] },
  { id: "audit", title: "Audit and accountability", description: "Safe lifecycle and human-review receipts support authorized traceability.", ids: ["FR11.a", "FR11.b", "FR12", "NFR04", "FR09.a", "FR09.b", "FR09.c"] },
] as const;
export const secondaryIds = ["FR06.a", "FR06.b", "FR06.c", "NFR06", "NFR07", "NFR08", "NFR09", "NFR10.a", "NFR10.b"];

export const scopeNotes: Record<string, Pick<Check, "approval" | "readiness" | "evaluation">> = {
  "FR01.b": { approval: "Institutional notice and purpose approval pending; this is not executable application functionality." },
  "FR03.b": { readiness: "Logical identity/linkage tables are implemented. They share a database owner; independent store privileges are not deployed.", evaluation: "Real-data privacy evaluation is pending; C2 owns text anonymization." },
  "NFR01": { evaluation: "Synthetic identity/log exclusions are tested; real-provider data-flow and text privacy evaluation remain pending." },
  "FR04.b": { readiness: "Real C2–C4 APIs are not connected. The current service implementations are development mocks." },
  "NFR05": { readiness: "Current mock schemas are tested. Real C2–C4 provider/version compatibility awaits joint integration." },
  "NFR02.b": { readiness: "TLS is missing from the current localhost HTTP deployment, including downstream service transport." },
  "NFR02.c": { readiness: "Storage encryption is unverified. No retained host/storage/key-management evidence establishes it; approval alone would not establish encryption." },
  "FR10.a": { approval: "Institutional retention/withdrawal policy approval remains pending." },
  "FR10.b": { readiness: "Local derived-evidence disposal is implemented; remote provider and backup deletion assurance awaits integration/deployment." },
  "NFR04": { evaluation: "Expanded audit coverage is unmeasured. The historical 29-observation catalogue excludes later staff, assignment, admin-access and review-save additions." },
  "NFR07": { evaluation: "The retained core proxy excludes HTTP/authentication/queue overhead. Full-boundary measurement tooling and repeated target evaluation remain incomplete." },
  "NFR08": { evaluation: "Controlled service-version change/ATAM experiment is missing; shared contracts and adapters already exist." },
  "NFR09": { readiness: "A reviewed institutional private deployment is not established.", evaluation: "The proposed clean deployment within 30 minutes has not been timed on a fresh environment." },
  "NFR10.b": { evaluation: "Approved human task/suitability evaluation has not been performed; the non-diagnostic UI boundary is implemented." },
};
export const groupSummaries: Record<string, string> = {
  consent: "Consent controls implemented · Notice approval pending.",
  identity: "Logical identity separation implemented · Independent storage isolation and real-data evaluation pending.",
  access: "Role, owner and assignment checks implemented · Deployment TLS missing · Storage encryption unverified.",
  routing: "C1 mock-contract orchestration implemented · Real C2–C4 integration incomplete.",
  withdrawal: "Local withdrawal and disposal implemented · Institutional policy and remote deletion assurance pending.",
  audit: "Audit logging and protected review records implemented · Expanded audit coverage unmeasured.",
};
export function groupImplementation(rows: Check[]): Implementation | "Mixed" {
  const states = new Set(rows.map(row => row.implementation).filter(value => value !== "Not applicable"));
  if (states.size === 1) return [...states][0];
  return states.size ? "Mixed" : "Not applicable";
}

// Proposal IT23187450 section 5: subchecks never roll up to a requirement-wide pass.
export function checklist(e: DemoEvidence | null, stale: boolean): Check[] {
  const rows: Check[] = [];
  const live = (id: string, title: string, fact: unknown, detail: string, missing: string, time?: string | null, withheld = false) => rows.push({ id, implementation: implementations[id], title,
    result: stale || withheld ? "Unavailable or stale" : fact ? "Verified in selected run" : "Not exercised",
    source: "Live event", detail: fact && !stale && !withheld ? detail : "No current supporting observation.", missing, time: stale ? null : time || e?.observed_at });
  const recorded = (id: string, title: string, detail: string, missing: string) => rows.push({ id, implementation: implementations[id], title, result: "Recorded test evidence", source: "Recorded test evidence", detail, missing });
  const config = (id: string, title: string, result: Result, detail: string, missing: string) => rows.push({ id, implementation: implementations[id], title, result, source: "Configuration evidence", detail, missing });
  live("FR01.a", "Versioned consent decision", e?.consent_recorded, `A consent decision is recorded; current status: ${e?.run.consent_status}. The development notice is dev-notice-1.`, "This does not establish approval of the notice or consent validity at every operation.", e?.run.created_at);
  config("FR01.b", "Approved purpose and notice", "Recorded configuration evidence", "Configuration uses a synthetic development purpose and notice.", "Research approval and finalized operational notice are not evidenced here.");
  live("FR02.a", "Consent denial exercised", e?.blocking_observed, "A persisted consent-policy denial exists for this run.", "Acceptance or rejection of a consent choice alone is not a blocked processing attempt. This receipt does not prove every invalid state.");
  recorded("FR02.b", "All invalid and expiry boundaries", "tests/integration/test_submission_recovery.py; consent lifecycle and withdrawal tests.", "Run-specific missing, pending, rejected, invalid, withdrawn and exact-expiry scenarios are not all exercised by this page.");
  live("FR03.a", "Pseudonymous case created", e?.run.case_id, "A case reference exists for this owner's run.", "A UUID alone does not prove identity separation.");
  recorded("FR03.b", "Identity separation", "Separate linkage records and adapter contract tests; see retained C1 evidence below.", "No live data-flow or identity-store isolation evaluation runs here.");
  live("FR04.a", "Validated versioned routing outcome", e?.provenance_validated, "Stored service provenance validates against the shared mock contract and case correlation.", "This is a persisted C1 outcome, not an independent replay of every service call.", undefined, e?.receipt_only);
  if (e?.run.processing_status === "FAILED" && !stale && !e.receipt_only) {
    rows[rows.length - 1].result = "Failed";
    rows[rows.length - 1].detail = "The server currently reports FAILED processing; no successful routing outcome is claimed.";
  }
  config("FR04.b", "C2–C4 research boundaries", "Recorded configuration evidence", "Current v1 adapters require mock-1 preprocessing, NLP and explanation contracts.", "No real anonymization, model quality or explanation faithfulness is verified. Research belongs to C2–C4.");
  live("FR05", "Service versions and correlation", e?.provenance_validated, "Persisted provenance matches this case: services 0.1.0; pipeline/model/explainer mock-1; synthetic-fixtures-1.", "Derived provenance is withheld when consent is inactive or the case is disposed.", undefined, e?.receipt_only);
  live("FR06.a", "Idempotent replay exercised", e?.replay_observed, "Persisted matching submission replay receipt.", "A first submission does not exercise duplicate recovery.", undefined, e?.receipt_only);
  live("FR06.b", "Retry or terminal failure receipt", e?.failure_observed, "A persisted retry or terminal failure event exists.", "This verifies only an event; it does not prove all timeout, retry-limit or safe-failure cases.", undefined, e?.receipt_only);
  recorded("FR06.c", "Bounded retries, timeouts and safe failure", "Existing backend reliability and PostgreSQL checks, retained evidence below.", "A successful fast mock call does not test failure handling.");
  live("FR07", "Authorized review task", e?.review_task_authorized, "Task and assignment exist with currently valid consent, supported case state and validated provenance.", "Task presence alone is insufficient. Inactive/disposed cases withhold this check.", undefined, e?.receipt_only);
  live("FR08.a", "Owner-scoped authenticated evidence read", e, "This response was authorized for the student owner on the server.", "This positive request does not prove foreign-owner or role denials.");
  recorded("FR08.b", "RBAC and foreign-case denial", "Security and owner-isolation regression tests.", "A denied request cannot expose another owner's run evidence.");
  live("FR09.a", "Counsellor started review", e?.review_started_at, "Persisted START_REVIEW action receipt from the authorized review endpoint.", "Workflow completion alone is not a review action.", e?.review_started_at);
  live("FR09.b", "Counsellor completed review", e?.review_completed_at, "Persisted COMPLETE_REVIEW action receipt; no notes or predictions returned.", "Requires an actual authorized action, not just case status COMPLETED.", e?.review_completed_at);
  live("FR09.c", "Review record saved", e?.review_record_saved_at, "A persisted review-record save receipt exists. Interpretation and follow-up contents are never returned here.", "A receipt proves a save occurred, not interpretation quality or that a follow-up happened. After disposal it is historical evidence only.", e?.review_record_saved_at);
  config("FR09.d", "Interpretation and follow-up capability", "Recorded configuration evidence", "Assigned counsellors can save one synthetic interpretation and follow-up category during review, then retrieve it while consent and retention permit.", "Final records have no edit workflow. C4 dashboard research and approved human task evaluation remain separate.");
  recorded("FR09.e", "Review record access and disposal tests", "tests/integration/test_review_records.py; tests/frontend/review-record.test.tsx; see dated FR09 evidence.", "Recorded regression tests are not current-run evidence or clinical evaluation.");
  live("FR10.a", "Explicit owner withdrawal", e?.withdrawn_at, "A persisted owner withdrawal receipt exists.", "Retention disposal alone does not prove explicit withdrawal.", e?.withdrawn_at);
  live("FR10.b", "Derived evidence disposal", e?.disposal_confirmed, "Retention receipt, cleared derived fields, revoked assignments and cancelled/cleared job agree.", "Pre-submission withdrawal has no derived case to dispose. A receipt alone does not prove deletion.");
  recorded("FR10.c", "Post-withdrawal access denial", "Withdrawal, retention and security regression tests.", "Disposal state does not prove a subsequent denied review request occurred in this run.");
  live("FR11.a", "Scoped lifecycle receipts", e?.receipts.length, "Allowlisted persisted event types and timestamps for this run only.", "The bounded receipt list is not a complete audit coverage evaluation.");
  recorded("FR11.b", "Append-only audit and text exclusion", "Audit trigger, privacy and trace-catalog tests; retained evaluation below.", "Event counts alone cannot establish append-only enforcement or log privacy.");
  config("FR12", "Authorized administrative evidence", "Recorded configuration evidence", "The separate staff /admin screen provides bounded, filtered operational receipts through ADMIN-only APIs. This owner checklist cannot read them.", "Implementation does not establish a current-run admin visit; admin verification is recorded separately. Counselling content and identity mappings remain excluded.");
  recorded("NFR01", "Privacy and identity exclusion", "Adapter boundary and privacy tests; C2 research remains separate.", "No live proof of real anonymization or complete log review.");
  live("NFR02.a", "Authenticated resource access", e, "The evidence endpoint requires an active student session and owner match.", "Does not establish least privilege across every deployment resource.");
  config("NFR02.b", "Transport encryption", "Recorded configuration evidence", "Documented development deployment uses HTTP localhost.", "No trusted TLS deployment evidence is available. HTTPS on a page alone would not prove downstream TLS.");
  config("NFR02.c", "Encryption at rest (supporting control)", "Unverified", "No specific storage-encryption evidence retained.", "Do not infer encryption from PostgreSQL, Docker or application authentication.");
  recorded("NFR03", "Consent enforcement coverage", "Consent state and submission recovery regression tests.", "Full scenario coverage is separate from this run's decision.");
  recorded("NFR04", "Audit coverage and reconstruction", "Historical trace catalog: see dated retained evidence below.", "No live coverage percentage or completeness claim.");
  recorded("NFR05", "Contract compatibility", "Shared schema drift and negative contract tests cover the connected development mocks.", "Real C2–C4 provider compatibility remains awaiting integration. This page does not execute malformed/version-mismatch scenarios.");
  recorded("NFR06", "Reliable terminal outcomes", "Reliability and concurrency regression tests.", "All failure modes are not exercised by a normal submission.");
  recorded("NFR07", "C1 latency target", "Recorded performance proxy below; excludes HTTP/authentication and AI work.", "No new benchmark or current-run latency measurement; proxy is not the full proposal metric.");
  config("NFR08", "Modifiability evaluation", "Recorded configuration evidence", "Shared contracts and adapters exist; no completed change experiment claimed.", "A measured version-change/architecture scenario is still required.");
  recorded("NFR09", "Deployment and external secrets", "Bootstrap and health evidence retained separately.", "No timed clean private-deployment evaluation is established here.");
  live("NFR10.a", "Human review action", e?.review_completed_at, "Authorized review completion receipt exists.", "This does not establish usability, clinical validity or appropriate interpretation.", e?.review_completed_at);
  config("NFR10.b", "Screening-support boundary", "Recorded configuration evidence", "Synthetic, non-diagnostic screening support with counsellor-assisted interpretation.", "The system does not replace professional counselling. Human task evaluation remains separate.");
  return rows.map(row => ({ ...row, ...scopeNotes[row.id] }));
}
