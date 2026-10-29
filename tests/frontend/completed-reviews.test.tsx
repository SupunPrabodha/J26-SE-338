import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import Dashboard from "../../apps/counsellor-dashboard/components/counsellor-workspace";

afterEach(() => vi.unstubAllGlobals());
const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
const denied = () => new Response(JSON.stringify({ error_code: "AUTH_REQUIRED" }), { status: 401 });

test("signing in on Completed reviews preserves its filter and explains exclusions", async () => {
  let signedIn = false;
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith("/login")) { signedIn = true; return ok({ role: "COUNSELLOR" }); }
    if (!signedIn) return denied();
    if (url.endsWith("/me")) return ok({ role: "COUNSELLOR" });
    return ok({ items: [], next_offset: null, observed_at: new Date().toISOString() });
  });
  vi.stubGlobal("fetch", fetcher); render(<Dashboard initialState="COMPLETED" />);
  await screen.findByLabelText("Development username");
  fireEvent.change(screen.getByLabelText("Development username"), { target: { value: "synthetic-reviewer" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: crypto.randomUUID() } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByText("No completed reviews available");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Completed reviews");
  expect(screen.getByLabelText("Review status")).toHaveValue("COMPLETED");
  expect(fetcher.mock.calls.filter(([url]) => url.includes("/review-queue?"))).toEqual([["/api/v1/review-queue?offset=0&state=COMPLETED", expect.anything()]]);
  expect(screen.getByText(/Withdrawn, expired, disposed or reassigned cases are excluded/)).toBeVisible();
});

test("changing the queue filter resets pagination and completed records reopen read-only", async () => {
  const task = { task_id: crypto.randomUUID(), case: { case_id: crypto.randomUUID(), processing_status: "COMPLETED" }, inference: { confidence: 0.5, stress_language_signals: [] }, explanation: { evidence: [], reliability_status: "NOT_EVALUATED" } };
  const record = { task_id: task.task_id, interpretation: "SYNTHETIC: Saved fictional observation.", follow_up: "DISCUSSION_OFFERED", saved_at: new Date().toISOString() };
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith("/me")) return ok({ role: "COUNSELLOR" });
    if (url.endsWith("/record")) return ok(record);
    if (!url.includes("/review-queue?")) return ok(task);
    return ok({ items: [{ ...task, review_record_saved_at: record.saved_at }], next_offset: url.includes("offset=0") ? 20 : null, observed_at: new Date().toISOString() });
  });
  vi.stubGlobal("fetch", fetcher); render(<Dashboard />);
  await screen.findByRole("button", { name: /^Open case / });
  fireEvent.click(screen.getByText("Next cases"));
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url.includes("offset=20"))).toBe(true));
  await waitFor(() => expect(screen.getByLabelText("Review status")).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Review status"), { target: { value: "COMPLETED" } });
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url.endsWith("offset=0&state=COMPLETED"))).toBe(true));
  await waitFor(() => expect(screen.getByRole("button", { name: /^Open case / })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: /^Open case / }));
  await screen.findByText(record.interpretation);
  expect(screen.queryByLabelText("Synthetic interpretation")).not.toBeInTheDocument();
  expect(screen.queryByText("Record review complete")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Refresh completed reviews"));
  await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/record"))).toHaveLength(2));
  expect(await screen.findByText(record.interpretation)).toBeVisible();
});
