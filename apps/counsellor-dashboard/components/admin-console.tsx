"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { adminApi, ApiError } from "@j26/common/api";
import { AppDialog, ChangeConfirmation, useDialogAccess, DemoHeader, ErrorMessage, SafetyNotice, StaffFrame, StaffSignIn, humanLabel, StatusBadge } from "@j26/common/ui";
import type { AccountResponse, AdminCasePage, AdminCaseSummary, AdminOverview, StaffPage, StaffSummary, StaffUpdateRequest } from "@j26/common/contracts";

import AdminOverviewPanel from "./admin-overview";

export type AdminSection = "overview" | "staff" | "assignments" | "operations" | "retention";
const titles: Record<AdminSection, string> = { overview: "Administration overview", staff: "Staff and roles", assignments: "Case assignments", operations: "Workflow and services", retention: "Retention overview" };
const stamp = (value?: string | null) => value ? new Date(value).toLocaleString() : "Not recorded";
type Filters = { q: string; state: string; assignment: string; role: string; enabled: string; disposed_only: string };
const initial: Filters = { q: "", state: "", assignment: "", role: "", enabled: "", disposed_only: "" };
const uuidPrefix = "[0-9a-fA-F-]{4,36}";

export default function AdminConsole({ section }: { section: AdminSection }) {
  const [authorized, setAuthorized] = useState(false), [checking, setChecking] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null), [staff, setStaff] = useState<StaffPage | null>(null), [cases, setCases] = useState<AdminCasePage | null>(null);
  const [draft, setDraft] = useState(initial), [filters, setFilters] = useState(initial), [offset, setOffset] = useState(0);
  const [selectedStaff, setSelectedStaff] = useState<StaffSummary | null>(null), [selectedCase, setSelectedCase] = useState<AdminCaseSummary | null>(null);
  const [metadata, setMetadata] = useState<AdminCaseSummary | null>(null);
  const [role, setRole] = useState<StaffUpdateRequest["role"]>("COUNSELLOR"), [enabled, setEnabled] = useState(true);
  const [recipient, setRecipient] = useState(""), [counsellors, setCounsellors] = useState<StaffSummary[]>([]), [pickerNext, setPickerNext] = useState<number | null>(null), [pickerQuery, setPickerQuery] = useState("");
  const [pending, setPending] = useState<{ title: string; description: string; execute: () => Promise<void> } | null>(null);
  const clear = useCallback(() => { setOverview(null); setStaff(null); setCases(null); setSelectedStaff(null); setSelectedCase(null); setMetadata(null); setPending(null); setCounsellors([]); }, []);
  function query(values: Filters, page: number) {
    const params = new URLSearchParams({ offset: String(page), limit: "20" });
    if (values.q) params.set("q", values.q);
    if (section === "staff") { if (values.role) params.set("role", values.role); if (values.enabled) params.set("enabled", values.enabled); }
    else { if (values.state) params.set("state", values.state); if (values.assignment) params.set("assignment", values.assignment); if (values.disposed_only) params.set("disposed_only", values.disposed_only); if (section === "assignments") params.set("eligible_only", "true"); }
    return params;
  }
  async function read(values = filters, page = offset) {
    clear();
    if (section === "overview") { setOverview(await adminApi<AdminOverview>("/admin/overview")); return; }
    if (section === "staff") setStaff(await adminApi<StaffPage>("/admin/staff?" + query(values, page)));
    else setCases(await adminApi<AdminCasePage>("/admin/cases?" + query(values, page)));
    if (section === "assignments" || section === "retention" || section === "operations") setOverview(await adminApi<AdminOverview>("/admin/overview"));
  }
  async function act(operation: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await operation(); } catch (cause) { clear(); setPending(null); if (cause instanceof ApiError && cause.status === 401) setAuthorized(false); setError(cause instanceof ApiError ? cause.message : "This action could not be completed. Refresh the current view and retry."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let live = true;
    async function start() {
      try {
        const account = await adminApi<AccountResponse>("/auth/me");
        if (!live) return;
        if (account.role !== "ADMIN") { setError("Administrative access is required for this page."); return; }
        setAuthorized(true);
        const params = new URLSearchParams({ offset: "0", limit: "20", ...(section === "assignments" ? { eligible_only: "true" } : {}) });
        const summary = await adminApi<AdminOverview>("/admin/overview");
        if (!live) return; setOverview(summary);
        if (section === "staff") { const result = await adminApi<StaffPage>("/admin/staff?" + params); if (live) setStaff(result); }
        else if (section !== "overview") { const result = await adminApi<AdminCasePage>("/admin/cases?" + params); if (live) setCases(result); }
      } catch (cause) { if (live) { clear(); if (cause instanceof ApiError && cause.status === 401) setAuthorized(false); else setError(cause instanceof ApiError ? cause.message : "Session check unavailable. Retry when connected."); } }
      finally { if (live) setChecking(false); }
    }
    void start(); return () => { live = false; };
  }, [section, clear]);
  useDialogAccess(selectedStaff?.account_id || selectedCase?.case_id || metadata?.case_id || null, async () => {
    const account = await adminApi<AccountResponse>("/auth/me");
    if (account.role !== "ADMIN") throw new ApiError(403, "Administrative access is no longer available.");
    if (selectedCase) {
      const current = await adminApi<AdminCasePage>(`/admin/cases?q=${selectedCase.case_id}`);
      if (!current.items.some(item => item.case_id === selectedCase.case_id && item.assignment_eligible)) throw new ApiError(404, "This case is no longer eligible for assignment. Refresh the case list.");
    }
  }, cause => {
    clear(); if (cause instanceof ApiError && [401,403].includes(cause.status)) setAuthorized(false);
    setError(cause instanceof ApiError ? cause.message : "Access verification unavailable or its window ended. Refresh and reopen to recheck permissions.");
  });
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, values = new FormData(form);
    await act(async () => { let account: AccountResponse; try { account = await adminApi<AccountResponse>("/auth/login", { username: values.get("username"), password: values.get("password"), remember_me: values.get("remember_me") === "on" }); } finally { form.reset(); }
      if (account.role !== "ADMIN") { await adminApi("/auth/logout", {}); throw new ApiError(403, "Administrative access is required for this page."); }
      setAuthorized(true); setOffset(0); setFilters(initial); setDraft(initial); await read(initial, 0);
    });
  }
  async function findCounsellors(search = pickerQuery, page = 0, append = false) {
    const result = await adminApi<StaffPage>(`/admin/staff?role=COUNSELLOR&enabled=true&limit=20&offset=${page}${search ? `&q=${encodeURIComponent(search)}` : ""}`);
    setCounsellors(previous => append ? [...previous, ...result.items.filter(item => item.usable)] : result.items.filter(item => item.usable)); setPickerNext(result.next_offset ?? null);
  }
  const next = section === "staff" ? staff?.next_offset : cases?.next_offset;
  const observedAt = section === "staff" ? staff?.observed_at : section === "overview" ? overview?.observed_at : cases?.observed_at;
  return <StaffFrame area="admin" current={section} authorized={authorized} checking={checking} busy={busy} onSignOut={() => act(async () => { clear(); setAuthorized(false); await adminApi("/auth/logout", {}); })}><main>
    <DemoHeader title={titles[section]} subtitle="Authorized staff administration and metadata-only operations." /><SafetyNotice />{!selectedStaff && !selectedCase && !metadata && <ErrorMessage message={error} />}
    {checking ? <section className="card empty" role="status">Checking administrative access…</section> : !authorized ? <StaffSignIn kind="admin" busy={busy} onSubmit={login} /> : <>
      <div className="toolbar"><div><h2>{section === "overview" ? "Current system snapshot" : "Records"}</h2><p className="hint">{observedAt ? `Observed ${stamp(observedAt)}` : "Refresh to load current evidence."}</p></div><button className="secondary" disabled={busy} onClick={() => act(() => read())}>Refresh view</button></div>
      <p className="feedback" role="status" aria-live="polite">{busy ? "Loading records…" : message || "Operational metadata only."}</p>
      {section === "overview" && overview && <AdminOverviewPanel overview={overview} onSessionEnded={() => { clear(); setAuthorized(false); }} />}
      {section !== "overview" && <section className="card filter-toolbar"><h2>Search and filter</h2><form onSubmit={event => { event.preventDefault(); setFilters({ ...draft }); setOffset(0); void act(() => read(draft, 0)); }}><div className="filter-grid"><div><label htmlFor="record-search">{section === "staff" ? "Staff reference prefix" : "Case reference prefix"}</label><input id="record-search" pattern={uuidPrefix} value={draft.q} placeholder="At least 4 reference characters" onChange={event => setDraft({ ...draft, q: event.target.value })} /></div>
        {section === "staff" ? <><div><label htmlFor="role-filter">Role</label><select id="role-filter" value={draft.role} onChange={event => setDraft({ ...draft, role: event.target.value })}><option value="">All staff roles</option><option value="ADMIN">Admin</option><option value="COUNSELLOR">Counsellor</option><option value="RESEARCHER">Researcher</option></select></div><div><label htmlFor="enabled-filter">Account status</label><select id="enabled-filter" value={draft.enabled} onChange={event => setDraft({ ...draft, enabled: event.target.value })}><option value="">All accounts</option><option value="true">Enabled</option><option value="false">Disabled</option></select></div></> : section === "assignments" ? <div><label htmlFor="assignment-filter">Assignment</label><select id="assignment-filter" value={draft.assignment} onChange={event => setDraft({ ...draft, assignment: event.target.value })}><option value="">All eligible cases</option><option value="AWAITING_ASSIGNMENT">Awaiting assignment</option><option value="ASSIGNED">Assigned</option></select></div> : section === "retention" ? <div><label htmlFor="retention-filter">Disposal status</label><select id="retention-filter" value={draft.disposed_only} onChange={event => setDraft({ ...draft, disposed_only: event.target.value })}><option value="">All retention states</option><option value="true">Disposed cases</option></select></div> : <div><label htmlFor="workflow-filter">Workflow state</label><select id="workflow-filter" value={draft.state} onChange={event => setDraft({ ...draft, state: event.target.value })}><option value="">All states</option>{["RECEIVED", "CONSENT_VERIFIED", "PREPROCESSING", "INFERENCE", "EXPLANATION", "READY_FOR_REVIEW", "UNDER_REVIEW", "COMPLETED", "FAILED", "WITHDRAWAL_REQUESTED", "WITHDRAWN"].map(state => <option key={state}>{state}</option>)}</select></div>}</div><div className="actions"><button disabled={busy}>Apply filters</button><button type="button" className="quiet" disabled={busy} onClick={() => { setDraft(initial); setFilters(initial); setOffset(0); void act(() => read(initial, 0)); }}>Clear filters</button></div></form></section>}
      {section === "staff" && <><section className="card"><div className="detail-heading"><h2>Staff accounts</h2><span className="tag">No student identities</span></div><p className="hint">Login handles and credentials are not exposed. Usable means enabled, unexpired and locally provisioned with credentials. Role changes and disabling revoke existing sessions.</p>
        {!staff ? <p className="empty">No current staff evidence.</p> : staff.items.length === 0 ? <p className="empty">No matching staff accounts.</p> : <div className="table-scroll" role="region" aria-label="Staff table" tabIndex={0}><table><thead><tr><th>Reference</th><th>Role</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead><tbody>{staff.items.map(item => <tr key={item.account_id}><td className="reference-cell"><code>{item.account_id.slice(0, 8)}</code>{item.is_current_account && <span className="tag">You</span>}</td><td>{humanLabel(item.role)}</td><td><StatusBadge value={item.enabled ? item.usable ? "ENABLED" : "UNAVAILABLE" : "DISABLED"}>{item.enabled ? item.usable ? "Usable" : "Enabled; unavailable" : "Disabled"}</StatusBadge></td><td>{stamp(item.updated_at)}</td><td><button className="text-button" disabled={busy} onClick={() => { setSelectedStaff(item); setRole(item.role); setEnabled(item.enabled); }}>Manage staff {item.account_id.slice(0, 8)}</button></td></tr>)}</tbody></table></div>}</section>

        <section className="card"><details><summary>Local account provisioning</summary><p>New privileged accounts are created by a local operator, never through public registration.</p><code>.venv/Scripts/python.exe scripts/provision_staff.py --role COUNSELLOR</code><p className="hint">The helper writes generated credentials only to an ignored .local file and prints its path. Use ADMIN or RESEARCHER only for an explicitly authorized local grant. No password-reset or account-delete action is exposed here.</p></details></section></>}
      {section !== "staff" && section !== "overview" && <section className="card"><div className="detail-heading"><h2>{section === "assignments" ? "Eligible cases" : section === "retention" ? "Retention and disposal" : "Workflow operations"}</h2><span className="tag">{section === "assignments" ? "Metadata only" : "Read-only"}</span></div>
        {!cases ? <p className="empty">No current case evidence.</p> : cases.items.length === 0 ? <p className="empty">No matching cases.</p> : <div className="table-scroll" role="region" aria-label="Case administration table" tabIndex={0}><table className={section === "assignments" ? "case-table assignment-table" : "case-table"}><thead><tr><th>Case</th>{section === "assignments" && <th>Submitted</th>}<th>Processing readiness</th><th>{section === "retention" ? "Deadline / disposal" : "Assignment"}</th><th>{section === "operations" ? "Job / safe failure" : "Updated"}</th>{section === "assignments" && <><th>Assigned counsellor</th><th>Human review</th><th>Last assignment change</th><th>Action</th></>}</tr></thead><tbody>{cases.items.map(item => <tr key={item.case_id}><td className="reference-cell"><code>{item.case_id.slice(0, 8)}</code><button className="text-button" aria-label={`Case metadata ${item.case_id.slice(0,8)}`} disabled={busy} onClick={() => setMetadata(item)}>Details</button></td>{section === "assignments" && <td>{stamp(item.created_at)}</td>}<td>{section === "assignments" && item.assignment_eligible ? "Processing complete" : <StatusBadge value={item.processing_status} />}</td><td>{section === "retention" ? <><time>{stamp(item.expires_at)}</time><span className="outcome">{item.disposal_reason ? humanLabel(item.disposal_reason) : "No disposal receipt"}</span></> : <><StatusBadge value={item.assignment_state}>{item.assignment_state === "AWAITING_ASSIGNMENT" ? "Awaiting assignment" : item.assignment_state === "ASSIGNED" ? "Assigned" : "Not eligible"}</StatusBadge><span className="outcome">{item.assignment_count} assignment(s){item.counsellors.some(counsellor => !counsellor.usable || counsellor.role !== "COUNSELLOR") ? " · staff unavailable" : ""}</span></>}</td><td>{section === "operations" ? <>{item.job_status ? humanLabel(item.job_status) : "No job"} · attempt {item.attempts}<span className="outcome">{item.failure_code ? humanLabel(item.failure_code) : "No failure code"}</span></> : stamp(item.updated_at)}</td>{section === "assignments" && <><td>{item.counsellors.map(staff => staff.display_name || `Counsellor ${staff.account_id.slice(0, 8)}`).join(", ") || "Unassigned"}</td><td>{item.human_review_status?.replaceAll("_", " ").toLowerCase() || "Unavailable"}</td><td>{stamp(item.last_assignment_at)}</td></>}{section === "assignments" && <td><button className="text-button" disabled={busy || !item.assignment_eligible} onClick={() => act(async () => { setSelectedCase(item); setRecipient(item.assignment_count === 1 ? item.counsellors[0]?.account_id || "" : ""); setPickerQuery(""); await findCounsellors("", 0); })}>Manage case {item.case_id.slice(0, 8)}</button></td>}</tr>)}</tbody></table></div>}</section>}

      {section !== "overview" && <div className="pagination"><button className="secondary" disabled={busy || offset === 0} onClick={() => { const page = Math.max(0, offset - 20); setOffset(page); void act(() => read(filters, page)); }}>Previous page</button><span className="hint">20 records per page · bounded filters</span><button className="secondary" disabled={busy || next == null} onClick={() => { const page = next!; setOffset(page); void act(() => read(filters, page)); }}>Next page</button></div>}
      {section === "retention" && <section className="card boundaries"><h2>Development retention policy</h2><p>Derived evidence and review contents are disposed on withdrawal or after the configured {overview?.retention_hours ?? "server-defined"} hours. Minimal permitted receipts remain. Consent expiry blocks review independently of the retention deadline.</p><p className="hint">This screen cannot change policy or delete records. The period is a development configuration, not institutional approval. Times above are case deadlines and last-case-update times, not invented disposal times.</p></section>}
      {section === "operations" && <section className="card boundaries"><h2>Service boundaries</h2><p>Current C2 preprocessing, C3 inference and C4 explanation providers are development mocks. No arbitrary retry, job execution or database control is provided.</p><Link prefetch={false} href="/research">Inspect the protected route directory ↗</Link></section>}
    </>}
    {(selectedStaff || selectedCase || metadata) && <AppDialog title={pending?.title || (selectedStaff ? `Manage staff ${selectedStaff.account_id.slice(0,8)}` : selectedCase ? `Assign case ${selectedCase.case_id.slice(0,8)}` : "Case metadata")} busy={busy} dirty={!!selectedStaff && (role !== selectedStaff.role || enabled !== selectedStaff.enabled) || !!selectedCase && recipient !== (selectedCase.assignment_count === 1 ? selectedCase.counsellors[0]?.account_id || "" : "")} onClose={() => { setSelectedStaff(null); setSelectedCase(null); setMetadata(null); setPending(null); setCounsellors([]); }}>
      {pending ? <ChangeConfirmation description={pending.description} busy={busy} error={error} onCancel={() => setPending(null)} onConfirm={() => act(async () => { await pending.execute(); setPending(null); })} /> : <>
      <ErrorMessage message={error} />
{selectedStaff && <><p className="hint">Staff reference <code>{selectedStaff.account_id}</code></p><p className="hint">Created {stamp(selectedStaff.created_at)} · expiry {stamp(selectedStaff.expires_at)}. The last usable admin cannot be disabled or demoted.</p><div className="filter-grid"><div><label htmlFor="staff-role">Staff role</label><select id="staff-role" disabled={busy} value={role} onChange={event => setRole(event.target.value as StaffUpdateRequest["role"])}><option value="ADMIN">Admin</option><option value="COUNSELLOR">Counsellor</option><option value="RESEARCHER">Researcher (local grant)</option></select></div><div><label htmlFor="staff-enabled">Account access</label><select id="staff-enabled" disabled={busy} value={String(enabled)} onChange={event => setEnabled(event.target.value === "true")}><option value="true">Enabled</option><option value="false">Disabled</option></select></div></div><button disabled={busy || role === selectedStaff.role && enabled === selectedStaff.enabled} onClick={() => setPending({ title: "Change staff access?", description: `Staff ${selectedStaff.account_id.slice(0, 8)} will become ${role}, ${enabled ? "enabled" : "disabled"}. Existing sessions will be revoked. No dataset or annotation permissions are created.`, execute: async () => { const result = await adminApi<StaffSummary>(`/admin/staff/${selectedStaff.account_id}`, { role, enabled, expected_updated_at: selectedStaff.updated_at }); if (result.is_current_account) { clear(); setAuthorized(false); setMessage("Your staff permissions changed. Sign in again."); } else { await read(); setMessage("Staff permissions saved; previous sessions revoked."); } } })}>Review staff change</button></>}
{section === "assignments" && selectedCase && <><p>Exclusive reassignment revokes every previous counsellor assignment. The new counsellor can read the existing saved record while consent remains valid; its author and contents are not changed.</p><p className="hint">Current staff references: {selectedCase.counsellors.map(item => item.account_id.slice(0, 8)).join(", ") || "None"}. First 20 references shown; total {selectedCase.assignment_count}.</p>
        <form onSubmit={event => { event.preventDefault(); void act(() => findCounsellors(pickerQuery, 0)); }}><label htmlFor="counsellor-search">Find active counsellor by reference prefix</label><input id="counsellor-search" pattern={uuidPrefix} value={pickerQuery} onChange={event => setPickerQuery(event.target.value)} /><button className="quiet" disabled={busy}>Find counsellors</button></form>
        <label htmlFor="assignment-recipient">Assigned counsellor</label><select id="assignment-recipient" value={recipient} disabled={busy} onChange={event => setRecipient(event.target.value)}><option value="">Awaiting assignment (remove access)</option>{recipient && !counsellors.some(item => item.account_id === recipient) && <option value={recipient}>Current reference {recipient.slice(0, 8)} · recheck eligibility</option>}{counsellors.map(item => <option key={item.account_id} value={item.account_id}>Counsellor {item.account_id.slice(0, 8)}</option>)}</select>
        {pickerNext != null && <button className="quiet" disabled={busy} onClick={() => act(() => findCounsellors(pickerQuery, pickerNext, true))}>More counsellors</button>}
        <button disabled={busy || (selectedCase.assignment_count === 0 && !recipient) || (selectedCase.assignment_count === 1 && selectedCase.counsellors[0]?.account_id === recipient)} onClick={() => setPending({ title: recipient ? "Confirm case assignment?" : "Remove case assignment?", description: recipient ? `Case ${selectedCase.case_id.slice(0, 8)} will be exclusively assigned to counsellor ${recipient.slice(0, 8)}. Previous counsellors lose access. Consent and staff eligibility will be checked again.` : "All counsellor assignments will be removed. This case will await assignment; processing and stored review content are not deleted by this action.", execute: async () => { await adminApi(`/admin/cases/${selectedCase.case_id}/assignment`, { counsellor_id: recipient || null, expected_version: selectedCase.assignment_version }); await read(); setMessage("Assignment saved. Previous assignments were revoked where applicable."); } })}>Review assignment change</button></>}
      {metadata && <dl className="status-list"><div><dt>Pseudonymous reference</dt><dd><code>{metadata.case_id}</code></dd></div><div><dt>Submitted</dt><dd>{stamp(metadata.created_at)}</dd></div><div><dt>Workflow state</dt><dd>{humanLabel(metadata.processing_status)}</dd></div><div><dt>Assignment</dt><dd>{humanLabel(metadata.assignment_state)}</dd></div><div><dt>Retention deadline</dt><dd>{stamp(metadata.expires_at)}</dd></div><div><dt>Disposal receipt</dt><dd>{metadata.disposal_reason ? humanLabel(metadata.disposal_reason) : "None recorded"}</dd></div></dl>}
      <p className="hint">Permissions are rechecked while this dialog is open and again on every server mutation. No counselling contents or identity links are loaded.</p><button className="quiet" disabled={busy} onClick={() => act(async () => { await adminApi("/admin/overview"); setMessage("Administrative access checked."); })}>Check current access</button>
      </>}
    </AppDialog>}
    <footer>J26-SE-338 · Local research workspace</footer>
  </main></StaffFrame>;
}
