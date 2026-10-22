import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AnnotationPage from "../../apps/counsellor-dashboard/app/c2-demo/annotation/page";
import fixtures from "../fixtures/synthetic/c2-demo.json";

afterEach(() => vi.unstubAllGlobals());
const item = {
  record_id: "english", record_version: "f".repeat(64), pipeline_version: "synthetic-test-pipeline",
  annotation_schema_version: "c2-dataset-annotation-v1", vocabulary_version: "c2-provisional-vocabulary-v1",
  preprocessing: fixtures.results.english,
};
const vocabulary = {
  language: ["english", "sinhala", "romanized-si", "code-mixed", "other", "uncertain"],
  code_mixing: ["none", "insertion", "intra-sentential", "inter-sentential", "uncertain"],
  emotion: ["neutral", "sadness", "worry-or-fear", "anger", "joy", "mixed", "uncertain"],
  wellbeing: ["academic-pressure", "sleep-or-energy", "concentration-or-motivation", "social-connection", "coping-or-support", "no-clear-indicator", "uncertain"],
};
const blank = { language: null, code_mixing: null, emotion: null, wellbeing: null };
function setup() {
  const state = { item, own_history: [] as { revision: number; status: string; labels: Record<string, string | null>; saved_at: string }[], finalized_count: 0, annotation_status: "PENDING", peer_final: null as unknown, can_submit: true, agreement_status: "NOT_EVALUATED", adjudication_status: "PENDING" };
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    const data = options?.body ? JSON.parse(String(options.body)) : {};
    if (url.endsWith("/auth/me") || url.endsWith("/auth/login")) return ok({ account_id: "synthetic-account-a", role: "COUNSELLOR" });
    if (url.endsWith("/auth/logout")) return { ok: true, status: 204, json: async () => undefined };
    if (url.endsWith("/submissions")) return ok({ submissions: [], vocabulary });
    if (url.endsWith("/prepare")) return ok({ items: [item], vocabulary });
    if (url.endsWith("/revisions")) {
      state.own_history.push({ revision: state.own_history.length + 1, status: data.status, labels: data.labels, saved_at: "2026-10-15T00:00:00Z" });
      state.annotation_status = data.status === "FINAL" ? "SUBMITTED" : "DRAFT";
      state.can_submit = data.status !== "FINAL"; state.finalized_count = data.status === "FINAL" ? 1 : 0;
    }
    return ok(state);
  });
  vi.stubGlobal("fetch", fetcher);
  return { state, fetcher };
}
function ok(value: unknown) { return { ok: true, status: 200, json: async () => structuredClone(value) }; }
async function choose() {
  await screen.findByLabelText("Annotation item");
  fireEvent.click(screen.getByText("Earlier standalone synthetic items (saved history preserved)"));
  fireEvent.change(screen.getByLabelText("Annotation item"), { target: { value: "english" } });
  await screen.findByRole("heading", { name: "Your annotation" });
}

test("renders immutable actual fixture text, provisional labels and no peer data", async () => {
  setup(); render(<AnnotationPage />); await choose();
  expect(screen.getByText(fixtures.results.english.records[0].anonymized_text)).toBeVisible();
  expect(screen.queryByRole("textbox", { name: /text/i })).not.toBeInTheDocument();
  expect(screen.getByText(/vocabulary is not expert-approved/)).toBeVisible();
  expect(screen.getByText(/labels remain hidden until both/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Finalize submission" })).toBeDisabled();
});

test("saves partial draft and restores it after unmount/reload without browser storage", async () => {
  const { fetcher } = setup(); const first = render(<AnnotationPage />); await choose();
  fireEvent.change(screen.getByLabelText("Language"), { target: { value: "english" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByText(/Draft saved on the server/);
  const saved = JSON.parse(String(fetcher.mock.calls.find(([url]) => url.endsWith("/revisions"))![1]!.body));
  expect(saved.labels).toEqual({ ...blank, language: "english" });
  expect(saved).not.toHaveProperty("actor_id"); expect(saved).not.toHaveProperty("text");
  first.unmount(); render(<AnnotationPage />); await choose();
  expect(screen.getByLabelText("Language")).toHaveValue("english");
  expect(screen.getByLabelText("Emotion")).toHaveValue("");
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});

test("neutral/none/no-indicator and uncertain are completed choices, then final is locked", async () => {
  setup(); render(<AnnotationPage />); await choose();
  for (const [name, value] of [["Language", "uncertain"], ["Code-mixing pattern", "none"], ["Emotion", "neutral"], ["Wellbeing indicator", "no-clear-indicator"]]) {
    fireEvent.change(screen.getByLabelText(name), { target: { value } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Finalize submission" }));
  await screen.findByText(/Final submission saved/);
  expect(screen.getByLabelText("Emotion")).toBeDisabled();
  expect(screen.getByText(/Submitted · awaiting second annotator/)).toBeVisible();
  expect(screen.getByText(/Agreement: NOT_EVALUATED/)).toBeVisible();
});

test("shows peer final only from backend after both finalize; agreement/release stay pending", async () => {
  const { state } = setup();
  state.own_history = [{ revision: 1, status: "FINAL", labels: { language: "english", code_mixing: "none", emotion: "neutral", wellbeing: "uncertain" }, saved_at: "2026-10-15T00:00:00Z" }];
  state.annotation_status = "PAIR_FINALIZED"; state.finalized_count = 2; state.can_submit = false;
  state.peer_final = { ...state.own_history[0], labels: { ...state.own_history[0].labels, emotion: "sadness" } };
  render(<AnnotationPage />); await choose();
  expect(screen.getByText("Two submissions saved")).toBeVisible();
  fireEvent.click(screen.getByText(/Other annotator’s final labels/));
  expect(screen.getByText("Emotion: sadness")).toBeVisible();
  expect(screen.getByText(/Adjudication: PENDING/)).toBeVisible();
  expect(screen.getByText(/Human release approval remains required/)).toBeVisible();
});

test.each([401, 403, 404, 409, 422, 503])("safe %s errors expose no server body", async status => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status, json: async () => ({ detail: "PRIVATE-INTERNAL" }) })));
  render(<AnnotationPage />);
  expect(await screen.findByRole("alert")).not.toHaveTextContent("PRIVATE-INTERNAL");
});

test("clears password after existing-login submission", async () => {
  const { fetcher } = setup(); fetcher.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
  render(<AnnotationPage />); await screen.findByLabelText("Password");
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "fictional-reviewer" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "disposable-test-value" } });
  const password = screen.getByLabelText("Password");
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(password).toHaveValue("");
  await screen.findByLabelText("Annotation item");
});

test("logout invalidates a delayed result so saved labels cannot reappear", async () => {
  const { fetcher } = setup(); render(<AnnotationPage />); await screen.findByLabelText("Annotation item");
  let resolve!: (value: ReturnType<typeof ok>) => void;
  fetcher.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  fireEvent.change(screen.getByLabelText("Annotation item"), { target: { value: "english" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await act(async () => resolve(ok({ item, own_history: [], annotation_status: "PAIR_FINALIZED" })));
  expect(screen.queryByRole("heading", { name: "Your annotation" })).not.toBeInTheDocument();
});
