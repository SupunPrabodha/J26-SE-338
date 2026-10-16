"use client";

import type { FeatureContribution } from "@j26/common/contracts";

interface CsvExportButtonProps {
  contributions: FeatureContribution[];
  method: "LIME" | "SHAP";
  targetClass: string | null;
}

export function CsvExportButton({
  contributions,
  method,
  targetClass,
}: CsvExportButtonProps) {
  const hasResults = contributions && contributions.length > 0;

  function handleExportCsv() {
    if (!hasResults) return;

    const headers = ["Rank", "Token", "Attribution_Weight", "Direction", "Target_Class", "Method"];
    const rows = contributions.map((item, index) => [
      index + 1,
      `"${item.token.replace(/"/g, '""')}"`,
      item.weight.toFixed(6),
      item.direction,
      `"${(targetClass || "Selected Class").replace(/"/g, '""')}"`,
      method,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${method.toLowerCase()}_feature_attributions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      className="btn-purple-outline"
      onClick={handleExportCsv}
      disabled={!hasResults}
      title={hasResults ? "Download attribution scores as CSV" : "CSV export available only when explanation results exist"}
    >
      <span className="btn-icon">📥</span> Export contributions as CSV
    </button>
  );
}
