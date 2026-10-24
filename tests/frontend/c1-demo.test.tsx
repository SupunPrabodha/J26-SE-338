import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import Demo from "../../apps/student-portal/app/demo/page";
import { checklist, privacyGroups } from "../../apps/student-portal/components/checklist-rules";
import { OBSERVER_INTERVAL, OBSERVER_LIMIT } from "../../apps/student-portal/components/demo-checklist";
import type { DemoEvidence } from "../../packages/typescript-common/src/contracts";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const meta = { schema_version: "1.0.0", synthetic: true, development_only: true } as const;
function fixture(): DemoEvidence {
  return { ...meta, run: { ...meta, run_id: crypto.randomUUID(), created_at: new Date().toISOString(), consent_status: "ACTIVE", case_id: null, processing_status: null },
    observed_at: new Date().toISOString(), receipt_only: false, consent_recorded: true, consent_policy_valid: true, blocking_observed: false, replay_observed: false,
    failure_observed: false, provenance_validated: false, review_task_authorized: false, review_started_at: null, review_completed_at: null,
    withdrawn_at: null, disposal_confirmed: false, receipts: [{ ...meta, event: "CONSENT_RECORDED", occurred_at: new Date().toISOString() }], receipts_truncated: false,
    provider: "MOCK_SYNTHETIC_DEVELOPMENT_ONLY" };
}
async function setup(empty = false) {
  const first = fixture(), second = fixture();
  let failure = 0;
  let values = empty ? [] : [first, second];
  const fetch = vi.fn(async (url: string) => {
    if (failure) return { ok: false, status: failure };
    const data = url.includes("?offset=") ? { ...meta, runs: values.map(v => v.run), next_offset: null } : values.find(v => url.endsWith(v.run.run_id));
    return { ok: true, status: 200, json: async () => structuredClone(data) };
  });
  vi.stubGlobal("fetch", fetch);
  render(<Demo />);
  await screen.findByText(/Connected ?/);
  return { first, second, fetch, fail: (status: number) => { failure = status; }, values: (next: DemoEvidence[]) => { values = next; } };
}
async function select(id: string) { await act(async () => { fireEvent.change(screen.getByLabelText("Your runs"), { target: { value: id } }); }); }
async function refresh() { await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Refresh evidence" })); }); }
function row(id: string) {
  if (!document.querySelector(`[data-check="${id}"]`)) {
    const close = screen.queryByRole("button", { name: "Close dialog" }); if (close) fireEvent.click(close);
    const group = privacyGroups.find(value => (value.ids as readonly string[]).includes(id));
    if (group) { fireEvent.click(screen.getByRole("button", { name: "Privacy controls" })); fireEvent.click(screen.getByRole("button", { name: `View evidence: ${group.title}` })); }
    else { fireEvent.click(screen.getByRole("button", { name: "Reliability and oversight" })); fireEvent.click(screen.getByText("View reliability and oversight evidence")); }
  }
  return within(document.querySelector(`[data-check="${id}"]`)! as HTMLElement);
}
async function tick() { await act(async () => { await vi.advanceTimersByTimeAsync(OBSERVER_INTERVAL); }); }

test("observer has no form, no automatic selection, and clear application links", async () => {
  const { fetch } = await setup();
  expect(screen.queryByLabelText("Consent choice")).not.toBeInTheDocument();
  expect(screen.queryByText("Submit synthetic fixture")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open student submission" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "Open counsellor application" })).toHaveAttribute("href", "http://localhost:3001");
  expect(row("FR01.a").getByText("Not exercised")).toBeVisible();
  expect(fetch.mock.calls.every(([url]) => url.includes("/demo/runs"))).toBe(true);
});

test("empty owner context can observe consent added in another tab after refresh", async () => {
  const state = await setup(true);
  expect(screen.getByText(/No consent or case yet/)).toBeVisible();
  state.values([state.first]); await refresh(); await select(state.first.run.run_id);
  expect(row("FR01.a").getByText("Verified in selected run")).toBeVisible();
  expect(row("FR02.a").getByText("Not exercised")).toBeVisible();
});

test("rejection is a decision, not evidence of a denied processing request", async () => {
  const { first } = await setup(); first.run.consent_status = "REJECTED"; first.receipt_only = true;
  await select(first.run.run_id);
  expect(row("FR01.a").getByText("Verified in selected run")).toBeVisible();
  expect(row("FR02.a").getByText("Not exercised")).toBeVisible();
  expect(row("FR05").getByText("Unavailable or stale")).toBeVisible();
});

test("pre-case withdrawal shows only actual receipt and does not invent disposal", async () => {
  const { first } = await setup(); first.withdrawn_at = new Date().toISOString(); first.receipt_only = true; first.run.consent_status = "WITHDRAWN";
  await select(first.run.run_id);
  expect(row("FR10.a").getByText("Verified in selected run")).toBeVisible();
  expect(row("FR10.b").getByText("Not exercised")).toBeVisible();
});

test("workflow and real review actions update through bounded polling without a form", async () => {
  const { first } = await setup(); await select(first.run.run_id);
  vi.useFakeTimers(); await refresh();
  first.run.case_id = crypto.randomUUID(); first.run.processing_status = "READY_FOR_REVIEW";
  first.provenance_validated = true; first.review_task_authorized = true;
  await tick();
  expect(row("FR07").getByText("Verified in selected run")).toBeVisible();
  expect(row("FR09.b").getByText("Not exercised")).toBeVisible();
  first.run.processing_status = "COMPLETED";
  await tick(); expect(row("FR09.b").getByText("Not exercised")).toBeVisible();
  first.review_completed_at = new Date().toISOString(); await tick();
  expect(row("FR09.b").getByText("Verified in selected run")).toBeVisible();
  first.receipt_only = true; first.run.processing_status = "WITHDRAWN"; first.withdrawn_at = new Date().toISOString(); first.disposal_confirmed = true;
  first.provenance_validated = false; first.review_task_authorized = false; await tick();
  expect(row("FR07").getByText("Unavailable or stale")).toBeVisible();
  expect(row("FR10.b").getByText("Verified in selected run")).toBeVisible();
});

test("newly selected run cannot inherit old successful evidence", async () => {
  const { first, second } = await setup(); first.provenance_validated = true;
  await select(first.run.run_id); expect(row("FR05").getByText("Verified in selected run")).toBeVisible();
  await select(second.run.run_id); expect(row("FR05").getByText("Not exercised")).toBeVisible();
});

for (const status of [401, 403, 404, 503]) test(`failed refresh ${status} removes green live evidence and stops polling`, async () => {
  const state = await setup(); await select(state.first.run.run_id); state.fail(status); await refresh();
  expect(row("FR01.a").getByText("Unavailable or stale")).toBeVisible();
  expect(screen.queryAllByText("Verified in selected run")).toHaveLength(0);
  const count = state.fetch.mock.calls.length;
  vi.useFakeTimers(); await tick(); expect(state.fetch.mock.calls.length).toBe(count);
  if (status === 401) expect(state.fetch.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(true);
});

test("polling budget expires honestly and manual refresh can resume", async () => {
  const state = await setup(); await select(state.first.run.run_id);
  vi.useFakeTimers(); await refresh();
  for (let i = 1; i < OBSERVER_LIMIT; i++) await tick();
  expect(screen.getByText(/Refresh window ended/)).toBeVisible();
  expect(row("FR01.a").getByText("Unavailable or stale")).toBeVisible();
  const count = state.fetch.mock.calls.length; await tick(); expect(state.fetch.mock.calls.length).toBe(count);
  await refresh(); expect(row("FR01.a").getByText("Verified in selected run")).toBeVisible();
});

test("HTTP, mocks, recorded tests and compound requirements never inherit a workflow pass", () => {
  const evidence = fixture(); evidence.provenance_validated = true; evidence.run.processing_status = "COMPLETED";
  const rows = checklist(evidence, false);
  const result = (id: string) => rows.find(r => r.id === id)!;
  expect(result("FR04.b").result).toBe("Recorded configuration evidence");
  expect(result("NFR02.b").result).toBe("Recorded configuration evidence");
  expect(result("NFR02.c").result).toBe("Recorded configuration evidence");
  expect(result("FR03.b").source).toBe("Recorded test evidence");
  for (const id of ["FR02.a", "FR06.a", "FR06.b", "FR09.b"]) expect(result(id).result).toBe("Not exercised");
});

test("server failure is a failed outcome, not a fabricated completed stage", () => {
  const evidence = fixture(); evidence.run.processing_status = "FAILED";
  expect(checklist(evidence, false).find(r => r.id === "FR04.a")?.result).toBe("Failed");
  expect(checklist(evidence, true).find(r => r.id === "FR04.a")?.result).toBe("Unavailable or stale");
});
