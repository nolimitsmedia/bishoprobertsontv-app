import React from "react";
import { useLocation, Link } from "react-router-dom";

export default function SubscribeThanks() {
  const { state } = useLocation();
  const planTitle = state?.title || "your plan";

  return (
    <div style={{ maxWidth: 720, margin: "80px auto", padding: "0 16px" }}>
      <div className="card" style={{ textAlign: "center", padding: 28 }}>
        <h2 style={{ marginTop: 0 }}>🎉 You’re all set!</h2>
        <p style={{ color: "#6b7280" }}>
          Thanks for subscribing to <strong>{planTitle}</strong>.
        </p>
        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 8,
            justifyContent: "center",
          }}
        >
          <Link className="btn" to="/">
            Go to Dashboard
          </Link>
          <Link className="btn ghost" to="/subscribe">
            Change plan
          </Link>
        </div>
      </div>
    </div>
  );
}
