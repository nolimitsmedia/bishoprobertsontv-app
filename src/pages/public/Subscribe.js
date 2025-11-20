// src/pages/public/Subscribe.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";

/* utils */
const fmtMoney = (cents) =>
  (Number(cents || 0) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

/* small UI bits */
function Toggle({ value, onChange, options = ["month", "year"] }) {
  return (
    <div
      role="tablist"
      aria-label="Billing interval"
      style={{
        display: "inline-flex",
        padding: 4,
        borderRadius: 999,
        background: "#f3f4f6",
        border: "1px solid #e5e7eb",
      }}
    >
      {options.map((opt) => {
        const on = value === opt;
        return (
          <button
            key={opt}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(opt)}
            className="btn small"
            style={{
              border: "none",
              background: on ? "#fff" : "transparent",
              boxShadow: on ? "0 1px 2px rgba(0,0,0,.06)" : "none",
              borderRadius: 999,
              padding: "6px 12px",
              fontWeight: 700,
              color: on ? "#111827" : "#6b7280",
              cursor: "pointer",
            }}
          >
            {opt === "month" ? "Monthly" : "Yearly"}
          </button>
        );
      })}
    </div>
  );
}

function Feature({ ok, children }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        margin: "6px 0",
        color: ok ? "#111827" : "#6b7280",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          display: "grid",
          placeItems: "center",
          background: ok ? "#ecfdf5" : "#f3f4f6",
          border: `1px solid ${ok ? "#10b981" : "#e5e7eb"}`,
          fontSize: 12,
        }}
      >
        {ok ? "✓" : "–"}
      </span>
      <span>{children}</span>
    </li>
  );
}

/* save calc (annual vs monthly of same tier) */
function buildAnnualSavingsMap(plans) {
  const byTier = new Map();
  for (const p of plans) {
    const tier = (p.tier || p.title || "").toLowerCase().trim();
    if (!byTier.has(tier)) byTier.set(tier, {});
    if (p.interval === "month") byTier.get(tier).m = p;
    if (p.interval === "year") byTier.get(tier).y = p;
  }
  const out = new Map();
  for (const [tier, pair] of byTier.entries()) {
    if (pair.m && pair.y) {
      const mTotal = (pair.m.price_cents || 0) * 12;
      const y = pair.y.price_cents || 0;
      if (y > 0 && mTotal > 0 && y < mTotal) {
        const pct = Math.round(((mTotal - y) / mTotal) * 100);
        out.set(pair.y.id || pair.y._id, { pct, saved: mTotal - y });
      }
    }
  }
  return out;
}

export default function Subscribe() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [billing, setBilling] = useState("month"); // "month" | "year"

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const [plansRes, meRes] = await Promise.all([
        api.get("/subscription/plans", { params: { limit: 100 } }),
        api.get("/subscription/customer").catch(async (e) => {
          if (e?.response?.status === 404) {
            const legacy = await api.get("/subscription");
            return { data: { legacy_plan: legacy.data?.plan || "free" } };
          }
          throw e;
        }),
      ]);

      const items = Array.isArray(plansRes.data?.items)
        ? plansRes.data.items
        : plansRes.data || [];

      // Filter out archived on public page
      const visible = items.filter((p) => p.status !== "archived");

      setPlans(visible);
      setCustomer(meRes.data || null);

      // Set default billing tab based on majority
      const monthlyCount = visible.filter((p) => p.interval === "month").length;
      const yearlyCount = visible.filter((p) => p.interval === "year").length;
      setBilling(yearlyCount > monthlyCount ? "year" : "month");
    } catch (e) {
      console.error("load subscribe page error:", e);
      setErr(e?.response?.data?.message || "Failed to load plans.");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const hasMonthly = useMemo(
    () => plans.some((p) => p.interval === "month"),
    [plans]
  );
  const hasYearly = useMemo(
    () => plans.some((p) => p.interval === "year"),
    [plans]
  );

  const filtered = useMemo(
    () =>
      plans
        .filter((p) => p.interval === billing)
        .sort((a, b) => (a.price_cents || 0) - (b.price_cents || 0)),
    [plans, billing]
  );

  const savingsMap = useMemo(() => buildAnnualSavingsMap(plans), [plans]);

  const currentPlanId =
    customer?.plan_id || customer?.plan?.id || customer?.planId || null;
  const legacyPlan = customer?.legacy_plan; // "free" | "monthly" | "yearly"

  // Choose "Most popular": prefer explicit flag, else middle card
  const popularId = useMemo(() => {
    const byFlag = filtered.find((p) => p.popular);
    if (byFlag) return byFlag.id || byFlag._id;
    if (filtered.length >= 2)
      return (
        filtered[Math.floor(filtered.length / 2)].id ||
        filtered[Math.floor(filtered.length / 2)]._id
      );
    return filtered[0]?.id || filtered[0]?._id || null;
  }, [filtered]);

  async function handleSubscribe(planId, title) {
    setBusy(true);
    setErr("");
    try {
      await api.post("/subscription/subscribe", { plan_id: planId });
      navigate("/subscribe/thanks", { state: { title } });
    } catch (e) {
      // legacy fallback by interval mapping
      if (e?.response?.status === 404) {
        const p = plans.find((x) => (x.id || x._id) === planId);
        if (p?.interval) {
          await api.post("/subscription", {
            plan: p.interval === "year" ? "yearly" : "monthly",
          });
          navigate("/subscribe/thanks", { state: { title } });
          setBusy(false);
          return;
        }
      }
      console.error("subscribe error:", e);
      setErr(e?.response?.data?.message || "Subscription failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    setErr("");
    try {
      await api.delete("/subscription/cancel").catch(async (e) => {
        if (e?.response?.status === 404) {
          await api.delete("/subscription");
          return;
        }
        throw e;
      });
      await load();
    } catch (e) {
      console.error("cancel error:", e);
      setErr(e?.response?.data?.message || "Failed to cancel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontWeight: 900 }}>Choose your plan</h1>
        <p style={{ color: "#6b7280", marginTop: 8 }}>
          Transparent pricing. Cancel anytime.
        </p>
        <div style={{ marginTop: 12 }}>
          <Toggle
            value={billing}
            onChange={(v) => setBilling(v)}
            options={[
              ...(hasMonthly ? ["month"] : []),
              ...(hasYearly ? ["year"] : []),
            ]}
          />
        </div>
      </div>

      {err && (
        <div
          className="card"
          style={{ borderLeft: "4px solid #ef4444", marginBottom: 16 }}
        >
          <strong>Error:</strong> {err}
        </div>
      )}

      {loading ? (
        <div className="card">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          No {billing === "year" ? "yearly" : "monthly"} plans available.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 18,
          }}
        >
          {filtered.map((p) => {
            const id = p.id || p._id;
            const isActive = currentPlanId
              ? String(currentPlanId) === String(id)
              : legacyPlan
              ? (legacyPlan === "yearly" && p.interval === "year") ||
                (legacyPlan === "monthly" && p.interval === "month")
              : false;

            const isPopular = popularId && String(popularId) === String(id);
            const features = p.features || {};
            const tierLabel =
              (p.tier || "Starter").charAt(0).toUpperCase() +
              (p.tier || "Starter").slice(1);

            const annualSaving = savingsMap.get(id); // { pct, saved } if this is a yearly plan

            return (
              <div
                key={id}
                className="card"
                style={{
                  position: "relative",
                  display: "grid",
                  gap: 12,
                  padding: 20,
                  border: isPopular
                    ? "2px solid #2563eb"
                    : "1px solid var(--line)",
                  boxShadow: isPopular
                    ? "0 12px 24px rgba(37,99,235,.15)"
                    : "0 6px 16px rgba(0,0,0,.06)",
                  transform: isPopular ? "translateY(-2px)" : "none",
                }}
              >
                {/* Ribbon */}
                {isPopular && (
                  <div
                    style={{
                      position: "absolute",
                      top: -10,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "#2563eb",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 800,
                      padding: "4px 10px",
                      borderRadius: 999,
                      boxShadow: "0 6px 12px rgba(37,99,235,.25)",
                    }}
                  >
                    MOST POPULAR
                  </div>
                )}

                {/* Title + Tier */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{p.title}</div>
                  <span
                    style={{
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "#f3f4f6",
                      color: "#374151",
                    }}
                  >
                    {tierLabel}
                  </span>
                </div>

                {/* Description */}
                <div style={{ color: "#6b7280", minHeight: 36 }}>
                  {p.description || "—"}
                </div>

                {/* Price */}
                <div
                  style={{ display: "flex", alignItems: "baseline", gap: 6 }}
                >
                  <div style={{ fontSize: 32, fontWeight: 900 }}>
                    {fmtMoney(p.price_cents)}
                  </div>
                  <div style={{ color: "#6b7280" }}>
                    / {p.interval === "year" ? "year" : "month"}
                  </div>
                </div>

                {/* Savings hint for yearly */}
                {p.interval === "year" && annualSaving?.pct > 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#059669",
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      padding: "6px 10px",
                      borderRadius: 8,
                    }}
                  >
                    Save {annualSaving.pct}% compared to paying monthly
                  </div>
                )}

                {/* Features */}
                <ul
                  style={{
                    margin: "4px 0 0",
                    paddingLeft: 0,
                    listStyle: "none",
                  }}
                >
                  <Feature ok={!!features.mobile_tv_apps}>
                    Mobile & TV apps
                  </Feature>
                  <Feature ok={!!features.custom_option}>
                    Custom implementation
                  </Feature>
                  {p.in_trial_days ? (
                    <Feature ok>Free trial: {p.in_trial_days} day(s)</Feature>
                  ) : null}
                </ul>

                {/* CTA */}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {isActive ? (
                    <>
                      <button
                        className="btn"
                        disabled
                        style={{
                          background: "#10b981",
                          borderColor: "#10b981",
                          cursor: "default",
                        }}
                      >
                        Current plan
                      </button>
                      <button
                        className="btn ghost"
                        onClick={handleCancel}
                        disabled={busy}
                        title="Cancel subscription"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn"
                      onClick={() => handleSubscribe(id, p.title)}
                      disabled={busy}
                      style={{
                        background: isPopular ? "#2563eb" : undefined,
                        borderColor: isPopular ? "#2563eb" : undefined,
                      }}
                    >
                      {busy ? "Processing…" : "Choose plan"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
