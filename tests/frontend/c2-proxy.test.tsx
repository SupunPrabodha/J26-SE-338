import { afterEach, expect, test, vi } from "vitest";
import { POST } from "../../apps/counsellor-dashboard/app/api/v1/c2-demo/custom-runs/route";

afterEach(() => vi.unstubAllGlobals());

test("C2 proxy preserves authentication, exact input and no-cache response without selecting a fallback", async () => {
  const body = JSON.stringify({ text: "Fictional text 🙂", strategy: "gliner" });
  const fetch = vi.fn(async () => new Response('{"strategy":"gliner"}', { headers: { "x-correlation-id": "synthetic-correlation" } }));
  vi.stubGlobal("fetch", fetch);
  const response = await POST(new Request("http://localhost:3001/api/v1/c2-demo/custom-runs", {
    method: "POST", body, headers: { cookie: "synthetic=session", origin: "http://localhost:3001", "x-requested-with": "j26-browser" },
  }));
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, options] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toMatch(/\/api\/v1\/c2-demo\/custom-runs$/);
  expect(options.body).toBe(body);
  expect(new Headers(options.headers).get("cookie")).toBe("synthetic=session");
  expect(new Headers(options.headers).get("origin")).toBe("http://localhost:3001");
  expect(options.cache).toBe("no-store");
  expect(options.redirect).toBe("manual");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-correlation-id")).toBe("synthetic-correlation");
  expect(await response.json()).toEqual({ strategy: "gliner" });
});

test("C2 proxy preserves backend authorization failures and safely handles transport failure", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response('{"error_code":"AUTH_REQUIRED"}', { status: 401 })).mockRejectedValueOnce(new Error("PRIVATE-SENTINEL"));
  vi.stubGlobal("fetch", fetch);
  const request = () => new Request("http://localhost:3001/api/v1/c2-demo/custom-runs", { method: "POST", body: "{}" });
  expect((await POST(request())).status).toBe(401);
  const response = await POST(request());
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("PRIVATE-SENTINEL");
  expect(fetch).toHaveBeenCalledTimes(2);
});
