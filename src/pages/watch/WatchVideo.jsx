// src/pages/watch/WatchVideo.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api";
import TeaserGatePlayer from "../../components/TeaserGatePlayer";

function fmtDate(d) {
  if (!d) return null;
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return x.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function WatchVideo() {
  const { id } = useParams();
  const [me, setMe] = useState(null);
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const [meRes, vRes] = await Promise.all([
          api.get("/auth/me").catch(() => ({ data: null })),
          api.get(`/videos/${id}`),
        ]);
        if (cancelled) return;
        setMe(meRes?.data || null);
        setVideo(vRes?.data || null);
      } catch (e) {
        if (cancelled) return;
        setErr(e?.response?.data?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const teaserSeconds = useMemo(
    () => Number(video?.metadata?.teaser_seconds ?? 300) || 300,
    [video]
  );
  const isLoggedIn = !!me?.id;
  const isGated = !!video?.is_premium;

  if (loading) return <div className="card">Loading…</div>;
  if (err) return <div className="card">Error: {err}</div>;
  if (!video) return <div className="card">Not found</div>;

  const createdAt = fmtDate(video.created_at || video.created);
  const authors = Array.isArray(video?.metadata?.authors)
    ? video.metadata.authors
    : Array.isArray(video?.authors)
    ? video.authors
    : [];
  const resources = Array.isArray(video?.metadata?.resources)
    ? video.metadata.resources
    : Array.isArray(video?.resources)
    ? video.resources
    : [];
  const tags = Array.isArray(video?.metadata?.tags)
    ? video.metadata.tags
    : Array.isArray(video?.tags)
    ? video.tags
    : [];
  const categoryId = video?.category_id;
  const visibility =
    (video?.visibility || "").toLowerCase() ||
    (video?.is_premium ? "private" : "public");

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {categoryId && (
            <Link to={`/category/${categoryId}`} className="vd-link">
              ← Back to category
            </Link>
          )}
          <span className="badge" style={{ background: "#111", color: "#9ad" }}>
            {visibility === "public"
              ? "Public"
              : visibility === "unlisted"
              ? "Unlisted"
              : "Gated"}
          </span>
          {isGated && !isLoggedIn && (
            <span className="badge badge-green">Preview: {teaserSeconds}s</span>
          )}
        </div>

        <h2 style={{ margin: "10px 0 6px" }}>{video.title}</h2>
        {createdAt && (
          <div className="vd-muted" style={{ marginBottom: 8 }}>
            {createdAt}
          </div>
        )}
        {!!authors.length && (
          <div className="vd-token-wrap" style={{ marginBottom: 8 }}>
            {authors.map((a, i) => (
              <span key={`author-${i}-${a}`} className="badge badge-green">
                {a}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Player + preview banner */}
      {isGated && !isLoggedIn && (
        <div
          className="vd-muted"
          style={{
            marginBottom: 8,
            padding: "8px 12px",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 8,
          }}
        >
          You’re watching a preview. Log in to continue after {teaserSeconds}{" "}
          seconds.
        </div>
      )}

      <TeaserGatePlayer
        url={video.video_url}
        title={video.title}
        isLoggedIn={isLoggedIn}
        isGated={isGated}
        teaserSeconds={teaserSeconds}
        onRequireLogin={() => {}}
      />

      {/* Description */}
      {video.description && (
        <div style={{ marginTop: 16, opacity: 0.9, lineHeight: 1.6 }}>
          {video.description}
        </div>
      )}

      {/* Resources */}
      {!!resources.length && (
        <div style={{ marginTop: 20 }}>
          <h3 className="vd-h" style={{ marginTop: 0 }}>
            Resources
          </h3>
          <ul className="vd-list">
            {resources.map((r, i) => (
              <li
                key={`res-${i}-${r.title || r.url || i}`}
                className="vd-list-row"
              >
                {r.title ? <b>{r.title}</b> : <b>Link</b>}
                <a
                  className="vd-link"
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ marginLeft: 10 }}
                >
                  {r.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tags */}
      {!!tags.length && (
        <div style={{ marginTop: 16 }}>
          <div className="vd-token-wrap">
            {tags.map((t, i) => (
              <span key={`tag-${i}-${t}`} className="badge">
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
