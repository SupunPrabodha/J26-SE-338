import type { ReactNode } from "react";
import { ErrorBoundary, StaffWorkspace } from "@j26/common/ui";
import "./globals.css";
export const metadata = { title: "Wellbeing | Staff workspace", description: "Authorized administration and counsellor-assisted screening support. J26-SE-338 synthetic research workspace." };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><a className="skip" href="#content">Skip to content</a><div id="content"><StaffWorkspace><ErrorBoundary>{children}</ErrorBoundary></StaffWorkspace></div></body></html>;
}
