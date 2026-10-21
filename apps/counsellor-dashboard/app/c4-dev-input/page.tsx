"use client";

import React, { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "../components/Sidebar";
import { useReviewCase, type DevelopmentInputData } from "../context/CaseContext";
import type { C4PredictionResponse } from "@j26/common/contracts";

export const MAX_CHAR_LIMIT = 2000;

export const SAMPLE_INPUTS = [
  {
    label: "English sample",
    language: "English",
    text: "I have three assignments due this week and the final examination starts next Monday. I cannot sleep and I feel completely overwhelmed by the workload.",
  },
  {
    label: "Sinhala sample",
    language: "Sinhala",
    text: "මට මේ සතියේ පැවරුම් තුනක් භාර දීමට තිබෙන අතර අවසාන විභාගය ලබන සඳුදා ආරම්භ වේ. මට නිදා ගැනීමට නොහැකි අතර වැඩ බර නිසා මට දැඩි පීඩනයක් දැනේ.",
  },
  {
    label: "Romanized Sinhala sample",
    language: "Romanized Sinhala",
    text: "Mata me sathiyedi assignments thunak submit karanna thiyenawa. Exams langai mata godak bayai stress wadi nisa nidaganna baha.",
  },
  {
    label: "Code-mixed sample",
    language: "Code-mixed",
    text: "Semester finals langa nisa godak pressure ekak thiyenawa, syllabus cover karanna baha kiyala hithenawa. I feel stressed and cannot concentrate on studies.",
  },
];

function C4DevInputContent() {
  const router = useRouter();
  const {
    authorized,
    checking,
    devInput,
    setDevInput,
    selectedSentimentClass,
    setSelectedSentimentClass,
    login,
  } = useReviewCase();

  const [text, setText] = useState(devInput?.text || "");
  const [language, setLanguage] = useState(devInput?.language || "English");
  const [submittedText, setSubmittedText] = useState<string | null>(devInput?.text || null);
  const [submittedLanguage, setSubmittedLanguage] = useState<string | null>(devInput?.language || null);
  const [prediction, setPrediction] = useState<C4PredictionResponse | null>(devInput?.prediction || null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  // Inline development login state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  async function handleInlineLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError("Please enter both username and password.");
      return;
    }
    setIsLoggingIn(true);
    setLoginError("");
    try {
      await login(loginUsername.trim(), loginPassword.trim());
      setErrorMessage("");
      setStatusMessage("Authenticated successfully as counsellor. You can now analyze reflections.");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Sign-in failed. Please check credentials.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  // Retrieve incoming student-portal handoff (?handoff=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const handoffId = urlParams.get("handoff");
    const dest = urlParams.get("dest");
    if (!handoffId) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("handoff");
    url.searchParams.delete("dest");
    window.history.replaceState(null, "", url.pathname);

    fetch(`/api/c4-handoff?handoffId=${encodeURIComponent(handoffId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !data.text) return;
        setText(data.text);
        setLanguage(data.language || "English");
        setSubmittedText(data.text);
        setSubmittedLanguage(data.language || "English");
        if (data.prediction) {
          setPrediction(data.prediction);
          const target = data.targetClass || (data.prediction.predicted_sentiment as "Negative" | "Neutral" | "Positive") || "Negative";
          setSelectedSentimentClass(target);
          const snapshot: DevelopmentInputData = Object.freeze({
            id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            text: data.text,
            language: data.language || "English",
            prediction: data.prediction,
            targetClass: target,
            modelVersion: data.prediction.model_version,
            submittedAt: Date.now(),
          });
          setDevInput(snapshot);
          if (dest === "lime") router.push("/lime");
          else if (dest === "shap") router.push("/shap");
          else if (dest === "counterfactuals") router.push("/counterfactuals");
        }
      })
      .catch(() => {});
  }, [router, setDevInput, setSelectedSentimentClass]);

  const isOutdated =
    submittedText !== null &&
    (text.trim() !== submittedText || language !== submittedLanguage);

  function handleSelectSample(sample: (typeof SAMPLE_INPUTS)[0]) {
    setText(sample.text);
    setLanguage(sample.language);
    setErrorMessage("");
  }

  function handleClear() {
    setText("");
    setSubmittedText(null);
    setSubmittedLanguage(null);
    setPrediction(null);
    setErrorMessage("");
    setStatusMessage("");
    setDevInput(null);
  }

  async function handleAnalyse(event?: FormEvent) {
    if (event) event.preventDefault();

    const trimmed = text.trim();
    if (!trimmed) {
      setErrorMessage("Input text cannot be empty or contain only whitespace.");
      return;
    }

    if (trimmed.length > MAX_CHAR_LIMIT) {
      setErrorMessage(`Input exceeds maximum allowed limit of ${MAX_CHAR_LIMIT.toLocaleString()} characters.`);
      return;
    }

    setErrorMessage("");
    setStatusMessage("");
    setIsAnalysing(true);

    try {
      const response = await fetch("/api/c4-predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          language,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as C4PredictionResponse;
        setSubmittedText(trimmed);
        setSubmittedLanguage(language);
        setPrediction(data);
        setStatusMessage("Prediction completed successfully. Explanations are now enabled.");

        const target = (data.predicted_sentiment as "Negative" | "Neutral" | "Positive") || "Negative";
        setSelectedSentimentClass(target);

        // Store an immutable snapshot in shared context
        const snapshot: DevelopmentInputData = Object.freeze({
          id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          text: trimmed,
          language,
          prediction: data,
          targetClass: target,
          modelVersion: data.model_version,
          submittedAt: Date.now(),
        });
        setDevInput(snapshot);
      } else {
        const errJson = await response.json().catch(() => ({}));
        if (response.status === 401) {
          setErrorMessage(
            "Authentication required (HTTP 401). Please sign in via the Overview page with your synthetic counsellor credentials."
          );
        } else {
          setErrorMessage(errJson.error || errJson.message || `Prediction failed with status ${response.status}`);
        }
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Could not connect to sentiment classifier service."
      );
    } finally {
      setIsAnalysing(false);
    }
  }

  function handleSelectTargetClass(cls: "Negative" | "Neutral" | "Positive") {
    setSelectedSentimentClass(cls);
  }

  function handleOpenLime() {
    if (!devInput || !devInput.text) return;
    router.push("/lime");
  }

  function handleOpenShap() {
    if (!devInput || !devInput.text) return;
    router.push("/shap");
  }

  function handleOpenCounterfactuals() {
    if (!devInput || !devInput.text) return;
    router.push("/counterfactuals");
  }

  return (
    <div className="lime-page-container">
      <Sidebar isClassifierConnected={authorized} />

      <main className="lime-main" id="content">
        {/* Header Block */}
        <header className="lime-header">
          <div className="lime-header-title-block">
            <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 600, color: "#6366f1", letterSpacing: "0.5px", textTransform: "uppercase" }}>
              Component 4 · Explainable AI
            </p>
            <h1 className="lime-main-title" style={{ fontSize: "22px", margin: 0 }}>
              C4 Explanation Development
            </h1>
            <p className="lime-main-subtitle" style={{ marginTop: "4px" }}>
              Screening Support · Non-Diagnostic Research Environment
            </p>
          </div>

          <div className="lime-header-actions">
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={handleOpenLime}
                disabled={!devInput || !devInput.text}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: devInput && devInput.text ? "#6366f1" : "#e2e8f0",
                  color: devInput && devInput.text ? "#ffffff" : "#94a3b8",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: devInput && devInput.text ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                <span>Open LIME →</span>
              </button>
              <button
                type="button"
                onClick={handleOpenShap}
                disabled={!devInput || !devInput.text}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: devInput && devInput.text ? "#4f46e5" : "#e2e8f0",
                  color: devInput && devInput.text ? "#ffffff" : "#94a3b8",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: devInput && devInput.text ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                <span>Open SHAP →</span>
              </button>
            </div>
          </div>
        </header>

        {/* Persistent Development Notice Banner */}
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fef3c7",
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "12px",
            color: "#92400e",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 700, background: "#fef3c7", padding: "2px 6px", borderRadius: "4px", fontSize: "11px" }}>
              C4 development — fictional text only
            </span>
            <span>Fictional test text only. Do not enter personal or student information.</span>
          </div>
          <Link href="/" style={{ color: "#b45309", fontSize: "11.5px", textDecoration: "underline", fontWeight: 600 }}>
            Return to Overview
          </Link>
        </div>

        {/* Mandatory Screening Notice */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "11.5px",
            color: "#475569",
            marginBottom: "16px",
            lineHeight: 1.45,
          }}
        >
          <strong>Screening Support Notice:</strong> This system supports wellbeing screening and counsellor-assisted review. It does not provide a diagnosis or replace professional counselling.
        </div>

        {/* Sign-In Card when Unauthenticated */}
        {!checking && !authorized && (
          <div
            style={{
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              borderRadius: "10px",
              padding: "16px 20px",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: 700, background: "#fecdd3", color: "#9f1239", padding: "2px 8px", borderRadius: "4px", fontSize: "11px" }}>
                    Sign-in Required
                  </span>
                  <strong style={{ fontSize: "14px", color: "#9f1239" }}>
                    Counsellor Authentication Required
                  </strong>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: "12.5px", color: "#881337" }}>
                  Prediction and XAI explanations require an authorized counsellor session. Sign in below using your local development credentials from <code>.env</code>.
                </p>
              </div>
              <Link
                href="/"
                style={{
                  color: "#e11d48",
                  fontSize: "12px",
                  fontWeight: 600,
                  textDecoration: "underline",
                }}
              >
                Go to Overview →
              </Link>
            </div>

            <form onSubmit={handleInlineLogin} style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 240px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  Username (DEV_COUNSELLOR_USERNAME)
                </label>
                <input
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Paste dev counsellor username"
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    background: "#ffffff",
                    color: "#0f172a",
                  }}
                />
              </div>

              <div style={{ flex: "1 1 240px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  Password (DEV_COUNSELLOR_PASSWORD)
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Paste dev counsellor password"
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    background: "#ffffff",
                    color: "#0f172a",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                style={{
                  padding: "7px 18px",
                  borderRadius: "6px",
                  border: "none",
                  background: isLoggingIn ? "#94a3b8" : "#e11d48",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: isLoggingIn ? "not-allowed" : "pointer",
                  height: "33px",
                  whiteSpace: "nowrap",
                }}
              >
                {isLoggingIn ? "Signing In…" : "Sign In & Authorize"}
              </button>
            </form>

            {loginError && (
              <div style={{ marginTop: "10px", color: "#b91c1c", fontSize: "12px", fontWeight: 500 }}>
                ⚠️ {loginError}
              </div>
            )}
          </div>
        )}

        {/* Errors / Status Alerts */}
        {errorMessage && (
          <div
            role="alert"
            style={{
              background: "#fef2f2",
              border: "1px solid #fee2e2",
              color: "#991b1b",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "12px",
              marginBottom: "14px",
            }}
          >
            {errorMessage}
          </div>
        )}

        {statusMessage && (
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #dcfce7",
              color: "#166534",
              borderRadius: "8px",
              padding: "8px 14px",
              fontSize: "12px",
              marginBottom: "14px",
            }}
          >
            {statusMessage}
          </div>
        )}

        {/* MAIN TWO-COLUMN WORKFLOW GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "16px" }}>
          {/* LEFT COLUMN: Input form & sample buttons */}
          <div className="lime-card">
            <div className="lime-card-header">
              <div className="lime-card-title-group">
                <svg className="lime-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <h3 className="lime-card-title">Fictional Reflection Input</h3>
              </div>
              <span style={{ fontSize: "11px", color: text.length > MAX_CHAR_LIMIT ? "#ef4444" : "#64748b", fontWeight: 600 }}>
                {text.length.toLocaleString()} / 2,000 characters
              </span>
            </div>

            {/* Fictional Sample Loaders */}
            <div style={{ marginBottom: "12px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", display: "block", marginBottom: "6px" }}>
                Load Fictional Test Samples (No Personal Information):
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {SAMPLE_INPUTS.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => handleSelectSample(sample)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#334155",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea Form */}
            <form onSubmit={handleAnalyse}>
              <div style={{ marginBottom: "12px" }}>
                <label htmlFor="test-reflection-textarea" style={{ display: "none" }}>
                  Test reflection text
                </label>
                <textarea
                  id="test-reflection-textarea"
                  aria-label="Test reflection text"
                  rows={8}
                  maxLength={MAX_CHAR_LIMIT}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (errorMessage) setErrorMessage("");
                  }}
                  placeholder="Enter fictional academic reflection text in English, Sinhala, Romanized Sinhala or Code-mixed..."
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    lineHeight: 1.5,
                    resize: "vertical",
                    outline: "none",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "10.5px", color: "#64748b" }}>
                  <span>Enforced development limit: 2,000 characters maximum</span>
                  <span style={{ color: text.length > MAX_CHAR_LIMIT ? "#ef4444" : "#64748b" }}>
                    {text.length} / 2,000 characters
                  </span>
                </div>
              </div>

              {/* Language Selector */}
              <div style={{ marginBottom: "16px", padding: "10px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                <label
                  htmlFor="test-language-select"
                  style={{ fontSize: "11.5px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "4px" }}
                >
                  Test language — manually selected
                </label>
                <select
                  id="test-language-select"
                  aria-label="Test language — manually selected"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    background: "#ffffff",
                    color: "#1e293b",
                  }}
                >
                  <option value="English">English</option>
                  <option value="Sinhala">Sinhala</option>
                  <option value="Romanized Sinhala">Romanized Sinhala</option>
                  <option value="Code-mixed">Code-mixed</option>
                </select>
                <p style={{ margin: "4px 0 0", fontSize: "10px", color: "#64748b", lineHeight: 1.35 }}>
                  Manual selection only. Automated language detection is not implemented or claimed. Support for entering these text forms does not establish underlying model support.
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="submit"
                  aria-label="Analyse (Prepare test input)"
                  disabled={isAnalysing}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: isAnalysing ? "#94a3b8" : "#6366f1",
                    color: "#ffffff",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: isAnalysing ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "background 0.15s ease",
                  }}
                >
                  {isAnalysing ? "Analysing sentiment..." : "Analyse"}
                </button>

                <button
                  type="button"
                  onClick={handleClear}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
              </div>
            </form>
          </div>

          {/* RIGHT COLUMN: Submitted text state & prediction results */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Prediction Card */}
            <div className="lime-card">
              <div className="lime-card-header">
                <div className="lime-card-title-group">
                  <svg className="lime-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <h3 className="lime-card-title">Sentiment Prediction</h3>
                </div>
                <span style={{ fontSize: "10px", color: "#6366f1", fontWeight: 600 }}>
                  Temporary sentiment model — C4 development
                </span>
              </div>

              {prediction ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", background: "#f8fafc", padding: "10px 12px", borderRadius: "8px" }}>
                    <div>
                      <span style={{ fontSize: "10.5px", color: "#64748b", display: "block" }}>Predicted Sentiment:</span>
                      <strong
                        style={{
                          fontSize: "18px",
                          color:
                            prediction.predicted_sentiment === "Negative"
                              ? "#ef4444"
                              : prediction.predicted_sentiment === "Positive"
                              ? "#16a34a"
                              : "#3b82f6",
                        }}
                      >
                        {prediction.predicted_sentiment}
                      </strong>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b", display: "block" }}>
                        {Math.round(prediction.confidence * 100)}%
                      </span>
                      <span style={{ fontSize: "10px", color: "#64748b" }}>Confidence</span>
                    </div>
                  </div>

                  {/* Probabilities Distribution */}
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px", fontWeight: 600 }}>
                      <span style={{ color: "#ef4444" }}>Negative: {Math.round((prediction.probabilities["Negative"] ?? 0) * 100)}%</span>
                      <span style={{ color: "#3b82f6" }}>Neutral: {Math.round((prediction.probabilities["Neutral"] ?? 0) * 100)}%</span>
                      <span style={{ color: "#16a34a" }}>Positive: {Math.round((prediction.probabilities["Positive"] ?? 0) * 100)}%</span>
                    </div>
                    <div style={{ height: "8px", width: "100%", background: "#f1f5f9", borderRadius: "999px", overflow: "hidden", display: "flex" }}>
                      <div style={{ width: `${Math.round((prediction.probabilities["Negative"] ?? 0) * 100)}%`, background: "#ef4444" }}></div>
                      <div style={{ width: `${Math.round((prediction.probabilities["Neutral"] ?? 0) * 100)}%`, background: "#93c5fd" }}></div>
                      <div style={{ width: `${Math.round((prediction.probabilities["Positive"] ?? 0) * 100)}%`, background: "#16a34a" }}></div>
                    </div>
                  </div>

                  <div style={{ fontSize: "10.5px", color: "#64748b", borderTop: "1px solid #f1f5f9", paddingTop: "8px", display: "flex", justifyContent: "space-between" }}>
                    <span>Tokens: <strong>{prediction.token_count}</strong> {prediction.truncated ? "(Truncated >512)" : "(≤512)"}</span>
                    <span>Model: <strong>twitter-xlm-roberta-base-sentiment</strong></span>
                  </div>

                  {/* Target Class Selector for LIME and SHAP */}
                  <div style={{ marginTop: "10px", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                      Target Class to Explain (shared with LIME and SHAP):
                    </span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {(["Negative", "Neutral", "Positive"] as const).map((cls) => (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => handleSelectTargetClass(cls)}
                          style={{
                            flex: 1,
                            padding: "4px 6px",
                            fontSize: "11px",
                            fontWeight: 600,
                            borderRadius: "5px",
                            border: (devInput?.targetClass || selectedSentimentClass) === cls ? "1.5px solid #4f46e5" : "1px solid #cbd5e1",
                            background: (devInput?.targetClass || selectedSentimentClass) === cls ? "#eef2ff" : "#ffffff",
                            color: (devInput?.targetClass || selectedSentimentClass) === cls ? "#4338ca" : "#475569",
                            cursor: "pointer",
                          }}
                        >
                          {cls}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Explanations Action Row */}
                  <div style={{ marginTop: "14px", borderTop: "1px solid #f1f5f9", paddingTop: "12px", display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={handleOpenLime}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: "7px",
                        border: "none",
                        background: "#6366f1",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Open LIME Explanation →
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenShap}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: "7px",
                        border: "none",
                        background: "#4f46e5",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Open SHAP Explanation →
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenCounterfactuals}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: "7px",
                        border: "none",
                        background: "#0d9488",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Open Counterfactuals →
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "24px 12px", textAlign: "center" }}>
                  <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 6px" }}>
                    No test input analyzed yet.
                  </p>
                  <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0 }}>
                    Enter or select sample reflection text and click &ldquo;Analyse&rdquo; to evaluate sentiment probabilities.
                  </p>
                </div>
              )}
            </div>

            {/* Submitted Text Separate Preview Card */}
            <div className="lime-card">
              <div className="lime-card-header">
                <div className="lime-card-title-group">
                  <svg className="lime-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <h3 className="lime-card-title">Submitted Reflection (Read-Only)</h3>
                </div>
                {isOutdated ? (
                  <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#b45309", background: "#fef3c7", padding: "2px 8px", borderRadius: "4px" }}>
                    Outdated (modified after preparation)
                  </span>
                ) : submittedText ? (
                  <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#166534", background: "#dcfce7", padding: "2px 8px", borderRadius: "4px" }}>
                    Input prepared
                  </span>
                ) : null}
              </div>

              {isOutdated && (
                <div
                  style={{
                    background: "#fffbeb",
                    border: "1px solid #fef3c7",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    fontSize: "11px",
                    color: "#92400e",
                    marginBottom: "10px",
                  }}
                >
                  <strong>Preview is outdated:</strong> Input text or language was modified since last preparation. Click Analyse to update predictions.
                </div>
              )}

              {submittedText ? (
                <div>
                  <pre
                    className="c4-preview-text"
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      background: "#f8fafc",
                      border: "1px solid #f1f5f9",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "#1e293b",
                      margin: "0 0 8px",
                      maxHeight: "160px",
                      overflowY: "auto",
                      fontFamily: "inherit",
                    }}
                  >
                    {submittedText}
                  </pre>
                  <div style={{ fontSize: "11px", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                    <span>Language: <strong>{submittedLanguage}</strong></span>
                    <span>Explaining Sentiment: <strong>{prediction?.predicted_sentiment || "Negative"}</strong></span>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: "11.5px", color: "#94a3b8", fontStyle: "italic", margin: 0 }}>
                  No test input prepared yet. Enter or select sample text and click &ldquo;Prepare test input&rdquo;.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function C4DevInputPage() {
  return (
    <React.Suspense fallback={<div className="lime-page-container" style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading C4 Development Input...</div>}>
      <C4DevInputContent />
    </React.Suspense>
  );
}

