// src/pages/admin/Website.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";

/* tiny helpers */
const badge = (t, c) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      background: `${c}20`,
      color: c,
    }}
  >
    {t}
  </span>
);

function Section({ title, children, right = null }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ fontWeight: 800 }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function FilePicker({ value, onChange, label = "Logo" }) {
  const ref = useRef(null);
  async function pick(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    const { data } = await api.post("/uploads", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    onChange?.(data?.url || "");
    e.target.value = "";
  }
  return (
    <div>
      <label className="vd-label">{label}</label>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div
          style={{
            width: 96,
            height: 56,
            border: "1px solid var(--line)",
            borderRadius: 8,
            background: "#f8fafc",
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
          }}
        >
          {value ? (
            <img
              alt=""
              src={value.startsWith("http") ? value : `/${value}`}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <span className="vd-muted vd-small">No image</span>
          )}
        </div>
        <div>
          <button className="btn small" onClick={() => ref.current?.click()}>
            Upload…
          </button>
          {value && (
            <button
              className="btn small ghost"
              style={{ marginLeft: 8 }}
              onClick={() => onChange("")}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={pick}
      />
    </div>
  );
}

export default function Website() {
  const navigate = useNavigate();

  // tabs
  const [tab, setTab] = useState("branding");

  // settings
  const [settings, setSettings] = useState({
    brand_color: "#006aff",
    color_scheme: "light",
    logo_url: "",
    maintenance: false,
  });

  // nav items
  const [nav, setNav] = useState([]);

  // pages
  const [pages, setPages] = useState([]);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(null);
  useEffect(() => {
    const h = () => setMenuOpen(null);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  async function loadAll() {
    const [s, n, p] = await Promise.all([
      api.get("/site/settings"),
      api.get("/site/nav"),
      api.get("/site/pages"),
    ]);
    if (s.data) setSettings(s.data);
    setNav(Array.isArray(n.data) ? n.data : []);
    setPages(Array.isArray(p.data) ? p.data : []);
  }
  useEffect(() => {
    loadAll();
  }, []);

  // save handlers
  async function saveSettings(next) {
    const { data } = await api.put("/site/settings", next || settings);
    setSettings(data);
  }
  async function saveNav() {
    await api.put("/site/nav", {
      items: nav.map((n, i) => ({ ...n, sort: i })),
    });
  }

  async function duplicatePage(id) {
    await api.post(`/site/pages/${id}/duplicate`);
    const list = await api.get("/site/pages");
    setPages(list.data || []);
  }
  async function deletePage(id) {
    await api.delete(`/site/pages/${id}`);
    const list = await api.get("/site/pages");
    setPages(list.data || []);
  }

  const filteredPages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    );
  }, [pages, search]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ margin: 0, fontWeight: 800 }}>Website</h2>
        <button
          className="btn"
          onClick={() => navigate("/admin/website/pages/new")}
        >
          + New page
        </button>
      </div>

      {/* tabs */}
      <div className="card" style={{ padding: "8px 12px" }}>
        {["branding", "navigation", "pages", "advanced"].map((t) => (
          <button
            key={t}
            className="btn ghost small"
            style={{
              marginRight: 8,
              fontWeight: tab === t ? 700 : 500,
              background: tab === t ? "var(--line)" : "transparent",
            }}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "branding" && (
        <Section title="Branding">
          <div className="vd-col" style={{ gap: 12 }}>
            <div>
              <label className="vd-label">Brand color</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="color"
                  value={settings.brand_color}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, brand_color: e.target.value }))
                  }
                />
                <input
                  className="search"
                  style={{ width: 120 }}
                  value={settings.brand_color}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, brand_color: e.target.value }))
                  }
                />
                <button className="btn small" onClick={() => saveSettings()}>
                  Save
                </button>
              </div>
            </div>
            <div>
              <label className="vd-label">Color scheme</label>
              <div style={{ display: "flex", gap: 8 }}>
                <label>
                  <input
                    type="radio"
                    checked={settings.color_scheme === "light"}
                    onChange={() =>
                      setSettings((s) => ({ ...s, color_scheme: "light" }))
                    }
                  />{" "}
                  Light
                </label>
                <label>
                  <input
                    type="radio"
                    checked={settings.color_scheme === "dark"}
                    onChange={() =>
                      setSettings((s) => ({ ...s, color_scheme: "dark" }))
                    }
                  />{" "}
                  Dark
                </label>
                <button className="btn small" onClick={() => saveSettings()}>
                  Save
                </button>
              </div>
            </div>
            <FilePicker
              value={settings.logo_url || ""}
              onChange={(url) => saveSettings({ ...settings, logo_url: url })}
            />
          </div>
        </Section>
      )}

      {tab === "navigation" && (
        <Section
          title="Navigation"
          right={
            <button className="btn small" onClick={saveNav}>
              Save
            </button>
          }
        >
          <div className="vd-col" style={{ gap: 8 }}>
            {nav.map((n, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr auto",
                  gap: 8,
                }}
              >
                <input
                  className="search"
                  placeholder="Label"
                  value={n.label}
                  onChange={(e) =>
                    setNav((list) =>
                      list.map((x, i) =>
                        i === idx ? { ...x, label: e.target.value } : x
                      )
                    )
                  }
                />
                <input
                  className="search"
                  placeholder="URL (/about)"
                  value={n.url}
                  onChange={(e) =>
                    setNav((list) =>
                      list.map((x, i) =>
                        i === idx ? { ...x, url: e.target.value } : x
                      )
                    )
                  }
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn small ghost"
                    onClick={() =>
                      setNav((list) => {
                        const a = [...list];
                        if (idx > 0) {
                          const t = a[idx - 1];
                          a[idx - 1] = a[idx];
                          a[idx] = t;
                        }
                        return a;
                      })
                    }
                  >
                    ↑
                  </button>
                  <button
                    className="btn small ghost"
                    onClick={() =>
                      setNav((list) => {
                        const a = [...list];
                        if (idx < a.length - 1) {
                          const t = a[idx + 1];
                          a[idx + 1] = a[idx];
                          a[idx] = t;
                        }
                        return a;
                      })
                    }
                  >
                    ↓
                  </button>
                  <button
                    className="btn small ghost danger"
                    onClick={() =>
                      setNav((list) => list.filter((_, i) => i !== idx))
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            <button
              className="btn small"
              onClick={() =>
                setNav((list) => [...list, { label: "New", url: "/" }])
              }
            >
              + Add item
            </button>
          </div>
        </Section>
      )}

      {tab === "pages" && (
        <Section title="Pages">
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              className="search"
              placeholder="Search…"
              style={{ maxWidth: 360 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className="btn ghost"
              onClick={async () => {
                const { data } = await api.get("/site/pages");
                setPages(data || []);
              }}
            >
              Refresh
            </button>
          </div>
          {filteredPages.length === 0 ? (
            <div className="vd-muted">No pages yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      color: "#6b7280",
                      borderBottom: "1px solid var(--line)",
                      textAlign: "left",
                    }}
                  >
                    <th style={{ padding: "10px 8px" }}>Title</th>
                    <th style={{ padding: "10px 8px" }}>Status</th>
                    <th style={{ padding: "10px 8px" }}>Slug</th>
                    <th
                      style={{ padding: "10px 8px", textAlign: "right" }}
                    ></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPages.map((p) => (
                    <tr
                      key={p.id}
                      style={{ borderBottom: "1px solid var(--line)" }}
                    >
                      <td style={{ padding: "12px 8px" }}>
                        <button
                          className="btn linklike"
                          style={{ padding: 0 }}
                          onClick={() =>
                            navigate(`/admin/website/pages/${p.id}`)
                          }
                        >
                          {p.title}
                        </button>
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {p.status === "public"
                          ? badge("PUBLIC", "#10b981")
                          : p.status === "private"
                          ? badge("PRIVATE", "#6b7280")
                          : badge("ARCHIVED", "#ef4444")}
                      </td>
                      <td style={{ padding: "12px 8px" }}>/ {p.slug}</td>
                      <td style={{ padding: "12px 8px", textAlign: "right" }}>
                        <div
                          style={{
                            position: "relative",
                            display: "inline-block",
                          }}
                        >
                          <button
                            className="btn ghost small"
                            style={{
                              width: 32,
                              height: 32,
                              display: "grid",
                              placeItems: "center",
                              padding: 0,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpen((m) => (m === p.id ? null : p.id));
                            }}
                            title="More"
                          >
                            <span style={{ fontSize: 18, lineHeight: 1 }}>
                              ⋮
                            </span>
                          </button>
                          {menuOpen === p.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="card"
                              style={{
                                position: "absolute",
                                right: 0,
                                top: 36,
                                width: 220,
                                padding: 6,
                                zIndex: 30,
                                boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                              }}
                            >
                              <button
                                className="btn ghost small"
                                style={{
                                  width: "100%",
                                  justifyContent: "flex-start",
                                }}
                                onClick={() => {
                                  setMenuOpen(null);
                                  navigate(`/admin/website/pages/${p.id}`);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="btn ghost small"
                                style={{
                                  width: "100%",
                                  justifyContent: "flex-start",
                                }}
                                onClick={async () => {
                                  setMenuOpen(null);
                                  await duplicatePage(p.id);
                                }}
                              >
                                Duplicate
                              </button>
                              <button
                                className="btn ghost small"
                                style={{
                                  width: "100%",
                                  justifyContent: "flex-start",
                                }}
                                onClick={async () => {
                                  setMenuOpen(null);
                                  const link = `${window.location.origin}/p/${p.slug}`;
                                  try {
                                    await navigator.clipboard.writeText(link);
                                  } catch {
                                    window.prompt("Copy link", link);
                                  }
                                }}
                              >
                                Copy link
                              </button>
                              <button
                                className="btn ghost small danger"
                                style={{
                                  width: "100%",
                                  justifyContent: "flex-start",
                                }}
                                onClick={() => {
                                  setMenuOpen(null);
                                  deletePage(p.id);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {tab === "advanced" && (
        <Section title="Advanced">
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={!!settings.maintenance}
              onChange={(e) =>
                setSettings((s) => ({ ...s, maintenance: e.target.checked }))
              }
            />
            Maintenance mode
          </label>
          <button
            className="btn"
            style={{ marginTop: 10 }}
            onClick={() => saveSettings()}
          >
            Save
          </button>
        </Section>
      )}
    </div>
  );
}
