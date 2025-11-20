// src/pages/admin/LiveStreaming.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api";

/* ---------------------------- small helpers ---------------------------- */
function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}
function fmtSince(sec) {
  if (!sec || sec < 0) return "";
  if (sec < 60) return `since ${sec}s ago`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `since ${m}m ${s}s ago`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `since ${h}h ${mm}m ago`;
}
function copy(text) {
  try {
    navigator.clipboard.writeText(text || "");
  } catch (_) {}
}

/* ------------------------------ page css ------------------------------ */
const styles = {
  page: {
    display: "grid",
    gap: 16,
  },

  // 4 stat cards → responsive grid
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },
  card: {
    background: "#fff",
    border: "1px solid var(--line, #e5e7eb)",
    borderRadius: 12,
    padding: 16,
  },
  statTitle: {
    fontSize: 12,
    color: "var(--muted, #6b7280)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  statValueRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  statValue: {
    fontWeight: 800,
    fontSize: 18,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
  },

  // Channel card
  channelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  channelTitle: { fontWeight: 800, fontSize: 18 },

  toggleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  toggle: (on) => ({
    position: "relative",
    width: 46,
    height: 26,
    borderRadius: 999,
    background: on ? "#4ade80" : "#e5e7eb",
    transition: "background .2s",
    cursor: "pointer",
  }),
  knob: (on) => ({
    position: "absolute",
    top: 3,
    left: on ? 22 : 3,
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,.2)",
    transition: "left .2s",
  }),

  // Player
  playerWrap: {
    position: "relative",
    width: "100%",
    aspectRatio: "16 / 9",
    background: "#0b0b0b",
    borderRadius: 10,
    overflow: "hidden",
    minHeight: 420, // good base height
  },
  iframeFill: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    border: 0,
    display: "block",
  },
  offlineCenter: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    color: "#e5e7eb",
  },
  playOverlay: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    background:
      "radial-gradient(60% 60% at 50% 50%, rgba(0,0,0,.35) 0%, rgba(0,0,0,.65) 100%)",
  },
  playBtn: {
    width: 74,
    height: 74,
    borderRadius: "50%",
    background: "#fff",
    display: "grid",
    placeItems: "center",
    boxShadow: "0 6px 20px rgba(0,0,0,.35)",
    cursor: "pointer",
  },

  // Actions row
  btnRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  btn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    border: "1px solid var(--line, #e5e7eb)",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },

  // Modal
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.45)",
    display: "grid",
    placeItems: "center",
    zIndex: 1000,
  },
  modal: {
    width: "min(720px, 92vw)",
    background: "#fff",
    borderRadius: 12,
    padding: 18,
    boxShadow: "0 20px 60px rgba(0,0,0,.25)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: { fontWeight: 800, fontSize: 18 },
  modalClose: {
    border: "1px solid var(--line, #e5e7eb)",
    background: "#fff",
    borderRadius: 8,
    padding: "8px 10px",
    cursor: "pointer",
  },

  inputRow: { position: "relative" },
  input: {
    width: "100%",
    border: "1px solid var(--line, #e5e7eb)",
    borderRadius: 8,
    padding: "12px 44px 12px 12px",
    fontFamily: "monospace",
    background: "#f8fafc",
  },
  copyBtn: {
    position: "absolute",
    right: 8,
    top: 8,
    height: 30,
    padding: "0 10px",
    border: "1px solid var(--line, #e5e7eb)",
    borderRadius: 6,
    background: "#fff",
    cursor: "pointer",
  },
};

/* ------------------------------ Modal base ------------------------------ */
function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>{title}</div>
          <button style={styles.modalClose} onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CopyInput({ label, value }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {!!label && (
        <div style={{ fontSize: 12, color: "#6b7280", margin: "0 0 6px 2px" }}>
          {label}
        </div>
      )}
      <div style={styles.inputRow}>
        <input readOnly value={value || ""} style={styles.input} />
        <button
          style={styles.copyBtn}
          title="Copy"
          onClick={() => copy(value || "")}
        >
          ⧉
        </button>
      </div>
    </div>
  );
}

/* --------------------------- stat card widgets --------------------------- */
function StatusCard({ online, startingSince }) {
  const color = online ? "#10b981" : "#6b7280";
  const label = online ? "Broadcasting" : "Ready";
  return (
    <div style={styles.card}>
      <div style={styles.statTitle}>Status</div>
      <div style={styles.statValueRow}>
        <span style={{ ...styles.badge, background: color + "20", color }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: color,
              display: "inline-block",
            }}
          />
          {label}
        </span>
        {online && startingSince ? (
          <span style={{ color: "#6b7280", fontSize: 12 }}>
            {fmtSince(startingSince)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
function ViewersCard({ viewers = 0 }) {
  return (
    <div style={styles.card}>
      <div style={styles.statTitle}>Viewers</div>
      <div style={styles.statValueRow}>
        <div style={styles.statValue}>{viewers} Online</div>
        <span style={{ color: "#6b7280", fontSize: 12 }}>
          0% Since last hour
        </span>
      </div>
    </div>
  );
}
function BroadcastCard({ mbps = 0, profile = "" }) {
  return (
    <div style={styles.card}>
      <div style={styles.statTitle}>Broadcast</div>
      <div style={styles.statValueRow}>
        <div style={styles.statValue}>{mbps.toFixed(2)} Mbps</div>
        {profile ? (
          <span style={{ color: "#6b7280", fontSize: 12 }}>{profile}</span>
        ) : null}
      </div>
    </div>
  );
}
function RecordingCard({ recording = false }) {
  return (
    <div style={styles.card}>
      <div style={styles.statTitle}>Recording</div>
      <div style={styles.statValueRow}>
        <span
          style={{
            ...styles.badge,
            background: (recording ? "#ef4444" : "#6b7280") + "20",
            color: recording ? "#ef4444" : "#6b7280",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: recording ? "#ef4444" : "#9ca3af",
              display: "inline-block",
            }}
          />
          {recording ? "Recording" : "Not Recording"}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------ main page ------------------------------ */
export default function LiveStreaming() {
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [stats, setStats] = useState({
    online: false,
    starting_for_sec: 0,
    viewers: 0,
    bitrate_mbps: 0,
    recording: false,
    quality: "",
  });

  // persisted override (per channel)
  const [overrideOnline, setOverrideOnline] = useState(null);

  // preview "click to play" state
  const [previewStarted, setPreviewStarted] = useState(false);

  // modals
  const [encOpen, setEncOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);

  const channel = useMemo(
    () => channels.find((c) => String(c.id) === String(selectedId)) || null,
    [channels, selectedId]
  );

  /* ---------------------------- load channels ---------------------------- */
  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        setLoading(true);
        const { data } = await api.get("/streamcontrol/channels");
        if (!alive) return;
        const arr = Array.isArray(data) ? data : [];
        setChannels(arr);

        const firstId = arr[0]?.id || null;
        setSelectedId(firstId);
        if (firstId) {
          const saved = localStorage.getItem(`live_toggle_${firstId}`);
          if (saved === "1" || saved === "0") setOverrideOnline(saved === "1");
        }
      } catch (e) {
        console.error("[LiveStreaming] load channels failed:", e);
        setChannels([]);
      } finally {
        setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, []);

  // when channel changes, re-seed persisted toggle and reset preview overlay
  useEffect(() => {
    if (!selectedId) return;
    const saved = localStorage.getItem(`live_toggle_${selectedId}`);
    if (saved === "1" || saved === "0") setOverrideOnline(saved === "1");
    setPreviewStarted(false);
  }, [selectedId]);

  /* ------------------------------ poll stats ----------------------------- */
  useEffect(() => {
    if (!selectedId) return;
    let timer = 0;
    let disposed = false;

    const fetchStats = async () => {
      try {
        const { data } = await api.get(
          `/streamcontrol/${encodeURIComponent(selectedId)}/stats`
        );
        if (!disposed) {
          setStats({
            online:
              overrideOnline !== null
                ? overrideOnline
                : !!(data?.online ?? data?.status === "online"),
            starting_for_sec: Number(data?.starting_for_sec || 0),
            viewers: Number(data?.viewers || 0),
            bitrate_mbps: Number(data?.bitrate_mbps || 0),
            recording: !!data?.recording,
            quality: data?.quality || "",
          });
        }
      } catch (e) {
        console.warn("[LiveStreaming] stats error:", e?.message || e);
      }
    };

    fetchStats();
    timer = window.setInterval(fetchStats, 5000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [selectedId, overrideOnline]);

  const effectiveOnline = overrideOnline ?? !!stats.online;
  const since = Number(stats.starting_for_sec || 0);
  const viewers = Number(stats.viewers || 0);
  const mbps = Number(stats.bitrate_mbps || 0);
  const recording = !!stats.recording;

  /* --------------------------- toggle (persisted) ------------------------- */
  function toggleBroadcast() {
    setOverrideOnline((v) => {
      const next = !(v ?? stats.online);
      try {
        if (selectedId) {
          localStorage.setItem(`live_toggle_${selectedId}`, next ? "1" : "0");
        }
      } catch {}
      // reset the click-to-play overlay when state changes
      setPreviewStarted(false);
      return next;
    });
  }

  /* ------------------------------ modal data ----------------------------- */
  const serverUrl =
    channel?.rtmp_url || "rtmps://ingest.mycloudstream.io:1936/static";
  const streamKey = channel?.stream_key || "";
  const playerIframe = channel?.player_iframe_src || "";
  const hlsUrl = channel?.hls_url || "";
  const publicUrl = channel?.public_url || "";

  /* ------------------------------ ui states ------------------------------ */
  if (loading) {
    return <div className="card">Loading…</div>;
  }

  if (!channel) {
    return (
      <div className="card">
        No channels found. Create one in StreamControl then reload this page.
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* top metric cards */}
      <div style={styles.statsGrid}>
        <StatusCard online={effectiveOnline} startingSince={since} />
        <ViewersCard viewers={viewers} />
        <BroadcastCard mbps={mbps} profile={stats.quality || ""} />
        <RecordingCard recording={recording} />
      </div>

      {/* channel card (no Publishing column) */}
      <section style={styles.card}>
        <div style={styles.channelHeader}>
          <div style={styles.channelTitle}>
            {channel.title || channel.name || "Live channel"}
          </div>

          <div style={styles.toggleWrap}>
            <div
              role="button"
              aria-label={effectiveOnline ? "Turn off" : "Turn on"}
              title={effectiveOnline ? "Turn off" : "Turn on"}
              onClick={toggleBroadcast}
              style={styles.toggle(effectiveOnline)}
            >
              <span style={styles.knob(effectiveOnline)} />
            </div>
            <span style={{ color: "#6b7280", fontWeight: 700 }}>
              {effectiveOnline ? "On" : "Off"}
            </span>
          </div>
        </div>

        {/* preview area */}
        <div style={styles.playerWrap}>
          {effectiveOnline ? (
            <>
              {!previewStarted && (
                <div style={styles.playOverlay}>
                  <div
                    style={styles.playBtn}
                    onClick={() => setPreviewStarted(true)}
                    title="Play preview"
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M8 5v14l11-7L8 5z" fill="#111827" />
                    </svg>
                  </div>
                </div>
              )}
              {previewStarted && (
                <iframe
                  src={playerIframe}
                  title="Stream preview"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  style={styles.iframeFill}
                />
              )}
            </>
          ) : (
            <div style={styles.offlineCenter}>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#ffffff",
                    marginBottom: 6,
                  }}
                >
                  Broadcast Offline
                </div>
                <div style={{ color: "#9ca3af" }}>
                  Waiting for encoder connection…
                </div>
              </div>
            </div>
          )}
        </div>

        {/* actions */}
        <div style={styles.btnRow}>
          <button style={styles.btn} onClick={() => setEncOpen(true)}>
            <span>🎛</span> Encoder Setup
          </button>
          <button style={styles.btn} onClick={() => setCodeOpen(true)}>
            <span>▶️</span> Player Code
          </button>
          <button style={styles.btn} onClick={() => setEventsOpen(true)}>
            <span>🗂</span> Stream Events
          </button>
          <button style={styles.btn} onClick={() => setFallbackOpen(true)}>
            <span>⤵</span> Fallback Video
          </button>
        </div>
      </section>

      {/* ---------------------------- Modals ---------------------------- */}
      <Modal
        open={encOpen}
        title="Encoder Setup"
        onClose={() => setEncOpen(false)}
      >
        <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 10 }}>
          Copy these values into your encoder (OBS, Wirecast, etc.).
        </div>
        <CopyInput label="Server URL" value={serverUrl} />
        <CopyInput label="Stream Key" value={streamKey} />
      </Modal>

      <Modal
        open={codeOpen}
        title="Player Code"
        onClose={() => setCodeOpen(false)}
      >
        <CopyInput
          label="Embed iframe"
          value={`<iframe src="${playerIframe}" width="100%" height="480" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`}
        />
        <CopyInput label="Direct HLS Link" value={hlsUrl} />
        <CopyInput label="Public Page" value={publicUrl} />
      </Modal>

      <Modal
        open={eventsOpen}
        title="Stream Events"
        onClose={() => setEventsOpen(false)}
      >
        <div className="vd-muted" style={{ color: "#6b7280", fontSize: 14 }}>
          Stream events for the last 7 days will appear here when available.
          (This is a UI-only modal at the moment.)
        </div>
      </Modal>

      <Modal
        open={fallbackOpen}
        title="Fallback Video"
        onClose={() => setFallbackOpen(false)}
      >
        <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 10 }}>
          A fallback video creates a 24/7 linear live channel by playing when
          there is no live encoder connected.
        </div>
        <div
          style={{
            border: "2px dashed #e5e7eb",
            borderRadius: 10,
            padding: 24,
            display: "grid",
            placeItems: "center",
            color: "#6b7280",
          }}
        >
          Drag &amp; drop a *.mp4 file here (UI only)
        </div>
      </Modal>
    </div>
  );
}
