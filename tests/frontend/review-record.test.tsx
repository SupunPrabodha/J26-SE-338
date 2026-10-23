import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import Dashboard from "../../apps/counsellor-dashboard/app/page";
import { checklist } from "../../apps/student-portal/components/checklist-rules";
import type { DemoEvidence } from "@j26/common/contracts";

afterEach(() => vi.unstubAllGlobals());
const text = "SYNTHETIC: Fictional context considered by a human.";
const ok = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });

async function setup() {
  const task = { task_id: crypto.randomUUID(), case: { case_id: crypto.randomUUID(), processing_status: "UNDER_REVIEW" },
    inference: { wellbeing_indicator: "synthetic-indicator", emotional_tone: "synthetic-neutral", stress_language_signals: [], confidence: 0.5, model_version: "mock-1", service_version: "0.1.0" },
    explanation: { evidence: ["SYNTHETIC fixed explanation"], reliability_status: "NOT_EVALUATED", explainer_version: "mock-1" } };
  let record: unknown = null, denied = false;
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/me")) return ok({ role: "COUNSELLOR" });
    if (denied) return new Response(JSON.stringify({ error_code: "CONSENT_INVALID" }), { status: 403 });
    if (url.endsWith("/review-tasks")) return ok([task]);
    if (url.endsWith("/record")) {
      if (options?.method === "POST") {
        const body = JSON.parse(String(options.body));
        record = { task_id: task.task_id, interpretation: body.interpretation, follow_up: body.follow_up, saved_at: new Date().toISOString() };
      }
      return ok(record);
    }
    return ok(task);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<Dashboard />);
  fireEvent.click(await screen.findByText("Open synthetic case 1"));
  await screen.findByLabelText("Synthetic interpretation");
  return { fetcher, deny: () => { denied = true; } };
}

test("assigned review form saves and retrieves protected content", async () => {
  const { fetcher } = await setup();
  const input = screen.getByLabelText("Synthetic interpretation");
  expect(input).toHaveAttribute("maxlength", "2000");
  expect(screen.getByText("Save review record")).toBeDisabled();
  fireEvent.change(input, { target: { value: text } });
  fireEvent.change(screen.getByLabelText("Follow-up category"), { target: { value: "DISCUSSION_OFFERED" } });
  fireEvent.click(screen.getByText("Save review record"));
  await screen.findByText("Review record saved");
  expect(screen.getByText(text)).toBeVisible();
  expect(screen.queryByLabelText("Synthetic interpretation")).not.toBeInTheDocument();
  const saved = fetcher.mock.calls.find(([url, init]) => url.endsWith("/record") && init?.method === "POST");
  expect(JSON.parse(String(saved?.[1]?.body))).toMatchObject({ interpretation: text, follow_up: "DISCUSSION_OFFERED" });
  fireEvent.click(screen.getByText("Refresh assigned tasks"));
  await waitFor(() => expect(fetcher.mock.calls.filter(([url, init]) => url.endsWith("/record") && init?.method === "GET")).toHaveLength(2));
  expect(await screen.findByText(text)).toBeVisible();
});

test("revoked consent clears saved record and protected controls", async () => {
  const { deny } = await setup();
  fireEvent.change(screen.getByLabelText("Synthetic interpretation"), { target: { value: text } });
  fireEvent.click(screen.getByText("Save review record"));
  await screen.findByText("Review record saved");
  deny(); fireEvent.click(screen.getByText("Refresh assigned tasks"));
  await screen.findByRole("alert");
  expect(screen.queryByText(text)).not.toBeInTheDocument();
  expect(screen.queryByText("Record review complete")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Synthetic interpretation")).not.toBeInTheDocument();
});

test("checklist separates capability, recorded tests and actual save receipt", () => {
  const evidence = { run: { consent_status: "ACTIVE" }, observed_at: new Date().toISOString(), receipts: [], review_record_saved_at: null } as unknown as DemoEvidence;
  expect(checklist(evidence, false).find(row => row.id === "FR09.c")?.result).toBe("Not exercised");
  evidence.review_record_saved_at = new Date().toISOString();
  const rows = checklist(evidence, false);
  expect(rows.find(row => row.id === "FR09.c")?.result).toBe("Verified for this run");
  expect(rows.find(row => row.id === "FR09.d")?.source).toBe("Configuration evidence");
  expect(rows.find(row => row.id === "FR09.e")?.source).toBe("Recorded test evidence");
  expect(checklist(evidence, true).find(row => row.id === "FR09.c")?.result).toBe("Unavailable/stale");
});
