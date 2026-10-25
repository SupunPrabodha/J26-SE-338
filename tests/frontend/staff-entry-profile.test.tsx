import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { StaffSignIn } from "@j26/common/ui";
import AccountProfile from "../../apps/counsellor-dashboard/components/account-profile";
import ResearchDirectory from "../../apps/counsellor-dashboard/app/research/page";

afterEach(() => vi.unstubAllGlobals());
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

test("sign-in errors stay with the form and password visibility never submits", () => {
  const submit = vi.fn();
  const view = render(<StaffSignIn kind="research" busy={false} onSubmit={submit} error="Use the sign-in for your authorized workspace." />);
  expect(screen.getByRole("alert")).toHaveTextContent("authorized workspace");
  expect(document.querySelector("form")).toHaveAttribute("aria-describedby", "staff-signin-error");
  const password = screen.getByLabelText("Password");
  expect(password).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(password).toHaveAttribute("type", "text");
  fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
  expect(password).toHaveAttribute("type", "password");
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  view.rerender(<StaffSignIn kind="research" busy onSubmit={submit} />);
  expect(password).toBeDisabled();
  expect(screen.getByLabelText("Development username")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Show password" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
});

test("expired research profile offers the correct sign-in without protected content", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error_code: "AUTH_INVALID" }), { status: 401 })));
  render(<AccountProfile workspace="research" />);
  await screen.findByRole("heading", { name: "Sign in to view your account" });
  expect(screen.getByRole("link", { name: "Open workspace sign-in" })).toHaveAttribute("href", "/research");
  expect(screen.getByRole("button", { name: "Check account access" })).toBeEnabled();
  expect(screen.queryByText("Account reference")).not.toBeInTheDocument();
  expect(document.querySelector('a[href^="/admin"]')).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("network profile failure offers retry without falsely reporting session expiry", async () => {
  const identifier = crypto.randomUUID(), instant = new Date().toISOString();
  let connected = false;
  vi.stubGlobal("fetch", vi.fn(async () => {
    if (!connected) throw new TypeError("Synthetic offline transport");
    return ok({ account_id: identifier, role: "RESEARCHER", enabled: true, created_at: instant, session_expires_at: instant, remember_me: false });
  }));
  render(<AccountProfile workspace="research" />);
  await screen.findByRole("heading", { name: "Account details are unavailable" });
  expect(screen.getByRole("alert")).not.toHaveTextContent(/session has ended|consent is no longer active/i);
  connected = true;
  fireEvent.click(screen.getByRole("button", { name: "Check account access" }));
  await screen.findByText(identifier);
  expect(screen.getByRole("heading", { name: "Current session" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Return to workspace" })).toHaveAttribute("href", "/research");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("directory cards remain metadata-only and preserve protected provider details", async () => {
  const instant = new Date().toISOString();
  const items = [
    { component: "C2", function: "PREPROCESSING" },
    { component: "C3", function: "INFERENCE" },
    { component: "C4", function: "EXPLANATION" },
  ].map(item => ({ ...item, provider: "MOCK_SYNTHETIC_DEVELOPMENT_ONLY", route_status: "INTERNAL_SERVICE_ONLY" }));
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/me") ? ok({ role: "RESEARCHER" }) : ok({ items, observed_at: instant })));
  render(<ResearchDirectory />);
  await screen.findByRole("heading", { name: "Service connections" });
  expect(screen.getAllByText("Mock provider")).toHaveLength(3);
  expect(screen.getAllByText("Internal API only")).toHaveLength(3);
  expect(document.querySelector('a[href*="internal"]')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Provider metadata C3" }));
  await waitFor(() => expect(screen.getByRole("dialog")).toHaveAccessibleName("Provider metadata: C3"));
  expect(screen.getByRole("dialog")).toHaveTextContent("No new research implementation");
  expect(document.querySelector('a[href^="/admin"]')).not.toBeInTheDocument();
  expect(document.querySelectorAll('.staff-sidebar a[href="/research"]')).toHaveLength(1);
});
