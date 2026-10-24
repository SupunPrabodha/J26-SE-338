"use client";

import { useEffect, useState, type FormEvent } from "react";
import { adminApi, ApiError } from "@j26/common/api";
import { AppDialog, useDialogAccess, StaffFrame, DemoHeader, ErrorMessage, SafetyNotice, StaffSignIn, humanLabel, StatusBadge } from "@j26/common/ui";
import type { AccountResponse, AdminAuditPage } from "@j26/common/contracts";

const eventTypes = ["AUTH_LOGIN", "AUTH_FAILURE", "AUTH_LOGOUT", "AUTH_REFRESH", "SESSION_REVOKED", "CONSENT_RECORDED", "CONSENT_EXPIRED", "OPERATION_BLOCKED", "SUBMISSION", "SUBMISSION_REPLAY", "WORKFLOW_TRANSITION", "JOB_RETRY", "JOB_TERMINAL", "JOB_CLAIM", "HUMAN_REVIEW", "WITHDRAWAL", "RETENTION", "ASSIGNMENT", "ADMIN_EVIDENCE_ACCESS", "STAFF_ADMINISTRATION"];
const instant = (value: string) => new Date(value).toLocaleString();
const initial = { case_id: "", event_type: "", since: "", until: "" };
type Filters = typeof initial;

export default function Operations() {
  const [authorized, setAuthorized] = useState(false), [checking, setChecking] = useState(true);
  const [page, setPage] = useState<AdminAuditPage | null>(null);
  const [draft, setDraft] = useState(initial), [filters, setFilters] = useState(initial);
  const [cursor, setCursor] = useState<string | null>(null), [history, setHistory] = useState<(string | null)[]>([]);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const selectedEvent = page?.items.find(item => item.event_id === detail);
  useDialogAccess(page && detail ? detail : null, async () => {
    await adminApi("/admin/overview");
    if (detail === "provider" && page?.case_operations) {
      const current = await adminApi<AdminAuditPage>(`/admin/audit-events?limit=1&case_id=${page.case_operations.case_id}`);
      if (page.case_operations.provenance && !current.case_operations?.provenance) throw new ApiError(404, "Derived provenance is no longer available. Refresh the permitted receipts.");
    }
  }, cause => {
    setDetail(null); setPage(null); if (cause instanceof ApiError && [401,403].includes(cause.status)) setAuthorized(false);
    setError(cause instanceof ApiError ? cause.message : "Evidence access verification unavailable or its window ended. Refresh to recheck.");
  });
  function path(values: Filters, position: string | null) {
    const params = new URLSearchParams({ limit: "25" });
    for (const [key, value] of Object.entries(values)) if (value) params.set(key, key === "since" || key === "until" ? new Date(value).toISOString() : value);
    if (position) params.set("cursor", position);
    return "/admin/audit-events?" + params;
  }
  async function read(values = filters, position = cursor) {
    setDetail(null);
    setPage(null);
    setPage(await adminApi<AdminAuditPage>(path(values, position)));
  }
  async function act(operation: () => Promise<void>) {
    setBusy(true); setError("");
    try { await operation(); } catch (cause) {
      setPage(null); setDetail(null);
      if (cause instanceof ApiError && cause.status === 401) setAuthorized(false);
      setError(cause instanceof ApiError ? cause.message : "Operational evidence is unavailable. Check the filters and connection, then retry.");
    } finally { setBusy(false); }
  }
  useEffect(() => {
    let live = true;
    adminApi<AccountResponse>("/auth/me").then(async account => {
      if (account.role !== "ADMIN") { if (live) setError("Administrative access is required. Sign in with an authorized admin account."); return; }
      const result = await adminApi<AdminAuditPage>("/admin/audit-events?limit=25");
      if (live) { setAuthorized(true); setPage(result); }
    }).catch(cause => { if (live && !(cause instanceof ApiError && cause.status === 401)) setError(cause instanceof ApiError ? cause.message : "Session check unavailable. Retry when connected."); }).finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, values = new FormData(form);
    await act(async () => {
      let account: AccountResponse;
      try { account = await adminApi<AccountResponse>("/auth/login", { username: values.get("username"), password: values.get("password") }); }
      finally { form.reset(); }
      if (account.role !== "ADMIN") { await adminApi("/auth/logout", {}); throw new ApiError(403, "Administrative access is required. This account cannot open operational evidence."); }
      setAuthorized(true); setCursor(null); setHistory([]); await read(initial, null);
    });
  }
  return <StaffFrame area="admin" current="audit" authorized={authorized} busy={busy} onSignOut={() => act(async () => { setPage(null); setDetail(null); setAuthorized(false); await adminApi("/auth/logout", {}); })}><main>
    <DemoHeader title="Operational evidence" subtitle="Restricted lifecycle receipts, policy outcomes and service provenance." />
    <SafetyNotice /><ErrorMessage message={error} />
    {checking ? <section className="card empty" role="status">Checking administrative access…</section> : !authorized ? <StaffSignIn kind="admin" busy={busy} onSubmit={login} /> : <>
      <section className="card audit-filters filter-toolbar" aria-labelledby="filter-title"><div className="detail-heading"><div><p className="eyebrow">Evidence explorer</p><h2 id="filter-title">Find lifecycle events</h2></div><span className="tag">25 events per page</span></div>
        <form onSubmit={event => { event.preventDefault(); if (draft.since && draft.until && new Date(draft.since) > new Date(draft.until)) { setError("From time must be before or equal to Until time."); return; } setFilters({ ...draft }); setCursor(null); setHistory([]); void act(() => read(draft, null)); }}>
          <div className="filter-grid"><div><label htmlFor="audit-case">Case reference</label><input id="audit-case" value={draft.case_id} placeholder="Optional pseudonymous UUID" onChange={event => setDraft({ ...draft, case_id: event.target.value })} pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" /></div>
            <div><label htmlFor="audit-type">Event type</label><select id="audit-type" value={draft.event_type} onChange={event => setDraft({ ...draft, event_type: event.target.value })}><option value="">All permitted types</option>{eventTypes.map(type => <option key={type} value={type}>{type.replaceAll("_", " ").toLowerCase()}</option>)}</select></div>
            <div><label htmlFor="audit-since">From time (local)</label><input type="datetime-local" id="audit-since" value={draft.since} onChange={event => setDraft({ ...draft, since: event.target.value })} /></div><div><label htmlFor="audit-until">Until time (local)</label><input type="datetime-local" id="audit-until" value={draft.until} onChange={event => setDraft({ ...draft, until: event.target.value })} /></div></div>
          <div className="actions"><button disabled={busy}>Apply filters</button><button type="button" className="quiet" disabled={busy} onClick={() => { setDraft(initial); setFilters(initial); setCursor(null); setHistory([]); void act(() => read(initial, null)); }}>Clear filters</button><button type="button" className="secondary" disabled={busy} onClick={() => act(() => read())}>Refresh evidence</button></div>
        </form>
      </section>
      <p className="feedback" role="status">{busy ? "Loading authorized receipts…" : page ? `Observed ${instant(page.observed_at)} · ${page.items.length} event(s) on this page` : "Evidence unavailable. Refresh to recheck access."}</p>
      {page?.case_operations && <section className="card operations-panel"><h2>Case operations · {page.case_operations.case_id.slice(0, 8)}</h2><dl className="evidence-list"><div><dt>Workflow state</dt><dd><StatusBadge value={page.case_operations.processing_status} /></dd></div><div><dt>Failure code</dt><dd>{page.case_operations.failure_code ? humanLabel(page.case_operations.failure_code) : "None recorded"}</dd></div><div><dt>Disposal reason</dt><dd>{page.case_operations.retention_reason ? humanLabel(page.case_operations.retention_reason) : "None recorded"}</dd></div><div><dt>Provider mode</dt><dd>Mock · synthetic development</dd></div></dl>
        <button className="text-button" onClick={() => setDetail("provider")}>Available provider versions</button></section>}
      <section className="card audit-card" aria-labelledby="audit-title"><div className="detail-heading"><h2 id="audit-title">Persisted audit events</h2><span className="tag">Read-only</span></div><p className="hint">Event time records persistence; observed time records this response. A policy deadline, when present, is shown separately. Only permitted event/outcome pairs are returned.</p>
        {!page ? <p className="empty">No current evidence to display.</p> : page.items.length === 0 ? <div className="empty"><h3>No matching events</h3><p>Adjust the date, event or case filters. Missing events are not reconstructed.</p></div> : <div className="table-scroll" role="region" aria-label="Audit event table" tabIndex={0}><table><thead><tr><th scope="col">Event time</th><th scope="col">Event / outcome</th><th scope="col">Case</th><th scope="col">Safe detail</th></tr></thead><tbody>{page.items.map(item => <tr key={item.event_id}>
          <td><time dateTime={item.occurred_at}>{instant(item.occurred_at)}</time></td><td><strong>{humanLabel(item.event_type)}</strong><span className="outcome">{humanLabel(item.outcome)}</span></td>
          <td>{item.case_id ? <button className="text-button" disabled={busy} aria-label={`Filter case ${item.case_id}`} onClick={() => { const values = { ...initial, case_id: item.case_id! }; setDraft(values); setFilters(values); setCursor(null); setHistory([]); void act(() => read(values, null)); }}><code>{item.case_id.slice(0, 8)}</code> ↗</button> : <span className="hint">Not case-scoped</span>}</td>
          <td><button className="text-button" aria-label={`Audit references ${item.event_id}`} onClick={() => setDetail(item.event_id)}>References</button></td>
        </tr>)}</tbody></table></div>}
        <div className="pagination"><button className="secondary" disabled={busy || history.length === 0} onClick={() => { const previous = history.at(-1) ?? null; setCursor(previous); setHistory(history.slice(0, -1)); void act(() => read(filters, previous)); }}>Newer events</button><span className="hint">Bounded cursor pagination · no automatic polling</span><button className="secondary" disabled={busy || !page?.next_cursor} onClick={() => { const next = page!.next_cursor!; setHistory([...history, cursor]); setCursor(next); void act(() => read(filters, next)); }}>Older events</button></div>
      </section>
      <section className="card boundaries"><h2>Evidence boundaries</h2><p>Local HTTP has no verified TLS. Storage encryption has not been demonstrated. Audit triggers prevent application updates and deletes; database operators remain trusted.</p><p className="hint">One administrative read receipt is retained per authenticated session. Filters and page refreshes do not create a stream of audit writes. Session/security events are scoped to available persisted records, without account identities or mappings.</p></section>
    </>}
    {page && (selectedEvent || detail === "provider" && page.case_operations) && <AppDialog title={selectedEvent ? "Safe audit references" : "Available provider versions"} onClose={() => setDetail(null)}>
      {selectedEvent ? <dl><dt>Event</dt><dd><code>{selectedEvent.event_id}</code></dd><dt>Correlation</dt><dd><code>{selectedEvent.correlation_id}</code></dd>{selectedEvent.case_id && <><dt>Case</dt><dd><code>{selectedEvent.case_id}</code></dd></>}<dt>Orchestrator version</dt><dd>{selectedEvent.service_version}</dd><dt>Policy expiry deadline</dt><dd>{selectedEvent.policy_expires_at ? instant(selectedEvent.policy_expires_at) : "Not recorded"}</dd></dl> : page.case_operations?.provenance ? <dl className="evidence-list">{Object.entries(page.case_operations?.provenance || {}).filter(([key]) => key.endsWith("version")).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{String(value)}</dd></div>)}</dl> : <p>Derived provenance is unavailable or withheld by consent, retention or disposal policy. No historical versions are reconstructed.</p>}
      <p className="hint">This view contains allowlisted operational metadata only. No review text, predictions, explanations or identity mappings are loaded.</p>
      <button className="secondary" disabled={busy} onClick={() => act(() => read())}>Recheck access and refresh evidence</button>
    </AppDialog>}
    <footer>J26-SE-338 · Local research workspace</footer>
  </main></StaffFrame>;
}
