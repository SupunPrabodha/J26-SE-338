export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: string) { super(message); }
}

const messages: Record<string, string> = {
  AUTH_REQUIRED: "Your session has ended. Please sign in again.",
  AUTH_INVALID: "Your session has ended. Please sign in again.",
  FORBIDDEN: "This request is not authorized. Check the signed-in role and application.",
  CONSENT_REQUIRED: "This action requires a consent record. Refresh the consent status.",
  CONSENT_INVALID: "Consent policy blocks this action. Refresh its status to check expiry, withdrawal or validity.",
  NOT_FOUND: "This resource is unavailable to your session. Refresh the current view.",
  RATE_LIMITED: "Too many attempts. Please wait a minute.",
  DEPENDENCY_UNAVAILABLE: "A service is unavailable. Please retry; this does not indicate consent withdrawal.",
  CONFLICT: "The record or assignment changed, or this action is not allowed in its current state. Refresh and review before retrying.",
  CONTRACT_INVALID: "Check the required fields and permitted values, then retry.",
};

async function failure(response: Response): Promise<ApiError> {
  let code: string | undefined;
  try { const body = await response.json(); if (typeof body.error_code === "string" && Object.hasOwn(messages, body.error_code)) code = body.error_code; } catch { /* Never display response bodies. */ }
  return new ApiError(response.status, code ? messages[code] : response.status === 401 ? messages.AUTH_INVALID :
    response.status === 403 ? "This action was denied. Refresh your session and consent status for details." :
    response.status === 429 ? messages.RATE_LIMITED : "The request could not be completed. Check the connection or development services; consent withdrawal is not implied.", code);
}

async function request(path: string, body?: unknown, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(`/api/v1${path}`, {
      method: body === undefined ? "GET" : "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Requested-With": "j26-browser" },
      body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(503, "The connection failed. Retry when available; this does not indicate consent withdrawal.");
  }
}

async function sessionLock<T>(operation: () => Promise<T>, name = "j26-session-transition"): Promise<T> {
  // Web Locks coordinates same-origin tabs without storing credentials or auth flags.
  // Never silently race rotation in browsers lacking cross-tab coordination.
  if (!globalThis.navigator?.locks) throw new ApiError(503, "Session renewal requires a browser with Web Locks support. Use a current supported browser and retry.");
  return navigator.locks.request(name, { signal: AbortSignal.timeout(8000) }, operation);
}

function createClient(realm: "default" | "admin" | "research" = "default") {
const send = (path: string, body?: unknown, signal?: AbortSignal) => request(realm !== "default" && path.startsWith("/auth/") ? path.replace("/auth/", `/${realm}-auth/`) : path, body, signal);
const lock = <T,>(operation: () => Promise<T>) => sessionLock(operation, realm === "default" ? "j26-session-transition" : `j26-${realm}-session-transition`);
let renewal: Promise<unknown> | null = null;
async function renew(): Promise<unknown> {
  if (!renewal) {
    renewal = lock(async () => {
      // Another tab, or an earlier request, may already have refreshed. Probe inside the lock.
      const probe = await send("/auth/me", undefined, AbortSignal.timeout(8000));
      if (probe.ok) return probe.json();
      if (probe.status !== 401) throw await failure(probe);
      const refreshed = await send("/auth/refresh", {}, AbortSignal.timeout(8000));
      if (!refreshed.ok) throw await failure(refreshed);
      return refreshed.json();
    }).finally(() => { renewal = null; });
  }
  return renewal;
}

async function client<T>(path: string, body?: unknown, retry = true, signal?: AbortSignal): Promise<T> {
  if (path === "/auth/refresh") return await renew() as T;
  const perform = async () => {
    const response = await send(path, body, signal);
    if (!response.ok) throw await failure(response);
    return response.status === 204 ? undefined as T : response.json() as Promise<T>;
  };
  // Do not let a queued refresh finish after logout and restore revoked cookies.
  if (["/auth/login", "/auth/logout", "/auth/student-session"].includes(path)) return lock(perform);
  try { return await perform(); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !retry) throw error;
    await renew();
    signal?.throwIfAborted();
    return client<T>(path, body, false, signal);
  }
}
return client;
}

export const api = createClient();
export const adminApi = createClient("admin");
export const researchApi = createClient("research");
