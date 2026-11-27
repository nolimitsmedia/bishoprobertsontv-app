// src/pages/public/Login.js
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import api from "../../api";
import AuthShell, {
  AuthField,
  PasswordInput,
} from "../../components/auth/AuthShell";
import { SITE } from "../../config/site";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // UX-only helpers (does not change auth logic)
  const [capsOn, setCapsOn] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  function safeInternalRedirect(url) {
    const value = String(url || "").trim();
    if (!value) return "/";

    // Keep redirects inside the React app only.
    if (/^https?:\/\//i.test(value) || value.startsWith("//")) return "/";
    return value.startsWith("/") ? value : `/${value}`;
  }

  function appendResumeTime(url, resumeSeconds) {
    const target = safeInternalRedirect(url);
    const t = Number(resumeSeconds);
    if (!Number.isFinite(t) || t <= 0) return target || "/";

    try {
      const [path, hash = ""] = target.split("#");
      const [base, query = ""] = path.split("?");
      const qs = new URLSearchParams(query);
      if (!qs.has("t")) qs.set("t", String(Math.floor(t)));
      const out = `${base}?${qs.toString()}`;
      return hash ? `${out}#${hash}` : out;
    } catch {
      const hasQuery = target.includes("?");
      return `${target}${hasQuery ? "&" : "?"}t=${Math.floor(t)}`;
    }
  }

  function computeRedirect(user) {
    const qs = new URLSearchParams(location.search);

    // 1) ?next=/path
    const nextParam = qs.get("next");

    // If login was triggered mid-watch, we may have t=
    const resumeT = qs.get("t");

    // 2) pending path set by a ProtectedRoute
    const pendingPath = localStorage.getItem("pendingPath");

    // 3) from router state
    const stateFrom =
      location.state?.from &&
      location.state.from.pathname + (location.state.from.search || "");

    // 4) role-based default
    const role = String(user?.role || "user").toLowerCase();
    const roleDefault = role === "admin" ? "/admin" : "/account";

    const baseTarget =
      nextParam || pendingPath || stateFrom || roleDefault || "/";
    return appendResumeTime(baseTarget, resumeT);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      // Small UX improvement: trim email (doesn't remove/replace any logic)
      const cleanEmail = String(email || "").trim();

      const res = await api.post("/auth/login", {
        email: cleanEmail,
        password,
      });
      const token = res?.data?.token;
      const user = res?.data?.user || res?.data?.me || null;

      if (!token) {
        throw new Error("Missing token");
      }

      // Persist token + user (sessionStorage if remember = false)
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem("token", token);
      storage.setItem("user", JSON.stringify(user));

      // Ensure the other store doesn't hold a stale token
      const other = remember ? sessionStorage : localStorage;
      other.removeItem("token");
      other.removeItem("user");

      // Set default auth header for subsequent requests
      api.defaults.headers.common.Authorization = `Bearer ${token}`;

      // Compute redirect target
      const redirectTo = computeRedirect(user);

      // Clear any stale protected-route redirect after a successful login.
      localStorage.removeItem("pendingPath");

      navigate(redirectTo, { replace: true });
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Login failed. Check your credentials.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = useMemo(() => {
    return (
      String(email || "").trim().length > 0 && String(password || "").length > 0
    );
  }, [email, password]);

  return (
    <AuthShell
      headline="Every message. Every service. Anywhere."
      points={[
        "Watch the full library of messages, on any device",
        "Join the live services and get a reminder before they start",
        "Pick up where you left off, and keep your own playlists",
      ]}
      title="Sign in"
      subtitle="Welcome back. Sign in to continue watching."
    >
      {error ? (
        <div className="as-alert" role="alert">
          {error}
        </div>
      ) : null}
      <form
        onSubmit={onSubmit}
        className="as-form"
        autoComplete="on"
        noValidate
      >
        <AuthField label="Email">
          <input
            className="as-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            placeholder="you@example.com"
            required
            autoFocus
            inputMode="email"
          />
        </AuthField>
        <AuthField label="Password" hint={capsOn ? "Caps Lock is on" : ""}>
          <PasswordInput
            show={showPw}
            onToggle={() => setShowPw((v) => !v)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Your password"
            required
            onKeyUp={(e) =>
              setCapsOn(e.getModifierState?.("CapsLock") || false)
            }
          />
        </AuthField>
        <div className="as-row">
          <label className="as-check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Remember me</span>
          </label>
          <Link to="/forgot" className="as-link">
            Forgot password?
          </Link>
        </div>
        <button
          className="as-btn"
          disabled={submitting || !canSubmit}
          aria-busy={submitting ? "true" : "false"}
        >
          {submitting ? (
            <>
              <span className="as-spinner" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
        <div className="as-divider">New to {SITE.name}?</div>
        <Link to="/free-account" className="as-btn as-btn--ghost">
          Create a free account
        </Link>
      </form>
    </AuthShell>
  );
}
