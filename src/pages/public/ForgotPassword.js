// src/pages/public/ForgotPassword.js
import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import AuthShell, { AuthField } from "../../components/auth/AuthShell";

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
        e?.response?.data?.message || e.message || "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      headline="Forgot your password?"
      points={[
        "We’ll email you a secure reset link",
        "The link expires after a while, for your safety",
        "Need help? Use the Contact page",
      ]}
      title="Reset your password"
      subtitle={
        sent
          ? ""
          : "Enter the email you signed up with and we’ll send you a reset link."
      }
      footer={
        <Link to="/login" className="as-link">
          ← Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="as-success" role="status">
          If an account exists for <strong>{email}</strong>, a reset link has
          been sent. Please check your inbox (and the spam folder).
        </div>
      ) : (
        <>
          {err ? (
            <div className="as-alert" role="alert">
              {err}
            </div>
          ) : null}
          <form className="as-form" onSubmit={onSubmit}>
            <AuthField label="Email">
              <input
                className="as-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                required
                autoFocus
              />
            </AuthField>
            <button
              className="as-btn"
              disabled={busy}
              aria-busy={busy ? "true" : "false"}
            >
              {busy ? (
                <>
                  <span className="as-spinner" aria-hidden="true" />
                  Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
