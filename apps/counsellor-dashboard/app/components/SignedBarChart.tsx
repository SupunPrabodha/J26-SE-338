"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
  CartesianGrid,
} from "recharts";
import type { FeatureContribution } from "@j26/common/contracts";

interface SignedBarChartProps {
  contributions: FeatureContribution[];
  method: "LIME" | "SHAP";
  targetClass: string | null;
  maxDisplay?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      token: string;
      weight: number;
      absWeight: number;
      direction: string;
      formattedWeight: string;
    };
  }>;
  targetClass: string | null;
}

function CustomTooltip({ active, payload, targetClass }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const isPositive = data.weight >= 0;

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "6px",
        padding: "8px 12px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
        fontSize: "11px",
      }}
    >
      <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>
        Feature: &quot;{data.token}&quot;
      </div>
      <div style={{ display: "flex", gap: "6px", marginBottom: "2px" }}>
        <span style={{ color: "#64748b" }}>Weight:</span>
        <strong style={{ color: isPositive ? "#ef4444" : "#16a34a" }}>
          {data.formattedWeight}
        </strong>
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <span style={{ color: "#64748b" }}>Impact:</span>
        <span style={{ color: isPositive ? "#dc2626" : "#15803d", fontWeight: 600 }}>
          {isPositive ? `Supports ${targetClass || "class"}` : `Opposes ${targetClass || "class"}`}
        </span>
      </div>
    </div>
  );
}

export function SignedBarChart({
  contributions,
  method,
  targetClass,
  maxDisplay = 10,
}: SignedBarChartProps) {
  const missingFields: string[] = [];
  if (!contributions || contributions.length === 0) missingFields.push("contributions");

  if (missingFields.length > 0) {
    return (
      <div className="empty-panel" role="status">
        <div className="empty-icon">📈</div>
        <h3>No Attribution Bar Chart Available</h3>
        <p>
          Explanation data incomplete. Missing required field(s):{" "}
          <strong>{missingFields.join(", ")}</strong>. Feature importance bars will be plotted when explanation results are received.
        </p>
      </div>
    );
  }

  // Sort a copy by descending absolute weight to preserve original token order for text highlighting
  const sortedContributions = [...contributions].sort(
    (a, b) => Math.abs(b.weight) - Math.abs(a.weight)
  );
  const items = sortedContributions.slice(0, maxDisplay);
  const maxAbsWeight = Math.max(...items.map((c) => Math.abs(c.weight)), 0.05);

  const chartData = items.map((c) => ({
    token: c.token,
    weight: c.weight,
    absWeight: Math.abs(c.weight),
    direction: c.direction,
    formattedWeight: (c.weight >= 0 ? "+" : "") + c.weight.toFixed(4),
  }));

  // Height dynamic to number of displayed items
  const chartHeight = Math.max(220, chartData.length * 24 + 50);

  return (
    <div className="signed-chart-container" aria-label={`${method} Diverging Signed Bar Chart`}>
      <div
        className="chart-legend"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "10.5px",
          color: "#475569",
          padding: "4px 8px 8px",
          borderBottom: "1px solid #f1f5f9",
          marginBottom: "6px",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#16a34a" }} />
          <span>Opposes {targetClass || "Class"} (&lt; 0)</span>
        </span>
        <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 600 }}>
          0.00 (Neutral Baseline)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#ef4444" }} />
          <span>Supports {targetClass || "Class"} (&gt; 0)</span>
        </span>
      </div>

      <div style={{ width: "100%", height: `${chartHeight}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 24, left: 24, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis
              type="number"
              domain={[-Math.ceil(maxAbsWeight * 12) / 10, Math.ceil(maxAbsWeight * 12) / 10]}
              tickFormatter={(v: number) => v.toFixed(2)}
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={{ stroke: "#cbd5e1" }}
            />
            <YAxis
              type="category"
              dataKey="token"
              width={90}
              tick={{ fontSize: 11, fill: "#0f172a", fontWeight: 600 }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={false}
            />
            <ReferenceLine
              x={0}
              stroke="#64748b"
              strokeWidth={1.5}
              label={{
                value: "0.00",
                position: "insideTop",
                fill: "#64748b",
                fontSize: 9,
                fontWeight: 600,
              }}
            />
            <Tooltip content={<CustomTooltip targetClass={targetClass} />} />
            <Bar dataKey="weight" radius={[3, 3, 3, 3]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.weight >= 0 ? "#ef4444" : "#16a34a"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
