import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import PlaylistCard from "./PlaylistCard";

export default function CatalogRow({
  title,
  playlistId,
  playlistSlug,
  videos,
}) {
  const [playlist, setPlaylist] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        if (playlistId || playlistSlug) {
          const idOrSlug = playlistSlug || playlistId;
          const { data } = await api.get(`/playlists/public/${idOrSlug}`);
          if (isMounted) setPlaylist(data);
        } else {
          setPlaylist(null);
        }
      } catch {
        setPlaylist(null);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [playlistId, playlistSlug]);

  return (
    <section className="row">
      <div className="row-header">
        <h2>{title}</h2>
        <Link
          className="row-seeall"
          to={`/browse?section=${encodeURIComponent(title)}`}
        >
          See All
        </Link>
      </div>

      <div className="row-grid">
        {playlist ? <PlaylistCard playlist={playlist} /> : null}

        {videos.map((v) => (
          <Link
            key={v.id}
            to={`/programs/${v.slug || `${v.title}-${v.id}`}`}
            className="video-card"
          >
            <div className="video-thumb">
              <img src={v.thumbnail_url} alt={v.title} />
              {v.duration_seconds ? (
                <span className="video-duration">
                  {fmtDur(v.duration_seconds)}
                </span>
              ) : null}
            </div>
            <div className="video-title">{v.title}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function fmtDur(sec) {
  const s = Math.max(0, sec | 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${m}:${String(ss).padStart(2, "0")}`;
}
