// src/pages/admin/WebsitePageEditor.js
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api";

const empty = {
  title: "",
  slug: "",
  status: "public",
  blocks: [],
};

function BlockEditor({ block, onChange, onRemove, onMoveUp, onMoveDown }) {
  return (
    <div className="card" style={{ padding: 12, marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <strong>{block.type}</strong>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn small ghost" onClick={onMoveUp}>
            ↑
          </button>
          <button className="btn small ghost" onClick={onMoveDown}>
            ↓
          </button>
          <button className="btn small ghost danger" onClick={onRemove}>
            Delete
          </button>
        </div>
      </div>

      {/* fields per block type */}
      {block.type === "hero" && (
        <div className="vd-col" style={{ gap: 8 }}>
          <input
            className="search"
            placeholder="Heading"
            value={block.heading || ""}
            onChange={(e) => onChange({ ...block, heading: e.target.value })}
          />
          <textarea
            className="search"
            rows={3}
            placeholder="Subheading"
            value={block.sub || ""}
            onChange={(e) => onChange({ ...block, sub: e.target.value })}
          />
        </div>
      )}

      {block.type === "text" && (
        <textarea
          className="search"
          rows={5}
          placeholder="Text content"
          value={block.text || ""}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      )}

      {block.type === "videoGrid" && (
        <div className="vd-col" style={{ gap: 8 }}>
          <input
            className="search"
            placeholder="Section title"
            value={block.title || ""}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
          />
          <input
            className="search"
            placeholder="Category ID (optional)"
            value={block.category_id || ""}
            onChange={(e) =>
              onChange({ ...block, category_id: e.target.value })
            }
          />
        </div>
      )}
    </div>
  );
}

function Preview({ page }) {
  const { blocks = [] } = page || {};
  return (
    <div className="card" style={{ padding: 16 }}>
      {blocks.map((b, i) => {
        if (b.type === "hero") {
          return (
            <div
              key={i}
              style={{
                padding: "36px 20px",
                textAlign: "center",
                background: "#0b0b0b",
                color: "#fff",
                borderRadius: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
                {b.heading || "Hero heading"}
              </div>
              <div style={{ opacity: 0.8 }}>{b.sub || "Subheading"}</div>
            </div>
          );
        }
        if (b.type === "text") {
          return (
            <div key={i} style={{ padding: "12px 4px", marginBottom: 12 }}>
              <div style={{ whiteSpace: "pre-wrap" }}>{b.text || "Text…"}</div>
            </div>
          );
        }
        if (b.type === "videoGrid") {
          return (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                {b.title || "Videos"}
              </div>
              <div className="vd-muted vd-small">
                Grid of videos (category: {b.category_id || "all"})
              </div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

export default function WebsitePageEditor() {
  const { id } = useParams(); // "new" or numeric id
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const isNew = id === "new";
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (isNew) return;
      const { data } = await api.get(`/site/pages/${id}`);
      setForm(data || empty);
    }
    load();
  }, [id, isNew]);

  function setField(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }
  function addBlock(type) {
    const defaults =
      type === "hero"
        ? { type, heading: "", sub: "" }
        : type === "text"
        ? { type, text: "" }
        : type === "videoGrid"
        ? { type, title: "", category_id: "" }
        : { type };
    setForm((p) => ({ ...p, blocks: [...(p.blocks || []), defaults] }));
  }

  async function save() {
    setSaving(true);
    try {
      if (isNew) {
        const { data } = await api.post("/site/pages", form);
        navigate(`/admin/website/pages/${data.id}`);
      } else {
        await api.put(`/site/pages/${id}`, form);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ margin: 0, fontWeight: 800 }}>
          {isNew ? "New page" : "Edit page"}
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn ghost"
            onClick={() => navigate("/admin/website")}
          >
            Back
          </button>
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "minmax(320px, 560px) 1fr",
        }}
      >
        {/* left: form */}
        <div className="card" style={{ padding: 16 }}>
          <label className="vd-label">Title</label>
          <input
            className="search"
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
          />

          <div className="vd-row" style={{ gap: 10, marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <label className="vd-label">Slug</label>
              <input
                className="search"
                value={form.slug}
                onChange={(e) => setField("slug", e.target.value)}
                placeholder="auto"
              />
            </div>
            <div style={{ width: 180 }}>
              <label className="vd-label">Status</label>
              <select
                className="search"
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <strong>Blocks</strong>
              <div className="vd-row" style={{ gap: 6 }}>
                <button
                  className="btn small ghost"
                  onClick={() => addBlock("hero")}
                >
                  + Hero
                </button>
                <button
                  className="btn small ghost"
                  onClick={() => addBlock("text")}
                >
                  + Text
                </button>
                <button
                  className="btn small ghost"
                  onClick={() => addBlock("videoGrid")}
                >
                  + Video Grid
                </button>
              </div>
            </div>

            {(form.blocks || []).map((b, idx) => (
              <BlockEditor
                key={idx}
                block={b}
                onChange={(nb) =>
                  setForm((p) => {
                    const arr = [...(p.blocks || [])];
                    arr[idx] = nb;
                    return { ...p, blocks: arr };
                  })
                }
                onRemove={() =>
                  setForm((p) => ({
                    ...p,
                    blocks: (p.blocks || []).filter((_, i) => i !== idx),
                  }))
                }
                onMoveUp={() =>
                  setForm((p) => {
                    const a = [...(p.blocks || [])];
                    if (idx > 0) {
                      const t = a[idx - 1];
                      a[idx - 1] = a[idx];
                      a[idx] = t;
                    }
                    return { ...p, blocks: a };
                  })
                }
                onMoveDown={() =>
                  setForm((p) => {
                    const a = [...(p.blocks || [])];
                    if (idx < a.length - 1) {
                      const t = a[idx + 1];
                      a[idx + 1] = a[idx];
                      a[idx] = t;
                    }
                    return { ...p, blocks: a };
                  })
                }
              />
            ))}
          </div>
        </div>

        {/* right: preview */}
        <Preview page={form} />
      </div>
    </div>
  );
}
