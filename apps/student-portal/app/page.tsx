"use client";

import { useEffect, useState } from "react";
import { api } from "@j26/common/api";
import { ErrorMessage, SafetyNotice } from "@j26/common/ui";
import type { ConsentRecord, FixturesResponse, PseudonymousCase } from "@j26/common/contracts";

export default function StudentPortal() {
  const [fixtures, setFixtures] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState("english");
  const [consent, setConsent] = useState("");
  const [result, setResult] = useState<PseudonymousCase | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState("REJECTED");
  const [idempotency, setIdempotency] = useState("");

  useEffect(() => {
    api<FixturesResponse>("/fixtures").then(data => setFixtures(data.fixtures)).catch(() => setError("Synthetic fixtures could not be loaded."));
  }, []);

  async function act(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed."); }
    finally { setBusy(false); }
  }

  return <main><header><p>J26-SE-338 · Component 1 development foundation</p>
    <h1>Privacy-Preserving Sinhala-English NLP Framework for Student Mental Wellbeing Screening</h1></header>
    <SafetyNotice />
    <section><h2>Try a voluntary synthetic submission</h2>
      <p>Purpose: demonstrate consent-aware routing of fictional text to mock preprocessing, indicator,
        and explanation services for counsellor-assisted review. Participation is optional.</p>
      <p>A temporary pseudonymous session lasts one hour. You may withdraw during the session.
        Withdrawal blocks further review and deletes derived fixture evidence. No identity details are requested.</p>
      <label htmlFor="decision">Consent choice</label>
      <select id="decision" value={decision} disabled={!!consent || busy} onChange={e => setDecision(e.target.value)}>
        <option value="REJECTED">I do not agree</option><option value="ACTIVE">I agree to this synthetic demonstration</option>
      </select>
      <button disabled={busy || !!consent} onClick={() => act(async () => {
        await api("/auth/student-session", {});
        const value = await api<ConsentRecord>("/consents", { consent_status: decision });
        if (value.consent_status === "ACTIVE") { setConsent(value.consent_id); setIdempotency(crypto.randomUUID()); }
        else setError("Consent declined. No text processing will take place.");
      })}>Record consent decision</button>
    </section>
    <section><h2>Guided fictional text</h2>
      <label htmlFor="language">Fixture language</label>
      <select id="language" value={choice} disabled={busy || !!result} onChange={e => { setChoice(e.target.value); setIdempotency(crypto.randomUUID()); }}>
        {Object.keys(fixtures).map(key => <option key={key} value={key}>{key}</option>)}
      </select>
      <label htmlFor="reflection">Synthetic reflection (fixed fixture)</label>
      <textarea id="reflection" readOnly value={fixtures[choice] || ""} rows={4} />
      <button disabled={busy || !consent || !!result || !fixtures[choice]} onClick={() => act(async () => {
        setResult(await api<PseudonymousCase>("/submissions", {
          consent_id: consent, fixture_id: choice, text: fixtures[choice], idempotency_key: idempotency,
        }));
      })}>Submit synthetic fixture</button>
    </section>
    <ErrorMessage message={error} />
    <p role="status" aria-live="polite">{busy ? "Working…" : result ? `Workflow: ${result.processing_status}` : "No submission processed."}</p>
    {result && <section><h2>Submission status</h2><p>Case: <code>{result.case_id}</code></p>
      <button disabled={busy} onClick={() => act(async () => setResult(await api<PseudonymousCase>(`/cases/${result.case_id}/status`)))}>Refresh status</button>
      <button disabled={busy || result.processing_status === "WITHDRAWN"} onClick={() => act(async () => {
        setResult(await api<PseudonymousCase>(`/cases/${result.case_id}/withdraw`, { idempotency_key: crypto.randomUUID() }));
      })}>Withdraw submission</button>
    </section>}
  </main>;
}
