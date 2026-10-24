"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useReviewCase } from "../context/CaseContext";

export interface SidebarProps {
  isClassifierConnected?: boolean;
  workspace?: "counsellor" | "research";
}

/**
 * Main Counsellor Workspace Sidebar
 * Dedicated to active case queue, review workflows, and quick access to research.
 */
export function CounsellorSidebar({ isClassifierConnected }: SidebarProps) {
  const pathname = usePathname();
  const { authorized } = useReviewCase();

  const connected =
    isClassifierConnected !== undefined ? isClassifierConnected : (authorized ?? true);

  const isActive = (path: string) => {
    if (!pathname) return false;
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <aside className="lime-sidebar" aria-label="Counsellor Workspace Navigation">
      {/* Brand Logo - Counsellor Dashboard */}
      <Link href="/" className="lime-brand" style={{ textDecoration: "none" }} title="Counsellor Dashboard — Case Queue">
        <div className="lime-brand-logo-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="7" fill="url(#counsellorBrandGrad)" />
            <path d="M12 4L4 8V14C4 18.5 7.5 21.8 12 23C16.5 21.8 20 18.5 20 14V8L12 4Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 12L11 14L15 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="counsellorBrandGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#4338ca" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="lime-brand-info">
          <h2 className="lime-brand-name">Counsellor Dashboard</h2>
          <span className="lime-brand-tagline">Screening Support</span>
        </div>
      </Link>

      {/* Navigation Menu */}
      <nav className="lime-nav">
        <div className="lime-nav-heading">WORKFLOW</div>

        {/* Case Queue */}
        <Link
          href="/"
          className={`lime-nav-btn ${isActive("/") ? "lime-nav-btn-active active" : ""}`}
          aria-current={isActive("/") ? "page" : undefined}
          title="Assigned tasks and case queue"
        >
          <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-6l-2 3h-4l-2-3H2" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          </svg>
          <span>Case Queue</span>
        </Link>

        {/* Submission Review - Disabled with Coming soon */}
        <div
          className="lime-nav-btn lime-nav-btn-disabled"
          style={{ opacity: 0.6, cursor: "not-allowed", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          title="Detailed student submission review and consent verification — Coming soon"
          aria-disabled="true"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="m9 15 2 2 4-4" />
            </svg>
            <span>Submission Review</span>
          </div>
          <span className="lime-nav-badge">Coming soon</span>
        </div>

        {/* Review History - Disabled with Coming soon */}
        <div
          className="lime-nav-btn lime-nav-btn-disabled"
          style={{ opacity: 0.6, cursor: "not-allowed", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          title="Historical review audits and finalized determinations — Coming soon"
          aria-disabled="true"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 14 14" />
            </svg>
            <span>Review History</span>
          </div>
          <span className="lime-nav-badge">Coming soon</span>
        </div>

        <div className="lime-nav-heading">RESEARCH & TOOLS</div>

        {/* Explanation Research */}
        <Link
          href="/lime"
          className="lime-nav-btn"
          title="Open Explanation Research workspace (LIME, SHAP, Faithfulness, Stability)"
        >
          <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
          <span>Explanation Research</span>
        </Link>

        {/* Settings - preserved */}
        <div
          className="lime-nav-btn lime-nav-btn-disabled"
          style={{ opacity: 0.6, cursor: "not-allowed", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          title="Development configuration"
          aria-disabled="true"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Settings</span>
          </div>
          <span className="lime-nav-badge">Dev</span>
        </div>

        {/* Development Input */}
        <Link
          href={pathname === "/input" ? "/input" : "/c4-dev-input"}
          className={`lime-nav-btn ${isActive("/c4-dev-input") || isActive("/input") ? "lime-nav-btn-active active" : ""}`}
          aria-current={isActive("/c4-dev-input") || isActive("/input") ? "page" : undefined}
          title="C4 development — fictional text only"
          aria-label={pathname === "/input" ? "Input" : "Development Input"}
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
      </nav>

      {/* Persistent Non-Diagnostic Notice */}
      <div style={{ margin: "10px 0 6px", padding: "8px 10px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)", fontSize: "10px", color: "#94a3b8", lineHeight: 1.35 }}>
        <strong style={{ color: "#cbd5e1", display: "block", marginBottom: "2px" }}>Screening Support</strong>
        Screening support only. Requires counsellor-assisted interpretation and does not replace professional counselling.
      </div>

      {/* Counsellor Workspace Status Card */}
      <div className="lime-sidebar-model-card">
        <div className="lime-model-label" style={{ fontSize: "10px", lineHeight: "1.25", marginBottom: "4px" }}>
          Counsellor Review Shell · Development
        </div>
        <div className="lime-model-name" style={{ fontSize: "12px", fontWeight: 700, color: "#ffffff" }}>
          {connected ? "Authorized Counsellor" : "Session Pending"}
        </div>
        <div className="lime-model-sub" style={{ fontSize: "10px", color: "#94a3b8" }}>
          Synthetic development cases
        </div>
        <div className="lime-model-status-badge">
          <span
            className="lime-status-indicator"
            style={{ backgroundColor: connected ? "#10b981" : "#eab308" }}
          ></span>
          <span>{connected ? "Active Session" : "Authentication Required"}</span>
        </div>
      </div>
    </aside>
  );
}

/**
 * Explanation Research Workspace Sidebar
 * Dedicated to Component 4 XAI explainability and evaluation methods.
 */
export function ResearchSidebar({ isClassifierConnected }: SidebarProps) {
  const pathname = usePathname();
  const { authorized } = useReviewCase();

  const connected =
    isClassifierConnected !== undefined ? isClassifierConnected : (authorized ?? true);

  const isActive = (path: string) => {
    if (!pathname) return false;
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <aside className="lime-sidebar" aria-label="Explanation Research Navigation">
      {/* Brand Logo - Explanation Research */}
      <Link href="/lime" className="lime-brand" style={{ textDecoration: "none" }} title="Explanation Research Workspace">
        <div className="lime-brand-logo-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="7" fill="url(#researchBrandGrad)" />
            <path d="M7 7L17 17M17 7L7 17" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
            <circle cx="12" cy="12" r="2.2" fill="white" />
            <defs>
              <linearGradient id="researchBrandGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#4338ca" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="lime-brand-info">
          <h2 className="lime-brand-name">Explanation Research</h2>
          <span className="lime-brand-tagline">Faithfulness Evaluator</span>
        </div>
      </Link>

      {/* Navigation Menu */}
      <nav className="lime-nav">
        {/* Return to Counsellor Dashboard */}
        <Link
          href="/"
          className="lime-nav-btn lime-nav-btn-back"
          title="Return to Counsellor Dashboard (Case Queue)"
        >
          <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span>Back to Counsellor Dashboard</span>
        </Link>

        {/* Section: EXPLANATIONS */}
        <div className="lime-nav-heading">EXPLANATIONS</div>
        <Link
          href="/lime"
          className={`lime-nav-btn ${isActive("/lime") ? "lime-nav-btn-active active" : ""}`}
          aria-current={isActive("/lime") ? "page" : undefined}
          title="Local Interpretable Model-agnostic Explanations"
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
          className={`lime-nav-btn ${isActive("/shap") ? "lime-nav-btn-active active" : ""}`}
          aria-current={isActive("/shap") ? "page" : undefined}
          title="SHapley Additive exPlanations"
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
          className={`lime-nav-btn ${isActive("/counterfactuals") ? "lime-nav-btn-active active" : ""}`}
          aria-current={isActive("/counterfactuals") ? "page" : undefined}
          title="Minimal perturbation counterfactual examples"
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
        <Link
          href="/faithfulness"
          className={`lime-nav-btn ${isActive("/faithfulness") ? "lime-nav-btn-active active" : ""}`}
          aria-current={isActive("/faithfulness") ? "page" : undefined}
          title="Progressive deletion & sufficiency testing"
        >
          <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span>Faithfulness Tests</span>
        </Link>

        <Link
          href="/stability"
          className={`lime-nav-btn ${isActive("/stability") ? "lime-nav-btn-active active" : ""}`}
          aria-current={isActive("/stability") ? "page" : undefined}
          title="Repeated-run explainer consistency and perturbation variability"
        >
          <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          <span>Stability Analysis</span>
        </Link>

        <Link
          href="/comparison"
          className={`lime-nav-btn ${isActive("/comparison") ? "lime-nav-btn-active active" : ""}`}
          aria-current={isActive("/comparison") ? "page" : undefined}
          title="Compare saved LIME and SHAP explanation and evaluation evidence"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="M7 21h10" />
              <path d="M12 3v18" />
              <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
            </svg>
            <span>Comparison</span>
          </div>
        </Link>

        {/* Section: SETTINGS */}
        <div className="lime-nav-heading">SETTINGS</div>
        <div
          className="lime-nav-btn lime-nav-btn-disabled"
          style={{ opacity: 0.6, cursor: "not-allowed", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          title="Development configuration"
          aria-disabled="true"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <svg className="lime-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Settings</span>
          </div>
          <span className="lime-nav-badge">Dev</span>
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
            style={{ backgroundColor: connected ? "#10b981" : "#eab308" }}
          ></span>
          <span>{connected ? "Connected" : "Loading / Disconnected"}</span>
        </div>
      </div>
    </aside>
  );
}

/**
 * Universal Sidebar Component
 * Automatically switches between Counsellor Workspace layout and Explanation Research layout,
 * or can be explicitly controlled via the `workspace` prop.
 */
export function Sidebar({ isClassifierConnected, workspace }: SidebarProps) {
  const pathname = usePathname();
  const isCounsellorRoute =
    pathname === "/" ||
    pathname === "/c4-dev-input" ||
    pathname === "/input";
  const activeWorkspace = workspace ?? (isCounsellorRoute ? "counsellor" : "research");

  if (activeWorkspace === "counsellor") {
    return <CounsellorSidebar isClassifierConnected={isClassifierConnected} />;
  }

  return <ResearchSidebar isClassifierConnected={isClassifierConnected} />;
}

export default Sidebar;
