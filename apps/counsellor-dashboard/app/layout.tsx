import type { ReactNode } from "react";
import { ErrorBoundary } from "@j26/common/ui";
import { CaseProvider } from "./context/CaseContext";
import "./globals.css";

export const metadata = {
  title: "Counsellor Dashboard | J26-SE-338",
  description: "Non-diagnostic student wellbeing screening support prototype",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#content">
          Skip to content
        </a>
        <div className="app-shell-root">
          <ErrorBoundary>
            <CaseProvider>{children}</CaseProvider>
          </ErrorBoundary>
        </div>
      </body>
    </html>
  );
}
