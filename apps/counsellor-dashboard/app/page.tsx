"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@j26/common/api";
import { DemoHeader, ErrorMessage, SafetyNotice, processingLabel, reviewLabel } from "@j26/common/ui";
import type { AccountResponse, ReviewTask } from "@j26/common/contracts";

export default function Dashboard() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [selected, setSelected] = useState<ReviewTask | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api<AccountResponse>("/auth/me").then(async account => {
      if (account.role !== "COUNSELLOR") return;
      const values = await api<ReviewTask[]>("/review-tasks");
      if (live) { setAuthorized(true); setTasks(values); }
    }).catch(() => { if (live) setAuthorized(false); }).finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, []);

  async function load() {
    const values = await api<ReviewTask[]>("/review-tasks");
    setTasks(values);
    setSelected(previous => previous ? values.find(task => task.task_id === previous.task_id) || null : null);
  }
  async function act(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (cause) {
      setTasks([]); setSelected(null);
      if (cause instanceof ApiError && cause.status === 401) setAuthorized(false);
      setError(cause instanceof ApiError ? cause.message : cause instanceof Error && cause.message.includes("requires an authorized counsellor") ? cause.message : "The request could not be completed. Refresh assigned tasks or sign in again.");
    } finally { setBusy(false); }
  }
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    await act(async () => {
      let account: AccountResponse;
      try { account = await api<AccountResponse>("/auth/login", { username: values.get("username"), password: values.get("password") }); }
      finally { form.reset(); }
      if (account.role !== "COUNSELLOR") {
        await api("/auth/logout", {});
        throw new Error("This development shell requires an authorized counsellor account.");
      }
      setAuthorized(true); await load();
    });
  }
  return <main>
    <DemoHeader title="Counsellor review" subtitle="Assigned fictional cases, interpreted by an authorized human." />
    <SafetyNotice /><ErrorMessage message={error} />
    {checking ? <p role="status" className="empty">Checking your session…</p> : !authorized ? <section className="card sign-in" aria-labelledby="sign-in-title">
      <p className="eyebrow">Restricted access</p><h2 id="sign-in-title">Development sign-in</h2>
      <p>Use the synthetic counsellor credentials from your private local setup. Only assigned, consent-valid cases are available.</p>
      <form onSubmit={login}>
        <label htmlFor="username">Development username</label><input id="username" name="username" required autoComplete="username" />
        <label htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" />
        <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form><p className="hint">Use a separate browser profile from the student portal.</p>
    </section> : <>
      <nav className="toolbar" aria-label="Review controls"><div><h2>Assigned tasks</h2><p className="hint">Refresh to recheck access and current consent.</p></div>
        <div className="actions"><button className="secondary" disabled={busy} onClick={() => act(load)}>Refresh assigned tasks</button>
          <button className="quiet" disabled={busy} onClick={() => act(async () => { setAuthorized(false); setTasks([]); setSelected(null); await api("/auth/logout", {}); })}>Sign out</button></div></nav>
      <p role="status" className="feedback">{busy ? "Checking authorized evidence…" : `${tasks.length} authorized synthetic task(s)`}</p>
      <div className="review-grid"><section className="card task-list" aria-label="Assigned synthetic cases">
        {tasks.length === 0 ? <div className="empty"><h3>No assigned cases available</h3><p>Cases appear after successful processing with active consent. Withdrawn or inaccessible evidence is excluded.</p></div> :
          <ul>{tasks.map((task, index) => <li key={task.task_id}><button className={`task-button ${selected?.task_id === task.task_id ? "selected" : ""}`} disabled={busy} aria-pressed={selected?.task_id === task.task_id}
            onClick={() => act(async () => setSelected(await api<ReviewTask>(`/review-tasks/${task.task_id}`)))}>
            <strong>Open synthetic case {index + 1}</strong><span>{reviewLabel(task.case.processing_status)}</span>
          </button></li>)}</ul>}
      </section>
      <section className="card review-detail" aria-label="Selected case">
        {!selected ? <div className="empty"><h2>Select a case to review</h2><p>Opening a task rechecks your access with the server. No evidence is actionable after an access check fails.</p></div> : <>
          <div className="detail-heading"><h2>Synthetic case</h2><span className="status-badge">{reviewLabel(selected.case.processing_status)}</span></div>
          <p className="hint">Case reference: <code>{selected.case.case_id}</code></p>
          <dl className="evidence-list"><div><dt>Processing</dt><dd>{processingLabel(selected.case.processing_status)}</dd></div>
            <div><dt>Human review</dt><dd>{reviewLabel(selected.case.processing_status)}</dd></div>
            <div><dt>Mock wellbeing indicator</dt><dd>{selected.inference.wellbeing_indicator}</dd></div>
            <div><dt>Mock emotional tone</dt><dd>{selected.inference.emotional_tone}</dd></div>
            <div><dt>Mock stress-language signal</dt><dd>{selected.inference.stress_language_signals.join(", ")}</dd></div>
            <div><dt>Mock confidence</dt><dd>{Math.round(selected.inference.confidence * 100)}% — fixed fixture value, uncalibrated</dd></div>
            <div><dt>Explanation reliability</dt><dd>{selected.explanation.reliability_status} — no faithfulness calculation</dd></div></dl>
          <div className="mock-evidence"><h3>Mock explanation</h3>{selected.explanation.evidence.map((evidence, index) => <p key={index}>{evidence}</p>)}</div>
          <details><summary>Provider versions</summary><p>Model {selected.inference.model_version}; explainer {selected.explanation.explainer_version}; service {selected.inference.service_version}.</p></details>
          <p className="notice-inline">Processing completion is not human review completion. These fixed outputs are not research results or clinical recommendations.</p>
          {(["READY_FOR_REVIEW", "UNDER_REVIEW"].includes(selected.case.processing_status)) && <button disabled={busy} onClick={() => act(async () => {
            await api(`/review-tasks/${selected.task_id}/actions`, { action: selected.case.processing_status === "READY_FOR_REVIEW" ? "START_REVIEW" : "COMPLETE_REVIEW", idempotency_key: crypto.randomUUID() }); await load();
          })}>{selected.case.processing_status === "READY_FOR_REVIEW" ? "Start human review" : "Record review complete"}</button>}
        </>}
      </section></div>
    </>}
    <footer>C1 authorization and review shell · Full dashboard and explanation research remain with Component 4 · DEVELOPMENT ONLY</footer>
  </main>;
}
