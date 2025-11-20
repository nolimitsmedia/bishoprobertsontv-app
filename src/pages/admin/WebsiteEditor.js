// src/pages/admin/WebsiteEditor.js
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";

/* ----------------------------------------------------------------------------
 * Defaults (kept in sync with server's defaultSettings)
 * ------------------------------------------------------------------------- */
const DEFAULTS = {
  branding: {
    brand_color: "#006aff",
    theme: "light", // 'light' | 'dark'
    custom_theme: false,
    logo_url: null,
    favicon_url: null,
    name: "BishopTV",
  },
  navigation: {
    menu: [
      { id: "home", title: "Home", path: "/", visible: true },
      { id: "about", title: "About", path: "/about", visible: true },
    ],
  },
  catalog: {
    featured_category_id: null,
  },
  advanced: {
    custom_css: "",
  },
};

/* ----------------------------------------------------------------------------
 * Small helpers
 * ------------------------------------------------------------------------- */
const clampHex = (s = "") =>
  s
    .trim()
    .replace(/[^#a-fA-F0-9]/g, "")
    .slice(0, 7) || "#000000";

function contrastBadge(hex) {
  const good = true;
  return (
    <span
      style={{
        marginLeft: 8,
        fontSize: 12,
        fontWeight: 700,
        background: good ? "#d1fae5" : "#fee2e2",
        color: good ? "#047857" : "#991b1b",
        borderRadius: 999,
        padding: "2px 8px",
      }}
    >
      {good ? "GOOD CONTRAST" : "LOW CONTRAST"}
    </span>
  );
}

function Badge({ children }) {
  return (
    <span
      style={{
        fontSize: 11,
        letterSpacing: 0.5,
        fontWeight: 800,
        background: "#111827",
        color: "#fff",
        padding: "5px 10px",
        borderRadius: 999,
        marginRight: 10,
      }}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------------------
 * Main component
 * ------------------------------------------------------------------------- */
export default function WebsiteEditor() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // UI state
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("Branding"); // Branding | Navigation | Catalog | Advanced
  const [previewTab, setPreviewTab] = useState("Home"); // Home | About

  // Real data for preview
  const [categories, setCategories] = useState([]);
  const [videos, setVideos] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");

  const theme = settings.branding.theme === "dark" ? "dark" : "light";

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [siteRes, catRes, vidRes] = await Promise.all([
        api.get("/site"),
        api.get("/categories"),
        api.get("/videos", { params: { limit: 48 } }),
      ]);

      const site = siteRes?.data || {};
      setSettings({
        ...DEFAULTS,
        ...site,
        branding: { ...DEFAULTS.branding, ...(site?.branding || {}) },
        navigation: { ...DEFAULTS.navigation, ...(site?.navigation || {}) },
        catalog: { ...DEFAULTS.catalog, ...(site?.catalog || {}) },
        advanced: { ...DEFAULTS.advanced, ...(site?.advanced || {}) },
      });

      const cats = Array.isArray(catRes?.data?.items)
        ? catRes.data.items
        : catRes?.data || [];
      setCategories(cats);

      const vids = Array.isArray(vidRes?.data?.items)
        ? vidRes.data.items
        : vidRes?.data || [];
      setVideos(vids);
    } catch (e) {
      console.error("load site error:", e);
      setSettings(DEFAULTS);
      setCategories([]);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    try {
      setSaving(true);
      await api.put("/site", settings);
    } catch (e) {
      console.error("save site error:", e);
      alert("Failed to save. Check server logs.");
    } finally {
      setSaving(false);
    }
  }

  function setBranding(patch) {
    setSettings((s) => ({ ...s, branding: { ...s.branding, ...patch } }));
  }

  async function uploadTo(pathKey, file) {
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = data?.url || data?.path || data?.location || "";
      if (!url) throw new Error("Upload failed");
      setBranding({ [pathKey]: url.startsWith("http") ? url : `/${url}` });
    } catch (e) {
      console.error("upload error:", e);
      alert("Upload failed.");
    }
  }

  // Filter videos by search and category
  const filteredVideos = useMemo(() => {
    const q = (search || "").toLowerCase();
    let list = videos;
    if (categoryId !== "all") {
      list = list.filter((v) => {
        // Try common shapes for category id(s)
        const ids = v.category_ids || v.categories || [];
        if (Array.isArray(ids)) return ids.includes(categoryId);
        return v.category_id === categoryId;
      });
    }
    if (q) {
      list = list.filter((v) =>
        (v.title || v.name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [videos, categoryId, search]);

  /* -------------------- Responsive two-column grid -------------------- */
  const pageStyle = useMemo(
    () => ({
      ...S.page,
      gridTemplateColumns: panelOpen ? "minmax(720px,1fr) 420px" : "1fr",
      transition: "grid-template-columns .18s ease",
    }),
    [panelOpen]
  );

  // Click handler: Featured Category box -> open editor & go to Catalog tab
  const openCatalogFromPreview = () => {
    setPanelOpen(true);
    setActiveTab("Catalog");
  };

  return (
    <div style={S.app}>
      {/* Admin ribbon */}
      <div style={S.ribbon}>
        <div style={S.ribbonLeft}>
          <Badge>ADMIN</Badge>
          <strong style={{ marginRight: 8 }}>Robin Paje</strong>
          <span style={{ color: "#9ca3af" }}>Maintenance mode:</span>{" "}
          <a href="#!" style={{ fontWeight: 700 }}>
            Enabled
          </a>
        </div>
        <div style={S.ribbonRight}>
          <a href="#!" style={S.ribbonLink}>
            Manage videos
          </a>
          <span style={{ opacity: 0.4, margin: "0 6px" }}>·</span>
          <a href="#!" style={S.ribbonLink}>
            Manage categories
          </a>
          <span style={{ opacity: 0.4, margin: "0 6px" }}>·</span>
          <a href="#!" style={S.ribbonLink}>
            Help
          </a>
        </div>
      </div>

      {/* Main */}
      <div style={pageStyle}>
        {/* PREVIEW (fills entire width when panel closed) */}
        <div style={{ ...S.previewWrap(theme), minWidth: 0 }}>
          <PreviewTopNav
            siteName={settings.branding.name || "Your membership"}
            active={previewTab}
            onTab={setPreviewTab}
            editOpen={panelOpen}
            onEditToggle={() => setPanelOpen((v) => !v)}
          />

          {previewTab === "Home" ? (
            <PreviewHome
              theme={theme}
              brandColor={settings.branding.brand_color}
              // real data
              categories={categories}
              videos={filteredVideos}
              search={search}
              setSearch={setSearch}
              categoryId={categoryId}
              setCategoryId={setCategoryId}
              // open editor to Catalog
              onSelectFeaturedCategory={openCatalogFromPreview}
            />
          ) : (
            <PreviewAbout theme={theme} />
          )}
        </div>

        {/* EDITOR (sidebar) */}
        <div style={S.editorWrap(panelOpen)}>
          {/* header */}
          <div style={S.panelHeader}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Edit website</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save & apply"}
              </button>
              <button
                className="btn ghost"
                onClick={() => setPanelOpen(false)}
                title="Close editor"
              >
                ✕
              </button>
            </div>
          </div>

          {/* tabs */}
          <div style={S.tabs}>
            {["Branding", "Navigation", "Catalog", "Advanced"].map((t) => (
              <button
                key={t}
                className="btn ghost"
                style={{
                  ...S.tabBtn,
                  ...(activeTab === t ? S.tabBtnActive : {}),
                }}
                onClick={() => setActiveTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={S.panelBody}>
            {loading ? (
              <div className="vd-muted">Loading…</div>
            ) : (
              <>
                {activeTab === "Branding" && (
                  <BrandingPanel
                    branding={settings.branding}
                    setBranding={setBranding}
                    onUploadLogo={(file) => uploadTo("logo_url", file)}
                    onUploadFavicon={(file) => uploadTo("favicon_url", file)}
                  />
                )}

                {activeTab === "Navigation" && (
                  <NavigationPanel
                    settings={settings}
                    setSettings={setSettings}
                  />
                )}

                {activeTab === "Catalog" && (
                  <CatalogPanel settings={settings} setSettings={setSettings} />
                )}

                {activeTab === "Advanced" && (
                  <AdvancedPanel
                    settings={settings}
                    setSettings={setSettings}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Panels (Branding / Navigation / Catalog / Advanced)
 * ------------------------------------------------------------------------- */

function BrandingPanel({
  branding,
  setBranding,
  onUploadLogo,
  onUploadFavicon,
}) {
  const [hex, setHex] = useState(branding.brand_color || "#006aff");

  useEffect(() => {
    setHex(branding.brand_color || "#006aff");
  }, [branding.brand_color]);

  const onHexBlur = () => {
    setBranding({ brand_color: clampHex(hex) });
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Color */}
      <Section title="Color">
        <div className="vd-row" style={{ alignItems: "center", gap: 12 }}>
          <input
            type="color"
            value={hex}
            onChange={(e) => {
              setHex(e.target.value);
              setBranding({ brand_color: e.target.value });
            }}
            style={{
              width: 36,
              height: 36,
              cursor: "pointer",
              border: "1px solid var(--line)",
              borderRadius: 6,
              background: "transparent",
            }}
          />
          <input
            className="search"
            style={{ width: 110 }}
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            onBlur={onHexBlur}
          />
          {contrastBadge(hex)}
        </div>

        {/* scheme */}
        <div style={{ marginTop: 12 }}>
          <div className="vd-muted vd-small" style={{ marginBottom: 6 }}>
            Color scheme
          </div>
          <div className="vd-row" style={{ gap: 16, alignItems: "center" }}>
            <label className="vd-row" style={{ gap: 8, cursor: "pointer" }}>
              <input
                type="radio"
                name="scheme"
                checked={branding.theme !== "dark"}
                onChange={() => setBranding({ theme: "light" })}
              />
              Light
            </label>
            <label className="vd-row" style={{ gap: 8, cursor: "pointer" }}>
              <input
                type="radio"
                name="scheme"
                checked={branding.theme === "dark"}
                onChange={() => setBranding({ theme: "dark" })}
              />
              Dark
            </label>
            <label
              className="vd-row"
              style={{ gap: 8, marginLeft: 8, cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={!!branding.custom_theme}
                onChange={(e) =>
                  setBranding({ custom_theme: e.target.checked })
                }
              />
              Custom scheme color
            </label>
          </div>
        </div>
      </Section>

      {/* Logo */}
      <Section title="Logo">
        <UploadBox
          label="Logo"
          url={branding.logo_url}
          onPick={(f) => onUploadLogo(f)}
          hint="Recommended size: 480×192px, PNG with transparent background"
        />
        <UploadBox
          label="Favicon"
          url={branding.favicon_url}
          onPick={(f) => onUploadFavicon(f)}
          hint="Recommended size: 192×192px, ICO or PNG"
        />
      </Section>

      {/* Website name */}
      <Section title="Website name">
        <input
          className="search"
          value={branding.name || ""}
          onChange={(e) => setBranding({ name: e.target.value })}
          placeholder="Your website name"
        />
        <div className="vd-muted vd-small" style={{ marginTop: 6 }}>
          This will be used as your logo if you don’t upload one.
        </div>
        <div
          style={{
            borderTop: "1px solid var(--line)",
            marginTop: 14,
            paddingTop: 12,
          }}
        >
          <a href="#!" className="vd-small">
            Account settings ↗
          </a>
        </div>
      </Section>
    </div>
  );
}

function NavigationPanel({ settings }) {
  return (
    <Section title="Navigation">
      <div className="vd-muted vd-small" style={{ marginBottom: 8 }}>
        Default menu:
      </div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {settings.navigation.menu.map((m) => (
          <li key={m.id} style={{ margin: "4px 0" }}>
            {m.title} — <span className="vd-muted">{m.path}</span>
          </li>
        ))}
      </ul>
      <div className="vd-muted vd-small" style={{ marginTop: 10 }}>
        (Add full menu editor later if desired.)
      </div>
    </Section>
  );
}

function CatalogPanel({ settings, setSettings }) {
  return (
    <Section title="Catalog">
      <div className="vd-muted vd-small" style={{ marginBottom: 8 }}>
        Featured category ID
      </div>
      <input
        className="search"
        value={settings.catalog.featured_category_id || ""}
        onChange={(e) =>
          setSettings((s) => ({
            ...s,
            catalog: { ...s.catalog, featured_category_id: e.target.value },
          }))
        }
        placeholder="Optional category ID"
        style={{ maxWidth: 280 }}
      />
      <div className="vd-muted vd-small" style={{ marginTop: 8 }}>
        Select the category that will appear in the Home spotlight section.
      </div>
    </Section>
  );
}

function AdvancedPanel({ settings, setSettings }) {
  return (
    <Section title="Advanced">
      <div className="vd-muted vd-small" style={{ marginBottom: 8 }}>
        Custom CSS
      </div>
      <textarea
        className="search"
        rows={8}
        placeholder="/* Your CSS here */"
        value={settings.advanced.custom_css || ""}
        onChange={(e) =>
          setSettings((s) => ({
            ...s,
            advanced: { ...s.advanced, custom_css: e.target.value },
          }))
        }
      />
    </Section>
  );
}

/* ----------------------------------------------------------------------------
 * Preview UI
 * ------------------------------------------------------------------------- */

function PreviewTopNav({ siteName, active, onTab, editOpen, onEditToggle }) {
  return (
    <div style={S.nav}>
      <div style={S.navLeft}>
        <div style={{ fontWeight: 800 }}>{siteName}</div>
        <div style={S.navTabs}>
          {["Home", "About"].map((t) => (
            <button
              key={t}
              className="btn ghost"
              style={{
                ...S.navTab,
                ...(active === t ? S.navTabActive : {}),
              }}
              onClick={() => onTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div style={S.navRight}>
        <button className="btn small" onClick={onEditToggle}>
          {editOpen ? "Close editor" : "Edit website"}
        </button>
        <div style={S.avatar}>RP</div>
      </div>
    </div>
  );
}

function PreviewHome({
  theme,
  brandColor,
  categories,
  videos,
  search,
  setSearch,
  categoryId,
  setCategoryId,
  onSelectFeaturedCategory,
}) {
  const releases = videos.slice(0, 4);
  const library = videos.slice(4, 12);

  return (
    <div style={S.previewBody}>
      {/* Featured category selector — tall, clickable; opens editor → Catalog */}
      <div
        className="card"
        onClick={onSelectFeaturedCategory}
        style={{
          textAlign: "center",
          padding: 18,
          border: "1px dashed var(--line)",
          background: theme === "dark" ? "#0b1324" : "#fff",
          height: 220, // << requested height
          display: "grid",
          alignContent: "center",
          gap: 8,
          cursor: "pointer",
        }}
        title="Click to open the Catalog editor"
      >
        <button className="btn ghost">Select featured category</button>
        <div className="vd-muted vd-small">
          This section is hidden from end-users until you select a featured
          category (click to open the Catalog tab).
        </div>
      </div>

      {/* search + filter */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(240px, 1fr) 220px",
          gap: 12,
          marginTop: 14,
        }}
      >
        <input
          className="search"
          placeholder="Search videos"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ position: "relative" }}>
          <select
            className="search"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="all">Category: All</option>
            {categories.map((c) => (
              <option key={c.id || c._id} value={c.id || c._id}>
                {c.title || c.name}
              </option>
            ))}
          </select>
          <div
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              opacity: 0.6,
            }}
          >
            ▾
          </div>
        </div>
      </div>

      {/* New releases */}
      <h3 style={{ margin: "16px 0 10px", fontWeight: 800 }}>New releases</h3>
      {releases.length === 0 ? (
        <div className="vd-muted vd-small">No videos yet.</div>
      ) : (
        <div style={S.thumbGrid}>
          {releases.map((v) => (
            <VideoCard key={v.id || v._id} video={v} />
          ))}
        </div>
      )}

      {/* My Library (more real videos) */}
      <h3 style={{ margin: "16px 0 10px", fontWeight: 800 }}>My Library</h3>
      {library.length === 0 ? (
        <div className="vd-muted vd-small">No more videos to show.</div>
      ) : (
        <div style={S.thumbGrid}>
          {library.map((v) => (
            <VideoCard key={v.id || v._id} video={v} />
          ))}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 16 }}>
        <span className="vd-small vd-muted">
          © 2025 <strong>Robin's membership</strong> · Terms · Privacy · FAQ ·
          Buy gift card · Claim gift card
        </span>
        <div className="vd-small vd-muted" style={{ marginTop: 4 }}>
          ⚡ Powered by Uscreen (preview)
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video }) {
  const title = video.title || video.name || "Untitled";
  const img =
    video.thumbnail_url ||
    video.thumbnail ||
    video.poster ||
    video.cover ||
    video.image_url ||
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop";

  const vid = video.id || video._id;

  return (
    <div
      style={{ ...S.cardWrap, cursor: "pointer" }}
      title="Open video"
      onClick={() => window.open(`/watch/${vid}`, "_blank")}
    >
      <div style={S.cardImageWrap}>
        <img
          src={img}
          alt={title}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        {video.duration_seconds != null && (
          <div style={S.durationBadge}>
            {formatDuration(video.duration_seconds)}
          </div>
        )}
      </div>
      <div style={{ paddingTop: 6, fontWeight: 600, fontSize: 14 }}>
        {title}
      </div>
    </div>
  );
}

function formatDuration(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rs = s % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(rs).padStart(2, "0")}`
    : `${m}:${String(rs).padStart(2, "0")}`;
}

function PreviewAbout({ theme }) {
  return (
    <div style={S.previewBody}>
      <div className="card">
        <h3 style={{ marginTop: 0, fontWeight: 800 }}>About</h3>
        <p className="vd-muted">
          This is a simple about page preview. Customize your site’s look and
          feel from the editor.
        </p>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Small building blocks
 * ------------------------------------------------------------------------- */

function Section({ title, children }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function UploadBox({ label, url, onPick, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <label
        style={{
          display: "grid",
          placeItems: "center",
          height: 140,
          borderRadius: 10,
          border: "1px dashed var(--line)",
          background: "#f9fafb",
          cursor: "pointer",
        }}
      >
        {url ? (
          <img
            src={url}
            alt=""
            style={{ maxHeight: 120, maxWidth: "100%", objectFit: "contain" }}
          />
        ) : (
          <div className="vd-muted">
            Drag and drop, or click to select image
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => onPick(e.target.files?.[0])}
        />
      </label>
      {hint && (
        <div className="vd-small vd-muted" style={{ marginTop: 6 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Styles (inline tokens used throughout)
 * ------------------------------------------------------------------------- */
const S = {
  app: {
    display: "grid",
    gridTemplateRows: "auto 1fr",
    minHeight: "100%",
  },

  ribbon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 12px",
    background: "#fff7ed",
    borderBottom: "1px solid #fde68a",
    position: "sticky",
    top: 0,
    zIndex: 5,
  },
  ribbonLeft: { display: "flex", alignItems: "center" },
  ribbonRight: { display: "flex", alignItems: "center" },
  ribbonLink: { fontWeight: 600 },

  page: {
    display: "grid",
    gap: 0,
    minHeight: 0,
  },

  previewWrap: (theme) => ({
    background: theme === "dark" ? "#0f172a" : "#fff",
    color: theme === "dark" ? "#e5e7eb" : "#111827",
    minHeight: "calc(100vh - 46px)",
    overflow: "auto",
  }),

  editorWrap: (open) => ({
    display: open ? "block" : "none",
    minWidth: 0,
    borderLeft: "1px solid var(--line)",
    minHeight: "calc(100vh - 46px)",
    background: "#fff",
  }),

  panelHeader: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottom: "1px solid var(--line)",
    background: "#fff",
  },
  tabs: {
    display: "flex",
    gap: 6,
    padding: "8px 12px",
    borderBottom: "1px solid var(--line)",
    background: "#fff",
    position: "sticky",
    top: 48,
    zIndex: 1,
  },
  tabBtn: {
    fontWeight: 700,
    borderRadius: 8,
  },
  tabBtnActive: {
    background: "#eef2ff",
    color: "#1d4ed8",
  },
  panelBody: {
    padding: 12,
    display: "grid",
    gap: 12,
  },

  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    borderBottom: "1px solid var(--line)",
    background: "#fff",
    position: "sticky",
    top: 46,
    zIndex: 2,
  },
  navLeft: { display: "flex", alignItems: "center", gap: 14 },
  navTabs: { display: "flex", gap: 6, marginLeft: 8 },
  navTab: { borderRadius: 10, padding: "8px 12px", fontWeight: 700 },
  navTabActive: { background: "#f1f5f9", color: "#111827" },
  navRight: { display: "flex", alignItems: "center", gap: 10 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#111827",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontSize: 12,
    fontWeight: 800,
  },

  previewBody: {
    padding: 14,
    display: "grid",
    gap: 14,
  },

  thumbGrid: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },

  cardWrap: {
    display: "grid",
    gridTemplateRows: "140px auto",
    gap: 6,
  },
  cardImageWrap: {
    position: "relative",
    width: "100%",
    height: 140,
    overflow: "hidden",
    borderRadius: 10,
    border: "1px solid var(--line)",
    background: "#0b1220",
  },
  durationBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    background: "rgba(0,0,0,.7)",
    color: "#fff",
    padding: "2px 6px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
  },
};
