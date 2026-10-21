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
        <div className="cf-text-box">
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
      <div className="cf-text-box">
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
          Probability Shift Comparison (Before vs. After Perturbation)
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
        {/* Header Block */}
        <header className="cf-header">
          <div className="cf-header-title-block">
            <p
              style={{
                margin: "0 0 4px",
                fontSize: "11px",
                fontWeight: 600,
                color: "#6366f1",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              Component 4 · Explainable AI
            </p>
            <h1 className="cf-main-title">Counterfactual Explanations</h1>
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>{caseLanguage}</span>
            </div>

            {/* Counsellor Profile Pill */}
            <div className="cf-header-pill">
              <div className="cf-user-avatar-circle">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

        {/* Top 3 Context & Baseline Cards */}
        <div className="cf-top-grid">
          {/* Card 1: Input Reflection */}
          <div className="cf-top-card">
            <div className="cf-top-card-header">
              <h2 className="cf-top-card-title">
                <span>📝</span>
                <span>Input Reflection</span>
              </h2>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#4338ca",
                  background: "#e0e7ff",
                  padding: "2px 8px",
                  borderRadius: "4px",
                }}
              >
                {caseLanguage}
              </span>
            </div>

            {submissionText ? (
              <>
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "12.5px",
                    lineHeight: "1.5",
                    color: "#1e293b",
                    maxHeight: "120px",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    flex: 1,
                  }}
                >
                  {submissionText}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "10px",
                    fontSize: "11px",
                    color: "#64748b",
                  }}
                >
                  <span>
                    {submissionText.trim().split(/\s+/).length} words · {submissionText.length} chars
                  </span>
                  <span style={{ fontWeight: 600, color: "#475569" }}>
                    {snapshot ? "Development Input" : "Assigned Case"}
                  </span>
                </div>
              </>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "16px 12px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px dashed #cbd5e1",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                  No reflection active
                </p>
                <p style={{ margin: "0 0 12px", fontSize: "11.5px", color: "#64748b", maxWidth: "260px" }}>
                  Load a synthetic student reflection to explore minimal counterfactual edits, or enter your own narrative on Development Input.
                </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={handleLoadDefaultSample}
                    style={{
                      padding: "6px 12px",
                      background: "#4f46e5",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span>⚡</span>
                    <span>Load Sample Reflection</span>
                  </button>
                  <Link
                    href="/c4-dev-input"
                    style={{
                      padding: "6px 12px",
                      background: "#ffffff",
                      color: "#4338ca",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Custom Input →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Model Prediction (Baseline) */}
          <div className="cf-top-card">
            <div className="cf-top-card-header">
              <h2 className="cf-top-card-title">
                <span>🎯</span>
                <span>Original Prediction (Baseline)</span>
              </h2>
              <span style={{ fontSize: "10.5px", color: "#64748b", fontFamily: "monospace" }}>
                xlm-roberta
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: SENTIMENT_COLORS[baselineClass] || "#0f172a",
                  }}
                >
                  {baselineClass}
                </span>
                <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748b" }}>
                  ({(baselineConfidence * 100).toFixed(1)}% confidence)
                </span>
              </div>
              <span
                style={{
                  fontSize: "10.5px",
                  background: "#f1f5f9",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  color: "#475569",
                  fontWeight: 600,
                }}
              >
                Original Class
              </span>
            </div>

            <div style={{ marginTop: "4px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              {(["Negative", "Neutral", "Positive"] as const).map((cls) => {
                const prob = baselineProbs[cls] ?? 0;
                return (
                  <div
                    key={cls}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "11px",
                      marginBottom: "6px",
                    }}
                  >
                    <span style={{ width: "52px", color: "#475569", fontWeight: 500 }}>{cls}:</span>
                    <div
                      style={{
                        flex: 1,
                        background: "#f1f5f9",
                        height: "6px",
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.round(prob * 100)}%`,
                          background: SENTIMENT_COLORS[cls] || "#6366f1",
                          height: "100%",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        width: "36px",
                        textAlign: "right",
                        color: "#64748b",
                        fontFamily: "monospace",
                      }}
                    >
                      {(prob * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: Counterfactual Target & Limits */}
          <div className="cf-top-card">
            <div className="cf-top-card-header">
              <h2 className="cf-top-card-title">
                <span>🔄</span>
                <span>Counterfactual Objective</span>
              </h2>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: SENTIMENT_COLORS[targetClass] || "#6366f1",
                  background: `${SENTIMENT_COLORS[targetClass] || "#6366f1"}15`,
                  padding: "2px 8px",
                  borderRadius: "4px",
                }}
              >
                Target: {targetClass}
              </span>
            </div>

            <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#334155", lineHeight: "1.45" }}>
              Perturb reflection tokens to flip the verified classifier decision from{" "}
              <strong>{baselineClass}</strong> to <strong>{targetClass}</strong>.
            </p>

            <div
              style={{
                background: "#f8fafc",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #f1f5f9",
                fontSize: "11px",
                color: "#64748b",
                marginTop: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                <span>Max Edits:</span>
                <strong style={{ color: "#0f172a" }}>2 (Deletions / Synonyms)</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                <span>Search Budget:</span>
                <strong style={{ color: "#0f172a" }}>50 candidates</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Minimality:</span>
                <strong style={{ color: "#0f172a" }}>Fewest edits, then target prob</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Mandatory Screening & Non-Diagnostic Notice */}
        <section className="cf-notice-box" aria-label="Non-diagnostic safety notice">
          <div className="cf-notice-title">
            <span>🛡️</span>
            <span>Non-Diagnostic Wellbeing Decision Support</span>
          </div>
          <div>
            Counterfactual examples illustrate local decision boundaries and sensitivity of the sentiment classifier.
            Outputs represent model behaviour examples requiring authorized counsellor interpretation, and must{" "}
            <strong>never</strong> be interpreted as advice or recommendations for altering a student&apos;s personal wellbeing or life circumstances.
          </div>
        </section>

        {/* Error and Status Banners */}
        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              borderRadius: "8px",
              color: "#9f1239",
              fontSize: "13px",
              marginBottom: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
            role="alert"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              style={{ background: "none", border: "none", color: "#9f1239", cursor: "pointer", fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
        )}

        {statusMessage && (
          <div
            style={{
              padding: "10px 16px",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "8px",
              color: "#065f46",
              fontSize: "12.5px",
              marginBottom: "16px",
            }}
            role="status"
          >
            {statusMessage}
          </div>
        )}

        {/* Control Toolbar */}
        <section className="cf-toolbar" aria-label="Counterfactual Search Controls">
          <div className="cf-toolbar-left">
            <span className="cf-toolbar-label">Target Class:</span>
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

            <div style={{ fontSize: "12px", color: "#64748b", marginLeft: "8px" }}>
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
                <span
                  style={{
                    display: "inline-block",
                    width: "12px",
                    height: "12px",
                    border: "2px solid #ffffff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <span>Searching Bounded Space…</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Generate Counterfactuals</span>
              </>
            )}
          </button>
        </section>

        {/* Empty State: No Input Text */}
        {!submissionText && (
          <div className="cf-state-card" role="status">
            <h3 className="cf-state-title">No Input Text Selected</h3>
            <p className="cf-state-desc">
              Please select an assigned case from the selector above or navigate to{" "}
              <Link href="/c4-dev-input" style={{ color: "#6366f1", textDecoration: "underline" }}>
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
                border: "3px solid #6366f1",
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
              style={{
                background: result.outcome === "SUCCESS" ? "#f0fdf4" : result.outcome === "ALREADY_TARGET_CLASS" ? "#eff6ff" : "#fffbeb",
                border: `1px solid ${result.outcome === "SUCCESS" ? "#bbf7d0" : result.outcome === "ALREADY_TARGET_CLASS" ? "#bfdbfe" : "#fef3c7"}`,
                borderRadius: "10px",
                padding: "16px 20px",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <strong
                      style={{
                        fontSize: "14px",
                        color: result.outcome === "SUCCESS" ? "#166534" : result.outcome === "ALREADY_TARGET_CLASS" ? "#1e40af" : "#92400e",
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
                  <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", margin: 0 }}>
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
                      className={`cf-card ${isBest ? "cf-card-best" : ""}`}
                      aria-label={`Counterfactual Candidate ${cand.minimality_rank}`}
                    >
                      {/* Card Header */}
                      <div className="cf-card-header">
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
                      <div className="cf-card-body">
                        {/* Changed Text Display with Spans */}
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                          Perturbed Reflection Narrative:
                        </div>
                        {renderCandidateText(cand)}

                        {/* Edit Operations List */}
                        {cand.edits && cand.edits.length > 0 && (
                          <div style={{ marginTop: "12px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                              Edit Operations ({cand.edits.length}):
                            </div>
                            <div className="cf-operations-list">
                              {cand.edits.map((op, opIdx) => (
                                <span
                                  key={opIdx}
                                  className={`cf-op-badge ${op.op === "delete" ? "cf-op-delete" : "cf-op-replace"}`}
                                >
                                  <strong>{op.op.toUpperCase()}:</strong>
                                  {op.op === "delete" ? (
                                    <span>&ldquo;{op.original}&rdquo;</span>
                                  ) : (
                                    <span>
                                      &ldquo;{op.original}&rdquo; → &ldquo;{op.replacement}&rdquo;
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

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

                        {/* Probability Comparison Recharts Chart */}
                        {renderProbabilityComparison(cand)}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
