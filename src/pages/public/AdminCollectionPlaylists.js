// src/pages/public/AdminCollectionPlaylists.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api";
import DefaultThumb from "../../assets/BishopRobertsonTVLogo.png";
import "./AdminCollectionPlaylists.css";
import "./Catalog.css"; // reuse your existing catalog card/grid styles

/* -----------------------------------------
   Utilities (keep consistent with Catalog/VideoView patterns)
----------------------------------------- */
function apiOrigin() {
  try {
    const u = new URL(api.defaults.baseURL || "", window.location.href);
    return u.origin;
  } catch {
    return window.location.origin;
  }
}

function absUrl(u) {
  // ✅ return null (not "") so we never produce <img src="">
  if (!u) return null;
  if (/^(https?:|blob:|data:)/i.test(u)) return u;
  const base = apiOrigin();
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}

async function tryGetFirst(urls) {
  for (const u of urls) {
    try {
      const r = await api.get(u);
      return r.data;
    } catch (e) {
      const code = e?.response?.status;
      if ([401, 403, 404].includes(code)) continue;
      continue;
    }
  }
  return null;
}

/* -----------------------------------------
   Publish-aware date helpers
   - Uses published_at first, then created_at
   - Supports alternate shapes + metadata
----------------------------------------- */
function getPublishOrCreateMs(x) {
  const raw =
    x?.published_at ??
    x?.publishedAt ??
    x?.metadata?.published_at ??
    x?.metadata?.publishedAt ??
    x?.created_at ??
    x?.createdAt ??
    x?.metadata?.created_at ??
    x?.metadata?.createdAt ??
    null;

  const d = raw ? new Date(raw) : null;
  const ms = d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
  return ms;
}

/* -----------------------------------------
   Sorting for playlist videos
   - If any position exists => respect positions first
   - Otherwise => newest first by published_at (fallback created_at)
----------------------------------------- */
function sortPlaylistVideos(rawList) {
  const list = Array.isArray(rawList) ? [...rawList] : [];

  // Detect if playlist has explicit ordering
  const hasPosition = list.some((v) => {
    const p = v?.position ?? v?.sort_index ?? v?.sortIndex ?? null;
    return p !== null && p !== undefined && p !== "" && Number.isFinite(+p);
  });

  if (hasPosition) {
    return list.sort((a, b) => {
      const pa = Number.isFinite(+a.position)
        ? +a.position
        : Number.isFinite(+a.sort_index)
          ? +a.sort_index
          : Number.isFinite(+a.sortIndex)
            ? +a.sortIndex
            : 1e9;

      const pb = Number.isFinite(+b.position)
        ? +b.position
        : Number.isFinite(+b.sort_index)
          ? +b.sort_index
          : Number.isFinite(+b.sortIndex)
            ? +b.sortIndex
            : 1e9;

      if (pa !== pb) return pa - pb;

      // ✅ tie-breaker: newest first by publish date (fallback created)
      const da = getPublishOrCreateMs(a);
      const db = getPublishOrCreateMs(b);
      if (db !== da) return db - da;

      // final tie-breaker to keep stable-ish ordering
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
  }

  // No explicit playlist positions => publish date ordering
  return list.sort((a, b) => {
    const da = getPublishOrCreateMs(a);
    const db = getPublishOrCreateMs(b);
    if (db !== da) return db - da;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

function VideoCard({ v, playlistId }) {
  const href = `/watch/${v.id}?playlist=${encodeURIComponent(String(playlistId))}`;

  const thumb =
    v.thumbnail_url ||
    v.metadata?.thumbnail_vertical_url ||
    v.metadata?.thumbnail_url;

  const title = v.title || "Untitled";

  const realSrc = absUrl(thumb);
  const src = realSrc || DefaultThumb;
  const isDefault = !realSrc;

  return (
    <Link to={href} className="nf-card">
      <div className="nf-thumb">
        <img
          src={src}
          alt={title}
          className={
            isDefault ? "nf-thumb-img nf-thumb-img--default" : "nf-thumb-img"
          }
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = DefaultThumb;
            e.currentTarget.className = "nf-thumb-img nf-thumb-img--default";
          }}
        />
        <div className="nf-overlay" />
        <div className="nf-play-btn">▶</div>
      </div>
      <div className="nf-title">{title}</div>
    </Link>
  );
}

export default function AdminCollectionPlaylists() {
  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [playlist, setPlaylist] = useState(null);
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");
      setPlaylist(null);
      setVideos([]);

      try {
        // Public-first, authed fallback
        const data = await tryGetFirst([
          `/playlists/public/${id}`,
          `/playlists/${id}`,
        ]);

        if (!alive) return;

        if (!data) {
          setErr("Collection playlist not found.");
          return;
        }

        const pl = {
          id: data.id,
          title: data.title || "Collection",
          description: data.description || "",
          thumbnail_url: data.thumbnail_url || "",
        };

        const raw = Array.isArray(data.videos)
          ? data.videos
          : Array.isArray(data.items)
            ? data.items
            : [];

        // ✅ UPDATED: sort by publish date (fallback created), but respect explicit playlist order when present
        const ordered = sortPlaylistVideos(raw);

        setPlaylist(pl);
        setVideos(ordered);
      } catch (e) {
        if (!alive) return;
        setErr("Failed to load collection playlist.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  // Banner: use playlist thumbnail if present, otherwise default
  const banner = useMemo(() => {
    const u = playlist?.thumbnail_url;
    const real = absUrl(u);
    return real || DefaultThumb;
  }, [playlist?.thumbnail_url]);

  const bannerIsDefault = useMemo(() => {
    const u = playlist?.thumbnail_url;
    return !absUrl(u);
  }, [playlist?.thumbnail_url]);

  if (loading) {
    return (
      <div className="acp-page theme--dark">
        <div className="card card--dark">Loading collection…</div>
      </div>
    );
  }

  if (err || !playlist) {
    return (
      <div className="acp-page theme--dark">
        <div className="card card--dark">
          <div style={{ marginBottom: 10 }}>{err || "Not found."}</div>
          <button className="back-btn" onClick={() => nav("/catalog")}>
            Back to Catalog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="acp-page theme--dark">
      <div className="acp-top">
        <div className="acp-actions">
          <button className="back-btn" onClick={() => nav(-1)}>
            ← Back
          </button>
          <Link
            className="btn--purple"
            to="/catalog"
            style={{ textDecoration: "none" }}
          >
            Catalog
          </Link>
        </div>

        <div className="acp-hero">
          <div
            className={
              bannerIsDefault
                ? "acp-heroImg acp-heroImg--default"
                : "acp-heroImg"
            }
          >
            <img
              src={banner}
              alt={playlist.title}
              className={
                bannerIsDefault
                  ? "nf-thumb-img nf-thumb-img--default"
                  : "nf-thumb-img"
              }
            />
          </div>

          <div className="acp-heroInfo">
            <h1 className="acp-title">{playlist.title}</h1>

            {!!playlist.description && (
              <div className="acp-desc">{playlist.description}</div>
            )}

            <div className="acp-meta">
              <span className="acp-badge">PLAYLIST</span>
              <span className="acp-muted">{videos.length} videos</span>
              <span className="acp-muted">•</span>
              <span className="acp-muted">
                Full playback follows your existing login/preview rules.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="acp-section">
        <h2 className="section-title">Videos</h2>

        {videos.length === 0 ? (
          <div className="empty">No videos in this playlist yet.</div>
        ) : (
          <div className="nf-grid">
            {videos.map((v) => (
              <VideoCard key={v.id} v={v} playlistId={playlist.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
