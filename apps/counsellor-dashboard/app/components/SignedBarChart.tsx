"use client";

import type { FeatureContribution } from "@j26/common/contracts";

interface SignedBarChartProps {
  contributions: FeatureContribution[];
  method: "LIME" | "SHAP";
  targetClass: string | null;
}

export function SignedBarChart({
  contributions,
  method,
  targetClass,
}: SignedBarChartProps) {
  if (!contributions || contributions.length === 0) {
    return (
      <div className="empty-panel" role="status">
        <div className="empty-icon">📈</div>
        <h3>No Attribution Bar Chart Available</h3>
        <p>
          Model Prediction is currently <strong>Pending C3 integration</strong>. Feature importance bars will be plotted when explanation results are received.
        </p>
      </div>
    );
  }

  // Display top features (up to 12)
  const displayItems = contributions.slice(0, 12);
  const maxAbsWeight = Math.max(...displayItems.map((c) => Math.abs(c.weight)), 0.0001);

  return (
    <div className="signed-chart-container" aria-label={`${method} Diverging Signed Bar Chart`}>
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-color negative" />
          <span>Opposes {targetClass || "Class"} (&lt; 0)</span>
        </span>
        <span className="legend-divider">0.00 (Neutral)</span>
        <span className="legend-item">
          <span className="legend-color positive" />
          <span>Supports {targetClass || "Class"} (&gt; 0)</span>
        </span>
      </div>

      <div className="signed-bar-list">
        {displayItems.map((item, idx) => {
          const isPositive = item.weight >= 0;
          const barWidthPercent = Math.round((Math.abs(item.weight) / maxAbsWeight) * 45); // up to 45% of half-width

          return (
            <div key={`${item.token}-${idx}`} className="signed-bar-row">
              <div className="bar-label" title={item.token}>
                <code>{item.token}</code>
              </div>

              <div className="bar-track-diverging">
                <div className="half-left">
                  {!isPositive && (
                    <div
                      className="diverging-bar negative"
                      style={{ width: `${barWidthPercent}%` }}
                    >
                      <span className="bar-val-inside">{item.weight.toFixed(3)}</span>
                    </div>
                  )}
                </div>

                <div className="center-axis" />

                <div className="half-right">
                  {isPositive && (
                    <div
                      className="diverging-bar positive"
                      style={{ width: `${barWidthPercent}%` }}
                    >
                      <span className="bar-val-inside">+{item.weight.toFixed(3)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
