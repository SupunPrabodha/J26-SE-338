import type { ReviewTask } from "@j26/common/contracts";
import { humanLabel } from "@j26/common/ui";

export default function ExplanationAvailability({ task }: { task: ReviewTask }) {
  // Current authoritative contract has one fixture confidence, no per-class probabilities,
  // signed contributions or measured reliability. Do not infer unavailable research outputs.
  const explanation = task.explanation;
  return <section className="explanation-availability" aria-labelledby="explanation-values"><h3 id="explanation-values">Explanation values unavailable from current provider</h3>
    <p><span className="tag">Mock provider</span> · Fixed fixture evidence; numeric explanation charts are unavailable.</p>
    <details><summary>Why numeric charts are unavailable</summary><p>Current method: <strong>{humanLabel(explanation.method)}</strong> · explainer {explanation.explainer_version} · model {task.inference.model_version}</p>
    <p className="hint">The current API supplies fixed fixture evidence and a single uncalibrated confidence value. It does not supply per-class probabilities, signed LIME/SHAP contributions, a target class or measured faithfulness/stability. Confidence is not converted into class probabilities or clinical indicators.</p>
    <p className="hint">C4 explanation algorithms and offline evaluation work are preserved. Real provider integration and suitable authorized contracts are required before those charts can be displayed.</p></details>
  </section>;
}
