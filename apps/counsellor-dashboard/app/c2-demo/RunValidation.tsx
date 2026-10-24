"use client";

import type { C2DemoValidationSummary } from "@j26/common/contracts";

const labels: Record<string, string> = {
  anonymization: "Anonymization checks", quality: "Data quality",
  language_id: "Language evidence", normalization: "Normalization integrity",
  tokenization: "Tokenization integrity",
};

export default function RunValidation({ summary }: { summary?: C2DemoValidationSummary | null }) {
  function download() {
    if (!summary) return;
    // Export only the backend's text-free validation object, never the demo response.
    const url = URL.createObjectURL(new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "c2-run-validation.json"; link.click();
    URL.revokeObjectURL(url);
  }

  return <section className="card c2-full-width c2-validation" aria-labelledby="run-validation-title">
    <div className="detail-heading"><h2 id="run-validation-title">Run validation summary</h2>
      {summary && <button className="secondary" onClick={download}>Download validation JSON</button>}</div>
    <p>Actual backend policy and integrity checks. Pass rates are not anonymization or language accuracy.</p>
    {!summary ? <p>No validation report returned. Run the updated backend; older saved snapshots may have no report.</p> : <>
      <p><strong>Accuracy: Not measured for this run.</strong> Detection accuracy requires a separate labelled evaluation set.</p>
      <p>Ruleset: <code>{summary.method}</code> · Strategy: {summary.anonymization_strategy} · Records processed: {summary.records_processed}</p>
      <div className="c2-table-scroll" role="region" aria-label="Scrollable validation counts" tabIndex={0}><table className="c2-validation-counts">
        <caption>Backend stage validation counts</caption>
        <thead><tr><th scope="col">Stage</th><th scope="col">Checked</th><th scope="col">Pass</th><th scope="col">Fail</th><th scope="col">Review</th><th scope="col">Not evaluated</th><th scope="col">Check pass rate</th></tr></thead>
        <tbody>{summary.stages.map(stage => <tr key={stage.stage}>
          <th scope="row">{labels[stage.stage]}</th><td>{stage.checked_records}</td><td>{stage.passed_records}</td>
          <td>{stage.failed_records}</td><td>{stage.review_records}</td><td>{stage.not_evaluated_records}</td>
          <td>{stage.pass_rate_percent == null ? "Not measured" : `${stage.pass_rate_percent.toFixed(2)}%`}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="hint">Checked = pass + fail + review. Pass rate = records passing every stage rule ÷ checked records. Not-evaluated records are excluded and reported separately.</p>
      <details><summary>Per-record rules, outcomes and code locations</summary>
        {summary.records.map(record => <section key={record.record_index} aria-label={`Validation record ${record.record_index}`}>
          <h3>Record {record.record_index}</h3><ul className="c2-validation-rules">{record.checks.map(check => {
            const rule = summary.rules.find(candidate => candidate.rule_id === check.rule_id);
            return <li key={check.rule_id}><strong>{check.status}</strong> · <code>{check.rule_id}</code>
              <p>{rule?.description ?? "Rule definition unavailable."}</p>
              {check.reasons.length > 0 && <p>Reasons: {check.reasons.join(", ")}</p>}
              {rule && <p>Code location: <code>{rule.source_path}</code> → <code>{rule.source_function}()</code>. Open this path in your repository editor.</p>}
            </li>;
          })}</ul>
        </section>)}
      </details>
      <p className="notice-inline"><strong>Residual FAIL and REVIEW signals block automated release.</strong> A passed check means no supported signal was found; it does not prove absence of all PII, semantic correctness or human release approval.</p>
    </>}
  </section>;
}
