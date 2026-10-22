import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SubmissionWorkbench } from "../../apps/counsellor-dashboard/app/c2-demo/annotation/SubmissionWorkbench";
import fixtures from "../fixtures/synthetic/c2-demo.json";

afterEach(() => vi.unstubAllGlobals());
const blank = { language: null, code_mixing: null, emotion: null, wellbeing: null };
const vocabulary = { language: ["sinhala", "english", "uncertain"], code_mixing: ["none"], emotion: ["neutral"], wellbeing: ["no-clear-indicator"] };
function setup() {
  const rows = ["SYN-A", "SYN-B"].map(submission_id => ({ submission_id, submission_version: "v1", source_dataset_id: "synthetic", source_file_sha256: "f".repeat(64), available_answers: 5, finalized_answers: 0, blocked_answers: 1, complete: false,
    answers: Array.from({ length: 7 }, (_, i) => ({ question_id: `Q${i + 4}`, question_text: `Fictional question ${i + 4}`, source_record_id: `${submission_id}-Q${i + 4}`, required: i < 6,
      state: i === 6 ? "OPTIONAL_UNANSWERED" : i === 5 ? "WITHHELD" : "AVAILABLE", blocking_reasons: i === 5 ? ["privacy_review_required"] : [],
      annotation: i >= 5 ? null : { item: { record_id: `${submission_id}-Q${i + 4}`, record_version: "f".repeat(64), pipeline_version: "test", annotation_schema_version: "c2-dataset-annotation-v1", vocabulary_version: "c2-provisional-vocabulary-v1", preprocessing: fixtures.results.english },
        own_history: [] as { revision: number; status: string; labels: Record<string, string | null> }[], can_submit: true, annotation_status: "PENDING", peer_final: null },
    })),
  }));
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/submissions")) return ok({ submissions: rows, vocabulary });
    if (url.endsWith("/revisions")) {
      const body = JSON.parse(String(options?.body));
      const answer = rows.flatMap(row => row.answers).find(row => url.includes(row.source_record_id))!;
      answer.annotation!.own_history.push({ revision: answer.annotation!.own_history.length + 1, status: body.status, labels: body.labels });
      answer.annotation!.can_submit = body.status !== "FINAL";
      answer.annotation!.annotation_status = body.status === "FINAL" ? "SUBMITTED" : "DRAFT";
      return ok(answer.annotation);
    }
    return ok(rows.find(row => url.endsWith(row.submission_id)));
  });
  vi.stubGlobal("fetch", fetcher);
  return { rows, fetcher };
}
function ok(data: unknown) { return { ok: true, status: 200, json: async () => structuredClone(data) }; }
async function open() { fireEvent.click(await screen.findByRole("button", { name: "SYN-A" })); await screen.findByRole("heading", { name: "Submission SYN-A" }); }

test("navigates ordered answers and submissions; optional Q10 and withheld answers have no labels", async () => {
  setup(); render(<SubmissionWorkbench onExpired={vi.fn()} />); await open();
  expect(screen.getByRole("button", { name: "Previous answer" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Next answer" }));
  await screen.findByRole("heading", { name: "Q5: Fictional question 5" });
  fireEvent.click(screen.getByRole("button", { name: "Q9" }));
  await screen.findByText(/Answer withheld or missing/); expect(screen.queryByLabelText("Language")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Q10" }));
  await screen.findByText(/Optional Q10 unanswered/); expect(screen.queryByRole("button", { name: "Finalize answer" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next submission" }));
  await screen.findByRole("heading", { name: "Submission SYN-B" });
  expect(screen.getByRole("heading", { name: "Q4: Fictional question 4" })).toBeVisible();
});

test("language labels never change text; draft survives reload and finals lock", async () => {
  const { fetcher } = setup(); const first = render(<SubmissionWorkbench onExpired={vi.fn()} />); await open();
  const original = fixtures.results.english.records[0].anonymized_text;
  expect(screen.getByLabelText("Language")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Language"), { target: { value: "sinhala" } });
  expect(screen.getByText(original)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" })); await screen.findByText("Draft saved on the server.");
  const sent = JSON.parse(String(fetcher.mock.calls.find(([url]) => url.endsWith("/revisions"))![1]?.body));
  expect(sent.labels).toEqual({ ...blank, language: "sinhala" }); expect(sent).not.toHaveProperty("text");
  first.unmount(); render(<SubmissionWorkbench onExpired={vi.fn()} />); await open();
  expect(screen.getByLabelText("Language")).toHaveValue("sinhala"); expect(screen.getByText(original)).toBeVisible();
  for (const [field, value] of [["Code-mixing pattern", "none"], ["Emotion", "neutral"], ["Wellbeing indicator", "no-clear-indicator"]]) fireEvent.change(screen.getByLabelText(field), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Finalize answer" })); await screen.findByText(/Final answer saved and locked/);
  expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
  expect(screen.getByLabelText("Language")).toBeDisabled();
  expect(screen.getByText(/labels remain hidden until both/)).toBeVisible();
});

test("unassigned account has empty queue and no way to claim answers", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ok({ submissions: [], vocabulary })));
  render(<SubmissionWorkbench onExpired={vi.fn()} />);
  await screen.findByText(/No submissions assigned/);
  expect(screen.queryByLabelText("Language")).toBeNull();
});

test("expired session clears protected results", async () => {
  const { fetcher } = setup(); const expired = vi.fn(); render(<SubmissionWorkbench onExpired={expired} />); await open();
  fetcher.mockImplementation(async () => ({ ok: false, status: 401, json: async () => ({}) }));
  fireEvent.click(screen.getByRole("button", { name: "Next submission" }));
  await screen.findByRole("alert"); expect(expired).toHaveBeenCalledOnce();
  expect(screen.queryByText(fixtures.results.english.records[0].anonymized_text)).toBeNull();
});

test("final notice and distinct states explain locks while other answers stay editable", async () => {
  const { rows, fetcher } = setup();
  rows[0].answers[0].annotation!.own_history.push({ revision: 1, status: "FINAL", labels: { language: "english", code_mixing: "none", emotion: "neutral", wellbeing: "no-clear-indicator" } });
  rows[0].answers[0].annotation!.can_submit = false;
  rows[0].answers[1].annotation!.own_history.push({ revision: 1, status: "DRAFT", labels: { ...blank, language: "sinhala" } });
  render(<SubmissionWorkbench onExpired={vi.fn()} />); await open();
  expect(screen.getByText("Finalized — read only")).toBeVisible();
  expect(screen.getByLabelText("Language")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Q4" })).toHaveAttribute("aria-current", "step");
  expect(screen.getByRole("button", { name: "Q5" })).toHaveTextContent("Draft");
  expect(screen.getByRole("button", { name: "Q6" })).toHaveTextContent("Pending");
  expect(screen.getByRole("button", { name: "Q9" })).toHaveTextContent("Privacy hold");
  expect(screen.getByRole("button", { name: "Q10" })).toHaveTextContent("Optional missing");
  const calls = fetcher.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Next answer" }));
  expect(screen.getByLabelText("Language")).toBeEnabled(); expect(screen.getByLabelText("Language")).toHaveValue("sinhala");
  expect(screen.queryByText("Finalized — read only")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Q6" })); expect(screen.getByLabelText("Language")).toHaveValue("");
  expect(fetcher.mock.calls.length).toBe(calls);
});

test("unsaved navigation cancellation retains labels; successful save shows one dismissible notification", async () => {
  setup(); render(<SubmissionWorkbench onExpired={vi.fn()} />); await open();
  vi.stubGlobal("confirm", vi.fn(() => false));
  fireEvent.change(screen.getByLabelText("Language"), { target: { value: "english" } });
  fireEvent.click(screen.getByRole("button", { name: "Q5" }));
  expect(screen.getByRole("button", { name: "Q4" })).toHaveAttribute("aria-current", "step");
  expect(screen.getByLabelText("Language")).toHaveValue("english");
  fireEvent.click(screen.getByRole("button", { name: "Save draft" })); await screen.findByText("Draft saved on the server.");
  expect(screen.getAllByText("Draft saved on the server.")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
  expect(screen.queryByText("Draft saved on the server.")).toBeNull();
});

test("unavailable assignment gives a specific safe error and keeps final states unchanged", async () => {
  const { fetcher } = setup(); render(<SubmissionWorkbench onExpired={vi.fn()} />); await open();
  fetcher.mockImplementationOnce(async () => ({ ok: false, status: 404, json: async () => ({ private: "not displayed" }) }));
  fireEvent.click(screen.getByRole("button", { name: "Next submission" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("unassigned to your account");
  expect(screen.queryByText("not displayed")).toBeNull();
});
