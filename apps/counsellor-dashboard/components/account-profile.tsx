"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, adminApi, researchApi, ApiError } from "@j26/common/api";
import type { StaffProfile } from "@j26/common/contracts";
import { StaffFrame, DemoHeader, SafetyNotice, Icon, roleLabel } from "@j26/common/ui";

export default function AccountProfile({ workspace }: { workspace: "admin" | "research" | "counsellor" }) {
  const client = workspace === "admin" ? adminApi : workspace === "research" ? researchApi : api;
  const landing = workspace === "admin" ? "/admin/overview" : workspace === "research" ? "/research" : "/";
  const [profile, setProfile] = useState<StaffProfile | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [state, setState] = useState<"session" | "restricted" | "unavailable" | "signed-out">("session");
  const revision = useRef({ value: 0, signedOut: false });
  const read = useCallback(async () => {
    const request = ++revision.current.value;
    setBusy(true); setProfile(null); setError("");
    try {
      const value = await client<StaffProfile>("/auth/profile");
      if (workspace !== "research" && value.role !== (workspace === "admin" ? "ADMIN" : "COUNSELLOR")) throw new ApiError(403, "Use the sign-in for your authorized workspace.");
      if (request === revision.current.value) setProfile(value);
    } catch (cause) { if (request === revision.current.value) { setState(cause instanceof ApiError && cause.status === 401 ? "session" : cause instanceof ApiError && cause.status === 403 ? "restricted" : "unavailable"); setError(cause instanceof ApiError ? cause.message : "Account information is unavailable. Retry when connected."); } }
    finally { if (request === revision.current.value) setBusy(false); }
  }, [client, workspace]);
  useEffect(() => {
    const state = revision.current; let live = true;
    void Promise.resolve().then(() => { if (live) return read(); });
    // A protected page is rechecked on focus; there is no persistent browser copy.
    const focus = () => { if (!state.signedOut) void read(); };
    window.addEventListener("focus", focus);
    return () => { live = false; ++state.value; window.removeEventListener("focus", focus); };
  }, [read]);
  async function logout() { ++revision.current.value; revision.current.signedOut = true; setProfile(null); setBusy(true); try { await client("/auth/logout", {}); setState("signed-out"); setError("Signed out. Return to your workspace to sign in."); } catch { setState("unavailable"); setError("Sign-out could not be confirmed. Retry when connected."); } finally { setBusy(false); } }
  const workspaceName = workspace === "admin" ? "Administration" : workspace === "research" ? "Research directory" : "Counsellor workspace";
  const stateTitle = state === "unavailable" ? "Account details are unavailable" : state === "restricted" ? "Check your workspace access" : state === "signed-out" ? "You’re signed out" : "Sign in to view your account";
  return <StaffFrame area={workspace} current="profile" authorized={!!profile} role={profile?.role} checking={busy} busy={busy} onSignOut={logout}><main className="staff-profile-page">
    <DemoHeader title="Account profile" subtitle="Your account, session and workspace access in one place." /><SafetyNotice />
    {busy ? <section className="card profile-loading" role="status"><span className="profile-symbol" aria-hidden="true"><Icon name="account" /></span><h2>Checking account access…</h2><p>Confirming your current session with the server.</p></section> : profile ? <>
      <div className="profile-overview"><div className="profile-identity"><span className="profile-symbol" aria-hidden="true"><Icon name="account" /></span><div><p className="eyebrow">{workspaceName}</p><h2>{roleLabel(profile.role)} account</h2><p>Current account information, verified by the server.</p></div></div><span className="status-badge">{profile.enabled ? "Account enabled" : "Account disabled"}</span></div>
      <div className="profile-grid"><section className="card profile-details"><div className="section-heading"><Icon name="account" /><h2>Account details</h2></div><dl className="status-list">
        <div><dt>Account reference</dt><dd><code>{profile.account_id}</code></dd></div><div><dt>Role</dt><dd>{roleLabel(profile.role)}</dd></div><div><dt>Created</dt><dd><time dateTime={profile.created_at}>{new Date(profile.created_at).toLocaleString()}</time></dd></div><div><dt>Account expiry</dt><dd>{profile.account_expires_at ? <time dateTime={profile.account_expires_at}>{new Date(profile.account_expires_at).toLocaleString()}</time> : "No account deadline configured; session expiry still applies"}</dd></div>
      </dl><p className="hint">Your account reference is an internal identifier. Your login handle and credentials are not displayed here.</p></section>
      <div className="profile-aside"><section className="card profile-session"><div className="section-heading"><Icon name="clock" /><h2>Current session</h2></div><dl className="status-list"><div><dt>Remember me</dt><dd>{profile.remember_me ? "Enabled for this session" : "Not enabled"}</dd></div><div><dt>Current session deadline</dt><dd><time dateTime={profile.session_expires_at}>{new Date(profile.session_expires_at).toLocaleString()}</time></dd></div></dl><p className="hint">A staff session does not extend student consent or case access.</p></section>
        <section className="profile-privacy"><Icon name="shield" /><div><h3>Access stays role-based</h3><p>{profile.role === "RESEARCHER" ? "Your researcher account provides directory metadata only. Datasets, participant responses and private reviews are not included." : profile.role === "ADMIN" ? "Administration provides safe operational metadata. Private counselling content stays restricted." : "Case access requires your current assignment, active consent and retention eligibility."}</p><p>No passwords, tokens, student identities or case contents appear on this page.</p></div></section></div></div>
      <div className="profile-actions"><Link className="button-link" prefetch={false} href={landing}>Return to workspace<Icon name="arrow" /></Link><button className="secondary" onClick={() => void read()}>Refresh account</button></div>
    </> : <section className="card profile-access-state" aria-labelledby="profile-state-title"><span className="profile-symbol" aria-hidden="true"><Icon name={state === "unavailable" ? "operations" : "shield"} /></span><p className="eyebrow">{workspaceName}</p><h2 id="profile-state-title">{stateTitle}</h2><p role={state === "unavailable" || state === "restricted" ? "alert" : "status"}>{error}</p><p className="hint">No current protected account information. Sign in through your workspace.</p><div className="actions"><Link className="button-link" prefetch={false} href={landing}>Open workspace sign-in<Icon name="arrow" /></Link><button className="secondary" onClick={() => void read()}>Check account access</button></div><div className="profile-recovery-note"><Icon name="info" /><p>Use the sign-in for this workspace. Your account details appear only after a successful server check. Connection failures do not imply consent withdrawal.</p></div></section>}
    <footer>J26-SE-338 · Local research workspace</footer>
  </main></StaffFrame>;
}
