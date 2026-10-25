"use client";

import { Component, useEffect, useId, useRef, useState, type ReactNode } from "react";

export function SafetyNotice() {
  const [open, setOpen] = useState(false);
  return <aside aria-label="Prototype limitations" className="prototype-line">
    <span><Icon name="shield" />Screening support only <span aria-hidden="true">·</span> Mock data</span>
    <button className="text-button" onClick={() => setOpen(true)}>About this prototype<Icon name="info" /></button>
    {open && <AppDialog title="About this prototype" className="small-dialog" onClose={() => setOpen(false)}>
      <p>This prototype does not provide clinical diagnosis, treatment advice, or emergency intervention.
      It does not replace professional counselling. Outputs require authorized human interpretation.
      Use fictional fixtures only. Do not enter real student information.</p>
      <p className="hint">C1 provides consent, access and workflow controls. Connected C2–C4 services are mock providers; their research results are not demonstrated here.</p>
    </AppDialog>}
  </aside>;
}

// Small code-native outline set; this repository has no installed icon library.
export function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    staff: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 5a5 5 0 0 1 3 5" /></>,
    assignments: <><path d="M9 5H5v16h14V5h-4" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="m8 13 3 3 5-6" /></>,
    audit: <><path d="M14 3H5v18h14V8Z M14 3v5h5M8 12h8m-8 4h6" /></>,
    operations: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    retention: <><path d="M4 7h16v14H4ZM3 3h18v4H3Zm6 8h6" /></>,
    queue: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 14h5l2 3h4l2-3h5" /></>,
    completed: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
    research: <><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /><path d="M6 9v9h9m0-12h6m-3-3v6" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v1" /></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
    account: <><circle cx="12" cy="8" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    logout: <><path d="M10 4H4v16h6m4-12 4 4-4 4m-6-4h14" /></>,
    leaf: <><path d="M20 3C8 2 3 7 5 14s15 8 15-11ZM4 21 16 9" /><path d="M9 16v-5m0 5h5" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    book: <><path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1m0-15c4-3 8-2 10-1v15c-4-2-7-1-10 1Zm0 0v15" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  };
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name] || paths.info}</svg>;
}

export function ReflectionHero() {
  return <section className="reflection-hero" aria-labelledby="reflection-title">
    <div className="reflection-art" aria-hidden="true"><img src="/images/wellbeing-garden.webp" alt="" width="1600" height="800" fetchPriority="high" decoding="async" /><span className="art-caption"><Icon name="leaf" />Your pace. Your choice.</span></div>
    <div className="reflection-hero-copy"><p className="hero-kicker"><span />A space to pause</p>
      <h1 id="reflection-title" tabIndex={-1}>Your wellbeing<br /><em>reflection.</em></h1>
      <p>A little room for reflection, with your choices at the centre. Explore a voluntary, fictional walkthrough of counsellor-assisted screening support.</p>
      <div className="hero-actions"><a className="button-link" href="#consent-title">Start with your choice<Icon name="arrow" /></a><a className="hero-secondary" href="#reflection-guide">How it works</a></div>
      <p className="hero-footnote"><Icon name="info" />Synthetic demonstration · No personal information</p>
    </div>
  </section>;
}

export function ReflectionPrinciples() {
  return <div className="reflection-principles" aria-label="About this reflection">{[
    ["heart", "Your choice comes first", "Agree, decline or withdraw. Taking part is always optional."],
    ["book", "A fictional walkthrough", "Explore with built-in examples, without entering personal information."],
    ["staff", "People stay in control", "Outputs support an authorized counsellor’s human review."],
  ].map(([icon, title, description]) => <div className="reflection-principle" key={title}><span className="principle-icon"><Icon name={icon} /></span><div><h2>{title}</h2><p>{description}</p></div></div>)}</div>;
}

// Decorative representation of C1 responsibilities, never workflow or test-result data.
export function WorkspaceIllustration() {
  return <div className="workspace-illustration" aria-hidden="true"><div className="illustration-orbit orbit-outer" /><div className="illustration-orbit orbit-inner" /><span className="illustration-dot dot-one" /><span className="illustration-dot dot-two" />
    <div className="illustration-core"><Icon name="leaf" /></div>
    <div className="illustration-node node-consent"><span><Icon name="heart" /></span>Consent</div>
    <div className="illustration-node node-access"><span><Icon name="shield" /></span>Access</div>
    <div className="illustration-node node-trace"><span><Icon name="audit" /></span>Traceability</div>
  </div>;
}

export const roleLabel = (role: string) => ({ ADMIN: "Admin", COUNSELLOR: "Counsellor", RESEARCHER: "Researcher" })[role] || "Staff";

export function AccountMenu({ role, busy = false, onSignOut, workspace }: { role: string; busy?: boolean; onSignOut: () => void; workspace?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), item = useRef<HTMLAnchorElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    item.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div className="account-control" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      const entries = [...root.current!.querySelectorAll<HTMLElement>('[role="menuitem"]')];
      const index = entries.indexOf(document.activeElement as HTMLElement);
      entries[event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : (index + (event.key === "ArrowUp" ? -1 : 1) + entries.length) % entries.length]?.focus();
    }
  }}>
    <button ref={trigger} className="account-trigger" aria-label={`${roleLabel(role)} account`} aria-expanded={open} aria-haspopup="menu" aria-controls={open ? id : undefined} disabled={busy} onClick={() => setOpen(value => !value)}><span className="account-avatar"><Icon name="account" /></span><span>{roleLabel(role)}</span><Icon name="chevron" /></button>
    {open && <div id={id} className="account-dropdown" role="menu" aria-label="Account menu"><p>Signed in as {roleLabel(role)}</p><a ref={item} role="menuitem" href={`/account?workspace=${workspace || (role === "ADMIN" ? "admin" : role === "RESEARCHER" ? "research" : "counsellor")}`} onClick={() => setOpen(false)}><Icon name="account" />Account profile</a><button role="menuitem" disabled={busy} onClick={() => { setOpen(false); onSignOut(); }}><Icon name="logout" />Sign out</button></div>}
  </div>;
}

export function AppNavigation({ active, role, children }: { active: "student" | "counsellor" | "admin" | "demo" | "research"; role?: string; children?: ReactNode }) {
  const links = active === "student" || active === "demo"
    ? [{ id: "student", label: "Your reflection", href: "/" }, { id: "demo", label: "C1 evidence", href: "/demo" }]
    : [{ id: "counsellor", label: "Case workspace", href: "/" }, { id: "admin", label: "Administration", href: "/admin/overview" }, { id: "research", label: "C2–C4 routes", href: "/research" }].filter(link => link.id === active || link.id === "research" || (role === "ADMIN" && link.id === "admin") || (role === "COUNSELLOR" && link.id === "counsellor"));
  return <nav className="app-nav" aria-label="Main navigation"><a className="brand" href={active === "student" || active === "demo" ? "/" : "http://localhost:3000"}><span className="brand-mark" aria-hidden="true">W</span><span>Wellbeing<span className="brand-caption">Research workspace · J26-SE-338</span></span></a>
    <div className="nav-links">{links.map(link => <a key={link.id} href={link.href} aria-current={link.id === active ? "page" : undefined}>{link.label}</a>)}</div>{children}</nav>;
}

export function StaffFrame({ area, current, authorized, role, busy, onSignOut, children }: { area: "admin" | "counsellor" | "research"; current: string; authorized: boolean; role?: string; busy?: boolean; onSignOut?: () => void; children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { if (!authorized) void Promise.resolve().then(() => setDrawer(false)); }, [authorized]);
  useEffect(() => {
    const media = window.matchMedia?.("(min-width: 761px)");
    if (!media) return;
    const close = (event: MediaQueryListEvent) => { if (event.matches) setDrawer(false); };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);
  const resolvedRole = role || (area === "admin" ? "ADMIN" : area === "counsellor" ? "COUNSELLOR" : "RESEARCHER");
  const links = resolvedRole === "ADMIN" ? [
    ["overview", "Overview", "/admin/overview"], ["staff", "Staff and roles", "/admin/staff"],
    ["assignments", "Case assignments", "/admin/assignments"], ["audit", "Audit log", "/admin"],
    ["operations", "Workflow / services", "/admin/operations"], ["retention", "Retention overview", "/admin/retention"],
  ] : resolvedRole === "COUNSELLOR" ? [["queue", "Assigned cases", "/"], ["completed", "Completed reviews", "/?state=COMPLETED"]] : [["research", "Research directory", "/research"]];
  links.push(["profile", "Account profile", `/account?workspace=${area}`]);
  const navigation = <div className="sidebar-content"><p className="eyebrow">{resolvedRole === "ADMIN" ? "Administration" : resolvedRole === "COUNSELLOR" ? "Review workspace" : "Research workspace"}</p><nav aria-label="Workspace sections">{links.map(([id, label, href]) => <a key={id} href={href} onClick={() => setDrawer(false)} aria-current={id === current ? "page" : undefined}><Icon name={id} />{label}</a>)}</nav><div className="sidebar-boundary"><p className="eyebrow">Integrations</p><a href="/research" aria-current={current === "research" ? "page" : undefined} onClick={() => setDrawer(false)}><Icon name="research" />Component directory</a></div><p className="sidebar-footnote">J26-SE-338<span>Local research workspace</span></p></div>;
  return <div className={`staff-application ${authorized ? "has-sidebar" : ""}`} data-area={area}><header className="staff-topbar"><AppNavigation active={area} role={authorized ? resolvedRole : undefined}>{authorized && onSignOut && <AccountMenu key={resolvedRole} role={resolvedRole} busy={busy} onSignOut={onSignOut} workspace={area} />}</AppNavigation>{authorized && <button className="drawer-toggle secondary" aria-label="Open workspace navigation" aria-expanded={drawer} aria-haspopup="dialog" onClick={() => setDrawer(true)}><Icon name="menu" />Menu</button>}</header>
    <div className="workspace-shell">{authorized && <aside className="staff-sidebar" aria-label={`${area} workspace navigation`}>{navigation}</aside>}<div className="workspace-main">{children}</div></div>
    {authorized && drawer && <AppDialog title="Workspace navigation" className="navigation-drawer" onClose={() => setDrawer(false)}>{navigation}</AppDialog>}
  </div>;
}

export function AppDialog({ title, children, onClose, dirty = false, busy = false, className = "", initialFocus }: { title: string; children: ReactNode; onClose: () => void; dirty?: boolean; busy?: boolean; className?: string; initialFocus?: string }) {
  const dialog = useRef<HTMLDialogElement>(null), close = useRef<HTMLButtonElement>(null), keep = useRef<HTMLButtonElement>(null);
  const [discarding, setDiscarding] = useState(false);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement, element = dialog.current;
    element?.showModal();
    (initialFocus ? element?.querySelector<HTMLElement>(initialFocus) : close.current)?.focus();
    return () => { element?.close(); if (previous instanceof HTMLElement && previous.isConnected && !previous.matches(":disabled")) previous.focus(); else document.querySelector<HTMLElement>("main h1")?.focus(); };
  }, [initialFocus]);
  useEffect(() => { if (discarding) keep.current?.focus(); else if (!dialog.current?.contains(document.activeElement)) close.current?.focus(); }, [discarding]);
  function requestClose() { if (busy) return; if (dirty) setDiscarding(true); else onClose(); }
  return <dialog ref={dialog} className={`app-dialog ${className}`} aria-labelledby={titleId} aria-busy={busy} onCancel={event => { event.preventDefault(); if (discarding) setDiscarding(false); else requestClose(); }}>
    <header className="dialog-header"><h2 id={titleId}>{discarding ? "Discard unsaved changes?" : title}</h2><button ref={close} className="quiet" disabled={busy} data-dialog-close aria-label="Close dialog" onClick={requestClose}>Close</button></header>
    <div className="dialog-body" tabIndex={0}>{discarding ? <><p>Your edits have not been saved. Keep editing or discard them. No server change will be made.</p><div className="actions"><button ref={keep} className="secondary" onClick={() => setDiscarding(false)}>Keep editing</button><button className="danger" onClick={onClose}>Discard changes</button></div></> : children}</div>
  </dialog>;
}

// Only an open protected view is monitored. Each request still authorizes on the server;
// no client flag grants access. Failed checks clear the view, including dirty editors.
export function useDialogAccess(key: string | null, verify: () => Promise<unknown>, invalidate: (cause: unknown) => void) {
  const callbacks = useRef({ verify, invalidate });
  useEffect(() => { callbacks.current = { verify, invalidate }; }, [verify, invalidate]);
  useEffect(() => {
    if (!key) return;
    let live = true, running = false, observations = 0;
    async function check() {
      if (!live || running) return;
      running = true;
      try { await callbacks.current.verify(); observations++; if (live && observations >= 20) callbacks.current.invalidate(new Error("Verification window ended")); }
      catch (cause) { if (live) callbacks.current.invalidate(cause); }
      finally { running = false; }
    }
    void check();
    const timer = window.setInterval(check, 10000);
    window.addEventListener("focus", check);
    return () => { live = false; clearInterval(timer); window.removeEventListener("focus", check); };
  }, [key]);
}

export function ChangeConfirmation({ description, busy, error, onCancel, onConfirm }: { description: string; busy: boolean; error?: string; onCancel: () => void; onConfirm: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { const parent = cancel.current?.closest("dialog"); cancel.current?.focus(); return () => { parent?.querySelector<HTMLElement>("[data-dialog-close]")?.focus(); }; }, []);
  return <><p>{description}</p><ErrorMessage message={error || ""} /><div className="actions"><button ref={cancel} data-change-cancel className="secondary" disabled={busy} onClick={onCancel}>Cancel change</button><button disabled={busy} onClick={onConfirm}>{busy ? "Saving…" : "Confirm change"}</button></div></>;
}

export function ConfirmChange({ title, ...props }: { title: string; description: string; busy: boolean; error?: string; onCancel: () => void; onConfirm: () => void }) {
  return <AppDialog title={title} initialFocus="[data-change-cancel]" busy={props.busy} onClose={props.onCancel}><ChangeConfirmation {...props} /></AppDialog>;
}

export function StaffSignIn({ kind, busy, onSubmit }: { kind: "counsellor" | "admin" | "research"; busy: boolean; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <div className="signin-layout"><aside className="signin-story"><img src="/images/wellbeing-garden.webp" alt="" width="1600" height="800" decoding="async" /><div className="signin-story-copy"><p className="hero-kicker">Wellbeing · Research workspace</p><h2>A considered space.<br /><em>A human perspective.</em></h2><p>Thoughtful tools for people who support people.</p></div></aside><section className="card sign-in" aria-labelledby="sign-in-title"><div className="sign-in-icon" aria-hidden="true"><Icon name={kind === "admin" ? "shield" : kind === "research" ? "research" : "staff"} /></div>
    <p className="eyebrow">{kind === "admin" ? "Restricted administration" : kind === "research" ? "Permitted research navigation" : "Counsellor workspace"}</p>
    <h2 id="sign-in-title">Development sign-in</h2><p>{kind === "admin" ? "Review safe operational receipts. Counselling content is excluded." : kind === "research" ? "View the current component route directory with a locally granted staff/research role. No datasets or participant responses are available." : "Continue to your assigned, consent-valid cases and saved reviews."}</p>
    <form onSubmit={onSubmit}><label htmlFor="username">Development username</label><input id="username" name="username" required autoComplete="username" />
      <label htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" />
      <label className="remember-choice"><input type="checkbox" name="remember_me" disabled={busy} aria-describedby="remember-help" />Remember me on this device</label>
      <p id="remember-help" className="hint remember-help">Keep a bounded session across browser restarts. Use only on a device you control. Unchecked keeps the existing one-hour session behaviour.</p>
      <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form>
    <p className="hint">Use your private local setup credentials. Use a separate browser profile for each demonstration role.</p></section></div>;
}

export function DemoHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <header className="page-header"><div><p className="eyebrow">J26-SE-338 · Component 1</p>
    <h1 tabIndex={-1}>{title}</h1><p className="subtitle">{subtitle}</p></div>
    </header>;
}

export function humanLabel(value?: string | null) {
  if (!value) return "Unavailable";
  const labels: Record<string, string> = { READY_FOR_REVIEW: "Ready for review", UNDER_REVIEW: "Review in progress", WITHDRAWN: "Withdrawn", WITHDRAWAL_REQUESTED: "Withdrawal requested", RECEIVED: "Received", DONE: "Done", CANCELLED: "Cancelled", OWNER_WITHDRAWAL: "Owner withdrawal", RETENTION: "Retention", NOT_EVALUATED: "Not evaluated" };
  return labels[value] || value.toLowerCase().replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
}

export function StatusBadge({ value, children }: { value: string; children?: ReactNode }) {
  return <span className="status-badge" data-status={value}>{children || humanLabel(value)}</span>;
}

export function reviewLabel(state?: string, unavailable = false) {
  if (unavailable) return "Unavailable";
  if (state === "COMPLETED") return "Human review completed";
  if (state === "UNDER_REVIEW") return "Human review in progress";
  if (state === "READY_FOR_REVIEW") return "Awaiting human review";
  return "Not yet available";
}

export function processingLabel(state?: string, disposed = false) {
  if (disposed || state === "WITHDRAWN" || state === "WITHDRAWAL_REQUESTED") return "Disposed; review unavailable";
  if (["READY_FOR_REVIEW", "UNDER_REVIEW", "COMPLETED"].includes(state || "")) return "Processing complete";
  const labels: Record<string, string> = { RECEIVED: "Submission received", CONSENT_VERIFIED: "Consent verified",
    PREPROCESSING: "Preparing synthetic text", INFERENCE: "Running mock indicators", EXPLANATION: "Preparing mock explanation", FAILED: "Processing failed" };
  return labels[state || ""] || "Not submitted";
}

export function WithdrawalDialog({ busy, error, onCancel, onConfirm }: {
  busy: boolean; error: string; onCancel: () => void; onConfirm: () => void;
}) {
  return <AppDialog title="Withdraw your consent?" initialFocus="[data-withdraw-cancel]" busy={busy} onClose={onCancel}>
    <p>Further processing and counsellor review will be blocked. Derived fixture evidence will be deleted. Minimal audit receipts remain. This decision cannot be undone for this consent.</p>
    <ErrorMessage message={error} />
    <p role="status">{busy ? "Recording your withdrawal…" : "You can keep your consent by cancelling."}</p>
    <div className="actions"><button data-withdraw-cancel className="secondary" disabled={busy} onClick={onCancel}>Keep consent</button><button className="danger" disabled={busy} onClick={onConfirm}>Confirm withdrawal</button></div>
  </AppDialog>;
}

export function ErrorMessage({ message }: { message: string }) {
  return message ? <p role="alert" className="error">{message}</p> : null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p role="alert">The development interface could not load. Refresh to try again.</p> : this.props.children;
  }
}
