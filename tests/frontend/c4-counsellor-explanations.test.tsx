import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import LimePage from "../../apps/counsellor-dashboard/app/lime/page";
import ShapPage from "../../apps/counsellor-dashboard/app/shap/page";
import type { C4ExplanationResponse } from "@j26/common/contracts";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/lime",
}));

// Mutable mock context value for testing different case states
interface MockCaseData {
  authorized: boolean;
  checking: boolean;
  tasks: unknown[];
  selectedTask: unknown | null;
  selectedTaskId: string | null;
  selectTask: (id: string | null) => void;
  loadTasks: () => Promise<void>;
  error: string;
  setError: (err: string) => void;
}

let mockContextState: MockCaseData;

vi.mock("../../apps/counsellor-dashboard/app/context/CaseContext", () => ({
  useReviewCase: () => mockContextState,
  CaseProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockTaskWithText = {
  task_id: "task-fictional-001",
  case: {
    case_id: "case-98765432-fictional",
    correlation_id: "corr-fictional-001",
    session_token_hash: "hash-001",
    created_at: "2026-10-14T10:00:00Z",
    retention_expires_at: "2026-11-14T10:00:00Z",
    processing_status: "INFERENCE_COMPLETE",
  },
  preprocessing: {
    anonymized_text: "Final semester exams are approaching and deadlines are piling up. I feel overwhelmed.",
    language: "English",
  },
  inference: {
    wellbeing_indicator: "Academic Pressure",
    emotional_tone: "Overwhelmed",
    review_priority: "HIGH_PRIORITY",
    confidence: 0.84,
  },
  explanation: {
    method: "LIME",
    feature_attributions: [],
    faithfulness_score: null,
  },
  human_review_required: true,
};

const mockTaskWithoutText = {
  task_id: "task-fictional-002",
  case: {
    case_id: "case-12345678-fictional",
    correlation_id: "corr-fictional-002",
    session_token_hash: "hash-002",
    created_at: "2026-10-14T10:00:00Z",
    retention_expires_at: "2026-11-14T10:00:00Z",
    processing_status: "INFERENCE_COMPLETE",
  },
  inference: {
    wellbeing_indicator: "Wellbeing Screening",
    emotional_tone: "Neutral",
    review_priority: "HUMAN_REVIEW_REQUIRED",
    confidence: 0.72,
  },
  explanation: {
    method: "LIME",
    feature_attributions: [],
    faithfulness_score: null,
  },
  human_review_required: true,
};

beforeEach(() => {
  mockContextState = {
    authorized: true,
    checking: false,
    tasks: [mockTaskWithoutText],
    selectedTask: mockTaskWithoutText,
    selectedTaskId: mockTaskWithoutText.task_id,
    selectTask: vi.fn(),
    loadTasks: vi.fn(),
    error: "",
    setError: vi.fn(),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("C4 Counsellor Dashboard LIME Page (Review Prototype)", () => {
  it("renders heading, mandatory screening notice, and top prototype cards", () => {
    render(<LimePage />);

    expect(screen.getByRole("heading", { level: 1, name: "LIME Feature Attribution" })).toBeVisible();
    expect(
      screen.getAllByText(
        "Screening support only. Requires counsellor-assisted interpretation and does not replace professional counselling."
      ).length
    ).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText("Model Prediction").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Input Text")).toBeVisible();
    expect(screen.getByText("Case Summary")).toBeVisible();
  });

  it("renders Input navigation link in sidebar", () => {
    render(<LimePage />);

    const inputLink = screen.getAllByRole("link", { name: /Development Input/i })[0];
    expect(inputLink).toBeVisible();
    expect(inputLink).toHaveAttribute("href", "/c4-dev-input");
  });

  it("removes developer input controls (no textareas, sample buttons, manual selectors, or Clear buttons)", () => {
    render(<LimePage />);

    // Must be a read-only review page, not an editable development input harness
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /reflection/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Sinhala/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Academic pressure/i })).toBeNull();
    expect(screen.queryByLabelText(/Reflection Language/i)).toBeNull();
    expect(screen.queryByText("Manual selection")).toBeNull();
    expect(screen.queryByRole("button", { name: /Clear/i })).toBeNull();
  });

  it("displays 'Submission text unavailable' and disables actions when review contract lacks text", () => {
    render(<LimePage />);

    // Verification of contract gap handling without inventing text
    expect(screen.getAllByText("Submit text first").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(
        "No reflection submission is active in shared context. Enter and analyse fictional reflection text on the Development Input page before generating explanations."
      )
    ).toBeVisible();

    // Compute button is disabled
    const computeBtn = screen.getByRole("button", { name: "Compute LIME Attributions" });
    expect(computeBtn).toBeDisabled();

    // Disabled hint is visible
    expect(
      screen.getByText("Submit text on Development Input to enable LIME explanations.")
    ).toBeVisible();

    // Visualizations show empty states
    expect(screen.getByText("No Attribution Values Available")).toBeVisible();
    expect(screen.getByText("No Attribution Bar Chart Available")).toBeVisible();

    // CSV export button is disabled
    const csvBtn = screen.getByRole("button", { name: /Export contributions as CSV/ });
    expect(csvBtn).toBeDisabled();
  });

  it("renders read-only submission text, displays case language, and runs LIME when case has text", async () => {
    mockContextState = {
      ...mockContextState,
      tasks: [mockTaskWithText],
      selectedTask: mockTaskWithText,
      selectedTaskId: mockTaskWithText.task_id,
    };

    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");
    const sessionStorageSpy = vi.spyOn(Storage.prototype, "setItem");

    const mockLimeResult: C4ExplanationResponse = {
      method: "LIME",
      status: "READY",
      status_message: "LIME local explanation generated successfully.",
      model_version: "test-c3-model-v1",
      target_class: "Academic Pressure",
      target_class_probability: 0.842,
      base_value: 0.2,
      output_value: 0.842,
      contributions: [
        { token: "deadlines", weight: 0.35, direction: "supports", abs_weight: 0.35 },
        { token: "overwhelmed", weight: 0.28, direction: "supports", abs_weight: 0.28 },
        { token: "semester", weight: -0.05, direction: "opposes", abs_weight: 0.05 },
      ],
      tokens: ["deadlines", "overwhelmed", "semester"],
      weights: [0.35, 0.28, -0.05],
      computation_bounds: { num_samples: 100, num_features: 15 },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockLimeResult,
      })
    );

    render(<LimePage />);

    // Text is displayed read-only
    expect(screen.getByText(mockTaskWithText.preprocessing.anonymized_text)).toBeVisible();
    // Language metadata is displayed only from case data
    expect(screen.getByText("Language: English")).toBeVisible();

    // Compute button is now enabled
    const computeBtn = screen.getByRole("button", { name: "Compute LIME Attributions" });
    expect(computeBtn).toBeEnabled();

    fireEvent.click(computeBtn);

    await waitFor(() => {
      expect(screen.getByText("LIME explanation computed successfully.")).toBeVisible();
    });

    // Verify contributions table
    expect(screen.getAllByText("deadlines").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("+0.350")).toBeVisible();
    expect(screen.getAllByText("overwhelmed").length).toBeGreaterThanOrEqual(1);

    // Verify signed bar chart & highlighter
    expect(screen.getByLabelText("LIME Diverging Signed Bar Chart")).toBeVisible();
    expect(screen.getByLabelText("Attribution highlighted text")).toBeVisible();

    // CSV export is enabled
    const csvBtn = screen.getByRole("button", { name: /Export contributions as CSV/ });
    expect(csvBtn).toBeEnabled();

    // Verify no storage writes
    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(sessionStorageSpy).not.toHaveBeenCalled();
    localStorageSpy.mockRestore();
    sessionStorageSpy.mockRestore();
  });
});

describe("C4 Counsellor Dashboard SHAP Page (Review Prototype)", () => {
  it("renders heading, mandatory notice, top cards, and local waterfall/force view without beeswarm plot", () => {
    render(<ShapPage />);

    expect(screen.getByRole("heading", { level: 1, name: "SHAP Additive Explanations" })).toBeVisible();
    expect(
      screen.getAllByText(
        "Screening support only. Requires counsellor-assisted interpretation and does not replace professional counselling."
      ).length
    ).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText("Model Prediction").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Input Text")).toBeVisible();
    expect(screen.getByText("Case Summary")).toBeVisible();

    // Absence of dev input controls
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /reflection/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Clear/i })).toBeNull();

    // Waterfall plot empty state
    expect(screen.getByText("No SHAP Waterfall / Force Plot Available")).toBeVisible();

    // Rejection of beeswarm plot for single examples
    expect(
      screen.getAllByText(
        /Beeswarm plots are designed for dataset-level multi-example distributions and are not shown for individual predictions\./
      ).length
    ).toBeGreaterThanOrEqual(1);

    // Disabled CSV export
    const csvBtn = screen.getByRole("button", { name: /Export contributions as CSV/ });
    expect(csvBtn).toBeDisabled();
  });

  it("renders SHAP additive waterfall view with base value and output scale on actual results", async () => {
    mockContextState = {
      ...mockContextState,
      tasks: [mockTaskWithText],
      selectedTask: mockTaskWithText,
      selectedTaskId: mockTaskWithText.task_id,
    };

    const mockShapResult: C4ExplanationResponse = {
      method: "SHAP",
      status: "READY",
      status_message: "SHAP additive explanation generated successfully.",
      model_version: "test-c3-model-v1",
      target_class: "Academic Pressure",
      target_class_probability: 0.88,
      base_value: 0.15,
      output_value: 0.88,
      contributions: [
        { token: "deadlines", weight: 0.42, direction: "supports", abs_weight: 0.42 },
        { token: "exams", weight: 0.31, direction: "supports", abs_weight: 0.31 },
      ],
      tokens: ["deadlines", "exams"],
      weights: [0.42, 0.31],
      computation_bounds: { max_evals: 100 },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockShapResult,
      })
    );

    render(<ShapPage />);

    // Compute button is enabled when case text is present
    const computeBtn = screen.getByRole("button", { name: "Compute SHAP Values" });
    expect(computeBtn).toBeEnabled();

    fireEvent.click(computeBtn);

    await waitFor(() => {
      expect(screen.getByText("SHAP additive explanation computed successfully.")).toBeVisible();
    });

    // Waterfall chart metrics
    expect(screen.getByLabelText("SHAP Local Waterfall Plot")).toBeVisible();
    expect(screen.getByText("0.1500")).toBeVisible(); // Base value
    expect(screen.getAllByText("0.8800").length).toBeGreaterThanOrEqual(1); // Output value
    expect(screen.getAllByText("deadlines").length).toBeGreaterThanOrEqual(1);

    // CSV export enabled
    const csvBtn = screen.getByRole("button", { name: /Export contributions as CSV/ });
    expect(csvBtn).toBeEnabled();
  });
});
