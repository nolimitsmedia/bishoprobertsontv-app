// src/pages/public/ResetPassword.js
// The page the "Reset your password" email links to:
//   #/reset-password?token=…  → choose a new password → sign in.
import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../api";
import AuthShell, { AuthField } from "../../components/auth/AuthShell";
import "./EmailPreferences.css";

const MIN = 8;

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState("checking"); // checking | ready | invalid | done
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    if (!token) {
      setState("invalid");
      return undefined;
    }
    api
      .get("/auth/reset/verify", { params: { token } })
      .then(() => alive && setState("ready"))
      .catch(() => alive && setState("invalid"));
    return () => {
      alive = false;
    };
  }, [token]);

  const tooShort = pw.length > 0 && pw.length < MIN;
  const mismatch = pw2.length > 0 && pw !== pw2;

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    // Problems already shown under a field aren't repeated at the top.
    if (pw.length < MIN)
      return pw.length
        ? undefined
        : setErr(`Enter a new password (at least ${MIN} characters).`);
    if (!pw2) return setErr("Type the new password again.");
    if (pw !== pw2) return undefined;
    setBusy(true);
    try {
      await api.post("/auth/reset", { token, password: pw });
      setState("done");
    } catch (e2) {
      const msg = e2?.response?.data?.message || "";
      if (/invalid|expired/i.test(msg)) setState("invalid");
      else setErr(msg || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      headline="Choose a new password"
      points={[
        "Use at least 8 characters",
        "A short phrase is easier to remember",
        "You’ll sign in with it right after",
      ]}
      title={
        state === "done"
          ? "Password changed"
          : state === "invalid"
            ? "This link has expired"
            : "Set a new password"
      }
      subtitle={
        state === "ready"
          ? "Enter your new password twice."
          : state === "checking"
            ? "Checking your link…"
            : ""
      }
      footer={
        <Link to="/login" className="as-link">
          ← Back to sign in
        </Link>
      }
    >
      {state === "done" ? (
        <>
          <div className="as-success" role="status">
            Your password has been changed. You can sign in with it now.
          </div>
          <Link to="/login" className="as-btn" style={{ textAlign: "center" }}>
            Sign in
          </Link>
        </>
      ) : state === "invalid" ? (
        <>
          <div className="as-alert" role="alert">
            Reset links work for 24 hours and only once. Ask for a new one and
            use the newest email.
          </div>
          <Link to="/forgot" className="as-btn" style={{ textAlign: "center" }}>
            Send a new reset link
          </Link>
        </>
      ) : state === "ready" ? (
        <>
          {err ? (
            <div className="as-alert" role="alert">
              {err}
            </div>
          ) : null}
          <form className="as-form" onSubmit={onSubmit} noValidate>
            <AuthField
              label="New password"
              hint={tooShort ? undefined : `At least ${MIN} characters`}
              error={tooShort ? `Use at least ${MIN} characters.` : undefined}
            >
              <input
                className="as-input"
                type={show ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="new-password"
                required
                autoFocus
              />
            </AuthField>
            <AuthField
              label="Type it again"
              error={mismatch ? "The passwords don’t match." : undefined}
            >
              <input
                className="as-input"
                type={show ? "text" : "password"}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                autoComplete="new-password"
                required
              />
            </AuthField>
            <label className="rp-show">
              <input
                type="checkbox"
                checked={show}
                onChange={(e) => setShow(e.target.checked)}
              />
              <span>Show passwords</span>
            </label>
            <button
              className="as-btn"
              disabled={busy}
              aria-busy={busy ? "true" : "false"}
            >
              {busy ? (
                <>
                  <span className="as-spinner" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                "Save new password"
              )}
            </button>
          </form>
        </>
      ) : (
        <p role="status" className="as-subtitle">
          <span className="as-spinner" aria-hidden="true" /> Checking…
        </p>
      )}
    </AuthShell>
  );
}
