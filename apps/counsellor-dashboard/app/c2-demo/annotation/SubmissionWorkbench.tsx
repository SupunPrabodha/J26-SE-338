"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@j26/common/api";
import type { C2AnnotationLabels, C2AnnotationSubmission, C2AnnotationSubmissionQueue, C2AnnotationSaveRequest } from "@j26/common/contracts";
import "./annotation.css";

const dimensions = ["language", "code_mixing", "emotion", "wellbeing"] as const;
const titles = { language: "Language", code_mixing: "Code-mixing pattern", emotion: "Emotion", wellbeing: "Wellbeing indicator" };
const blank = { language: null, code_mixing: null, emotion: null, wellbeing: null };
type Labels = Pick<C2AnnotationLabels, typeof dimensions[number]>;

function answerStatus(answer: C2AnnotationSubmission["answers"][number]) {
  if (answer.state === "OPTIONAL_UNANSWERED") return { label: "Optional missing", style: "optional" };
  if (answer.state === "WITHHELD") return { label: answer.blocking_reasons.some(reason => reason.includes("privacy")) ? "Privacy hold" : "Quality hold", style: "hold" };
  if (answer.state === "MISSING_REQUIRED") return { label: "Missing required", style: "hold" };
  const latest = answer.annotation?.own_history.at(-1)?.status;
  return latest === "FINAL" ? { label: "Finalized", style: "final" } : latest === "DRAFT" ? { label: "Draft", style: "draft" } : { label: "Pending", style: "pending" };
}

export function SubmissionWorkbench({ onExpired, onDirtyChange }: { onExpired: (reason: string) => void; onDirtyChange?: (dirty: boolean) => void }) {
  const [queue, setQueue] = useState<C2AnnotationSubmissionQueue | null>(null);
  const [submission, setSubmission] = useState<C2AnnotationSubmission | null>(null);
  const [index, setIndex] = useState(0);
  const [labels, setLabels] = useState<Labels>(blank);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const sequence = useRef(0), pending = useRef<AbortController | null>(null), active = useRef(false);
  const answer = submission?.answers[index];
  const annotation = answer?.annotation;
  const finalized = annotation?.own_history.at(-1)?.status === "FINAL";
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  function apply(value: C2AnnotationSubmission, position: number) {
    setSubmission(value); setIndex(position); setLabels(value.answers[position]?.annotation?.own_history.at(-1)?.labels ?? blank); setDirty(false);
    setQueue(current => current ? { ...current, submissions: current.submissions.map(row => row.submission_id === value.submission_id ? value : row) } : current);
  }
  function fail(cause: unknown) {
    const reasons: Record<number, string> = {
      401: "Your session expired. Sign in again; saved drafts and finals are preserved.",
      403: "Your account is not authorized for this annotation action.",
      404: "This submission is unavailable, unassigned to your account, or the development workbench is disabled.",
      409: "Saved version changed or answer is final. Reload saved state; finalized answers cannot be edited.",
      422: "Choose allowed labels and complete all four fields before finalizing.",
    };
    const reason = cause instanceof ApiError && reasons[cause.status] ? reasons[cause.status] : "Annotation service is unavailable. Saved history is preserved; reload before retrying.";
    setError(reason);
    if (cause instanceof ApiError && [401, 403].includes(cause.status)) { setQueue(null); setSubmission(null); setLabels(blank); onExpired(reason); }
  }
  useEffect(() => {
    const controller = new AbortController(); pending.current = controller; const id = ++sequence.current;
    api<C2AnnotationSubmissionQueue>("/c2-annotations/submissions", undefined, true, controller.signal).then(value => {
      if (sequence.current === id) setQueue(value);
    }).catch(cause => { if (sequence.current === id) fail(cause); }).finally(() => { if (sequence.current === id) setBusy(false); });
    // Invalidate every request, including one begun after the initial catalogue fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { sequence.current++; controller.abort(); pending.current?.abort(); };
    // onExpired is only used for a failed authenticated request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function load(id: string, position = 0) {
    if (active.current || (dirty && !window.confirm("Leave unsaved labels? Save a draft first to retain them."))) return;
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    const request = ++sequence.current; active.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const value = await api<C2AnnotationSubmission>(`/c2-annotations/submissions/${encodeURIComponent(id)}`, undefined, true, controller.signal);
      if (request === sequence.current) apply(value, position);
    } catch (cause) { if (request === sequence.current) fail(cause); }
    finally { if (request === sequence.current) { setBusy(false); active.current = false; } }
  }
  function navigateAnswer(position: number) {
    if (!submission || active.current || position < 0 || position >= submission.answers.length) return;
    if (dirty && !window.confirm("Leave unsaved labels? Save a draft first to retain them.")) return;
    apply(submission, position); setMessage(""); setError("");
  }
  async function save(status: "DRAFT" | "FINAL") {
    if (active.current || finalized || !annotation?.can_submit || !submission) return;
    const controller = new AbortController(); pending.current?.abort(); pending.current = controller;
    const request = ++sequence.current; active.current = true; setBusy(true); setError(""); setMessage("");
    const body: C2AnnotationSaveRequest = {
      record_version: annotation.item.record_version, pipeline_version: annotation.item.pipeline_version,
      annotation_schema_version: annotation.item.annotation_schema_version, vocabulary_version: annotation.item.vocabulary_version,
      expected_revision: annotation.own_history.at(-1)?.revision ?? 0, status, labels,
    };
    try {
      await api(`/c2-annotations/${encodeURIComponent(annotation.item.record_id)}/revisions`, body, true, controller.signal);
      const value = await api<C2AnnotationSubmission>(`/c2-annotations/submissions/${encodeURIComponent(submission.submission_id)}`, undefined, true, controller.signal);
      if (request === sequence.current) { apply(value, index); setMessage(status === "FINAL" ? "Final answer saved and locked. Agreement and release remain pending." : "Draft saved on the server."); }
    } catch (cause) { if (request === sequence.current) fail(cause); }
    finally { if (request === sequence.current) { setBusy(false); active.current = false; } }
  }
  const items = queue?.submissions.flatMap(row => row.answers.map((value, position) => ({ submission: row, answer: value, position, id: value.annotation?.item.record_id ?? value.source_record_id }))) ?? [];
  const selectedId = answer?.annotation?.item.record_id ?? answer?.source_record_id ?? "";
  const position = items.findIndex(item => item.id === selectedId);
  const filteredItems = items.filter(item => item.id.toLowerCase().includes(search.trim().toLowerCase()));
  const completed = queue?.submissions.reduce((count, row) => count + row.finalized_answers, 0) ?? 0;
  const eligible = queue?.submissions.reduce((count, row) => count + row.available_answers, 0) ?? 0;
  function selectItem(id: string) {
    const item = items.find(value => value.id === id);
    if (!item) return;
    if (item.submission.submission_id === submission?.submission_id) navigateAnswer(item.position);
    else void load(item.submission.submission_id, item.position);
  }
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function renderField(key: typeof dimensions[number]) {
    return <div key={key}><label htmlFor={`submission-${key}`}>{titles[key]}</label>
      <select id={`submission-${key}`} value={labels[key] ?? ""} disabled={busy || finalized || !annotation?.can_submit} onChange={event => { setLabels(current => ({ ...current, [key]: event.target.value || null })); setDirty(true); setMessage(""); }}>
        <option value="">Not completed</option>{queue?.vocabulary[key].map(value => <option key={value} value={value}>{value.replaceAll(/[-_]/g, " ")}</option>)}
      </select></div>;
  }
  return <section aria-label="Submission annotation" className="c2-submission-workbench">
    <div className="c2-annotation-notifications" aria-label="Annotation notifications">
      {error && <div role="alert" className="c2-annotation-error">{error}<button aria-label="Dismiss error" onClick={() => setError("")}>×</button></div>}
      {message && <div role="status" className="c2-annotation-saved">{message}<button aria-label="Dismiss notification" onClick={() => setMessage("")}>×</button></div>}
    </div>
    {busy && <p role="status" className="hint">Loading or saving actual server state…</p>}
    <div className="c2-annotation-layout">
      <div className="c2-annotation-content">
      <aside className="c2-assignment-sidebar">
        <h2>Assigned items</h2>
        <label className="c2-search-label" htmlFor="assigned-search">Search anonymous item ID</label>
        <input id="assigned-search" type="search" placeholder="Search ID" value={search} onChange={event => setSearch(event.target.value)} />
        <p className="hint">Your progress: {completed}/{eligible} eligible items finalized.</p>
        {queue?.submissions.some(row => row.blocked_answers) && <p className="hint">Withheld or missing required answers remain incomplete.</p>}
        <ul className="c2-assignment-list">{filteredItems.map(item => { const status = answerStatus(item.answer); return <li key={item.id}>
          <button disabled={busy} aria-label={item.id} aria-current={selectedId === item.id ? "true" : undefined} onClick={() => selectItem(item.id)}>
            <span>{item.id}</span><span className={`c2-answer-badge c2-answer-${status.style}`}>{status.label}</span>
          </button>
        </li>; })}</ul>
        {queue && !items.length && <p>No submissions assigned to this account. Empty slots cannot be claimed.</p>}
        {!!items.length && !filteredItems.length && <p>No assigned IDs match your search.</p>}
      </aside>
      <div className="c2-workspace-main">
        {!submission && <section className="card c2-annotation-empty"><h2>Select an assigned item</h2><p>Choose an authorized item above to read its frozen text and save your own labels. Completed finals remain read-only.</p></section>}
        {submission && answer && <>
          <section className="card c2-annotation-answer">
            <div className="c2-question-heading"><h2>{selectedId}</h2><span className={`c2-answer-badge c2-answer-${answerStatus(answer).style}`}>{answerStatus(answer).label}</span></div>
            <p className="c2-question-context">{answer.question_id}: {answer.question_text}</p>
            {answer.state === "OPTIONAL_UNANSWERED" ? <p className="c2-answer-notice">Optional Q10 unanswered — no annotation required.</p> : answer.state !== "AVAILABLE" ? <div role="alert" className="c2-answer-hold"><strong>{answerStatus(answer).label} — answer withheld</strong><p>Answer withheld or missing. Submission remains incomplete.</p><ul>{answer.blocking_reasons.map(reason => <li key={reason}>{reason.replaceAll("_", " ")}</li>)}</ul><p>Labels cannot be saved for this answer.</p></div> : annotation && <>
              {finalized ? <div className="c2-final-notice"><strong>Finalized — read only</strong></div> : !annotation.can_submit ? <p role="alert" className="c2-answer-hold">Editing is not authorized for this answer. Reload saved state or use your assigned account; existing submissions remain unchanged.</p> : null}
              <h3>Anonymized answer</h3><p className="c2-text">{annotation.item.preprocessing.records[0].anonymized_text}</p>
              <div className="c2-simple-fields">{(["emotion", "wellbeing"] as const).map(key => renderField(key))}</div>
              <details className="c2-additional-labels"><summary>Additional labels</summary><div className="c2-simple-fields">{(["language", "code_mixing"] as const).map(key => renderField(key))}</div></details>
              {!finalized && annotation.can_submit && <p className="hint">{dirty ? "Unsaved changes. " : ""}{dimensions.filter(key => !labels[key]).length ? `${dimensions.filter(key => !labels[key]).length} fields unfinished. Save a partial draft, or complete all four fields to finalize.` : "All fields completed. Save a draft or explicitly finalize."}</p>}
              { !finalized && annotation?.can_submit && (!labels.language || !labels.code_mixing) && <p id="additional-required" className="hint">Complete Language and Code-mixing pattern in Additional labels before finalizing.</p>}
              <div className="actions"><button disabled={busy || finalized || !annotation.can_submit} onClick={() => save("DRAFT")}>Save draft</button><button aria-describedby={!finalized && (!labels.language || !labels.code_mixing) ? "additional-required" : undefined} disabled={busy || finalized || !annotation.can_submit || dimensions.some(key => !labels[key])} onClick={() => save("FINAL")}>Finalize submission</button><button className="secondary" disabled={busy} onClick={() => load(submission.submission_id, index)}>Reload saved state</button></div>
            </>}
          </section>
          <details className="c2-technical-details"><summary>Technical details</summary><p><strong>Agreement not evaluated; adjudication and human release approval pending.</strong> Automated checks do not certify complete anonymization. Vocabulary is provisional and not expert-approved.</p>
            <p>Submission: {submission.submission_id} · {answer.question_id} · Answer {index + 1} of {submission.answers.length}. Q4–Q9 required; Q10 optional.</p>
            <p>Item: {selectedId}. Record version: {annotation?.item.record_version ?? "Withheld or unavailable"}</p>
            <p>Submission version: {submission.submission_version}</p><p>Dataset: {submission.source_dataset_id}</p><p>Source file SHA-256: {submission.source_file_sha256}</p>
          <p>Labels describe text, not clinical diagnoses. Two accounts do not establish independent human annotation. Blank fields are unfinished; neutral, uncertain and no-clear-indicator are explicit decisions.</p>
            {annotation && <>
              <h3>Your saved revisions ({annotation.own_history.length})</h3>{annotation.own_history.map(row => <p key={row.revision}>Revision {row.revision} · {row.status} · {dimensions.map(key => row.labels[key] ?? "Unfinished").join(", ")}</p>)}
              {annotation.peer_final ? <><h3>Other annotator’s final labels — both finalized</h3><p>{dimensions.map(key => `${titles[key]}: ${annotation.peer_final!.labels[key]}`).join("; ")}</p></> : <p className="hint">Other annotator’s labels remain hidden until both finalize this answer.</p>}

            </>}
          </details>
        </>}
        <nav className="c2-answer-pagination" aria-label="Item navigation">
          <button className="secondary" disabled={busy || position <= 0} title={position <= 0 ? "Select an item, or this is the first assigned item" : "Previous assigned item"} onClick={() => selectItem(items[position - 1].id)}>Previous item</button>
          <span>{position < 0 ? "No item selected" : `Item ${position + 1} of ${items.length}`}</span>
          <button className="secondary" disabled={busy || position < 0 || position >= items.length - 1} title={position < 0 ? "Select an assigned item first" : position >= items.length - 1 ? "Last assigned item" : "Next assigned item"} onClick={() => selectItem(items[position + 1].id)}>Next item</button>
        </nav>
      </div>
      </div>
    </div>
  </section>;
}
