// src/pages/public/LiveWatch.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import Hls from "hls.js";
import api from "../../api";

/* ---------------- utils ---------------- */
function apiOrigin() {
  try {
    const u = new URL(api.defaults.baseURL || "", window.location.href);
    return u.origin; // strip /api path
  } catch {
    return window.location.origin;
  }
}

async function attachHls(videoEl, src, onFatal) {
  if (!videoEl || !src) return null;

  if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
    videoEl.src = src;
    try {
      await videoEl.play();
    } catch {}
    return null;
  }

  if (Hls.isSupported()) {
    const hls = new Hls({
      liveSyncDuration: 2,
      enableWorker: true,
      maxBufferLength: 15,
    });
    hls.loadSource(src);
    hls.attachMedia(videoEl);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      videoEl.play().catch(() => {});
    });
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data?.fatal && typeof onFatal === "function") onFatal(data);
    });
    return hls;
  }

  videoEl.src = src;
  try {
    await videoEl.play();
  } catch {}
  return null;
}

/* ---------------- page ---------------- */
export default function LiveWatch() {
  const { id } = useParams();
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const socketRef = useRef(null);
  const chatBodyRef = useRef(null);

  const [ev, setEv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // prereg
  const [registered, setRegistered] = useState(false);
  const [reg, setReg] = useState({ name: "", email: "" });

  // chat
  const [chat, setChat] = useState([]);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  const playbackUrl = useMemo(() => {
    if (!ev?.playback_id) return "";
    return `https://livepeercdn.com/hls/${ev.playback_id}/index.m3u8`;
  }, [ev]);

  const showGate = useMemo(() => {
    if (!ev) return true;
    // Gate if not registered and (event is scheduled OR not public)
    return (
      !registered && (ev.status === "scheduled" || ev.visibility !== "public")
    );
  }, [ev, registered]);

  /* ----- load event ----- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/live/events/${id}`);
        if (!alive) return;
        setEv(data);
        setError("");
      } catch (e) {
        console.error(e);
        if (alive) setError("Failed to load event.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  /* ----- load chat history ----- */
  useEffect(() => {
    if (!id) return;
    api
      .get(`/live/events/${id}/chat?limit=200`)
      .then((r) => setChat(r.data?.items || []))
      .catch(() => {});
  }, [id]);

  /* ----- socket join ----- */
  useEffect(() => {
    if (!id) return;
    const s = io(apiOrigin(), { transports: ["websocket"] });
    socketRef.current = s;

    s.emit("chat:join", { eventId: Number(id), name: reg.name || "Viewer" });
    s.on("chat:new", (m) => {
      setChat((prev) => [...prev, m]);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ----- autoscroll chat ----- */
  useEffect(() => {
    const el = chatBodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  /* ----- attach HLS when allowed ----- */
  useEffect(() => {
    (async () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {}
        hlsRef.current = null;
      }
      if (!playbackUrl || showGate) return;
      const hls = await attachHls(videoRef.current, playbackUrl, () =>
        setError("Playback error. Please refresh.")
      );
      if (hls) hlsRef.current = hls;
    })();

    return () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {}
        hlsRef.current = null;
      }
    };
  }, [playbackUrl, showGate]);

  /* ----- actions ----- */
  async function doRegister(e) {
    e.preventDefault();
    try {
      await api.post(`/live/events/${id}/register`, reg);
      setRegistered(true);
      socketRef.current?.emit("chat:join", {
        eventId: Number(id),
        name: reg.name || "Viewer",
      });
    } catch {
      alert("Registration failed");
    }
  }

  function sendMessage() {
    const text = msg.trim();
    if (!text) return;
    setSending(true);
    socketRef.current?.emit(
      "chat:message",
      {
        eventId: Number(id),
        name: reg.name || "Viewer",
        message: text,
      },
      (ack) => {
        setSending(false);
        if (!ack?.ok) return alert("Message failed to send.");
        setMsg("");
      }
    );
  }

  /* ----- render ----- */
  if (loading) {
    return (
      <div className="lw-shell">
        <div className="card">Loading…</div>
        <Styles />
      </div>
    );
  }
  if (!ev) {
    return (
      <div className="lw-shell">
        <div className="card">Event not found.</div>
        <Styles />
      </div>
    );
  }

  return (
    <div className="lw-shell">
      <Styles />
      <div className="lw-grid">
        {/* Player / Gate */}
        <div className="card lw-card">
          <div className="lw-head">
            <h2 className="lw-title">
              {ev.title || "Live stream"}
              <span
                className={`lw-badge ${
                  (ev.status || "").toLowerCase() === "live" ? "live" : ""
                }`}
              >
                {(ev.status || "scheduled").toUpperCase()}
              </span>
            </h2>
            {ev.start_at ? (
              <div className="lw-start">
                Starts{" "}
                {new Date(ev.start_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            ) : null}
          </div>

          <div className="lw-player">
            {showGate ? (
              <div className="lw-gate">
                <div className="lw-gate-inner">
                  <h3 className="lw-gate-title">Save your spot</h3>
                  <p className="lw-muted">
                    Enter your name and email to unlock the stream and get a
                    reminder.
                  </p>
                  <form className="lw-form" onSubmit={doRegister}>
                    <input
                      className="lw-input"
                      placeholder="Your name"
                      value={reg.name}
                      onChange={(e) => setReg({ ...reg, name: e.target.value })}
                      required
                    />
                    <input
                      className="lw-input"
                      placeholder="Your email"
                      type="email"
                      value={reg.email}
                      onChange={(e) =>
                        setReg({ ...reg, email: e.target.value })
                      }
                      required
                    />

                    <div className="lw-form-row">
                      <a
                        className="lw-link"
                        href={`${api.defaults.baseURL}/live/events/${id}/register?ics=1`}
                      >
                        + Add to calendar (.ics)
                      </a>
                      <button className="pill-btn" type="submit">
                        Register
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : playbackUrl ? (
              <div className="lw-video-box">
                <video
                  ref={videoRef}
                  controls
                  playsInline
                  muted
                  crossOrigin="anonymous"
                />
              </div>
            ) : (
              <div className="lw-empty">
                Stream isn’t ready yet. Check back soon.
              </div>
            )}
          </div>

          {error && <div className="lw-error">{error}</div>}

          {ev.description && <p className="lw-desc">{ev.description}</p>}
        </div>

        {/* Chat */}
        <div className="card lw-chat">
          <div className="lw-chat-head">Live Chat</div>
          <div className="lw-chat-body" ref={chatBodyRef}>
            {chat.length === 0 ? (
              <div className="lw-muted center">
                No messages yet. Be the first to say hi!
              </div>
            ) : (
              chat.map((m) => (
                <div key={m.id} className="lw-bubble">
                  <div className="lw-bubble-head">
                    <span className="lw-name">{m.name || "Viewer"}</span>
                    <span className="lw-time">
                      {m.created_at
                        ? new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </div>
                  <div className="lw-bubble-text">{m.message}</div>
                </div>
              ))
            )}
          </div>

          <div className="lw-chat-send">
            <input
              className="lw-input"
              placeholder={showGate ? "Register to chat…" : "Say something…"}
              value={msg}
              disabled={showGate || sending}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => (e.key === "Enter" ? sendMessage() : null)}
            />
            <button
              className="pill-btn"
              disabled={showGate || sending || !msg.trim()}
              onClick={sendMessage}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- page-scoped styles ---------- */
function Styles() {
  return (
    <style>{`
      .lw-shell { max-width: 1200px; margin: 0 auto; padding: 16px; }
      .lw-grid {
        display: grid; gap: 16px;
        grid-template-columns: 1.8fr 1fr;
      }
      @media (max-width: 980px) {
        .lw-grid { grid-template-columns: 1fr; }
      }

      .lw-card { padding: 16px; }
      .lw-head { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
      .lw-title { margin:0; font-size:26px; font-weight:800; letter-spacing:-.01em; }
      .lw-badge {
        margin-left: 10px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 800;
        border-radius: 999px;
        background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0;
      }
      .lw-badge.live { background:#fee2e2; color:#991b1b; border-color:#fecaca; }

      .lw-start { color:#64748b; font-weight:600; }

      .lw-player { margin-top: 10px; }
      .lw-video-box {
        border-radius: 14px; overflow: hidden; background:#000;
        /* nice responsive 16:9 */
        position: relative; aspect-ratio: 16 / 9;
      }
      .lw-video-box video {
        position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain;
        background: #000;
      }

      /* GATE */
      .lw-gate {
        position: relative;
        border-radius: 14px;
        overflow: hidden;
        background: radial-gradient(120% 120% at 0% 0%, #0b1320 0%, #0f172a 60%, #0b1320 100%);
        color: #e5e7eb;
        padding: 28px 24px;
      }
      .lw-gate-inner { max-width: 560px; }
      .lw-gate-title { margin: 0 0 6px; font-size: 22px; font-weight: 800; }
      .lw-muted, .lw-desc { color:#64748b; }
      .lw-desc { margin-top: 12px; }
      .lw-error { margin-top: 8px; color:#b91c1c; font-weight:700; }
      .lw-empty { padding: 24px; text-align:center; color:#64748b; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; }

      .lw-form { display:grid; gap:10px; margin-top: 10px; }
      .lw-form-row { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }

      .lw-input {
        width: 100%;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 12px 14px;
        font-size: 14px;
        outline: none;
        transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
      }
      .lw-input:focus {
        border-color:#93c5fd;
        box-shadow:0 0 0 3px rgba(147,197,253,.45);
      }

      .pill-btn {
        background:#0b66ff; color:#fff; border:1px solid #0b66ff;
        padding:10px 16px; border-radius:12px; font-weight:800;
        transition: background .15s ease, box-shadow .15s ease, transform .02s ease;
      }
      .pill-btn:hover { background:#0958db; box-shadow:0 4px 14px rgba(9,88,219,.25); }
      .pill-btn:disabled { opacity:.6; cursor:not-allowed; }

      .lw-link { color:#2563eb; text-decoration:none; font-weight:700; }
      .lw-link:hover { text-decoration:underline; }

      /* CHAT */
      .lw-chat { display:flex; flex-direction:column; padding: 0; overflow:hidden; }
      .lw-chat-head {
        padding: 14px 16px;
        border-bottom: 1px solid #e5e7eb;
        font-weight: 800; letter-spacing:.01em;
      }
      .lw-chat-body {
        height: 420px; overflow-y:auto; padding:12px;
        background:#fcfdff;
      }
      .lw-bubble {
        background:#ffffff; border:1px solid #e5e7eb; border-radius:12px;
        padding:10px 12px; margin-bottom:8px;
        box-shadow: 0 1px 0 rgba(0,0,0,.02);
      }
      .lw-bubble-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
      .lw-name { font-weight:800; color:#0f172a; }
      .lw-time { color:#94a3b8; font-size:12px; font-weight:700; }
      .lw-bubble-text { color:#0f172a; }

      .lw-chat-send {
        display:flex; gap:8px; align-items:center;
        padding: 12px; border-top:1px solid #e5e7eb; background:#fff;
      }
      .lw-chat .lw-input { flex:1; }

      .center { text-align:center; }
    `}</style>
  );
}
