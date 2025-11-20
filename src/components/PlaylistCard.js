import React from "react";
import { Link } from "react-router-dom";

export default function PlaylistCard({ playlist }) {
  if (!playlist) return null;
  const href = `/playlists/${playlist.slug || playlist.id}`;

  return (
    <Link to={href} className="pl-card">
      <div className="pl-thumb">
        {playlist.thumbnail_url ? (
          <img src={playlist.thumbnail_url} alt={playlist.title} />
        ) : (
          <div className="pl-thumb-fallback">PLAYLIST</div>
        )}

        {/* Ribbon */}
        <div className="pl-ribbon">PLAYLIST</div>

        {/* Count badge */}
        <div className="pl-badge">
          <span className="pl-badge-icon">📺</span>
          <span>{playlist.video_count ?? playlist.item_count ?? 0}</span>
        </div>
      </div>

      <div className="pl-title">{playlist.title}</div>
      {playlist.description ? (
        <div className="pl-desc" title={playlist.description}>
          {playlist.description}
        </div>
      ) : null}
    </Link>
  );
}
