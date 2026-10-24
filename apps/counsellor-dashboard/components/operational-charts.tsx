"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { adminApi, ApiError } from "@j26/common/api";
import { ErrorMessage, StatusBadge, humanLabel } from "@j26/common/ui";
import type { AdminAnalytics, AdminCasePage } from "@j26/common/contracts";

type Datum = { label: string; value: number };
const labels: Record<string, string> = { READY_FOR_REVIEW: "Awaiting review", UNDER_REVIEW: "In progress", COMPLETED: "Completed", UNAVAILABLE: "Unavailable" };
const label = (value: string) => labels[value] || value.toLowerCase().replaceAll("_", " ");
const utc = (value: string) => new Date(value).toISOString().slice(0, 10);

export function CountChart({ title, definition, values }: { title: string; definition: string; values: Datum[] }) {
  const max = Math.max(1, ...values.map(row => row.value));
  return <section className="card count-chart"><h3>{title}</h3><p className="hint">{definition}</p>
    {values.some(row => row.value > 0) ? <div className="bar-chart" role="img" aria-label={`${title}. ${values.map(row => `${row.label}: ${row.value}`).join("; ")}. Exact counts are available in the data table below.`}>{values.map(row => <div className="bar-row" key={row.label}><span>{row.label}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${row.value / max * 100}%` }} /></div><strong>{row.value}</strong></div>)}</div> : <p className="empty" role="status">No matching cases for this metric and range.</p>}
    <details><summary>View data table: {title}</summary><div className="table-scroll" tabIndex={0} role="region" aria-label={`${title} data`}><table><caption>{title} — case counts</caption><thead><tr><th scope="col">Category</th><th scope="col">Cases</th></tr></thead><tbody>{values.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.value}</td></tr>)}</tbody></table></div></details>
  </section>;
}

type Filters = { days: string; interval: "day" | "week"; state: string; assignment: string; q: string };
const initial: Filters = { days: "7", interval: "day", state: "", assignment: "", q: "" };
function params(values: Filters) {
  const until = new Date(); until.setUTCHours(0, 0, 0, 0); until.setUTCDate(until.getUTCDate() + 1);
  const since = new Date(until); since.setUTCDate(since.getUTCDate() - Number(values.days));
  const query = new URLSearchParams({ since: since.toISOString(), until: until.toISOString() });
  for (const key of ["q", "state", "assignment"] as const) if (values[key]) query.set(key, values[key]);
  return query;
}

export default function OperationalCharts({ refreshKey, onSessionEnded }: { refreshKey: string; onSessionEnded: () => void }) {
  const [draft, setDraft] = useState(initial), [filters, setFilters] = useState(initial), [offset, setOffset] = useState(0);
  const [data, setData] = useState<AdminAnalytics | null>(null), [cases, setCases] = useState<AdminCasePage | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState("");
  const serial = useRef({ revision: 0 }), ended = useRef(onSessionEnded), last = useRef({ values: initial, page: 0 });
  useEffect(() => { ended.current = onSessionEnded; }, [onSessionEnded]);
  const read = useCallback(async (values: Filters, page: number) => {
    last.current = { values, page };
    const revision = ++serial.current.revision;
    await Promise.resolve();
    setBusy(true); setData(null); setCases(null); setError("");
    try {
      const query = params(values);
      const [aggregate, list] = await Promise.all([
        adminApi<AdminAnalytics>(`/admin/analytics?${query}&interval=${values.interval}`),
        adminApi<AdminCasePage>(`/admin/cases?${query}&offset=${page}&limit=20`),
      ]);
      if (revision === serial.current.revision) { setData(aggregate); setCases(list); }
    } catch (cause) {
      if (revision === serial.current.revision) { if (cause instanceof ApiError && cause.status === 401) ended.current(); setError(cause instanceof ApiError ? cause.message : "Operational counts are unavailable. Refresh when connected."); }
    } finally { if (revision === serial.current.revision) setBusy(false); }
  }, []);
  useEffect(() => { const state = serial.current; let live = true; void Promise.resolve().then(() => { if (live) { const current = last.current; return read(current.values, current.page); } }); return () => { live = false; ++state.revision; }; }, [refreshKey, read]);
  async function apply(event: FormEvent) { event.preventDefault(); setFilters(draft); setOffset(0); await read(draft, 0); }
  const reviewCounts = new Map<string, number>();
  for (const item of data?.statuses || []) { const state = ["READY_FOR_REVIEW", "UNDER_REVIEW", "COMPLETED"].includes(item.state) ? label(item.state) : item.state === "WITHDRAWN" ? "Disposed" : "Not review-ready"; reviewCounts.set(state, (reviewCounts.get(state) || 0) + item.cases); }
  return <section className="operational-analysis" aria-labelledby="analysis-title"><div className="toolbar"><div><p className="eyebrow">Operational aggregates · Admin only</p><h2 id="analysis-title">Case activity and workload</h2></div><button className="secondary" disabled={busy} onClick={() => read(filters, offset)}>Refresh charts</button></div>
    <p className="hint">Charts and the source case table share the filters below. The overview cards above are an all-record snapshot. Counts represent synthetic cases, not people, diagnoses, audit events or model quality.</p>
    <form className="card" onSubmit={apply}><div className="filter-grid"><div><label htmlFor="chart-period">Submission range (UTC)</label><select id="chart-period" disabled={busy} value={draft.days} onChange={event => setDraft({ ...draft, days: event.target.value })}><option value="7">Last 7 calendar days</option><option value="28">Last 28 calendar days</option><option value="90">Last 90 calendar days</option></select></div><div><label htmlFor="chart-interval">Submission buckets</label><select id="chart-interval" disabled={busy} value={draft.interval} onChange={event => setDraft({ ...draft, interval: event.target.value as "day" | "week" })}><option value="day">Daily (UTC)</option><option value="week">Weekly (Monday, UTC)</option></select></div><div><label htmlFor="chart-state">Stored workflow state</label><select id="chart-state" disabled={busy} value={draft.state} onChange={event => setDraft({ ...draft, state: event.target.value })}><option value="">All states</option>{["RECEIVED", "CONSENT_VERIFIED", "PREPROCESSING", "INFERENCE", "EXPLANATION", "READY_FOR_REVIEW", "UNDER_REVIEW", "COMPLETED", "FAILED", "WITHDRAWAL_REQUESTED", "WITHDRAWN"].map(state => <option key={state} value={state}>{state}</option>)}</select></div><div><label htmlFor="chart-assignment">Assignment</label><select id="chart-assignment" disabled={busy} value={draft.assignment} onChange={event => setDraft({ ...draft, assignment: event.target.value })}><option value="">All cases</option><option value="AWAITING_ASSIGNMENT">Eligible, awaiting assignment</option><option value="ASSIGNED">Eligible, assigned</option></select></div><div><label htmlFor="chart-reference">Case reference prefix</label><input id="chart-reference" disabled={busy} pattern="[0-9a-fA-F-]{4,36}" value={draft.q} onChange={event => setDraft({ ...draft, q: event.target.value })} placeholder="At least 4 reference characters" /></div></div><button disabled={busy}>Apply chart filters</button></form>
    <ErrorMessage message={error} />
    {busy ? <div className="card loading-skeleton" role="status" aria-live="polite">Loading authorized counts and matching case records…</div> : data && cases ? <>
      <p className="chart-observed" role="status" data-chart-total={data.total_cases}>{data.total_cases} matching case(s) · {utc(data.since)} inclusive to {utc(data.until)} exclusive · UTC · updated {new Date(data.observed_at).toLocaleString()}</p>
      <div className="charts-grid"><CountChart title="Cases by stored workflow state" definition="One case per current processing/review state; these are not job or event counts." values={data.statuses.map(row => ({ label: row.state, value: row.cases }))} /><CountChart title="Human-review status" definition="Review-ready, in-progress and completed states counted separately from cases not review-ready or disposed." values={[...reviewCounts].map(([label, value]) => ({ label, value }))} /><CountChart title={`Submissions by ${data.interval === "day" ? "day" : "week"}`} definition="One persisted case at submission time. UTC days or Monday-start weeks; edge weeks may be partial. Retries and consent-only decisions add no submission." values={data.submissions.map(row => ({ label: utc(row.bucket_start), value: row.cases }))} /><CountChart title="Active assigned workload" definition={`Within the same submitted-case range: ${data.workload_assignment_pairs} case/counsellor assignment pair(s). Only usable counsellors and consent-valid awaiting/in-progress review cases; completed work is excluded. Top 20 staff plus an Other aggregate; legacy multi-grants can count a case for more than one counsellor.`} values={data.workload.map(row => ({ label: row.display_name, value: row.cases }))} /></div>
      <section className="card"><h3>Matching source cases</h3><p className="hint">Same submission range and filters as the charts · {data.total_cases} total · 20 per page. Separate request snapshots can differ if processing changes during refresh.</p><div className="table-scroll" tabIndex={0} role="region" aria-label="Chart source cases"><table><thead><tr><th>Case</th><th>Submitted (UTC)</th><th>Workflow state</th><th>Assignment</th><th>Human review</th></tr></thead><tbody>{cases.items.map(item => <tr key={item.case_id}><td><details className="identifier"><summary><code>{item.case_id.slice(0, 8)}</code></summary><code>{item.case_id}</code></details></td><td>{new Date(item.created_at).toISOString()}</td><td><StatusBadge value={item.processing_status} /></td><td>{humanLabel(item.assignment_state)}</td><td>{label(item.human_review_status || "UNAVAILABLE")}</td></tr>)}</tbody></table></div>{cases.items.length === 0 && <p className="empty">No source cases match these filters.</p>}<div className="pagination"><button className="quiet" disabled={busy || offset === 0} onClick={() => { const page = offset - 20; setOffset(page); void read(filters, page); }}>Previous source cases</button><button className="quiet" disabled={busy || cases.next_offset == null} onClick={() => { const page = cases.next_offset!; setOffset(page); void read(filters, page); }}>Next source cases</button></div></section>
    </> : !error && <p className="empty">No current operational evidence. Refresh to retry.</p>}
  </section>;
}
