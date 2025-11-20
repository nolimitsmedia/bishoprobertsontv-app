import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";

export default function LiveEvents() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/live/events");
      setItems(data?.items || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>Live Events</h2>
        <Link to="/account/live/new" className="btn">
          Create Event
        </Link>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 16 }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 16 }}>No events yet.</div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {items.map((e) => (
              <li
                key={e.id}
                style={{ padding: 12, borderTop: "1px solid var(--line)" }}
              >
                <div style={{ fontWeight: 700 }}>{e.title}</div>
                <div style={{ color: "var(--muted)", fontSize: 14 }}>
                  Status: {e.status} · Ingest: {e.rtmp_ingest} · Key:{" "}
                  <code>{e.stream_key}</code>
                </div>
                {e.hls_url && (
                  <div style={{ marginTop: 6 }}>
                    Playback:{" "}
                    <a href={`/watch/live/${e.id}`}>/watch/live/{e.id}</a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
