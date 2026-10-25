"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@j26/common/api";
import type { DemoEvidence as Evidence, DemoRunPage } from "@j26/common/contracts";
import { AppDialog, DemoHeader, Icon, SafetyNotice, StatusBadge, humanLabel } from "@j26/common/ui";
import { DemoEvidence, DemoOverview } from "./demo-panels";
import { checklist, groupImplementation, groupSummaries, privacyGroups, secondaryIds, type Check } from "./checklist-rules";

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
  const [view, setView] = useState<"privacy" | "reliability" | "recorded">("privacy");
  const [dialog, setDialog] = useState<string | null>(null);

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
        if (count >= OBSERVER_LIMIT) { setStale(true); setDialog(null); return; }
        timer = setTimeout(observe, OBSERVER_INTERVAL);
      } catch (cause) {
        if (cancelled) return;
        setEvidence(null); setRuns(null); setStale(true); setDialog(null);
        setConnection("Unavailable/stale: " + (cause instanceof ApiError ? cause.message : "Connection check failed. Retry without assuming consent withdrawal."));
      } finally { clearTimeout(deadline); }
    }
    void observe();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [selected, offset, refresh]);

  const rows = checklist(evidence, stale);
  const activeGroup = privacyGroups.find(group => group.id === dialog);
  const detailRows = activeGroup ? rows.filter(row => (activeGroup.ids as readonly string[]).includes(row.id)) : dialog === "reliability" ? rows.filter(row => secondaryIds.includes(row.id)) : [];
  function restart() { setDialog(null); setStale(true); setEvidence(null); setConnection("Checking owner session…"); setRefresh(n => n + 1); }
  return <main className="student-evidence-page">
    <div className="evidence-hero"><DemoHeader title="Infrastructure Privacy and Security — Component 1" subtitle="PP1 · Consent, access, routing, traceability and disposal" /><span className="evidence-hero-symbol" aria-hidden="true"><Icon name="shield" /></span></div>
    <SafetyNotice />
    <nav className="demo-nav" aria-label="Applications"><a href="/" target="_blank" rel="noopener noreferrer">Open student submission</a><a href="http://localhost:3001" target="_blank" rel="noopener noreferrer">Open counsellor application</a></nav>
    <p className="hint">Use this tab and student submission in the same browser profile. Application cookies are isolated. Use a separate counsellor profile for clear demo roles; these links open tabs, not profiles.</p>
    <DemoOverview />
    <section className="card run-selector" aria-labelledby="run-title"><h2 id="run-title">Selected demonstration run</h2>
      <p className="hint">Each consent is a separate owner-scoped run. Select explicitly; evidence never carries over from another run.</p>
      <label htmlFor="demo-run">Your runs</label><select id="demo-run" value={selected} onChange={event => { setDialog(null); setSelected(event.target.value); setEvidence(null); setStale(false); }}>
        <option value="">Select a run</option>
        {selected && !runs?.runs.some(r => r.run_id === selected) && <option value={selected}>Selected run (access being checked)</option>}
        {runs?.runs.map(run => <option key={run.run_id} value={run.run_id}>{new Date(run.created_at).toLocaleString()} · {run.consent_status} · {run.run_id.slice(0, 8)}</option>)}
      </select>
      {runs?.runs.length === 0 && <p>No consent or case yet for this owner. Record a choice on student submission.</p>}
      <div className="actions"><button className="secondary" onClick={restart}>Refresh evidence</button><button className="secondary" disabled={offset === 0} onClick={() => { setOffset(Math.max(0, offset - 20)); setSelected(""); setEvidence(null); }}>Previous runs</button><button className="secondary" disabled={runs?.next_offset == null} onClick={() => { setOffset(runs!.next_offset!); setSelected(""); setEvidence(null); }}>Older runs</button></div>
      <p role="status">{connection}</p><p className="hint">Last successful browser receipt: {updated ? new Date(updated).toLocaleString() : "None"}. Each window is bounded to 20 observations; manual refresh starts another window.</p>
      {evidence && !stale && <dl className="status-list"><div><dt>Consent</dt><dd>{evidence.run.consent_status}</dd></div><div><dt>Pseudonymous case</dt><dd>{evidence.run.case_id || "No case submitted"}</dd></div><div><dt>Actual processing state</dt><dd>{evidence.run.processing_status ? humanLabel(evidence.run.processing_status) : "Not submitted"}</dd></div><div><dt>Evidence policy</dt><dd>{evidence.receipt_only ? "Minimal receipts only; processing provenance withheld" : "Owner-safe status and receipts"}</dd></div></dl>}
    </section>
    <nav className="evidence-tabs" aria-label="Evidence sections">{([['privacy','Privacy controls'],['reliability','Reliability and oversight'],['recorded','Recorded evaluation']] as const).map(([id,title]) => <button key={id} className={view === id ? "selected" : "quiet"} aria-pressed={view === id} onClick={() => { setDialog(null); setView(id); }}>{title}</button>)}</nav>
    {view === "privacy" && <section className="card"><h2>C1 privacy controls</h2><p className="hint">Implementation and selected-run observations are independent. Mixed subchecks are shown separately; no group-wide pass or overall percentage is inferred. Source: proposed C1 requirements, section 5.</p>
      <div className="table-scroll" role="region" aria-label="Privacy control checklist" tabIndex={0}><table className="privacy-checklist"><thead><tr><th>Control</th><th>Implementation</th><th>Evidence for selected run</th><th>Details</th></tr></thead><tbody>{privacyGroups.map(group => {
        const checks = rows.filter(row => (group.ids as readonly string[]).includes(row.id));
        return <tr key={group.id} data-group={group.id}><th scope="row">{group.title}<span className="control-description">{group.description}</span></th><td><StatusBadge value={groupImplementation(checks)} /><span className="control-description">{groupSummaries[group.id]}</span></td><td><EvidenceSummary rows={checks} /></td><td><button className="text-button" aria-label={`View evidence: ${group.title}`} onClick={() => setDialog(group.id)}>View evidence</button></td></tr>;
      })}</tbody></table></div><button className="secondary" onClick={() => setDialog("receipts")}>View safe event receipts</button>
    </section>}
    {view === "reliability" && <section className="card"><h2>Reliability and human oversight</h2><p>Retries, timeouts, interoperability and research evaluation remain separate from a successful privacy-control observation.</p><EvidenceSummary rows={rows.filter(row => secondaryIds.includes(row.id))} /><button className="secondary" onClick={() => setDialog("reliability")}>View reliability and oversight evidence</button></section>}
    {view === "recorded" && <DemoEvidence />}
    {dialog && <AppDialog title={activeGroup?.title || (dialog === "receipts" ? "Safe persisted event receipts" : "Reliability and oversight evidence")} onClose={() => setDialog(null)}>
      {dialog === "receipts" ? <><p>Allowlisted event types and timestamps only. No raw text, review contents or audit payloads.</p>{evidence && !stale ? <><ul>{evidence.receipts.map((receipt,index) => <li key={index}>{receipt.event} · <time dateTime={receipt.occurred_at}>{new Date(receipt.occurred_at).toLocaleString()}</time></li>)}</ul>{evidence.receipts_truncated && <p>Latest 50 receipts shown; earlier events omitted.</p>}</> : <p className="empty">No current receipt evidence available. Select a run and refresh.</p>}</> : detailRows.map(row => <article className="control-evidence" key={row.id} data-check={row.id}><h3><span className="requirement-id">{row.id}</span>{row.title}</h3><dl><div><dt>Implementation</dt><dd><StatusBadge value={row.implementation} /></dd></div><div><dt>Evidence</dt><dd><span className="status-badge" data-result={row.result}>{row.result}</span></dd></div><div><dt>Source</dt><dd>{row.source}</dd></div>{row.approval && <div><dt>External approval</dt><dd>{row.approval}</dd></div>}{row.readiness && <div><dt>Deployment / integration readiness</dt><dd>{row.readiness}</dd></div>}{row.evaluation && <div><dt>Evaluation gap</dt><dd>{row.evaluation}</dd></div>}</dl><p>{row.detail}</p>{row.time && <p className="hint">Observation/event time: <time dateTime={row.time}>{new Date(row.time).toLocaleString()}</time></p>}<p className="notice-inline">{row.missing}</p></article>)}
    </AppDialog>}
    <footer>J26-SE-338 · Local research workspace</footer>
  </main>;
}

function EvidenceSummary({ rows }: { rows: Check[] }) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.result, (counts.get(row.result) || 0) + 1);
  return <ul className="evidence-summary">{[...counts].map(([result,count]) => <li key={result} data-evidence={result}>{result}: <strong>{count}</strong> subcheck{count === 1 ? "" : "s"}</li>)}</ul>;
}
