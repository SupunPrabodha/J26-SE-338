"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { api, ApiError } from "@j26/common/api";
import type {
  C4ExplanationResponse,
  C4PredictionResponse,
  C4CounterfactualResponse,
  C4ManualEvaluationResponse,
  CounterfactualFeedback,
  TextSpanLock,
  C4FaithfulnessResponse,
  C4StabilityResponse,
  C4ComparisonCurrentResponse,
  C4ComparisonEvaluatedResponse,
} from "@j26/common/contracts";
import { useReviewCase, type DevelopmentInputSnapshot } from "./CaseContext";

export type SentimentClass = "Negative" | "Neutral" | "Positive";

export interface CommittedSource {
  type: "dev" | "case" | null;
  id: string | null;
  fingerprint: string | null;
  text: string | null;
  language: string;
  modelVersion?: string;
  targetClass: SentimentClass;
}

export interface C4ExplanationState {
  response: C4ExplanationResponse | null;
  status: "IDLE" | "IN_FLIGHT" | "READY" | "ERROR" | "RESTORING";
  statusMessage: string;
  error: string;
  isSaved: boolean;
  savedId: string | null;
}

export interface C4CounterfactualState {
  response: C4CounterfactualResponse | null;
  status: "IDLE" | "IN_FLIGHT" | "READY" | "ERROR" | "RESTORING";
  statusMessage: string;
  error: string;
  isSaved: boolean;
  savedId: string | null;
  selectedCandidateId: string | null;
  restoredTextUnavailable: boolean;
  maxEdits: number;
  editMode: "both" | "replace_only" | "delete_only";
  lockedSpans: TextSpanLock[];
  manualText: string;
  manualResult: C4ManualEvaluationResponse | null;
  isManualBusy: boolean;
  manualError: string;
}

export interface C4FaithfulnessState {
  response: C4FaithfulnessResponse | null;
  status: "IDLE" | "IN_FLIGHT" | "READY" | "ERROR" | "RESTORING";
  statusMessage: string;
  error: string;
  savedNotice: string;
  selectedExpId: string;
  selectedStep: number | null;
  budgetMode: "words" | "pct";
  maxWords: number;
  maxPct: number;
  randomTrials: number;
  seed: number;
  showAdvanced: boolean;
}

export interface C4StabilityState {
  response: C4StabilityResponse | null;
  status: "IDLE" | "IN_FLIGHT" | "READY" | "ERROR" | "RESTORING";
  statusMessage: string;
  error: string;
  savedNotice: string;
  selectedExpId: string;
  selectedRunIndex: number;
  runCount: number;
  topK: number;
  baseSeed: number;
  explainerEvals: number;
  showAdvanced: boolean;
}

export interface C4ComparisonState {
  currentResponse: C4ComparisonCurrentResponse | null;
  evaluatedResponse: C4ComparisonEvaluatedResponse | null;
  selectedMetric: string;
  selectedRevision: string;
  selectedClass: string;
  selectedLanguage: string;
  chartLanguageFilter: string;
  commonK: number;
  activeTab: "current" | "evaluated";
  selectedLimeRecId: string;
  selectedShapRecId: string;
  isCurrentBusy: boolean;
  currentError: string;
  isEvaluatedBusy: boolean;
  evaluatedError: string;
}

export interface C4WorkspaceContextType {
  committedSource: CommittedSource | null;
  prediction: C4PredictionResponse | null;
  isPredicting: boolean;
  predictionError: string;
  isClassifierConnected: boolean;

  // LIME & SHAP
  lime: C4ExplanationState;
  shap: C4ExplanationState;
  computeLime: (customClass?: SentimentClass) => Promise<void>;
  computeShap: (customClass?: SentimentClass) => Promise<void>;
  restoreExplanation: (id: string, method: "LIME" | "SHAP") => Promise<void>;

  // Counterfactuals
  counterfactual: C4CounterfactualState;
  computeCounterfactuals: (params?: {
    targetClass?: SentimentClass;
    maxEdits?: number;
    editMode?: "both" | "replace_only" | "delete_only";
    lockedSpans?: TextSpanLock[];
  }) => Promise<void>;
  restoreCounterfactual: (id: string) => Promise<void>;
  setSelectedCandidateId: (id: string | null) => void;
  setCounterfactualSettings: (settings: Partial<Pick<C4CounterfactualState, "maxEdits" | "editMode" | "lockedSpans">>) => void;
  setManualText: (text: string) => void;
  runManualEvaluation: (overrideText?: string) => Promise<void>;
  resetManualEvaluation: () => void;
  updateCounterfactualFeedback: (candidateId: string, feedback: CounterfactualFeedback) => void;

  // Faithfulness
  faithfulness: C4FaithfulnessState;
  computeFaithfulness: (params?: {
    explanationId?: string;
    budgetMode?: "words" | "pct";
    maxWords?: number;
    maxPct?: number;
    randomTrials?: number;
    seed?: number;
  }) => Promise<void>;
  restoreFaithfulness: (evalId: string) => Promise<void>;
  setSelectedFaithfulnessExpId: (id: string) => void;
  setSelectedFaithfulnessStep: (step: number | null) => void;
  setFaithfulnessSettings: (settings: Partial<Pick<C4FaithfulnessState, "budgetMode" | "maxWords" | "maxPct" | "randomTrials" | "seed" | "showAdvanced">>) => void;

  // Stability
  stability: C4StabilityState;
  computeStability: (params?: {
    explanationId?: string;
    runCount?: number;
    topK?: number;
    baseSeed?: number;
    explainerEvals?: number;
  }) => Promise<void>;
  restoreStability: (evalId: string) => Promise<void>;
  setSelectedStabilityExpId: (id: string) => void;
  setSelectedStabilityRunIndex: (index: number) => void;
  setStabilitySettings: (settings: Partial<Pick<C4StabilityState, "runCount" | "topK" | "baseSeed" | "explainerEvals" | "showAdvanced">>) => void;
  resetStabilityAnalysis: () => void;

  // Comparison
  comparison: C4ComparisonState;
  runComparisonCurrent: () => Promise<void>;
  runComparisonEvaluated: (page?: number, pageSize?: number) => Promise<void>;
  setComparisonSettings: (settings: Partial<C4ComparisonState>) => void;

  // Workspace Actions
  commitNewSource: (snapshot: DevelopmentInputSnapshot) => void;
  clearActiveWorkspace: () => void;
}

const MANIFEST_KEY = "j26_c4_manifest";

export interface C4WorkspaceManifest {
  version: 1;
  sourceType: "case" | "dev" | null;
  sourceId: string | null;
  sourceFingerprint: string | null;
  language: string;
  targetClass: SentimentClass;
  savedIds: {
    limeId?: string | null;
    shapId?: string | null;
    counterfactualId?: string | null;
    faithfulnessId?: string | null;
    stabilityId?: string | null;
  };
  settings: {
    faithfulness?: {
      budgetMode: "words" | "pct";
      maxWords: number;
      maxPct: number;
      randomTrials: number;
      seed: number;
      showAdvanced: boolean;
    };
    stability?: {
      runCount: number;
      topK: number;
      baseSeed: number;
      explainerEvals: number;
      showAdvanced: boolean;
    };
    counterfactual?: {
      maxEdits: number;
      editMode: "both" | "replace_only" | "delete_only";
    };
    comparison?: {
      selectedMetric: string;
      selectedRevision: string;
      selectedClass: string;
      selectedLanguage: string;
      commonK: number;
      activeTab: "current" | "evaluated";
    };
  };
}

export function computeSourceFingerprint(text: string | null | undefined, language: string | null | undefined): string {
  if (!text) return "";
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
  }
  return `fp_${language || "en"}_${text.length}_${hash}`;
}

function readSafeManifest(): C4WorkspaceManifest | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(MANIFEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1) return parsed as C4WorkspaceManifest;
  } catch {
    // Ignore read errors
  }
  return null;
}

function writeSafeManifest(manifest: C4WorkspaceManifest | null) {
  if (typeof window === "undefined") return;
  try {
    if (manifest) {
      sessionStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
    } else {
      sessionStorage.removeItem(MANIFEST_KEY);
    }
  } catch {
    // Ignore write errors
  }
}

const C4WorkspaceContext = createContext<C4WorkspaceContextType | null>(null);

export function C4WorkspaceProvider({ children }: { children: ReactNode }) {
  const {
    authorized,
    checking,
    selectedTask,
    selectedTaskId,
    selectedSentimentClass,
    setSelectedSentimentClass,
    devInput,
  } = useReviewCase();

  // Workspace generation counter and active request tracking
  const workspaceGenerationRef = useRef(0);
  const requestIdCounterRef = useRef(0);
  const activeRequestsRef = useRef<{ [key: string]: number }>({});
  const abortControllersRef = useRef<{ [key: string]: AbortController }>({});

  // 1. Determine active committed source from shared context
  const activeSnapshot = devInput && devInput.text ? devInput : null;
  const activeText = activeSnapshot
    ? activeSnapshot.text
    : selectedTask?.preprocessing?.anonymized_text || null;
  const activeLang = activeSnapshot
    ? activeSnapshot.language || "English"
    : selectedTask?.preprocessing?.language || "English";
  const activeType: "dev" | "case" | null = activeSnapshot ? "dev" : selectedTask ? "case" : null;
  const activeId = activeSnapshot ? activeSnapshot.id : selectedTask ? selectedTask.task_id : null;
  const activeFingerprint = activeText ? computeSourceFingerprint(activeText, activeLang) : null;
  const activeModelVersion = activeSnapshot?.modelVersion || undefined;

  const [committedSource, setCommittedSource] = useState<CommittedSource | null>(() => {
    if (!activeText) return null;
    return {
      type: activeType,
      id: activeId,
      fingerprint: activeFingerprint,
      text: activeText,
      language: activeLang,
      modelVersion: activeModelVersion,
      targetClass: selectedSentimentClass || "Negative",
    };
  });

  const committedSourceRef = useRef<CommittedSource | null>(committedSource);
  committedSourceRef.current = committedSource;

  // 2. Base prediction state
  const [prediction, setPrediction] = useState<C4PredictionResponse | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionError, setPredictionError] = useState("");
  const [isClassifierConnected, setIsClassifierConnected] = useState(true);

  // 3. Explanation stores (cached by target class for the active committed source)
  const [limeResultsByClass, setLimeResultsByClass] = useState<Partial<Record<SentimentClass, C4ExplanationResponse>>>({});
  const [limeStatusByClass, setLimeStatusByClass] = useState<Partial<Record<SentimentClass, "IDLE" | "IN_FLIGHT" | "READY" | "ERROR" | "RESTORING">>>({});
  const [limeMessageByClass, setLimeMessageByClass] = useState<Partial<Record<SentimentClass, string>>>({});
  const [limeErrorByClass, setLimeErrorByClass] = useState<Partial<Record<SentimentClass, string>>>({});

  const [shapResultsByClass, setShapResultsByClass] = useState<Partial<Record<SentimentClass, C4ExplanationResponse>>>({});
  const [shapStatusByClass, setShapStatusByClass] = useState<Partial<Record<SentimentClass, "IDLE" | "IN_FLIGHT" | "READY" | "ERROR" | "RESTORING">>>({});
  const [shapMessageByClass, setShapMessageByClass] = useState<Partial<Record<SentimentClass, string>>>({});
  const [shapErrorByClass, setShapErrorByClass] = useState<Partial<Record<SentimentClass, string>>>({});

  // 4. Counterfactual state
  const [cfResultsByClass, setCfResultsByClass] = useState<Partial<Record<SentimentClass, C4CounterfactualResponse>>>({});
  const [cfStatusByClass, setCfStatusByClass] = useState<Partial<Record<SentimentClass, "IDLE" | "IN_FLIGHT" | "READY" | "ERROR" | "RESTORING">>>({});
  const [cfMessageByClass, setCfMessageByClass] = useState<Partial<Record<SentimentClass, string>>>({});
  const [cfErrorByClass, setCfErrorByClass] = useState<Partial<Record<SentimentClass, string>>>({});
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [restoredTextUnavailable, setRestoredTextUnavailable] = useState(false);
  const [cfMaxEdits, setCfMaxEdits] = useState<number>(2);
  const [cfEditMode, setCfEditMode] = useState<"both" | "replace_only" | "delete_only">("both");
  const [cfLockedSpans, setCfLockedSpans] = useState<TextSpanLock[]>([]);
  const [manualText, setManualText] = useState<string>("");
  const [manualResult, setManualResult] = useState<C4ManualEvaluationResponse | null>(null);
  const [isManualBusy, setIsManualBusy] = useState(false);
  const [manualError, setManualError] = useState("");

  // 5. Faithfulness state
  const [faithfulnessResultsByExpId, setFaithfulnessResultsByExpId] = useState<Record<string, C4FaithfulnessResponse>>({});
  const [faithfulnessStatus, setFaithfulnessStatus] = useState<"IDLE" | "IN_FLIGHT" | "READY" | "ERROR" | "RESTORING">("IDLE");
  const [faithfulnessMessage, setFaithfulnessMessage] = useState("");
  const [faithfulnessError, setFaithfulnessError] = useState("");
  const [faithfulnessSavedNotice, setFaithfulnessSavedNotice] = useState("");
  const [selectedFaithfulnessExpId, setSelectedFaithfulnessExpId] = useState("");
  const [selectedFaithfulnessStep, setSelectedFaithfulnessStep] = useState<number | null>(null);
  const [faithfulnessBudgetMode, setFaithfulnessBudgetMode] = useState<"words" | "pct">("words");
  const [faithfulnessMaxWords, setFaithfulnessMaxWords] = useState<number>(5);
  const [faithfulnessMaxPct, setFaithfulnessMaxPct] = useState<number>(30);
  const [faithfulnessRandomTrials, setFaithfulnessRandomTrials] = useState<number>(5);
  const [faithfulnessSeed, setFaithfulnessSeed] = useState<number>(42);
  const [faithfulnessShowAdvanced, setFaithfulnessShowAdvanced] = useState<boolean>(false);

  // 6. Stability state
  const [stabilityResultsByExpId, setStabilityResultsByExpId] = useState<Record<string, C4StabilityResponse>>({});
  const [stabilityStatus, setStabilityStatus] = useState<"IDLE" | "IN_FLIGHT" | "READY" | "ERROR" | "RESTORING">("IDLE");
  const [stabilityMessage, setStabilityMessage] = useState("");
  const [stabilityError, setStabilityError] = useState("");
  const [stabilitySavedNotice, setStabilitySavedNotice] = useState("");
  const [selectedStabilityExpId, setSelectedStabilityExpId] = useState("");
  const [selectedStabilityRunIndex, setSelectedStabilityRunIndex] = useState<number>(2);
  const [stabilityRunCount, setStabilityRunCount] = useState<number>(5);
  const [stabilityTopK, setStabilityTopK] = useState<number>(5);
  const [stabilityBaseSeed, setStabilityBaseSeed] = useState<number>(42);
  const [stabilityExplainerEvals, setStabilityExplainerEvals] = useState<number>(100);
  const [stabilityShowAdvanced, setStabilityShowAdvanced] = useState<boolean>(false);

  // 7. Comparison state
  const [comparisonCurrentResponse, setComparisonCurrentResponse] = useState<C4ComparisonCurrentResponse | null>(null);
  const [comparisonEvaluatedResponse, setComparisonEvaluatedResponse] = useState<C4ComparisonEvaluatedResponse | null>(null);
  const [comparisonSelectedMetric, setComparisonSelectedMetric] = useState<string>("DELETION_AOPC");
  const [comparisonSelectedRevision, setComparisonSelectedRevision] = useState<string>("main");
  const [comparisonSelectedClass, setComparisonSelectedClass] = useState<string>("all");
  const [comparisonSelectedLanguage, setComparisonSelectedLanguage] = useState<string>("all");
  const [comparisonChartLangFilter, setComparisonChartLangFilter] = useState<string>("");
  const [comparisonCommonK, setComparisonCommonK] = useState<number>(5);
  const [comparisonActiveTab, setComparisonActiveTab] = useState<"current" | "evaluated">("current");
  const [comparisonSelectedLimeId, setComparisonSelectedLimeId] = useState<string>("");
  const [comparisonSelectedShapId, setComparisonSelectedShapId] = useState<string>("");
  const [isComparisonCurrentBusy, setIsComparisonCurrentBusy] = useState(false);
  const [comparisonCurrentError, setComparisonCurrentError] = useState("");
  const [isComparisonEvaluatedBusy, setIsComparisonEvaluatedBusy] = useState(false);
  const [comparisonEvaluatedError, setComparisonEvaluatedError] = useState("");

  // Helper to update manifest in sessionStorage without storing raw text
  const syncManifest = useCallback((override?: Partial<C4WorkspaceManifest>) => {
    if (typeof window === "undefined") return;
    const current = committedSourceRef.current;
    const manifest: C4WorkspaceManifest = {
      version: 1,
      sourceType: current?.type || null,
      sourceId: current?.id || null,
      sourceFingerprint: current?.fingerprint || null,
      language: current?.language || "English",
      targetClass: current?.targetClass || "Negative",
      savedIds: {
        limeId: override?.savedIds?.limeId,
        shapId: override?.savedIds?.shapId,
        counterfactualId: override?.savedIds?.counterfactualId,
        faithfulnessId: override?.savedIds?.faithfulnessId,
        stabilityId: override?.savedIds?.stabilityId,
      },
      settings: {
        faithfulness: {
          budgetMode: faithfulnessBudgetMode,
          maxWords: faithfulnessMaxWords,
          maxPct: faithfulnessMaxPct,
          randomTrials: faithfulnessRandomTrials,
          seed: faithfulnessSeed,
          showAdvanced: faithfulnessShowAdvanced,
        },
        stability: {
          runCount: stabilityRunCount,
          topK: stabilityTopK,
          baseSeed: stabilityBaseSeed,
          explainerEvals: stabilityExplainerEvals,
          showAdvanced: stabilityShowAdvanced,
        },
        counterfactual: {
          maxEdits: cfMaxEdits,
          editMode: cfEditMode,
        },
        comparison: {
          selectedMetric: comparisonSelectedMetric,
          selectedRevision: comparisonSelectedRevision,
          selectedClass: comparisonSelectedClass,
          selectedLanguage: comparisonSelectedLanguage,
          commonK: comparisonCommonK,
          activeTab: comparisonActiveTab,
        },
      },
    };
    writeSafeManifest(manifest);
  }, [
    faithfulnessBudgetMode,
    faithfulnessMaxWords,
    faithfulnessMaxPct,
    faithfulnessRandomTrials,
    faithfulnessSeed,
    faithfulnessShowAdvanced,
    stabilityRunCount,
    stabilityTopK,
    stabilityBaseSeed,
    stabilityExplainerEvals,
    stabilityShowAdvanced,
    cfMaxEdits,
    cfEditMode,
    comparisonSelectedMetric,
    comparisonSelectedRevision,
    comparisonSelectedClass,
    comparisonSelectedLanguage,
    comparisonCommonK,
    comparisonActiveTab,
  ]);

  // Centralized atomic cleanup
  const clearActiveWorkspace = useCallback(() => {
    workspaceGenerationRef.current += 1;
    activeRequestsRef.current = {};
    Object.values(abortControllersRef.current).forEach((ctrl) => ctrl.abort());
    abortControllersRef.current = {};

    setCommittedSource(null);
    setPrediction(null);
    setPredictionError("");
    setLimeResultsByClass({});
    setLimeStatusByClass({});
    setLimeMessageByClass({});
    setLimeErrorByClass({});
    setShapResultsByClass({});
    setShapStatusByClass({});
    setShapMessageByClass({});
    setShapErrorByClass({});
    setCfResultsByClass({});
    setCfStatusByClass({});
    setCfMessageByClass({});
    setCfErrorByClass({});
    setSelectedCandidateId(null);
    setManualResult(null);
    setManualError("");
    setFaithfulnessResultsByExpId({});
    setFaithfulnessStatus("IDLE");
    setFaithfulnessMessage("");
    setFaithfulnessError("");
    setFaithfulnessSavedNotice("");
    setSelectedFaithfulnessExpId("");
    setSelectedFaithfulnessStep(null);
    setStabilityResultsByExpId({});
    setStabilityStatus("IDLE");
    setStabilityMessage("");
    setStabilityError("");
    setStabilitySavedNotice("");
    setSelectedStabilityExpId("");
    setComparisonCurrentResponse(null);
    setComparisonCurrentError("");
    writeSafeManifest(null);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (
        url.searchParams.has("id") ||
        url.searchParams.has("eval_id") ||
        url.searchParams.has("evaluation_id") ||
        url.searchParams.has("exp_id")
      ) {
        url.searchParams.delete("id");
        url.searchParams.delete("eval_id");
        url.searchParams.delete("evaluation_id");
        url.searchParams.delete("exp_id");
        window.history.replaceState(null, "", url.toString());
      }
    }
  }, []);

  // Invalidate on unauthorized / session expiry
  useEffect(() => {
    if (!checking && !authorized) {
      clearActiveWorkspace();
    }
  }, [checking, authorized, clearActiveWorkspace]);

  // Synchronize committed source from CaseContext (devInput or selectedTask)
  useEffect(() => {
    if (!authorized) return;

    const nextSource: CommittedSource | null = activeText
      ? {
          type: activeType,
          id: activeId,
          fingerprint: activeFingerprint,
          text: activeText,
          language: activeLang,
          modelVersion: activeModelVersion,
          targetClass: selectedSentimentClass || "Negative",
        }
      : null;

    const prev = committedSourceRef.current;
    const sourceChanged =
      (!prev && nextSource) ||
      (prev && !nextSource) ||
      (prev && nextSource && (prev.fingerprint !== nextSource.fingerprint || prev.id !== nextSource.id));

    if (sourceChanged) {
      // Atomic invalidation on source change
      workspaceGenerationRef.current += 1;
      activeRequestsRef.current = {};
      Object.values(abortControllersRef.current).forEach((ctrl) => ctrl.abort());
      abortControllersRef.current = {};

      setCommittedSource(nextSource);
      setPrediction(activeSnapshot?.prediction || null);
      setPredictionError("");
      setLimeResultsByClass({});
      setLimeStatusByClass({});
      setLimeMessageByClass({});
      setLimeErrorByClass({});
      setShapResultsByClass({});
      setShapStatusByClass({});
      setShapMessageByClass({});
      setShapErrorByClass({});
      setCfResultsByClass({});
      setCfStatusByClass({});
      setCfMessageByClass({});
      setCfErrorByClass({});
      setSelectedCandidateId(null);
      setManualResult(null);
      setManualError("");
      setManualText(nextSource?.text || "");
      setFaithfulnessResultsByExpId({});
      setFaithfulnessStatus("IDLE");
      setFaithfulnessMessage("");
      setFaithfulnessError("");
      setFaithfulnessSavedNotice("");
      setSelectedFaithfulnessExpId("");
      setSelectedFaithfulnessStep(null);
      setStabilityResultsByExpId({});
      setStabilityStatus("IDLE");
      setStabilityMessage("");
      setStabilityError("");
      setStabilitySavedNotice("");
      setSelectedStabilityExpId("");
      setComparisonCurrentResponse(null);
      setComparisonCurrentError("");

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (
          url.searchParams.has("id") ||
          url.searchParams.has("eval_id") ||
          url.searchParams.has("evaluation_id") ||
          url.searchParams.has("exp_id")
        ) {
          url.searchParams.delete("id");
          url.searchParams.delete("eval_id");
          url.searchParams.delete("evaluation_id");
          url.searchParams.delete("exp_id");
          window.history.replaceState(null, "", url.toString());
        }
      }
    } else if (nextSource && prev) {
      // Just keep class / text in sync if unchanged
      if (prev.targetClass !== nextSource.targetClass) {
        setCommittedSource(nextSource);
      }
      if (activeSnapshot?.prediction && !prediction) {
        setPrediction(activeSnapshot.prediction);
      }
    }
  }, [
    authorized,
    activeText,
    activeLang,
    activeType,
    activeId,
    activeFingerprint,
    activeModelVersion,
    selectedSentimentClass,
    activeSnapshot,
    prediction,
  ]);

  // Fetch prediction once if source is committed but prediction is missing
  useEffect(() => {
    if (!authorized || !committedSource?.text || prediction || isPredicting) return;
    let live = true;
    setIsPredicting(true);
    setPredictionError("");

    fetch("/api/c4-predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: committedSource.text,
        language: committedSource.language,
      }),
    })
      .then(async (res) => {
        if (!live) return;
        if (res.ok) {
          const data = (await res.json()) as C4PredictionResponse;
          setPrediction(data);
          setIsClassifierConnected(true);
        } else {
          const err = await res.json().catch(() => ({}));
          setPredictionError(err.error || `Prediction check failed (${res.status})`);
          setIsClassifierConnected(false);
        }
      })
      .catch((err) => {
        if (!live) return;
        setPredictionError(err.message || "Could not connect to sentiment classifier");
        setIsClassifierConnected(false);
      })
      .finally(() => {
        if (live) setIsPredicting(false);
      });

    return () => {
      live = false;
    };
  }, [authorized, committedSource, prediction, isPredicting]);

  // Restore safe settings from manifest on mount
  useEffect(() => {
    const manifest = readSafeManifest();
    if (!manifest) return;
    if (manifest.settings?.faithfulness) {
      setFaithfulnessBudgetMode(manifest.settings.faithfulness.budgetMode);
      setFaithfulnessMaxWords(manifest.settings.faithfulness.maxWords);
      setFaithfulnessMaxPct(manifest.settings.faithfulness.maxPct);
      setFaithfulnessRandomTrials(manifest.settings.faithfulness.randomTrials);
      setFaithfulnessSeed(manifest.settings.faithfulness.seed);
      setFaithfulnessShowAdvanced(manifest.settings.faithfulness.showAdvanced);
    }
    if (manifest.settings?.stability) {
      setStabilityRunCount(manifest.settings.stability.runCount);
      setStabilityTopK(manifest.settings.stability.topK);
      setStabilityBaseSeed(manifest.settings.stability.baseSeed);
      setStabilityExplainerEvals(manifest.settings.stability.explainerEvals);
      setStabilityShowAdvanced(manifest.settings.stability.showAdvanced);
    }
    if (manifest.settings?.counterfactual) {
      setCfMaxEdits(manifest.settings.counterfactual.maxEdits);
      setCfEditMode(manifest.settings.counterfactual.editMode);
    }
    if (manifest.settings?.comparison) {
      setComparisonSelectedMetric(manifest.settings.comparison.selectedMetric);
      setComparisonSelectedRevision(manifest.settings.comparison.selectedRevision);
      setComparisonSelectedClass(manifest.settings.comparison.selectedClass);
      setComparisonSelectedLanguage(manifest.settings.comparison.selectedLanguage);
      setComparisonCommonK(manifest.settings.comparison.commonK);
      setComparisonActiveTab(manifest.settings.comparison.activeTab);
    }
  }, []);

  // Compute LIME Explanation
  const computeLime = useCallback(
    async (customClass?: SentimentClass) => {
      const cls = customClass || committedSourceRef.current?.targetClass || "Negative";
      const src = committedSourceRef.current;
      if (!src?.text) {
        setLimeErrorByClass((prev) => ({
          ...prev,
          [cls]: "Submit text first on the Development Input page before computing explanations.",
        }));
        return;
      }

      const reqKey = `LIME_${cls}_${src.fingerprint}`;
      if (activeRequestsRef.current[reqKey]) {
        return; // Deduplicate concurrent identical request
      }

      const reqGen = workspaceGenerationRef.current;
      const reqId = ++requestIdCounterRef.current;
      activeRequestsRef.current[reqKey] = reqId;

      abortControllersRef.current["LIME"]?.abort();
      const controller = new AbortController();
      abortControllersRef.current["LIME"] = controller;

      setLimeStatusByClass((prev) => ({ ...prev, [cls]: "IN_FLIGHT" }));
      setLimeMessageByClass((prev) => ({
        ...prev,
        [cls]: `Running LIME explanation for "${cls}" with whitespace Unicode preservation...`,
      }));
      setLimeErrorByClass((prev) => ({ ...prev, [cls]: "" }));

      try {
        const data = await api<C4ExplanationResponse>("/c4/explanations", {
          text: src.text,
          method: "LIME",
          target_class: cls,
          language: src.language,
          idempotency_key: crypto.randomUUID(),
        });

        if (
          workspaceGenerationRef.current !== reqGen ||
          activeRequestsRef.current[reqKey] !== reqId ||
          committedSourceRef.current?.fingerprint !== src.fingerprint
        ) {
          return; // Drop late response
        }

        setLimeResultsByClass((prev) => ({ ...prev, [cls]: data }));
        setLimeStatusByClass((prev) => ({ ...prev, [cls]: "READY" }));

        if (data.status === "AWAITING_CLASSIFIER_CONNECTION") {
          setIsClassifierConnected(false);
          setLimeMessageByClass((prev) => ({
            ...prev,
            [cls]: "Awaiting classifier connection — C3 model integration pending.",
          }));
        } else if (data.status === "UNAVAILABLE") {
          setIsClassifierConnected(true);
          setLimeMessageByClass((prev) => ({
            ...prev,
            [cls]: data.status_message || "LIME explanation unavailable.",
          }));
        } else {
          setIsClassifierConnected(true);
          setLimeMessageByClass((prev) => ({
            ...prev,
            [cls]: data.explanation_id
              ? `LIME explanation for "${cls}" computed and saved successfully.`
              : "LIME explanation computed successfully.",
          }));
        }

        if (data.explanation_id) {
          syncManifest({ savedIds: { limeId: String(data.explanation_id) } });
          if (typeof window !== "undefined" && window.location.pathname === "/lime") {
            const url = new URL(window.location.href);
            url.searchParams.set("id", String(data.explanation_id));
            window.history.replaceState(null, "", url.toString());
          }
        }
      } catch (err) {
        if (
          workspaceGenerationRef.current === reqGen &&
          activeRequestsRef.current[reqKey] === reqId
        ) {
          setLimeStatusByClass((prev) => ({ ...prev, [cls]: "ERROR" }));
          setLimeErrorByClass((prev) => ({
            ...prev,
            [cls]: (err as Error).message || "Could not retrieve LIME explanation from services.",
          }));
        }
      } finally {
        if (activeRequestsRef.current[reqKey] === reqId) {
          delete activeRequestsRef.current[reqKey];
        }
      }
    },
    [syncManifest]
  );

  // Compute SHAP Explanation
  const computeShap = useCallback(
    async (customClass?: SentimentClass) => {
      const cls = customClass || committedSourceRef.current?.targetClass || "Negative";
      const src = committedSourceRef.current;
      if (!src?.text) {
        setShapErrorByClass((prev) => ({
          ...prev,
          [cls]: "Submit text first on the Development Input page before computing explanations.",
        }));
        return;
      }

      const reqKey = `SHAP_${cls}_${src.fingerprint}`;
      if (activeRequestsRef.current[reqKey]) {
        return; // Deduplicate concurrent identical request
      }

      const reqGen = workspaceGenerationRef.current;
      const reqId = ++requestIdCounterRef.current;
      activeRequestsRef.current[reqKey] = reqId;

      abortControllersRef.current["SHAP"]?.abort();
      const controller = new AbortController();
      abortControllersRef.current["SHAP"] = controller;

      setShapStatusByClass((prev) => ({ ...prev, [cls]: "IN_FLIGHT" }));
      setShapMessageByClass((prev) => ({
        ...prev,
        [cls]: `Computing exact Shapley values for "${cls}" with word-token coalition perturbations...`,
      }));
      setShapErrorByClass((prev) => ({ ...prev, [cls]: "" }));

      try {
        const data = await api<C4ExplanationResponse>("/c4/explanations", {
          text: src.text,
          method: "SHAP",
          target_class: cls,
          language: src.language,
          idempotency_key: crypto.randomUUID(),
        });

        if (
          workspaceGenerationRef.current !== reqGen ||
          activeRequestsRef.current[reqKey] !== reqId ||
          committedSourceRef.current?.fingerprint !== src.fingerprint
        ) {
          return; // Drop late response
        }

        setShapResultsByClass((prev) => ({ ...prev, [cls]: data }));
        setShapStatusByClass((prev) => ({ ...prev, [cls]: "READY" }));

        if (data.status === "AWAITING_CLASSIFIER_CONNECTION") {
          setIsClassifierConnected(false);
          setShapMessageByClass((prev) => ({
            ...prev,
            [cls]: "Awaiting classifier connection — C3 model integration pending.",
          }));
        } else if (data.status === "UNAVAILABLE") {
          setIsClassifierConnected(true);
          setShapMessageByClass((prev) => ({
            ...prev,
            [cls]: data.status_message || "SHAP explanation unavailable.",
          }));
        } else {
          setIsClassifierConnected(true);
          setShapMessageByClass((prev) => ({
            ...prev,
            [cls]: data.explanation_id
              ? `SHAP explanation for "${cls}" computed and saved successfully.`
              : "SHAP explanation computed successfully.",
          }));
        }

        if (data.explanation_id) {
          syncManifest({ savedIds: { shapId: String(data.explanation_id) } });
          if (typeof window !== "undefined" && window.location.pathname === "/shap") {
            const url = new URL(window.location.href);
            url.searchParams.set("id", String(data.explanation_id));
            window.history.replaceState(null, "", url.toString());
          }
        }
      } catch (err) {
        if (
          workspaceGenerationRef.current === reqGen &&
          activeRequestsRef.current[reqKey] === reqId
        ) {
          setShapStatusByClass((prev) => ({ ...prev, [cls]: "ERROR" }));
          setShapErrorByClass((prev) => ({
            ...prev,
            [cls]: (err as Error).message || "Could not retrieve SHAP explanation from services.",
          }));
        }
      } finally {
        if (activeRequestsRef.current[reqKey] === reqId) {
          delete activeRequestsRef.current[reqKey];
        }
      }
    },
    [syncManifest]
  );

  // Restore Saved Explanation (LIME or SHAP) via authenticated GET
  const restoreExplanation = useCallback(
    async (id: string, method: "LIME" | "SHAP") => {
      if (!id) return;
      const setter = method === "LIME" ? setLimeResultsByClass : setShapResultsByClass;
      const statusSetter = method === "LIME" ? setLimeStatusByClass : setShapStatusByClass;
      const msgSetter = method === "LIME" ? setLimeMessageByClass : setShapMessageByClass;
      const errSetter = method === "LIME" ? setLimeErrorByClass : setShapErrorByClass;

      const reqGen = workspaceGenerationRef.current;
      try {
        const data = await api<C4ExplanationResponse>(`/c4/explanations/${id}`);
        if (workspaceGenerationRef.current !== reqGen) return;

        if (data.method !== method) {
          errSetter((prev) => ({
            ...prev,
            [data.target_class as SentimentClass]: `Method mismatch: record ${id} is a ${data.method} explanation, not ${method}.`,
          }));
          return;
        }

        const cls = (data.target_class as SentimentClass) || "Negative";
        setter((prev) => ({ ...prev, [cls]: data }));
        statusSetter((prev) => ({ ...prev, [cls]: "READY" }));
        msgSetter((prev) => ({ ...prev, [cls]: `Restored saved ${method} explanation (${cls}).` }));

        if (data.probabilities && data.predicted_class && !prediction) {
          setPrediction({
            model_id: data.model_id || "cardiffnlp/twitter-xlm-roberta-base-sentiment",
            model_version: data.model_version || "",
            model_revision: data.model_revision || null,
            predicted_sentiment: data.predicted_class as SentimentClass,
            confidence: data.probabilities[data.predicted_class] ?? (data.target_class_probability ?? 0),
            probabilities: data.probabilities,
            token_count: data.token_count ?? 0,
            truncated: data.truncated ?? false,
            max_sequence_length: 512,
            status: "READY",
            status_message: "Restored from saved explanation record.",
          });
        }
      } catch (err) {
        if (workspaceGenerationRef.current !== reqGen) return;
        errSetter((prev) => ({
          ...prev,
          Negative:
            err instanceof ApiError && err.status === 404
              ? "Saved explanation record not found or has expired."
              : "Failed to retrieve saved explanation record.",
        }));
      }
    },
    [prediction]
  );

  // Compute Counterfactuals
  const computeCounterfactuals = useCallback(
    async (params?: {
      targetClass?: SentimentClass;
      maxEdits?: number;
      editMode?: "both" | "replace_only" | "delete_only";
      lockedSpans?: TextSpanLock[];
    }) => {
      const src = committedSourceRef.current;
      const cls = params?.targetClass || src?.targetClass || "Neutral";
      const edits = params?.maxEdits ?? cfMaxEdits;
      const mode = params?.editMode ?? cfEditMode;
      const locks = params?.lockedSpans ?? cfLockedSpans;

      if (!src?.text) {
        setCfErrorByClass((prev) => ({ ...prev, [cls]: "No reflection submission is active in shared context." }));
        return;
      }

      const reqKey = `CF_${cls}_${src.fingerprint}_${edits}_${mode}`;
      if (activeRequestsRef.current[reqKey]) return;

      const reqGen = workspaceGenerationRef.current;
      const reqId = ++requestIdCounterRef.current;
      activeRequestsRef.current[reqKey] = reqId;

      setCfStatusByClass((prev) => ({ ...prev, [cls]: "IN_FLIGHT" }));
      setCfMessageByClass((prev) => ({
        ...prev,
        [cls]: `Generating minimal perturbation counterfactuals targeting "${cls}"...`,
      }));
      setCfErrorByClass((prev) => ({ ...prev, [cls]: "" }));

      try {
        const payload = {
          text: src.text,
          language: src.language,
          target_class: cls,
          max_edits: edits,
          edit_mode: mode,
          locked_spans: locks,
          source_reference: src.id || "development-input",
        };

        const data = await api<C4CounterfactualResponse>("/c4/counterfactuals", payload);

        if (
          workspaceGenerationRef.current !== reqGen ||
          activeRequestsRef.current[reqKey] !== reqId ||
          committedSourceRef.current?.fingerprint !== src.fingerprint
        ) {
          return;
        }

        setCfResultsByClass((prev) => ({ ...prev, [cls]: data }));
        setCfStatusByClass((prev) => ({ ...prev, [cls]: "READY" }));
        setSelectedCandidateId(
          data.best_candidate?.candidate_id || data.candidates?.[0]?.candidate_id || null
        );
        setRestoredTextUnavailable(false);

        if (data.outcome === "SUCCESS") {
          setCfMessageByClass((prev) => ({
            ...prev,
            [cls]: `Generated ${data.evaluated_candidate_count || 0} candidate(s); best counterfactual found with ${data.best_candidate?.edit_count || 1} edit(s).`,
          }));
        } else if (data.outcome === "NO_COUNTERFACTUAL_FOUND") {
          setCfMessageByClass((prev) => ({
            ...prev,
            [cls]: "No counterfactual within the edit budget flipped the sentiment. Showing nearest partial candidate.",
          }));
        } else {
          setCfMessageByClass((prev) => ({ ...prev, [cls]: data.outcome_message || "Counterfactual generation complete." }));
        }

        if (data.counterfactual_id) {
          syncManifest({ savedIds: { counterfactualId: String(data.counterfactual_id) } });
          if (typeof window !== "undefined" && window.location.pathname === "/counterfactuals") {
            const url = new URL(window.location.href);
            url.searchParams.set("id", String(data.counterfactual_id));
            window.history.replaceState(null, "", url.toString());
          }
        }
      } catch (err) {
        if (workspaceGenerationRef.current === reqGen && activeRequestsRef.current[reqKey] === reqId) {
          setCfStatusByClass((prev) => ({ ...prev, [cls]: "ERROR" }));
          setCfErrorByClass((prev) => ({
            ...prev,
            [cls]: (err as Error).message || "Could not generate counterfactual explanations.",
          }));
        }
      } finally {
        if (activeRequestsRef.current[reqKey] === reqId) {
          delete activeRequestsRef.current[reqKey];
        }
      }
    },
    [cfMaxEdits, cfEditMode, cfLockedSpans, syncManifest]
  );

  // Restore Counterfactual via authenticated GET
  const restoreCounterfactual = useCallback(async (id: string) => {
    if (!id) return;
    const reqGen = workspaceGenerationRef.current;
    try {
      const data = await api<C4CounterfactualResponse>(`/c4/counterfactuals/${id}`);
      if (workspaceGenerationRef.current !== reqGen) return;

      const cls = (data.target_class as SentimentClass) || "Neutral";
      setCfResultsByClass((prev) => ({ ...prev, [cls]: data }));
      setCfStatusByClass((prev) => ({ ...prev, [cls]: "READY" }));
      setSelectedCandidateId(data.best_candidate?.candidate_id || data.candidates?.[0]?.candidate_id || null);

      const src = committedSourceRef.current;
      const matchesContext = Boolean(
        src?.text && data.source_reference === (src.id || "development-input")
      );
      setRestoredTextUnavailable(!matchesContext);
      setCfMessageByClass((prev) => ({
        ...prev,
        [cls]: "Saved counterfactual explanation record restored successfully.",
      }));
    } catch (err) {
      if (workspaceGenerationRef.current !== reqGen) return;
      setCfErrorByClass((prev) => ({
        ...prev,
        Neutral:
          err instanceof ApiError && err.status === 404
            ? "Saved counterfactual record not found or has expired."
            : "Could not restore the saved counterfactual explanation record.",
      }));
    }
  }, []);

  // Run Manual "What If?" evaluation
  const runManualEvaluation = useCallback(
    async (overrideText?: string) => {
      const src = committedSourceRef.current;
      const textToEval = overrideText !== undefined ? overrideText : manualText;
      if (!textToEval.trim()) {
        setManualError("Please enter modified text to evaluate.");
        return;
      }
      setIsManualBusy(true);
      setManualError("");

      const reqGen = workspaceGenerationRef.current;
      try {
        const payload = {
          modified_text: textToEval,
          original_text: src?.text || textToEval,
          language: src?.language || "English",
        };
        const data = await api<C4ManualEvaluationResponse>("/c4/counterfactuals/manual", payload);
        if (workspaceGenerationRef.current !== reqGen) return;
        setManualResult(data);
      } catch (err) {
        if (workspaceGenerationRef.current !== reqGen) return;
        setManualError((err as Error).message || "Could not evaluate modified text.");
      } finally {
        if (workspaceGenerationRef.current === reqGen) {
          setIsManualBusy(false);
        }
      }
    },
    [manualText]
  );

  const updateCounterfactualFeedback = useCallback(
    (candidateId: string, feedback: CounterfactualFeedback) => {
      setCfResultsByClass((prev) => {
        const next = { ...prev };
        for (const [cls, resp] of Object.entries(next)) {
          if (!resp) continue;
          let updatedBest = resp.best_candidate;
          if (resp.best_candidate?.candidate_id === candidateId) {
            updatedBest = { ...resp.best_candidate, feedback };
          }
          const updatedList = (resp.candidates || []).map((c) =>
            c.candidate_id === candidateId ? { ...c, feedback } : c
          );
          next[cls as SentimentClass] = {
            ...resp,
            best_candidate: updatedBest,
            candidates: updatedList,
          };
        }
        return next;
      });
    },
    []
  );

  const resetManualEvaluation = useCallback(() => {
    const src = committedSourceRef.current;
    setManualText(src?.text || "");
    setManualResult(null);
    setManualError("");
  }, []);

  // Compute Faithfulness Test
  const computeFaithfulness = useCallback(
    async (params?: {
      explanationId?: string;
      budgetMode?: "words" | "pct";
      maxWords?: number;
      maxPct?: number;
      randomTrials?: number;
      seed?: number;
    }) => {
      const expId = params?.explanationId || selectedFaithfulnessExpId;
      const src = committedSourceRef.current;
      const bMode = params?.budgetMode || faithfulnessBudgetMode;
      const words = params?.maxWords ?? faithfulnessMaxWords;
      const pct = params?.maxPct ?? faithfulnessMaxPct;
      const trials = params?.randomTrials ?? faithfulnessRandomTrials;
      const s = params?.seed ?? faithfulnessSeed;

      if (!expId) {
        setFaithfulnessError("Please select a saved LIME or SHAP explanation to evaluate.");
        return;
      }
      if (!src?.text) {
        setFaithfulnessError("No source text is available in the current context.");
        return;
      }

      const reqKey = `FAITH_${expId}_${bMode}_${words}_${pct}_${trials}_${s}`;
      if (activeRequestsRef.current[reqKey]) return;

      const reqGen = workspaceGenerationRef.current;
      const reqId = ++requestIdCounterRef.current;
      activeRequestsRef.current[reqKey] = reqId;

      setFaithfulnessStatus("IN_FLIGHT");
      setFaithfulnessMessage("Running model-based progressive deletion & random trials...");
      setFaithfulnessError("");
      setFaithfulnessSavedNotice("");

      try {
        const payload = {
          explanation_id: expId,
          text: src.text,
          language: src.language as "English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed",
          max_removal_words: bMode === "words" ? words : null,
          max_removal_pct: bMode === "pct" ? pct : null,
          random_trials: trials,
          seed: s,
        };

        const data = await api<C4FaithfulnessResponse>("/c4/faithfulness", payload);
        if (workspaceGenerationRef.current !== reqGen || activeRequestsRef.current[reqKey] !== reqId) {
          return;
        }

        setFaithfulnessResultsByExpId((prev) => ({ ...prev, [expId]: data }));
        setFaithfulnessStatus("READY");
        if (data.steps && data.steps.length > 0) {
          setSelectedFaithfulnessStep(data.steps[data.steps.length - 1].step);
        }

        if (data.outcome === "SUCCESS") {
          setFaithfulnessMessage(data.outcome_message || "Faithfulness test completed successfully.");
        } else if (data.outcome === "PARTIAL") {
          setFaithfulnessMessage(`Partial result: ${data.outcome_message}`);
        } else {
          setFaithfulnessError(`Evaluation halted: ${data.outcome_message}`);
        }

        if (data.evaluation_id) {
          setFaithfulnessSavedNotice(`Saved in PostgreSQL (Record ID: ${data.evaluation_id})`);
          syncManifest({ savedIds: { faithfulnessId: String(data.evaluation_id) } });
          if (typeof window !== "undefined" && window.location.pathname === "/faithfulness") {
            const url = new URL(window.location.href);
            url.searchParams.set("eval_id", String(data.evaluation_id));
            window.history.replaceState(null, "", url.toString());
          }
        }
      } catch (err) {
        if (workspaceGenerationRef.current === reqGen && activeRequestsRef.current[reqKey] === reqId) {
          setFaithfulnessStatus("ERROR");
          setFaithfulnessError((err as Error).message || "Could not complete faithfulness evaluation.");
        }
      } finally {
        if (activeRequestsRef.current[reqKey] === reqId) {
          delete activeRequestsRef.current[reqKey];
        }
      }
    },
    [
      selectedFaithfulnessExpId,
      faithfulnessBudgetMode,
      faithfulnessMaxWords,
      faithfulnessMaxPct,
      faithfulnessRandomTrials,
      faithfulnessSeed,
      syncManifest,
    ]
  );

  // Restore Faithfulness via authenticated GET
  const restoreFaithfulness = useCallback(async (evalId: string) => {
    if (!evalId) return;
    const reqGen = workspaceGenerationRef.current;
    setFaithfulnessStatus("RESTORING");
    try {
      const data = await api<C4FaithfulnessResponse>(`/c4/faithfulness/${evalId}`);
      if (workspaceGenerationRef.current !== reqGen) return;

      setFaithfulnessResultsByExpId((prev) => ({ ...prev, [data.explanation_id]: data }));
      setSelectedFaithfulnessExpId(data.explanation_id);
      setFaithfulnessStatus("READY");
      setFaithfulnessMessage("Restored saved faithfulness evaluation from database.");
      setFaithfulnessSavedNotice(`Saved in PostgreSQL (Record ID: ${data.evaluation_id})`);
      if (data.steps && data.steps.length > 0) {
        setSelectedFaithfulnessStep(data.steps[data.steps.length - 1].step);
      }
    } catch (err) {
      if (workspaceGenerationRef.current !== reqGen) return;
      setFaithfulnessStatus("ERROR");
      setFaithfulnessError((err as Error).message || "Failed to retrieve saved faithfulness evaluation.");
    }
  }, []);

  // Compute Stability Analysis
  const computeStability = useCallback(
    async (params?: {
      explanationId?: string;
      runCount?: number;
      topK?: number;
      baseSeed?: number;
      explainerEvals?: number;
    }) => {
      const expId = params?.explanationId || selectedStabilityExpId;
      const src = committedSourceRef.current;
      const rCount = params?.runCount ?? stabilityRunCount;
      const k = params?.topK ?? stabilityTopK;
      const bSeed = params?.baseSeed ?? stabilityBaseSeed;
      const evals = params?.explainerEvals ?? stabilityExplainerEvals;

      if (!src?.text || !src.text.trim()) {
        setStabilityError("No source text available in current case context.");
        return;
      }
      if (!expId) {
        setStabilityError("Please select a saved explanation to analyze.");
        return;
      }

      const reqKey = `STAB_${expId}_${rCount}_${k}_${bSeed}_${evals}_${Date.now()}`; // Allow fresh intentional runs
      const reqGen = workspaceGenerationRef.current;
      const reqId = ++requestIdCounterRef.current;
      activeRequestsRef.current[reqKey] = reqId;

      setStabilityStatus("IN_FLIGHT");
      setStabilityMessage("Running independent explainer computations across distinct seeds...");
      setStabilityError("");
      setStabilitySavedNotice("");

      try {
        const payload = {
          explanation_id: expId,
          text: src.text,
          language: src.language as "English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed",
          run_count: rCount,
          top_k: k,
          base_seed: bSeed,
          explainer_evals: evals,
          source_reference: `case-${src.id || "dev"}`,
        };

        const res = await api<C4StabilityResponse>("/c4/stability", payload);
        if (workspaceGenerationRef.current !== reqGen || activeRequestsRef.current[reqKey] !== reqId) {
          return;
        }

        if (res.outcome === "TEXT_MISMATCH") {
          setStabilityError("Source text mismatch: current input text does not match the explanation's source text.");
          setStabilityStatus("ERROR");
          return;
        }
        if (res.outcome === "UNAVAILABLE_MODEL") {
          setStabilityError("Sentiment classifier model is currently unavailable.");
          setStabilityStatus("ERROR");
          return;
        }

        setStabilityResultsByExpId((prev) => ({ ...prev, [expId]: res }));
        setStabilityStatus("READY");
        setSelectedStabilityRunIndex(res.runs && res.runs.length > 1 ? 2 : 1);
        const overlapPct =
          res.mean_top_k_overlap !== undefined && res.mean_top_k_overlap !== null
            ? (res.mean_top_k_overlap * 100).toFixed(1)
            : "0.0";
        const count = res.completed_runs || res.runs?.length || 0;
        setStabilityMessage(
          `Analysis complete: Mean top-k overlap is ${overlapPct}% across ${count} runs.`
        );

        if (res.evaluation_id) {
          setStabilitySavedNotice(`Saved evaluation #${res.evaluation_id} in database`);
          syncManifest({ savedIds: { stabilityId: String(res.evaluation_id) } });
          if (typeof window !== "undefined" && window.location.pathname === "/stability") {
            const url = new URL(window.location.href);
            url.searchParams.set("evaluation_id", String(res.evaluation_id));
            window.history.replaceState(null, "", url.toString());
          }
        }
      } catch (err) {
        if (workspaceGenerationRef.current === reqGen && activeRequestsRef.current[reqKey] === reqId) {
          setStabilityStatus("ERROR");
          setStabilityError((err as Error).message || "Stability evaluation failed.");
        }
      } finally {
        if (activeRequestsRef.current[reqKey] === reqId) {
          delete activeRequestsRef.current[reqKey];
        }
      }
    },
    [
      selectedStabilityExpId,
      stabilityRunCount,
      stabilityTopK,
      stabilityBaseSeed,
      stabilityExplainerEvals,
      syncManifest,
    ]
  );

  // Restore Stability via authenticated GET
  const restoreStability = useCallback(async (evalId: string) => {
    if (!evalId) return;
    const reqGen = workspaceGenerationRef.current;
    setStabilityStatus("RESTORING");
    try {
      const res = await api<C4StabilityResponse>(`/c4/stability/${evalId}`);
      if (workspaceGenerationRef.current !== reqGen) return;

      setStabilityResultsByExpId((prev) => ({ ...prev, [res.explanation_id]: res }));
      setSelectedStabilityExpId(res.explanation_id);
      setSelectedStabilityRunIndex(res.runs && res.runs.length > 1 ? 2 : 1);
      setStabilityStatus("READY");
      setStabilitySavedNotice(`Restored saved evaluation #${res.evaluation_id}`);
    } catch {
      if (workspaceGenerationRef.current !== reqGen) return;
      setStabilityStatus("ERROR");
      setStabilityError("Failed to restore saved stability evaluation from database.");
    }
  }, []);

  const resetStabilityAnalysis = useCallback(() => {
    setStabilityStatus("IDLE");
    setStabilityError("");
    setStabilityMessage("");
    setStabilitySavedNotice("");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("evaluation_id");
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  // Run Comparison - Current Input
  const runComparisonCurrent = useCallback(async () => {
    const src = committedSourceRef.current;
    if (!src?.text) return;
    setIsComparisonCurrentBusy(true);
    setComparisonCurrentError("");

    const reqGen = workspaceGenerationRef.current;
    try {
      const payload = {
        text: src.text,
        source_reference: src.id || "development-input",
        language: src.language as "English" | "Sinhala" | "Romanized Sinhala" | "Code-mixed",
        target_class: src.targetClass,
        common_k: comparisonCommonK,
        selected_lime_eval_id: comparisonSelectedLimeId || undefined,
        selected_shap_eval_id: comparisonSelectedShapId || undefined,
      };

      const res = await api<C4ComparisonCurrentResponse>("/c4/comparison/current", payload);
      if (workspaceGenerationRef.current !== reqGen) return;
      setComparisonCurrentResponse(res);
    } catch (err) {
      if (workspaceGenerationRef.current !== reqGen) return;
      setComparisonCurrentError((err as Error).message || "Failed to load current input comparison.");
    } finally {
      if (workspaceGenerationRef.current === reqGen) {
        setIsComparisonCurrentBusy(false);
      }
    }
  }, [comparisonCommonK, comparisonSelectedLimeId, comparisonSelectedShapId]);

  // Run Comparison - Evaluated Inputs
  const runComparisonEvaluated = useCallback(
    async (page: number = 1, pageSize: number = 15) => {
      setIsComparisonEvaluatedBusy(true);
      setComparisonEvaluatedError("");

      const reqGen = workspaceGenerationRef.current;
      try {
        const offset = (page - 1) * pageSize;
        const effectiveLang = comparisonChartLangFilter || comparisonSelectedLanguage;
        const url = `/c4/comparison/evaluated?metric=${encodeURIComponent(comparisonSelectedMetric)}&model_revision=${encodeURIComponent(
          comparisonSelectedRevision
        )}&explained_class=${encodeURIComponent(comparisonSelectedClass)}&language=${encodeURIComponent(
          effectiveLang
        )}&common_k=${comparisonCommonK}&limit=${pageSize}&offset=${offset}`;

        const res = await api<C4ComparisonEvaluatedResponse>(url);
        if (workspaceGenerationRef.current !== reqGen) return;
        setComparisonEvaluatedResponse(res);
      } catch (err) {
        if (workspaceGenerationRef.current !== reqGen) return;
        setComparisonEvaluatedError((err as Error).message || "Failed to load evaluated comparison data.");
      } finally {
        if (workspaceGenerationRef.current === reqGen) {
          setIsComparisonEvaluatedBusy(false);
        }
      }
    },
    [
      comparisonChartLangFilter,
      comparisonSelectedLanguage,
      comparisonSelectedMetric,
      comparisonSelectedRevision,
      comparisonSelectedClass,
      comparisonCommonK,
    ]
  );

  const commitNewSource = useCallback(
    (snapshot: DevelopmentInputSnapshot) => {
      workspaceGenerationRef.current += 1;
      activeRequestsRef.current = {};
      Object.values(abortControllersRef.current).forEach((ctrl) => ctrl.abort());
      abortControllersRef.current = {};

      const fp = computeSourceFingerprint(snapshot.text, snapshot.language);
      const next: CommittedSource = {
        type: "dev",
        id: snapshot.id,
        fingerprint: fp,
        text: snapshot.text,
        language: snapshot.language,
        modelVersion: snapshot.modelVersion,
        targetClass: snapshot.targetClass,
      };

      setCommittedSource(next);
      setPrediction(snapshot.prediction || null);
      setPredictionError("");
      setLimeResultsByClass({});
      setLimeStatusByClass({});
      setLimeMessageByClass({});
      setLimeErrorByClass({});
      setShapResultsByClass({});
      setShapStatusByClass({});
      setShapMessageByClass({});
      setShapErrorByClass({});
      setCfResultsByClass({});
      setCfStatusByClass({});
      setCfMessageByClass({});
      setCfErrorByClass({});
      setSelectedCandidateId(null);
      setManualResult(null);
      setManualError("");
      setManualText(snapshot.text);
      setFaithfulnessResultsByExpId({});
      setFaithfulnessStatus("IDLE");
      setFaithfulnessMessage("");
      setFaithfulnessError("");
      setFaithfulnessSavedNotice("");
      setSelectedFaithfulnessExpId("");
      setSelectedFaithfulnessStep(null);
      setStabilityResultsByExpId({});
      setStabilityStatus("IDLE");
      setStabilityMessage("");
      setStabilityError("");
      setStabilitySavedNotice("");
      setSelectedStabilityExpId("");
      setComparisonCurrentResponse(null);
      setComparisonCurrentError("");

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (
          url.searchParams.has("id") ||
          url.searchParams.has("eval_id") ||
          url.searchParams.has("evaluation_id") ||
          url.searchParams.has("exp_id")
        ) {
          url.searchParams.delete("id");
          url.searchParams.delete("eval_id");
          url.searchParams.delete("evaluation_id");
          url.searchParams.delete("exp_id");
          window.history.replaceState(null, "", url.toString());
        }
      }
    },
    []
  );

  // Active explained class
  const activeClass = committedSource?.targetClass || selectedSentimentClass || "Negative";

  // LIME active state
  const limeExplanation = limeResultsByClass[activeClass] || null;
  const isLimeBusy = limeStatusByClass[activeClass] === "IN_FLIGHT";
  const limeMessage = limeMessageByClass[activeClass] || "";
  const limeError = limeErrorByClass[activeClass] || "";
  const limeState: C4ExplanationState = {
    response: limeExplanation,
    status: isLimeBusy ? "IN_FLIGHT" : limeExplanation ? "READY" : limeError ? "ERROR" : "IDLE",
    statusMessage: limeMessage,
    error: limeError,
    isSaved: Boolean(limeExplanation?.explanation_id),
    savedId: limeExplanation?.explanation_id ? String(limeExplanation.explanation_id) : null,
  };

  // SHAP active state
  const shapExplanation = shapResultsByClass[activeClass] || null;
  const isShapBusy = shapStatusByClass[activeClass] === "IN_FLIGHT";
  const shapMessage = shapMessageByClass[activeClass] || "";
  const shapError = shapErrorByClass[activeClass] || "";
  const shapState: C4ExplanationState = {
    response: shapExplanation,
    status: isShapBusy ? "IN_FLIGHT" : shapExplanation ? "READY" : shapError ? "ERROR" : "IDLE",
    statusMessage: shapMessage,
    error: shapError,
    isSaved: Boolean(shapExplanation?.explanation_id),
    savedId: shapExplanation?.explanation_id ? String(shapExplanation.explanation_id) : null,
  };

  // Counterfactual active state
  const cfTarget = activeClass;
  const cfResult = cfResultsByClass[cfTarget] || null;
  const isCfBusy = cfStatusByClass[cfTarget] === "IN_FLIGHT";
  const cfMessage = cfMessageByClass[cfTarget] || "";
  const cfError = cfErrorByClass[cfTarget] || "";
  const counterfactualState: C4CounterfactualState = {
    response: cfResult,
    status: isCfBusy ? "IN_FLIGHT" : cfResult ? "READY" : cfError ? "ERROR" : "IDLE",
    statusMessage: cfMessage,
    error: cfError,
    isSaved: Boolean(cfResult?.counterfactual_id),
    savedId: cfResult?.counterfactual_id ? String(cfResult.counterfactual_id) : null,
    selectedCandidateId,
    restoredTextUnavailable,
    maxEdits: cfMaxEdits,
    editMode: cfEditMode,
    lockedSpans: cfLockedSpans,
    manualText,
    manualResult,
    isManualBusy,
    manualError,
  };

  // Faithfulness active state
  const faithfulnessResult = selectedFaithfulnessExpId
    ? faithfulnessResultsByExpId[selectedFaithfulnessExpId] || null
    : null;
  const faithfulnessState: C4FaithfulnessState = {
    response: faithfulnessResult,
    status: faithfulnessStatus,
    statusMessage: faithfulnessMessage,
    error: faithfulnessError,
    savedNotice: faithfulnessSavedNotice,
    selectedExpId: selectedFaithfulnessExpId,
    selectedStep: selectedFaithfulnessStep,
    budgetMode: faithfulnessBudgetMode,
    maxWords: faithfulnessMaxWords,
    maxPct: faithfulnessMaxPct,
    randomTrials: faithfulnessRandomTrials,
    seed: faithfulnessSeed,
    showAdvanced: faithfulnessShowAdvanced,
  };

  // Stability active state
  const stabilityResult = selectedStabilityExpId
    ? stabilityResultsByExpId[selectedStabilityExpId] || null
    : null;
  const stabilityState: C4StabilityState = {
    response: stabilityResult,
    status: stabilityStatus,
    statusMessage: stabilityMessage,
    error: stabilityError,
    savedNotice: stabilitySavedNotice,
    selectedExpId: selectedStabilityExpId,
    selectedRunIndex: selectedStabilityRunIndex,
    runCount: stabilityRunCount,
    topK: stabilityTopK,
    baseSeed: stabilityBaseSeed,
    explainerEvals: stabilityExplainerEvals,
    showAdvanced: stabilityShowAdvanced,
  };

  // Comparison active state
  const comparisonState: C4ComparisonState = {
    currentResponse: comparisonCurrentResponse,
    evaluatedResponse: comparisonEvaluatedResponse,
    selectedMetric: comparisonSelectedMetric,
    selectedRevision: comparisonSelectedRevision,
    selectedClass: comparisonSelectedClass,
    selectedLanguage: comparisonSelectedLanguage,
    chartLanguageFilter: comparisonChartLangFilter,
    commonK: comparisonCommonK,
    activeTab: comparisonActiveTab,
    selectedLimeRecId: comparisonSelectedLimeId,
    selectedShapRecId: comparisonSelectedShapId,
    isCurrentBusy: isComparisonCurrentBusy,
    currentError: comparisonCurrentError,
    isEvaluatedBusy: isComparisonEvaluatedBusy,
    evaluatedError: comparisonEvaluatedError,
  };

  const setCounterfactualSettings = useCallback(
    (settings: Partial<Pick<C4CounterfactualState, "maxEdits" | "editMode" | "lockedSpans">>) => {
      if (settings.maxEdits !== undefined) setCfMaxEdits(settings.maxEdits);
      if (settings.editMode !== undefined) setCfEditMode(settings.editMode);
      if (settings.lockedSpans !== undefined) setCfLockedSpans(settings.lockedSpans);
    },
    []
  );

  const setFaithfulnessSettings = useCallback(
    (
      settings: Partial<
        Pick<
          C4FaithfulnessState,
          "budgetMode" | "maxWords" | "maxPct" | "randomTrials" | "seed" | "showAdvanced"
        >
      >
    ) => {
      if (settings.budgetMode !== undefined) setFaithfulnessBudgetMode(settings.budgetMode);
      if (settings.maxWords !== undefined) setFaithfulnessMaxWords(settings.maxWords);
      if (settings.maxPct !== undefined) setFaithfulnessMaxPct(settings.maxPct);
      if (settings.randomTrials !== undefined) setFaithfulnessRandomTrials(settings.randomTrials);
      if (settings.seed !== undefined) setFaithfulnessSeed(settings.seed);
      if (settings.showAdvanced !== undefined) setFaithfulnessShowAdvanced(settings.showAdvanced);
    },
    []
  );

  const setStabilitySettings = useCallback(
    (
      settings: Partial<
        Pick<
          C4StabilityState,
          "runCount" | "topK" | "baseSeed" | "explainerEvals" | "showAdvanced"
        >
      >
    ) => {
      if (settings.runCount !== undefined) setStabilityRunCount(settings.runCount);
      if (settings.topK !== undefined) setStabilityTopK(settings.topK);
      if (settings.baseSeed !== undefined) setStabilityBaseSeed(settings.baseSeed);
      if (settings.explainerEvals !== undefined) setStabilityExplainerEvals(settings.explainerEvals);
      if (settings.showAdvanced !== undefined) setStabilityShowAdvanced(settings.showAdvanced);
    },
    []
  );

  const setComparisonSettings = useCallback((settings: Partial<C4ComparisonState>) => {
    if (settings.selectedMetric !== undefined) setComparisonSelectedMetric(settings.selectedMetric);
    if (settings.selectedRevision !== undefined) setComparisonSelectedRevision(settings.selectedRevision);
    if (settings.selectedClass !== undefined) setComparisonSelectedClass(settings.selectedClass);
    if (settings.selectedLanguage !== undefined) setComparisonSelectedLanguage(settings.selectedLanguage);
    if (settings.chartLanguageFilter !== undefined) setComparisonChartLangFilter(settings.chartLanguageFilter);
    if (settings.commonK !== undefined) setComparisonCommonK(settings.commonK);
    if (settings.activeTab !== undefined) setComparisonActiveTab(settings.activeTab);
    if (settings.selectedLimeRecId !== undefined) setComparisonSelectedLimeId(settings.selectedLimeRecId);
    if (settings.selectedShapRecId !== undefined) setComparisonSelectedShapId(settings.selectedShapRecId);
    if (settings.currentResponse !== undefined) setComparisonCurrentResponse(settings.currentResponse);
    if (settings.evaluatedResponse !== undefined) setComparisonEvaluatedResponse(settings.evaluatedResponse);
  }, []);

  return (
    <C4WorkspaceContext.Provider
      value={{
        committedSource,
        prediction,
        isPredicting,
        predictionError,
        isClassifierConnected,

        lime: limeState,
        shap: shapState,
        computeLime,
        computeShap,
        restoreExplanation,

        counterfactual: counterfactualState,
        computeCounterfactuals,
        restoreCounterfactual,
        setSelectedCandidateId,
        setCounterfactualSettings,
        setManualText,
        runManualEvaluation,
        resetManualEvaluation,
        updateCounterfactualFeedback,

        faithfulness: faithfulnessState,
        computeFaithfulness,
        restoreFaithfulness,
        setSelectedFaithfulnessExpId,
        setSelectedFaithfulnessStep,
        setFaithfulnessSettings,

        stability: stabilityState,
        computeStability,
        restoreStability,
        setSelectedStabilityExpId,
        setSelectedStabilityRunIndex,
        setStabilitySettings,
        resetStabilityAnalysis,

        comparison: comparisonState,
        runComparisonCurrent,
        runComparisonEvaluated,
        setComparisonSettings,

        commitNewSource,
        clearActiveWorkspace,
      }}
    >
      {children}
    </C4WorkspaceContext.Provider>
  );
}

export function useC4Workspace(): C4WorkspaceContextType {
  const ctx = useContext(C4WorkspaceContext);
  if (!ctx) {
    throw new Error("useC4Workspace must be used within a C4WorkspaceProvider");
  }
  return ctx;
}
