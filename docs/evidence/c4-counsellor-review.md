# C4 Counsellor Review Interface: LIME and SHAP Explainable AI Modules

**Owner:** C4 — Alahakoon A. W. A. C. N. (IT23163522)  
**Branch:** `feature/c4-xai-dashboard`  
**Application:** `apps/counsellor-dashboard`  
**Routes:** `/lime`, `/shap`  
**Backend Endpoint:** `POST /internal/v1/dev/explain` (inside `services/xai`)  
**URLs:**
- [http://localhost:3001/lime](http://localhost:3001/lime)
- [http://localhost:3001/shap](http://localhost:3001/shap)

---

## 1. Purpose and Research Scope

Component 4 is responsible for Explainable AI (XAI), faithfulness evaluation, and the counsellor explanation review interface.

This increment aligns the `/lime` and `/shap` pages in `apps/counsellor-dashboard` with the project review prototypes. These pages serve authorized human counsellors conducting non-diagnostic wellbeing screening interpretation, rather than developer test inputs.

### Strict Research & Non-Diagnostic Boundary
> **Mandatory Practice Notice:**  
> Screening support only. Requires counsellor-assisted interpretation and does not replace professional counselling.  
> The system operates under human-in-the-loop review. It does not provide autonomous clinical diagnosis, triage decisions, or emergency interventions.

---

## 2. Review Contract Inspection & Findings

### Current Contract Status (`ReviewTask`)
An inspection of `packages/contracts/src/research_contracts/__init__.py` and `services/orchestrator/main.py` shows the current C1 review task schema:

```python
class ReviewTask(Contract):
    task_id: str
    case: PseudonymousCase
    inference: InferenceResponse
    explanation: ExplanationResponse
    human_review_required: bool
```

### Gap Analysis
- `ReviewTask` delivers the pseudonymous case metadata, model inference receipts, and explanation receipts.
- However, neither `ReviewTask` nor the orchestrator's `workflow_cases` review projection currently includes the preprocessed/anonymized student text (`PreprocessResponse` or `anonymized_text`).
- In strict adherence to Component 1 ownership and security boundaries:
  - C4 **does not invent fictional text** for real review cases.
  - C4 **does not query unauthorized database tables or bypass C1 access controls**.
  - When submission text is missing from the task object, the read-only **Input Text** card displays:
    > **“Submission text unavailable”**  
    > *Current C1 ReviewTask contract provides inference & explanation receipts, but excludes raw/preprocessed submission text.*
  - Action buttons (`Compute LIME Attributions` and `Compute SHAP Values`) remain disabled until both preprocessed text and the C3 classifier connection are supplied.

### Required Contract Extension (Component 1 Request)
To enable full in-context attribution review, Component 1 should update `ReviewTask` in `packages/contracts/src/research_contracts/__init__.py`:

```python
class ReviewTask(Contract):
    task_id: str
    case: PseudonymousCase
    inference: InferenceResponse
    explanation: ExplanationResponse
    human_review_required: bool
    # Proposed C1 addition:
    preprocessing: PreprocessResponse | None = None
```

---

## 3. Counsellor Review Interface Alignment

### Removal of Developer Input Controls
In accordance with the project review prototype requirements:
1. **Removed editable textareas:** Input reflection is displayed in a read-only card.
2. **Removed developer sample buttons:** Quick-fill buttons for synthetic reflections have been removed from counsellor pages.
3. **Removed manual language selectors:** Language metadata is displayed dynamically only when supplied by the selected case. If absent from case metadata, no manual override is shown.
4. **Removed Clear buttons:** Counsellors review persistent assigned cases.

### Prototype Visual System
- **Navy Sidebar:** Matches `#1a1d2e` dark navy styling with brand badges, section links, and persistent non-diagnostic notice.
- **Purple Navigation:** Matches `#7c3aed` active indicator, buttons, and badges.
- **Top 3 Cards Layout:**
  1. **Input Text Card:** Read-only submission view, language badge (if present), or graceful "Submission text unavailable" state.
  2. **Model Prediction Card:** Clearly marked **“Pending C3 integration”** with placeholder indicator, emotional tone, and review priority fields.
  3. **Case Summary Card:** Pseudonymous case reference (`case_id`), correlation ID, and active consent boundary.
- **Case State Across Navigation:**
  - `CaseContext` (`apps/counsellor-dashboard/app/context/CaseContext.tsx`) maintains the selected case in memory.
  - Navigating between `/lime` and `/shap` retains the selected case seamlessly.
  - No case data or reflections are stored in `localStorage`, `sessionStorage`, or URL search parameters.

---

## 4. XAI Visualization Modules

### LIME Feature Attribution (`/lime`)
- **Signed Diverging Bar Chart:** Visualizes directional impact (tokens supporting the target indicator in purple vs. opposing in salmon).
- **In-Text Attribution Highlighting:** Color-coded token spans showing local attribution weight directly within the submission narrative.
- **Feature Contribution Table:** Tabular listing of token names, raw weights, absolute magnitude, and directional badge.
- **CSV Export:** Disabled until valid attribution results exist.

### SHAP Additive Decomposition (`/shap`)
- **Single-Example Waterfall / Force View:**
  - Displays base value ($E[f(x)]$) and final model output value ($f(x)$) on an output scale $[0, 1]$.
  - Step-by-step additive contribution bars showing $\phi_i$ increments and cumulative progression.
- **Prohibition of Beeswarm Plots:**
  - Single-example views do not display beeswarm plots. Beeswarm plots represent multi-example distribution summaries across datasets, not single-instance additive breakdowns.
- **Signed Bar Chart & Highlighting:** Mirrors directional features with Shapley values.
- **CSV Export:** Disabled until valid SHAP results exist.

---

## 5. Verification Commands

```sh
# 1. Frontend Vitest unit tests (31+ tests)
npm test

# 2. Typecheck across workspace
npm run typecheck

# 3. Lint across workspace
npm run lint

# 4. Backend unit tests for XAI explainers
.venv/Scripts/python.exe -m pytest tests/unit/test_c4_explainers.py
.venv/Scripts/python.exe -m pytest tests/unit/test_c4_encoder.py

# 5. Contract schema drift verification
npm run contracts:check
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
```
