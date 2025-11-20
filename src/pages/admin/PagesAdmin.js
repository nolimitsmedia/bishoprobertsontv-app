// src/pages/admin/PagesAdmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";

/* ---------------- UI bits ---------------- */

function Field({ label, children, style }) {
  return (
    <div className="field" style={{ marginBottom: 12, ...style }}>
      {label && (
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className="input"
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid #e3e3e8",
        outline: "none",
      }}
    />
  );
}

function NumberInput(props) {
  return <TextInput type="number" {...props} />;
}

function Card({ children }) {
  return (
    <div
      className="card"
      style={{
        background: "#fff",
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

function Button({ children, variant = "primary", disabled, ...rest }) {
  const base = {
    borderRadius: 10,
    padding: "10px 14px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600,
    opacity: disabled ? 0.5 : 1,
  };
  const styles =
    variant === "danger"
      ? { background: "#ffe5e5", color: "#b40000", border: "1px solid #ffc9c9" }
      : variant === "ghost"
      ? { background: "transparent", color: "#111", border: "1px solid #ddd" }
      : { background: "#111827", color: "#fff", border: "1px solid #111827" };
  return (
    <button {...rest} disabled={disabled} style={{ ...styles, ...base }}>
      {children}
    </button>
  );
}

/* ---------------- helpers ---------------- */

function slugify(s = "") {
  const out = String(s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
  return out || "page";
}

/* ---------------- main ---------------- */

export default function PagesAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pages, setPages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    sort_order: 0,
    is_home: false,
  });

  const navigate = useNavigate();

  const currentHomeId = useMemo(
    () => pages.find((p) => p.is_home)?.id ?? null,
    [pages]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      setLoading(true);
      // baseURL already includes /api; path should NOT start with /api
      const r = await api.get("/channels/me/pages");
      setPages(r.data?.pages ?? []);
    } catch (e) {
      console.error(e);
      alert("Failed to load pages.");
    } finally {
      setLoading(false);
    }
  }

  /** Old behavior: just cleared the form.
   * New behavior: CREATE immediately, then select it for editing. */
  async function createNewNow() {
    try {
      setSaving(true);
      const baseTitle = "New Page";
      // try to make a friendly unique slug
      const n = pages.length + 1;
      const candidate = slugify(`${baseTitle} ${n}`);
      const payload = {
        title: baseTitle,
        slug: candidate,
        sort_order: pages?.length || 0,
        // if no pages yet, make it the home by default
        is_home: pages.length === 0,
      };
      const r = await api.post("/channels/me/pages", payload);
      const p = r.data?.page;
      if (p?.id) {
        setSelected(p.id);
        setForm({
          title: p.title || baseTitle,
          slug: p.slug || candidate,
          sort_order: p.sort_order ?? 0,
          is_home: !!p.is_home,
        });
      }
      await load();
    } catch (e) {
      console.error(e);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Create failed.";
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  function editRow(p) {
    setSelected(p.id);
    setForm({
      title: p.title || "",
      slug: p.slug || "",
      sort_order: p.sort_order ?? 0,
      is_home: !!p.is_home,
    });
  }

  async function saveCurrent() {
    try {
      setSaving(true);
      const payload = {
        title: form.title?.trim(),
        slug: form.slug?.trim(),
        sort_order: Number(form.sort_order) || 0,
        is_home: !!form.is_home,
      };
      if (!payload.title) return alert("Title is required.");
      if (!payload.slug) return alert("Slug is required.");

      if (selected) {
        await api.put(`/channels/me/pages/${selected}`, payload);
      } else {
        const r = await api.post(`/channels/me/pages`, payload);
        if (r.data?.page?.id) setSelected(r.data.page.id);
      }
      await load();
    } catch (e) {
      console.error(e);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Save failed.";
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(id) {
    if (!window.confirm("Delete this page? This cannot be undone.")) return;
    try {
      await api.delete(`/channels/me/pages/${id}`);
      if (selected === id) {
        setSelected(null);
        setForm({ title: "", slug: "", sort_order: 0, is_home: false });
      }
      await load();
    } catch (e) {
      console.error(e);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Delete failed.";
      alert(msg);
    }
  }

  function openBuilder(id) {
    navigate(`/admin/pages/${id}/edit`);
  }

  return (
    <div style={{ padding: 12 }}>
      <h1 style={{ margin: "6px 0 16px" }}>Pages</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 16,
        }}
      >
        {/* LEFT: list */}
        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 700 }}>All pages</div>
            <Button onClick={createNewNow} disabled={saving}>
              {saving ? "Creating…" : "+ New page"}
            </Button>
          </div>

          {loading ? (
            <div>Loading…</div>
          ) : pages.length === 0 ? (
            <div>No pages yet. Click “New page”.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {pages
                .slice()
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((p) => (
                  <div
                    key={p.id}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 10,
                      padding: 12,
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {p.title || "(untitled)"} {p.is_home ? "🏠" : ""}
                      </div>
                      <div style={{ fontSize: 12, color: "#555" }}>
                        <code>/p/{p.slug}</code> • sort {p.sort_order ?? 0}
                      </div>
                      {p.is_published ? (
                        <div style={{ fontSize: 12, color: "#0a7" }}>
                          Published
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#999" }}>Draft</div>
                      )}
                      <div style={{ fontSize: 12, marginTop: 6 }}>
                        Public URL:{" "}
                        <Link
                          to={`/p/${p.slug}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          /p/{p.slug}
                        </Link>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button variant="ghost" onClick={() => editRow(p)}>
                        Edit
                      </Button>
                      <Button onClick={() => openBuilder(p.id)}>
                        Open visual builder
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => deleteRow(p.id)}
                        disabled={!!p.is_home}
                        title={
                          p.is_home
                            ? "Unset as Home before deleting"
                            : "Delete page"
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>

        {/* RIGHT: editor */}
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>
            {selected ? "Edit page" : "New page"}
          </div>
          <Field label="Title">
            <TextInput
              value={form.title}
              onChange={(e) =>
                setForm((s) => ({ ...s, title: e.target.value }))
              }
              placeholder="My Home"
            />
          </Field>
          <Field label="Slug">
            <TextInput
              value={form.slug}
              onChange={(e) => {
                const v = e.target.value;
                setForm((s) => ({ ...s, slug: v }));
              }}
              placeholder="my-home"
            />
          </Field>
          <Field label="Sort order">
            <NumberInput
              value={form.sort_order}
              onChange={(e) =>
                setForm((s) => ({ ...s, sort_order: e.target.value }))
              }
              placeholder="0"
            />
          </Field>
          <Field>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={!!form.is_home}
                onChange={(e) =>
                  setForm((s) => ({ ...s, is_home: e.target.checked }))
                }
              />
              Make this the Home page
            </label>
            {currentHomeId && selected !== currentHomeId && form.is_home && (
              <div style={{ color: "#b45309", fontSize: 12, marginTop: 6 }}>
                This will replace the current Home page.
              </div>
            )}
          </Field>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Button disabled={saving} onClick={saveCurrent}>
              {saving ? "Saving…" : "Save page"}
            </Button>
            {selected && (
              <Button variant="ghost" onClick={() => openBuilder(selected)}>
                Open visual builder
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
