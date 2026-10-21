"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { Sidebar } from "../components/Sidebar";
import { useReviewCase } from "../context/CaseContext";
import { api, ApiError } from "@j26/common/api";
import type {
  C4CounterfactualRequest,
  C4CounterfactualResponse,
  CounterfactualCandidate,
} from "@j26/common/contracts";

const SENTIMENT_COLORS: Record<string, string> = {
  Negative: "#ef4444",
  Neutral: "#3b82f6",
  Positive: "#16a34a",
};

export default function CounterfactualsPage() {
  const {
    authorized,
    checking,
    selectedTask,
    selectedTaskId,
    selectedSentimentClass,
    setSelectedSentimentClass,
    devInput,
    setDevInput,
  } = useReviewCase();

  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [result, setResult] = useState<C4CounterfactualResponse | null>(null);
  const [restoredTextUnavailable, setRestoredTextUnavailable] = useState(false);
  const [isClassifierConnected, setIsClassifierConnected] = useState(true);

  // Active request ref to ignore late responses
  const activeRequestRef = useRef(0);
  const isRestoringRef = useRef(false);
  const restoredIdRef = useRef<string | null>(null);

  // Read original submission text from shared context (devInput or selected review task)
  const snapshot = devInput && devInput.text ? devInput : null;
  const submissionText = snapshot
    ? snapshot.text
    : selectedTask?.preprocessing?.anonymized_text || null;
  const caseLanguage = snapshot
    ? snapshot.language || "English"
    : selectedTask?.preprocessing?.language || "English";

  const baselineClass =
    (snapshot?.prediction?.predicted_sentiment as "Negative" | "Neutral" | "Positive") ||
    (result?.original_predicted_class as "Negative" | "Neutral" | "Positive") ||
    "Negative";

  const baselineConfidence =
    snapshot?.prediction?.confidence ??
    (result?.original_probabilities ? result.original_probabilities[baselineClass] : 0.767);

  const baselineProbs: Record<string, number> =
    snapshot?.prediction?.probabilities ||
    result?.original_probabilities ||
    { Negative: 0.767, Neutral: 0.177, Positive: 0.056 };

  // Target class selection
  const [targetClass, setTargetClass] = useState<"Negative" | "Neutral" | "Positive">(
    selectedSentimentClass || "Neutral"
  );

  const handleLoadDefaultSample = () => {
    const defaultSnapshot = Object.freeze({
      id: `snap_${Date.now()}_default`,
      text: "I have three assignments due this week and the final examination starts next Monday. I cannot sleep and I feel completely overwhelmed by the workload.",
      language: "English",
      prediction: {
        model_id: "cardiffnlp/twitter-xlm-roberta-base-sentiment",
        model_version: "1.0.0",
        predicted_sentiment: "Negative" as const,
        confidence: 0.767,
        probabilities: { Negative: 0.767, Neutral: 0.177, Positive: 0.056 },
        token_count: 24,
        truncated: false,
        max_sequence_length: 512,
        status: "READY" as const,
      },
      targetClass: "Positive" as const,
      submittedAt: Date.now(),
    });
    setDevInput(defaultSnapshot);
    setTargetClass("Positive");
    setSelectedSentimentClass("Positive");
  };

  // Track previous inputs to clear stale results
  const prevSubmissionTextRef = useRef<string | null>(submissionText);
  const prevTargetClassRef = useRef<string>(targetClass);

  // Clear stale results when input text or target class changes
  useEffect(() => {
    if (isRestoringRef.current) return;
    if (
      prevSubmissionTextRef.current !== submissionText ||
      prevTargetClassRef.current !== targetClass
    ) {
      prevSubmissionTextRef.current = submissionText;
      prevTargetClassRef.current = targetClass;
      setResult(null);
      setError("");
      setStatusMessage("");
      setRestoredTextUnavailable(false);
      // Invalidate in-flight requests
      activeRequestRef.current++;
    }
  }, [submissionText, targetClass]);

  // Restore saved counterfactual by record ID (?id=...) once auth is ready
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (checking || !authorized) return;

    const urlParams = new URLSearchParams(window.location.search);
    const savedId = urlParams.get("id");
    if (!savedId || savedId === restoredIdRef.current) return;

    let mounted = true;
    isRestoringRef.current = true;
    const currentReqId = ++activeRequestRef.current;
    setIsBusy(true);

    api<C4CounterfactualResponse>(`/c4/counterfactuals/${savedId}`)
      .then((data) => {
        if (!mounted || currentReqId !== activeRequestRef.current) return;
        restoredIdRef.current = savedId;
        setResult(data);
        if (data.target_class === "Negative" || data.target_class === "Neutral" || data.target_class === "Positive") {
          setTargetClass(data.target_class);
        }

        // Check if original source text is present in active context
        if (!submissionText) {
          setRestoredTextUnavailable(true);
        }
        setStatusMessage("Saved counterfactual explanation record restored successfully.");
      })
      .catch((err) => {
        if (!mounted || currentReqId !== activeRequestRef.current) return;
        setError(
          err instanceof ApiError && err.status === 404
            ? "Saved counterfactual record not found or has expired under the retention policy."
            : "Could not restore the saved counterfactual explanation record."
        );
      })
      .finally(() => {
        if (mounted) {
          setIsBusy(false);
          isRestoringRef.current = false;
        }
      });

    return () => {
      mounted = false;
    };
  }, [checking, authorized, submissionText]);

  // Handle Generate Counterfactuals
  async function handleGenerate() {
    if (!submissionText || !submissionText.trim()) {
      setError("No submission text selected. Please select an assigned case or input reflection.");
      return;
    }

    setError("");
    setStatusMessage("");
    setIsBusy(true);
    const currentReqId = ++activeRequestRef.current;
    const idempotencyKey = crypto.randomUUID();

    try {
      const payload: C4CounterfactualRequest = {
        text: submissionText.trim(),
        target_class: targetClass,
        language: (caseLanguage as "English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") || "English",
        idempotency_key: idempotencyKey,
        source_reference: selectedTaskId || snapshot?.id || "development-input",
        max_edits: 2,
        max_candidates: 50,
      };

      const data = await api<C4CounterfactualResponse>("/c4/counterfactuals", payload);

      if (currentReqId !== activeRequestRef.current) {
        return; // Ignore late responses
      }

      setResult(data);
      setRestoredTextUnavailable(false);

      if (data.outcome === "UNAVAILABLE_MODEL") {
        setIsClassifierConnected(false);
        setError("Classifier service unavailable. Please ensure model service is connected.");
      } else {
        setIsClassifierConnected(true);
      }

      // Update URL with saved record ID
      if (data.counterfactual_id && typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("id", data.counterfactual_id);
        window.history.replaceState(null, "", url.pathname + url.search);
      }
    } catch (err) {
      if (currentReqId !== activeRequestRef.current) return;
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError("Your session has expired. Please log in again.");
        } else if (err.status === 403) {
          setError("Access forbidden. You do not have permissions to generate counterfactuals.");
        } else {
          setError("Failed to generate counterfactuals. Please check backend services.");
        }
      } else {
        setError("A connection error occurred while contacting the counterfactual service.");
      }
    } finally {
      if (currentReqId === activeRequestRef.current) {
        setIsBusy(false);
      }
    }
  }

  // Render diff spans for a candidate
  function renderCandidateText(candidate: CounterfactualCandidate) {
    if (restoredTextUnavailable && !candidate.candidate_text) {
      return (
        <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: "6px", border: "1px dashed #cbd5e1", fontSize: "12.5px", color: "#64748b" }}>
          <em>Complete candidate text is unavailable (retained only in transient memory under data protection rules). Verified edit operations and probability shifts are displayed below.</em>
        </div>
      );
    }

    if (candidate.diff_spans && candidate.diff_spans.length > 0) {
      return (
        <div className="cf-highlight-text-box">
          {candidate.diff_spans.map((span, idx) => {
            if (span.type === "deleted") {
              return (
                <span key={idx} className="cf-span-deleted" title={`Deleted: "${span.text}"`}>
                  {span.text}
                </span>
              );
            }
            if (span.type === "inserted") {
              return (
                <span key={idx} className="cf-span-inserted" title={`Inserted: "${span.text}"`}>
                  {span.text}
                </span>
              );
            }
            if (span.type === "replaced") {
              return (
                <span
                  key={idx}
                  className="cf-span-replaced"
                  title={`Replaced "${span.original_text || ""}" with "${span.text}"`}
                >
                  {span.text}
                </span>
              );
            }
            return (
              <span key={idx} className="cf-span-unchanged">
                {span.text}
              </span>
            );
          })}
        </div>
      );
    }

    return (
      <div className="cf-highlight-text-box">
        <span className="cf-span-unchanged">{candidate.candidate_text}</span>
      </div>
    );
  }

  // Render before & after probability comparison chart
  function renderProbabilityComparison(candidate: CounterfactualCandidate) {
    const origProbs = result?.original_probabilities || {};
    const candProbs = candidate.probabilities || {};

    const chartData = (["Negative", "Neutral", "Positive"] as const).map((cls) => ({
      sentiment: cls,
      "Original Prob (%)": Math.round((origProbs[cls] ?? 0) * 100),
      "Counterfactual Prob (%)": Math.round((candProbs[cls] ?? 0) * 100),
    }));

    return (
      <div className="cf-prob-comparison">
        <div className="cf-prob-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span>Probability Shift (Before vs. After Perturbation)</span>
        </div>
        <div style={{ width: "100%", height: "130px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              barGap={4}
              barCategoryGap="20%"
            >
              <XAxis dataKey="sentiment" tick={{ fontSize: 11, fill: "#475569", fontWeight: 600 }} />
              <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: "#64748b" }} width={42} />
              <Tooltip
                formatter={(val: unknown) => [`${val}%`, "Probability"]}
                contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "11px" }}
              />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }} />
              <Bar dataKey="Original Prob (%)" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Counterfactual Prob (%)" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="cf-page-container">
      <Sidebar isClassifierConnected={isClassifierConnected} />

      <main className="cf-main" id="content">
        {/* Top Header */}
        <header className="cf-header">
          <div className="cf-header-title-block">
            <h1 className="cf-main-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="m16 3 4 4-4 4" />
                <path d="M20 7H4" />
                <path d="m8 21-4-4 4-4" />
                <path d="M4 17h16" />
              </svg>
              <span>Counterfactual Explanations</span>
            </h1>
            <p className="cf-main-subtitle">
              Model-behaviour exploration identifying minimal token edits required to perturb the classifier&apos;s verified prediction.
            </p>
          </div>

          <div className="cf-header-actions">
            {snapshot ? (
              <div className="cf-header-pill" title="Active development submission">
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Source:</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#4f46e5" }}>
                  Development Input
                </span>
              </div>
            ) : selectedTask ? (
              <div className="cf-header-pill" title={`Case ID: ${selectedTask.case?.case_id || selectedTask.task_id}`}>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Case:</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                  {String(selectedTask.case?.case_id || selectedTask.task_id).slice(0, 8)}...
                </span>
              </div>
            ) : null}

            {/* Language Pill */}
            <div className="cf-header-pill" title="Language detected in submission">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4 10z" />
              </svg>
              <span>{caseLanguage}</span>
            </div>

            {/* Counsellor Profile Pill */}
            <div className="cf-header-pill">
              <div className="cf-user-avatar-circle">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="cf-user-text-info">
                <span className="cf-user-name">Counsellor</span>
                <span className="cf-user-role">Reviewer</span>
              </div>
            </div>
          </div>
        </header>

        {/* Screening Support Banner & Non-Diagnostic Notice */}
        <aside className="cf-notice" aria-label="Non-diagnostic boundary">
          <strong>Mandatory Practice Notice:</strong> Screening support only. Requires counsellor-assisted interpretation and does not replace professional counselling.
          <span style={{ display: "block", color: "#475569", marginTop: "3px", fontSize: "10.5px" }}>
            Model: Temporary sentiment model — C4 development (cardiffnlp/twitter-xlm-roberta-base-sentiment). Outputs represent model behaviour perturbations, not clinical recommendations. Does not claim validated Sinhala, Romanized Sinhala, or code-mixed diagnostic accuracy.
          </span>
        </aside>

        {/* Alerts */}
        {error && (
          <div className="cf-alert cf-alert-error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="cf-alert-close"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {statusMessage && (
          <div className="cf-alert cf-alert-success" role="status">
            {statusMessage}
          </div>
        )}

        {/* DASHBOARD GRID */}
        <div className="cf-grid">
          {/* ROW 1: Input Text | Model Prediction | Counterfactual Objective */}
          <div className="cf-row cf-row-3-cols">
            {/* Card 1: Input Text */}
            <div className="cf-card cf-card-input-text">
              <div className="cf-card-header">
                <div className="cf-card-title-group">
                  <svg className="cf-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <h3 className="cf-card-title">Input Text</h3>
                </div>
              </div>

              <div className="cf-input-box">
                {submissionText ? (
                  <p className="cf-input-line-1">{submissionText}</p>
                ) : (
                  <div role="status" style={{ padding: "12px 6px", textAlign: "center" }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>
                      No reflection narrative active
                    </p>
                    <p style={{ color: "#64748b", fontSize: "11.5px", margin: "0 0 10px", lineHeight: 1.45 }}>
                      Load a synthetic student reflection to explore minimal counterfactual edits, or enter your own narrative on Development Input.
                    </p>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={handleLoadDefaultSample}
                        className="cf-btn-primary-sm"
                      >
                        ⚡ Load Sample Reflection
                      </button>
                      <Link href="/c4-dev-input" className="cf-btn-secondary-sm">
                        Custom Input →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <div className="cf-input-meta-row">
                <span className="cf-meta-label">Detected Language:</span>
                <span className={caseLanguage === "Sinhala" ? "cf-meta-pill-sinhala" : "cf-meta-pill-english"}>
                  Language: {caseLanguage}
                </span>
              </div>

              <div className="cf-input-bottom-row">
                <span>
                  Words: <strong>{submissionText ? submissionText.trim().split(/\s+/).length : 0}</strong> · Chars: <strong>{submissionText ? submissionText.length : 0}</strong>
                </span>
                <span>
                  Target Class: <span className="cf-target-class-val" style={{ color: SENTIMENT_COLORS[targetClass] }}>{targetClass}</span>
                </span>
              </div>
            </div>

            {/* Card 2: Model Prediction */}
            <div className="cf-card cf-card-orig-prediction">
              <div className="cf-card-header">
                <div className="cf-card-title-group">
                  <svg className="cf-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4 10z" />
                  </svg>
                  <h3 className="cf-card-title">Model Prediction</h3>
                </div>
                <span style={{ fontSize: "9.5px", color: "#6366f1", fontWeight: 600 }}>Temporary sentiment model</span>
              </div>

              <div className="cf-prediction-main-row">
                <div>
                  <span style={{ fontSize: "10.5px", color: "#64748b", display: "block" }}>Predicted Sentiment:</span>
                  <div
                    className="cf-stress-label"
                    style={{
                      color:
                        baselineClass === "Negative"
                          ? "#ef4444"
                          : baselineClass === "Positive"
                          ? "#16a34a"
                          : "#3b82f6",
                    }}
                  >
                    {baselineClass}
                  </div>
                </div>
                <div className="cf-confidence-badge">
                  <span className="cf-score-percent">
                    {Math.round(baselineConfidence * 100)}%
                  </span>
                  <span className="cf-score-sublabel">Confidence</span>
                </div>
              </div>

              {/* Sentiment Probabilities Progress Bars */}
              <div className="cf-prob-section">
                {(["Negative", "Neutral", "Positive"] as const).map((cls) => {
                  const prob = baselineProbs[cls] ?? 0;
                  return (
                    <div key={cls} className="cf-prob-bar-row">
                      <span className="cf-prob-label">{cls}:</span>
                      <div className="cf-prob-track">
                        <div
                          className={`cf-prob-fill cf-prob-fill-${cls.toLowerCase()}`}
                          style={{
                            width: `${Math.round(prob * 100)}%`,
                            backgroundColor: SENTIMENT_COLORS[cls],
                          }}
                        />
                      </div>
                      <span className="cf-prob-val">{(prob * 100).toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: "10px", color: "#64748b", marginTop: "auto", borderTop: "1px solid #f1f5f9", paddingTop: "6px", display: "flex", justifyContent: "space-between" }}>
                <span>Model: <strong>twitter-xlm-roberta</strong></span>
                <span>Status: <strong style={{ color: "#16a34a" }}>READY</strong></span>
              </div>
            </div>

            {/* Card 3: Counterfactual Objective & Bounds */}
            <div className="cf-card cf-card-explanation-summary">
              <div className="cf-card-header">
                <div className="cf-card-title-group">
                  <svg className="cf-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  <h3 className="cf-card-title">Counterfactual Objective</h3>
                </div>
                <span
                  className="cf-strength-badge"
                  style={{
                    backgroundColor: `${SENTIMENT_COLORS[targetClass]}15`,
                    color: SENTIMENT_COLORS[targetClass],
                    borderColor: `${SENTIMENT_COLORS[targetClass]}30`,
                  }}
                >
                  Target: {targetClass}
                </span>
              </div>

              <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#334155", lineHeight: "1.45" }}>
                Find minimal token perturbations required to change predicted sentiment from <strong>{baselineClass}</strong> to <strong>{targetClass}</strong>.
              </p>

              <div className="cf-summary-legend-list">
                <div className="cf-legend-item-row">
                  <div className="cf-legend-left">
                    <span className="cf-dot cf-dot-red" />
                    <span>Max Perturbation Edits:</span>
                  </div>
                  <span className="cf-legend-item-val">2 (Deletions / Synonyms)</span>
                </div>

                <div className="cf-legend-item-row">
                  <div className="cf-legend-left">
                    <span className="cf-dot cf-dot-gray" />
                    <span>Search Budget:</span>
                  </div>
                  <span className="cf-legend-item-val">50 candidates</span>
                </div>

                <div className="cf-legend-item-row">
                  <div className="cf-legend-left">
                    <span className="cf-dot cf-dot-green" />
                    <span>Minimality Criterion:</span>
                  </div>
                  <span className="cf-legend-item-val">Fewest edits, target prob</span>
                </div>
              </div>

              <div className="cf-strength-row">
                <span className="cf-strength-label">Search Space:</span>
                <span className="cf-strength-badge">Bounded Local Search</span>
              </div>
            </div>
          </div>

          {/* ROW 2: Control Toolbar */}
          <div className="cf-card cf-toolbar-card">
            <div className="cf-toolbar-inner">
              <div className="cf-toolbar-left">
                <span className="cf-toolbar-label">Target Sentiment Class:</span>
                <div className="cf-target-button-group" role="radiogroup" aria-label="Target Class Selector">
                  {(["Negative", "Neutral", "Positive"] as const).map((cls) => {
                    const isActive = targetClass === cls;
                    return (
                      <button
                        key={cls}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        className={`cf-target-btn ${isActive ? `cf-target-btn-active-${cls}` : ""}`}
                        onClick={() => {
                          setTargetClass(cls);
                          setSelectedSentimentClass(cls);
                        }}
                        disabled={isBusy}
                      >
                        {cls}
                      </button>
                    );
                  })}
                </div>

                <div style={{ fontSize: "11.5px", color: "#64748b", marginLeft: "8px" }}>
                  Language rules: <strong>{caseLanguage}</strong>
                </div>
              </div>

              <button
                type="button"
                className="cf-generate-btn"
                onClick={handleGenerate}
                disabled={isBusy || !submissionText}
              >
                {isBusy ? (
                  <>
                    <span className="cf-spinner-sm" />
                    <span>Searching Bounded Space…</span>
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span>Generate Counterfactuals</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Empty State: No Input Text */}
          {!submissionText && (
            <div className="cf-state-card" role="status">
              <h3 className="cf-state-title">No Input Text Selected</h3>
              <p className="cf-state-desc">
                Please select an assigned case from the selector above or navigate to{" "}
                <Link href="/c4-dev-input" style={{ color: "#4f46e5", textDecoration: "underline" }}>
                  Development Input
                </Link>{" "}
                to prepare a fictional academic reflection.
              </p>
            </div>
          )}

          {/* Loading State */}
          {isBusy && (
            <div className="cf-state-card" role="status">
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  border: "3px solid #4f46e5",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  margin: "0 auto 12px auto",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <h3 className="cf-state-title">Evaluating Bounded Perturbations</h3>
              <p className="cf-state-desc">
                Generating token deletions and language-specific replacements, running batch inference through the
                shared classifier, and verifying predicted class outcomes…
              </p>
            </div>
          )}

          {/* Results Section */}
          {result && !isBusy && (
            <section aria-label="Counterfactual Results">
              {/* Outcome Overview Banner */}
              <div
                className={`cf-outcome-card ${
                  result.outcome === "SUCCESS"
                    ? "cf-outcome-success"
                    : result.outcome === "ALREADY_TARGET_CLASS"
                    ? "cf-outcome-info"
                    : "cf-outcome-warning"
                }`}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <strong
                      style={{
                        fontSize: "14px",
                        color:
                          result.outcome === "SUCCESS"
                            ? "#166534"
                            : result.outcome === "ALREADY_TARGET_CLASS"
                            ? "#1e40af"
                            : "#92400e",
                      }}
                    >
                      Outcome: {result.outcome}
                    </strong>
                    {result.outcome === "SUCCESS" && (
                      <span className="cf-verified-badge">✓ Verified Predicted Class Equals Target</span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#334155" }}>
                    {result.outcome_message}
                  </p>
                </div>

                <div style={{ fontSize: "11.5px", color: "#64748b", textAlign: "right" }}>
                  <div>Model: <strong>{result.model_id || "twitter-xlm-roberta-base-sentiment"}</strong></div>
                  {result.execution_time_ms && <div>Execution: {result.execution_time_ms}ms</div>}
                </div>
              </div>

              {/* Honest No Result Found State */}
              {result.outcome === "NO_COUNTERFACTUAL_FOUND" && (
                <div className="cf-state-card cf-state-no-result" role="status">
                  <h3 className="cf-state-title" style={{ color: "#92400e" }}>
                    No Counterfactual Found Within Search Bounds
                  </h3>
                  <p className="cf-state-desc" style={{ color: "#78350f" }}>
                    {result.outcome_message}
                  </p>
                  <div style={{ marginTop: "12px", fontSize: "12px", color: "#92400e" }}>
                    The classifier&apos;s decision boundary for this text is robust against bounded token deletions
                    and automatic dictionary replacements. No synthetic counterfactual has been fabricated.
                  </div>
                </div>
              )}

              {/* Candidate Cards */}
              {result.candidates && result.candidates.length > 0 && (
                <div className="cf-candidate-grid">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#1e293b", margin: 0 }}>
                      Verified Counterfactual Candidates ({result.candidates.length})
                    </h2>
                    <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                      Ranked by fewest edits, then target probability
                    </span>
                  </div>

                  {result.candidates.map((cand, idx) => {
                    const isBest = cand.minimality_rank === 1;
                    return (
                      <article
                        key={idx}
                        className={`cf-card cf-candidate-card ${isBest ? "cf-card-best" : ""}`}
                        aria-label={`Counterfactual Candidate ${cand.minimality_rank}`}
                      >
                        {/* Card Header */}
                        <div className="cf-candidate-header">
                          <div className="cf-card-title-group">
                            <span className={`cf-rank-badge ${isBest ? "cf-rank-badge-best" : ""}`}>
                              Rank #{cand.minimality_rank} {isBest ? "· Smallest Edit" : ""}
                            </span>
                            <span className="cf-minimality-tag">
                              {cand.minimality_description}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span className="cf-edit-count-badge">
                              {cand.edit_count} {cand.edit_count === 1 ? "edit" : "edits"}
                            </span>
                            <span className="cf-verified-badge">
                              Verified: {cand.predicted_class}
                            </span>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="cf-candidate-body">
                          {/* Changed Text Display with Spans */}
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                              Perturbed Reflection Narrative:
                            </div>
                            {renderCandidateText(cand)}
                          </div>

                          {/* Sub-split: Probability Chart & Operations Table */}
                          <div className="cf-sub-cards-split">
                            <div>{renderProbabilityComparison(cand)}</div>

                            <div>
                              <div className="cf-prob-header">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                <span>Edit Operations Breakdown ({cand.edits?.length || 0})</span>
                              </div>
                              <div className="cf-features-table-wrap">
                                <table className="cf-features-table">
                                  <thead>
                                    <tr>
                                      <th>Operation</th>
                                      <th>Original Token</th>
                                      <th>Replacement</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {cand.edits && cand.edits.length > 0 ? (
                                      cand.edits.map((op, opIdx) => (
                                        <tr
                                          key={opIdx}
                                          className={op.op === "delete" ? "cf-row-delete" : "cf-row-replace"}
                                        >
                                          <td>
                                            <span
                                              className={`cf-table-op-badge ${
                                                op.op === "delete" ? "cf-table-op-delete" : "cf-table-op-replace"
                                              }`}
                                            >
                                              {op.op}
                                            </span>
                                          </td>
                                          <td>
                                            <strong>&ldquo;{op.original}&rdquo;</strong>
                                          </td>
                                          <td>
                                            {op.op === "delete" ? (
                                              <span style={{ color: "#94a3b8" }}>— (deleted)</span>
                                            ) : (
                                              <strong style={{ color: "#4338ca" }}>&ldquo;{op.replacement}&rdquo;</strong>
                                            )}
                                          </td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan={3} style={{ textAlign: "center", color: "#64748b" }}>
                                          No explicit token edits recorded
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>

                          {/* Metrics Summary Row */}
                          <div className="cf-metrics-grid">
                            <div className="cf-metric-col">
                              <span className="cf-metric-title">Verified Prediction</span>
                              <span
                                className="cf-metric-val"
                                style={{ color: SENTIMENT_COLORS[cand.predicted_class] || "#0f172a" }}
                              >
                                {cand.predicted_class}
                              </span>
                            </div>

                            <div className="cf-metric-col">
                              <span className="cf-metric-title">Target Probability</span>
                              <span className="cf-metric-val">
                                {(cand.target_probability * 100).toFixed(1)}%
                              </span>
                            </div>

                            <div className="cf-metric-col">
                              <span className="cf-metric-title">Target Shift Delta</span>
                              <span
                                className={`cf-metric-val ${cand.target_probability_delta >= 0 ? "cf-metric-delta-pos" : "cf-metric-delta-neg"}`}
                              >
                                {cand.target_probability_delta >= 0 ? "+" : ""}
                                {(cand.target_probability_delta * 100).toFixed(1)}%
                              </span>
                            </div>

                            <div className="cf-metric-col">
                              <span className="cf-metric-title">Edit Distance</span>
                              <span className="cf-metric-val">
                                {cand.edit_count} {cand.edit_count === 1 ? "operation" : "operations"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ROW 3: How to Read Counterfactual Explanations */}
          <div className="cf-card cf-card-how-to">
            <div className="cf-card-header" style={{ marginBottom: 8 }}>
              <div className="cf-card-title-group">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                </svg>
                <h3 className="cf-card-title">How to Read Counterfactual Explanations</h3>
              </div>
            </div>

            <div className="cf-how-to-columns">
              <div className="cf-how-to-item">
                <div className="cf-how-to-icon cf-icon-green">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="cf-how-to-content">
                  <span className="cf-how-to-title">Minimal Edits (Green)</span>
                  <p className="cf-how-to-desc">
                    Highlighted tokens show the minimal word edits required to flip the sentiment decision to <strong>{targetClass}</strong>.
                  </p>
                </div>
              </div>

              <div className="cf-how-to-item">
                <div className="cf-how-to-icon cf-icon-red">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="cf-how-to-content">
                  <span className="cf-how-to-title">Decision Boundary Distance</span>
                  <p className="cf-how-to-desc">
                    Smaller edit distances (e.g. 1 edit) indicate the student reflection was positioned near the classifier&apos;s decision boundary.
                  </p>
                </div>
              </div>

              <div className="cf-how-to-item">
                <div className="cf-how-to-icon cf-icon-blue">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div className="cf-how-to-content">
                  <span className="cf-how-to-title">Non-Diagnostic Support</span>
                  <p className="cf-how-to-desc">
                    Counterfactuals illustrate NLP model behaviour for authorized counsellors, and are never recommendations for altering student wellbeing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
