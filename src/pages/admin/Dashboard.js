// src/pages/admin/Dashboard.js
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import "./Dashboard.css";

/* ---------------- helpers ---------------- */
async function tryGetFirst(urls) {
  let lastErr;
  for (const u of urls) {
    try {
      const r = await api.get(u);
      return r.data;
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw lastErr || new Error("REQUEST_FAILED");
}

function pickArray(data, keys = []) {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }

  // common shapes: { items: [] }
  if (Array.isArray(data?.items)) return data.items;

  return [];
}

function toDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function withinDays(date, days) {
  const d = toDate(date);
  if (!d) return false;
  const now = new Date();
  const ms = days * 24 * 60 * 60 * 1000;
  return now.getTime() - d.getTime() <= ms;
}

function isPublishedVideo(v) {
  // Try to be compatible with different schemas
  const status = String(v?.status || v?.state || "").toLowerCase();
  const visibility = String(v?.visibility || v?.access || "").toLowerCase();
  const publishedAt = v?.published_at || v?.publishedAt;

  if (publishedAt) return true;
  if (visibility === "public") return true;
  if (status === "published") return true;

  // if status is "ready" AND visibility is public-ish, treat as published
  if (
    status === "ready" &&
    (visibility === "public" || visibility === "published")
  )
    return true;

  return false;
}

function safeText(s) {
  return String(s || "").trim();
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [users, setUsers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");

      try {
        // USERS
        const usersData = await tryGetFirst([
          "/admin/users",
          "/users/all",
          "/users",
          "/api/users",
        ]);
        const usersArr = pickArray(usersData, ["users", "data"]);
        if (!alive) return;
        setUsers(usersArr);

        // VIDEOS
        const videosData = await tryGetFirst([
          "/videos?limit=1000",
          "/videos",
          "/videos/admin?limit=1000",
          "/videos/public?limit=1000",
        ]);
        const videosArr = pickArray(videosData, ["videos", "data"]);
        if (!alive) return;
        setVideos(videosArr);

        // CATEGORIES
        const categoriesData = await tryGetFirst([
          "/categories",
          "/categories/all",
          "/api/categories",
        ]);
        const categoriesArr = pickArray(categoriesData, ["categories", "data"]);
        if (!alive) return;
        setCategories(categoriesArr);
      } catch (e) {
        if (!alive) return;
        setErr(
          e?.response?.data?.message ||
            e?.message ||
            "Failed to load dashboard data."
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* ---------------- metrics ---------------- */
  const metrics = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);

    // USERS
    const totalUsers = users.length;

    const newUsersToday = users.filter((u) => {
      const d = toDate(u?.created_at || u?.createdAt);
      return d && d >= todayStart;
    }).length;

    const newUsers7d = users.filter((u) =>
      withinDays(u?.created_at || u?.createdAt, 7)
    ).length;
    const newUsers30d = users.filter((u) =>
      withinDays(u?.created_at || u?.createdAt, 30)
    ).length;

    // VIDEOS
    const missingThumb = videos.filter(
      (v) => !safeText(v?.thumbnail_url || v?.thumbnailUrl)
    ).length;
    const missingCategory = videos.filter(
      (v) => !v?.category_id && !v?.categoryId
    ).length;

    const notPublished = videos.filter((v) => !isPublishedVideo(v)).length;

    const publishedVideos = videos
      .filter((v) => isPublishedVideo(v))
      .slice()
      .sort((a, b) => {
        const da = toDate(
          a?.published_at || a?.publishedAt || a?.created_at || a?.createdAt
        );
        const db = toDate(
          b?.published_at || b?.publishedAt || b?.created_at || b?.createdAt
        );
        return (db?.getTime() || 0) - (da?.getTime() || 0);
      });

    const recentPublished = publishedVideos.slice(0, 8);

    // Top categories by video count
    const catCount = new Map();
    for (const v of videos) {
      const cid = v?.category_id ?? v?.categoryId;
      if (!cid) continue;
      catCount.set(String(cid), (catCount.get(String(cid)) || 0) + 1);
    }

    const catsByCount = categories
      .map((c) => {
        const id = String(c?.id ?? c?.category_id ?? "");
        return {
          id,
          name: c?.name || c?.title || `Category ${id}`,
          count: catCount.get(id) || 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Top videos (Phase 1): if API has views/watch_time use it, else show newest
    const topVideos = videos
      .slice()
      .sort((a, b) => {
        const va = Number(a?.views || a?.view_count || 0);
        const vb = Number(b?.views || b?.view_count || 0);
        if (vb !== va) return vb - va;

        const da = toDate(a?.published_at || a?.created_at || a?.createdAt);
        const db = toDate(b?.published_at || b?.created_at || b?.createdAt);
        return (db?.getTime() || 0) - (da?.getTime() || 0);
      })
      .slice(0, 8);

    return {
      totalUsers,
      newUsersToday,
      newUsers7d,
      newUsers30d,
      missingThumb,
      missingCategory,
      notPublished,
      recentPublished,
      catsByCount,
      topVideos,
    };
  }, [users, videos, categories]);

  if (loading) {
    return (
      <div className="dash-page">
        <div className="dash-wrap">
          <div className="dash-hero">
            <h1>Dashboard</h1>
            <p>Loading…</p>
          </div>
          <div className="dash-card">Fetching data…</div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="dash-page">
        <div className="dash-wrap">
          <div className="dash-hero">
            <h1>Dashboard</h1>
            <p className="dash-muted">We couldn’t load the data.</p>
          </div>
          <div className="dash-card">
            <div className="dash-error">{err}</div>
            <div className="dash-muted" style={{ marginTop: 10 }}>
              Tip: make sure your API routes for users/videos/categories are
              accessible for admin.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-page">
      <div className="dash-wrap">
        <div className="dash-hero">
          <div>
            <h1>Admin Dashboard</h1>
            <p className="dash-muted">
              Users + Content overview (no subscriptions yet).
            </p>
          </div>

          <div className="dash-actions">
            <Link to="/admin/videos" className="dash-btn">
              Manage Videos
            </Link>
            <Link to="/admin/categories" className="dash-btn dash-btn--ghost">
              Manage Categories
            </Link>
          </div>
        </div>

        {/* Metric cards */}
        <div className="dash-grid">
          <div className="dash-card">
            <div className="dash-kicker">Users</div>
            <div className="dash-metric">{metrics.totalUsers}</div>
            <div className="dash-sub">Total registered users</div>
          </div>

          <div className="dash-card">
            <div className="dash-kicker">New Users</div>
            <div className="dash-row">
              <div className="dash-pill">
                <strong>{metrics.newUsersToday}</strong>
                <span>Today</span>
              </div>
              <div className="dash-pill">
                <strong>{metrics.newUsers7d}</strong>
                <span>7 days</span>
              </div>
              <div className="dash-pill">
                <strong>{metrics.newUsers30d}</strong>
                <span>30 days</span>
              </div>
            </div>
            <div className="dash-sub">Signups trend (based on created_at)</div>
          </div>

          <div className="dash-card">
            <div className="dash-kicker">Content Health</div>
            <div className="dash-row">
              <div className="dash-pill dash-pill--warn">
                <strong>{metrics.missingThumb}</strong>
                <span>Missing thumbnails</span>
              </div>
              <div className="dash-pill dash-pill--warn">
                <strong>{metrics.missingCategory}</strong>
                <span>Missing category</span>
              </div>
              <div className="dash-pill">
                <strong>{metrics.notPublished}</strong>
                <span>Not published</span>
              </div>
            </div>
            <div className="dash-sub">Quick cleanup list for admin</div>
          </div>
        </div>

        {/* Tables */}
        <div className="dash-split">
          <div className="dash-card">
            <div className="dash-cardHead">
              <h3>Recently Published</h3>
              <span className="dash-muted">
                Latest {metrics.recentPublished.length}
              </span>
            </div>

            {metrics.recentPublished.length === 0 ? (
              <div className="dash-muted">No published videos found.</div>
            ) : (
              <div className="dash-list">
                {metrics.recentPublished.map((v) => (
                  <div key={v.id} className="dash-item">
                    <div className="dash-itemTitle">
                      {v.title || v.name || "Untitled"}
                    </div>
                    <div className="dash-itemMeta">
                      {String(v.published_at || v.created_at || "").slice(
                        0,
                        10
                      ) || "—"}
                      <span className="dash-dot">•</span>
                      {String(v.visibility || v.status || "—")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="dash-card">
            <div className="dash-cardHead">
              <h3>Top Categories</h3>
              <span className="dash-muted">By video count</span>
            </div>

            {metrics.catsByCount.length === 0 ? (
              <div className="dash-muted">No categories found.</div>
            ) : (
              <div className="dash-bars">
                {metrics.catsByCount.map((c) => (
                  <div key={c.id} className="dash-barRow">
                    <div className="dash-barLabel">{c.name}</div>
                    <div className="dash-barTrack">
                      <div
                        className="dash-barFill"
                        style={{
                          width: `${Math.min(
                            100,
                            (c.count /
                              Math.max(1, metrics.catsByCount[0].count)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="dash-barValue">{c.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="dash-card dash-span2">
            <div className="dash-cardHead">
              <h3>Top Videos</h3>
              <span className="dash-muted">
                Views if available; otherwise newest
              </span>
            </div>

            {metrics.topVideos.length === 0 ? (
              <div className="dash-muted">No videos found.</div>
            ) : (
              <div className="dash-table">
                <div className="dash-th">Title</div>
                <div className="dash-th">Status</div>
                <div className="dash-th">Views</div>

                {metrics.topVideos.map((v) => (
                  <React.Fragment key={v.id}>
                    <div className="dash-td">
                      {v.title || v.name || "Untitled"}
                    </div>
                    <div className="dash-td dash-muted">
                      {String(v.visibility || v.status || "—")}
                    </div>
                    <div className="dash-td">
                      {Number(v.views || v.view_count || 0)}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
