"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@j26/common/api";
import { ReflectionHero, ReflectionPrinciples, Icon, ErrorMessage, SafetyNotice, WithdrawalDialog, processingLabel, reviewLabel } from "@j26/common/ui";
import type { ConsentLifecycle, ConsentRecord, FixturesResponse, PseudonymousCase } from "@j26/common/contracts";

export default function StudentLifecycle() {
  const [fixtures, setFixtures] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState("english");
  const [lifecycle, setLifecycle] = useState<ConsentLifecycle | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Start by reading the notice and recording your choice.");
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<"consent" | "submission" | "status" | "withdrawal" | null>(null);
  const pending = useRef(false);
  const [submissionOutcome, setSubmissionOutcome] = useState<"idle" | "unconfirmed" | "accepted" | "rejected">("idle");
  const [decision, setDecision] = useState("REJECTED");
  const [idempotency, setIdempotency] = useState("");
  const [withdrawKey, setWithdrawKey] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [clock, setClock] = useState(0);
  const [stale, setStale] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const [ownerVerified, setOwnerVerified] = useState(false);
  const consent = lifecycle?.consent;
  const result = lifecycle?.case;
  const expired = !!consent && Date.parse(consent.expires_at) <= clock;
  const active = consent?.consent_status === "ACTIVE" && !expired && !sessionEnded && !needsRefresh && !stale && !accessLost;
  const canRetry = submissionOutcome === "unconfirmed" && consent?.consent_status === "ACTIVE" && !expired && !sessionEnded && !needsRefresh && !accessLost;
  const disposed = !!lifecycle?.disposal_reason || result?.processing_status === "WITHDRAWN";
  const consentStatus = sessionEnded ? "Session ended; status unavailable" : needsRefresh ? "Refresh required after access denial" : expired && consent?.consent_status === "ACTIVE" ? "EXPIRED" : consent?.consent_status || "Not recorded";

  useEffect(() => {
    api<FixturesResponse>("/fixtures").then(data => setFixtures(data.fixtures)).catch(() => setError("Synthetic fixtures could not be loaded. Refresh this page to retry."));
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const failed = useCallback((cause: unknown) => {
      setStale(true);
      if (cause instanceof ApiError && cause.status === 401) {
        setSessionEnded(true); setConfirming(false);
        setOwnerVerified(false);
        setError("Your temporary session has ended. This demonstration cannot recover access to an earlier consent or case. A new session does not withdraw an earlier case.");
      } else {
        if (cause instanceof ApiError && [403, 404].includes(cause.status)) { setNeedsRefresh(true); setAccessLost(true); }
        setError(cause instanceof ApiError ? cause.message : "The request could not be completed. Please retry.");
      }
  }, []);

  const observe = useCallback((value: ConsentLifecycle) => {
    setLifecycle(value);
    if (value.case) setSubmissionOutcome("accepted");
    setNeedsRefresh(false); setAccessLost(false); setStale(false); setClock(Date.now());
  }, []);

  async function act(kind: NonNullable<typeof operation>, action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setOperation(kind); setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (cause) { failed(cause); setMessage(kind === "consent" ? "Consent decision was not confirmed. Text submission remains blocked." : kind === "status" && submissionOutcome === "accepted" ? "Submission accepted; processing status temporarily unavailable." : "The action was not confirmed. Refresh status before retrying."); }
    finally { pending.current = false; setBusy(false); setOperation(null); }
  }

  async function refresh(consentId: string) {
    observe(await api<ConsentLifecycle>(`/consents/${consentId}/lifecycle`));
  }

  async function submit() {
    if (!consent) return;
    let created: PseudonymousCase;
    try {
      created = await api<PseudonymousCase>("/submissions", { consent_id: consent.consent_id, fixture_id: choice, text: fixtures[choice], idempotency_key: idempotency });
    } catch (cause) {
      const uncertain = !(cause instanceof ApiError) || cause.status >= 500 || cause.status === 408;
      setSubmissionOutcome(uncertain ? "unconfirmed" : "rejected"); failed(cause);
      setMessage(uncertain ? "Submission outcome is unconfirmed. Retry safely using the same idempotency key, or refresh status." : "Submission was not accepted. Check the error and refresh your consent status.");
      return;
    }
    setLifecycle(previous => previous ? { ...previous, case: created } : previous);
    setSubmissionOutcome("accepted");
    try { await refresh(consent.consent_id); setMessage("Submission accepted. Processing is separate; refresh status to follow the actual workflow."); }
    catch (cause) { failed(cause); setMessage("Submission accepted; processing status temporarily unavailable."); }
  }

  const progressLabel = operation === "consent" ? "Recording consent…" : operation === "submission" ? "Submitting text…" : operation === "withdrawal" ? "Recording withdrawal…" : "Refreshing status…";

  return <main className="student-home">
    <ReflectionHero />
    <SafetyNotice />
    <ReflectionPrinciples />
    <div className="reflection-workspace-heading"><div><p className="eyebrow">A guided demonstration</p><h2>Your reflection space</h2></div><span className="workspace-label"><Icon name="leaf" />Built around your choices</span></div>
    <section className="student-session" aria-label="Student session"><div><strong>{sessionEnded ? "Session ended" : ownerVerified ? "Student · owner session verified" : "Your private demonstration"}</strong><span>{ownerVerified ? "Your consent and case controls use an authenticated pseudonymous owner session." : "A pseudonymous owner session is checked when you record a decision. No identity details are requested."}</span></div></section>
    <p className="demo-nav"><Link href="/demo" target="_blank" rel="noopener noreferrer">Open the Component 1 PP1 demo</Link><span className="hint">The checklist observes your runs in another tab using this browser's student session.</span></p>
    <ol className="steps" id="reflection-guide" aria-label="Demonstration steps"><li><span>1</span><div>Consent<small>Read the notice. Make your choice.</small></div></li><li><span>2</span><div>Submission<small>Explore a built-in fictional example.</small></div></li><li><span>3</span><div>Status & withdrawal<small>Check progress and stay in control.</small></div></li></ol>
    {!confirming && <ErrorMessage message={error} />}
    <p className="feedback" role="status" aria-live="polite">{busy ? progressLabel : message}</p>
    {busy && <div className="request-progress" role="progressbar" aria-label={progressLabel} aria-valuetext="Request pending; progress cannot be measured"><span /></div>}
    <div className="student-grid"><div className="stack">
      <section className="card consent-card" aria-labelledby="consent-title" aria-busy={operation === "consent"}><div className="section-heading"><span className="step-number">1</span><h2 id="consent-title" tabIndex={-1}>Your consent</h2><Icon name="heart" /></div>
        <p>Choose whether fictional text may be processed by mock services and shared with an authorized counsellor for this demonstration. Participation is optional.</p>
        <p className="privacy-summary">No identity details are requested. You can withdraw before or after submission while your temporary session is active.</p>
        <details className="consent-notice"><summary>Read the full consent and privacy notice</summary>
          <p><strong>Consent notice dev-notice-1</strong> · Purpose: <code>synthetic-wellbeing-screening</code>.</p>
          <p>The demonstration routes only supplied fictional text to mock preprocessing, indicator and explanation services for counsellor-assisted screening support. It does not diagnose or replace professional counselling.</p>
          <p>Your pseudonymous session and consent last one hour. Synthetic derived evidence is retained for up to 24 hours or disposed on withdrawal. Withdrawal blocks further processing and review and deletes derived fixture evidence. Minimal audit and review receipts remain.</p>
          <p>You may reject without submitting anything. Withdrawal cannot be undone for the same consent. Expiry and retention disposal are separate from an explicit withdrawal.</p>
          <p>Reloading or leaving this page loses its in-memory case reference. The checklist can find owner-scoped receipts while this session remains active; it cannot restore submission controls or recover an expired session. No participant data should be entered.</p>
          <p>Only successful, consent-checked processing can create a review task. Assignment follows the configured development policy: in the manual demonstration an administrator selects an active counsellor; the automatic development policy may assign the configured counsellor. Staff must sign in and hold a current case assignment; consent alone does not grant access. Saved interpretation and follow-up contents are visible only to authorized assigned counsellors and are deleted on withdrawal or retention disposal.</p>
        </details>
        <p className="hint">Withdrawal deletes derived evidence; minimal receipts remain. The session lasts one hour, and reloading loses this page's case reference.</p>
        <label htmlFor="decision">Consent choice</label>
        <select id="decision" value={decision} disabled={!!consent || busy || sessionEnded} onChange={e => setDecision(e.target.value)}>
          <option value="REJECTED">I do not agree</option><option value="ACTIVE">I agree to this synthetic demonstration</option>
        </select>
        <button disabled={busy || !!consent || sessionEnded} onClick={() => act("consent", async () => {
          let role: string;
          try { role = (await api<{ role: string }>("/auth/me")).role; }
          catch (cause) {
            if (!(cause instanceof ApiError) || cause.status !== 401) throw cause;
            role = (await api<{ role: string }>("/auth/student-session", {})).role;
          }
          if (role !== "STUDENT") throw new ApiError(403, "Open student submission in a separate student browser profile.");
          setOwnerVerified(true);
          const value = await api<ConsentRecord>("/consents", { consent_status: decision });
          observe({ schema_version: "1.0.0", synthetic: true, development_only: true, consent: value });
          setClock(Date.now()); setIdempotency(crypto.randomUUID()); setWithdrawKey(crypto.randomUUID());
          setMessage(value.consent_status === "ACTIVE" ? "Consent recorded—accepted. You may submit or withdraw." : "Consent recorded—declined. Text submission remains blocked. Open a fresh page for another fictional walkthrough.");
        })}>Record consent decision</button>
      </section>
      <section className="card submission-card" aria-labelledby="submission-title" aria-busy={operation === "submission"}><div className="section-heading"><span className="step-number">2</span><h2 id="submission-title">A fictional reflection</h2><Icon name="book" /></div>
        <p>Choose a built-in example. The text is fixed; do not enter personal or student information.</p>
        <label htmlFor="language">Fixture language</label>
        <select id="language" value={choice} disabled={busy || !!result || sessionEnded || submissionOutcome === "unconfirmed"} onChange={e => { setChoice(e.target.value); setIdempotency(crypto.randomUUID()); }}>
          {Object.keys(fixtures).map(key => <option key={key} value={key}>{key}</option>)}
        </select>
        <label htmlFor="reflection">Synthetic reflection (fixed fixture)</label>
        <textarea id="reflection" readOnly value={fixtures[choice] || ""} rows={3} />
        <button disabled={busy || (!active && !canRetry) || !!result || !fixtures[choice]} onClick={() => act("submission", submit)}>{submissionOutcome === "unconfirmed" ? "Retry unconfirmed submission" : "Submit synthetic fixture"}</button>
        {!active && !result && <p className="hint">Submission is available only after the server confirms active consent.</p>}
      </section>
    </div>
    <section className="card status-card" aria-labelledby="lifecycle-heading"><div className="section-heading"><span className="step-number">3</span><h2 id="lifecycle-heading" tabIndex={-1}>Status & withdrawal</h2><Icon name="shield" /></div>
      <p className="hint">Refresh for the latest server status. Processing completion is not a completed human review.</p>
      <details className="access-path"><summary>Who can access this case?</summary><p>Your owner session controls consent, status and withdrawal. Mock services process the fixed fixture through C1. Only the assigned, signed-in counsellor can open review evidence while consent remains valid. Administrators see safe operational metadata, never counselling content.</p></details>
      <dl className="status-list"><div><dt>Consent</dt><dd><span className="status-badge" data-status={consentStatus}>{consentStatus}</span></dd></div>
        <div><dt>Processing</dt><dd>{sessionEnded || stale || accessLost ? "Status unavailable" : processingLabel(result?.processing_status, disposed)}</dd></div>
        <div><dt>Human review</dt><dd>{reviewLabel(result?.processing_status, disposed || !active)}</dd></div>
        <div><dt>Disposal</dt><dd>{lifecycle?.disposal_reason === "RETENTION" ? "Retention disposal" : lifecycle?.disposal_reason === "OWNER_WITHDRAWAL" ? "Disposed after owner withdrawal" : lifecycle?.disposal_reason === "LEGACY_DISPOSAL" ? "Previously disposed; reason unavailable" : "None recorded"}</dd></div>
      </dl>
      {consent && <p className="hint">Consent expires: <time dateTime={consent.expires_at}>{new Date(consent.expires_at).toLocaleString()}</time></p>}
      <p className={lifecycle?.explicitly_withdrawn_at ? "receipt" : "hint"}>{lifecycle?.explicitly_withdrawn_at ? "Owner withdrawal recorded." : "No explicit owner withdrawal recorded."}</p>
      {lifecycle?.explicitly_withdrawn_at && <p className="hint">Receipt time: <time dateTime={lifecycle.explicitly_withdrawn_at}>{new Date(lifecycle.explicitly_withdrawn_at).toLocaleString()}</time>. Further processing and review are blocked.</p>}
      {consent ? <div className="actions"><button className="secondary" disabled={busy || sessionEnded} onClick={() => act("status", async () => { await refresh(consent.consent_id); setMessage("Status refreshed."); })}>Refresh status</button>
        {(["ACTIVE", "EXPIRED", "WITHDRAWN"].includes(consent.consent_status)) && <button className="danger-outline" disabled={busy || sessionEnded || !!lifecycle?.explicitly_withdrawn_at} onClick={() => { setError(""); setConfirming(true); }}>Withdraw consent</button>}</div>
        : <p className="empty">No submission yet. Begin with your consent choice.</p>}
      {(expired || sessionEnded) && <p className="notice-inline">Your consent or session has expired. Existing-case recovery is not supported. A new session cannot withdraw an earlier case.</p>}
    </section></div>
    {confirming && <WithdrawalDialog busy={busy} error={error} onCancel={() => { setConfirming(false); setError(""); }} onConfirm={() => act("withdrawal", async () => {
      if (!consent) return;
      observe(await api<ConsentLifecycle>(`/consents/${consent.consent_id}/withdraw`, { idempotency_key: withdrawKey }));
      setConfirming(false); setMessage("Withdrawal recorded. Further processing and review are blocked.");
    })} />}
    <footer className="student-footer"><span className="footer-brand"><Icon name="leaf" />Wellbeing</span><span>Screening support · Authorized human interpretation</span><span>J26-SE-338 · Synthetic research workspace</span></footer>
  </main>;
}
