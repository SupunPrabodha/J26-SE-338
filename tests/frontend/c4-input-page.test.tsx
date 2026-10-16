import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Sidebar } from "../../apps/counsellor-dashboard/app/components/Sidebar";
import InputPage from "../../apps/counsellor-dashboard/app/input/page";
import { CaseProvider, useReviewCase } from "../../apps/counsellor-dashboard/app/context/CaseContext";

// Mock next/navigation
let currentPathname = "/input";
vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

// Mock @j26/common/api so CaseProvider auth check doesn't make real network calls
vi.mock("@j26/common/api", () => ({
  api: vi.fn().mockRejectedValue(new Error("Network disabled in test")),
  ApiError: class ApiError extends Error {
    status = 500;
  },
}));

function ContextInspector() {
  const { inputText } = useReviewCase();
  return <div data-testid="shared-state-input">{inputText}</div>;
}

describe("C4 Counsellor Dashboard Input Page", () => {
  beforeEach(() => {
    currentPathname = "/input";
    vi.clearAllMocks();
  });

  it("opens from the sidebar with an active link to /input", () => {
    currentPathname = "/input";
    render(<Sidebar />);

    const inputLink = screen.getByRole("link", { name: "Input" });
    expect(inputLink).toBeVisible();
    expect(inputLink).toHaveAttribute("href", "/input");
    expect(inputLink).toHaveClass("active");
  });

  it("contains only a multiline text box and a Submit button", () => {
    render(
      <CaseProvider>
        <InputPage />
      </CaseProvider>
    );

    // Multiline text box
    const textboxes = screen.getAllByRole("textbox");
    expect(textboxes).toHaveLength(1);
    expect(textboxes[0].tagName.toLowerCase()).toBe("textarea");

    // Submit button
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent("Submit");

    // Must NOT contain sample text, language selectors, counters, extra buttons or other features
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText(/characters/i)).toBeNull();
    expect(screen.queryByText(/sample/i)).toBeNull();
    expect(screen.queryByText(/Sinhala/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();
  });

  it("stores entered text in shared frontend state on Submit without calling API", () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    render(
      <CaseProvider>
        <InputPage />
        <ContextInspector />
      </CaseProvider>
    );

    // Shared state initially empty
    expect(screen.getByTestId("shared-state-input")).toHaveTextContent("");

    // Enter text into multiline text box
    const textarea = screen.getByRole("textbox");
    const testText = "Student reporting severe sleep disruption and deadline anxiety.";
    fireEvent.change(textarea, { target: { value: testText } });

    // Click Submit
    const submitBtn = screen.getByRole("button", { name: "Submit" });
    fireEvent.click(submitBtn);

    // Verified: text stored in shared frontend state for later C4 use
    expect(screen.getByTestId("shared-state-input")).toHaveTextContent(testText);

    // Verified: No API or model call occurred
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
