// src/public/RequestDemo.js
import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api"; // keep consistent with your project import path
import "./RequestDemo.css";

const PRODUCTS = [
  "Video Membership + Community",
  "Mobile & TV Apps",
  "Live Streaming",
  "Video Catalog",
  "Monetization & Paywalls",
  "Other / Not sure yet",
];

const INDUSTRIES = [
  "Fitness & Sports",
  "Education",
  "Entertainment",
  "Lifestyle",
  "Faith & Spirituality",
  "Corporate / Internal",
  "Other",
];

export default function RequestDemo() {
  const [params] = useSearchParams();
  const planCard = (params.get("plan_card") || "essentials").toLowerCase();

  // form state
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [product, setProduct] = useState(PRODUCTS[0]);
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const heading = useMemo(() => {
    if (planCard === "custom") return "Okay! Let’s book your custom plan demo.";
    if (planCard === "growth") return "Okay! Let’s book your Growth demo.";
    return "Okay! Let’s book your demo.";
  }, [planCard]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!first || !last || !email) {
      setErr("Please fill first name, last name, and a valid email.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/demo", {
        plan_card: planCard,
        first_name: first,
        last_name: last,
        email,
        company,
        phone,
        heard_about: source,
        primary_product: product,
        industry,
        notes,
      });
      setDone(true);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "Submission failed.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="demo-wrap">
        <div className="demo-content">
          <h1>Thanks! 🎉</h1>
          <p>
            We’ve received your demo request for the{" "}
            <strong>
              {planCard === "custom"
                ? "Custom-made"
                : planCard === "growth"
                ? "Growth"
                : "App Essentials"}
            </strong>{" "}
            plan. Our team will reach out shortly.
          </p>
          <a className="btn primary" href="/pricing">
            Back to Pricing
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="demo-wrap">
      <div className="demo-left">
        <h1>{heading}</h1>

        <div className="bullets">
          <div>
            ✅ Visualize what your membership would look like with Bishop.
          </div>
          <div>✅ Walkthrough features including Apps, Live, & Community.</div>
          <div>✅ Discover your earning potential with our platform.</div>
          <div>✅ Learn why Bishop is perfect for your audience.</div>
        </div>

        <div className="quote card">
          <div className="qmark">“</div>
          <div>
            Bishop helped me grow my community beyond imagination, without
            compromising on the quality. Everyone loves the new apps!
          </div>
          <div className="person">
            Adriene Mishler • Founder of Yoga with Adriene
          </div>
        </div>
      </div>

      <div className="demo-right card">
        <form onSubmit={submit} className="demo-form">
          <div className="row two">
            <div className="field">
              <label>First Name*</label>
              <input
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Last Name*</label>
              <input
                value={last}
                onChange={(e) => setLast(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label>Business Email*</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>Company name</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Phone Number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8910"
            />
          </div>

          <div className="row two">
            <div className="field">
              <label>How did you hear about us?</label>
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Primary product you want to build*</label>
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              >
                {PRODUCTS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Which best describes your industry?*</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            >
              {INDUSTRIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Anything else we should know?</label>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {err ? <div className="form-error">{err}</div> : null}

          <button className="btn primary" disabled={busy}>
            {busy ? "Sending…" : "Request 1-on-1 Demo"}
          </button>
        </form>
      </div>
    </div>
  );
}
