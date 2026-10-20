"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

interface SentimentProbabilityChartProps {
  probabilities: { [sentiment: string]: number } | null | undefined;
  compact?: boolean;
}

const SENTIMENT_COLORS: { [key: string]: string } = {
  Negative: "#ef4444",
  Neutral: "#3b82f6",
  Positive: "#16a34a",
};

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      sentiment: string;
      percentage: number;
      probability: number;
    };
  }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const color = SENTIMENT_COLORS[data.sentiment] || "#6366f1";

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "6px",
        padding: "6px 10px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        fontSize: "11px",
      }}
    >
      <div style={{ fontWeight: 700, color }}>{data.sentiment}</div>
      <div style={{ color: "#0f172a", marginTop: "2px" }}>
        Probability: <strong>{(data.probability * 100).toFixed(1)}%</strong> ({data.probability.toFixed(4)})
      </div>
    </div>
  );
}

export function SentimentProbabilityChart({
  probabilities,
  compact = false,
}: SentimentProbabilityChartProps) {
  if (!probabilities || Object.keys(probabilities).length === 0) {
    return (
      <div
        style={{
          padding: "8px 12px",
          background: "#fff1f2",
          border: "1px dashed #fecdd3",
          borderRadius: "6px",
          color: "#9f1239",
          fontSize: "11px",
          textAlign: "center",
          margin: "6px 0",
        }}
        role="status"
      >
        Sentiment probability distribution unavailable: missing &apos;probabilities&apos; in response.
      </div>
    );
  }

  const items = ["Negative", "Neutral", "Positive"].map((cls) => {
    const prob = probabilities[cls] ?? 0;
    return {
      sentiment: cls,
      probability: prob,
      percentage: Math.round(prob * 100),
      fill: SENTIMENT_COLORS[cls] || "#6366f1",
    };
  });

  return (
    <div style={{ width: "100%", marginTop: compact ? "4px" : "8px", marginBottom: "6px" }}>
      {/* Top summary row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "10.5px",
          marginBottom: "4px",
          fontWeight: 600,
        }}
      >
        <span style={{ color: "#ef4444" }}>Negative: {items[0].percentage}%</span>
        <span style={{ color: "#3b82f6" }}>Neutral: {items[1].percentage}%</span>
        <span style={{ color: "#16a34a" }}>Positive: {items[2].percentage}%</span>
      </div>

      <div style={{ width: "100%", height: compact ? "38px" : "48px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={items}
            layout="vertical"
            margin={{ top: 0, right: 35, left: 0, bottom: 0 }}
          >
            <XAxis type="number" domain={[0, 1]} hide />
            <YAxis
              type="category"
              dataKey="sentiment"
              width={50}
              tick={{ fontSize: 9.5, fill: "#475569", fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="probability" radius={[0, 4, 4, 0]}>
              {items.map((entry) => (
                <Cell key={`prob-${entry.sentiment}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface LocalProbabilityChartProps {
  targetClass: string;
  targetProbability: number | null | undefined;
}

export function LocalProbabilityChart({
  targetClass,
  targetProbability,
}: LocalProbabilityChartProps) {
  if (targetProbability === null || targetProbability === undefined) {
    return (
      <div
        style={{
          padding: "8px 12px",
          background: "#fff1f2",
          border: "1px dashed #fecdd3",
          borderRadius: "6px",
          color: "#9f1239",
          fontSize: "11px",
          textAlign: "center",
          margin: "6px 0",
        }}
        role="status"
      >
        Local probability unavailable: missing &apos;target_class_probability&apos; in explanation.
      </div>
    );
  }

  const opposingProb = Math.max(0, 1 - targetProbability);

  const data = [
    {
      category: targetClass,
      probability: targetProbability,
      percentage: Math.round(targetProbability * 100),
      fill: "#ef4444",
    },
    {
      category: "Opposing",
      probability: opposingProb,
      percentage: Math.round(opposingProb * 100),
      fill: "#16a34a",
    },
  ];

  return (
    <div style={{ width: "100%", height: "55px", marginTop: "4px", marginBottom: "8px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 35, left: 10, bottom: 0 }}
        >
          <XAxis type="number" domain={[0, 1]} hide />
          <YAxis
            type="category"
            dataKey="category"
            width={65}
            tick={{ fontSize: 10, fill: "#0f172a", fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: any) => [`${(Number(value) * 100).toFixed(1)}% (${Number(value).toFixed(4)})`, "Probability"]}
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "11px",
            }}
          />
          <Bar dataKey="probability" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={`local-${entry.category}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
