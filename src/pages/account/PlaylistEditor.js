// src/pages/account/PlaylistEditor.js
import React, { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../../api";
import "./PlaylistEditor.css";

/** Reorder playlist videos by ID */
async function putReorder(playlistId, order) {
  // Backend route: PUT /playlists/:id/reorder  { video_ids: [...] }
  return api.put(`/playlists/${playlistId}/reorder`, {
    video_ids: order,
  });
}

/** Load playlist detail, preferring owner route but falling back to public. */
async function getDetail(idOrSlug) {
  const attempts = [
    () => api.get(`/playlists/${idOrSlug}`),
    () => api.get(`/playlists/public/${idOrSlug}`),
  ];
  for (const fn of attempts) {
    try {
      const r = await fn();
      const p = r.data?.playlist ?? r.data;
      if (p && Array.isArray(p.videos)) return p;
    } catch (e) {
      // ignore and try next
    }
  }
  throw new Error("Unable to load playlist");
}

export default function PlaylistEditor() {
  const { idOrSlug } = useParams();
  const nav = useNavigate();

  const [pl, setPl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const dragIndex = useRef(null);

  // simple toast { type: 'success' | 'error', message: string }
  const [toast, setToast] = useState(null);

  // auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // initial load
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const detail = await getDetail(idOrSlug);
        if (!alive) return;
        setPl(detail);
      } catch (e) {
        if (!alive) return;
        setErr(
          e?.response?.data?.message || e.message || "Failed to load playlist"
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [idOrSlug]);

  /* ---------- drag + drop ---------- */
  function onDragStart(e, index) {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e) {
    e.preventDefault();
  }

  function onDrop(e, index) {
    e.preventDefault();
    const from = dragIndex.current;
    const to = index;
    if (from == null || to == null || from === to) return;

    setPl((prev) => {
      if (!prev) return prev;
      const list = [...(prev.videos || [])];
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return { ...prev, videos: list };
    });
  }

  /* ---------- save order ---------- */
  async function saveOrder() {
    if (!pl?.id || !Array.isArray(pl?.videos)) return;
    setSaving(true);
    setErr("");
    try {
      const order = pl.videos.map((v) => v.id);
      await putReorder(pl.id, order);
      setToast({ type: "success", message: "Playlist order updated." });
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Failed to reorder playlist";
      setErr(msg);
      setToast({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  }

  async function removeVideo(videoId) {
    if (!window.confirm("Remove this video from the playlist?")) return;
    try {
      await api.delete(`/playlists/${pl.id}/videos/${videoId}`);
      setPl((prev) => ({
        ...prev,
        videos: (prev.videos || []).filter((v) => v.id !== videoId),
      }));
      setToast({ type: "success", message: "Video removed from playlist." });
    } catch (e) {
      const msg =
        e?.response?.data?.message || e?.message || "Failed to remove video.";
      setToast({ type: "error", message: msg });
    }
  }

  if (loading) {
    return <div className="ple-state">Loading playlist…</div>;
  }

  if (!pl) {
    return <div className="ple-state ple-error">Playlist not found.</div>;
  }

  const hasVideos = Array.isArray(pl.videos) && pl.videos.length > 0;

  return (
    <div className="ple-page">
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            right: 16,
            padding: "10px 14px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
            color: "#fff",
            background:
              toast.type === "success"
                ? "rgba(34,197,94,0.95)"
                : "rgba(239,68,68,0.95)",
            boxShadow: "0 10px 25px rgba(15,23,42,0.45)",
            zIndex: 9999,
          }}
        >
          {toast.message}
        </div>
      )}

      <div className="ple-header">
        <div>
          <div className="ple-kicker">ACCOUNT</div>
          <h1 className="ple-title">Edit Playlist</h1>
          <div className="ple-subtitle">
            <span className="ple-name">{pl.title}</span>
            <span className="ple-dot">•</span>
            Drag videos to reorder, then save.
          </div>
        </div>

        <div className="ple-header-actions">
          <Link
            to={`/playlists/${pl.slug || pl.id}`}
            className="ple-btn ple-btn-ghost"
          >
            Open public page
          </Link>
          <button onClick={() => nav(-1)} className="ple-btn ple-btn-ghost">
            Back
          </button>
        </div>
      </div>

      {/* inline error banner, but don’t destroy the whole UI */}
      {err && <div className="ple-banner ple-banner-error">{err}</div>}

      {!hasVideos ? (
        <div className="ple-empty">
          No videos yet. Go to any video and use <b>Add to playlist</b>.
        </div>
      ) : (
        <>
          <div className="ple-hint">
            Tip: drag a row to move it up/down. Changes aren’t saved until you
            click <b>Save order</b>.
          </div>

          <ul className="ple-list">
            {pl.videos.map((v, i) => (
              <li
                key={v.id}
                draggable
                onDragStart={(e) => onDragStart(e, i)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, i)}
                className="ple-row"
              >
                <div className="ple-drag" aria-hidden="true">
                  ⋮⋮
                </div>

                <img
                  src={
                    v.thumb_url ||
                    v.thumbnail ||
                    v.poster ||
                    "/placeholder-thumb.jpg"
                  }
                  alt=""
                  className="ple-thumb"
                  loading="lazy"
                />

                <div className="ple-info">
                  <div className="ple-video-title">
                    {v.title || v.name || `Video ${v.id}`}
                  </div>
                  <div className="ple-meta">
                    {v.duration_label || v.duration || ""}
                    {v.is_free ? <span className="ple-pill">Free</span> : null}
                  </div>
                </div>

                <div className="ple-actions">
                  <Link
                    to={`/watch/${v.slug || v.id}`}
                    className="ple-btn ple-btn-ghost"
                  >
                    View
                  </Link>
                  <button
                    type="button"
                    className="ple-btn ple-btn-danger"
                    onClick={() => removeVideo(v.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="ple-footer">
            <button
              type="button"
              onClick={saveOrder}
              disabled={saving}
              className="ple-btn ple-btn-primary"
            >
              {saving ? "Saving…" : "Save order"}
            </button>

            <Link
              to={`/playlists/${pl.slug || pl.id}`}
              className="ple-btn ple-btn-ghost"
            >
              Open public page
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
