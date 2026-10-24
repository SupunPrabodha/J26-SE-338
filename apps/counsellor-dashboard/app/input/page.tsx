"use client";

import { useState, type FormEvent } from "react";
import { Sidebar } from "../components/Sidebar";
import { useReviewCase } from "../context/CaseContext";

export default function InputPage() {
  const { inputText, setInputText } = useReviewCase();
  const [text, setText] = useState(inputText || "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInputText(text);
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-content" id="content">
        <header className="c4-dashboard-header">
          <div>
            <p className="eyebrow">Component 4 · Explainable AI</p>
            <h1>Input</h1>
          </div>
        </header>

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="textarea-group">
              <textarea
                aria-label="Input text"
                className="c4-textarea"
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="c4-action-row">
              <button type="submit" className="btn-purple">
                Submit
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
