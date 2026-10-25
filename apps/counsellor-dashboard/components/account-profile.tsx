"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, adminApi, researchApi, ApiError } from "@j26/common/api";
import type { StaffProfile } from "@j26/common/contracts";
import { StaffFrame, DemoHeader, SafetyNotice, ErrorMessage, roleLabel } from "@j26/common/ui";

export default function AccountProfile({ workspace }: { workspace: "admin" | "research" | "counsellor" }) {
  const client = workspace === "admin" ? adminApi : workspace === "research" ? researchApi : api;
  const landing = workspace === "admin" ? "/admin/overview" : workspace === "research" ? "/research" : "/";
  const [profile, setProfile] = useState<StaffProfile | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const revision = useRef({ value: 0, signedOut: false });
  const read = useCallback(async () => {
    const request = ++revision.current.value;
    setBusy(true); setProfile(null); setError("");
    try {
      const value = await client<StaffProfile>("/auth/profile");
      if (workspace !== "research" && value.role !== (workspace === "admin" ? "ADMIN" : "COUNSELLOR")) throw new ApiError(403, "Use the sign-in for your authorized workspace.");
      if (request === revision.current.value) setProfile(value);
    } catch (cause) { if (request === revision.current.value) setError(cause instanceof ApiError ? cause.message : "Account information is unavailable. Retry when connected."); }
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
  async function logout() { ++revision.current.value; revision.current.signedOut = true; setProfile(null); setBusy(true); try { await client("/auth/logout", {}); setError("Signed out. Return to your workspace to sign in."); } catch { setError("Sign-out could not be confirmed. Retry when connected."); } finally { setBusy(false); } }
  return <StaffFrame area={workspace} current="profile" authorized={!!profile} role={profile?.role} busy={busy} onSignOut={logout}><main>
    <DemoHeader title="Account profile" subtitle="Your current account and session, verified by the server." /><SafetyNotice /><ErrorMessage message={error} />
    {busy ? <p role="status">Checking account access…</p> : profile ? <section className="card account-profile"><h2>{roleLabel(profile.role)} account</h2><dl className="status-list">
      <div><dt>Account reference</dt><dd><code>{profile.account_id}</code></dd></div><div><dt>Role</dt><dd>{roleLabel(profile.role)}</dd></div><div><dt>Account enabled</dt><dd>{profile.enabled ? "Yes" : "No"}</dd></div><div><dt>Created</dt><dd>{new Date(profile.created_at).toLocaleString()}</dd></div><div><dt>Account expiry</dt><dd>{profile.account_expires_at ? new Date(profile.account_expires_at).toLocaleString() : "No account deadline configured; session expiry still applies"}</dd></div><div><dt>Remember me</dt><dd>{profile.remember_me ? "Enabled for this session" : "Not enabled"}</dd></div><div><dt>Current session deadline</dt><dd>{new Date(profile.session_expires_at).toLocaleString()}</dd></div>
    </dl><p className="hint">No password, login handle, token, student identity or case contents are displayed. A researcher account grants the existing component directory only; research pages, datasets and case access are not implied.</p><button className="secondary" onClick={() => void read()}>Refresh account</button></section> : <p className="empty">No current protected account information. Sign in through your workspace.</p>}
    <p className="demo-nav"><a href={landing}>{profile ? "Return to workspace" : "Open workspace sign-in"}</a>{!profile && <button className="secondary" disabled={busy} onClick={() => void read()}>Check account access</button>}</p>
  </main></StaffFrame>;
}
