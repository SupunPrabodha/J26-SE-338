"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ExplanationNav() {
  const pathname = usePathname();

  const tabs = [
    {
      id: "lime",
      label: "LIME Feature Attribution",
      href: "/lime",
      desc: "Local surrogate interpretable feature weights",
    },
    {
      id: "shap",
      label: "SHAP Additive Values",
      href: "/shap",
      desc: "Game-theoretic Shapley additive attributions",
    },
  ];

  return (
    <nav className="explanation-tabs" aria-label="Explanation Method Switcher">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`tab-btn ${isActive ? "active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <strong>{tab.label}</strong>
            <span className="tab-desc">{tab.desc}</span>
          </Link>
        );
      })}
    </nav>
  );
}
