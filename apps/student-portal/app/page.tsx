"use client";

import { useEffect, useState } from "react";
import { api } from "@j26/common/api";
import { ErrorMessage, SafetyNotice } from "@j26/common/ui";
import type { ConsentLifecycle, ConsentRecord, FixturesResponse, PseudonymousCase } from "@j26/common/contracts";

export default function StudentPortal() {
  const [fixtures, setFixtures] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState("english");
  const [lifecycle, setLifecycle] = useState<ConsentLifecycle | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("No submission processed.");
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState("REJECTED");
  const [idempotency, setIdempotency] = useState("");
  const [withdrawKey, setWithdrawKey] = useState("");
  const [confirming, setConfirming] = useState(false);
  const consent = lifecycle?.consent;
  const result = lifecycle?.case;

  useEffect(() => {
    api<FixturesResponse>("/fixtures").then(data => setFixtures(data.fixtures)).catch(() => setError("Synthetic fixtures could not be loaded."));
  }, []);

  async function act(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed."); }
    finally { setBusy(false); }
  }

  async function refresh(consentId: string) {
    setLifecycle(await api<ConsentLifecycle>(`/consents/${consentId}/lifecycle`));
  }

  return <main><header><p>J26-SE-338 · Component 1 development foundation</p>
    <h1>Privacy-Preserving Sinhala-English NLP Framework for Student Mental Wellbeing Screening</h1></header>
    <SafetyNotice />
    <section><h2>Try a voluntary synthetic submission</h2>
      <p>Consent notice dev-notice-1 · Purpose: synthetic-wellbeing-screening.</p>
      <p>Demonstrate consent-aware routing of fictional text to mock preprocessing, indicator,
        and explanation services for counsellor-assisted review. Participation is optional.</p>
      <p>A temporary pseudonymous session lasts one hour. You may withdraw before or after submission
        while signed in. Withdrawal blocks further processing and review and deletes derived fixture evidence.
        Minimal audit receipts remain. After session expiry or losing this page, this demonstration provides
        no owner recovery mechanism. No identity details are requested.</p>
      <label htmlFor="decision">Consent choice</label>
      <select id="decision" value={decision} disabled={!!consent || busy} onChange={e => setDecision(e.target.value)}>
        <option value="REJECTED">I do not agree</option><option value="ACTIVE">I agree to this synthetic demonstration</option>
      </select>
      <button disabled={busy || !!consent} onClick={() => act(async () => {
        await api("/auth/student-session", {});
        const value = await api<ConsentRecord>("/consents", { consent_status: decision });
        setLifecycle({ schema_version: "1.0.0", synthetic: true, development_only: true, consent: value });
        setIdempotency(crypto.randomUUID()); setWithdrawKey(crypto.randomUUID());
        setMessage(value.consent_status === "ACTIVE" ? "Consent accepted. You may submit or withdraw." : "Consent declined. No text processing will take place.");
      })}>Record consent decision</button>
    </section>
    <section><h2>Guided fictional text</h2>
      <label htmlFor="language">Fixture language</label>
      <select id="language" value={choice} disabled={busy || !!result} onChange={e => { setChoice(e.target.value); setIdempotency(crypto.randomUUID()); }}>
        {Object.keys(fixtures).map(key => <option key={key} value={key}>{key}</option>)}
      </select>
      <label htmlFor="reflection">Synthetic reflection (fixed fixture)</label>
      <textarea id="reflection" readOnly value={fixtures[choice] || ""} rows={4} />
      <button disabled={busy || consent?.consent_status !== "ACTIVE" || !!result || !fixtures[choice]} onClick={() => act(async () => {
        if (!consent) return;
        const created = await api<PseudonymousCase>("/submissions", {
          consent_id: consent.consent_id, fixture_id: choice, text: fixtures[choice], idempotency_key: idempotency,
        });
        setLifecycle(previous => previous ? { ...previous, case: created } : previous);
        await refresh(consent.consent_id);
        setMessage("Synthetic submission received. Outputs require authorized human review.");
      })}>Submit synthetic fixture</button>
    </section>
    <ErrorMessage message={error} />
    <p role="status" aria-live="polite">{busy ? "Working…" : message}</p>
    {consent && <section aria-label="Consent and submission status"><h2>Consent and submission status</h2>
      <p>Consent: {consent.consent_status}</p>
      <p>Consent expires: {consent.expires_at}</p>
      <p>Processing: {lifecycle?.disposal_reason ? "Disposed; review unavailable" : result?.processing_status || "Not submitted"}</p>
      <p>Disposal: {lifecycle?.disposal_reason || "None recorded"}</p>
      <p>{lifecycle?.explicitly_withdrawn_at ? "Owner withdrawal recorded." : "No explicit owner withdrawal recorded."}</p>
      <button disabled={busy} onClick={() => act(async () => { await refresh(consent.consent_id); setMessage("Status refreshed."); })}>Refresh status</button>
      {(["ACTIVE", "EXPIRED", "WITHDRAWN"].includes(consent.consent_status)) && <button disabled={busy || !!lifecycle?.explicitly_withdrawn_at} onClick={() => setConfirming(true)}>Withdraw consent</button>}
      {confirming && <div role="group" aria-label="Confirm withdrawal">
        <p>Withdraw your consent? Further processing and counsellor review will be blocked. This cannot be undone.</p>
        <button disabled={busy} onClick={() => act(async () => {
          setLifecycle(await api<ConsentLifecycle>(`/consents/${consent.consent_id}/withdraw`, { idempotency_key: withdrawKey }));
          setConfirming(false); setMessage("Withdrawal recorded. Further processing and review are blocked.");
        })}>Confirm withdrawal</button>
        <button disabled={busy} onClick={() => setConfirming(false)}>Keep consent</button>
      </div>}
    </section>}
  </main>;
}
