// src/public/Pricing.js
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import "./Pricing.css";

/* -------------------------------------------------------
   Helpers
------------------------------------------------------- */

function toDollars(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (!cleaned) return null;
    const num = Number(cleaned);
    if (!isFinite(num)) return null;
    if (Number.isInteger(num) && num >= 1000) return Math.round(num / 100);
    return Math.round(num);
  }
  if (typeof value === "number") {
    if (Number.isInteger(value) && value >= 1000)
      return Math.round(value / 100);
    return Math.round(value);
  }
  return null;
}

function slugize(name = "") {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Map any DB plan title/code to the 3 canonical buckets
function mapBucket(titleOrCode = "") {
  const s = slugize(titleOrCode);
  if (/starter/.test(s)) return "starter";
  if (/pro/.test(s)) return "pro";
  if (/custom|enterprise/.test(s)) return "custom";
  return null;
}

// Robust JSON array reader (for features_* columns)
function parseArrayMaybe(v, fallback = []) {
  if (!v) return fallback;
  if (Array.isArray(v)) return v;
  try {
    const arr = JSON.parse(v);
    return Array.isArray(arr) ? arr : fallback;
  } catch {
    return fallback;
  }
}

/* -------------------------------------------------------
   Default text/branding fallbacks
------------------------------------------------------- */

const BRAND = {
  starter: {
    color: "#f5a524",
    icon: "✨",
    blurb: "Start earning recurring revenue with seamless video streaming.",
  },
  pro: {
    color: "#1677ff",
    icon: "✚",
    blurb:
      "Build your brand & boost retention with mobile apps. Optimize with Add-Ons.",
  },
  custom: {
    color: "#6d6dff",
    icon: "✺",
    blurb:
      "Get the most from Bishop with a custom plan tailored to your needs.",
  },
};

const FALLBACK_FEATURES = {
  starter: {
    core: [
      "Unlimited bandwidth",
      "100 hours of video storage",
      "1 free hour of live streaming",
      "Chat + e-mail support",
    ],
    access: [
      "Netflix-style catalog",
      "Monetize your way",
      "Analytics on steroids",
      "Marketing tools & automations",
      "Build your own website",
      "Gated Zoom links",
    ],
  },
  pro: {
    core: [
      "Unlimited bandwidth",
      "100 hours of video storage",
      "1 free hour of live streaming",
      "Chat + e-mail support",
      "Onboarding support",
      "Migration support (users, payments, content)",
    ],
    access: [
      "Everything in Starter, plus",
      "2 Mobile Apps",
      "Video storage packs (100 hours per pack)",
      "Live streaming packs (10 hours per pack)",
      "Advanced analytics",
    ],
  },
  custom: {
    core: [
      "Unlimited bandwidth",
      "Custom amount of video storage",
      "Custom amount of live streaming hours",
      "Dedicated success manager",
      "Migration support (users, payments, content)",
      "White labeling",
      "VIP support with SLA",
    ],
    access: [
      "2 Mobile Apps",
      "5 TV apps",
      "API access",
      "Advanced analytics",
      "Sell B2B with Group Subscriptions",
    ],
  },
};

const PER_SUB_FEE = 0.99;

/* -------------------------------------------------------
   Price UI
------------------------------------------------------- */

function Price({ planId, cycle, pricing, loading }) {
  if (loading) {
    return (
      <div className="price">
        <div className="skeleton-line big" />
        <div className="skeleton-line small" />
      </div>
    );
  }
  const value = pricing?.[cycle]?.[planId];
  if (value == null) {
    return (
      <div className="price">
        <div className="price-main">{"Let's talk"}</div>
        <div className="price-sub">
          + ${PER_SUB_FEE.toFixed(2)} per subscriber fee
        </div>
      </div>
    );
  }
  return (
    <div className="price">
      <div className="price-main">
        ${value}
        <span className="per">/month</span>
      </div>
      <div className="price-sub">
        + ${PER_SUB_FEE.toFixed(2)} per subscriber fee
      </div>
    </div>
  );
}

function Check({ muted }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`check ${muted ? "muted" : ""}`}
    >
      <path
        d="M20 6L9 17l-5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------
   Component
------------------------------------------------------- */

export default function Pricing() {
  // We’re removing the billing cycle toggle; default to monthly internally.
  const cycle = "monthly";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Cards to render (title, blurb, features, CTA, branding)
  const [cards, setCards] = useState([]);

  // { monthly: {starter, pro, custom}, yearly: { … } }
  const [pricing, setPricing] = useState({
    monthly: { starter: null, pro: null, custom: null },
    yearly: { starter: null, pro: null, custom: null },
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        // Prefer /subscription/plans, but try a few alternatives too
        const candidates = [
          "/subscription/plans",
          "/subscriptions/plans",
          "/plans",
          "/plans/public",
        ];

        let data = null;
        for (const url of candidates) {
          try {
            const r = await api.get(url);
            data = r?.data;
            if (data) break;
          } catch {}
        }

        const list =
          (data?.plans && Array.isArray(data.plans) && data.plans) ||
          (data?.items && Array.isArray(data.items) && data.items) ||
          (Array.isArray(data) ? data : []);

        const nextPricing = {
          monthly: { starter: null, pro: null, custom: null },
          yearly: { starter: null, pro: null, custom: null },
        };
        const nextCardsMap = new Map();

        for (const row of list) {
          const title = row.title || row.name || "";
          const code = row.code || row.slug || title;
          const bucket = mapBucket(code) || mapBucket(title);
          if (!bucket) continue;

          const cents =
            row.price_cents ??
            row.price_cents_month ??
            row.monthly_price_cents ??
            row.price ??
            null;

          const interval = String(row.interval || "month").toLowerCase();

          const monthly = toDollars(
            interval === "year" ||
              interval === "annual" ||
              interval === "yearly"
              ? Number(cents || 0) / 12
              : cents
          );
          const yearly = monthly; // no annual toggle UI anymore

          nextPricing.monthly[bucket] = monthly;
          nextPricing.yearly[bucket] = yearly;

          const featuresCore = parseArrayMaybe(
            row.features_core,
            FALLBACK_FEATURES[bucket].core
          );
          const featuresAccess = parseArrayMaybe(
            row.features_access,
            FALLBACK_FEATURES[bucket].access
          );
          const blurb = (row.description || "").trim() || BRAND[bucket].blurb;

          const canSubscribeDirect = !!(
            row.allow_checkout ||
            row.paypal_plan_id ||
            row.stripe_plan_id ||
            row.price_cents
          );

          // Primary CTA per bucket
          let ctaText = "";
          let ctaHrefBuilder = () => "#";

          if (bucket === "starter") {
            ctaText = "Subscribe Now";
            ctaHrefBuilder = (c) => `/signup?plan_card=starter&cycle=${c}`;
          } else if (bucket === "pro") {
            if (canSubscribeDirect) {
              ctaText = "Subscribe Now";
              ctaHrefBuilder = (c) => `/signup?plan_card=pro&cycle=${c}`;
            } else {
              ctaText = "Subscribe Now";
              ctaHrefBuilder = (c) => `/signup?plan_card=pro&cycle=${c}`;
            }
          } else {
            // ENTERPRISE/CUSTOM -> Subscribe Now + same signup link
            ctaText = "Subscribe Now";
            ctaHrefBuilder = (c) => `/signup?plan_card=enterprise&cycle=${c}`;
          }

          const color = BRAND[bucket].color;
          const icon = BRAND[bucket].icon;

          nextCardsMap.set(bucket, {
            id: bucket,
            title: title || (bucket === "custom" ? "Enterprise Plan" : bucket),
            color,
            icon,
            blurb,
            featuresCore,
            featuresAccess,
            ctaText,
            ctaHrefBuilder,
          });
        }

        // Ensure all three cards exist even if DB is missing one
        ["starter", "pro", "custom"].forEach((b) => {
          if (!nextCardsMap.has(b)) {
            nextCardsMap.set(b, {
              id: b,
              title:
                b === "starter"
                  ? "Starter Plan"
                  : b === "pro"
                  ? "Pro Plan"
                  : "Enterprise Plan",
              color: BRAND[b].color,
              icon: BRAND[b].icon,
              blurb: BRAND[b].blurb,
              featuresCore: FALLBACK_FEATURES[b].core,
              featuresAccess: FALLBACK_FEATURES[b].access,
              ctaText: "Subscribe Now",
              ctaHrefBuilder: (c) => `/signup?plan_card=${b}&cycle=${c}`,
            });
          }
        });

        // Force Enterprise price to $500 if missing from API
        if (nextPricing.monthly.custom == null)
          nextPricing.monthly.custom = 500;
        if (nextPricing.yearly.custom == null) nextPricing.yearly.custom = 500;

        if (!alive) return;
        setPricing(nextPricing);
        setCards(["starter", "pro", "custom"].map((b) => nextCardsMap.get(b)));
        setLoading(false);
      } catch (e) {
        if (!alive) return;
        console.error("Pricing load failed:", e);
        setErr("We couldn’t load live pricing. Showing placeholders.");
        setCards(
          ["starter", "pro", "custom"].map((b) => ({
            id: b,
            title:
              b === "starter"
                ? "Starter Plan"
                : b === "pro"
                ? "Pro Plan"
                : "Enterprise Plan",
            color: BRAND[b].color,
            icon: BRAND[b].icon,
            blurb: BRAND[b].blurb,
            featuresCore: FALLBACK_FEATURES[b].core,
            featuresAccess: FALLBACK_FEATURES[b].access,
            ctaText: "Subscribe Now",
            ctaHrefBuilder: (c) => `/signup?plan_card=${b}&cycle=${c}`,
          }))
        );
        // Also set placeholder pricing with Enterprise at $500
        setPricing({
          monthly: { starter: null, pro: null, custom: 500 },
          yearly: { starter: null, pro: null, custom: 500 },
        });
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const displayedCards = useMemo(() => cards, [cards]);

  return (
    <div className="pricing-page">
      <section className="pricing-hero">
        <h1>
          A plan for every stage
          <br />
          of your business
        </h1>

        {/* Billing cycle toggle removed per request */}
        {err ? (
          <div
            style={{
              marginTop: 10,
              color: "#9a3412",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              padding: "8px 10px",
              borderRadius: 10,
              display: "inline-block",
            }}
          >
            {err}
          </div>
        ) : null}
      </section>

      <section className="pricing-grid">
        {displayedCards.map((p) => {
          const href = p.ctaHrefBuilder ? p.ctaHrefBuilder(cycle) : "#";
          const ctaStyle = {
            background: p.color,
            borderColor: p.color,
            color: "#fff",
          };

          return (
            <article key={p.id} className="card plan">
              <div className="plan-top">
                <div
                  className="plan-icon"
                  style={{ background: p.color + "33", color: p.color }}
                >
                  {p.icon}
                </div>
                <h3 className="plan-title">{p.title}</h3>
                <p className="plan-blurb">{p.blurb}</p>
              </div>

              <div className="plan-price" style={{ borderTopColor: p.color }}>
                <Price
                  planId={p.id}
                  cycle={cycle}
                  pricing={pricing}
                  loading={loading}
                />
              </div>

              <div className="plan-features">
                <div className="group-title">Core</div>
                <ul>
                  {p.featuresCore.map((f, i) => (
                    <li key={i}>
                      <Check />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="divider" />

                <div className="group-title">Access to Bishop Platform</div>
                <ul>
                  {p.featuresAccess.map((f, i) => (
                    <li key={i}>
                      <Check muted={i === 0 && p.id !== "pro"} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="plan-cta">
                <a
                  href={href}
                  className="btn"
                  style={ctaStyle}
                  aria-label={`${p.title} - ${p.ctaText}`}
                >
                  {p.ctaText}
                </a>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
