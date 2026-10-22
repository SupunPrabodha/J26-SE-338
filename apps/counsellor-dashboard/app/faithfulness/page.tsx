"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { Sidebar } from "../components/Sidebar";
import { useReviewCase } from "../context/CaseContext";
import { api, ApiError } from "@j26/common/api";
import type {
  C4ExplanationListResponse,
  C4ExplanationResponse,
  C4ExplanationSummary,
  C4FaithfulnessRequest,
  C4FaithfulnessResponse,
  C4FaithfulnessStepResult,
} from "@j26/common/contracts";
import "../styles/FaithfulnessEvaluator.css";

const SENTIMENT_COLORS: Record<string, string> = {
  Negative: "#ef4444",
  Neutral: "#3b82f6",
  Positive: "#16a34a",
};

interface ChartPoint {
  k: number;
  importantProb: number;
  randomMeanProb?: number;
  randomUpper?: number;
  randomLower?: number;
  importantDrop: number;
  randomDrop?: number;
}

export default function FaithfulnessPage() {
  const {
    authorized,
    checking,
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

  // Faithfulness settings
  const [budgetMode, setBudgetMode] = useState<"words" | "pct">("words");
  const [maxWords, setMaxWords] = useState<number>(5);
  const [maxPct, setMaxPct] = useState<number>(30);
  const [randomTrials, setRandomTrials] = useState<number>(5);
  const [seed, setSeed] = useState<number>(42);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Evaluation results
  const [result, setResult] = useState<C4FaithfulnessResponse | null>(null);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

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
  const loadExplanations = useCallback(async () => {
    try {
      const res = await api<C4ExplanationListResponse>("/c4/explanations?limit=50");
      setExplanations(res.items || []);
    } catch {
      // Non-critical if list fails
    }
  }, []);

  useEffect(() => {
    if (authorized && !checking) {
      loadExplanations();
    }
  }, [authorized, checking, loadExplanations]);

  // Handle URL query parameters: ?exp_id=... (load explanation) or ?eval_id=... / ?id=... (restore evaluation)
  useEffect(() => {
    if (typeof window === "undefined" || checking || !authorized) return;

    const urlParams = new URLSearchParams(window.location.search);
    const evalIdParam = urlParams.get("eval_id") || urlParams.get("id");
    const expIdParam = urlParams.get("exp_id");

    if (evalIdParam && evalIdParam !== restoredEvalIdRef.current) {
      // Restore saved evaluation
      isRestoringRef.current = true;
      const currentReqId = ++activeRequestRef.current;
      setIsBusy(true);

      api<C4FaithfulnessResponse>(`/c4/faithfulness/${evalIdParam}`)
        .then((data) => {
          if (currentReqId !== activeRequestRef.current) return;
          restoredEvalIdRef.current = evalIdParam;
          setResult(data);
          setSelectedExpId(data.explanation_id);
          setStatusMessage("Restored saved faithfulness evaluation from database.");
          setSavedNotice(`Saved in PostgreSQL (Record ID: ${data.evaluation_id})`);
          if (data.steps && data.steps.length > 0) {
            setSelectedStep(data.steps[data.steps.length - 1].step);
          }
        })
        .catch((err) => {
          if (currentReqId !== activeRequestRef.current) return;
          setError(err.message || "Failed to retrieve saved faithfulness evaluation.");
        })
        .finally(() => {
          isRestoringRef.current = false;
          if (currentReqId === activeRequestRef.current) {
            setIsBusy(false);
          }
        });
      return;
    }

    if (expIdParam && expIdParam !== selectedExpId) {
      setSelectedExpId(expIdParam);
    }
  }, [checking, authorized, selectedExpId]);

  // Load details of selected explanation when selectedExpId changes
  useEffect(() => {
    if (!selectedExpId || !authorized) {
      setSelectedExplanation(null);
      return;
    }

    let live = true;
    api<C4ExplanationResponse>(`/c4/explanations/${selectedExpId}`)
      .then((data) => {
        if (!live) return;
        setSelectedExplanation(data);
      })
      .catch((err) => {
        if (!live) return;
        setError(err.message || "Could not load selected explanation details.");
      });

    return () => {
      live = false;
    };
  }, [selectedExpId, authorized]);

  // Clear stale results and saved IDs when source context or settings change
  useEffect(() => {
    if (!authorized) {
      setResult(null);
      setSelectedExplanation(null);
      setSelectedExpId("");
      setError("");
      setStatusMessage("");
      setSavedNotice("");
      restoredEvalIdRef.current = null;
      return;
    }

    if (isRestoringRef.current) return;

    const textChanged = submissionText !== prevTextRef.current;
    const taskChanged = selectedTaskId !== prevTaskIdRef.current;

    prevTextRef.current = submissionText;
    prevTaskIdRef.current = selectedTaskId;

    if (textChanged || taskChanged) {
      activeRequestRef.current += 1;
      restoredEvalIdRef.current = null;
      setResult(null);
      setError("");
      setStatusMessage("");
      setSavedNotice("");
    }
  }, [authorized, submissionText, selectedTaskId]);

  // Run Faithfulness Test
  const handleRunTest = async () => {
    if (!selectedExpId) {
      setError("Please select a saved LIME or SHAP explanation to evaluate.");
      return;
    }

    if (!submissionText) {
      setError("No source text is available in the current context. Faithfulness testing requires the exact authorized source text.");
      return;
    }

    setIsBusy(true);
    setError("");
    setStatusMessage("Running model-based progressive deletion & random trials...");
    setSavedNotice("");
    setResult(null);
    const reqId = ++activeRequestRef.current;

    const requestBody: C4FaithfulnessRequest = {
      explanation_id: selectedExpId,
      text: submissionText,
      language: (caseLanguage as "English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") || null,
      max_removal_words: budgetMode === "words" ? maxWords : null,
      max_removal_pct: budgetMode === "pct" ? maxPct : null,
      random_trials: randomTrials,
      seed: seed,
    };

    try {
      const data = await api<C4FaithfulnessResponse>("/c4/faithfulness", requestBody);
      if (reqId !== activeRequestRef.current) return;

      setResult(data);
      if (data.outcome === "SUCCESS") {
        setStatusMessage(data.outcome_message || "Faithfulness test completed successfully.");
      } else if (data.outcome === "PARTIAL") {
        setStatusMessage(`Partial result: ${data.outcome_message}`);
      } else {
        setError(`Evaluation halted: ${data.outcome_message}`);
      }

      if (data.saved && data.evaluation_id) {
        setSavedNotice(`Saved in PostgreSQL (Record ID: ${data.evaluation_id})`);
        // Update URL parameter without reload
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("eval_id", data.evaluation_id);
          window.history.replaceState(null, "", url.toString());
        }
      } else if (data.outcome === "SUCCESS" || data.outcome === "PARTIAL") {
        setSavedNotice("Completed (unsaved in database)");
      }

      if (data.steps && data.steps.length > 0) {
        setSelectedStep(data.steps[data.steps.length - 1].step);
      }
    } catch (err: unknown) {
      if (reqId !== activeRequestRef.current) return;
      if (err instanceof ApiError) {
        setError(`API Error (${err.status}): ${err.message}`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred during faithfulness testing.");
      }
    } finally {
      if (reqId === activeRequestRef.current) {
        setIsBusy(false);
      }
    }
  };

  // Prepare Recharts deletion curve data
  const chartData: ChartPoint[] = useMemo(() => {
    if (!result || !result.steps || result.steps.length === 0) return [];

    const points: ChartPoint[] = [];
    // Point at k=0 (original baseline probability)
    points.push({
      k: 0,
      importantProb: Number((result.baseline_probability * 100).toFixed(2)),
      randomMeanProb: Number((result.baseline_probability * 100).toFixed(2)),
      randomUpper: Number((result.baseline_probability * 100).toFixed(2)),
      randomLower: Number((result.baseline_probability * 100).toFixed(2)),
      importantDrop: 0,
      randomDrop: 0,
    });

    for (const s of result.steps) {
      const impProbPct = Number((s.remaining_probability * 100).toFixed(2));
      const randMeanPct = s.random_mean_probability !== null && s.random_mean_probability !== undefined
        ? Number((s.random_mean_probability * 100).toFixed(2))
        : undefined;

      let rUpper: number | undefined;
      let rLower: number | undefined;
      if (randMeanPct !== undefined && s.random_std_drop !== null && s.random_std_drop !== undefined) {
        const stdPct = s.random_std_drop * 100;
        rUpper = Number(Math.min(100, randMeanPct + stdPct).toFixed(2));
        rLower = Number(Math.max(0, randMeanPct - stdPct).toFixed(2));
      }

      points.push({
        k: s.step,
        importantProb: impProbPct,
        randomMeanProb: randMeanPct,
        randomUpper: rUpper,
        randomLower: rLower,
        importantDrop: Number((s.comprehensiveness_drop * 100).toFixed(2)),
        randomDrop: s.random_mean_drop !== null && s.random_mean_drop !== undefined
          ? Number((s.random_mean_drop * 100).toFixed(2))
          : undefined,
      });
    }

    return points;
  }, [result]);

  // CSV export handler (strictly excluding participant text/tokens by default)
  const handleExportCsv = () => {
    if (!result || !result.steps) return;

    const headers = [
      "Step (k)",
      "Remaining Class Probability",
      "Comprehensiveness Drop (pp)",
      "Sufficiency Gap (pp)",
      "Random Mean Drop (pp)",
      "Random Std Dev (pp)",
      "Difference from Random (pp)",
      "Random Trials Count",
      "Model ID",
      "Model Revision",
      "Method",
      "Explained Class",
      "Baseline Probability",
      "AOPC",
      "Seed",
    ];

    const rows = result.steps.map((s) => [
      s.step,
      s.remaining_probability.toFixed(4),
      (s.comprehensiveness_drop * 100).toFixed(2),
      s.sufficiency_gap !== null && s.sufficiency_gap !== undefined ? (s.sufficiency_gap * 100).toFixed(2) : "",
      s.random_mean_drop !== null && s.random_mean_drop !== undefined ? (s.random_mean_drop * 100).toFixed(2) : "",
      s.random_std_drop !== null && s.random_std_drop !== undefined ? (s.random_std_drop * 100).toFixed(2) : "",
      s.difference_from_random !== null && s.difference_from_random !== undefined ? (s.difference_from_random * 100).toFixed(2) : "",
      s.random_trial_count,
      `"${result.model_id || ""}"`,
      `"${result.model_revision || ""}"`,
      result.method,
      result.explained_class,
      result.baseline_probability.toFixed(4),
      result.aopc !== null && result.aopc !== undefined ? result.aopc.toFixed(4) : "",
      result.seed,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `faithfulness_${result.method}_${result.explained_class}_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Summary indicators
  const explainedClassColor = selectedExplanation
    ? SENTIMENT_COLORS[selectedExplanation.target_class || "Negative"] || "#64748b"
    : "#64748b";

  return (
    <div className="faith-page-container">
      <Sidebar isClassifierConnected={true} />

      <main className="faith-main" id="main-content">
        {/* Top Header */}
        <header className="faith-header">
          <div className="faith-header-title-block">
            <h1 className="faith-main-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              Faithfulness Tests
            </h1>
            <p className="faith-main-subtitle">
              Model-backed comprehensiveness, sufficiency, and seeded random baseline evaluation for LIME &amp; SHAP.
            </p>
          </div>

          <div className="faith-header-actions">
            <div className="faith-header-pill">
              <div className="faith-user-avatar-circle">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="faith-user-text-info">
                <span className="faith-user-name">Authorized Counsellor</span>
                <span className="faith-user-role">Research Review</span>
              </div>
            </div>
          </div>
        </header>

        {/* Status Alerts */}
        {error && (
          <div className="faith-alert-error" role="alert">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>{error}</div>
          </div>
        )}

        {statusMessage && !error && (
          <div className="faith-alert-info" role="status">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div>{statusMessage}</div>
          </div>
        )}

        {savedNotice && (
          <div className="faith-alert-success">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div>{savedNotice}</div>
          </div>
        )}

        {/* Card 1: Selected Explanation Summary */}
        <section className="faith-card" aria-labelledby="explanation-summary-title">
          <div className="faith-card-title" id="explanation-summary-title">
            <span>Selected Explanation &amp; Source Context</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <Link href="/lime" className="faith-btn-secondary" style={{ textDecoration: "none" }}>
                Generate LIME
              </Link>
              <Link href="/shap" className="faith-btn-secondary" style={{ textDecoration: "none" }}>
                Generate SHAP
              </Link>
            </div>
          </div>

          {/* Explanation selector */}
          <div style={{ marginBottom: "14px" }}>
            <label htmlFor="exp-select" className="faith-control-label">
              Choose Saved Explanation to Evaluate:
            </label>
            <select
              id="exp-select"
              className="faith-select"
              style={{ width: "100%", marginTop: "4px" }}
              value={selectedExpId}
              onChange={(e) => {
                setSelectedExpId(e.target.value);
                setResult(null);
                setSavedNotice("");
                setError("");
              }}
            >
              <option value="">-- Select a saved explanation --</option>
              {explanations.map((exp) => (
                <option key={exp.explanation_id} value={exp.explanation_id}>
                  [{exp.method}] {exp.target_class} ({new Date(exp.created_at).toLocaleTimeString()}) - ID: {exp.explanation_id.slice(0, 8)}... {exp.source_reference ? `(${exp.source_reference})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Read-only original input text */}
          <div>
            <div className="faith-control-label">
              <span>Read-Only Verified Source Text:</span>
              <span style={{ fontWeight: 400, color: "#64748b", fontSize: "11.5px" }}>
                ({submissionText ? `${submissionText.length} chars` : "Unavailable"})
              </span>
            </div>
            {submissionText ? (
              <div className="faith-readonly-text">{submissionText}</div>
            ) : (
              <div className="faith-readonly-text" style={{ color: "#94a3b8", fontStyle: "italic" }}>
                No verified text in current review context. Faithfulness testing requires authorized input.
              </div>
            )}
          </div>

          {/* Selected Explanation Metadata Strip */}
          {selectedExplanation && (
            <div className="faith-summary-grid">
              <div className="faith-summary-item">
                <span className="faith-summary-label">Explainer Method</span>
                <span className="faith-summary-value">
                  <span className={`faith-badge faith-badge-${selectedExplanation.method.toLowerCase()}`}>
                    {selectedExplanation.method}
                  </span>
                </span>
              </div>

              <div className="faith-summary-item">
                <span className="faith-summary-label">Explained Class</span>
                <span className="faith-summary-value" style={{ color: explainedClassColor }}>
                  <span className={`faith-badge faith-badge-${selectedExplanation.target_class?.toLowerCase() || "negative"}`}>
                    {selectedExplanation.target_class}
                  </span>
                </span>
              </div>

              <div className="faith-summary-item">
                <span className="faith-summary-label">Baseline Probability (p0)</span>
                <span className="faith-summary-value">
                  {selectedExplanation.target_class_probability !== undefined && selectedExplanation.target_class_probability !== null
                    ? `${(selectedExplanation.target_class_probability * 100).toFixed(1)}%`
                    : "N/A"}
                </span>
              </div>

              <div className="faith-summary-item">
                <span className="faith-summary-label">Model Checkpoint</span>
                <span className="faith-summary-value" style={{ fontSize: "12px", fontFamily: "monospace" }}>
                  {selectedExplanation.model_id ? selectedExplanation.model_id.split("/").pop() : "cardiffnlp-xlm-r"}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Card 2: Evaluation Controls */}
        <section className="faith-card" aria-labelledby="controls-title">
          <h2 className="faith-card-title" id="controls-title">Faithfulness Test Settings</h2>

          <div className="faith-controls-grid">
            {/* Removal budget mode */}
            <div className="faith-control-group">
              <label htmlFor="budget-mode-select" className="faith-control-label">Budget Unit:</label>
              <select
                id="budget-mode-select"
                className="faith-select"
                value={budgetMode}
                onChange={(e) => setBudgetMode(e.target.value as "words" | "pct")}
              >
                <option value="words">Fixed Word Count</option>
                <option value="pct">Percentage of Words</option>
              </select>
            </div>

            {/* Removal limit */}
            <div className="faith-control-group">
              <label htmlFor="budget-value-input" className="faith-control-label">
                {budgetMode === "words" ? "Max Words to Remove:" : "Max Removal Percentage (%):"}
              </label>
              <input
                id="budget-value-input"
                type="number"
                className="faith-input"
                min={1}
                max={budgetMode === "words" ? 50 : 100}
                value={budgetMode === "words" ? maxWords : maxPct}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (budgetMode === "words") setMaxWords(isNaN(val) ? 5 : val);
                  else setMaxPct(isNaN(val) ? 30 : Math.min(100, Math.max(1, val)));
                }}
              />
            </div>

            {/* Bounded Random Trials */}
            <div className="faith-control-group">
              <label htmlFor="random-trials-input" className="faith-control-label">
                Random Trials (Baseline):
              </label>
              <input
                id="random-trials-input"
                type="number"
                className="faith-input"
                min={1}
                max={20}
                value={randomTrials}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setRandomTrials(isNaN(val) ? 5 : Math.max(1, Math.min(20, val)));
                }}
              />
            </div>

            {/* Run Button */}
            <div className="faith-control-group">
              <button
                type="button"
                className="faith-btn-primary"
                onClick={handleRunTest}
                disabled={isBusy || !selectedExpId || !submissionText}
                style={{ height: "40px" }}
              >
                {isBusy ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="faith-spinner">
                      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="16" />
                    </svg>
                    Evaluating...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Run Faithfulness Test
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Advanced Settings Toggle */}
          <div style={{ marginTop: "14px" }}>
            <button
              type="button"
              className="faith-btn-secondary"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ fontSize: "12px", padding: "4px 10px" }}
            >
              {showAdvanced ? "▲ Hide Advanced Settings" : "▼ Show Advanced Settings (Seed)"}
            </button>

            {showAdvanced && (
              <div style={{ marginTop: "10px", maxWidth: "260px" }}>
                <label htmlFor="seed-input" className="faith-control-label">Deterministic Seed:</label>
                <input
                  id="seed-input"
                  type="number"
                  className="faith-input"
                  value={seed}
                  onChange={(e) => setSeed(parseInt(e.target.value, 10) || 42)}
                />
                <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", display: "block" }}>
                  Controls random deletion permutation sequence reproducibility.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Results Section */}
        {result && result.steps && result.steps.length > 0 && (
          <>
            {/* Key Metrics Cards */}
            <div className="faith-metrics-grid">
              {/* Important-word Drop */}
              <div className="faith-metric-card">
                <div className="faith-metric-header">
                  <span className="faith-metric-title">Important-Word Drop</span>
                  <span className="faith-badge faith-badge-lime">Comprehensiveness</span>
                </div>
                <div className="faith-metric-value">
                  {result.final_comprehensiveness_drop !== null && result.final_comprehensiveness_drop !== undefined
                    ? `${result.final_comprehensiveness_drop >= 0 ? "+" : ""}${(result.final_comprehensiveness_drop * 100).toFixed(1)}`
                    : "0.0"}
                  <span className="faith-metric-unit">pp</span>
                </div>
                <p className="faith-metric-subtext">
                  p0 - p(delete top-k words). A higher drop indicates the explanation identified impactful words.
                </p>
              </div>

              {/* Random Mean Drop */}
              <div className="faith-metric-card">
                <div className="faith-metric-header">
                  <span className="faith-metric-title">Random Mean Drop</span>
                  <span className="faith-badge faith-badge-neutral">{result.completed_trials} trials</span>
                </div>
                <div className="faith-metric-value">
                  {result.final_random_mean_drop !== null && result.final_random_mean_drop !== undefined
                    ? `${result.final_random_mean_drop >= 0 ? "+" : ""}${(result.final_random_mean_drop * 100).toFixed(1)}`
                    : "0.0"}
                  <span className="faith-metric-unit">pp</span>
                </div>
                <p className="faith-metric-subtext">
                  Average drop across completed seeded trials removing the same number of words randomly.
                </p>
              </div>

              {/* Difference from Random */}
              <div className="faith-metric-card">
                <div className="faith-metric-header">
                  <span className="faith-metric-title">Diff from Random</span>
                  <span className={`faith-badge ${(result.final_difference_from_random || 0) > 0 ? "faith-badge-positive" : "faith-badge-negative"}`}>
                    {(result.final_difference_from_random || 0) > 0 ? "Faithful" : "Uninformative"}
                  </span>
                </div>
                <div className="faith-metric-value" style={{ color: (result.final_difference_from_random || 0) > 0 ? "#15803d" : "#b91c1c" }}>
                  {result.final_difference_from_random !== null && result.final_difference_from_random !== undefined
                    ? `${result.final_difference_from_random >= 0 ? "+" : ""}${(result.final_difference_from_random * 100).toFixed(1)}`
                    : "0.0"}
                  <span className="faith-metric-unit">pp</span>
                </div>
                <p className="faith-metric-subtext">
                  Important drop minus random drop. Positive values verify the method beats chance deletion.
                </p>
              </div>

              {/* Sufficiency Gap */}
              <div className="faith-metric-card">
                <div className="faith-metric-header">
                  <span className="faith-metric-title">Sufficiency Gap</span>
                  <span className="faith-badge faith-badge-shap">Retention</span>
                </div>
                <div className="faith-metric-value">
                  {result.final_sufficiency_gap !== null && result.final_sufficiency_gap !== undefined
                    ? `${result.final_sufficiency_gap >= 0 ? "+" : ""}${(result.final_sufficiency_gap * 100).toFixed(1)}`
                    : "N/A"}
                  <span className="faith-metric-unit">pp</span>
                </div>
                <p className="faith-metric-subtext">
                  p0 - p(keep top-k words). Small gaps indicate kept words alone preserve the classification.
                </p>
              </div>
            </div>

            {/* Recharts Deletion Curve Card */}
            <section className="faith-card" aria-labelledby="chart-title">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h2 className="faith-card-title" id="chart-title" style={{ margin: 0 }}>
                    Deletion Curve (Comprehensiveness vs. Random Baseline)
                  </h2>
                  <p className="faith-main-subtitle">
                    Tracking explained-class probability (%) as words are progressively removed. Click a step to inspect modified text.
                  </p>
                </div>
                <button
                  type="button"
                  className="faith-btn-secondary"
                  onClick={handleExportCsv}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export CSV (Numeric Only)
                </button>
              </div>

              <div className="faith-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                    onClick={(state) => {
                      if (state && state.activeLabel !== undefined) {
                        const clickedK = Number(state.activeLabel);
                        if (clickedK > 0) setSelectedStep(clickedK);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="k"
                      label={{ value: "Words Removed (k)", position: "insideBottom", offset: -10, fill: "#64748b", fontSize: 12 }}
                      tick={{ fill: "#64748b", fontSize: 12 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      label={{ value: "Class Probability (%)", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 12 }}
                      tick={{ fill: "#64748b", fontSize: 12 }}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: any) => {
                        if (val === undefined || val === null) return ["-", String(name || "")];
                        return [`${Number(val).toFixed(1)}%`, String(name || "")];
                      }}
                      labelFormatter={(label) => `Step k = ${label} word(s) removed`}
                      contentStyle={{ backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                    />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "12.5px" }} />

                    {/* Standard Deviation Band for Random Baseline */}
                    <Area
                      type="monotone"
                      dataKey="randomUpper"
                      stroke="none"
                      fill="#94a3b8"
                      fillOpacity={0.15}
                      name="Random ± 1 SD Band"
                    />
                    <Area
                      type="monotone"
                      dataKey="randomLower"
                      stroke="none"
                      fill="#ffffff"
                      fillOpacity={1}
                      name="Random Lower"
                      legendType="none"
                    />

                    {/* Random Mean Curve (Dashed) */}
                    <Line
                      type="monotone"
                      dataKey="randomMeanProb"
                      name="Random Baseline Mean"
                      stroke="#64748b"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 4, stroke: "#64748b", fill: "#ffffff" }}
                    />

                    {/* Important Words Deletion Curve (Solid) */}
                    <Line
                      type="monotone"
                      dataKey="importantProb"
                      name="Important Words Removed"
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={{ r: 5, stroke: "#6366f1", fill: "#6366f1" }}
                      activeDot={{ r: 8, stroke: "#4f46e5", strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Interactive Step Table */}
            <section className="faith-card" aria-labelledby="step-table-title">
              <h2 className="faith-card-title" id="step-table-title">
                Progressive Deletion Steps &amp; Transient Text Previews
              </h2>
              <p className="faith-main-subtitle">
                Select a step row to review the modified text and remaining model probabilities.
              </p>

              <div className="faith-table-container">
                <table className="faith-table">
                  <thead>
                    <tr>
                      <th>Step (k)</th>
                      <th>Removed Word(s)</th>
                      <th>Remaining Prob</th>
                      <th>Comprehensiveness Drop</th>
                      <th>Sufficiency Gap</th>
                      <th>Diff from Random</th>
                      <th>Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.steps.map((s) => (
                      <tr
                        key={s.step}
                        className={selectedStep === s.step ? "faith-row-selected" : ""}
                        onClick={() => setSelectedStep(s.step)}
                      >
                        <td style={{ fontWeight: 600 }}>k = {s.step}</td>
                        <td>
                          {(s.removed_words || []).map((w, idx) => (
                            <span key={idx} className="faith-word-chip">
                              {w}
                            </span>
                          ))}
                        </td>
                        <td>{(s.remaining_probability * 100).toFixed(1)}%</td>
                        <td style={{ fontWeight: 600, color: s.comprehensiveness_drop > 0 ? "#15803d" : "#b91c1c" }}>
                          {s.comprehensiveness_drop >= 0 ? "+" : ""}{(s.comprehensiveness_drop * 100).toFixed(1)} pp
                        </td>
                        <td>
                          {s.sufficiency_gap !== null && s.sufficiency_gap !== undefined
                            ? `${s.sufficiency_gap >= 0 ? "+" : ""}${(s.sufficiency_gap * 100).toFixed(1)} pp`
                            : "-"}
                        </td>
                        <td style={{ color: (s.difference_from_random || 0) >= 0 ? "#15803d" : "#b91c1c" }}>
                          {s.difference_from_random !== null && s.difference_from_random !== undefined
                            ? `${s.difference_from_random >= 0 ? "+" : ""}${(s.difference_from_random * 100).toFixed(1)} pp`
                            : "-"}
                        </td>
                        <td style={{ maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#64748b", fontSize: "12px" }}>
                          {s.modified_text || "(Text unavailable in restored numeric view)"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Selected Step Full Text Preview */}
              {selectedStep !== null && (
                <div style={{ marginTop: "16px", padding: "14px 18px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontWeight: 600, fontSize: "13px", color: "#334155" }}>
                      Transient Modified Text for Step k = {selectedStep}:
                    </span>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Remaining Probability: {((result.steps.find((s) => s.step === selectedStep)?.remaining_probability || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ fontSize: "13.5px", lineHeight: 1.6, color: "#1e293b", whiteSpace: "pre-wrap" }}>
                    {result.steps.find((s) => s.step === selectedStep)?.modified_text ||
                      "(Full modified text is transient and not stored permanently in the database to prevent saving participant text.)"}
                  </div>
                </div>
              )}
            </section>

            {/* Collapsed Technical Details */}
            <details className="faith-details">
              <summary>View Technical Metrics, Provenance &amp; Stopping Reason</summary>
              <div className="faith-details-content">
                <div>
                  <strong>Deletion AOPC:</strong>{" "}
                  {result.aopc !== null && result.aopc !== undefined ? result.aopc.toFixed(4) : "N/A"}
                </div>
                <div>
                  <strong>Removal Budget Evaluated:</strong> {result.budget_evaluated} / {result.budget_requested} words
                </div>
                <div>
                  <strong>Total Eligible Supporting Words:</strong> {result.total_eligible_words}
                </div>
                <div>
                  <strong>Completed Random Trials:</strong> {result.completed_trials}
                </div>
                <div>
                  <strong>Model Checkpoint:</strong> {result.model_id || "N/A"}
                </div>
                <div>
                  <strong>Model Revision:</strong> {result.model_revision || "main"}
                </div>
                <div>
                  <strong>Execution Time:</strong> {result.execution_time_ms ? `${result.execution_time_ms} ms` : "N/A"}
                </div>
                <div>
                  <strong>Total Inferences:</strong> {result.total_inferences}
                </div>
                <div>
                  <strong>Stopping Reason:</strong> {result.stopping_reason || "Completed all requested steps."}
                </div>
                <div>
                  <strong>Database Save Status:</strong> {result.saved ? `Saved (ID: ${result.evaluation_id})` : "Unsaved / In-memory"}
                </div>
              </div>
            </details>
          </>
        )}

        {/* Limitation Notice */}
        <div className="faith-limitation-box">
          <strong>Non-Diagnostic Notice &amp; Deletion Limitation:</strong> Progressive deletion can create unnatural input strings and out-of-distribution phrases. These faithfulness tests measure internal model sensitivity and behavioural attribution consistency, not clinical diagnosis or linguistic correctness. The system is designed for human counsellor review support and does not replace professional counselling or clinical intervention.
        </div>
      </main>
    </div>
  );
}
