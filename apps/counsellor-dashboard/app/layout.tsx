import type { ReactNode } from "react";
import { ErrorBoundary } from "@j26/common/ui";
import { CaseProvider } from "./context/CaseContext";
import "./globals.css";

export const metadata = {
  title: "J26-SE-338 | Counsellor Review & XAI",
  description: "Non-diagnostic student wellbeing screening support prototype",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#content">
          Skip to content
        </a>
        <div id="content">
          <ErrorBoundary>
            <CaseProvider>{children}</CaseProvider>
          </ErrorBoundary>
        </div>
      </body>
    </html>
  );
}
