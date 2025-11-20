// src/pages/studio/LiveEvent.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api";

function CopyBox({ label, value }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          readOnly
          value={value || ""}
          className="auth-input"
          style={{ flex: 1 }}
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className="btn outline"
          onClick={() => value && navigator.clipboard?.writeText(value)}
        >
          Copy
        </button>
      </div>
    </label>
  );
}

export default function LiveEvent() {
  const { id } = useParams();
  const nav = useNavigate();

  const [ev, setEv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const { data } = await api.get(`/live/events/${id}`);
      setEv(data);
    } catch (e) {
      setErr("Failed to load event");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function markLive() {
    try {
      setBusy(true);
      setMsg("");
      const { data } = await api.post(`/live/events/${id}/start`);
      setEv(data);
      setMsg("Marked as live.");
    } catch (e) {
      setMsg("Failed to mark live.");
    } finally {
      setBusy(false);
    }
  }

  async function endAndVod() {
    try {
      setBusy(true);
      setMsg("");
      const { data } = await api.post(`/live/events/${id}/end`);
      setEv(data);
      if (data?.vod_video_id) {
        setMsg("Stream ended. Replay is being prepared.");
        // Optional: jump to “My videos” after a moment
        setTimeout(() => nav("/studio/videos"), 1200);
      } else {
        setMsg("Stream ended.");
      }
    } catch (e) {
      setMsg("Failed to end stream.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Link className="btn ghost" to="/studio/live">
          ← Back to events
        </Link>
        <div style={{ flex: 1 }} />
        <Link className="btn outline" to="/studio/videos">
          My videos
        </Link>
      </div>

      {loading ? (
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          Loading…
        </div>
      ) : err ? (
        <div
          className="card"
          style={{ marginTop: 16, padding: 16, color: "crimson" }}
        >
          {err}
        </div>
      ) : !ev ? (
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          Not found.
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <h2 style={{ margin: 0 }}>{ev.title || `Event #${ev.id}`}</h2>
            <span className="badge">{ev.status || "scheduled"}</span>
          </div>

          <CopyBox label="RTMP server" value={ev.rtmp_ingest} />
          <CopyBox label="Stream key" value={ev.stream_key} />
          <CopyBox label="HLS playback (advanced)" value={ev.hls_url} />
          <CopyBox
            label="Share / watch link"
            value={`${window.location.origin}/watch/live/${ev.id}`}
          />

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button className="btn outline" onClick={markLive} disabled={busy}>
              Mark as live
            </button>
            <button className="btn primary" onClick={endAndVod} disabled={busy}>
              End & Create VOD
            </button>
            <Link
              className="btn ghost"
              to={`/watch/live/${ev.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Open watch page
            </Link>
          </div>

          {msg && <div style={{ marginTop: 12, color: "#64748b" }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}
