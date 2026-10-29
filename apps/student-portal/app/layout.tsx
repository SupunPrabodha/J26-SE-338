import type { ReactNode } from "react";
import { ErrorBoundary, StudentWorkspace } from "@j26/common/ui";
import "./globals.css";
export const metadata = { title: "Wellbeing | Your reflection", description: "A voluntary, fictional walkthrough of consent and counsellor-assisted wellbeing screening support. J26-SE-338 research prototype." };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><a className="skip" href="#content">Skip to content</a><div id="content"><StudentWorkspace><ErrorBoundary>{children}</ErrorBoundary></StudentWorkspace></div></body></html>;
}
