"use client";

import type { FeatureContribution } from "@j26/common/contracts";

interface WaterfallChartProps {
  baseValue: number | null;
  outputValue: number | null;
  contributions: FeatureContribution[];
  targetClass: string | null;
}

export function WaterfallChart({
  baseValue,
  outputValue,
  contributions,
  targetClass,
}: WaterfallChartProps) {
  if (baseValue === null || outputValue === null || !contributions || contributions.length === 0) {
    return (
      <div className="empty-panel" role="status">
        <div className="empty-icon">🌊</div>
        <h3>No SHAP Waterfall / Force Plot Available</h3>
        <p>
          Model Prediction is currently <strong>Pending C3 integration</strong>. Once the classifier is connected, SHAP will compute base expected value E[f(x)], additive token contributions, and final output f(x).
        </p>
        <p className="hint">
          Note: In accordance with research standards, single-example explanations utilize local waterfall/force views. Beeswarm plots are designed for dataset-level multi-example distributions and are not shown for individual predictions.
        </p>
      </div>
    );
  }

  // Calculate cumulative steps for the top 10 features functionally
  const displayItems = contributions.slice(0, 10);
  const steps = displayItems.reduce<
    {
      token: string;
      weight: number;
      startVal: number;
      endVal: number;
      isPositive: boolean;
    }[]
  >((acc, item) => {
    const prevEnd = acc.length > 0 ? acc[acc.length - 1].endVal : baseValue;
    const endVal = prevEnd + item.weight;
    acc.push({
      token: item.token,
      weight: item.weight,
      startVal: prevEnd,
      endVal,
      isPositive: item.weight >= 0,
    });
    return acc;
  }, []);


  return (
    <div className="waterfall-container" aria-label="SHAP Local Waterfall Plot">
      <div className="waterfall-header">
        <div>
          <h4>SHAP Additive Waterfall View</h4>
          <p className="subtitle">
            Local decomposition: Base expectation E[f(x)] → Feature contributions Σφ_i → Final f(x)
          </p>
        </div>
        <div className="waterfall-summary-pill">
          <span>Target: <strong>{targetClass || "Selected Class"}</strong></span>
        </div>
      </div>

      <div className="waterfall-scales">
        <div className="scale-metric">
          <span className="scale-label">Base Value E[f(x)]</span>
          <span className="scale-val">{baseValue.toFixed(4)}</span>
        </div>
        <div className="scale-arrow">→</div>
        <div className="scale-metric output-metric">
          <span className="scale-label">Output Score f(x)</span>
          <span className="scale-val">{outputValue.toFixed(4)}</span>
        </div>
      </div>

      {/* Axis Scale Bar [0.0 - 1.0] */}
      <div className="output-scale-bar-wrapper">
        <div className="scale-ticks">
          <span>0.0</span>
          <span>0.25</span>
          <span>0.50</span>
          <span>0.75</span>
          <span>1.0</span>
        </div>
        <div className="scale-track">
          {/* Base value marker */}
          <div
            className="scale-marker base-marker"
            style={{ left: `${Math.max(0, Math.min(100, baseValue * 100))}%` }}
            title={`Base value: ${baseValue.toFixed(3)}`}
          />
          {/* Output value marker */}
          <div
            className="scale-marker output-marker"
            style={{ left: `${Math.max(0, Math.min(100, outputValue * 100))}%` }}
            title={`Final output: ${outputValue.toFixed(3)}`}
          />
        </div>
      </div>

      <div className="waterfall-steps-list">
        {/* Base value row */}
        <div className="waterfall-row base-row">
          <div className="step-label">Base expectation E[f(x)]</div>
          <div className="step-bar-area">
            <div
              className="waterfall-step-bar base-block"
              style={{
                width: `${Math.max(4, Math.min(100, baseValue * 100))}%`,
              }}
            >
              {baseValue.toFixed(3)}
            </div>
          </div>
        </div>

        {/* Individual feature steps */}
        {steps.map((step, idx) => {
          const minVal = Math.min(step.startVal, step.endVal);
          const maxVal = Math.max(step.startVal, step.endVal);
          const leftPercent = Math.max(0, Math.min(100, minVal * 100));
          const widthPercent = Math.max(1.5, Math.min(100, (maxVal - minVal) * 100));

          return (
            <div key={`${step.token}-${idx}`} className="waterfall-row">
              <div className="step-label" title={step.token}>
                <code>{step.token}</code>
              </div>
              <div className="step-bar-area">
                <div
                  className={`waterfall-step-bar ${step.isPositive ? "positive" : "negative"}`}
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                  }}
                >
                  <span className="step-val-text">
                    {step.isPositive ? "+" : ""}{step.weight.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Final output value row */}
        <div className="waterfall-row final-row">
          <div className="step-label">Final output score f(x)</div>
          <div className="step-bar-area">
            <div
              className="waterfall-step-bar final-block"
              style={{
                width: `${Math.max(4, Math.min(100, outputValue * 100))}%`,
              }}
            >
              {outputValue.toFixed(3)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
