import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ErrorMessage, SafetyNotice } from "@j26/common/ui";
import StudentPortal from "../../apps/student-portal/app/page";
import Dashboard from "../../apps/counsellor-dashboard/app/page";

afterEach(() => vi.unstubAllGlobals());

test("visible non-diagnostic and synthetic-only notice", () => {
  render(<SafetyNotice />);
  expect(screen.getByText(/MOCK · SYNTHETIC/)).toBeVisible();
  expect(screen.getByText(/does not provide clinical diagnosis/)).toBeVisible();
  expect(screen.getByText(/Do not enter real student information/)).toBeVisible();
});

test("errors are accessible", () => {
  render(<ErrorMessage message="Safe generic failure" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Safe generic failure");
});

test("student cannot submit before active consent", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ fixtures: { english: "SYNTHETIC: fixture" } }) }));
  render(<StudentPortal />);
  await screen.findByRole("option", { name: "english" });
  expect(screen.getByRole("button", { name: "Submit synthetic fixture" })).toBeDisabled();
  expect(screen.getByLabelText(/Synthetic reflection/)).toHaveAttribute("readonly");
});

test("protected dashboard shows login when unauthenticated", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
  render(<Dashboard />);
  expect(await screen.findByRole("heading", { name: "Development sign-in" })).toBeVisible();
  expect(screen.queryByText("Refresh assigned tasks")).not.toBeInTheDocument();
});

test("wrong role is denied and signed out", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
    if (url.endsWith("/me")) return { ok: false, status: 401 };
    if (url.endsWith("/logout")) return { ok: true, status: 204 };
    return { ok: true, status: 200, json: async () => ({ role: "ADMIN" }) };
  }));
  render(<Dashboard />);
  fireEvent.change(screen.getByLabelText("Development username"), { target: { value: "synthetic" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: crypto.randomUUID() } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("requires an authorized counsellor"));
  expect(screen.queryByText("Refresh assigned tasks")).not.toBeInTheDocument();
});
