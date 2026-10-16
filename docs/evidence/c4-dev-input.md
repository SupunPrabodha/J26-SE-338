# C4 Explanation Development: Pretrained Base Encoder Connection

**Owner:** C4 — Alahakoon A. W. A. C. N. (IT23163522)  
**Branch:** `feature/c4-xai-dashboard`  
**Route:** `/c4-dev-input` (inside `apps/student-portal`)  
**Backend Endpoint:** `POST /internal/v1/dev/encoder-check` (inside `services/xai`)  
**URL:** [http://localhost:3000/c4-dev-input](http://localhost:3000/c4-dev-input)

---

## 1. Purpose and Scope

This increment connects the Component 4 development test harness (`/c4-dev-input`) directly to the pretrained multilingual encoder **`FacebookAI/xlm-roberta-base`** without ANY training, classification heads, or simulated wellbeing scoring.

### Strict Research & Non-Diagnostic Boundary
> **Mandatory Screening Notice:**  
> This system supports student wellbeing screening and counsellor-assisted review. It does not provide a diagnosis or replace professional counselling.  
> Outputs require authorized human interpretation. No autonomous emergency intervention or clinical decisions are made.

### Base Encoder Boundary Notice
> **Base encoder connected — wellbeing classification unavailable.**  
> Pretrained encoder representations exist only for tokenization, representation inspection, and future XAI module testing. Downstream classification heads, wellbeing predictions, confidence scores, LIME, SHAP, and faithfulness evaluations are unavailable. No class labels or scores are invented.

---

## 2. Removal of Training Code & Clean Architecture

In accordance with strict component governance and requirements:
1. **Removed training code and artifacts:**
   - Deleted all synthetic training dataset generation scripts and data files.
   - Removed optimizer, learning rate scheduling, loss calculation, and epoch training logic.
   - Removed classification head architectures, weights, and trained-head loading routines.
2. **Preserved architecture:**
   - Preserved `/c4-dev-input` development input screen, sample selector, and character limit checks.
   - Preserved Hugging Face cache for `FacebookAI/xlm-roberta-base`.
   - Preserved Next.js server route wiring and shared platform mock endpoints.

---

## 3. Technical Architecture & Pretrained Base Encoder

### Single-Instance Pretrained Encoder Adapter
- **Checkpoint:** `FacebookAI/xlm-roberta-base`
- **Classes Used:** `AutoTokenizer` and `AutoModel` (Hugging Face `transformers`).
- **Forbidden:** No `AutoModelForSequenceClassification`, no `Linear` classification projection, no softmax or argmax scoring.
- **Loading & State:** Loaded once via singleton pattern (`get_encoder_adapter()`).
- **Inference Mode:**
  - `model.eval()`
  - All parameter gradients disabled (`param.requires_grad = False`).
  - Executed inside `torch.inference_mode()`.

### Authoritative Research Contracts
Defined in `packages/contracts/src/research_contracts/__init__.py`:
```python
class C4EncoderCheckRequest(Contract):
    text: Annotated[str, Field(min_length=1, max_length=2000)]
    language: (
        Literal["English", "Sinhala", "Romanized Sinhala", "Code-mixed"] | None
    ) = None

class C4EncoderCheckResponse(Contract):
    model_id: Literal["FacebookAI/xlm-roberta-base"] = "FacebookAI/xlm-roberta-base"
    status_message: Literal[
        "Base encoder connected — wellbeing classification unavailable."
    ] = "Base encoder connected — wellbeing classification unavailable."
    encoder_executed: Literal[True] = True
    token_count: int
    truncated: bool
    embedding_shape: list[int]
    hidden_dimension: int = 768
```

### Security & Privacy Controls
- **No full embeddings sent to browser:** Only diagnostic metadata (`model_id`, `encoder_executed`, `token_count`, `truncated`, `embedding_shape`, `hidden_dimension`) is returned.
- **Server-side Next.js route:** `apps/student-portal/app/api/c4-encoder/route.ts` bridges browser requests to the internal XAI service (`http://xai:8000` / `http://127.0.0.1:8000`), protecting internal topology and secrets.
- **Environment restriction:** The FastAPI endpoint `/internal/v1/dev/encoder-check` enforces `settings().environment == "development"`.

---

## 4. UI Diagnostics and Verification

When the developer clicks **"Check pretrained encoder"**:
1. The text is submitted to `/api/c4-encoder`.
2. The response renders a diagnostic card containing:
   - **Banner:** `"Base encoder connected — wellbeing classification unavailable."`
   - **Model ID:** `FacebookAI/xlm-roberta-base`
   - **Encoder execution:** `Successful (eval / inference mode)`
   - **Token count:** Real token count calculated by XLM-RoBERTa SentencePiece tokenizer.
   - **Truncation status:** Real status based on the 512-token sequence limit.
   - **Embedding shape:** e.g. `[1, 28, 768]`.
   - **Hidden dimension:** `768`.
3. Downstream tasks card keeps:
   - `Prediction`: **Not connected**
   - `LIME`: **Not connected**
   - `SHAP`: **Not connected**
   - `Faithfulness`: **Not connected**
   - `Counterfactuals`: **Not connected**

---

## 5. Verification Commands

```sh
# 1. Run frontend test suite
npm test

# 2. Run Python contract drift check
.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check

# 3. Run TypeScript contract check
npm run contracts:check

# 4. Run Python unit tests
.venv/Scripts/python.exe scripts/run.py pytest tests/unit/test_c4_encoder.py

# 5. Lint and typecheck
npm run lint
npm run typecheck
.venv/Scripts/python.exe -m ruff check services/xai tests/unit/test_c4_encoder.py
```
