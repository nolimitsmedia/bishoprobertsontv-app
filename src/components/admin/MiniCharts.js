// src/components/admin/MiniCharts.js
// Small SVG charts in the dashboard's style (uses classes from DashboardModern.css).
import React from "react";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
function points(values, w, h, pad = 2) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values.map((v, i) => [
    pad + i * step,
    h - pad - (num(v) / max) * (h - pad * 2),
  ]);
}
const pathOf = (pts) =>
  pts
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
const shortDay = (day) =>
  day
    ? new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "";

export function Sparkline({ values = [], label }) {
  const d = pathOf(points(values.length ? values : [0, 0], 120, 36));
  return (
    <svg
      className="dm-spark"
      viewBox="0 0 120 36"
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <path d={`${d} L118,34 L2,34 Z`} className="dm-sparkFill" />
      <path d={d} className="dm-sparkLine" />
    </svg>
  );
}

// series: [{ day: "YYYY-MM-DD", n }]
export function AreaChart({ series = [], label, unit = "" }) {
  const values = series.map((s) => num(s.n));
  const W = 640;
  const H = 220;
  const d = pathOf(points(values.length ? values : [0, 0], W, H, 8));
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(0, ...values);
  return (
    <figure className="dm-area">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label}: ${total}${unit} in total, highest ${max}${unit} in a day`}
        preserveAspectRatio="none"
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={W}
            y1={H * f}
            y2={H * f}
            className="dm-grid"
          />
        ))}
        <path
          d={`${d} L${W - 8},${H - 8} L8,${H - 8} Z`}
          className="dm-areaFill"
        />
        <path d={d} className="dm-areaLine" />
      </svg>
      <figcaption className="dm-axis" aria-hidden="true">
        <span>{shortDay(series[0]?.day)}</span>
        <span>{shortDay(series[Math.floor(series.length / 2)]?.day)}</span>
        <span>{shortDay(series[series.length - 1]?.day)}</span>
      </figcaption>
    </figure>
  );
}

// series: [{ day, n }]; title shows on hover
export function Bars({ series = [], label, format = (v) => v }) {
  const values = series.map((s) => num(s.n));
  const max = Math.max(1, ...values);
  return (
    <div
      className="dm-bars"
      role="img"
      aria-label={`${label}: ${format(values.reduce((a, b) => a + b, 0))} in total`}
    >
      {values.map((v, i) => (
        <span
          key={i}
          className="dm-bar"
          style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
          title={`${shortDay(series[i]?.day)}: ${format(v)}`}
        />
      ))}
    </div>
  );
}

export function trend(now, prev) {
  const a = num(now);
  const b = num(prev);
  if (!b && !a) return { dir: "flat", label: "0%" };
  if (!b) return { dir: "up", label: "New" };
  const pct = Math.round(((a - b) / b) * 100);
  return {
    dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat",
    label: `${pct > 0 ? "+" : ""}${pct}%`,
  };
}

export function Kpi({
  title,
  value,
  sub,
  tr,
  spark,
  sparkLabel,
  accent = "violet",
}) {
  return (
    <section
      className={`dm-card dm-kpi dm-accent-${accent}`}
      aria-label={title}
    >
      <div className="dm-kpiHead">
        <span className="dm-kpiTitle">{title}</span>
        {tr ? (
          <span
            className={`dm-trend dm-trend--${tr.dir}`}
            title="Compared with the previous period"
          >
            <span aria-hidden="true">
              {tr.dir === "up" ? "▲" : tr.dir === "down" ? "▼" : "•"}
            </span>{" "}
            {tr.label}
          </span>
        ) : null}
      </div>
      <div className="dm-kpiValue">{value}</div>
      <div className="dm-kpiFoot">
        <span className="dm-kpiSub">{sub}</span>
        {spark ? <Sparkline values={spark} label={sparkLabel} /> : null}
      </div>
    </section>
  );
}
