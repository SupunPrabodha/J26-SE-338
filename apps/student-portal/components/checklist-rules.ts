import type { DemoEvidence } from "@j26/common/contracts";

export type Result = "Verified for this run" | "Not exercised" | "Failed" | "Mock dependency" | "Not implemented" | "Unavailable/stale";
export type Check = { id: string; title: string; result: Result; source: "Live event" | "Configuration evidence" | "Recorded test evidence"; detail: string; missing: string; time?: string | null };

// Proposal IT23187450 section 5: subchecks never roll up to a requirement-wide pass.
export function checklist(e: DemoEvidence | null, stale: boolean): Check[] {
  const rows: Check[] = [];
  const live = (id: string, title: string, fact: unknown, detail: string, missing: string, time?: string | null, withheld = false) => rows.push({ id, title,
    result: stale || withheld ? "Unavailable/stale" : fact ? "Verified for this run" : "Not exercised",
    source: "Live event", detail: fact && !stale && !withheld ? detail : "No current supporting observation.", missing, time: stale ? null : time || e?.observed_at });
  const recorded = (id: string, title: string, detail: string, missing: string) => rows.push({ id, title, result: "Not exercised", source: "Recorded test evidence", detail, missing });
  const config = (id: string, title: string, result: Result, detail: string, missing: string) => rows.push({ id, title, result, source: "Configuration evidence", detail, missing });
  live("FR01.a", "Versioned consent decision", e?.consent_recorded, `A consent decision is recorded; current status: ${e?.run.consent_status}. The development notice is dev-notice-1.`, "This does not establish approval of the notice or consent validity at every operation.", e?.run.created_at);
  config("FR01.b", "Approved purpose and notice", "Not implemented", "Configuration uses a synthetic development purpose and notice.", "Research approval and finalized operational notice are not evidenced here.");
  live("FR02.a", "Consent denial exercised", e?.blocking_observed, "A persisted consent-policy denial exists for this run.", "Acceptance or rejection of a consent choice alone is not a blocked processing attempt. This receipt does not prove every invalid state.");
  recorded("FR02.b", "All invalid and expiry boundaries", "tests/integration/test_submission_recovery.py; consent lifecycle and withdrawal tests.", "Run-specific missing, pending, rejected, invalid, withdrawn and exact-expiry scenarios are not all exercised by this page.");
  live("FR03.a", "Pseudonymous case created", e?.run.case_id, "A case reference exists for this owner's run.", "A UUID alone does not prove identity separation.");
  recorded("FR03.b", "Identity separation", "Separate linkage records and adapter contract tests; see retained C1 evidence below.", "No live data-flow or identity-store isolation evaluation runs here.");
  live("FR04.a", "Validated versioned routing outcome", e?.provenance_validated, "Stored service provenance validates against the shared mock contract and case correlation.", "This is a persisted C1 outcome, not an independent replay of every service call.", undefined, e?.receipt_only);
  if (e?.run.processing_status === "FAILED" && !stale && !e.receipt_only) {
    rows[rows.length - 1].result = "Failed";
    rows[rows.length - 1].detail = "The server currently reports FAILED processing; no successful routing outcome is claimed.";
  }
  config("FR04.b", "C2–C4 research boundaries", "Mock dependency", "Current v1 adapters require mock-1 preprocessing, NLP and explanation contracts.", "No real anonymization, model quality or explanation faithfulness is verified. Research belongs to C2–C4.");
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
  config("FR09.d", "Interpretation and follow-up capability", "Not exercised", "Assigned counsellors can save one synthetic interpretation and follow-up category during review, then retrieve it while consent and retention permit.", "Final records have no edit workflow. C4 dashboard research and approved human task evaluation remain separate.");
  recorded("FR09.e", "Review record access and disposal tests", "tests/integration/test_review_records.py; tests/frontend/review-record.test.tsx; see dated FR09 evidence.", "Recorded regression tests are not current-run evidence or clinical evaluation.");
  live("FR10.a", "Explicit owner withdrawal", e?.withdrawn_at, "A persisted owner withdrawal receipt exists.", "Retention disposal alone does not prove explicit withdrawal.", e?.withdrawn_at);
  live("FR10.b", "Derived evidence disposal", e?.disposal_confirmed, "Retention receipt, cleared derived fields, revoked assignments and cancelled/cleared job agree.", "Pre-submission withdrawal has no derived case to dispose. A receipt alone does not prove deletion.");
  recorded("FR10.c", "Post-withdrawal access denial", "Withdrawal, retention and security regression tests.", "Disposal state does not prove a subsequent denied review request occurred in this run.");
  live("FR11.a", "Scoped lifecycle receipts", e?.receipts.length, "Allowlisted persisted event types and timestamps for this run only.", "The bounded receipt list is not a complete audit coverage evaluation.");
  recorded("FR11.b", "Append-only audit and text exclusion", "Audit trigger, privacy and trace-catalog tests; retained evaluation below.", "Event counts alone cannot establish append-only enforcement or log privacy.");
  config("FR12", "Authorized administrative evidence", "Not implemented", "This is a student-owner receipt view, not an administrative console.", "The proposal's broader authorized operations evidence interface remains missing.");
  recorded("NFR01", "Privacy and identity exclusion", "Adapter boundary and privacy tests; C2 research remains separate.", "No live proof of real anonymization or complete log review.");
  live("NFR02.a", "Authenticated resource access", e, "The evidence endpoint requires an active student session and owner match.", "Does not establish least privilege across every deployment resource.");
  config("NFR02.b", "Transport encryption", "Not implemented", "Documented development deployment uses HTTP localhost.", "No trusted TLS deployment evidence is available. HTTPS on a page alone would not prove downstream TLS.");
  config("NFR02.c", "Encryption at rest (supporting control)", "Not exercised", "No specific storage-encryption evidence retained.", "Do not infer encryption from PostgreSQL, Docker or application authentication.");
  recorded("NFR03", "Consent enforcement coverage", "Consent state and submission recovery regression tests.", "Full scenario coverage is separate from this run's decision.");
  recorded("NFR04", "Audit coverage and reconstruction", "Historical trace catalog: see dated retained evidence below.", "No live coverage percentage or completeness claim.");
  recorded("NFR05", "Contract compatibility", "Shared schema drift and negative contract tests.", "This page does not execute all malformed/version-mismatch scenarios.");
  recorded("NFR06", "Reliable terminal outcomes", "Reliability and concurrency regression tests.", "All failure modes are not exercised by a normal submission.");
  recorded("NFR07", "C1 latency target", "Recorded performance proxy below; excludes HTTP/authentication and AI work.", "No new benchmark or current-run latency measurement; proxy is not the full proposal metric.");
  config("NFR08", "Modifiability evaluation", "Not exercised", "Shared contracts and adapters exist; no completed change experiment claimed.", "A measured version-change/architecture scenario is still required.");
  recorded("NFR09", "Deployment and external secrets", "Bootstrap and health evidence retained separately.", "No timed clean private-deployment evaluation is established here.");
  live("NFR10.a", "Human review action", e?.review_completed_at, "Authorized review completion receipt exists.", "This does not establish usability, clinical validity or appropriate interpretation.", e?.review_completed_at);
  config("NFR10.b", "Screening-support boundary", "Not exercised", "Synthetic, non-diagnostic screening support with counsellor-assisted interpretation.", "The system does not replace professional counselling. Human task evaluation remains separate.");
  return rows;
}
