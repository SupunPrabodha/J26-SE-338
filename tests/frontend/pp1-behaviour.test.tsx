import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import StudentPortal from "../../apps/student-portal/app/page";
import Dashboard from "../../apps/counsellor-dashboard/app/page";

afterEach(() => vi.unstubAllGlobals());
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data });
const consent = () => ({ consent_id: crypto.randomUUID(), consent_status: "ACTIVE", expires_at: new Date(Date.now() + 3600000).toISOString() });

test("submission waits for server-confirmed acceptance", async () => {
  let resolveDecision: (value: unknown) => void = () => {};
  const pending = new Promise(resolve => { resolveDecision = resolve; });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/fixtures") ? ok({ fixtures: { english: "SYNTHETIC: fixture" } }) : url.endsWith("/consents") ? pending : ok({})));
  render(<StudentPortal />);
  await screen.findByRole("option", { name: "english" });
  fireEvent.change(screen.getByLabelText("Consent choice"), { target: { value: "ACTIVE" } });
  fireEvent.click(screen.getByText("Record consent decision"));
  expect(screen.getByText("Submit synthetic fixture")).toBeDisabled();
  resolveDecision(ok(consent()));
  await waitFor(() => expect(screen.getByText("Submit synthetic fixture")).toBeEnabled());
});

test.each([401, 403])("student controls respond to server denial %i without inventing withdrawal", async status => {
  const record = consent();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/fixtures")) return ok({ fixtures: { english: "SYNTHETIC: fixture" } });
    if (url.endsWith("/consents")) return ok(record);
    if (url.endsWith("/submissions") || url.endsWith("/auth/refresh")) return { ok: false, status };
    return ok({});
  }));
  render(<StudentPortal />);
  await screen.findByRole("option", { name: "english" });
  fireEvent.change(screen.getByLabelText("Consent choice"), { target: { value: "ACTIVE" } });
  fireEvent.click(screen.getByText("Record consent decision"));
  await waitFor(() => expect(screen.getByText("Submit synthetic fixture")).toBeEnabled());
  fireEvent.click(screen.getByText("Submit synthetic fixture"));
  await screen.findByRole("alert");
  expect(screen.getByText("Submit synthetic fixture")).toBeDisabled();
  expect(screen.getByText("No explicit owner withdrawal recorded.")).toBeVisible();
  if (status === 401) {
    expect(screen.getByText("Withdraw consent")).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("cannot recover access");
  } else expect(screen.getByText("Refresh required after access denial")).toBeVisible();
});

test("expired consent cannot enable submission even if server status says ACTIVE", async () => {
  const record = { ...consent(), expires_at: new Date(Date.now() - 1).toISOString() };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/fixtures") ? ok({ fixtures: { english: "SYNTHETIC: fixture" } }) : url.endsWith("/consents") ? ok(record) : ok({})));
  render(<StudentPortal />);
  await screen.findByRole("option", { name: "english" });
  fireEvent.click(screen.getByText("Record consent decision"));
  await screen.findByText("EXPIRED");
  expect(screen.getByText("Submit synthetic fixture")).toBeDisabled();
});

test.each([401, 403, 404])("counsellor denial %i clears cached evidence and actions", async status => {
  const task = { task_id: crypto.randomUUID(), case: { case_id: crypto.randomUUID(), processing_status: "READY_FOR_REVIEW" },
    inference: { wellbeing_indicator: "synthetic-indicator", emotional_tone: "synthetic-neutral", stress_language_signals: [], confidence: 0.5, model_version: "mock-1", service_version: "0.1.0" },
    explanation: { evidence: ["SYNTHETIC selected evidence"], reliability_status: "NOT_EVALUATED", explainer_version: "mock-1" } };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/me")) return ok({ role: "COUNSELLOR" });
    if (url.endsWith("/review-tasks")) return ok([task]);
    if (url.endsWith("/actions") || url.endsWith("/refresh")) return { ok: false, status };
    return ok(task);
  }));
  render(<Dashboard />);
  fireEvent.click(await screen.findByText("Open synthetic case 1"));
  await screen.findByText("SYNTHETIC selected evidence");
  expect(screen.getByText("Processing complete")).toBeVisible();
  expect(screen.queryByText("Human review completed")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Start human review"));
  await screen.findByRole("alert");
  expect(screen.queryByText("SYNTHETIC selected evidence")).not.toBeInTheDocument();
  expect(screen.queryByText("Start human review")).not.toBeInTheDocument();
  if (status === 401) expect(await screen.findByText("Development sign-in")).toBeVisible();
});
