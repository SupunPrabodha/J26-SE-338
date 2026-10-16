"use client";

interface ExplanationInfoPanelProps {
  method: "LIME" | "SHAP";
  status: string;
  modelVersion: string | null;
  targetClass: string | null;
  targetClassProbability: number | null;
  computationBounds?: Record<string, number>;
}

export function ExplanationInfoPanel({
  method,
  status,
  modelVersion,
  targetClass,
  targetClassProbability,
  computationBounds,
}: ExplanationInfoPanelProps) {
  const isLime = method === "LIME";

  return (
    <div className="explanation-info-card">
      <div className="info-header">
        <h4>{method} Methodology &amp; Governance</h4>
        <span className={`status-badge ${status === "READY" ? "connected" : "pending"}`}>
          {status === "READY" ? "Explanation ready" : "Pending C3 integration"}
        </span>
      </div>

      <dl className="info-dl">
        <div>
          <dt>Explainer Type</dt>
          <dd>
            {isLime
              ? "Local Interpretable Model-agnostic Explanations (LIME)"
              : "SHapley Additive exPlanations (SHAP) Text Explainer"}
          </dd>
        </div>
        <div>
          <dt>Mathematical Formulation</dt>
          <dd>
            {isLime ? (
              <code>argmin_g L(f, g, π_x) + Ω(g)</code>
            ) : (
              <code>f(x) = φ_0 + ∑_{`i=1`}^M φ_i</code>
            )}
          </dd>
        </div>
        <div>
          <dt>Target Class</dt>
          <dd>
            {targetClass ? (
              <strong>{targetClass}</strong>
            ) : (
              <span className="text-muted">Pending C3 integration</span>
            )}
            {targetClassProbability !== null && (
              <span className="class-prob"> (p = {targetClassProbability.toFixed(3)})</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Model Pipeline</dt>
          <dd>
            {modelVersion ? (
              <code>{modelVersion}</code>
            ) : (
              <span className="text-muted">Pending C3 classifier connection</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Computation Bounds &amp; Unicode</dt>
          <dd>
            {isLime ? (
              <span>
                {computationBounds?.num_samples || 100} perturbation samples · Whitespace Unicode preservation
              </span>
            ) : (
              <span>
                {computationBounds?.max_evals || 100} text masker evaluations · Text-compatible masker
              </span>
            )}
          </dd>
        </div>
      </dl>

      <div className="panel-screening-notice">
        <strong>Governance &amp; Interpretation Boundary:</strong>
        <p>
          Screening support only. Requires counsellor-assisted interpretation and does not replace professional counselling.
        </p>
      </div>
    </div>
  );
}
