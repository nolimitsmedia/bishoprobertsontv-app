// src/public/channel/ChannelVideos.jsx
import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../../../api";

export default function ChannelVideos() {
  const { slug } = useParams();
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      const r = await api.get(`/channels/${slug}/videos?limit=24`);
      setItems(r.data || []);
    })();
  }, [slug]);

  return (
    <div className="grid">
      {items.map((v) => (
        <Link key={v.id} to={`/studio/videos/${v.id}`} className="card">
          <img src={v.thumbnail_url} alt="" />
          <div className="meta">
            <div className="title">{v.title}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
