"use client";

import type { FeatureContribution } from "@j26/common/contracts";

interface ContributionTableProps {
  contributions: FeatureContribution[];
  method: "LIME" | "SHAP";
  targetClass: string | null;
}

export function ContributionTable({
  contributions,
  method,
  targetClass,
}: ContributionTableProps) {
  if (!contributions || contributions.length === 0) {
    return (
      <div className="empty-panel" role="status">
        <div className="empty-icon">📊</div>
        <h3>No Attribution Values Available</h3>
        <p>
          Model Prediction is currently <strong>Pending C3 integration</strong>. Attribution values will be computed once the C3 classifier is connected.
        </p>
      </div>
    );
  }

  // Find maximum absolute weight for scaling bars
  const maxAbsWeight = Math.max(...contributions.map((c) => Math.abs(c.weight)), 0.0001);

  return (
    <div className="table-responsive">
      <table className="contribution-table" aria-label={`${method} Feature Contributions`}>
        <thead>
          <tr>
            <th scope="col" style={{ width: "60px" }}>Rank</th>
            <th scope="col">Token / Word</th>
            <th scope="col" style={{ width: "130px" }}>
              {method === "LIME" ? "Weight (w_i)" : "Shapley (φ_i)"}
            </th>
            <th scope="col" style={{ width: "120px" }}>Direction</th>
            <th scope="col">Impact on {targetClass || "Selected Class"}</th>
          </tr>
        </thead>
        <tbody>
          {contributions.map((item, idx) => {
            const isPositive = item.weight >= 0;
            const barWidthPercent = Math.min(100, Math.round((Math.abs(item.weight) / maxAbsWeight) * 100));

            return (
              <tr key={`${item.token}-${idx}`}>
                <td className="rank-cell">#{idx + 1}</td>
                <td className="token-cell">
                  <code>{item.token}</code>
                </td>
                <td className="weight-cell">
                  <span className={isPositive ? "val-positive" : "val-negative"}>
                    {isPositive ? "+" : ""}{item.weight.toFixed(4)}
                  </span>
                </td>
                <td>
                  <span className={`direction-badge ${isPositive ? "supports" : "opposes"}`}>
                    {isPositive ? "Supports" : "Opposes"}
                  </span>
                </td>
                <td className="bar-cell">
                  <div className="mini-bar-track">
                    <div
                      className={`mini-bar-fill ${isPositive ? "positive" : "negative"}`}
                      style={{ width: `${barWidthPercent}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
