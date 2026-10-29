"use client";

import { useState } from "react";
import Link from "next/link";
import { AppNavigation } from "@j26/common/ui";
import { DAPT_LOSS_CURVES_IMAGE } from "./c3-loss-curve-image";
import { STAGE_A_MACRO_F1_IMAGE } from "./c3-stage-a-image";
import {
  C3_KPI_METRICS,
  C3_ABLATION_TABLE,
  C3_PROBE_CASES,
  C3_GROUND_TRUTH_RECOVERIES,
  C3_CLEANING_EXAMPLES,
  C3_STAGE_A_METRICS,
  C3_STAGE_A_TABLE,
  C3_STAGE_A_REASONS,
  type ProbeCase,
  type StageABenchmarkRow
} from "./c3-demo-data";

export default function C3Demo() {
  const [activeTab, setActiveTab] = useState<"model-selection" | "playground" | "groundtruth" | "ablation" | "pipeline">("model-selection");
  const [selectedProbeId, setSelectedProbeId] = useState<string>(C3_PROBE_CASES[0].id);
  const [customSentence, setCustomSentence] = useState<string>("");
  const [showPlot, setShowPlot] = useState<boolean>(true);
  const [showStageAPlot, setShowStageAPlot] = useState<boolean>(true);
  const [stageADataset, setStageADataset] = useState<"ALL" | "Dreaddit" | "GoEmotions">("ALL");
  const [activeCleanerIdx, setActiveCleanerIdx] = useState<number>(0);

  const filteredStageARows: StageABenchmarkRow[] = C3_STAGE_A_TABLE.filter((row) => {
    if (stageADataset === "ALL") return true;
    return row.dataset === stageADataset;
  });

  const activeProbe: ProbeCase =
    C3_PROBE_CASES.find((p) => p.id === selectedProbeId) || C3_PROBE_CASES[0];

  return (
    <>
      <AppNavigation active="c3" />
      <main className="c3-demo-container">
      {/* Top Breadcrumb & Return Navigation */}
      <nav className="c3-top-nav" aria-label="Breadcrumb">
        <Link href="/demo" className="c3-back-link">
          &larr; Back to Component 1 Demo
        </Link>
        <div className="c3-nav-badges">
          <span className="c3-badge-pill">J26-SE-338</span>
          <span className="c3-badge-pill c3-badge-accent">Component 3: Modelling</span>
        </div>
      </nav>

      {/* Hero Header */}
      <header className="c3-hero">
        <div className="c3-hero-eyebrow">
          <span>Domain-Adaptive Pre-Training (DAPT)</span>
          <span className="c3-dot-separator">&bull;</span>
          <span>Sinhala-English & Romanized Singlish</span>
        </div>
        <h1 className="c3-title">
          Multilingual Language Model Adaptation Studio
        </h1>
        <p className="c3-subtitle">
          Interactive evaluation of continued pre-training on <strong>XLM-RoBERTa (125M)</strong> across
          over <strong>6.05 Million tokens</strong> of Sri Lankan university student mental health discourse.
        </p>

        <div className="c3-meta-strip">
          <div className="c3-meta-item">
            <span className="c3-meta-label">Author / Role</span>
            <span className="c3-meta-value">C3 &middot; Ramanayake R. H. B. D. G. (IT23164130)</span>
          </div>
          <div className="c3-meta-item">
            <span className="c3-meta-label">Target Architecture</span>
            <span className="c3-meta-value">XLM-RoBERTa Base (12 Layers, 250k Vocab)</span>
          </div>
          <div className="c3-meta-item">
            <span className="c3-meta-label">Compute Acceleration</span>
            <span className="c3-meta-value">NVIDIA RTX 4090 (24GB VRAM &middot; RunPod)</span>
          </div>
          <div className="c3-meta-item">
            <span className="c3-meta-label">Scientific Reference</span>
            <span className="c3-meta-value">Gururangan et al., ACL 2020 (DAPT)</span>
          </div>
        </div>
      </header>

      {/* KPI Highlight Strip */}
      <section className="c3-kpi-grid" aria-label="Key Performance Indicators">
        <div className="c3-kpi-card">
          <div className="c3-kpi-header">
            <span className="c3-kpi-title">Perplexity Collapse</span>
            <span className="c3-kpi-tag c3-tag-success">-87.10%</span>
          </div>
          <div className="c3-kpi-value">
            146.4 <span className="c3-kpi-arrow">&rarr;</span> 18.9
          </div>
          <p className="c3-kpi-desc">
            Model uncertainty collapsed from ~146 random candidate words down to under 19.
          </p>
        </div>

        <div className="c3-kpi-card">
          <div className="c3-kpi-header">
            <span className="c3-kpi-title">Top-1 Prediction Acc</span>
            <span className="c3-kpi-tag c3-tag-success">+18.00%</span>
          </div>
          <div className="c3-kpi-value">
            33.3% <span className="c3-kpi-arrow">&rarr;</span> 51.3%
          </div>
          <p className="c3-kpi-desc">
            Majority of masked domain words are now predicted correctly on the very first try.
          </p>
        </div>

        <div className="c3-kpi-card">
          <div className="c3-kpi-header">
            <span className="c3-kpi-title">Top-5 Candidate Acc</span>
            <span className="c3-kpi-tag c3-tag-success">+23.73%</span>
          </div>
          <div className="c3-kpi-value">
            44.8% <span className="c3-kpi-arrow">&rarr;</span> 68.5%
          </div>
          <p className="c3-kpi-desc">
            Over 68% of masked Sri Lankan emotion tokens appear in the model&apos;s top 5 predictions.
          </p>
        </div>

        <div className="c3-kpi-card">
          <div className="c3-kpi-header">
            <span className="c3-kpi-title">Ablation Throughput</span>
            <span className="c3-kpi-tag c3-tag-info">4x Speedup</span>
          </div>
          <div className="c3-kpi-value">
            12m 38s <span className="c3-kpi-unit">(Packed)</span>
          </div>
          <p className="c3-kpi-desc">
            0% padding waste sequence packing delivered maximum Tensor Core throughput.
          </p>
        </div>
      </section>

      {/* Main Tab Navigation */}
      <nav className="c3-tab-bar" aria-label="Interactive sections">
        <button
          className={`c3-tab-button ${activeTab === "model-selection" ? "active" : ""}`}
          onClick={() => setActiveTab("model-selection")}
          aria-pressed={activeTab === "model-selection"}
        >
          Chapter 1: Model Selection (Stage A)
        </button>
        <button
          className={`c3-tab-button ${activeTab === "playground" ? "active" : ""}`}
          onClick={() => setActiveTab("playground")}
          aria-pressed={activeTab === "playground"}
        >
          Chapter 2: Mask Infilling Studio
        </button>
        <button
          className={`c3-tab-button ${activeTab === "groundtruth" ? "active" : ""}`}
          onClick={() => setActiveTab("groundtruth")}
          aria-pressed={activeTab === "groundtruth"}
        >
          Ground-Truth Recovery
        </button>
        <button
          className={`c3-tab-button ${activeTab === "ablation" ? "active" : ""}`}
          onClick={() => setActiveTab("ablation")}
          aria-pressed={activeTab === "ablation"}
        >
          Dual-Variant Ablations
        </button>
        <button
          className={`c3-tab-button ${activeTab === "pipeline" ? "active" : ""}`}
          onClick={() => setActiveTab("pipeline")}
          aria-pressed={activeTab === "pipeline"}
        >
          Preprocessing Pipeline
        </button>
      </nav>

      {/* CHAPTER 1: BASELINE & MODEL SELECTION (STAGE A) */}
      {activeTab === "model-selection" && (
        <section className="c3-section" aria-labelledby="model-selection-heading">
          <div className="c3-section-header">
            <div className="c3-chapter-badge">Chapter 1 &bull; Stage A Empirical Selection</div>
            <h2 id="model-selection-heading">Foundational Model Selection &amp; Cross-Lingual Benchmarking</h2>
            <p className="c3-section-intro">
              Before committing compute resources to Domain-Adaptive Pre-Training (DAPT), a rigorous baseline and model selection protocol was executed across standardized psychological stress (<strong>Dreaddit</strong>) and multi-class emotion (<strong>GoEmotions</strong>) datasets. This benchmark compared classical n-gram baselines against multilingual transformer backbones to justify selecting <strong>XLM-RoBERTa</strong> as our foundation architecture.
            </p>
          </div>

          {/* Chapter 1 KPI Cards */}
          <div className="c3-stage-a-kpi-grid">
            <div className="c3-stage-a-kpi-card c3-kpi-highlight">
              <div className="c3-kpi-header">
                <span className="c3-kpi-title">Selected Foundation Model</span>
                <span className="c3-kpi-tag c3-tag-gold">Selected Model</span>
              </div>
              <div className="c3-stage-a-kpi-model">xlm-roberta-base</div>
              <p className="c3-kpi-desc">
                125M parameters &bull; 250k SentencePiece BPE vocabulary with native Indic/Sinhala subword coverage.
              </p>
            </div>

            <div className="c3-stage-a-kpi-card">
              <div className="c3-kpi-header">
                <span className="c3-kpi-title">Dreaddit Stress Detection</span>
                <span className="c3-kpi-tag c3-tag-success">+5.39% vs Baseline</span>
              </div>
              <div className="c3-kpi-value">
                82.41% <span className="c3-kpi-unit">Macro F1</span>
              </div>
              <p className="c3-kpi-desc">
                82.46% test accuracy on binary academic/financial psychological stress detection.
              </p>
            </div>

            <div className="c3-stage-a-kpi-card">
              <div className="c3-kpi-header">
                <span className="c3-kpi-title">GoEmotions Classification</span>
                <span className="c3-kpi-tag c3-tag-success">+9.66% vs Baseline</span>
              </div>
              <div className="c3-kpi-value">
                62.09% <span className="c3-kpi-unit">Macro F1</span>
              </div>
              <p className="c3-kpi-desc">
                65.88% accuracy across 28 fine-grained emotion categories, outperforming mBERT &amp; TF-IDF.
              </p>
            </div>

            <div className="c3-stage-a-kpi-card">
              <div className="c3-kpi-header">
                <span className="c3-kpi-title">Probability Calibration</span>
                <span className="c3-kpi-tag c3-tag-info">ECE: 0.0512</span>
              </div>
              <div className="c3-kpi-value">
                0.0512 <span className="c3-kpi-unit">ECE</span>
              </div>
              <p className="c3-kpi-desc">
                Well-calibrated predictive confidence without overconfident probability distortion.
              </p>
            </div>
          </div>

          {/* Interactive Benchmark Comparison Table */}
          <div className="c3-card c3-stage-a-table-card">
            <div className="c3-card-header-flex">
              <div>
                <h3 className="c3-card-title">Stage A Empirical Evaluation Matrix</h3>
                <p className="c3-card-desc">
                  Standardized benchmarking of classical ML baselines vs. multilingual transformer candidates:
                </p>
              </div>

              {/* Dataset Filter Buttons */}
              <div className="c3-filter-group" role="group" aria-label="Dataset Filter">
                <button
                  type="button"
                  className={`c3-filter-btn ${stageADataset === "ALL" ? "active" : ""}`}
                  onClick={() => setStageADataset("ALL")}
                >
                  All Benchmarks (8)
                </button>
                <button
                  type="button"
                  className={`c3-filter-btn ${stageADataset === "Dreaddit" ? "active" : ""}`}
                  onClick={() => setStageADataset("Dreaddit")}
                >
                  Dreaddit (Stress)
                </button>
                <button
                  type="button"
                  className={`c3-filter-btn ${stageADataset === "GoEmotions" ? "active" : ""}`}
                  onClick={() => setStageADataset("GoEmotions")}
                >
                  GoEmotions (28 Emotions)
                </button>
              </div>
            </div>

            <div className="c3-table-wrapper">
              <table className="c3-table c3-stage-a-table">
                <thead>
                  <tr>
                    <th>Benchmark Dataset</th>
                    <th>Classification Task</th>
                    <th>Category</th>
                    <th>Model Architecture</th>
                    <th>Accuracy</th>
                    <th>Macro F1</th>
                    <th>Weighted F1</th>
                    <th>ECE</th>
                    <th>Selection Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStageARows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={row.isWinner ? "c3-row-stage-a-winner" : row.category === "Baseline" ? "c3-row-baseline" : "c3-row-candidate"}
                    >
                      <td>
                        <span className="c3-dataset-badge">{row.dataset}</span>
                      </td>
                      <td className="c3-task-cell">{row.task}</td>
                      <td>
                        <span className={`c3-cat-badge ${row.category === "Baseline" ? "cat-baseline" : "cat-transformer"}`}>
                          {row.category}
                        </span>
                      </td>
                      <td className="c3-model-cell">
                        <code>{row.model}</code>
                      </td>
                      <td className="c3-cell-strong">{row.accuracy.toFixed(2)}%</td>
                      <td className={`c3-cell-f1 ${row.isWinner ? "c3-winner-f1" : ""}`}>
                        {row.macroF1.toFixed(2)}%
                      </td>
                      <td>{row.weightedF1.toFixed(2)}%</td>
                      <td className="c3-cell-ece">{row.ece.toFixed(4)}</td>
                      <td>
                        {row.isWinner ? (
                          <span className="c3-badge-winner">Selected Foundation</span>
                        ) : (
                          <span className="c3-badge-runnerup">Evaluated</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="c3-table-footnote">
              <strong>Evaluation Protocol Note:</strong> All models evaluated on identical test splits using standardized scikit-learn &amp; HuggingFace Transformers pipelines under fixed random seed 42. ECE calculated with 10 equal-width confidence bins.
            </div>
          </div>

          {/* Visual Benchmark Comparison Figure */}
          <div className="c3-card c3-chart-card">
            <div className="c3-plot-header">
              <div>
                <h3 className="c3-card-title">Stage A Macro F1 Performance Across Benchmarks</h3>
                <p className="c3-card-desc">
                  Visual comparison showing classical bag-of-words floor vs. multilingual contextual representations.
                </p>
              </div>
              <button
                type="button"
                className="c3-btn c3-btn-outline"
                onClick={() => setShowStageAPlot(!showStageAPlot)}
              >
                {showStageAPlot ? "Hide Comparison Chart" : "Show Comparison Chart"}
              </button>
            </div>

            {showStageAPlot && (
              <div className="c3-plot-container">
                <img
                  src={STAGE_A_MACRO_F1_IMAGE}
                  alt="Stage A Macro F1 Comparison: Dreaddit and GoEmotions benchmarks"
                  className="c3-loss-curve-image"
                />
                <div className="c3-plot-caption">
                  <strong>Figure 1 &bull; Stage A Model Selection Empirical Proof:</strong> Test Macro F1 comparison across Dreaddit and GoEmotions. Multilingual transformers (XLM-RoBERTa and mBERT) drastically outperform classical n-gram baselines, especially on GoEmotions where fine-grained emotion nuance requires contextual representations. XLM-RoBERTa achieved the highest overall score on both tasks (+9.66% gain over baseline).
                </div>
              </div>
            )}
          </div>

          {/* Architectural Justifications */}
          <div className="c3-reasons-section">
            <h3 className="c3-reasons-heading">Why XLM-RoBERTa was Selected: 3 Key Scientific Criteria</h3>
            <div className="c3-reasons-grid">
              {C3_STAGE_A_REASONS.map((reason, idx) => (
                <div key={idx} className="c3-reason-card">
                  <div className="c3-reason-number">0{idx + 1}</div>
                  <h4 className="c3-reason-title">{reason.title}</h4>
                  <p className="c3-reason-summary">{reason.summary}</p>
                  <p className="c3-reason-detail">{reason.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Transition to Chapter 2 Call To Action Banner */}
          <div className="c3-stage-transition-banner">
            <div className="c3-transition-content">
              <span className="c3-transition-eyebrow">The Next Scientific Challenge &rarr;</span>
              <h3 className="c3-transition-title">Why Wasn&apos;t Raw XLM-RoBERTa Enough for Local Discourse?</h3>
              <p className="c3-transition-desc">
                Although XLM-RoBERTa won Stage A on standard benchmarks, deploying it directly on real Sri Lankan student conversations revealed acute domain vulnerability: off-the-shelf perplexity on conversational Singlish spiked to <strong>146.4</strong>. This necessitated <strong>Chapter 2: Domain-Adaptive Pre-Training (DAPT)</strong>.
              </p>
            </div>
            <button
              type="button"
              className="c3-btn c3-btn-primary c3-transition-btn"
              onClick={() => {
                setActiveTab("playground");
                window.scrollTo({ top: 380, behavior: "smooth" });
              }}
            >
              Proceed to Chapter 2: Mask Infilling Studio &rarr;
            </button>
          </div>
        </section>
      )}

      {/* TAB 1: INTERACTIVE MASK INFILLING STUDIO (CHAPTER 2) */}
      {activeTab === "playground" && (
        <section className="c3-section" aria-labelledby="playground-heading">
          <div className="c3-section-header">
            <h2 id="playground-heading">Chapter 2: Interactive Mask Infilling Studio (DAPT)</h2>
            <p className="c3-section-intro">
              Inspect how the language model predicts hidden tokens in Sinhala-English code-mixed sentences.
              Compare the <strong>Vanilla Baseline</strong> (before DAPT) against <strong>Variant 1 (Packed)</strong> and <strong>Variant 2 (Dynamic)</strong>.
            </p>
          </div>

          {/* Preset Probe Sentence Selector */}
        <div className="c3-card c3-selector-card">
          <div className="c3-dropdown-header">
            <label className="c3-label" htmlFor="probe-select">
              Select a Student Conversational Probe Sentence:
            </label>
            <div className="c3-stepper-buttons">
              <button
                type="button"
                className="c3-step-btn"
                disabled={C3_PROBE_CASES.findIndex((p) => p.id === selectedProbeId) === 0}
                onClick={() => {
                  const idx = C3_PROBE_CASES.findIndex((p) => p.id === selectedProbeId);
                  if (idx > 0) {
                    setSelectedProbeId(C3_PROBE_CASES[idx - 1].id);
                    setCustomSentence("");
                  }
                }}
                title="Previous probe sentence"
              >
                &larr; Prev
              </button>
              <span className="c3-step-counter">
                {C3_PROBE_CASES.findIndex((p) => p.id === selectedProbeId) + 1} / {C3_PROBE_CASES.length}
              </span>
              <button
                type="button"
                className="c3-step-btn"
                disabled={
                  C3_PROBE_CASES.findIndex((p) => p.id === selectedProbeId) ===
                  C3_PROBE_CASES.length - 1
                }
                onClick={() => {
                  const idx = C3_PROBE_CASES.findIndex((p) => p.id === selectedProbeId);
                  if (idx < C3_PROBE_CASES.length - 1) {
                    setSelectedProbeId(C3_PROBE_CASES[idx + 1].id);
                    setCustomSentence("");
                  }
                }}
                title="Next probe sentence"
              >
                Next &rarr;
              </button>
            </div>
          </div>

          <div className="c3-select-wrapper">
            <select
              id="probe-select"
              className="c3-dropdown-select"
              value={selectedProbeId}
              onChange={(e) => {
                setSelectedProbeId(e.target.value);
                setCustomSentence("");
              }}
            >
              {C3_PROBE_CASES.map((probe, index) => (
                <option key={probe.id} value={probe.id}>
                  {index + 1}. {probe.sentence}
                </option>
              ))}
            </select>
          </div>

          <div className="c3-active-sentence-box">
            <span className="c3-box-label">Active Input Sentence:</span>
              <p className="c3-sentence-display">
                {activeProbe.maskedSentence.split("[MASK]").map((part, idx, arr) => (
                  <span key={idx}>
                    {part}
                    {idx < arr.length - 1 && <span className="c3-mask-token">[MASK]</span>}
                  </span>
                ))}
              </p>
              {activeProbe.notes && (
                <p className="c3-box-notes">
                  <strong>Linguistic Observation:</strong> {activeProbe.notes}
                </p>
              )}
            </div>
          </div>

          {/* Model Side-by-Side Comparison Grid */}
          <div className="c3-models-grid">
            {/* Model 1: Baseline */}
            <div className="c3-model-card c3-card-baseline">
              <div className="c3-model-card-header">
                <div>
                  <h3 className="c3-model-title">Vanilla XLM-RoBERTa</h3>
                  <span className="c3-model-subtitle">Off-the-shelf Base (PPL: 146.36)</span>
                </div>
                <span className="c3-pill c3-pill-muted">Before DAPT</span>
              </div>
              <p className="c3-model-note">
                Lacks Sinhala/Singlish conversational context. Probabilities are scattered across European and standard languages.
              </p>
              <div className="c3-candidate-list">
                <span className="c3-list-label">Top-5 Mask Predictions:</span>
                {activeProbe.predictions.baseline.map((cand, idx) => (
                  <div key={idx} className="c3-candidate-row">
                    <span className="c3-candidate-rank">#{idx + 1}</span>
                    <span className="c3-candidate-token">&apos;{cand.token}&apos;</span>
                    <div className="c3-bar-track">
                      <div
                        className="c3-bar-fill c3-fill-baseline"
                        style={{ width: `${Math.min(100, cand.probability * 250)}%` }}
                      />
                    </div>
                    <span className="c3-candidate-prob">{(cand.probability * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Model 2: DAPT-Packed (Variant 1) */}
            <div className="c3-model-card c3-card-packed">
              <div className="c3-model-card-header">
                <div>
                  <h3 className="c3-model-title">Variant 1: DAPT-Packed</h3>
                  <span className="c3-model-subtitle">Contiguous 256 Buffers (PPL: 18.88)</span>
                </div>
                <span className="c3-pill c3-pill-success">Adapted &bull; 12m</span>
              </div>
              <p className="c3-model-note">
                Learned conversational verbs and emotional predicates with 0% padding waste. High confidence across Sri Lankan tokens.
              </p>
              <div className="c3-candidate-list">
                <span className="c3-list-label">Top-5 Mask Predictions:</span>
                {activeProbe.predictions.packed.map((cand, idx) => (
                  <div key={idx} className="c3-candidate-row">
                    <span className="c3-candidate-rank">#{idx + 1}</span>
                    <span className="c3-candidate-token c3-token-adapted">&apos;{cand.token}&apos;</span>
                    <div className="c3-bar-track">
                      <div
                        className="c3-bar-fill c3-fill-packed"
                        style={{ width: `${Math.min(100, cand.probability * 180)}%` }}
                      />
                    </div>
                    <span className="c3-candidate-prob">{(cand.probability * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Model 3: DAPT-Dynamic (Variant 2) */}
            <div className="c3-model-card c3-card-dynamic">
              <div className="c3-model-card-header">
                <div>
                  <h3 className="c3-model-title">Variant 2: DAPT-Dynamic</h3>
                  <span className="c3-model-subtitle">Length-Grouped Isolated (PPL: 19.38)</span>
                </div>
                <span className="c3-pill c3-pill-accent">Highest Acc &bull; 51.3%</span>
              </div>
              <p className="c3-model-note">
                Strict conversational isolation prevents cross-sentence noise. Highest Top-1 accuracy (+2.17% over packed).
              </p>
              <div className="c3-candidate-list">
                <span className="c3-list-label">Top-5 Mask Predictions:</span>
                {activeProbe.predictions.dynamic.map((cand, idx) => (
                  <div key={idx} className="c3-candidate-row">
                    <span className="c3-candidate-rank">#{idx + 1}</span>
                    <span className="c3-candidate-token c3-token-adapted">&apos;{cand.token}&apos;</span>
                    <div className="c3-bar-track">
                      <div
                        className="c3-bar-fill c3-fill-dynamic"
                        style={{ width: `${Math.min(100, cand.probability * 180)}%` }}
                      />
                    </div>
                    <span className="c3-candidate-prob">{(cand.probability * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: GROUND-TRUTH RECOVERY */}
      {activeTab === "groundtruth" && (
        <section className="c3-section" aria-labelledby="groundtruth-heading">
          <div className="c3-section-header">
            <h2 id="groundtruth-heading">Ground-Truth Target Word Recovery (Top-1 &amp; Top-5)</h2>
            <p className="c3-section-intro">
              Evaluation on held-out sentences from <code>dapt_val.txt</code> where the true hidden word is known.
              Notice how Vanilla XLM-R failed while the adapted models recovered the exact target word with high probability.
            </p>
          </div>

          <div className="c3-gt-grid">
            {C3_GROUND_TRUTH_RECOVERIES.map((item, idx) => (
              <div key={item.id} className="c3-card c3-gt-card">
                <div className="c3-gt-card-header">
                  <div className="c3-gt-card-title-group">
                    <span className="c3-gt-idx">Case #{idx + 1}</span>
                    <span className="c3-chip-category">{item.category}</span>
                  </div>
                  <div className="c3-gt-target-tag">
                    Target Word: <strong>&apos;{item.targetWord}&apos;</strong>
                  </div>
                </div>

                <div className="c3-gt-body">
                  <div className="c3-gt-text-line">
                    <span className="c3-gt-label">Full Sentence:</span>
                    <span className="c3-gt-sentence">{item.originalSentence}</span>
                  </div>
                  <div className="c3-gt-text-line">
                    <span className="c3-gt-label">Masked Input:</span>
                    <span className="c3-gt-sentence c3-highlight-mask">{item.maskedSentence}</span>
                  </div>

                  {/* Model Performance Comparison Cards */}
                  <div className="c3-gt-results-table">
                    <div className="c3-gt-row c3-gt-row-baseline">
                      <div className="c3-gt-col-name">Vanilla Baseline</div>
                      <div className="c3-gt-col-status">
                        <span className="c3-badge-fail">{item.baselineStatus}</span>
                      </div>
                      <div className="c3-gt-col-desc">
                        True token ranked #{item.baselineRank}; model guessed irrelevant tokens.
                      </div>
                    </div>

                    <div className="c3-gt-row c3-gt-row-packed">
                      <div className="c3-gt-col-name">DAPT-Packed (V1)</div>
                      <div className="c3-gt-col-status">
                        <span className="c3-badge-success">
                          {item.packedStatus} (Rank {item.packedRank}) &bull; {item.packedProb}%
                        </span>
                      </div>
                      <div className="c3-gt-col-desc">
                        Top Guesses: {item.packedPredictions.map((p) => `${p.token} (${(p.probability * 100).toFixed(0)}%)`).join(", ")}
                      </div>
                    </div>

                    <div className="c3-gt-row c3-gt-row-dynamic">
                      <div className="c3-gt-col-name">DAPT-Dynamic (V2)</div>
                      <div className="c3-gt-col-status">
                        <span className="c3-badge-success-accent">
                          {item.dynamicStatus} (Rank {item.dynamicRank}) &bull; {item.dynamicProb}%
                        </span>
                      </div>
                      <div className="c3-gt-col-desc">
                        Top Guesses: {item.dynamicPredictions.map((p) => `${p.token} (${(p.probability * 100).toFixed(0)}%)`).join(", ")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 3: DUAL-VARIANT ABLATION DASHBOARD */}
      {activeTab === "ablation" && (
        <section className="c3-section" aria-labelledby="ablation-heading">
          <div className="c3-section-header">
            <h2 id="ablation-heading">Dual-Variant Empirical Ablation Dashboard</h2>
            <p className="c3-section-intro">
              Rigorous scientific comparison between <strong>Variant 1 (Standard RoBERTa Packing with &lt;/s&gt;&lt;/s&gt;)</strong> and
              <strong> Variant 2 (Dynamic Length-Grouped Sentence Isolation)</strong> against the Vanilla Baseline control.
            </p>
          </div>

          {/* Ablation Table */}
          <div className="c3-card c3-table-card">
            <h3 className="c3-card-title">Empirical Benchmark Summary (NVIDIA RTX 4090)</h3>
            <div className="c3-table-wrapper">
              <table className="c3-table">
                <thead>
                  <tr>
                    <th>Variant</th>
                    <th>Strategy</th>
                    <th>Validation Loss</th>
                    <th>Perplexity (PPL)</th>
                    <th>&Delta; PPL</th>
                    <th>% PPL Drop</th>
                    <th>Top-1 Acc</th>
                    <th>Top-5 Acc</th>
                    <th>Runtime</th>
                  </tr>
                </thead>
                <tbody>
                  {C3_ABLATION_TABLE.map((row, idx) => (
                    <tr key={idx} className={idx === 0 ? "c3-row-base" : "c3-row-adapted"}>
                      <td className="c3-cell-strong">{row.variant}</td>
                      <td>{row.strategy}</td>
                      <td><code>{row.valLoss.toFixed(4)}</code></td>
                      <td className="c3-cell-ppl">{row.perplexity.toFixed(2)}</td>
                      <td>{row.deltaPpl.toFixed(2)}</td>
                      <td className="c3-cell-badge">
                        <span className={idx === 0 ? "c3-pill-muted" : "c3-pill-success"}>
                          {row.reductionPct}
                        </span>
                      </td>
                      <td className="c3-cell-acc">{row.top1Acc}</td>
                      <td className="c3-cell-acc">{row.top5Acc}</td>
                      <td><code>{row.runtime}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="c3-tradeoff-panel">
              <div className="c3-tradeoff-item">
                <strong>Strategy 1 (DAPT-Packed) Key Finding:</strong> 0% padding waste saturates GPU Tensor Cores,
                yielding a <strong>4x throughput speedup (12m 38s)</strong> with optimal perplexity (18.88).
              </div>
              <div className="c3-tradeoff-item">
                <strong>Strategy 3 (DAPT-Dynamic) Key Finding:</strong> Complete conversational sentence isolation
                delivers <strong>higher semantic precision (+2.17% Top-1 accuracy, 51.27%)</strong> by eliminating cross-sentence attention noise.
              </div>
            </div>
          </div>

          {/* Loss Curve Plot Viewer */}
          <div className="c3-card c3-plot-card">
            <div className="c3-plot-header">
              <div>
                <h3 className="c3-card-title">Loss &amp; Perplexity Convergence Trajectories</h3>
                <p className="c3-card-desc">
                  High-resolution Matplotlib publication curves logged across 1,119 optimization steps on the held-out validation set.
                </p>
              </div>
              <button
                className="c3-btn-secondary"
                onClick={() => setShowPlot(!showPlot)}
              >
                {showPlot ? "Hide Convergence Curves" : "Show Convergence Curves"}
              </button>
            </div>

            {showPlot && (
              <div className="c3-plot-container">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={DAPT_LOSS_CURVES_IMAGE}
                  alt="Training and Validation Loss and Perplexity Convergence Curves (Packed vs Dynamic)"
                  className="c3-loss-curve-image"
                />
                <p className="c3-plot-caption">
                  Figure 1: Side-by-side progression of cross-entropy validation loss (left) and domain perplexity convergence (right)
                  benchmarked against the Vanilla Baseline anchor (red dotted line).
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 4: DATA PIPELINE (PHASES 1-3) */}
      {activeTab === "pipeline" && (
        <section className="c3-section" aria-labelledby="pipeline-heading">
          <div className="c3-section-header">
            <h2 id="pipeline-heading">Corpus Preparation &amp; Tokenizer Pipeline (Phases 1&ndash;3)</h2>
            <p className="c3-section-intro">
              Before running DAPT, the raw multilingual social discourse was curated, sanitized, and stratified to prevent
              data leakage and protect native Sinhala orthography.
            </p>
          </div>

          {/* 4 Phases Flowchart */}
          <div className="c3-pipeline-flow">
            <div className="c3-pipeline-step">
              <span className="c3-step-badge">Phase 1</span>
              <h4>Corpus Sanitization</h4>
              <p>128,329 cleaned sentences (3.32M words). Stripped 5,323 BBCode tags, removed 818 symbol floods, preserved 5,017 Sinhala ZWJs.</p>
              <div className="c3-step-meta">Script: <code>clean_corpus.py</code></div>
            </div>

            <div className="c3-pipeline-step">
              <span className="c3-step-badge">Phase 2</span>
              <h4>Tokenizer Profiling</h4>
              <p>6.05M subwords. Fragmentation ratio 1.89x, UNK rate 0.011% (696 tokens). Sequence length P50=28, P95=161, 97.85% &le; 256.</p>
              <div className="c3-step-meta">Script: <code>audit_tokenizer.py</code></div>
            </div>

            <div className="c3-pipeline-step">
              <span className="c3-step-badge">Phase 3</span>
              <h4>Stratified Partitioning</h4>
              <p>Exact 95% Train (121,913) / 5% Val (6,416) split. Strict 0% leakage. Preserved 79.2% Singlish vs 20.2% Mixed Sinhala stratum.</p>
              <div className="c3-step-meta">Script: <code>split_corpus.py</code></div>
            </div>

            <div className="c3-pipeline-step c3-step-active">
              <span className="c3-step-badge c3-badge-accent">Phase 4</span>
              <h4>DAPT Pre-Training</h4>
              <p>Dual-variant continued pre-training on RTX 4090 with 15% dynamic MLM. Reduced perplexity by 87.1% (146.4 &rarr; 18.9).</p>
              <div className="c3-step-meta">Script: <code>train_dapt_mlm.py</code></div>
            </div>
          </div>

          {/* Interactive Before & After Text Cleaning Viewer */}
          <div className="c3-card c3-cleaner-card">
            <h3 className="c3-card-title">Before vs. After Text Cleaning Demonstrator</h3>
            <p className="c3-card-desc">
              Select an example to see how our regex sanitization pipeline addressed noisy student text:
            </p>

            <div className="c3-cleaner-selector">
              {C3_CLEANING_EXAMPLES.map((ex, idx) => (
                <button
                  key={idx}
                  className={`c3-cleaner-btn ${activeCleanerIdx === idx ? "active" : ""}`}
                  onClick={() => setActiveCleanerIdx(idx)}
                >
                  <span className="c3-cleaner-btn-cat">{ex.category}</span>
                  <span className="c3-cleaner-btn-title">{ex.title}</span>
                </button>
              ))}
            </div>

            <div className="c3-cleaner-comparison">
              <div className="c3-cleaner-pane c3-pane-raw">
                <span className="c3-pane-header">Raw Unsanitized Text:</span>
                <p className="c3-pane-text">{C3_CLEANING_EXAMPLES[activeCleanerIdx].rawText}</p>
              </div>
              <div className="c3-cleaner-arrow">&rarr;</div>
              <div className="c3-cleaner-pane c3-pane-clean">
                <span className="c3-pane-header">Cleaned Domain Text:</span>
                <p className="c3-pane-text">{C3_CLEANING_EXAMPLES[activeCleanerIdx].cleanedText}</p>
              </div>
            </div>

            <div className="c3-cleaner-rules">
              <span className="c3-rules-title">Transformations Applied:</span>
              <ul>
                {C3_CLEANING_EXAMPLES[activeCleanerIdx].transformations.map((t, idx) => (
                  <li key={idx}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="c3-footer">
        <p>J26-SE-338 &middot; Student Conversational Emotion &amp; Mental Health Analysis &middot; Component 3 Research Workspace</p>
      </footer>
    </main>
  </>
  );
}