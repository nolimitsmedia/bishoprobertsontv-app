// src/pages/studio/ChannelPages.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";

const css = `
.channel-pages .grid { display:grid;grid-template-columns:1fr 360px;gap:16px; }
@media (max-width: 980px){ .channel-pages .grid { grid-template-columns:1fr; } }
.channel-pages .card { background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:12px; }
.channel-pages .row { display:flex;align-items:center;gap:10px; }
.channel-pages .btn { height:36px;border-radius:10px;padding:0 12px;border:1px solid #e5e7eb;background:#fff;font-weight:600;cursor:pointer; }
.channel-pages .btn.primary { background:#2563eb;color:#fff;border-color:#2563eb; }
.channel-pages .btn.ghost { background:#f8fafc; }
.channel-pages input, .channel-pages select { width:100%;border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px; }
.channel-pages .list-item { display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid #eef2f6; }
.channel-pages .list-item .title { font-weight:800; }
.channel-pages .muted { color:#6b7280;font-size:12px; }
`;

function slugify(s = "") {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function PageForm({
  value,
  onChange,
  onSave,
  onDelete,
  saving,
  onOpenBuilder,
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  function set(k, v) {
    const next = { ...local, [k]: v };
    setLocal(next);
    onChange?.(next);
  }

  return (
    <div className="card">
      <div className="row" style={{ gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: "#6b7280" }}>Title</label>
          <input
            value={local.title || ""}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Page title"
          />
        </div>
        <div style={{ width: 200 }}>
          <label style={{ fontSize: 12, color: "#6b7280" }}>Slug</label>
          <input
            value={local.page_slug || ""}
            onChange={(e) => set("page_slug", slugify(e.target.value))}
            placeholder="about"
          />
        </div>
      </div>

      <div className="row" style={{ gap: 12, marginBottom: 12 }}>
        <div style={{ width: 140 }}>
          <label style={{ fontSize: 12, color: "#6b7280" }}>Sort order</label>
          <input
            type="number"
            value={Number(local.sort_order ?? 0)}
            onChange={(e) => set("sort_order", Number(e.target.value || 0))}
            placeholder="0"
          />
        </div>
        <label
          className="row"
          style={{ gap: 8, userSelect: "none", fontSize: 13, color: "#0f172a" }}
          title="When checked, this becomes the channel's Home page."
        >
          <input
            type="checkbox"
            checked={!!local.is_home}
            onChange={(e) => set("is_home", e.target.checked)}
          />
          Make this the Home page
        </label>

        <div style={{ marginLeft: "auto" }}>
          <button
            type="button"
            className="btn ghost"
            onClick={() => onOpenBuilder?.(local)}
          >
            Open visual builder
          </button>
        </div>
      </div>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        {onDelete && (
          <button
            className="btn"
            onClick={onDelete}
            style={{ borderColor: "#fecaca", color: "#b91c1c" }}
          >
            Delete
          </button>
        )}
        <button
          className="btn primary"
          onClick={() => onSave?.(local)}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save page"}
        </button>
      </div>
    </div>
  );
}

export default function ChannelPages() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState(null);
  const [pages, setPages] = useState([]);
  const [sel, setSel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Compose a public URL for a page
  const publicPrefix = channel?.slug
    ? `/c/${encodeURIComponent(channel.slug)}`
    : "";
  const pageHref = (p) => {
    if (!publicPrefix) return "";
    if (p.is_home || p.page_slug === "home") return publicPrefix;
    const slug = p.page_slug || "page";
    return `${publicPrefix}/page/${encodeURIComponent(slug)}`;
  };

  async function load() {
    setErr("");
    try {
      setLoading(true);

      // 1) My channels (prefer first for shell)
      const me = await api.get("/channels/me").then((r) => r.data || {});
      const channels = me.channels || [];
      const first = channels[0] || null;
      setChannel(first);

      // 2) My pages
      const pagesRes = await api
        .get("/channels/me/pages")
        .then((r) => r.data || {});
      const list = pagesRes.pages || [];

      const normalized = list.map((p, idx) => ({
        // robust ids & fields (some backends omit certain fields)
        id: p.id ?? `${p.slug || p.page_slug || "tmp"}-${idx}`,
        page_slug: p.slug || p.page_slug || "",
        title: p.title || "",
        blocks: (p.content_draft && p.content_draft.blocks) || p.blocks || [],
        is_home: !!p.is_home,
        sort_order: Number(p.nav_order ?? p.sort_order ?? idx) || 0,
      }));

      setPages(normalized);
      if (!sel && normalized.length) setSel(normalized[0]);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load pages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createPage() {
    const title = prompt("New page title (e.g., About):", "About");
    if (!title) return;
    try {
      setSaving(true);
      const payload = {
        title,
        slug: slugify(title),
      };
      const r = await api
        .post("/channels/me/pages", payload)
        .then((x) => x.data || {});
      const created = {
        id: r.id ?? `tmp-${Date.now()}`,
        title: r.title ?? title,
        page_slug: r.slug || r.page_slug || slugify(title),
        blocks: (r.content_draft && r.content_draft.blocks) || r.blocks || [],
        is_home: !!r.is_home,
        sort_order: Number(r.sort_order ?? pages.length) || 0,
      };

      const next = [...pages, created];
      setPages(next);
      setSel(created);
    } catch (e) {
      setErr(e?.response?.data?.message || "Create failed.");
    } finally {
      setSaving(false);
    }
  }

  async function savePage(next) {
    if (!next?.id) return;
    try {
      setSaving(true);

      const body = {
        title: (next.title || "").trim() || "Untitled",
        slug: (next.page_slug || "").trim(), // server will mirror to legacy if needed
        content_draft: next.blocks ? { blocks: next.blocks } : undefined,
        is_home: !!next.is_home,
        sort_order: Number(next.sort_order || 0),
      };

      // Optimistic patch while we wait
      setPages((prev) =>
        prev.map((x) => (x.id === next.id ? { ...x, ...next, ...body } : x))
      );

      const saved = await api
        .put(`/channels/me/pages/${next.id}`, body)
        .then((r) => r.data || {});

      // Prefer server values; fall back to the ones we sent
      const patched = {
        id: saved.id ?? next.id,
        title: saved.title ?? body.title,
        page_slug:
          saved.slug || saved.page_slug || body.slug || next.page_slug || "",
        blocks:
          (saved.content_draft && saved.content_draft.blocks) ||
          next.blocks ||
          [],
        is_home:
          typeof saved.is_home === "boolean" ? saved.is_home : body.is_home,
        sort_order:
          Number(saved.sort_order ?? saved.nav_order ?? body.sort_order ?? 0) ||
          0,
      };

      // If this page became the new Home, un-home the others in UI
      setPages((prev) =>
        prev
          .map((x) =>
            x.id === patched.id
              ? patched
              : { ...x, is_home: patched.is_home ? false : x.is_home }
          )
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      );
      setSel((s) => (s && s.id === patched.id ? patched : s));
    } catch (e) {
      setErr(e?.response?.data?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePage(id) {
    if (!id) return;
    if (!window.confirm("Delete this page?")) return;
    try {
      setSaving(true);
      await api.delete(`/channels/me/pages/${id}`);
      const next = pages.filter((x) => x.id !== id);
      setPages(next);
      setSel(next[0] || null);
    } catch (e) {
      setErr(e?.response?.data?.message || "Delete failed.");
    } finally {
      setSaving(false);
    }
  }

  async function move(id, dir) {
    const idx = pages.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= pages.length) return;

    const a = pages[idx];
    const b = pages[swapIdx];
    const aNew = { ...a, sort_order: b.sort_order };
    const bNew = { ...b, sort_order: a.sort_order };

    try {
      setSaving(true);
      await Promise.all([
        api.put(`/channels/me/pages/${a.id}`, { sort_order: aNew.sort_order }),
        api.put(`/channels/me/pages/${b.id}`, { sort_order: bNew.sort_order }),
      ]);
      const next = [...pages];
      next[idx] = bNew;
      next[swapIdx] = aNew;
      next.sort((x, y) => (x.sort_order || 0) - (y.sort_order || 0));
      setPages(next);
    } catch (e) {
      setErr(e?.response?.data?.message || "Reorder failed.");
    } finally {
      setSaving(false);
    }
  }

  const sorted = useMemo(
    () => [...pages].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [pages]
  );

  return (
    <div className="channel-pages">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        className="row"
        style={{ justifyContent: "space-between", marginBottom: 12 }}
      >
        <h2 style={{ margin: 0, fontWeight: 800 }}>Channel pages</h2>
        <button className="btn primary" onClick={createPage} disabled={saving}>
          + New page
        </button>
      </div>

      {err && (
        <div
          className="card"
          style={{
            borderColor: "#fecaca",
            background: "#fee2e2",
            color: "#7f1d1d",
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      )}

      <div className="grid">
        {/* Left: list */}
        <div className="card">
          {loading ? (
            <div>Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="muted">No pages yet. Create one →</div>
          ) : (
            sorted.map((p, i) => {
              const href = pageHref(p);
              return (
                <div
                  className="list-item"
                  key={p.id ?? p.page_slug ?? `tmp-${i}`} // stable, unique
                >
                  <div style={{ minWidth: 78 }} className="muted">
                    #{p.sort_order ?? 0}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="title">{p.title || "(Untitled)"}</div>
                    <div className="muted">
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer">
                          {href}
                        </a>
                      ) : (
                        "/"
                      )}{" "}
                      {p.is_home ? "• Home" : ""}
                    </div>
                  </div>
                  <button
                    className="btn"
                    onClick={() => move(p.id, "up")}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    className="btn"
                    onClick={() => move(p.id, "down")}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button className="btn" onClick={() => setSel(p)}>
                    Edit
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Right: metadata editor */}
        <div style={{ position: "sticky", top: 12 }}>
          {sel ? (
            <PageForm
              value={sel}
              saving={saving}
              onChange={(v) => setSel(v)} // merge happens inside PageForm.set
              onSave={savePage}
              onDelete={() => deletePage(sel.id)}
              onOpenBuilder={(p) =>
                navigate(
                  `/studio/channel/pages/${encodeURIComponent(p.id)}/edit`
                )
              }
            />
          ) : (
            <div className="card">
              <div className="muted">Select a page to edit</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
