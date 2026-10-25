import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import ResearchDirectory from "../../apps/counsellor-dashboard/app/research/page";
import Dashboard from "../../apps/counsellor-dashboard/components/counsellor-workspace";
import AdminConsole from "../../apps/counsellor-dashboard/components/admin-console";
import AccountProfile from "../../apps/counsellor-dashboard/components/account-profile";
import { AccountMenu } from "@j26/common/ui";
import { checklist, groupImplementation, groupSummaries } from "../../apps/student-portal/components/checklist-rules";

afterEach(() => vi.unstubAllGlobals());
const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

test("implementation, approval, readiness and recorded evidence remain independent", () => {
  const fresh = checklist(null, false), stale = checklist(null, true);
  expect(fresh.map(row => row.implementation)).toEqual(stale.map(row => row.implementation));
  const get = (id: string) => fresh.find(row => row.id === id)!;
  expect(get("FR03.b").implementation).toBe("Implemented");
  expect(get("FR03.b").result).toBe("Recorded test evidence");
  expect(get("FR03.b").readiness).toContain("share a database owner");
  expect(get("FR01.b").approval).toContain("approval pending");
  expect(get("NFR02.b").implementation).toBe("Missing");
  expect(get("NFR02.c").implementation).toBe("Unverified");
  expect(get("NFR05").readiness).toContain("awaits joint integration");
  expect(get("NFR04").implementation).toBe("Implemented");
  expect(get("NFR04").evaluation).toContain("unmeasured");
  expect(groupImplementation([get("NFR02.a"), get("NFR02.b"), get("NFR02.c")])).toBe("Mixed");
  expect(groupSummaries.consent).toContain("Notice approval pending");
  expect(groupSummaries.routing).toContain("integration incomplete");
  expect(groupSummaries.audit).toContain("coverage unmeasured");
});

test.each(["research", "admin", "counsellor"] as const)("%s sign-in sends checked and unchecked Remember me", async kind => {
  let loggedIn = false;
  const role = kind === "research" ? "RESEARCHER" : kind === "admin" ? "ADMIN" : "COUNSELLOR";
  const fetcher = vi.fn(async (url: string, ...args: [RequestInit?]) => {
    void args;
    if (url.endsWith("/login")) { loggedIn = true; return ok({ role }); }
    if (url.endsWith("/me") || url.endsWith("/refresh")) return loggedIn ? ok({ role }) : new Response(JSON.stringify({ error_code: "AUTH_REQUIRED" }), { status: 401 });
    return ok({ items: [], observed_at: new Date().toISOString() });
  });
  vi.stubGlobal("fetch", fetcher);
  const page = kind === "research" ? <ResearchDirectory /> : kind === "admin" ? <AdminConsole section="staff" /> : <Dashboard />;
  const view = render(page);
  const checkbox = await screen.findByRole("checkbox", { name: "Remember me on this device" });
  expect(checkbox).not.toBeChecked();
  for (const checked of [false, true]) {
    if (checked) { view.unmount(); loggedIn = false; render(page); await screen.findByRole("checkbox"); fireEvent.click(screen.getByRole("checkbox")); }
    fireEvent.change(screen.getByLabelText("Development username"), { target: { value: "synthetic" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-test-input" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      const request = fetcher.mock.calls.filter(([url]) => url.endsWith("/login")).at(-1)!;
      expect(JSON.parse(String(request[1]?.body)).remember_me).toBe(checked);
    });
    await screen.findByRole("button", { name: `${role === "RESEARCHER" ? "Researcher" : role === "ADMIN" ? "Admin" : "Counsellor"} account` });
  }
});

test("account menu supports profile, arrow navigation and Escape without logout", () => {
  const logout = vi.fn(); render(<AccountMenu role="RESEARCHER" workspace="research" onSignOut={logout} />);
  fireEvent.click(screen.getByRole("button", { name: "Researcher account" }));
  const profile = screen.getByRole("menuitem", { name: "Account profile" });
  expect(profile).toHaveFocus(); expect(profile).toHaveAttribute("href", "/account?workspace=research");
  fireEvent.keyDown(profile, { key: "ArrowDown" });
  expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Sign out" }), { key: "Escape" });
  expect(screen.getByRole("button", { name: "Researcher account" })).toHaveFocus();
  expect(logout).not.toHaveBeenCalled();
});

test("profile clears during revalidation and on logout, with researcher-only navigation", async () => {
  const identifier = crypto.randomUUID(), instant = new Date().toISOString(); let defer = false;
  let complete: (response: Response) => void = () => {};
  const profile = { account_id: identifier, role: "RESEARCHER", enabled: true, created_at: instant, session_expires_at: instant, remember_me: true };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/logout") ? new Response(null, { status: 204 }) : defer ? new Promise<Response>(resolve => { complete = resolve; }) : ok(profile)));
  render(<AccountProfile workspace="research" />); await screen.findByText(identifier);
  expect(document.querySelector('a[href^="/admin"]')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Researcher account" }));
  // Revalidation hides protected values until its response has been checked.
  defer = true; fireEvent(window, new Event("focus"));
  await act(async () => {});
  // The profile has already been cleared while this deferred read is pending.
  expect(screen.queryByText(identifier)).not.toBeInTheDocument();
  await act(async () => complete(ok(profile)));
  await screen.findByText(identifier);
  defer = false;
  fireEvent.click(screen.getByRole("button", { name: "Researcher account" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
  await screen.findByText("No current protected account information. Sign in through your workspace.");
  fireEvent(window, new Event("focus"));
  expect(screen.queryByText(identifier)).not.toBeInTheDocument();
});
