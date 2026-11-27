import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import "./AdminSiteDesign.css";
import { SITE } from "../../config/site";

const DEFAULT = {
  fontFamily: "Inter",
  baseFontSize: 16,
  accentColor: "#7C3AED",
};
const POPULAR = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Montserrat",
  "Poppins",
  "Lato",
  "Nunito",
  "Raleway",
  "DM Sans",
  "Playfair Display",
  "Oswald",
  "Merriweather",
  "Ubuntu",
  "Source Sans 3",
  "Work Sans",
  "Manrope",
  "Rubik",
  "Libre Baskerville",
  "Noto Sans",
  "Barlow",
];
const PALETTE = [
  "#7C3AED",
  "#2563EB",
  "#0EA5E9",
  "#14B8A6",
  "#22C55E",
  "#F59E0B",
  "#F97316",
  "#EF4444",
  "#EC4899",
  "#FFFFFF",
  "#94A3B8",
  "#111827",
  "#000000",
  "#D4AF37",
  "#8B5CF6",
  "#06B6D4",
];
const GOOGLE_FONTS_API = "https://fonts.googleapis.com/css2?family=";
function googleFontUrl(name) {
  return `${GOOGLE_FONTS_API}${encodeURIComponent(name).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;
}
function useFont(name) {
  useEffect(() => {
    const id = "brtv-admin-font-preview";
    let link = document.getElementById(id);
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = googleFontUrl(name);
  }, [name]);
}
export default function AdminSiteDesign() {
  const [draft, setDraft] = useState(DEFAULT);
  const [published, setPublished] = useState(DEFAULT);
  const [search, setSearch] = useState("");
  const [catalog] = useState(POPULAR);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useFont(draft.fontFamily);
  useEffect(() => {
    let active = true;
    api
      .get("/site-design/admin")
      .then(({ data }) => {
        if (active) {
          setDraft(data.draft || DEFAULT);
          setPublished(data.published || DEFAULT);
        }
      })
      .catch((err) => {
        if (active)
          setMessage(
            err?.response?.data?.error ||
              "Could not load design settings. Check database migration.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  // The Google Fonts Developer API requires an API key; the UI offers a curated, searchable
  // catalog without exposing a key in the browser. Any valid Google Font name can be entered.
  const matches = useMemo(
    () =>
      catalog
        .filter((f) => f.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 30),
    [catalog, search],
  );
  const validHex = /^#[0-9a-fA-F]{6}$/.test(draft.accentColor);
  const dirty = JSON.stringify(draft) !== JSON.stringify(published);
  const patch = (p) => setDraft((v) => ({ ...v, ...p }));
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const { data } = await api.put("/site-design/admin", draft);
      setDraft(data.settings);
      setMessage("Draft saved. The public website has not changed.");
    } catch (e) {
      setMessage(e?.response?.data?.error || "Could not save draft");
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    setMessage("");
    try {
      await api.put("/site-design/admin", draft);
      const { data } = await api.post("/site-design/admin/publish");
      setPublished(data.settings);
      setDraft(data.settings);
      setMessage("Design published. Reload the public website to view it.");
    } catch (e) {
      setMessage(e?.response?.data?.error || "Could not publish design");
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return <main className="sd-page">Loading website design settings…</main>;
  return (
    <main className="sd-page">
      <div className="sd-header">
        <div>
          <h1>Website Design Settings</h1>
          <p>
            Choose site-wide typography and accent colors. Save a draft or
            publish when ready.
          </p>
        </div>
        <div className="sd-actions">
          <button disabled={busy || !validHex} onClick={save}>
            Save Draft
          </button>
          <button
            className="sd-primary"
            disabled={busy || !validHex}
            onClick={publish}
          >
            Publish Changes
          </button>
        </div>
      </div>
      {message && (
        <div className="sd-message" role="status">
          {message}
        </div>
      )}
      <div className="sd-grid">
        <section className="sd-panel">
          <h2>Typography</h2>
          <label htmlFor="sd-font-search">Search Google Fonts</label>
          <input
            id="sd-font-search"
            placeholder="Search font names…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label htmlFor="sd-font">Font family</label>
          <select
            id="sd-font"
            value={
              catalog.includes(draft.fontFamily) ? draft.fontFamily : "__custom"
            }
            onChange={(e) => {
              if (e.target.value !== "__custom")
                patch({ fontFamily: e.target.value });
            }}
          >
            <option value="__custom">Custom font name</option>
            {matches.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
            {!matches.includes(draft.fontFamily) &&
              catalog.includes(draft.fontFamily) && (
                <option value={draft.fontFamily}>{draft.fontFamily}</option>
              )}
          </select>
          <label htmlFor="sd-font-custom">
            Selected Google Font (editable)
          </label>
          <input
            id="sd-font-custom"
            value={draft.fontFamily}
            maxLength={80}
            onChange={(e) => patch({ fontFamily: e.target.value })}
          />
          <p className="sd-help">
            Browse the popular fonts or enter any Google Fonts family name. Font
            files load directly from Google Fonts when online.
          </p>
          <label>Base font size</label>
          <div className="sd-stepper">
            <button
              aria-label="Decrease font size"
              disabled={draft.baseFontSize <= 10}
              onClick={() =>
                patch({ baseFontSize: Math.max(10, draft.baseFontSize - 1) })
              }
            >
              −
            </button>
            <strong>{draft.baseFontSize}px</strong>
            <button
              aria-label="Increase font size"
              disabled={draft.baseFontSize >= 36}
              onClick={() =>
                patch({ baseFontSize: Math.min(36, draft.baseFontSize + 1) })
              }
            >
              +
            </button>
          </div>
          <p className="sd-help">10–36px · 1px increments</p>
          <h2>Accent color</h2>
          <div className="sd-palette">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Select ${c}`}
                title={c}
                className={
                  draft.accentColor.toUpperCase() === c ? "selected" : ""
                }
                style={{ background: c }}
                onClick={() => patch({ accentColor: c })}
              />
            ))}
          </div>
          <div className="sd-color-input">
            <input
              type="color"
              aria-label="Custom accent color"
              value={validHex ? draft.accentColor : "#7C3AED"}
              onChange={(e) =>
                patch({ accentColor: e.target.value.toUpperCase() })
              }
            />
            <input
              aria-label="HEX accent color"
              value={draft.accentColor}
              maxLength={7}
              onChange={(e) => patch({ accentColor: e.target.value })}
            />
          </div>
          {!validHex && (
            <p className="sd-error">
              Enter a valid six-digit HEX color (for example #7C3AED).
            </p>
          )}
        </section>
        <section className="sd-panel">
          <h2>Live editor preview</h2>
          <div
            className="sd-preview"
            style={{
              fontFamily: `"${draft.fontFamily.replace(/["\\]/g, "")}", sans-serif`,
              fontSize: draft.baseFontSize,
            }}
          >
            <span
              className="sd-eyebrow"
              style={{ color: validHex ? draft.accentColor : "#7C3AED" }}
            >
              {SITE.name.toUpperCase()}
            </span>
            <h3>Experience the Message</h3>
            <p>
              Preview your typography and accent color before publishing. Your
              changes will appear across the public website after publishing.
            </p>
            <span
              className="sd-preview-button"
              style={{ background: validHex ? draft.accentColor : "#7C3AED" }}
            >
              Explore Teachings
            </span>
          </div>
          <p className="sd-help">
            The preview is local to this editor. Existing components with
            hardcoded styles may need additional CSS variable integration.
          </p>
          <p className="sd-help">
            {dirty
              ? "Draft differs from published settings."
              : "Editor values match published settings."}
          </p>
        </section>
      </div>
    </main>
  );
}
