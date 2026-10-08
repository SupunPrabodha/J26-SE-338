export async function api<T>(path: string, body?: unknown, retry = true): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Requested-With": "j26-browser" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    await api("/auth/refresh", {}, false);
    return api<T>(path, body, false);
  }
  if (!response.ok) {
    // Never display server bodies or submitted text in an error.
    throw new Error(response.status === 401 ? "Your session has ended. Please sign in again." :
      response.status === 403 ? "This action is not authorized or consent is no longer active." :
      response.status === 429 ? "Too many attempts. Please wait a minute." :
      "The request could not be completed. Please retry or check the development services.");
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
