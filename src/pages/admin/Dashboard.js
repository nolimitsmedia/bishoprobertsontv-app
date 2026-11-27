// src/pages/admin/Dashboard.js
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import "./Dashboard.css";

/* ─── helpers ─────────────────────────────────────────────── */
async function tryGet(urls) {
  for (const u of urls) {
    try {
      const r = await api.get(u);
      return r.data;
    } catch {
      continue;
    }
  }
  return null;
}

function pickArray(data, keys = []) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  for (const k of keys) if (Array.isArray(data?.[k])) return data[k];
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function toDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function withinDays(date, days) {
  const d = toDate(date);
  if (!d) return false;
  return Date.now() - d.getTime() <= days * 864e5;
}

function isPublished(v) {
  const status = String(v?.status || v?.state || "").toLowerCase();
  const visibility = String(v?.visibility || v?.access || "").toLowerCase();
  if (v?.published_at || v?.publishedAt) return true;
  if (visibility === "public") return true;
  if (status === "published") return true;
  if (status === "ready" && visibility === "public") return true;
  return false;
}

function fmtDate(val) {
  const d = toDate(val);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/* ─── Skeleton ────────────────────────────────────────────── */
function Skeleton({ h = 20, w = "100%", r = 10, mb = 0 }) {
  return (
    <div
      style={{
        height: h,
        width: w,
        borderRadius: r,
        marginBottom: mb,
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.06) 75%)",
        backgroundSize: "500px 100%",
        animation: "dash-shimmer 1.4s linear infinite",
      }}
    />
  );
}

/* ─── Stat card ───────────────────────────────────────────── */
function StatCard({ kicker, metric, sub, accent, loading }) {
  return (
    <div className="dash-card dash-stat-card">
      <div className="dash-kicker">{kicker}</div>
      {loading ? (
        <>
          <Skeleton h={48} w={80} r={10} mb={6} />
          <Skeleton h={14} w="60%" r={6} />
        </>
      ) : (
        <>
          <div className="dash-metric" style={accent ? { color: accent } : {}}>
            {metric}
          </div>
          <div className="dash-sub">{sub}</div>
        </>
      )}
    </div>
  );
}

/* ─── Mini pill ───────────────────────────────────────────── */
function Pill({ value, label, warn, loading }) {
  return (
    <div className={`dash-pill${warn ? " dash-pill--warn" : ""}`}>
      {loading ? <Skeleton h={18} w={40} r={6} /> : <strong>{value}</strong>}
      <span>{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [users, setUsers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let alive = true;

    // OPTIMIZATION 1: all three fetched in parallel
    const fetchUsers = tryGet(["/admin/users", "/users/all", "/users"]).then(
      (d) => {
        if (alive) setUsers(pickArray(d, ["users", "data"]));
      },
      (e) => {
        if (alive) setErrors((p) => ({ ...p, users: e?.message }));
      },
    );

    const fetchVideos = tryGet([
      "/videos?limit=1000",
      "/videos",
      "/videos/admin?limit=1000",
    ]).then(
      (d) => {
        if (alive) setVideos(pickArray(d, ["videos", "data"]));
      },
      (e) => {
        if (alive) setErrors((p) => ({ ...p, videos: e?.message }));
      },
    );

    const fetchCats = tryGet(["/categories", "/categories/all"]).then(
      (d) => {
        if (alive) setCategories(pickArray(d, ["categories", "data"]));
      },
      (e) => {
        if (alive) setErrors((p) => ({ ...p, cats: e?.message }));
      },
    );

    // OPTIMIZATION 2: hide skeleton only once ALL three resolve
    Promise.all([fetchUsers, fetchVideos, fetchCats]).finally(() => {
      if (alive) setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, []);

  /* ─── metrics ─────────────────────────────────────────── */
  // OPTIMIZATION 3: split into two memos so video stats don't rerun when only users change
  const userMetrics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    return {
      total: users.length,
      today: users.filter((u) => {
        const d = toDate(u?.created_at || u?.createdAt);
        return d && d >= todayStart;
      }).length,
      week: users.filter((u) => withinDays(u?.created_at || u?.createdAt, 7))
        .length,
      month: users.filter((u) => withinDays(u?.created_at || u?.createdAt, 30))
        .length,
    };
  }, [users]);

  const videoMetrics = useMemo(() => {
    const missingThumb = videos.filter(
      (v) => !String(v?.thumbnail_url || v?.thumbnailUrl || "").trim(),
    ).length;
    const missingCategory = videos.filter(
      (v) => !v?.category_id && !v?.categoryId,
    ).length;
    const notPublished = videos.filter((v) => !isPublished(v)).length;

    const published = videos.filter(isPublished).sort((a, b) => {
      const da = toDate(a?.published_at || a?.publishedAt || a?.created_at);
      const db = toDate(b?.published_at || b?.publishedAt || b?.created_at);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    });

    const catCount = new Map();
    for (const v of videos) {
      const cid = String(v?.category_id ?? v?.categoryId ?? "");
      if (cid) catCount.set(cid, (catCount.get(cid) || 0) + 1);
    }
    const catsByCount = categories
      .map((c) => {
        const id = String(c?.id ?? "");
        return {
          id,
          name: c?.name || c?.title || `Cat ${id}`,
          count: catCount.get(id) || 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);

    const topVideos = videos
      .slice()
      .sort((a, b) => {
        const va = Number(a?.views || a?.view_count || 0);
        const vb = Number(b?.views || b?.view_count || 0);
        if (vb !== va) return vb - va;
        const da = toDate(a?.published_at || a?.created_at);
        const db = toDate(b?.published_at || b?.created_at);
        return (db?.getTime() || 0) - (da?.getTime() || 0);
      })
      .slice(0, 8);

    return {
      missingThumb,
      missingCategory,
      notPublished,
      recentPublished: published.slice(0, 8),
      catsByCount,
      topVideos,
      totalPublished: published.length,
    };
  }, [videos, categories]);

  const isLoading = loading;
  const maxCatCount = videoMetrics.catsByCount[0]?.count || 1;

  return (
    <div className="dash-page">
      <div className="dash-wrap">
        {/* ── Header ── */}
        <div className="dash-hero">
          <div>
            <p className="dash-eyebrow">{todayLabel()}</p>
            <h1 className="dash-title">Dashboard</h1>
            <p className="dash-muted">Users + content overview</p>
          </div>
          <div className="dash-actions">
            <Link to="/admin/users" className="dash-btn">
              View Members
            </Link>
            <Link to="/admin/videos" className="dash-btn dash-btn--ghost">
              Manage Videos
            </Link>
          </div>
        </div>

        {/* ── Top stat cards ── */}
        <div className="dash-grid dash-grid--3">
          <StatCard
            kicker="Users"
            metric={userMetrics.total}
            sub="Total registered users"
            loading={isLoading}
          />

          <div className="dash-card">
            <div className="dash-kicker">New Users</div>
            <div className="dash-row" style={{ marginTop: 10 }}>
              <Pill
                value={userMetrics.today}
                label="Today"
                loading={isLoading}
              />
              <Pill
                value={userMetrics.week}
                label="7 days"
                loading={isLoading}
              />
              <Pill
                value={userMetrics.month}
                label="30 days"
                loading={isLoading}
              />
            </div>
            <div className="dash-sub" style={{ marginTop: 10 }}>
              Based on user created date
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-kicker">Content Health</div>
            <div className="dash-row" style={{ marginTop: 10 }}>
              <Pill
                value={videoMetrics.missingThumb}
                label="Missing thumbnails"
                warn
                loading={isLoading}
              />
              <Pill
                value={videoMetrics.missingCategory}
                label="Missing categories"
                warn
                loading={isLoading}
              />
              <Pill
                value={videoMetrics.notPublished}
                label="Not published"
                loading={isLoading}
              />
            </div>
            <div className="dash-sub" style={{ marginTop: 10 }}>
              Quick cleanup checklist
            </div>
          </div>
        </div>

        {/* ── Bottom panels ── */}
        <div className="dash-split">
          {/* Recently Published */}
          <div className="dash-card">
            <div className="dash-cardHead">
              <h3>Recently Published</h3>
              <span className="dash-badge">
                Total videos: {isLoading ? "—" : videoMetrics.totalPublished}
              </span>
            </div>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="dash-item" style={{ marginBottom: 8 }}>
                  <Skeleton h={16} w="70%" r={6} mb={6} />
                  <Skeleton h={12} w="40%" r={4} />
                </div>
              ))
            ) : !videoMetrics.recentPublished.length ? (
              <div className="dash-muted">No published videos found.</div>
            ) : (
              <div className="dash-list">
                {videoMetrics.recentPublished.map((v) => (
                  <Link
                    key={v.id}
                    to={`/admin/videos/${v.id}`}
                    className="dash-item dash-item--link"
                  >
                    <div className="dash-itemTitle">
                      {v.title || v.name || "Untitled"}
                    </div>
                    <div className="dash-itemMeta">
                      {fmtDate(v.published_at || v.created_at)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <Link to="/admin/videos" className="dash-see-all">
              View all videos →
            </Link>
          </div>

          {/* Top Categories */}
          <div className="dash-card">
            <div className="dash-cardHead">
              <h3>Top Categories</h3>
              <span className="dash-muted dash-badge--sm">By video count</span>
            </div>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="dash-barRow"
                  style={{ marginBottom: 12 }}
                >
                  <Skeleton h={14} w={120} r={6} />
                  <Skeleton h={10} w="100%" r={999} />
                  <Skeleton h={14} w={28} r={6} />
                </div>
              ))
            ) : !videoMetrics.catsByCount.length ? (
              <div className="dash-muted">No categories found.</div>
            ) : (
              <div className="dash-bars">
                {videoMetrics.catsByCount.map((c) => (
                  <div key={c.id} className="dash-barRow">
                    <div className="dash-barLabel" title={c.name}>
                      {c.name}
                    </div>
                    <div className="dash-barTrack">
                      <div
                        className="dash-barFill"
                        style={{
                          width: `${Math.min(100, (c.count / maxCatCount) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="dash-barValue">{c.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Videos — full width */}
          <div className="dash-card dash-span2">
            <div className="dash-cardHead">
              <h3>Top Videos</h3>
              <span className="dash-muted dash-badge--sm">
                Views if available; otherwise newest
              </span>
            </div>
            {isLoading ? (
              <div className="dash-table">
                {["Title", "Status", "Views"].map((h) => (
                  <div key={h} className="dash-th">
                    {h}
                  </div>
                ))}
                {Array.from({ length: 6 }).map((_, i) => (
                  <React.Fragment key={i}>
                    <div className="dash-td">
                      <Skeleton h={14} w="80%" r={6} />
                    </div>
                    <div className="dash-td">
                      <Skeleton h={14} w={60} r={6} />
                    </div>
                    <div className="dash-td">
                      <Skeleton h={14} w={40} r={6} />
                    </div>
                  </React.Fragment>
                ))}
              </div>
            ) : !videoMetrics.topVideos.length ? (
              <div className="dash-muted">No videos found.</div>
            ) : (
              <div className="dash-table">
                <div className="dash-th">Title</div>
                <div className="dash-th">Status</div>
                <div className="dash-th">Views</div>
                {videoMetrics.topVideos.map((v) => (
                  <React.Fragment key={v.id}>
                    <div className="dash-td">
                      <Link
                        to={`/admin/videos/${v.id}`}
                        className="dash-video-link"
                      >
                        {v.title || v.name || "Untitled"}
                      </Link>
                    </div>
                    <div className="dash-td dash-muted">
                      <span
                        className={`dash-status dash-status--${String(v.visibility || v.status || "").toLowerCase()}`}
                      >
                        {String(v.visibility || v.status || "—")}
                      </span>
                    </div>
                    <div className="dash-td">
                      {Number(v.views || v.view_count || 0).toLocaleString()}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
            <Link to="/admin/videos" className="dash-see-all">
              View all videos →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
