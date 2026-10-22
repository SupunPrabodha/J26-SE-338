"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "@j26/common/api";
import type { AccountResponse, LoginRequest, C2AnnotationDetail, C2AnnotationQueue, C2AnnotationLabels, C2AnnotationSaveRequest } from "@j26/common/contracts";
import { DemoHeader } from "@j26/common/ui";
import { PipelineStepper } from "../PipelineStepper";
import { SubmissionWorkbench } from "./SubmissionWorkbench";
import "../demo.css";

const dimensions = ["language", "code_mixing", "emotion", "wellbeing"] as const;
type Labels = Pick<C2AnnotationLabels, typeof dimensions[number]>;
const empty: Labels = { language: null, code_mixing: null, emotion: null, wellbeing: null };
const readable = (value: string) => value.replaceAll(/[-_]/g, " ");
const titles = { language: "Language", code_mixing: "Code-mixing pattern", emotion: "Emotion", wellbeing: "Wellbeing indicator" };

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
  const [queue, setQueue] = useState<C2AnnotationQueue | null>(null);
  const [detail, setDetail] = useState<C2AnnotationDetail | null>(null);
  const [selected, setSelected] = useState("");
  const [labels, setLabels] = useState<Labels>(empty);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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
      setAccount(null); setQueue(null); setDetail(null); setSelected(""); setLabels(empty);
    }
  }
  function finish(id: number) {
    if (sequence.current === id) { submitting.current = false; setBusy(false); }
  }
  function apply(value: C2AnnotationDetail) {
    setDetail(value); setLabels(value.own_history.at(-1)?.labels ?? empty);
  }
  async function loadItem(recordId: string) {
    const { id, signal } = begin(); setSelected(recordId); setDetail(null); setLabels(empty);
    try {
      const value = await api<C2AnnotationDetail>(`/c2-annotations/${encodeURIComponent(recordId)}`, undefined, true, signal);
      if (sequence.current === id) apply(value);
    } catch (cause) { fail(cause, id); }
    finally { finish(id); }
  }
  useEffect(() => {
    const pending = new AbortController(); controller.current = pending;
    const id = ++sequence.current;
    api<AccountResponse>("/auth/me", undefined, true, pending.signal).then(async value => {
      const catalogue = await api<C2AnnotationQueue>("/c2-annotations/prepare", {}, true, pending.signal);
      if (sequence.current === id) { setAccount(value); setQueue(catalogue); }
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
      const catalogue = await api<C2AnnotationQueue>("/c2-annotations/prepare", {}, true, signal);
      if (sequence.current === id) { setAccount(value); setQueue(catalogue); }
    } catch (cause) { fail(cause, id); }
    finally { finish(id); }
  }
  async function save(status: "DRAFT" | "FINAL") {
    if (submitting.current || !detail?.can_submit) return;
    const { id, signal } = begin();
    const body: C2AnnotationSaveRequest = {
      record_version: detail.item.record_version, pipeline_version: detail.item.pipeline_version,
      annotation_schema_version: detail.item.annotation_schema_version, vocabulary_version: detail.item.vocabulary_version,
      expected_revision: detail.own_history.at(-1)?.revision ?? 0, status, labels,
    };
    try {
      const value = await api<C2AnnotationDetail>(`/c2-annotations/${encodeURIComponent(detail.item.record_id)}/revisions`, body, true, signal);
      if (sequence.current === id) { apply(value); setMessage(status === "FINAL" ? "Final submission saved. Agreement and adjudication are not evaluated." : "Draft saved on the server. You may reload this page."); }
    } catch (cause) { fail(cause, id); }
    finally { finish(id); }
  }
  async function logout() {
    const { id, signal } = begin(); setAccount(null); setQueue(null); setDetail(null); setSelected(""); setLabels(empty);
    try { await api("/auth/logout", {}, false, signal); }
    catch (cause) { fail(cause, id); }
    finally { finish(id); }
  }

  return <main className="c2-demo c2-annotation-page">
    <DemoHeader title="C2 Synthetic Dataset Annotation" subtitle="Saved human decisions on fictional, privacy-cleared items." component="Component 2" badge="Provisional vocabulary · Development only" />
    <nav className="actions"><a href="/c2-demo">Back to C2 demo</a>{account && <button onClick={logout}>Sign out</button>}</nav>
    <aside className="notice"><strong>Fictional demonstration only — vocabulary is not expert-approved.</strong><p>Emotion and wellbeing labels describe text, not clinical diagnoses. Two accounts establish separate submissions, not verified human independence.</p></aside>
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status" className="notice">{message}</p>}
    {busy && <p role="status">Loading or saving actual server state…</p>}
    {!account && !busy && <section className="card"><h2>Existing development sign-in</h2><form onSubmit={login}>
      <label htmlFor="annotation-username">Username</label><input id="annotation-username" name="username" autoComplete="off" required maxLength={100} />
      <label htmlFor="annotation-password">Password</label><input id="annotation-password" name="password" type="password" autoComplete="off" required maxLength={256} />
      <button disabled={busy}>Sign in</button></form></section>}
    {account && queue && <>
      <SubmissionWorkbench key={account.account_id} onExpired={reason => { setAccount(null); setQueue(null); setDetail(null); setLabels(empty); setError(reason); }} />
      <details><summary>Earlier standalone synthetic items (saved history preserved)</summary>
      <section className="card"><h2>Eligible synthetic queue</h2><p>Authenticated account: {account.account_id} ({account.role}). No actor identity is supplied by the form.</p>
        <label htmlFor="annotation-record">Annotation item</label><select id="annotation-record" value={selected} onChange={event => { if (event.target.value) void loadItem(event.target.value); }}>
          <option value="">Choose an item</option>{queue.items.map(value => <option key={value.record_id} value={value.record_id}>{"scenario" in value.preprocessing ? value.preprocessing.scenario.label : value.record_id}</option>)}</select>
        {!queue.items.length && <p>No eligible items. REVIEW, REJECT and privacy-blocked results stay outside this queue.</p>}
      </section>
      {detail && <>
        <PipelineStepper result={detail.item.preprocessing} busy={false} annotationStatus={detail.annotation_status} />
        <section className="card"><h2>Immutable anonymized text</h2><p className="c2-text">{detail.item.preprocessing.records[0].anonymized_text}</p>
          <details><summary>Record and schema versions</summary><p>Record: {detail.item.record_version}</p><p>Pipeline: {detail.item.pipeline_version}</p><p>Schema: {detail.item.annotation_schema_version}. Vocabulary: {detail.item.vocabulary_version}.</p></details>
          <p>Privacy-cleared snapshot. Automated checks do not certify complete anonymization.</p></section>
        <section className="card"><h2>Your annotation</h2>
          <p>One label per dimension for this provisional demo. “Uncertain” is a completed human abstention; blank means unfinished. Neutral and no clear indicator are explicit decisions.</p>
          {dimensions.map(key => <div key={key}><label htmlFor={`annotation-${key}`}>{titles[key]}</label>
            <select id={`annotation-${key}`} value={labels[key] ?? ""} disabled={busy || !detail.can_submit} onChange={event => { setLabels(current => ({ ...current, [key]: event.target.value || null })); setMessage(""); }}>
              <option value="">Not completed</option>{queue.vocabulary[key].map(value => <option key={value} value={value}>{readable(value)}</option>)}</select></div>)}
          <p className="hint">Mixed script alone is not code-mixing. Annotate observable language/emotion/indicator evidence; use uncertain for ambiguous evidence. These candidate categories come from the C2 proposal, not a validated taxonomy.</p>
          <div className="actions"><button onClick={() => save("DRAFT")} disabled={busy || !detail.can_submit}>Save draft</button><button onClick={() => save("FINAL")} disabled={busy || !detail.can_submit || dimensions.some(key => !labels[key])}>Finalize submission</button><button className="secondary" onClick={() => loadItem(selected)} disabled={busy}>Reload saved state</button></div>
          <p>Final submission is immutable. Finalizing does not approve a dataset release.</p>
          {!detail.can_submit && <p>Your submission is finalized, or both account slots are occupied. Saved history remains unchanged.</p>}
        </section>
        <section className="card"><h2>Saved history and visibility</h2><p>Finalized submissions: {detail.finalized_count}/2. Agreement: {detail.agreement_status}. Adjudication: {detail.adjudication_status}.</p>
          <details><summary>Your saved revisions ({detail.own_history.length})</summary>{detail.own_history.map(value => <div key={value.revision}><h3>Revision {value.revision} — {value.status}</h3><p>{value.saved_at}</p><ul>{dimensions.map(key => <li key={key}>{titles[key]}: {value.labels[key] ? readable(value.labels[key]!) : "Unfinished"}</li>)}</ul></div>)}</details>
          {detail.peer_final ? <details><summary>Other annotator’s final labels — both submissions finalized</summary><ul>{dimensions.map(key => <li key={key}>{titles[key]}: {readable(detail.peer_final!.labels[key]!)}</li>)}</ul></details> : <p>Other annotator’s labels remain hidden until both submissions are finalized.</p>}
          <p className="notice-inline"><strong>Human release approval remains required.</strong> Agreement, adjudication and dataset release are pending; no agreement score is calculated.</p>
        </section>
      </>}
      </details>
    </>}
  </main>;
}
