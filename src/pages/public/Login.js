// src/pages/public/Login.js
import React, { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import api from "../../api";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  function computeRedirect(user) {
    // 1) ?next=/path
    const qs = new URLSearchParams(location.search);
    const nextParam = qs.get("next");

    // 2) pending path set by a ProtectedRoute
    const pendingPath = localStorage.getItem("pendingPath");

    // 3) from router state
    const stateFrom =
      location.state?.from &&
      location.state.from.pathname + (location.state.from.search || "");

    // 4) role-based default
    const role = String(user?.role || "user").toLowerCase();
    const roleDefault = role === "admin" ? "/admin" : "/account";

    return nextParam || pendingPath || stateFrom || roleDefault || "/";
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await api.post("/auth/login", { email, password });
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

      // Clear pendingPath if we used it
      if (redirectTo === localStorage.getItem("pendingPath")) {
        localStorage.removeItem("pendingPath");
      }

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

  return (
    <div className="auth-wrap">
      <div className="auth-grid">
        {/* Left: form card */}
        <div className="auth-card card">
          <h1 className="auth-title">Sign in</h1>

          {error ? <div className="auth-alert">{error}</div> : null}

          <form onSubmit={onSubmit} className="auth-form" autoComplete="on">
            <label className="auth-label">
              Email
              <input
                className="auth-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>

            <label className="auth-label">
              Password
              <div className="auth-input-wrap">
                <input
                  className="auth-input"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-eye"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  title={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? "🙈" : "👁️"}
                </button>
              </div>
            </label>

            <div className="auth-row">
              <label className="auth-check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              <Link to="/forgot" className="auth-link">
                Forgot password?
              </Link>
            </div>

            <button className="auth-btn primary" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="auth-foot">
            Don’t have an account? <Link to="/free-account">Create one</Link>
          </div>
        </div>

        {/* Right: promo / artwork (hidden on mobile) */}
        <aside className="auth-aside">
          <div className="auth-aside-inner">
            <h2>Welcome back</h2>
            <p>
              Access your library, manage your subscriptions, and keep
              streaming.
            </p>
            <ul>
              <li>Unlimited streaming on any device</li>
              <li>Cancel anytime</li>
              <li>Secure checkout</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
