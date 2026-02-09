// src/pages/admin/LiveStreaming.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api";
import "./LiveStreaming.css";

/* ---------------------------- helpers ---------------------------- */
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

function safeUrlJoin(a, b) {
  const aa = String(a || "").replace(/\/+$/, "");
  const bb = String(b || "").replace(/^\/+/, "");
  return `${aa}/${bb}`;
}

/**
 * Try to get the API base from axios config (api.defaults.baseURL).
 * Works for:
 *  - "http://localhost:5000/api"
 *  - "https://bishop...onrender.com/api"
 *  - "/api"
 */
function getApiBaseUrl() {
  const base = api?.defaults?.baseURL || "/api";
  return base;
}

function getApiAbsoluteUrl(path = "") {
  const base = getApiBaseUrl();
  // If base is absolute
  if (/^https?:\/\//i.test(base)) return safeUrlJoin(base, path);
  // If base is relative (e.g. "/api"), resolve with current origin
  return safeUrlJoin(window.location.origin + base, path);
}

function openCenteredPopup(url, title = "Connect", w = 520, h = 700) {
  const dualScreenLeft = window.screenLeft ?? window.screenX ?? 0;
  const dualScreenTop = window.screenTop ?? window.screenY ?? 0;

  const width =
    window.innerWidth ||
    document.documentElement.clientWidth ||
    window.screen?.width ||
    1200;

  const height =
    window.innerHeight ||
    document.documentElement.clientHeight ||
    window.screen?.height ||
    800;

  const left = Math.max(0, width / 2 - w / 2 + dualScreenLeft);
  const top = Math.max(0, height / 2 - h / 2 + dualScreenTop);

  const popup = window.open(
    url,
    title,
    `scrollbars=yes,width=${w},height=${h},top=${top},left=${left},noopener,noreferrer`
  );

  return popup;
}

/* -----------------------------------------
   Modern Loading Spinner (same as Community.js)
----------------------------------------- */
function CircularSpinner({ size = 40, label = "Loading…" }) {
  const ring = Math.max(4, Math.round(size / 10));

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        gap: 10,
        padding: "14px 0",
      }}
    >
      <style>{`
        @keyframes brtv-spin { to { transform: rotate(360deg); } }
        @keyframes brtv-dash {
          0%   { stroke-dasharray: 1, 200; stroke-dashoffset: 0; }
          50%  { stroke-dasharray: 90, 200; stroke-dashoffset: -35; }
          100% { stroke-dasharray: 90, 200; stroke-dashoffset: -125; }
        }
        @keyframes brtv-shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }
      `}</style>

      <div
        aria-label={label}
        role="status"
        style={{
          width: size,
          height: size,
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 50 50"
          style={{
            animation: "brtv-spin 1.2s linear infinite",
            filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.35))",
          }}
        >
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={ring}
          />
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="rgba(154, 92, 255, 0.95)"
            strokeLinecap="round"
            strokeWidth={ring}
            style={{ animation: "brtv-dash 1.4s ease-in-out infinite" }}
          />
        </svg>
      </div>

      {!!label && (
        <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 13 }}>
          {label}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ styles ------------------------------ */
const styles = {
  page: { display: "grid", gap: 16 },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },

  mainGrid: {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    alignItems: "flex-start",
  },

  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
  },

  statTitle: {
    fontSize: 12,
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 8,
  },

  statValueRow: { display: "flex", alignItems: "center", gap: 10 },
  statValue: { fontWeight: 800, fontSize: 18 },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
  },

  channelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  channelTitle: { fontWeight: 800, fontSize: 18 },
  toggleWrap: { display: "flex", alignItems: "center", gap: 8 },

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
    transition: "left .2s",
  }),

  playerWrap: {
    position: "relative",
    width: "100%",
    aspectRatio: "16/9",
    background: "#0b0b0b",
    borderRadius: 10,
    overflow: "hidden",
    minHeight: 420,
  },

  iframeFill: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    border: 0,
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
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    boxShadow: "0 6px 20px rgba(0,0,0,.35)",
    color: "#3f1770",
  },

  btnRow: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 },
  btn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },

  /* modal */
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.45)",
    display: "grid",
    placeItems: "center",
    zIndex: 1000,
  },
  modal: {
    width: "min(820px, 92vw)",
    background: "#fff",
    borderRadius: 12,
    padding: 18,
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: { fontWeight: 800, fontSize: 18 },
  modalClose: {
    border: "1px solid #e5e7eb",
    padding: "8px 10px",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
  },

  inputRow: { position: "relative" },
  input: {
    width: "100%",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "12px 44px 12px 12px",
    fontFamily: "monospace",
    background: "#f8fafc",
  },
  copyBtn: {
    position: "absolute",
    right: 8,
    top: 8,
    padding: "0 10px",
    height: 30,
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    background: "#fff",
    cursor: "pointer",
  },

  /* toast */
  toastContainer: { position: "fixed", right: 24, bottom: 24, zIndex: 2000 },
  toast: (type) => ({
    minWidth: 260,
    maxWidth: 420,
    padding: "10px 14px",
    borderRadius: 10,
    boxShadow: "0 10px 25px rgba(0,0,0,.25)",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    background:
      type === "error" ? "#fee2e2" : type === "info" ? "#e0f2fe" : "#dcfce7",
    color:
      type === "error" ? "#b91c1c" : type === "info" ? "#075985" : "#166534",
  }),
  toastDot: (type) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background:
      type === "error" ? "#b91c1c" : type === "info" ? "#0284c7" : "#16a34a",
  }),
  toastCloseBtn: {
    marginLeft: "auto",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
  },

  /* publishing */
  pubHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  pubTitle: { fontWeight: 800, fontSize: 16 },
  pubAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: "34px",
    textAlign: "center",
    fontWeight: 800,
  },
  pubList: { display: "grid", gap: 10 },
  pubRow: {
    display: "grid",
    gridTemplateColumns: "28px 1fr auto auto",
    alignItems: "center",
    gap: 10,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "10px 12px",
  },
  pubIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 900,
  },
  pubName: { fontWeight: 800 },
  pubSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  pill: (on) => ({
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: on ? "#dcfce7" : "#e5e7eb",
    color: on ? "#166534" : "#6b7280",
  }),
  pubMenuBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: "36px",
    textAlign: "center",
  },

  /* Add Publisher - tile grid (StreamControl-like) */
  tileGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },
  tile: {
    background: "#6366f1",
    borderRadius: 10,
    padding: 18,
    color: "#fff",
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,.25)",
    minHeight: 110,
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    fontWeight: 800,
  },
  tileIcon: { fontSize: 34, marginBottom: 8, fontWeight: 900 },

  addStepWrap: { display: "grid", gridTemplateColumns: "260px 1fr", gap: 18 },

  leftPane: {
    borderRight: "1px solid #e5e7eb",
    paddingRight: 14,
    display: "grid",
    gap: 10,
    alignContent: "start",
  },
  continueBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    cursor: "pointer",
    fontWeight: 900,
    background: "#6366f1",
    color: "#fff",
  },
  nameInput: {
    width: "100%",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 12,
    background: "#fff",
  },
  footerBar: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 14,
  },
  smallBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 800,
  },
  primarySave: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #2563eb",
    background: "#2563eb",
    cursor: "pointer",
    fontWeight: 900,
    color: "#fff",
  },

  fbPanel: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    background: "#f9fafb",
    marginBottom: 12,
  },
  fbRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
  },
  fbLeft: { display: "grid", gap: 4 },
  fbLabel: { fontWeight: 900 },
  fbSub: { fontSize: 12, color: "#6b7280" },
  select: {
    width: "100%",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 10,
    background: "#fff",
  },
};

/* ------------------------------- UI bits ------------------------------- */
function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle} className="brtv-status">
            {title}
          </div>
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
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
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

/* --------------------------- stat cards --------------------------- */
function StatusCard({ online, startingSince }) {
  const color = online ? "#10b981" : "#6b7280";
  const label = online ? "Broadcasting" : "Ready";
  return (
    <div style={styles.card}>
      <div style={styles.statTitle} className="brtv-status">
        Status
      </div>
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
      <div style={styles.statTitle} className="brtv-status">
        Viewers
      </div>
      <div style={styles.statValueRow}>
        <div style={styles.statValue} className="brtv-publisher">
          {viewers} Online
        </div>
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
      <div style={styles.statTitle} className="brtv-status">
        Broadcast
      </div>
      <div style={styles.statValueRow}>
        <div style={styles.statValue} className="brtv-status">
          {mbps.toFixed(2)} Mbps
        </div>
        {profile ? (
          <span style={{ color: "#6b7280", fontSize: 12 }}>{profile}</span>
        ) : null}
      </div>
    </div>
  );
}

function RecordingCard({ recording = false }) {
  const active = !!recording;
  return (
    <div style={styles.card}>
      <div style={styles.statTitle} className="brtv-status">
        Recording
      </div>
      <div style={styles.statValueRow}>
        <span
          style={{
            ...styles.badge,
            background: (active ? "#ef4444" : "#6b7280") + "20",
            color: active ? "#ef4444" : "#6b7280",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: active ? "#ef4444" : "#9ca3af",
              display: "inline-block",
            }}
          />
          {active ? "Recording" : "Not Recording"}
        </span>
      </div>
    </div>
  );
}

/* ----------------------------- toast ----------------------------- */
function Toast({ open, type, message, onClose }) {
  if (!open || !message) return null;
  return (
    <div style={styles.toastContainer}>
      <div style={styles.toast(type)}>
        <span style={styles.toastDot(type)} />
        <span>{message}</span>
        <button style={styles.toastCloseBtn} onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
}

/* ----------------------- Add Publisher content ----------------------- */
const PUBLISHERS = [
  { key: "facebook", label: "Facebook", icon: "f" },
  { key: "twitch", label: "Twitch", icon: "⌁" },
  { key: "youtube", label: "Youtube", icon: "▶" },
  { key: "icecast", label: "Icecast Server", icon: "☊" },
  { key: "custom_rtmp", label: "Custom RTMP", icon: "⤴" },
  { key: "srt", label: "SRT Destination", icon: "▣" },
];

function requirementsFor(key) {
  switch (key) {
    case "facebook":
      return {
        title: "Facebook Streaming Requirements",
        bullets: [
          "Facebook accepts up to 1080p (1920×1080).",
          "Aspect ratio 16:9 recommended.",
          "30 or 60 fps.",
          "Bitrate: CBR 1–5 Mbps recommended (higher may work depending on your setup).",
          "Audio: AAC (typically 128–256 kbps).",
          "Titles must be short (long titles can fail).",
          "H.264 video + AAC audio only.",
        ],
        button: "CONTINUE WITH FACEBOOK",
      };
    case "twitch":
      return {
        title: "Twitch Streaming Requirements",
        bullets: [
          "Resolution up to 1080p recommended.",
          "30 or 60 fps.",
          "H.264 video + AAC audio.",
          "Use a stable upload; avoid variable bitrate spikes.",
          "A Twitch account link step is required in StreamControl.",
        ],
        button: "CONTINUE WITH TWITCH",
      };
    case "youtube":
      return {
        title: "YouTube Streaming Requirements",
        bullets: [
          "1080p recommended (higher supported depending on channel).",
          "30 or 60 fps.",
          "H.264 video + AAC audio.",
          "A YouTube account link step is required in StreamControl.",
          "Make sure your YouTube channel is verified for live streaming.",
        ],
        button: "CONTINUE WITH YOUTUBE",
      };
    case "icecast":
      return {
        title: "Icecast Destination Requirements",
        bullets: [
          "You’ll need Icecast server URL/credentials.",
          "StreamControl will send your broadcast audio/video to Icecast.",
          "Confirm your mount point and password are correct.",
        ],
        button: "CONFIGURE ICECAST",
      };
    case "custom_rtmp":
      return {
        title: "Custom RTMP Requirements",
        bullets: [
          "You’ll need destination RTMP URL + Stream Key from the platform.",
          "Confirm whether it requires RTMPS (secure) or RTMP.",
          "StreamControl will push your live stream to that destination.",
        ],
        button: "CONFIGURE CUSTOM RTMP",
      };
    case "srt":
      return {
        title: "SRT Destination Requirements",
        bullets: [
          "You’ll need SRT URL (caller/listener) and optional passphrase.",
          "Confirm your mode and latency settings with your destination.",
          "StreamControl will publish the stream using SRT.",
        ],
        button: "CONFIGURE SRT",
      };
    default:
      return { title: "Requirements", bullets: [], button: "CONTINUE" };
  }
}

/* ------------------------------- page ------------------------------- */
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

  const [overrideOnline, setOverrideOnline] = useState(null);
  const [previewStarted, setPreviewStarted] = useState(false);

  const [toast, setToast] = useState({
    open: false,
    type: "success",
    message: "",
  });

  // ✅ prevent setTimeout leak / state update after unmount
  const toastTimerRef = useRef(null);
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const [encOpen, setEncOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);

  // publishers (streamcontrol list)
  const [pubLoading, setPubLoading] = useState(false);
  const [publishers, setPublishers] = useState([]);

  // Add Publisher modal
  const [addPubOpen, setAddPubOpen] = useState(false);
  const [addStep, setAddStep] = useState(1);
  const [selectedPubKey, setSelectedPubKey] = useState(null);
  const [pubDisplayName, setPubDisplayName] = useState("");

  // Facebook integration (your app)
  const [fbLoading, setFbLoading] = useState(false);
  const [fbStatus, setFbStatus] = useState({
    connected: false,
    name: "",
    email: "",
  });
  const [fbPages, setFbPages] = useState([]);
  const [fbPageId, setFbPageId] = useState("");
  const [fbLiveTitle, setFbLiveTitle] = useState("Bishop Robertson TV - Live");
  const [fbLiveDesc, setFbLiveDesc] = useState("");
  const [fbPrivacy, setFbPrivacy] = useState("EVERYONE"); // or "ALL_FRIENDS" etc
  const [fbLive, setFbLive] = useState({
    live_video_id: "",
    rtmp_url: "",
    stream_key: "",
  });

  // local override (if Facebook created RTMP)
  const [overrideServerUrl, setOverrideServerUrl] = useState("");
  const [overrideStreamKey, setOverrideStreamKey] = useState("");

  const channel = useMemo(
    () => channels.find((c) => String(c.id) === String(selectedId)) || null,
    [channels, selectedId]
  );

  const showToast = (type, message) => {
    setToast({ open: true, type, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) =>
        prev.message === message ? { ...prev, open: false } : prev
      );
    }, 3200);
  };

  const openStreamControlChannelPage = () => {
    const id = channel?.id ? String(channel.id) : "";
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      );

    const url = isUuid
      ? `https://my.streamcontrol.live/channel/${id}`
      : "https://my.streamcontrol.live";

    window.open(url, "_blank", "noopener,noreferrer");
  };

  /* ---------------------------- load channels ---------------------------- */
  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        setLoading(true);

        // ✅ IMPORTANT: no leading "/" so it keeps baseURL .../api
        const { data } = await api.get("streamcontrol/channels");
        if (!alive) return;

        setChannels(Array.isArray(data) ? data : []);
        const first = (Array.isArray(data) ? data : [])?.[0]?.id || null;
        setSelectedId(first);

        if (first) {
          const saved = localStorage.getItem(`live_toggle_${first}`);
          if (saved === "1" || saved === "0") setOverrideOnline(saved === "1");
        }
      } catch (e) {
        console.error("load channels failed", e);
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => (alive = false);
  }, []);

  /* ------------------------------ poll stats ------------------------------ */
  useEffect(() => {
    if (!selectedId) return;
    let disposed = false;

    async function tick() {
      try {
        // ✅ no leading "/"
        const { data } = await api.get(
          `streamcontrol/${encodeURIComponent(selectedId)}/stats`
        );
        if (!disposed) {
          setStats((prev) => ({
            ...prev,
            online:
              overrideOnline !== null
                ? overrideOnline
                : !!(data?.online ?? data?.status === "online"),
            starting_for_sec: Number(data?.starting_for_sec || 0),
            viewers: Number(data?.viewers || 0),
            bitrate_mbps: Number(data?.bitrate_mbps || 0),
            recording: !!data?.recording,
            quality: data?.quality || "",
          }));
        }
      } catch (e) {
        console.warn("stats error:", e?.message || e);
      }
    }

    tick();
    const id = setInterval(tick, 5000);
    return () => {
      disposed = true;
      clearInterval(id);
    };
  }, [selectedId, overrideOnline]);

  const effectiveOnline = overrideOnline ?? stats.online;

  function toggleBroadcast() {
    setOverrideOnline((prev) => {
      const next = !(prev ?? stats.online);
      if (selectedId)
        localStorage.setItem(`live_toggle_${selectedId}`, next ? "1" : "0");
      setPreviewStarted(false);
      return next;
    });
  }

  /* -------------------------- streamcontrol publishers list -------------------------- */
  const pubIcon = (type) => {
    const t = String(type || "").toLowerCase();
    if (t.includes("facebook")) return "f";
    if (t.includes("twitch")) return "t";
    if (t.includes("youtube")) return "▶";
    if (t.includes("rtmp")) return "⤴";
    if (t.includes("srt")) return "s";
    if (t.includes("icecast")) return "i";
    return "⤴";
  };

  async function loadPublishers() {
    if (!selectedId) return;
    try {
      setPubLoading(true);

      // ✅ no leading "/"
      const res = await api.get(
        `streamcontrol/${encodeURIComponent(selectedId)}/publishers`
      );
      const items = Array.isArray(res.data?.publishers)
        ? res.data.publishers
        : Array.isArray(res.data)
        ? res.data
        : [];
      setPublishers(items);
    } catch (e) {
      console.error("load publishers failed", e);
      setPublishers([]);
      showToast("error", "Failed to load publishers.");
    } finally {
      setPubLoading(false);
    }
  }

  useEffect(() => {
    loadPublishers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function togglePublisher(pub) {
    try {
      const pubId = pub.id || pub.publisher_id || pub.uuid;
      if (!pubId) throw new Error("Missing publisher id");

      // ✅ no leading "/"
      await api.post(
        `streamcontrol/${encodeURIComponent(
          selectedId
        )}/publishers/${encodeURIComponent(pubId)}/toggle`,
        { enabled: !pub.enabled }
      );

      showToast("success", "Publishing updated.");
      loadPublishers();
    } catch (e) {
      const errCode = e?.response?.data?.error;
      if (errCode === "PUBLISHER_TOGGLE_NOT_SUPPORTED") {
        showToast(
          "info",
          "Publisher changes are managed in StreamControl. Opening channel…"
        );
        openStreamControlChannelPage();
        return;
      }
      console.error("toggle publisher failed", e);
      showToast("error", "Failed to update publisher.");
    }
  }

  async function removePublisher(pub) {
    try {
      const pubId = pub.id || pub.publisher_id || pub.uuid;
      if (!pubId) throw new Error("Missing publisher id");

      // ✅ no leading "/"
      await api.delete(
        `streamcontrol/${encodeURIComponent(
          selectedId
        )}/publishers/${encodeURIComponent(pubId)}`
      );

      showToast("success", "Publisher removed.");
      loadPublishers();
    } catch (e) {
      const errCode = e?.response?.data?.error;
      if (errCode === "PUBLISHER_DELETE_NOT_SUPPORTED") {
        showToast(
          "info",
          "Publishers are managed in StreamControl. Opening channel…"
        );
        openStreamControlChannelPage();
        return;
      }
      console.error("remove publisher failed", e);
      showToast("error", "Failed to remove publisher.");
    }
  }

  /* -------------------------- Facebook (your app) -------------------------- */
  async function refreshFacebookStatus(silent = false) {
    try {
      setFbLoading(true);

      // ✅ no leading "/"
      const res = await api.get("auth/facebook/status");
      const connected = !!(res.data?.connected ?? res.data?.ok);
      setFbStatus({
        connected,
        name: res.data?.user?.name || "",
        email: res.data?.user?.email || "",
      });
      if (!silent) {
        showToast(
          "success",
          connected ? "Facebook connected." : "Facebook not connected."
        );
      }
      return connected;
    } catch (e) {
      if (!silent)
        showToast("error", "Missing endpoint: GET /auth/facebook/status");
      setFbStatus({ connected: false, name: "", email: "" });
      return false;
    } finally {
      setFbLoading(false);
    }
  }

  async function connectFacebook() {
    try {
      setFbLoading(true);

      const returnTo = window.location.href;
      const url = getApiAbsoluteUrl(
        `auth/facebook/login?returnTo=${encodeURIComponent(returnTo)}`
      );

      const popup = openCenteredPopup(url, "Facebook Connect");

      if (!popup) {
        showToast("error", "Popup blocked. Allow popups and try again.");
        setFbLoading(false);
        return;
      }

      const startedAt = Date.now();
      const timer = setInterval(async () => {
        const closed = popup.closed;
        const tooLong = Date.now() - startedAt > 1000 * 120; // 2 minutes
        if (closed || tooLong) {
          clearInterval(timer);
          await refreshFacebookStatus(true);
          setFbLoading(false);
        }
      }, 800);
    } catch (e) {
      console.error(e);
      showToast("error", "Failed to start Facebook login.");
      setFbLoading(false);
    }
  }

  async function disconnectFacebook() {
    try {
      setFbLoading(true);

      // ✅ no leading "/"
      await api.post("auth/facebook/disconnect");
      setFbStatus({ connected: false, name: "", email: "" });
      setFbPages([]);
      setFbPageId("");
      setFbLive({ live_video_id: "", rtmp_url: "", stream_key: "" });
      setOverrideServerUrl("");
      setOverrideStreamKey("");
      showToast("success", "Facebook disconnected.");
    } catch (e) {
      showToast("error", "Missing endpoint: POST /auth/facebook/disconnect");
    } finally {
      setFbLoading(false);
    }
  }

  async function loadFacebookPages() {
    try {
      setFbLoading(true);

      // ✅ no leading "/"
      const res = await api.get("auth/facebook/pages");
      const pages = Array.isArray(res.data?.pages)
        ? res.data.pages
        : Array.isArray(res.data)
        ? res.data
        : [];
      setFbPages(pages);
      if (pages.length && !fbPageId)
        setFbPageId(String(pages[0].id || pages[0].page_id || ""));
      showToast("success", "Facebook pages loaded.");
    } catch (e) {
      showToast("error", "Missing endpoint: GET /auth/facebook/pages");
    } finally {
      setFbLoading(false);
    }
  }

  async function createFacebookLive() {
    if (!fbPageId) {
      showToast("error", "Please select a Facebook Page.");
      return;
    }
    try {
      setFbLoading(true);
      const payload = {
        page_id: fbPageId,
        title: fbLiveTitle,
        description: fbLiveDesc,
        privacy: fbPrivacy,
      };

      // ✅ no leading "/"
      const res = await api.post("auth/facebook/live", payload);
      const rtmp_url = res.data?.rtmp_url || res.data?.server_url || "";
      const stream_key = res.data?.stream_key || res.data?.key || "";
      const live_video_id = res.data?.live_video_id || res.data?.id || "";

      if (!rtmp_url || !stream_key) {
        showToast(
          "error",
          "Live created but missing RTMP URL / Stream Key from backend."
        );
        return;
      }

      setFbLive({ live_video_id, rtmp_url, stream_key });
      setOverrideServerUrl(rtmp_url);
      setOverrideStreamKey(stream_key);
      showToast(
        "success",
        "Facebook Live created. Copy RTMP URL + Stream Key."
      );
      setEncOpen(true);
    } catch (e) {
      showToast("error", "Missing endpoint: POST /auth/facebook/live");
    } finally {
      setFbLoading(false);
    }
  }

  useEffect(() => {
    refreshFacebookStatus(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------- Add Publisher modal actions ---------------------- */
  function openAddPublisher() {
    setAddStep(1);
    setSelectedPubKey(null);
    setPubDisplayName("");
    setAddPubOpen(true);
  }

  function selectPublisherTile(key) {
    setSelectedPubKey(key);
    setAddStep(2);
  }

  function savePublisherSelection() {
    if (!selectedPubKey) {
      showToast("error", "Please select a destination.");
      return;
    }

    if (selectedPubKey === "facebook") {
      setAddPubOpen(false);
      showToast(
        "info",
        "Use the Facebook panel below to connect and create a live stream."
      );
      return;
    }

    setAddPubOpen(false);
    showToast("info", "Opening StreamControl to finish adding the publisher…");
    openStreamControlChannelPage();
  }

  /* ------------------------------ modal values ------------------------------ */
  const serverUrl =
    overrideServerUrl ||
    channel?.rtmp_url ||
    "rtmps://ingest.mycloudstream.io:1936/static";

  const streamKey = overrideStreamKey || channel?.stream_key || "";
  const playerIframe = channel?.player_iframe_src || "";
  const hlsUrl = channel?.hls_url || "";
  const publicUrl = channel?.public_url || "";

  const req = selectedPubKey ? requirementsFor(selectedPubKey) : null;

  /* ------------------------------ FIXED: loading + empty states ------------------------------ */
  // ✅ show spinner while loading, but DO NOT show "No channels found" yet
  if (loading) {
    return (
      <div style={{ margin: "8px 0 14px" }}>
        <CircularSpinner label="Loading live streaming…" />
      </div>
    );
  }

  // ✅ only show "No channels found" AFTER load completes and channels are truly empty
  if (!loading && (!Array.isArray(channels) || channels.length === 0)) {
    return <div className="card">No channels found.</div>;
  }

  // ✅ safety: if channels exist but selected channel hasn't resolved yet
  if (!channel) {
    return (
      <div style={{ margin: "8px 0 14px" }}>
        <CircularSpinner label="Loading live streaming…" />
      </div>
    );
  }

  return (
    <>
      <div style={styles.page}>
        <div style={styles.statsGrid}>
          <StatusCard
            online={overrideOnline ?? stats.online}
            startingSince={stats.starting_for_sec}
          />
          <ViewersCard viewers={stats.viewers} />
          <BroadcastCard
            mbps={stats.bitrate_mbps}
            profile={stats.quality || ""}
          />
          <RecordingCard recording={stats.recording} />
        </div>

        <div style={styles.mainGrid}>
          {/* Channel */}
          <section style={styles.card}>
            <div style={styles.channelHeader}>
              <div style={styles.channelTitle} className="brtv-status">
                {channel.title || channel.name || "Live Channel"}
              </div>

              <div style={styles.toggleWrap}>
                <div
                  onClick={toggleBroadcast}
                  style={styles.toggle(overrideOnline ?? stats.online)}
                >
                  <span style={styles.knob(overrideOnline ?? stats.online)} />
                </div>
                <span style={{ color: "#6b7280", fontWeight: 700 }}>
                  {overrideOnline ?? stats.online ? "On" : "Off"}
                </span>
              </div>
            </div>

            <div style={styles.playerWrap}>
              {effectiveOnline ? (
                <>
                  {!previewStarted && (
                    <div style={styles.playOverlay}>
                      <div
                        style={styles.playBtn}
                        onClick={() => setPreviewStarted(true)}
                      >
                        ▶
                      </div>
                    </div>
                  )}
                  {previewStarted && (
                    <iframe
                      src={playerIframe}
                      title="Stream Preview"
                      style={styles.iframeFill}
                      allow="autoplay; fullscreen; picture-in-picture"
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
                        color: "#fff",
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

            <div style={styles.btnRow}>
              <button style={styles.btn} onClick={() => setEncOpen(true)}>
                🎛 Encoder Setup
              </button>
              <button style={styles.btn} onClick={() => setCodeOpen(true)}>
                ▶ Player Code
              </button>
              <button style={styles.btn} onClick={() => setEventsOpen(true)}>
                🗂 Stream Events
              </button>
              <button style={styles.btn} onClick={() => setFallbackOpen(true)}>
                ⤵ Fallback Video
              </button>
            </div>
          </section>

          {/* Publishing */}
          <section style={styles.card}>
            <div style={styles.pubHeader}>
              <div style={styles.pubTitle} className="brtv-status">
                Publishing
              </div>
              <button
                style={styles.pubAddBtn}
                title="Add Publisher"
                onClick={openAddPublisher}
              >
                +
              </button>
            </div>

            {/* Facebook in-app panel */}
            <div style={styles.fbPanel}>
              <div style={styles.fbRow}>
                <div style={styles.fbLeft}>
                  <div style={styles.fbLabel} className="brtv-status">
                    Facebook
                  </div>
                  <div style={styles.fbSub} className="brtv-status">
                    {fbStatus.connected
                      ? `Connected ${
                          fbStatus.name ? `as ${fbStatus.name}` : ""
                        }`
                      : "Not connected"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {!fbStatus.connected ? (
                    <button
                      style={styles.btn}
                      onClick={connectFacebook}
                      disabled={fbLoading}
                    >
                      {fbLoading ? "Connecting…" : "Connect"}
                    </button>
                  ) : (
                    <>
                      <button
                        style={styles.btn}
                        onClick={loadFacebookPages}
                        disabled={fbLoading}
                      >
                        {fbLoading ? "Loading…" : "Load Pages"}
                      </button>
                      <button
                        style={styles.btn}
                        onClick={disconnectFacebook}
                        disabled={fbLoading}
                      >
                        Disconnect
                      </button>
                    </>
                  )}
                </div>
              </div>

              {fbStatus.connected ? (
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        marginBottom: 6,
                      }}
                    >
                      Select Page
                    </div>
                    <select
                      style={styles.select}
                      value={fbPageId}
                      onChange={(e) => setFbPageId(e.target.value)}
                    >
                      <option value="">-- Select a Page --</option>
                      {fbPages.map((p) => (
                        <option
                          key={p.id || p.page_id}
                          value={String(p.id || p.page_id)}
                        >
                          {p.name ||
                            p.page_name ||
                            p.title ||
                            p.id ||
                            p.page_id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      Live Title
                    </div>
                    <input
                      style={styles.nameInput}
                      value={fbLiveTitle}
                      onChange={(e) => setFbLiveTitle(e.target.value)}
                      placeholder="Live title"
                    />

                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      Description (optional)
                    </div>
                    <input
                      style={styles.nameInput}
                      value={fbLiveDesc}
                      onChange={(e) => setFbLiveDesc(e.target.value)}
                      placeholder="Description"
                    />

                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      Privacy
                    </div>
                    <select
                      style={styles.select}
                      value={fbPrivacy}
                      onChange={(e) => setFbPrivacy(e.target.value)}
                    >
                      <option value="EVERYONE">Public</option>
                      <option value="ALL_FRIENDS">Friends</option>
                      <option value="SELF">Only Me</option>
                    </select>

                    <button
                      style={styles.primarySave}
                      onClick={createFacebookLive}
                      disabled={fbLoading}
                    >
                      {fbLoading
                        ? "Creating…"
                        : "Create Facebook Live (Get RTMP URL + Key)"}
                    </button>

                    {fbLive?.rtmp_url ? (
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        Live Ready
                        {fbLive.live_video_id
                          ? ` (ID: ${fbLive.live_video_id})`
                          : ""}
                        . Open <b>Encoder Setup</b> to copy RTMP.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div
              style={{
                fontSize: 12,
                color: "#6b7280!important",
                marginBottom: 10,
              }}
              className="brtv-publisher"
            >
              StreamControl publishers are configured in StreamControl. This
              list shows the current StreamControl publishers.
            </div>

            {pubLoading ? (
              <div
                style={{ color: "#6b7280!important" }}
                className="brtv-publisher"
              >
                Loading publishers…
              </div>
            ) : publishers.length === 0 ? (
              <div
                style={{ color: "#6b7280!important" }}
                className="brtv-publisher"
              >
                No publishers found. Click <b>+</b> to add one.
              </div>
            ) : (
              <div style={styles.pubList}>
                {publishers.map((p) => {
                  const name = p.name || p.title || p.platform || "Publisher";
                  const type = p.type || p.platform || "custom_rtmp";
                  const enabled = !!(p.enabled ?? p.active ?? p.is_enabled);
                  const sub =
                    p.destination ||
                    p.page_name ||
                    p.channel_name ||
                    p.rtmp_url ||
                    p.srt_url ||
                    "";
                  return (
                    <div
                      key={p.id || p.uuid || name + sub}
                      style={styles.pubRow}
                    >
                      <div style={styles.pubIcon}>{pubIcon(type)}</div>
                      <div>
                        <div style={styles.pubName}>{name}</div>
                        {sub ? <div style={styles.pubSub}>{sub}</div> : null}
                      </div>
                      <span style={styles.pill(enabled)}>
                        {enabled ? "online" : "offline"}
                      </span>
                      <button
                        style={styles.pubMenuBtn}
                        title="Manage"
                        onClick={() => {
                          const action = window.prompt(
                            'Type "toggle" to enable/disable, or "remove" to delete this publisher.\n\nIf not supported, we will open StreamControl.'
                          );
                          if (action === "toggle") togglePublisher(p);
                          if (action === "remove") removePublisher(p);
                        }}
                      >
                        ⋮
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Modals */}
        <Modal
          open={encOpen}
          title="Encoder Setup"
          onClose={() => setEncOpen(false)}
        >
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
          <div style={{ color: "#6b7280" }}>Events will appear here soon.</div>
        </Modal>

        <Modal
          open={fallbackOpen}
          title="Fallback Video"
          onClose={() => setFallbackOpen(false)}
        >
          <div style={{ color: "#6b7280", marginBottom: 10 }}>
            Upload a fallback video to play when offline.
          </div>
          <div
            style={{
              border: "2px dashed #e5e7eb",
              padding: 24,
              borderRadius: 12,
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            Drag & drop .mp4 here (UI only)
          </div>
        </Modal>

        {/* Add Publisher Modal */}
        <Modal
          open={addPubOpen}
          title="Add Publisher"
          onClose={() => setAddPubOpen(false)}
        >
          {addStep === 1 ? (
            <>
              <div
                style={{ fontSize: 13, marginBottom: 12 }}
                className="brtv-publisher"
              >
                Select a destination to publish your broadcast.
              </div>

              <div style={styles.tileGrid}>
                {PUBLISHERS.map((p) => (
                  <div
                    key={p.key}
                    style={styles.tile}
                    onClick={() => selectPublisherTile(p.key)}
                    title={p.label}
                  >
                    <div>
                      <div style={styles.tileIcon}>{p.icon}</div>
                      <div>{p.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 14, fontSize: 12, color: "#6b7280" }}>
                Note: Twitch/YouTube/RTMP/SRT are still finished in
                StreamControl. Facebook is supported in-app.
              </div>
            </>
          ) : (
            <>
              <div style={styles.addStepWrap}>
                <div style={styles.leftPane}>
                  <button
                    style={styles.continueBtn}
                    onClick={() => {
                      if (selectedPubKey === "facebook") {
                        connectFacebook();
                        return;
                      }
                      openStreamControlChannelPage();
                    }}
                  >
                    {req?.button || "CONTINUE"} ↗
                  </button>

                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        marginBottom: 6,
                      }}
                    >
                      Display name (optional)
                    </div>
                    <input
                      value={pubDisplayName}
                      onChange={(e) => setPubDisplayName(e.target.value)}
                      placeholder="e.g. Bishop Robertson TV"
                      style={styles.nameInput}
                    />
                  </div>

                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Facebook connects inside your app. Other platforms complete
                    inside StreamControl.
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 10 }}>
                    {req?.title}
                  </div>
                  <ul
                    style={{ marginTop: 0, color: "#111827", lineHeight: 1.6 }}
                  >
                    {(req?.bullets || []).map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={styles.footerBar}>
                <button style={styles.smallBtn} onClick={() => setAddStep(1)}>
                  Back
                </button>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    style={styles.smallBtn}
                    onClick={() => setAddPubOpen(false)}
                  >
                    Close
                  </button>
                  <button
                    style={styles.primarySave}
                    onClick={savePublisherSelection}
                  >
                    Save
                  </button>
                </div>
              </div>
            </>
          )}
        </Modal>
      </div>

      <Toast
        open={toast.open}
        type={toast.type}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </>
  );
}
