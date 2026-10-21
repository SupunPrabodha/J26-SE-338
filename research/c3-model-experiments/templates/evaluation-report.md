# Evaluation Report - Stage A: Baseline & Model Selection

Status: STAGE A COMPLETED - Model Selection Finalized

**Owner:** Ramanayake R. H. B. D. G. (IT23164130)  
**Date:** October 2026  
**Component:** Component 3 - Bilingual NLP, Emotion-Aware Modelling, and Wellbeing Indicator Classification  

---

### 1. Objective & Intended Use
To benchmark traditional baseline machine learning models against multilingual transformer candidates on public emotion and stress datasets (Dreaddit, GoEmotions) using a standardized 80/20 held-out split, in order to select the strongest multilingual backbone model for Stage B (Domain-Adaptive Pretraining and Multi-Task Fine-Tuning). Non-diagnostic screening-support only; authorized human counsellor interpretation.

### 2. Dataset & Split Provenance
* **Dreaddit (Stress Classification):** 3,546 total samples. 80% train (2,839 samples) / 20% test (707 samples). Binary stress classification (`Non-Stress` vs. `Stress`).
* **GoEmotions (Emotion Classification):** 51,969 total samples mapped to 7 Ekman categories (`anger`, `disgust`, `fear`, `joy`, `sadness`, `surprise`, `neutral`). 80% train (41,575 samples) / 20% test (10,394 samples).
* **Control:** Identical 80/20 stratified split (`random_state=42`) evaluated across all models.

### 3. Models Compared
1. **Baselines:** Word + character n-gram TF-IDF with Logistic Regression and Platt-calibrated Linear Support Vector Machine (LinearSVC).
2. **Multilingual Transformer Candidates:** `bert-base-multilingual-cased` (mBERT) vs. `xlm-roberta-base`.

---

### 4. Observed Results (Empirical Measurements)

#### A. Comprehensive Benchmark Metrics Table
| Dataset | Category | Model | Test Accuracy | Macro Precision | Macro Recall | Macro F1 | Weighted F1 | ECE (Calibration) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dreaddit** *(Stress)* | Baseline | TF-IDF + LogisticRegression | 0.7718 | 0.7725 | 0.7701 | 0.7702 | 0.7711 | 0.1083 |
| **Dreaddit** *(Stress)* | Baseline | TF-IDF + Calibrated SVM | 0.7662 | 0.7665 | 0.7656 | 0.7657 | 0.7662 | 0.0197 |
| **Dreaddit** *(Stress)* | Transformer | `bert-base-multilingual-cased` | 0.8204 | 0.8211 | 0.8168 | 0.8170 | 0.8182 | 0.0461 |
| **Dreaddit** *(Stress)* | Transformer | **`xlm-roberta-base`** | **0.8246** | **0.8252** | **0.8239** | **0.8241** | **0.8245** | 0.0678 |
| **GoEmotions** *(Emotion)* | Baseline | TF-IDF + LogisticRegression | 0.6005 | 0.6411 | 0.4772 | 0.5243 | 0.5899 | 0.0336 |
| **GoEmotions** *(Emotion)* | Baseline | TF-IDF + Calibrated SVM | 0.5853 | 0.6134 | 0.4742 | 0.5171 | 0.5748 | 0.0453 |
| **GoEmotions** *(Emotion)* | Transformer | `bert-base-multilingual-cased` | 0.6585 | 0.6521 | 0.6025 | 0.6174 | 0.6542 | 0.0390 |
| **GoEmotions** *(Emotion)* | Transformer | **`xlm-roberta-base`** | **0.6588** | **0.6548** | **0.6083** | **0.6209** | **0.6534** | 0.0512 |

#### B. Precision / Recall Significance in Screening Context
* **Recall for Stress/Distress (Sensitivity):** In wellbeing screening, high recall is vital to minimize **false negatives** (failing to flag a student experiencing distress). On Dreaddit, `xlm-roberta-base` achieves higher recall on the stress class compared to TF-IDF baselines (reducing missed distress signals).
* **Precision (False Positive Control):** High precision ensures that cases escalated for human counsellor review genuinely contain distress markers, preventing alert fatigue.

#### C. Confusion Matrix Findings
* **Dreaddit:** Confusion matrices (`cm_Dreaddit_*.png`) confirm balanced error distributions between stress (1) and non-stress (0), with XLM-RoBERTa demonstrating the lowest off-diagonal misclassification rate.
* **GoEmotions:** Confusion matrices (`cm_GoEmotions_*.png`) show that TF-IDF models frequently collapse nuanced negative emotions (*sadness*, *fear*, *anger*) into the majority *neutral* or *joy* classes due to lexical sparsity. Transformers successfully retain separation across distinct emotional tones.

---

### 5. Decision & Evidence Justification for Stage B
* **Empirical Justification:** `xlm-roberta-base` achieved the highest Macro F1 across both tasks (0.8241 on Dreaddit, +5.39% over baseline; 0.6209 on GoEmotions, +9.66% over baseline), with superior Macro Recall and Precision balance.
* **Linguistic & Architectural Justification:** XLM-RoBERTa utilizes SentencePiece subword tokenization trained on Common Crawl across 100 languages including Sinhala, providing proven cross-lingual representation capacity for Sinhala-English code-mixed adaptation (supported by Dhananjaya et al., 2022).
* **Conclusion:** **`xlm-roberta-base` is officially selected as the backbone model to be carried forward into Stage B.**

### 6. Limitations & Follow-Up
Public benchmarks are English-dominant; Stage B adapts the selected backbone to Sinhala-English code-mixed reflective text via domain-adaptive pretraining (DAPT) and multi-task learning across wellbeing indicator, emotional tone, and stress signals.
