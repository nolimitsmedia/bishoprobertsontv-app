// src/pages/studio/LiveEventPage.js
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../../api";

/* ── Page-scoped CSS to match LiveCreatePage ─────────────────────────────── */
const PAGE_CSS = `
  :root {
    --btn-h: 44px;
    --btn-radius: 12px;
    --btn-pad-x: 18px;
  }

  .chip-row {
    display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:16px;
  }
  .chip-btn {
    background:#f1f5f9; border:1px solid #e2e8f0; color:#0f172a;
    padding:8px 12px; border-radius:10px; font-weight:600; line-height:1;
    text-decoration:none; display:inline-flex; align-items:center; gap:6px;
  }
  .chip-btn:hover { background:#e8eef6; border-color:#d8e1ec; }

  .top-primary {
    background:#2563eb; color:#fff; font-weight:700; height:var(--btn-h); padding:0 var(--btn-pad-x);
    border:1px solid transparent; border-radius:var(--btn-radius);
    box-shadow:0 8px 16px -8px rgba(37,99,235,.55);
    display:inline-flex; align-items:center;
  }
  .top-primary:hover { background:#1e40af; }

  /* Copy button INSIDE inputs */
  .copy-field { position: relative; }
  .copy-field .auth-input { padding-right: 86px; }
  .copy-inside {
    position:absolute; right:6px; top:50%; transform:translateY(-50%);
    height:36px; min-width:64px; padding:0 12px; border-radius:10px; background:#ffffff;
    border:1px solid #e2e8f0; font-weight:700; cursor:pointer;
    display:inline-flex; align-items:center; justify-content:center;
  }
  .copy-inside:hover { background:#f8fafc; }
  .copy-inside.ok { border-color:#34d399; background:#ecfdf5; color:#065f46; }

  /* Buttons */
  .btn {
    height:var(--btn-h); border-radius:var(--btn-radius); padding:0 var(--btn-pad-x);
    font-weight:700; display:inline-flex; align-items:center; justify-content:center;
    border:1px solid transparent; cursor:pointer;
  }
  .btn.primary { background:#2563eb; color:#fff; }
  .btn.primary:hover { background:#1e40af; }
  .btn.outline { background:#fff; border-color:#e2e8f0; color:#0f172a; }
  .btn.danger { background:#ef4444; color:#fff; }
  .btn.wide { min-width: 170px; }
  .btn.xwide { min-width: 220px; }

  .btn-row { display:flex; flex-wrap:wrap; gap:12px; margin-top:18px; }

  .le-title { margin:0 0 6px; font-size:28px; font-weight:800; letter-spacing:-.01em; }
  .le-status { font-size:14px; color:#64748b; font-weight:600; margin-left:8px; }

  .le-grid { display:grid; gap:16px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 800px) { .le-grid { grid-template-columns: 1fr; } }

  .le-label { font-size:12px; color:#64748b; font-weight:700; letter-spacing:.02em; margin-bottom:6px; }
`;

/* ---------- Reusable field with copy (button inside input) ---------- */
function CopyInput({ label, value, onCopy, copied }) {
  return (
    <div>
      <div className="le-label">{label}</div>
      <div className="copy-field">
        <input
          className="auth-input"
          value={value || ""}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className={`copy-inside ${copied ? "ok" : ""}`}
          aria-label={`Copy ${label}`}
          title="Copy"
          onClick={onCopy}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function LiveEventPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [ev, setEv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");

  const watchUrl = useMemo(
    () => `${window.location.origin}/watch/live/${id}`,
    [id]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id) {
        setErr("Missing event id.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setErr("");
        const { data } = await api.get(`/live/events/${id}`);
        if (!alive) return;
        setEv(data || null);
      } catch (e) {
        if (alive) setErr("Failed to load event.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const refresh = async () => {
    try {
      const { data } = await api.get(`/live/events/${id}`);
      setEv(data || null);
    } catch {}
  };

  const doStart = async () => {
    try {
      setBusy(true);
      await api.post(`/live/events/${id}/start`);
      await refresh();
    } catch (e) {
      alert("Failed to mark as live.");
    } finally {
      setBusy(false);
    }
  };

  const doEnd = async () => {
    try {
      setBusy(true);
      const { data } = await api.post(`/live/events/${id}/end`);
      await refresh();
      if (data?.vod_video_id) {
        setTimeout(() => {
          if (window.confirm("VOD is created. Open the replay now?")) {
            window.open(`/watch/${data.vod_video_id}`, "_blank");
          }
        }, 100);
      }
    } catch (e) {
      alert("Failed to end the event.");
    } finally {
      setBusy(false);
    }
  };

  const copyText = async (key, text) => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 1200);
    } catch {}
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 40px" }}>
      <style>{PAGE_CSS}</style>

      <div className="chip-row">
        <button className="chip-btn" onClick={() => nav("/studio/live")}>
          ← Back to events
        </button>
        <a
          className="top-primary"
          href={watchUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open watch page
        </a>
      </div>

      <div className="card" style={{ padding: 20 }}>
        {loading ? (
          <div className="vd-muted">Loading…</div>
        ) : err ? (
          <div className="vd-muted">{err}</div>
        ) : !ev ? (
          <div className="vd-muted">Event not found.</div>
        ) : (
          <>
            <h2 className="le-title">
              {ev.title || "Untitled live"}
              <span className="le-status">({ev.status || "scheduled"})</span>
            </h2>

            <div className="le-grid">
              <CopyInput
                label="RTMP server"
                value={ev.rtmp_ingest || "rtmp://rtmp.livepeer.studio/live"}
                copied={copiedKey === "rtmp"}
                onCopy={() =>
                  copyText(
                    "rtmp",
                    ev.rtmp_ingest || "rtmp://rtmp.livepeer.studio/live"
                  )
                }
              />
              <CopyInput
                label="HLS playback (advanced)"
                value={ev.hls_url || ""}
                copied={copiedKey === "hls"}
                onCopy={() => copyText("hls", ev.hls_url || "")}
              />
              <CopyInput
                label="Stream key"
                value={ev.stream_key || ""}
                copied={copiedKey === "key"}
                onCopy={() => copyText("key", ev.stream_key || "")}
              />
              <CopyInput
                label="Share / watch link"
                value={watchUrl}
                copied={copiedKey === "watch"}
                onCopy={() => copyText("watch", watchUrl)}
              />
            </div>

            <div className="btn-row">
              <button
                className="btn primary wide"
                disabled={busy}
                onClick={doStart}
              >
                Mark as live
              </button>
              <button
                className="btn danger xwide"
                disabled={busy}
                onClick={doEnd}
              >
                End & Create VOD
              </button>
              <Link className="btn outline wide" to={watchUrl} target="_blank">
                Open watch page
              </Link>
            </div>

            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 12 }}>
              In OBS, set <b>Server</b> to the RTMP URL and <b>Stream Key</b> to
              the key above, then press <b>Start Streaming</b>.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
