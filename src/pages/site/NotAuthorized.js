// src/pages/site/NotAuthorized.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function NotAuthorized() {
  return (
    <div className="card" style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>403 — Not authorized</h2>
      <p className="vd-muted">You need an admin account to access this page.</p>
      <Link className="btn" to="/">
        Back to home
      </Link>
    </div>
  );
}
