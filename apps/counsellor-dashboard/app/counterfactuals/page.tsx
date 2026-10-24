"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { RequireAuth } from "../components/RequireAuth";
import { useReviewCase } from "../context/CaseContext";
import { api, ApiError } from "@j26/common/api";
import type {
  C4CounterfactualRequest,
  C4CounterfactualResponse,
  CounterfactualCandidate,
  C4ManualEvaluationRequest,
  C4ManualEvaluationResponse,
  CounterfactualFeedback,
  CounterfactualFeedbackRequest,
  TextSpanLock,
} from "@j26/common/contracts";

const SENTIMENT_COLORS: Record<string, string> = {
  Negative: "#ef4444",
  Neutral: "#3b82f6",
  Positive: "#16a34a",
};

interface TokenItem {
  text: string;
  start: number;
  end: number;
  isWord: boolean;
  isProtected: boolean;
}

// Word tokenization preserving Sinhala combining marks, matras, and ZWJ conjuncts
// eslint-disable-next-line no-misleading-character-class
const TOKEN_REGEX =
  /(\[[A-Za-z0-9_]+\]|@[A-Za-z0-9_]+|https?:\/\/\S+|\d+(?:[.,]\d+)*|[\w\u0d80-\u0dff\u200c\u200d]+|[^\w\s\u0d80-\u0dff\u200c\u200d]+|\s+)/gu;
const WORD_REGEX = /^[\w\u0d80-\u0dff\u200c\u200d]+$/u;
const PLACEHOLDER_REGEX = /^(\[[A-Za-z0-9_]+\]|@[A-Za-z0-9_]+|https?:\/\/\S+)$/i;
const NUMBER_REGEX = /^\d+([.,]\d+)*$/;

interface CandidateFeedbackState {
  naturalWording: "Yes" | "No" | "Unsure" | null;
  contextPreserved: "Yes" | "No" | "Unsure" | null;
  useful: "Yes" | "No" | "Unsure" | null;
  comment: string;
  savedNotice: string;
}

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

  // Active candidate selection (defaults to best_candidate or rank 1)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  // Active request ref to ignore late responses
  const activeRequestRef = useRef(0);
  const isRestoringRef = useRef(false);
  const restoredIdRef = useRef<string | null>(null);

  // Read original submission text from shared context
  const snapshot = devInput && devInput.text ? devInput : null;
  const submissionText = snapshot
    ? snapshot.text
    : selectedTask?.preprocessing?.anonymized_text || null;
  const caseLanguage = snapshot
    ? snapshot.language || "English"
    : selectedTask?.preprocessing?.language || "English";

  // Actual predictions without hardcoding
  const baselineClass =
    (snapshot?.prediction?.predicted_sentiment as "Negative" | "Neutral" | "Positive" | undefined) ||
    (result?.original_predicted_class as "Negative" | "Neutral" | "Positive" | undefined) ||
    undefined;

  const baselineProbs: Record<string, number> | null =
    snapshot?.prediction?.probabilities ||
    result?.original_probabilities ||
    null;

  // Generation controls
  const [targetClass, setTargetClass] = useState<"Negative" | "Neutral" | "Positive">(
    selectedSentimentClass || "Neutral"
  );
  const [maxEdits, setMaxEdits] = useState<number>(2); // Advertise only implemented depths (1 or 2)
  const [editMode, setEditMode] = useState<"both" | "replace_only" | "delete_only">("both");

  // Word locks (offsets)
  const [lockedSpans, setLockedSpans] = useState<TextSpanLock[]>([]);

  // Auto-switch target class away from baselineClass when baseline becomes known
  const prevBaselineRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (baselineClass && baselineClass !== prevBaselineRef.current) {
      prevBaselineRef.current = baselineClass;
      if (targetClass === baselineClass) {
        const altTarget: "Negative" | "Neutral" | "Positive" =
          baselineClass === "Negative" ? "Neutral" : baselineClass === "Positive" ? "Neutral" : "Positive";
        setTargetClass(altTarget);
        setSelectedSentimentClass(altTarget);
      }
    }
  }, [baselineClass, targetClass, setSelectedSentimentClass]);

  // Manual "What if?" exploration state
  const [manualText, setManualText] = useState<string>(submissionText || "");
  const [manualResult, setManualResult] = useState<C4ManualEvaluationResponse | null>(null);
  const [isManualBusy, setIsManualBusy] = useState<boolean>(false);
  const [manualStale, setManualStale] = useState<boolean>(false);
  const [manualError, setManualError] = useState<string>("");
  const [prevSyncedText, setPrevSyncedText] = useState<string | null>(submissionText);

  // Synchronize manual text during rendering when submissionText changes
  if (submissionText !== prevSyncedText) {
    setPrevSyncedText(submissionText);
    setManualText(submissionText || "");
    setManualResult(null);
    setManualStale(false);
    setManualError("");
  }

  // Reviewer feedback drafts per candidate
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, CandidateFeedbackState>>({});
  const [feedbackSaving, setFeedbackSaving] = useState<boolean>(false);


  // Tokenize original text for interactive span locking
  const textTokens: TokenItem[] = useMemo(() => {
    if (!submissionText) return [];
    const tokens: TokenItem[] = [];
    const re = new RegExp(TOKEN_REGEX.source, "gu");
    let match: RegExpExecArray | null;
    while ((match = re.exec(submissionText)) !== null) {
      const piece = match[0];
      const start = match.index;
      const end = start + piece.length;
      const isProtected = Boolean(PLACEHOLDER_REGEX.test(piece) || NUMBER_REGEX.test(piece));
      const isWord = !isProtected && WORD_REGEX.test(piece);
      tokens.push({ text: piece, start, end, isWord, isProtected });
    }
    return tokens;
  }, [submissionText]);

  // Toggle word lock
  const handleToggleLock = (token: TokenItem) => {
    if (!token.isWord || token.isProtected) return;
    setLockedSpans((prev) => {
      const exists = prev.some((l) => l.start === token.start && l.end === token.end);
      if (exists) {
        return prev.filter((l) => !(l.start === token.start && l.end === token.end));
      } else {
        return [...prev, { start: token.start, end: token.end, text: token.text }];
      }
    });
  };

  const handleClearLocks = () => {
    setLockedSpans([]);
  };

  const isTokenLocked = (token: TokenItem) => {
    return lockedSpans.some(
      (l) => Math.max(l.start, token.start) < Math.min(l.end, token.end)
    );
  };

  const handleLoadDefaultSample = () => {
    const defaultSnapshot = Object.freeze({
      id: `snap_${Date.now()}_default`,
      text: "I have three assignments due this week and the final examination starts next Monday. I cannot sleep and I feel completely overwhelmed by the workload.",
      language: "English",
      prediction: undefined, // Actual probabilities calculated by model on demand
      targetClass: "Positive" as const,
      submittedAt: Date.now(),
    });
    setDevInput(defaultSnapshot);
    setTargetClass("Positive");
    setSelectedSentimentClass("Positive");
    setLockedSpans([]);
  };

  // Clear stale results and URL IDs when input, case, locks, or controls change
  const prevInputRef = useRef({
    submissionText,
    selectedTaskId,
    targetClass,
    maxEdits,
    editMode,
    lockedCount: lockedSpans.length,
  });

  useEffect(() => {
    if (isRestoringRef.current) return;
    const prev = prevInputRef.current;
    if (
      prev.submissionText !== submissionText ||
      prev.selectedTaskId !== selectedTaskId ||
      prev.targetClass !== targetClass ||
      prev.maxEdits !== maxEdits ||
      prev.editMode !== editMode ||
      prev.lockedCount !== lockedSpans.length
    ) {
      prevInputRef.current = {
        submissionText,
        selectedTaskId,
        targetClass,
        maxEdits,
        editMode,
        lockedCount: lockedSpans.length,
      };

      setResult(null);
      setSelectedCandidateId(null);
      setError("");
      setStatusMessage("");
      setFeedbackDrafts({});
      setRestoredTextUnavailable(false);
      activeRequestRef.current++;

      // Clear ?id= from URL
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (url.searchParams.has("id")) {
          url.searchParams.delete("id");
          window.history.replaceState(null, "", url.pathname + (url.search || ""));
        }
      }
    }
  }, [submissionText, selectedTaskId, targetClass, maxEdits, editMode, lockedSpans]);

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
        if (
          data.target_class === "Negative" ||
          data.target_class === "Neutral" ||
          data.target_class === "Positive"
        ) {
          setTargetClass(data.target_class);
        }

        // Verify source identity/content before displaying current context as original text
        const matchesContext = Boolean(
          submissionText &&
            (data.source_reference === (selectedTaskId || snapshot?.id || "development-input"))
        );

        if (!matchesContext) {
          setRestoredTextUnavailable(true);
        } else {
          setRestoredTextUnavailable(false);
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
  }, [checking, authorized, submissionText, selectedTaskId, snapshot?.id]);

  // Active selected candidate (defaults to best_candidate)
  const activeCandidate: CounterfactualCandidate | null = useMemo(() => {
    if (!result) return null;
    const candidateList = result.candidates || [];
    if (selectedCandidateId) {
      if (result.best_candidate?.candidate_id === selectedCandidateId) {
        return result.best_candidate;
      }
      const match = candidateList.find((c) => c.candidate_id === selectedCandidateId);
      if (match) return match;
    }
    return result.best_candidate || (candidateList.length > 0 ? candidateList[0] : null);
  }, [result, selectedCandidateId]);

  const candKey = activeCandidate?.candidate_id || "none";
  const currentFeedback = feedbackDrafts[candKey] || {
    naturalWording: activeCandidate?.feedback?.natural_wording || null,
    contextPreserved: activeCandidate?.feedback?.context_preserved || null,
    useful: activeCandidate?.feedback?.useful || null,
    comment: activeCandidate?.feedback?.comment || "",
    savedNotice: activeCandidate?.feedback?.updated_at
      ? `Feedback recorded at ${new Date(activeCandidate.feedback.updated_at).toLocaleTimeString()}`
      : "",
  };

  const updateCurrentFeedback = (patch: Partial<CandidateFeedbackState>) => {
    setFeedbackDrafts((prev) => ({
      ...prev,
      [candKey]: {
        ...currentFeedback,
        ...patch,
      },
    }));
  };

  // Generate Counterfactuals
  async function handleGenerate() {
    if (!submissionText || !submissionText.trim()) {
      setError("No submission text selected. Please select an assigned case or load a sample.");
      return;
    }

    if (baselineClass && targetClass === baselineClass) {
      setError(
        `Original reflection is already classified as "${baselineClass}". Please select an alternative target class (Neutral or Positive) to search for flip counterfactuals.`
      );
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
        language:
          (caseLanguage as "English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") || "English",
        idempotency_key: idempotencyKey,
        source_reference: selectedTaskId || snapshot?.id || "development-input",
        max_edits: maxEdits,
        max_candidates: 40,
        edit_mode: editMode,
        locked_spans: lockedSpans,
      };

      const data = await api<C4CounterfactualResponse>("/c4/counterfactuals", payload);

      if (currentReqId !== activeRequestRef.current) return; // Ignore late responses

      setResult(data);
      setSelectedCandidateId(data.best_candidate?.candidate_id || null);
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

  // Handle Manual "What If?" evaluation
  async function handleEvaluateManual() {
    if (!submissionText || !manualText.trim()) {
      setManualError("Original or edited text is empty.");
      return;
    }

    setManualError("");
    setIsManualBusy(true);

    try {
      const payload: C4ManualEvaluationRequest = {
        original_text: submissionText.trim(),
        edited_text: manualText.trim(),
        target_class: targetClass,
        language:
          (caseLanguage as "English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed") || "English",
      };

      const data = await api<C4ManualEvaluationResponse>("/c4/counterfactuals/manual", payload);
      setManualResult(data);
      setManualStale(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setManualError("Access forbidden. Reviewer authentication required.");
      } else {
        setManualError("Manual evaluation failed. Check classifier connection.");
      }
    } finally {
      setIsManualBusy(false);
    }
  }

  // Handle Reviewer Feedback saving
  async function handleSaveFeedback() {
    if (!result?.counterfactual_id) {
      setError("Please generate and save a counterfactual before submitting feedback.");
      return;
    }
    if (!activeCandidate?.candidate_id) {
      setError("No candidate selected for feedback.");
      return;
    }

    setFeedbackSaving(true);
    const targetCandId = activeCandidate.candidate_id;

    try {
      const payload: CounterfactualFeedbackRequest = {
        candidate_id: targetCandId,
        natural_wording: currentFeedback.naturalWording || undefined,
        context_preserved: currentFeedback.contextPreserved || undefined,
        useful: currentFeedback.useful || undefined,
        comment: currentFeedback.comment.trim()
          ? currentFeedback.comment.trim().slice(0, 500)
          : undefined,
      };

      const saved = await api<CounterfactualFeedback>(
        `/c4/counterfactuals/${result.counterfactual_id}/feedback`,
        payload
      );

      // Show confirmation ONLY after DB confirmation
      const notice = `✓ Feedback saved to database at ${new Date(saved.updated_at || Date.now()).toLocaleTimeString()}`;
      setFeedbackDrafts((prev) => ({
        ...prev,
        [targetCandId]: {
          ...currentFeedback,
          savedNotice: notice,
        },
      }));

      // Update candidate feedback in result state immutably
      setResult((prev) => {
        if (!prev) return null;
        let updatedBest = prev.best_candidate;
        if (prev.best_candidate?.candidate_id === targetCandId) {
          updatedBest = { ...prev.best_candidate, feedback: saved };
        }
        const updatedList = (prev.candidates || []).map((c) =>
          c.candidate_id === targetCandId ? { ...c, feedback: saved } : c
        );
        return {
          ...prev,
          best_candidate: updatedBest,
          candidates: updatedList,
        };
      });
    } catch (_err) {
      setError("Failed to save reviewer feedback to database. Please retry.");
    } finally {
      setFeedbackSaving(false);
    }
  }

  // Render Diff Spans for Candidate
  function renderDiffText(candidate: CounterfactualCandidate) {
    if (restoredTextUnavailable && !candidate.candidate_text) {
      return (
        <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: "6px", border: "1px dashed #cbd5e1", fontSize: "12px", color: "#64748b" }}>
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
        <span className="cf-span-unchanged">{candidate.candidate_text || "—"}</span>
      </div>
    );
  }

  // Render Probability Comparison Chart
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
    <RequireAuth workspace="research">
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

            <div className="cf-header-pill" title="Language detected in submission">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4 10z" />
              </svg>
              <span>{caseLanguage}</span>
            </div>

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
            Model: Temporary sentiment model — C4 development (cardiffnlp/twitter-xlm-roberta-base-sentiment). Outputs represent model behaviour perturbations, not clinical recommendations.
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

        {/* 1. ORIGINAL TEXT AND GENERATION CONTROLS */}
        <div className="cf-row cf-row-3-cols" style={{ marginBottom: "16px" }}>
          {/* Card 1: Read-Only Original Text & Word Locking */}
          <div className="cf-card cf-card-input-text">
            <div className="cf-card-header">
              <div className="cf-card-title-group">
                <svg className="cf-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <h3 className="cf-card-title">Original Text (Click words to lock)</h3>
              </div>
              {lockedSpans.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearLocks}
                  className="cf-clear-locks-btn"
                  title="Unlock all words"
                >
                  Clear Locks ({lockedSpans.length})
                </button>
              )}
            </div>

            <div className="cf-input-box" style={{ maxHeight: "170px" }}>
              {restoredTextUnavailable ? (
                <p style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "12px", margin: 0 }}>
                  Original text unavailable. (Under patient privacy and retention rules, original text is held transiently and not stored permanently in database records.)
                </p>
              ) : submissionText ? (
                <div className="cf-tokens-container">
                  {textTokens.map((token, idx) => {
                    if (token.isWord) {
                      const locked = isTokenLocked(token);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleToggleLock(token)}
                          className={`cf-token-word ${locked ? "cf-token-locked" : ""}`}
                          title={locked ? "Click to unlock this word" : "Click to lock this word (prevent changes)"}
                        >
                          {locked && <span>🔒</span>}
                          <span>{token.text}</span>
                        </button>
                      );
                    }
                    if (token.isProtected) {
                      return (
                        <span
                          key={idx}
                          className="cf-token-word cf-token-protected"
                          title="Protected token (anonymization placeholder or number)"
                        >
                          {token.text}
                        </span>
                      );
                    }
                    return (
                      <span key={idx} className="cf-token-delimiter">
                        {token.text}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div role="status" style={{ padding: "12px 6px", textAlign: "center" }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>
                    No reflection narrative active
                  </p>
                  <p style={{ color: "#64748b", fontSize: "11.5px", margin: "0 0 10px" }}>
                    Load a sample reflection or enter custom text in Development Input.
                  </p>
                  <button
                    type="button"
                    onClick={handleLoadDefaultSample}
                    className="cf-btn-primary-sm"
                  >
                    ⚡ Load Sample Reflection
                  </button>
                </div>
              )}
            </div>

            <div className="cf-input-bottom-row">
              <span>
                Words: <strong>{submissionText ? submissionText.trim().split(/\s+/).length : 0}</strong> · Chars: <strong>{submissionText ? submissionText.length : 0}</strong>
              </span>
              <span>
                Locks: <strong>{lockedSpans.length}</strong>
              </span>
            </div>
          </div>

          {/* Card 2: Actual Original Model Prediction */}
          <div className="cf-card cf-card-orig-prediction">
            <div className="cf-card-header">
              <div className="cf-card-title-group">
                <svg className="cf-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4 10z" />
                </svg>
                <h3 className="cf-card-title">Original Model Prediction</h3>
              </div>
            </div>

            <div className="cf-prediction-main-row">
              <div>
                <span style={{ fontSize: "10.5px", color: "#64748b", display: "block" }}>Predicted Sentiment:</span>
                <div
                  className="cf-stress-label"
                  style={{
                    color: baselineClass ? SENTIMENT_COLORS[baselineClass] || "#0f172a" : "#64748b",
                    fontSize: baselineClass ? "22px" : "16px",
                  }}
                >
                  {baselineClass || "Not calculated"}
                </div>
              </div>
              <div className="cf-confidence-badge">
                <span className="cf-score-percent">
                  {baselineClass && baselineProbs && baselineProbs[baselineClass] !== undefined
                    ? `${Math.round(baselineProbs[baselineClass] * 100)}%`
                    : "—"}
                </span>
                <span className="cf-score-sublabel">Probability</span>
              </div>
            </div>

            {/* Actual Probabilities or Not calculated */}
            <div className="cf-prob-section">
              {(["Negative", "Neutral", "Positive"] as const).map((cls) => {
                const prob = baselineProbs ? baselineProbs[cls] ?? null : null;
                return (
                  <div key={cls} className="cf-prob-bar-row">
                    <span className="cf-prob-label">{cls}:</span>
                    <div className="cf-prob-track">
                      {prob !== null ? (
                        <div
                          className="cf-prob-fill"
                          style={{
                            width: `${Math.round(prob * 100)}%`,
                            backgroundColor: SENTIMENT_COLORS[cls],
                          }}
                        />
                      ) : null}
                    </div>
                    <span className="cf-prob-val">
                      {prob !== null ? `${(prob * 100).toFixed(0)}%` : "Not calculated"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: "10px", color: "#64748b", marginTop: "auto", borderTop: "1px solid #f1f5f9", paddingTop: "6px", display: "flex", justifyContent: "space-between" }}>
              <span>CardiffNLP twitter-xlm-roberta</span>
              <span style={{ color: "#16a34a", fontWeight: 600 }}>Adapter Ready</span>
            </div>
          </div>

          {/* Card 3: Generation Controls */}
          <div className="cf-card cf-card-explanation-summary">
            <div className="cf-card-header">
              <div className="cf-card-title-group">
                <svg className="cf-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                <h3 className="cf-card-title">Generation Controls</h3>
              </div>
            </div>

            {/* Target Class Control */}
            <div style={{ marginBottom: "10px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "4px" }}>
                Target Class Flip:
              </span>
              <div className="cf-target-button-group" role="radiogroup" aria-label="Target Class Selector">
                {(["Negative", "Neutral", "Positive"] as const).map((cls) => {
                  const isActive = targetClass === cls;
                  const isCurrent = baselineClass === cls;
                  return (
                    <button
                      key={cls}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      className={`cf-target-btn ${isActive ? `cf-target-btn-active-${cls}` : ""} ${
                        isCurrent ? "cf-target-btn-current" : ""
                      }`}
                      onClick={() => {
                        setTargetClass(cls);
                        setSelectedSentimentClass(cls);
                      }}
                      disabled={isBusy}
                      title={
                        isCurrent
                          ? `Original text is currently classified as ${cls}`
                          : `Target flip to ${cls}`
                      }
                    >
                      {cls} {isCurrent && <span style={{ fontSize: "9px", opacity: 0.8 }}>(Current)</span>}
                    </button>
                  );
                })}
              </div>
              {targetClass === baselineClass && (
                <div style={{ fontSize: "11px", color: "#b45309", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "5px", padding: "4px 8px", marginTop: "6px", lineHeight: "1.4" }}>
                  ⚠️ Original text is already predicted as <strong>{baselineClass}</strong>. Select an alternative target class to find a perturbation that flips the prediction.
                </div>
              )}
            </div>

            {/* Max Word Edits Control */}
            <div style={{ marginBottom: "10px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "4px" }}>
                Max Word Edits (Implemented depths):
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                {[1, 2].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className={`cf-feedback-btn ${maxEdits === num ? "cf-feedback-btn-selected" : ""}`}
                    onClick={() => setMaxEdits(num)}
                    disabled={isBusy}
                  >
                    {num} {num === 1 ? "word edit" : "word edits"}
                  </button>
                ))}
              </div>
            </div>

            {/* Edit Mode Control */}
            <div style={{ marginBottom: "12px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "4px" }}>
                Allowed Edit Operations:
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                {[
                  { id: "both", label: "Deletions & Replacements" },
                  { id: "replace_only", label: "Replacements Only" },
                  { id: "delete_only", label: "Deletions Only" },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    style={{ fontSize: "10.5px", padding: "4px 8px" }}
                    className={`cf-feedback-btn ${editMode === mode.id ? "cf-feedback-btn-selected" : ""}`}
                    onClick={() => setEditMode(mode.id as "both" | "replace_only" | "delete_only")}
                    disabled={isBusy}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="cf-generate-btn"
              onClick={handleGenerate}
              disabled={isBusy || !submissionText}
              style={{ width: "100%", marginTop: "auto" }}
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
              Running bounded candidate generation, adhering to locked spans, and evaluating model flips…
            </p>
          </div>
        )}

        {/* 2. BEST COUNTERFACTUAL WITH SIDE-BY-SIDE COMPARISON */}
        {result && !isBusy && (
          <section aria-label="Counterfactual Results" style={{ marginBottom: "20px" }}>
            {/* Outcome Notice */}
            {result.outcome === "NO_COUNTERFACTUAL_FOUND" && (
              <div className="cf-state-card cf-state-no-result" role="status" style={{ marginBottom: "16px" }}>
                <h3 className="cf-state-title" style={{ color: "#92400e" }}>
                  No Counterfactual Found Within Search Bounds
                </h3>
                <p className="cf-state-desc" style={{ color: "#78350f" }}>
                  {result.outcome_message}
                </p>
                <div style={{ marginTop: "8px", fontSize: "11.5px", color: "#92400e" }}>
                  No synthetic counterfactual has been fabricated. Try allowing 2 edits or manual exploration below.
                </div>
              </div>
            )}

            {result.outcome === "ALREADY_TARGET_CLASS" && (
              <div className="cf-outcome-card cf-outcome-info" style={{ marginBottom: "16px" }}>
                <div>
                  <strong>Outcome: Already Target Class</strong>
                  <p style={{ margin: "4px 0 0", fontSize: "13px" }}>{result.outcome_message}</p>
                </div>
              </div>
            )}

            {activeCandidate && (
              <div className="cf-card" style={{ padding: "18px 20px" }}>
                {/* Header & Verification Label */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className="cf-rank-badge cf-rank-badge-best">
                      {activeCandidate.minimality_rank === 1 ? "Best Counterfactual" : `Alternative Candidate (Rank #${activeCandidate.minimality_rank})`}
                    </span>
                    <span className="cf-verified-badge">
                      ✓ Model flip verified
                    </span>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Fewest edits found within this search.
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px" }}>
                    <span>
                      Target: <strong style={{ color: SENTIMENT_COLORS[activeCandidate.predicted_class] }}>{activeCandidate.predicted_class}</strong>
                    </span>
                    <span>
                      Edits: <strong>{activeCandidate.edit_count}</strong>
                    </span>
                  </div>
                </div>

                {/* Side-by-Side Comparison */}
                <div className="cf-side-by-side-wrap">
                  {/* Left: Original Text */}
                  <div className="cf-side-panel">
                    <div className="cf-side-panel-header">
                      <span>Original Text</span>
                      <span style={{ color: SENTIMENT_COLORS[result.original_predicted_class || "Negative"] || "#475569" }}>
                        {result.original_predicted_class || "Baseline"}
                      </span>
                    </div>
                    <div className="cf-highlight-text-box" style={{ flex: 1 }}>
                      {restoredTextUnavailable ? (
                        <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                          Original text unavailable.
                        </span>
                      ) : (
                        <span>{submissionText}</span>
                      )}
                    </div>
                  </div>

                  {/* Right: Modified Perturbed Text */}
                  <div className="cf-side-panel">
                    <div className="cf-side-panel-header">
                      <span>Perturbed Counterfactual Text</span>
                      <span style={{ color: SENTIMENT_COLORS[activeCandidate.predicted_class] || "#16a34a" }}>
                        {activeCandidate.predicted_class} (Flipped)
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      {renderDiffText(activeCandidate)}
                    </div>
                  </div>
                </div>

                {/* Probability Shift & Metrics */}
                <div className="cf-sub-cards-split" style={{ marginBottom: "14px" }}>
                  <div>{renderProbabilityComparison(activeCandidate)}</div>

                  <div>
                    <div className="cf-prob-header">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      <span>Edit Operations Breakdown ({activeCandidate.edits?.length || 0})</span>
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
                          {activeCandidate.edits && activeCandidate.edits.length > 0 ? (
                            activeCandidate.edits.map((op, opIdx) => (
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
                    <span className="cf-metric-title">Original → Candidate Class</span>
                    <span className="cf-metric-val">
                      {result.original_predicted_class || "—"} →{" "}
                      <span style={{ color: SENTIMENT_COLORS[activeCandidate.predicted_class] }}>
                        {activeCandidate.predicted_class}
                      </span>
                    </span>
                  </div>

                  <div className="cf-metric-col">
                    <span className="cf-metric-title">Target Probability</span>
                    <span className="cf-metric-val">
                      {((result.original_probabilities?.[targetClass] || 0) * 100).toFixed(1)}% →{" "}
                      {(activeCandidate.target_probability * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="cf-metric-col">
                    <span className="cf-metric-title">Probability Shift</span>
                    <span
                      className={`cf-metric-val ${activeCandidate.target_probability_delta >= 0 ? "cf-metric-delta-pos" : "cf-metric-delta-neg"}`}
                    >
                      {activeCandidate.target_probability_delta >= 0 ? "+" : ""}
                      {(activeCandidate.target_probability_delta * 100).toFixed(1)} pp
                    </span>
                  </div>

                  <div className="cf-metric-col">
                    <span className="cf-metric-title">Word Edits</span>
                    <span className="cf-metric-val">
                      {activeCandidate.edit_count} {activeCandidate.edit_count === 1 ? "word edit" : "word edits"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 3. COLLAPSIBLE ALTERNATIVE CANDIDATES */}
        {result && result.candidates && result.candidates.length > 0 && (
          <details className="cf-collapsible-details" open style={{ marginBottom: "20px" }}>
            <summary className="cf-collapsible-summary">
              <span>Alternative Verified Candidates ({result.candidates.length} distinct alternatives available)</span>
              <span style={{ fontSize: "11px", color: "#6366f1" }}>Click candidate to compare</span>
            </summary>
            <div className="cf-collapsible-content">
              <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#64748b" }}>
                Select an alternative successful candidate to update the side-by-side comparison and probability chart above:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "10px" }}>
                {result.candidates.map((alt) => {
                  const isSelected = activeCandidate?.candidate_id === alt.candidate_id;
                  return (
                    <div
                      key={alt.candidate_id || alt.minimality_rank}
                      className={`cf-alt-candidate-card ${isSelected ? "cf-alt-candidate-card-active" : ""}`}
                      onClick={() => setSelectedCandidateId(alt.candidate_id || null)}
                      role="button"
                      tabIndex={0}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <strong style={{ fontSize: "12px", color: "#1e293b" }}>
                          Candidate #{alt.minimality_rank}
                        </strong>
                        <span className="cf-edit-count-badge">
                          {alt.edit_count} {alt.edit_count === 1 ? "edit" : "edits"}
                        </span>
                      </div>
                      <div style={{ fontSize: "11.5px", color: "#475569", marginBottom: "6px" }}>
                        Target Prob: <strong>{(alt.target_probability * 100).toFixed(1)}%</strong> ({alt.target_probability_delta >= 0 ? "+" : ""}{(alt.target_probability_delta * 100).toFixed(1)} pp)
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        &ldquo;{alt.candidate_text}&rdquo;
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </details>
        )}

        {/* 4. MANUAL “WHAT IF?” EDITOR */}
        <section className="cf-card" style={{ padding: "18px 20px", marginBottom: "20px" }} aria-label="Manual What If Exploration">
          <div className="cf-card-header" style={{ marginBottom: "8px" }}>
            <div className="cf-card-title-group">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <h2 className="cf-card-title">Manual &ldquo;What If?&rdquo; Exploration</h2>
            </div>
            {manualStale && (
              <span className="cf-stale-badge">
                Draft modified — click Evaluate to recalculate
              </span>
            )}
          </div>

          <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#64748b" }}>
            Test your own wording hypotheses. Edits are evaluated server-side using the shared classifier without overwriting the original student reflection.
          </p>

          <textarea
            className="cf-manual-textarea"
            value={manualText}
            onChange={(e) => {
              setManualText(e.target.value);
              setManualStale(true);
            }}
            placeholder="Type or modify reflection text..."
            disabled={isManualBusy || !submissionText}
          />

          <div className="cf-manual-actions">
            <button
              type="button"
              className="cf-btn-primary-sm"
              onClick={handleEvaluateManual}
              disabled={isManualBusy || !manualText.trim()}
            >
              {isManualBusy ? "Evaluating Model Prediction…" : 'Evaluate "What If?"'}
            </button>

            <button
              type="button"
              className="cf-btn-secondary-sm"
              onClick={() => {
                setManualText(submissionText || "");
                setManualStale(false);
                setManualResult(null);
                setManualError("");
              }}
              disabled={isManualBusy || !submissionText}
            >
              Reset to Original
            </button>

            {manualError && (
              <span style={{ fontSize: "11.5px", color: "#ef4444" }}>{manualError}</span>
            )}
          </div>

          {/* Manual Evaluation Results */}
          {manualResult && (
            <div style={{ marginTop: "14px", borderTop: "1px solid #f1f5f9", paddingTop: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
                <span
                  className="cf-verified-badge"
                  style={{
                    background: manualResult.is_flip ? "#dcfce7" : "#fef3c7",
                    color: manualResult.is_flip ? "#166534" : "#92400e",
                    borderColor: manualResult.is_flip ? "#bbf7d0" : "#fde68a",
                  }}
                >
                  {manualResult.is_flip ? "✓ Model flip verified" : manualResult.flip_status_label}
                </span>
                <span style={{ fontSize: "12px", color: "#334155" }}>
                  Original <strong>{manualResult.original_predicted_class}</strong> → Edited{" "}
                  <strong style={{ color: SENTIMENT_COLORS[manualResult.edited_predicted_class] }}>
                    {manualResult.edited_predicted_class}
                  </strong>
                </span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  Target shift: <strong>{manualResult.target_probability_delta >= 0 ? "+" : ""}{(manualResult.target_probability_delta * 100).toFixed(1)} pp</strong> ({manualResult.edit_count} word {manualResult.edit_count === 1 ? "edit" : "edits"})
                </span>
              </div>

              {/* Diff visualization */}
              <div className="cf-highlight-text-box" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
                {(manualResult.diff_spans || []).map((span, idx) => {
                  if (span.type === "deleted") {
                    return (
                      <span key={idx} className="cf-span-deleted">
                        {span.text}
                      </span>
                    );
                  }
                  if (span.type === "inserted") {
                    return (
                      <span key={idx} className="cf-span-inserted">
                        {span.text}
                      </span>
                    );
                  }
                  if (span.type === "replaced") {
                    return (
                      <span key={idx} className="cf-span-replaced">
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
            </div>
          )}
        </section>

        {/* 5. REVIEWER FEEDBACK AND COLLAPSIBLE SEARCH DETAILS */}
        {result && activeCandidate && (
          <section className="cf-feedback-card" aria-label="Reviewer Feedback">
            <div className="cf-card-header" style={{ marginBottom: "12px" }}>
              <div className="cf-card-title-group">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
                <h2 className="cf-card-title">
                  Reviewer Evaluation &amp; Feedback ({activeCandidate.minimality_rank === 1 ? "Best Candidate" : `Candidate #${activeCandidate.minimality_rank}`})
                </h2>
              </div>
              {currentFeedback.savedNotice && (
                <span style={{ fontSize: "11.5px", color: "#166534", fontWeight: 600 }}>
                  {currentFeedback.savedNotice}
                </span>
              )}
            </div>

            <p style={{ margin: "0 0 14px", fontSize: "12px", color: "#64748b" }}>
              Record qualitative human review against candidate ID <code>{activeCandidate.candidate_id || "transient"}</code>. Saved feedback is persisted in PostgreSQL with reviewer identity and timestamps.
            </p>

            <div className="cf-feedback-grid">
              {/* Field 1: Natural wording */}
              <div className="cf-feedback-item">
                <span className="cf-feedback-label">Natural phrasing &amp; syntax?</span>
                <div className="cf-feedback-options">
                  {(["Yes", "No", "Unsure"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`cf-feedback-btn ${currentFeedback.naturalWording === opt ? "cf-feedback-btn-selected" : ""}`}
                      onClick={() => updateCurrentFeedback({ naturalWording: opt })}
                      disabled={feedbackSaving}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field 2: Context preserved */}
              <div className="cf-feedback-item">
                <span className="cf-feedback-label">Unrelated context preserved?</span>
                <div className="cf-feedback-options">
                  {(["Yes", "No", "Unsure"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`cf-feedback-btn ${currentFeedback.contextPreserved === opt ? "cf-feedback-btn-selected" : ""}`}
                      onClick={() => updateCurrentFeedback({ contextPreserved: opt })}
                      disabled={feedbackSaving}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field 3: Useful */}
              <div className="cf-feedback-item">
                <span className="cf-feedback-label">Useful exploration aid?</span>
                <div className="cf-feedback-options">
                  {(["Yes", "No", "Unsure"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`cf-feedback-btn ${currentFeedback.useful === opt ? "cf-feedback-btn-selected" : ""}`}
                      onClick={() => updateCurrentFeedback({ useful: opt })}
                      disabled={feedbackSaving}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Comment */}
            <div style={{ marginBottom: "12px" }}>
              <span className="cf-feedback-label" style={{ display: "block", marginBottom: "4px" }}>
                Optional Reviewer Note (max 500 characters):
              </span>
              <textarea
                className="cf-comment-textarea"
                maxLength={500}
                value={currentFeedback.comment}
                onChange={(e) => updateCurrentFeedback({ comment: e.target.value })}
                placeholder="Enter notes on candidate semantics, language nuances, or diagnostic boundary..."
                disabled={feedbackSaving}
              />
              <div className="cf-comment-counter">
                {currentFeedback.comment.length} / 500 characters
              </div>
            </div>

            <button
              type="button"
              className="cf-btn-primary-sm"
              onClick={handleSaveFeedback}
              disabled={feedbackSaving}
            >
              {feedbackSaving ? "Saving to Database…" : "Save Reviewer Feedback"}
            </button>
          </section>
        )}

        {/* Collapsible Search Details */}
        {result && (
          <details className="cf-collapsible-details" style={{ marginTop: "14px" }}>
            <summary className="cf-collapsible-summary">
              <span>Search Statistics &amp; Model Details</span>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Execution details</span>
            </summary>
            <div className="cf-collapsible-content">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", fontSize: "12px", color: "#334155" }}>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "10.5px" }}>Evaluated Candidates</span>
                  <strong>{result.evaluated_candidate_count || 0}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "10.5px" }}>Successful Flips Found</span>
                  <strong>{result.successful_candidate_count || ((result.candidates?.length || 0) + (result.best_candidate ? 1 : 0))}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "10.5px" }}>Execution Time</span>
                  <strong>{result.execution_time_ms ? `${result.execution_time_ms}ms` : "—"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "10.5px" }}>Stopping Reason</span>
                  <strong>{result.stopping_reason || result.outcome}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "10.5px" }}>Model Checkpoint</span>
                  <strong>{result.model_id || "twitter-xlm-roberta-base-sentiment"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", fontSize: "10.5px" }}>Effective Search Limits</span>
                  <strong>Max edits: {maxEdits} · Budget: 40</strong>
                </div>
              </div>

              <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #f1f5f9", fontSize: "11px", color: "#64748b", lineHeight: 1.45 }}>
                <em>Note:</em> These edits explore the sentiment model&apos;s sensitivity and behaviour under controlled perturbations. They do not represent wellbeing advice, clinical judgements, or corrections to the student&apos;s account.
              </div>
            </div>
          </details>
        )}
      </main>
    </div>
    </RequireAuth>
  );
}
