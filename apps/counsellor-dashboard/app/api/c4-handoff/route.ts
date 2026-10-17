import { NextResponse } from "next/server";

// Transient in-memory handoff store for development only
// Automatically expires entries after 120 seconds.
interface HandoffItem {
  text: string;
  language: string;
  prediction: unknown;
  targetClass: string;
  expiresAt: number;
}

const handoffStore = new Map<string, HandoffItem>();

// Periodic cleanup of expired handoffs
function cleanExpired() {
  const now = Date.now();
  for (const [key, item] of handoffStore.entries()) {
    if (item.expiresAt < now) {
      handoffStore.delete(key);
    }
  }
}

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(request: Request) {
  cleanExpired();
  try {
    const body = await request.json();
    if (!body || !body.text || typeof body.text !== "string" || !body.text.trim()) {
      return NextResponse.json({ error: "Text is required for handoff." }, { status: 422 });
    }

    const handoffId = `c4_${crypto.randomUUID().replace(/-/g, "")}`;
    handoffStore.set(handoffId, {
      text: body.text.trim().slice(0, 2000),
      language: body.language || "English",
      prediction: body.prediction || null,
      targetClass: body.targetClass || "Negative",
      expiresAt: Date.now() + 120_000, // 2 minutes TTL
    });

    return NextResponse.json(
      { handoffId },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch {
    return NextResponse.json({ error: "Invalid handoff payload." }, { status: 400 });
  }
}

export async function GET(request: Request) {
  cleanExpired();
  const url = new URL(request.url);
  const handoffId = url.searchParams.get("handoffId");

  if (!handoffId || !handoffStore.has(handoffId)) {
    return NextResponse.json({ error: "Handoff expired or not found." }, { status: 404 });
  }

  const item = handoffStore.get(handoffId)!;
  // Consume immediately: single-use opaque handoff
  handoffStore.delete(handoffId);

  if (item.expiresAt < Date.now()) {
    return NextResponse.json({ error: "Handoff expired." }, { status: 410 });
  }

  return NextResponse.json(
    {
      text: item.text,
      language: item.language,
      prediction: item.prediction,
      targetClass: item.targetClass,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
