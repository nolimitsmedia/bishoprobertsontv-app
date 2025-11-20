// src/pages/content/Categories.js
import React, { useEffect, useState } from "react";
import api from "../../api";

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function CategoriesPage() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({ name: "", slug: "" });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/categories");
      setItems(data || []);
    } catch (e) {
      console.error("load categories error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!name.trim()) return;
    try {
      setSaving(true);
      await api.post("/categories", { name, slug: slugify(name) });
      setName("");
      await load();
    } catch (e) {
      alert(e?.response?.data?.message || "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id) {
    try {
      setSaving(true);
      await api.put(`/categories/${id}`, {
        name: edit.name,
        slug: edit.slug || slugify(edit.name),
      });
      setEditingId(null);
      await load();
    } catch (e) {
      alert(e?.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Delete this category?")) return;
    try {
      await api.delete(`/categories/${id}`);
      await load();
    } catch {
      alert("Delete failed");
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Categories</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            className="search"
            placeholder="New category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <button className="btn" disabled={saving} onClick={add}>
            {saving ? "Saving…" : "Add"}
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            No categories yet.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{ textAlign: "left", borderBottom: "1px solid #23304a" }}
              >
                <th style={{ padding: 8, width: 320 }}>Name</th>
                <th style={{ padding: 8 }}>Slug</th>
                <th style={{ padding: 8, width: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const isEdit = editingId === c.id;
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid #15213a" }}>
                    <td style={{ padding: 8 }}>
                      {isEdit ? (
                        <input
                          className="search"
                          value={edit.name}
                          onChange={(e) =>
                            setEdit({
                              ...edit,
                              name: e.target.value,
                              slug: slugify(e.target.value),
                            })
                          }
                        />
                      ) : (
                        <strong>{c.name}</strong>
                      )}
                    </td>
                    <td style={{ padding: 8 }}>
                      {isEdit ? (
                        <input
                          className="search"
                          value={edit.slug}
                          onChange={(e) =>
                            setEdit({ ...edit, slug: e.target.value })
                          }
                        />
                      ) : (
                        <span style={{ opacity: 0.8 }}>{c.slug}</span>
                      )}
                    </td>
                    <td style={{ padding: 8 }}>
                      {isEdit ? (
                        <>
                          <button
                            className="btn"
                            onClick={() => saveEdit(c.id)}
                            style={{ marginRight: 8 }}
                          >
                            Save
                          </button>
                          <button
                            className="btn ghost"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn"
                            onClick={() => {
                              setEditingId(c.id);
                              setEdit({ name: c.name, slug: c.slug });
                            }}
                            style={{ marginRight: 8 }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn ghost"
                            onClick={() => remove(c.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
