import { NextResponse } from "next/server";
import type { C4PredictionRequest, C4PredictionResponse } from "@j26/common/contracts";

export const dynamic = "force-dynamic";

const ALLOWED_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  return ALLOWED_ORIGIN_REGEX.test(origin);
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!isAllowedOrigin(origin)) {
      return NextResponse.json({ error: "Disallowed origin" }, { status: 403 });
    }

    const body = (await request.json()) as C4PredictionRequest;

    if (!body || !body.text || !body.text.trim()) {
      return NextResponse.json(
        { error: "Input text is required for prediction." },
        { status: 422 }
      );
    }

    if (body.text.length > 2000) {
      return NextResponse.json(
        { error: "Input text exceeds maximum allowed length of 2000 characters." },
        { status: 422 }
      );
    }

    // Route browser requests through the authenticated orchestrator
    const orchestratorUrls = [
      process.env.API_INTERNAL_URL ? `${process.env.API_INTERNAL_URL}/api/v1/c4/predict` : null,
      "http://orchestrator:8000/api/v1/c4/predict",
      "http://127.0.0.1:8000/api/v1/c4/predict",
      "http://localhost:8000/api/v1/c4/predict",
    ].filter(Boolean) as string[];

    const cookieHeader = request.headers.get("cookie") || "";
    let lastError: Error | null = null;

    for (const url of orchestratorUrls) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "j26-browser",
            Origin: origin || "http://localhost:3001",
            Cookie: cookieHeader,
          },
          body: JSON.stringify({
            text: body.text,
            language: body.language,
          }),
          cache: "no-store",
        });

        if (response.ok) {
          const data = (await response.json()) as C4PredictionResponse;
          return NextResponse.json(data);
        } else if (response.status === 401 || response.status === 403 || response.status === 422) {
          const errorData = await response.json().catch(() => ({}));
          const fallbackError =
            response.status === 401
              ? "Authentication required. Please sign in to the Counsellor Dashboard with your development credentials."
              : response.status === 403
              ? "Access forbidden. Authorized counsellor account required."
              : "Invalid prediction request.";
          return NextResponse.json(
            { error: errorData.error || errorData.message || fallbackError, ...errorData },
            { status: response.status }
          );
        }
      } catch (err) {
        lastError = err as Error;
      }
    }

    return NextResponse.json(
      {
        error: "Prediction service is unavailable. Please verify orchestrator and XAI services are running.",
        details: lastError?.message,
      },
      { status: 503 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }
}

