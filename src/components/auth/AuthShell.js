// src/components/auth/AuthShell.js — shared layout for Sign in, Register and
// Forgot password: a centered headline with the benefits, and the form card.
// On phones the headline sits above the form.
import React, { useId } from "react";
import "./AuthShell.css";
import { SITE } from "../../config/site";

export default function AuthShell({
  kicker = SITE.name,
  headline,
  points = [],
  title,
  subtitle,
  children,
  footer,
  wide = false,
}) {
  return (
    <main className="as-page">
      <section className="as-art">
        <div className="as-artInner">
          <p className="as-kicker">{kicker}</p>
          {headline ? <h2 className="as-headline">{headline}</h2> : null}
          {points.length ? (
            <ul className="as-points">
              {points.map((p) => (
                <li key={p}>
                  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                    <path
                      d="M7.7 13.6 4.4 10.3l-1.3 1.3 4.6 4.6 9.2-9.2-1.3-1.3z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
      <section className="as-panel">
        <div className={`as-card ${wide ? "as-card--wide" : ""}`}>
          <h1 className="as-title">{title}</h1>
          {subtitle ? <p className="as-sub">{subtitle}</p> : null}
          {children}
        </div>
        {footer ? <div className="as-footer">{footer}</div> : null}
      </section>
    </main>
  );
}

// A labelled field with an optional hint and an error announced to screen readers.
export function AuthField({
  label,
  optional,
  hint,
  error,
  children,
  id: idIn,
}) {
  const auto = useId();
  const id = idIn || `af-${auto.replace(/[^a-z0-9]/gi, "")}`;
  const describedBy =
    [hint ? `${id}-hint` : "", error ? `${id}-err` : ""]
      .filter(Boolean)
      .join(" ") || undefined;
  const child = React.Children.only(children);
  return (
    <div className={`as-field ${error ? "has-error" : ""}`}>
      <label className="as-label" htmlFor={id}>
        {label}
        {optional ? <span className="as-optional"> (optional)</span> : null}
      </label>
      {React.cloneElement(child, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {hint && !error ? (
        <p className="as-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="as-error" id={`${id}-err`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Password input with a show / hide eye button inside the field.
export function PasswordInput({ show, onToggle, className = "", ...props }) {
  return (
    <div className="as-pw">
      <input
        {...props}
        className={`as-input ${className}`}
        type={show ? "text" : "password"}
      />
      <button
        type="button"
        className="as-eye"
        onClick={onToggle}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
      >
        {show ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.7M6.1 6.1C4 7.5 2.6 9.6 2 12c1 2.5 5 7 10 7 1.6 0 3.1-.4 4.4-1.1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <circle
              cx="12"
              cy="12"
              r="3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
