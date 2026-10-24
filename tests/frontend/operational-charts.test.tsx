import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import OperationalCharts from "../../apps/counsellor-dashboard/components/operational-charts";
import ExplanationAvailability from "../../apps/counsellor-dashboard/components/explanation-availability";
import type { ReviewTask } from "@j26/common/contracts";

afterEach(() => vi.unstubAllGlobals());
const stamp = new Date().toISOString();
const values = { since: stamp, until: stamp, timezone: "UTC", interval: "day", total_cases: 3, statuses: [{ state: "READY_FOR_REVIEW", cases: 3 }], submissions: [{ bucket_start: stamp, cases: 3 }], workload: [], workload_assignment_pairs: 0, observed_at: stamp };
const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

test("operational charts show actual counts with tables and identical source filters", async () => {
  const fetcher = vi.fn(async (url: string) => ok(url.includes("/analytics?") ? values : { items: [], next_offset: null, observed_at: stamp }));
  vi.stubGlobal("fetch", fetcher);
  const ended = vi.fn();
  const view = render(<OperationalCharts refreshKey="initial" onSessionEnded={ended} />);
  await screen.findByText(/3 matching case/);
  expect(screen.getAllByRole("img")).toHaveLength(3); // empty workload does not fabricate bars
  expect(screen.getByText("View data table: Active assigned workload")).toBeVisible();
  expect(screen.getByText(/No matching cases for this metric/)).toBeVisible();
  fireEvent.change(screen.getByLabelText("Submission buckets"), { target: { value: "week" } });
  fireEvent.change(screen.getByLabelText("Case reference prefix"), { target: { value: "abcd" } });
  fireEvent.change(screen.getByLabelText("Assignment"), { target: { value: "AWAITING_ASSIGNMENT" } });
  fireEvent.click(screen.getByText("Apply chart filters"));
  await waitFor(() => expect(fetcher.mock.calls.length).toBe(4));
  const aggregate = new URL(fetcher.mock.calls[2][0], "http://localhost"), source = new URL(fetcher.mock.calls[3][0], "http://localhost");
  for (const key of ["since", "until", "q", "state", "assignment"]) expect(aggregate.searchParams.get(key)).toBe(source.searchParams.get(key));
  expect(aggregate.searchParams.get("interval")).toBe("week");
  expect(aggregate.searchParams.get("assignment")).toBe("AWAITING_ASSIGNMENT");
  await screen.findByText(/3 matching case/);
  view.rerender(<OperationalCharts refreshKey="next" onSessionEnded={ended} />);
  await waitFor(() => expect(fetcher.mock.calls.length).toBe(6));
  const refreshed = new URL(fetcher.mock.calls[4][0], "http://localhost");
  expect(refreshed.searchParams.get("q")).toBe("abcd");
  expect(refreshed.searchParams.get("interval")).toBe("week");
});

test("chart refresh failure clears previously displayed counts without claiming consent withdrawal", async () => {
  let fail = false;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (fail) throw new TypeError("private transport details");
    return ok(url.includes("/analytics?") ? values : { items: [], next_offset: null, observed_at: stamp });
  }));
  render(<OperationalCharts refreshKey="initial" onSessionEnded={vi.fn()} />);
  await screen.findByText(/3 matching case/); fail = true;
  fireEvent.click(screen.getByText("Refresh charts"));
  await screen.findByRole("alert");
  expect(screen.queryByText(/3 matching case/)).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).not.toHaveTextContent("private transport details");
  expect(screen.queryAllByRole("img")).toHaveLength(0);
});

test("expired chart session clears counts and delegates session invalidation", async () => {
  const ended = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error_code: "AUTH_INVALID" }), { status: 401 })));
  render(<OperationalCharts refreshKey="initial" onSessionEnded={ended} />);
  await waitFor(() => expect(ended).toHaveBeenCalledOnce());
  expect(screen.queryAllByRole("img")).toHaveLength(0);
});

test("C4 contract without numeric contributions or class probabilities renders an honest unavailable state", () => {
  render(<ExplanationAvailability task={{ inference: { confidence: 0.5, model_version: "mock-1" }, explanation: { method: "MOCK_FIXED_FIXTURE", explainer_version: "mock-1", faithfulness: null, stability: null } } as ReviewTask} />);
  expect(screen.getByText("Explanation values unavailable from current provider")).toBeVisible();
  expect(screen.getByText("Mock provider")).toBeVisible();
  expect(screen.queryAllByRole("img")).toHaveLength(0);
  expect(document.querySelector("svg, canvas")).not.toBeInTheDocument();
});
