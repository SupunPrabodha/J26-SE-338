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

test.each(["NO_SIGNAL", "FAIL", "REVIEW", "NOT_EVALUATED"] as const)("shows actual residual assessment %s separately from structured passes", status => {
  const changed = structuredClone(report);
  changed.records[0].residual_assessment = {
    status, verification: "NOT_VERIFIED", method: "c2-residual-output-v1",
    rule_ids: [], reasons: ["no_signal_not_verified_anonymity"],
  };
  if (status === "NO_SIGNAL") Object.assign(changed.stages[0], { checked_records: 0, passed_records: 0, not_evaluated_records: 1, pass_rate_percent: null });
  render(<RunValidation summary={changed} />);
  const assessment = screen.getByRole("generic", { name: "Residual assessment record 1" });
  if (status === "NO_SIGNAL") {
    expect(within(assessment).queryByText(/Residual PII:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No residual signal detected/)).not.toBeInTheDocument();
  } else {
    expect(assessment).toHaveTextContent(status === "NOT_EVALUATED" ? "Not evaluated" : status);
  }
  expect(assessment).toHaveTextContent("Structured PII pattern checks:");
  expect(screen.queryByText(/Privacy verified|Complete anonymization/)).not.toBeInTheDocument();
  if (status === "NO_SIGNAL") {
    const row = screen.getByRole("rowheader", { name: "Residual PII checks" }).closest("tr")!;
    expect([...row.children].map(node => node.textContent)).toEqual(["Residual PII checks", "1", "0", "0", "0", "1", "0"]);
    expect(changed.stages[0].not_evaluated_records).toBe(1);
    expect(changed.stages[0].checked_records).toBe(0);
  }
});

test("missing assessment is unavailable, never no-signal or a completed audit", () => {
  render(<RunValidation summary={report} />);
  expect(screen.getByRole("generic", { name: "Residual assessment record 1" })).toHaveTextContent("Residual PII: Unavailable");
  expect(screen.queryByText(/No residual signal detected/)).not.toBeInTheDocument();
});

test("shows returned counts without technical disclosure or accuracy claims", () => {
  render(<RunValidation summary={report} />);
  const table = screen.getByRole("table", { name: "Backend stage validation counts" });
  expect(screen.getByRole("region", { name: "Scrollable validation counts" })).toHaveAttribute("tabindex", "0");
  expect(within(table).getByRole("rowheader", { name: "Tokenization integrity" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Automated checks" })).toBeVisible();
  expect(screen.queryByText(/Accuracy:/)).not.toBeInTheDocument();
  expect(within(table).getByRole("rowheader", { name: "Residual PII checks" })).toBeVisible();
  expect(table).not.toHaveTextContent("%");
  expect(screen.queryByText("Technical validation")).not.toBeInTheDocument();
  expect(screen.queryByText("tokenization.offsets")).not.toBeInTheDocument();
  expect(screen.queryByText("services/preprocessing/validation.py")).not.toBeInTheDocument();
});

test("missing count and accuracy values remain unavailable rather than zero or a pass", () => {
  const changed = structuredClone(report);
  Object.assign(changed, { records_processed: undefined, accuracy_status: undefined });
  Object.assign(changed.stages[0], { checked_records: undefined, passed_records: undefined });
  const view = render(<RunValidation summary={changed} />);
  expect(screen.getByText("Records processed: Unavailable")).toBeVisible();
  expect(screen.queryByText(/Accuracy:/)).not.toBeInTheDocument();
  const row = screen.getByRole("rowheader", { name: "Residual PII checks" }).closest("tr")!;
  expect([...row.children].map(node => node.textContent).slice(1, 3)).toEqual(["Unavailable", "Unavailable"]);
  Object.assign(changed, { stages: undefined });
  view.rerender(<RunValidation summary={changed} />);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText("Stage counts unavailable.")).toBeVisible();
});

test("new responses update actual counts and a failed request clears prior results", async () => {
  const failedChecks = structuredClone(report);
  Object.assign(failedChecks.stages[0], { passed_records: 0, failed_records: 1, pass_rate_percent: 0 });
  let runs = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/scenarios")) return { ok: true, status: 200, json: async () => response.catalogue };
    runs += 1;
    if (runs === 3) return { ok: false, status: 503 };
    return { ok: true, status: 200, json: async () => ({ ...response.results.english, validation_summary: runs === 1 ? report : failedChecks }) };
  }));
  render(<C2Demo />);
  await screen.findByRole("textbox", { name: "Input text" });
  const button = screen.getByRole("button", { name: "Anonymize" });
  fireEvent.click(button);
  await screen.findByRole("table");
  const cells = () => [...screen.getByRole("rowheader", { name: "Residual PII checks" }).closest("tr")!.children].map(node => node.textContent);
  expect(cells()).toEqual(["Residual PII checks", "1", "1", "0", "0", "Unavailable", "0"]);
  fireEvent.click(button);
  await screen.findByRole("table");
  expect(cells()).toEqual(["Residual PII checks", "1", "0", "1", "0", "Unavailable", "0"]);
  fireEvent.click(button);
  await screen.findByRole("alert");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText("No validation report returned.")).toBeVisible();
});

test("zero denominator is Not measured and returned failures are preserved", () => {
  const changed = structuredClone(report);
  Object.assign(changed.stages[0], { passed_records: 0, failed_records: 1, pass_rate_percent: 0 });
  Object.assign(changed.stages[1], { checked_records: 0, passed_records: 0, not_evaluated_records: 1, pass_rate_percent: null });
  render(<RunValidation summary={changed} />);
  const table = screen.getByRole("table", { name: "Backend stage validation counts" });
  expect(table.querySelectorAll("thead th")).toHaveLength(7);
  expect(table).not.toHaveTextContent("%");
  const residual = within(table).getByRole("rowheader", { name: "Residual PII checks" }).closest("tr")!;
  expect([...residual.children].map(node => node.textContent)).toEqual(["Residual PII checks", "1", "0", "1", "0", "Unavailable", "0"]);
  const quality = within(table).getByRole("rowheader", { name: "Data quality" }).closest("tr")!;
  expect([...quality.children].map(node => node.textContent)).toEqual(["Data quality", "0", "0", "0", "0", "—", "1"]);
});

test("missing report from older snapshots never becomes a pass", () => {
  render(<RunValidation />);
  expect(screen.getByText(/No validation report returned/)).toBeVisible();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Download validation JSON" })).not.toBeInTheDocument();
});

test.each([undefined, "gliner-name-labels-v4-context-demo-v1"])("download preserves diagnostics and optional text-free provenance: %s", async configuration => {
  let captured: Blob | undefined;
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn((blob: Blob) => { captured = blob; return "blob:synthetic"; }),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const actual: C2DemoValidationSummary = configuration ? { ...report, anonymization_strategy: "gliner" } : report;
  const current = structuredClone(actual);
  current.records[0].residual_assessment = {
    status: "NO_SIGNAL", verification: "NOT_VERIFIED", method: "c2-residual-output-v1",
    rule_ids: [], reasons: ["no_signal_not_verified_anonymity"],
  };
  const release = configuration ? { release_ready: false, blocking_reasons: ["experimental_anonymizer_not_release_validated", "additional_policy_hold"], human_release_required: true as const } : undefined;
  render(<RunValidation summary={current} configuration={configuration} release={release} />);
  fireEvent.click(screen.getByRole("button", { name: "Download validation JSON" }));
  expect(captured).toBeDefined();
  expect(captured!.type).toBe("application/json");
  const content = await new Promise<string>(resolve => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(captured!);
  });
  expect(JSON.parse(content)).toEqual(configuration ? {
    ...current, anonymization_configuration: configuration,
    model: { id: "urchade/gliner_multi-v2.1", revision: "443d26d654e0324125a96bebd8e796c14ff2efe6" },
    release_status: release,
  } : current);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:synthetic");
});

test.each(["Reset", "edit"])("report belongs to the actual run and clears with %s", async action => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => url.endsWith("/scenarios") ? response.catalogue : { ...response.results.english, validation_summary: report } })));
  render(<C2Demo />);
  await screen.findByRole("textbox", { name: "Input text" });
  fireEvent.click(screen.getByRole("button", { name: "Anonymize" }));
  await screen.findByRole("table", { name: "Backend stage validation counts" });
  if (action === "Reset") fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  else fireEvent.change(screen.getByRole("textbox", { name: "Input text" }), { target: { value: "New fictional input" } });
  expect(screen.queryByRole("table", { name: "Backend stage validation counts" })).not.toBeInTheDocument();
  expect(screen.getByText(/No validation report returned/)).toBeVisible();
});
