// src/pages/admin/AdminDashboard.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./Dashboard.css";

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString();
}

/* -----------------------------------------
   Modern Loading Spinner + Skeletons
   (MUI-like, no deps, doesn't break layout)
----------------------------------------- */
function CircularSpinner({ size = 42, label = "Loading…" }) {
  const ring = Math.max(4, Math.round(size / 10));

  return (
    <div style={{ display: "grid", placeItems: "center", padding: "6px 0" }}>
      <style>{`
        @keyframes brtv-spin { to { transform: rotate(360deg); } }
        @keyframes brtv-dash {
          0%   { stroke-dasharray: 1, 200; stroke-dashoffset: 0; }
          50%  { stroke-dasharray: 90, 200; stroke-dashoffset: -35; }
          100% { stroke-dasharray: 90, 200; stroke-dashoffset: -125; }
        }
        @keyframes brtv-shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }
      `}</style>

      <div
        aria-label={label}
        role="status"
        style={{
          width: size,
          height: size,
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 50 50"
          style={{
            animation: "brtv-spin 1.2s linear infinite",
            filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.35))",
          }}
        >
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={ring}
          />
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="rgba(154, 92, 255, 0.95)"
            strokeLinecap="round"
            strokeWidth={ring}
            style={{ animation: "brtv-dash 1.4s ease-in-out infinite" }}
          />
        </svg>
      </div>
    </div>
  );
}

function ShimmerBlock({ style }) {
  return (
    <div
      style={{
        borderRadius: 10,
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 100%)",
        backgroundSize: "200% 100%",
        animation: "brtv-shimmer 1.2s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

function SkeletonMetricCard({ variant = "simple" }) {
  return (
    <div className="dash-card" aria-busy="true">
      <ShimmerBlock style={{ width: 70, height: 12, borderRadius: 999 }} />
      <div style={{ height: 12 }} />

      {variant === "simple" ? (
        <>
          <ShimmerBlock style={{ width: 90, height: 34, borderRadius: 12 }} />
          <div style={{ height: 10 }} />
          <ShimmerBlock style={{ width: "70%", height: 12 }} />
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10 }}>
            <ShimmerBlock style={{ width: 90, height: 44, borderRadius: 12 }} />
            <ShimmerBlock style={{ width: 90, height: 44, borderRadius: 12 }} />
            <ShimmerBlock style={{ width: 90, height: 44, borderRadius: 12 }} />
          </div>
          <div style={{ height: 10 }} />
          <ShimmerBlock style={{ width: "78%", height: 12 }} />
        </>
      )}
    </div>
  );
}

function SkeletonListPanel({ rows = 6 }) {
  return (
    <div className="dash-card" aria-busy="true">
      <div className="dash-cardHead">
        <ShimmerBlock style={{ width: 180, height: 16, borderRadius: 10 }} />
        <ShimmerBlock style={{ width: 120, height: 12, borderRadius: 10 }} />
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: "grid", gap: 6 }}>
            <ShimmerBlock
              style={{ width: `${65 + (i % 4) * 8}%`, height: 14 }}
            />
            <ShimmerBlock
              style={{ width: `${45 + (i % 3) * 12}%`, height: 12 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonBarsPanel({ rows = 6 }) {
  return (
    <div className="dash-card" aria-busy="true">
      <div className="dash-cardHead">
        <ShimmerBlock style={{ width: 150, height: 16, borderRadius: 10 }} />
        <ShimmerBlock style={{ width: 110, height: 12, borderRadius: 10 }} />
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr 50px",
              gap: 10,
              alignItems: "center",
            }}
          >
            <ShimmerBlock style={{ width: "90%", height: 12 }} />
            <ShimmerBlock
              style={{ width: `${55 + (i % 4) * 10}%`, height: 10 }}
            />
            <ShimmerBlock style={{ width: 28, height: 12 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* -----------------------------------------
   Animations: Counters + Progress Bars
   (No deps, keeps UI intact)
----------------------------------------- */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(!!mq.matches);

    apply();

    // Safari compatibility
    if (mq.addEventListener) mq.addEventListener("change", apply);
    else mq.addListener(apply);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", apply);
      else mq.removeListener(apply);
    };
  }, []);

  return reduced;
}

function AnimatedNumber({
  value,
  duration = 800,
  startAt = 0,
  as: Tag = "span",
  formatter,
  ariaLabel,
}) {
  const prefersReduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(startAt);
  const rafRef = useRef(null);

  useEffect(() => {
    const target = safeNum(value);

    if (prefersReduced) {
      setDisplay(target);
      return;
    }

    const from = safeNum(display);
    const to = target;

    if (from === to) return;

    const start = performance.now();
    const dur = Math.max(200, safeNum(duration));

    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const next = Math.round(from + (to - from) * eased);
      setDisplay(next);

      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, prefersReduced]);

  const text = formatter ? formatter(display) : String(display);

  return <Tag aria-label={ariaLabel}>{text}</Tag>;
}

function AnimatedBarFill({ percent, duration = 900 }) {
  const prefersReduced = usePrefersReducedMotion();
  const [w, setW] = useState(0);

  useEffect(() => {
    const p = Math.max(0, Math.min(100, safeNum(percent)));

    if (prefersReduced) {
      setW(p);
      return;
    }

    setW(0);
    const t = setTimeout(() => setW(p), 30);
    return () => clearTimeout(t);
  }, [percent, prefersReduced]);

  return (
    <div
      className="dash-barFill"
      style={{
        width: `${w}%`,
        transition: prefersReduced
          ? "none"
          : `width ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        willChange: "width",
      }}
    />
  );
}

export default function AdminDashboard() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  // Used to re-trigger animations when new data arrives
  const [animSeed, setAnimSeed] = useState(0);

  const load = useCallback(async (aliveRef) => {
    setLoading(true);
    setErr("");

    try {
      const res = await api.get("/admin/dashboard/overview", {
        timeout: 30000,
      });

      if (aliveRef && !aliveRef.current) return;

      if (!res.data?.ok) {
        throw new Error(res.data?.message || "Failed to load");
      }

      setData(res.data);
      setAnimSeed((s) => s + 1);
    } catch (e) {
      if (aliveRef && !aliveRef.current) return;

      const isTimeout =
        e?.code === "ECONNABORTED" ||
        String(e?.message || "")
          .toLowerCase()
          .includes("timeout");

      const msg =
        (isTimeout
          ? "The dashboard request timed out. This usually means the backend route is missing or taking too long to respond."
          : e?.response?.data?.message || e?.message) ||
        "Failed to load dashboard data.";

      setErr(msg);
      setData(null);
    } finally {
      if (!aliveRef || aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const aliveRef = { current: true };
    load(aliveRef);
    return () => {
      aliveRef.current = false;
    };
  }, [load]);

  const users = data?.users || {};
  const content = data?.content || {};
  const health = data?.health || {};

  const recent = useMemo(() => {
    return Array.isArray(content.recently_published)
      ? content.recently_published
      : [];
  }, [content.recently_published]);

  const topCats = useMemo(() => {
    return Array.isArray(content.top_categories) ? content.top_categories : [];
  }, [content.top_categories]);

  const topCatMax = useMemo(() => {
    const first = topCats?.[0]?.count;
    return safeNum(first) || 0;
  }, [topCats]);

  return (
    <div className="dash-page">
      <div className="dash-wrap">
        <div
          className="dash-hero"
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 className="dash-title">Dashboard</h1>
            <p className="dash-muted">Users + content overview</p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => nav("/admin/users")}>
              View members
            </button>
          </div>
        </div>

        {loading ? (
          <>
            <div className="dash-card" aria-busy="true">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <CircularSpinner size={34} label="Loading dashboard…" />
                <div className="dash-muted" style={{ fontSize: 14 }}>
                  Loading dashboard…
                </div>
              </div>
            </div>

            <div className="dash-grid">
              <SkeletonMetricCard variant="simple" />
              <SkeletonMetricCard variant="pills" />
              <SkeletonMetricCard variant="pills" />
            </div>

            <div className="dash-split">
              <SkeletonListPanel rows={6} />
              <SkeletonBarsPanel rows={6} />
            </div>
          </>
        ) : err ? (
          <div className="dash-card">
            <div className="dash-errorTitle">We couldn’t load the data.</div>
            <div className="dash-errorText">{err}</div>

            <div
              className="dash-muted"
              style={{
                marginTop: 10,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <span>
                Backend endpoint needed: <b>/api/admin/dashboard/overview</b>
              </span>

              <button
                className="btn"
                onClick={() => {
                  const aliveRef = { current: true };
                  load(aliveRef);
                }}
                style={{ marginLeft: "auto" }}
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="dash-grid">
              <div className="dash-card">
                <div className="dash-kicker">Users</div>
                <div className="dash-metric">
                  <AnimatedNumber
                    key={`users-total-${animSeed}`}
                    value={safeNum(users.total)}
                    duration={900}
                    ariaLabel="Total users"
                  />
                </div>
                <div className="dash-sub">Total registered users</div>
              </div>

              <div className="dash-card">
                <div className="dash-kicker">New users</div>
                <div className="dash-row">
                  <div className="dash-pill">
                    <strong>
                      <AnimatedNumber
                        key={`users-today-${animSeed}`}
                        value={safeNum(users.new_today)}
                        duration={700}
                        ariaLabel="New users today"
                      />
                    </strong>
                    <span>Today</span>
                  </div>
                  <div className="dash-pill">
                    <strong>
                      <AnimatedNumber
                        key={`users-7d-${animSeed}`}
                        value={safeNum(users.new_7d)}
                        duration={750}
                        ariaLabel="New users last 7 days"
                      />
                    </strong>
                    <span>7 days</span>
                  </div>
                  <div className="dash-pill">
                    <strong>
                      <AnimatedNumber
                        key={`users-30d-${animSeed}`}
                        value={safeNum(users.new_30d)}
                        duration={800}
                        ariaLabel="New users last 30 days"
                      />
                    </strong>
                    <span>30 days</span>
                  </div>
                </div>
                <div className="dash-sub">Based on user created date</div>
              </div>

              <div className="dash-card">
                <div className="dash-kicker">Content health</div>
                <div className="dash-row">
                  <div className="dash-pill dash-pill--warn">
                    <strong>
                      <AnimatedNumber
                        key={`health-thumb-${animSeed}`}
                        value={safeNum(health.missing_thumbnails)}
                        duration={700}
                        ariaLabel="Missing thumbnails"
                      />
                    </strong>
                    <span>Missing thumbnails</span>
                  </div>
                  <div className="dash-pill dash-pill--warn">
                    <strong>
                      <AnimatedNumber
                        key={`health-cat-${animSeed}`}
                        value={safeNum(health.missing_categories)}
                        duration={750}
                        ariaLabel="Missing categories"
                      />
                    </strong>
                    <span>Missing categories</span>
                  </div>
                  <div className="dash-pill">
                    <strong>
                      <AnimatedNumber
                        key={`health-notpub-${animSeed}`}
                        value={safeNum(health.not_published)}
                        duration={800}
                        ariaLabel="Not published"
                      />
                    </strong>
                    <span>Not published</span>
                  </div>
                </div>
                <div className="dash-sub">Quick cleanup checklist</div>
              </div>
            </div>

            <div className="dash-split">
              <div className="dash-card">
                <div className="dash-cardHead">
                  <h3>Recently published</h3>
                  <span className="dash-muted">
                    Total videos:{" "}
                    <AnimatedNumber
                      key={`total-videos-${animSeed}`}
                      value={safeNum(content.total_videos)}
                      duration={900}
                      ariaLabel="Total videos"
                    />
                  </span>
                </div>

                {recent.length === 0 ? (
                  <div className="dash-muted">No recent videos found.</div>
                ) : (
                  <div className="dash-list">
                    {recent.map((v) => (
                      <div key={v.id} className="dash-item">
                        <div className="dash-itemTitle">
                          {v.title || "Untitled"}
                        </div>
                        <div className="dash-itemMeta">{fmtDate(v.date)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="dash-card">
                <div className="dash-cardHead">
                  <h3>Top categories</h3>
                  <span className="dash-muted">By video count</span>
                </div>

                {topCats.length === 0 ? (
                  <div className="dash-muted">No categories found.</div>
                ) : (
                  <div className="dash-bars">
                    {topCats.map((c) => {
                      const pct = topCatMax
                        ? Math.min(100, (safeNum(c.count) / topCatMax) * 100)
                        : 0;

                      return (
                        <div key={c.id} className="dash-barRow">
                          <div className="dash-barLabel">
                            {c.name || "Category"}
                          </div>

                          <div className="dash-barTrack">
                            <AnimatedBarFill
                              key={`bar-${c.id}-${animSeed}`}
                              percent={pct}
                              duration={950}
                            />
                          </div>

                          <div className="dash-barValue">
                            <AnimatedNumber
                              key={`cat-count-${c.id}-${animSeed}`}
                              value={safeNum(c.count)}
                              duration={900}
                              ariaLabel={`${c.name || "Category"} count`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
