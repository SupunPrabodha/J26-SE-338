"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, researchApi } from "@j26/common/api";
import { AppDialog, StaffFrame, DemoHeader, ErrorMessage, SafetyNotice, StaffSignIn, useDialogAccess, humanLabel } from "@j26/common/ui";
import type { AccountResponse, ComponentDirectory } from "@j26/common/contracts";

export default function ResearchDirectory() {
  const [role, setRole] = useState<string | null>(null), [data, setData] = useState<ComponentDirectory | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [checking, setChecking] = useState(true);
  const [detail, setDetail] = useState<string | null>(null);
  const selected = data?.items.find(item => item.component === detail);
  useDialogAccess(selected?.component || null, () => researchApi("/component-routes"), cause => {
    setDetail(null); setData(null); if (cause instanceof ApiError && [401,403].includes(cause.status)) setRole(null);
    setError(cause instanceof ApiError ? cause.message : "Directory access verification unavailable or its window ended. Refresh to retry.");
  });
  async function load() {
    const account = await researchApi<AccountResponse>("/auth/me");
    const result = await researchApi<ComponentDirectory>("/component-routes");
    setRole(account.role); setData(result);
  }
  async function act(operation: () => Promise<void>) {
    setBusy(true); setError("");
    try { await operation(); } catch (cause) { setData(null); if (cause instanceof ApiError && [401, 403].includes(cause.status)) setRole(null); setError(cause instanceof ApiError ? cause.message : "The protected directory is unavailable. Retry when connected."); } finally { setBusy(false); }
  }
  useEffect(() => { let live = true; (async () => { try { const account = await researchApi<AccountResponse>("/auth/me"); const result = await researchApi<ComponentDirectory>("/component-routes"); if (live) { setRole(account.role); setData(result); } } catch (cause) { if (live && !(cause instanceof ApiError && cause.status === 401)) setError(cause instanceof ApiError ? cause.message : "Directory unavailable."); } finally { if (live) setChecking(false); } })(); return () => { live = false; }; }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, values = new FormData(form);
    await act(async () => { try { await researchApi("/auth/login", { username: values.get("username"), password: values.get("password"), remember_me: values.get("remember_me") === "on" }); } finally { form.reset(); } await load(); });
  }
  return <StaffFrame area="research" current="research" authorized={!!role} role={role || undefined} busy={busy} onSignOut={() => act(async () => { setData(null); setDetail(null); setRole(null); await researchApi("/auth/logout", {}); })}><main><DemoHeader title="Component directory" subtitle="Available preprocessing, inference and explanation connections." /><SafetyNotice /><ErrorMessage message={error} />
    {checking ? <p role="status">Checking route access…</p> : !role ? <StaffSignIn kind="research" busy={busy} onSubmit={login} /> : <><div className="toolbar"><div><h2>Service connections</h2><p className="hint">Metadata only. No case, dataset or annotation access.</p></div><button className="secondary" disabled={busy} onClick={() => act(load)}>Refresh routes</button></div>
      {data ? <div className="component-grid">{data.items.map(item => <section className="card" key={item.component}><p className="eyebrow">{item.component}</p><h2>{item.function.toLowerCase()}</h2><p><span className="status-badge" data-status="MOCK">Mock provider</span></p><p>No web page is connected in this checkout. The existing internal service API remains audience-authenticated and is not exposed as a public link.</p><button className="text-button" aria-label={`Provider metadata ${item.component}`} onClick={() => setDetail(item.component)}>Actual provider / route provenance</button></section>)}</div> : <p className="empty">No current route evidence. Refresh to recheck access.</p>}
      <p className="hint">Directory observed {data ? new Date(data.observed_at).toLocaleString() : "not available"}. Links can be added only when teammate pages and their function-specific authorization are integrated.</p></>}
    {selected && <AppDialog title={`Provider metadata: ${selected.component}`} onClose={() => setDetail(null)}><p>{humanLabel(selected.provider)}</p><p>{humanLabel(selected.route_status)}</p><p className="hint">C2 owns preprocessing/datasets; C3 owns inference/models; C4 owns explanations and final dashboard research. No new research implementation is introduced here.</p></AppDialog>}
    <footer>J26-SE-338 · Local research workspace</footer></main></StaffFrame>;
}
