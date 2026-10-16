import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import C4DevInput, { MAX_CHAR_LIMIT, SAMPLE_INPUTS } from "../../apps/student-portal/app/c4-dev-input/page";

describe("C4 Explanation Development Input Screen", () => {
  it("renders clear heading, persistent development notice, and screening-support boundaries", () => {
    render(<C4DevInput />);

    // 1. Clear heading
    expect(screen.getByRole("heading", { level: 1, name: "C4 Explanation Development" })).toBeVisible();

    // 2. Persistent development notice
    expect(
      screen.getByText("Fictional test text only. Do not enter personal or student information.")
    ).toBeVisible();

    // 8. Screening-support wording
    expect(
      screen.getByText(
        "This system supports wellbeing screening and counsellor-assisted review. It does not provide a diagnosis or replace professional counselling."
      )
    ).toBeVisible();

    // Return link
    expect(screen.getByRole("link", { name: /Return to Student Portal/ })).toHaveAttribute("href", "/");
  });

  it("validates and rejects empty or whitespace-only input", () => {
    render(<C4DevInput />);
    const prepareButton = screen.getByRole("button", { name: "Prepare test input" });

    // Empty input validation
    fireEvent.click(prepareButton);
    expect(screen.getByRole("alert")).toHaveTextContent("Input cannot be empty or contain only whitespace");
    expect(screen.queryByText(/Input prepared\. Classifier and explanation backend/)).not.toBeInTheDocument();

    // Whitespace-only input validation
    const textarea = screen.getByLabelText("Test reflection text");
    fireEvent.change(textarea, { target: { value: "   \n\t   " } });
    fireEvent.click(prepareButton);
    expect(screen.getByRole("alert")).toHaveTextContent("Input cannot be empty or contain only whitespace");
    expect(screen.queryByText(/Input prepared\. Classifier and explanation backend/)).not.toBeInTheDocument();
  });

  it("enforces and documents the 2,000 character development limit", () => {
    render(<C4DevInput />);
    const textarea = screen.getByLabelText("Test reflection text");

    expect(textarea).toHaveAttribute("maxlength", "2000");
    expect(screen.getByText(/Enforced development limit: 2,000 characters maximum/)).toBeVisible();
    expect(screen.getByText("0 / 2,000 characters")).toBeVisible();

    // Typing text updates the counter
    fireEvent.change(textarea, { target: { value: "A".repeat(50) } });
    expect(screen.getByText("50 / 2,000 characters")).toBeVisible();

    // Max limit
    fireEvent.change(textarea, { target: { value: "B".repeat(MAX_CHAR_LIMIT) } });
    expect(screen.getByText("2,000 / 2,000 characters")).toBeVisible();
  });

  it("supports manual test language selection and documents absence of auto-detection", () => {
    render(<C4DevInput />);

    const languageSelect = screen.getByLabelText("Test language — manually selected");
    expect(languageSelect).toBeVisible();

    // Check options
    const options = ["English", "Sinhala", "Romanized Sinhala", "Code-mixed"];
    options.forEach((opt) => {
      expect(screen.getByRole("option", { name: opt })).toBeInTheDocument();
    });

    // Check documentation hint
    expect(
      screen.getByText(/Manual selection only\. Automated language detection is not implemented or claimed\./)
    ).toBeVisible();
    expect(
      screen.getByText(/Support for entering these text forms does not establish underlying model support\./)
    ).toBeVisible();

    // Change language manually
    fireEvent.change(languageSelect, { target: { value: "Sinhala" } });
    expect(languageSelect).toHaveValue("Sinhala");

    fireEvent.change(languageSelect, { target: { value: "Romanized Sinhala" } });
    expect(languageSelect).toHaveValue("Romanized Sinhala");

    fireEvent.change(languageSelect, { target: { value: "Code-mixed" } });
    expect(languageSelect).toHaveValue("Code-mixed");
  });

  it("loads four fictional samples and synchronizes the corresponding test language", () => {
    render(<C4DevInput />);
    const textarea = screen.getByLabelText("Test reflection text");
    const languageSelect = screen.getByLabelText("Test language — manually selected");

    // Verify all 4 sample buttons exist and have fictional content about academic pressure without identifiers
    for (const sample of SAMPLE_INPUTS) {
      const sampleButton = screen.getByRole("button", { name: new RegExp(`^${sample.label}`) });
      expect(sampleButton).toBeVisible();

      // Ensure no participant IDs, personal names, emails or phone numbers
      expect(sample.text).not.toMatch(/IT\d{8}/i);
      expect(sample.text).not.toMatch(/@/);
      expect(sample.text).not.toMatch(/\+?\d{9,}/);

      fireEvent.click(sampleButton);
      expect(textarea).toHaveValue(sample.text);
      expect(languageSelect).toHaveValue(sample.language);
    }
  });

  it("prepares test input with in-memory preview and marks preview as outdated when edited", () => {
    const { container } = render(<C4DevInput />);
    const textarea = screen.getByLabelText("Test reflection text");
    const languageSelect = screen.getByLabelText("Test language — manually selected");
    const prepareButton = screen.getByRole("button", { name: "Prepare test input" });

    // Initial state: empty preview
    expect(screen.getByText("No test input prepared yet. Enter or select sample text and click \"Prepare test input\".")).toBeVisible();

    // Load sample and prepare
    const englishBtn = screen.getByRole("button", { name: /^English sample/ });
    fireEvent.click(englishBtn);
    fireEvent.click(prepareButton);

    // Verify prepared state message
    const expectedState = "Input prepared. Classifier and explanation backend are not connected yet.";
    expect(screen.getAllByText(expectedState).length).toBeGreaterThanOrEqual(1);

    // Verify preview contents
    const previewPre = container.querySelector(".c4-preview-text");
    expect(previewPre).toHaveTextContent(SAMPLE_INPUTS[0].text);
    expect(screen.getByText("Input prepared")).toBeVisible();

    // Invalidation 1: Editing text marks preview as outdated
    fireEvent.change(textarea, { target: { value: SAMPLE_INPUTS[0].text + " Additional stress note." } });
    expect(screen.getByText("Outdated (modified after preparation)")).toBeVisible();
    expect(screen.getByText("Preview is outdated:")).toBeVisible();
    expect(screen.getByText(/Input text or language was modified since last preparation/)).toBeVisible();

    // Re-preparing clears outdated status
    fireEvent.click(prepareButton);
    expect(screen.getByText("Input prepared")).toBeVisible();
    expect(screen.queryByText("Outdated (modified after preparation)")).not.toBeInTheDocument();

    // Invalidation 2: Changing language selector marks preview as outdated
    fireEvent.change(languageSelect, { target: { value: "Code-mixed" } });
    expect(screen.getByText("Outdated (modified after preparation)")).toBeVisible();
  });

  it("clears input, preview, and validation errors on Clear button click", () => {
    const { container } = render(<C4DevInput />);
    const textarea = screen.getByLabelText("Test reflection text");
    const clearButton = screen.getByRole("button", { name: "Clear" });
    const prepareButton = screen.getByRole("button", { name: "Prepare test input" });

    // Load sample and prepare
    const sinhalaBtn = screen.getByRole("button", { name: /^Sinhala sample/ });
    fireEvent.click(sinhalaBtn);
    fireEvent.click(prepareButton);

    expect(textarea).toHaveValue(SAMPLE_INPUTS[1].text);
    const previewPre = container.querySelector(".c4-preview-text");
    expect(previewPre).toHaveTextContent(SAMPLE_INPUTS[1].text);

    // Click Clear
    fireEvent.click(clearButton);

    expect(textarea).toHaveValue("");
    expect(container.querySelector(".c4-preview-text")).toBeNull();
    expect(screen.getByText(/No test input prepared yet/)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Input prepared/)).not.toBeInTheDocument();
  });

  it("displays honest 'Not connected' status for all explanation and prediction components", () => {
    render(<C4DevInput />);

    // Check all required 5 items
    const requiredItems = ["Prediction", "LIME", "SHAP", "Faithfulness", "Counterfactuals"];
    requiredItems.forEach((item) => {
      expect(screen.getByText(item)).toBeVisible();
    });

    const notConnectedBadges = screen.getAllByText("Not connected");
    expect(notConnectedBadges.length).toBe(5);

    // Verify no fake confidence scores or numbers exist
    expect(screen.queryByText(/%\b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0\.\d{2}/)).not.toBeInTheDocument();
  });

  it("runs the encoder check and displays base encoder diagnostics without classification", async () => {
    const mockResponse = {
      model_id: "FacebookAI/xlm-roberta-base",
      status_message: "Base encoder connected — wellbeing classification unavailable.",
      encoder_executed: true,
      token_count: 28,
      truncated: false,
      embedding_shape: [1, 28, 768],
      hidden_dimension: 768,
    };

    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    try {
      render(<C4DevInput />);
      const englishBtn = screen.getByRole("button", { name: /^English sample/ });
      fireEvent.click(englishBtn);

      const encoderCheckBtn = screen.getByRole("button", { name: "Check pretrained encoder" });
      fireEvent.click(encoderCheckBtn);

      expect(
        await screen.findByText("Base encoder connected — wellbeing classification unavailable.")
      ).toBeVisible();

      expect(screen.getByText("FacebookAI/xlm-roberta-base")).toBeVisible();
      expect(screen.getByText("Successful (eval / inference mode)")).toBeVisible();
      expect(screen.getByText("28")).toBeVisible();
      expect(screen.getByText("[1,28,768]")).toBeVisible();
      expect(screen.getByText("768")).toBeVisible();

      // Verify prediction and explanations remain disconnected
      const notConnectedBadges = screen.getAllByText("Not connected");
      expect(notConnectedBadges.length).toBe(5);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

