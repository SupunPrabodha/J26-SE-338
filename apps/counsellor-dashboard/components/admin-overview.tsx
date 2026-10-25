"use client";
import Link from "next/link";

import type { AdminOverview } from "@j26/common/contracts";
import { Icon, WorkspaceIllustration } from "@j26/common/ui";
import OperationalCharts from "./operational-charts";

const metrics = [
  ["eligible_cases", "Eligible review cases", "Consent-valid review tasks", "queue", "sage"],
  ["awaiting_assignment", "Awaiting assignment", "Eligible and unassigned", "assignments", "sand"],
  ["assigned_cases", "Assigned cases", "Eligible cases with an assignment", "completed", "sage"],
  ["active_counsellors", "Active counsellors", "Usable local accounts", "staff", "lavender"],
  ["enabled_staff", "Enabled staff", "Enabled staff records", "account", "lavender"],
  ["pending_jobs", "Queued / running jobs", "Current work awaiting completion", "operations", "sky"],
  ["failed_cases", "Failed cases", "Stored failure states", "info", "rose"],
  ["disposed_cases", "Disposed cases", "Stored disposal states", "retention", "sand"],
] as const;

export default function AdminOverviewPanel({ overview, onSessionEnded }: { overview: AdminOverview; onSessionEnded: () => void }) {
  return <>
    <section className="admin-welcome" aria-labelledby="admin-welcome-title"><div className="admin-welcome-copy"><p className="hero-kicker"><Icon name="leaf" />Your administration workspace</p><h2 id="admin-welcome-title">Thoughtful oversight.<br /><em>A connected workspace.</em></h2><p>Coordinate access, connect cases with counsellors, and follow the workflow through permitted operational evidence.</p><div className="hero-actions"><Link prefetch={false} className="button-link" href="/admin/assignments">Open assignments<Icon name="arrow" /></Link><Link prefetch={false} className="hero-secondary" href="/admin">View audit receipts</Link></div></div><WorkspaceIllustration /></section>
    <div className="snapshot-heading"><h2>At a glance</h2><span>Current synthetic records · All-record snapshot</span></div>
    <div className="metric-grid">{metrics.map(([key, title, description, icon, tone]) => <section className="card metric-card" data-tone={tone} key={key}><span className="metric-label">{title}</span><span className="metric-icon" aria-hidden="true"><Icon name={icon} /></span><strong>{overview[key]}</strong><p className="metric-description">{description}</p></section>)}</div>
    <section className="card policy-panel"><span className="policy-icon" aria-hidden="true"><Icon name="assignments" /></span><div><h2>Configured assignment policy</h2><p><span className="status-badge">{overview.assignment_policy === "MANUAL" ? "Manual assignment" : "Designated development counsellor"}</span></p><p>{overview.assignment_policy === "MANUAL" ? "Successfully processed cases wait for an administrator to assign a counsellor." : "Successfully processed cases are automatically assigned to the configured usable development counsellor. If unavailable, they remain awaiting assignment."}</p><details><summary>Assignment policy details</summary><p className="hint">Designated counsellor available: {overview.designated_counsellor_available ? "Yes" : "No"}. Counts reflect stored rows, not participants or research performance. Eligible cases include consent-valid ready/in-progress/completed review tasks; assignment count does not establish staff availability.</p></details><Link prefetch={false} href="/admin/assignments">Open case assignments ↗</Link></div></section>
    <OperationalCharts refreshKey={overview.observed_at} onSessionEnded={onSessionEnded} />
  </>;
}
