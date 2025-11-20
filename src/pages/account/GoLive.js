import React, { useState } from "react";
import api from "../../api";

export default function GoLive() {
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [evt, setEvt] = useState(null);
  const [err, setErr] = useState("");

  async function create() {
    setCreating(true);
    setErr("");
    try {
      const { data } = await api.post("/live/events", {
        title: title || "My Live Event",
        visibility: "unlisted",
        record: true,
      });
      setEvt(data);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to create event");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Go Live</h2>
      <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
        <label>
          <div>Title</div>
          <input
            className="search"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Live Event"
          />
        </label>
        <button className="btn" onClick={create} disabled={creating}>
          {creating ? "Creating…" : "Create Event"}
        </button>
        {err && <div className="auth-alert">{err}</div>}
      </div>

      {evt && (
        <div className="card" style={{ marginTop: 16, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>{evt.title}</h3>
          <div>
            RTMP Ingest: <code>{evt.rtmp_ingest}</code>
          </div>
          <div>
            Stream Key: <code>{evt.stream_key}</code>
          </div>
          {evt.hls_url && (
            <div>
              Playback URL:{" "}
              <a href={`/watch/live/${evt.id}`}>/watch/live/{evt.id}</a>
            </div>
          )}
          <div style={{ color: "var(--muted)", marginTop: 8 }}>
            In OBS: Settings → Stream → Service: <b>Custom</b>, Server:{" "}
            <code>{evt.rtmp_ingest}</code>, Stream Key:{" "}
            <code>{evt.stream_key}</code>.
          </div>
        </div>
      )}
    </div>
  );
}
