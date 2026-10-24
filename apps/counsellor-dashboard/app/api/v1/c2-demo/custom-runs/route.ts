/** C2-only cold-model proxy. Authorization remains in the existing gateway. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const name of ["cookie", "origin", "x-requested-with", "x-correlation-id"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL || "http://localhost:8000"}/api/v1/c2-demo/custom-runs`, {
      method: "POST", headers, body: await request.text(), cache: "no-store",
      redirect: "manual", signal: AbortSignal.any([request.signal, AbortSignal.timeout(310_000)]),
    });
    const returned = new Headers({ "Cache-Control": "no-store", "Content-Type": "application/json" });
    const correlation = response.headers.get("x-correlation-id");
    if (correlation) returned.set("x-correlation-id", correlation);
    return new Response(await response.arrayBuffer(), { status: response.status, headers: returned });
  } catch {
    // Never expose upstream exceptions, request text, cookies or model paths.
    return Response.json({ error_code: "DOWNSTREAM_FAILED" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
