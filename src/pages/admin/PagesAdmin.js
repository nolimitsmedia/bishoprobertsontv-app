// src/pages/admin/PagesAdmin.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./PagesAdmin.css";

function safe(v) {
  return String(v ?? "");
}

function fmtDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString();
}

function normalizeAccessLabel(v) {
  const x = String(v || "").toLowerCase();
  if (x === "members") return "Members";
  if (x === "admin") return "Admin";
  return "Public";
}

function normalizeStatusLabel(published, status) {
  const s = String(status || "").toLowerCase();
  if (s === "deleted") return "Deleted";
  if (published) return "Published";
  return "Draft";
}

/* -----------------------------------------
   Modern Loading Spinner + Skeleton shimmer
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

function Shimmer({ style }) {
  return (
    <div
      style={{
        borderRadius: 10,
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 100%)",
        backgroundSize: "200% 100%",
        animation: "brtv-shimmer 1.2s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

function SkeletonRow() {
  return (
    <div className="pg-row pg-row--skeleton" aria-busy="true">
      <div className="pg-left">
        <Shimmer style={{ width: 220, height: 14 }} />
        <div style={{ height: 8 }} />
        <Shimmer style={{ width: 140, height: 12, opacity: 0.85 }} />
      </div>
      <div className="pg-right">
        <Shimmer style={{ width: 90, height: 28, borderRadius: 999 }} />
        <Shimmer style={{ width: 90, height: 28, borderRadius: 999 }} />
        <Shimmer style={{ width: 90, height: 28, borderRadius: 999 }} />
      </div>
    </div>
  );
}

const EMPTY_CREATE = {
  title: "",
  slug: "",
  access: "public",
};

export default function PagesAdmin() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [pages, setPages] = useState([]);

  // filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all"); // all | published | draft
  const [access, setAccess] = useState("all"); // all | public | members | admin

  // create modal
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_CREATE });

  async function fetchPages() {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status !== "all") {
        if (status === "published") params.set("published", "true");
        if (status === "draft") params.set("published", "false");
      }
      if (access !== "all") params.set("access", access);

      const res = await api.get(`/admin/pages?${params.toString()}`);
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Failed to load pages.");
      setPages(Array.isArray(res.data.pages) ? res.data.pages : []);
    } catch (e) {
      setPages([]);
      setErr(
        e?.response?.data?.message || e?.message || "Failed to load pages."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setForm({ ...EMPTY_CREATE });
    setOpen(true);
  }

  function closeCreate() {
    if (saving) return;
    setOpen(false);
  }

  async function onCreate(e) {
    e.preventDefault();
    if (saving) return;

    const title = safe(form.title).trim();
    const slug = safe(form.slug).trim();
    const accessVal = safe(form.access).toLowerCase() || "public";

    if (!title) return alert("Title is required.");
    if (!slug)
      return alert("Slug is required. Example: about, contact, giving");

    setSaving(true);
    try {
      const res = await api.post("/admin/pages", {
        title,
        slug,
        access: accessVal,
        status: "draft",
        published: false,
      });
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Create failed");
      setOpen(false);
      await fetchPages();
    } catch (e2) {
      alert(
        e2?.response?.data?.message || e2?.message || "Failed to create page."
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(p) {
    const nextPublished = !p.published;
    try {
      const res = await api.put(`/admin/pages/${p.id}`, {
        published: nextPublished,
        status: nextPublished ? "published" : "draft",
      });
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Update failed");
      setPages((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, ...res.data.page } : x))
      );
    } catch (e) {
      alert(
        e?.response?.data?.message || e?.message || "Failed to update page."
      );
    }
  }

  async function onDelete(p) {
    if (!window.confirm("Delete this page?")) return;
    try {
      const res = await api.delete(`/admin/pages/${p.id}`);
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Delete failed");
      setPages((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {
      alert(
        e?.response?.data?.message || e?.message || "Failed to delete page."
      );
    }
  }

  const filteredCount = useMemo(() => pages.length, [pages]);

  return (
    <div className="pg-page">
      <div className="pg-wrap">
        <div className="pg-top">
          <div className="pg-topLeft">
            {/* <div className="pg-kicker">ADMIN</div> */}
            <h1 className="pg-title">Pages</h1>
            <p className="pg-sub">
              Create and manage additional website pages, then design them in
              the builder.
            </p>
          </div>
          <div className="pg-topRight">
            <button className="pg-btn pg-btn--primary" onClick={openCreate}>
              + New page
            </button>
          </div>
        </div>

        <div className="pg-filters">
          <div className="pg-search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search pages…"
            />
            <button className="pg-btn pg-btn--ghost" onClick={fetchPages}>
              Search
            </button>
          </div>

          <div className="pg-selects">
            <div className="pg-select">
              <label>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">All</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            <div className="pg-select">
              <label>Access</label>
              <select
                value={access}
                onChange={(e) => setAccess(e.target.value)}
              >
                <option value="all">All</option>
                <option value="public">Public</option>
                <option value="members">Members</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button className="pg-btn pg-btn--ghost" onClick={fetchPages}>
              Apply
            </button>

            <div className="pg-pill">
              <span>Showing</span>
              <b>{filteredCount}</b>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="pg-card">
            <div style={{ padding: 6 }}>
              <CircularSpinner label="Loading pages…" />
            </div>
            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          </div>
        ) : err ? (
          <div className="pg-card pg-card--error">
            <div className="pg-errorTitle">We couldn’t load pages.</div>
            <div className="pg-errorText">{err}</div>
            <div className="pg-muted" style={{ marginTop: 10 }}>
              Make sure backend route exists: <b>/api/admin/pages</b>
            </div>
          </div>
        ) : pages.length === 0 ? (
          <div className="pg-card">
            <div className="pg-emptyTitle">No pages yet</div>
            <div className="pg-muted">
              Click “New page” to add your first page.
            </div>
          </div>
        ) : (
          <div className="pg-card">
            <div className="pg-list">
              {pages.map((p) => {
                const statusLabel = normalizeStatusLabel(p.published, p.status);
                const accessLabel = normalizeAccessLabel(p.access);
                return (
                  <div key={p.id} className="pg-row">
                    <div className="pg-left">
                      <div className="pg-name">{p.title || "Untitled"}</div>
                      <div className="pg-meta">
                        <span
                          className={`pg-badge ${
                            p.published ? "is-published" : "is-draft"
                          }`}
                        >
                          {statusLabel}
                        </span>
                        <span className="pg-badge is-access">
                          {accessLabel}
                        </span>
                        <span className="pg-muted">/{p.slug}</span>
                        <span className="pg-muted">
                          • Updated: {fmtDate(p.updated_at || p.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="pg-right">
                      <button
                        className="pg-btn pg-btn--ghost"
                        onClick={() => nav(`/admin/pages/${p.id}/edit`)}
                      >
                        Edit
                      </button>
                      <button
                        className="pg-btn pg-btn--ghost"
                        onClick={() => togglePublish(p)}
                      >
                        {p.published ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        className="pg-btn pg-btn--danger"
                        onClick={() => onDelete(p)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Create modal */}
        {open ? (
          <div className="pg-modalOverlay" onMouseDown={closeCreate}>
            <div
              className="pg-modal"
              onMouseDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="pg-modalHead">
                <div>
                  <div className="pg-modalTitle">New page</div>
                  <div className="pg-muted">
                    Create a page, then design it in the builder.
                  </div>
                </div>
                <button
                  className="pg-x"
                  onClick={closeCreate}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <form className="pg-form" onSubmit={onCreate}>
                <div className="pg-field">
                  <label>Title</label>
                  <input
                    value={form.title}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, title: e.target.value }))
                    }
                    placeholder="e.g., About"
                  />
                </div>

                <div className="pg-field">
                  <label>Slug</label>
                  <input
                    value={form.slug}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, slug: e.target.value }))
                    }
                    placeholder="e.g., about"
                  />
                  <div className="pg-muted" style={{ marginTop: 6 }}>
                    This becomes the URL: <b>/#/p/about</b>
                  </div>
                </div>

                <div className="pg-field">
                  <label>Access</label>
                  <select
                    value={form.access}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, access: e.target.value }))
                    }
                  >
                    <option value="public">Public</option>
                    <option value="members">Members</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="pg-actions">
                  <button
                    type="button"
                    className="pg-btn pg-btn--ghost"
                    onClick={closeCreate}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="pg-btn pg-btn--primary"
                    disabled={saving}
                  >
                    {saving ? "Creating…" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
