// src/pages/admin/Collection.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";
import "./Videos.css"; // reuses table/btn/badge/thumb styles
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

  async function load() {
    setLoading(true);
    setBanner(null);
    try {
      // Playlists (auth)
      const { data } = await api.get("/playlists", { params: { limit: 200 } });
      const list = Array.isArray(data) ? data : data?.items || [];
      setItems(list);

      // Categories (optional; only to show the "Displays In" dropdown)
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
          (p.description || "").toLowerCase().includes(query)
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
          new Date(a.created_at || a.created || 0)
      );
    } else if (sortBy === "oldest") {
      list.sort(
        (a, b) =>
          new Date(a.created_at || a.created || 0) -
          new Date(b.created_at || b.created || 0)
      );
    } else if (sortBy === "title") {
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }

    return list;
  }, [items, q, statusFilter, sortBy]);

  async function remove(id) {
    if (!window.confirm("Delete this playlist?")) return;
    try {
      await api.delete(`/playlists/${id}`);
      await load();
    } catch (e) {
      console.error("delete playlist error:", e);
      alert("Delete failed");
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
    } catch (e) {
      console.error("create playlist error:", e);
      alert(e?.response?.data?.message || "Failed to create playlist");
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

      // if user set it back to original, remove from pending
      if (String(nextVal || "") === original) {
        const copy = { ...cur };
        delete copy[String(playlistId)];
        return copy;
      }
      return { ...cur, [String(playlistId)]: nextVal || null };
    });

    // Reflect immediately in table UI (optimistic local change)
    setItems((arr) =>
      arr.map((p) =>
        String(p.id) === String(playlistId)
          ? { ...p, featured_category_id: nextVal || null }
          : p
      )
    );
  }

  async function savePending() {
    if (!hasPending) return;
    setSaving(true);
    setBanner(null);
    try {
      // bulk save all pending changes
      const ops = Object.entries(pending).map(([id, val]) =>
        api.put(`/playlists/${id}`, {
          featured_category_id: val || null,
        })
      );
      await Promise.all(ops);
      setPending({});
      await load();
    } catch (e) {
      console.error("save playlists error:", e);
      setBanner({
        type: "error",
        text:
          e?.response?.data?.message ||
          "Failed to save changes. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  function cancelPending() {
    setPending({});
    // reload to reset any optimistic local changes
    load();
  }

  return (
    <div>
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontWeight: 800 }}>Playlists</h2>

        {/* Save / Cancel block (shows only when there are unsaved edits) */}
        {hasPending && (
          <div style={{ display: "flex", gap: 8, marginLeft: 8 }}>
            <button
              className="btn"
              onClick={savePending}
              disabled={saving}
              title="Save your pending changes"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              className="btn ghost"
              onClick={cancelPending}
              disabled={saving}
              title="Discard your pending changes"
            >
              Cancel
            </button>
          </div>
        )}

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <input
            className="search"
            style={{
              height: 40,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              padding: "0 12px",
            }}
            placeholder="New playlist title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <button
            className="btn btn--add"
            onClick={create}
            disabled={!newTitle.trim() || creating}
          >
            {creating ? "Creating…" : "+ Add new Playlist"}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 220px 180px",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="search search--with-icon"
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
      <div className="card table-card">
        {loading ? (
          <div>Loading…</div>
        ) : filteredSorted.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            No playlists yet.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>
                  <input type="checkbox" disabled />
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

                const original =
                  p.original_featured_category_id !== undefined
                    ? p.original_featured_category_id
                    : p.featured_category_id;

                // if this row id is in "pending", it means it's dirty (value may equal UI value because we set items optimistically)
                const dirty = Object.prototype.hasOwnProperty.call(
                  pending,
                  String(p.id)
                );

                return (
                  <tr key={p.id}>
                    <td>
                      <input type="checkbox" />
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <div className="thumb">
                          {thumb ? (
                            <img src={absUrl(thumb)} alt="" />
                          ) : (
                            <div className="thumb-fallback">▶</div>
                          )}
                        </div>
                        <Link
                          to={`/admin/content/collections/${p.id}`}
                          className="row-title"
                          title="Edit playlist"
                        >
                          {p.title || "Untitled"}
                        </Link>
                        {dirty && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 12,
                              color: "#64748b",
                              fontWeight: 700,
                            }}
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
                          className="menu"
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
                            onClick={() => remove(p.id)}
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
