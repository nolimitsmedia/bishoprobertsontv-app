// src/pages/admin/Resources.js
import React, { useEffect, useMemo, useState } from "react";
import api, { uploadApi } from "../../api";
import "./Resources.css";

const TYPE_OPTIONS = [
  { value: "doc", label: "Doc" },
  { value: "image", label: "Image" },
  { value: "link", label: "Link" },
  { value: "pdf", label: "PDF" },
  { value: "zip", label: "ZIP" },
  { value: "other", label: "Other" },
];

const ACCESS_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "members", label: "Members" },
  { value: "admin", label: "Admin" },
];

function safe(v) {
  return String(v ?? "");
}

function normType(v) {
  const t = String(v || "").toLowerCase();
  return t || "link";
}

function normAccessFromResource(r) {
  // support both field names coming from backend
  const v = String(r?.access ?? r?.visibility ?? "").toLowerCase();
  if (v === "members" || v === "member") return "members";
  if (v === "admin") return "admin";
  return "public";
}

function accessLabel(v) {
  const x = String(v || "").toLowerCase();
  if (x === "members") return "Members";
  if (x === "admin") return "Admin";
  return "Public";
}

function isUploadType(t) {
  const v = String(t || "").toLowerCase();
  return v !== "link"; // everything except link uses upload field
}

const EMPTY_FORM = {
  title: "",
  type: "doc",
  url: "",
  description: "",
  access: "public", // UI field
  video_id: "",
  category_id: "",
  sort_order: "0", // keep as string to avoid controlled/uncontrolled warnings
  is_active: true,
};

/* -----------------------------------------
   Modern Loading Spinner (matches other admin pages)
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

/* -----------------------------------------
   Skeleton Shimmer (keeps existing layout)
----------------------------------------- */
function ShimmerBlock({ style }) {
  return (
    <>
      <style>{`
        @keyframes brtv-shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }
      `}</style>
      <div
        style={{
          borderRadius: 10,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 100%)",
          backgroundSize: "200% 100%",
          animation: "brtv-shimmer 1.15s ease-in-out infinite",
          ...style,
        }}
      />
    </>
  );
}

function SkeletonResourceCard({ i = 0 }) {
  // Mimic .res-item layout without touching CSS
  return (
    <div className="res-item" aria-busy="true" style={{ cursor: "default" }}>
      <div className="res-itemTop">
        <ShimmerBlock
          style={{
            width: 72,
            height: 22,
            borderRadius: 999,
          }}
        />
        <ShimmerBlock
          style={{
            width: 70,
            height: 22,
            borderRadius: 999,
            opacity: 0.95,
          }}
        />
      </div>

      <div className="res-itemTitle">
        <ShimmerBlock
          style={{
            width: `${62 + (i % 4) * 8}%`,
            height: 14,
            borderRadius: 8,
          }}
        />
      </div>

      <div className="res-itemDesc">
        <ShimmerBlock style={{ width: "92%", height: 12, borderRadius: 8 }} />
        <div style={{ height: 8 }} />
        <ShimmerBlock
          style={{
            width: `${55 + (i % 3) * 12}%`,
            height: 12,
            borderRadius: 8,
            opacity: 0.9,
          }}
        />
      </div>

      <div className="res-meta">
        <div className="res-metaRow">
          <ShimmerBlock style={{ width: 50, height: 10, borderRadius: 8 }} />
          <ShimmerBlock
            style={{
              width: `${45 + (i % 3) * 15}%`,
              height: 10,
              borderRadius: 8,
            }}
          />
        </div>
        <div className="res-metaRow" style={{ marginTop: 8 }}>
          <ShimmerBlock style={{ width: 70, height: 10, borderRadius: 8 }} />
          <ShimmerBlock
            style={{
              width: `${35 + (i % 4) * 12}%`,
              height: 10,
              borderRadius: 8,
            }}
          />
        </div>
      </div>

      <div className="res-actions" style={{ pointerEvents: "none" }}>
        <ShimmerBlock style={{ width: 74, height: 32, borderRadius: 10 }} />
        <ShimmerBlock style={{ width: 84, height: 32, borderRadius: 10 }} />
      </div>
    </div>
  );
}

function SkeletonResourcesGrid({ count = 9 }) {
  return (
    <div className="res-grid" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonResourceCard key={i} i={i} />
      ))}
    </div>
  );
}

export default function Resources() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [resources, setResources] = useState([]);

  // filters
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [access, setAccess] = useState("");
  const [active, setActive] = useState("true");

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // upload
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // form
  const [form, setForm] = useState({ ...EMPTY_FORM });

  async function fetchResources() {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());

      if (type) {
        // backend might accept type
        params.set("type", type);
      }

      if (access) {
        // IMPORTANT: support both query param names
        // some backends use access, some use visibility
        params.set("access", access);
        params.set("visibility", access);
      }

      if (active === "true" || active === "false") {
        // some backends use active, some use is_active
        params.set("active", active);
        params.set("is_active", active);
      }

      const res = await api.get(`/admin/resources?${params.toString()}`);
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Failed to load");

      setResources(Array.isArray(res.data.resources) ? res.data.resources : []);
    } catch (e) {
      setResources([]);
      setErr(
        e?.response?.data?.message || e?.message || "Failed to load resources."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setUploadFile(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(r) {
    setEditing(r);
    setUploadFile(null);

    const t = normType(r?.type || "link");
    const a = normAccessFromResource(r);

    setForm({
      title: safe(r?.title),
      type: t,
      url: safe(r?.url),
      description: safe(r?.description),
      access: a, // normalize from access/visibility
      video_id: r?.video_id ? String(r.video_id) : "",
      category_id: r?.category_id ? String(r.category_id) : "",
      sort_order: safe(r?.sort_order ?? 0),
      is_active: r?.is_active !== false,
    });

    setModalOpen(true);
  }

  function closeModal() {
    if (saving || uploading) return;
    setModalOpen(false);
    setEditing(null);
    setUploadFile(null);
  }

  async function uploadSelectedFile(file, fileType) {
    // POST /api/admin/resources/upload
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", String(fileType || "other"));

    const res = await uploadApi.post("/admin/resources/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (!res?.data?.ok || !res?.data?.url) {
      throw new Error(res?.data?.message || "Upload failed");
    }
    return String(res.data.url);
  }

  async function onSave(e) {
    e.preventDefault();
    if (saving || uploading) return;

    const cleanTitle = String(form.title || "").trim();
    const cleanType = normType(form.type || "link");
    const cleanUrl = String(form.url || "").trim();
    const cleanAccess = String(form.access || "public").toLowerCase();

    if (!cleanTitle) return alert("Title is required.");

    const needsUpload = isUploadType(cleanType);

    // base payload (send BOTH access + visibility for compatibility)
    const payload = {
      title: cleanTitle,
      type: cleanType,
      url: cleanUrl,
      description: String(form.description || "").trim(),

      // 🔥 IMPORTANT: some backends store this as `visibility`
      access: cleanAccess,
      visibility: cleanAccess,

      video_id: form.video_id ? Number(form.video_id) : null,
      category_id: form.category_id ? Number(form.category_id) : null,
      sort_order: Number(String(form.sort_order ?? "0") || "0"),
      is_active: !!form.is_active,
    };

    if (needsUpload) {
      // create requires file; edit can keep existing URL unless new file selected
      if (!editing?.id && !uploadFile)
        return alert("Please choose a file to upload.");

      if (uploadFile) {
        setUploading(true);
        try {
          const url = await uploadSelectedFile(uploadFile, cleanType);
          payload.url = url;
        } catch (upErr) {
          return alert(
            upErr?.response?.data?.message || upErr?.message || "Upload failed."
          );
        } finally {
          setUploading(false);
        }
      } else {
        // no new file selected on edit; keep existing url
        if (!payload.url && editing?.url) payload.url = String(editing.url);
      }
    } else {
      if (!payload.url) return alert("URL is required.");
    }

    setSaving(true);
    try {
      if (editing?.id) {
        const res = await api.put(`/admin/resources/${editing.id}`, payload);
        if (!res?.data?.ok)
          throw new Error(res?.data?.message || "Update failed");
      } else {
        const res = await api.post(`/admin/resources`, payload);
        if (!res?.data?.ok)
          throw new Error(res?.data?.message || "Create failed");
      }

      setModalOpen(false);
      setEditing(null);
      setUploadFile(null);
      await fetchResources();
    } catch (e2) {
      alert(e2?.response?.data?.message || e2?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!editing?.id) return;
    if (!window.confirm("Delete this resource? (It will be deactivated)"))
      return;

    setSaving(true);
    try {
      const res = await api.delete(`/admin/resources/${editing.id}`);
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Delete failed");

      setModalOpen(false);
      setEditing(null);
      setUploadFile(null);
      await fetchResources();
    } catch (e2) {
      alert(e2?.response?.data?.message || e2?.message || "Failed to delete.");
    } finally {
      setSaving(false);
    }
  }

  async function copyUrl(url) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      alert("Copy failed. You can manually copy the URL.");
    }
  }

  const filteredCount = useMemo(() => resources.length, [resources]);
  const showUpload = isUploadType(form.type);

  return (
    <div className="res-page">
      <div className="res-wrap">
        <div className="res-top">
          <div className="res-topLeft">
            <div className="res-kicker">ADMIN</div>
            <h1 className="res-title">Resources</h1>
            <p className="res-sub">
              Upload links and downloads for your community.
            </p>
          </div>

          <div className="res-topRight">
            <button className="res-btn res-btn--primary" onClick={openCreate}>
              + New resource
            </button>
          </div>
        </div>

        <div className="res-filters">
          <div className="res-search">
            <input
              value={q ?? ""}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search resources…"
            />
            <button className="res-btn res-btn--ghost" onClick={fetchResources}>
              Search
            </button>
          </div>

          <div className="res-selects">
            <div className="res-select">
              <label>Type</label>
              <select
                value={type ?? ""}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="">All</option>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="res-select">
              <label>Access</label>
              <select
                value={access ?? ""}
                onChange={(e) => setAccess(e.target.value)}
              >
                <option value="">All</option>
                {ACCESS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="res-select">
              <label>Status</label>
              <select
                value={active ?? "true"}
                onChange={(e) => setActive(e.target.value)}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            <button className="res-btn res-btn--ghost" onClick={fetchResources}>
              Apply
            </button>

            <div className="res-pill">
              <span>Showing</span>
              <b>{filteredCount}</b>
            </div>
          </div>
        </div>

        {/* ✅ Modern loading treatment (spinner + skeleton shimmer) */}
        {loading ? (
          <div className="res-card">
            <div style={{ padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <CircularSpinner size={34} label="" />
                <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 13 }}>
                  Loading resources…
                </div>
              </div>

              <div style={{ height: 12 }} />
              <SkeletonResourcesGrid count={9} />
            </div>
          </div>
        ) : err ? (
          <div className="res-card">
            <div className="res-errorTitle">We couldn’t load resources.</div>
            <div className="res-errorText">{err}</div>
            <div className="res-muted" style={{ marginTop: 10 }}>
              Make sure backend route exists: <b>/api/admin/resources</b>
            </div>
          </div>
        ) : (
          <div className="res-grid">
            {resources.map((r) => {
              const t = normType(r.type);
              const a = normAccessFromResource(r);
              return (
                <div
                  key={r.id}
                  className={`res-item ${r.is_active ? "" : "is-inactive"}`}
                  onClick={() => openEdit(r)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && openEdit(r)}
                >
                  <div className="res-itemTop">
                    <div className={`res-badge res-badge--${t}`}>
                      {t.toUpperCase()}
                    </div>
                    <div className={`res-access res-access--${a}`}>
                      {accessLabel(a).toUpperCase()}
                    </div>
                  </div>

                  <div className="res-itemTitle">{r.title}</div>

                  {r.description ? (
                    <div className="res-itemDesc">{r.description}</div>
                  ) : (
                    <div className="res-itemDesc res-muted">No description</div>
                  )}

                  <div className="res-meta">
                    {r.video_title ? (
                      <div className="res-metaRow">
                        <span className="res-muted">Video:</span>
                        <b>{r.video_title}</b>
                      </div>
                    ) : null}

                    {r.category_name ? (
                      <div className="res-metaRow">
                        <span className="res-muted">Category:</span>
                        <b>{r.category_name}</b>
                      </div>
                    ) : null}
                  </div>

                  <div className="res-actions">
                    <button
                      className="res-btn res-btn--ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(r.url, "_blank", "noopener,noreferrer");
                      }}
                    >
                      Open
                    </button>
                    <button
                      className="res-btn res-btn--ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyUrl(r.url);
                      }}
                    >
                      Copy link
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen ? (
        <div className="res-modalOverlay" onMouseDown={closeModal}>
          <div
            className="res-modal"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="res-modalHead">
              <div>
                <div className="res-modalTitle">
                  {editing?.id ? "Edit resource" : "New resource"}
                </div>
                <div className="res-muted">
                  {editing?.id
                    ? `ID: ${editing.id}`
                    : "Create a new downloadable resource."}
                </div>
              </div>
              <button className="res-x" onClick={closeModal} aria-label="Close">
                ✕
              </button>
            </div>

            <form className="res-form" onSubmit={onSave}>
              <div className="res-field">
                <label>Title</label>
                <input
                  value={form.title ?? ""}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, title: e.target.value }))
                  }
                  placeholder="e.g., Prayer Guide PDF"
                />
              </div>

              <div className="res-row2">
                <div className="res-field">
                  <label>Type</label>
                  <select
                    value={form.type ?? "link"}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setForm((s) => ({ ...s, type: nextType }));
                      setUploadFile(null);
                    }}
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="res-field">
                  <label>Access</label>
                  <select
                    value={form.access ?? "public"}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, access: e.target.value }))
                    }
                  >
                    {ACCESS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Link vs Upload */}
              {!showUpload ? (
                <div className="res-field">
                  <label>URL (external link)</label>
                  <input
                    value={form.url ?? ""}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, url: e.target.value }))
                    }
                    placeholder="https://…"
                  />
                </div>
              ) : (
                <div className="res-field">
                  <label>Upload file</label>
                  <input
                    type="file"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    accept={
                      form.type === "pdf"
                        ? "application/pdf"
                        : form.type === "image"
                        ? "image/*"
                        : undefined
                    }
                  />
                  <div className="res-muted" style={{ marginTop: 6 }}>
                    {editing?.id && form.url
                      ? `Current file: ${form.url}`
                      : "Choose a file to upload."}
                    {uploadFile ? `  • Selected: ${uploadFile.name}` : ""}
                  </div>
                </div>
              )}

              <div className="res-field">
                <label>Description</label>
                <input
                  value={form.description ?? ""}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, description: e.target.value }))
                  }
                  placeholder="Optional short description…"
                />
              </div>

              <div className="res-row2">
                <div className="res-field">
                  <label>Video ID (optional)</label>
                  <input
                    value={form.video_id ?? ""}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, video_id: e.target.value }))
                    }
                    inputMode="numeric"
                    placeholder="e.g., 123"
                  />
                </div>
                <div className="res-field">
                  <label>Category ID (optional)</label>
                  <input
                    value={form.category_id ?? ""}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, category_id: e.target.value }))
                    }
                    inputMode="numeric"
                    placeholder="e.g., 45"
                  />
                </div>
              </div>

              <div className="res-row2">
                <div className="res-field">
                  <label>Sort order</label>
                  <input
                    type="number"
                    value={form.sort_order ?? "0"}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, sort_order: e.target.value }))
                    }
                  />
                </div>

                <div className="res-field res-toggleRow">
                  <label>Active</label>
                  <div className="res-toggle">
                    <input
                      type="checkbox"
                      checked={!!form.is_active}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, is_active: e.target.checked }))
                      }
                    />
                    <span>{form.is_active ? "Active" : "Inactive"}</span>
                  </div>
                </div>
              </div>

              <div className="res-modalActions">
                {editing?.id ? (
                  <button
                    type="button"
                    className="res-btn res-btn--danger"
                    onClick={onDelete}
                    disabled={saving || uploading}
                  >
                    Delete
                  </button>
                ) : (
                  <span />
                )}

                <div className="res-actionsRight">
                  <button
                    type="button"
                    className="res-btn res-btn--ghost"
                    onClick={closeModal}
                    disabled={saving || uploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="res-btn res-btn--primary"
                    disabled={saving || uploading}
                  >
                    {uploading ? "Uploading…" : saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
