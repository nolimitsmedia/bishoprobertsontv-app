// src/pages/studio/LiveCreatePage.js
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";

/* ── Page-scoped CSS (outside component to avoid focus issues) ─────────── */
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
`;

function Wrap({ children }) {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 40px" }}>
      <style>{PAGE_CSS}</style>
      {children}
    </div>
  );
}

/* ---------- small helpers ---------- */
function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function CopyInput({ label, value, onCopy, copied }) {
  return (
    <Field label={label}>
      <div className="copy-field">
        <input
          className="auth-input"
          value={value || "—"}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className={`copy-inside ${copied ? "ok" : ""}`}
          onClick={onCopy}
          title="Copy to clipboard"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </Field>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

export default function LiveCreatePage() {
  const nav = useNavigate();

  // subscription gate
  const [sub, setSub] = useState(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [subErr, setSubErr] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/subscription/me");
        if (mounted) setSub(data || {});
      } catch (e) {
        if (mounted)
          setSubErr(e?.response?.data?.message || "Unable to check plan");
      } finally {
        if (mounted) setLoadingSub(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const planCode = useMemo(
    () => String(sub?.plan || sub?.plan_code || "").toLowerCase() || "free",
    [sub]
  );
  // Allow only paid/custom plans
  const canCreateLive = useMemo(
    () => ["starter", "pro", "custom"].includes(planCode),
    [planCode]
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");
  const [event, setEvent] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  // keep global hotkeys from interfering (doesn't affect focus)
  const stopHotkeys = useCallback((e) => {
    e.stopPropagation();
  }, []);

  async function createEvent(e) {
    e.preventDefault();
    setErr("");

    if (!canCreateLive) {
      setErr("Live streaming is not included in your current plan.");
      return;
    }

    try {
      setCreating(true);
      const { data } = await api.post("/live/events", {
        title: title || `Live ${new Date().toLocaleString()}`,
        description,
        visibility: "unlisted",
        is_premium: true,
        record: true,
      });
      setEvent(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e2) {
      if (e2?.response?.status === 402) {
        setErr(
          e2?.response?.data?.message ||
            "Live streaming is not included in your current plan."
        );
        try {
          const { data } = await api.get("/subscription/me");
          setSub(data || {});
        } catch {}
      } else {
        setErr(e2?.response?.data?.message || "Failed to create event");
      }
    } finally {
      setCreating(false);
    }
  }

  // Pull latest event row (used by polling + manual refresh)
  const refreshEvent = useCallback(
    async (id) => {
      try {
        const { data } = await api.get(`/live/events/${id}`);
        setEvent((prev) => ({ ...prev, ...data }));
      } catch {}
    },
    [setEvent]
  );

  // Light polling while the page is open so status updates if changed elsewhere
  useEffect(() => {
    if (!event?.id) return;
    const t = setInterval(() => refreshEvent(event.id), 5000);
    return () => clearInterval(t);
  }, [event?.id, refreshEvent]);

  async function markLive() {
    if (!event?.id) return;
    setActionBusy(true);
    try {
      const { data } = await api.post(`/live/events/${event.id}/start`);
      // IMPORTANT: update local state with server's latest status
      setEvent((prev) => ({ ...prev, ...data }));
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Failed to mark live");
    } finally {
      setActionBusy(false);
    }
  }

  async function endAndVod() {
    if (!event?.id) return;
    setActionBusy(true);
    try {
      const { data } = await api.post(`/live/events/${event.id}/end`, {});
      // Update local state so "(scheduled)" becomes "(ended)" immediately
      setEvent((prev) => ({ ...prev, ...data }));
      // If you'd still like to redirect, uncomment the next line:
      // nav("/studio/videos");
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Failed to end event");
    } finally {
      setActionBusy(false);
    }
  }

  // Copy helpers
  const [copiedKey, setCopiedKey] = useState("");
  const copyText = async (key, text) => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 1200);
    } catch {}
  };

  const watchUrl = event
    ? `${window.location.origin}/watch/live/${event.id}`
    : "";

  // Prefer VOD HLS after end; otherwise live HLS
  const playbackUrl = useMemo(() => {
    if (!event) return "";
    if (String(event.status) === "ended" && event.vod_hls_url)
      return event.vod_hls_url;
    return event.hls_url || "";
  }, [event]);

  const markDisabled =
    actionBusy || !event || event.status === "live" || event.status === "ended";
  const endDisabled = actionBusy || !event || event.status === "ended";

  return (
    <Wrap>
      <div className="chip-row">
        <Link className="chip-btn" to="/studio/live">
          ← Back to events
        </Link>
        {event ? (
          <Link className="top-primary" to={watchUrl}>
            Open watch page
          </Link>
        ) : (
          <span />
        )}
      </div>

      {!event ? (
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ margin: "0 0 12px 0" }}>Create a live event</h2>

          {(err || subErr) && (
            <div className="auth-alert" style={{ marginBottom: 14 }}>
              {err || subErr}
            </div>
          )}

          {!loadingSub && !canCreateLive && (
            <div
              className="auth-alert"
              style={{
                marginBottom: 14,
                background: "#fff7ed",
                borderColor: "#fdba74",
              }}
            >
              Live streaming is available on paid plans.
              <br />
              Your current plan: <b>{sub?.plan_title || planCode || "Free"}</b>.
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <Link className="btn primary" to="/account">
                  Upgrade plan
                </Link>
                <Link className="btn outline" to="/studio/videos">
                  Go to videos
                </Link>
              </div>
            </div>
          )}

          <form onSubmit={createEvent}>
            <div style={{ marginBottom: 16 }}>
              <label
                className="auth-label"
                htmlFor="live-title"
                style={{ display: "block" }}
              >
                Title
              </label>
              <input
                id="live-title"
                name="title"
                className="auth-input"
                type="text"
                autoComplete="off"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={stopHotkeys}
                placeholder="Sunday Service"
                disabled={loadingSub || !canCreateLive}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                className="auth-label"
                htmlFor="live-desc"
                style={{ display: "block" }}
              >
                Description <span className="vd-muted">(optional)</span>
              </label>
              <textarea
                id="live-desc"
                name="description"
                className="auth-input"
                rows={4}
                autoComplete="off"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={stopHotkeys}
                placeholder="A short description…"
                disabled={loadingSub || !canCreateLive}
              />
            </div>

            <button
              type={canCreateLive ? "submit" : "button"}
              className="btn primary xwide"
              disabled={creating || loadingSub}
              style={{ width: "100%", opacity: canCreateLive ? 1 : 0.8 }}
              title={
                canCreateLive
                  ? "Create event"
                  : "Upgrade your plan to create live events"
              }
              onClick={(e) => {
                if (!canCreateLive) {
                  e.preventDefault();
                  setErr(
                    "Live streaming is not included in your current plan."
                  );
                }
              }}
            >
              {creating
                ? "Creating…"
                : canCreateLive
                ? "Create event"
                : "Upgrade to create live events"}
            </button>
          </form>
        </div>
      ) : (
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ margin: 0, marginBottom: 6 }}>
            {event.title || "Live Event"}
            {event.status ? (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 14,
                  color: "#64748b",
                  fontWeight: 600,
                }}
              >
                ({String(event.status)})
              </span>
            ) : null}
          </h2>

          {err && (
            <div className="auth-alert" style={{ marginBottom: 14 }}>
              {err}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            }}
          >
            <CopyInput
              label="RTMP server"
              value={event.rtmp_ingest || "rtmp://rtmp.livepeer.studio/live"}
              copied={copiedKey === "rtmp"}
              onCopy={() =>
                copyText(
                  "rtmp",
                  event.rtmp_ingest || "rtmp://rtmp.livepeer.studio/live"
                )
              }
            />

            <CopyInput
              label={
                event.status === "ended"
                  ? "HLS playback (replay)"
                  : "HLS playback (advanced)"
              }
              value={playbackUrl}
              copied={copiedKey === "hls"}
              onCopy={() => copyText("hls", playbackUrl)}
            />

            <CopyInput
              label="Stream key"
              value={event.stream_key || ""}
              copied={copiedKey === "key"}
              onCopy={() => copyText("key", event.stream_key || "")}
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
              onClick={markLive}
              disabled={markDisabled}
              title={
                event?.status === "live"
                  ? "Already live"
                  : event?.status === "ended"
                  ? "Stream has ended"
                  : "Mark event as live"
              }
            >
              {actionBusy && event?.status !== "live"
                ? "Working…"
                : "Mark as live"}
            </button>
            <button
              className="btn danger xwide"
              onClick={endAndVod}
              disabled={endDisabled}
              title={event?.status === "ended" ? "Already ended" : "End stream"}
            >
              {actionBusy && event?.status !== "ended"
                ? "Ending…"
                : "End & Create VOD"}
            </button>
            <Link className="btn outline wide" to={watchUrl}>
              Open watch page
            </Link>
            <button
              className="btn outline"
              onClick={() => refreshEvent(event.id)}
              disabled={actionBusy}
              title="Refresh event status"
            >
              Refresh status
            </button>
          </div>

          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 12 }}>
            In OBS, set <b>Server</b> to the RTMP URL and <b>Stream Key</b> to
            the key above, then press <b>Start Streaming</b>.
          </div>
        </div>
      )}
    </Wrap>
  );
}
