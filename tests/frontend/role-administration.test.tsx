import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AdminConsole from "../../apps/counsellor-dashboard/components/admin-console";
import ResearchDirectory from "../../apps/counsellor-dashboard/app/research/page";

afterEach(() => vi.unstubAllGlobals());
const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
const time = new Date().toISOString();
const staff = { account_id: crypto.randomUUID(), role: "COUNSELLOR", enabled: true, usable: true, created_at: time, updated_at: time, expires_at: null, is_current_account: false };
const example = { case_id: crypto.randomUUID(), processing_status: "READY_FOR_REVIEW", created_at: time, updated_at: time, expires_at: time, assignment_eligible: true, assignment_state: "AWAITING_ASSIGNMENT", assignment_version: "0".repeat(64), assignment_count: 0, counsellors: [], job_status: "DONE", attempts: 1 };
const counts = { eligible_cases: 1, awaiting_assignment: 1, assigned_cases: 0, active_counsellors: 1, enabled_staff: 2, pending_jobs: 0, failed_cases: 0, disposed_cases: 0, assignment_policy: "MANUAL", designated_counsellor_available: true, retention_hours: 24, observed_at: time };
const chartResponse = (url: string) => url.includes("/analytics?") ? { since: time, until: time, statuses: [], submissions: [], workload: [], total_cases: 0, workload_assignment_pairs: 0, observed_at: time, interval: "day" } : { items: [], next_offset: null, observed_at: time };

test("assignment changes require confirmation and send the observed version", async () => {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/me")) return ok({ role: "ADMIN" });
    if (url.endsWith("/overview")) return ok(counts);
    if (url.includes("/staff?")) return ok({ items: [staff], next_offset: null, observed_at: time });
    if (options?.method === "POST") return ok(example);
    return ok({ items: [example], next_offset: null, observed_at: time });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<AdminConsole section="assignments" />);
  fireEvent.click(await screen.findByText(`Manage case ${example.case_id.slice(0, 8)}`));
  const select = await screen.findByLabelText("Assigned counsellor");
  await screen.findByRole("option", { name: `Counsellor ${staff.account_id.slice(0, 8)}` });
  fireEvent.change(select, { target: { value: staff.account_id } });
  fireEvent.click(screen.getByText("Review assignment change"));
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByText("Cancel change")).toHaveFocus();
  expect(fetcher.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
  await screen.findByText("Assignment saved. Previous assignments were revoked where applicable.");
  const saved = fetcher.mock.calls.find(([url, options]) => url.endsWith("/assignment") && options?.method === "POST");
  expect(JSON.parse(String(saved?.[1]?.body))).toMatchObject({ counsellor_id: staff.account_id, expected_version: example.assignment_version });
});

test("staff controls confirm revocation before saving and allow cancellation", async () => {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/me")) return ok({ role: "ADMIN" });
    if (url.endsWith("/overview")) return ok(counts);
    if (options?.method === "POST") return ok({ ...staff, enabled: false });
    return ok({ items: [staff], next_offset: null, observed_at: time });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<AdminConsole section="staff" />);
  fireEvent.click(await screen.findByText(`Manage staff ${staff.account_id.slice(0, 8)}`));
  fireEvent.change(screen.getByLabelText("Account access"), { target: { value: "false" } });
  fireEvent.click(screen.getByText("Review staff change"));
  expect(screen.getByRole("dialog")).toHaveTextContent("Existing sessions will be revoked");
  fireEvent.click(screen.getByText("Cancel change"));
  expect(fetcher.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
  fireEvent.click(screen.getByText("Review staff change"));
  fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
  await screen.findByText("Staff permissions saved; previous sessions revoked.");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("overview renders counts supplied by the backend rather than invented metrics", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("?") ? ok(chartResponse(url)) : url.endsWith("/me") ? ok({ role: "ADMIN" }) : ok(counts)));
  render(<AdminConsole section="overview" />);
  expect(await screen.findByText("Manual assignment")).toBeVisible();
  expect(screen.getByText("Awaiting assignment").parentElement).toHaveTextContent("1");
  expect(screen.getByText("Disposed cases").parentElement).toHaveTextContent("0");
  expect(screen.getByRole("link", { name: "Staff and roles" })).toHaveAttribute("href", "/admin/staff");
});

test("research navigation is protected and does not invent component web links", async () => {
  const fetcher = vi.fn(async (url: string) => url.endsWith("/me") ? ok({ role: "RESEARCHER" }) : ok({ items: ["C2", "C3", "C4"].map((component, index) => ({ component, function: ["PREPROCESSING", "INFERENCE", "EXPLANATION"][index], provider: "MOCK_SYNTHETIC_DEVELOPMENT_ONLY", route_status: "INTERNAL_SERVICE_ONLY", web_path: null })), observed_at: time }));
  vi.stubGlobal("fetch", fetcher);
  render(<ResearchDirectory />);
  await screen.findByRole("button", { name: "Researcher account" });
  expect(screen.getAllByText(/No web page is connected/)).toHaveLength(3);
  expect(document.querySelectorAll(".component-grid a")).toHaveLength(0);
  expect(fetcher.mock.calls.every(([url]) => url.includes("/research-auth/") || url.endsWith("/component-routes"))).toBe(true);
});

test("expired admin session clears section data and protected controls", async () => {
  let ended = false;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (ended) return new Response(JSON.stringify({ error_code: "AUTH_INVALID" }), { status: 401 });
    return url.includes("?") ? ok(chartResponse(url)) : url.endsWith("/me") ? ok({ role: "ADMIN" }) : ok(counts);
  }));
  render(<AdminConsole section="overview" />);
  await screen.findByText("Manual assignment");
  ended = true; fireEvent.click(screen.getByText("Refresh view"));
  await screen.findByText("Development sign-in");
  await waitFor(() => expect(screen.queryByText("Manual assignment")).not.toBeInTheDocument());
});
