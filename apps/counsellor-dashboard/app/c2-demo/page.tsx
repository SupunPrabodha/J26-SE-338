"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "@j26/common/api";
import { DemoHeader, ErrorMessage } from "@j26/common/ui";
import type { AccountResponse, LoginRequest, C2DemoCatalogue, C2CustomDemoRequest, C2CustomDemoResponse } from "@j26/common/contracts";
import { PipelineStepper } from "./PipelineStepper";
import "./demo.css";

const readable = (value: string) => value.replaceAll(/[-_:]/g, " ");
const issueExplanation = (value: string) => ({
  very_short_text: "Very short content needs human review.",
  empty_text: "Empty content cannot pass the quality gate.",
  placeholder_only_text: "Only masking placeholders remain; review usable content.",
  duplicate_text: "Matching masked text may be a duplicate or a masking collision.",
  privacy_review_required: "Possible indirect identifiers require human privacy review.",
  no_usable_content: "No meaningful content remains for processing.",
} as Record<string, string>)[value] ?? readable(value);
function safeMessage(cause: unknown) {
  if (cause instanceof ApiError) {
    if (cause.status === 401) return "Your session has ended or sign-in was unsuccessful. Sign in here with your private development account.";
    if (cause.status === 403) return "This demonstration requires an authorized development counsellor session.";
    if (cause.status === 404) return "The development demonstration is disabled or unavailable in this configuration.";
    if (cause.status === 422) return "The demonstration could not be validated. Check the fictional text and try again.";
    if (cause.status === 429) return "Too many attempts. Please wait a minute before trying again.";
  }
  return "The demonstration service is unavailable. Check the local development services and try again.";
}

export default function C2Demo() {
  const [catalogue, setCatalogue] = useState<C2DemoCatalogue | null>(null);
  const [result, setResult] = useState<C2CustomDemoResponse | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [reload, setReload] = useState(0);
  const [authBusy, setAuthBusy] = useState(false);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const authenticating = useRef(false);

  function invalidate() {
    sequence.current += 1;
    controller.current?.abort();
    submitting.current = false;
    setBusy(false); setResult(null); setError("");
  }

  useEffect(() => {
    const id = ++sequence.current;
    const pending = new AbortController();
    controller.current = pending;
    api<C2DemoCatalogue>("/c2-demo/scenarios", undefined, true, pending.signal).then(values => {
      if (sequence.current !== id) return;
      setCatalogue(values);
      setDenied(false);
    }).catch(cause => {
      if (sequence.current !== id) return;
      setError(safeMessage(cause));
      setDenied(cause instanceof ApiError && [401, 403].includes(cause.status));
    }).finally(() => { if (sequence.current === id) setLoading(false); });
    return () => { sequence.current += 1; pending.abort(); controller.current?.abort(); };
  }, [reload]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authenticating.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const body: LoginRequest = { username: String(values.get("username") ?? ""), password: String(values.get("password") ?? "") };
    // Credentials are transient request values only, never React state or storage.
    (form.elements.namedItem("password") as HTMLInputElement).value = "";
    invalidate();
    const id = sequence.current;
    const pending = new AbortController(); controller.current = pending;
    authenticating.current = true; setAuthBusy(true);
    try {
      const account = await api<AccountResponse>("/auth/login", body, false, pending.signal);
      if (sequence.current !== id) return;
      if (account.role !== "COUNSELLOR") {
        await api("/auth/logout", {}, false, pending.signal);
        throw new ApiError(403, "Unauthorized role");
      }
      const values = await api<C2DemoCatalogue>("/c2-demo/scenarios", undefined, true, pending.signal);
      if (sequence.current !== id) return;
      setCatalogue(values);
      setDenied(false);
    } catch (cause) {
      if (sequence.current === id) setError(safeMessage(cause));
    } finally {
      if (sequence.current === id) { authenticating.current = false; setAuthBusy(false); }
    }
  }

  async function run() {
    if (submitting.current || denied || !catalogue) return;
    invalidate();
    const id = sequence.current;
    const pending = new AbortController(); controller.current = pending;
    submitting.current = true; setBusy(true);
    const body: C2CustomDemoRequest = { text, strategy: "presidio" };
    try {
      const response = await api<C2CustomDemoResponse>("/c2-demo/custom-runs", body, true, pending.signal);
      if (sequence.current === id) setResult(response);
    } catch (cause) {
      if (sequence.current !== id) return;
      setError(safeMessage(cause));
      setDenied(cause instanceof ApiError && [401, 403].includes(cause.status));
      if (cause instanceof ApiError && [401, 403].includes(cause.status)) { setCatalogue(null); setText(""); }
    } finally {
      if (sequence.current === id) { submitting.current = false; setBusy(false); }
    }
  }

  async function logout() {
    invalidate(); setDenied(true); setCatalogue(null); setText("");
    authenticating.current = true; setAuthBusy(true);
    try { await api("/auth/logout", {}); }
    catch (cause) { setError(safeMessage(cause)); }
    finally { authenticating.current = false; setAuthBusy(false); }
  }

  return <main className="c2-demo">
    <DemoHeader title="C2 Dataset Pipeline Demo" subtitle="Explore actual anonymization and data-quality gates with fictional samples." component="Component 2" badge="Development only · Live pipeline" />
    <PipelineStepper result={result} busy={busy} />
    <nav className="actions" aria-label="Demo navigation"><a href="/">Back to dashboard</a>
      {catalogue && !denied && <button className="quiet" onClick={logout}>Sign out</button>}</nav>
    <aside className="notice c2-synthetic"><strong>Synthetic demonstration — not participant data</strong><p>Fictional test text only. Results stay in page memory; outputs are non-diagnostic and require human interpretation.</p></aside>
    {denied && <section className="card c2-sign-in" aria-labelledby="c2-sign-in-title">
      <h2 id="c2-sign-in-title">Development sign-in</h2><p className="hint">Use your private local development counsellor credentials. No student submission, consent form, review task or LMS flow is needed.</p>
      <form onSubmit={login}><div className="c2-columns">
        <div><label htmlFor="c2-username">Development username</label><input id="c2-username" name="username" required maxLength={100} autoComplete="off" disabled={authBusy} /></div>
        <div><label htmlFor="c2-password">Password</label><input id="c2-password" name="password" type="password" required maxLength={256} autoComplete="off" disabled={authBusy} /></div>
      </div><button disabled={authBusy}>{authBusy ? "Signing in…" : "Sign in"}</button></form>
    </section>}
    <div className="c2-notifications" aria-label="Demo notifications">
      {error ? <ErrorMessage message={error} /> : result ? <div role="status" aria-live="polite" aria-atomic="true" className={"feedback c2-toast " + (!result.release_ready ? "c2-toast-review" : "")}>Live results received. Automated gate {result.release_ready ? "passed; human approval still required" : "blocked — inspect review/rejection reasons"}.</div> : busy ? <p className="feedback">Processing — waiting for the actual pipeline response…</p> : <p className="feedback">No live results. Enter fictional text and run the demonstration.</p>}
    </div>
    <div className="c2-workbench">
    {loading ? <p role="status" className="empty">Checking development access…</p> : <section className="card" aria-labelledby="configure-title">
      <h2 id="configure-title">Custom fictional test</h2>
      {!catalogue ? <><p>{denied ? "Sign in above to run a fictional test." : "Development access is unavailable."}</p>{!denied && <button className="secondary" onClick={() => { invalidate(); setLoading(true); setReload(value => value + 1); }}>Retry access</button>}</> : <>
        <div className="c2-custom">
          <label htmlFor="custom-text">Fictional test text only</label><textarea id="custom-text" value={text} maxLength={1000} rows={4} autoComplete="off" onChange={event => { invalidate(); setText(event.target.value); }} />
          <p className="hint c2-example"><strong>Illustrative examples (not inserted):</strong> I feel worried about exams. / <span lang="si">විභාග නිසා මට බයයි.</span> / Mata exams gana dukai.</p>
          <p className="hint">Up to 1,000 characters. No participant records or uploads. Empty text demonstrates the actual rejection policy.</p>
        </div>
          <div><p><strong>Anonymizer: Presidio</strong></p><p className="hint c2-description">Multilingual detection remains limited. Sinhala and Romanized Sinhala can miss names or mask ordinary words. Quality PASS does not certify anonymization correctness.</p>
          <details><summary>Anonymizer configuration</summary><p>Current runtime: English spaCy NER within Presidio plus bounded C2 introduction, title and role rules; experimental GLiNER and trained candidates remain offline. Presidio runs in the preprocessing service; failures are reported without switching anonymizers.</p></details></div>
        <div className="actions"><button disabled={busy || denied} onClick={run}>{busy ? "Running demonstration…" : "Run demonstration"}</button>
          <button className="secondary" onClick={() => { invalidate(); setText(""); }}>Reset</button></div>
      </>}
      {result?.records.map(record => <section className="c2-original-record" key={record.record_id}><h3>Original synthetic text</h3><p className="c2-text">{record.original_text || "(Empty content)"}</p></section>)}
    </section>}
    <section className="stack" aria-label="Live demonstration results">
      <section className="card"><h2>Anonymization results</h2>
      {!result?.records.length && <section><h3>Actual anonymized output</h3><p className="c2-text">{result ? "No anonymized records returned." : "Actual pipeline output will appear here."}</p></section>}
      {result && !result.records.length && <p><strong>Empty batch</strong> — no records returned; automated release is blocked.</p>}
      {result?.records.map((record, index) => <article className="c2-record" key={record.record_id}><div className="detail-heading"><h3>Fictional record {index + 1}</h3><span className="status-badge">Quality: {record.quality_status}</span></div>
        <h3>Actual anonymized output</h3><p className="c2-text" lang={record.language_identification?.language === "sinhala" ? "si" : undefined}>{record.anonymized_text || "(Empty content)"}</p>
      </article>)}
      </section>
    </section>
    </div>
    <section className="card c2-full-width" aria-label="Language identification results"><h2>Language identification</h2>
      {!result?.records.length && <p>No language results returned yet.</p>}
      {result?.records.map(record => <div key={record.record_id}>
        <h3>Language ID — after quality assessment</h3>
        <p>Detected language: <strong>{record.language_identification ? readable(record.language_identification.language) : "Unknown — result unavailable"}</strong>{record.language_identification && <> ({record.language_identification.status}).</>}</p>
        <details><summary>Language evidence and limitations</summary>{record.language_identification && <><p>{readable(record.language_identification.reason)}.</p><p>Method: {record.language_identification.method}. Uncertain: {record.language_identification.uncertain ? "Yes" : "No — provisional rule evidence, not calibrated confidence"}.</p></>}
        <p>Provisional offline script and word evidence. Insufficient or ambiguous evidence remains unknown/uncertain. This result does not configure Presidio or establish multilingual anonymization.</p></details>
      </div>)}
    </section>
    <section className="card c2-full-width" aria-label="Normalized text and tokens"><h2>Normalized text and tokens</h2>
      {!result?.records.length && <p>Run fictional text to see actual normalized text and tokens.</p>}
      {result?.records.map(record => <div key={record.record_id}>
        <section className="c2-derived">
          <h3>Normalized text</h3><p data-testid="normalized-text" className="c2-normalized-text">{record.normalized_text == null ? "No normalization result returned." : record.normalized_text || "(Empty content)"}</p>
          <h3>Tokens</h3>{record.tokens == null ? <p>No tokenization result returned.</p> : record.tokens.length ? <ol className="c2-tokens" aria-label="Actual tokens">{record.tokens.map((token, tokenIndex) => <li key={tokenIndex}>{token}</li>)}</ol> : <p>No tokens — empty normalized content.</p>}
          <details><summary>Normalization and token offsets</summary>
            <p>NFC and collapsed whitespace only. Case, negation, punctuation, emoji, joiners and masking placeholders are preserved. Original anonymized text remains above.</p>
            <p>Offsets: zero-based [start, end) Unicode code points in normalized text, not JavaScript UTF-16 units or UTF-8 bytes. Use Array.from(text) when slicing by these offsets in JavaScript.</p>
            <p>Methods: {record.normalization_method ?? "Unavailable"}; {record.tokenization_method ?? "Unavailable"}. Tokenizer segments words and graphemes; it does not perform linguistic annotation.</p>
            {!!record.tokens?.length && <div className="c2-table-scroll"><table><caption>Backend token offsets</caption><thead><tr><th scope="col">Token</th><th scope="col">Start</th><th scope="col">End</th></tr></thead><tbody>{record.tokens.map((token, tokenIndex) => <tr key={tokenIndex}><td>{token}</td><td>{record.token_offsets?.[tokenIndex]?.[0] ?? "Unavailable"}</td><td>{record.token_offsets?.[tokenIndex]?.[1] ?? "Unavailable"}</td></tr>)}</tbody></table></div>}
          </details>
        </section>
      </div>)}
    </section>
    <section className="card c2-full-width" aria-label="Record quality and privacy"><h2>Record quality and privacy</h2>
      {!result?.records.length && <p>No record-level quality or privacy results yet.</p>}
      {result?.records.map(record => <div key={record.record_id}>
        <details><summary>Transformation types</summary>{record.transformations.length ? <ul>{record.transformations.map(value => <li key={value}>{readable(value)}</li>)}</ul> : <p>No transformations returned.</p>}</details>
        <h3>Quality issues</h3>{record.quality_issues.length ? <ul>{record.quality_issues.map(value => <li key={value}>{issueExplanation(value)}</li>)}</ul> : <p>No quality issues returned.</p>}
        <p className="notice-inline"><strong>Privacy review: {record.requires_privacy_review ? "Required — quarantine pending human review" : "No automated review signal flagged"}.</strong></p>
      </div>)}
    </section>
    <section className="card c2-full-width" aria-label="Quality and release summary">
      <div className="detail-heading"><h2>Quality and release</h2><span className="status-badge">Automated gate: {result ? result.release_ready ? "Passed" : "Blocked" : "Not run"}</span></div>
      {!result ? <p>No quality or privacy checks run yet.</p> : <>
        <p><strong>Quality policy gate: {result.quality_summary.data_quality_gate}.</strong> <strong>Privacy gate: {result.privacy_summary.status}.</strong></p>
        {result.records.length > 1 && <dl className="c2-counts"><div><dt>Records</dt><dd>{result.quality_summary.total_records}</dd></div>{["PASS", "REVIEW", "REJECT"].map(status => <div key={status}><dt>{status}</dt><dd>{result.quality_summary.status_counts[status] ?? 0}</dd></div>)}</dl>}
        {!!result.blocking_reasons.length && <><h3>Blocking reasons</h3><ol className="c2-blocking-reasons">{result.blocking_reasons.map(reason => <li key={reason}>{readable(reason)}</li>)}</ol></>}
        {!!result.privacy_summary.issues.length && <ul aria-label="Privacy gate issues">{result.privacy_summary.issues.map(issue => <li key={issue}>{issueExplanation(issue)}</li>)}</ul>}
      </>}
      <p className="notice-inline"><strong>Human release approval required.</strong> Automated checks do not certify complete anonymization.</p>
    </section>
    <footer>C2 pipeline demonstration · Authorized human release remains required · DEVELOPMENT ONLY</footer>
  </main>;
}
