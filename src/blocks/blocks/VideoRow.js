import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import "../blocks.css";

function VCard({ v }) {
  return (
    <Link to={`/watch/${v.id}`} className="b-vcard">
      <div className="b-vthumb">
        {v.thumbnail_url ? (
          <img src={v.thumbnail_url} alt="" />
        ) : (
          <div className="ph" />
        )}
        {!v.is_premium && <span className="pill pill-free">Free</span>}
      </div>
      <div className="b-vtitle">{v.title}</div>
    </Link>
  );
}

/** mode: "latest" | "playlist"; when playlist, pass playlistSlugOrId */
export default function VideoRow({
  title = "Latest Videos",
  mode = "latest",
  playlistSlugOrId,
  limit = 12,
}) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (mode === "playlist" && playlistSlugOrId) {
          const r = await api.get(`/playlists/public/${playlistSlugOrId}`);
          const videos = Array.isArray(r.data?.videos) ? r.data.videos : [];
          if (alive) setItems(videos.slice(0, limit));
        } else {
          const r = await api.get(`/videos/public?limit=${limit}`);
          const videos = Array.isArray(r.data?.items)
            ? r.data.items
            : r.data || [];
          if (alive) setItems(videos);
        }
      } catch {
        if (alive) setItems([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode, playlistSlugOrId, limit]);

  return (
    <div className="wrap">
      <div className="b-center b-kicker">{title}</div>
      <div className="hscroll">
        <div className="hscroll-inner">
          {items.map((v) => (
            <VCard key={v.id} v={v} />
          ))}
        </div>
      </div>
    </div>
  );
}
