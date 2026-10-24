import { proxy } from "@j26/common/proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = (request: Request) => {
  const path = new URL(request.url).pathname;
  return proxy(request, path.startsWith("/api/v1/admin/") || path.startsWith("/api/v1/admin-auth/") ? "admin" : path.startsWith("/api/v1/research-auth/") || path === "/api/v1/component-routes" ? "research" : "counsellor");
};
export const POST = GET;
