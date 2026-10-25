import type { C2CustomDemoResponse } from "@j26/common/contracts";

const stages = ["Anonymize", "Data Quality", "Language ID", "Normalize", "Tokenize", "Annotate", "Validate", "Versioned Release"];

type StageResult = Pick<C2CustomDemoResponse, "records" | "quality_summary" | "privacy_summary" | "release_ready" | "blocking_reasons">;
type AnnotationStatus = "PENDING" | "DRAFT" | "SUBMITTED" | "PAIR_FINALIZED";
export function PipelineStepper({ result, busy, annotationStatus, showReleaseStatus = true }: { result: StageResult | null; busy: boolean; annotationStatus?: AnnotationStatus; showReleaseStatus?: boolean }) {
  const hasRecords = !!result?.records.length;
  const completed = [
    !!result,
    !!result,
    hasRecords && result!.records.every(record => !!record.language_identification),
    hasRecords && result!.records.every(record => typeof record.normalized_text === "string" && !!record.normalization_method),
    hasRecords && result!.records.every(record => Array.isArray(record.tokens) && Array.isArray(record.token_offsets) && !!record.tokenization_method),
    annotationStatus === "PAIR_FINALIZED", false, false,
  ];
  return <section className="card c2-roadmap" aria-label="Pipeline progress" aria-busy={busy}>
    <div className="detail-heading"><h2>C2 pipeline stages</h2><span className="hint">Live execution · no simulated progress</span></div>
    {busy && <p className="c2-processing" role="status"><span className="c2-spinner" aria-hidden="true" />Overall processing — individual stage events are unavailable.</p>}
    <ol className="c2-stepper">{stages.map((stage, index) => {
      const languageUncertain = index === 2 && !!result && result.records.some(record => record.language_identification?.uncertain || ["unknown", "uncertain"].includes(record.language_identification?.status ?? ""));
      const review = completed[index] && !!result && (languageUncertain || index === 1 && result.quality_summary.data_quality_gate === "FAILED" || index === 0 && result.records.some(record => record.requires_privacy_review));
      const rejected = completed[index] && index === 1 && !!result?.quality_summary.status_counts.REJECT;
      const state = completed[index] ? rejected ? "error" : review ? "review" : "complete" : "pending";
      return <li key={stage} className={`c2-step-${state}`}>
        <span className="c2-step-circle" aria-hidden="true">{completed[index] ? review || rejected ? "!" : "✓" : index + 1}</span>
        <strong>{stage}</strong><span>{index === 5 && annotationStatus ? annotationStatus === "PAIR_FINALIZED" ? "Two submissions saved" : annotationStatus === "SUBMITTED" ? "Submitted · awaiting second annotator" : annotationStatus === "DRAFT" ? "Draft saved · not finalized" : "Pending" : completed[index] ? rejected ? "Completed · rejected" : languageUncertain ? "Completed · uncertain" : review ? "Completed · review/blocking" : "Completed" : "Pending"}</span>
      </li>;
    })}</ol>
    {showReleaseStatus && <section className="c2-release-stage" aria-label="Versioned Release status">
      <h3>Versioned Release</h3>
      <span className={`c2-status ${result?.release_ready === false ? "c2-status-blocked" : "c2-status-unknown"}`}>Automated gate: {!result ? "Not run" : result.release_ready === false ? "Blocked" : result.release_ready === true ? "Passed" : "Unavailable"}</span>
      <p className="hint">Release remains pending.</p>
      {!!result?.blocking_reasons?.length && <ol className="c2-blocking-reasons" aria-label="Blocking reasons">{result.blocking_reasons.map(reason => <li key={reason}>{reason === "experimental_anonymizer_not_release_validated" ? "Experimental model validation pending" : reason.replaceAll(/[-_:]/g, " ")}</li>)}</ol>}
    </section>}
  </section>;
}
