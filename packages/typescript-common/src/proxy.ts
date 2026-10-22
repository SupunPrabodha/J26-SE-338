// Server-only same-origin adapter. Ports share a cookie jar, so each app has a namespace.
export async function proxy(request: Request, application: "student" | "counsellor"): Promise<Response> {
  const headers = new Headers();
  for (const name of ["content-type", "origin", "x-requested-with"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const prefix = `j26_${application}_`;
  const cookies = (request.headers.get("cookie") || "").split(";").map(c => c.trim())
    .filter(c => c.startsWith(prefix + "access=") || c.startsWith(prefix + "refresh="))
    .map(c => c.replace(prefix, "j26_"));
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  const incoming = new URL(request.url);
  const upstream = new URL(process.env.API_INTERNAL_URL || "http://localhost:8000");
  upstream.pathname = incoming.pathname;
  upstream.search = incoming.search;
  try {
    const response = await fetch(upstream, {
      method: request.method, headers, cache: "no-store", redirect: "error",
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      signal: AbortSignal.timeout(10000),
    });
    const outgoing = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["content-type", "date"]) {
      const value = response.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    for (const cookie of response.headers.getSetCookie()) {
      if (/^j26_(access|refresh)=/.test(cookie)) outgoing.append("Set-Cookie", cookie.replace(/^j26_/, prefix));
    }
    return new Response(response.body, { status: response.status, headers: outgoing });
  } catch {
    return Response.json({ schema_version: "1.0.0", synthetic: true, development_only: true,
      error_code: "DEPENDENCY_UNAVAILABLE", correlation_id: crypto.randomUUID(),
      message: "Request could not be completed safely." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
