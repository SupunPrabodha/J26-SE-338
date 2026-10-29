"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@j26/common/api";
import { AppDialog, useDialogAccess, StaffFrame, DemoHeader, ErrorMessage, SafetyNotice, StaffSignIn, processingLabel, reviewLabel } from "@j26/common/ui";
import type { AccountResponse, ReviewTask, ReviewQueuePage, CounsellorReviewRecord, ReviewRecordRequest } from "@j26/common/contracts";
import ExplanationAvailability from "./explanation-availability";

const time = (value?: string | null) => value ? new Date(value).toLocaleString() : "Not recorded";
export default function Dashboard({ initialState = "" }: { initialState?: "" | "COMPLETED" }) {
  const [authorized, setAuthorized] = useState(false), [checking, setChecking] = useState(true);
  const [queue, setQueue] = useState<ReviewQueuePage | null>(null);
  const [filter, setFilter] = useState<string>(initialState), [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<ReviewTask | null>(null);
  const [record, setRecord] = useState<CounsellorReviewRecord | null>(null);
  const [interpretation, setInterpretation] = useState("");
  const [followUp, setFollowUp] = useState<ReviewRecordRequest["follow_up"]>("NO_FOLLOW_UP_PLANNED");
  const [error, setError] = useState(""), [validation, setValidation] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [providerOpen, setProviderOpen] = useState(false);
  const completedView = filter === "COMPLETED";
  const selectedSummary = queue?.items.find(item => item.task_id === selected?.task_id);
  function clearSelection() { setProviderOpen(false); setSelected(null); setRecord(null); setInterpretation(""); setValidation(""); }
  useDialogAccess(providerOpen && selected ? selected.task_id : null, () => api(`/review-tasks/${selected!.task_id}`), cause => {
    clearSelection(); setQueue(null); if (cause instanceof ApiError && cause.status === 401) setAuthorized(false);
    setError(cause instanceof ApiError ? cause.message : "Case access verification unavailable or its window ended. Refresh assigned tasks.");
  });
  async function open(taskId: string) {
    clearSelection(); setFollowUp("NO_FOLLOW_UP_PLANNED");
    const current = await api<ReviewTask>(`/review-tasks/${taskId}`);
    const saved = await api<CounsellorReviewRecord | null>(`/review-tasks/${taskId}/record`);
    setSelected(current); setRecord(saved); setCheckedAt(new Date().toISOString());
  }
  async function load(state = filter, page = offset) {
    const taskId = selected?.task_id; clearSelection();
    const values = await api<ReviewQueuePage>(`/review-queue?offset=${page}${state ? `&state=${state}` : ""}`);
    setQueue(values); setCheckedAt(values.observed_at);
    if (taskId && values.items.some(task => task.task_id === taskId)) await open(taskId);
  }
  async function act(operation: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await operation(); } catch (cause) {
      setQueue(null); clearSelection();
      if (cause instanceof ApiError && cause.status === 401) setAuthorized(false);
      setError(cause instanceof ApiError ? cause.message : cause instanceof Error && cause.message.includes("requires an authorized counsellor") ? cause.message : "The request could not be completed. Refresh assigned tasks or sign in again.");
    } finally { setBusy(false); }
  }
  useEffect(() => {
    let live = true;
    api<AccountResponse>("/auth/me").then(async account => {
      if (account.role !== "COUNSELLOR") { if (live) setError("This workspace requires an authorized counsellor. Use the appropriate sign-in."); return; }
      const initialFilter = initialState;
      const values = await api<ReviewQueuePage>("/review-queue?offset=0" + (initialFilter ? "&state=COMPLETED" : ""));
      if (live) { setFilter(initialFilter); setOffset(0); }
      if (live) { setAuthorized(true); setQueue(values); setCheckedAt(values.observed_at); }
    }).catch(cause => { if (live && !(cause instanceof ApiError && cause.status === 401)) setError(cause instanceof ApiError ? cause.message : "Session check unavailable. Retry when connected."); }).finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, [initialState]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, values = new FormData(form);
    await act(async () => {
      let account: AccountResponse;
      try { account = await api<AccountResponse>("/auth/login", { username: values.get("username"), password: values.get("password"), remember_me: values.get("remember_me") === "on" }); }
      finally { form.reset(); }
      if (account.role !== "COUNSELLOR") { await api("/auth/logout", {}); throw new Error("This development shell requires an authorized counsellor account."); }
      setAuthorized(true); setOffset(0); setFilter(initialState); await load(initialState, 0);
    });
  }
  return <StaffFrame area="counsellor" current={filter === "COMPLETED" ? "completed" : "queue"} authorized={authorized} checking={checking} busy={busy} onSignOut={() => act(async () => { setAuthorized(false); setQueue(null); clearSelection(); await api("/auth/logout", {}); })}><main>
    <DemoHeader title={completedView ? "Completed reviews" : "Case workspace"} subtitle={completedView ? "Explicitly completed human reviews, with read-only saved records where available." : "Your assigned cases, human review and saved interpretations."} />
    <SafetyNotice /><ErrorMessage message={error} />
    {checking ? <section className="card empty" role="status">Checking your session…</section> : !authorized ? <StaffSignIn kind="counsellor" busy={busy} onSubmit={login} /> : <>
      <div className="toolbar"><div><h2>{completedView ? "Completed human reviews" : "Assigned cases"}</h2><p className="hint">{completedView ? "Only explicitly completed reviews still assigned to you with valid consent and retention are listed. Processing completion or saving a record alone does not complete human review." : "Only processed, assigned cases with current consent are listed. Consent alone does not grant access."}</p></div><button className="secondary" disabled={busy} onClick={() => act(() => load())}>{completedView ? "Refresh completed reviews" : "Refresh assigned tasks"}</button></div>
      <p className="feedback" role="status" aria-live="polite">{busy ? "Loading cases…" : message || `${queue?.items.length ?? 0} case(s) on this page · Last checked ${time(checkedAt)}`}</p>
      <div className="review-grid"><section className="card task-list" aria-label="Assigned synthetic cases">
        <label htmlFor="queue-filter">Review status</label><select id="queue-filter" value={filter} disabled={busy} onChange={event => { const state = event.target.value; setFilter(state); setOffset(0); void act(() => load(state, 0)); }}><option value="">All assigned cases</option><option value="READY_FOR_REVIEW">Awaiting review</option><option value="UNDER_REVIEW">In progress</option><option value="COMPLETED">Completed</option></select>
        <div className="queue-caption">{completedView ? "Completed case queue" : "Pseudonymous case queue"}</div>
        {!queue ? <p className="empty">Evidence unavailable. Refresh to recheck access.</p> : queue.items.length === 0 ? <div className="empty"><h3>{completedView ? "No completed reviews available" : "No cases in this view"}</h3><p>{completedView ? "A review appears after Record review complete, while it remains assigned to you and consent and retention permit access. Withdrawn, expired, disposed or reassigned cases are excluded; deleted records are not restored." : "Try another filter or refresh after processing. Withdrawn and expired cases are excluded."}</p></div> : <ul>{queue.items.map(task => <li key={task.task_id}><button className={`task-button ${selected?.task_id === task.task_id ? "selected" : ""}`} aria-pressed={selected?.task_id === task.task_id} aria-label={`Open case ${task.case.case_id}`} disabled={busy} onClick={() => act(() => open(task.task_id))}>
          <strong className="case-ref">Case {task.case.case_id.slice(0, 8)}</strong><span>{processingLabel(task.case.processing_status)}</span><span>{reviewLabel(task.case.processing_status)}</span><span className={task.review_record_saved_at ? "record-state saved" : "record-state"}>{task.review_record_saved_at ? "Saved review available ↗" : "No review record saved"}</span><span>Submitted {time(task.case.created_at)}</span>{task.review_record_saved_at && <span>Review saved {time(task.review_record_saved_at)}</span>}</button></li>)}</ul>}
        <div className="actions"><button className="quiet" disabled={busy || offset === 0} onClick={() => { const page = Math.max(0, offset - 20); setOffset(page); void act(() => load(filter, page)); }}>Previous cases</button><button className="quiet" disabled={busy || queue?.next_offset == null} onClick={() => { const page = queue!.next_offset!; setOffset(page); void act(() => load(filter, page)); }}>Next cases</button></div>
      </section><section className="card review-detail" aria-label="Selected case">
        {!selected ? <div className="empty selection-empty"><span aria-hidden="true" className="empty-symbol">↗</span><h2>Open a case to begin</h2><p>Select an assigned case to inspect evidence, continue review or reopen its saved record.</p></div> : <>
          <div className="detail-heading"><div><p className="eyebrow">Assigned to you · consent checked on open</p><h2>Case {selected.case.case_id.slice(0, 8)}</h2></div><span className="status-badge">{reviewLabel(selected.case.processing_status)}</span></div>
          <details className="reference-panel"><summary>Case reference and lifecycle</summary><dl className="status-list"><div><dt>Case reference</dt><dd><code>{selected.case.case_id}</code></dd></div><div><dt>Task reference</dt><dd><code>{selected.task_id}</code></dd></div><div><dt>Submitted</dt><dd>{time(selected.case.created_at)}</dd></div><div><dt>Last case update</dt><dd>{time(selected.case.updated_at)}</dd></div></dl><p className="hint">A task is created after successful processing. A saved review belongs to this task; a consent decision without submission has no review task.</p></details>
          <div className="review-states"><div><span>Processing</span><strong>{processingLabel(selected.case.processing_status)}</strong></div><div><span>Human review</span><strong>{reviewLabel(selected.case.processing_status)}</strong></div></div>
          <details><summary>Human review timestamps</summary><dl className="evidence-list"><div><dt>Review started</dt><dd>{time(selectedSummary?.review_started_at)}</dd></div><div><dt>Review completed</dt><dd>{time(selectedSummary?.review_completed_at)}</dd></div></dl><p className="hint">Times come from persisted human actions; processing completion does not create them.</p></details>
          <details className="evidence-disclosure"><summary>Screening evidence <span className="tag">Mock provider</span></summary><dl className="evidence-list"><div><dt>Mock wellbeing indicator</dt><dd>{selected.inference.wellbeing_indicator}</dd></div><div><dt>Mock emotional tone</dt><dd>{selected.inference.emotional_tone}</dd></div><div><dt>Mock stress-language signals</dt><dd>{selected.inference.stress_language_signals.join(", ")}</dd></div><div><dt>Fixed fixture confidence</dt><dd>{Math.round(selected.inference.confidence * 100)}% · uncalibrated</dd></div><div><dt>Explanation reliability</dt><dd>{selected.explanation.reliability_status}</dd></div></dl><div className="mock-evidence"><h3>Mock explanation</h3>{selected.explanation.evidence.map((evidence, index) => <p key={index}>{evidence}</p>)}</div><p className="hint">Fixed development outputs. Research methods and the final dashboard remain with C2–C4.</p></details>
          <button className="text-button" onClick={() => setProviderOpen(true)}>Provider versions and correlation</button>
          <ExplanationAvailability task={selected} />
          <section className="review-record" aria-labelledby="review-record-title"><div className="detail-heading"><h3 id="review-record-title">Interpretation & follow-up</h3><span className="tag">Human authored</span></div><p className="hint">Use fictional observations only. Follow-up categories record your choice; they do not send messages, schedule care or generate advice.</p>
            {record ? <div className="saved-record"><div className="detail-heading"><strong role="status">Review record saved</strong><span className="tag">Read-only</span></div><p className="hint">Saved {time(record.saved_at)} · one final record for this task</p><p className="interpretation-text">{record.interpretation}</p><dl><dt>Follow-up category</dt><dd>{record.follow_up.replaceAll("_", " ").toLowerCase()}</dd></dl><p className="hint">Reopen from this queue after refresh or sign-in while access remains valid.</p></div> : selected.case.processing_status === "UNDER_REVIEW" ? <form onSubmit={event => {
              event.preventDefault(); const value = interpretation.trim();
              if (!value.startsWith("SYNTHETIC:") || !value.slice(10).trim()) { setValidation("Start with SYNTHETIC: and add a fictional observation before saving."); return; }
              void act(async () => { setRecord(await api<CounsellorReviewRecord>(`/review-tasks/${selected.task_id}/record`, { interpretation: value, follow_up: followUp, idempotency_key: crypto.randomUUID() })); setInterpretation(""); setValidation(""); setMessage("Review record saved. Reopen it from this case queue."); await load(); });
            }}><label htmlFor="interpretation">Synthetic interpretation</label><p id="interpretation-help" className="hint">Begin with <code>SYNTHETIC:</code> and a fictional observation. Do not enter identity details or clinical advice.</p><textarea id="interpretation" required maxLength={2000} value={interpretation} disabled={busy} aria-describedby="interpretation-help interpretation-length" placeholder="SYNTHETIC: Fictional review observation." onChange={event => { setInterpretation(event.target.value); setValidation(""); }} /><p id="interpretation-length" className="hint">{interpretation.length} / 2,000 characters</p><ErrorMessage message={validation} /><label htmlFor="follow-up">Follow-up category</label><select id="follow-up" value={followUp} disabled={busy} onChange={event => setFollowUp(event.target.value as ReviewRecordRequest["follow_up"])}><option value="NO_FOLLOW_UP_PLANNED">No follow-up planned</option><option value="DISCUSSION_OFFERED">Discussion offered</option><option value="FOLLOW_UP_REQUESTED">Follow-up requested</option></select><button disabled={busy || !interpretation.trim()}>Save review record</button></form> : <p className="empty">No review record saved. Start review to record an interpretation. Existing completed tasks may have status actions only.</p>}
          </section><div className="review-action-bar"><p className="hint">Processing and human review completion are separate. Completed follow-up is not inferred.</p>{(["READY_FOR_REVIEW", "UNDER_REVIEW"].includes(selected.case.processing_status)) && <button disabled={busy} onClick={() => act(async () => { await api(`/review-tasks/${selected.task_id}/actions`, { action: selected.case.processing_status === "READY_FOR_REVIEW" ? "START_REVIEW" : "COMPLETE_REVIEW", idempotency_key: crypto.randomUUID() }); await load(); })}>{selected.case.processing_status === "READY_FOR_REVIEW" ? "Start human review" : "Record review complete"}</button>}</div>
        </>}
      </section></div>
    </>}
    {selected && providerOpen && <AppDialog title="Provider versions and correlation" onClose={() => setProviderOpen(false)}>
      <dl className="status-list"><div><dt>Model / NLP service</dt><dd>{selected.inference.model_version} / {selected.inference.service_version}</dd></div><div><dt>Explainer / XAI service</dt><dd>{selected.explanation.explainer_version} / {selected.explanation.service_version}</dd></div><div><dt>Correlation reference</dt><dd><code>{selected.case.correlation_id}</code></dd></div></dl>
      <p className="hint">This snapshot was authorized on case open. Rechecking access clears it before loading current permissions.</p><button className="secondary" disabled={busy} onClick={() => act(() => load())}>Recheck case access</button>
    </AppDialog>}
    <footer>J26-SE-338 · Local research workspace</footer>
  </main></StaffFrame>;
}
