// src/pages/admin/LiveStreamListPage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";

/* ----------------------- utils ----------------------- */
const fmtMb = (n) => (n ? `${Number(n).toFixed(1)} Mbps` : "0 Mbps");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function safeCopy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}
function buildUrls(evt) {
  const id = evt.channel_id;
  const hls =
    evt.hls_url ||
    `https://cdn.mycloudstream.io/hls/live/broadcast/${id}/index.m3u8`;
  const pub = evt.public_url || `https://my.streamcontrol.live/public/${id}`;
  const iframe =
    evt.player_iframe_src ||
    `https://my.streamcontrol.live/player/${id}?autoplay=true`;
  return { hls, pub, iframe };
}

/* ----------------------- Modals ----------------------- */
function ModalShell({ open, onClose, title, children, width = 640 }) {
  if (!open) return null;
  return (
    <div
      className="vd-overlay"
      onClick={onClose}
      style={{ backdropFilter: "blur(1px)" }}
    >
      <div
        className="vd-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width, maxWidth: "95vw" }}
      >
        <div className="vd-row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="icon-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

function EncoderSetupModal({ open, onClose, event }) {
  const url = event?.rtmp_url || "rtmps://ingest.mycloudstream.io:1936/static";
  const key = event?.stream_key || "";
  return (
    <ModalShell open={open} onClose={onClose} title="Encoder Setup">
      <label className="vd-label">Server URL</label>
      <div className="vd-row">
        <input className="search" readOnly value={url} />
        <button className="btn ghost" onClick={() => safeCopy(url)}>
          Copy
        </button>
      </div>

      <div className="vd-gap" />
      <label className="vd-label">Stream Key</label>
      <div className="vd-row">
        <input className="search" readOnly value={key} />
        <button className="btn ghost" onClick={() => safeCopy(key)}>
          Copy
        </button>
      </div>

      <div className="vd-gap" />
      <div className="vd-muted">
        Paste these into OBS / your encoder. The stream will go live as soon as
        the encoder connects.
      </div>
      <div className="vd-row right" style={{ marginTop: 16 }}>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}

function PlayerCodeModal({ open, onClose, event }) {
  const { hls, pub, iframe } = useMemo(() => buildUrls(event || {}), [event]);
  const code = `<iframe src="${iframe}" width="100%" height="560" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
  return (
    <ModalShell open={open} onClose={onClose} title="Player Code">
      <label className="vd-label">Player Embed Code</label>
      <textarea className="search" rows={6} readOnly value={code} />
      <div className="vd-row" style={{ marginTop: 6 }}>
        <button className="btn ghost" onClick={() => safeCopy(code)}>
          Copy embed code
        </button>
      </div>

      <div className="vd-gap" />
      <label className="vd-label">Direct HLS Link</label>
      <div className="vd-row">
        <input className="search" readOnly value={hls} />
        <button className="btn ghost" onClick={() => safeCopy(hls)}>
          Copy
        </button>
      </div>

      <div className="vd-gap" />
      <label className="vd-label">Public Page</label>
      <div className="vd-row">
        <input className="search" readOnly value={pub} />
        <button className="btn ghost" onClick={() => safeCopy(pub)}>
          Copy
        </button>
      </div>

      <div className="vd-row right" style={{ marginTop: 16 }}>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}

/* --------------------- Streamcontrol widget --------------------- */
function PublishingCard({ items }) {
  return (
    <div className="card">
      <div className="vd-row" style={{ justifyContent: "space-between" }}>
        <h3 className="vd-h">Publishing</h3>
        <button
          className="btn small ghost"
          title="Add destination"
          onClick={() =>
            alert("Hook this to your server to add a destination.")
          }
        >
          +
        </button>
      </div>

      {items?.length ? (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((d) => (
            <div
              key={d.id || d.name}
              className="card"
              style={{ padding: 10, border: "1px solid var(--line)" }}
            >
              <div
                className="vd-row"
                style={{ justifyContent: "space-between" }}
              >
                <div>
                  <b>{d.name}</b>
                  <div className="vd-small vd-muted">{d.platform || ""}</div>
                </div>
                <span
                  className="badge"
                  style={{
                    background:
                      d.status === "ready"
                        ? "var(--green)"
                        : d.status === "live"
                        ? "var(--blue)"
                        : "var(--line)",
                    color: d.status ? "#fff" : "inherit",
                  }}
                >
                  {d.status || "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="vd-muted">No publishing targets yet.</div>
      )}
    </div>
  );
}

function StreamcontrolWidget({ event }) {
  const [encOpen, setEncOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);

  const [stats, setStats] = useState({
    status: "ready",
    viewers: 0,
    bitrate_mbps: 0,
    recording: false,
    destinations: [],
  });
  const [loadingStats, setLoadingStats] = useState(true);

  async function fetchStats() {
    if (!event?.channel_id) return;
    try {
      const { data } = await api.get(
        `/live/streamcontrol/${event.channel_id}/stats`
      );
      setStats((s) => ({ ...s, ...(data || {}) }));
    } catch {
      // fine—render placeholders if your backend isn't ready yet
    } finally {
      setLoadingStats(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      await fetchStats();
      // poll
      while (alive) {
        await sleep(10000);
        await fetchStats();
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.channel_id]);

  const statusBadge =
    stats.status === "live"
      ? { label: "Live", color: "var(--green)" }
      : stats.status === "ready"
      ? { label: "Ready", color: "var(--blue)" }
      : { label: "Offline", color: "var(--line)" };

  return (
    <>
      <div
        className="vd-grid"
        style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}
      >
        {/* Left block (channel) */}
        <div className="card">
          <div className="vd-row" style={{ justifyContent: "space-between" }}>
            <h3 className="vd-h" style={{ margin: 0 }}>
              {event.title || event.channel_id}
            </h3>
            <div className="vd-row" style={{ gap: 8 }}>
              <span
                className="badge"
                style={{ background: statusBadge.color, color: "#fff" }}
              >
                {statusBadge.label}
              </span>
              <button className="btn small ghost" title="Settings">
                ⚙
              </button>
            </div>
          </div>

          <div style={{ textAlign: "center", margin: "20px 0 12px" }}>
            <div style={{ fontWeight: 700 }}>
              {stats.status === "live"
                ? "Broadcast Online"
                : "Broadcast Offline"}
            </div>
            <div className="vd-muted">
              {stats.status === "live"
                ? "Encoder connected"
                : "Waiting for encoder connection…"}
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <button className="btn" onClick={() => setEncOpen(true)}>
              ⏺️ Encoder Setup
            </button>
            <button className="btn" onClick={() => setPlayerOpen(true)}>
              ▶ Player Code
            </button>
            <button
              className="btn ghost"
              onClick={() => alert("Hook to your Stream Events page/route")}
            >
              ☰ Stream Events
            </button>
            <button
              className="btn ghost"
              onClick={() => alert("Hook to your Fallback Video configuration")}
            >
              ▷ Fallback Video
            </button>
          </div>
        </div>

        {/* Right block (publishing) */}
        <PublishingCard items={stats.destinations || []} />
      </div>

      {/* Stats row */}
      <div
        className="vd-grid"
        style={{
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 16,
          marginTop: 16,
        }}
      >
        <div className="card">
          <div className="vd-muted vd-small">STATUS</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
            {statusBadge.label}
          </div>
          <div className="vd-small vd-muted">
            {loadingStats ? "Fetching…" : "Created by Streamcontrol"}
          </div>
        </div>

        <div className="card">
          <div className="vd-muted vd-small">VIEWERS</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
            {stats.viewers || 0} Online
          </div>
          <div className="vd-small vd-muted">~ last poll</div>
        </div>

        <div className="card">
          <div className="vd-muted vd-small">BROADCAST</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
            {fmtMb(stats.bitrate_mbps)}
          </div>
          <div className="vd-small vd-muted">~</div>
        </div>

        <div className="card">
          <div className="vd-muted vd-small">RECORDING</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
            {stats.recording ? "Recording" : "Not Recording"}
          </div>
          <div className="vd-row" style={{ marginTop: 8, gap: 8 }}>
            <button
              className="btn small"
              onClick={() =>
                alert(
                  "Wire this to your server: POST /api/live/streamcontrol/:channelId/recording {on:true|false}"
                )
              }
            >
              {stats.recording ? "Stop Recording" : "Start Recording"}
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <EncoderSetupModal
        open={encOpen}
        onClose={() => setEncOpen(false)}
        event={event}
      />
      <PlayerCodeModal
        open={playerOpen}
        onClose={() => setPlayerOpen(false)}
        event={event}
      />
    </>
  );
}

/* --------------------- Page: Upcoming / Past --------------------- */
export default function LiveStreamListPage() {
  const [loading, setLoading] = useState(true);
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);

  async function load() {
    try {
      setLoading(true);
      const { data } = await api.get("/live/events");
      setUpcoming(data?.upcoming || []);
      setPast(data?.past || []);
    } catch (e) {
      console.error("load live events error:", e);
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
        className="vd-row"
        style={{ justifyContent: "space-between", marginBottom: 12 }}
      >
        <h2 style={{ margin: 0, fontWeight: 800 }}>Live Streaming</h2>
        <Link to="/content/live/new" className="btn">
          + Create live event
        </Link>
      </div>

      {/* UPCOMING */}
      <section className="card">
        <h3 className="vd-h" style={{ marginBottom: 12 }}>
          Upcoming
        </h3>
        {loading ? (
          <div className="vd-muted">Loading…</div>
        ) : upcoming.length === 0 ? (
          <div className="vd-muted">No upcoming live events.</div>
        ) : (
          upcoming.map((evt) => (
            <div key={evt.id} style={{ marginBottom: 16 }}>
              {/* Streamcontrol dashboard for Streamcontrol events */}
              {evt.provider === "streamcontrol" ? (
                <StreamcontrolWidget event={evt} />
              ) : (
                <div className="card">
                  <div
                    className="vd-row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <b>{evt.title || `Live #${evt.id}`}</b>
                    <span className="badge">
                      Provider: {evt.provider || "custom"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </section>

      {/* PAST */}
      <section className="card" style={{ marginTop: 16 }}>
        <h3 className="vd-h" style={{ marginBottom: 12 }}>
          Past
        </h3>
        {loading ? (
          <div className="vd-muted">Loading…</div>
        ) : past.length === 0 ? (
          <div className="vd-muted">No past events.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {past.map((evt) => (
              <div key={evt.id} className="card" style={{ padding: 12 }}>
                <div
                  className="vd-row"
                  style={{ justifyContent: "space-between" }}
                >
                  <div>
                    <b>{evt.title || `Live #${evt.id}`}</b>
                    <div className="vd-muted vd-small">
                      {evt.ended_at || ""}
                    </div>
                  </div>
                  <div className="vd-row" style={{ gap: 8 }}>
                    <Link
                      to={`/content/live/${evt.id}`}
                      className="btn small ghost"
                    >
                      View
                    </Link>
                    <button
                      className="btn small ghost"
                      onClick={() => alert("Hook to your analytics/export")}
                    >
                      Analytics
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
