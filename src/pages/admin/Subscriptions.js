// src/pages/admin/Subscriptions.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";

/* ------------------------------ helpers ------------------------------ */
const fmtMoney = (cents) =>
  (Number(cents || 0) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

const badge = (text, color) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      background: `${color}20`,
      color,
    }}
  >
    {text}
  </span>
);

function buildPublicLink(plan) {
  const base = window.location.origin;
  return `${base}/subscribe/${plan.id || plan._id}`;
}

/* ------------------------------ Confirm modal ------------------------------ */
function Modal({ open, title, onClose, children, width = 480 }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          width,
          maxWidth: "96vw",
          maxHeight: "88vh",
          overflow: "auto",
          padding: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 18 }}>{title}</div>
          <button className="btn ghost small" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Confirm({ open, title, message, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <Modal open title={title} onClose={onCancel}>
      <div style={{ color: "#6b7280", marginBottom: 16 }}>{message}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn danger" onClick={onConfirm}>
          Delete
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------ Floating kebab menu ------------------------------ */
const MENU_W = 220;
function KebabMenu({
  open,
  x,
  y,
  onClose,
  onEdit,
  onDuplicate,
  onCopy,
  onDelete,
}) {
  if (!open) return null;

  const left = Math.max(8, Math.min(x, window.innerWidth - (MENU_W + 8)));
  const top = Math.max(8, y);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          position: "fixed",
          left,
          top,
          width: MENU_W,
          borderRadius: 12,
          border: "1px solid var(--line)",
          boxShadow: "0 12px 24px rgba(0,0,0,.12)",
          padding: 6,
          background: "#fff",
        }}
      >
        <MenuItem onClick={onEdit}>Edit</MenuItem>
        <MenuItem onClick={onDuplicate}>Duplicate</MenuItem>
        <MenuItem onClick={onCopy}>Copy link</MenuItem>
        <MenuItem onClick={onDelete} danger>
          Delete
        </MenuItem>
      </div>
    </div>
  );
}

function MenuItem({ children, onClick, danger }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      className="menu-item"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "9px 12px",
        borderRadius: 8,
        background: hover ? "#f3f4f6" : "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: 14,
        color: danger ? "#ef4444" : "inherit",
        display: "block",
      }}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Main page ------------------------------ */
export default function Subscriptions() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [metrics, setMetrics] = useState({
    in_trial: 0,
    active_subscribers: 0,
    mrr_cents: 0,
  });

  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState({ open: false, id: null });

  // floating menu state
  const [menu, setMenu] = useState({ open: false, id: null, x: 0, y: 0 });

  // pagination (lightweight)
  const [page, setPage] = useState(1);
  const pageSize = 20;

  async function load() {
    try {
      setLoading(true);
      const { data } = await api.get("/subscription/plans", {
        params: { q: search, limit: 500 },
      });
      const items = Array.isArray(data?.items) ? data.items : data || [];
      setPlans(items);
      if (data?.metrics) setMetrics(data.metrics);
      setPage(1);
    } catch (e) {
      console.error("load plans error:", e);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return plans;
    return plans.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }, [plans, search]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  async function duplicatePlan(id) {
    try {
      await api.post(`/subscription/plans/${id}/duplicate`);
      await load();
    } catch (e) {
      console.error("duplicate plan error:", e);
      alert(e?.response?.data?.message || "Duplicate failed");
    }
  }

  async function removePlan(id) {
    try {
      await api.delete(`/subscription/plans/${id}`);
      setConfirm({ open: false, id: null });
      await load();
    } catch (e) {
      console.error("delete plan error:", e);
      alert(e?.response?.data?.message || "Delete failed");
    }
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ margin: 0, fontWeight: 800 }}>Subscription plans</h2>
        <button className="btn" onClick={() => navigate("/subscriptions/new")}>
          + New plan
        </button>
      </div>

      {/* Metrics cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        <div className="card">
          <div className="vd-muted vd-small" style={{ marginBottom: 8 }}>
            In Trial
          </div>
          <div style={{ fontWeight: 800, fontSize: 22 }}>
            {metrics.in_trial}
          </div>
          <div className="vd-muted vd-small" style={{ marginTop: 6 }}>
            <button className="btn small ghost">See Breakdown ▸</button>
          </div>
        </div>
        <div className="card">
          <div className="vd-muted vd-small" style={{ marginBottom: 8 }}>
            Active Subscribers
          </div>
          <div style={{ fontWeight: 800, fontSize: 22 }}>
            {metrics.active_subscribers}
          </div>
          <div className="vd-muted vd-small" style={{ marginTop: 6 }}>
            <button className="btn small ghost">See Breakdown ▸</button>
          </div>
        </div>
        <div className="card">
          <div className="vd-muted vd-small" style={{ marginBottom: 8 }}>
            Current MRR
          </div>
          <div style={{ fontWeight: 800, fontSize: 22 }}>
            {fmtMoney(metrics.mrr_cents)}
          </div>
          <div className="vd-muted vd-small" style={{ marginTop: 6 }}>
            <button className="btn small ghost">See Breakdown ▸</button>
          </div>
        </div>
      </div>

      {/* Search + table */}
      <div className="card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <input
            className="search"
            placeholder="Search…"
            style={{ maxWidth: 380 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <button className="btn ghost" onClick={load}>
            Refresh
          </button>
          <div style={{ marginLeft: "auto" }}>
            <span className="vd-muted vd-small">
              {filtered.length} plan{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="vd-muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="vd-muted">No plans yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid var(--line)",
                    color: "#6b7280",
                  }}
                >
                  <th style={{ padding: "10px 8px" }}>Title</th>
                  <th style={{ padding: "10px 8px" }}>Status</th>
                  {/* NEW: Tier & Features columns */}
                  <th style={{ padding: "10px 8px" }}>Tier</th>
                  <th style={{ padding: "10px 8px" }}>Features</th>
                  <th style={{ padding: "10px 8px" }}>In Trial</th>
                  <th style={{ padding: "10px 8px" }}>Total</th>
                  <th style={{ padding: "10px 8px" }}>Content</th>
                  <th style={{ padding: "10px 8px" }}>Price</th>
                  <th style={{ padding: "10px 8px" }}>Duration</th>
                  <th style={{ padding: "10px 8px" }} />
                </tr>
              </thead>
              <tbody>
                {paged.map((p) => {
                  const id = p.id || p._id;
                  return (
                    <tr
                      key={id}
                      style={{ borderBottom: "1px solid var(--line)" }}
                    >
                      <td style={{ padding: "12px 8px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 64,
                              height: 40,
                              borderRadius: 6,
                              overflow: "hidden",
                              background: "#f3f4f6",
                              border: "1px solid var(--line)",
                              display: "grid",
                              placeItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            {p.thumbnail_url ? (
                              <img
                                src={
                                  p.thumbnail_url.startsWith("http")
                                    ? p.thumbnail_url
                                    : `/${p.thumbnail_url}`
                                }
                                alt=""
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <span className="vd-small vd-muted">—</span>
                            )}
                          </div>
                          <div>
                            <button
                              className="btn linklike"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/subscriptions/plan/${id}`);
                              }}
                              style={{
                                fontWeight: 700,
                                padding: 0,
                                background: "none",
                                border: "none",
                                color: "var(--link, #2563eb)",
                                cursor: "pointer",
                              }}
                            >
                              {p.title}
                            </button>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "12px 8px" }}>
                        {p.status === "public"
                          ? badge("PUBLIC", "#10b981")
                          : p.status === "private"
                          ? badge("PRIVATE", "#6b7280")
                          : badge("ARCHIVED", "#ef4444")}
                      </td>

                      {/* NEW: Tier */}
                      <td style={{ padding: "12px 8px" }}>
                        {p.tier === "enterprise"
                          ? "Enterprise"
                          : p.tier === "pro"
                          ? "Pro"
                          : "Starter"}
                      </td>

                      {/* NEW: Features summary */}
                      <td style={{ padding: "12px 8px" }}>
                        {p.features?.mobile_tv_apps
                          ? "Mobile/TV ✓"
                          : "Mobile/TV —"}
                        {" · "}
                        {p.features?.custom_option ? "Custom ✓" : "Custom —"}
                      </td>

                      <td style={{ padding: "12px 8px" }}>
                        {p.in_trial_days ? `${p.in_trial_days} days` : "—"}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {p.total_subscribers ?? 0}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {p.content_count ?? 0}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {fmtMoney(p.price_cents)}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {p.interval === "year" ? "Yearly" : "Monthly"}
                      </td>

                      <td style={{ padding: "12px 8px", textAlign: "right" }}>
                        <button
                          className="btn ghost small"
                          title="More actions"
                          style={{
                            width: 32,
                            height: 32,
                            display: "grid",
                            placeItems: "center",
                            padding: 0,
                            borderRadius: 8,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const r = e.currentTarget.getBoundingClientRect();
                            setMenu((m) =>
                              m.open && m.id === id
                                ? { open: false, id: null, x: 0, y: 0 }
                                : {
                                    open: true,
                                    id,
                                    x: r.left + r.width - MENU_W,
                                    y: r.bottom + 8,
                                  }
                            );
                          }}
                        >
                          <span style={{ fontSize: 18, lineHeight: 1 }}>⋮</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 6,
                  marginTop: 10,
                }}
              >
                <button
                  className="btn small ghost"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  ◂
                </button>
                <div
                  className="vd-muted vd-small"
                  style={{ padding: "8px 6px" }}
                >
                  Page {page} / {totalPages}
                </div>
                <button
                  className="btn small ghost"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  ▸
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating 3-dots menu */}
      <KebabMenu
        open={menu.open}
        x={menu.x}
        y={menu.y}
        onClose={() => setMenu({ open: false, id: null, x: 0, y: 0 })}
        onEdit={() => {
          const id = menu.id;
          setMenu({ open: false, id: null, x: 0, y: 0 });
          navigate(`/subscriptions/plan/${id}`);
        }}
        onDuplicate={async () => {
          const id = menu.id;
          setMenu({ open: false, id: null, x: 0, y: 0 });
          await duplicatePlan(id);
        }}
        onCopy={async () => {
          const item = plans.find((p) => (p.id || p._id) === menu.id);
          const link = item ? buildPublicLink(item) : "";
          setMenu({ open: false, id: null, x: 0, y: 0 });
          try {
            await navigator.clipboard.writeText(link);
          } catch {
            window.prompt("Copy link", link);
          }
        }}
        onDelete={() => {
          const id = menu.id;
          setMenu({ open: false, id: null, x: 0, y: 0 });
          setConfirm({ open: true, id });
        }}
      />

      {/* Delete confirm */}
      <Confirm
        open={confirm.open}
        title="Delete plan"
        message="This will permanently delete the plan. Are you sure?"
        onCancel={() => setConfirm({ open: false, id: null })}
        onConfirm={() => removePlan(confirm.id)}
      />
    </div>
  );
}

/* Tip:
   Add this to global CSS if you want the link-like button style reused:
   .btn.linklike { color:#2563eb; background:none; border:none; padding:0 }
*/
