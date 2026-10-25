"use client";

import type { C2CustomDemoResponse, C2DemoValidationSummary } from "@j26/common/contracts";

const labels: Record<string, string> = {
  anonymization: "Residual PII checks", quality: "Data quality",
  language_id: "Language evidence", normalization: "Normalization integrity",
  tokenization: "Tokenization integrity",
};
const count = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : "Unavailable";

export default function RunValidation({ summary, configuration, release }: { summary?: C2DemoValidationSummary | null; configuration?: string | null; release?: Pick<C2CustomDemoResponse, "release_ready" | "blocking_reasons" | "human_release_required"> }) {
  const model = summary?.anonymization_strategy === "gliner" ? { id: "urchade/gliner_multi-v2.1", revision: "443d26d654e0324125a96bebd8e796c14ff2efe6" } : null;
  const noSignal = summary?.records?.length === summary?.records_processed && summary?.records?.every(record => !!record.residual_assessment)
    ? summary.records.filter(record => record.residual_assessment?.status === "NO_SIGNAL").length : null;
  function download() {
    if (!summary) return;
    // Preserve backend diagnostics; add only text-free configuration provenance.
    const report = { ...summary, ...(configuration ? { anonymization_configuration: configuration, ...(model ? { model } : {}) } : {}), ...(release ? { release_status: { release_ready: release.release_ready, blocking_reasons: release.blocking_reasons, human_release_required: release.human_release_required } } : {}) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "c2-run-validation.json"; link.click();
    URL.revokeObjectURL(url);
  }

  return <section className="card c2-full-width c2-validation" aria-labelledby="run-validation-title">
    <div className="detail-heading"><h2 id="run-validation-title">Automated checks</h2>
      {summary && <button className="secondary" onClick={download}>Download validation JSON</button>}</div>
    {!summary ? <p>No validation report returned.</p> : <>
      <div className="c2-validation-meta"><p>Records processed: {count(summary.records_processed)}</p></div>
      {summary.records?.map(record => {
        const assessment = record.residual_assessment;
        const structured = record.checks.filter(check => ["anonymization.residual_email", "anonymization.residual_phone", "anonymization.residual_student_id"].includes(check.rule_id));
        const status = assessment?.status;
        return <div key={record.record_index} className="c2-residual-assessment" aria-label={`Residual assessment record ${record.record_index}`}>
          <p><strong className={`c2-status ${status === "FAIL" ? "c2-status-fail" : status === "REVIEW" ? "c2-status-review" : "c2-status-unknown"}`}>Residual PII: {status === "NO_SIGNAL" ? "No residual signal detected" : status === "NOT_EVALUATED" ? "Not evaluated" : status ?? "Unavailable"}</strong></p>
          {assessment && ["FAIL", "REVIEW"].includes(assessment.status) && <ul>{assessment.reasons.map(reason => <li key={reason}>{reason.replaceAll(/[-_:]/g, " ")}</li>)}</ul>}
          <p className="hint">Structured PII pattern checks: {Object.entries({ residual_email: "Email", residual_phone: "Phone", residual_student_id: "Student ID" }).map(([rule, label], index) => {
            const outcome = structured.find(check => check.rule_id === `anonymization.${rule}`)?.status;
            return <span key={rule}>{index > 0 && " · "}{label}: {outcome === "PASS" ? "Pass" : outcome === "FAIL" ? "Fail" : outcome === "REVIEW" ? "Review" : outcome === "NOT_EVALUATED" ? "Not evaluated" : "Unavailable"}</span>;
          })}</p>
        </div>;
      })}
      {!summary.stages?.length ? <p>Stage counts unavailable.</p> : <div className="c2-table-scroll" role="region" aria-label="Scrollable validation counts" tabIndex={0}><table className="c2-validation-counts">
        <caption>Backend stage validation counts</caption>
        <thead><tr><th scope="col">Stage</th><th scope="col">Checked</th><th scope="col">Pass</th><th scope="col">Fail</th><th scope="col">Review</th><th scope="col">No signal</th><th scope="col">Not evaluated</th></tr></thead>
        <tbody>{summary.stages.map(stage => <tr key={stage.stage}>
          <th scope="row">{labels[stage.stage] ?? "Unknown stage"}</th><td>{count(stage.stage === "anonymization" && noSignal !== null && typeof stage.checked_records === "number" ? stage.checked_records + noSignal : stage.checked_records)}</td><td>{count(stage.passed_records)}</td>
          <td className={stage.failed_records > 0 ? "c2-count-fail" : undefined}>{count(stage.failed_records)}</td><td className={stage.review_records > 0 ? "c2-count-review" : undefined}>{count(stage.review_records)}</td><td>{stage.stage === "anonymization" ? noSignal ?? "Unavailable" : "—"}</td><td>{count(stage.stage === "anonymization" && noSignal !== null && typeof stage.not_evaluated_records === "number" ? stage.not_evaluated_records - noSignal : stage.not_evaluated_records)}</td>
        </tr>)}</tbody>
      </table></div>}

    </>}
  </section>;
}
