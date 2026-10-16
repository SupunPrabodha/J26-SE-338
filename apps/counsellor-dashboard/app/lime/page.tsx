"use client";

import { useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { ExplanationNav } from "../components/ExplanationNav";
import { CaseReviewHeader } from "../components/CaseReviewHeader";
import { ContributionTable } from "../components/ContributionTable";
import { SignedBarChart } from "../components/SignedBarChart";
import { TextHighlighter } from "../components/TextHighlighter";
import { ExplanationInfoPanel } from "../components/ExplanationInfoPanel";
import { CsvExportButton } from "../components/CsvExportButton";
import { useReviewCase } from "../context/CaseContext";
import type { C4ExplanationResponse } from "@j26/common/contracts";

export default function LimePage() {
  const { selectedTask } = useReviewCase();

  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [explanation, setExplanation] = useState<C4ExplanationResponse | null>(null);

  // Inspect case data for submission text
  const anyTask = selectedTask as unknown as Record<string, unknown> | null;
  const preprocessing = (anyTask?.preprocessing || anyTask?.case_data) as
    | Record<string, unknown>
    | undefined;

  const submissionText =
    typeof preprocessing?.anonymized_text === "string"
      ? preprocessing.anonymized_text
      : typeof anyTask?.text === "string"
        ? anyTask.text
        : null;

  async function handleRunLime() {
    if (!submissionText) {
      setError("Cannot compute explanations: submission text is unavailable in the current ReviewTask contract.");
      return;
    }

    setIsBusy(true);
    setError("");
    setStatusMessage("Running LIME explanation with whitespace Unicode preservation...");

    try {
      const res = await fetch("/api/c4-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: submissionText,
          method: "LIME",
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Request failed with status ${res.status}`);
      }

      const data = (await res.json()) as C4ExplanationResponse;
      setExplanation(data);

      if (data.status === "AWAITING_CLASSIFIER_CONNECTION") {
        setStatusMessage("Awaiting classifier connection — C3 model integration pending.");
      } else {
        setStatusMessage("LIME explanation computed successfully.");
      }
    } catch (err) {
      setError((err as Error).message || "Could not retrieve LIME explanation from services.");
    } finally {
      setIsBusy(false);
    }
  }

  const hasResults = Boolean(
    explanation &&
      explanation.status === "READY" &&
      explanation.contributions &&
      explanation.contributions.length > 0
  );

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-content" id="content">
        <header className="c4-dashboard-header">
          <div>
            <p className="eyebrow">Component 4 · Explainable AI</p>
            <h1>LIME Feature Attribution</h1>
            <p className="subtitle">
              Local surrogate interpretable word contributions for counsellor review.
            </p>
          </div>
          <div className="header-badge-group">
            <span className="badge-purple">LIME Explainer</span>
            <span className="badge-pending">Model Prediction: Pending C3 integration</span>
          </div>
        </header>

        <aside className="screening-notice-banner" aria-label="Non-diagnostic boundary">
          <strong>Mandatory Practice Notice:</strong>
          <p>
            Screening support only. Requires counsellor-assisted interpretation and does not replace professional counselling.
          </p>
        </aside>

        <ExplanationNav />

        {/* Top Cards: Read-only Input Text, Model Prediction, Case Summary */}
        <CaseReviewHeader />

        {error && (
          <div className="error-alert" role="alert">
            {error}
          </div>
        )}

        {statusMessage && (
          <p className="feedback" role="status" aria-live="polite">
            {statusMessage}
          </p>
        )}

        {/* Action Controls */}
        <div className="explanation-action-toolbar">
          <div className="action-buttons-group">
            <button
              type="button"
              className="btn-purple"
              onClick={handleRunLime}
              disabled={isBusy || !submissionText}
              title={
                !submissionText
                  ? "Explanation actions disabled: submission text is unavailable in current ReviewTask contract"
                  : "Compute LIME attributions for this case"
              }
            >
              {isBusy ? "Computing LIME..." : "Compute LIME Attributions"}
            </button>

            {!submissionText && (
              <span className="action-disabled-hint">
                Explanation action disabled: submission text is unavailable in the current ReviewTask contract and C3 classifier connection is pending.
              </span>
            )}
          </div>

          <div className="export-action-group">
            <CsvExportButton
              contributions={explanation?.contributions || []}
              method="LIME"
              targetClass={explanation?.target_class || null}
            />
          </div>
        </div>

        {/* Explanation Visualizations and Tables */}
        <div className="c4-cards-grid">
          {/* Left Column: Signed Bars and Highlighting */}
          <div className="grid-stack">
            <section className="card" aria-labelledby="bars-heading">
              <div className="card-header">
                <h3 id="bars-heading">Feature Importance (Signed Bars)</h3>
                <span className="badge-info">Directional Impact</span>
              </div>
              <SignedBarChart
                contributions={explanation?.contributions || []}
                method="LIME"
                targetClass={explanation?.target_class || null}
              />
            </section>

            <section className="card" aria-labelledby="highlight-heading">
              <div className="card-header">
                <h3 id="highlight-heading">In-Text Attribution Highlighting</h3>
                <span className="badge-info">LIME Local Weights</span>
              </div>
              <TextHighlighter
                text={submissionText || ""}
                contributions={explanation?.contributions || []}
                targetClass={explanation?.target_class || null}
              />
            </section>
          </div>

          {/* Right Column: Table & Methodology */}
          <div className="grid-stack">
            <section className="card" aria-labelledby="table-heading">
              <div className="card-header">
                <h3 id="table-heading">Attribution Contributions Table</h3>
                {hasResults && explanation?.contributions && (
                  <span className="badge-success">
                    {explanation.contributions.length} features extracted
                  </span>
                )}
              </div>
              <ContributionTable
                contributions={explanation?.contributions || []}
                method="LIME"
                targetClass={explanation?.target_class || null}
              />
            </section>

            <section className="card" aria-labelledby="info-heading">
              <div className="card-header">
                <h3 id="info-heading">Methodology &amp; Parameters</h3>
              </div>
              <ExplanationInfoPanel
                method="LIME"
                status={explanation?.status || "AWAITING_CLASSIFIER_CONNECTION"}
                modelVersion={explanation?.model_version || null}
                targetClass={explanation?.target_class || null}
                targetClassProbability={explanation?.target_class_probability || null}
                computationBounds={explanation?.computation_bounds}
              />
            </section>
          </div>
        </div>

        <footer className="c4-footer">
          J26-SE-338 · Component 4 (Explainable AI &amp; Evaluation) · Fictional counsellor review shell
        </footer>
      </main>
    </div>
  );
}
