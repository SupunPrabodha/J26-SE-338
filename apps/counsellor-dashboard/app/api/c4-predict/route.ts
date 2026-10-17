import { NextResponse } from "next/server";
import type { C4PredictionRequest, C4PredictionResponse } from "@j26/common/contracts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as C4PredictionRequest;

    if (!body || !body.text || !body.text.trim()) {
      return NextResponse.json(
        { error: "Input text is required for prediction." },
        { status: 422 }
      );
    }

    const candidateUrls = [
      process.env.XAI_URL,
      process.env.XAI_INTERNAL_URL,
      "http://xai:8000/internal/v1/dev/predict",
      "http://127.0.0.1:8000/internal/v1/dev/predict",
    ].filter(Boolean) as string[];

    let lastError: Error | null = null;

    for (const rawUrl of candidateUrls) {
      const url = rawUrl.endsWith("/internal/v1/dev/predict")
        ? rawUrl
        : `${rawUrl.replace(/\/+$/, "")}/internal/v1/dev/predict`;

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
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
        } else if (response.status === 403 || response.status === 422) {
          const errorData = await response.json().catch(() => ({}));
          return NextResponse.json(errorData, { status: response.status });
        }
      } catch (err) {
        lastError = err as Error;
      }
    }

    return NextResponse.json(
      {
        error: "XAI prediction service is unavailable. Please verify the service is running.",
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
