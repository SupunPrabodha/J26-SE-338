import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AccountMenu, SafetyNotice, StaffFrame } from "@j26/common/ui";
import Dashboard from "../../apps/counsellor-dashboard/app/page";
import AdminConsole from "../../apps/counsellor-dashboard/components/admin-console";

afterEach(() => vi.unstubAllGlobals());
const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

test("compact prototype disclosure retains all boundaries and restores trigger focus", () => {
  render(<SafetyNotice />);
  const trigger = screen.getByRole("button", { name: "About this prototype" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  trigger.focus(); fireEvent.click(trigger);
  expect(screen.getByRole("dialog")).toHaveAccessibleName("About this prototype");
  expect(screen.getByRole("dialog")).toHaveTextContent(/clinical diagnosis.*treatment advice.*emergency intervention/);
  expect(screen.getByRole("dialog")).toHaveTextContent(/does not replace professional counselling/);
  expect(screen.getByRole("dialog")).toHaveTextContent(/authorized human interpretation/i);
  expect(screen.getByRole("dialog")).toHaveTextContent(/fictional fixtures only/i);
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test("account dropdown supports keyboard dismissal and restores focus", () => {
  const logout = vi.fn(); render(<AccountMenu role="COUNSELLOR" onSignOut={logout} />);
  const trigger = screen.getByRole("button", { name: "Counsellor account" });
  trigger.focus(); fireEvent.keyDown(trigger, { key: "ArrowDown" });
  expect(screen.getByRole("menuitem", { name: "Account profile" })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Account profile" }), { key: "Escape" });
  expect(screen.queryByRole("menu")).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
  expect(logout).not.toHaveBeenCalled();
  fireEvent.click(trigger); fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
  expect(logout).toHaveBeenCalledOnce();
});

test("outside pointer dismissal does not invoke sign out", () => {
  const logout = vi.fn(); render(<><AccountMenu role="ADMIN" onSignOut={logout} /><button>Other action</button></>);
  fireEvent.click(screen.getByRole("button", { name: "Admin account" }));
  fireEvent.pointerDown(screen.getByText("Other action"));
  expect(screen.queryByRole("menu")).not.toBeInTheDocument(); expect(logout).not.toHaveBeenCalled();
});

test.each(["COUNSELLOR", "RESEARCHER"])("%s navigation omits administrative routes", role => {
  const view = render(<StaffFrame area={role === "COUNSELLOR" ? "counsellor" : "research"} current="research" authorized role={role} onSignOut={vi.fn()}><main /></StaffFrame>);
  expect(document.querySelector('a[href^="/admin"]')).not.toBeInTheDocument();
  if (role === "RESEARCHER") expect(screen.queryByText("Case workspace")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: `${role === "COUNSELLOR" ? "Counsellor" : "Researcher"} account` }));
  view.rerender(<StaffFrame area="research" current="research" authorized={false}><main /></StaffFrame>);
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/workspace navigation$/)).not.toBeInTheDocument();
});

test("counsellor header logout uses existing API and clears the protected queue", async () => {
  const reference = crypto.randomUUID();
  const fetcher = vi.fn(async (url: string) => url.endsWith("/logout") ? new Response(null, { status: 204 }) : url.endsWith("/me") ? ok({ role: "COUNSELLOR" }) : ok({ items: [{ task_id: crypto.randomUUID(), case: { case_id: reference, processing_status: "COMPLETED" } }], observed_at: new Date().toISOString() }));
  vi.stubGlobal("fetch", fetcher); render(<Dashboard />);
  await screen.findByRole("button", { name: `Open case ${reference}` });
  fireEvent.click(screen.getByRole("button", { name: "Counsellor account" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
  await screen.findByText("Development sign-in");
  expect(screen.queryByRole("button", { name: `Open case ${reference}` })).not.toBeInTheDocument();
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url.endsWith("/auth/logout"))).toBe(true));
});

test("abbreviated administrative case reference retains full details in the authorized dialog", async () => {
  const reference = crypto.randomUUID();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/me") ? ok({ role: "ADMIN" }) : url.endsWith("/overview") ? ok({}) : ok({ items: [{ case_id: reference, processing_status: "WITHDRAWN", assignment_state: "NOT_ELIGIBLE", counsellors: [], assignment_count: 0, created_at: new Date().toISOString() }] })));
  render(<AdminConsole section="retention" />);
  fireEvent.click(await screen.findByRole("button", { name: `Case metadata ${reference.slice(0,8)}` }));
  expect(screen.getByRole("dialog")).toHaveTextContent(reference);
  expect(screen.getByRole("dialog")).toHaveTextContent("Withdrawn");
  expect(document.querySelector('main .session-strip')).not.toBeInTheDocument();
});
