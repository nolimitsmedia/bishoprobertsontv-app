// src/pages/admin/AdminDashboard.js
//
// Admin dashboard (redesigned): KPI cards with 30-day trends and sparklines,
// plays and new-member charts, clickable Content health (which videos are
// missing a thumbnail or category, or not published — with Fix links), top
// categories and recently published videos. Charts are plain SVG.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";
import "./DashboardModern.css";

const CACHE_KEY = "brtv:admin-dashboard:v2";
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmt = (n) => num(n).toLocaleString("en-US");
const usDate = (d) => {
  const t = new Date(d || "");
  return Number.isNaN(t.getTime()) ? "—" : t.toLocaleDateString("en-US");
};

function trend(now, prev) {
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

// ---------- small SVG charts ----------
function pathFor(values, w, h, pad = 2) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values.map((v, i) => [
    pad + i * step,
    h - pad - (num(v) / max) * (h - pad * 2),
  ]);
}
function Sparkline({ values = [], label }) {
  const pts = pathFor(values.length ? values : [0, 0], 120, 36);
  const d = pts
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
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
function AreaChart({ series = [], label }) {
  const values = series.map((s) => num(s.n));
  const W = 640;
  const H = 220;
  const pts = pathFor(values.length ? values : [0, 0], W, H, 8);
  const d = pts
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const tick = (i) => {
    const day = series[i]?.day;
    return day
      ? new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "";
  };
  return (
    <figure className="dm-area">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label}: ${total} in 30 days, highest ${max} in a day`}
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
        <span>{tick(0)}</span>
        <span>{tick(Math.floor(values.length / 2))}</span>
        <span>{tick(values.length - 1)}</span>
      </figcaption>
    </figure>
  );
}
function Bars({ series = [], label }) {
  const values = series.map((s) => num(s.n));
  const max = Math.max(1, ...values);
  return (
    <div
      className="dm-bars"
      role="img"
      aria-label={`${label}: ${values.reduce((a, b) => a + b, 0)} in total`}
    >
      {values.map((v, i) => (
        <span
          key={i}
          className="dm-bar"
          style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
          title={`${series[i]?.day || series[i]?.month}: ${v}`}
        />
      ))}
    </div>
  );
}

function Kpi({ title, value, sub, tr, spark, sparkLabel, accent }) {
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
            title="Compared with the previous 30 days"
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

const HEALTH = [
  [
    "thumbnails",
    "Missing thumbnails",
    "missing_thumbnails",
    "Add a thumbnail so the video shows a picture in the Catalog.",
  ],
  [
    "categories",
    "Missing categories",
    "missing_categories",
    "Choose a category so the video appears in a Catalog row.",
  ],
  [
    "unpublished",
    "Not published",
    "not_published",
    "Publish it, or leave it hidden on purpose.",
  ],
];

export default function AdminDashboard() {
  const nav = useNavigate();
  const [data, setData] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    } catch {
      return null;
    }
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState(null);
  const [open, setOpen] = useState(""); // which Content health list is open
  const [list, setList] = useState({ type: "", items: null, error: "" });

  const load = useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      const { data: d } = await api.get("/admin/dashboard/overview", {
        timeout: 20000,
      });
      if (!d?.ok) throw new Error(d?.message || "Dashboard unavailable");
      setData(d);
      setUpdated(new Date());
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(d));
      } catch {
        /* ignore */
      }
    } catch (e) {
      setErr(
        e?.response?.data?.message ||
          e?.message ||
          "The dashboard could not be loaded.",
      );
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function openList(type) {
    if (open === type) {
      setOpen("");
      return;
    }
    setOpen(type);
    setList({ type, items: null, error: "" });
    try {
      const { data: d } = await api.get(
        `/admin/dashboard/content-health/${type}`,
      );
      setList({
        type,
        items: Array.isArray(d?.items) ? d.items : [],
        error: "",
      });
    } catch (e) {
      setList({
        type,
        items: [],
        error: e?.response?.data?.message || "This list could not be loaded.",
      });
    }
  }

  const u = data?.users || {};
  const c = data?.content || {};
  const h = data?.health || {};
  const p = data?.plays || null;
  const s = data?.series || {};
  const topCats = useMemo(
    () => (Array.isArray(c.top_categories) ? c.top_categories : []).slice(0, 6),
    [c.top_categories],
  );
  const catMax = Math.max(1, ...topCats.map((x) => num(x.count)));
  const recent = Array.isArray(c.recently_published)
    ? c.recently_published
    : [];
  const openMeta = HEALTH.find((x) => x[0] === open);

  return (
    <main className="dm-page">
      <header className="dm-head">
        <div>
          <nav className="dm-crumbs" aria-label="Breadcrumb">
            <span>Home</span> <span aria-hidden="true">›</span>{" "}
            <span aria-current="page">Dashboard</span>
          </nav>
          <h1>Dashboard</h1>
          <p className="dm-subtitle">
            Members, videos and viewing — last 30 days compared with the 30
            before.
          </p>
        </div>
        <div className="dm-headTools">
          {updated ? (
            <span className="dm-updated">
              Updated{" "}
              {updated.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          ) : null}
          <button
            type="button"
            className="dm-btn"
            onClick={load}
            disabled={busy}
          >
            {busy ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            className="dm-btn dm-btnPrimary"
            onClick={() => nav("/admin/users")}
          >
            View members
          </button>
        </div>
      </header>

      {err ? (
        <p className="dm-alert" role="alert">
          {err} {data ? "Showing the last saved numbers." : ""}
        </p>
      ) : null}
      {!data && !err ? (
        <p className="dm-muted" role="status">
          Loading the dashboard…
        </p>
      ) : null}

      {data ? (
        <>
          <div className="dm-kpis">
            <Kpi
              title="Members"
              accent="violet"
              value={fmt(u.total)}
              sub={`${fmt(u.new_30d)} new in 30 days · ${fmt(u.new_today)} today`}
              tr={trend(u.new_30d, u.prev_30d)}
              spark={(s.users_daily || []).map((x) => x.n)}
              sparkLabel="New members per day, last 30 days"
            />
            <Kpi
              title="Videos"
              accent="teal"
              value={fmt(c.total_videos)}
              sub={`${fmt(c.published_30d)} published in 30 days`}
              tr={trend(c.published_30d, c.published_prev_30d)}
              spark={(s.videos_monthly || []).map((x) => x.n)}
              sparkLabel="Videos published per month, last 12 months"
            />
            <Kpi
              title="Plays (30 days)"
              accent="blue"
              value={p ? fmt(p.last_30d) : "—"}
              sub={
                p
                  ? `${fmt(p.prev_30d)} the 30 days before`
                  : "No viewing data yet"
              }
              tr={p ? trend(p.last_30d, p.prev_30d) : null}
              spark={(s.plays_daily || []).map((x) => x.n)}
              sparkLabel="Plays per day, last 30 days"
            />
            <Kpi
              title="Viewers (30 days)"
              accent="amber"
              value={p ? fmt(p.viewers_30d) : "—"}
              sub="Signed-in members who watched"
            />
          </div>

          <div className="dm-row dm-row--charts">
            <section className="dm-card dm-span2" aria-labelledby="dm-plays">
              <div className="dm-cardHead">
                <h2 id="dm-plays">Plays — last 30 days</h2>
                <Link to="/admin/analytics" className="dm-link">
                  Analytics ›
                </Link>
              </div>
              {(s.plays_daily || []).length ? (
                <AreaChart series={s.plays_daily} label="Plays per day" />
              ) : (
                <p className="dm-muted">No viewing data yet.</p>
              )}
            </section>
            <section className="dm-card" aria-labelledby="dm-members">
              <div className="dm-cardHead">
                <h2 id="dm-members">New members</h2>
                <span className="dm-muted">30 days</span>
              </div>
              <div className="dm-bigNum">{fmt(u.new_30d)}</div>
              <Bars series={s.users_daily || []} label="New members per day" />
              <p className="dm-muted">{fmt(u.new_7d)} in the last 7 days</p>
            </section>
          </div>

          <div className="dm-row">
            <section className="dm-card dm-span2" aria-labelledby="dm-health">
              <div className="dm-cardHead">
                <h2 id="dm-health">Content health</h2>
                <span className="dm-muted">
                  Click a box to see which videos
                </span>
              </div>
              <div className="dm-healthGrid">
                {HEALTH.map(([type, label, key]) => {
                  const n = num(h[key]);
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`dm-health${n ? " is-issue" : " is-ok"}${open === type ? " is-open" : ""}`}
                      aria-expanded={open === type}
                      aria-controls="dm-healthList"
                      onClick={() => openList(type)}
                    >
                      <strong>{fmt(n)}</strong>
                      <span>{label}</span>
                      <small>
                        {n
                          ? open === type
                            ? "Hide list"
                            : "Show videos"
                          : "All good"}
                      </small>
                    </button>
                  );
                })}
              </div>
              {open ? (
                <div id="dm-healthList" className="dm-healthList">
                  <p className="dm-muted">{openMeta?.[3]}</p>
                  {list.error ? (
                    <p className="dm-alert" role="alert">
                      {list.error}
                    </p>
                  ) : null}
                  {list.items === null ? (
                    <p className="dm-muted" role="status">
                      Loading…
                    </p>
                  ) : null}
                  {list.items && !list.items.length && !list.error ? (
                    <p className="dm-muted">No videos — all good.</p>
                  ) : null}
                  {list.items && list.items.length ? (
                    <div className="dm-tableWrap">
                      <table className="dm-table">
                        <caption className="dm-sr">{openMeta?.[1]}</caption>
                        <thead>
                          <tr>
                            <th scope="col">Video</th>
                            <th scope="col">Date</th>
                            <th scope="col">Category</th>
                            <th scope="col">Status</th>
                            <th scope="col">
                              <span className="dm-sr">Action</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.items.map((v) => (
                            <tr key={v.id}>
                              <td>
                                <span className="dm-vid">
                                  {v.thumb ? (
                                    <img src={v.thumb} alt="" loading="lazy" />
                                  ) : (
                                    <span
                                      className="dm-noThumb"
                                      aria-hidden="true"
                                    >
                                      No image
                                    </span>
                                  )}
                                  <span>{v.title || `Video #${v.id}`}</span>
                                </span>
                              </td>
                              <td>{usDate(v.date)}</td>
                              <td>
                                {v.category_name || (
                                  <span className="dm-warnText">None</span>
                                )}
                              </td>
                              <td>
                                {v.is_published ? (
                                  "Published"
                                ) : (
                                  <span className="dm-warnText">
                                    Not published
                                  </span>
                                )}
                              </td>
                              <td>
                                <Link
                                  to={`/admin/content/videos/${v.id}`}
                                  className="dm-btn dm-btnSmall"
                                  aria-label={`Fix ${v.title || `video ${v.id}`}`}
                                >
                                  Fix
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="dm-card" aria-labelledby="dm-cats">
              <div className="dm-cardHead">
                <h2 id="dm-cats">Top categories</h2>
                <span className="dm-muted">Videos</span>
              </div>
              <ul className="dm-catList">
                {topCats.map((x) => (
                  <li key={x.id}>
                    <span className="dm-catName">{x.name}</span>
                    <span className="dm-catBar" aria-hidden="true">
                      <span
                        style={{ width: `${(num(x.count) / catMax) * 100}%` }}
                      />
                    </span>
                    <span className="dm-catNum">{fmt(x.count)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="dm-card" aria-labelledby="dm-recent">
            <div className="dm-cardHead">
              <h2 id="dm-recent">Recently published</h2>
              <Link to="/admin/content/videos" className="dm-link">
                All videos ›
              </Link>
            </div>
            <div className="dm-tableWrap">
              <table className="dm-table">
                <thead>
                  <tr>
                    <th scope="col">Video</th>
                    <th scope="col">Published</th>
                    <th scope="col">
                      <span className="dm-sr">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <span className="dm-vid">
                          {v.thumb ? (
                            <img src={v.thumb} alt="" loading="lazy" />
                          ) : (
                            <span className="dm-noThumb" aria-hidden="true">
                              No image
                            </span>
                          )}
                          <span>{v.title}</span>
                        </span>
                      </td>
                      <td>{usDate(v.date)}</td>
                      <td>
                        <Link
                          to={`/admin/content/videos/${v.id}`}
                          className="dm-btn dm-btnSmall"
                          aria-label={`Open ${v.title}`}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
