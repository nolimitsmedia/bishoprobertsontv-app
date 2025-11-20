// src/public/channel/ChannelLive.jsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../../../api";

export default function ChannelLive() {
  const { slug } = useParams();
  const [stream, setStream] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await api.get(`/channels/${slug}/stream`);
      setStream(r.data);
    })();
  }, [slug]);

  if (!stream) return <div style={{ padding: 24 }}>Loading…</div>;
  if (stream.status !== "live")
    return <div style={{ padding: 24 }}>Currently offline.</div>;

  return (
    <div className="live-player">
      {/* If you have an HLS URL, plug into your player; or use an iframe embed: */}
      <iframe
        title="Live Stream"
        src={stream.playback_url}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        style={{ width: "100%", height: "60vh", border: 0, borderRadius: 12 }}
      />
    </div>
  );
}
