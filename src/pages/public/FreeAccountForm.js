// src/pages/public/FreeAccountForm.js
import React, { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api";
import "./FreeAccountForm.css";

export default function FreeAccountForm() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "", // <-- full name
    email: "",
    phone: "", // contact number
    password: "",
    confirm: "",
    org: "",
    agree: false,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // UX states (added; does not remove any existing functions)
  const [touched, setTouched] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function upd(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  const validators = useMemo(() => {
    const emailOk = /^\S+@\S+\.\S+$/.test(form.email.trim());
    const phoneOk = String(form.phone || "").trim().length >= 7; // simple sanity check
    const pwOk = String(form.password || "").length >= 6;
    const pwMatch = form.password && form.password === form.confirm;

    return {
      name: form.name.trim().length > 0,
      email: emailOk,
      phone: phoneOk,
      password: pwOk,
      confirm: pwMatch,
      agree: !!form.agree,
    };
  }, [form]);

  const passwordScore = useMemo(() => {
    const p = String(form.password || "");
    let score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 10) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return Math.min(score, 5);
  }, [form.password]);

  const canSubmit = useMemo(() => {
    return (
      validators.name &&
      validators.email &&
      validators.phone &&
      validators.password &&
      validators.confirm &&
      validators.agree &&
      !loading
    );
  }, [validators, loading]);

  function markTouched(name) {
    setTouched((t) => ({ ...t, [name]: true }));
  }

  function fieldError(name) {
    if (!touched[name]) return "";
    if (name === "name" && !validators.name)
      return "Please enter your full name.";
    if (name === "email" && !validators.email)
      return "Please enter a valid email address.";
    if (name === "phone" && !validators.phone)
      return "Please enter a valid contact number.";
    if (name === "password" && !validators.password)
      return "Password must be at least 6 characters.";
    if (name === "confirm" && !validators.confirm)
      return "Passwords do not match.";
    if (name === "agree" && !validators.agree)
      return "You must agree to continue.";
    return "";
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    // mark all as touched so errors show if invalid
    setTouched({
      name: true,
      email: true,
      phone: true,
      password: true,
      confirm: true,
      agree: true,
      org: true,
    });

    if (!form.name || !form.email || !form.password) {
      setErr("Please fill in name, email, and password.");
      return;
    }
    if (!form.phone) {
      setErr("Please include a contact number.");
      return;
    }
    if (form.password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirm) {
      setErr("Passwords do not match.");
      return;
    }
    if (!form.agree) {
      setErr("Please agree to the Terms to continue.");
      return;
    }

    setLoading(true);
    try {
      // 1) Create the user
      const { data } = await api.post("/auth/register", {
        name: form.name, // <-- send full name
        email: form.email,
        phone: form.phone,
        password: form.password,
        organization: form.org || null,
      });

      // 2) Store token if your API returns it
      const token = data?.token;
      if (token) {
        localStorage.setItem("token", token);
      }

      // 3) Activate Free plan
      try {
        await api.post("/subscriptions/change-plan", { code: "free" });
      } catch {
        try {
          await api.post("/subscriptions/start-free");
        } catch {}
      }

      // 4) Go to Account
      nav("/account", { replace: true });
    } catch (e2) {
      const msg =
        e2?.response?.data?.message ||
        e2?.response?.data?.error ||
        e2?.message ||
        "Sign-up failed. Please try again.";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="free-account-page">
      <div className="free-account-shell">
        <div className="free-account-header">
          <h1 className="page-title">Register</h1>
          <p className="page-subtitle">
            Create your free account to start watching on{" "}
            <span>BishopRobertson.TV</span>.
          </p>
        </div>

        <form className="card form-grid" onSubmit={onSubmit} noValidate>
          {err && (
            <div className="alert error" role="alert" aria-live="polite">
              {err}
            </div>
          )}

          <div className="field">
            <label htmlFor="fa-name">Full name</label>
            <input
              id="fa-name"
              name="name"
              value={form.name}
              onChange={upd}
              onBlur={() => markTouched("name")}
              placeholder="e.g., Jordan Smith"
              autoComplete="name"
              required
            />
            {fieldError("name") && (
              <div className="field-err">{fieldError("name")}</div>
            )}
          </div>

          <div className="field">
            <label htmlFor="fa-email">Email</label>
            <input
              id="fa-email"
              name="email"
              type="email"
              value={form.email}
              onChange={upd}
              onBlur={() => markTouched("email")}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            {fieldError("email") && (
              <div className="field-err">{fieldError("email")}</div>
            )}
          </div>

          <div className="field">
            <label htmlFor="fa-phone">Contact number</label>
            <input
              id="fa-phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={upd}
              onBlur={() => markTouched("phone")}
              autoComplete="tel"
              placeholder="e.g., +1 555 123 4567"
              required
            />
            {fieldError("phone") && (
              <div className="field-err">{fieldError("phone")}</div>
            )}
          </div>

          <div className="field">
            <label htmlFor="fa-org">Organization (optional)</label>
            <input
              id="fa-org"
              name="org"
              value={form.org}
              onChange={upd}
              onBlur={() => markTouched("org")}
              placeholder="Church, business, or team"
              autoComplete="organization"
            />
          </div>

          <div className="field">
            <label htmlFor="fa-pass">Password</label>
            <div className="input-row">
              <input
                id="fa-pass"
                name="password"
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={upd}
                onBlur={() => markTouched("password")}
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="Create a password"
              />
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>

            <div className="pw-meter" aria-hidden="true">
              <div className={`pw-bar s${passwordScore}`} />
            </div>
            <div className="hint">
              Use at least 6 characters. Stronger passwords include numbers and
              symbols.
            </div>

            {fieldError("password") && (
              <div className="field-err">{fieldError("password")}</div>
            )}
          </div>

          <div className="field">
            <label htmlFor="fa-confirm">Confirm password</label>
            <div className="input-row">
              <input
                id="fa-confirm"
                name="confirm"
                type={showConfirm ? "text" : "password"}
                value={form.confirm}
                onChange={upd}
                onBlur={() => markTouched("confirm")}
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="Re-enter your password"
              />
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setShowConfirm((s) => !s)}
                aria-label={
                  showConfirm
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
            {fieldError("confirm") && (
              <div className="field-err">{fieldError("confirm")}</div>
            )}
          </div>

          <div className="field checkbox">
            <label>
              <input
                type="checkbox"
                name="agree"
                checked={form.agree}
                onChange={upd}
                onBlur={() => markTouched("agree")}
              />
              <span>
                I agree to the{" "}
                <Link to="/legal/terms" target="_blank" rel="noreferrer">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/legal/privacy" target="_blank" rel="noreferrer">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {fieldError("agree") && (
              <div className="field-err">{fieldError("agree")}</div>
            )}
          </div>

          <button className="pl-btn primary" disabled={!canSubmit}>
            {loading ? (
              <span className="btn-loading">
                <span className="spinner" aria-hidden="true" />
                Creating your account…
              </span>
            ) : (
              "Create Free Account"
            )}
          </button>

          <p className="muted small">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
