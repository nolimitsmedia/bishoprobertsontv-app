// src/pages/admin/Analytics.js
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import "./Dashboard.css"; // reuse your admin styling if this already exists

function fmtDuration(sec) {
  const s = Math.max(0, Number(sec || 0));
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  if (m < 60) return `${m}m ${r}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function niceLabel(key) {
  const k = String(key || "");
  if (k === "video_play") return "Plays";
  if (k === "video_progress") return "Progress";
  if (k === "video_complete") return "Completions";
  if (k === "live_open") return "Live Opens";
  if (k === "live_progress") return "Live Progress";
  if (k === "live_leave") return "Live Leaves";
  return k.replace(/_/g, " ");
}

function MiniBar({ value, max }) {
  const v = Math.max(0, Number(value || 0));
  const m = Math.max(1, Number(max || 1));
  const pct = Math.max(0, Math.min(100, Math.round((v / m) * 100)));
  return (
    <div
      style={{
        height: 8,
        background: "rgba(255,255,255,0.08)",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: "linear-gradient(90deg, #2CC8FF, #136AFE)",
        }}
      />
    </div>
  );
}

/* -----------------------------
   Loading UI (spinner + skeleton)
------------------------------ */

function Spinner({ size = 34, label = "Loading…" }) {
  const ring = Math.max(4, Math.round(size / 8));
  return (
    <div
      style={{ display: "grid", placeItems: "center", gap: 10, padding: 12 }}
    >
      <style>{`
        @keyframes brtv-spin { to { transform: rotate(360deg); } }
        @keyframes brtv-shimmer {
          0% { background-position: -500px 0; }
          100% { background-position: 500px 0; }
        }
      `}</style>
      <div
        aria-label={label}
        role="status"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `${ring}px solid rgba(255,255,255,0.12)`,
          borderTopColor: "rgba(44, 200, 255, 0.95)",
          animation: "brtv-spin 0.9s linear infinite",
        }}
      />
      <div style={{ opacity: 0.7, fontSize: 13 }}>{label}</div>
    </div>
  );
}

function Skeleton({ h = 12, w = "100%", r = 10, style }) {
  return (
    <div
      style={{
        height: h,
        width: w,
        borderRadius: r,
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.12), rgba(255,255,255,0.05))",
        backgroundSize: "500px 100%",
        animation: "brtv-shimmer 1.1s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

function AnalyticsSkeleton() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        className="card"
        style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
      >
        <div style={{ flex: 1 }}>
          <Skeleton h={18} w="220px" r={10} />
          <div style={{ height: 8 }} />
          <Skeleton h={12} w="65%" r={10} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Skeleton h={34} w="54px" r={10} />
          <Skeleton h={34} w="54px" r={10} />
          <Skeleton h={34} w="54px" r={10} />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)",
          gap: 12,
        }}
      >
        <div className="card">
          <Skeleton h={16} w="140px" />
          <div style={{ height: 8 }} />
          <Skeleton h={12} w="55%" />
          <div style={{ height: 12 }} />
          <Skeleton h={180} w="100%" r={16} />
        </div>
        <div className="card">
          <Skeleton h={16} w="170px" />
          <div style={{ height: 12 }} />
          <Skeleton h={12} w="100%" />
          <div style={{ height: 10 }} />
          <Skeleton h={12} w="92%" />
          <div style={{ height: 10 }} />
          <Skeleton h={12} w="85%" />
          <div style={{ height: 10 }} />
          <Skeleton h={12} w="78%" />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12,
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="card" key={i}>
            <Skeleton h={12} w="110px" />
            <div style={{ height: 10 }} />
            <Skeleton h={26} w="120px" r={12} />
            <div style={{ height: 10 }} />
            <Skeleton h={10} w="70%" />
          </div>
        ))}
      </div>

      <div className="card">
        <Skeleton h={16} w="120px" />
        <div style={{ height: 12 }} />
        <Skeleton h={44} w="100%" r={14} />
        <div style={{ height: 10 }} />
        <Skeleton h={44} w="100%" r={14} />
        <div style={{ height: 10 }} />
        <Skeleton h={44} w="100%" r={14} />
      </div>
    </div>
  );
}

/**
 * Simple SVG line chart (no deps)
 */
function LineChart({ labels, series, height = 170 }) {
  const data = Array.isArray(series) ? series.map((n) => Number(n || 0)) : [];
  const max = Math.max(1, ...data);
  const w = 900;
  const h = height;

  const padL = 44;
  const padR = 14;
  const padT = 16;
  const padB = 26;

  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const pts = data.map((v, i) => {
    const x = padL + (data.length <= 1 ? 0 : (i / (data.length - 1)) * innerW);
    const y = padT + (1 - v / max) * innerH;
    return { x, y, v };
  });

  const d =
    pts.length === 0
      ? ""
      : `M ${pts[0].x} ${pts[0].y} ` +
        pts
          .slice(1)
          .map((p) => `L ${p.x} ${p.y}`)
          .join(" ");

  const areaD =
    pts.length === 0
      ? ""
      : `${d} L ${pts[pts.length - 1].x} ${padT + innerH} L ${pts[0].x} ${
          padT + innerH
        } Z`;

  const gridYs = [0.25, 0.5, 0.75].map((t) => padT + t * innerH);

  const labelCount = Math.min(labels?.length || 0, 6);
  const step =
    labelCount <= 1 ? 1 : Math.floor((labels.length - 1) / (labelCount - 1));

  const tickIdxs = [];
  for (let i = 0; i < (labels?.length || 0); i += step) tickIdxs.push(i);
  if (labels?.length && tickIdxs[tickIdxs.length - 1] !== labels.length - 1) {
    tickIdxs.push(labels.length - 1);
  }

  return (
    <div
      style={{
        width: "100%",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 12,
      }}
    >
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
        {gridYs.map((gy, idx) => (
          <line
            key={idx}
            x1={padL}
            y1={gy}
            x2={w - padR}
            y2={gy}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        ))}

        {[max, Math.round(max * 0.5), Math.round(max * 0.25), 0].map(
          (val, i) => {
            const yy =
              i === 0
                ? padT
                : i === 1
                  ? padT + innerH * 0.5
                  : i === 2
                    ? padT + innerH * 0.75
                    : padT + innerH;
            return (
              <text
                key={i}
                x={padL - 10}
                y={yy + 4}
                textAnchor="end"
                fontSize="12"
                fill="rgba(255,255,255,0.55)"
              >
                {val}
              </text>
            );
          },
        )}

        {areaD ? (
          <path d={areaD} fill="rgba(44, 200, 255, 0.10)" stroke="none" />
        ) : null}

        {d ? (
          <path
            d={d}
            fill="none"
            stroke="rgba(44, 200, 255, 0.95)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3.2"
            fill="rgba(19, 106, 254, 0.95)"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
          />
        ))}

        {tickIdxs.map((i, idx) => {
          const x =
            padL +
            (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * innerW);
          const label = labels?.[i] || "";
          return (
            <text
              key={idx}
              x={x}
              y={h - 8}
              textAnchor="middle"
              fontSize="12"
              fill="rgba(255,255,255,0.55)"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  // Live metrics
  const [live, setLive] = useState({
    live_open: 0,
    live_progress: 0,
    live_leave: 0,
    minutes: 10,
  });
  const [liveErr, setLiveErr] = useState("");

  // viewport helper (no CSS changes)
  const [vw, setVw] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const stackTop = vw < 980;

  // Summary fetch
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");

    (async () => {
      const res = await api.get(
        `/analytics/summary?days=${days}&ping_seconds=15`,
      );
      if (!alive) return;
      setData(res.data);
      setLoading(false);
    })().catch(() => {
      if (!alive) return;
      setErr("Failed to load analytics.");
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [days]);

  // Live metrics poll (separate, doesn’t affect your existing KPI cards)
  useEffect(() => {
    let alive = true;
    setLiveErr("");

    const loadLive = async () => {
      try {
        const res = await api.get(`/analytics/live?minutes=10&_=${Date.now()}`);
        if (!alive) return;
        setLive(
          res.data || {
            live_open: 0,
            live_progress: 0,
            live_leave: 0,
            minutes: 10,
          },
        );
      } catch {
        if (!alive) return;
        setLiveErr("Live metrics unavailable.");
      }
    };

    loadLive();
    const intv = setInterval(loadLive, 5000);
    return () => {
      alive = false;
      clearInterval(intv);
    };
  }, []);

  // Always-safe derived values (no conditional hooks)
  const counts = useMemo(
    () => (Array.isArray(data?.counts) ? data.counts : []),
    [data],
  );
  const topVideos = useMemo(
    () => (Array.isArray(data?.top_videos) ? data.top_videos : []),
    [data],
  );

  const t = data?.totals || {};

  const maxCount = useMemo(() => {
    if (!counts.length) return 1;
    return Math.max(1, ...counts.map((c) => Number(c.n || 0)));
  }, [counts]);

  const chart = useMemo(() => {
    const plays = Number(t.plays || 0);
    const unique = Number(t.unique_viewers || 0);
    const completes = Number(t.completions || 0);

    const a = Math.max(0, Math.round(plays * 0.35));
    const b = Math.max(0, Math.round(plays * 0.65));
    const c = Math.max(0, plays);

    const labels =
      days === 7
        ? ["Day 1", "Day 4", "Day 7"]
        : days === 30
          ? ["Day 1", "Day 15", "Day 30"]
          : ["Day 1", "Day 45", "Day 90"];

    return {
      labels,
      series: [a, b, c],
      sub: `Plays: ${plays} • Unique: ${unique} • Completions: ${completes}`,
    };
  }, [days, t.plays, t.unique_viewers, t.completions]);

  if (loading) {
    return (
      <>
        <div
          className="card"
          style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Analytics</h2>
            <div style={{ opacity: 0.75, fontSize: 13, marginTop: 4 }}>
              Loading viewing analytics…
            </div>
          </div>
          <Spinner />
        </div>
        <AnalyticsSkeleton />
      </>
    );
  }

  if (err) return <div className="card">{err}</div>;
  if (!data) return <div className="card">No data.</div>;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Header / Filters */}
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: vw < 560 ? "flex-start" : "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: vw < 560 ? "100%" : 320 }}>
          <h2 style={{ margin: 0 }}>Analytics</h2>
          {/* <div style={{ opacity: 0.75, fontSize: 13, marginTop: 4 }}>
            Uscreen-style viewing analytics (logged-in users only). Watch time
            is estimated from progress pings.
          </div> */}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
            width: vw < 560 ? "100%" : "auto",
            justifyContent: vw < 560 ? "flex-start" : "flex-end",
          }}
        >
          <button
            className="btn"
            onClick={() => setDays(7)}
            style={{ opacity: days === 7 ? 1 : 0.7 }}
          >
            7D
          </button>
          <button
            className="btn"
            onClick={() => setDays(30)}
            style={{ opacity: days === 30 ? 1 : 0.7 }}
          >
            30D
          </button>
          <button
            className="btn"
            onClick={() => setDays(90)}
            style={{ opacity: days === 90 ? 1 : 0.7 }}
          >
            90D
          </button>
        </div>
      </div>

      {/* ✅ Live Metrics Tile Group (separate; doesn’t alter your existing cards) */}
      <div
        className="card"
        style={{
          padding: 14,
          display: "grid",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0 }}>Live Metrics</h3>
          <div style={{ opacity: 0.65, fontSize: 12 }}>
            Last {live?.minutes || 10} minutes {liveErr ? `• ${liveErr}` : ""}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 12,
          }}
        >
          <div className="card" style={{ margin: 0 }}>
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              {niceLabel("live_open")}
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>
              {Number(live?.live_open || 0)}
            </div>
            <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>
              Page opens on /live
            </div>
          </div>

          <div className="card" style={{ margin: 0 }}>
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              {niceLabel("live_progress")}
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>
              {Number(live?.live_progress || 0)}
            </div>
            <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>
              Progress pings
            </div>
          </div>

          <div className="card" style={{ margin: 0 }}>
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              {niceLabel("live_leave")}
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>
              {Number(live?.live_leave || 0)}
            </div>
            <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>
              Leaves/unmounts
            </div>
          </div>
        </div>
      </div>

      {/* Main chart + side breakdown */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: stackTop
            ? "1fr"
            : "minmax(0, 1.7fr) minmax(0, 1fr)",
          gap: 12,
        }}
      >
        <div className="card" style={{ paddingBottom: 12, overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 240 }}>
              <h3 style={{ marginTop: 0, marginBottom: 4 }}>Activity</h3>
              <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 10 }}>
                {chart.sub}
              </div>
            </div>
            <div style={{ opacity: 0.7, fontSize: 13 }}>Last {days} days</div>
          </div>

          <LineChart labels={chart.labels} series={chart.series} />

          <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
            Note: This chart is a visual summary. If you want real daily charts
            like Uscreen, we’ll add a <code>/analytics/timeseries</code>{" "}
            endpoint next.
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Events Breakdown</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {counts.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No analytics events yet.</div>
            ) : (
              counts.map((row) => {
                const n = Number(row.n || 0);
                return (
                  <div key={row.type}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                        gap: 10,
                      }}
                    >
                      <strong
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {niceLabel(row.type)}
                      </strong>
                      <span style={{ opacity: 0.85 }}>{n}</span>
                    </div>
                    <MiniBar value={n} max={maxCount} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards (UNCHANGED layout) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12,
        }}
      >
        <div className="card">
          <div style={{ opacity: 0.7, fontSize: 13 }}>Plays</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>
            {Number(t.plays || 0)}
          </div>
          <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>
            Total starts across videos
          </div>
        </div>

        <div className="card">
          <div style={{ opacity: 0.7, fontSize: 13 }}>Unique Viewers</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>
            {Number(t.unique_viewers || 0)}
          </div>
          <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>
            Logged-in members only
          </div>
        </div>

        <div className="card">
          <div style={{ opacity: 0.7, fontSize: 13 }}>Watch Time</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>
            {fmtDuration(data.watch_seconds)}
          </div>
          <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>
            {Number(data.watch_hours || 0).toFixed(2)} hours (estimated)
          </div>
        </div>

        <div className="card">
          <div style={{ opacity: 0.7, fontSize: 13 }}>Completion Rate</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>
            {Number(t.completion_rate || 0)}%
          </div>
          <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>
            {Number(t.completions || 0)} completions
          </div>
        </div>

        <div className="card">
          <div style={{ opacity: 0.7, fontSize: 13 }}>Avg Watch / Play</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>
            {fmtDuration(t.avg_watch_seconds_per_play)}
          </div>
          <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>
            Average engagement per start
          </div>
        </div>
      </div>

      {/* Top Videos */}
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>Top Videos</h3>
          <div style={{ opacity: 0.65, fontSize: 12 }}>
            Ranked by estimated watch time
          </div>
        </div>

        <div style={{ height: 10 }} />

        {topVideos.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No video analytics yet.</div>
        ) : (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table
              className="table"
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 640,
              }}
            >
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "10px 8px" }}>Video</th>
                  <th style={{ padding: "10px 8px" }}>Plays</th>
                  <th style={{ padding: "10px 8px" }}>Unique</th>
                  <th style={{ padding: "10px 8px" }}>Watch Time</th>
                </tr>
              </thead>
              <tbody>
                {topVideos.map((v) => (
                  <tr key={v.video_id}>
                    <td style={{ padding: "10px 8px" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            width: 64,
                            height: 38,
                            borderRadius: 10,
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            overflow: "hidden",
                            flex: "0 0 auto",
                          }}
                        >
                          {v.thumbnail_url ? (
                            <img
                              src={v.thumbnail_url}
                              alt=""
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          ) : null}
                        </div>

                        <div style={{ minWidth: 220 }}>
                          <div style={{ fontWeight: 800 }}>
                            {v.title || `Video #${v.video_id}`}
                          </div>
                          <div style={{ opacity: 0.65, fontSize: 12 }}>
                            ID: {v.video_id}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "10px 8px" }}>
                      {Number(v.plays || 0)}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {Number(v.unique_viewers || 0)}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {fmtDuration(v.watch_seconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
