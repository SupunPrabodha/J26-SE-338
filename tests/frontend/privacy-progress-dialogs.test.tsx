import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import StudentPortal from "../../apps/student-portal/app/page";
import AdminConsole from "../../apps/counsellor-dashboard/components/admin-console";
import { AppDialog, StaffFrame } from "@j26/common/ui";
import { checklist, implementations, privacyGroups, secondaryIds } from "../../apps/student-portal/components/checklist-rules";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
const consent = { consent_id: crypto.randomUUID(), consent_status: "ACTIVE", expires_at: new Date(Date.now() + 3600000).toISOString() };
const created = { case_id: crypto.randomUUID(), processing_status: "RECEIVED" };

async function accept() {
  await screen.findByRole("option", { name: "english" });
  fireEvent.change(screen.getByLabelText("Consent choice"), { target: { value: "ACTIVE" } });
  fireEvent.click(screen.getByText("Record consent decision"));
  await screen.findByText("Consent recorded—accepted. You may submit or withdraw.");
}
function fixtureFetch(other: (url: string, options?: RequestInit) => Promise<Response>) {
  return vi.fn(async (url: string, options?: RequestInit) => url.endsWith("/fixtures") ? ok({ fixtures: { english: "SYNTHETIC: fixture" } }) : url.endsWith("/auth/me") ? ok({ role: "STUDENT" }) : url.endsWith("/consents") ? ok(consent) : other(url, options));
}

test("implementation mapping is explicit, exhaustive and independent of absent run events", () => {
  const rows = checklist(null, false);
  expect(rows.map(row => row.id).sort()).toEqual(Object.keys(implementations).sort());
  const grouped = [...privacyGroups.flatMap(group => [...group.ids]), ...secondaryIds];
  expect(new Set(grouped).size).toBe(grouped.length);
  expect([...grouped].sort()).toEqual(rows.map(row => row.id).sort());
  for (const id of ["FR12", "FR09.d", "FR02.b", "FR08.b"]) {
    const row = rows.find(value => value.id === id)!;
    expect(row.implementation).toBe("Implemented");
    expect(row.result).toBe(row.source === "Recorded test evidence" ? "Recorded test evidence" : "Recorded configuration evidence");
  }
  expect(rows.find(row => row.id === "FR01.b")?.implementation).toBe("Not applicable");
  expect(rows.find(row => row.id === "NFR02.b")?.implementation).toBe("Missing");
  expect(rows.find(row => row.id === "NFR08")?.implementation).toBe("Not applicable");
  const compatibility = rows.find(row => row.id === "NFR05")!;
  expect(compatibility.implementation).toBe("Implemented");
  expect(compatibility.source).toBe("Recorded test evidence");
  expect(compatibility.detail).toContain("development mocks");
  expect(compatibility.readiness).toContain("awaits joint integration");
  expect(rows.find(row => row.id === "FR07")?.result).toBe("Not exercised");
});

test("pending submission is indeterminate, announced and duplicate-click safe", async () => {
  let complete: (value: Response) => void = () => {};
  const pending = new Promise<Response>(resolve => { complete = resolve; });
  const fetcher = fixtureFetch(async url => url.endsWith("/submissions") ? pending : ok({ consent, case: created }));
  vi.stubGlobal("fetch", fetcher); render(<StudentPortal />); await accept();
  const button = screen.getByText("Submit synthetic fixture");
  fireEvent.click(button); fireEvent.click(button);
  expect(screen.getByRole("progressbar")).toHaveAccessibleName("Submitting text…");
  expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  expect(screen.getByRole("region", { name: "A fictional reflection" })).toHaveAttribute("aria-busy", "true");
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/submissions"))).toHaveLength(1);
  await act(async () => complete(ok(created)));
  await screen.findByText(/Submission accepted\. Processing is separate/);
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});

test("accepted submission stays accepted when the following lifecycle fetch fails", async () => {
  vi.stubGlobal("fetch", fixtureFetch(async url => url.endsWith("/submissions") ? ok(created) : new Response(JSON.stringify({ error_code: "DEPENDENCY_UNAVAILABLE" }), { status: 503 })));
  render(<StudentPortal />); await accept(); fireEvent.click(screen.getByText("Submit synthetic fixture"));
  await screen.findByText("Submission accepted; processing status temporarily unavailable.");
  expect(screen.getByText("Submit synthetic fixture")).toBeDisabled();
  expect(screen.queryByText(/Submission was not accepted/)).not.toBeInTheDocument();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});

test("uncertain submission preserves its payload/key and retries safely", async () => {
  let first = true;
  const fetcher = fixtureFetch(async url => {
    if (url.endsWith("/submissions")) { if (first) { first = false; throw new TypeError("private network detail"); } return ok(created); }
    return ok({ consent, case: created });
  });
  vi.stubGlobal("fetch", fetcher); render(<StudentPortal />); await accept();
  fireEvent.click(screen.getByText("Submit synthetic fixture"));
  await screen.findByText(/Submission outcome is unconfirmed/);
  expect(screen.getByLabelText("Fixture language")).toBeDisabled();
  fireEvent.click(screen.getByText("Retry unconfirmed submission"));
  await screen.findByText(/Submission accepted\. Processing is separate/);
  const calls = fetcher.mock.calls.filter(([url]) => url.endsWith("/submissions"));
  expect(calls).toHaveLength(2);
  expect(calls[0][1]?.body).toBe(calls[1][1]?.body);
  expect(screen.queryByText("private network detail")).not.toBeInTheDocument();
});

test("explicit validation failure is rejected rather than unconfirmed or accepted", async () => {
  vi.stubGlobal("fetch", fixtureFetch(async () => new Response(JSON.stringify({ error_code: "CONTRACT_INVALID" }), { status: 422 })));
  render(<StudentPortal />); await accept(); fireEvent.click(screen.getByText("Submit synthetic fixture"));
  await screen.findByText(/Submission was not accepted/);
  expect(screen.queryByText(/Submission outcome is unconfirmed/)).not.toBeInTheDocument();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});

function Editor() {
  const [open, setOpen] = useState(false), [value, setValue] = useState("");
  return <><button onClick={() => setOpen(true)}>Open editor</button>{open && <AppDialog title="Synthetic editor" dirty={!!value} onClose={() => setOpen(false)}><label>Permitted setting<input value={value} onChange={event => setValue(event.target.value)} /></label></AppDialog>}</>;
}
test("dirty dialog protects edits in one modal and restores focus after discard", () => {
  render(<Editor />); const trigger = screen.getByText("Open editor"); trigger.focus(); fireEvent.click(trigger);
  expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus();
  fireEvent.change(screen.getByLabelText("Permitted setting"), { target: { value: "synthetic" } });
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByText("Keep editing")).toHaveFocus();
  fireEvent.click(screen.getByText("Keep editing"));
  expect(screen.getByLabelText("Permitted setting")).toHaveValue("synthetic");
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  fireEvent.click(screen.getByText("Discard changes"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
});

test("access denial closes a dirty staff editor without a discard prompt", async () => {
  let denied = false;
  const person = { account_id: crypto.randomUUID(), role: "COUNSELLOR", enabled: true, usable: true, updated_at: new Date().toISOString() };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (denied) return new Response(JSON.stringify({ error_code: "FORBIDDEN" }), { status: 403 });
    return ok(url.endsWith("/me") ? { role: "ADMIN" } : url.includes("/staff?") ? { items: [person] } : {});
  }));
  render(<AdminConsole section="staff" />);
  fireEvent.click(await screen.findByText(`Manage staff ${person.account_id.slice(0,8)}`));
  fireEvent.change(screen.getByLabelText("Account access"), { target: { value: "false" } });
  await act(async () => {});
  denied = true;
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.queryByText("Discard unsaved changes?")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Staff role")).not.toBeInTheDocument();
});

test("drawer is accessible, restores focus and does not survive loss of authorization", async () => {
  const view = render(<StaffFrame area="admin" current="staff" authorized><main><h1>Staff</h1></main></StaffFrame>);
  const trigger = screen.getByRole("button", { name: "Open workspace navigation" });
  trigger.focus(); fireEvent.click(trigger);
  expect(screen.getByRole("dialog")).toHaveAccessibleName("Workspace navigation");
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  view.rerender(<StaffFrame area="admin" current="staff" authorized={false}><main /></StaffFrame>);
  await act(async () => {});
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  view.rerender(<StaffFrame area="admin" current="staff" authorized><main /></StaffFrame>);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("entering the mobile breakpoint does not close a just-opened drawer", () => {
  let changed: (event: { matches: boolean }) => void = () => {};
  vi.stubGlobal("matchMedia", () => ({ addEventListener: (_name: string, callback: typeof changed) => { changed = callback; }, removeEventListener: vi.fn() }));
  render(<StaffFrame area="admin" current="staff" authorized><main /></StaffFrame>);
  fireEvent.click(screen.getByRole("button", { name: "Open workspace navigation" }));
  act(() => changed({ matches: false }));
  expect(screen.getByRole("dialog")).toBeVisible();
  act(() => changed({ matches: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
