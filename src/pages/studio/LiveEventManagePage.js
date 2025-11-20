import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../../api";

export default function LiveEventManagePage() {
  const { id: idParam } = useParams();
  const navigate = useNavigate();

  // Validate param immediately
  const eventId = useMemo(() => {
    const n = Number.parseInt(idParam, 10);
    return Number.isInteger(n) ? n : null;
  }, [idParam]);

  const [evt, setEvt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (eventId == null) {
      setErr("Invalid event id.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErr("");
      const { data } = await api.get(`/live/events/${eventId}`);
      setEvt(data || null);
    } catch (e) {
      console.error("load event failed:", e);
      setErr("Failed to load event.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const markLive = async () => {
    if (eventId == null) return;
    try {
      const { data } = await api.post(`/live/events/${eventId}/start`);
      setEvt(data || null);
    } catch (e) {
      console.error("start failed:", e);
      alert("Failed to mark live.");
    }
  };

  const endAndVod = async () => {
    if (eventId == null) return;
    try {
      const { data } = await api.post(`/live/events/${eventId}/end`);
      setEvt(data || null);
      alert(
        data?.vod_video_id
          ? "Ended. Replay/VOD created."
          : "Ended. (No VOD was created.)"
      );
    } catch (e) {
      console.error("end failed:", e);
      alert("Failed to end/live-to-VOD.");
    }
  };

  const watchUrl = evt?.id ? `/watch/live/${evt.id}` : "#";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      {/* Top bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <button className="btn ghost" onClick={() => navigate("/studio/live")}>
          ← Back to events
        </button>
        <Link
          className="btn outline"
          to={watchUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open watch page
        </Link>
        <Link className="btn ghost" to="/account">
          My account
        </Link>
      </div>

      {eventId == null ? (
        <div className="vd-muted">Invalid event id.</div>
      ) : loading ? (
        <div className="vd-muted">Loading…</div>
      ) : err ? (
        <div className="vd-muted">{err}</div>
      ) : !evt ? (
        <div className="vd-muted">Event not found.</div>
      ) : (
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>{evt.title || "Untitled event"}</h2>

          <div
            style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}
          >
            <div>
              <div style={{ fontSize: 13, color: "#64748b" }}>RTMP server</div>
              <input className="input" value={evt.rtmp_ingest || ""} readOnly />
            </div>
            <div>
              <div style={{ fontSize: 13, color: "#64748b" }}>Stream key</div>
              <input className="input" value={evt.stream_key || ""} readOnly />
            </div>
            <div>
              <div style={{ fontSize: 13, color: "#64748b" }}>HLS playback</div>
              <input className="input" value={evt.hls_url || ""} readOnly />
            </div>
            <div>
              <div style={{ fontSize: 13, color: "#64748b" }}>Status</div>
              <div style={{ fontWeight: 700 }}>{evt.status || "scheduled"}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn outline" onClick={markLive}>
              Mark as live
            </button>
            <button className="btn" onClick={endAndVod}>
              End & Create VOD
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
