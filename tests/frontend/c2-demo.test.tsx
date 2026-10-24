import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import C2Demo from "../../apps/counsellor-dashboard/app/c2-demo/page";
import fixtures from "../fixtures/synthetic/c2-demo.json";
import roleFixtures from "../fixtures/synthetic/c2-role-review.json";
import textFixtures from "../fixtures/synthetic/c2-text-processing.json";

afterEach(() => vi.unstubAllGlobals());

test("renders the real corrected role result with separate privacy and human gates", async () => {
  setup(async () => ok(roleFixtures.corrected)); render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByText(roleFixtures.corrected.records[0].anonymized_text);
  expect(screen.getByText(roleFixtures.corrected.records[0].original_text)).toBeVisible();
  expect(screen.getByText("Quality: PASS")).toBeVisible();
  expect(screen.getByText(/Privacy review: No automated review signal flagged/)).toBeVisible();
  expect(screen.getByText("Privacy gate: PASSED.")).toBeVisible();
  expect(screen.getByText(/Automated checks do not certify complete anonymization/)).toBeVisible();
  expect(screen.getByText("Human release approval required.")).toBeVisible();
});

test("renders actual unresolved-context quarantine and backend blocking reasons", async () => {
  setup(async () => ok(roleFixtures.review)); render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByText("Quality: REVIEW");
  expect(screen.getByText(/Privacy review: Required — quarantine pending human review/)).toBeVisible();
  expect(screen.getByText("Privacy gate: FAILED.")).toBeVisible();
  expect(screen.getByText("Automated gate: Blocked")).toBeVisible();
  for (const reason of roleFixtures.review.blocking_reasons) {
    expect(screen.getByText(reason.replaceAll(/[-_:]/g, " "))).toBeVisible();
  }
  expect(screen.getByRole("list", { name: "Privacy gate issues" })).toHaveTextContent("Possible indirect identifiers require human privacy review.");
});

test("keeps actual-runtime and Sinhala/Romanized limitations visible", async () => {
  setup(); render(<C2Demo />); await ready();
  expect(screen.getByText(/Sinhala and Romanized Sinhala can miss names or mask ordinary words/)).toBeVisible();
  expect(screen.getByText(/Quality PASS does not certify anonymization correctness/)).toBeVisible();
  fireEvent.click(screen.getByText("Anonymizer configuration", { selector: "summary" }));
  expect(screen.getByText(/Trained candidates remain offline/)).toBeVisible();
});

test("submits text without asking for its language; examples never populate input", async () => {
  setup(); render(<C2Demo />); await ready();
  expect(screen.queryByLabelText("Manual language hint")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Demo anonymizer")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Manual language hint")).not.toBeInTheDocument();
  const input = screen.getByLabelText("Fictional test text only");
  expect(input).toHaveValue("");
  fireEvent.change(input, { target: { value: "My fictional text" } });
  expect(input).toHaveValue("My fictional text");
  expect(screen.getByText("Illustrative examples (not inserted):")).toBeVisible();
});

test("renders backend Language ID read-only, with uncertainty and reset protection", async () => {
  const result = structuredClone(fixtures.results.english);
  Object.assign(result.records[0], { language_identification: {
    language: "uncertain", status: "uncertain",
    reason: "insufficient_or_ambiguous_latin_evidence", method: "c2-rule-language-v1", uncertain: true
  } });
  setup(async () => ok(result)); render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByRole("heading", { name: /Language ID.*after quality assessment/ });
  expect(screen.getByText("uncertain", { selector: "strong" })).toBeVisible();
  expect(screen.queryByLabelText("Manual language hint")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Demo anonymizer")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(screen.queryByText("uncertain", { selector: "strong" })).not.toBeInTheDocument();
});

test("duplicate run clicks send only one actual custom request", async () => {
  let resolve!: (value: unknown) => void;
  const fetch = setup(() => new Promise(done => { resolve = done; }));
  render(<C2Demo />); await ready();
  const button = screen.getByRole("button", { name: "Run demonstration" });
  fireEvent.click(button); fireEvent.click(button);
  expect(fetch.mock.calls.filter(([url]) => url.endsWith("/custom-runs"))).toHaveLength(1);
  await act(async () => resolve(ok(fixtures.results.english)));
  const notifications = screen.getByLabelText("Demo notifications");
  expect(notifications).toBeVisible();
  expect(notifications.querySelectorAll('[role="status"], [role="alert"]')).toHaveLength(1);
});

test("downstream cards are outside the top input/output row and technical tables start collapsed", async () => {
  setup(async () => ok(textFixtures.processed)); render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByTestId("normalized-text");
  const row = document.querySelector(".c2-workbench")!;
  expect(row.querySelector('[data-testid="normalized-text"]')).toBeNull();
  expect(row.querySelector(".c2-tokens")).toBeNull();
  expect(screen.getByRole("region", { name: "Language identification results" }).closest(".c2-workbench")).toBeNull();
  expect(screen.getByLabelText("Normalized text and tokens").closest(".c2-workbench")).toBeNull();
  expect(screen.getByText("Normalization and token offsets", { selector: "summary" }).parentElement).not.toHaveAttribute("open");
  expect(screen.getByText("Language evidence and limitations", { selector: "summary" }).parentElement).not.toHaveAttribute("open");
  expect(screen.queryByText("Evidence context")).not.toBeInTheDocument();
  expect(screen.queryByText(/artifacts\/c2-evidence/)).not.toBeInTheDocument();
});

test.each(["processed", "review"] as const)("one actual %s outcome toast clears on edit and Reset", async key => {
  setup(async () => ok(textFixtures[key])); render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByTestId("normalized-text");
  const notifications = screen.getByLabelText("Demo notifications");
  expect(notifications.querySelectorAll('[role="status"], [role="alert"]')).toHaveLength(1);
  expect(notifications).toHaveTextContent(key === "review" ? "blocked" : "passed; human approval still required");
  fireEvent.change(screen.getByLabelText("Fictional test text only"), { target: { value: "Edited fictional text" } });
  expect(notifications.querySelectorAll('[role="status"], [role="alert"]')).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByTestId("normalized-text");
  expect(notifications.querySelectorAll('[role="status"], [role="alert"]')).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(notifications.querySelectorAll('[role="status"], [role="alert"]')).toHaveLength(0);
});

test("a request failure produces one safe error toast, never a completion toast", async () => {
  setup(async () => ({ ok: false, status: 503 })); render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByRole("alert");
  const notifications = screen.getByLabelText("Demo notifications");
  expect(notifications).toBeVisible();
  expect(notifications.querySelectorAll('[role="alert"]')).toHaveLength(1);
  expect(notifications.querySelectorAll('[role="status"]')).toHaveLength(0);
  expect(notifications).not.toHaveTextContent("Live results received");
});

test.each(["sinhala", "english", "romanized-si", "code-mixed", "unknown", "uncertain"])("shows backend %s Language ID without input controls", async language => {
  const result = structuredClone(fixtures.results.english);
  Object.assign(result.records[0], { language_identification: {
    language, status: ["unknown", "uncertain"].includes(language) ? language : "provisional",
    uncertain: ["unknown", "uncertain"].includes(language),
    reason: "insufficient_or_ambiguous_latin_evidence", method: "c2-rule-language-v1"
  } });
  setup(async () => ok(result)); render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByText(language.replaceAll(/[-_:]/g, " "), { selector: "strong" });
  expect(document.querySelectorAll(".c2-step-complete")).toHaveLength(3);
  expect(screen.getAllByText("Pending")).toHaveLength(5);
  expect(screen.queryByLabelText("Manual language hint")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Demo anonymizer")).not.toBeInTheDocument();
});

test("overall loading never fabricates successful intermediate stages", async () => {
  let resolve!: (value: unknown) => void;
  setup(() => new Promise(done => { resolve = done; }));
  render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  expect(screen.getByText(/Overall processing — individual stage events are unavailable/)).toBeVisible();
  expect(screen.getAllByText("Pending")).toHaveLength(8);
  expect(document.querySelectorAll(".c2-step-complete")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  await act(async () => resolve(ok(fixtures.results.english)));
  expect(document.querySelectorAll(".c2-step-complete")).toHaveLength(0);
  expect(screen.getAllByText("Pending")).toHaveLength(8);
});

test("renders actual normalized text, tokens and offsets with five confirmed stages", async () => {
  setup(async () => ok(textFixtures.processed)); render(<C2Demo />); await ready();
  const input = screen.getByLabelText("Fictional test text only");
  fireEvent.change(input, { target: { value: textFixtures.processed.records[0].original_text } });
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  const normalized = await screen.findByTestId("normalized-text");
  const record = textFixtures.processed.records[0];
  expect(normalized.textContent).toBe(record.normalized_text);
  expect([...screen.getByRole("list", { name: "Actual tokens" }).children].map(node => node.textContent)).toEqual(record.tokens);
  expect(document.querySelectorAll(".c2-step-complete")).toHaveLength(5);
  expect(screen.getAllByText("Pending")).toHaveLength(3);
  fireEvent.click(screen.getByText("Normalization and token offsets", { selector: "summary" }));
  const table = screen.getByRole("table", { name: "Backend token offsets" });
  expect(table).toBeVisible();
  expect(table.querySelectorAll("tbody tr")).toHaveLength(record.tokens.length);
  for (const [index, row] of [...table.querySelectorAll("tbody tr")].entries()) {
    expect([...row.children].map(node => node.textContent)).toEqual([record.tokens[index], ...record.token_offsets[index].map(String)]);
  }
  expect(input).toHaveValue(record.original_text);
  expect(document.querySelector(".c2-roadmap")!.compareDocumentPosition(document.querySelector("#custom-text")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(screen.queryByRole("list", { name: "Actual tokens" })).not.toBeInTheDocument();
  expect(screen.getAllByText("Pending")).toHaveLength(8);
});

test.each(["empty", "review"] as const)("keeps actual %s privacy/release blocking with normalization completed", async key => {
  setup(async () => ok(textFixtures[key])); render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByTestId("normalized-text");
  expect(screen.getByText("Automated gate: Blocked")).toBeVisible();
  expect(screen.getByText(`Quality: ${textFixtures[key].records[0].quality_status}`)).toBeVisible();
  expect(screen.getAllByText("Pending")).toHaveLength(3);
  expect(document.querySelectorAll(key === "empty" ? ".c2-step-error" : ".c2-step-review").length).toBeGreaterThan(0);
  if (key === "empty") expect(screen.getByText("No tokens — empty normalized content.")).toBeVisible();
});

test("custom mode sends the bounded contract and renders returned output", async () => {
  const { scenario, ...execution } = fixtures.results.english;
  void scenario;
  const fetch = setup(async () => ok({ ...execution, language_hint: "english" }));
  render(<C2Demo />); await ready();
  const input = screen.getByLabelText("Fictional test text only");
  expect(input).toHaveAttribute("maxlength", "1000");
  fireEvent.change(input, { target: { value: fixtures.results.english.records[0].original_text } });
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByText(fixtures.results.english.records[0].anonymized_text);
  const calls = fetch.mock.calls as unknown as [string, RequestInit][];
  expect(JSON.parse(calls.find(([url]) => url.endsWith("/custom-runs"))![1].body as string)).toEqual({ text: fixtures.results.english.records[0].original_text, strategy: "gliner" });
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(input).toHaveValue("");
  expect(screen.queryByText(fixtures.results.english.records[0].anonymized_text)).not.toBeInTheDocument();
});

test("editing custom input invalidates a pending response", async () => {
  let resolve!: (value: unknown) => void;
  setup(() => new Promise(done => { resolve = done; }));
  render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  fireEvent.change(screen.getByLabelText("Fictional test text only"), { target: { value: "Changed fictional example" } });
  await act(async () => resolve(ok({ ...fixtures.results.english, language_hint: "unsure" })));
  expect(screen.queryByText(fixtures.results.english.records[0].anonymized_text)).not.toBeInTheDocument();
});
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data });
function setup(run: () => Promise<unknown> = async () => ok(fixtures.results.english)) {
  const fetch = vi.fn(async (url: string) => url.endsWith("/scenarios") ? ok(fixtures.catalogue) : run());
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
async function ready() { await screen.findByLabelText("Fictional test text only"); }

test("renders actual backend response and sends only text and the fixed strategy", async () => {
  const fetch = setup(); render(<C2Demo />); await ready();
  expect(screen.getByText("Anonymizer: GLiNER v4 (experimental)")).toBeVisible();
  expect(screen.queryByLabelText("Anonymization strategy")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Manual language hint")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Demo anonymizer")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByText(fixtures.results.english.records[0].original_text);
  expect(screen.getByText(fixtures.results.english.records[0].anonymized_text)).toBeVisible();
  expect(screen.getByText("Quality: PASS")).toBeVisible();
  expect(screen.getByText("Automated gate: Passed")).toBeVisible();
  expect(screen.getByText("Human release approval required.")).toBeVisible();
  expect(screen.getAllByText("Pending")).toHaveLength(6);
  const options = fetch.mock.calls.find(([url]) => url.endsWith("/custom-runs"));
  expect(options).toBeDefined();
  const calls = (fetch.mock.calls as unknown as [string, RequestInit][]);
  expect(JSON.parse(calls.find(([url]) => url.endsWith("/custom-runs"))![1].body as string)).toEqual({ text: "", strategy: "gliner" });
});

test("GLiNER failure is safe and never falls back, including after Reset", async () => {
  const fetch = setup(async () => ({ ok: false, status: 503, json: async () => ({ detail: "PRIVATE-SENTINEL" }) }));
  render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByRole("alert");
  expect(screen.queryByText(/PRIVATE-SENTINEL/)).not.toBeInTheDocument();
  expect(screen.getByText("Actual pipeline output will appear here.")).toBeVisible();
  const calls = fetch.mock.calls as unknown as [string, RequestInit][];
  expect(calls.filter(([url]) => url.endsWith("/custom-runs"))).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByRole("alert");
  const runs = calls.filter(([url]) => url.endsWith("/custom-runs"));
  expect(runs).toHaveLength(2);
  expect(runs.every(([, options]) => JSON.parse(options.body as string).strategy === "gliner")).toBe(true);
});

test.each(["short", "empty", "empty-batch"] as const)("shows actual blocked %s result", async scenario => {
  setup(async () => ok(fixtures.results[scenario])); render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByText("Automated gate: Blocked");
  if (scenario === "empty-batch") expect(screen.getByText("Empty batch", { selector: "strong" })).toBeVisible();
  else expect(screen.getByText(`Quality: ${scenario === "short" ? "REVIEW" : "REJECT"}`)).toBeVisible();
});

test.each([401, 403, 404, 422, 503])("catalogue safely handles %i", async status => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status, json: async () => ({ detail: "SECRET-SENTINEL" }) })));
  render(<C2Demo />); await screen.findByRole("alert");
  expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/");
  expect(screen.queryByText(/SECRET-SENTINEL/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Run demonstration" })).not.toBeInTheDocument();
});

test.each([401, 403, 404, 422, 503])("execution safely handles %i", async status => {
  setup(async () => ({ ok: false, status })); render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByRole("alert");
  expect(screen.getByText("Actual pipeline output will appear here.")).toBeVisible();
  if ([401, 403].includes(status)) expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test.each(["reset", "input", "logout", "unmount"])("invalidates late result after %s", async action => {
  let resolve: (value: unknown) => void = () => {};
  const pending = new Promise(value => { resolve = value; });
  const fetch = setup(() => pending); const view = render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  expect(screen.getByRole("button", { name: "Running demonstration…" })).toBeDisabled();
  if (action === "input") fireEvent.change(screen.getByLabelText("Fictional test text only"), { target: { value: "New fictional text" } });
  if (action === "reset") fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  if (action === "logout") fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  if (action === "unmount") view.unmount();
  await act(async () => { resolve(ok(fixtures.results.english)); await pending; });
  expect(screen.queryByText(fixtures.results.english.records[0].original_text)).not.toBeInTheDocument();
  const calls = fetch.mock.calls as unknown as [string, RequestInit][];
  expect(calls.filter(([url]) => url.endsWith("/custom-runs"))).toHaveLength(1);
  expect(calls.find(([url]) => url.endsWith("/custom-runs"))![1].signal?.aborted).toBe(true);
});

test("older execution cannot overwrite a newer selection's response", async () => {
  let resolveOld: (value: unknown) => void = () => {};
  const old = new Promise(value => { resolveOld = value; });
  let count = 0;
  setup(async () => ++count === 1 ? old : ok(fixtures.results.short));
  render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  fireEvent.change(screen.getByLabelText("Fictional test text only"), { target: { value: "New fictional text" } });
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByText("Quality: REVIEW");
  await act(async () => { resolveOld(ok(fixtures.results.english)); await old; });
  expect(screen.getByText("Quality: REVIEW")).toBeVisible();
  expect(screen.queryByText(fixtures.results.english.records[0].original_text)).not.toBeInTheDocument();
});

test("renders punctuation, emoji and whitespace without browser preprocessing", async () => {
  const result = structuredClone(fixtures.results.english);
  result.records[0].original_text = "SYNTHETIC: හොඳයි! 🙂\n  Practice?";
  result.records[0].anonymized_text = "SYNTHETIC: හොඳයි! 🙂\n  [EMAIL]?";
  setup(async () => ok(result)); render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByText("Quality: PASS");
  const texts = document.querySelectorAll(".c2-text");
  expect(texts[0].textContent).toBe(result.records[0].original_text);
  expect(texts[1].textContent).toBe(result.records[0].anonymized_text);
});

test("selection changes clear completed results and preserve Sinhala punctuation", async () => {
  setup(async () => ok(fixtures.results.sinhala)); render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByText("Quality: PASS");
  expect(screen.getAllByText(fixtures.results.sinhala.records[0].original_text)).toHaveLength(2);
  fireEvent.change(screen.getByLabelText("Fictional test text only"), { target: { value: "Changed text" } });
  expect(screen.getByText("Actual pipeline output will appear here.")).toBeVisible();
});

test("keeps both result sections visible before a run and all eight stages visible", async () => {
  setup(); render(<C2Demo />); await ready();
  expect(screen.getByRole("heading", { name: "Anonymization results" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Quality and release" })).toBeVisible();
  expect(screen.getByText("Automated gate: Not run")).toBeVisible();
  expect(document.querySelectorAll(".c2-roadmap li")).toHaveLength(8);
  expect(screen.getByText("Synthetic demonstration — not participant data")).toBeVisible();
});

function signedOut(loginResult: () => Promise<unknown>) {
  let authorized = false;
  const fetch = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/auth/login")) {
      const result = await loginResult();
      authorized = true;
      return result;
    }
    if (url.endsWith("/auth/logout")) return { ok: true, status: 204 };
    if (url.endsWith("/scenarios")) return authorized ? ok(fixtures.catalogue) : { ok: false, status: 401 };
    if (url.endsWith("/custom-runs")) return ok(fixtures.results.short);
    void options;
    return { ok: false, status: 401 };
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
function fillLogin() {
  fireEvent.change(screen.getByLabelText("Development username"), { target: { value: "synthetic-reviewer" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "disposable-test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

test("signs in on C2, clears password immediately and loads catalogue without workflow calls", async () => {
  let resolve: (value: unknown) => void = () => {};
  const pending = new Promise(value => { resolve = value; });
  const fetch = signedOut(() => pending);
  render(<C2Demo />); await screen.findByRole("button", { name: "Sign in" });
  fillLogin();
  expect(screen.getByLabelText("Password")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  fireEvent.submit(screen.getByLabelText("Password").closest("form")!);
  expect(fetch.mock.calls.filter(([url]) => url.endsWith("/auth/login"))).toHaveLength(1);
  await act(async () => { resolve(ok({ role: "COUNSELLOR" })); await pending; });
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByText("Quality: REVIEW");
  expect(fetch.mock.calls.every(([url]) => /\/auth\/(login|refresh)$|\/c2-demo\/(scenarios|custom-runs)$/.test(url))).toBe(true);
  const loginCall = fetch.mock.calls.find(([url]) => url.endsWith("/auth/login"));
  expect(JSON.parse(loginCall![1]!.body as string)).toEqual({ username: "synthetic-reviewer", password: "disposable-test-password" });
  expect(fetch.mock.calls.filter(([url]) => url.endsWith("/auth/login"))).toHaveLength(1);
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});

test("failed sign-in keeps password cleared and displays only a safe error", async () => {
  signedOut(async () => ({ ok: false, status: 401, json: async () => ({ detail: "SECRET-SENTINEL" }) }));
  render(<C2Demo />); await screen.findByRole("button", { name: "Sign in" }); fillLogin();
  await screen.findByText(/sign-in was unsuccessful/);
  expect(screen.getByLabelText("Password")).toHaveValue("");
  expect(screen.queryByText(/SECRET-SENTINEL/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Manual language hint")).not.toBeInTheDocument();
});

test("rejects a non-counsellor login and signs that session out", async () => {
  const fetch = signedOut(async () => ok({ role: "ADMIN" }));
  render(<C2Demo />); await screen.findByRole("button", { name: "Sign in" }); fillLogin();
  await screen.findByText("This demonstration requires an authorized development counsellor session.");
  expect(fetch.mock.calls.some(([url]) => url.endsWith("/auth/logout"))).toBe(true);
  expect(screen.queryByLabelText("Manual language hint")).not.toBeInTheDocument();
});

test("expired session clears earlier results and can sign in again on C2", async () => {
  let runs = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/scenarios")) return ok(fixtures.catalogue);
    if (url.endsWith("/auth/login")) return ok({ role: "COUNSELLOR" });
    if (url.endsWith("/custom-runs")) return ++runs === 1 ? ok(fixtures.results.english) : { ok: false, status: 401 };
    return { ok: false, status: 401 };
  }));
  render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByText(fixtures.results.english.records[0].original_text);
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByRole("button", { name: "Sign in" });
  expect(screen.queryByText(fixtures.results.english.records[0].original_text)).not.toBeInTheDocument();
  expect(screen.getByText("Actual pipeline output will appear here.")).toBeVisible();
  fillLogin(); await ready();
  expect(screen.getByRole("button", { name: "Run demonstration" })).toBeEnabled();
});

test("fixed GLiNER default sends the backend and shows executed configuration", async () => {
  const response = { ...fixtures.results.english, strategy: "gliner", anonymization_configuration: "gliner-name-labels-v4-context-demo-v1", release_ready: false, blocking_reasons: ["experimental_anonymizer_not_release_validated"] };
  const fetch = setup(async () => ok(response)); render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByText("gliner-name-labels-v4-context-demo-v1");
  fireEvent.click(screen.getByText("Executed configuration", { selector: "summary" }));
  expect(screen.getByText("gliner-name-labels-v4-context-demo-v1")).toBeVisible();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  const call = fetch.mock.calls.find(([url]) => url.endsWith("/custom-runs"));
  expect(JSON.parse(call![1]!.body as string).strategy).toBe("gliner");
  expect(screen.getByText("Automated gate: Blocked")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Fictional test text only"), { target: { value: "Changed fictional text" } });
  expect(screen.queryByText("gliner-name-labels-v4-context-demo-v1")).not.toBeInTheDocument();
});

test("GLiNER unavailable never silently submits a baseline request", async () => {
  const fetch = setup(async () => ({ ok: false, status: 503 })); render(<C2Demo />); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Run demonstration" }));
  await screen.findByRole("alert");
  const calls = fetch.mock.calls.filter(([url]) => url.endsWith("/custom-runs"));
  expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0][1]!.body as string).strategy).toBe("gliner");
  expect(screen.getByText("Automated gate: Not run")).toBeVisible();
});
