"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: "Input", href: "/input" },
    { label: "Assigned Reviews", href: "/" },
    { label: "LIME Attribution", href: "/lime" },
    { label: "SHAP Additive Values", href: "/shap" },
  ];

  return (
    <aside className="dashboard-sidebar" aria-label="Counsellor Navigation">
      <div className="sidebar-brand">
        <span className="brand-badge">J26-SE-338</span>
        <h2>Counsellor Portal</h2>
        <p className="sidebar-subtitle">Screening Review &amp; XAI</p>
      </div>

      <nav className="sidebar-nav">
        <p className="nav-heading">Explanation &amp; Review</p>
        <ul>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`sidebar-link ${isActive ? "active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="link-indicator" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-notice">
          <strong>Non-Diagnostic Boundary</strong>
          <p>
            Screening support only. Requires counsellor-assisted interpretation and does not replace professional counselling.
          </p>
        </div>
        <p className="sidebar-version">Component 4 · Development</p>
      </div>
    </aside>
  );
}
