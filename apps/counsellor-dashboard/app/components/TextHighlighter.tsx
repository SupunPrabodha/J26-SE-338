"use client";

import { useMemo } from "react";
import type { FeatureContribution } from "@j26/common/contracts";

interface TextHighlighterProps {
  text: string;
  contributions: FeatureContribution[];
  targetClass: string | null;
}

export function TextHighlighter({
  text,
  contributions,
  targetClass,
}: TextHighlighterProps) {
  // Build lookup map from token to weight
  const weightMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!contributions || contributions.length === 0) return map;
    for (const item of contributions) {
      // Normalize token string for lookup
      const cleaned = item.token.trim().toLowerCase();
      if (cleaned) {
        map.set(cleaned, item.weight);
      }
    }
    return map;
  }, [contributions]);

  const maxAbsWeight = useMemo(() => {
    if (!contributions || contributions.length === 0) return 1.0;
    return Math.max(...contributions.map((c) => Math.abs(c.weight)), 0.001);
  }, [contributions]);

  // Tokenize text by whitespace while preserving punctuation
  const words = useMemo(() => {
    if (!text) return [];
    return text.split(/(\s+)/);
  }, [text]);

  if (!text) {
    return (
      <div className="empty-panel" role="status">
        <p>No reflection text entered yet. Enter or select a sample reflection above.</p>
      </div>
    );
  }

  const hasExplanations = contributions && contributions.length > 0;

  return (
    <div className="text-highlighter-card" aria-label="Attribution highlighted text">
      <div className="highlighter-header">
        <h4>In-Context Reflection Highlights</h4>
        {hasExplanations ? (
          <span className="highlighter-hint">
            Hover over highlighted words to inspect attribution scores for {targetClass || "Selected Class"}.
          </span>
        ) : (
          <span className="highlighter-hint pending">
            Highlights awaiting C3 classifier integration.
          </span>
        )}
      </div>

      <div className="highlighted-text-body">
        {words.map((chunk, index) => {
          if (/^\s+$/.test(chunk)) {
            return <span key={index}>{chunk}</span>;
          }

          // Strip simple boundary punctuation for matching
          const cleanWord = chunk.replace(/^[^\w\u0D80-\u0DFF]+|[^\w\u0D80-\u0DFF]+$/gu, "").toLowerCase();
          const weight = weightMap.get(cleanWord) ?? weightMap.get(chunk.toLowerCase());

          if (weight === undefined || !hasExplanations) {
            return (
              <span key={index} className="word-normal">
                {chunk}
              </span>
            );
          }

          const isPositive = weight >= 0;
          const ratio = Math.min(1.0, Math.abs(weight) / maxAbsWeight);
          const opacity = Math.max(0.18, ratio * 0.75);

          const bgColor = isPositive
            ? `rgba(99, 102, 241, ${opacity})` // Purple for positive support
            : `rgba(239, 68, 68, ${opacity})`; // Red for opposing

          return (
            <mark
              key={index}
              className={`highlight-word ${isPositive ? "supports" : "opposes"}`}
              style={{ backgroundColor: bgColor }}
              title={`Word: "${chunk}" | Weight: ${weight > 0 ? "+" : ""}${weight.toFixed(4)} (${isPositive ? "Supports" : "Opposes"} ${targetClass || "class"})`}
            >
              {chunk}
            </mark>
          );
        })}
      </div>
    </div>
  );
}
