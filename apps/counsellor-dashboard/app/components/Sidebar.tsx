"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  isClassifierConnected?: boolean;
}

export function Sidebar({ isClassifierConnected = false }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="lime-sidebar" aria-label="Counsellor Navigation">
      {/* Brand Logo */}
      <div className="lime-brand">
        <div className="lime-brand-logo-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="7" fill="url(#limeBrandGrad)" />
            <path d="M7 7L17 17M17 7L7 17" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
            <circle cx="12" cy="12" r="2.2" fill="white" />
            <defs>
              <linearGradient id="limeBrandGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#4338ca" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="lime-brand-info">
          <h2 className="lime-brand-name">XAI Dashboard</h2>
          <span className="lime-brand-tagline">Faithfulness Evaluator</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="lime-nav">
        <Link
          href="/"
          className={`lime-nav-btn ${pathname === "/" ? "lime-nav-btn-active active" : ""}`}
        >
          <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Overview</span>
        </Link>

        {/* Section: EXPLANATIONS */}
        <div className="lime-nav-heading">EXPLANATIONS</div>
        <Link
          href="/lime"
          className={`lime-nav-btn ${pathname === "/lime" ? "lime-nav-btn-active active" : ""}`}
          aria-current={pathname === "/lime" ? "page" : undefined}
        >
          <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <circle cx="18" cy="6" r="3" />
            <path d="M6 9v12M18 9v3a3 3 0 0 1-3 3H6" />
          </svg>
          <span>LIME Explanation</span>
        </Link>

        <Link
          href="/shap"
          className={`lime-nav-btn ${pathname === "/shap" ? "lime-nav-btn-active active" : ""}`}
          aria-current={pathname === "/shap" ? "page" : undefined}
        >
          <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span>SHAP Explanation</span>
        </Link>

        <Link
          href="/counterfactuals"
          className={`lime-nav-btn ${pathname === "/counterfactuals" ? "lime-nav-btn-active active" : ""}`}
          aria-current={pathname === "/counterfactuals" ? "page" : undefined}
        >
          <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m16 3 4 4-4 4" />
            <path d="M20 7H4" />
            <path d="m8 21-4-4 4-4" />
            <path d="M4 17h16" />
          </svg>
          <span>Counterfactuals</span>
        </Link>

        {/* Section: EVALUATION */}
        <div className="lime-nav-heading">EVALUATION</div>
        <div
          className="lime-nav-btn"
          style={{ opacity: 0.6, cursor: "not-allowed" }}
          title="Awaiting C4 Faithfulness module"
          aria-disabled="true"
        >
          <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span>Faithfulness Tests</span>
        </div>

        <div
          className="lime-nav-btn"
          style={{ opacity: 0.6, cursor: "not-allowed" }}
          title="Awaiting C4 Stability module"
          aria-disabled="true"
        >
          <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          <span>Stability Analysis</span>
        </div>

        <div
          className="lime-nav-btn"
          style={{ opacity: 0.6, cursor: "not-allowed" }}
          title="Awaiting C4 Comparison module"
          aria-disabled="true"
        >
          <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path d="M7 21h10" />
            <path d="M12 3v18" />
            <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
          </svg>
          <span>Comparison</span>
        </div>

        {/* Section: DATA & SETTINGS */}
        <div className="lime-nav-heading">DATA & SETTINGS</div>
        <Link
          href="/c4-dev-input"
          className={`lime-nav-btn ${pathname === "/c4-dev-input" || pathname === "/input" ? "lime-nav-btn-active active" : ""}`}
          aria-current={pathname === "/c4-dev-input" || pathname === "/input" ? "page" : undefined}
          title="C4 development — fictional text only"
        >
          <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span>Development Input</span>
        </Link>

        <div
          className="lime-nav-btn"
          style={{ opacity: 0.6, cursor: "not-allowed" }}
          aria-disabled="true"
        >
          <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Settings</span>
        </div>
      </nav>

      {/* Persistent Non-Diagnostic Notice */}
      <div style={{ margin: "10px 0 6px", padding: "8px 10px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)", fontSize: "10px", color: "#94a3b8", lineHeight: 1.35 }}>
        <strong style={{ color: "#cbd5e1", display: "block", marginBottom: "2px" }}>Screening Support</strong>
        Screening support only. Requires counsellor-assisted interpretation and does not replace professional counselling.
      </div>

      {/* Model Card */}
      <div className="lime-sidebar-model-card">
        <div className="lime-model-label" style={{ fontSize: "10px", lineHeight: "1.25", marginBottom: "4px" }}>
          Temporary sentiment model — C4 development
        </div>
        <div className="lime-model-name" style={{ fontSize: "11px", fontWeight: 700, color: "#ffffff", wordBreak: "break-all" }}>
          twitter-xlm-roberta-base-sentiment
        </div>
        <div className="lime-model-sub" style={{ fontSize: "10px", color: "#94a3b8" }}>
          (cardiffnlp checkpoint)
        </div>
        <div className="lime-model-status-badge">
          <span
            className="lime-status-indicator"
            style={{ backgroundColor: isClassifierConnected ? "#10b981" : "#eab308" }}
          ></span>
          <span>{isClassifierConnected ? "Connected" : "Loading / Disconnected"}</span>
        </div>
      </div>
    </aside>
  );
}
