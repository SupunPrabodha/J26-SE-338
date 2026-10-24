"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ErrorBar,
} from "recharts";
import { Sidebar } from "../components/Sidebar";
import { useReviewCase } from "../context/CaseContext";
import { api, ApiError } from "@j26/common/api";
import type {
  C4ComparisonCurrentRequest,
  C4ComparisonCurrentResponse,
  C4ComparisonEvaluatedResponse,
} from "@j26/common/contracts";
import "../styles/Comparison.css";

const METRIC_OPTIONS = [
  { value: "DELETION_AOPC", label: "Deletion AOPC" },
  { value: "COMPREHENSIVENESS_AT_K", label: "Comprehensiveness (at common k)" },
  { value: "DIFFERENCE_FROM_RANDOM_AT_K", label: "Diff from Random (at common k)" },
  { value: "SUFFICIENCY_GAP_AT_K", label: "Sufficiency Gap (at common k)" },
  { value: "TOP_K_OVERLAP", label: "Mean Top-k Overlap" },
  { value: "RANK_CORRELATION", label: "Mean Spearman Rank Correlation" },
  { value: "EXPLANATION_TIME", label: "Explanation Generation Time" },
];

const METRIC_DEFINITIONS: Record<string, { name: string; version: string; unit: string; higher_is: string }> = {
  DELETION_AOPC: {
    name: "Deletion AOPC",
    version: "1.0.0",
    unit: "percentage points",
    higher_is: "more faithful",
  },
  COMPREHENSIVENESS_AT_K: {
    name: "Comprehensiveness (at common k)",
    version: "1.0.0",
    unit: "percentage points",
    higher_is: "more faithful",
  },
  DIFFERENCE_FROM_RANDOM_AT_K: {
    name: "Diff from Random (at common k)",
    version: "1.0.0",
    unit: "percentage points",
    higher_is: "more faithful",
  },
  SUFFICIENCY_GAP_AT_K: {
    name: "Sufficiency Gap (at common k)",
    version: "1.0.0",
    unit: "percentage points",
    higher_is: "near zero indicates similar probability",
  },
  TOP_K_OVERLAP: {
    name: "Mean Top-k Overlap",
    version: "1.0.0",
    unit: "%",
    higher_is: "more stable",
  },
  RANK_CORRELATION: {
    name: "Mean Spearman Rank Correlation",
    version: "1.0.0",
    unit: "[-1.0, 1.0]",
    higher_is: "more stable",
  },
  EXPLANATION_TIME: {
    name: "Explanation Generation Time",
    version: "1.0.0",
    unit: "seconds",
    higher_is: "faster",
  },
};

const LANGUAGE_OPTIONS = [
  { value: "all", label: "All Languages" },
  { value: "English", label: "English" },
  { value: "Sinhala", label: "Sinhala" },
  { value: "Romanized Sinhala", label: "Romanized Sinhala" },
  { value: "Code-mixed", label: "Code-mixed" },
  { value: "Unknown", label: "Unknown" },
];

const CLASS_OPTIONS = [
  { value: "all", label: "All Classes" },
  { value: "Negative", label: "Negative" },
  { value: "Neutral", label: "Neutral" },
  { value: "Positive", label: "Positive" },
];

interface ChartLanguageDatum {
  language: string;
  limeValue: number | null;
  shapValue: number | null;
  limeError: [number, number] | null;
  shapError: [number, number] | null;
  validPairs: number;
}

const emptySubscribe = () => () => {};

export default function ComparisonPage() {
  const {
    authorized,
    checking,
    selectedTask,
    selectedTaskId,
    selectedSentimentClass,
    devInput,
  } = useReviewCase();

  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Active Tab: "current" or "evaluated"
  const [activeTab, setActiveTab] = useState<"current" | "evaluated">(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("tab");
      if (p === "current" || p === "evaluated") return p;
    }
    return "current";
  });

  // Filters state (synchronized with URL where appropriate)
  const [selectedMetric, setSelectedMetric] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("metric");
      if (p && METRIC_OPTIONS.some((m) => m.value === p)) return p;
    }
    return "DELETION_AOPC";
  });
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("lang");
      if (p) return p;
    }
    return "all";
  });
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("class");
      if (p) return p;
    }
    return "all";
  });
  const [selectedRevision, setSelectedRevision] = useState<string>("all");
  const [commonK, setCommonK] = useState<number>(5);

  // Pagination for Evaluated Inputs
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Evaluated tab state
  const [evaluatedData, setEvaluatedData] = useState<C4ComparisonEvaluatedResponse | null>(null);
  const [isEvaluatedBusy, setIsEvaluatedBusy] = useState<boolean>(false);
  const [evaluatedError, setEvaluatedError] = useState<string>("");

  // Current Input tab state
  const [currentData, setCurrentData] = useState<C4ComparisonCurrentResponse | null>(null);
  const [isCurrentBusy, setIsCurrentBusy] = useState<boolean>(false);
  const [currentError, setCurrentError] = useState<string>("");
  const [selectedLimeRecId, setSelectedLimeRecId] = useState<string>("");
  const [selectedShapRecId, setSelectedShapRecId] = useState<string>("");

  // Collapsible accordion for metric definitions & comparison settings
  const [showDefinitions, setShowDefinitions] = useState<boolean>(false);

  // Interactive chart language filter
  const [chartLanguageFilter, setChartLanguageFilter] = useState<string | null>(null);

  // Read current input context
  const snapshot = devInput && devInput.text ? devInput : null;
  const currentText = snapshot ? snapshot.text : selectedTask?.preprocessing?.anonymized_text || null;
  const currentLang = snapshot ? (snapshot.language || "English") : (selectedTask?.preprocessing?.language || "English");
  const currentClass = selectedSentimentClass || (snapshot ? snapshot.targetClass : null) || "Negative";
  const currentRef = selectedTaskId || (snapshot ? snapshot.id : "development-input");

  // Active request ref to discard stale responses
  const currentReqRef = useRef(0);
  const evaluatedReqRef = useRef(0);

  // Sync tab and filter changes to URL
  const updateUrlParams = useCallback((newTab: string, metric: string, lang: string, cls: string) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", newTab);
    url.searchParams.set("metric", metric);
    if (lang !== "all") url.searchParams.set("lang", lang);
    else url.searchParams.delete("lang");
    if (cls !== "all") url.searchParams.set("class", cls);
    else url.searchParams.delete("class");
    window.history.replaceState(null, "", url.toString());
  }, []);

  // Fetch Evaluated Inputs summary & evidence
  const loadEvaluatedInputs = useCallback(async () => {
    if (!authorized) return;
    const reqId = ++evaluatedReqRef.current;
    setIsEvaluatedBusy(true);
    setEvaluatedError("");

    try {
      const offset = (currentPage - 1) * pageSize;
      const effectiveLang = chartLanguageFilter || selectedLanguage;
      const url = `/c4/comparison/evaluated?metric=${encodeURIComponent(selectedMetric)}&model_revision=${encodeURIComponent(
        selectedRevision
      )}&explained_class=${encodeURIComponent(selectedClass)}&language=${encodeURIComponent(
        effectiveLang
      )}&common_k=${commonK}&limit=${pageSize}&offset=${offset}`;

      const res = await api<C4ComparisonEvaluatedResponse>(url);
      if (reqId !== evaluatedReqRef.current) return;
      setEvaluatedData(res);
    } catch (err) {
      if (reqId !== evaluatedReqRef.current) return;
      setEvaluatedError(err instanceof ApiError ? err.message : "Failed to load evaluated comparison data.");
    } finally {
      if (reqId === evaluatedReqRef.current) {
        setIsEvaluatedBusy(false);
      }
    }
  }, [authorized, selectedMetric, selectedRevision, selectedClass, selectedLanguage, chartLanguageFilter, commonK, currentPage]);

  // Fetch Current Input paired evidence
  const loadCurrentInput = useCallback(async () => {
    if (!authorized) return;
    const reqId = ++currentReqRef.current;
    setIsCurrentBusy(true);
    setCurrentError("");

    try {
      const payload: C4ComparisonCurrentRequest = {
        text: currentText,
        source_reference: currentRef,
        language: currentLang as C4ComparisonCurrentRequest["language"],
        target_class: currentClass,
        common_k: commonK,
        selected_lime_eval_id: selectedLimeRecId || undefined,
        selected_shap_eval_id: selectedShapRecId || undefined,
      };

      const res = await api<C4ComparisonCurrentResponse>("/c4/comparison/current", payload);
      if (reqId !== currentReqRef.current) return;
      setCurrentData(res);
    } catch (err) {
      if (reqId !== currentReqRef.current) return;
      setCurrentError(err instanceof ApiError ? err.message : "Failed to load current input comparison.");
    } finally {
      if (reqId === currentReqRef.current) {
        setIsCurrentBusy(false);
      }
    }
  }, [authorized, currentText, currentRef, currentLang, currentClass, commonK, selectedLimeRecId, selectedShapRecId]);

  // Trigger loads when active tab or filters change
  useEffect(() => {
    if (authorized && !checking) {
      const timer = setTimeout(() => {
        if (activeTab === "evaluated") {
          void loadEvaluatedInputs();
        } else {
          void loadCurrentInput();
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [authorized, checking, activeTab, loadEvaluatedInputs, loadCurrentInput]);

  // Tab switch handler
  function handleTabChange(tab: "current" | "evaluated") {
    setActiveTab(tab);
    updateUrlParams(tab, selectedMetric, selectedLanguage, selectedClass);
  }

  // Filter change handlers
  function handleMetricChange(metric: string) {
    setSelectedMetric(metric);
    setCurrentPage(1);
    updateUrlParams(activeTab, metric, selectedLanguage, selectedClass);
  }

  function handleLanguageChange(lang: string) {
    setSelectedLanguage(lang);
    setChartLanguageFilter(null);
    setCurrentPage(1);
    updateUrlParams(activeTab, selectedMetric, lang, selectedClass);
  }

  function handleClassChange(cls: string) {
    setSelectedClass(cls);
    setCurrentPage(1);
    updateUrlParams(activeTab, selectedMetric, selectedLanguage, cls);
  }

  // Handle Export CSV
  function handleExportCsv() {
    if (!authorized) return;
    const effectiveLang = chartLanguageFilter || selectedLanguage;
    const url = `/api/v1/c4/comparison/export?metric=${encodeURIComponent(selectedMetric)}&model_revision=${encodeURIComponent(
      selectedRevision
    )}&explained_class=${encodeURIComponent(selectedClass)}&language=${encodeURIComponent(effectiveLang)}&common_k=${commonK}`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "c4_comparison_metrics_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Prepare chart data for Recharts
  const chartData: ChartLanguageDatum[] = useMemo(() => {
    if (!evaluatedData || !evaluatedData.language_groups) return [];
    return evaluatedData.language_groups.map((grp) => {
      const validPairs = grp.valid_pairs_count ?? 0;
      // Error bars represent between-input sample standard deviation when >= 2 pairs exist
      const limeErr: [number, number] | null =
        grp.lime_std !== null && grp.lime_std !== undefined && validPairs >= 2
          ? [grp.lime_std, grp.lime_std]
          : null;

      const shapErr: [number, number] | null =
        grp.shap_std !== null && grp.shap_std !== undefined && validPairs >= 2
          ? [grp.shap_std, grp.shap_std]
          : null;

      return {
        language: grp.language,
        limeValue: grp.lime_mean ?? null,
        shapValue: grp.shap_mean ?? null,
        limeError: limeErr,
        shapError: shapErr,
        validPairs: validPairs,
      };
    });
  }, [evaluatedData]);

  // Format cell value helper
  function formatVal(val: number | null | undefined, unit: string = ""): string {
    if (val === null || val === undefined) return "—";
    if (unit === "percentage" || unit === "%") return `${val}%`;
    if (unit === "percentage points") return `${val > 0 ? "+" : ""}${val} pp`;
    if (unit.includes("correlation")) return `${val > 0 ? "+" : ""}${val}`;
    if (unit === "ms") return `${val} ms`;
    return `${val}`;
  }

  // Format Status Badge helper
  function renderStatusBadge(status: string) {
    switch (status) {
      case "COMPARABLE":
        return <span className="comp-status-pill comp-status-comparable">Comparable</span>;
      case "INCOMPATIBLE":
        return <span className="comp-status-pill comp-status-incompatible">Incompatible Settings</span>;
      case "MISSING_LIME":
        return <span className="comp-status-pill comp-status-missing-lime">Missing LIME</span>;
      case "MISSING_SHAP":
        return <span className="comp-status-pill comp-status-missing-shap">Missing SHAP</span>;
      case "MISSING_BOTH":
        return <span className="comp-status-pill comp-status-missing-both">Missing Evidence</span>;
      case "PROVENANCE_UNAVAILABLE":
        return <span className="comp-status-pill comp-status-provenance">Provenance Unavailable</span>;
      case "EVALUATION_FAILED":
        return <span className="comp-status-pill comp-status-failed">Evaluation Failed</span>;
      default:
        return <span className="comp-status-pill comp-status-incompatible">{status}</span>;
    }
  }

  return (
    <div className="comp-page-container">
      <Sidebar />
      <main className="comp-main">
        {/* Header */}
        <header className="comp-header">
          <div className="comp-header-title-block">
            <h1 className="comp-main-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                <path d="M7 21h10" />
                <path d="M12 3v18" />
                <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
              </svg>
              Evidence Comparison: LIME vs SHAP
            </h1>
            <p className="comp-main-subtitle">
              Rigorous side-by-side verification and statistical summary of saved explanation, faithfulness, and stability records.
            </p>
          </div>

          <div className="comp-header-actions">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!authorized || isEvaluatedBusy}
              className="comp-btn comp-btn-secondary"
              title="Export full filtered dataset with formula injection protection"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Metrics CSV
            </button>
          </div>
        </header>

        {/* Mandatory Non-Diagnostic Disclaimer Notice */}
        <div className="comp-notice-banner" role="alert">
          <svg className="comp-notice-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <strong>Screening Support Only:</strong> This page compares saved explanation-evaluation evidence. Consistency and deletion behaviour do not establish prediction correctness or clinical validity. The system supports counsellor-assisted screening review and does not replace professional counselling.
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="comp-tabs-bar" aria-label="Comparison Views">
          <button
            type="button"
            className={`comp-tab-btn ${activeTab === "current" ? "active" : ""}`}
            onClick={() => handleTabChange("current")}
          >
            Current Input
            <span className="comp-tab-badge">Authorized Focus</span>
          </button>
          <button
            type="button"
            className={`comp-tab-btn ${activeTab === "evaluated" ? "active" : ""}`}
            onClick={() => handleTabChange("evaluated")}
          >
            Evaluated Inputs
            <span className="comp-tab-badge">Saved Dataset</span>
          </button>
        </nav>

        {/* =========================================================================
            TAB 1: CURRENT INPUT
           ========================================================================= */}
        {activeTab === "current" && (
          <section aria-label="Current Input Comparison View">
            {isCurrentBusy && (
              <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
                Resolving server-side source identity and pairing evidence...
              </div>
            )}

            {currentError && (
              <div style={{ padding: "14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#991b1b", marginBottom: "16px", fontSize: "13px" }}>
                ⚠️ {currentError}
              </div>
            )}

            {currentData && (
              <>
                {/* Source Input Card */}
                <div className="comp-card">
                  <div className="comp-card-header">
                    <div className="comp-card-title-group">
                      <h2 className="comp-card-title">Matching Source Reflection</h2>
                      <span className="comp-card-badge comp-badge-diff">
                        {currentData.text_available ? "Read-Only Verified" : "Provenance Ref"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        Explained Class: <strong style={{ color: "#0f172a" }}>{currentData.explained_class}</strong>
                      </span>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        Language: <strong style={{ color: "#0f172a" }}>{currentData.language}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="comp-source-box">
                    {currentData.text_available && currentData.authorized_source_text ? (
                      <p className="comp-source-text">{currentData.authorized_source_text}</p>
                    ) : (
                      <p style={{ color: "#64748b", fontStyle: "italic", margin: 0, fontSize: "13px" }}>
                        Raw source text is not stored on disk under the zero-retention policy. Displaying verified source reference: <strong>{currentData.input_reference}</strong>.
                      </p>
                    )}
                    <div className="comp-source-meta">
                      <span>Input Reference: <code>{currentData.input_reference}</code></span>
                      {currentData.source_hash && (
                        <span>Content Fingerprint: <code>{currentData.source_hash.slice(0, 16)}...</code></span>
                      )}
                      {currentData.model_revision && <span>Model Revision: <code>{currentData.model_revision}</code></span>}
                    </div>
                  </div>

                  {/* Candidate alternative records selection */}
                  {((currentData.available_lime_records?.length ?? 0) > 1 || (currentData.available_shap_records?.length ?? 0) > 1) && (
                    <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "6px" }}>
                        Alternative Saved Evaluations for this Input:
                      </span>
                      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                        {(currentData.available_lime_records?.length ?? 0) > 1 && (
                          <div>
                            <span style={{ fontSize: "11px", fontWeight: 600, color: "#7c3aed" }}>Select LIME Record:</span>
                            <div className="comp-record-chips">
                              {(currentData.available_lime_records ?? []).map((rec) => (
                                <button
                                  key={rec.record_id}
                                  type="button"
                                  onClick={() => setSelectedLimeRecId(rec.record_id)}
                                  className={`comp-record-chip ${selectedLimeRecId === rec.record_id ? "active" : ""}`}
                                  title={rec.is_compatible ? "Compatible record" : rec.incompatibility_reason || "Incompatible"}
                                >
                                  {rec.record_type} ({rec.record_id.slice(0, 6)}…)
                                  {rec.is_compatible ? " ✓" : " ⚠️"}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {(currentData.available_shap_records?.length ?? 0) > 1 && (
                          <div>
                            <span style={{ fontSize: "11px", fontWeight: 600, color: "#0d9488" }}>Select SHAP Record:</span>
                            <div className="comp-record-chips">
                              {(currentData.available_shap_records ?? []).map((rec) => (
                                <button
                                  key={rec.record_id}
                                  type="button"
                                  onClick={() => setSelectedShapRecId(rec.record_id)}
                                  className={`comp-record-chip ${selectedShapRecId === rec.record_id ? "active" : ""}`}
                                  title={rec.is_compatible ? "Compatible record" : rec.incompatibility_reason || "Incompatible"}
                                >
                                  {rec.record_type} ({rec.record_id.slice(0, 6)}…)
                                  {rec.is_compatible ? " ✓" : " ⚠️"}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Navigation row to underlying pages */}
                  <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
                    <Link
                      href={currentData.selected_lime_explanation_id ? `/lime?id=${currentData.selected_lime_explanation_id}` : "/lime"}
                      className="comp-btn comp-btn-secondary"
                      style={{ fontSize: "12px", padding: "6px 12px", color: "#7c3aed", borderColor: "#ddd6fe" }}
                    >
                      Open in LIME Page →
                    </Link>
                    <Link
                      href={currentData.selected_shap_explanation_id ? `/shap?id=${currentData.selected_shap_explanation_id}` : "/shap"}
                      className="comp-btn comp-btn-secondary"
                      style={{ fontSize: "12px", padding: "6px 12px", color: "#0d9488", borderColor: "#99f6e4" }}
                    >
                      Open in SHAP Page →
                    </Link>
                    <Link
                      href={currentData.selected_lime_explanation_id ? `/faithfulness?exp_id=${currentData.selected_lime_explanation_id}` : "/faithfulness"}
                      className="comp-btn comp-btn-secondary"
                      style={{ fontSize: "12px", padding: "6px 12px" }}
                    >
                      Open in Faithfulness Evaluator →
                    </Link>
                    <Link
                      href={currentData.selected_lime_explanation_id ? `/stability?exp_id=${currentData.selected_lime_explanation_id}` : "/stability"}
                      className="comp-btn comp-btn-secondary"
                      style={{ fontSize: "12px", padding: "6px 12px" }}
                    >
                      Open in Stability Analysis →
                    </Link>
                  </div>
                </div>

                {/* Current Input Metric Comparison Table */}
                <div className="comp-card">
                  <div className="comp-card-header">
                    <h2 className="comp-card-title">Side-by-Side Metric Comparison</h2>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Pairing defined as <strong>SHAP minus LIME</strong>
                    </span>
                  </div>

                  <div className="comp-table-container">
                    <table className="comp-table" aria-label="Current Input Metric Comparison">
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Units</th>
                          <th style={{ color: "#7c3aed" }}>LIME Value</th>
                          <th style={{ color: "#0d9488" }}>SHAP Value</th>
                          <th style={{ color: "#2563eb" }}>Paired Diff (SHAP - LIME)</th>
                          <th>Compatibility Status</th>
                          <th>Notes / Reason</th>
                          <th>Saved Records</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(currentData.evidence_items ?? []).map((it) => (
                          <tr key={it.metric}>
                            <td style={{ fontWeight: 600 }}>
                              {it.metric.replace(/_/g, " ")}
                            </td>
                            <td style={{ color: "#64748b" }}>
                              {METRIC_DEFINITIONS[it.metric]?.unit || "—"}
                            </td>
                            <td style={{ fontWeight: 600, color: "#7c3aed" }}>
                              {formatVal(it.lime_value, METRIC_DEFINITIONS[it.metric]?.unit)}
                            </td>
                            <td style={{ fontWeight: 600, color: "#0d9488" }}>
                              {formatVal(it.shap_value, METRIC_DEFINITIONS[it.metric]?.unit)}
                            </td>
                            <td style={{ fontWeight: 600, color: it.paired_difference !== null && it.paired_difference !== undefined ? (it.paired_difference > 0 ? "#15803d" : it.paired_difference < 0 ? "#b91c1c" : "#2563eb") : "#64748b" }}>
                              {it.paired_difference !== null && it.paired_difference !== undefined ? formatVal(it.paired_difference, METRIC_DEFINITIONS[it.metric]?.unit) : "—"}
                            </td>
                            <td>{renderStatusBadge(it.status || "")}</td>
                            <td style={{ fontSize: "11.5px", color: "#64748b", maxWidth: "260px" }}>
                              {it.reason || "Compatible pair"}
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "6px" }}>
                                {it.lime_evaluation_id && (
                                  <Link
                                    href={`/faithfulness?eval_id=${it.lime_evaluation_id}`}
                                    className="comp-status-pill comp-badge-lime"
                                    title="View LIME evaluation record"
                                  >
                                    LIME Eval
                                  </Link>
                                )}
                                {it.shap_evaluation_id && (
                                  <Link
                                    href={`/faithfulness?eval_id=${it.shap_evaluation_id}`}
                                    className="comp-status-pill comp-badge-shap"
                                    title="View SHAP evaluation record"
                                  >
                                    SHAP Eval
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* =========================================================================
            TAB 2: EVALUATED INPUTS
           ========================================================================= */}
        {activeTab === "evaluated" && (
          <section aria-label="Evaluated Inputs Dataset Comparison View">
            {/* Filter Bar */}
            <div className="comp-filter-card">
              <div className="comp-filter-grid">
                <div className="comp-filter-group">
                  <label htmlFor="filter-metric" className="comp-filter-label">Comparison Metric</label>
                  <select
                    id="filter-metric"
                    className="comp-select"
                    value={selectedMetric}
                    onChange={(e) => handleMetricChange(e.target.value)}
                  >
                    {METRIC_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="comp-filter-group">
                  <label htmlFor="filter-language" className="comp-filter-label">Language</label>
                  <select
                    id="filter-language"
                    className="comp-select"
                    value={selectedLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                  >
                    {LANGUAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="comp-filter-group">
                  <label htmlFor="filter-class" className="comp-filter-label">Explained Class</label>
                  <select
                    id="filter-class"
                    className="comp-select"
                    value={selectedClass}
                    onChange={(e) => handleClassChange(e.target.value)}
                  >
                    {CLASS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="comp-filter-group">
                  <label htmlFor="filter-revision" className="comp-filter-label">Model Revision</label>
                  <select
                    id="filter-revision"
                    className="comp-select"
                    value={selectedRevision}
                    onChange={(e) => {
                      setSelectedRevision(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="all">All Revisions</option>
                    <option value="c3_multilingual_sentiment_v1">c3_multilingual_sentiment_v1</option>
                  </select>
                </div>

                {selectedMetric.includes("AT_K") && (
                  <div className="comp-filter-group" style={{ maxWidth: "120px" }}>
                    <label htmlFor="filter-common-k" className="comp-filter-label">Common k</label>
                    <input
                      id="filter-common-k"
                      type="number"
                      min={1}
                      max={20}
                      className="comp-select"
                      value={commonK}
                      onChange={(e) => setCommonK(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                  </div>
                )}

                {chartLanguageFilter && (
                  <div className="comp-filter-group" style={{ alignSelf: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => setChartLanguageFilter(null)}
                      className="comp-btn comp-btn-secondary"
                      style={{ fontSize: "11.5px", padding: "6px 10px" }}
                    >
                      Clear Language Focus ({chartLanguageFilter}) ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            {isEvaluatedBusy && (
              <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
                Computing authorized pairings and statistical summaries across saved dataset...
              </div>
            )}

            {evaluatedError && (
              <div style={{ padding: "14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#991b1b", marginBottom: "16px", fontSize: "13px" }}>
                ⚠️ {evaluatedError}
              </div>
            )}

            {evaluatedData && (
              <>
                {/* Coverage Cards */}
                <div className="comp-coverage-grid" aria-label="Coverage Statistics">
                  <div className="comp-coverage-card">
                    <div className="comp-coverage-header">
                      <span className="comp-coverage-title">Inputs in Scope</span>
                      <span className="comp-card-badge" style={{ background: "#f1f5f9", color: "#475569" }}>Distinct</span>
                    </div>
                    <div className="comp-coverage-val">{evaluatedData.coverage.distinct_inputs_in_scope}</div>
                    <div className="comp-coverage-sub">Distinct source inputs matching active filters</div>
                  </div>

                  <div className="comp-coverage-card" style={{ borderLeft: "4px solid #16a34a" }}>
                    <div className="comp-coverage-header">
                      <span className="comp-coverage-title" style={{ color: "#15803d" }}>Comparable Pairs</span>
                      <span className="comp-card-badge" style={{ background: "#dcfce7", color: "#15803d" }}>Valid</span>
                    </div>
                    <div className="comp-coverage-val" style={{ color: "#15803d" }}>{evaluatedData.coverage.comparable_pairs}</div>
                    <div className="comp-coverage-sub">Full settings and provenance compatibility</div>
                  </div>

                  <div className="comp-coverage-card" style={{ borderLeft: "4px solid #d97706" }}>
                    <div className="comp-coverage-header">
                      <span className="comp-coverage-title" style={{ color: "#b45309" }}>Missing Evidence</span>
                      <span className="comp-card-badge" style={{ background: "#fef3c7", color: "#b45309" }}>Incomplete</span>
                    </div>
                    <div className="comp-coverage-val" style={{ color: "#b45309" }}>{evaluatedData.coverage.missing_evidence}</div>
                    <div className="comp-coverage-sub">Inputs lacking LIME or SHAP evaluation</div>
                  </div>

                  <div className="comp-coverage-card" style={{ borderLeft: "4px solid #dc2626" }}>
                    <div className="comp-coverage-header">
                      <span className="comp-coverage-title" style={{ color: "#b91c1c" }}>Incompatible Evidence</span>
                      <span className="comp-card-badge" style={{ background: "#fee2e2", color: "#b91c1c" }}>Mismatch</span>
                    </div>
                    <div className="comp-coverage-val" style={{ color: "#b91c1c" }}>{evaluatedData.coverage.incompatible_evidence}</div>
                    <div className="comp-coverage-sub">Settings, word universe, or trials disparity</div>
                  </div>
                </div>

                {/* Insufficient Evidence Notice */}
                {evaluatedData.coverage.comparable_pairs === 0 && (
                  <div className="comp-empty-state">
                    <svg className="comp-empty-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <h3 className="comp-empty-title">Insufficient Comparable Evidence</h3>
                    <p className="comp-empty-desc">
                      Found {evaluatedData.coverage.distinct_inputs_in_scope} inputs in scope, but 0 comparable pairs for <strong>{METRIC_OPTIONS.find((m) => m.value === selectedMetric)?.label}</strong>. Evidence may be missing or evaluated under differing configurations.
                    </p>
                  </div>
                )}

                {/* Summary Metric Comparison Table */}
                <div className="comp-card">
                  <div className="comp-card-header">
                    <div className="comp-card-title-group">
                      <h2 className="comp-card-title">Metric Summaries Across Saved Dataset</h2>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        Computed across full filtered dataset ({evaluatedData.coverage.distinct_inputs_in_scope} inputs)
                      </span>
                    </div>
                  </div>

                  <div className="comp-table-container">
                    <table className="comp-table" aria-label="Metric Summary Table">
                      <thead>
                        <tr>
                          <th>Metric Name</th>
                          <th>Units</th>
                          <th>Valid Pairs</th>
                          <th style={{ color: "#7c3aed" }}>LIME (Mean ± SD)</th>
                          <th style={{ color: "#0d9488" }}>SHAP (Mean ± SD)</th>
                          <th style={{ color: "#2563eb" }}>Paired Diff (SHAP - LIME)</th>
                          <th>Missing</th>
                          <th>Incompatible</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(evaluatedData.metric_summaries ?? []).map((m) => (
                          <tr
                            key={m.metric}
                            className={`clickable ${selectedMetric === m.metric ? "selected" : ""}`}
                            onClick={() => handleMetricChange(m.metric)}
                            title="Click to focus chart and detail table on this metric"
                          >
                            <td style={{ fontWeight: 600 }}>
                              {m.metric_label}
                              {selectedMetric === m.metric && (
                                <span style={{ marginLeft: "8px", fontSize: "11px", color: "#4f46e5", fontWeight: 700 }}>
                                  (Selected)
                                </span>
                              )}
                            </td>
                            <td style={{ color: "#64748b" }}>{m.unit}</td>
                            <td style={{ fontWeight: 600 }}>{m.valid_pairs_count}</td>
                            <td style={{ color: "#7c3aed", fontWeight: 600 }}>
                              {m.lime_mean !== null ? (
                                <>
                                  {formatVal(m.lime_mean, m.unit)}
                                  {m.lime_std !== null ? (
                                    <span style={{ fontSize: "11px", color: "#8b5cf6", fontWeight: 400 }}>
                                      {" "}± {m.lime_std}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: "10.5px", color: "#94a3b8", fontWeight: 400 }}>
                                      {" "}(N=1)
                                    </span>
                                  )}
                                </>
                              ) : "—"}
                            </td>
                            <td style={{ color: "#0d9488", fontWeight: 600 }}>
                              {m.shap_mean !== null ? (
                                <>
                                  {formatVal(m.shap_mean, m.unit)}
                                  {m.shap_std !== null ? (
                                    <span style={{ fontSize: "11px", color: "#14b8a6", fontWeight: 400 }}>
                                      {" "}± {m.shap_std}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: "10.5px", color: "#94a3b8", fontWeight: 400 }}>
                                      {" "}(N=1)
                                    </span>
                                  )}
                                </>
                              ) : "—"}
                            </td>
                            <td style={{ color: "#2563eb", fontWeight: 600 }}>
                              {m.paired_difference_mean !== null ? (
                                <>
                                  {formatVal(m.paired_difference_mean, m.unit)}
                                  {m.paired_difference_std !== null && (
                                    <span style={{ fontSize: "11px", color: "#60a5fa", fontWeight: 400 }}>
                                      {" "}± {m.paired_difference_std}
                                    </span>
                                  )}
                                </>
                              ) : "—"}
                            </td>
                            <td style={{ color: "#b45309" }}>{m.missing_count}</td>
                            <td style={{ color: "#b91c1c" }}>{m.incompatible_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recharts Metric Chart: Grouped by Language */}
                <div className="comp-card">
                  <div className="comp-card-header">
                    <div>
                      <h2 className="comp-card-title">
                        {METRIC_OPTIONS.find((m) => m.value === selectedMetric)?.label} by Language
                      </h2>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                        Error bars explicitly represent <strong>between-input sample standard deviation</strong> (not confidence intervals). Inputs with N=1 display values without error bars.
                      </p>
                    </div>
                    {chartLanguageFilter && (
                      <span className="comp-card-badge comp-badge-diff">
                        Filtered to {chartLanguageFilter}
                      </span>
                    )}
                  </div>

                  {isMounted && (
                    <div className="comp-chart-wrapper">
                      <div style={{ width: "100%", height: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 25 }}
                            onClick={(state) => {
                              if (state && state.activeLabel !== undefined && state.activeLabel !== null) {
                                const lbl = String(state.activeLabel);
                                setChartLanguageFilter(lbl === chartLanguageFilter ? null : lbl);
                              }
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                              dataKey="language"
                              tick={{ fontSize: 12, fill: "#334155" }}
                              stroke="#cbd5e1"
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: "#64748b" }}
                              stroke="#cbd5e1"
                              domain={selectedMetric === "RANK_CORRELATION" ? [-1, 1] : ["auto", "auto"]}
                            />
                            <RechartsTooltip
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  const datum = payload[0].payload as ChartLanguageDatum;
                                  return (
                                    <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.06)" }}>
                                      <div style={{ fontWeight: 700, marginBottom: "4px", color: "#0f172a" }}>
                                        {label} ({datum.validPairs} valid pair{datum.validPairs === 1 ? "" : "s"})
                                      </div>
                                      <div style={{ color: "#7c3aed", fontWeight: 600 }}>
                                        LIME Mean: {datum.limeValue !== null ? datum.limeValue : "—"}
                                      </div>
                                      <div style={{ color: "#0d9488", fontWeight: 600 }}>
                                        SHAP Mean: {datum.shapValue !== null ? datum.shapValue : "—"}
                                      </div>
                                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                                        Click bar to filter paired evidence table below.
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend
                              content={() => (
                                <div className="comp-chart-legend">
                                  <div className="comp-chart-legend-item">
                                    <span className="comp-chart-legend-dot" style={{ background: "#7c3aed" }} />
                                    <span>LIME (Mean ± Between-Input SD)</span>
                                  </div>
                                  <div className="comp-chart-legend-item">
                                    <span className="comp-chart-legend-dot" style={{ background: "#0d9488" }} />
                                    <span>SHAP (Mean ± Between-Input SD)</span>
                                  </div>
                                </div>
                              )}
                            />
                            <Bar
                              dataKey="limeValue"
                              name="LIME"
                              fill="#7c3aed"
                              radius={[4, 4, 0, 0]}
                              maxBarSize={45}
                            >
                              <ErrorBar dataKey="limeError" width={4} strokeWidth={1.5} stroke="#5b21b6" />
                            </Bar>
                            <Bar
                              dataKey="shapValue"
                              name="SHAP"
                              fill="#0d9488"
                              radius={[4, 4, 0, 0]}
                              maxBarSize={45}
                            >
                              <ErrorBar dataKey="shapError" width={4} strokeWidth={1.5} stroke="#0f766e" />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>

                {/* Inspect Paired Evidence Table */}
                <div className="comp-card">
                  <div className="comp-card-header">
                    <div className="comp-card-title-group">
                      <h2 className="comp-card-title">Inspect Paired Evidence</h2>
                      <span className="comp-card-badge" style={{ background: "#f1f5f9", color: "#475569" }}>
                        Showing {(evaluatedData.paired_items ?? []).length} of {evaluatedData.total_items ?? 0} inputs
                      </span>
                    </div>
                    {chartLanguageFilter && (
                      <span style={{ fontSize: "12px", color: "#4f46e5", fontWeight: 600 }}>
                        Filtered by chart language: {chartLanguageFilter}
                      </span>
                    )}
                  </div>

                  <div className="comp-table-container">
                    <table className="comp-table" aria-label="Paired Evidence Detail Table">
                      <thead>
                        <tr>
                          <th>Input Reference</th>
                          <th>Language</th>
                          <th>Class</th>
                          <th style={{ color: "#7c3aed" }}>LIME Value</th>
                          <th style={{ color: "#0d9488" }}>SHAP Value</th>
                          <th style={{ color: "#2563eb" }}>Paired Diff</th>
                          <th>Status</th>
                          <th>Reason / Incompatibility</th>
                          <th>Saved Records</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(evaluatedData.paired_items ?? []).map((it, idx) => (
                          <tr key={`${it.input_reference}-${idx}`}>
                            <td style={{ fontWeight: 600 }}>
                              <code>{it.input_reference}</code>
                            </td>
                            <td>{it.language}</td>
                            <td>{it.explained_class}</td>
                            <td style={{ fontWeight: 600, color: "#7c3aed" }}>
                              {formatVal(it.lime_value, METRIC_DEFINITIONS[it.metric]?.unit)}
                            </td>
                            <td style={{ fontWeight: 600, color: "#0d9488" }}>
                              {formatVal(it.shap_value, METRIC_DEFINITIONS[it.metric]?.unit)}
                            </td>
                            <td style={{ fontWeight: 600, color: it.paired_difference !== null && it.paired_difference !== undefined ? (it.paired_difference > 0 ? "#15803d" : it.paired_difference < 0 ? "#b91c1c" : "#2563eb") : "#64748b" }}>
                              {it.paired_difference !== null && it.paired_difference !== undefined ? formatVal(it.paired_difference, METRIC_DEFINITIONS[it.metric]?.unit) : "—"}
                            </td>
                            <td>{renderStatusBadge(it.status || "")}</td>
                            <td style={{ fontSize: "11.5px", color: "#64748b", maxWidth: "260px" }}>
                              {it.reason || "Compatible pair"}
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "6px" }}>
                                {it.lime_explanation_id && (
                                  <Link
                                    href={`/lime?id=${it.lime_explanation_id}`}
                                    className="comp-status-pill comp-badge-lime"
                                    title="Open LIME explanation"
                                  >
                                    LIME
                                  </Link>
                                )}
                                {it.shap_explanation_id && (
                                  <Link
                                    href={`/shap?id=${it.shap_explanation_id}`}
                                    className="comp-status-pill comp-badge-shap"
                                    title="Open SHAP explanation"
                                  >
                                    SHAP
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="comp-pagination">
                    <span>
                      Page {currentPage} of {Math.max(1, Math.ceil((evaluatedData.total_items ?? 0) / pageSize))} ({evaluatedData.total_items ?? 0} total inputs)
                    </span>
                    <div className="comp-pagination-btns">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="comp-btn comp-btn-secondary"
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                      >
                        ← Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => p + 1)}
                        disabled={currentPage * pageSize >= (evaluatedData.total_items ?? 0)}
                        className="comp-btn comp-btn-secondary"
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* Collapsible Comparison Settings & Metric Definitions Accordion */}
        <section className="comp-accordion" aria-label="Comparison Settings and Metric Definitions">
          <div
            className="comp-accordion-header"
            onClick={() => setShowDefinitions((prev) => !prev)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowDefinitions((prev) => !prev);
              }
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>Comparison Settings, Metric Definitions & Interpretation Rules</span>
            </div>
            <span>{showDefinitions ? "▲ Hide" : "▼ Expand"}</span>
          </div>

          {showDefinitions && (
            <div className="comp-accordion-body">
              <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#0f172a" }}>Why Raw Attribution Magnitudes Are Not Compared</h4>
              <p style={{ margin: "0 0 14px 0" }}>
                LIME feature attributions represent local linear surrogate regression coefficients, whereas SHAP values represent additive Shapley contributions derived via game-theoretic axioms. Because their scales, normalization baselines, and mathematical foundations differ fundamentally, raw attribution magnitudes or attribution standard deviations are never compared directly across methods.
              </p>

              <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#0f172a" }}>Supported Comparative Metrics</h4>
              <ul style={{ margin: "0 0 14px 0", paddingLeft: "20px" }}>
                <li><strong>Deletion AOPC:</strong> Mean explained-class probability drop across progressive deletion of top-k supporting words. Values reported in percentage points (pp).</li>
                <li><strong>Comprehensiveness at common k:</strong> Probability drop when removing the top-k supporting words (p0 - p_del). Higher positive values indicate words with stronger support for the model decision.</li>
                <li><strong>Difference from Random at common k:</strong> Probability drop from top-k word deletion minus the average drop across randomized k-word deletion trials. Positive values verify non-random attribution quality.</li>
                <li><strong>Sufficiency Gap at common k:</strong> Signed gap (p0 - p_keep) when retaining only the top-k supporting words. Values near zero indicate that the isolated words alone preserve the classifier output. A larger signed value is not automatically better.</li>
                <li><strong>Repeated-Run Mean Top-k Overlap:</strong> Jaccard-style feature set overlap between repeated runs and reference Run 1 under perturbation. Reported as percentage.</li>
                <li><strong>Repeated-Run Mean Spearman Rank Correlation:</strong> Monotonicity of absolute attribution rankings across repeated runs against reference Run 1. Preserved in [-1, 1] range.</li>
                <li><strong>Explanation Generation Time:</strong> Computation duration in milliseconds. Disclosed and compared only when identical execution boundaries exist.</li>
              </ul>

              <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#0f172a" }}>Deterministic Default Pairing Rule</h4>
              <p style={{ margin: "0" }}>
                Evidence pairing uses a documented deterministic rule: the latest successfully completed evaluation for LIME and SHAP holding source input, classifier revision, and explained class fixed, without reference to which metric value is higher or lower.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
