import { NextResponse } from "next/server";
import type { C4ExplanationRequest, C4ExplanationResponse } from "@j26/common/contracts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as C4ExplanationRequest;

    if (!body || !body.text || !body.text.trim()) {
      return NextResponse.json(
        { error: "Input text is required for explanation." },
        { status: 422 }
      );
    }

    if (!body.method || !["LIME", "SHAP"].includes(body.method)) {
      return NextResponse.json(
        { error: "Valid explanation method (LIME or SHAP) is required." },
        { status: 422 }
      );
    }

    const candidateUrls = [
      process.env.XAI_URL,
      process.env.XAI_INTERNAL_URL,
      "http://xai:8000/internal/v1/dev/explain",
      "http://host.docker.internal:8002/internal/v1/dev/explain",
      "http://127.0.0.1:8002/internal/v1/dev/explain",
      "http://127.0.0.1:8000/internal/v1/dev/explain",
    ].filter(Boolean) as string[];

    let lastError: Error | null = null;

    for (const rawUrl of candidateUrls) {
      const url = rawUrl.endsWith("/internal/v1/dev/explain")
        ? rawUrl
        : `${rawUrl.replace(/\/+$/, "")}/internal/v1/dev/explain`;

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: body.text,
            method: body.method,
            target_class: body.target_class,
            language: body.language,
          }),
          cache: "no-store",
        });

        if (response.ok) {
          const data = (await response.json()) as C4ExplanationResponse;
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
        error: "XAI explanation service is unavailable. Please verify the service is running.",
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
