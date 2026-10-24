"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useReviewCase } from "../context/CaseContext";
import { Sidebar } from "./Sidebar";

interface RequireAuthProps {
  children: ReactNode;
  workspace?: "counsellor" | "research";
}

/**
 * RequireAuth Guard
 * Ensures only authenticated counsellors can view research and review pages.
 * If unauthenticated, displays a clear access-restricted banner directing
 * the user to log in on the Case Queue page.
 */
export function RequireAuth({ children, workspace = "counsellor" }: RequireAuthProps) {
  const { authorized, checking } = useReviewCase();

  if (checking) {
    return (
      <div className="lime-page-container">
        <Sidebar workspace={workspace} isClassifierConnected={false} />
        <main className="lime-main" id="content">
          <div style={{ maxWidth: "480px", margin: "80px auto", textAlign: "center" }}>
            <p role="status" className="empty">Checking your session…</p>
          </div>
        </main>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="lime-page-container">
        <Sidebar workspace={workspace} isClassifierConnected={false} />
        <main className="lime-main" id="content">
          <div
            className="card"
            style={{
              maxWidth: "520px",
              margin: "60px auto",
              textAlign: "center",
              padding: "36px 28px",
              border: "1px solid #fecdd3",
              background: "#fff1f2",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(225, 29, 72, 0.06)",
            }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                background: "#fee2e2",
                color: "#e11d48",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <p
              className="eyebrow"
              style={{
                color: "#e11d48",
                fontWeight: 700,
                margin: "0 0 6px",
                fontSize: "11px",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              Restricted Access
            </p>
            <h2 style={{ margin: "0 0 12px", fontSize: "20px", color: "#1e293b" }}>
              Counsellor Authentication Required
            </h2>
            <p style={{ color: "#475569", fontSize: "13.5px", lineHeight: 1.55, margin: "0 0 24px" }}>
              This research page requires an authorized counsellor session. Please sign in on the Case Queue page
              using your synthetic development credentials from <code>.env</code>. Once signed in, all research and
              review pages will be unlocked.
            </p>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 22px",
                borderRadius: "8px",
                background: "#6366f1",
                color: "#ffffff",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "13.5px",
                boxShadow: "0 2px 4px rgba(99, 102, 241, 0.2)",
              }}
            >
              Go to Case Queue to Sign in →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}

export default RequireAuth;
