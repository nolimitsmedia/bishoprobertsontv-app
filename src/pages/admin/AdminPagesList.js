// src/pages/admin/AdminPagesList.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { useSiteOptions } from "../../lib/siteOptions";
import "./AdminPages.css";

/* ---------------------------
   Tiny Toast System (no deps)
---------------------------- */
function useToasts() {
  const [toasts, setToasts] = useState([]);

  function push(type, message, ms = 2800) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ms);
  }

  return {
    toasts,
    success: (msg, ms) => push("success", msg, ms),
    error: (msg, ms) => push("error", msg, ms),
    info: (msg, ms) => push("info", msg, ms),
  };
}

function ToastHost({ items }) {
  return (
    <div
      style={{
        position: "fixed",
        right: 18,
        top: 18,
        zIndex: 9999,
        display: "grid",
        gap: 10,
        width: 360,
        maxWidth: "calc(100vw - 36px)",
      }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          style={{
            borderRadius: 12,
            padding: "12px 14px",
            border: "1px solid rgba(255,255,255,0.10)",
            background:
              t.type === "success"
                ? "linear-gradient(180deg, rgba(46,204,113,0.22), rgba(255,255,255,0.06))"
                : t.type === "error"
                  ? "linear-gradient(180deg, rgba(255,91,91,0.22), rgba(255,255,255,0.06))"
                  : "linear-gradient(180deg, rgba(154,92,255,0.18), rgba(255,255,255,0.06))",
            boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
            color: "rgba(255,255,255,0.92)",
            fontSize: 14,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {t.type === "success"
              ? "Success"
              : t.type === "error"
                ? "Error"
                : "Info"}
          </div>
          <div style={{ color: "rgba(255,255,255,0.78)", lineHeight: 1.35 }}>
            {t.message}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------
   Modern Modal (no deps)
---------------------------- */
function Modal({ open, title, children, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        // click outside to close
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(0,0,0,0.62)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: 520,
          maxWidth: "100%",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
          boxShadow: "0 28px 70px rgba(0,0,0,0.60)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>
            {title}
          </div>
          <button
            className="ap-btn"
            onClick={onClose}
            style={{ padding: "6px 10px" }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminPagesList() {
  const siteOptions = useSiteOptions(); // which page is the front page
  const nav = useNavigate();
  const toast = useToasts();

  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("title");
  const [direction, setDirection] = useState("asc");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState([]);
  const [bulkAction, setBulkAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [quickPage, setQuickPage] = useState(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickSlug, setQuickSlug] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);

  // New Page modal state
  const [openNew, setOpenNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    if (openNew) {
      setTimeout(() => titleRef.current?.focus?.(), 50);
    }
  }, [openNew]);

  // Keep slug auto-generated unless user edits it
  const autoSlug = useMemo(() => slugify(newTitle), [newTitle]);

  useEffect(() => {
    // if slug is empty, keep in sync with title
    if (!openNew) return;
    if (!newSlug) setNewSlug(autoSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSlug, openNew]);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get("/admin/pages");
      setPages(r.data.pages || []);
      setSelected([]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load pages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setNewTitle("");
    setNewSlug("");
    setOpenNew(true);
  }

  function closeCreate() {
    if (creating) return;
    setOpenNew(false);
  }

  async function confirmCreate() {
    const title = String(newTitle || "").trim();
    const slug = slugify(newSlug || "");

    if (!title) {
      toast.error("Please enter a page title.");
      titleRef.current?.focus?.();
      return;
    }
    if (!slug) {
      toast.error("Please enter a valid slug.");
      return;
    }

    setCreating(true);
    try {
      const r = await api.post("/admin/pages", {
        title,
        slug,
        // Seed builder container so you can add sections/blocks immediately
        content_json: { extra_sections: [] },
      });
      toast.success("Page created.");
      setOpenNew(false);
      nav(`/admin/pages/${r.data.page.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Create failed.");
    } finally {
      setCreating(false);
    }
  }

  async function publish(id) {
    try {
      await api.post(`/admin/pages/${id}/publish`);
      toast.success("Page published.");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Publish failed.");
    }
  }

  async function unpublish(id) {
    try {
      await api.post(`/admin/pages/${id}/unpublish`);
      toast.success("Page unpublished.");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Unpublish failed.");
    }
  }

  // optional: confirm delete via modal-like confirm (still no window.confirm)
  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    id: null,
    title: "",
  });

  function askDelete(p) {
    setConfirmDelete({ open: true, id: p.id, title: p.title });
  }

  async function doDelete() {
    const id = confirmDelete.id;
    if (!id) return;

    try {
      await api.delete(`/admin/pages/${id}`);
      toast.success("Page deleted.");
      setConfirmDelete({ open: false, id: null, title: "" });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Delete failed.");
    }
  }

  const counts = useMemo(
    () => ({
      all: pages.length,
      published: pages.filter((p) => p.status === "published").length,
      draft: pages.filter((p) => p.status !== "published").length,
    }),
    [pages],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = pages.filter((p) => {
      if (filter === "published" && p.status !== "published") return false;
      if (filter === "draft" && p.status === "published") return false;
      return (
        !term || `${p.title || ""} ${p.slug || ""}`.toLowerCase().includes(term)
      );
    });
    rows.sort((a, b) => {
      const left =
        sort === "date"
          ? new Date(a.updated_at || 0).getTime()
          : String(a.title || "").toLowerCase();
      const right =
        sort === "date"
          ? new Date(b.updated_at || 0).getTime()
          : String(b.title || "").toLowerCase();
      const comparison = left < right ? -1 : left > right ? 1 : 0;
      return direction === "asc" ? comparison : -comparison;
    });
    return rows;
  }, [pages, search, filter, sort, direction]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(pageNumber, totalPages);
  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const visibleIds = visible.map((p) => p.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  function changeFilter(value) {
    setFilter(value);
    setPageNumber(1);
    setSelected([]);
  }
  function toggleSort(key) {
    if (sort === key) setDirection((old) => (old === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDirection(key === "date" ? "desc" : "asc");
    }
  }
  function toggleSelection(id, checked) {
    setSelected((prev) =>
      checked
        ? [...new Set([...prev, id])]
        : prev.filter((value) => value !== id),
    );
  }
  function toggleVisible(checked) {
    setSelected((prev) =>
      checked
        ? [...new Set([...prev, ...visibleIds])]
        : prev.filter((id) => !visibleIds.includes(id)),
    );
  }
  function openQuick(p) {
    setQuickPage(p);
    setQuickTitle(p.title || "");
    setQuickSlug(p.slug || "");
  }
  async function saveQuick() {
    if (!quickPage) return;
    const title = quickTitle.trim();
    const slug = slugify(quickSlug);
    if (!title || !slug) {
      toast.error("Title and slug are required.");
      return;
    }
    setQuickSaving(true);
    try {
      // Fetch the complete draft first: PUT requires content fields and must not overwrite them.
      const response = await api.get(`/admin/pages/${quickPage.id}`);
      const original = response.data?.page;
      if (!original) throw new Error("Could not load the current page draft.");
      await api.put(`/admin/pages/${quickPage.id}`, {
        title,
        slug,
        hero_image_url: original.hero_image_url || null,
        excerpt: original.excerpt || "",
        content_html: original.content_html || "",
        content_json: original.content_json || { extra_sections: [] },
      });
      setQuickPage(null);
      toast.success("Page details saved to draft.");
      await load();
    } catch (e) {
      toast.error(
        e?.response?.data?.error || e.message || "Quick Edit failed.",
      );
    } finally {
      setQuickSaving(false);
    }
  }
  async function duplicatePage(p) {
    setBusy(true);
    try {
      const response = await api.get(`/admin/pages/${p.id}`);
      const original = response.data?.page;
      if (!original) throw new Error("Unable to load page.");
      const uniqueSlug = `${slugify(p.slug || p.title)}-copy-${Date.now().toString(36)}`;
      const created = await api.post("/admin/pages", {
        title: `${p.title} (Copy)`,
        slug: uniqueSlug,
        content_json: original.content_json || { extra_sections: [] },
      });
      const newId = created.data?.page?.id;
      if (!newId) throw new Error("Copy was created without a page ID.");
      await api.put(`/admin/pages/${newId}`, {
        title: `${p.title} (Copy)`,
        slug: uniqueSlug,
        hero_image_url: original.hero_image_url || null,
        excerpt: original.excerpt || "",
        content_html: original.content_html || "",
        content_json: original.content_json || { extra_sections: [] },
      });
      toast.success("Draft copy created.");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || "Duplicate failed.");
    } finally {
      setBusy(false);
    }
  }
  async function applyBulk() {
    if (!bulkAction || !selected.length) return;
    const targets = pages.filter((p) => selected.includes(p.id));
    if (bulkAction === "delete") {
      toast.error("For safety, delete pages individually using confirmation.");
      return;
    }
    setBusy(true);
    let successes = 0;
    let failures = 0;
    for (const p of targets) {
      try {
        if (bulkAction === "publish")
          await api.post(`/admin/pages/${p.id}/publish`);
        if (bulkAction === "unpublish")
          await api.post(`/admin/pages/${p.id}/unpublish`);
        successes += 1;
      } catch (e) {
        failures += 1;
      }
    }
    setBusy(false);
    setBulkAction("");
    toast.info(
      `${successes} updated${failures ? `; ${failures} failed` : ""}.`,
    );
    await load();
  }
  function preview(p) {
    if (p.status !== "published") {
      nav(`/admin/pages/${p.id}/preview`);
      return;
    }
    nav(p.slug === "home" ? "/" : `/p/${p.slug}`);
  }
  return (
    <div className="ap-root">
      <ToastHost items={toast.toasts} />

      {/* New Page Modal */}
      <Modal open={openNew} title="Create new page" onClose={closeCreate}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 13 }}>
            Create a new static page (e.g., Home, About, Privacy, Terms). You
            can edit the content after creating it.
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, color: "rgba(255,255,255,0.78)" }}>
              Page title
            </label>
            <input
              ref={titleRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., Home"
              className="ap-input"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(0,0,0,0.35)",
                color: "rgba(255,255,255,0.92)",
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmCreate();
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, color: "rgba(255,255,255,0.78)" }}>
              Slug
            </label>
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="e.g., home"
              className="ap-input"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(0,0,0,0.35)",
                color: "rgba(255,255,255,0.92)",
                outline: "none",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmCreate();
              }}
            />
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
              Preview URL:{" "}
              <span style={{ color: "rgba(255,255,255,0.75)" }}>
                /p/{slugify(newSlug || autoSlug)}
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 6,
            }}
          >
            <button
              className="ap-btn"
              onClick={closeCreate}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              className="ap-btn ap-btnPrimary"
              onClick={confirmCreate}
              disabled={creating}
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        open={confirmDelete.open}
        title="Delete page?"
        onClose={() => setConfirmDelete({ open: false, id: null, title: "" })}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ color: "rgba(255,255,255,0.78)" }}>
            This will permanently delete <b>{confirmDelete.title}</b>. This
            cannot be undone.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              className="ap-btn"
              onClick={() =>
                setConfirmDelete({ open: false, id: null, title: "" })
              }
            >
              Cancel
            </button>
            <button className="ap-btn ap-btnDanger" onClick={doDelete}>
              Delete
            </button>
          </div>
        </div>
      </Modal>

      <div className="ap-head ap-wpHead">
        <div>
          <div className="ap-title">
            Pages{" "}
            <button className="ap-btn ap-wpAdd" onClick={openCreate}>
              Add Page
            </button>
          </div>
          <div className="ap-sub">
            Manage website pages and their published content.
          </div>
        </div>
      </div>
      <div className="ap-wpTabs" role="group" aria-label="Filter pages">
        {[
          ["all", "All"],
          ["published", "Published"],
          ["draft", "Drafts"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={filter === key ? "active" : ""}
            onClick={() => changeFilter(key)}
          >
            {label} <span>({counts[key]})</span>
          </button>
        ))}
      </div>
      <div className="ap-wpToolbar">
        <div className="ap-wpToolbarGroup">
          <select
            aria-label="Bulk action"
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="ap-input"
          >
            <option value="">Bulk actions</option>
            <option value="publish">Publish</option>
            <option value="unpublish">Unpublish</option>
          </select>
          <button
            className="ap-btn"
            disabled={busy || !selected.length || !bulkAction}
            onClick={applyBulk}
          >
            Apply
          </button>
          <select
            aria-label="Pages per page"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPageNumber(1);
            }}
            className="ap-input"
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
          </select>
        </div>
        <div className="ap-wpToolbarGroup ap-wpSearch">
          <input
            className="ap-input"
            placeholder="Search pages"
            aria-label="Search pages"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageNumber(1);
            }}
          />
          <button className="ap-btn" onClick={() => setPageNumber(1)}>
            Search Pages
          </button>
        </div>
      </div>
      <div className="ap-wpTableWrap">
        <table className="ap-table ap-wpTable">
          <thead>
            <tr>
              <th className="ap-wpCheck">
                <input
                  type="checkbox"
                  aria-label="Select visible pages"
                  checked={allVisibleSelected}
                  onChange={(e) => toggleVisible(e.target.checked)}
                />
              </th>
              <th>
                <button
                  className="ap-wpSort"
                  onClick={() => toggleSort("title")}
                >
                  Title{" "}
                  {sort === "title" ? (direction === "asc" ? "↑" : "↓") : "↕"}
                </button>
              </th>
              <th>Status</th>
              <th>
                <button
                  className="ap-wpSort"
                  onClick={() => toggleSort("date")}
                >
                  Date{" "}
                  {sort === "date" ? (direction === "asc" ? "↑" : "↓") : "↕"}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="ap-empty">
                  Loading pages…
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={4} className="ap-empty">
                  No matching pages.
                </td>
              </tr>
            ) : (
              visible.map((p) => (
                <tr key={p.id}>
                  <td className="ap-wpCheck">
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.title}`}
                      checked={selected.includes(p.id)}
                      onChange={(e) => toggleSelection(p.id, e.target.checked)}
                    />
                  </td>
                  <td>
                    <button
                      className="ap-wpPageTitle"
                      onClick={() => nav(`/admin/pages/${p.id}`)}
                    >
                      {p.title || "(Untitled)"}
                    </button>
                    <div className="ap-wpSlug">
                      /{p.slug}
                      {(
                        siteOptions?.home_page_slug
                          ? siteOptions.home_page_slug === p.slug
                          : p.slug === "home"
                      ) ? (
                        <span
                          className="ap-frontBadge"
                          title="Shown at the website's main address (Site Settings)"
                        >
                          Front page
                        </span>
                      ) : null}
                    </div>
                    <div className="ap-wpRowActions">
                      <button onClick={() => nav(`/admin/pages/${p.id}`)}>
                        Edit
                      </button>
                      <span>|</span>
                      <button
                        onClick={() => nav(`/admin/pages/${p.id}/visual`)}
                      >
                        Edit visually
                      </button>
                      <span>|</span>
                      <button onClick={() => openQuick(p)}>Quick Edit</button>
                      <span>|</span>
                      <button onClick={() => preview(p)}>Preview</button>
                      <span>|</span>
                      <button disabled={busy} onClick={() => duplicatePage(p)}>
                        Duplicate
                      </button>
                      <span>|</span>
                      <button
                        onClick={() =>
                          p.status === "published"
                            ? unpublish(p.id)
                            : publish(p.id)
                        }
                      >
                        {p.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                      <span>|</span>
                      <button
                        className="ap-wpDanger"
                        onClick={() => askDelete(p)}
                      >
                        Delete Permanently
                      </button>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`ap-badge ${p.status === "published" ? "ok" : ""}`}
                    >
                      {p.status === "published" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="ap-wpDate">
                    {p.status === "published"
                      ? "Last modified"
                      : "Draft updated"}
                    <br />
                    {p.updated_at
                      ? new Date(p.updated_at).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <th className="ap-wpCheck">
                <input
                  type="checkbox"
                  aria-label="Select visible pages at bottom"
                  checked={allVisibleSelected}
                  onChange={(e) => toggleVisible(e.target.checked)}
                />
              </th>
              <th>Title</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="ap-wpPagination">
        <span>
          {filtered.length} item{filtered.length === 1 ? "" : "s"}
        </span>
        <button
          className="ap-btn"
          disabled={currentPage === 1}
          onClick={() => setPageNumber(1)}
        >
          «
        </button>
        <button
          className="ap-btn"
          disabled={currentPage === 1}
          onClick={() => setPageNumber(currentPage - 1)}
        >
          ‹
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button
          className="ap-btn"
          disabled={currentPage === totalPages}
          onClick={() => setPageNumber(currentPage + 1)}
        >
          ›
        </button>
        <button
          className="ap-btn"
          disabled={currentPage === totalPages}
          onClick={() => setPageNumber(totalPages)}
        >
          »
        </button>
      </div>
      <Modal
        open={!!quickPage}
        title="Quick Edit Page"
        onClose={() => {
          if (!quickSaving) setQuickPage(null);
        }}
      >
        <div className="ap-wpQuick">
          <label>
            Title
            <input
              className="ap-input"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
            />
          </label>
          <label>
            Slug
            <input
              className="ap-input"
              value={quickSlug}
              onChange={(e) => setQuickSlug(e.target.value)}
            />
          </label>
          <p className="ap-hint">
            Updates page title and URL slug. Existing public links may need
            updating.
          </p>
          <div className="ap-wpQuickActions">
            <button
              className="ap-btn"
              disabled={quickSaving}
              onClick={() => setQuickPage(null)}
            >
              Cancel
            </button>
            <button
              className="ap-btn ap-btnPrimary"
              disabled={quickSaving}
              onClick={saveQuick}
            >
              {quickSaving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
