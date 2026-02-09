// src/pages/admin/Organize.js
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import "./Organize.css";

function normalizeAccessLabel(v) {
  const x = String(v || "").toLowerCase();
  if (x === "members") return "Members";
  if (x === "admin") return "Admin";
  return "Public";
}

function normalizeStatusLabel(isPublished) {
  return isPublished ? "Published" : "Hidden";
}

/* -----------------------------------------
   Modern Loading Spinner (drop-in, no CSS changes needed)
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

/* -----------------------------------------
   Skeleton Shimmer Blocks (no CSS file edits)
----------------------------------------- */
function ShimmerBlock({ style }) {
  return (
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
  );
}

function SkeletonCollectionsList({ rows = 9 }) {
  return (
    <div className="org-main" aria-busy="true">
      <aside className="org-left">
        <div className="org-leftHead">
          <div className="org-leftTitle">
            <ShimmerBlock style={{ width: 110, height: 14, borderRadius: 8 }} />
          </div>
          <div className="org-leftCount">
            <ShimmerBlock style={{ width: 90, height: 12, borderRadius: 8 }} />
          </div>
        </div>

        <div className="org-leftSearch">
          <ShimmerBlock
            style={{ width: "100%", height: 36, borderRadius: 10 }}
          />
        </div>

        <div className="org-catList">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className={"org-catItem" + (i === 0 ? " is-active" : "")}
              style={{ cursor: "default" }}
            >
              <div className="org-catName">
                <ShimmerBlock
                  style={{
                    width: `${62 + (i % 4) * 9}%`,
                    height: 12,
                    borderRadius: 8,
                  }}
                />
              </div>
              <div className="org-catMeta">
                <ShimmerBlock
                  style={{ width: 70, height: 10, borderRadius: 8 }}
                />
                <ShimmerBlock
                  style={{ width: 36, height: 10, borderRadius: 8 }}
                />
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="org-right">
        <div className="org-videosCard">
          <div className="org-videosHead">
            <div>
              <div className="org-videosTitle">
                <ShimmerBlock
                  style={{ width: 220, height: 16, borderRadius: 10 }}
                />
              </div>
              <div className="org-muted" style={{ marginTop: 8 }}>
                <ShimmerBlock
                  style={{ width: "60%", height: 12, borderRadius: 8 }}
                />
              </div>

              <div className="org-filtersRow" style={{ marginTop: 12 }}>
                <ShimmerBlock
                  style={{ width: "45%", height: 36, borderRadius: 10 }}
                />
                <ShimmerBlock
                  style={{ width: 160, height: 36, borderRadius: 10 }}
                />
                <ShimmerBlock
                  style={{ width: 150, height: 36, borderRadius: 10 }}
                />
                <ShimmerBlock
                  style={{ width: 70, height: 26, borderRadius: 999 }}
                />
              </div>
            </div>
          </div>

          <div className="org-tableWrap">
            <table className="org-table" aria-busy="true">
              <thead>
                <tr>
                  <th style={{ width: 40 }} />
                  <th className="th-title">Title</th>
                  <th style={{ width: 120 }} className="th-status">
                    Status
                  </th>
                  <th style={{ width: 110 }} className="th-access">
                    Access
                  </th>
                  <th
                    style={{ width: 80, textAlign: "center" }}
                    className="th-order"
                  >
                    Order
                  </th>
                  <th style={{ width: 130 }} />
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="org-row">
                    <td>
                      <ShimmerBlock
                        style={{ width: 20, height: 12, borderRadius: 6 }}
                      />
                    </td>
                    <td>
                      <div className="org-videoTitle">
                        <ShimmerBlock
                          style={{
                            width: `${55 + (i % 4) * 10}%`,
                            height: 12,
                            borderRadius: 8,
                          }}
                        />
                      </div>
                      <div
                        className="org-videoSlug org-muted"
                        style={{ marginTop: 6 }}
                      >
                        <ShimmerBlock
                          style={{ width: "40%", height: 10, borderRadius: 8 }}
                        />
                      </div>
                    </td>
                    <td>
                      <ShimmerBlock
                        style={{ width: 88, height: 22, borderRadius: 999 }}
                      />
                    </td>
                    <td>
                      <ShimmerBlock
                        style={{ width: 78, height: 22, borderRadius: 999 }}
                      />
                    </td>
                    <td style={{ textAlign: "center" }} className="org-id">
                      <ShimmerBlock
                        style={{ width: 24, height: 12, borderRadius: 6 }}
                      />
                    </td>
                    <td className="org-rowActions">
                      <ShimmerBlock
                        style={{ width: 28, height: 28, borderRadius: 10 }}
                      />
                      <ShimmerBlock
                        style={{ width: 28, height: 28, borderRadius: 10 }}
                      />
                      <ShimmerBlock
                        style={{ width: 74, height: 30, borderRadius: 10 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function SkeletonVideosCard({ title }) {
  return (
    <div className="org-card">
      <div style={{ padding: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <CircularSpinner size={34} label="" />
          <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 13 }}>
            {title || "Loading…"}
          </div>
        </div>
        <div style={{ height: 14 }} />
        <div className="org-videosCard">
          <div className="org-videosHead">
            <div style={{ width: "100%" }}>
              <ShimmerBlock
                style={{ width: 240, height: 16, borderRadius: 10 }}
              />
              <div style={{ height: 10 }} />
              <ShimmerBlock
                style={{ width: "65%", height: 12, borderRadius: 8 }}
              />
              <div style={{ height: 12 }} />
              <div className="org-filtersRow">
                <ShimmerBlock
                  style={{ width: "45%", height: 36, borderRadius: 10 }}
                />
                <ShimmerBlock
                  style={{ width: 160, height: 36, borderRadius: 10 }}
                />
                <ShimmerBlock
                  style={{ width: 150, height: 36, borderRadius: 10 }}
                />
                <ShimmerBlock
                  style={{ width: 70, height: 26, borderRadius: 999 }}
                />
              </div>
            </div>
          </div>
          <div className="org-tableWrap">
            <table className="org-table" aria-busy="true">
              <thead>
                <tr>
                  <th style={{ width: 40 }} />
                  <th className="th-title">Title</th>
                  <th style={{ width: 120 }} className="th-status">
                    Status
                  </th>
                  <th style={{ width: 110 }} className="th-access">
                    Access
                  </th>
                  <th
                    style={{ width: 80, textAlign: "center" }}
                    className="th-order"
                  >
                    Order
                  </th>
                  <th style={{ width: 130 }} />
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="org-row">
                    <td>
                      <ShimmerBlock
                        style={{ width: 20, height: 12, borderRadius: 6 }}
                      />
                    </td>
                    <td>
                      <div className="org-videoTitle">
                        <ShimmerBlock
                          style={{
                            width: `${55 + (i % 4) * 10}%`,
                            height: 12,
                            borderRadius: 8,
                          }}
                        />
                      </div>
                      <div
                        className="org-videoSlug org-muted"
                        style={{ marginTop: 6 }}
                      >
                        <ShimmerBlock
                          style={{ width: "40%", height: 10, borderRadius: 8 }}
                        />
                      </div>
                    </td>
                    <td>
                      <ShimmerBlock
                        style={{ width: 88, height: 22, borderRadius: 999 }}
                      />
                    </td>
                    <td>
                      <ShimmerBlock
                        style={{ width: 78, height: 22, borderRadius: 999 }}
                      />
                    </td>
                    <td style={{ textAlign: "center" }} className="org-id">
                      <ShimmerBlock
                        style={{ width: 24, height: 12, borderRadius: 6 }}
                      />
                    </td>
                    <td className="org-rowActions">
                      <ShimmerBlock
                        style={{ width: 28, height: 28, borderRadius: 10 }}
                      />
                      <ShimmerBlock
                        style={{ width: 28, height: 28, borderRadius: 10 }}
                      />
                      <ShimmerBlock
                        style={{ width: 74, height: 30, borderRadius: 10 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Organize() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedCatId, setSelectedCatId] = useState(null);

  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosErr, setVideosErr] = useState("");
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [togglingIds, setTogglingIds] = useState({});

  // drag & drop state
  const [dragIndex, setDragIndex] = useState(null);

  // toast state
  const [toast, setToast] = useState(null);
  function showToast(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  // search + filters
  const [collectionSearch, setCollectionSearch] = useState("");
  const [videoSearch, setVideoSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | published | hidden
  const [accessFilter, setAccessFilter] = useState("all"); // all | public | members | admin

  const isVideoFilterActive = useMemo(() => {
    return (
      (videoSearch || "").trim().length > 0 ||
      statusFilter !== "all" ||
      accessFilter !== "all"
    );
  }, [videoSearch, statusFilter, accessFilter]);

  // LOAD CATEGORY OVERVIEW
  async function fetchCategories() {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/admin/organize/overview");
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Failed to load.");
      const list = Array.isArray(res.data.categories)
        ? res.data.categories
        : [];
      setCategories(list);

      // auto-select first category if nothing selected
      if (!selectedCatId && list.length > 0) {
        setSelectedCatId(list[0].id);
      }
    } catch (e) {
      setErr(
        e?.response?.data?.message || e?.message || "Failed to load categories."
      );
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LOAD VIDEOS FOR SELECTED CATEGORY
  async function fetchVideos(catId) {
    if (!catId) return;
    setVideos([]);
    setVideosErr("");
    setVideosLoading(true);
    setOrderDirty(false);

    try {
      const res = await api.get(`/admin/organize/category/${catId}/videos`);
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Failed to load.");
      const list = Array.isArray(res.data.videos) ? res.data.videos : [];
      setVideos(list);
    } catch (e) {
      setVideosErr(
        e?.response?.data?.message || e?.message || "Failed to load videos."
      );
      setVideos([]);
    } finally {
      setVideosLoading(false);
    }
  }

  useEffect(() => {
    if (selectedCatId) {
      // reset video search/filters when switching collections (clean UX)
      setVideoSearch("");
      setStatusFilter("all");
      setAccessFilter("all");
      fetchVideos(selectedCatId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCatId]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCatId) || null,
    [categories, selectedCatId]
  );

  // filtered lists
  const filteredCategories = useMemo(() => {
    const q = (collectionSearch || "").trim().toLowerCase();
    if (!q) return categories;

    return categories.filter((c) => {
      const name = String(c.name || "").toLowerCase();
      return name.includes(q);
    });
  }, [categories, collectionSearch]);

  const filteredVideos = useMemo(() => {
    const q = (videoSearch || "").trim().toLowerCase();

    return videos.filter((v) => {
      // search
      if (q) {
        const title = String(v.title || "").toLowerCase();
        const slug = String(v.slug || "").toLowerCase();
        if (!title.includes(q) && !slug.includes(q)) return false;
      }

      // status filter
      if (statusFilter === "published" && !v.is_published) return false;
      if (statusFilter === "hidden" && v.is_published) return false;

      // access filter
      const access = String(v.access || v.visibility || "public").toLowerCase();
      if (accessFilter !== "all" && access !== accessFilter) return false;

      return true;
    });
  }, [videos, videoSearch, statusFilter, accessFilter]);

  // LOCAL REORDER HELPERS (buttons)
  function moveVideoUp(idx) {
    if (idx <= 0) return;
    setVideos((prev) => {
      const clone = [...prev];
      const tmp = clone[idx - 1];
      clone[idx - 1] = clone[idx];
      clone[idx] = tmp;
      return clone;
    });
    setOrderDirty(true);
  }

  function moveVideoDown(idx) {
    if (idx >= videos.length - 1) return;
    setVideos((prev) => {
      const clone = [...prev];
      const tmp = clone[idx + 1];
      clone[idx + 1] = clone[idx];
      clone[idx] = tmp;
      return clone;
    });
    setOrderDirty(true);
  }

  // LOCAL REORDER HELPERS (drag & drop)
  function handleDragStart(e, index) {
    if (isVideoFilterActive) return; // guard
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e, index) {
    if (isVideoFilterActive) return; // guard
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    setVideos((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIndex, 1);
      arr.splice(index, 0, moved);
      return arr;
    });
    setDragIndex(index);
    setOrderDirty(true);
  }

  function handleDragEnd() {
    setDragIndex(null);
  }

  async function saveOrder() {
    if (!orderDirty || videos.length === 0) return;
    setSavingOrder(true);
    try {
      const items = videos.map((v, idx) => ({ id: v.id, sort_order: idx + 1 }));
      const res = await api.put("/admin/organize/videos/reorder", { items });
      if (!res?.data?.ok) throw new Error(res?.data?.message || "Save failed.");
      setOrderDirty(false);
      await fetchVideos(selectedCatId);
      showToast("success", "Order saved successfully.");
    } catch (e) {
      console.error("Reorder save error:", e);
      showToast(
        "error",
        e?.response?.data?.message || e?.message || "Failed to save order."
      );
    } finally {
      setSavingOrder(false);
    }
  }

  // PUBLISH / HIDE
  async function togglePublish(video) {
    const next = !video.is_published;
    setTogglingIds((m) => ({ ...m, [video.id]: true }));
    try {
      const res = await api.put(
        `/admin/organize/videos/${video.id}/visibility`,
        {
          is_published: next,
        }
      );
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Update failed.");

      const updated = res.data.video || res.data;
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, ...updated } : v))
      );
    } catch (e) {
      showToast(
        "error",
        e?.response?.data?.message || e?.message || "Failed to update video."
      );
    } finally {
      setTogglingIds((m) => {
        const copy = { ...m };
        delete copy[video.id];
        return copy;
      });
    }
  }

  const reorderDisabledHint = isVideoFilterActive
    ? "Clear search/filters to reorder."
    : null;

  return (
    <div className="org-page">
      <div className="org-wrap">
        <header className="org-header">
          <div>
            <div className="org-kicker">CONTENT</div>
            <h1 className="org-title">Organize</h1>
            <p className="org-sub">
              Reorder videos inside collections and quickly hide or publish
              content.
            </p>
          </div>

          <div className="org-headerRight">
            {selectedCategory && (
              <button
                className="org-btn org-btn--primary"
                onClick={saveOrder}
                disabled={!orderDirty || savingOrder || videos.length === 0}
                title={
                  isVideoFilterActive
                    ? "You can still save, but reorder is disabled while filtering."
                    : ""
                }
              >
                {savingOrder
                  ? "Saving…"
                  : orderDirty
                  ? "Save order"
                  : "Order saved"}
              </button>
            )}
          </div>
        </header>

        {/* ✅ Modern loading treatment (spinner + skeleton shimmer) */}
        {loading ? (
          <div className="org-card">
            <div style={{ padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <CircularSpinner size={34} label="" />
                <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 13 }}>
                  Loading collections…
                </div>
              </div>
              <div style={{ height: 12 }} />
              <SkeletonCollectionsList rows={9} />
            </div>
          </div>
        ) : err ? (
          <div className="org-card org-card--error">
            <div className="org-errorTitle">We couldn’t load collections.</div>
            <div className="org-errorText">{err}</div>
            <div className="org-muted" style={{ marginTop: 10 }}>
              Make sure the backend route{" "}
              <code>/api/admin/organize/overview</code> is accessible to admin.
            </div>
          </div>
        ) : (
          <div className="org-main">
            {/* LEFT: collections */}
            <aside className="org-left">
              <div className="org-leftHead">
                <div className="org-leftTitle">Collections</div>
                <div className="org-leftCount">
                  {categories.length}{" "}
                  {categories.length === 1 ? "collection" : "collections"}
                </div>
              </div>

              {/* Collections search (full width) */}
              <div className="org-leftSearch">
                <input
                  value={collectionSearch}
                  onChange={(e) => setCollectionSearch(e.target.value)}
                  placeholder="Search collections…"
                  className="org-input"
                />
              </div>

              <div className="org-catList">
                {filteredCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={
                      "org-catItem" +
                      (c.id === selectedCatId ? " is-active" : "")
                    }
                    onClick={() => setSelectedCatId(c.id)}
                  >
                    <div className="org-catName">{c.name}</div>
                    <div className="org-catMeta">
                      <span>{c.video_count || 0} videos</span>
                      {typeof c.sort_order === "number" && (
                        <span className="org-catSort">#{c.sort_order}</span>
                      )}
                    </div>
                  </button>
                ))}

                {categories.length === 0 && (
                  <div className="org-empty">
                    No collections yet. Create a category/collection first.
                  </div>
                )}

                {categories.length > 0 && filteredCategories.length === 0 && (
                  <div className="org-empty">
                    No collections match your search.
                  </div>
                )}
              </div>
            </aside>

            {/* RIGHT: videos */}
            <section className="org-right">
              {!selectedCategory ? (
                <div className="org-emptyState">
                  <div className="org-emptyTitle">No collection selected</div>
                  <p className="org-muted">
                    Choose a collection on the left to see the videos inside it.
                  </p>
                </div>
              ) : videosLoading ? (
                <SkeletonVideosCard
                  title={`Loading videos in “${selectedCategory.name}”…`}
                />
              ) : videosErr ? (
                <div className="org-card org-card--error">
                  <div className="org-errorTitle">
                    We couldn’t load videos for this collection.
                  </div>
                  <div className="org-errorText">{videosErr}</div>
                </div>
              ) : videos.length === 0 ? (
                <div className="org-emptyState">
                  <div className="org-emptyTitle">
                    No videos in this collection
                  </div>
                  <p className="org-muted">
                    Assign videos to the category “{selectedCategory.name}” to
                    manage their order here.
                  </p>
                </div>
              ) : (
                <div className="org-videosCard">
                  <div className="org-videosHead">
                    <div>
                      <div className="org-videosTitle">
                        {selectedCategory.name}
                      </div>
                      <div className="org-muted">
                        Drag rows using the handle, or use the arrows to tweak
                        the order.
                        {reorderDisabledHint && (
                          <span style={{ marginLeft: 10, opacity: 0.9 }}>
                            • {reorderDisabledHint}
                          </span>
                        )}
                      </div>

                      {/* Video search + filters */}
                      <div className="org-filtersRow">
                        <input
                          value={videoSearch}
                          onChange={(e) => setVideoSearch(e.target.value)}
                          placeholder="Search videos…"
                          className="org-input"
                        />

                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="org-select"
                        >
                          <option value="all">All status</option>
                          <option value="published">Published</option>
                          <option value="hidden">Hidden</option>
                        </select>

                        <select
                          value={accessFilter}
                          onChange={(e) => setAccessFilter(e.target.value)}
                          className="org-select"
                        >
                          <option value="all">All access</option>
                          <option value="public">Public</option>
                          <option value="members">Members</option>
                          <option value="admin">Admin</option>
                        </select>

                        {(isVideoFilterActive ||
                          (collectionSearch || "").trim()) && (
                          <button
                            type="button"
                            className="org-btn org-btn--ghost org-btn--sm"
                            onClick={() => {
                              setCollectionSearch("");
                              setVideoSearch("");
                              setStatusFilter("all");
                              setAccessFilter("all");
                            }}
                            title="Clear search & filters"
                          >
                            Clear
                          </button>
                        )}

                        <div className="org-pill">
                          {filteredVideos.length}{" "}
                          {filteredVideos.length === 1 ? "result" : "results"}
                        </div>
                      </div>
                    </div>

                    {/* REMOVED: “X videos in this collection” pill */}
                  </div>

                  <div className="org-tableWrap">
                    <table className="org-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }} />
                          <th className="th-title">Title</th>
                          <th style={{ width: 120 }} className="th-status">
                            Status
                          </th>
                          <th style={{ width: 110 }} className="th-access">
                            Access
                          </th>
                          <th
                            style={{ width: 80, textAlign: "center" }}
                            className="th-order"
                          >
                            Order
                          </th>
                          <th style={{ width: 130 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVideos.map((v) => {
                          const actualIdx = videos.findIndex(
                            (x) => x.id === v.id
                          );

                          const rowDraggable = !isVideoFilterActive;
                          const canMoveUp =
                            !isVideoFilterActive && actualIdx > 0;
                          const canMoveDown =
                            !isVideoFilterActive &&
                            actualIdx < videos.length - 1;

                          return (
                            <tr
                              key={v.id}
                              draggable={rowDraggable}
                              onDragStart={(e) => handleDragStart(e, actualIdx)}
                              onDragOver={(e) => handleDragOver(e, actualIdx)}
                              onDragEnd={handleDragEnd}
                              className={
                                dragIndex === actualIdx
                                  ? "org-row is-dragging"
                                  : "org-row"
                              }
                              title={
                                isVideoFilterActive
                                  ? "Clear search/filters to reorder."
                                  : ""
                              }
                              style={{ opacity: rowDraggable ? 1 : 0.98 }}
                            >
                              <td>
                                <span
                                  className="org-handle"
                                  title={
                                    rowDraggable
                                      ? "Drag to reorder"
                                      : "Clear search/filters to reorder"
                                  }
                                  style={{
                                    cursor: rowDraggable
                                      ? "grab"
                                      : "not-allowed",
                                    opacity: rowDraggable ? 1 : 0.45,
                                  }}
                                >
                                  ⋮⋮
                                </span>
                              </td>

                              <td>
                                <div className="org-videoTitle">{v.title}</div>
                                {v.slug && (
                                  <div className="org-videoSlug org-muted">
                                    /{v.slug}
                                  </div>
                                )}
                              </td>

                              <td>
                                <span
                                  className={
                                    "org-statusBadge " +
                                    (v.is_published
                                      ? "is-published"
                                      : "is-hidden")
                                  }
                                >
                                  {normalizeStatusLabel(v.is_published)}
                                </span>
                              </td>

                              <td>
                                <span className="org-accessBadge">
                                  {normalizeAccessLabel(
                                    v.access || v.visibility || "public"
                                  )}
                                </span>
                              </td>

                              <td
                                style={{ textAlign: "center" }}
                                className="org-id"
                              >
                                {actualIdx + 1}
                              </td>

                              <td className="org-rowActions">
                                <button
                                  type="button"
                                  className="org-iconBtn"
                                  onClick={() => moveVideoUp(actualIdx)}
                                  disabled={!canMoveUp}
                                  title={
                                    canMoveUp
                                      ? "Move up"
                                      : "Clear filters to reorder"
                                  }
                                  style={{ opacity: canMoveUp ? 1 : 0.5 }}
                                >
                                  ↑
                                </button>

                                <button
                                  type="button"
                                  className="org-iconBtn"
                                  onClick={() => moveVideoDown(actualIdx)}
                                  disabled={!canMoveDown}
                                  title={
                                    canMoveDown
                                      ? "Move down"
                                      : "Clear filters to reorder"
                                  }
                                  style={{ opacity: canMoveDown ? 1 : 0.5 }}
                                >
                                  ↓
                                </button>

                                <button
                                  type="button"
                                  className="org-btn org-btn--ghost org-btn--sm"
                                  onClick={() => togglePublish(v)}
                                  disabled={!!togglingIds[v.id]}
                                >
                                  {togglingIds[v.id]
                                    ? "Updating…"
                                    : v.is_published
                                    ? "Hide"
                                    : "Publish"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {videos.length > 0 && filteredVideos.length === 0 && (
                      <div className="org-emptyState" style={{ marginTop: 14 }}>
                        <div className="org-emptyTitle">No matches</div>
                        <p className="org-muted">
                          Try a different search term or clear your filters.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {toast && (
          <div className={`org-toast org-toast--${toast.type}`}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
