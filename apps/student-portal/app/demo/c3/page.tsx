import type { Metadata } from "next";
import C3Demo from "../../../components/c3-demo";
import "../../../components/c3-demo.css";

export const metadata: Metadata = {
  title: "Component 3 Demo: XLM-RoBERTa Domain-Adaptive Pre-Training (DAPT)",
  description:
    "Interactive research studio evaluating domain-adapted multilingual language models on Sinhala-English code-mixed and Singlish student mental health discourse.",
};

export default function ComponentThreeDemoPage() {
  return <C3Demo />;
}
