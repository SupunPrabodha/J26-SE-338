import { proxy } from "@j26/common/proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = (request: Request) => proxy(request, "student");
export const POST = GET;
