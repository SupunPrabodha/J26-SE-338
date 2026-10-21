"use client";

import React, { useMemo } from "react";
import Plotly from "plotly.js-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";
import type { FeatureContribution } from "@j26/common/contracts";

const Plot = createPlotlyComponent(Plotly);

interface PlotlyWaterfallProps {
  baseValue: number;
  outputValue: number;
  contributions: FeatureContribution[];
  targetClass: string | null;
  maxTopFeatures?: number;
}

export default function PlotlyWaterfall({
  baseValue,
  contributions,
  targetClass,
  maxTopFeatures = 8,
}: PlotlyWaterfallProps) {
  const { yLabels, xValues, measures, textLabels } = useMemo(() => {
    const y: string[] = ["Base value E[f(x)]"];
    const x: number[] = [baseValue];
    const m: ("absolute" | "relative" | "total")[] = ["absolute"];
    const t: string[] = [baseValue.toFixed(4)];

    // Sort a copy by descending absolute weight without mutating shared data
    const sortedContributions = [...contributions].sort(
      (a, b) => Math.abs(b.weight) - Math.abs(a.weight)
    );
    const topFeatures = sortedContributions.slice(0, maxTopFeatures);
    const remainingFeatures = sortedContributions.slice(maxTopFeatures);

    for (const feat of topFeatures) {
      y.push(feat.token);
      x.push(feat.weight);
      m.push("relative");
      t.push((feat.weight >= 0 ? "+" : "") + feat.weight.toFixed(4));
    }

    if (remainingFeatures.length > 0) {
      // Sum actual omitted contributions without forcing agreement with output
      const otherWeight = remainingFeatures.reduce((acc, c) => acc + c.weight, 0);
      y.push(`+${remainingFeatures.length} other features`);
      x.push(otherWeight);
      m.push("relative");
      t.push((otherWeight >= 0 ? "+" : "") + otherWeight.toFixed(4));
    }

    // Plotted total matches actual accumulated values
    const sumAllContributions = contributions.reduce((acc, c) => acc + c.weight, 0);
    const accumulatedTotal = baseValue + sumAllContributions;

    y.push("Reconstructed f(x)");
    x.push(0); // Plotly auto-computes total from preceding values
    m.push("total");
    t.push(accumulatedTotal.toFixed(4));

    return { yLabels: y, xValues: x, measures: m, textLabels: t };
  }, [baseValue, contributions, maxTopFeatures]);

  const height = Math.max(260, yLabels.length * 28 + 70);

  return (
    <div style={{ width: "100%", height: `${height}px` }}>
      <Plot
        data={[
          {
            type: "waterfall",
            orientation: "h",
            measure: measures,
            y: yLabels,
            x: xValues,
            text: textLabels,
            textposition: "outside",
            hoverinfo: "y+text",
            decreasing: {
              marker: {
                color: "#16a34a",
              },
            },
            increasing: {
              marker: {
                color: "#ef4444",
              },
            },
            totals: {
              marker: {
                color: "#4f46e5",
              },
            },
            connector: {
              line: {
                color: "#cbd5e1",
                width: 1,
                dash: "dot",
              },
            },
          } as unknown as Plotly.Data,
        ]}
        layout={{
          autosize: true,
          margin: { l: 120, r: 60, t: 10, b: 35 },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          yaxis: {
            autorange: "reversed",
            automargin: true,
            tickfont: {
              family: "Inter, -apple-system, sans-serif",
              size: 11,
              color: "#0f172a",
            },
          },
          xaxis: {
            title: {
              text: `Output Scale (${targetClass || "Target Class"})`,
              font: {
                size: 10.5,
                color: "#64748b",
                family: "Inter, sans-serif",
              },
              standoff: 6,
            },
            zeroline: true,
            zerolinecolor: "#cbd5e1",
            gridcolor: "#f1f5f9",
            tickfont: {
              size: 10,
              color: "#64748b",
              family: "Inter, sans-serif",
            },
          },
        }}
        useResizeHandler={true}
        style={{ width: "100%", height: "100%" }}
        config={{
          responsive: true,
          displayModeBar: false,
        }}
      />
    </div>
  );
}
