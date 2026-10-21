"use client";

import { Component, useEffect, useRef, type ReactNode } from "react";

export function SafetyNotice() {
  return <aside aria-label="Prototype limitations" className="notice">
    <strong>Screening support, with people in control.</strong>
    <p>This prototype does not provide clinical diagnosis, treatment advice, or emergency intervention.
      It does not replace professional counselling. Outputs require authorized human interpretation.
      Use fictional fixtures only. Do not enter real student information.</p>
  </aside>;
}

export function DemoHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <header className="page-header"><div><p className="eyebrow">J26-SE-338 · Component 1</p>
    <h1>{title}</h1><p className="subtitle">{subtitle}</p></div>
    <span className="badge">Synthetic demonstration · Mock services</span></header>;
}

export function reviewLabel(state?: string, unavailable = false) {
  if (unavailable) return "Unavailable";
  if (state === "COMPLETED") return "Human review completed";
  if (state === "UNDER_REVIEW") return "Human review in progress";
  if (state === "READY_FOR_REVIEW") return "Awaiting human review";
  return "Not yet available";
}

export function processingLabel(state?: string, disposed = false) {
  if (disposed || state === "WITHDRAWN" || state === "WITHDRAWAL_REQUESTED") return "Disposed; review unavailable";
  if (["READY_FOR_REVIEW", "UNDER_REVIEW", "COMPLETED"].includes(state || "")) return "Processing complete";
  const labels: Record<string, string> = { RECEIVED: "Submission received", CONSENT_VERIFIED: "Consent verified",
    PREPROCESSING: "Preparing synthetic text", INFERENCE: "Running mock indicators", EXPLANATION: "Preparing mock explanation", FAILED: "Processing failed" };
  return labels[state || ""] || "Not submitted";
}

export function WithdrawalDialog({ busy, error, onCancel, onConfirm }: {
  busy: boolean; error: string; onCancel: () => void; onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element?.showModal(); cancel.current?.focus();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected && !previous.matches(":disabled")) previous.focus();
      else document.getElementById("lifecycle-heading")?.focus();
    };
  }, []);
  return <dialog ref={dialog} aria-labelledby="withdraw-title" aria-describedby="withdraw-description"
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <p className="eyebrow">Your choice</p><h2 id="withdraw-title">Withdraw your consent?</h2>
    <p id="withdraw-description">Further processing and counsellor review will be blocked. Derived fixture evidence
      will be deleted. Minimal audit receipts remain. This decision cannot be undone for this consent.</p>
    <ErrorMessage message={error} />
    <p role="status">{busy ? "Recording your withdrawal…" : "You can keep your consent by cancelling."}</p>
    <div className="actions"><button ref={cancel} className="secondary" disabled={busy} onClick={onCancel}>Keep consent</button>
      <button className="danger" disabled={busy} onClick={onConfirm}>Confirm withdrawal</button></div>
  </dialog>;
}

export function ErrorMessage({ message }: { message: string }) {
  return message ? <p role="alert" className="error">{message}</p> : null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p role="alert">The development interface could not load. Refresh to try again.</p> : this.props.children;
  }
}
