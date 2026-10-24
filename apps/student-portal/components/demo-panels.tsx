"use client";

import { useState } from "react";
import { AppDialog } from "@j26/common/ui";
import { c1Evidence } from "./c1-evidence";

export function DemoOverview() {
  const [open, setOpen] = useState(false);
  return <section className="privacy-intro" aria-label="C1 contribution and scope"><p>C1 controls consent, access, workflow routing, traceability and disposal. <strong>C2 owns anonymization research.</strong> Pseudonymous references and infrastructure controls do not prove complete anonymization or privacy compliance.</p><button className="text-button" onClick={() => setOpen(true)}>Provider and scope details</button>
    {open && <AppDialog title="Configured providers and scope" onClose={() => setOpen(false)}><p>Demo data · Mock services. Current preprocessing, NLP and explanation contracts use mock-1 providers and fictional fixtures. These labels describe the configured prototype, not a runtime health check.</p><p>C1 owns orchestration, identity/access and lifecycle controls. C2 owns preprocessing/anonymization research; C3 owns modelling; C4 owns explanation methods and final dashboard research.</p><p>Development notice approval, TLS, storage-encryption evidence and real provider integration remain separate dependencies. The system requires authorized human interpretation and does not replace professional counselling.</p></AppDialog>}
  </section>;
}

export function DemoEvidence() {
  const [selected, setSelected] = useState<number | null>(null);
  const item = selected === null ? null : c1Evidence[selected];
  return <section id="recorded-evidence" className="card demo-evidence" aria-labelledby="evidence-title"><p className="eyebrow">Recorded evidence · not live results</p><h2 id="evidence-title">Recorded research and evaluation</h2><p className="hint">These dated, allowlisted summaries are historical evidence. Opening this page runs no tests, training, benchmarks or dataset release.</p>
    <div className="recorded-list">{c1Evidence.map((value,index) => <div key={value.title}><div><h3>{value.title}</h3><p className="hint">{value.date} · {value.result}</p></div><button className="secondary" aria-label={`View recorded evidence: ${value.title}`} onClick={() => setSelected(index)}>View details</button></div>)}</div>
    {item && <AppDialog title={item.title} onClose={() => setSelected(null)}><p>{item.result}</p><p>{item.detail}</p><dl><dt>Source</dt><dd>{item.source}</dd><dt>Execution / report date</dt><dd>{item.date}</dd><dt>Revision provenance</dt><dd>{item.revision}</dd><dt>Method and limitations</dt><dd>{item.limitation}</dd></dl></AppDialog>}
  </section>;
}
