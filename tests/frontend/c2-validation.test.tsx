import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { C2DemoValidationSummary } from "../../packages/typescript-common/src/contracts";
import RunValidation from "../../apps/counsellor-dashboard/app/c2-demo/RunValidation";
import C2Demo from "../../apps/counsellor-dashboard/app/c2-demo/page";
import response from "../fixtures/synthetic/c2-demo.json";
import fixture from "../fixtures/synthetic/c2-output-validation.json";

const report = fixture as C2DemoValidationSummary;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test("shows returned counts and code locations without claiming accuracy", () => {
  render(<RunValidation summary={report} />);
  const table = screen.getByRole("table", { name: "Backend stage validation counts" });
  expect(screen.getByRole("region", { name: "Scrollable validation counts" })).toHaveAttribute("tabindex", "0");
  expect(within(table).getByRole("rowheader", { name: "Tokenization integrity" })).toBeVisible();
  expect(screen.getByText("Accuracy: Not measured for this run.")).toBeVisible();
  fireEvent.click(screen.getByText("Per-record rules, outcomes and code locations"));
  expect(screen.getAllByText("services/preprocessing/validation.py").length).toBeGreaterThan(0);
  expect(screen.getByText("tokenization.offsets")).toBeVisible();
  expect(screen.getByText(/No token boundary splits a Unicode grapheme/)).toBeVisible();
});

test("zero denominator is Not measured and returned failures are preserved", () => {
  const changed = structuredClone(report);
  Object.assign(changed.stages[0], { passed_records: 0, failed_records: 1, pass_rate_percent: 0 });
  Object.assign(changed.stages[1], { checked_records: 0, passed_records: 0, not_evaluated_records: 1, pass_rate_percent: null });
  render(<RunValidation summary={changed} />);
  const table = screen.getByRole("table", { name: "Backend stage validation counts" });
  expect(within(table).getByText("0.00%")).toBeVisible();
  expect(within(table).getByText("Not measured")).toBeVisible();
});

test("missing report from older snapshots never becomes a pass", () => {
  render(<RunValidation />);
  expect(screen.getByText(/No validation report returned/)).toBeVisible();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Download validation JSON" })).not.toBeInTheDocument();
});

test("download contains only the backend validation report", async () => {
  let captured: Blob | undefined;
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn((blob: Blob) => { captured = blob; return "blob:synthetic"; }),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<RunValidation summary={report} />);
  fireEvent.click(screen.getByRole("button", { name: "Download validation JSON" }));
  expect(captured).toBeDefined();
  expect(captured!.type).toBe("application/json");
  const content = await new Promise<string>(resolve => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(captured!);
  });
  expect(JSON.parse(content)).toEqual(report);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:synthetic");
});

test("report belongs to the actual run and clears with Reset", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => url.endsWith("/scenarios") ? response.catalogue : { ...response.results.english, validation_summary: report } })));
  render(<C2Demo />);
  await screen.findByLabelText("Fictional test text only");
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByRole("table", { name: "Backend stage validation counts" });
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(screen.queryByRole("table", { name: "Backend stage validation counts" })).not.toBeInTheDocument();
  expect(screen.getByText(/No validation report returned/)).toBeVisible();
});
