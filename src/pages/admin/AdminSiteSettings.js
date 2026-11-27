// src/pages/admin/AdminSiteSettings.js
//
// Site Settings (like WordPress "Reading" + "Additional CSS"):
//  - Homepage: the built-in Home page, or any page you choose.
//  - Custom CSS: site-wide styles (use with the CSS ID / classes set in the
//    visual editor's Advanced tab).

import React, { useEffect, useState } from "react";
import api from "../../api";
import { loadSiteOptions } from "../../lib/siteOptions";
import MediaPickerModal from "../../components/media/MediaPicker";
import { mediaSrc } from "../../lib/mediaApi";
import "./AdminMedia.css";
import "./AdminTeam.css";
import "./AdminPages.css";

function errText(e, fallback) {
  return e?.response?.data?.error || e?.response?.data?.message || fallback;
}

function ColorInput({ label, value, onChange }) {
  const v = String(value || "");
  return (
    // A group, not a <label>: each input has its own name for screen readers.
    <div className="ss-colorField" role="group" aria-label={label}>
      <span className="ss-colorLabel">{label}</span>
      <span className="ss-color">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={/^#[0-9a-f]{6}$/i.test(v) ? v : "#000000"}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          className="ml-input"
          aria-label={label}
          value={v}
          placeholder="Default"
          maxLength={60}
          onChange={(e) => onChange(e.target.value.trim())}
        />
        {v ? (
          <button
            type="button"
            className="ml-btn"
            onClick={() => onChange("")}
            aria-label={`Reset ${label}`}
          >
            Reset
          </button>
        ) : null}
      </span>
    </div>
  );
}

export default function AdminSiteSettings() {
  const [pages, setPages] = useState([]);
  const [mode, setMode] = useState("builtin");
  const [slug, setSlug] = useState("");
  const [css, setCss] = useState("");
  const [colors, setColors] = useState([]);
  // Release 1.3: brand (white-label), header, footer
  const [brand, setBrand] = useState({});
  const [header, setHeader] = useState({});
  const [footer, setFooter] = useState({});
  const [pickLogo, setPickLogo] = useState(false);
  // Release 2.0: Browse hero
  const [featured, setFeatured] = useState([]); // [{ video_id, image_url, title, thumbnail }]
  const [findQ, setFindQ] = useState("");
  const [found, setFound] = useState([]);
  const [pickHeroFor, setPickHeroFor] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ data: o }, { data: p }] = await Promise.all([
          api.get("/site-options/admin"),
          api.get("/admin/pages", { params: { limit: 500 } }),
        ]);
        if (!alive) return;
        const list = (Array.isArray(p?.pages) ? p.pages : []).filter(
          (x) => x?.slug && x.slug !== "home",
        );
        setPages(list);
        const s = String(o?.options?.home_page_slug || "");
        setMode(s && s !== "home" ? "page" : "builtin");
        setSlug(s && s !== "home" ? s : list[0]?.slug || "");
        setCss(String(o?.options?.custom_css || ""));
        setColors(
          Array.isArray(o?.options?.global_colors)
            ? o.options.global_colors
            : [],
        );
        setBrand(o?.options?.brand || {});
        setHeader({
          sticky: true,
          logo_height: 44,
          ...(o?.options?.header || {}),
        });
        setFooter({
          show_powered_by: true,
          columns: [],
          socials: [],
          ...(o?.options?.footer || {}),
        });
        const fl = Array.isArray(o?.options?.featured)
          ? o.options.featured
          : [];
        setFeatured(
          fl.map((f) => ({
            ...f,
            title: `Video #${f.video_id}`,
            thumbnail: "",
          })),
        );
        if (fl.length) {
          // show titles for the saved picks
          api
            .get("/viewer/browse")
            .then(({ data }) => {
              const all = [
                ...(data?.featured || []),
                ...(data?.rows || []).flatMap((r) => r.items || []),
              ];
              setFeatured((cur) =>
                cur.map((f) => {
                  const v = all.find(
                    (x) => Number(x.id) === Number(f.video_id),
                  );
                  return v
                    ? { ...f, title: v.title, thumbnail: v.thumbnail }
                    : f;
                }),
              );
            })
            .catch(() => {});
        }
        setLoaded(true);
      } catch (e) {
        if (alive)
          setNotice({
            tone: "error",
            text: errText(e, "Site settings could not be loaded."),
          });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function save(kind) {
    setBusy(kind);
    setNotice(null);
    try {
      const body =
        kind === "home"
          ? { home_page_slug: mode === "page" ? slug : "" }
          : kind === "colors"
            ? { global_colors: colors }
            : kind === "featured"
              ? {
                  featured: featured.map((f) => ({
                    video_id: f.video_id,
                    image_url: f.image_url || "",
                  })),
                }
              : kind === "brand" || kind === "header" || kind === "footer"
                ? { [kind]: { brand, header, footer }[kind] }
                : { custom_css: css };
      const { data } = await api.put("/site-options/admin", body);
      if (kind === "css") setCss(String(data?.options?.custom_css || ""));
      if (kind === "colors") setColors(data?.options?.global_colors || []);
      if (kind === "brand") setBrand(data?.options?.brand || {});
      if (kind === "header") setHeader(data?.options?.header || {});
      if (kind === "footer") setFooter(data?.options?.footer || {});
      await loadSiteOptions(true);
      setNotice({
        tone: "success",
        text:
          kind === "home"
            ? "Homepage saved. The site's home now shows your choice."
            : kind === "colors"
              ? "Global colors saved. Elements using them update everywhere."
              : kind === "featured"
                ? "Featured videos saved. The Browse page hero shows them in this order."
                : kind === "brand" || kind === "header" || kind === "footer"
                  ? `${kind[0].toUpperCase()}${kind.slice(1)} saved and live on every page.`
                  : "Custom CSS saved and live.",
      });
    } catch (e) {
      setNotice({ tone: "error", text: errText(e, "Could not save.") });
    } finally {
      setBusy("");
    }
  }

  const chosen = pages.find((p) => p.slug === slug);
  return (
    <main className="ml-page tm-page">
      <div className="ml-header">
        <div>
          <h1>Site Settings</h1>
          <p>
            Choose what your home page shows, and add custom CSS for the whole
            website.
          </p>
        </div>
      </div>

      {notice ? (
        <div
          className={`ml-notice ${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            className="ml-link"
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <section className="tm-card" aria-labelledby="ss-home">
        <h2 id="ss-home">Homepage</h2>
        <p className="ml-help">
          What visitors see at your website's main address.
        </p>
        <fieldset
          disabled={!loaded}
          style={{
            border: 0,
            padding: 0,
            margin: "10px 0 0",
            display: "grid",
            gap: 8,
          }}
        >
          <legend className="ml-help" style={{ padding: 0 }}>
            Your homepage displays
          </legend>
          <label className="tm-check">
            <input
              type="radio"
              name="homepage"
              checked={mode === "builtin"}
              onChange={() => setMode("builtin")}
            />
            The built-in Home page (hero, live, teachings…)
          </label>
          <label className="tm-check">
            <input
              type="radio"
              name="homepage"
              checked={mode === "page"}
              onChange={() => setMode("page")}
              disabled={!pages.length}
            />
            A page I choose
          </label>
          {mode === "page" ? (
            <div className="tm-addRow">
              <select
                className="ml-input"
                aria-label="Homepage"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              >
                {pages.map((p) => (
                  <option key={p.id} value={p.slug}>
                    {p.title} {p.status !== "published" ? "(draft)" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {mode === "page" && chosen && chosen.status !== "published" ? (
            <p className="ml-help" role="note">
              This page is still a draft. Publish it, or visitors will see the
              built-in Home page.
            </p>
          ) : null}
        </fieldset>
        <div className="tm-addRow">
          <button
            type="button"
            className="ml-btn ml-btnPrimary"
            onClick={() => save("home")}
            disabled={!loaded || busy === "home"}
          >
            {busy === "home" ? "Saving…" : "Save homepage"}
          </button>
        </div>
      </section>

      <section className="tm-card" aria-labelledby="ss-brand">
        <h2 id="ss-brand">Brand</h2>
        <p className="ml-help">
          Your website's name and logo, used in the header, footer and browser
          tab.
        </p>
        <div className="ss-grid">
          <label>
            Site name
            <input
              className="ml-input"
              value={brand.name || ""}
              maxLength={80}
              onChange={(e) => setBrand({ ...brand, name: e.target.value })}
            />
          </label>
          <label>
            Tagline (footer)
            <input
              className="ml-input"
              value={brand.tagline || ""}
              maxLength={160}
              onChange={(e) => setBrand({ ...brand, tagline: e.target.value })}
            />
          </label>
          <label>
            Contact email
            <input
              className="ml-input"
              type="email"
              value={brand.contact_email || ""}
              onChange={(e) =>
                setBrand({ ...brand, contact_email: e.target.value.trim() })
              }
            />
          </label>
          <label>
            Brand colour
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                aria-label="Brand colour picker"
                value={
                  /^#[0-9a-fA-F]{6}$/.test(brand.color || "")
                    ? brand.color
                    : "#7c3aed"
                }
                onChange={(e) => setBrand({ ...brand, color: e.target.value })}
                style={{
                  width: 44,
                  height: 36,
                  padding: 0,
                  border: 0,
                  background: "none",
                }}
              />
              <input
                className="ml-input"
                aria-label="Brand colour (hex)"
                placeholder="#7c3aed"
                value={brand.color || ""}
                maxLength={7}
                onChange={(e) =>
                  setBrand({ ...brand, color: e.target.value.trim() })
                }
              />
            </span>
            <small style={{ opacity: 0.75 }}>
              Used for the play-button image on videos without a thumbnail.
            </small>
          </label>
        </div>
        <div className="tm-addRow">
          {brand.logo_url ? (
            <img
              src={mediaSrc(brand.logo_url)}
              alt="Current logo"
              className="ss-logo"
            />
          ) : (
            <span className="ml-help">Using the built-in logo.</span>
          )}
          <button
            type="button"
            className="ml-btn"
            onClick={() => setPickLogo(true)}
          >
            {brand.logo_url ? "Change logo" : "Choose logo"}
          </button>
          {brand.logo_url ? (
            <button
              type="button"
              className="ml-btn"
              onClick={() => setBrand({ ...brand, logo_url: "" })}
            >
              Use built-in logo
            </button>
          ) : null}
          <button
            type="button"
            className="ml-btn ml-btnPrimary"
            onClick={() => save("brand")}
            disabled={!loaded || busy === "brand"}
          >
            {busy === "brand" ? "Saving…" : "Save brand"}
          </button>
        </div>
        <MediaPickerModal
          open={pickLogo}
          title="Choose a logo"
          onCancel={() => setPickLogo(false)}
          onConfirm={(item) => {
            setPickLogo(false);
            if (item?.url) setBrand((b) => ({ ...b, logo_url: item.url }));
          }}
        />
      </section>

      <section className="tm-card" aria-labelledby="ss-header">
        <h2 id="ss-header">Header</h2>
        <p className="ml-help">
          The bar at the top of every page. Menu links are managed in Website
          Navigation.
        </p>
        <div className="ss-grid">
          <ColorInput
            label="Background"
            value={header.bg}
            onChange={(v) => setHeader({ ...header, bg: v })}
          />
          <ColorInput
            label="Text"
            value={header.text}
            onChange={(v) => setHeader({ ...header, text: v })}
          />
          <label>
            Logo height: {header.logo_height || 44}px
            <input
              type="range"
              min={24}
              max={96}
              value={header.logo_height || 44}
              onChange={(e) =>
                setHeader({ ...header, logo_height: Number(e.target.value) })
              }
            />
          </label>
          <label className="tm-check">
            <input
              type="checkbox"
              checked={header.sticky !== false}
              onChange={(e) =>
                setHeader({ ...header, sticky: e.target.checked })
              }
            />{" "}
            Stay at the top while scrolling
          </label>
          <label>
            Header button text
            <input
              className="ml-input"
              value={header.button_label || ""}
              maxLength={40}
              placeholder="e.g. Give"
              onChange={(e) =>
                setHeader({ ...header, button_label: e.target.value })
              }
            />
          </label>
          <label>
            Header button link
            <input
              className="ml-input"
              value={header.button_link || ""}
              placeholder="/give or https://…"
              onChange={(e) =>
                setHeader({ ...header, button_link: e.target.value.trim() })
              }
            />
          </label>
        </div>
        <fieldset className="ss-fieldset">
          <legend>
            <label className="tm-check">
              <input
                type="checkbox"
                checked={!!header.topbar_enabled}
                onChange={(e) =>
                  setHeader({ ...header, topbar_enabled: e.target.checked })
                }
              />{" "}
              Announcement bar above the header
            </label>
          </legend>
          {header.topbar_enabled ? (
            <div className="ss-grid">
              <label>
                Text
                <input
                  className="ml-input"
                  value={header.topbar_text || ""}
                  maxLength={160}
                  placeholder="Join us live Sunday at 11am"
                  onChange={(e) =>
                    setHeader({ ...header, topbar_text: e.target.value })
                  }
                />
              </label>
              <label>
                Link (optional)
                <input
                  className="ml-input"
                  value={header.topbar_link || ""}
                  placeholder="/live"
                  onChange={(e) =>
                    setHeader({ ...header, topbar_link: e.target.value.trim() })
                  }
                />
              </label>
              <ColorInput
                label="Bar color"
                value={header.topbar_bg}
                onChange={(v) => setHeader({ ...header, topbar_bg: v })}
              />
              <ColorInput
                label="Bar text"
                value={header.topbar_color}
                onChange={(v) => setHeader({ ...header, topbar_color: v })}
              />
            </div>
          ) : null}
        </fieldset>
        <div className="tm-addRow">
          <button
            type="button"
            className="ml-btn ml-btnPrimary"
            onClick={() => save("header")}
            disabled={!loaded || busy === "header"}
          >
            {busy === "header" ? "Saving…" : "Save header"}
          </button>
        </div>
      </section>

      <section className="tm-card" aria-labelledby="ss-footer">
        <h2 id="ss-footer">Footer</h2>
        <p className="ml-help">
          The area at the bottom of every page. Links: a page (like /about), an
          https address, mailto: or tel:.
        </p>
        <div className="ss-grid">
          <ColorInput
            label="Background"
            value={footer.bg}
            onChange={(v) => setFooter({ ...footer, bg: v })}
          />
          <ColorInput
            label="Text"
            value={footer.text}
            onChange={(v) => setFooter({ ...footer, text: v })}
          />
          <label>
            Copyright text
            <input
              className="ml-input"
              value={footer.copyright || ""}
              maxLength={160}
              placeholder="© {year} Your Ministry."
              onChange={(e) =>
                setFooter({ ...footer, copyright: e.target.value })
              }
            />
          </label>
          <label className="tm-check">
            <input
              type="checkbox"
              checked={footer.show_powered_by !== false}
              onChange={(e) =>
                setFooter({ ...footer, show_powered_by: e.target.checked })
              }
            />{" "}
            Show “Powered by No Limits Media”
          </label>
        </div>
        {(footer.columns || []).map((c, ci) => (
          <fieldset key={ci} className="ss-fieldset">
            <legend>Link column {ci + 1}</legend>
            <div className="tm-addRow">
              <input
                className="ml-input"
                aria-label={`Column ${ci + 1} title`}
                placeholder="Title (optional)"
                value={c.title || ""}
                onChange={(e) =>
                  setFooter({
                    ...footer,
                    columns: footer.columns.map((x, k) =>
                      k === ci ? { ...x, title: e.target.value } : x,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="ml-btn"
                onClick={() =>
                  setFooter({
                    ...footer,
                    columns: footer.columns.filter((_, k) => k !== ci),
                  })
                }
              >
                Remove column
              </button>
            </div>
            {(c.links || []).map((l, li) => (
              <div key={li} className="tm-addRow">
                <input
                  className="ml-input"
                  aria-label={`Column ${ci + 1} link ${li + 1} text`}
                  placeholder="Text"
                  value={l.label || ""}
                  onChange={(e) =>
                    setFooter({
                      ...footer,
                      columns: footer.columns.map((x, k) =>
                        k === ci
                          ? {
                              ...x,
                              links: x.links.map((y, j) =>
                                j === li ? { ...y, label: e.target.value } : y,
                              ),
                            }
                          : x,
                      ),
                    })
                  }
                />
                <input
                  className="ml-input"
                  aria-label={`Column ${ci + 1} link ${li + 1} address`}
                  placeholder="/about or https://…"
                  value={l.to || ""}
                  onChange={(e) =>
                    setFooter({
                      ...footer,
                      columns: footer.columns.map((x, k) =>
                        k === ci
                          ? {
                              ...x,
                              links: x.links.map((y, j) =>
                                j === li
                                  ? { ...y, to: e.target.value.trim() }
                                  : y,
                              ),
                            }
                          : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="ml-btn"
                  aria-label={`Remove link ${li + 1}`}
                  onClick={() =>
                    setFooter({
                      ...footer,
                      columns: footer.columns.map((x, k) =>
                        k === ci
                          ? { ...x, links: x.links.filter((_, j) => j !== li) }
                          : x,
                      ),
                    })
                  }
                >
                  ✕
                </button>
              </div>
            ))}
            {(c.links || []).length < 8 ? (
              <button
                type="button"
                className="ml-btn"
                onClick={() =>
                  setFooter({
                    ...footer,
                    columns: footer.columns.map((x, k) =>
                      k === ci
                        ? {
                            ...x,
                            links: [...(x.links || []), { label: "", to: "" }],
                          }
                        : x,
                    ),
                  })
                }
              >
                + Add link
              </button>
            ) : null}
          </fieldset>
        ))}
        {(footer.columns || []).length < 3 ? (
          <button
            type="button"
            className="ml-btn"
            onClick={() =>
              setFooter({
                ...footer,
                columns: [
                  ...(footer.columns || []),
                  { title: "", links: [{ label: "", to: "" }] },
                ],
              })
            }
          >
            + Add link column
          </button>
        ) : null}
        <fieldset className="ss-fieldset">
          <legend>Social links</legend>
          {(footer.socials || []).map((x, i) => (
            <div key={i} className="tm-addRow">
              <select
                className="ml-input"
                aria-label={`Social ${i + 1} network`}
                value={x.network}
                onChange={(e) =>
                  setFooter({
                    ...footer,
                    socials: footer.socials.map((y, k) =>
                      k === i ? { ...y, network: e.target.value } : y,
                    ),
                  })
                }
              >
                {[
                  ["facebook", "Facebook"],
                  ["instagram", "Instagram"],
                  ["youtube", "YouTube"],
                  ["x", "X (Twitter)"],
                  ["tiktok", "TikTok"],
                  ["linkedin", "LinkedIn"],
                  ["email", "Email"],
                  ["website", "Website"],
                  ["phone", "Phone"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <input
                className="ml-input"
                aria-label={`Social ${i + 1} address`}
                placeholder="https://…"
                value={x.url || ""}
                onChange={(e) =>
                  setFooter({
                    ...footer,
                    socials: footer.socials.map((y, k) =>
                      k === i ? { ...y, url: e.target.value.trim() } : y,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="ml-btn"
                aria-label={`Remove social link ${i + 1}`}
                onClick={() =>
                  setFooter({
                    ...footer,
                    socials: footer.socials.filter((_, k) => k !== i),
                  })
                }
              >
                ✕
              </button>
            </div>
          ))}
          {(footer.socials || []).length < 9 ? (
            <button
              type="button"
              className="ml-btn"
              onClick={() =>
                setFooter({
                  ...footer,
                  socials: [
                    ...(footer.socials || []),
                    { network: "facebook", url: "" },
                  ],
                })
              }
            >
              + Add social link
            </button>
          ) : null}
        </fieldset>
        <p className="ml-help">
          With no link columns, the footer shows Terms, Privacy and Contact as
          before.
        </p>
        <div className="tm-addRow">
          <button
            type="button"
            className="ml-btn ml-btnPrimary"
            onClick={() => save("footer")}
            disabled={!loaded || busy === "footer"}
          >
            {busy === "footer" ? "Saving…" : "Save footer"}
          </button>
        </div>
      </section>

      <section className="tm-card" aria-labelledby="ss-featured">
        <h2 id="ss-featured">Featured videos (Browse page)</h2>
        <p className="ml-help">
          Choose up to 8 videos for the large banner at the top of the Browse
          page (/catalog). Add a wide image (about 1920×800, without text) for
          the best look; otherwise the thumbnail is used. With none chosen, the
          newest videos are featured.
        </p>
        <ul className="ss-featList" aria-label="Featured videos">
          {featured.map((f, i) => (
            <li key={f.video_id} className="ss-featRow">
              {f.image_url || f.thumbnail ? (
                <img src={mediaSrc(f.image_url || f.thumbnail)} alt="" />
              ) : (
                <span className="ss-featNo" />
              )}
              <span className="ss-featTitle">
                <strong>{f.title}</strong>
                <small>
                  {f.image_url ? "Wide hero image set" : "Uses the thumbnail"}
                </small>
              </span>
              <span className="ss-featActions">
                <button
                  type="button"
                  className="ml-btn"
                  disabled={i === 0}
                  aria-label={`Move ${f.title} up`}
                  onClick={() =>
                    setFeatured((l) => {
                      const x = l.slice();
                      [x[i - 1], x[i]] = [x[i], x[i - 1]];
                      return x;
                    })
                  }
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="ml-btn"
                  disabled={i === featured.length - 1}
                  aria-label={`Move ${f.title} down`}
                  onClick={() =>
                    setFeatured((l) => {
                      const x = l.slice();
                      [x[i + 1], x[i]] = [x[i], x[i + 1]];
                      return x;
                    })
                  }
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="ml-btn"
                  onClick={() => setPickHeroFor(f.video_id)}
                >
                  {f.image_url ? "Change image" : "Hero image"}
                </button>
                {f.image_url ? (
                  <button
                    type="button"
                    className="ml-btn"
                    onClick={() =>
                      setFeatured((l) =>
                        l.map((x) =>
                          x.video_id === f.video_id
                            ? { ...x, image_url: "" }
                            : x,
                        ),
                      )
                    }
                  >
                    Use thumbnail
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ml-btn"
                  aria-label={`Remove ${f.title}`}
                  onClick={() =>
                    setFeatured((l) =>
                      l.filter((x) => x.video_id !== f.video_id),
                    )
                  }
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
        {featured.length < 8 ? (
          <div className="ss-featFind">
            <input
              className="ml-input"
              type="search"
              aria-label="Find a video to feature"
              placeholder="Find a video to feature…"
              value={findQ}
              onChange={async (e) => {
                const v = e.target.value;
                setFindQ(v);
                if (v.trim().length < 2) return setFound([]);
                try {
                  const { data } = await api.get("/viewer/search", {
                    params: { q: v.trim() },
                  });
                  setFound(
                    Array.isArray(data?.videos) ? data.videos.slice(0, 8) : [],
                  );
                } catch {
                  setFound([]);
                }
              }}
            />
            {found.length ? (
              <ul className="ss-featFound" aria-label="Matching videos">
                {found
                  .filter((v) => !featured.some((f) => f.video_id === v.id))
                  .map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        className="ml-btn"
                        onClick={() => {
                          setFeatured((l) => [
                            ...l,
                            {
                              video_id: v.id,
                              image_url: "",
                              title: v.title,
                              thumbnail: v.thumbnail,
                            },
                          ]);
                          setFindQ("");
                          setFound([]);
                        }}
                      >
                        + {v.title}
                      </button>
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <div className="tm-addRow">
          <button
            type="button"
            className="ml-btn ml-btnPrimary"
            onClick={() => save("featured")}
            disabled={!loaded || busy === "featured"}
          >
            {busy === "featured" ? "Saving…" : "Save featured videos"}
          </button>
        </div>
        <MediaPickerModal
          open={pickHeroFor != null}
          title="Choose a wide hero image"
          onCancel={() => setPickHeroFor(null)}
          onConfirm={(item) => {
            const vid = pickHeroFor;
            setPickHeroFor(null);
            if (item?.url)
              setFeatured((l) =>
                l.map((x) =>
                  x.video_id === vid ? { ...x, image_url: item.url } : x,
                ),
              );
          }}
        />
      </section>

      <section className="tm-card" aria-labelledby="ss-colors">
        <h2 id="ss-colors">Global colors</h2>
        <p className="ml-help">
          Your brand palette (up to 12). In the visual editor every color picker
          shows these as swatches; elements using a global color update
          automatically when you change it here.
        </p>
        <ul className="ss-colorList" aria-label="Global colors">
          {colors.map((c, i) => (
            <li key={c.slug} className="ss-colorRow">
              <input
                type="color"
                aria-label={`${c.name || "Color"} value`}
                value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#000000"}
                onChange={(e) =>
                  setColors(
                    colors.map((x, k) =>
                      k === i ? { ...x, hex: e.target.value } : x,
                    ),
                  )
                }
              />
              <input
                className="ml-input"
                aria-label="Color name"
                value={c.name}
                maxLength={40}
                onChange={(e) =>
                  setColors(
                    colors.map((x, k) =>
                      k === i ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
              />
              <code>{c.hex}</code>
              <button
                type="button"
                className="ml-btn"
                aria-label={`Remove ${c.name || "color"}`}
                onClick={() => setColors(colors.filter((_, k) => k !== i))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="tm-addRow" style={{ justifyContent: "space-between" }}>
          <button
            type="button"
            className="ml-btn"
            disabled={!loaded || colors.length >= 12}
            onClick={() => {
              const base = `color-${colors.length + 1}`;
              const taken = new Set(colors.map((c) => c.slug));
              let slug = base;
              for (let n = 1; taken.has(slug); n += 1) slug = `${base}-${n}`;
              setColors([
                ...colors,
                { slug, name: `Color ${colors.length + 1}`, hex: "#7c3aed" },
              ]);
            }}
          >
            + Add color
          </button>
          <button
            type="button"
            className="ml-btn ml-btnPrimary"
            onClick={() => save("colors")}
            disabled={!loaded || busy === "colors"}
          >
            {busy === "colors" ? "Saving…" : "Save colors"}
          </button>
        </div>
      </section>

      <section className="tm-card" aria-labelledby="ss-css">
        <h2 id="ss-css">Custom CSS</h2>
        <p className="ml-help">
          Applies to every page of the website. Give an element a CSS ID or
          class in the visual editor (Element › Advanced › Attributes), then
          style it here. Example:
          <code style={{ display: "block", marginTop: 6 }}>
            .gold-title {"{"} color: #d4af37; {"}"} #welcome {"{"} padding:
            40px; {"}"}
          </code>
        </p>
        <textarea
          className="ml-input"
          aria-label="Custom CSS"
          spellCheck={false}
          rows={16}
          maxLength={50000}
          value={css}
          onChange={(e) => setCss(e.target.value)}
          disabled={!loaded}
          style={{
            width: "100%",
            fontFamily: "ui-monospace, Menlo, Consolas, monospace",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        />
        <div className="tm-addRow" style={{ justifyContent: "space-between" }}>
          <span className="ml-help">
            {css.length.toLocaleString()} / 50,000 characters
          </span>
          <button
            type="button"
            className="ml-btn ml-btnPrimary"
            onClick={() => save("css")}
            disabled={!loaded || busy === "css"}
          >
            {busy === "css" ? "Saving…" : "Save CSS"}
          </button>
        </div>
      </section>
    </main>
  );
}
