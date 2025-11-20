import React from "react";
import { Link } from "react-router-dom";

/**
 * Lightweight wrapper for studio/member pages.
 * - Shows a back link, page title, optional right-side actions
 * - Renders children as the page body
 */
export default function StudioShell({
  title,
  children,
  actions = null,
  backTo = "/account",
}) {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <Link to={backTo} className="btn ghost">
          ← Back to account
        </Link>
        <div style={{ marginLeft: "auto" }}>{actions}</div>
      </div>

      {title && (
        <h1 style={{ margin: "6px 0 16px", fontSize: 22, fontWeight: 700 }}>
          {title}
        </h1>
      )}

      <div className="card" style={{ padding: 16 }}>
        {children}
      </div>
    </div>
  );
}
