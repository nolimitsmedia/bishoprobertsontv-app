// src/pages/studio/LiveEventsPage.js
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";

/* ---------- small hooks / bits ---------- */
function useIsNarrow(bp = 720) {
  const [narrow, setNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth <= bp : false
  );
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= bp);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bp]);
  return narrow;
}

function StatusBadge({ status }) {
  const s = String(status || "scheduled").toLowerCase();
  const tone = s === "live" ? "live" : s === "ended" ? "ended" : "scheduled";
  return <span className={`le-badge ${tone}`}>{s}</span>;
}

/* ---------- Confirm modal ---------- */
function ConfirmModal({
  open,
  title = "Are you sure?",
  message,
  confirmText = "Delete",
  onConfirm,
  onCancel,
  busy = false,
}) {
  const overlayRef = useRef(null);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") {
        onConfirm?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <>
      <style>{`
        .cm-overlay {
          position: fixed; inset: 0; background: rgba(15, 23, 42, .55);
          display: grid; place-items: center; z-index: 50;
        }
        .cm-modal {
          background: #ffffff; border-radius: 14px; width: min(520px, 92vw);
          box-shadow: 0 20px 60px rgba(2, 6, 23, .25);
          padding: 18px;
        }
        .cm-title { font-size: 18px; font-weight: 800; margin: 4px 0 6px; }
        .cm-body { color:#475569; margin-bottom: 14px; line-height: 1.45; }
        .cm-row { display:flex; gap:8px; justify-content:flex-end; }
        .cm-btn { border:1px solid #e2e8f0; background:#f8fafc; padding:8px 12px; border-radius:10px; font-weight:700; }
        .cm-btn:hover { background:#eef3f9; }
        .cm-btn.ghost { background:#fff; }
        .cm-btn.danger { background:#fff1f2; border-color:#fecdd3; color:#b91c1c; }
        .cm-btn.danger:hover { background:#ffe4e6; }
        .cm-btn[disabled] { opacity:.6; cursor:not-allowed; }
      `}</style>

      <div
        className="cm-overlay"
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => {
          if (e.target === overlayRef.current) onCancel?.();
        }}
      >
        <div className="cm-modal">
          <div className="cm-title">{title}</div>
          {message && <div className="cm-body">{message}</div>}
          <div className="cm-row">
            <button className="cm-btn ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button
              className="cm-btn danger"
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? "Deleting…" : confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- Page ---------- */
export default function LiveEventsPage() {
  const nav = useNavigate();
  const isNarrow = useIsNarrow();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null); // {id, title}
  const [busyDelete, setBusyDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      const { data } = await api.get("/live/events");
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      console.error("GET /live/events failed:", e);
      setErr("Failed to load events.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function askRemove(id, title) {
    setToDelete({ id, title });
    setConfirmOpen(true);
  }

  async function doRemove() {
    if (!toDelete?.id) return;
    try {
      setBusyDelete(true);
      await api.delete(`/live/events/${toDelete.id}`);
      setItems((prev) => prev.filter((x) => x.id !== toDelete.id));
      setConfirmOpen(false);
      setToDelete(null);
    } catch (e) {
      console.warn("Delete failed:", e?.response || e);
      alert(
        e?.response?.data?.message ||
          "Delete failed (this server may not support deleting live events)."
      );
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      {/* page-scoped styles */}
      <style>{`
        .le-top { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:12px; }
        .chip-btn {
          background:#f1f5f9; border:1px solid #e2e8f0; color:#0f172a;
          padding:8px 12px; border-radius:10px; font-weight:600; line-height:1;
          text-decoration:none; display:inline-flex; align-items:center; gap:6px;
          transition:background .15s ease, border-color .15s ease, transform .02s ease;
          white-space:nowrap;
        }
        .chip-btn:hover { background:#e8eef6; border-color:#d8e1ec; }
        .chip-btn:active { transform:translateY(0.5px); }
        .le-actions { display:flex; gap:8px; flex-wrap:wrap; }
        .le-btn {
          background:#f8fafc; border:1px solid #e2e8f0; padding:8px 12px;
          border-radius:10px; font-weight:600; cursor:pointer;
        }
        .le-btn:hover { background:#eef3f9; }
        .le-btn.danger { background:#fff1f2; border-color:#fecdd3; color:#b91c1c; }
        .le-btn.danger:hover { background:#ffe4e6; }
        .le-badge {
          padding:2px 8px; border-radius:999px; font-size:12px; font-weight:700; text-transform:uppercase;
        }
        .le-badge.live { background:#ecfeff; color:#155e75; border:1px solid #a5f3fc; }
        .le-badge.scheduled { background:#f1f5f9; color:#334155; border:1px solid #e2e8f0; }
        .le-badge.ended { background:#fef2f2; color:#7f1d1d; border:1px solid #fecaca; }

        /* table */
        .le-table { width:100%; border-collapse:collapse; font-size:14px; }
        .le-table th { text-align:left; color:#64748b; font-weight:700; padding:10px 8px; }
        .le-table td { padding:12px 8px; border-top:1px solid var(--line, #e5e7eb); vertical-align:middle; }
        .le-title { font-weight:700; text-decoration:none; color:inherit; }
        .le-title:hover { text-decoration:underline; }

        /* responsive: render list cards on narrow screens */
        .le-list { display:grid; gap:12px; }
        .le-item {
          border:1px solid #e5e7eb; border-radius:12px; padding:12px 12px;
          background:#fff;
          display:grid; gap:8px;
          grid-template-columns: 1fr auto;
          align-items:center;
        }
        .le-item .le-meta { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        @media (max-width:720px) {
          .le-item { grid-template-columns: 1fr; }
          .le-item .le-actions { justify-content:flex-start; }
        }
      `}</style>

      <div className="le-top">
        <button className="chip-btn" onClick={() => nav("/account")}>
          ← Back to account
        </button>
        <button
          className="btn primary create-live-event"
          onClick={() => nav("/studio/live/new")}
        >
          Create live event
        </button>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0, marginBottom: 10 }}>Live events</h2>

        {loading ? (
          <div className="vd-muted">Loading…</div>
        ) : err ? (
          <div className="vd-muted">{err}</div>
        ) : items.length === 0 ? (
          <div className="vd-muted">No events yet.</div>
        ) : isNarrow ? (
          /* Mobile / narrow layout as cards */
          <div className="le-list">
            {items.map((ev) => (
              <div key={ev.id} className="le-item">
                <div className="le-meta">
                  <Link to={`/studio/live/${ev.id}`} className="le-title">
                    {ev.title || "Untitled live"}
                  </Link>
                  <StatusBadge status={ev.status} />
                </div>
                <div className="le-actions">
                  <button
                    className="le-btn"
                    onClick={() => nav(`/studio/live/${ev.id}`)}
                  >
                    Manage
                  </button>
                  <a
                    className="le-btn"
                    href={`/watch/live/${ev.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                  <button
                    className="le-btn danger"
                    onClick={() => askRemove(ev.id, ev.title)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop table */
          <table className="le-table">
            <thead>
              <tr>
                <th style={{ width: "55%" }}>Title</th>
                <th style={{ width: "15%" }}>Status</th>
                <th style={{ width: "30%" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <Link to={`/studio/live/${ev.id}`} className="le-title">
                      {ev.title || "Untitled live"}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge status={ev.status} />
                  </td>
                  <td>
                    <div className="le-actions">
                      <button
                        className="le-btn"
                        onClick={() => nav(`/studio/live/${ev.id}`)}
                      >
                        Manage
                      </button>
                      <a
                        className="le-btn"
                        href={`/watch/live/${ev.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                      <button
                        className="le-btn danger"
                        onClick={() => askRemove(ev.id, ev.title)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        open={confirmOpen}
        title="Delete live event?"
        message={
          toDelete
            ? `This will permanently delete “${
                toDelete.title || "Untitled live"
              }”. This action cannot be undone.`
            : ""
        }
        confirmText="Delete event"
        onCancel={() => {
          if (busyDelete) return;
          setConfirmOpen(false);
          setToDelete(null);
        }}
        onConfirm={doRemove}
        busy={busyDelete}
      />
    </div>
  );
}
