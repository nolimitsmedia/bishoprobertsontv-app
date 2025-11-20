// src/pages/public/channel/AllVideos.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";

/* ---------- utils ---------- */
const API_ORIGIN = (() => {
  try {
    const u = new URL(api.defaults.baseURL || "", window.location.href);
    return u.origin || window.location.origin;
  } catch {
    return window.location.origin;
  }
})();
function absUrl(url) {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith("//")) return window.location.protocol + url;
  if (url.startsWith("/")) return API_ORIGIN + url;
  return API_ORIGIN + "/" + url.replace(/^\.\//, "");
}
function thumbFallbackSVG(title = "Video") {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0b1320"/>
        <stop offset="100%" stop-color="#1b2436"/>
      </linearGradient>
    </defs>
    <rect width="640" height="360" rx="18" fill="url(#g)"/>
    <circle cx="320" cy="180" r="56" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" />
    <polygon points="300,155 350,180 300,205" fill="#ffffff"/>
    <text x="320" y="330" font-size="22" text-anchor="middle" fill="#b6bfcc" font-family="Inter,Arial,sans-serif">
      ${(title || "Video").slice(0, 40).replace(/&/g, "&amp;")}
    </text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

/* ---------- page ---------- */
export default function AllVideos() {
  const nav = useNavigate();

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [onlyFree, setOnlyFree] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // Prefer a public endpoint if your API exposes it
        const tryPublic = await api
          .get("/public/videos", { params: { limit: 200 } })
          .then((r) => r.data)
          .catch(() => null);

        let items;
        if (tryPublic && Array.isArray(tryPublic.items)) {
          items = tryPublic.items;
        } else {
          // Fallback: use /videos and filter client-side (works if your API allows it without auth)
          const r = await api.get("/videos", { params: { limit: 200 } });
          items = r.data?.items || [];
        }

        // Normalize + keep only public (and optionally free) items
        const normalized = (items || []).filter((v) => {
          const isPublic = (v.visibility || "").toLowerCase() === "public";
          return isPublic;
        });

        if (alive) setVideos(normalized);
      } catch (e) {
        console.error("AllVideos load error:", e);
        if (alive) setErr("Failed to load videos.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return videos
      .filter((v) => (onlyFree ? !v.is_premium : true))
      .filter(
        (v) =>
          !text ||
          (v.title || "").toLowerCase().includes(text) ||
          (v.description || "").toLowerCase().includes(text)
      )
      .sort(
        (a, b) =>
          new Date(b.created_at || b.created || 0) -
          new Date(a.created_at || a.created || 0)
      );
  }, [videos, q, onlyFree]);

  return (
    <div className="av-wrap">
      <style>{`
        .av-wrap { max-width: 1200px; margin: 0 auto; padding: 16px; }
        .av-top { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; margin-bottom: 10px; }
        .av-title { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -.01em; }
        .av-toolbar {
          display: grid; gap: 10px;
          grid-template-columns: 1fr auto;
        }
        .av-search {
          position: relative;
        }
        .av-search input {
          width: 100%;
          padding: 12px 14px 12px 40px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          outline: none;
          transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
        }
        .av-search input:focus {
          border-color: #93c5fd;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(147,197,253,.35);
        }
        .av-search .icon {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          opacity: .6;
        }
        .av-chip {
          display: inline-flex; align-items: center; gap: 8px;
          background: #f1f5f9; border: 1px solid #e2e8f0; color: #0f172a;
          padding: 10px 14px; border-radius: 12px; font-weight: 700; white-space: nowrap;
        }
        .av-chip input { margin-right: 6px; }

        .av-grid {
          margin-top: 12px;
          display: grid; gap: 14px;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        }
        .av-card {
          border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; background: #fff;
          display: flex; flex-direction: column;
          transition: transform .07s ease, box-shadow .15s ease;
        }
        .av-card:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(15,23,42,.08); }
        .av-thumb { aspect-ratio: 16/9; background: #0b1320; display: block; width: 100%; object-fit: cover; }
        .av-body { padding: 12px; display: grid; gap: 6px; }
        .av-h {
          margin: 0; font-weight: 800; font-size: 16px; letter-spacing: -.01em;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .av-meta { display: flex; gap: 8px; align-items: center; font-size: 12px; color:#64748b; }
        .av-badges { display: flex; gap: 6px; flex-wrap: wrap; }
        .badge {
          border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 800; letter-spacing: .03em;
          border: 1px solid #e2e8f0; background:#f8fafc; color:#334155;
        }
        .badge.free { background:#ecfdf5; border-color:#a7f3d0; color:#065f46; }
        .badge.lock { background:#fef2f2; border-color:#fecaca; color:#7f1d1d; }
        .av-actions { display:flex; gap:8px; margin-top:6px; }
        .av-watch {
          display:inline-flex; align-items:center; justify-content:center; gap:8px;
          border:1px solid #0b66ff; background:#0b66ff; color:#fff; padding:8px 12px; border-radius:10px;
          font-weight:800; text-decoration:none; transition: background .15s ease, box-shadow .15s ease;
        }
        .av-watch:hover { background:#0958db; box-shadow:0 4px 14px rgba(9,88,219,.25); }
        .muted { color:#94a3b8; }
      `}</style>

      <div className="av-top">
        <h1 className="av-title">All Videos</h1>
      </div>

      <div className="av-toolbar">
        <div className="av-search">
          <svg
            className="icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <input
            placeholder="Search videos…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <label className="av-chip">
          <input
            type="checkbox"
            checked={onlyFree}
            onChange={(e) => setOnlyFree(e.target.checked)}
          />
          Show only free videos
        </label>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          Loading…
        </div>
      ) : err ? (
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          {err}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <span className="muted">No videos found.</span>
        </div>
      ) : (
        <div className="av-grid">
          {filtered.map((v) => {
            const title = v.title || "Untitled";
            const img = absUrl(v.thumbnail_url || "");
            const fallback = thumbFallbackSVG(title);
            const free = !v.is_premium;
            const dt = v.created_at || v.created;
            return (
              <div className="av-card" key={v.id}>
                <Link to={`/watch/${v.id}`} aria-label={`Watch ${title}`}>
                  {img ? (
                    <img
                      className="av-thumb"
                      src={img}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = fallback;
                      }}
                    />
                  ) : (
                    <img className="av-thumb" src={fallback} alt="" />
                  )}
                </Link>
                <div className="av-body">
                  <h3 className="av-h" title={title}>
                    {title}
                  </h3>
                  <div className="av-meta">
                    <span>
                      {new Date(dt || Date.now()).toLocaleDateString()}
                    </span>
                    <div className="av-badges">
                      <span className={`badge ${free ? "free" : "lock"}`}>
                        {free ? "FREE" : "SUBSCRIBERS"}
                      </span>
                      <span className="badge">PUBLIC</span>
                    </div>
                  </div>
                  <div className="av-actions">
                    <Link className="av-watch" to={`/watch/${v.id}`}>
                      Watch
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
