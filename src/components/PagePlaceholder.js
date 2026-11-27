// src/components/PagePlaceholder.js
// Shown for About / Leadership / Partnership when the ministry hasn't
// published that page yet in Admin › Pages (Phase 2C: no built-in content).
import React from "react";
import { Link } from "react-router-dom";

export default function PagePlaceholder({ title }) {
  return (
    <main
      style={{
        minHeight: "60vh",
        display: "grid",
        placeItems: "center",
        padding: "64px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ margin: "0 0 12px", fontSize: "clamp(28px, 4vw, 40px)" }}>
          {title}
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            opacity: 0.8,
            fontSize: 17,
            lineHeight: 1.6,
          }}
        >
          This page is being prepared. Please check back soon.
        </p>
        <Link to="/" className="btn">
          Back to home
        </Link>
      </div>
    </main>
  );
}
