"use client";

import { useReviewCase } from "../context/CaseContext";

export function CaseReviewHeader() {
  const { tasks, selectedTask, selectedTaskId, selectTask, loadTasks } = useReviewCase();

  // Inspect the current review contract for submission text or preprocessing data
  // The current C1 ReviewTask contract (task_id, case, inference, explanation) does not include
  // PreprocessResponse or submission text. We check if it is supplied dynamically or remains unavailable.
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

  const languageMetadata =
    typeof preprocessing?.language === "string"
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
              <div className="unavailable-icon">📄</div>
              <strong>Submission text unavailable</strong>
              <p className="unavailable-hint">
                Current C1 ReviewTask contract provides inference &amp; explanation receipts, but excludes raw/preprocessed submission text.
              </p>
              <span className="contract-change-tag">
                Contract extension required: extend ReviewTask with PreprocessResponse
              </span>
            </div>
          )}
        </div>

        {/* Card 2: Model Prediction Card */}
        <div className="card model-prediction-card">
          <div className="card-header">
            <h3>Model Prediction</h3>
            <span className="badge-pending">Pending C3 integration</span>
          </div>

          <div className="prediction-content">
            <div className="pred-row">
              <span className="pred-label">Wellbeing Indicator:</span>
              <span className="pred-val">
                {selectedTask?.inference?.wellbeing_indicator || "Pending C3 integration"}
              </span>
            </div>
            <div className="pred-row">
              <span className="pred-label">Emotional Tone:</span>
              <span className="pred-val">
                {selectedTask?.inference?.emotional_tone || "Pending C3 integration"}
              </span>
            </div>
            <div className="pred-row">
              <span className="pred-label">Review Priority:</span>
              <span className="pred-val priority">
                {selectedTask?.inference?.review_priority || "HUMAN_REVIEW_REQUIRED"}
              </span>
            </div>
            <div className="pred-row">
              <span className="pred-label">Model Confidence:</span>
              <span className="pred-val text-muted">
                {selectedTask?.inference?.confidence !== undefined
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
              {selectedTask?.case?.processing_status || "Not selected"}
            </span>
          </div>

          <div className="summary-content">
            <div className="summary-row">
              <span className="sum-label">Case Reference:</span>
              <code className="sum-code">
                {selectedTask?.case?.case_id || "None selected"}
              </code>
            </div>
            <div className="summary-row">
              <span className="sum-label">Correlation ID:</span>
              <code className="sum-code">
                {selectedTask?.case?.correlation_id || "None"}
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
