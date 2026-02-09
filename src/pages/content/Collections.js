// src/pages/admin/Collections.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";
import "./Videos.css"; // reuse (scoped) styles
import "./Collections.css";

/* -------- utils -------- */
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ visibility }) {
  const published = visibility === "public";
  return (
    <span
      className={`badge ${published ? "badge-green" : "badge-red"}`}
      title={published ? "Published" : "Unpublished"}
    >
      {published ? "PUBLISHED" : "UNPUBLISHED"}
    </span>
  );
}

function absUrl(u) {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return u.startsWith("/") ? u : `/${u}`;
}

/* -----------------------------------------
   Modern Loading Spinner (matches LiveStreaming.js)
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
   Skeleton Shimmer Blocks (no deps)
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

function SkeletonCollectionsTable({ rows = 8, showCategoryCol = true }) {
  return (
    <div style={{ padding: 16 }} aria-busy="true">
      {/* Top loader row (keeps same spacing) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <CircularSpinner size={34} label="" />
        <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 13 }}>
          Loading playlists…
        </div>
      </div>

      <div style={{ height: 10 }} />

      {/* Skeleton rows that visually match your table columns */}
      <div style={{ display: "grid", gap: 10 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: showCategoryCol
                ? "44px 1fr 260px 120px 160px 220px 60px"
                : "44px 1fr 120px 160px 220px 60px",
              gap: 10,
              alignItems: "center",
              padding: "10px 8px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {/* checkbox */}
            <ShimmerBlock
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                opacity: 0.85,
                justifySelf: "start",
              }}
            />

            {/* playlist cell (thumb + title lines) */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ShimmerBlock
                style={{ width: 44, height: 28, borderRadius: 8 }}
              />
              <div style={{ flex: 1 }}>
                <ShimmerBlock
                  style={{ width: `${58 + (i % 4) * 10}%`, height: 12 }}
                />
                <div style={{ height: 6 }} />
                <ShimmerBlock
                  style={{ width: `${34 + (i % 3) * 12}%`, height: 10 }}
                />
              </div>
            </div>

            {/* displays in */}
            {showCategoryCol && (
              <ShimmerBlock
                style={{ width: "100%", height: 34, borderRadius: 10 }}
              />
            )}

            {/* items */}
            <ShimmerBlock
              style={{
                width: 46,
                height: 12,
                borderRadius: 8,
                justifySelf: "end",
              }}
            />

            {/* status */}
            <ShimmerBlock
              style={{ width: 120, height: 20, borderRadius: 999 }}
            />

            {/* created */}
            <ShimmerBlock style={{ width: 150, height: 12, borderRadius: 8 }} />

            {/* actions */}
            <ShimmerBlock
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                justifySelf: "end",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------- page -------- */
export default function CollectionsPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // categories (for "Display In" mapping)
  const [categories, setCategories] = useState([]);
  const [catsLoaded, setCatsLoaded] = useState(false);

  // filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // '', 'published', 'unpublished'
  const [sortBy, setSortBy] = useState("newest"); // 'newest' | 'oldest' | 'title'

  // UI state
  const [rowMenu, setRowMenu] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [banner, setBanner] = useState(null);

  // pending edits for featured_category_id: { [playlistId]: categoryId|null }
  const [pending, setPending] = useState({});
  const [saving, setSaving] = useState(false);
  const hasPending = Object.keys(pending).length > 0;

  // selection + bulk actions
  const [selected, setSelected] = useState(() => new Set());
  const [bulkAction, setBulkAction] = useState("");

  // toast
  const [toast, setToast] = useState(null); // { type: 'success'|'error', text: string }
  function showToast(type, text) {
    setToast({ type, text });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2200);
  }

  async function load() {
    setLoading(true);
    setBanner(null);
    try {
      const { data } = await api.get("/playlists", { params: { limit: 200 } });
      const list = Array.isArray(data) ? data : data?.items || [];
      setItems(list);

      // clear selections that no longer exist
      setSelected((cur) => {
        const ids = new Set(list.map((p) => String(p.id)));
        const next = new Set();
        cur.forEach((id) => {
          if (ids.has(String(id))) next.add(String(id));
        });
        return next;
      });

      // Categories (optional)
      try {
        const cats = await api.get("/categories?mine=1");
        const catList = Array.isArray(cats.data)
          ? cats.data
          : cats.data?.items || [];
        setCategories(catList.map((c) => ({ id: String(c.id), name: c.name })));
        setCatsLoaded(true);
      } catch {
        setCatsLoaded(false);
      }
    } catch (e) {
      console.error("load playlists error:", e);
      setBanner({
        type: "error",
        text:
          e?.response?.data?.message ||
          "Failed to load playlists. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredSorted = useMemo(() => {
    let list = [...items];

    // search
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (p) =>
          (p.title || "").toLowerCase().includes(query) ||
          (p.description || "").toLowerCase().includes(query),
      );
    }

    // status
    if (statusFilter === "published")
      list = list.filter((p) => p.visibility === "public");
    else if (statusFilter === "unpublished")
      list = list.filter((p) => p.visibility !== "public");

    // sort
    if (sortBy === "newest") {
      list.sort(
        (a, b) =>
          new Date(b.created_at || b.created || 0) -
          new Date(a.created_at || a.created || 0),
      );
    } else if (sortBy === "oldest") {
      list.sort(
        (a, b) =>
          new Date(a.created_at || a.created || 0) -
          new Date(b.created_at || b.created || 0),
      );
    } else if (sortBy === "title") {
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }

    return list;
  }, [items, q, statusFilter, sortBy]);

  const filteredIds = useMemo(
    () => new Set(filteredSorted.map((p) => String(p.id))),
    [filteredSorted],
  );

  const allVisibleSelected =
    filteredSorted.length > 0 &&
    filteredSorted.every((p) => selected.has(String(p.id)));

  function toggleRow(id) {
    const sid = String(id);
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelected((cur) => {
      const next = new Set(cur);
      if (allVisibleSelected) {
        filteredSorted.forEach((p) => next.delete(String(p.id)));
      } else {
        filteredSorted.forEach((p) => next.add(String(p.id)));
      }
      return next;
    });
  }

  async function removeOne(id) {
    if (!window.confirm("Delete this playlist?")) return;
    try {
      await api.delete(`/playlists/${id}`);
      await load();
      showToast("success", "Playlist deleted");
    } catch (e) {
      console.error("delete playlist error:", e);
      showToast("error", e?.response?.data?.message || "Delete failed");
    }
  }

  async function create() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await api.post("/playlists", {
        title: newTitle.trim(),
        visibility: "public",
      });
      setNewTitle("");
      await load();
      showToast("success", "Playlist created");
    } catch (e) {
      console.error("create playlist error:", e);
      showToast(
        "error",
        e?.response?.data?.message || "Failed to create playlist",
      );
    } finally {
      setCreating(false);
    }
  }

  // Track dropdown edits without saving immediately
  function setFeaturedLocal(playlistId, nextVal) {
    setPending((cur) => {
      const currentRow = items.find((p) => String(p.id) === String(playlistId));
      const original = currentRow?.featured_category_id
        ? String(currentRow.featured_category_id)
        : "";

      if (String(nextVal || "") === original) {
        const copy = { ...cur };
        delete copy[String(playlistId)];
        return copy;
      }
      return { ...cur, [String(playlistId)]: nextVal || null };
    });

    // optimistic
    setItems((arr) =>
      arr.map((p) =>
        String(p.id) === String(playlistId)
          ? { ...p, featured_category_id: nextVal || null }
          : p,
      ),
    );
  }

  async function savePending() {
    if (!hasPending) return;
    setSaving(true);
    setBanner(null);
    try {
      const ops = Object.entries(pending).map(([id, val]) =>
        api.put(`/playlists/${id}`, { featured_category_id: val || null }),
      );
      await Promise.all(ops);
      setPending({});
      await load();
      showToast("success", "Changes saved");
    } catch (e) {
      console.error("save playlists error:", e);
      setBanner({
        type: "error",
        text:
          e?.response?.data?.message ||
          "Failed to save changes. Please try again.",
      });
      showToast("error", "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  function cancelPending() {
    setPending({});
    load();
  }

  async function applyBulk() {
    const ids = Array.from(selected).filter(
      (id) => filteredIds.has(String(id)) || true,
    );
    if (ids.length === 0) return;

    const action = bulkAction;
    if (!action) return;

    try {
      if (action === "delete") {
        if (!window.confirm(`Delete ${ids.length} playlist(s)?`)) return;
        await Promise.all(ids.map((id) => api.delete(`/playlists/${id}`)));
        showToast("success", `Deleted ${ids.length} playlist(s)`);
      } else if (action === "publish") {
        await Promise.all(
          ids.map((id) =>
            api.put(`/playlists/${id}`, { visibility: "public" }),
          ),
        );
        showToast("success", `Published ${ids.length} playlist(s)`);
      } else if (action === "unpublish") {
        await Promise.all(
          ids.map((id) =>
            api.put(`/playlists/${id}`, { visibility: "private" }),
          ),
        );
        showToast("success", `Unpublished ${ids.length} playlist(s)`);
      }

      setBulkAction("");
      setSelected(new Set());
      await load();
    } catch (e) {
      console.error("bulk action error:", e);
      showToast("error", e?.response?.data?.message || "Bulk action failed");
    }
  }

  return (
    <div className="videos-page collections-page">
      {/* Toast */}
      {toast && (
        <div
          className={`collections-toast ${
            toast.type === "success" ? "is-success" : "is-error"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Banner */}
      {banner && (
        <div
          className={`banner ${banner.type || "error"}`}
          style={{ marginBottom: 12 }}
        >
          <span>{banner.text}</span>
          <span className="x" onClick={() => setBanner(null)}>
            ✕
          </span>
        </div>
      )}

      {/* Header */}
      <div className="collections-headerbar">
        <div className="collections-titlewrap">
          <h2
            style={{ margin: 0, fontWeight: 800 }}
            className="collection-title"
          >
            Playlists
          </h2>

          {hasPending && (
            <div className="collections-savebar">
              <button
                className="btn-save"
                onClick={savePending}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                className="btn ghost"
                onClick={cancelPending}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="collections-createwrap">
          <input
            className="search collections-newtitle"
            placeholder="New playlist title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <button
            className="btn--add"
            onClick={create}
            disabled={!newTitle.trim() || creating}
          >
            {creating ? "Creating…" : "+ Add new Playlist"}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="collections-toolbarcard" style={{ marginBottom: 16 }}>
        <div className="collections-toolbar-grid">
          <div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="search"
            />
          </div>

          <select
            className="search"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Status</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>

          <select
            className="search"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="title">Sort: Title A–Z</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        {/* Bulk action bar (top of table) */}
        <div className="collections-bulkbar">
          <div className="collections-bulkleft">
            <div className="collections-bulkcount">
              Bulk actions{" "}
              {selected.size > 0 ? `(${selected.size} selected)` : ""}
            </div>

            <select
              className="search collections-bulkselect"
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              disabled={selected.size === 0}
            >
              <option value="">Choose…</option>
              <option value="publish">Publish</option>
              <option value="unpublish">Unpublish</option>
              <option value="delete">Delete</option>
            </select>

            <button
              className="collections-bulkapply"
              onClick={applyBulk}
              disabled={selected.size === 0 || !bulkAction}
              title="Apply to selected"
            >
              Apply
            </button>
          </div>

          <div className="collections-bulktip">
            Tip: select rows using the checkboxes.
          </div>
        </div>

        {/* ✅ Modern loading treatment (spinner + skeleton shimmer) */}
        {loading ? (
          <SkeletonCollectionsTable rows={8} showCategoryCol={catsLoaded} />
        ) : filteredSorted.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            No playlists yet.
          </div>
        ) : (
          <table className="table-collection">
            <thead>
              <tr>
                <th style={{ width: 44 }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all"
                  />
                </th>
                <th>PLAYLISTS</th>
                {catsLoaded && <th style={{ width: 260 }}>DISPLAYS IN</th>}
                <th style={{ width: 120, textAlign: "right" }}>ITEMS</th>
                <th style={{ width: 160 }}>STATUS</th>
                <th style={{ width: 220 }}>CREATED</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>

            <tbody>
              {filteredSorted.map((p) => {
                const thumb =
                  p.thumbnail_url ||
                  p.thumb_h ||
                  p.vertical_thumbnail_url ||
                  p.thumb_v;
                const itemsCount = p.item_count ?? p.video_count ?? 0;

                const dirty = Object.prototype.hasOwnProperty.call(
                  pending,
                  String(p.id),
                );

                return (
                  <tr key={p.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(String(p.id))}
                        onChange={() => toggleRow(p.id)}
                        aria-label={`Select ${p.title || "playlist"}`}
                      />
                    </td>

                    <td>
                      <div className="collections-playlistcell">
                        <div className="thumb">
                          {thumb ? (
                            <img src={absUrl(thumb)} alt="" />
                          ) : (
                            <div className="thumb-fallback">▶</div>
                          )}
                        </div>

                        <Link
                          to={`/admin/content/collections/${p.id}`}
                          className="row-title collections-row-title"
                          title="Edit playlist"
                        >
                          {p.title || "Untitled"}
                        </Link>

                        {dirty && (
                          <span
                            className="collections-unsaved"
                            title="You have unsaved changes for this playlist"
                          >
                            • unsaved
                          </span>
                        )}
                      </div>
                    </td>

                    {catsLoaded && (
                      <td>
                        <select
                          className="search"
                          value={String(p.featured_category_id || "")}
                          onChange={(e) =>
                            setFeaturedLocal(p.id, e.target.value || null)
                          }
                        >
                          <option value="">— Do not feature —</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}

                    <td style={{ textAlign: "right" }}>{itemsCount}</td>
                    <td>
                      <StatusBadge visibility={p.visibility} />
                    </td>
                    <td>{formatDate(p.created_at || p.created)}</td>

                    <td style={{ position: "relative" }}>
                      <button
                        className="icon-btn"
                        onClick={() =>
                          setRowMenu((cur) => (cur === p.id ? null : p.id))
                        }
                        aria-label="Actions"
                      >
                        ⋮
                      </button>

                      {rowMenu === p.id && (
                        <div
                          className="menu collections-menu"
                          onMouseLeave={() => setRowMenu(null)}
                        >
                          <button
                            className="menu-item"
                            onClick={() =>
                              navigate(`/admin/content/collections/${p.id}`)
                            }
                          >
                            Edit
                          </button>
                          <button
                            className="menu-item danger"
                            onClick={() => removeOne(p.id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="table-footer">Displaying {filteredSorted.length}</div>
      </div>
    </div>
  );
}
