"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@j26/common/api";
import { ErrorMessage, SafetyNotice } from "@j26/common/ui";
import type { AccountResponse, ReviewTask } from "@j26/common/contracts";

export default function Dashboard() {
  const [authorized, setAuthorized] = useState(false);
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<AccountResponse>("/auth/me").then(account => setAuthorized(account.role === "COUNSELLOR")).catch(() => setAuthorized(false));
  }, []);
  async function load() { setTasks(await api<ReviewTask[]>("/review-tasks")); }
  async function act(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (cause) { setTasks([]); setError(cause instanceof Error ? cause.message : "Request failed."); }
    finally { setBusy(false); }
  }
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    await act(async () => {
      const account = await api<AccountResponse>("/auth/login", { username: values.get("username"), password: values.get("password") });
      form.reset();
      if (account.role !== "COUNSELLOR") {
        await api("/auth/logout", {});
        throw new Error("This development shell requires an authorized counsellor account.");
      }
      setAuthorized(true); await load();
    });
  }
  return <main><header><p>J26-SE-338 · Secure development shell</p><h1>Counsellor-assisted review</h1></header>
    <SafetyNotice /><ErrorMessage message={error} />
    {!authorized ? <section><h2>Development sign-in</h2>
      <p>Use the synthetic counsellor credentials generated in your local environment.</p>
      <form onSubmit={login}>
        <label htmlFor="username">Development username</label><input id="username" name="username" required autoComplete="username" />
        <label htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" />
        <button disabled={busy}>Sign in</button>
      </form></section> : <>
      <nav aria-label="Review controls"><button disabled={busy} onClick={() => act(load)}>Refresh assigned tasks</button>
        <button disabled={busy} onClick={() => act(async () => { await api("/auth/logout", {}); setAuthorized(false); setTasks([]); })}>Sign out</button></nav>
      <p role="status">{busy ? "Loading…" : `${tasks.length} authorized synthetic task(s)`}</p>
      {tasks.map(task => <article key={task.task_id}>
        <h2>Synthetic case</h2><p><code>{task.case.case_id}</code></p>
        <dl><dt>Workflow</dt><dd>{task.case.processing_status}</dd>
          <dt>Wellbeing indicator</dt><dd>{task.inference.wellbeing_indicator}</dd>
          <dt>Emotional tone</dt><dd>{task.inference.emotional_tone}</dd>
          <dt>Stress-language signal</dt><dd>{task.inference.stress_language_signals.join(", ")}</dd>
          <dt>Mock confidence</dt><dd>{Math.round(task.inference.confidence * 100)}% — fixed fixture value, uncalibrated</dd>
          <dt>Explanation reliability</dt><dd>{task.explanation.reliability_status} — no faithfulness calculation</dd>
          <dt>Versions</dt><dd>Model {task.inference.model_version}; explainer {task.explanation.explainer_version}; service {task.inference.service_version}</dd></dl>
        {task.explanation.evidence.map((evidence, index) => <p key={index}>{evidence}</p>)}
        <p><strong>Authorized human review is required. These outputs are not research results.</strong></p>
        {task.case.processing_status !== "COMPLETED" && <button disabled={busy} onClick={() => act(async () => {
          await api(`/review-tasks/${task.task_id}/actions`, {
            action: task.case.processing_status === "READY_FOR_REVIEW" ? "START_REVIEW" : "COMPLETE_REVIEW",
            idempotency_key: crypto.randomUUID(),
          }); await load();
        })}>{task.case.processing_status === "READY_FOR_REVIEW" ? "Start human review" : "Record review complete"}</button>}
      </article>)}
    </>}
  </main>;
}
