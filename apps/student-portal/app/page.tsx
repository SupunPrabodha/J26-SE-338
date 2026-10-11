"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@j26/common/api";
import { DemoHeader, ErrorMessage, SafetyNotice, WithdrawalDialog, processingLabel, reviewLabel } from "@j26/common/ui";
import type { ConsentLifecycle, ConsentRecord, FixturesResponse, PseudonymousCase } from "@j26/common/contracts";

export default function StudentPortal() {
  const [fixtures, setFixtures] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState("english");
  const [lifecycle, setLifecycle] = useState<ConsentLifecycle | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Start by reading the notice and recording your choice.");
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState("REJECTED");
  const [idempotency, setIdempotency] = useState("");
  const [withdrawKey, setWithdrawKey] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [clock, setClock] = useState(0);
  const consent = lifecycle?.consent;
  const result = lifecycle?.case;
  const expired = !!consent && Date.parse(consent.expires_at) <= clock;
  const active = consent?.consent_status === "ACTIVE" && !expired && !sessionEnded && !needsRefresh;
  const disposed = !!lifecycle?.disposal_reason || result?.processing_status === "WITHDRAWN";
  const consentStatus = sessionEnded ? "Session ended; status unavailable" : needsRefresh ? "Refresh required after access denial" : expired && consent?.consent_status === "ACTIVE" ? "EXPIRED" : consent?.consent_status || "Not recorded";

  useEffect(() => {
    api<FixturesResponse>("/fixtures").then(data => setFixtures(data.fixtures)).catch(() => setError("Synthetic fixtures could not be loaded. Refresh this page to retry."));
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function act(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setSessionEnded(true); setConfirming(false);
        setError("Your temporary session has ended. This demonstration cannot recover access to an earlier consent or case. A new session does not withdraw an earlier case.");
      } else {
        if (cause instanceof ApiError && cause.status === 403) setNeedsRefresh(true);
        setError(cause instanceof ApiError ? cause.message : "The request could not be completed. Please retry.");
      }
    } finally { setBusy(false); }
  }

  async function refresh(consentId: string) {
    setLifecycle(await api<ConsentLifecycle>(`/consents/${consentId}/lifecycle`));
    setNeedsRefresh(false);
    setClock(Date.now());
  }

  return <main>
    <DemoHeader title="Your wellbeing reflection" subtitle="A voluntary, fictional walkthrough of consent and counsellor-assisted review." />
    <SafetyNotice />
    <ol className="steps" aria-label="Demonstration steps"><li><span>1</span> Consent</li><li><span>2</span> Submission</li><li><span>3</span> Status & withdrawal</li></ol>
    {!confirming && <ErrorMessage message={error} />}
    <p className="feedback" role="status" aria-live="polite">{busy ? "Working…" : message}</p>
    <div className="student-grid"><div className="stack">
      <section className="card" aria-labelledby="consent-title"><div className="section-heading"><span className="step-number">1</span><h2 id="consent-title">Your consent</h2></div>
        <p>Choose whether fictional text may be processed by mock services and shared with an authorized counsellor for this demonstration. Participation is optional.</p>
        <p className="privacy-summary">No identity details are requested. You can withdraw before or after submission while your temporary session is active.</p>
        <details className="consent-notice"><summary>Read the full consent and privacy notice</summary>
          <p><strong>Consent notice dev-notice-1</strong> · Purpose: <code>synthetic-wellbeing-screening</code>.</p>
          <p>The demonstration routes only supplied fictional text to mock preprocessing, indicator and explanation services for counsellor-assisted screening support. It does not diagnose or replace professional counselling.</p>
          <p>Your pseudonymous session and consent last one hour. Synthetic derived evidence is retained for up to 24 hours or disposed on withdrawal. Withdrawal blocks further processing and review and deletes derived fixture evidence. Minimal audit and review receipts remain.</p>
          <p>You may reject without submitting anything. Withdrawal cannot be undone for the same consent. Expiry and retention disposal are separate from an explicit withdrawal.</p>
          <p>Reloading or leaving this page loses its in-memory case reference. After session expiry or loss of that reference there is no owner recovery mechanism in this demonstration. No participant data should be entered.</p>
        </details>
        <p className="hint">Withdrawal deletes derived evidence; minimal receipts remain. The session lasts one hour, and reloading loses this page's case reference.</p>
        <label htmlFor="decision">Consent choice</label>
        <select id="decision" value={decision} disabled={!!consent || busy || sessionEnded} onChange={e => setDecision(e.target.value)}>
          <option value="REJECTED">I do not agree</option><option value="ACTIVE">I agree to this synthetic demonstration</option>
        </select>
        <button disabled={busy || !!consent || sessionEnded} onClick={() => act(async () => {
          await api("/auth/student-session", {});
          const value = await api<ConsentRecord>("/consents", { consent_status: decision });
          setLifecycle({ schema_version: "1.0.0", synthetic: true, development_only: true, consent: value });
          setClock(Date.now()); setIdempotency(crypto.randomUUID()); setWithdrawKey(crypto.randomUUID());
          setMessage(value.consent_status === "ACTIVE" ? "Consent accepted. You may submit or withdraw." : "Consent declined. No text processing will take place. Open a fresh page for another fictional walkthrough.");
        })}>Record consent decision</button>
      </section>
      <section className="card" aria-labelledby="submission-title"><div className="section-heading"><span className="step-number">2</span><h2 id="submission-title">A fictional reflection</h2></div>
        <p>Choose a built-in example. The text is fixed; do not enter personal or student information.</p>
        <label htmlFor="language">Fixture language</label>
        <select id="language" value={choice} disabled={busy || !!result || sessionEnded} onChange={e => { setChoice(e.target.value); setIdempotency(crypto.randomUUID()); }}>
          {Object.keys(fixtures).map(key => <option key={key} value={key}>{key}</option>)}
        </select>
        <label htmlFor="reflection">Synthetic reflection (fixed fixture)</label>
        <textarea id="reflection" readOnly value={fixtures[choice] || ""} rows={3} />
        <button disabled={busy || !active || !!result || !fixtures[choice]} onClick={() => act(async () => {
          if (!consent) return;
          const created = await api<PseudonymousCase>("/submissions", { consent_id: consent.consent_id, fixture_id: choice, text: fixtures[choice], idempotency_key: idempotency });
          setLifecycle(previous => previous ? { ...previous, case: created } : previous);
          await refresh(consent.consent_id); setMessage("Synthetic submission received. Refresh status to follow processing. Outputs require authorized human review.");
        })}>Submit synthetic fixture</button>
        {!active && !result && <p className="hint">Submission is available only after the server confirms active consent.</p>}
      </section>
    </div>
    <section className="card status-card" aria-labelledby="lifecycle-heading"><div className="section-heading"><span className="step-number">3</span><h2 id="lifecycle-heading" tabIndex={-1}>Status & withdrawal</h2></div>
      <p className="hint">Refresh for the latest server status. Processing completion is not a completed human review.</p>
      <dl className="status-list"><div><dt>Consent</dt><dd><span className="status-badge">{consentStatus}</span></dd></div>
        <div><dt>Processing</dt><dd>{sessionEnded ? "Status unavailable" : processingLabel(result?.processing_status, disposed)}</dd></div>
        <div><dt>Human review</dt><dd>{reviewLabel(result?.processing_status, disposed || !active)}</dd></div>
        <div><dt>Disposal</dt><dd>{lifecycle?.disposal_reason === "RETENTION" ? "Retention disposal" : lifecycle?.disposal_reason === "OWNER_WITHDRAWAL" ? "Disposed after owner withdrawal" : lifecycle?.disposal_reason === "LEGACY_DISPOSAL" ? "Previously disposed; reason unavailable" : "None recorded"}</dd></div>
      </dl>
      {consent && <p className="hint">Consent expires: <time dateTime={consent.expires_at}>{new Date(consent.expires_at).toLocaleString()}</time></p>}
      <p className={lifecycle?.explicitly_withdrawn_at ? "receipt" : "hint"}>{lifecycle?.explicitly_withdrawn_at ? "Owner withdrawal recorded." : "No explicit owner withdrawal recorded."}</p>
      {lifecycle?.explicitly_withdrawn_at && <p className="hint">Receipt time: <time dateTime={lifecycle.explicitly_withdrawn_at}>{new Date(lifecycle.explicitly_withdrawn_at).toLocaleString()}</time>. Further processing and review are blocked.</p>}
      {consent ? <div className="actions"><button className="secondary" disabled={busy || sessionEnded} onClick={() => act(async () => { await refresh(consent.consent_id); setMessage("Status refreshed."); })}>Refresh status</button>
        {(["ACTIVE", "EXPIRED", "WITHDRAWN"].includes(consent.consent_status)) && <button className="danger-outline" disabled={busy || sessionEnded || !!lifecycle?.explicitly_withdrawn_at} onClick={() => { setError(""); setConfirming(true); }}>Withdraw consent</button>}</div>
        : <p className="empty">No submission yet. Begin with your consent choice.</p>}
      {(expired || sessionEnded) && <p className="notice-inline">Your consent or session has expired. Existing-case recovery is not supported. A new session cannot withdraw an earlier case.</p>}
    </section></div>
    {confirming && <WithdrawalDialog busy={busy} error={error} onCancel={() => { setConfirming(false); setError(""); }} onConfirm={() => act(async () => {
      if (!consent) return;
      setLifecycle(await api<ConsentLifecycle>(`/consents/${consent.consent_id}/withdraw`, { idempotency_key: withdrawKey }));
      setConfirming(false); setMessage("Withdrawal recorded. Further processing and review are blocked.");
    })} />}
    <footer>Voluntary screening support · Authorized human interpretation · DEVELOPMENT ONLY</footer>
  </main>;
}
