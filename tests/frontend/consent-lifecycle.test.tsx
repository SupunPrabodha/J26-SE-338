import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import StudentPortal from "../../apps/student-portal/app/page";

afterEach(() => vi.unstubAllGlobals());

function setup(retained = false, failWithdrawal = false) {
  let withdrawn = false;
  const consent = { consent_id: crypto.randomUUID(), consent_status: "ACTIVE", expires_at: new Date(Date.now() + 3600000).toISOString() };
  const state = () => ({ consent: { ...consent, consent_status: withdrawn ? "WITHDRAWN" : consent.consent_status }, case: retained ? { processing_status: "WITHDRAWN" } : null, disposal_reason: retained ? "RETENTION" : null, explicitly_withdrawn_at: withdrawn ? new Date().toISOString() : null });
  const fetch = vi.fn().mockImplementation(async (url: string, options?: {body?: string}) => {
    let data: unknown = {};
    if (url.endsWith("/fixtures")) data = { fixtures: { english: "SYNTHETIC: fixed fixture" } };
    if (url.endsWith("/consents")) { consent.consent_status = JSON.parse(options?.body || "{}").consent_status; data = consent; }
    if (url.endsWith("/withdraw")) {
      if (failWithdrawal) return { ok: false, status: 503 };
      withdrawn = true; data = state();
    }
    if (url.endsWith("/lifecycle")) data = state();
    return { ok: true, status: 200, json: async () => data };
  });
  vi.stubGlobal("fetch", fetch);
  render(<StudentPortal />);
  return fetch;
}

async function accept() {
  await screen.findByRole("option", { name: "english" });
  fireEvent.change(screen.getByLabelText("Consent choice"), { target: { value: "ACTIVE" } });
  fireEvent.click(screen.getByText("Record consent decision"));
  await screen.findByText("ACTIVE");
}

test("accepted consent can be withdrawn before submission with confirmation", async () => {
  const fetch = setup(); await accept();
  fireEvent.click(screen.getByText("Read the full consent and privacy notice"));
  expect(screen.getByText(/Consent notice dev-notice-1/)).toBeVisible();
  screen.getByText("Withdraw consent").focus();
  fireEvent.click(screen.getByText("Withdraw consent"));
  expect(screen.getByText("Keep consent")).toHaveFocus();
  expect(fetch.mock.calls.some(([url]) => url.endsWith("/withdraw"))).toBe(false);
  fireEvent.click(screen.getByText("Keep consent"));
  expect(screen.queryByText("Confirm withdrawal")).not.toBeInTheDocument();
  expect(screen.getByText("Withdraw consent")).toHaveFocus();
  fireEvent.click(screen.getByText("Withdraw consent"));
  fireEvent.click(screen.getByText("Confirm withdrawal"));
  await screen.findByText("Owner withdrawal recorded.");
  expect(screen.getByText("Withdraw consent")).toBeDisabled();
  expect(screen.getByText("Submit synthetic fixture")).toBeDisabled();
});

test("retention disposal still permits the owner's first explicit withdrawal", async () => {
  setup(true); await accept();
  fireEvent.click(screen.getByText("Refresh status"));
  await screen.findByText("Retention disposal");
  expect(screen.getByText("No explicit owner withdrawal recorded.")).toBeVisible();
  await waitFor(() => expect(screen.getByText("Withdraw consent")).toBeEnabled());
  fireEvent.click(screen.getByText("Withdraw consent"));
  fireEvent.click(screen.getByText("Confirm withdrawal"));
  await screen.findByText("Owner withdrawal recorded.");
  expect(screen.getByText("Retention disposal")).toBeVisible();
});

test("rejection is a successful decision and disables submission", async () => {
  setup(); await screen.findByRole("option", { name: "english" });
  fireEvent.click(screen.getByText("Record consent decision"));
  await screen.findByText("REJECTED");
  expect(screen.getByRole("status")).toHaveTextContent("Consent declined");
  expect(screen.getByText("Submit synthetic fixture")).toBeDisabled();
});

test("failed withdrawal retains confirmation and the same retry key", async () => {
  const fetch = setup(false, true); await accept();
  fireEvent.click(screen.getByText("Withdraw consent"));
  for (let attempt = 0; attempt < 2; attempt++) {
    fireEvent.click(screen.getByText("Confirm withdrawal"));
    await screen.findByRole("alert");
    await waitFor(() => expect(screen.getByText("Confirm withdrawal")).toBeEnabled());
  }
  const calls = fetch.mock.calls.filter(([url]) => url.endsWith("/withdraw"));
  expect(calls).toHaveLength(2);
  expect(calls[0][1].body).toEqual(calls[1][1].body);
  expect(screen.getByText("No explicit owner withdrawal recorded.")).toBeVisible();
});
