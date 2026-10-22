import { c1Evidence } from "./c1-evidence";

export function DemoOverview() {
  return <section className="card demo-overview" aria-labelledby="boundary-title">
    <h2 id="boundary-title">C1 orchestration and its boundaries</h2>
    <div className="boundary-grid">
      <p><strong>C1</strong><span>Implemented development orchestration</span></p>
      <p><strong>Authentication</strong><span>Local development provider</span></p>
      <p><strong>C2 dependency</strong><span>Mock preprocessing</span></p>
      <p><strong>C3 dependency</strong><span>Mock NLP indicators</span></p>
      <p><strong>C4 dependency</strong><span>Mock explanations</span></p>
    </div>
    <p className="hint">Provider labels describe this configured prototype, not a runtime health check. C2–C4 research remains with its owners; no real model or anonymizer runs in this workflow.</p>
  </section>;
}

export function DemoEvidence() {
  return <section id="recorded-evidence" className="card demo-evidence" aria-labelledby="evidence-title">
    <p className="eyebrow">Recorded evidence · not live results</p><h2 id="evidence-title">C1 evaluation evidence</h2>
    <p className="hint">Opening this page runs no tests, training or dataset release. These allowlisted historical summaries are separate from the current case. Source paths identify repository evidence; arbitrary files and audit records are not served.</p>
    <div className="evidence-grid">{c1Evidence.map(item => <details className="evidence-item" key={item.title}>
      <summary>{item.title}<span>{item.result}</span></summary>
      <p>{item.detail}</p><dl><dt>Source</dt><dd>{item.source}</dd><dt>Execution / report date</dt><dd>{item.date}</dd><dt>Revision provenance</dt><dd>{item.revision}</dd><dt>Limitations</dt><dd>{item.limitation}</dd></dl>
    </details>)}</div>
  </section>;
}
