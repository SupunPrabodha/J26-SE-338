"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Sidebar } from "../components/Sidebar";
import { RequireAuth } from "../components/RequireAuth";
import { useReviewCase } from "../context/CaseContext";
import { api, ApiError } from "@j26/common/api";
import type {
  C4ExplanationListResponse,
  C4ExplanationResponse,
  C4ExplanationSummary,
  C4StabilityRequest,
  C4StabilityResponse,
  C4StabilityWordConsistency,
} from "@j26/common/contracts";
import "../styles/StabilityEvaluator.css";

const SENTIMENT_COLORS: Record<string, string> = {
  Negative: "#ef4444",
  Neutral: "#3b82f6",
  Positive: "#16a34a",
};

interface ChartPoint {
  occurrence_id: string;
  name: string;
  run1Weight: number;
  selectedRunWeight: number;
  delta: number;
  otherCount?: number;
}

export default function StabilityPage() {
  const {
    authorized,
    selectedTask,
    selectedTaskId,
    selectedSentimentClass,
    devInput,
  } = useReviewCase();

  // State
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [savedNotice, setSavedNotice] = useState("");

  // Saved explanations list & selected explanation
  const [explanations, setExplanations] = useState<C4ExplanationSummary[]>([]);
  const [selectedExpId, setSelectedExpId] = useState<string>("");
  const [selectedExplanation, setSelectedExplanation] = useState<C4ExplanationResponse | null>(null);

  // Settings
  const [runCount, setRunCount] = useState<number>(5);
  const [topK, setTopK] = useState<number>(5);
  const [baseSeed, setBaseSeed] = useState<number>(42);
  const [explainerEvals, setExplainerEvals] = useState<number>(100);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Evaluation results & Selected run for comparison
  const [result, setResult] = useState<C4StabilityResponse | null>(null);
  const [selectedRunIndex, setSelectedRunIndex] = useState<number>(2);

  // Active request ref to ignore late responses
  const activeRequestRef = useRef(0);
  const isRestoringRef = useRef(false);
  const restoredEvalIdRef = useRef<string | null>(null);

  // Read original submission text from shared context
  const snapshot = devInput && devInput.text ? devInput : null;
  const submissionText = snapshot
    ? snapshot.text
    : selectedTask?.preprocessing?.anonymized_text || null;
  const caseLanguage = snapshot
    ? (snapshot.language || "English")
    : (selectedTask?.preprocessing?.language || "English");

  const prevTextRef = useRef<string | null>(submissionText);
  const prevTaskIdRef = useRef<string | null>(selectedTaskId);

  // Fetch list of saved explanations for this counsellor
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api<C4ExplanationListResponse>("/c4/explanations?limit=50");
        if (!cancelled) setExplanations(res.items || []);
      } catch {
        if (!cancelled) setExplanations([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch detailed saved explanation when selected
  useEffect(() => {
    if (!selectedExpId) {
      queueMicrotask(() => setSelectedExplanation(null));
      return;
    }
    let cancelled = false;
    async function fetchExp() {
      try {
        const exp = await api<C4ExplanationResponse>(`/c4/explanations/${selectedExpId}`);
        if (!cancelled) {
          setSelectedExplanation(exp);
        }
      } catch {
        if (!cancelled) setSelectedExplanation(null);
      }
    }
    fetchExp();
    return () => {
      cancelled = true;
    };
  }, [selectedExpId]);

  // Reset or clear stale results on text/source or settings change
  useEffect(() => {
    if (prevTextRef.current !== submissionText || prevTaskIdRef.current !== selectedTaskId) {
      prevTextRef.current = submissionText;
      prevTaskIdRef.current = selectedTaskId;
      if (!isRestoringRef.current) {
        queueMicrotask(() => {
          setResult(null);
          setError("");
          setStatusMessage("");
          setSavedNotice("");
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("evaluation_id");
            window.history.replaceState(null, "", url.toString());
          }
        });
      }
    }
  }, [submissionText, selectedTaskId]);


  // Check URL on mount for restored evaluation
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const evalId = params.get("evaluation_id");
    if (evalId && evalId !== restoredEvalIdRef.current) {
      restoredEvalIdRef.current = evalId;
      isRestoringRef.current = true;
      api<C4StabilityResponse>(`/c4/stability/${evalId}`)
        .then((res) => {
          setResult(res);
          setSelectedExpId(res.explanation_id);
          if (res.runs && res.runs.length > 1) {
            setSelectedRunIndex(2);
          } else {
            setSelectedRunIndex(1);
          }
          setSavedNotice(`Restored saved evaluation #${res.evaluation_id}`);
        })
        .catch(() => {
          setError("Failed to restore saved stability evaluation from database.");
        })
        .finally(() => {
          isRestoringRef.current = false;
        });
    }
  }, []);

  // Check source-match status between current text and explanation
  const sourceMatchStatus = useMemo<"matched" | "mismatched" | "unknown">(() => {
    if (!selectedExplanation || !submissionText) return "unknown";
    const textTrimmed = submissionText.trim();
    if (!textTrimmed) return "unknown";
    const tokens = selectedExplanation.tokens || [];
    if (tokens.length === 0) return "unknown";

    const cleanTokens = tokens
      .map((t) => t.trim())
      .filter((t) => t.length > 1 && !t.startsWith("[") && !t.startsWith("<"));
    if (cleanTokens.length === 0) return "unknown";

    const matchedTokens = cleanTokens.filter((t) => textTrimmed.includes(t));
    const ratio = matchedTokens.length / cleanTokens.length;

    return ratio >= 0.3 ? "matched" : "mismatched";
  }, [selectedExplanation, submissionText]);

  // Reset analysis results and clear URL evaluation parameter
  const handleResetAnalysis = () => {
    setResult(null);
    setError("");
    setStatusMessage("");
    setSavedNotice("");
    restoredEvalIdRef.current = null;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("evaluation_id");
      window.history.replaceState(null, "", url.toString());
    }
  };

  // Handle Run Analysis
  const handleRunAnalysis = async () => {
    if (!submissionText || !submissionText.trim()) {
      setError("No source text available in current case context.");
      return;
    }
    if (!selectedExpId || !selectedExplanation) {
      setError("Please select a saved explanation to analyze.");
      return;
    }

    if (sourceMatchStatus === "mismatched") {
      setError("Source text mismatch: The selected explanation was generated from different text than the current case input. Please select an explanation matching this case or generate a new explanation first.");
      setResult(null);
      return;
    }

    setIsBusy(true);
    setError("");
    setResult(null);
    setStatusMessage("Running independent explainer computations across distinct seeds...");
    setSavedNotice("");

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("evaluation_id");
      window.history.replaceState(null, "", url.toString());
    }
    restoredEvalIdRef.current = null;

    const reqId = ++activeRequestRef.current;

    const payload: C4StabilityRequest = {
      explanation_id: selectedExpId,
      text: submissionText,
      language: caseLanguage as C4StabilityRequest["language"],
      run_count: runCount,
      top_k: topK,
      base_seed: baseSeed,
      explainer_evals: explainerEvals,
      source_reference: selectedExplanation.source_reference || `case-${selectedTaskId || "dev"}`,
    };

    try {
      const res = await api<C4StabilityResponse>("/c4/stability", payload);

      if (activeRequestRef.current !== reqId) return;

      if (res.outcome === "TEXT_MISMATCH") {
        setError("Source text mismatch: current input text does not match the explanation's source text.");
        setResult(null);
        return;
      }
      if (res.outcome === "UNAVAILABLE_MODEL") {
        setError("Sentiment classifier model is currently unavailable.");
        setResult(null);
        return;
      }
      if (res.outcome === "INCOMPATIBLE_MODEL") {
        setError(res.outcome_message || "Explanation model revision does not match current model.");
        setResult(null);
        return;
      }
      if (res.outcome === "UNSUPPORTED_ALIGNMENT") {
        setError(res.outcome_message || "Reliable attribution alignment unavailable for this input.");
        setResult(null);
        return;
      }
      if (res.outcome === "OVERLENGTH_TEXT") {
        setError(res.outcome_message || "Input text exceeds maximum allowed length.");
        setResult(null);
        return;
      }
      if (res.outcome === "TIMEOUT") {
        setError("Stability analysis timed out before completing.");
        setResult(null);
        return;
      }
      if (res.outcome === "INFERENCE_FAILED") {
        setError(res.outcome_message || "Stability inference failed.");
        setResult(null);
        return;
      }

      setResult(res);
      setSelectedRunIndex(res.runs && res.runs.length > 1 ? 2 : 1);

      if (res.saved && res.evaluation_id) {
        setSavedNotice(`Confirmed & saved to database (ID: ${res.evaluation_id})`);
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("evaluation_id", String(res.evaluation_id));
          window.history.replaceState(null, "", url.toString());
        }
      } else {
        setSavedNotice("Completed (In-memory execution only)");
      }
      setStatusMessage("");
    } catch (err: unknown) {
      if (activeRequestRef.current !== reqId) return;
      setResult(null);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to complete stability evaluation. Please check the backend services.");
      }
      setStatusMessage("");
    } finally {
      if (activeRequestRef.current === reqId) {
        setIsBusy(false);
      }
    }
  };

  // Recharts Chart Data: Compare Run 1 Reference vs Currently Selected Run
  // Limits to the top 7 words with the highest magnitude attribution and groups
  // all other words into an "other" aggregate category showing their total attribution score.
  const chartData = useMemo<ChartPoint[]>(() => {
    if (!result || !result.runs || result.runs.length === 0) return [];

    const run1 = result.runs.find((r) => r.run_index === 1);
    const selectedRun =
      result.runs.find((r) => r.run_index === selectedRunIndex) || run1;

    if (!run1) return [];

    const occurrences: C4StabilityWordConsistency[] = result.word_consistency || [];

    const allPoints = occurrences.map((wc) => {
      const w1 = run1.weights?.[wc.occurrence_id] ?? 0.0;
      const wSel =
        selectedRunIndex === 1
          ? wc.mean_weight // When Run 1 is selected, compare against mean weight
          : selectedRun?.weights?.[wc.occurrence_id] ?? 0.0;

      const label = wc.word && wc.word.trim() ? wc.word : wc.occurrence_id;

      return {
        occurrence_id: wc.occurrence_id,
        name: label,
        run1Weight: Number(w1.toFixed(4)),
        selectedRunWeight: Number(wSel.toFixed(4)),
        delta: Number((wSel - w1).toFixed(4)),
        maxAbs: Math.max(Math.abs(w1), Math.abs(wSel)),
      };
    });

    if (allPoints.length <= 7) {
      return allPoints.sort((a, b) => b.maxAbs - a.maxAbs);
    }

    const sorted = [...allPoints].sort((a, b) => b.maxAbs - a.maxAbs);
    const top7 = sorted.slice(0, 7);
    const remaining = sorted.slice(7);

    const otherRun1 = remaining.reduce((sum, p) => sum + p.run1Weight, 0);
    const otherSel = remaining.reduce((sum, p) => sum + p.selectedRunWeight, 0);

    const otherPoint: ChartPoint = {
      occurrence_id: "other",
      name: "other",
      run1Weight: Number(otherRun1.toFixed(4)),
      selectedRunWeight: Number(otherSel.toFixed(4)),
      delta: Number((otherSel - otherRun1).toFixed(4)),
      otherCount: remaining.length,
    };

    return [...top7, otherPoint];
  }, [result, selectedRunIndex]);

  // Export Metrics CSV: numerical evidence/settings/provenance, excluding raw text by default
  const handleExportCsv = () => {
    if (!result) return;

    const lines: string[] = [];
    lines.push("# C4 STABILITY ANALYSIS METRICS REPORT");
    lines.push(`# Evaluation ID,${result.evaluation_id || "unsaved"}`);
    lines.push(`# Created At,${result.created_at || new Date().toISOString()}`);
    lines.push(`# Method,${result.method}`);
    lines.push(`# Explained Class,${result.explained_class}`);
    lines.push(`# Model ID,${result.model_id || "N/A"}`);
    lines.push(`# Model Revision,${result.model_revision || "N/A"}`);
    lines.push(`# Requested Runs,${result.requested_runs}`);
    lines.push(`# Completed Runs,${result.completed_runs}`);
    lines.push(`# Effective k,${result.effective_k}`);
    lines.push(`# Total Eligible Words,${result.total_eligible_words}`);
    lines.push(`# Mean Top-k Overlap,${result.mean_top_k_overlap !== null ? result.mean_top_k_overlap : "N/A"}`);
    lines.push(`# Mean Rank Correlation,${result.mean_rank_correlation !== null ? result.mean_rank_correlation : "N/A"}`);
    lines.push(`# Mean Attribution SD,${result.mean_attribution_std !== null ? result.mean_attribution_std : "N/A"}`);
    lines.push(`# Is Deterministic,${result.is_deterministic ? "true" : "false"}`);
    lines.push("");

    // Per-run summary table
    lines.push("RUN METRICS");
    lines.push("run_index,seed,is_reference,status,top_k_overlap,rank_correlation,execution_time_ms");
    (result.runs || []).forEach((r) => {
      lines.push(
        [
          r.run_index,
          r.seed !== null ? r.seed : "",
          r.is_reference ? "true" : "false",
          r.status,
          r.top_k_overlap !== null ? r.top_k_overlap : "",
          r.rank_correlation !== null ? r.rank_correlation : "",
          r.execution_time_ms ? r.execution_time_ms.toFixed(1) : "",
        ].join(",")
      );
    });
    lines.push("");

    // Word consistency table
    lines.push("WORD CONSISTENCY METRICS");
    lines.push("occurrence_id,start_offset,end_offset,mean_weight,attribution_std,top_k_frequency,run_occurrence_count");
    (result.word_consistency || []).forEach((wc) => {
      lines.push(
        [
          wc.occurrence_id,
          wc.start,
          wc.end,
          wc.mean_weight.toFixed(5),
          wc.std_dev !== null && wc.std_dev !== undefined ? wc.std_dev.toFixed(5) : "",
          wc.top_k_frequency.toFixed(4),
          wc.run_occurrence_count,
        ].join(",")
      );
    });

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(lines.join("\n"));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", csvContent);
    downloadAnchor.setAttribute(
      "download",
      `stability_metrics_${result.evaluation_id || "eval"}.csv`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const wordCount = submissionText ? submissionText.trim().split(/\s+/).length : 0;
  const probabilities =
    (selectedExplanation?.probabilities as Record<string, number> | undefined) ||
    {};



  return (
    <RequireAuth workspace="research">
      <div className="stab-page-container">
        <Sidebar isClassifierConnected={authorized} />

      <main className="stab-main">
        {/* Header */}
        <header className="stab-header">
          <div className="stab-header-title-block">
            <h1 className="stab-main-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Stability Analysis
            </h1>
            <p className="stab-main-subtitle">
              Repeated-run explainer consistency and perturbation variability analysis
            </p>
          </div>

          <div className="stab-header-actions">
            <div className="stab-header-pill">
              <div className="stab-user-avatar-circle">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="stab-user-text-info">
                <span className="stab-user-name">Authorized Counsellor</span>
                <span className="stab-user-role">Screening Review</span>
              </div>
            </div>
          </div>
        </header>

        {/* Non-diagnostic Advisory Banner */}
        <div className="stab-advisory-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <strong>Non-Diagnostic Wellbeing Screening Support:</strong> This module measures repeated-run
            stability and explainer consistency, not model correctness, faithfulness, or clinical validity.
            Authorized human review is required; outputs do not replace professional counselling or clinical diagnosis.
          </div>
        </div>

        {/* Status & Error Alerts */}
        {error && (
          <div className="stab-alert-error" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>{error}</div>
          </div>
        )}

        {statusMessage && (
          <div className="stab-alert-info">
            <div className="stab-spinner" />
            <div>{statusMessage}</div>
          </div>
        )}

        {savedNotice && !error && (
          <div className="stab-advisory-banner" style={{ background: "#f0fdf4", borderColor: "#86efac", color: "#166534" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div>{savedNotice}</div>
          </div>
        )}

        {/* TOP ROW: 3 Cards Side by Side */}
        <section className="stab-top-grid" aria-label="Overview Cards">
          {/* Card 1: Input Text */}
          <div className="stab-top-card">
            <div className="stab-card-header">
              <span className="stab-card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Input Text
              </span>
              <span className="stab-card-badge stab-badge-neutral">
                {wordCount} words
              </span>
            </div>
            <div className="stab-card-body">
              {submissionText ? (
                <div className="stab-source-text-box">
                  {submissionText}
                </div>
              ) : (
                <div className="stab-source-text-box" style={{ color: "#94a3b8", fontStyle: "italic" }}>
                  No case submission loaded. Select a task or enter development input.
                </div>
              )}
              <div className="stab-meta-row" style={{ marginTop: 6 }}>
                <span className="stab-meta-label">Language:</span>
                <span className="stab-meta-val">{caseLanguage}</span>
              </div>
              <div className="stab-meta-row">
                <span className="stab-meta-label">Context:</span>
                <span className="stab-meta-val">{selectedTaskId ? `Case #${selectedTaskId.slice(0, 8)}` : "Development Session"}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Original Model Prediction */}
          <div className="stab-top-card">
            <div className="stab-card-header">
              <span className="stab-card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Original Model Prediction
              </span>
              {selectedExplanation?.predicted_class && (
                <span
                  className="stab-card-badge"
                  style={{
                    backgroundColor: `${SENTIMENT_COLORS[selectedExplanation.predicted_class] || "#6366f1"}15`,
                    color: SENTIMENT_COLORS[selectedExplanation.predicted_class] || "#6366f1",
                    border: `1px solid ${SENTIMENT_COLORS[selectedExplanation.predicted_class] || "#6366f1"}40`,
                  }}
                >
                  {selectedExplanation.predicted_class}
                </span>
              )}
            </div>
            <div className="stab-card-body">
              <div className="stab-prob-bars">
                {["Negative", "Neutral", "Positive"].map((cls) => {
                  const prob = probabilities[cls] ?? 0;
                  const pct = Math.round(prob * 100);
                  const color = SENTIMENT_COLORS[cls] || "#6366f1";
                  return (
                    <div key={cls} className="stab-prob-item">
                      <span className="stab-prob-name">{cls}</span>
                      <div className="stab-prob-track">
                        <div
                          className="stab-prob-fill"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="stab-prob-pct">{pct}%</span>
                    </div>
                  );
                })}
              </div>
              <div className="stab-meta-row" style={{ marginTop: 8 }}>
                <span className="stab-meta-label">Explained Target:</span>
                <span className="stab-meta-val">{selectedExplanation?.target_class || selectedSentimentClass || "Negative"}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Selected Explanation */}
          <div className="stab-top-card">
            <div className="stab-card-header">
              <span className="stab-card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Selected Explanation
              </span>
              <span
                className={`stab-card-badge ${
                  sourceMatchStatus === "matched"
                    ? "stab-badge-match"
                    : sourceMatchStatus === "mismatched"
                    ? "stab-badge-mismatch"
                    : "stab-badge-neutral"
                }`}
                title={
                  sourceMatchStatus === "matched"
                    ? "Explanation tokens match current source text"
                    : sourceMatchStatus === "mismatched"
                    ? "Explanation was generated for different text"
                    : "Pending verification"
                }
              >
                {sourceMatchStatus === "matched"
                  ? "Source Verified"
                  : sourceMatchStatus === "mismatched"
                  ? "Text Mismatch"
                  : "Pending Match"}
              </span>
            </div>
            <div className="stab-card-body">
              <select
                id="select-explanation"
                className="stab-select"
                value={selectedExpId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedExpId(newId);
                  handleResetAnalysis();
                }}
                aria-label="Select saved explanation"
              >
                <option value="">-- Choose saved LIME or SHAP explanation --</option>
                {explanations.map((exp) => (
                  <option key={exp.explanation_id} value={exp.explanation_id}>
                    {exp.method} ({exp.target_class}) - {new Date(exp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </option>
                ))}
              </select>

              <div className="stab-meta-row" style={{ marginTop: 4 }}>
                <span className="stab-meta-label">Method:</span>
                <span className="stab-meta-val">{selectedExplanation?.method || "—"}</span>
              </div>
              <div className="stab-meta-row">
                <span className="stab-meta-label">Explained Class:</span>
                <span className="stab-meta-val">{selectedExplanation?.target_class || "—"}</span>
              </div>
              <div className="stab-meta-row">
                <span className="stab-meta-label">Model / Rev:</span>
                <span className="stab-meta-val" title={selectedExplanation?.model_id || undefined}>
                  {selectedExplanation?.model_revision || (selectedExplanation?.model_id ? selectedExplanation.model_id.split("/").pop() : "—")}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* CONTROLS SECTION */}
        <section className="stab-controls-card" aria-label="Stability Controls">
          <div className="stab-controls-grid">
            <div className="stab-field-group">
              <label htmlFor="input-run-count" className="stab-field-label">
                Run Count (k runs)
              </label>
              <input
                id="input-run-count"
                type="number"
                min={2}
                max={20}
                className="stab-input"
                style={{ width: "120px" }}
                value={runCount}
                onChange={(e) => setRunCount(Math.max(2, Math.min(20, parseInt(e.target.value) || 2)))}
                disabled={isBusy}
              />
            </div>

            <div className="stab-field-group">
              <label htmlFor="input-top-k" className="stab-field-label">
                Top Words (Top-k)
              </label>
              <input
                id="input-top-k"
                type="number"
                min={1}
                max={50}
                className="stab-input"
                style={{ width: "120px" }}
                value={topK}
                onChange={(e) => setTopK(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                disabled={isBusy}
              />
            </div>

            <button
              id="btn-run-stability"
              type="button"
              className="stab-btn-run"
              onClick={handleRunAnalysis}
              disabled={isBusy || !selectedExpId || !submissionText}
              title="Execute repeated explanation runs with distinct seeds"
            >
              {isBusy ? (
                <>
                  <span className="stab-spinner" />
                  <span>Computing Runs...</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Run Stability Analysis</span>
                </>
              )}
            </button>

            {(result || selectedExpId) && (
              <button
                type="button"
                className="stab-btn-secondary"
                onClick={handleResetAnalysis}
                disabled={isBusy}
                title="Clear current stability results and reset analysis view"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                <span>Reset View</span>
              </button>
            )}

            <button
              type="button"
              className="stab-advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              {showAdvanced ? "Hide Advanced Settings" : "Advanced Settings"}
            </button>
          </div>

          {showAdvanced && (
            <div className="stab-advanced-panel">
              <div className="stab-field-group">
                <label htmlFor="input-base-seed" className="stab-field-label">
                  Base Random Seed
                </label>
                <input
                  id="input-base-seed"
                  type="number"
                  min={0}
                  className="stab-input"
                  style={{ width: "120px" }}
                  value={baseSeed}
                  onChange={(e) => setBaseSeed(Math.max(0, parseInt(e.target.value) || 0))}
                  disabled={isBusy}
                />
              </div>

              <div className="stab-field-group">
                <label htmlFor="input-evals" className="stab-field-label">
                  Explainer Evaluations (Samples / Max Evals)
                </label>
                <input
                  id="input-evals"
                  type="number"
                  min={10}
                  max={500}
                  className="stab-input"
                  style={{ width: "150px" }}
                  value={explainerEvals}
                  onChange={(e) => setExplainerEvals(Math.max(10, Math.min(500, parseInt(e.target.value) || 100)))}
                  disabled={isBusy}
                />
              </div>
            </div>
          )}
        </section>

        {/* SUMMARY SECTION: 4 Metric Cards */}
        {result && (
          <section className="stab-summary-grid" aria-label="Stability Metrics Summary">
            {/* Card 1: Mean Top-k Overlap */}
            <div className="stab-summary-card">
              <span className="stab-summary-label">Mean Top-k Overlap</span>
              <span className="stab-summary-val" id="metric-mean-overlap">
                {result.mean_top_k_overlap !== null && result.mean_top_k_overlap !== undefined
                  ? `${(result.mean_top_k_overlap * 100).toFixed(1)}%`
                  : "N/A"}
              </span>
              <span className="stab-summary-sub">
                Effective k = {result.effective_k} (vs Run 1 reference)
              </span>
            </div>

            {/* Card 2: Mean Rank Correlation */}
            <div className="stab-summary-card">
              <span className="stab-summary-label">Mean Rank Correlation</span>
              <span className="stab-summary-val" id="metric-mean-corr">
                {result.mean_rank_correlation !== null && result.mean_rank_correlation !== undefined
                  ? result.mean_rank_correlation.toFixed(3)
                  : "N/A"}
              </span>
              <span className="stab-summary-sub">
                Spearman rank corr across all eligible words
              </span>
            </div>

            {/* Card 3: Mean Attribution SD */}
            <div className="stab-summary-card">
              <span className="stab-summary-label">Mean Attribution SD</span>
              <span className="stab-summary-val" id="metric-mean-sd">
                {result.mean_attribution_std !== null && result.mean_attribution_std !== undefined
                  ? result.mean_attribution_std.toFixed(4)
                  : "N/A"}
              </span>
              <span className="stab-summary-sub">
                Attribution weight scale (not probability)
              </span>
            </div>

            {/* Card 4: Completed / Requested Runs */}
            <div className="stab-summary-card">
              <span className="stab-summary-label">Completed Runs</span>
              <span className="stab-summary-val" id="metric-completed-runs">
                {result.completed_runs} / {result.requested_runs}
              </span>
              <span className="stab-summary-sub">
                {result.outcome === "SUCCESS" ? "All runs finished" : "Partial execution reported"}
              </span>
            </div>
          </section>
        )}

        {/* COMPARISON GRID: Run Inspection Table + Recharts Signed Attribution Comparison Chart */}
        {result && result.runs && result.runs.length > 0 && (
          <section className="stab-comparison-grid" aria-label="Run Comparison and Attribution Chart">
            {/* Left: Run Inspection Table */}
            <div className="stab-run-table-card">
              <div className="stab-section-title">
                <span>Run Inspection Table</span>
                <span style={{ fontSize: "11.5px", fontWeight: 500, color: "#64748b" }}>
                  Click a row to compare against Run 1
                </span>
              </div>
              <div className="stab-table-responsive">
                <table className="stab-table" id="runs-inspection-table">
                  <thead>
                    <tr>
                      <th>Run</th>
                      <th>Seed</th>
                      <th>Overlap</th>
                      <th>Rank Corr</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.runs.map((r) => {
                      const isSelected = r.run_index === selectedRunIndex;
                      const isRef = r.is_reference;
                      return (
                        <tr
                          key={r.run_index}
                          className={`stab-table-row ${isSelected ? "stab-table-row-active" : ""}`}
                          onClick={() => setSelectedRunIndex(r.run_index)}
                          title={`Select Run ${r.run_index} to compare in attribution chart`}
                        >
                          <td>
                            <strong>Run {r.run_index}</strong>{" "}
                            {isRef && <span className="stab-run-ref-tag">Ref</span>}
                            {!isRef && isSelected && (
                              <span className="stab-run-selected-tag">Selected</span>
                            )}
                          </td>
                          <td style={{ fontFamily: "monospace", fontSize: "11.5px" }}>
                            {r.seed !== null ? r.seed : "—"}
                          </td>
                          <td>
                            {isRef
                              ? "— (Ref)"
                              : r.top_k_overlap !== null && r.top_k_overlap !== undefined
                              ? `${(r.top_k_overlap * 100).toFixed(0)}%`
                              : "N/A"}
                          </td>
                          <td>
                            {isRef
                              ? "— (Ref)"
                              : r.rank_correlation !== null && r.rank_correlation !== undefined
                              ? r.rank_correlation.toFixed(3)
                              : "N/A"}
                          </td>
                          <td>
                            <span
                              className="stab-card-badge"
                              style={{
                                backgroundColor: r.status === "SUCCESS" ? "#dcfce7" : "#fee2e2",
                                color: r.status === "SUCCESS" ? "#166534" : "#991b1b",
                              }}
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Recharts Signed Attribution Comparison Chart */}
            <div className="stab-chart-card">
              <div className="stab-section-title">
                <span>Signed Attribution Comparison</span>
                <span style={{ fontSize: "12px", color: "#6366f1", fontWeight: 600 }}>
                  Run 1 (Reference) vs{" "}
                  {selectedRunIndex === 1
                    ? "Mean Weight (All Runs)"
                    : `Run ${selectedRunIndex}`}
                </span>
              </div>
              <div style={{ width: "100%", height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 15, right: 25, left: 15, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="occurrence_id"
                      tickFormatter={(id) => {
                        const item = chartData.find((d) => d.occurrence_id === id);
                        return item ? item.name : id;
                      }}
                      interval={0}
                      tick={{ fontSize: 12, fill: "#334155" }}
                      width={85}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as ChartPoint;
                          return (
                            <div
                              style={{
                                background: "#ffffff",
                                border: "1px solid #cbd5e1",
                                borderRadius: "8px",
                                padding: "8px 12px",
                                fontSize: "12px",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                              }}
                            >
                              <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                                {data.name}
                                {data.occurrence_id && data.occurrence_id !== "other"
                                  ? ` (${data.occurrence_id})`
                                  : data.otherCount
                                  ? ` (${data.otherCount} words)`
                                  : ""}
                              </div>
                              <div style={{ color: "#4f46e5" }}>
                                Run 1 (Ref): {data.run1Weight.toFixed(4)}
                              </div>
                              <div style={{ color: "#f59e0b" }}>
                                {selectedRunIndex === 1 ? "Mean Weight" : `Run ${selectedRunIndex}`}:{" "}
                                {data.selectedRunWeight.toFixed(4)}
                              </div>
                              <div style={{ color: "#64748b", marginTop: "2px", fontSize: "11px" }}>
                                Delta: {data.delta > 0 ? `+${data.delta.toFixed(4)}` : data.delta.toFixed(4)}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend verticalAlign="top" height={32} />
                    <ReferenceLine x={0} stroke="#94a3b8" strokeWidth={1.5} />
                    <Bar
                      dataKey="run1Weight"
                      name="Run 1 (Reference)"
                      fill="#6366f1"
                      radius={[2, 2, 2, 2]}
                    />
                    <Bar
                      dataKey="selectedRunWeight"
                      name={selectedRunIndex === 1 ? "Overall Mean" : `Run ${selectedRunIndex}`}
                      fill="#f59e0b"
                      radius={[2, 2, 2, 2]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}

        {/* WORD CONSISTENCY TABLE */}
        {result && result.word_consistency && result.word_consistency.length > 0 && (
          <section className="stab-word-consistency-card" aria-label="Word Consistency Table">
            <div className="stab-section-title">
              <span>Word Consistency Table</span>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>
                {result.word_consistency.length} eligible word occurrences across {result.completed_runs} successful runs
              </span>
            </div>
            <div className="stab-table-responsive">
              <table className="stab-table" id="word-consistency-table">
                <thead>
                  <tr>
                    <th>Occurrence</th>
                    <th>Word Label</th>
                    <th>Mean Signed Weight</th>
                    <th>Attribution SD</th>
                    <th>Top-k Frequency</th>
                    <th>Occurrence Runs</th>
                  </tr>
                </thead>
                <tbody>
                  {result.word_consistency.map((wc) => {
                    const isPos = wc.mean_weight >= 0;
                    const freqPct = Math.round(wc.top_k_frequency * 100);
                    return (
                      <tr key={wc.occurrence_id}>
                        <td style={{ fontFamily: "monospace", fontSize: "11.5px", color: "#64748b" }}>
                          {wc.occurrence_id}
                        </td>
                        <td>
                          {wc.word && wc.word.trim() ? (
                            <strong style={{ fontSize: "13px" }}>{wc.word}</strong>
                          ) : (
                            <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "11.5px" }}>
                              {wc.occurrence_id} (source unavailable)
                            </span>
                          )}
                        </td>
                        <td className={isPos ? "stab-weight-pos" : "stab-weight-neg"}>
                          {isPos ? `+${wc.mean_weight.toFixed(4)}` : wc.mean_weight.toFixed(4)}
                        </td>
                        <td>
                          {wc.std_dev !== null && wc.std_dev !== undefined
                            ? wc.std_dev.toFixed(4)
                            : "N/A"}
                        </td>
                        <td>
                          <div className="stab-freq-bar-bg">
                            <div className="stab-freq-bar-fill" style={{ width: `${freqPct}%` }} />
                          </div>
                          <span style={{ fontWeight: 600 }}>{freqPct}%</span>
                        </td>
                        <td>
                          {wc.run_occurrence_count} / {result.completed_runs}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* BOTTOM SECTION: Collapsed Run Details, Save Status & Export Metrics CSV */}
        {result && (
          <section className="stab-bottom-section" aria-label="Details and Export">
            <details className="stab-details-card">
              <summary className="stab-details-summary">
                <span>View Full Execution Details & Provenance</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </summary>
              <div className="stab-details-content">
                <div className="stab-meta-row">
                  <span className="stab-meta-label">Evaluation ID:</span>
                  <span className="stab-meta-val" style={{ fontFamily: "monospace" }}>{result.evaluation_id || "Unsaved"}</span>
                </div>
                <div className="stab-meta-row">
                  <span className="stab-meta-label">Model ID / Version:</span>
                  <span className="stab-meta-val">{result.model_id || "default"}</span>
                </div>
                <div className="stab-meta-row">
                  <span className="stab-meta-label">Model Revision:</span>
                  <span className="stab-meta-val">{result.model_revision || "N/A"}</span>
                </div>
                <div className="stab-meta-row">
                  <span className="stab-meta-label">Effective k:</span>
                  <span className="stab-meta-val">{result.effective_k} (Requested: {topK})</span>
                </div>
                <div className="stab-meta-row">
                  <span className="stab-meta-label">Execution Time:</span>
                  <span className="stab-meta-val">{result.execution_time_ms ? `${(result.execution_time_ms / 1000).toFixed(2)}s` : "—"}</span>
                </div>
                <div className="stab-meta-row">
                  <span className="stab-meta-label">Determinism:</span>
                  <span className="stab-meta-val">{result.is_deterministic ? "Deterministic Explainer" : "Stochastic explainer"}</span>
                </div>
                {result.determinism_notice && (
                  <div style={{ gridColumn: "1 / -1", fontSize: "12px", color: "#64748b", background: "#f8fafc", padding: "8px 12px", borderRadius: "6px" }}>
                    <strong>Note:</strong> {result.determinism_notice}
                  </div>
                )}
                {result.stopping_reason && (
                  <div style={{ gridColumn: "1 / -1", fontSize: "12px", color: "#b45309", background: "#fffbeb", padding: "8px 12px", borderRadius: "6px" }}>
                    <strong>Stopping Reason:</strong> {result.stopping_reason}
                  </div>
                )}
              </div>
            </details>

            <div className="stab-footer-actions">
              <div className="stab-save-pill">
                {savedNotice ? (
                  <span className="stab-card-badge stab-save-confirmed">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: 4 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {savedNotice}
                  </span>
                ) : (
                  <span className="stab-card-badge stab-save-inmemory">
                    In-memory execution
                  </span>
                )}
              </div>

              <button
                id="btn-export-metrics-csv"
                type="button"
                className="stab-btn-export-csv"
                onClick={handleExportCsv}
                title="Export numerical metrics and provenance as CSV"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export Metrics CSV
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
    </RequireAuth>
  );
}
