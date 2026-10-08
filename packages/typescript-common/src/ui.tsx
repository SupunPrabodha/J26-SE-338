"use client";

import { Component, type ReactNode } from "react";

export function SafetyNotice() {
  return <aside aria-label="Prototype limitations" className="notice">
    <strong>MOCK · SYNTHETIC · DEVELOPMENT ONLY</strong>
    <p>Student mental wellbeing screening support. This prototype does not provide clinical diagnosis,
      treatment advice, or emergency intervention. All indicators require authorized human interpretation.</p>
    <p>Use the supplied fictional fixtures only. Do not enter real student information.</p>
  </aside>;
}

export function ErrorMessage({ message }: { message: string }) {
  return message ? <p role="alert" className="error">{message}</p> : null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p role="alert">The development interface could not load. Refresh to try again.</p> : this.props.children;
  }
}
