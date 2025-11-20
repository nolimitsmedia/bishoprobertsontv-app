// src/public/Signup.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api";
import "./Signup.css";

/* -------------------------------------------------------
   PayPal SDK env
------------------------------------------------------- */
const PAYPAL_CLIENT_ID =
  (typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_PAYPAL_CLIENT_ID) ||
  process.env.REACT_APP_PAYPAL_CLIENT_ID ||
  "";

/* -------------------------------------------------------
   Utilities
------------------------------------------------------- */
function loadPayPalSdk() {
  return new Promise((resolve, reject) => {
    if (window.paypal) return resolve(window.paypal);
    if (!PAYPAL_CLIENT_ID) {
      return reject(
        new Error(
          "Missing PayPal Client ID env (VITE_PAYPAL_CLIENT_ID / REACT_APP_PAYPAL_CLIENT_ID)."
        )
      );
    }
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      PAYPAL_CLIENT_ID
    )}&vault=true&intent=subscription`;
    s.async = true;
    s.onload = () => resolve(window.paypal);
    s.onerror = () => reject(new Error("Failed to load PayPal SDK"));
    document.body.appendChild(s);
  });
}

// Accept old param names too: growth→starter, essentials→pro
function planFromCard(card) {
  const s = String(card || "").toLowerCase();
  if (s === "pro") return "pro";
  if (s === "custom" || s === "enterprise") return "custom";
  return "starter";
}

/* -------------------------------------------------------
   Component
------------------------------------------------------- */
export default function Signup() {
  const [params] = useSearchParams();
  const planCode = planFromCard(params.get("plan_card") || "starter"); // starter | pro | custom

  // form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pw, setPw] = useState("");
  const [agree, setAgree] = useState(false);

  // ui
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [readyToPay, setReadyToPay] = useState(false);

  const paypalRef = useRef(null);

  const planLabel = useMemo(() => {
    if (planCode === "pro") return "Pro Plan";
    if (planCode === "custom") return "Enterprise Plan";
    return "Starter Plan";
  }, [planCode]);

  const heading = `Subscribe to BishopTV ${planLabel}`;

  /* --------------------------------------------- */
  useEffect(() => {
    if (!readyToPay) return;
    let destroyed = false;

    (async () => {
      try {
        const paypal = await loadPayPalSdk();
        if (destroyed || !paypalRef.current) return;

        // Ask backend to create/fetch the correct PayPal plan for this planCode
        let planId = null;
        try {
          const r = await api.post("/paypal/plan-id", { plan_code: planCode });
          planId = r?.data?.plan_id || null;
        } catch (e) {
          throw new Error(
            e?.response?.data?.message ||
              "Could not resolve a PayPal plan for this subscription."
          );
        }
        if (!planId) throw new Error("Missing PayPal plan_id.");

        // Clear previous render
        paypalRef.current.innerHTML = "";

        paypal
          .Buttons({
            style: {
              layout: "vertical",
              color: "blue",
              shape: "rect",
              label: "subscribe",
            },
            createSubscription: (_data, actions) =>
              actions.subscription.create({ plan_id: planId }),
            onApprove: async (data) => {
              try {
                const subscriptionID = data.subscriptionID;
                if (!subscriptionID)
                  throw new Error("Missing PayPal subscription ID");

                const res = await api.post("/paypal/subscribe/success", {
                  subscription_id: subscriptionID,
                  plan_code: planCode,
                  signup: {
                    name: fullName,
                    email,
                    phone,
                    password: pw,
                  },
                });

                const token = res?.data?.token;
                if (token) {
                  try {
                    localStorage.setItem("token", token);
                  } catch {}
                }

                window.location.href = "/account?sub=active";
              } catch (e) {
                console.error(e);
                setErr(
                  e?.response?.data?.message ||
                    e.message ||
                    "Could not finalize subscription."
                );
              }
            },
            onError: (e) => {
              console.error("PayPal error", e);
              setErr(e?.message || "PayPal failed. Please try again.");
            },
          })
          .render(paypalRef.current);
      } catch (e) {
        console.error(e);
        setErr(e.message || "Could not load PayPal.");
      }
    })();

    return () => {
      destroyed = true;
    };
  }, [readyToPay, planCode, fullName, email, phone, pw]);

  /* --------------------------------------------- */
  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!agree) {
      setErr("Please agree to the Terms & Privacy Policy.");
      return;
    }

    try {
      setBusy(true);
      setReadyToPay(true);
      setTimeout(() => {
        document
          .getElementById("paypal-container")
          ?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (e) {
      setErr(
        e?.response?.data?.message || e.message || "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  }

  /* --------------------------------------------- */
  return (
    <div className="signup-page">
      <div className="signup-col left">
        <h1>{heading}</h1>

        <form className="signup-form" onSubmit={onSubmit}>
          {/* ROWS (no grid) */}
          <div className="field">
            <label>First and last name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="First and last name"
              required
            />
          </div>

          <div className="field">
            <label>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label>Phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              required
              autoComplete="tel"
            />
          </div>

          <div className="field">
            <label>Set password</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Your password"
              required
              autoComplete="new-password"
            />
          </div>

          {/* ✅ Checkbox row aligned with the inputs */}
          <div className="field agree-row">
            <input
              id="agree"
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            <label htmlFor="agree" className="agree-label">
              Yes, I agree to the{" "}
              <a href="/terms" target="_blank" rel="noreferrer">
                Terms &amp; Conditions
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" rel="noreferrer">
                Privacy Policy
              </a>
              .
            </label>
          </div>

          {err ? <div className="form-error">{err}</div> : null}

          <button className="primarycta" disabled={busy}>
            {busy ? "Preparing checkout…" : "Continue to PayPal"}
          </button>

          <div className="login-hint">
            Have an account? <a href="/login">Login</a>
          </div>

          <div id="paypal-container" style={{ marginTop: 18 }}>
            {readyToPay ? <div ref={paypalRef} /> : null}
          </div>
        </form>
      </div>

      <div className="signup-col right">
        <div className="pitch">
          <h2>Join creators growing with Bishop</h2>
        </div>
        <div className="poster-grid">
          <div className="poster a" />
          <div className="poster b" />
          <div className="poster c" />
        </div>
      </div>
    </div>
  );
}
