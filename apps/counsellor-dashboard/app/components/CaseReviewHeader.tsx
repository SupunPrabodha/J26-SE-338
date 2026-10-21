"use client";

import Link from "next/link";
import { useReviewCase } from "../context/CaseContext";

export function CaseReviewHeader() {
  const { tasks, selectedTask, selectedTaskId, selectTask, loadTasks, devInput } = useReviewCase();

  // Inspect the current review contract or active development input
  const anyTask = selectedTask as unknown as Record<string, unknown> | null;
  const preprocessing = (anyTask?.preprocessing || anyTask?.case_data) as
    | Record<string, unknown>
    | undefined;

  const submissionText =
    devInput && devInput.text
      ? devInput.text
      : typeof preprocessing?.anonymized_text === "string"
      ? preprocessing.anonymized_text
      : typeof anyTask?.text === "string"
        ? anyTask.text
        : null;

  const languageMetadata =
    devInput && devInput.language
      ? devInput.language
      : typeof preprocessing?.language === "string"
      ? preprocessing.language
      : typeof anyTask?.language === "string"
        ? anyTask.language
        : null;

  return (
    <section className="c4-case-review-header" aria-label="Selected Case and Prediction Overview">
      {/* Case Selector Toolbar */}
      <div className="case-selector-bar">
        <div className="selector-left">
          <label htmlFor="case-select-dropdown">Selected Review Case:</label>
          {tasks.length > 0 ? (
            <select
              id="case-select-dropdown"
              className="c4-select case-dropdown"
              value={selectedTaskId || ""}
              onChange={(e) => selectTask(e.target.value)}
            >
              {tasks.map((task, index) => (
                <option key={task.task_id} value={task.task_id}>
                  Case {index + 1} ({task.case.case_id.slice(0, 8)}…) — {task.case.processing_status}
                </option>
              ))}
            </select>
          ) : (
            <span className="no-cases-badge">No assigned cases available</span>
          )}
        </div>

        <div className="selector-right">
          <button
            type="button"
            className="btn-quiet-sm"
            onClick={() => loadTasks()}
            title="Refresh assigned tasks from server"
          >
            ↻ Refresh cases
          </button>
        </div>
      </div>

      {/* Top 3 Prototype Cards: Input Text, Model Prediction, Case Summary */}
      <div className="top-cards-grid">
        {/* Card 1: Read-only Input Text Card */}
        <div className="card read-only-input-card">
          <div className="card-header">
            <h3>Input Text</h3>
            {languageMetadata ? (
              <span className="badge-info">Language: {languageMetadata}</span>
            ) : null}
          </div>

          {submissionText ? (
            <div className="case-submission-body">
              <pre className="read-only-text">{submissionText}</pre>
            </div>
          ) : (
            <div className="submission-unavailable-box" role="status">
              <div className="unavailable-icon">📝</div>
              <strong>No reflection text selected</strong>
              <p className="unavailable-hint">
                Select an assigned review case above, or enter and analyze a fictional reflection on the Development Input page.
              </p>
              <Link
                href="/c4-dev-input"
                style={{
                  display: "inline-block",
                  marginTop: "8px",
                  padding: "6px 12px",
                  background: "#6366f1",
                  color: "#ffffff",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Go to Development Input →
              </Link>
            </div>
          )}
        </div>

        {/* Card 2: Model Prediction Card */}
        <div className="card model-prediction-card">
          <div className="card-header">
            <h3>Model Prediction</h3>
            {devInput?.prediction ? (
              <span
                style={{
                  background: "#dcfce7",
                  color: "#166534",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                Temporary C4 Model
              </span>
            ) : (
              <span className="badge-pending">Pending C3 integration</span>
            )}
          </div>

          <div className="prediction-content">
            <div className="pred-row">
              <span className="pred-label">Wellbeing Indicator:</span>
              <span className="pred-val">
                {devInput?.prediction?.predicted_sentiment ||
                  selectedTask?.inference?.wellbeing_indicator ||
                  "Pending input analysis"}
              </span>
            </div>
            <div className="pred-row">
              <span className="pred-label">Emotional Tone:</span>
              <span className="pred-val">
                {devInput?.prediction?.predicted_sentiment
                  ? `Sentiment: ${devInput.prediction.predicted_sentiment}`
                  : selectedTask?.inference?.emotional_tone || "Pending input analysis"}
              </span>
            </div>
            <div className="pred-row">
              <span className="pred-label">Review Priority:</span>
              <span className="pred-val priority">
                {devInput ? "DEV_INTERPRETATION" : selectedTask?.inference?.review_priority || "HUMAN_REVIEW_REQUIRED"}
              </span>
            </div>
            <div className="pred-row">
              <span className="pred-label">Model Confidence:</span>
              <span className="pred-val text-muted">
                {devInput?.prediction
                  ? `${Math.round(devInput.prediction.confidence * 100)}% (${devInput.prediction.model_id || "twitter-xlm-roberta-base-sentiment"})`
                  : selectedTask?.inference?.confidence !== undefined
                  ? `${Math.round(selectedTask.inference.confidence * 100)}% (Uncalibrated mock fixture)`
                  : "Pending C3 integration"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Case Summary Card */}
        <div className="card case-summary-card">
          <div className="card-header">
            <h3>Case Summary</h3>
            <span className="badge-purple">
              {devInput ? "Development Input" : selectedTask?.case?.processing_status || "Not selected"}
            </span>
          </div>

          <div className="summary-content">
            <div className="summary-row">
              <span className="sum-label">Case Reference:</span>
              <code className="sum-code">
                {devInput ? "Fictional reflection input" : selectedTask?.case?.case_id || "None selected"}
              </code>
            </div>
            <div className="summary-row">
              <span className="sum-label">Correlation ID:</span>
              <code className="sum-code">
                {devInput ? devInput.id : selectedTask?.case?.correlation_id || "None"}
              </code>
            </div>
            <div className="summary-row">
              <span className="sum-label">Review Protocol:</span>
              <span className="sum-val">Counsellor-Assisted (Authorized Human)</span>
            </div>
            <div className="summary-row">
              <span className="sum-label">Consent Boundary:</span>
              <span className="sum-val active-status">Active Demonstration Consent</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
