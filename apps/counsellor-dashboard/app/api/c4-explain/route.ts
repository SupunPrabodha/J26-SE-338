import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error: "The unauthenticated c4-explain proxy path is closed. Explanations must be generated and persisted via the authenticated orchestrator endpoint /api/v1/c4/explanations.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: "The unauthenticated c4-explain proxy path is closed.",
    },
    { status: 410 }
  );
}

