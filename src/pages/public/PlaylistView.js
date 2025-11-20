// src/pages/public/PlaylistView.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import api from "../../api";
import "./PlaylistView.css";

/* ---------------- helpers ---------------- */
function apiOrigin() {
  try {
    const u = new URL(api?.defaults?.baseURL || "", window.location.href);
    return u.origin;
  } catch {
    return window.location.origin;
  }
}
function absUrl(u) {
  if (!u) return "";
  if (/^(https?:|blob:|data:)/i.test(u)) return u;
  const base = apiOrigin();
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}
function secsFromAny(v) {
  if (v == null) return null;
  if (typeof v === "number" || /^\d+(\.\d+)?$/.test(String(v))) {
    const n = Number(v);
    return n > 36000 ? Math.round(n / 1000) : Math.round(n);
  }
  const s = String(v).trim();
  if (/^\d+:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }
  return null;
}
function fmtDuration(secs) {
  const s = Math.max(0, Number(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const two = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(ss)}` : `${m}:${two(ss)}`;
}
function pickVideoDesc(v = {}) {
  return (
    v.short_description || v.description || v?.metadata?.seo_description || ""
  );
}

/** Public-first: try public detail (with videos), then private (owner) only on 404. */
async function getPlaylistDetail(idOrSlug) {
  // 1) public route first (prevents 403 console noise for non-owners)
  try {
    const rPub = await api.get(`/playlists/public/${idOrSlug}`);
    return rPub.data;
  } catch (e) {
    const code = e?.response?.status;
    if (code !== 404) {
      // if it's 401/403/500 etc on public, just surface it
      throw e;
    }
  }

  // 2) fallback to owner/private route only if we have a token
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");
  if (!token) throw new Error("Playlist not found");

  try {
    if (!api.defaults.headers.common.Authorization) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
    const r = await api.get(`/playlists/${idOrSlug}`);
    return r.data;
  } catch (e) {
    // swallow auth-ish codes and present a clean "not found"
    const code = e?.response?.status;
    if ([401, 403, 404].includes(code)) {
      throw new Error("Playlist not found");
    }
    throw e;
  }
}

export default function PlaylistView() {
  const { id } = useParams(); // id or slug
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState(null);
  const [error, setError] = useState("");
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getPlaylistDetail(id);
        if (!alive) return;

        // sort by explicit position (if present), then created_at
        const ordered = (data?.videos || []).slice().sort((a, b) => {
          const pa = Number.isFinite(+a.position) ? +a.position : 1e9;
          const pb = Number.isFinite(+b.position) ? +b.position : 1e9;
          if (pa !== pb) return pa - pb;
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        });

        setPlaylist({ ...data, videos: ordered });
      } catch (e) {
        if (!alive) return;
        setPlaylist(null);
        setError("Playlist not found.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const items = useMemo(() => playlist?.videos || [], [playlist?.videos]);
  const firstVideoId = items[0]?.id;
  const playlistKey = playlist?.slug || playlist?.id;
  const itemCount = useMemo(
    () => (Array.isArray(items) ? items.length : playlist?.item_count || 0),
    [items, playlist?.item_count]
  );

  const doShare = async () => {
    const url = window.location.origin + location.pathname;
    try {
      if (navigator.share) {
        await navigator.share({ title: playlist?.title || "Playlist", url });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Link copied to clipboard");
      }
    } catch {
      /* ignore */
    }
  };

  if (loading) return <div className="card card--dark">Loading playlist…</div>;
  if (error || !playlist)
    return (
      <div className="card card--dark">{error || "Playlist not found."}</div>
    );

  const longDesc = String(playlist.description || "");
  const SHOULD_COLLAPSE = longDesc.length > 280;

  return (
    <div className="catalog-page theme--dark pv-page">
      <section className="pv-hero theme--dark">
        <div className="pv-wrap">
          <div className="pv-left">
            <div className="pv-kicker">Collection</div>
            <h1 className="pv-title">{playlist.title}</h1>

            {!!longDesc && (
              <>
                <p
                  className={`pv-desc ${
                    !showFull && SHOULD_COLLAPSE ? "is-clamped" : ""
                  }`}
                >
                  {longDesc}
                </p>
                {SHOULD_COLLAPSE && (
                  <button
                    type="button"
                    className="pv-more"
                    onClick={() => setShowFull((s) => !s)}
                  >
                    {showFull ? "Show less" : "Show more"}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="pv-actions">
            {firstVideoId ? (
              <Link
                to={`/watch/${firstVideoId}?playlist=${encodeURIComponent(
                  String(playlistKey)
                )}`}
                className="btn btn--purple"
              >
                Start watching
              </Link>
            ) : (
              <button className="btn btn--purple" disabled>
                Start watching
              </button>
            )}
            <button className="btn btn--ghost" onClick={doShare}>
              Share
            </button>
          </div>
        </div>
      </section>

      <div className="card--dark">
        <div className="pv-section-head">
          <h3 className="pv-section-title">Videos</h3>
          <span className="pv-count">{itemCount}</span>
        </div>

        {items.length === 0 ? (
          <div className="empty" style={{ padding: "12px 16px" }}>
            No videos in this playlist yet.
          </div>
        ) : (
          <div className="cat-row">
            <div className="cat-row__scroller">
              {items.map((v) => {
                const dur =
                  secsFromAny(
                    v.duration_seconds ??
                      v.duration_sec ??
                      v.duration ??
                      v?.metadata?.duration
                  ) ?? null;
                const desc = pickVideoDesc(v);

                return (
                  <Link
                    key={v.id}
                    className="vd-card theme--dark"
                    to={`/watch/${v.id}?playlist=${encodeURIComponent(
                      String(playlistKey)
                    )}`}
                  >
                    <div className="vd-thumb">
                      {v.thumbnail_url ? (
                        <img src={absUrl(v.thumbnail_url)} alt="" />
                      ) : (
                        <div className="vd-thumb__placeholder">No Image</div>
                      )}
                      {dur != null && (
                        <div className="vd-pill vd-pill--dur">
                          {fmtDuration(dur)}
                        </div>
                      )}
                      {!v.is_premium && (
                        <div className="vd-pill vd-pill--free">Free</div>
                      )}
                    </div>
                    <div className="vd-title">{v.title}</div>
                    {desc && <div className="vd-desc">{desc}</div>}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .pv-desc.is-clamped {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          max-height: 4.5em;
        }
        .pv-more {
          background: none;
          border: 0;
          color: #9ab4ff;
          font-weight: 600;
          padding: 0;
          cursor: pointer;
          margin-top: -8px;
        }
        .pv-more:hover { text-decoration: underline; }
        .vd-desc {
          margin-top: 6px;
          font-size: 12px;
          line-height: 1.35;
          color: #c7d2fe;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 2.7em;
        }
      `}</style>
    </div>
  );
}
