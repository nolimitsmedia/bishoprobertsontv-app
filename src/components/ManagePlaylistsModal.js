// src/components/ManagePlaylistsModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";

// very light, self-contained styles (scoped by .mpl)
const styles = `
.mpl-overlay{position:fixed;inset:0;background:rgba(2,6,23,.45);display:grid;place-items:center;z-index:2000}
.mpl{width:min(920px,94vw);max-height:90vh;overflow:auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 24px 60px rgba(2,6,23,.25);padding:16px}
.mpl h3{font-size:18px;font-weight:800;margin:0 0 6px}
.mpl .sub{color:#475569;font-size:13px;margin-bottom:10px}
.mpl .close{margin-left:auto;border:1px solid #e2e8f0;background:#fff;border-radius:8px;height:34px;padding:0 10px;cursor:pointer}
.mpl .row{display:grid;grid-template-columns:2fr 120px 1.2fr 1fr 120px;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #eef2f6}
.mpl .head{position:sticky;top:0;background:#fff;border-bottom:1px solid #e2e8f0;padding:8px 0;z-index:1}
.mpl .row div,.mpl .head div{font-size:13px}
.mpl .pill{font-size:11px;font-weight:800;border:1px solid #a7f3d0;background:#ecfdf5;color:#065f46;border-radius:999px;padding:4px 8px;display:inline-block}
.mpl .muted{color:#64748b}
.mpl select,.mpl input[type="text"]{height:34px;border:1px solid #e2e8f0;border-radius:8px;padding:0 10px;width:100%}
.mpl .btn{height:34px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;padding:0 12px;font-weight:700;cursor:pointer}
.mpl .btn.save{background:#2563eb;border-color:#2563eb;color:#fff}
.mpl .btn.save:disabled{opacity:.6;cursor:default}
.mpl .right{display:flex;gap:8px;justify-content:flex-end}
.mpl .err{color:#b91c1c}
.mpl .ok{color:#065f46}
.mpl .grid{margin-top:8px}
@media (max-width:860px){.mpl .row,.mpl .head{grid-template-columns:2fr .8fr 1fr 1fr 100px}}
@media (max-width:680px){.mpl .row,.mpl .head{grid-template-columns:1.6fr .6fr 1fr 1fr}
.mpl .row .actions,.mpl .head .actions{display:none}}
`;

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// category key helper (matches your Catalog logic)
function categoryKeyFor(c) {
  // prefer numeric id; otherwise fallback to name:slug
  if (c?.id != null && String(c.id).length) return String(c.id);
  const nm = c?.name || c?.title;
  return nm ? `name:${slugify(nm)}` : "";
}

export default function ManagePlaylistsModal({
  open,
  onClose,
  categories = [],
}) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]); // playlists from /playlists
  const [busy, setBusy] = useState({});
  const [msg, setMsg] = useState(null);

  const catOptions = useMemo(() => {
    const opts = categories.map((c) => ({
      key: categoryKeyFor(c),
      name: c?.name || c?.title || `Category ${c?.id ?? ""}`,
    }));
    // dedupe by key
    const map = new Map();
    opts.forEach((o) => o.key && !map.has(o.key) && map.set(o.key, o));
    return [{ key: "", name: "— None —" }, ...Array.from(map.values())];
  }, [categories]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setLoading(true);
        setMsg(null);
        const { data } = await api.get("/playlists"); // auth list (returns metadata)
        const items = Array.isArray(data?.items) ? data.items : [];
        setRows(
          items.map((p) => ({
            ...p,
            _featured:
              p?.metadata?.featured_category != null
                ? String(p.metadata.featured_category)
                : "",
            _customOpen: false,
            _customKey:
              p?.metadata?.featured_category != null
                ? String(p.metadata.featured_category)
                : "",
          }))
        );
      } catch (e) {
        setMsg({
          type: "err",
          text: e?.response?.data?.message || "Load error",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  async function saveRow(p) {
    try {
      setBusy((b) => ({ ...b, [p.id]: true }));
      const featured = p._customOpen ? p._customKey : p._featured;
      const metadata = {
        ...(p.metadata || {}),
        featured_category: featured || null, // remove when empty
      };
      const { data } = await api.put(`/playlists/${p.id}`, { metadata });
      setRows((rs) =>
        rs.map((r) =>
          r.id === p.id
            ? {
                ...r,
                metadata: data.metadata || metadata,
                _featured: featured || "",
                _customKey: featured || "",
              }
            : r
        )
      );
      setMsg({ type: "ok", text: "Saved changes." });
    } catch (e) {
      setMsg({
        type: "err",
        text: e?.response?.data?.message || "Failed to save",
      });
    } finally {
      setBusy((b) => ({ ...b, [p.id]: false }));
    }
  }

  if (!open) return null;

  return (
    <div className="mpl-overlay" onClick={onClose}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="mpl" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3>Manage playlists</h3>
          <button className="close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="sub">
          Choose which <b>category row</b> should show a single playlist card.
          This sets <code>metadata.featured_category</code> on the playlist.
        </div>

        {msg && (
          <div className={msg.type === "ok" ? "ok" : "err"}>{msg.text}</div>
        )}

        <div className="head row muted">
          <div>Playlist</div>
          <div>Items</div>
          <div>Featured category</div>
          <div>Custom key</div>
          <div className="actions">Save</div>
        </div>

        <div className="grid">
          {loading ? (
            <div style={{ padding: 12 }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 12 }}>No playlists yet.</div>
          ) : (
            rows.map((p) => (
              <div key={p.id} className="row">
                <div style={{ fontWeight: 700 }}>{p.title || "Untitled"}</div>
                <div>
                  <span className="pill">
                    {p.video_count ?? p.item_count ?? 0} items
                  </span>
                </div>

                {/* Featured category select */}
                <div>
                  <select
                    value={p._featured}
                    disabled={p._customOpen}
                    onChange={(e) =>
                      setRows((rs) =>
                        rs.map((r) =>
                          r.id === p.id
                            ? { ...r, _featured: e.target.value }
                            : r
                        )
                      )
                    }
                  >
                    {catOptions.map((o) => (
                      <option key={o.key || "none"} value={o.key}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <div className="muted" style={{ marginTop: 6 }}>
                    <label style={{ display: "inline-flex", gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={p._customOpen}
                        onChange={(e) =>
                          setRows((rs) =>
                            rs.map((r) =>
                              r.id === p.id
                                ? { ...r, _customOpen: e.target.checked }
                                : r
                            )
                          )
                        }
                      />
                      Use custom key
                    </label>
                  </div>
                </div>

                {/* Custom key input */}
                <div>
                  <input
                    type="text"
                    placeholder='e.g. "12" or "name:trending"'
                    disabled={!p._customOpen}
                    value={p._customKey}
                    onChange={(e) =>
                      setRows((rs) =>
                        rs.map((r) =>
                          r.id === p.id
                            ? { ...r, _customKey: e.target.value }
                            : r
                        )
                      )
                    }
                  />
                  <div className="muted" style={{ marginTop: 6 }}>
                    Leave blank to remove.
                  </div>
                </div>

                <div className="actions right">
                  <button
                    className="btn save"
                    disabled={!!busy[p.id]}
                    onClick={() => saveRow(p)}
                  >
                    {busy[p.id] ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
