"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { FeatureContribution } from "@j26/common/contracts";

const DynamicPlotlyWaterfall = dynamic(() => import("./PlotlyWaterfall"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "260px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        borderRadius: "8px",
        border: "1px dashed #e2e8f0",
        color: "#64748b",
        fontSize: "12px",
        gap: "6px",
      }}
    >
      <div style={{ fontWeight: 600 }}>Loading SHAP Waterfall Plot...</div>
      <div style={{ fontSize: "11px", color: "#94a3b8" }}>Client-side rendering active</div>
    </div>
  ),
});

interface WaterfallChartProps {
  baseValue: number | null | undefined;
  outputValue: number | null | undefined;
  contributions: FeatureContribution[];
  targetClass: string | null;
}

export function WaterfallChart({
  baseValue,
  outputValue,
  contributions,
  targetClass,
}: WaterfallChartProps) {
  if (
    baseValue === null ||
    baseValue === undefined ||
    outputValue === null ||
    outputValue === undefined ||
    !contributions ||
    contributions.length === 0
  ) {
    const missingFields: string[] = [];
    if (baseValue === null || baseValue === undefined) missingFields.push("base_value");
    if (outputValue === null || outputValue === undefined) missingFields.push("output_value");
    if (!contributions || contributions.length === 0) missingFields.push("contributions");

    return (
      <div className="empty-panel" role="status">
        <div className="empty-icon">🌊</div>
        <h3>No SHAP Waterfall / Force Plot Available</h3>
        <p>
          SHAP explanation data incomplete. Missing required backend field(s):{" "}
          <strong>{missingFields.join(", ")}</strong>.
        </p>
        <p className="hint">
          Note: In accordance with research standards, single-example explanations utilize local waterfall/force views. Beeswarm plots are designed for dataset-level multi-example distributions and are not shown for individual predictions.
        </p>
      </div>
    );
  }

  return (
    <div className="waterfall-container" aria-label="SHAP Local Waterfall Plot">
      <div className="waterfall-header" style={{ marginBottom: "8px" }}>
        <div>
          <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
            SHAP Additive Waterfall View
          </h4>
          <p className="subtitle" style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>
            Local decomposition: Base expectation E[f(x)] → Feature contributions Σφ_i → Final f(x)
          </p>
        </div>
        <div className="waterfall-summary-pill" style={{ fontSize: "11px", color: "#475569" }}>
          <span>
            Target: <strong style={{ color: "#4f46e5" }}>{targetClass || "Selected Class"}</strong>
          </span>
        </div>
      </div>

      <div className="waterfall-scales" style={{ display: "flex", alignItems: "center", gap: "10px", margin: "6px 0 10px" }}>
        <div className="scale-metric" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "4px 8px" }}>
          <span className="scale-label" style={{ fontSize: "10px", color: "#64748b", display: "block" }}>
            Base Value E[f(x)]
          </span>
          <span className="scale-val" style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
            {baseValue.toFixed(4)}
          </span>
        </div>
        <div className="scale-arrow" style={{ color: "#94a3b8", fontWeight: 700 }}>→</div>
        <div className="scale-metric output-metric" style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: "6px", padding: "4px 8px" }}>
          <span className="scale-label" style={{ fontSize: "10px", color: "#4338ca", display: "block" }}>
            Output Score f(x)
          </span>
          <span className="scale-val" style={{ fontSize: "12px", fontWeight: 700, color: "#4f46e5" }}>
            {outputValue.toFixed(4)}
          </span>
        </div>
      </div>

      <DynamicPlotlyWaterfall
        baseValue={baseValue}
        outputValue={outputValue}
        contributions={contributions}
        targetClass={targetClass}
        maxTopFeatures={8}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "10px",
          color: "#64748b",
          marginTop: "6px",
          borderTop: "1px solid #f1f5f9",
          paddingTop: "6px",
        }}
      >
        <span>
          <span style={{ color: "#ef4444", fontWeight: 700 }}>Red</span> pushes towards {targetClass || "target"}.{" "}
          <span style={{ color: "#16a34a", fontWeight: 700 }}>Green</span> opposes.
        </span>
        <span>
          Scale: Unified continuous model output
        </span>
      </div>
    </div>
  );
}
