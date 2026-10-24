import { afterEach, expect, test, vi } from "vitest";
import { api, adminApi, ApiError } from "../../packages/typescript-common/src/api";
import { proxy } from "../../packages/typescript-common/src/proxy";

afterEach(() => vi.unstubAllGlobals());
const response = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

test("simultaneous expiry requests share rotation and retry each original once", async () => {
  let valid = false, rotations = 0;
  const fetch = vi.fn(async (path: string) => {
    if (path.endsWith("/auth/refresh")) { rotations++; valid = true; return response(200); }
    return response(valid ? 200 : 401, valid ? { role: "STUDENT" } : { error_code: "AUTH_REQUIRED" });
  });
  vi.stubGlobal("fetch", fetch);
  await Promise.all([api("/demo/runs"), api("/consents/synthetic/lifecycle"), api("/auth/me")]);
  expect(rotations).toBe(1);
  expect(fetch.mock.calls.filter(([p]) => p.endsWith("/demo/runs"))).toHaveLength(2);
});

test("admin concurrent expiry shares rotation in its own auth namespace", async () => {
  let valid = false, rotations = 0;
  const fetcher = vi.fn(async (path: string) => {
    if (path === "/api/v1/admin-auth/refresh") { valid = true; rotations++; return response(200, { role: "ADMIN" }); }
    return response(valid ? 200 : 401, valid ? { role: "ADMIN" } : { error_code: "AUTH_REQUIRED" });
  });
  vi.stubGlobal("fetch", fetcher);
  await Promise.all([adminApi("/admin/audit-events"), adminApi("/auth/me")]);
  expect(rotations).toBe(1);
  expect(fetcher.mock.calls.every(([path]) => path.includes("/admin/") || path.includes("/admin-auth/"))).toBe(true);
});

test("late old 401 probes refreshed cookies instead of rotating or clearing a newer session", async () => {
  let valid = false, rotations = 0, release: (value: Response) => void = () => {};
  let slowCalls = 0;
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path.endsWith("/slow") && ++slowCalls === 1) return new Promise<Response>(resolve => { release = resolve; });
    if (path.endsWith("/auth/refresh")) { rotations++; valid = true; return response(200); }
    return response(valid ? 200 : 401);
  }));
  const late = api("/slow"); await api("/demo/runs"); release(response(401)); await late;
  expect(rotations).toBe(1); expect(slowCalls).toBe(2);
});

test("separate tab modules serialize through Web Locks and recheck before rotation", async () => {
  let valid = false, rotations = 0;
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path.endsWith("/auth/refresh")) { rotations++; valid = true; return response(200); }
    return response(valid ? 200 : 401);
  }));
  vi.resetModules(); const other = await import("../../packages/typescript-common/src/api");
  await Promise.all([api("/demo/runs"), other.api("/demo/runs")]);
  expect(rotations).toBe(1);
});

test("revoked refresh stops retries and does not loop", async () => {
  const fetch = vi.fn(async () => response(401, { error_code: "AUTH_INVALID" })); vi.stubGlobal("fetch", fetch);
  await expect(api("/review-tasks")).rejects.toMatchObject({ status: 401, code: "AUTH_INVALID" });
  expect(fetch.mock.calls).toHaveLength(3); // original, probe, one refresh
});

test("a second 401 after successful refresh is terminal", async () => {
  const fetch = vi.fn(async (path: string) => response(path.endsWith("/auth/refresh") ? 200 : 401)); vi.stubGlobal("fetch", fetch);
  await expect(api("/review-tasks")).rejects.toMatchObject({ status: 401 });
  expect(fetch.mock.calls.filter(([p]) => p.endsWith("/auth/refresh"))).toHaveLength(1);
});

test.each(["CONSENT_INVALID", "CONSENT_REQUIRED", "FORBIDDEN"])("403 %s is not refreshed or reported as login expiry", async code => {
  const fetch = vi.fn(async () => response(403, { error_code: code, message: "SYNTHETIC_PRIVATE_SENTINEL" })); vi.stubGlobal("fetch", fetch);
  const error = await api("/submissions", {}).catch(e => e);
  expect(error).toBeInstanceOf(ApiError); expect(error.code).toBe(code);
  expect(error.message).not.toContain("SYNTHETIC_PRIVATE_SENTINEL"); expect(error.message).not.toContain("session has ended");
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("network failure is not consent withdrawal or authentication expiry", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("SYNTHETIC_PRIVATE_SENTINEL")));
  await expect(api("/demo/runs")).rejects.toMatchObject({ status: 503, message: expect.stringContaining("does not indicate consent withdrawal") });
});

test("logout waits for in-flight renewal then revokes the resulting family", async () => {
  const order: string[] = []; let release: () => void = () => {};
  const rotating = new Promise<void>(resolve => { release = resolve; });
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path.endsWith("/auth/me")) return response(401);
    if (path.endsWith("/auth/refresh")) { order.push("refresh-start"); await rotating; order.push("refresh-done"); return response(200); }
    order.push("logout"); return new Response(null, { status: 204 });
  }));
  const renewing = api("/auth/refresh", {});
  await vi.waitFor(() => expect(order).toContain("refresh-start"));
  const logout = api("/auth/logout", {}); release(); await Promise.all([renewing, logout]);
  expect(order).toEqual(["refresh-start", "refresh-done", "logout"]);
});

test("proxy isolates app cookies, preserves Set-Cookie attributes and ignores legacy/auth headers", async () => {
  const fetch = vi.fn(async () => {
    const headers = new Headers();
    headers.append("Set-Cookie", "j26_access=synthetic-access; HttpOnly; Max-Age=300; Path=/api/v1; SameSite=strict; Secure");
    headers.append("Set-Cookie", "j26_refresh=; Max-Age=0; Path=/api/v1; HttpOnly; SameSite=strict");
    return new Response("{}", { headers });
  });
  vi.stubGlobal("fetch", fetch);
  const result = await proxy(new Request("http://localhost:3000/api/v1/auth/me", { headers: {
    Cookie: "j26_student_access=synthetic-student; j26_counsellor_access=synthetic-counsellor; j26_access=synthetic-legacy",
    Authorization: "synthetic-untrusted", Origin: "http://localhost:3000",
  } }), "student");
  const forwarded = (fetch.mock.calls as unknown as [URL, RequestInit][])[0][1].headers as Headers;
  expect(forwarded.get("cookie")).toBe("j26_access=synthetic-student");
  expect(forwarded.has("authorization")).toBe(false);
  expect(result.headers.getSetCookie()).toEqual([
    "j26_student_access=synthetic-access; HttpOnly; Max-Age=300; Path=/api/v1; SameSite=strict; Secure",
    "j26_student_refresh=; Max-Age=0; Path=/api/v1; HttpOnly; SameSite=strict",
  ]);
});

test("unsupported cross-tab coordination fails safely without racing a refresh", async () => {
  Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  const fetch = vi.fn(async () => response(401)); vi.stubGlobal("fetch", fetch);
  await expect(api("/demo/runs")).rejects.toMatchObject({ status: 503 });
  expect(fetch).toHaveBeenCalledTimes(1);
});
test.each(["admin", "research"] as const)("%s browser cookies are namespaced and auth mapping preserves backend guards", async realm => {
  const { proxy } = await import("../../packages/typescript-common/src/proxy");
  const fetcher = vi.fn(async () => new Response("{}", { headers: { "Set-Cookie": "j26_access=synthetic-cookie; HttpOnly; SameSite=Strict; Path=/api/v1" } }));
  vi.stubGlobal("fetch", fetcher);
  const response = await proxy(new Request(`http://localhost:3001/api/v1/${realm}-auth/me`, { headers: { cookie: `j26_counsellor_access=other; j26_student_access=other; j26_admin_access=synthetic-admin; j26_research_access=synthetic-research` } }), realm);
  expect(String(fetcher.mock.calls[0][0])).toContain("/api/v1/auth/me");
  expect(fetcher.mock.calls[0][1].headers.get("cookie")).toBe(`j26_access=synthetic-${realm}`);
  expect(response.headers.get("set-cookie")).toContain(`j26_${realm}_access=`);
});
