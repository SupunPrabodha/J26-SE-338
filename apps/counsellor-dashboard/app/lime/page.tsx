"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Sidebar } from "../components/Sidebar";
import { RequireAuth } from "../components/RequireAuth";
import { useReviewCase } from "../context/CaseContext";
import { useC4Workspace, type SentimentClass } from "../context/C4WorkspaceContext";
import { SentimentProbabilityChart, LocalProbabilityChart } from "../components/SentimentProbabilityChart";
import { api } from "@j26/common/api";
import type { C4ExplanationResponse, C4PredictionResponse, FeatureContribution } from "@j26/common/contracts";

export default function LimePage() {
  const {
    authorized,
    checking,
    selectedTask,
    selectedTaskId,
    selectedSentimentClass,
    setSelectedSentimentClass,
    devInput,
  } = useReviewCase();

  const {
    lime,
    prediction: workspacePrediction,
    isPredicting: workspaceIsPredicting,
    isClassifierConnected: workspaceIsConnected,
    computeLime,
    restoreExplanation,
  } = useC4Workspace();

  const snapshot = devInput && devInput.text ? devInput : null;
  const submissionText = snapshot ? snapshot.text : (selectedTask?.preprocessing?.anonymized_text || null);
  const caseLanguage = snapshot ? (snapshot.language || "English") : (selectedTask?.preprocessing?.language || "English");
  const targetClass: SentimentClass = (selectedSentimentClass as SentimentClass) || (snapshot?.targetClass as SentimentClass) || "Negative";

  const explanation = lime.response;
  const isBusy = lime.status === "IN_FLIGHT";
  const error = lime.error;
  const statusMessage = lime.statusMessage;
  const prediction = workspacePrediction;
  const isPredicting = workspaceIsPredicting;
  const isClassifierConnected = workspaceIsConnected;

  const restoredIdRef = useRef<string | null>(null);

  // Restore saved explanation from URL parameter (?id=...) once auth is ready
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (checking || !authorized) return;

    const urlParams = new URLSearchParams(window.location.search);
    const savedId = urlParams.get("id");
    if (!savedId || savedId === restoredIdRef.current) return;

    restoredIdRef.current = savedId;
    void restoreExplanation(savedId, "LIME");
  }, [checking, authorized, restoreExplanation]);

  async function handleRunLime() {
    await computeLime(targetClass);
  }

  const hasResults = Boolean(
    explanation &&
      explanation.status === "READY" &&
      explanation.contributions &&
      explanation.contributions.length > 0
  );

  const contributions: FeatureContribution[] = explanation?.contributions || [];

  // Dynamic summary calculations
  const posWeights = contributions.filter((c) => c.weight > 0);
  const negWeights = contributions.filter((c) => c.weight < 0);
  const posSum = posWeights.reduce((acc, c) => acc + c.weight, 0);
  const negSum = negWeights.reduce((acc, c) => acc + Math.abs(c.weight), 0);
  const totalWeight = posSum + negSum;

  const posPct = totalWeight > 0 ? Math.round((posSum / totalWeight) * 100) : 0;
  const negPct = totalWeight > 0 ? Math.round((negSum / totalWeight) * 100) : 0;
  const neutralPct = Math.max(0, 100 - posPct - negPct);

  // Donut Gauge Calculations: radius 34, circumference = 213.63
  const circ = 2 * Math.PI * 34;
  const redDash = (posPct / 100) * circ;
  const greenDash = (negPct / 100) * circ;
  // Split contributions into positive and negative, ordered by impact
  const posContributions = contributions
    .filter((c) => c.weight >= 0)
    .sort((a, b) => b.weight - a.weight);

  const negContributions = contributions
    .filter((c) => c.weight < 0)
    .sort((a, b) => a.weight - b.weight);

  const displayContributions = [
    ...posContributions.slice(0, 5),
    ...negContributions.slice(0, 5),
  ];

  const maxAbsWeight = Math.max(
    ...displayContributions.map((c) => Math.abs(c.weight)),
    0.0001
  );

  const posLabel = targetClass === "Negative" ? "High Stress" : targetClass;
  const negLabel = targetClass === "Negative" ? "Low Stress" : `Opposes ${targetClass}`;

  const handleDownloadCsv = () => {
    if (!hasResults || contributions.length === 0) return;
    const headers = "Feature (Word/Phrase),Weight,Direction\n";
    const rows = contributions
      .map(
        (f) =>
          `"${f.token}","${(f.weight >= 0 ? "+" : "") + f.weight.toFixed(4)}","${
            f.direction === "supports" ? "Supports " + targetClass : "Opposes " + targetClass
          }"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `lime_attributions_${selectedTaskId || "case"}_${targetClass}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tokenCount = submissionText ? submissionText.trim().split(/\s+/).length : (explanation?.token_count ?? 0);
  const canCompute = Boolean(submissionText);

  // Explanation steps (matching prototype LIME workflow)
  const explanationSteps = [
    {
      num: 1,
      title: "Perturb Text",
      desc: "Generate local perturbed samples by masking word tokens from the input submission text.",
    },
    {
      num: 2,
      title: "Get Model Predictions",
      desc: `Obtain classification probabilities for "${targetClass}" across perturbed instances.`,
    },
    {
      num: 3,
      title: "Fit Local Surrogate",
      desc: "Train an interpretable sparse linear model weighted by distance to the original reflection.",
    },
    {
      num: 4,
      title: "Extract Explanations",
      desc: `Extract signed token weights to isolate specific vocabulary driving the "${targetClass}" prediction.`,
    },
  ];

  return (
    <RequireAuth workspace="research">
      <div className="lime-page-container">
        <Sidebar isClassifierConnected={isClassifierConnected} />

      <main className="lime-main" id="content">
        {/* Top Header */}
        <header className="lime-header">
          <div className="lime-header-title-block">
            <h1 className="lime-main-title">LIME Feature Attribution</h1>
            <p className="lime-main-subtitle">
              Local Interpretable Model-agnostic Explanations for individual sentiment prediction.
            </p>
          </div>

          <div className="lime-header-actions">
            {snapshot ? (
              <div className="lime-header-pill" title="Active development submission">
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Source:</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#4f46e5" }}>
                  Development Input
                </span>
              </div>
            ) : selectedTask ? (
              <div className="lime-header-pill" title={`Case ID: ${selectedTask.case?.case_id || selectedTask.task_id}`}>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Case:</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                  {String(selectedTask.case?.case_id || selectedTask.task_id).slice(0, 8)}...
                </span>
              </div>
            ) : null}

            {/* Language Pill (Read-only metadata from case) */}
            <div className="lime-header-pill" title="Language detected in submission">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>{caseLanguage}</span>
            </div>

            {/* Counsellor Profile Pill */}
            <div className="lime-header-pill">
              <div className="lime-user-avatar-circle">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="lime-user-text-info">
                <span className="lime-user-name">Counsellor</span>
                <span className="lime-user-role">Reviewer</span>
              </div>
            </div>
          </div>
        </header>

        {/* Screening Support Banner & Non-Diagnostic Notice */}
        <aside
          style={{
            background: "#eff6ff",
            border: "1px solid #dbeafe",
            borderRadius: "8px",
            padding: "8px 14px",
            marginBottom: "14px",
            fontSize: "11px",
            color: "#1e40af",
            lineHeight: 1.4,
          }}
          aria-label="Non-diagnostic boundary"
        >
          <strong>Mandatory Practice Notice:</strong> Screening support only. Requires counsellor-assisted interpretation and does not replace professional counselling.
          <span style={{ display: "block", color: "#475569", marginTop: "3px", fontSize: "10.5px" }}>
            Model: Temporary sentiment model — C4 development (cardiffnlp/twitter-xlm-roberta-base-sentiment). Outputs represent sentiment classification for explanation development, not clinical diagnoses. Does not claim validated Sinhala, Romanized Sinhala, or code-mixed diagnostic accuracy.
          </span>
        </aside>

        {error && (
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
            {error}
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

        {/* DASHBOARD GRID */}
        <div className="lime-grid">
          {/* ROW 1: Input Text | Model Prediction | Explanation Summary */}
          <div className="lime-row lime-row-3-cols">
            {/* Card 1: Input Text */}
            <div className="lime-card lime-card-input-text">
              <div className="lime-card-header">
                <div className="lime-card-title-group">
                  <svg className="lime-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <h3 className="lime-card-title">Input Text</h3>
                </div>
              </div>

              <div className="lime-input-box">
                {submissionText ? (
                  <p className="lime-input-line-1">{submissionText}</p>
                ) : explanation ? (
                  <div role="status" style={{ padding: "8px 4px" }}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>
                      Original text not retained in persistence
                    </p>
                    <p className="lime-input-line-2" style={{ color: "#64748b", fontSize: "11px", margin: 0, lineHeight: 1.45 }}>
                      Per data minimization and retention controls, full input text is excluded from stored explanation records. Token attributions, probabilities, and diagnostics have been retrieved from saved explanation ID: <code style={{ fontSize: "10.5px", background: "#f1f5f9", padding: "1px 4px", borderRadius: "3px" }}>{String(explanation.explanation_id || "").slice(0, 8)}...</code>
                    </p>
                  </div>
                ) : (
                  <div role="status" style={{ padding: "16px 8px", textAlign: "center" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", margin: "0 0 6px" }}>
                      Submit text first
                    </p>
                    <p className="lime-input-line-2" style={{ color: "#64748b", fontSize: "11.5px", margin: "0 0 12px", lineHeight: 1.5 }}>
                      No reflection submission is active in shared context. Enter and analyse fictional reflection text on the Development Input page before generating explanations.
                    </p>
                    <Link
                      href="/c4-dev-input"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 14px",
                        borderRadius: "6px",
                        background: "#6366f1",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      ← Go to Development Input
                    </Link>
                  </div>
                )}
              </div>

              <div className="lime-input-meta-row">
                <span className="lime-meta-label">Detected Language:</span>
                <span className="lime-meta-pill-sinhala">Language: {caseLanguage}</span>
              </div>

              <div className="lime-input-bottom-row">
                <span>Tokens: {tokenCount}</span>
                <span>Explaining Class: <span className="lime-explained-class-val">{targetClass}</span></span>
              </div>

              {/* Action row with compute button */}
              <div style={{ marginTop: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "10px" }}>
                <button
                  type="button"
                  aria-label="Compute LIME Attributions"
                  onClick={handleRunLime}
                  disabled={!canCompute || isBusy}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "7px",
                    border: "none",
                    background: canCompute ? "#4f46e5" : "#e2e8f0",
                    color: canCompute ? "#ffffff" : "#94a3b8",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: canCompute ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                  }}
                >
                  {isBusy ? "Computing LIME..." : !submissionText ? "Submit text first" : `Compute LIME for "${targetClass}"`}
                </button>
                {!submissionText && (
                  <p style={{ fontSize: "10px", color: "#64748b", marginTop: "5px", textAlign: "center" }}>
                    Submit text on Development Input to enable LIME explanations.
                  </p>
                )}
                {explanation?.explanation_id && (
                  <Link
                    href={`/faithfulness?exp_id=${explanation.explanation_id}`}
                    style={{
                      marginTop: "8px",
                      width: "100%",
                      padding: "7px 12px",
                      borderRadius: "7px",
                      border: "1px solid #c7d2fe",
                      background: "#eef2ff",
                      color: "#4338ca",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      textDecoration: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    → Evaluate Faithfulness
                  </Link>
                )}
              </div>
            </div>

            {/* Card 2: Model Prediction */}
            <div className="lime-card lime-card-orig-prediction">
              <div className="lime-card-header">
                <div className="lime-card-title-group">
                  <svg className="lime-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <h3 className="lime-card-title">Model Prediction</h3>
                </div>
                <span style={{ fontSize: "9.5px", color: "#6366f1", fontWeight: 600 }}>Temporary sentiment model</span>
              </div>

              {prediction ? (
                <>
                  <div className="lime-prediction-main-row">
                    <div>
                      <span style={{ fontSize: "10.5px", color: "#64748b", display: "block" }}>Predicted Sentiment:</span>
                      <div
                        className="lime-stress-label"
                        style={{
                          color:
                            prediction.predicted_sentiment === "Negative"
                              ? "#ef4444"
                              : prediction.predicted_sentiment === "Positive"
                              ? "#16a34a"
                              : "#3b82f6",
                        }}
                      >
                        {prediction.predicted_sentiment}
                      </div>
                    </div>
                    <div className="lime-confidence-badge">
                      <span className="lime-score-percent">
                        {Math.round(prediction.confidence * 100)}%
                      </span>
                      <span className="lime-score-sublabel">Confidence</span>
                    </div>
                  </div>

                  {/* Checkpoint Probabilities Distribution (Recharts) */}
                  <SentimentProbabilityChart probabilities={prediction.probabilities} />

                  <div style={{ fontSize: "10px", color: "#64748b", marginTop: "8px", borderTop: "1px solid #f1f5f9", paddingTop: "6px", display: "flex", justifyContent: "space-between" }}>
                    <span>Tokens: <strong>{prediction.token_count}</strong> {prediction.truncated ? "(Truncated)" : "(≤512)"}</span>
                    <span>Revision: <strong>{prediction.model_revision?.slice(0, 7) || "main"}</strong></span>
                  </div>
                </>
              ) : isPredicting ? (
                <div style={{ padding: "18px 0", textAlign: "center" }}>
                  <p style={{ fontSize: "11.5px", color: "#6366f1", margin: 0 }}>Evaluating checkpoint predictions...</p>
                </div>
              ) : (
                <div style={{ padding: "18px 0", textAlign: "center" }}>
                  <div className="lime-stress-label" style={{ fontSize: "14px", color: "#64748b", marginBottom: "4px" }}>
                    Submit text first
                  </div>
                  <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0 }}>
                    Predictions appear after analysing text on Development Input.
                  </p>
                </div>
              )}

              {/* Sentiment Class Selector for LIME / SHAP Explanation */}
              <div style={{ marginTop: "10px", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Explained Sentiment Class (shared with SHAP):
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  {(["Negative", "Neutral", "Positive"] as const).map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setSelectedSentimentClass(cls)}
                      style={{
                        flex: 1,
                        padding: "4px 6px",
                        fontSize: "11px",
                        fontWeight: 600,
                        borderRadius: "5px",
                        border: targetClass === cls ? "1.5px solid #4f46e5" : "1px solid #cbd5e1",
                        background: targetClass === cls ? "#eef2ff" : "#ffffff",
                        color: targetClass === cls ? "#4338ca" : "#475569",
                        cursor: "pointer",
                      }}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 3: Explanation Summary */}
            <div className="lime-card lime-card-explanation-summary">
              <div className="lime-card-header">
                <div className="lime-card-title-group">
                  <svg className="lime-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <h3 className="lime-card-title">Explanation Summary</h3>
                </div>
                <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>Case Summary</span>
              </div>

              {hasResults ? (
                <>
                  <div className="lime-summary-body-row">
                    <div className="lime-gauge-wrap">
                      <svg className="lime-gauge-svg" viewBox="0 0 84 84">
                        <circle cx="42" cy="42" r="34" fill="none" stroke="#f1f5f9" strokeWidth="9" />
                        {posPct > 0 && (
                          <circle
                            cx="42"
                            cy="42"
                            r="34"
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="9"
                            strokeDasharray={`${redDash} ${circ}`}
                            strokeDashoffset="0"
                          />
                        )}
                        {negPct > 0 && (
                          <circle
                            cx="42"
                            cy="42"
                            r="34"
                            fill="none"
                            stroke="#16a34a"
                            strokeWidth="9"
                            strokeDasharray={`${greenDash} ${circ}`}
                            strokeDashoffset={`${-redDash}`}
                          />
                        )}
                      </svg>
                    </div>

                    <div className="lime-summary-legend-list">
                      <div className="lime-legend-item-row">
                        <div className="lime-legend-left">
                          <span className="lime-dot lime-dot-red"></span>
                          <span>Supports {targetClass}</span>
                        </div>
                        <span className="lime-legend-item-val">{posPct}%</span>
                      </div>
                      <div className="lime-legend-item-row">
                        <div className="lime-legend-left">
                          <span className="lime-dot lime-dot-green"></span>
                          <span>Opposes {targetClass}</span>
                        </div>
                        <span className="lime-legend-item-val">{negPct}%</span>
                      </div>
                      <div className="lime-legend-item-row">
                        <div className="lime-legend-left">
                          <span className="lime-dot lime-dot-gray"></span>
                          <span>Neutral</span>
                        </div>
                        <span className="lime-legend-item-val">{neutralPct}%</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: "10px", fontSize: "11px", color: "#475569" }}>
                    Target Probability: <strong>{explanation?.target_class_probability != null ? (explanation.target_class_probability * 100).toFixed(1) + "%" : "—"}</strong>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "26px 10px", color: "#94a3b8", fontSize: "11.5px" }}>
                  <p style={{ fontWeight: 600, color: "#64748b", margin: "0 0 4px" }}>
                    {!submissionText ? "Submit text first" : "No Summary Available"}
                  </p>
                  <p style={{ margin: 0 }}>
                    {!submissionText
                      ? "Submit reflection text on Development Input to compute summary."
                      : "Compute LIME explanation to see attribution breakdown."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ROW 2: Features Table (Signed Diverging Bar Chart) & Highlights / Diagnostics */}
          <div className="lime-row lime-row-2-cols-split">
            {/* Card 4: LIME Feature Importance Table */}
            <div className="lime-card lime-card-features-table">
              <div className="lime-card-header">
                <div className="lime-card-title-group">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <h3 className="lime-card-title" style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                    LIME Feature Importance
                    <span style={{ fontSize: "11.5px", fontWeight: 400, color: "#64748b" }}>
                      (mean |weight|)
                    </span>
                  </h3>
                  <span className="lime-info-icon-small" title={`Feature weights for class: ${targetClass}`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </div>
              </div>

              {hasResults ? (
                <>
                  <div className="lime-features-table-wrap" aria-label="LIME Diverging Signed Bar Chart">
                    <table className="lime-features-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", paddingLeft: "8px" }}>Feature (Token)</th>
                          <th style={{ textAlign: "center" }}>LIME Weight</th>
                          <th style={{ textAlign: "right", paddingRight: "16px" }}>Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayContributions.map((item, i) => {
                          const isPositive = item.weight >= 0;
                          const barPercent = isPositive
                            ? Math.min(100, Math.max(8, Math.round((item.weight / maxAbsWeight) * 100)))
                            : 0;
                          const formattedWeight =
                            (isPositive ? "+" : "") + item.weight.toFixed(3);
                          return (
                            <tr key={i} className={isPositive ? "lime-row-pos" : "lime-row-neg"}>
                              <td className={`lime-feat-name ${isPositive ? "" : "lime-neg-cell-start"}`}>
                                {item.token}
                              </td>
                              <td
                                className={`lime-feat-weight ${
                                  isPositive ? "lime-weight-pos" : "lime-weight-neg lime-neg-cell-end"
                                }`}
                              >
                                {formattedWeight}
                              </td>
                              <td className="lime-feat-bar-col">
                                {isPositive && (
                                  <div className="lime-feat-bar-track">
                                    <div
                                      className="lime-feat-bar-fill-red"
                                      style={{ width: `${barPercent}%` }}
                                    />
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="lime-table-legend-row">
                    <div className="lime-table-legend-item">
                      <span className="lime-legend-square lime-square-red"></span>
                      <span>Pushes prediction towards {posLabel}</span>
                    </div>
                    <div className="lime-table-legend-item">
                      <span className="lime-legend-square lime-square-green"></span>
                      <span>Pushes prediction towards {negLabel}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 16px",
                    color: "#94a3b8",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  <p style={{ fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>
                    No Attribution Values Available
                  </p>
                  <p style={{ margin: 0, fontSize: "11px" }}>
                    No Attribution Bar Chart Available
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: "11px" }}>
                    {!submissionText
                      ? "Enter reflection text on Development Input to compute token attributions."
                      : `Generate LIME explanation to inspect token weights for ${targetClass}.`}
                  </p>
                </div>
              )}

              {/* Download CSV Button */}
              <div className="lime-download-csv-row">
                <button
                  type="button"
                  className="lime-download-csv-btn"
                  onClick={handleDownloadCsv}
                  disabled={!hasResults}
                  style={!hasResults ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Export contributions as CSV</span>
                </button>
              </div>
            </div>

            {/* Right Container: Highlights + Diagnostics */}
            <div className="lime-right-column-container">
              {/* Card 5: Text with LIME Highlights */}
              <div className="lime-card lime-card-highlights">
                <div className="lime-card-header" style={{ marginBottom: 8 }}>
                  <div className="lime-card-title-group">
                    <h3 className="lime-card-title">Text with LIME Highlights</h3>
                    <span className="lime-info-icon-small" title={`Highlight attributions for ${targetClass}`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </span>
                  </div>
                </div>

                {/* Token Chips */}
                <div className="lime-highlight-text-box" aria-label="Attribution highlighted text">
                  {hasResults && submissionText ? (
                    renderHighlightedTokens(submissionText, contributions, targetClass)
                  ) : hasResults ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "4px 0" }}>
                      <span style={{ fontSize: "10.5px", color: "#64748b", width: "100%", marginBottom: "4px" }}>
                        Attributed tokens from restored explanation:
                      </span>
                      {contributions.map((c, i) => (
                        <span
                          key={i}
                          className={`lime-chip-word ${
                            c.weight >= 0.25
                              ? "lime-chip-strong-red"
                              : c.weight > 0
                              ? "lime-chip-soft-pink"
                              : c.weight <= -0.15
                              ? "lime-chip-soft-green"
                              : "lime-chip-soft-green"
                          }`}
                          title={`Token: "${c.token}" | Weight: ${c.weight >= 0 ? "+" : ""}${c.weight.toFixed(4)}`}
                        >
                          {c.token} <small style={{ opacity: 0.8 }}>({c.weight >= 0 ? "+" : ""}{c.weight.toFixed(3)})</small>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: "#94a3b8", fontSize: "11px" }}>
                      {!submissionText
                        ? "Submit text first on Development Input to view highlighted attributions."
                        : "Attribution highlighted text will appear here once explanation is computed."}
                    </span>
                  )}
                </div>

                {/* Highlights Legend */}
                <div className="lime-highlights-legend-row">
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>Highlight Legend:</span>
                  <div className="lime-highlight-legend-item">
                    <span className="lime-swatch lime-swatch-dark-red"></span>
                    <span>Strongly supports {targetClass}</span>
                  </div>
                  <div className="lime-highlight-legend-item">
                    <span className="lime-swatch lime-swatch-pink"></span>
                    <span>Supports {targetClass}</span>
                  </div>
                  <div className="lime-highlight-legend-item">
                    <span className="lime-swatch lime-swatch-gray"></span>
                    <span>Neutral</span>
                  </div>
                  <div className="lime-highlight-legend-item">
                    <span className="lime-swatch lime-swatch-light-green"></span>
                    <span>Opposes {targetClass}</span>
                  </div>
                  <div className="lime-highlight-legend-item">
                    <span className="lime-swatch lime-swatch-dark-green"></span>
                    <span>Strongly opposes {targetClass}</span>
                  </div>
                </div>
              </div>

              {/* Sub-row with 2 cards */}
              <div className="lime-sub-cards-row">
                {/* Sub-Card 1: LIME Process Summary */}
                <div className="lime-card lime-card-process">
                  <div className="lime-card-header" style={{ marginBottom: 6 }}>
                    <div className="lime-card-title-group">
                      <h3 className="lime-card-title">LIME Process Summary</h3>
                    </div>
                  </div>

                  <div className="lime-process-timeline">
                    {explanationSteps.map((step) => (
                      <div key={step.num} className="lime-process-step-item">
                        <div className="lime-step-badge">{step.num}</div>
                        <div className="lime-step-body">
                          <span className="lime-step-title">{step.title}</span>
                          <span className="lime-step-desc">{step.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sub-Card 2: Prediction Probability (Local) */}
                <div className="lime-card lime-card-local-pred">
                  <div className="lime-card-header" style={{ marginBottom: 6 }}>
                    <div className="lime-card-title-group">
                      <h3 className="lime-card-title">Prediction Probability (Local)</h3>
                    </div>
                  </div>

                  {/* Prob bars (Recharts) */}
                  <LocalProbabilityChart
                    targetClass={targetClass}
                    targetProbability={explanation?.target_class_probability}
                  />

                  {/* 2-column local explanation info */}
                  <div className="lime-local-info-box">
                    <div className="lime-info-title">Local Explanation Info</div>
                    <div className="lime-info-grid-2x4">
                      <div className="lime-info-item">
                        <span className="lime-info-lbl">Explainer</span>
                        <span className="lime-info-val">LIME</span>
                      </div>
                      <div className="lime-info-item">
                        <span className="lime-info-lbl">Kernel</span>
                        <span className="lime-info-val">RBF Exponential</span>
                      </div>
                      <div className="lime-info-item">
                        <span className="lime-info-lbl">Samples</span>
                        <span className="lime-info-val">
                          {explanation?.computation_bounds?.num_samples ?? 100}
                        </span>
                      </div>
                      <div className="lime-info-item">
                        <span className="lime-info-lbl">Features</span>
                        <span className="lime-info-val">
                          {explanation?.computation_bounds?.num_features ?? 15}
                        </span>
                      </div>
                      <div className="lime-info-item">
                        <span className="lime-info-lbl">Split</span>
                        <span className="lime-info-val">\s+</span>
                      </div>
                      <div className="lime-info-item">
                        <span className="lime-info-lbl">Metric</span>
                        <span className="lime-info-val">Cosine</span>
                      </div>
                      <div className="lime-info-item">
                        <span className="lime-info-lbl">Model</span>
                        <span className="lime-info-val" style={{ fontSize: "9.5px" }}>
                          twitter-xlm-roberta
                        </span>
                      </div>
                      <div className="lime-info-item">
                        <span className="lime-info-lbl">Target</span>
                        <span className="lime-info-val">{targetClass}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 3: How to Read LIME Explanation */}
          <div className="lime-card lime-card-how-to">
            <div className="lime-card-header" style={{ marginBottom: 8 }}>
              <div className="lime-card-title-group">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                </svg>
                <h3 className="lime-card-title">How to Read LIME Explanation</h3>
              </div>
            </div>

            <div className="lime-how-to-columns">
              <div className="lime-how-to-item">
                <div className="lime-how-to-icon lime-icon-red">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </div>
                <div className="lime-how-to-content">
                  <span className="lime-how-to-title">Positive Weight (Red)</span>
                  <p className="lime-how-to-desc">
                    Words with positive weight increase the prediction towards <strong className="lime-text-red">{targetClass}</strong>.
                  </p>
                </div>
              </div>

              <div className="lime-how-to-item">
                <div className="lime-how-to-icon lime-icon-green">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="19 12 12 19 5 12" />
                  </svg>
                </div>
                <div className="lime-how-to-content">
                  <span className="lime-how-to-title">Negative Weight (Green)</span>
                  <p className="lime-how-to-desc">
                    Words with negative weight decrease the probability of <strong className="lime-text-red">{targetClass}</strong>.
                  </p>
                </div>
              </div>

              <div className="lime-how-to-item">
                <div className="lime-how-to-icon lime-icon-blue">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div className="lime-how-to-content">
                  <span className="lime-how-to-title">Weight Magnitude</span>
                  <p className="lime-how-to-desc">
                    The larger the absolute weight bar, the stronger the local surrogate influence on the prediction.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
    </RequireAuth>
  );
}

function renderHighlightedTokens(text: string, contributions: FeatureContribution[], targetClass: string) {
  const weightMap = new Map<string, number>();
  for (const c of contributions) {
    weightMap.set(c.token.toLowerCase(), c.weight);
  }

  // Preserve whitespace and punctuation with Unicode tokens
  const parts = text.split(/(\s+|[.,!?;:()""'—–])/);

  return parts.map((part, idx) => {
    if (!part) return null;
    if (/^\s+$/.test(part)) {
      return <span key={idx}>{part}</span>;
    }
    if (/^[.,!?;:()""'—–]$/.test(part)) {
      return (
        <span key={idx} className="lime-chip-punctuation">
          {part}
        </span>
      );
    }

    const cleanWord = part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLowerCase();
    const weight = weightMap.get(cleanWord) ?? weightMap.get(part.toLowerCase());

    let chipClass = "lime-chip-word";
    if (weight !== undefined) {
      if (weight >= 0.25) chipClass += " lime-chip-strong-red";
      else if (weight > 0) chipClass += " lime-chip-soft-pink";
      else if (weight <= -0.15) chipClass += " lime-chip-soft-green";
      else if (weight < 0) chipClass += " lime-chip-soft-green";
    }

    return (
      <span
        key={idx}
        className={chipClass}
        title={weight !== undefined ? `Word: "${part}" | Weight: ${weight >= 0 ? "+" : ""}${weight.toFixed(4)} (${weight >= 0 ? "Supports" : "Opposes"} ${targetClass})` : undefined}
      >
        {part}
      </span>
    );
  });
}
