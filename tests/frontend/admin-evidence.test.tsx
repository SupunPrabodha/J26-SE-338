import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import Operations from "../../apps/counsellor-dashboard/app/admin/page";

afterEach(() => vi.unstubAllGlobals());
const ok = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });

test("admin page filters safe events and clears them on access denial", async () => {
  let denied = false;
  const requests: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    requests.push(url);
    if (url.endsWith("/me")) return ok({ role: "ADMIN" });
    if (denied) return new Response(JSON.stringify({ error_code: "FORBIDDEN" }), { status: 403 });
    return ok({ items: [{ event_id: crypto.randomUUID(), event_type: "WORKFLOW_TRANSITION", outcome: "READY_FOR_REVIEW", occurred_at: new Date().toISOString(), correlation_id: crypto.randomUUID(), service_version: "0.1.0" }], observed_at: new Date().toISOString(), next_cursor: null, case_operations: null });
  }));
  render(<Operations />);
  await screen.findByRole("button", { name: "Admin account" });
  await screen.findByText("Ready for review");
  expect(requests.every(path => path.includes("/admin/") || path.includes("/admin-auth/"))).toBe(true);
  fireEvent.change(screen.getByLabelText("Event type"), { target: { value: "HUMAN_REVIEW" } });
  fireEvent.click(screen.getByText("Apply filters"));
  await screen.findByText("Ready for review");
  expect(requests.at(-1)).toContain("event_type=HUMAN_REVIEW");
  expect(screen.getByText("Older events")).toBeDisabled();
  denied = true; fireEvent.click(screen.getByText("Refresh evidence"));
  await screen.findByRole("alert");
  expect(screen.queryByText("Ready for review")).not.toBeInTheDocument();
});

test("a counsellor session cannot open admin data", async () => {
  const fetcher = vi.fn(async () => ok({ role: "COUNSELLOR" }));
  vi.stubGlobal("fetch", fetcher);
  render(<Operations />);
  await screen.findByText("Administrative access is required. Sign in with an authorized admin account.");
  expect(screen.getByLabelText("Development username")).toBeVisible();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Persisted audit events")).not.toBeInTheDocument();
});

test("open admin provider metadata is cleared when disposal withholds current provenance", async () => {
  let disposed = false;
  const caseId = crypto.randomUUID();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/me")) return ok({ role: "ADMIN" });
    if (url.endsWith("/overview")) return ok({});
    return ok({ items: [], observed_at: new Date().toISOString(), case_operations: { case_id: caseId, processing_status: disposed ? "WITHDRAWN" : "COMPLETED", provenance: disposed ? null : { model_version: "mock-private-version" } } });
  }));
  render(<Operations />);
  fireEvent.click(await screen.findByText("Available provider versions"));
  await screen.findByText("mock-private-version");
  await act(async () => {});
  disposed = true; fireEvent(window, new Event("focus"));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.queryByText("mock-private-version")).not.toBeInTheDocument();
  await screen.findByText("Derived provenance is no longer available. Refresh the permitted receipts.");
});
