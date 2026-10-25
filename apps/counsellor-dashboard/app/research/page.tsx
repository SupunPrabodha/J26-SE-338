"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, researchApi } from "@j26/common/api";
import { AppDialog, StaffFrame, DemoHeader, ErrorMessage, SafetyNotice, StaffSignIn, Icon, roleLabel, useDialogAccess, humanLabel } from "@j26/common/ui";
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
  return <StaffFrame area="research" current="research" authorized={!!role} role={role || undefined} checking={checking} busy={busy} onSignOut={() => act(async () => { setData(null); setDetail(null); setRole(null); await researchApi("/auth/logout", {}); })}><main className={role ? "research-directory-page" : "staff-entry-page"}><DemoHeader title="Component directory" subtitle="Explore the framework’s preprocessing, inference and explanation connections." /><SafetyNotice />{role && <ErrorMessage message={error} />}
    {checking ? <section className="card profile-loading" role="status"><Icon name="research" /><h2>Checking route access…</h2><p>Confirming your directory permissions.</p></section> : !role ? <StaffSignIn kind="research" busy={busy} onSubmit={login} error={error} /> : <>
      <section className="directory-summary"><div className="directory-symbol" aria-hidden="true"><Icon name="research" /></div><div><p className="eyebrow">Directory access · {roleLabel(role)}</p><h2>A clear view of the service boundaries</h2><p>Connection metadata for the current development framework. Component ownership stays separate from account permissions.</p></div><span className="tag">Metadata only</span></section>
      <div className="toolbar directory-toolbar"><div><h2>Service connections</h2><p className="hint">No case, dataset or annotation access.</p></div><button className="secondary" disabled={busy} onClick={() => act(load)}><Icon name="operations" />{busy ? "Refreshing…" : "Refresh routes"}</button></div>
      {data ? <div className="component-grid directory-grid">{data.items.map(item => <section className="card directory-card" key={item.component}><div className="directory-card-heading"><span className="component-number">{item.component}</span><span className="status-badge" data-status="MOCK">Mock provider</span></div><h2>{item.function === "PREPROCESSING" ? "Preprocessing" : item.function === "INFERENCE" ? "Inference" : "Explanation"}</h2><p className="directory-description">{item.component === "C2" ? "Text preparation and code-mixed preprocessing boundary." : item.component === "C3" ? "NLP model inference and versioned output boundary." : "Explanation evidence and reliability boundary."}</p><div className="directory-availability"><Icon name="info" /><div><strong>Internal API only</strong><p>No web page is connected in this checkout. The service API requires its own audience authentication.</p></div></div><button className="secondary" aria-label={`Provider metadata ${item.component}`} onClick={() => setDetail(item.component)}>View provider details<Icon name="arrow" /></button></section>)}</div> : <section className="card empty"><h3>Directory evidence is unavailable</h3><p>Refresh to recheck your access and the latest permitted metadata.</p></section>}
      <div className="directory-footnote"><Icon name="shield" /><p>Directory observed {data ? <time dateTime={data.observed_at}>{new Date(data.observed_at).toLocaleString()}</time> : "not available"}. New pages appear only after their routes and function-specific authorization are integrated. Mock providers do not demonstrate research results.</p></div></>}
    {selected && <AppDialog title={`Provider metadata: ${selected.component}`} onClose={() => setDetail(null)}><p>{humanLabel(selected.provider)}</p><p>{humanLabel(selected.route_status)}</p><p className="hint">C2 owns preprocessing/datasets; C3 owns inference/models; C4 owns explanations and final dashboard research. No new research implementation is introduced here.</p></AppDialog>}
    <footer>J26-SE-338 · Local research workspace</footer></main></StaffFrame>;
}
