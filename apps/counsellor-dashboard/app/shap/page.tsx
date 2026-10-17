"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sidebar } from "../components/Sidebar";
import { useReviewCase } from "../context/CaseContext";
import type { C4ExplanationResponse, FeatureContribution } from "@j26/common/contracts";

export default function ShapPage() {
  const { selectedTask, selectedTaskId, tasks, selectTask } = useReviewCase();

  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [explanation, setExplanation] = useState<C4ExplanationResponse | null>(null);
  const [isClassifierConnected, setIsClassifierConnected] = useState(false);

  // Ignore late responses across case changes
  const activeRequestRef = useRef(0);

  // Clear previous results whenever the selected case/task changes
  useEffect(() => {
    activeRequestRef.current += 1;
    setExplanation(null);
    setError("");
    setStatusMessage("");
  }, [selectedTaskId]);

  const submissionText = selectedTask?.preprocessing?.anonymized_text ?? null;
  const caseLanguage = selectedTask?.preprocessing?.language ?? "English (Code-mixed)";
  const targetClass = selectedTask?.inference?.wellbeing_indicator || "High Stress";

  // Check classifier status on mount
  useEffect(() => {
    let mounted = true;
    fetch("/api/c4-explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "probe connection",
        method: "SHAP",
      }),
    })
      .then(async (res) => {
        if (!mounted) return;
        if (res.ok) {
          const data = (await res.json()) as C4ExplanationResponse;
          setIsClassifierConnected(data.status === "READY");
        } else {
          setIsClassifierConnected(false);
        }
      })
      .catch(() => {
        if (mounted) setIsClassifierConnected(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleRunShap() {
    if (!submissionText) {
      setError("Cannot compute explanations: submission text is unavailable in the current ReviewTask contract.");
      return;
    }

    const currentReqId = ++activeRequestRef.current;
    setIsBusy(true);
    setError("");
    setStatusMessage("Running SHAP additive explanation with text masker...");

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
        setStatusMessage("SHAP additive explanation computed successfully.");
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
  const strengthLabel = parseFloat(meanAbsShap) > 0.15 ? "Strong" : parseFloat(meanAbsShap) > 0.05 ? "Moderate" : "Subtle";

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
    link.setAttribute("download", `shap_values_${selectedTaskId || "case"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tokenCount = submissionText ? submissionText.trim().split(/\s+/).length : 0;
  const canCompute = Boolean(submissionText);

  const baseValue = explanation?.base_value ?? 0.0;
  const outputValue = explanation?.output_value ?? (explanation?.target_class_probability ?? 0.0);

  return (
    <div className="shap-page-container">
      <Sidebar isClassifierConnected={isClassifierConnected} />

      <main className="shap-main" id="content">
        {/* Top Header */}
        <header className="shap-header">
          <div className="shap-header-title-block">
            <h1 className="shap-main-title">SHAP Additive Explanations</h1>
            <p className="shap-main-subtitle">
              SHAP (SHapley Additive exPlanations) attribute each token's contribution to the prediction.
            </p>
          </div>

          <div className="lime-header-actions">
            {/* Case selector dropdown if multiple tasks available */}
            {tasks.length > 1 ? (
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
                  {tasks.map((t) => (
                    <option key={t.task_id} value={t.task_id}>
                      {String(t.task_id).slice(0, 8)}... ({t.inference?.wellbeing_indicator || "Screening"})
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

            {/* Language Pill (Read-only metadata from case) */}
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

        {/* Screening Support Banner */}
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
                  <div>
                    <p className="shap-input-line-1" style={{ color: "#64748b", fontStyle: "italic" }}>
                      Submission text unavailable
                    </p>
                    <p className="shap-input-line-2" style={{ color: "#94a3b8", fontSize: "11px", marginTop: "4px" }}>
                      Current C1 ReviewTask contract provides inference &amp; explanation receipts, but excludes raw/preprocessed submission text.
                    </p>
                    <p style={{ fontSize: "10px", color: "#b91c1c", marginTop: "6px" }}>
                      Contract extension required: extend ReviewTask with PreprocessResponse
                    </p>
                  </div>
                )}
              </div>

              <div className="shap-input-meta-row">
                <span className="shap-meta-label">Detected Language:</span>
                <span className="shap-meta-pill-sinhala">Language: {caseLanguage}</span>
              </div>

              <div className="shap-input-bottom-row">
                <span>Tokens: {tokenCount}</span>
                <span>Explained Class: <span className="shap-explained-class-val">{targetClass}</span></span>
              </div>

              {/* Action row with compute button */}
              <div style={{ marginTop: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "10px" }}>
                <button
                  type="button"
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
                  {isBusy ? "Computing SHAP..." : "Compute SHAP Values"}
                </button>
                {!submissionText && (
                  <p style={{ fontSize: "10px", color: "#64748b", marginTop: "5px", textAlign: "center" }}>
                    Explanation action disabled: submission text is unavailable in the current ReviewTask contract and C3 classifier connection is pending.
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
              </div>

              {explanation && explanation.target_class_probability != null ? (
                <>
                  <div className="shap-prediction-main-row">
                    <div className="shap-stress-label">{explanation.target_class || targetClass}</div>
                    <div className="shap-confidence-badge">
                      <span className="shap-score-percent">
                        {Math.round(explanation.target_class_probability * 100)}%
                      </span>
                      <span className="shap-score-sublabel">Confidence</span>
                    </div>
                  </div>
                  <div className="shap-spectrum-slider-wrap">
                    <div className="shap-spectrum-labels-top">
                      <span className="shap-spectrum-left-label">{explanation.target_class || targetClass}</span>
                      <span className="shap-spectrum-right-label">Low Stress</span>
                    </div>
                    <div className="shap-spectrum-bar-track">
                      <div
                        className="shap-spectrum-indicator-pin"
                        style={{
                          left: `${Math.max(5, Math.min(95, Math.round((1 - explanation.target_class_probability) * 100)))}%`,
                        }}
                      ></div>
                    </div>
                    <div className="shap-spectrum-ticks-bottom">
                      <span>0%</span>
                      <span>25%</span>
                      <span>50%</span>
                      <span>75%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: "16px 0", textAlign: "center" }}>
                  <div className="shap-stress-label" style={{ fontSize: "16px", color: "#64748b", marginBottom: "8px" }}>
                    Pending C3 integration
                  </div>
                  <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0 }}>
                    Model Prediction: Pending C3 integration
                  </p>
                  <p style={{ fontSize: "10.5px", color: "#94a3b8", marginTop: "4px" }}>
                    Awaiting C3 classifier integration for live probability distribution.
                  </p>
                  <div className="shap-spectrum-slider-wrap" style={{ marginTop: "14px", opacity: 0.35 }}>
                    <div className="shap-spectrum-bar-track">
                      <div className="shap-spectrum-indicator-pin" style={{ left: "50%" }}></div>
                    </div>
                  </div>
                </div>
              )}
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
                  <p style={{ fontWeight: 600, color: "#64748b", margin: "0 0 4px" }}>No Summary Available</p>
                  <p style={{ margin: 0 }}>Run SHAP attribution to compute token decomposition balance.</p>
                </div>
              )}
            </div>
          </div>

          {/* ROW 2: Feature Importance (Left) & Force Plot / Beeswarm (Right) */}
          <div className="shap-row shap-row-middle-split">
            {/* Left Card: SHAP Feature Importance */}
            <div className="shap-card shap-card-features">
              <div className="shap-card-header">
                <div className="shap-card-title-group">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  <h3 className="shap-card-title">SHAP Feature Importance (mean |SHAP value|)</h3>
                  <span className="shap-info-icon-small" title="Attribution calculated via Shapley values">
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
                          <th style={{ textAlign: "left" }}>Impact</th>
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
                    No Attribution Values Available
                  </p>
                  <p style={{ margin: 0, fontSize: "11px" }}>
                    Compute SHAP additive values to inspect feature attributions.
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
                      <h3 className="shap-card-title">SHAP Force Plot (this prediction)</h3>
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
                        No SHAP Waterfall / Force Plot Available
                      </p>
                      <p style={{ margin: 0 }}>
                        Local waterfall / force decomposition will render upon SHAP calculation.
                      </p>
                    </div>
                  )}
                </div>

                {/* Card: Prediction Probabilities & SHAP Info */}
                <div className="shap-card shap-card-probs">
                  <div className="shap-card-header" style={{ marginBottom: 6 }}>
                    <div className="shap-card-title-group">
                      <h3 className="shap-card-title">Prediction Probabilities</h3>
                      <span className="shap-info-icon-small" title="Overall prediction probabilities">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
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
                        <span className="shap-info-lbl">Model Type</span>
                        <span className="shap-info-val">Transformer (XLM-RoBERTa)</span>
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
                        <span className="shap-info-lbl">Output Class</span>
                        <span className="shap-info-val">{targetClass}</span>
                      </div>
                      <div className="shap-info-item">
                        <span className="shap-info-lbl">Features</span>
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
                    <span className="shap-info-icon-small" title="Distribution of SHAP values across samples">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </span>
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
                {hasResults && contributions.length > 0 ? (
                  <>
                    Tokens like{" "}
                    <strong>
                      "{contributions.filter((c) => c.weight > 0).slice(0, 3).map((c) => c.token).join('", "') || "none"}"
                    </strong>{" "}
                    strongly push the prediction towards {targetClass}.
                  </>
                ) : (
                  "Awaiting C3 classifier integration to compute token attributions and summary."
                )}
              </p>
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
  const pos = contributions.filter((c) => c.weight > 0).sort((a, b) => b.weight - a.weight);
  const neg = contributions.filter((c) => c.weight < 0).sort((a, b) => a.weight - b.weight);

  const toX = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    return 20 + clamped * 280;
  };

  const baseX = toX(baseValue);
  const outX = toX(outputValue);

  return (
    <svg className="shap-force-svg" viewBox="0 0 340 85" aria-label="SHAP Local Waterfall Plot">
      {/* Top axis line */}
      <line x1="20" y1="16" x2="300" y2="16" stroke="#cbd5e1" strokeWidth="1" />
      <text x="20" y="11" fill="#64748b" fontSize="8" textAnchor="middle">
        0.00
      </text>
      <text x="90" y="11" fill="#64748b" fontSize="8" textAnchor="middle">
        0.25
      </text>
      <text x="160" y="11" fill="#64748b" fontSize="8" textAnchor="middle">
        0.50
      </text>
      <text x="230" y="11" fill="#64748b" fontSize="8" textAnchor="middle">
        0.75
      </text>
      <text x="300" y="11" fill="#64748b" fontSize="8" textAnchor="middle">
        1.00
      </text>
      {/* Indicator ticks for base value and output value */}
      <line x1={baseX} y1="13" x2={baseX} y2="19" stroke="#4338ca" strokeWidth="2" />
      <line x1={outX} y1="13" x2={outX} y2="19" stroke="#ef4444" strokeWidth="2" />
      <text x="320" y="27" fill="#0f172a" fontSize="8.5" fontWeight="700">
        f(x)
      </text>

      {/* Chevrons representing positive contributions pushing right */}
      {pos.slice(0, 4).map((p, idx) => {
        const xStart = 20 + idx * 46;
        const xEnd = xStart + 40;
        const colors = ["#ef4444", "#f87171", "#fca5a5", "#fecaca"];
        const color = colors[idx % colors.length];
        return (
          <g key={`pos-${idx}`}>
            <polygon
              points={`${xStart},24 ${xEnd},24 ${xEnd + 8},32 ${xEnd},40 ${xStart},40 ${xStart + 8},32`}
              fill={color}
            />
            <text x={xStart + 20} y="52" fill="#dc2626" fontSize="7.5" fontWeight="700" textAnchor="middle">
              {p.token}
            </text>
            <text x={xStart + 20} y="60" fill="#dc2626" fontSize="7" textAnchor="middle">
              +{p.weight.toFixed(3)}
            </text>
          </g>
        );
      })}

      {/* Chevrons representing negative contributions pushing left */}
      {neg.slice(0, 3).map((n, idx) => {
        const xStart = 210 + idx * 30;
        const xEnd = xStart + 28;
        const colors = ["#86efac", "#4ade80", "#16a34a"];
        const color = colors[idx % colors.length];
        return (
          <g key={`neg-${idx}`}>
            <polygon
              points={`${xStart},24 ${xEnd},24 ${xEnd + 8},32 ${xEnd},40 ${xStart},40 ${xStart + 8},32`}
              fill={color}
            />
            <text x={xStart + 14} y="52" fill="#15803d" fontSize="7.5" fontWeight="700" textAnchor="middle">
              {n.token}
            </text>
            <text x={xStart + 14} y="60" fill="#15803d" fontSize="7" textAnchor="middle">
              {n.weight.toFixed(3)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
