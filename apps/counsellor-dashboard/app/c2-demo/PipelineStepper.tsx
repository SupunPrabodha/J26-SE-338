import type { C2CustomDemoResponse } from "@j26/common/contracts";

const stages = ["Anonymize", "Data Quality", "Language ID", "Normalize", "Tokenize", "Annotate", "Validate", "Versioned Release"];

export function PipelineStepper({ result, busy }: { result: C2CustomDemoResponse | null; busy: boolean }) {
  const hasRecords = !!result?.records.length;
  const completed = [
    !!result,
    !!result,
    hasRecords && result!.records.every(record => !!record.language_identification),
    hasRecords && result!.records.every(record => typeof record.normalized_text === "string" && !!record.normalization_method),
    hasRecords && result!.records.every(record => Array.isArray(record.tokens) && Array.isArray(record.token_offsets) && !!record.tokenization_method),
    false, false, false,
  ];
  return <section className="card c2-roadmap" aria-label="Pipeline progress" aria-busy={busy}>
    <div className="detail-heading"><h2>C2 pipeline stages</h2><span className="hint">Live execution · no simulated progress</span></div>
    {busy && <p className="c2-processing" role="status"><span className="c2-spinner" aria-hidden="true" />Overall processing — individual stage events are unavailable.</p>}
    <ol className="c2-stepper">{stages.map((stage, index) => {
      const review = completed[index] && !!result && (index === 1 && result.quality_summary.data_quality_gate === "FAILED" || index === 0 && result.records.some(record => record.requires_privacy_review));
      const rejected = completed[index] && index === 1 && !!result?.quality_summary.status_counts.REJECT;
      const state = completed[index] ? rejected ? "error" : review ? "review" : "complete" : "pending";
      return <li key={stage} className={`c2-step-${state}`}>
        <span className="c2-step-circle" aria-hidden="true">{completed[index] ? review || rejected ? "!" : "✓" : index + 1}</span>
        <strong>{stage}</strong><span>{completed[index] ? rejected ? "Completed · rejected" : review ? "Completed · review/blocking" : index === 2 ? "Completed · provisional" : "Completed" : "Pending"}</span>
      </li>;
    })}</ol>
    <p className="hint">Quality assessment precedes Language ID, then Normalize and Tokenize. Validate means future annotated-dataset validation; existing quality/privacy gates appear below. Annotation and human release remain pending.</p>
  </section>;
}
