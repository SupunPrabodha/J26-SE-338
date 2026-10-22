"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@j26/common/api";
import type { C2AnnotationLabels, C2AnnotationSubmission, C2AnnotationSubmissionQueue, C2AnnotationSaveRequest } from "@j26/common/contracts";
import { PipelineStepper } from "../PipelineStepper";
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

export function SubmissionWorkbench({ onExpired }: { onExpired: (reason: string) => void }) {
  const [queue, setQueue] = useState<C2AnnotationSubmissionQueue | null>(null);
  const [submission, setSubmission] = useState<C2AnnotationSubmission | null>(null);
  const [index, setIndex] = useState(0);
  const [labels, setLabels] = useState<Labels>(blank);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const sequence = useRef(0), pending = useRef<AbortController | null>(null), active = useRef(false);
  const answer = submission?.answers[index];
  const annotation = answer?.annotation;
  const finalized = annotation?.own_history.at(-1)?.status === "FINAL";
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
  const position = queue?.submissions.findIndex(row => row.submission_id === submission?.submission_id) ?? -1;
  return <section aria-label="Submission annotation" className="c2-submission-workbench">
    <div className="c2-annotation-notifications" aria-label="Annotation notifications">
      {error && <div role="alert" className="c2-annotation-error">{error}<button aria-label="Dismiss error" onClick={() => setError("")}>×</button></div>}
      {message && <div role="status" className="c2-annotation-saved">{message}<button aria-label="Dismiss notification" onClick={() => setMessage("")}>×</button></div>}
    </div>
    {busy && <p role="status" className="hint">Loading or saving actual server state…</p>}
    <div className="c2-annotation-layout">
      <aside className="c2-annotation-sidebar">
        <section className="card"><h2>Assigned submissions</h2><p className="hint">Your finalized answers / available answers</p>
          <ul className="c2-submission-list">{queue?.submissions.map(row => <li key={row.submission_id}><button aria-label={row.submission_id} aria-current={row.submission_id === submission?.submission_id ? "true" : undefined} disabled={busy} onClick={() => load(row.submission_id)}>
            <span>{row.submission_id}</span><span className="c2-navigation-detail">{row.finalized_answers}/{row.available_answers} finalized{row.blocked_answers ? ` · ${row.blocked_answers} on hold/missing` : ""}{row.complete ? " · Complete" : ""}</span>
          </button></li>)}</ul>
          {queue && !queue.submissions.length && <p>No submissions assigned to this account. Empty slots cannot be claimed.</p>}
          {submission && <nav className="c2-compact-actions" aria-label="Submission navigation">
            <button title={position <= 0 ? "First assigned submission" : "Open previous submission"} disabled={busy || position <= 0} onClick={() => load(queue!.submissions[position - 1].submission_id)}>Previous submission</button>
            <button title={position >= (queue?.submissions.length ?? 0) - 1 ? "Last assigned submission" : "Open next submission"} disabled={busy || position < 0 || position >= (queue?.submissions.length ?? 0) - 1} onClick={() => load(queue!.submissions[position + 1].submission_id)}>Next submission</button>
          </nav>}
        </section>
        {submission && <section className="card"><h2>Questions</h2><p className="hint">Q4–Q9 required · Q10 optional</p>
          <ol className="c2-question-list">{submission.answers.map((value, i) => { const status = answerStatus(value); return <li key={value.question_id}><button aria-label={value.question_id} disabled={busy} aria-current={i === index ? "step" : undefined} onClick={() => navigateAnswer(i)}>
            <strong>{value.question_id}</strong><span className={`c2-answer-badge c2-answer-${status.style}`}>{status.label}</span>
          </button></li>; })}</ol>
        </section>}
      </aside>
      <div className="c2-annotation-content">
        {!submission && <section className="card c2-annotation-empty"><h2>Choose an assigned submission</h2><p>Open a submission to read its answers and save your own labels. Completed finals remain read-only.</p></section>}
        {submission && answer && <>
          <section className="card c2-annotation-answer">
            <div className="c2-current-submission"><h2>Submission {submission.submission_id}</h2><p>{submission.finalized_answers}/{submission.available_answers} available answers finalized{submission.blocked_answers ? ` · ${submission.blocked_answers} on hold/missing` : ""}. {submission.complete ? "Your answers complete." : "Submission incomplete."}</p>
              <progress aria-label="Submission completion" value={submission.finalized_answers} max={Math.max(1, submission.available_answers)} />
            </div>
            <nav className="c2-answer-pagination" aria-label="Answer navigation">
              <button title={index === 0 ? "First answer" : "Open previous answer"} disabled={busy || index === 0} onClick={() => navigateAnswer(index - 1)}>Previous answer</button><span>Answer {index + 1} of {submission.answers.length}</span>
              <button title={index >= submission.answers.length - 1 ? "Last answer" : "Open next answer"} disabled={busy || index >= submission.answers.length - 1} onClick={() => navigateAnswer(index + 1)}>Next answer</button>
            </nav>
            <div className="c2-question-heading"><h2>{answer.question_id}: {answer.question_text}</h2><span className={`c2-answer-badge c2-answer-${answerStatus(answer).style}`}>{answerStatus(answer).label}</span></div>
            {answer.state === "OPTIONAL_UNANSWERED" ? <p className="c2-answer-notice">Optional Q10 unanswered — no annotation required.</p> : answer.state !== "AVAILABLE" ? <div role="alert" className="c2-answer-hold"><strong>{answerStatus(answer).label} — answer withheld</strong><p>Answer withheld or missing. Submission remains incomplete.</p><ul>{answer.blocking_reasons.map(reason => <li key={reason}>{reason.replaceAll("_", " ")}</li>)}</ul><p>Labels cannot be saved for this answer.</p></div> : annotation && <>
              {finalized ? <div className="c2-final-notice"><strong>Finalized — read only</strong><p>Your final labels are permanently saved. You can read them and navigate to other answers; editing and saving are disabled.</p></div> : !annotation.can_submit ? <p role="alert" className="c2-answer-hold">Editing is not authorized for this answer. Reload saved state or use your assigned account; existing submissions remain unchanged.</p> : null}
              <h3>Immutable anonymized text</h3><p className="c2-text">{annotation.item.preprocessing.records[0].anonymized_text}</p>
              <p className="hint">Language selection saves your label only; it never changes the answer.</p>
              <h3>Your annotation</h3><div className="c2-label-fields">{dimensions.map(key => <div key={key}><label htmlFor={`submission-${key}`}>{titles[key]}</label><select id={`submission-${key}`} value={labels[key] ?? ""} disabled={busy || finalized || !annotation.can_submit} onChange={event => { setLabels(current => ({ ...current, [key]: event.target.value || null })); setDirty(true); setMessage(""); }}>
                <option value="">Not completed</option>{queue?.vocabulary[key].map(value => <option key={value} value={value}>{value.replaceAll("-", " ")}</option>)}</select></div>)}</div>
              {!finalized && annotation.can_submit && <p className="hint">{dirty ? "Unsaved changes. " : ""}{dimensions.filter(key => !labels[key]).length ? `${dimensions.filter(key => !labels[key]).length} fields unfinished. Save a partial draft, or complete all four fields to finalize.` : "All fields completed. Save a draft or explicitly finalize."}</p>}
              <div className="actions"><button disabled={busy || finalized || !annotation.can_submit} onClick={() => save("DRAFT")}>Save draft</button><button disabled={busy || finalized || !annotation.can_submit || dimensions.some(key => !labels[key])} onClick={() => save("FINAL")}>Finalize answer</button><button className="secondary" disabled={busy} onClick={() => load(submission.submission_id, index)}>Reload saved state</button></div>
              <p className="hint">Neutral, uncertain and no-clear-indicator are explicit labels; blank is unfinished. Final answers are immutable.</p>
              <details><summary>Your saved revisions ({annotation.own_history.length})</summary>{annotation.own_history.map(row => <p key={row.revision}>Revision {row.revision} · {row.status} · {dimensions.map(key => row.labels[key] ?? "Unfinished").join(", ")}</p>)}</details>
              {annotation.peer_final ? <details><summary>Other annotator’s final labels — both finalized</summary><p>{dimensions.map(key => `${titles[key]}: ${annotation.peer_final!.labels[key]}`).join("; ")}</p></details> : <p className="hint">Other annotator’s labels remain hidden until both finalize this answer.</p>}
            </>}
          </section>
          <section className="card"><p><strong>Agreement not evaluated; adjudication and human release approval pending.</strong> Automated checks do not certify complete anonymization. Vocabulary is provisional and not expert-approved.</p><details><summary>Pipeline and frozen source versions</summary>
            {annotation && <PipelineStepper result={annotation.item.preprocessing} busy={false} annotationStatus={annotation.annotation_status} />}
            <p>Submission version: {submission.submission_version}</p><p>Dataset: {submission.source_dataset_id}</p><p>Source file SHA-256: {submission.source_file_sha256}</p>
          </details></section>
        </>}
      </div>
    </div>
  </section>;
}
