// src/pages/account/AccountHome.js
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";

/* ────────────────────────────── tiny utils ────────────────────────────── */
function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
function toNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
function clampPct(v) {
  if (v == null || !isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}
function addMonths(dateLike, months) {
  const d = new Date(dateLike);
  const nd = new Date(d);
  nd.setMonth(nd.getMonth() + months);
  return nd.toISOString();
}
function addYears(dateLike, years) {
  const d = new Date(dateLike);
  const nd = new Date(d);
  nd.setFullYear(nd.getFullYear() + years);
  return nd.toISOString();
}
function firstOfNextMonth(dateLike) {
  const d = dateLike ? new Date(dateLike) : new Date();
  const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return nd.toISOString();
}

/* Hours → “X hrs Y mins” (minute-accurate, rounded to nearest minute) */
function toHM(hoursFloat) {
  let h = Number(hoursFloat || 0);
  if (!Number.isFinite(h) || h < 0) h = 0;
  const totalMin = Math.max(0, Math.round(h * 60));
  const hr = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  const hrLabel = `${hr} hr${hr === 1 ? "" : "s"}`;
  const minLabel = `${min} min${min === 1 ? "" : "s"}`;
  return {
    hr,
    min,
    totalMin,
    label: `${hrLabel} ${minLabel}`,
    hrLabel,
    minLabel,
  };
}

/* ─────────────────────────── usage normalizers ────────────────────────── */
function resolveMetric(usage, key) {
  const metric =
    usage?.metrics?.[key] ?? usage?.totals?.[key] ?? usage?.[key] ?? {};
  const limit = metric.limit ?? usage?.limits?.[key] ?? null;
  const used = toNum(metric.used ?? metric.value ?? metric.total ?? 0, 0);
  return {
    used,
    limit: limit != null ? toNum(limit, null) : null,
    resets:
      metric.resets ?? usage?.resets?.[key] ?? usage?.period?.resetAt ?? null,
    periodStart: metric.periodStart ?? usage?.period?.start ?? null,
    periodEnd: metric.periodEnd ?? usage?.period?.end ?? null,
  };
}

function resolveStorage(usage, me) {
  const candidates = [
    "storage_hours_total",
    "video_storage_hours",
    "storage_seconds_total",
    "storage_gb",
  ];
  let raw = null;
  let keyUsed = null;
  for (const k of candidates) {
    const m = usage?.metrics?.[k] ?? usage?.totals?.[k] ?? usage?.[k];
    if (m) {
      raw = m;
      keyUsed = k;
      break;
    }
  }
  const count =
    toNum(usage?.counts?.videos, null) ??
    toNum(usage?.video_count, null) ??
    toNum(me?.video_count, null);

  if (!keyUsed || !raw) {
    return { used: 0, limit: null, unit: "h", haveMetric: false, count };
  }
  const limit = raw.limit ?? usage?.limits?.[keyUsed] ?? null;

  if (keyUsed.includes("seconds")) {
    return {
      used: (Number(raw.used ?? raw.value ?? 0) || 0) / 3600,
      limit: limit != null ? Number(limit) / 3600 : null,
      unit: "h",
      haveMetric: true,
      count,
    };
  } else if (keyUsed.includes("gb")) {
    return {
      used: Number(raw.used ?? raw.value ?? 0) || 0,
      limit: limit != null ? Number(limit) : null,
      unit: "GB",
      haveMetric: true,
      count,
    };
  }
  return {
    used: Number(raw.used ?? raw.value ?? 0) || 0,
    limit: limit != null ? Number(limit) : null,
    unit: "h",
    haveMetric: true,
    count,
  };
}

/* ───────────────────────── usage coloring helpers ─────────────────────── */
function usageColor(pct) {
  if (pct == null) return "#94a3b8";
  if (pct < 70) return "#10b981";
  if (pct < 90) return "#f59e0b";
  return "#ef4444";
}
function trackTint(pct) {
  if (pct == null) return "#e2e8f0";
  if (pct < 70) return "#d1fae5";
  if (pct < 90) return "#fef3c7";
  return "#fee2e2";
}

/* ────────────────────────── plan limits & labels ────────────────────────
   Canonical tiers only: free, starter, pro, custom
------------------------------------------------------------------------- */
const LIMITS_BY_CODE = {
  free: { liveHoursMonthly: 1, storageHours: 5, label: "Free" },
  starter: { liveHoursMonthly: 100, storageHours: 100, label: "Starter" },
  pro: { liveHoursMonthly: 200, storageHours: 200, label: "Pro" },
  custom: { liveHoursMonthly: null, storageHours: null, label: "Custom" },
};

// Determine our canonical code from whatever the server gives us
function detectPlanCode({ plan_code, plan, plan_title }) {
  const s = (plan_code || plan || plan_title || "").toString().toLowerCase();
  if (s.includes("free")) return "free";
  if (s.includes("starter")) return "starter";
  if (s.includes("pro")) return "pro";
  if (s.includes("custom")) return "custom";
  return null;
}

/* ====================================================================== */
export default function AccountHome() {
  const [me, setMe] = useState(null);
  const [sub, setSub] = useState(null); // from /subscription/me
  const [usage, setUsage] = useState(null); // from /usage/me
  const [plans, setPlans] = useState([]); // from /subscription/plans
  const [loading, setLoading] = useState(true);

  // id -> plan row
  const planById = useMemo(() => {
    const m = new Map();
    for (const p of plans) m.set(Number(p.id), p);
    return m;
  }, [plans]);

  // canonical slug -> plan row
  const planBySlug = useMemo(() => {
    const m = new Map();
    for (const p of plans) {
      const t = String(p.title || p.code || "")
        .toLowerCase()
        .trim();
      if (t.includes("free")) m.set("free", p);
      if (t.includes("starter")) m.set("starter", p);
      if (t.includes("pro")) m.set("pro", p);
      if (t.includes("custom")) m.set("custom", p);
    }
    return m;
  }, [plans]);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        setLoading(true);
        const [meRes, subRes, usageRes, plansRes] = await Promise.allSettled([
          api.get("/auth/me"),
          api.get("/subscription/me"),
          api.get("/usage/me"),
          api.get("/subscription/plans?limit=100"),
        ]);
        if (!ok) return;
        if (meRes.status === "fulfilled") setMe(meRes.value.data || null);
        if (subRes.status === "fulfilled") setSub(subRes.value.data || null);
        if (usageRes.status === "fulfilled")
          setUsage(usageRes.value.data || null);
        if (plansRes.status === "fulfilled") {
          const items =
            plansRes.value.data?.items ??
            plansRes.value.data?.plans ??
            plansRes.value.data ??
            [];
          setPlans(items);
        }
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => {
      ok = false;
    };
  }, []);

  /* ─────────────────────── derive plan for display ─────────────────────── */
  const planFromId = sub?.plan_id ? planById.get(Number(sub.plan_id)) : null;

  // Prefer the server's canonical code if present.
  // Fallback: if sub has no status (free-tier), treat as 'free'.
  const planCode =
    detectPlanCode({
      plan_code: sub?.plan_code,
      plan: sub?.plan,
      plan_title: sub?.plan_title || planFromId?.title,
    }) || (!sub?.status || sub?.status === "none" ? "free" : null);

  const planFromCode = planCode ? planBySlug.get(planCode) : null;

  // Preferred title resolution
  const planTitle =
    sub?.plan_title ||
    planFromId?.title ||
    (planCode ? LIMITS_BY_CODE[planCode]?.label : null) ||
    planFromCode?.title ||
    null;

  const planName =
    !sub?.status || sub?.status === "none" ? "Free" : planTitle || "—";

  /* ─────────────── next billing: server -> fallback compute ────────────── */
  const startedAt =
    sub?.started_at || sub?.current_period_start || sub?.created_at || null;

  let nextPeriodEnd = sub?.current_period_end || sub?.renews_at || null;

  const interval =
    sub?.interval ||
    planFromId?.interval ||
    planFromCode?.interval ||
    (planCode ? "month" : null);

  if (!nextPeriodEnd && startedAt && interval) {
    nextPeriodEnd =
      interval === "year" ? addYears(startedAt, 1) : addMonths(startedAt, 1);
  }
  const nextBill = nextPeriodEnd ? fmtDate(nextPeriodEnd) : "—";

  /* ────────────────────────── usage + limits ───────────────────────────── */
  const live = resolveMetric(usage, "live_hours_monthly");
  let liveLimit = live.limit;

  const storage = resolveStorage(usage, me);
  let storageLimit = storage.limit;
  const storageUsed = storage.used;
  const storageUnit = storage.unit; // "h" or "GB"

  // plan-based defaults when API has no limits or returns 0
  if ((liveLimit == null || liveLimit === 0) && planCode) {
    const def = LIMITS_BY_CODE[planCode];
    if (def && def.liveHoursMonthly != null) liveLimit = def.liveHoursMonthly;
  }
  if ((storageLimit == null || storageLimit === 0) && planCode) {
    const def = LIMITS_BY_CODE[planCode];
    if (def && storageUnit === "h" && def.storageHours != null) {
      storageLimit = def.storageHours;
    }
  }

  const liveResets = live.resets || firstOfNextMonth(startedAt || new Date());

  const livePct = liveLimit
    ? clampPct((toNum(live.used) / liveLimit) * 100)
    : 0;
  const liveFill = usageColor(livePct);
  const liveTrack = trackTint(livePct);

  const storagePctRaw =
    storageLimit && storageUnit === "h"
      ? clampPct((toNum(storageUsed) / storageLimit) * 100)
      : 0;
  const storagePctVis =
    storageLimit && storageUsed > 0
      ? Math.max(storagePctRaw, 1.5)
      : storagePctRaw;
  const storageFill = usageColor(storagePctRaw);
  const storageTrack = trackTint(storagePctRaw);

  // Minute-accurate labels
  const liveUsedHM = toHM(live.used);
  const liveLimitHM = toHM(liveLimit || 0);
  const liveRemainHM = toHM(Math.max(0, toNum(liveLimit) - toNum(live.used)));

  function fmtStorageHM(used, unit, limit) {
    if (unit === "GB") {
      const u = `${toNum(used).toFixed(2)}GB`;
      return limit != null ? `${u} / ${toNum(limit).toFixed(0)}GB` : u;
    }
    const usedHM = toHM(used);
    const limHM = toHM(limit || 0);
    return limit != null
      ? `${usedHM.label} / ${limHM.hr} hr${limHM.hr === 1 ? "" : "s"}`
      : usedHM.label;
  }

  /* ───────────────────────────────── UI ────────────────────────────────── */
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      {/* Header */}
      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          justifyContent: "space-between",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#0b1220",
              color: "white",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
            }}
            aria-hidden
          >
            {(me?.name || me?.email || "U").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>{me?.name || "—"}</div>
            <div style={{ color: "#64748b", fontSize: 14 }}>
              {me?.email || "—"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link className="btn" to="/pricing">
            Upgrade
          </Link>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          marginTop: 16,
        }}
      >
        {/* Plan card */}
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Plan</h3>
          {loading ? (
            <div className="vd-muted">Loading…</div>
          ) : (
            <>
              <div style={{ color: "#64748b", fontSize: 13 }}>Current plan</div>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>
                {planName}
              </div>

              <div style={{ color: "#64748b", fontSize: 13 }}>Status</div>
              <div style={{ marginBottom: 12 }}>
                {sub?.status ? String(sub.status) : "no active subscription"}
              </div>

              <div style={{ color: "#64748b", fontSize: 13 }}>Next billing</div>
              <div>{nextBill}</div>
            </>
          )}
        </div>

        {/* Usage card */}
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Usage</h3>

          {/* Live streaming hours */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: "#64748b",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>Live streaming</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {liveLimit != null && (
                  <span
                    title="Remaining this period"
                    style={{
                      fontSize: 11,
                      background: liveTrack,
                      color: "#0f172a",
                      border: `1px solid ${liveFill}`,
                      padding: "2px 6px",
                      borderRadius: 999,
                    }}
                  >
                    {liveRemainHM.label} left
                  </span>
                )}
                <span>
                  {liveUsedHM.label}
                  {liveLimit != null
                    ? ` / ${liveLimitHM.hr} hr${
                        liveLimitHM.hr === 1 ? "" : "s"
                      }`
                    : ""}
                </span>
              </div>
            </div>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: liveTrack,
                overflow: "hidden",
                marginTop: 6,
                border: "1px solid rgba(0,0,0,0.06)",
              }}
              aria-hidden
            >
              <div
                style={{
                  width: `${livePct}%`,
                  height: "100%",
                  background: liveFill,
                  transition: "width 200ms ease",
                }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={livePct}
              />
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              Resets monthly {liveResets ? `· ${fmtDate(liveResets)}` : ""}
            </div>
          </div>

          {/* Video storage */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: "#64748b",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>Video storage</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>
                  {fmtStorageHM(storageUsed, storageUnit, storageLimit)}
                </span>
              </div>
            </div>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: storageTrack,
                overflow: "hidden",
                marginTop: 6,
                border: "1px solid rgba(0,0,0,0.06)",
              }}
              aria-hidden
            >
              <div
                style={{
                  width: `${storagePctVis}%`,
                  height: "100%",
                  background: storageFill,
                  transition: "width 200ms ease",
                }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={storagePctRaw}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
