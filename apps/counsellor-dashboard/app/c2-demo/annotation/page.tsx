"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "@j26/common/api";
import type { AccountResponse, LoginRequest } from "@j26/common/contracts";
import { DemoHeader } from "@j26/common/ui";
import { SubmissionWorkbench } from "./SubmissionWorkbench";
import "../demo.css";

function safeError(cause: unknown) {
  if (cause instanceof ApiError) {
    if (cause.status === 401) return "Session ended or sign-in failed. Sign in with your existing development account.";
    if (cause.status === 403) return "This synthetic workbench requires an authorized development counsellor or admin account.";
    if (cause.status === 404) return "Annotation is disabled or this record is outside the eligible synthetic queue.";
    if (cause.status === 409) return "Saved version changed, submission is final, or two accounts already hold this item. Reload saved state.";
    if (cause.status === 422) return "Check the allowed labels and complete every field before final submission.";
  }
  return "Annotation service is unavailable. Saved server history is retained; reload before retrying.";
}

export default function AnnotationPage() {
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const sequence = useRef(0), submitting = useRef(false);
  const controller = useRef<AbortController | null>(null);

  function begin() {
    sequence.current += 1; controller.current?.abort();
    const pending = new AbortController(); controller.current = pending;
    setError(""); setMessage(""); setBusy(true); submitting.current = true;
    return { id: sequence.current, signal: pending.signal };
  }
  function fail(cause: unknown, id: number) {
    if (sequence.current !== id) return;
    setError(safeError(cause));
    if (cause instanceof ApiError && [401, 403].includes(cause.status)) {
      setAccount(null);
    }
  }
  function finish(id: number) {
    if (sequence.current === id) { submitting.current = false; setBusy(false); }
  }
  useEffect(() => {
    const pending = new AbortController(); controller.current = pending;
    const id = ++sequence.current;
    api<AccountResponse>("/auth/me", undefined, true, pending.signal).then(async value => {
      if (sequence.current === id) { setAccount(value); }
    }).catch(cause => fail(cause, id)).finally(() => finish(id));
    return () => { sequence.current += 1; pending.abort(); controller.current?.abort(); };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current) return;
    const form = event.currentTarget, values = new FormData(form);
    const body: LoginRequest = { username: String(values.get("username") ?? ""), password: String(values.get("password") ?? "") };
    (form.elements.namedItem("password") as HTMLInputElement).value = "";
    const { id, signal } = begin();
    try {
      const value = await api<AccountResponse>("/auth/login", body, false, signal);
      if (sequence.current === id) { setAccount(value); }
    } catch (cause) { fail(cause, id); }
    finally { finish(id); }
  }
  async function logout() {
    if (dirty && !window.confirm("Sign out with unsaved labels? Save a draft first to retain them.")) return;
    const { id, signal } = begin(); setAccount(null);
    try { await api("/auth/logout", {}, false, signal); }
    catch (cause) { fail(cause, id); }
    finally { finish(id); }
  }

  return <main className="c2-demo c2-annotation-page">
    <DemoHeader title="C2 Synthetic Dataset Annotation" subtitle="Saved human decisions on fictional, privacy-cleared items." component="Component 2" badge="Provisional vocabulary · Development only" />
    <nav className="actions"><a href="/c2-demo">Back to C2 demo</a>{account && <button onClick={logout}>Sign out</button>}</nav>
    <p className="hint">Synthetic demonstration only.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status" className="notice">{message}</p>}
    {busy && <p role="status">Loading or saving actual server state…</p>}
    {!account && !busy && <section className="card"><h2>Existing development sign-in</h2><form onSubmit={login}>
      <label htmlFor="annotation-username">Username</label><input id="annotation-username" name="username" autoComplete="off" required maxLength={100} />
      <label htmlFor="annotation-password">Password</label><input id="annotation-password" name="password" type="password" autoComplete="off" required maxLength={256} />
      <button disabled={busy}>Sign in</button></form></section>}
    {account && <SubmissionWorkbench key={account.account_id} onDirtyChange={setDirty} onExpired={reason => { setAccount(null); setError(reason); }} />}

  </main>;
}
