"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "@j26/common/api";
import { DemoHeader, ErrorMessage } from "@j26/common/ui";
import type { AccountResponse, LoginRequest, C2DemoCatalogue, C2CustomDemoRequest, C2CustomDemoResponse } from "@j26/common/contracts";
import { PipelineStepper } from "./PipelineStepper";
import RunValidation from "./RunValidation";
import "./demo.css";

const readable = (value: string) => value.replaceAll(/[-_:]/g, " ");
const languageLabels: Record<string, string> = { english: "English", sinhala: "Sinhala", "romanized-si": "Romanized Sinhala", "code-mixed": "Code-mixed", unknown: "Unknown", uncertain: "Uncertain" };
const transformationLabels: Record<string, string> = {
  "mask:person": "Person", "mask:location": "Location", "mask:email": "Email", "mask:phone": "Phone", "mask:student-id": "Student ID",
  "presidio:person": "Person", "presidio:location": "Location", "presidio:email": "Email", "presidio:phone": "Phone", "presidio:student-id": "Student ID",
  "gliner-name-labels-v4-context-demo-v1:person": "Person", "gliner-name-labels-v4-context-demo-v1:location": "Location", "gliner-name-labels-v4-context-demo-v1:email": "Email", "gliner-name-labels-v4-context-demo-v1:phone": "Phone", "gliner-name-labels-v4-context-demo-v1:student_id": "Student ID",
  "gliner-name-labels-v4-location-context-demo-v2:person": "Person", "gliner-name-labels-v4-location-context-demo-v2:location": "Location", "gliner-name-labels-v4-location-context-demo-v2:email": "Email", "gliner-name-labels-v4-location-context-demo-v2:phone": "Phone", "gliner-name-labels-v4-location-context-demo-v2:student_id": "Student ID",
};
function maskedTypes(transformations: readonly string[] | undefined) {
  if (!Array.isArray(transformations)) return ["Unavailable"];
  return transformations.length ? [...new Set(transformations.map(value => transformationLabels[value] ?? "Unknown"))] : ["None reported"];
}
const statusTone = (status: string | undefined) => ["FAIL", "FAILED", "REJECT"].includes(status ?? "") ? "c2-status-fail" : status === "REVIEW" ? "c2-status-review" : ["PASS", "PASSED"].includes(status ?? "") ? "c2-status-pass" : "c2-status-unknown";
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
  const strategy = "gliner" as const;
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
    const body: C2CustomDemoRequest = { text, strategy };
    try {
      const response = await api<C2CustomDemoResponse>("/c2-demo/custom-runs", body, true, pending.signal);
      if (sequence.current === id) setResult(response);
    } catch (cause) {
      if (sequence.current !== id) return;
      setError(strategy === "gliner" && !(cause instanceof ApiError && [401, 403].includes(cause.status)) ? `Experimental GLiNER unavailable or failed. ${safeMessage(cause)} No fallback was run.` : safeMessage(cause));
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

  const hasFindings = !!result && (result.quality_summary.data_quality_gate === "FAILED" || result.records.some(record => record.requires_privacy_review || ["REVIEW", "REJECT"].includes(record.quality_status)));

  return <main className="c2-demo">
    <DemoHeader title="C2 Dataset Pipeline Demo" subtitle="Explore actual anonymization and data-quality gates with fictional samples." component="Component 2" badge="Live pipeline" />
    <PipelineStepper result={result} busy={busy} showReleaseStatus={false} />
    <nav className="actions" aria-label="Demo navigation"><a href="/">Back to dashboard</a>
      <a href="/c2-demo/annotation">Synthetic dataset annotation</a>
      {catalogue && !denied && <button className="quiet" onClick={logout}>Sign out</button>}</nav>
    <aside className="hint c2-synthetic">Development demo · Synthetic data only</aside>
    {denied && <section className="card c2-sign-in" aria-labelledby="c2-sign-in-title">
      <h2 id="c2-sign-in-title">Development sign-in</h2><p className="hint">Use your private local development counsellor credentials. No student submission, consent form, review task or LMS flow is needed.</p>
      <form onSubmit={login}><div className="c2-columns">
        <div><label htmlFor="c2-username">Development username</label><input id="c2-username" name="username" required maxLength={100} autoComplete="off" disabled={authBusy} /></div>
        <div><label htmlFor="c2-password">Password</label><input id="c2-password" name="password" type="password" required maxLength={256} autoComplete="off" disabled={authBusy} /></div>
      </div><button disabled={authBusy}>{authBusy ? "Signing in…" : "Sign in"}</button></form>
    </section>}
    <div className="c2-notifications" aria-label="Demo notifications">
      {error ? <ErrorMessage message={error} /> : result ? <div role="status" aria-live="polite" aria-atomic="true" className={"feedback c2-toast " + (hasFindings ? "c2-toast-review" : "")}>Live results received.{hasFindings && " Check quality/privacy findings below."}</div> : busy ? <p className="feedback">Processing — waiting for the actual pipeline response…</p> : <p className="feedback">Enter fictional text, then select Anonymize.</p>}
    </div>
    <div className="c2-workbench">
    <section className="card c2-text-card" aria-labelledby="input-title">
      <h2 id="input-title"><label htmlFor="custom-text">Input text</label></h2>
      {loading ? <p role="status" className="empty">Checking development access…</p> : !catalogue ? <><p>{denied ? "Sign in above to run a fictional test." : "Development access is unavailable."}</p>{!denied && <button className="secondary" onClick={() => { invalidate(); setLoading(true); setReload(value => value + 1); }}>Retry access</button>}</> : <>
        <div className="c2-custom">
          <textarea id="custom-text" className="c2-editor" aria-describedby="input-limit" value={text} maxLength={1000} rows={10} autoComplete="off" onChange={event => { invalidate(); setText(event.target.value); }} />
          <p id="input-limit" className="hint">Fictional text · up to 1,000 characters.</p>
        </div>
        <p className="c2-anonymizer">Anonymizer: GLiNER</p>
        <div className="actions"><button disabled={busy || denied} onClick={run}>{busy ? "Anonymizing…" : "Anonymize"}</button>
          <button className="secondary" onClick={() => { invalidate(); setText(""); }}>Reset</button></div>
      </>}
    </section>
    <section className="card c2-text-card" aria-labelledby="output-title" aria-busy={busy}>
      <h2 id="output-title"><label htmlFor="anonymized-text">Anonymized text</label></h2>
      <textarea id="anonymized-text" className="c2-editor" readOnly rows={10} value={result?.records.map(record => record.anonymized_text).join("\n\n") ?? ""} lang={result?.records[0]?.language_identification?.language === "sinhala" ? "si" : undefined} placeholder={busy ? "Waiting for the actual backend output…" : "Actual pipeline output will appear here."} />
      {result && !result.records.length && <p>No anonymized records returned.</p>}
      {!!result?.records.length && result.records.every(record => !record.anonymized_text) && <p className="hint">Empty content returned.</p>}
      {result && !result.records.length && <p><strong>Empty batch</strong> — no records returned; automated release is blocked.</p>}
    </section>
    </div>
    <section className="card c2-full-width c2-language" aria-label="Language identification results">
      {!result?.records.length && <p className="c2-language-result"><span className="c2-language-label">Language ID:</span>{" "}<span className="c2-language-neutral">Not run</span></p>}
      {result?.records.map(record => {
        const language = record.language_identification?.language;
        const label = language ? languageLabels[language] ?? "Unknown" : "Unknown";
        return <p className="c2-language-result" key={record.record_id}><span className="c2-language-label">Language ID:</span>{" "}<strong className={["Unknown", "Uncertain"].includes(label) ? "c2-language-neutral" : "c2-language-value"}>{label}</strong></p>;
      })}
    </section>
    <section className="card c2-full-width" aria-label="Normalized text and tokens"><h2>Normalized text and tokens</h2>
      {!result?.records.length && <p>Run fictional text to see actual normalized text and tokens.</p>}
      {result?.records.map(record => <div key={record.record_id}>
        <section className="c2-derived">
          <h3>Normalized text</h3><p data-testid="normalized-text" className="c2-normalized-text">{record.normalized_text == null ? "No normalization result returned." : record.normalized_text || "(Empty content)"}</p>
          <h3>Tokens</h3>{record.tokens == null ? <p>No tokenization result returned.</p> : record.tokens.length ? <ol className="c2-tokens" aria-label="Actual tokens">{record.tokens.map((token, tokenIndex) => <li key={tokenIndex}>{token}</li>)}</ol> : <p>No tokens — empty normalized content.</p>}
          <details><summary>Token positions</summary>
            {record.tokens?.length ? <div className="c2-table-scroll"><table><caption>Zero-based Unicode code-point offsets in normalized text; end is exclusive.</caption><thead><tr><th scope="col">Token</th><th scope="col">Start</th><th scope="col">End</th></tr></thead><tbody>{record.tokens.map((token, tokenIndex) => <tr key={tokenIndex}><td>{token}</td><td>{record.token_offsets?.[tokenIndex]?.[0] ?? "Unavailable"}</td><td>{record.token_offsets?.[tokenIndex]?.[1] ?? "Unavailable"}</td></tr>)}</tbody></table></div> : <p>{record.tokens == null ? "Token positions unavailable." : "No token positions — empty normalized content."}</p>}
          </details>
        </section>
      </div>)}
    </section>
    <section className="card c2-full-width" aria-label="Record quality and privacy"><h2>Record quality and privacy</h2>
      {result && <>
        <p className="c2-gate-statuses"><strong className={`c2-status ${statusTone(result.quality_summary.data_quality_gate)}`}>Quality policy gate: {result.quality_summary.data_quality_gate ?? "Unavailable"}.</strong> <strong className={`c2-status ${statusTone(result.privacy_summary.status)}`}>Privacy gate: {result.privacy_summary.status ?? "Unavailable"}.</strong></p>
        {result.records.length > 1 && <dl className="c2-counts"><div><dt>Records</dt><dd>{result.quality_summary.total_records ?? "Unavailable"}</dd></div>{["PASS", "REVIEW", "REJECT"].map(status => <div key={status}><dt>{status}</dt><dd>{result.quality_summary.status_counts[status] ?? "Unavailable"}</dd></div>)}</dl>}
        {!!result.privacy_summary.issues.length && <ul aria-label="Privacy gate issues">{result.privacy_summary.issues.map(issue => <li key={issue}>{issueExplanation(issue)}</li>)}</ul>}
      </>}
      {!result?.records.length && <p>No record-level quality or privacy results yet.</p>}
      {result?.records.map(record => <div key={record.record_id}>
        <p><strong className={`c2-status ${statusTone(record.quality_status)}`}>Quality: {record.quality_status ?? "Unavailable"}</strong></p>
        <div className="c2-masked-types" role="group" aria-label="Masked types"><span>Masked types:</span>{maskedTypes(record.transformations).map(label => <span className="c2-entity-badge" key={label}>{label}</span>)}</div>
        {!!record.quality_issues.length && <><h3>Quality issues</h3><ul>{record.quality_issues.map(value => <li key={value}>{issueExplanation(value)}</li>)}</ul></>}
        {record.requires_privacy_review === true ? <p className="c2-review-notice"><strong>Privacy review: Required — quarantine pending human review.</strong></p> : record.requires_privacy_review !== false ? <p>Privacy review status unavailable.</p> : null}
      </div>)}
    </section>
    <RunValidation summary={result?.validation_summary} configuration={result?.anonymization_configuration} release={result ?? undefined} />
  </main>;
}
