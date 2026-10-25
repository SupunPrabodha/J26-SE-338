import React, { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { StaffFrame, StaffWorkspace, StudentWorkspace } from "@j26/common/ui";

const route = vi.hoisted(() => ({ pathname: "/admin/overview" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

test("the layout keeps header and sidebar nodes through same-realm page authorization", () => {
  const page = (key: string, checking: boolean, authorized: boolean) => <StrictMode><StaffWorkspace><StaffFrame key={key} area="admin" current={key} authorized={authorized} checking={checking} onSignOut={vi.fn()}><main>{key} content</main></StaffFrame></StaffWorkspace></StrictMode>;
  const view = render(page("overview", false, true));
  const header = document.querySelector(".staff-topbar"), sidebar = document.querySelector(".staff-sidebar");
  view.rerender(page("staff", true, false));
  expect(document.querySelector(".staff-topbar")).toBe(header);
  expect(document.querySelector(".staff-sidebar")).toBe(sidebar);
  expect(screen.getByRole("button", { name: "Admin account" })).toBeDisabled();
  expect(screen.queryByText("overview content")).not.toBeInTheDocument();
  expect(document.querySelector('.staff-sidebar a[href="/admin/staff"]')).toHaveAttribute("aria-current", "page");
  view.rerender(page("staff", false, true));
  expect(document.querySelector(".staff-sidebar")).toBe(sidebar);
  expect(screen.getByRole("button", { name: "Admin account" })).toBeEnabled();
  view.rerender(page("staff", false, false));
  expect(document.querySelector(".staff-topbar")).toBe(header);
  expect(document.querySelector(".staff-sidebar")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Admin account" })).not.toBeInTheDocument();
});

test("a realm change cannot inherit the previous admin navigation authorization", () => {
  const view = render(<StaffWorkspace><StaffFrame area="admin" current="overview" authorized role="ADMIN"><main>Admin page</main></StaffFrame></StaffWorkspace>);
  const header = document.querySelector(".staff-topbar");
  view.rerender(<StaffWorkspace><StaffFrame key="research" area="research" current="research" authorized={false} checking><main>Checking researcher</main></StaffFrame></StaffWorkspace>);
  expect(document.querySelector(".staff-topbar")).toBe(header);
  expect(document.querySelector(".staff-sidebar")).not.toBeInTheDocument();
  expect(document.querySelector('a[href^="/admin"]')).not.toBeInTheDocument();
  view.rerender(<StaffWorkspace><StaffFrame key="research" area="research" current="research" authorized role="RESEARCHER"><main>Directory only</main></StaffFrame></StaffWorkspace>);
  expect(document.querySelector(".staff-topbar")).toBe(header);
  expect(document.querySelector('a[href^="/admin"]')).not.toBeInTheDocument();
  expect(screen.queryByText("Admin page")).not.toBeInTheDocument();
});

test("student root navigation stays mounted while the route outlet changes", () => {
  route.pathname = "/";
  const view = render(<StudentWorkspace><main>Reflection</main></StudentWorkspace>);
  const navigation = screen.getByRole("navigation", { name: "Main navigation" });
  route.pathname = "/demo";
  view.rerender(<StudentWorkspace><main>Evidence</main></StudentWorkspace>);
  expect(screen.getByRole("navigation", { name: "Main navigation" })).toBe(navigation);
  expect(screen.getByRole("link", { name: "C1 evidence" })).toHaveAttribute("aria-current", "page");
  expect(screen.queryByText("Reflection")).not.toBeInTheDocument();
});
