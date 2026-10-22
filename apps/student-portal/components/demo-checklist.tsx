"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@j26/common/api";
import type { DemoEvidence as Evidence, DemoRunPage } from "@j26/common/contracts";
import { DemoHeader, SafetyNotice } from "@j26/common/ui";
import { DemoEvidence, DemoOverview } from "./demo-panels";
import { checklist } from "./checklist-rules";

export const OBSERVER_INTERVAL = 3000;
export const OBSERVER_LIMIT = 20;

export default function DemoChecklist() {
  const [runs, setRuns] = useState<DemoRunPage | null>(null);
  const [selected, setSelected] = useState("");
  const [offset, setOffset] = useState(0);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [stale, setStale] = useState(false);
  const [connection, setConnection] = useState("Checking owner session…");
  const [refresh, setRefresh] = useState(0);
  const [updated, setUpdated] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false, count = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function observe() {
      const deadline = setTimeout(() => controller.abort(), 8000);
      try {
        const page = await api<DemoRunPage>(`/demo/runs?offset=${offset}`, undefined, true, controller.signal);
        const detail = selected ? await api<Evidence>(`/demo/runs/${selected}`, undefined, true, controller.signal) : null;
        if (cancelled) return;
        setRuns(page); setEvidence(detail); setStale(false); setUpdated(new Date().toISOString());
        count++;
        setConnection(count >= OBSERVER_LIMIT ? "Refresh window ended — evidence is stale; refresh to recheck." : "Connected — owner-scoped observations every 3 seconds.");
        if (count >= OBSERVER_LIMIT) { setStale(true); return; }
        timer = setTimeout(observe, OBSERVER_INTERVAL);
      } catch (cause) {
        if (cancelled) return;
        setEvidence(null); setRuns(null); setStale(true);
        setConnection("Unavailable/stale: " + (cause instanceof ApiError ? cause.message : "Connection check failed. Retry without assuming consent withdrawal."));
      } finally { clearTimeout(deadline); }
    }
    void observe();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [selected, offset, refresh]);

  const rows = checklist(evidence, stale);
  function restart() { setStale(true); setEvidence(null); setConnection("Checking owner session…"); setRefresh(n => n + 1); }
  return <main>
    <DemoHeader title="Component 1 · Live requirements checklist" subtitle="PP1 · Synthetic screening support and counsellor-assisted review" />
    <SafetyNotice />
    <nav className="demo-nav" aria-label="Applications"><a href="/" target="_blank" rel="noopener noreferrer">Open student submission</a><a href="http://localhost:3001" target="_blank" rel="noopener noreferrer">Open counsellor application</a><a href="#recorded-evidence">Recorded evaluation evidence</a></nav>
    <p className="hint">Use this tab and student submission in the same browser profile. Application cookies are isolated. Use a separate counsellor profile for clear demo roles; these links open tabs, not profiles.</p>
    <DemoOverview />
    <section className="card" aria-labelledby="run-title"><h2 id="run-title">Selected demonstration run</h2>
      <p>Each recorded consent is a separate run, including rejected decisions and withdrawal before submission. Select explicitly; a new run never inherits another run's checks.</p>
      <label htmlFor="demo-run">Your runs</label><select id="demo-run" value={selected} onChange={event => { setSelected(event.target.value); setEvidence(null); setStale(false); }}>
        <option value="">Select a run</option>
        {selected && !runs?.runs.some(r => r.run_id === selected) && <option value={selected}>Selected run (access being checked)</option>}
        {runs?.runs.map(run => <option key={run.run_id} value={run.run_id}>{new Date(run.created_at).toLocaleString()} · {run.consent_status} · {run.run_id.slice(0, 8)}</option>)}
      </select>
      {runs?.runs.length === 0 && <p>No consent or case yet for this owner. Record a choice on student submission.</p>}
      <div className="actions"><button className="secondary" onClick={restart}>Refresh evidence</button><button className="secondary" disabled={offset === 0} onClick={() => { setOffset(Math.max(0, offset - 20)); setSelected(""); setEvidence(null); }}>Previous runs</button><button className="secondary" disabled={runs?.next_offset == null} onClick={() => { setOffset(runs!.next_offset!); setSelected(""); setEvidence(null); }}>Older runs</button></div>
      <p role="status">{connection}</p><p className="hint">Last successful browser receipt: {updated ? new Date(updated).toLocaleString() : "None"}. Each window is bounded to 20 observations; manual refresh starts another window.</p>
      {evidence && !stale && <dl className="status-list"><div><dt>Consent</dt><dd>{evidence.run.consent_status}</dd></div><div><dt>Pseudonymous case</dt><dd>{evidence.run.case_id || "No case submitted"}</dd></div><div><dt>Actual processing state</dt><dd>{evidence.run.processing_status || "Not submitted"}</dd></div><div><dt>Evidence policy</dt><dd>{evidence.receipt_only ? "Minimal receipts only; processing provenance withheld" : "Owner-safe status and receipts"}</dd></div></dl>}
    </section>
    {["FR", "NFR"].map(group => <section className="card" key={group} aria-labelledby={`${group}-title`}><h2 id={`${group}-title`}>{group === "FR" ? "Functional requirements · FR01–FR12" : "Security and quality · NFR01–NFR10"}</h2>
      <p className="hint">Source: C1 proposal IT23187450, section 5 (proposed requirements). Subchecks do not produce an overall pass. Configuration and recorded tests are separate from live verification.</p>
      <div className="checklist">{rows.filter(row => row.id.startsWith(group)).map(row => <article className="checklist-row" key={row.id} data-check={row.id}>
        <div className="checklist-heading"><h3>{row.id} · {row.title}</h3><span className="status-badge" data-result={row.result}>{row.result}</span></div>
        <p className="hint">{row.source}{row.time && <> · Observed/event time: <time dateTime={row.time}>{new Date(row.time).toLocaleString()}</time></>}</p>
        <p>{row.detail}</p><details><summary>Scope and missing evidence</summary><p>{row.missing}</p></details>
      </article>)}</div>
    </section>)}
    <section className="card"><details><summary>Safe persisted event receipts</summary><p>Allowlisted types and event timestamps only; no invented stage history, event payloads, raw text or review content. Observation times above are snapshot times unless an action time is supplied.</p>
      {evidence && !stale ? <><ul>{evidence.receipts.map((receipt, index) => <li key={index}>{receipt.event} · <time dateTime={receipt.occurred_at}>{new Date(receipt.occurred_at).toLocaleString()}</time></li>)}</ul>{evidence.receipts_truncated && <p>Latest 50 receipts shown; earlier events omitted.</p>}</> : <p>No current receipt evidence available.</p>}
    </details></section>
    <DemoEvidence />
    <footer>Non-diagnostic screening support · Authorized human interpretation · Does not replace professional counselling · DEVELOPMENT ONLY</footer>
  </main>;
}
