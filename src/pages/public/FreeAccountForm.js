// src/pages/public/FreeAccountForm.js
import React, { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api";
import AuthShell, {
  AuthField,
  PasswordInput,
} from "../../components/auth/AuthShell";

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

  // strength: 0 none, 1 weak, 2 fair, 3 good, 4 strong
  const level = !form.password
    ? 0
    : passwordScore <= 1
      ? 1
      : passwordScore === 2
        ? 2
        : passwordScore <= 4
          ? 3
          : 4;
  const levelLabel = ["", "Weak", "Fair", "Good", "Strong"][level];

  return (
    <AuthShell
      headline="Create your free account"
      points={[
        "Free to join — no card needed",
        "Watch messages and join the live services",
        "Save favourites to My List and pick up where you left off",
      ]}
      title="Register"
      subtitle="It takes less than a minute."
      wide
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="as-link">
            Sign in
          </Link>
        </>
      }
    >
      {err ? (
        <div className="as-alert" role="alert">
          {err}
        </div>
      ) : null}
      <form className="as-form" onSubmit={onSubmit} noValidate>
        <div className="as-grid2">
          <AuthField label="Full name" error={fieldError("name")}>
            <input
              className="as-input"
              name="name"
              value={form.name}
              onChange={upd}
              onBlur={() => markTouched("name")}
              placeholder="e.g. Jordan Smith"
              autoComplete="name"
              required
            />
          </AuthField>
          <AuthField label="Email" error={fieldError("email")}>
            <input
              className="as-input"
              type="email"
              name="email"
              value={form.email}
              onChange={upd}
              onBlur={() => markTouched("email")}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              required
            />
          </AuthField>
          <AuthField label="Contact number" error={fieldError("phone")}>
            <input
              className="as-input"
              type="tel"
              name="phone"
              value={form.phone}
              onChange={upd}
              onBlur={() => markTouched("phone")}
              placeholder="e.g. +1 555 123 4567"
              autoComplete="tel"
              inputMode="tel"
              required
            />
          </AuthField>
          <AuthField label="Organization" optional>
            <input
              className="as-input"
              name="org"
              value={form.org}
              onChange={upd}
              placeholder="Church, business or team"
              autoComplete="organization"
            />
          </AuthField>
          <AuthField
            label="Password"
            error={fieldError("password")}
            hint="At least 6 characters."
          >
            <PasswordInput
              show={showPw}
              onToggle={() => setShowPw((v) => !v)}
              name="password"
              value={form.password}
              onChange={upd}
              onBlur={() => markTouched("password")}
              placeholder="Create a password"
              autoComplete="new-password"
              required
            />
          </AuthField>
          <AuthField label="Confirm password" error={fieldError("confirm")}>
            <PasswordInput
              show={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
              name="confirm"
              value={form.confirm}
              onChange={upd}
              onBlur={() => markTouched("confirm")}
              placeholder="Type it again"
              autoComplete="new-password"
              required
            />
          </AuthField>
        </div>
        {form.password ? (
          <div className="as-strength" aria-live="polite">
            <div className="as-bars" data-level={level} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <p className="as-hint">Password strength: {levelLabel}</p>
          </div>
        ) : null}
        <div className="as-field">
          <label className="as-check">
            <input
              type="checkbox"
              name="agree"
              checked={form.agree}
              onChange={upd}
              onBlur={() => markTouched("agree")}
              aria-invalid={fieldError("agree") ? true : undefined}
              aria-describedby={
                fieldError("agree") ? "fa-agree-err" : undefined
              }
            />
            <span>
              I agree to the{" "}
              <Link to="/terms" target="_blank" rel="noreferrer">
                Terms and Conditions
              </Link>{" "}
              and the{" "}
              <Link to="/privacy" target="_blank" rel="noreferrer">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {fieldError("agree") ? (
            <p className="as-error" id="fa-agree-err">
              {fieldError("agree")}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          className="as-btn"
          disabled={loading}
          aria-busy={loading ? "true" : "false"}
        >
          {loading ? (
            <>
              <span className="as-spinner" aria-hidden="true" />
              Creating your account…
            </>
          ) : (
            "Create free account"
          )}
        </button>
      </form>
    </AuthShell>
  );
}
