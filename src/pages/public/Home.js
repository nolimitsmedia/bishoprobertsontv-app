// src/pages/public/Home.js
import { VideoRow } from "../../components/viewer/ViewerParts";
import LiveSchedule from "../../components/viewer/LiveSchedule";
import HomeHero from "../../components/viewer/HomeHero";
import { fetchBrowse, readSavedBrowse, saveBrowse } from "../../lib/browseData";
import "../../components/viewer/Viewer.css";
import React, { Suspense, lazy, useEffect, useState } from "react";
import "./Home.css";
import { Link } from "react-router-dom";
import api from "../../api";
import { usePageMeta } from "../../utils/pageMeta";
import {
  CanvasField,
  CanvasSection,
  PageContext,
  useCanvas,
} from "../../components/builder/canvasContext";
import { cleanCss } from "../../lib/siteOptions";
// Play button in the ministry's brand color (no thumbnail).
import { DEFAULT_THUMB as DefaultThumb } from "../../lib/brand";
// This site's own pictures (public/content/, set per ministry at build time).
import {
  contentUrl,
  isSiteFile,
  loadSiteDefaults,
  siteDefaults,
  upgradeAssets,
  upgradeAssetUrl,
} from "../../lib/siteContent";
const ImgHead = contentUrl("leader.png");
const HomeBanner = contentUrl("home-banner.png");

/* ─── Utilities ─────────────────────────────────────────── */
const absUrl = (u) => {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (isSiteFile(u)) return u; // the website's own files
  const base = (api?.defaults?.baseURL || "").replace(/\/api\/?$/i, "");
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
};

async function safeGet(path, opts = {}) {
  try {
    const res = await api.get(path, { ...opts, validateStatus: () => true });
    const status = res?.status ?? 0;
    // Expose status so callers can detect 304 (no body) vs real 2xx data
    return { ok: status >= 200 && status < 300, status, data: res?.data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function normalizeItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.videos)) return data.videos;
  if (Array.isArray(data.rows)) return data.rows;
  return [];
}

/* ─── Spinner ────────────────────────────────────────────── */
let _styleInjected = false;
function ensureStyles() {
  if (_styleInjected) return;
  _styleInjected = true;
  const el = document.createElement("style");
  el.textContent = `
    @keyframes brtv-spin { to { transform: rotate(360deg); } }
    @keyframes brtv-dash {
      0%   { stroke-dasharray: 1,200; stroke-dashoffset: 0; }
      50%  { stroke-dasharray: 90,200; stroke-dashoffset: -35; }
      100% { stroke-dasharray: 90,200; stroke-dashoffset: -125; }
    }
    @keyframes live-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.5; transform: scale(0.85); }
    }
  `;
  document.head.appendChild(el);
}

function CircularSpinner({ size = 40, label = "Loading…" }) {
  useEffect(() => {
    ensureStyles();
  }, []);
  const ring = Math.max(4, Math.round(size / 10));
  return (
    <div className="spinner-wrap">
      <div role="status" aria-label={label}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 50 50"
          className="spinner-svg"
        >
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={ring}
          />
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="rgba(154,92,255,0.9)"
            strokeLinecap="round"
            strokeWidth={ring}
            className="spinner-arc"
          />
        </svg>
      </div>
      <span className="spinner-label">{label}</span>
    </div>
  );
}

/* ─── Video fetch ────────────────────────────────────────── */
// Fetches the 4 newest videos automatically.
// sort/order params cover the most common backend conventions so the API
// returns newest-first; we then client-sort as a safety net and take 4.
// Fetches the 4 newest videos.
// Tries both endpoints and picks whichever returns real data.
// - 304 responses are treated as empty (browser cached, no body)
// - Both responses are checked so a 304 on one does not block the other
// - Cache-Control headers are bypassed with a timestamp param
async function fetchVideos() {
  const response = await safeGet("/public/latest-teachings", {
    params: { limit: 4, _: Date.now() },
  });
  if (!response.ok) throw new Error("Unable to load latest teachings");
  return normalizeItems(response.data);
}

/* Published CMS content. Never use the admin/draft endpoint on the public site. */
// Neutral wording for a new ministry. Each site's own default wording is in
// public/content/defaults.json ("home") and wins over this; anything saved in
// the page editor wins over both (Phase 2C).
const HOME_FALLBACK = {
  home_hero: {
    kicker: "Sermons · Teaching · Live services",
    title: "Experience the Message",
    sub: "Watch sermons, teachings and live services anytime, anywhere.",
    cta_text: "Start Watching",
    cta_href: "/catalog",
  },
  home_join: {
    eyebrow: "Join us",
    title: "Become part of the family",
    sub: "Create a free account to save your place and get live service reminders.",
    cta_text: "Join Now",
    cta_href: "/signup",
  },
  home_cta: {
    title: "Go Deeper Into The Word",
    sub: "Stream powerful teachings anytime, anywhere.",
    cta_text: "Browse Catalog",
    cta_href: "/catalog",
  },
  home_about: {
    name: "Our Pastor",
    text: "Introduce your pastor here: their calling, their story and what God has placed on their heart for this ministry.",
  },
};
function homeDefaults(key) {
  return { ...HOME_FALLBACK[key], ...(siteDefaults().home?.[key] || {}) };
}

// Phase 4F: sections added to the Home page in the page builder.
// The builder renderer is loaded only when such sections exist, so a Home page
// without custom sections loads exactly what it did before.
const BuilderSections = lazy(() =>
  import("./BuilderPage").then((m) => ({ default: m.BuilderSections })),
);

// Built-in home parts, in the order Home renders them, keyed by the section
// id the editor uses and the block type that holds their content.
const HOME_CORE_PARTS = [
  { key: "home_hero", id: "core-hero" },
  { key: "home_join", id: "core-join" },
  { key: "featured_live", id: "core-featured-live" },
  { key: "latest_teaching", id: "core-latest-teaching" },
  { key: "home_cta", id: "core-cta" },
  { key: "home_about", id: "core-about" },
];

function homeCoreKey(section) {
  const id = String(section?.id || "");
  const byId = HOME_CORE_PARTS.find((p) => p.id === id);
  if (byId) return byId.key;
  const blocks = Array.isArray(section?.blocks)
    ? section.blocks
    : Array.isArray(section?.elements)
      ? section.elements
      : [];
  const hit = blocks.find((b) =>
    HOME_CORE_PARTS.some((p) => p.key === String(b?.type || "")),
  );
  return hit ? String(hit.type) : "";
}

// Groups custom sections under the built-in part they follow in the editor
// ("__top" = before the first built-in part). Built-in parts keep their order.
// includeEmpty: the editor canvas shows empty sections (as placeholders) so
// they can be selected and filled; the public site skips them.
function extractCustomSections(page, includeEmpty = false) {
  let json = page?.content_json;
  if (typeof json === "string") {
    try {
      json = JSON.parse(json);
    } catch {
      return {};
    }
  }
  if (!json || !Array.isArray(json.extra_sections)) return {};
  const groups = {};
  let anchor = "__top";
  for (const section of json.extra_sections) {
    if (!section || typeof section !== "object") continue;
    const core = homeCoreKey(section);
    if (core) {
      anchor = core;
      continue;
    }
    const blocks = Array.isArray(section.blocks)
      ? section.blocks
      : Array.isArray(section.elements)
        ? section.elements
        : [];
    if (!includeEmpty && !blocks.length && !String(section.html || "").trim())
      continue;
    (groups[anchor] = groups[anchor] || []).push(section);
  }
  return groups;
}

function extractHomeBlocks(page) {
  let json = page?.content_json;
  if (typeof json === "string") {
    try {
      json = JSON.parse(json);
    } catch {
      return null;
    }
  }
  if (!json || !Array.isArray(json.extra_sections)) return null;
  const found = {};
  for (const section of json.extra_sections) {
    const blocks = Array.isArray(section?.blocks)
      ? section.blocks
      : Array.isArray(section?.elements)
        ? section.elements
        : [];
    for (const block of blocks) {
      if (
        block &&
        Object.prototype.hasOwnProperty.call(HOME_FALLBACK, block.type) &&
        !found[block.type]
      ) {
        found[block.type] = block;
      }
    }
  }
  return found;
}

function cmsValue(block, field, fallback) {
  // An intentionally blank CMS field should remain blank; fallback only when absent.
  return block && block[field] != null ? String(block[field]) : fallback;
}

function cmsImage(url, fallback) {
  url = upgradeAssetUrl(url);
  if (!url) return fallback;
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  if (
    url.startsWith("/static/") ||
    url.startsWith("/assets/") ||
    isSiteFile(url)
  )
    return url;
  return absUrl(url) || fallback;
}

/* ══════════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════════ */
// previewPage (Phase 4E): an admin's draft page to show instead of the
// published Home page. Used by the editor's Preview.
export default function Home({ previewPage = null }) {
  const inCanvas = useCanvas(); // visual editor: show empty sections too
  useEffect(() => {
    ensureStyles();
  }, []);
  const [cmsBlocks, setCmsBlocks] = useState(null);
  const [customSections, setCustomSections] = useState({});
  const [homePage, setHomePage] = useState(null); // Phase 6: SEO fields

  // Phase 6: home page title/description; blank fields use the site defaults.
  usePageMeta({
    title: homePage?.seo_title || "",
    titleIsFinal: true,
    description: homePage?.seo_description || homePage?.excerpt || "",
    image: homePage?.seo_image_url || "",
    noindex: !!homePage?.seo_noindex || !!previewPage,
  });
  useEffect(() => {
    let alive = true;
    (async () => {
      const [result] = await Promise.all([
        previewPage
          ? { ok: true, data: { page: previewPage } }
          : safeGet("/pages/home", {
              params: { _: Date.now() },
              headers: { "Cache-Control": "no-cache" },
            }),
        loadSiteDefaults(), // this site's own default wording
      ]);
      if (!alive) return;
      if (result.ok && result.data?.page) {
        setCmsBlocks(extractHomeBlocks(upgradeAssets(result.data.page)));
        setCustomSections(extractCustomSections(result.data.page, inCanvas));
        setHomePage(result.data.page);
      } else
        console.warn(
          "[Home] Published CMS page unavailable; using existing content.",
        );
    })();
    return () => {
      alive = false;
    };
  }, [previewPage, inCanvas]);
  // Featured messages, Continue Watching (members) and the newest messages
  // A copy of the public part (featured + newest) is kept in the browser so a
  // returning visitor sees the new design at once — no flash of the old hero.
  const BROWSE_KEY = "brtv:home-browse:v1";
  const [browse, setBrowse] = useState(() => readSavedBrowse(BROWSE_KEY));
  const [browseState, setBrowseState] = useState(() =>
    browse ? "ready" : "loading",
  );
  useEffect(() => {
    let alive = true;
    fetchBrowse()
      .then((data) => {
        if (!alive) return;
        setBrowse(data);
        setBrowseState("ready");
        // only public content is saved (never Continue Watching / My List)
        saveBrowse(BROWSE_KEY, data, (r) => r.key === "new");
      })
      .catch(
        () => alive && setBrowseState((s) => (s === "ready" ? s : "failed")),
      );
    return () => {
      alive = false;
    };
  }, []);
  const homeRows = (browse?.rows || [])
    .filter(
      (r) =>
        r &&
        Array.isArray(r.items) &&
        r.items.length &&
        (r.key === "continue" || r.key === "new"),
    )
    .map((r) =>
      r.key === "new"
        ? { ...r, title: "Latest messages", items: r.items.slice(0, 12) }
        : { ...r, title: "Continue watching" },
    );

  const custom = (anchor) =>
    customSections[anchor]?.length ? (
      <Suspense fallback={null}>
        <BuilderSections sections={customSections[anchor]} pageSlug="home" />
      </Suspense>
    ) : null;

  return (
    <PageContext.Provider
      value={homePage ? { id: homePage.id, slug: homePage.slug } : null}
    >
      <main className="home-root">
        {homePage?.content_json?.page_css ? (
          <style data-page-css="">
            {cleanCss(homePage.content_json.page_css)}
          </style>
        ) : null}
        {custom("__top")}
        <CanvasSection sectionId="core-hero" blockId={cmsBlocks?.home_hero?.id}>
          {/* Featured messages (Site Settings › Featured); the editor always shows the editable hero */}
          {/* The editor shows exactly what visitors see. */}
          {browseState === "loading" ? (
            <div className="home-heroSkel" aria-hidden="true" />
          ) : browse?.featured?.length ? (
            <div className="home-featured">
              {inCanvas ? (
                <div className="home-editHint" role="note">
                  This banner shows the <strong>featured messages</strong>.
                  Choose them in{" "}
                  <a
                    href="#/admin/site-settings"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Site Settings › Featured
                  </a>
                  . When no messages are featured, the editable hero text shows
                  here instead.
                </div>
              ) : null}
              <HomeHero items={browse.featured} />
            </div>
          ) : (
            <HeroSection content={cmsBlocks?.home_hero} />
          )}
        </CanvasSection>
        {custom("home_hero")}
        <CanvasSection sectionId="core-join" blockId={cmsBlocks?.home_join?.id}>
          <JoinStrip content={cmsBlocks?.home_join} />
        </CanvasSection>
        {custom("home_join")}
        <CanvasSection sectionId="core-featured-live">
          <div className="home-wrap">
            <LiveSchedule />
          </div>
        </CanvasSection>
        {custom("featured_live")}
        <CanvasSection sectionId="core-latest-teaching">
          {browseState === "loading" && !inCanvas ? (
            <div className="home-wrap home-rows" aria-hidden="true">
              <div className="home-rowSkel" />
            </div>
          ) : homeRows.length ? (
            <div className="home-rows">
              {homeRows.map((row) =>
                row.key === "new" ? (
                  <div key={row.key} className="home-wrap vw-rows">
                    <VideoRow
                      row={row}
                      kicker="On demand"
                      seeAllLabel="Browse all"
                      headerNav
                      showCategory
                      onSeeAll={() => window.location.assign("#/catalog")}
                    />
                  </div>
                ) : (
                  <div key={row.key} className="home-wrap vw-rows">
                    <VideoRow row={row} />
                  </div>
                ),
              )}
            </div>
          ) : (
            <LatestTeaching />
          )}
        </CanvasSection>
        {custom("latest_teaching")}
        <CanvasSection sectionId="core-cta" blockId={cmsBlocks?.home_cta?.id}>
          <WatchMoreCTA content={cmsBlocks?.home_cta} />
        </CanvasSection>
        {custom("home_cta")}
        <CanvasSection
          sectionId="core-about"
          blockId={cmsBlocks?.home_about?.id}
        >
          <AboutSection content={cmsBlocks?.home_about} />
        </CanvasSection>
        {custom("home_about")}
        <div className="home-spacer" />
      </main>
    </PageContext.Provider>
  );
}

/* ══════════════════════════════════════════════════════════
   1. HERO
══════════════════════════════════════════════════════════ */
function HeroSection({ content }) {
  const defaults = homeDefaults("home_hero");
  const title = cmsValue(content, "title", defaults.title);
  // Highlighted ending of the headline (shown in the accent color). Editable as
  // "title_accent"; a blank value means no highlight.
  const accent = String(
    cmsValue(content, "title_accent", "Without Limits") || "",
  ).trim();
  const hasAccent =
    !!accent && title.trim().endsWith(accent) && title.trim() !== accent;
  const lead = hasAccent ? title.trim().slice(0, -accent.length).trim() : title;
  const background = cmsImage(content?.background_url, HomeBanner);
  // Phase 1: whitelisted, bounded presentation settings from published CMS data.
  // Existing CSS remains the default if no typography settings are provided.
  const fontChoices = {
    Poppins: "Poppins, sans-serif",
    Montserrat: "Montserrat, sans-serif",
    Arial: "Arial, sans-serif",
    Georgia: "Georgia, serif",
  };
  const size = Number(content?.heading_size);
  const weight = String(content?.heading_weight || "");
  const align = String(content?.heading_align || "");
  const color = String(content?.heading_color || "").trim();
  const headingStyle = {
    ...(fontChoices[content?.heading_font]
      ? { fontFamily: fontChoices[content.heading_font] }
      : {}),
    ...(Number.isFinite(size) && size >= 24 && size <= 96
      ? { fontSize: `clamp(24px, ${size / 16}rem, ${size}px)` }
      : {}),
    ...(["400", "500", "600", "700", "800"].includes(weight)
      ? { fontWeight: Number(weight) }
      : {}),
    ...(["left", "center", "right"].includes(align)
      ? { textAlign: align }
      : {}),
    ...(/^#[0-9a-fA-F]{6}$/.test(color) ? { color } : {}),
  };
  return (
    <section className="hero" style={{ backgroundImage: `url(${background})` }}>
      <div className="hero__overlay hero__overlay--radial" />
      <div className="hero__overlay hero__overlay--gradient" />

      <div className="hero__inner">
        <div className="hero__badge">
          <span className="hero__badge-dot" />
          <CanvasField name="kicker">
            {cmsValue(content, "kicker", defaults.kicker)}
          </CanvasField>
        </div>

        <h1 className="hero__title" style={headingStyle}>
          <CanvasField name="title">
            {lead}
            {hasAccent && (
              <>
                <br />
                <span className="hero__title-accent">{accent}</span>
              </>
            )}
          </CanvasField>
        </h1>

        <p className="hero__sub">
          <CanvasField name="sub">
            {cmsValue(content, "sub", defaults.sub)}
          </CanvasField>
        </p>

        <div className="hero__ctas">
          <Link
            className="btn btn--primary btn--lg"
            to={cmsValue(content, "cta_href", defaults.cta_href)}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M3 2.5a.5.5 0 0 1 .765-.424l10 5.5a.5.5 0 0 1 0 .848l-10 5.5A.5.5 0 0 1 3 13.5z" />
            </svg>
            <CanvasField name="cta_text">
              {cmsValue(content, "cta_text", defaults.cta_text)}
            </CanvasField>
          </Link>
          <Link className="btn btn--ghost btn--lg" to="/free-account">
            Create Free Account
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════
   2. JOIN STRIP
══════════════════════════════════════════════════════════ */
function JoinStrip({ content }) {
  const defaults = homeDefaults("home_join");
  return (
    <section className="join">
      <div className="join__inner">
        <div className="join__left">
          <p className="join__eyebrow">
            <CanvasField name="eyebrow">
              {cmsValue(content, "eyebrow", defaults.eyebrow)}
            </CanvasField>
          </p>
          <h2 className="join__title">
            <CanvasField name="title">
              {cmsValue(content, "title", defaults.title)}
            </CanvasField>
          </h2>
          <p className="join__sub">
            <CanvasField name="sub">
              {cmsValue(content, "sub", defaults.sub)}
            </CanvasField>
          </p>
        </div>
        <Link
          to={cmsValue(content, "cta_href", defaults.cta_href)}
          className="btn btn--primary btn--lg"
        >
          <CanvasField name="cta_text">
            {cmsValue(content, "cta_text", defaults.cta_text)}
          </CanvasField>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 7h12M8 2l5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════
   3. LIVE SECTION
══════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════
   LIVE — the Live schedule card (components/viewer/LiveSchedule.js)
   replaced the old LiveSection; the Calendar drives it.
══════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════
   4. LATEST TEACHING
══════════════════════════════════════════════════════════ */
function LatestTeaching() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const items = await fetchVideos();
        if (!cancelled) setVideos(items);
      } catch (error) {
        console.error("[LatestTeaching] Failed to load videos:", error);
        if (!cancelled) setVideos([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="teachings">
      <div className="teachings__head">
        <div>
          <p className="section-eyebrow">On Demand</p>
          <h2 className="section-title">Latest Teachings</h2>
          <p className="section-sub">
            A fresh impartation to strengthen your walk.
          </p>
        </div>
        <Link to="/catalog" className="btn btn--ghost btn--sm">
          Browse All
          <svg
            width="13"
            height="13"
            viewBox="0 0 13 13"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 6.5h11M7 1.5l5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>

      {loading ? (
        <div className="teachings__state">
          <CircularSpinner label="Loading teachings…" />
        </div>
      ) : !videos.length ? (
        <div className="teachings__state">No videos found yet.</div>
      ) : (
        <div className="teachings__grid">
          {videos.map((v, idx) => {
            const rawThumb =
              v.thumbnail_url ||
              v?.metadata?.thumbnail_vertical_url ||
              v?.metadata?.thumbnail_url ||
              null;
            const thumb = absUrl(rawThumb) || DefaultThumb;
            const isDef = !absUrl(rawThumb);
            return (
              <Link key={v.id} to={`/watch/${v.id}`} className="vcard">
                <div
                  className={`vcard__thumb${isDef ? " vcard__thumb--default" : ""}`}
                >
                  <img
                    src={thumb}
                    alt={v.title || "Video"}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = DefaultThumb;
                    }}
                  />
                  <div className="vcard__play" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      width="20"
                      height="20"
                    >
                      <path d="M5 3.5a.5.5 0 0 1 .765-.424l14 8a.5.5 0 0 1 0 .848l-14 8A.5.5 0 0 1 5 19.5z" />
                    </svg>
                  </div>
                </div>
                <div className="vcard__meta">
                  <h4 className="vcard__title">{v.title}</h4>
                  <p className="vcard__cat">
                    {v.category_name || v?.category?.name || ""}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ══════════════════════════════════════════════════════════
   5. WATCH MORE CTA BAND
══════════════════════════════════════════════════════════ */
function WatchMoreCTA({ content }) {
  const defaults = homeDefaults("home_cta");
  return (
    <section className="cta-band">
      <div className="cta-band__glow" aria-hidden="true" />
      <div className="cta-band__inner">
        <div className="cta-band__text">
          <h2 className="cta-band__title">
            <CanvasField name="title">
              {cmsValue(content, "title", defaults.title)}
            </CanvasField>
          </h2>
          <p className="cta-band__sub">
            <CanvasField name="sub">
              {cmsValue(content, "sub", defaults.sub)}
            </CanvasField>
          </p>
        </div>
        <div className="cta-band__actions">
          <Link
            to={cmsValue(content, "cta_href", defaults.cta_href)}
            className="btn btn--primary btn--lg"
          >
            <CanvasField name="cta_text">
              {cmsValue(content, "cta_text", defaults.cta_text)}
            </CanvasField>
          </Link>
          <Link to="/free-account" className="btn btn--outline btn--lg">
            Register For Free
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════
   6. ABOUT
══════════════════════════════════════════════════════════ */
function AboutSection({ content }) {
  const defaults = homeDefaults("home_about");
  return (
    <section className="about">
      <div className="about__inner">
        <div className="about__img-col">
          <div className="about__img-glow" aria-hidden="true" />
          <img
            src={cmsImage(content?.avatar_url, ImgHead)}
            alt={cmsValue(content, "name", defaults.name)}
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
            className="about__img"
          />
        </div>
        <div className="about__content">
          <p className="section-eyebrow">About</p>
          <h2 className="about__name">
            <CanvasField name="name">
              {cmsValue(content, "name", defaults.name)}
            </CanvasField>
          </h2>
          <div className="about__rule" />
          <p className="about__text">
            <CanvasField name="text">
              {cmsValue(content, "text", defaults.text)}
            </CanvasField>
          </p>
          <Link to="/about" className="btn btn--ghost btn--sm">
            Learn More
            <svg
              width="13"
              height="13"
              viewBox="0 0 13 13"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M1 6.5h11M7 1.5l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
