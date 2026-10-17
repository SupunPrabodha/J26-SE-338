"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Sidebar } from "../components/Sidebar";
import { useReviewCase } from "../context/CaseContext";
import type { C4ExplanationResponse, C4PredictionResponse, FeatureContribution } from "@j26/common/contracts";

export default function ShapPage() {
  const {
    selectedTask,
    selectedTaskId,
    tasks,
    selectTask,
    selectedSentimentClass,
    setSelectedSentimentClass,
    devInput,
  } = useReviewCase();

  const [isBusy, setIsBusy] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [explanation, setExplanation] = useState<C4ExplanationResponse | null>(null);
  const [prediction, setPrediction] = useState<C4PredictionResponse | null>(null);
  const [isClassifierConnected, setIsClassifierConnected] = useState(false);

  // Ignore late responses across case changes
  const activeRequestRef = useRef(0);

  const snapshot = devInput && devInput.text ? devInput : null;
  const submissionText = snapshot ? snapshot.text : null;
  const caseLanguage = snapshot ? (snapshot.language || "English") : "English";
  const targetClass = selectedSentimentClass || snapshot?.targetClass || "Negative";

  // Clear previous results whenever the submitted text or target class changes
  useEffect(() => {
    activeRequestRef.current += 1;
    setExplanation(null);
    setError("");
    setStatusMessage("");
  }, [selectedTaskId, selectedSentimentClass, submissionText]);

  // Set prediction from snapshot or fetch if text is present
  useEffect(() => {
    let mounted = true;
    if (!submissionText) {
      setPrediction(null);
      setIsClassifierConnected(false);
      return;
    }

    if (snapshot && snapshot.prediction) {
      setPrediction(snapshot.prediction);
      setIsClassifierConnected(true);
      return;
    }

    const currentReqId = ++activeRequestRef.current;
    setIsPredicting(true);

    fetch("/api/c4-predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: submissionText,
        language: caseLanguage,
      }),
    })
      .then(async (res) => {
        if (!mounted || currentReqId !== activeRequestRef.current) return;
        if (res.ok) {
          const data = (await res.json()) as C4PredictionResponse;
          setPrediction(data);
          setIsClassifierConnected(true);
        } else {
          const errJson = await res.json().catch(() => ({}));
          setError(errJson.error || `Prediction check failed (${res.status})`);
          setIsClassifierConnected(false);
        }
      })
      .catch((err) => {
        if (!mounted || currentReqId !== activeRequestRef.current) return;
        setError(err.message || "Could not connect to sentiment classifier");
        setIsClassifierConnected(false);
      })
      .finally(() => {
        if (mounted && currentReqId === activeRequestRef.current) {
          setIsPredicting(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [submissionText, caseLanguage, snapshot]);

  async function handleRunShap() {
    if (!submissionText) {
      setError("Submit text first on the Development Input page before computing explanations.");
      return;
    }

    const currentReqId = ++activeRequestRef.current;
    setIsBusy(true);
    setError("");
    setStatusMessage(`Running SHAP additive explanation for "${targetClass}" with text masker...`);

    try {
      const res = await fetch("/api/c4-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: submissionText,
          method: "SHAP",
          target_class: targetClass,
          language: caseLanguage,
        }),
      });

      if (currentReqId !== activeRequestRef.current) {
        // Stale response
        return;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Request failed with status ${res.status}`);
      }

      const data = (await res.json()) as C4ExplanationResponse;
      setExplanation(data);

      if (data.status === "AWAITING_CLASSIFIER_CONNECTION") {
        setIsClassifierConnected(false);
        setStatusMessage("Awaiting classifier connection — C3 model integration pending.");
      } else {
        setIsClassifierConnected(true);
        setStatusMessage(`SHAP additive explanation for "${targetClass}" computed successfully.`);
      }
    } catch (err) {
      if (currentReqId === activeRequestRef.current) {
        setError((err as Error).message || "Could not retrieve SHAP explanation from services.");
      }
    } finally {
      if (currentReqId === activeRequestRef.current) {
        setIsBusy(false);
      }
    }
  }

  const hasResults = Boolean(
    explanation &&
      explanation.status === "READY" &&
      explanation.contributions &&
      explanation.contributions.length > 0
  );

  const contributions: FeatureContribution[] = explanation?.contributions || [];

  // Summary calculations
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

  const maxAbsWeight = contributions.reduce((max, c) => Math.max(max, c.abs_weight), 0);
  const meanAbsShap =
    contributions.length > 0
      ? (contributions.reduce((acc, c) => acc + c.abs_weight, 0) / contributions.length).toFixed(4)
      : "0.0000";
  const strengthLabel = totalWeight > 0.6 ? "Strong" : totalWeight > 0.25 ? "Moderate" : "Subtle";

  const handleDownloadCsv = () => {
    if (!hasResults || contributions.length === 0) return;
    const headers = "Feature (Token),SHAP Value,Impact\n";
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
    link.setAttribute("download", `shap_values_${selectedTaskId || "case"}_${targetClass}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tokenCount = submissionText ? submissionText.trim().split(/\s+/).length : 0;
  const canCompute = Boolean(submissionText);

  // Base and Output values from explanation
  const baseValue = explanation?.base_value ?? 0.0;
  const outputValue = explanation?.output_value ?? (explanation?.target_class_probability ?? 0.0);

  return (
    <div className="shap-page-container">
      <Sidebar isClassifierConnected={isClassifierConnected} />

      <main className="shap-main" id="content">
        {/* Top Header */}
        <header className="shap-header">
          <div className="shap-header-title-block">
            <h1 className="shap-main-title">SHAP Explanation</h1>
            <p className="shap-main-subtitle">
              SHapley Additive exPlanations for individual sentiment screening predictions.
            </p>
          </div>

          <div className="shap-header-actions">
            {snapshot ? (
              <div className="shap-header-pill" title="Active development submission">
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Source:</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#4f46e5" }}>
                  Development Input
                </span>
              </div>
            ) : tasks.length > 1 ? (
              <div className="shap-header-pill" title="Assigned review cases">
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Case:</span>
                <select
                  aria-label="Selected case"
                  value={selectedTaskId || ""}
                  onChange={(e) => selectTask(e.target.value)}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#0f172a",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {tasks.map((t, idx) => (
                    <option key={t.task_id} value={t.task_id}>
                      Case {idx + 1} ({String(t.task_id).slice(0, 8)}...)
                    </option>
                  ))}
                </select>
              </div>
            ) : selectedTask ? (
              <div className="shap-header-pill" title={`Case ID: ${selectedTask.case?.case_id || selectedTask.task_id}`}>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Case:</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                  {String(selectedTask.case?.case_id || selectedTask.task_id).slice(0, 8)}...
                </span>
              </div>
            ) : null}

            {/* Language Pill */}
            <div className="shap-header-pill" title="Language detected in submission">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>{caseLanguage}</span>
            </div>

            {/* Counsellor Profile Pill */}
            <div className="shap-header-pill">
              <div className="shap-user-avatar-circle">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="shap-user-text-info">
                <span className="shap-user-name">Counsellor</span>
                <span className="shap-user-role">Reviewer</span>
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
        <div className="shap-grid">
          {/* ROW 1: Input Text | Model Prediction | SHAP Summary */}
          <div className="shap-row shap-row-3-cols">
            {/* Card 1: Input Text */}
            <div className="shap-card shap-card-input-text">
              <div className="shap-card-header">
                <div className="shap-card-title-group">
                  <svg className="shap-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <h3 className="shap-card-title">Input Text</h3>
                </div>
              </div>

              <div className="shap-input-box">
                {submissionText ? (
                  <p className="shap-input-line-1">{submissionText}</p>
                ) : (
                  <div role="status" style={{ padding: "16px 8px", textAlign: "center" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", margin: "0 0 6px" }}>
                      Submit text first
                    </p>
                    <p className="shap-input-line-2" style={{ color: "#64748b", fontSize: "11.5px", margin: "0 0 12px", lineHeight: 1.5 }}>
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

              <div className="shap-input-meta-row">
                <span className="shap-meta-label">Detected Language:</span>
                <span className="shap-meta-pill-sinhala">Language: {caseLanguage}</span>
              </div>

              <div className="shap-input-bottom-row">
                <span>Tokens: {tokenCount}</span>
                <span>Explaining Class: <span className="shap-explained-class-val">{targetClass}</span></span>
              </div>

              {/* Action row with compute button */}
              <div style={{ marginTop: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "10px" }}>
                <button
                  type="button"
                  aria-label="Compute SHAP Attributions"
                  onClick={handleRunShap}
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
                  {isBusy ? "Computing SHAP..." : !submissionText ? "Submit text first" : `Compute SHAP for "${targetClass}"`}
                </button>
                {!submissionText && (
                  <p style={{ fontSize: "10px", color: "#64748b", marginTop: "5px", textAlign: "center" }}>
                    Submit text on Development Input to enable SHAP explanations.
                  </p>
                )}
              </div>
            </div>

            {/* Card 2: Model Prediction */}
            <div className="shap-card shap-card-orig-prediction">
              <div className="shap-card-header">
                <div className="shap-card-title-group">
                  <svg className="shap-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <h3 className="shap-card-title">Model Prediction</h3>
                </div>
                <span style={{ fontSize: "9.5px", color: "#6366f1", fontWeight: 600 }}>Temporary sentiment model</span>
              </div>

              {prediction ? (
                <>
                  <div className="shap-prediction-main-row">
                    <div>
                      <span style={{ fontSize: "10.5px", color: "#64748b", display: "block" }}>Predicted Sentiment:</span>
                      <div
                        className="shap-stress-label"
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
                    <div className="shap-confidence-badge">
                      <span className="shap-score-percent">
                        {Math.round(prediction.confidence * 100)}%
                      </span>
                      <span className="shap-score-sublabel">Confidence</span>
                    </div>
                  </div>

                  {/* Checkpoint Probabilities Distribution */}
                  <div style={{ marginTop: "10px", marginBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", marginBottom: "4px", fontWeight: 600 }}>
                      <span style={{ color: "#ef4444" }}>Negative: {Math.round((prediction.probabilities["Negative"] ?? 0) * 100)}%</span>
                      <span style={{ color: "#3b82f6" }}>Neutral: {Math.round((prediction.probabilities["Neutral"] ?? 0) * 100)}%</span>
                      <span style={{ color: "#16a34a" }}>Positive: {Math.round((prediction.probabilities["Positive"] ?? 0) * 100)}%</span>
                    </div>
                    <div style={{ height: "8px", width: "100%", background: "#f1f5f9", borderRadius: "999px", overflow: "hidden", display: "flex" }}>
                      <div style={{ width: `${Math.round((prediction.probabilities["Negative"] ?? 0) * 100)}%`, background: "#ef4444" }} title={`Negative: ${(prediction.probabilities["Negative"] ?? 0).toFixed(4)}`}></div>
                      <div style={{ width: `${Math.round((prediction.probabilities["Neutral"] ?? 0) * 100)}%`, background: "#93c5fd" }} title={`Neutral: ${(prediction.probabilities["Neutral"] ?? 0).toFixed(4)}`}></div>
                      <div style={{ width: `${Math.round((prediction.probabilities["Positive"] ?? 0) * 100)}%`, background: "#16a34a" }} title={`Positive: ${(prediction.probabilities["Positive"] ?? 0).toFixed(4)}`}></div>
                    </div>
                  </div>

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
                  <div className="shap-stress-label" style={{ fontSize: "14px", color: "#64748b", marginBottom: "4px" }}>
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
                  Explained Sentiment Class (shared with LIME):
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

            {/* Card 3: SHAP Summary */}
            <div className="shap-card shap-card-summary">
              <div className="shap-card-header">
                <div className="shap-card-title-group">
                  <svg className="shap-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <h3 className="shap-card-title">SHAP Summary</h3>
                </div>
                <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>Case Summary</span>
              </div>

              {hasResults ? (
                <>
                  <div className="shap-summary-body-row">
                    <div className="shap-gauge-wrap">
                      <svg className="shap-gauge-svg" viewBox="0 0 84 84">
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

                    <div className="shap-summary-legend-list">
                      <div className="shap-legend-item-row">
                        <div className="shap-legend-left">
                          <span className="shap-dot shap-dot-red"></span>
                          <span>Supports {targetClass}</span>
                        </div>
                        <span className="shap-legend-item-val">{posPct}%</span>
                      </div>
                      <div className="shap-legend-item-row">
                        <div className="shap-legend-left">
                          <span className="shap-dot shap-dot-green"></span>
                          <span>Opposes {targetClass}</span>
                        </div>
                        <span className="shap-legend-item-val">{negPct}%</span>
                      </div>
                      <div className="shap-legend-item-row">
                        <div className="shap-legend-left">
                          <span className="shap-dot shap-dot-gray"></span>
                          <span>Neutral</span>
                        </div>
                        <span className="shap-legend-item-val">{neutralPct}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="shap-strength-row">
                    <span className="shap-strength-label">
                      Mean |SHAP value|: <strong>{meanAbsShap}</strong>
                    </span>
                    <span className="shap-strength-badge">{strengthLabel}</span>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "26px 10px", color: "#94a3b8", fontSize: "11.5px" }}>
                  <p style={{ fontWeight: 600, color: "#64748b", margin: "0 0 4px" }}>
                    {!submissionText ? "Submit text first" : "No Summary Available"}
                  </p>
                  <p style={{ margin: 0 }}>
                    {!submissionText
                      ? "Submit reflection text on Development Input to compute SHAP summary."
                      : "Compute SHAP explanation to inspect attribution breakdown."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ROW 2: SHAP Feature Importance Table & Visual Plots */}
          <div className="shap-row shap-row-2-cols-split">
            {/* Card 4: SHAP Feature Importance Table */}
            <div className="shap-card shap-card-features-table">
              <div className="shap-card-header">
                <div className="shap-card-title-group">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  <h3 className="shap-card-title">SHAP Feature Importance</h3>
                  <span className="shap-info-icon-small" title={`Feature attribution for class: ${targetClass}`}>
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
                  <div className="shap-features-table-wrap">
                    <table className="shap-features-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", paddingLeft: 8 }}>Feature (Token)</th>
                          <th style={{ textAlign: "left" }}>SHAP Value</th>
                          <th style={{ textAlign: "left" }}>Impact ({targetClass})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contributions.map((item, i) => {
                          const isPositive = item.weight >= 0;
                          const barPercent =
                            maxAbsWeight > 0
                              ? Math.round((Math.abs(item.weight) / maxAbsWeight) * 100)
                              : 0;
                          const formattedWeight =
                            (item.weight >= 0 ? "+" : "") + item.weight.toFixed(4);
                          return (
                            <tr key={i} className={isPositive ? "shap-row-pos" : "shap-row-neg"}>
                              <td className="shap-feat-name">{item.token}</td>
                              <td
                                className={`shap-feat-weight ${
                                  isPositive ? "shap-weight-pos" : "shap-weight-neg"
                                }`}
                              >
                                {formattedWeight}
                              </td>
                              <td className="shap-feat-bar-col">
                                {barPercent > 0 && (
                                  <div className="shap-feat-bar-track">
                                    <div
                                      className={
                                        isPositive
                                          ? "shap-feat-bar-fill-red"
                                          : "shap-feat-bar-fill-green"
                                      }
                                      style={{ width: `${barPercent}%` }}
                                    ></div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="shap-table-legend-row">
                    <div className="shap-table-legend-item">
                      <span className="shap-legend-square shap-square-red"></span>
                      <span>Pushes prediction towards {targetClass}</span>
                    </div>
                    <div className="shap-table-legend-item">
                      <span className="shap-legend-square shap-square-green"></span>
                      <span>Opposes {targetClass}</span>
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
                    {!submissionText ? "Submit text first" : "No Attribution Values Available"}
                  </p>
                  <p style={{ margin: 0, fontSize: "11px" }}>
                    {!submissionText
                      ? "Submit text first on Development Input before inspecting token attributions."
                      : `Compute SHAP additive values to inspect feature attributions for ${targetClass}.`}
                  </p>
                </div>
              )}

              <div className="shap-download-csv-row">
                <button
                  type="button"
                  className="shap-download-csv-btn"
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

            {/* Right Container: Force Plot & Probs (Top) and Beeswarm (Bottom) */}
            <div className="shap-right-column-container">
              {/* Top Sub-row */}
              <div className="shap-top-sub-row">
                {/* Card: SHAP Force Plot */}
                <div className="shap-card shap-card-force-plot">
                  <div className="shap-card-header" style={{ marginBottom: 6 }}>
                    <div className="shap-card-title-group">
                      <h3 className="shap-card-title">SHAP Force Plot ({targetClass})</h3>
                      <span className="shap-info-icon-small" title="Forces pushing output higher or lower">
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
                      <div className="shap-force-header-stats">
                        <span>Base value (Expected): <strong>{baseValue.toFixed(4)}</strong></span>
                        <span>Model output: <strong>{outputValue.toFixed(4)}</strong></span>
                      </div>

                      <div className="shap-force-svg-wrap">
                        {renderShapForceSvg(baseValue, outputValue, contributions, targetClass)}
                      </div>

                      <div className="shap-force-footer-note">
                        <span style={{ color: "#ef4444" }}>Red</span> pushes towards {targetClass}. <span style={{ color: "#15803d" }}>Green</span> opposes.
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: "center", padding: "26px 12px", color: "#94a3b8", fontSize: "11px" }}>
                      <p style={{ fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>
                        {!submissionText ? "Submit text first" : "No SHAP Waterfall / Force Plot Available"}
                      </p>
                      <p style={{ margin: 0 }}>
                        {!submissionText
                          ? "Submit reflection text on Development Input to enable local force decomposition."
                          : "Local waterfall / force decomposition will render upon SHAP calculation."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Card: Prediction Probabilities & SHAP Info */}
                <div className="shap-card shap-card-probs">
                  <div className="shap-card-header" style={{ marginBottom: 6 }}>
                    <div className="shap-card-title-group">
                      <h3 className="shap-card-title">Prediction Probabilities</h3>
                    </div>
                  </div>

                  {/* Prob bars */}
                  <div className="shap-prob-bars-wrap">
                    <div className="shap-prob-row">
                      <span className="shap-prob-lbl">{targetClass}</span>
                      <div className="shap-prob-bar-track">
                        <div
                          className="shap-prob-fill-red"
                          style={{
                            width: `${
                              explanation?.target_class_probability != null
                                ? Math.round(explanation.target_class_probability * 100)
                                : 0
                            }%`,
                          }}
                        ></div>
                      </div>
                      <span className="shap-prob-val">
                        {explanation?.target_class_probability != null
                          ? explanation.target_class_probability.toFixed(2)
                          : "—"}
                      </span>
                    </div>
                    <div className="shap-prob-row">
                      <span className="shap-prob-lbl">Opposing</span>
                      <div className="shap-prob-bar-track">
                        <div
                          className="shap-prob-fill-green"
                          style={{
                            width: `${
                              explanation?.target_class_probability != null
                                ? Math.round((1 - explanation.target_class_probability) * 100)
                                : 0
                            }%`,
                          }}
                        ></div>
                      </div>
                      <span className="shap-prob-val">
                        {explanation?.target_class_probability != null
                          ? (1 - explanation.target_class_probability).toFixed(2)
                          : "—"}
                      </span>
                    </div>
                  </div>

                  {/* SHAP Explanation Info Box */}
                  <div className="shap-info-box-compact">
                    <div className="shap-info-title">SHAP Explanation Info</div>
                    <div className="shap-info-list">
                      <div className="shap-info-item">
                        <span className="shap-info-lbl">Explainer</span>
                        <span className="shap-info-val">SHAP (Text Masker)</span>
                      </div>
                      <div className="shap-info-item">
                        <span className="shap-info-lbl">Model</span>
                        <span className="shap-info-val" style={{ fontSize: "9.5px" }}>
                          twitter-xlm-roberta
                        </span>
                      </div>
                      <div className="shap-info-item">
                        <span className="shap-info-lbl">Strategy</span>
                        <span className="shap-info-val">Whitespace Partition</span>
                      </div>
                      <div className="shap-info-item">
                        <span className="shap-info-lbl">Max Evaluations</span>
                        <span className="shap-info-val">
                          {explanation?.computation_bounds?.max_evals ?? 100}
                        </span>
                      </div>
                      <div className="shap-info-item">
                        <span className="shap-info-lbl">Target Class</span>
                        <span className="shap-info-val">{targetClass}</span>
                      </div>
                      <div className="shap-info-item">
                        <span className="shap-info-lbl">Tokens</span>
                        <span className="shap-info-val">
                          {contributions.length > 0 ? contributions.length : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Sub-Card: Beeswarm Plot */}
              <div className="shap-card shap-card-beeswarm">
                <div className="shap-card-header" style={{ marginBottom: 4 }}>
                  <div className="shap-card-title-group">
                    <h3 className="shap-card-title">SHAP Beeswarm Plot (Global view for this instance)</h3>
                  </div>
                </div>

                <div
                  className="shap-beeswarm-container"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    minHeight: "130px",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    border: "1px dashed #cbd5e1",
                    padding: "16px",
                  }}
                >
                  <div style={{ maxWidth: "460px" }}>
                    <p style={{ fontWeight: 600, color: "#475569", fontSize: "11.5px", marginBottom: "4px" }}>
                      Dataset-Level Beeswarm Unavailable for Single Prediction
                    </p>
                    <p style={{ fontSize: "10.5px", color: "#64748b", margin: 0, lineHeight: 1.45 }}>
                      Beeswarm plots are designed for dataset-level multi-example distributions and are not shown for individual predictions.
                      Awaiting aggregate multi-instance dataset explanations with aligned feature tokens.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 3: How to Read SHAP Explanation & Key Takeaway */}
          <div className="shap-card-how-to-wrap">
            <div className="shap-card shap-card-how-to">
              <div className="shap-card-header" style={{ marginBottom: 8 }}>
                <div className="shap-card-title-group">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                  </svg>
                  <h3 className="shap-card-title">How to Read SHAP Explanation</h3>
                </div>
              </div>

              <div className="shap-how-to-columns">
                <div className="shap-how-to-item">
                  <div className="shap-how-to-icon shap-icon-red">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  </div>
                  <div className="shap-how-to-content">
                    <span className="shap-how-to-title">Positive SHAP Value</span>
                    <p className="shap-how-to-desc">
                      The feature increases the model output for <strong className="shap-text-red">{targetClass}</strong>.
                    </p>
                  </div>
                </div>

                <div className="shap-how-to-item">
                  <div className="shap-how-to-icon shap-icon-green">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <polyline points="19 12 12 19 5 12" />
                    </svg>
                  </div>
                  <div className="shap-how-to-content">
                    <span className="shap-how-to-title">Negative SHAP Value</span>
                    <p className="shap-how-to-desc">
                      The feature decreases the model output for <strong className="shap-text-red">{targetClass}</strong>.
                    </p>
                  </div>
                </div>

                <div className="shap-how-to-item">
                  <div className="shap-how-to-icon shap-icon-blue">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="5" x2="19" y2="5" />
                      <line x1="5" y1="19" x2="19" y2="19" />
                    </svg>
                  </div>
                  <div className="shap-how-to-content">
                    <span className="shap-how-to-title">Magnitude Matters</span>
                    <p className="shap-how-to-desc">
                      Larger absolute SHAP values indicate stronger marginal influence on the screening prediction.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Key Takeaway */}
            <div className="shap-card-key-takeaway">
              <span className="shap-takeaway-title">Key Takeaway</span>
              <p className="shap-takeaway-desc">
                SHAP additive values satisfy local accuracy and consistency, providing exact game-theoretic attributions for <strong style={{ color: "#4f46e5" }}>{targetClass}</strong>.
              </p>
              <div className="shap-takeaway-footer">
                <span>Method: Tree-free Kernel / Partition</span>
                <span>Unicode Words Aligned</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function renderShapForceSvg(
  baseValue: number,
  outputValue: number,
  contributions: FeatureContribution[],
  targetClass: string
) {
  const topPos = contributions.filter((c) => c.weight > 0).slice(0, 4);
  const topNeg = contributions.filter((c) => c.weight < 0).slice(0, 4);

  const posSum = topPos.reduce((sum, c) => sum + c.weight, 0);
  const negSum = topNeg.reduce((sum, c) => sum + Math.abs(c.weight), 0);
  const total = posSum + negSum || 1;

  const width = 480;
  const height = 80;
  const center = Math.round(width * 0.48);

  const posWidth = Math.min(200, Math.max(30, Math.round((posSum / total) * 180)));
  const negWidth = Math.min(200, Math.max(30, Math.round((negSum / total) * 180)));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      {/* Background track */}
      <rect x="10" y="26" width={width - 20} height="28" rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />

      {/* Negative blocks (opposing target class) */}
      <rect
        x={center - negWidth}
        y="28"
        width={negWidth}
        height="24"
        fill="#16a34a"
        rx="4"
        opacity="0.85"
      />
      {topNeg.map((c, i) => (
        <text
          key={i}
          x={center - negWidth + 8 + i * 40}
          y="44"
          fill="#ffffff"
          fontSize="10"
          fontWeight="600"
        >
          {c.token.length > 7 ? c.token.slice(0, 6) + "…" : c.token}
        </text>
      ))}

      {/* Positive blocks (supporting target class) */}
      <rect
        x={center}
        y="28"
        width={posWidth}
        height="24"
        fill="#ef4444"
        rx="4"
        opacity="0.85"
      />
      {topPos.map((c, i) => (
        <text
          key={i}
          x={center + 8 + i * 42}
          y="44"
          fill="#ffffff"
          fontSize="10"
          fontWeight="600"
        >
          {c.token.length > 7 ? c.token.slice(0, 6) + "…" : c.token}
        </text>
      ))}

      {/* Center divider pin */}
      <line x1={center} y1="20" x2={center} y2="60" stroke="#0f172a" strokeWidth="2.5" />
      <circle cx={center} cy="20" r="4" fill="#0f172a" />
      <text x={center - 32} y="15" fill="#475569" fontSize="10" fontWeight="700">
        Base {baseValue.toFixed(2)}
      </text>

      {/* Output value arrow */}
      <text x={center + posWidth + 8} y="44" fill="#ef4444" fontSize="11" fontWeight="700">
        f(x)={outputValue.toFixed(2)}
      </text>
    </svg>
  );
}
