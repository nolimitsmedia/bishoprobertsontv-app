// src/pages/public/ForgotPassword.js
import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import "./Login.css"; // re-use the same styles

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      // Try a few common endpoints; succeed on the first that works.
      const endpoints = [
        "/auth/forgot",
        "/auth/password/forgot",
        "/auth/reset/request",
        "/password/forgot",
      ];
      let ok = false;
      for (const url of endpoints) {
        try {
          const r = await api.post(url, { email });
          if (r?.status < 400) {
            ok = true;
            break;
          }
        } catch {}
      }
      if (!ok)
        throw new Error("We couldn’t send a reset email. Please try again.");
      setSent(true);
    } catch (e) {
      setErr(
        e?.response?.data?.message || e.message || "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-grid">
        <div className="auth-card card">
          <h1 className="auth-title">Reset your password</h1>

          {sent ? (
            <div className="auth-alert success">
              If an account exists for <strong>{email}</strong>, a reset link
              has been sent. Please check your inbox (and spam folder).
            </div>
          ) : (
            <>
              {err && <div className="auth-alert">{err}</div>}
              <form className="auth-form" onSubmit={onSubmit}>
                <label className="auth-label">
                  Email
                  <input
                    className="auth-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
                <button className="auth-btn primary" disabled={busy}>
                  {busy ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          )}

          <div className="auth-foot">
            <Link to="/login">Back to sign in</Link>
          </div>
        </div>

        <aside className="auth-aside">
          <div className="auth-aside-inner">
            <h2>Forgot your password?</h2>
            <p>Enter your email and we’ll send you a secure reset link.</p>
            <ul>
              <li>Fast and secure</li>
              <li>Link expires for safety</li>
              <li>Contact support if you need help</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
