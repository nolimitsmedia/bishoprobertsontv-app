// src/components/cards/PlaylistCard.jsx
import React from "react";
import { Link } from "react-router-dom";
import api from "../../api";

function absUrl(u) {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const base = (api?.defaults?.baseURL || "").replace(/\/api\/?$/i, "");
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}

export default function PlaylistCard({ p }) {
  const href = `/playlist/${p.id}`;
  const thumb =
    p.thumbnail_url ||
    p.cover_url ||
    p.image ||
    p.metadata?.thumbnail_url ||
    p.metadata?.image;

  // A bunch of possible count fields – first non-null wins
  const count =
    p.items_count ??
    p.videos_count ??
    p.video_count ??
    (Array.isArray(p.items) ? p.items.length : null);

  return (
    <Link to={href} className="pl-card theme--dark">
      <div className="pl-thumb">
        {thumb ? (
          <img src={absUrl(thumb)} alt="" />
        ) : (
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              background: "#1f2937",
            }}
          />
        )}

        {Number.isFinite(count) && (
          <div className="pl-count">
            {count} {count === 1 ? "video" : "videos"}
          </div>
        )}
      </div>

      <div className="pl-title">{p.title || "Untitled Playlist"}</div>
    </Link>
  );
}
