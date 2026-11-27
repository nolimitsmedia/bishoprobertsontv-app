// src/pages/public/BuilderPage.js
import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../api";
import sanitizeHtml from "../../utils/sanitizeHtml";
import { usePageMeta } from "../../utils/pageMeta";
import {
  CanvasBlock,
  CanvasColumn,
  CanvasEmptySection,
  CanvasHint,
  PageContext,
  blocksDeviceCss,
  cssAttrs,
  hasDeviceStyles,
  sectionDeviceCss,
  useCanvas,
  visibilityClasses,
} from "../../components/builder/canvasContext";
import { cleanCss } from "../../lib/siteOptions";
import {
  EXTRA_BLOCK_TYPES,
  ExtraBlockPublic,
} from "../../components/builder/extraBlocks";
import "./Home.css"; // reuse existing builder section styles (cards, grids, etc)
import "./About.css"; // reuse About page layout styles
import "./PastoralLeadership.css"; // Pastoral Leadership layout styles
import "./Partnership.css"; // Partnership layout styles
import "./BuilderBlocks.css"; // Phase 4F: grid (cards) and columns blocks

// This site's own pictures (public/content/); old addresses repointed.
import { contentUrl, isSiteFile, upgradeAssets } from "../../lib/siteContent";
import { STORY_TYPES } from "../../components/builder/storyBlocks";

// Phase 4E: the Home page draft is previewed with the real Home component.
const HomePage = lazy(() => import("./Home"));

function DraftPreviewBanner() {
  return (
    <div
      role="status"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "8px 14px",
        background: "#6d28d9",
        color: "#fff",
        fontSize: 13,
        fontWeight: 700,
        textAlign: "center",
        letterSpacing: 0.2,
      }}
    >
      Draft preview. This is your saved draft; visitors see the published
      version until you publish.
    </div>
  );
}

/* -----------------------------------------
   Utilities
----------------------------------------- */
// Built-in picture names used by older saved pages → this site's own files.
const ASSET_MAP = {
  about_bishop_1: contentUrl("leader.png"),
  about_bishop_2: contentUrl("about-2.jpg"),
  about_bishop_3: contentUrl("about-3.jpg"),
};

/**
 * Normalize URLs so:
 * - http(s), data:, blob: are left alone
 * - frontend build assets (/static, /assets, /img) stay on frontend origin
 * - backend uploads (/uploads, /api/uploads) are rewritten to API origin
 */
const absUrl = (u) => {
  if (!u) return null;
  const s = String(u);

  // already absolute or special URLs
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("data:") || s.startsWith("blob:")) return s;

  // local build assets should stay on the FRONTEND origin (not the API origin)
  if (
    s.startsWith("/static/") ||
    s.startsWith("/assets/") ||
    s.startsWith("/img/") ||
    s === "/favicon.ico" ||
    isSiteFile(s) // the website's own files (e.g. /content/leader.png)
  ) {
    return s;
  }

  // allow builder seeds to reference packaged assets by key (optional)
  if (s.startsWith("asset:")) {
    const key = s.slice("asset:".length);
    return ASSET_MAP[key] || null;
  }

  // backend-served uploads should go to API origin
  const apiBase = (api?.defaults?.baseURL || "").replace(/\/api\/?$/i, "");
  if (s.startsWith("/uploads/")) return `${apiBase}${s}`;
  if (s.startsWith("/api/uploads/"))
    return `${apiBase}${s.replace(/^\/api/, "")}`;

  // plain relative paths: use as-is (frontend origin)
  return s.startsWith("/") ? s : `/${s}`;
};

async function safeGet(path, opts = {}) {
  try {
    const res = await api.get(path, { ...opts, validateStatus: () => true });
    const status = res?.status ?? 0;
    const ok = status >= 200 && status < 300;
    return { ok, status, data: res?.data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function clampNum(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isTwoColsLayout(layout) {
  const raw =
    layout && typeof layout === "object"
      ? (layout.value ??
        layout.layout ??
        layout.key ??
        layout.id ??
        layout.label)
      : layout;

  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (!s) return false;
  const norm = s.replace(/[^a-z0-9]+/g, "");
  return (
    norm === "twocolumns" ||
    norm === "twocolumn" ||
    norm === "twocols" ||
    norm === "twocol" ||
    norm === "2columns" ||
    norm === "2column" ||
    norm === "2cols" ||
    norm === "2col" ||
    norm.includes("twocol")
  );
}

function mapJustify(v) {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  if (!s || s === "default") return "flex-start";
  if (s === "left" || s === "start" || s === "flex-start") return "flex-start";
  if (s === "center") return "center";
  if (s === "right" || s === "end" || s === "flex-end") return "flex-end";
  if (s === "space-between") return "space-between";
  if (s === "space-around") return "space-around";
  if (s === "space-evenly") return "space-evenly";
  return v;
}

function mapAlignItems(v) {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  if (!s || s === "default") return "stretch";
  if (s === "left" || s === "start" || s === "flex-start") return "flex-start";
  if (s === "center") return "center";
  if (s === "right" || s === "end" || s === "flex-end") return "flex-end";
  if (s === "stretch") return "stretch";
  return v;
}

/* -----------------------------------------
   Theme + default styles
----------------------------------------- */
function themeDefaults(theme) {
  const t = String(theme || "default");
  if (t === "dark") {
    return {
      bg: "rgba(255,255,255,0.04)",
      border: "rgba(255,255,255,0.10)",
      text: "#ffffff",
    };
  }
  if (t === "purple") {
    return {
      bg: "rgba(124,58,237,0.12)",
      border: "rgba(124,58,237,0.25)",
      text: "#ffffff",
    };
  }
  if (t === "blue") {
    return {
      bg: "rgba(59,130,246,0.10)",
      border: "rgba(59,130,246,0.22)",
      text: "#ffffff",
    };
  }
  if (t === "light") {
    return {
      bg: "rgba(255,255,255,0.92)",
      border: "rgba(0,0,0,0.10)",
      text: "#0b0d12",
    };
  }
  return {
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.10)",
    text: "#ffffff",
  };
}

function defaultSectionStyle(theme = "default") {
  return {
    align: "center",
    max_width: "1100px",
    padding: "",
    margin: "",
    border_width: "",
    font_size: "",
    line_height: "",
    bg_color: "",
    text_color: "",
    border_color: "",
    radius: 14,
    shadow: "soft",
    title_color: "",
    show_title: true,
    overlay: 0,
    overlay_color: "",
    overlay_opacity: "",
    bg_image_url: "",
    bg_image_fit: "cover",
    bg_image_pos: "center",
    content_gap: "",
    min_height: "",
    height: "",
    img_radius: 12,
    img_fit: "cover",
    img_shadow: "soft",
  };
}

/* -----------------------------------------
   Block renderer (compatible with AdminPageEditor)
----------------------------------------- */
/* Phase 4E: safely map published block overrides to React inline styles.
   Empty properties inherit the global site design. */
const allowedCssColor = (value) => {
  const v = String(value || "").trim();
  if (!v || v.length > 100 || /[;{}<>]/.test(v)) return undefined;
  return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|transparent|currentColor|[a-z]+)$/i.test(
    v,
  )
    ? v
    : undefined;
};
const allowedCssLength = (value, max = 100) => {
  const v = String(value ?? "").trim();
  if (!v) return undefined;
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n) || n < 0 || n > max) return undefined;
  return /^\d+(?:\.\d+)?(?:px|rem|em|%)?$/.test(v)
    ? /^\d+(?:\.\d+)?$/.test(v)
      ? `${v}px`
      : v
    : undefined;
};
const allowedFontFamily = (value) => {
  const v = String(value || "").trim();
  return /^[a-zA-Z0-9 ,'-]{2,80}$/.test(v)
    ? `"${v.replace(/"/g, "")}", sans-serif`
    : undefined;
};
function publishedBlockStyle(block) {
  const st = isObj(block?.styles) ? block.styles : {};
  return {
    fontFamily: allowedFontFamily(st.font_family),
    fontSize: allowedCssLength(st.font_size, 72),
    color: allowedCssColor(st.text_color),
    backgroundColor: allowedCssColor(st.bg_color),
    borderColor: allowedCssColor(st.border_color),
    borderWidth: allowedCssLength(st.border_width, 20),
    borderStyle:
      allowedCssLength(st.border_width, 20) || allowedCssColor(st.border_color)
        ? "solid"
        : undefined,
    borderRadius: allowedCssLength(st.radius, 100),
    padding:
      /^\d+(?:\.\d+)?(?:px|rem|em|%)?(?:\s+\d+(?:\.\d+)?(?:px|rem|em|%)?){0,3}$/.test(
        String(st.padding || ""),
      )
        ? st.padding
        : undefined,
    textAlign: ["left", "center", "right", "justify"].includes(st.align)
      ? st.align
      : undefined,
  };
}

// Phase 4F: validated container style for columns and each column
// (background, border, radius, padding). Empty values mean "not set".
function publishedBoxStyle(styles) {
  const st = isObj(styles) ? styles : {};
  const bg = allowedCssColor(st.bg_color);
  const borderColor = allowedCssColor(st.border_color);
  const borderWidth = allowedCssLength(st.border_width, 20);
  const padding =
    /^\d+(?:\.\d+)?(?:px|rem|em|%)?(?:\s+\d+(?:\.\d+)?(?:px|rem|em|%)?){0,3}$/.test(
      String(st.padding || ""),
    )
      ? st.padding
      : undefined;
  const boxed = !!(bg || borderColor || borderWidth);
  return {
    backgroundColor: bg,
    borderColor: borderColor,
    borderWidth: borderWidth || (borderColor ? "1px" : undefined),
    borderStyle: borderColor || borderWidth ? "solid" : undefined,
    borderRadius: boxed ? allowedCssLength(st.radius, 100) : undefined,
    padding,
  };
}

// Phase 4F: every font family used by blocks, including blocks nested in columns.
function collectBlockFonts(sections) {
  const out = new Set();
  const walk = (blocks, depth) => {
    if (!Array.isArray(blocks) || depth > 4) return;
    blocks.forEach((b) => {
      if (!isObj(b)) return;
      const f = String(b?.styles?.font_family || "").trim();
      if (f) out.add(f);
      if (Array.isArray(b.columns))
        b.columns.forEach((c) => walk(c?.blocks, depth + 1));
    });
  };
  (Array.isArray(sections) ? sections : []).forEach((sec) =>
    walk(Array.isArray(sec?.blocks) ? sec.blocks : sec?.elements, 0),
  );
  return [...out].filter(
    (family) =>
      /^[a-zA-Z0-9 ,'-]{2,80}$/.test(family) &&
      !["Arial", "Georgia"].includes(family),
  );
}

// Loads the Google Fonts that block overrides refer to.
function useBlockFonts(sections) {
  useEffect(() => {
    const families = collectBlockFonts(sections);
    const id = "brtv-block-google-fonts";
    let link = document.getElementById(id);
    if (!families.length) {
      if (link) link.remove();
      return;
    }
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?${families.map((family) => `family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&")}&display=swap`;
  }, [sections]);
}

function renderBlocks(sec, st, pageSlug, isNarrow) {
  // Support both: sec.blocks (new) and sec.elements (older editor)
  const blocks = Array.isArray(sec.blocks)
    ? sec.blocks
    : Array.isArray(sec.elements)
      ? sec.elements
      : [];

  if (!blocks.length) return null;

  const gapNum = String(st.content_gap || "").trim()
    ? Number(String(st.content_gap).replace(/[^0-9.]/g, "")) || 18
    : 18;

  const hasGallery = blocks.some((b) => String(b?.type || "") === "gallery");
  const hasRich = blocks.some((b) => String(b?.type || "") === "richtext");

  const isTwoCols = isTwoColsLayout(sec?.layout);

  // Two-column builder layout (left = non-rich blocks, right = richtext)
  // Also keeps the About page layout you already like.
  const shouldUseTwoColLayout =
    isTwoCols && hasRich && (hasGallery || blocks.length > 1);

  if (shouldUseTwoColLayout) {
    const richBlocks = blocks.filter(
      (b) => String(b?.type || "") === "richtext",
    );
    const leftBlocks = blocks.filter(
      (b) => String(b?.type || "") !== "richtext",
    );

    // left width % (desktop only). default 68/32 like your screenshot.
    const leftStored = st?.col_left_pct ?? sec?.styles?.col_left_pct;
    const rightStored = st?.col_right_pct ?? sec?.styles?.col_right_pct;
    const leftPct = Number(
      leftStored != null
        ? leftStored
        : rightStored != null
          ? 100 - Number(rightStored || 50)
          : 50,
    );
    const rightPct = Number(
      rightStored != null
        ? rightStored
        : leftStored != null
          ? 100 - Number(leftStored || 50)
          : 50,
    );

    return (
      <section className="builder-twoCols">
        <div
          className="builder-twoColsShell"
          style={{
            display: "grid",
            gap: clampNum(gapNum, 0, 60),
            gridTemplateColumns: isNarrow ? `1fr` : `${leftPct}% ${rightPct}%`,
            alignItems: "start",
          }}
        >
          <div
            className="builder-twoColsLeft"
            style={{ padding: st.col_left_padding || undefined }}
          >
            {/* render all non-rich blocks on the left */}
            {leftBlocks.map((b, i) => (
              <CanvasBlock
                key={b?.id || `l${i}`}
                blockId={b?.id}
                spacing={b?.styles}
                type={b?.type}
              >
                {(() => {
                  const type = String(b?.type || "");
                  if (type === "gallery") {
                    const imgs = Array.isArray(b?.images)
                      ? b.images
                      : Array.isArray(b?.items)
                        ? b.items
                        : [];

                    return (
                      <div
                        key={b.id || `g-${i}`}
                        className="builder-galleryFlex"
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: Math.max(0, Number(b?.gap) || 10),
                          alignItems: "flex-start",
                        }}
                      >
                        {imgs.map((it, k) => {
                          const raw = it?.src || it?.url || it?.image_url || it;
                          const src = absUrl(raw);
                          if (!src) return null;

                          const w = Number(it?.w ?? it?.width);
                          const h = Number(it?.h ?? it?.height);

                          const boxStyle = {};
                          if (Number.isFinite(w) && w > 20)
                            boxStyle.width = `${Math.round(w)}px`;
                          if (Number.isFinite(h) && h > 20)
                            boxStyle.height = `${Math.round(h)}px`;

                          return (
                            <div
                              key={it?.id || `${k}`}
                              className="builder-galleryFlexItem"
                              style={boxStyle}
                            >
                              <img
                                src={src}
                                alt={String(it?.alt || "")}
                                style={{
                                  width: "100%",
                                  height: boxStyle.height ? "100%" : "auto",
                                  display: "block",
                                  objectFit: "cover",
                                  borderRadius: 14,
                                  border: "1px solid rgba(255,255,255,0.10)",
                                }}
                                loading="lazy"
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  // fallback: reuse single-column renderer for other block types
                  return (
                    <div key={b.id || `l-${i}`}>
                      {renderBlocks(
                        { ...sec, layout: "card", blocks: [b] },
                        st,
                        pageSlug,
                      )}
                    </div>
                  );
                })()}
              </CanvasBlock>
            ))}
          </div>

          <div
            className="builder-twoColsRight"
            style={{ padding: st.col_right_padding || undefined }}
          >
            {/* Phase 4E-2: the section heading already shows the title; only use
                this label when the heading is switched off. */}
            {sec?.title && st?.show_title === false ? (
              <div className="builder-kicker">{sec.title}</div>
            ) : null}
            {richBlocks.map((r, i) => (
              <CanvasBlock
                key={r?.id || `r${i}`}
                blockId={r?.id}
                spacing={r?.styles}
                type={r?.type}
              >
                {(() => {
                  const html = String(r?.html || "");
                  if (!html) return null;
                  return (
                    <div
                      key={r.id || `rt-${i}`}
                      className="builder-richtext"
                      style={publishedBlockStyle(r)}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
                    />
                  );
                })()}
              </CanvasBlock>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Default: single column stack
  return (
    <div
      className={`brtv-blocks${sec.__flex ? " brtv-blocks--flex" : ""}`}
      style={
        sec.__flex
          ? {
              // Container layout (Elementor-style flex container)
              display: "flex",
              flexDirection: sec.__flex.direction,
              flexWrap: sec.__flex.direction === "row" ? "wrap" : "nowrap",
              justifyContent: sec.__flex.justify,
              alignItems: sec.__flex.align,
              gap: sec.__flex.gap,
              minHeight: sec.__flex.fill ? "100%" : undefined,
              fontSize: String(st.font_size || "").trim() || undefined,
              lineHeight: String(st.line_height || "").trim() || undefined,
            }
          : {
              display: "grid",
              gap: clampNum(gapNum, 0, 60),
              fontSize: String(st.font_size || "").trim() || undefined,
              lineHeight: String(st.line_height || "").trim() || undefined,
            }
      }
    >
      {blocks.map((b) => (
        <CanvasBlock
          key={b?.id || Math.random()}
          blockId={b?.id}
          spacing={b?.styles}
          type={b?.type}
        >
          {(() => {
            const type = String(b?.type || "richtext");

            if (type === "hero") {
              const bg = absUrl(b.bg_url || "");
              const img = absUrl(b.image_url || "");
              const fit = b.bg_fit || "cover";
              const bpos = b.bg_pos || "center";

              return (
                <div
                  key={b.id || Math.random()}
                  className="brtv-hero"
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: bg ? `url(${bg})` : "rgba(255,255,255,0.04)",
                    backgroundSize: bg ? fit : undefined,
                    backgroundPosition: bg ? bpos : undefined,
                    padding: "22px 20px",
                  }}
                >
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      style={{
                        width: 86,
                        height: 86,
                        borderRadius: 14,
                        objectFit: "cover",
                      }}
                    />
                  ) : null}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ opacity: 0.8, fontSize: 13 }}>
                      {b.kicker || ""}
                    </div>
                    <div
                      style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}
                    >
                      {b.title || ""}
                    </div>
                    <div
                      style={{ opacity: 0.86, marginTop: 10, maxWidth: 720 }}
                    >
                      {b.sub || ""}
                    </div>
                  </div>
                </div>
              );
            }

            if (type === "button") {
              const text = String(b.text || "Click");
              const subtext = String(b.subtext || "");
              const hrefRaw = String(b.href || b.url || "");
              const href = hrefRaw || "#";
              const isExternal = /^https?:\/\//i.test(href);
              const className = String(b.className || "join-button");
              const align = String(b.align || "center");

              const blockStyle = publishedBlockStyle(b);
              const inner = (
                <>
                  <span>{text}</span>
                  {subtext ? <small>{subtext}</small> : null}
                </>
              );

              return (
                <div
                  key={b.id || Math.random()}
                  className="builder-buttonWrap"
                  style={{ textAlign: align }}
                >
                  {isExternal ? (
                    <a
                      className={className}
                      style={blockStyle}
                      href={href}
                      target={b.new_tab ? "_blank" : undefined}
                      rel={b.new_tab ? "noreferrer noopener" : undefined}
                    >
                      {inner}
                    </a>
                  ) : (
                    <Link className={className} style={blockStyle} to={href}>
                      {inner}
                    </Link>
                  )}
                </div>
              );
            }

            if (type === "gallery") {
              const imgs = Array.isArray(b?.images)
                ? b.images
                : Array.isArray(b?.items)
                  ? b.items
                  : [];
              if (!imgs.length)
                return (
                  <CanvasHint
                    key={b.id || "g"}
                    label="Gallery: add images in the panel on the left."
                  />
                );

              const cols = clampNum(Number(b?.cols) || 3, 1, 6);
              const gap = clampNum(Number(b?.gap) || 10, 0, 40);

              return (
                <div
                  key={b.id || Math.random()}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gap,
                  }}
                >
                  {imgs.map((it, idx) => {
                    const raw = it?.src || it?.url || it?.image_url || it;
                    const src = absUrl(raw);
                    if (!src) return null;
                    return (
                      <img
                        key={it?.id || idx}
                        src={src}
                        alt={it?.alt || ""}
                        style={{
                          width: "100%",
                          borderRadius: 14,
                          border: "1px solid rgba(255,255,255,0.10)",
                          objectFit: "cover",
                        }}
                        loading="lazy"
                      />
                    );
                  })}
                </div>
              );
            }

            // Phase 5: video, spacer, quote / testimonial, FAQ.
            if (EXTRA_BLOCK_TYPES.has(type)) {
              return <ExtraBlockPublic key={b.id || Math.random()} block={b} />;
            }

            // Phase 4F: Cards / Grid block (title, text, optional image per card).
            if (type === "grid") {
              const items = (Array.isArray(b?.items) ? b.items : []).filter(
                (it) =>
                  isObj(it) &&
                  (String(it.title || "").trim() ||
                    String(it.text || "").trim() ||
                    String(it.image_url || it.src || "").trim()),
              );
              if (!items.length)
                return (
                  <CanvasHint
                    key={b.id || "c"}
                    label="Cards: add cards in the panel on the left."
                  />
                );
              const cols = clampNum(Number(b?.cols) || 3, 1, 6);
              const gap = clampNum(
                Number.isFinite(Number(b?.gap)) && String(b?.gap ?? "") !== ""
                  ? Number(b.gap)
                  : 12,
                0,
                40,
              );
              return (
                <div
                  key={b.id || Math.random()}
                  className={`builder-grid builder-grid--cols${Math.min(cols, 4)}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    gap,
                  }}
                >
                  {items.map((it, k) => {
                    const src = absUrl(it.image_url || it.src || "");
                    const title = String(it.title || "").trim();
                    const text = String(it.text || "").trim();
                    return (
                      <div key={it.id || k} className="builder-card">
                        {src ? (
                          <img
                            className="builder-cardImg"
                            src={src}
                            alt={String(it.alt || "")}
                            loading="lazy"
                          />
                        ) : null}
                        {title || text ? (
                          <div className="builder-cardBody">
                            {title ? (
                              <h3 className="builder-cardTitle">{title}</h3>
                            ) : null}
                            {text ? (
                              <p className="builder-cardText">{text}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Phase 4F: Columns block. Each column renders its own blocks with this
            // same renderer (nested at most 3 levels deep).
            if (type === "columns") {
              const depth = Number(sec?.__depth) || 0;
              const cols = (Array.isArray(b?.columns) ? b.columns : []).filter(
                isObj,
              );
              if (!cols.length || depth >= 3) return null;
              const gap = clampNum(
                Number.isFinite(Number(b?.gap)) && String(b?.gap ?? "") !== ""
                  ? Number(b.gap)
                  : 14,
                0,
                60,
              );
              const stack = b?.stack_on_mobile !== false;
              // Container layout settings (validated)
              const FLEX = {
                start: "flex-start",
                center: "center",
                end: "flex-end",
                between: "space-between",
                stretch: "stretch",
              };
              const isContainer = b?.variant === "container";
              const widthMode = ["full", "boxed", "custom"].includes(
                b?.width_mode,
              )
                ? b.width_mode
                : "full";
              const widthStyle =
                widthMode === "boxed"
                  ? {
                      maxWidth: 1100,
                      marginLeft: "auto",
                      marginRight: "auto",
                      width: "100%",
                    }
                  : widthMode === "custom"
                    ? {
                        width: `${clampNum(Number(b?.width_pct) || 100, 10, 100)}%`,
                        marginLeft: "auto",
                        marginRight: "auto",
                      }
                    : null;
              const minH = clampNum(Number(b?.min_height) || 0, 0, 900);
              const alignItems = FLEX[b?.align_items] || "stretch";
              const justify = FLEX[b?.justify] || "flex-start";
              const direction =
                isContainer && b?.direction === "row" && !(stack && isNarrow)
                  ? "row"
                  : "column";
              const template = cols
                .map(
                  (c) =>
                    `minmax(0, ${clampNum(Number(c.width_pct) || 100 / cols.length, 5, 100)}fr)`,
                )
                .join(" ");
              return (
                <div
                  key={b.id || Math.random()}
                  className={`builder-columns ${stack ? "builder-columns--stack" : ""}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: stack && isNarrow ? "1fr" : template,
                    gap,
                    alignItems:
                      alignItems === "stretch" ? "stretch" : alignItems,
                    ...(minH ? { minHeight: minH } : {}),
                    ...(widthStyle || {}),
                    ...publishedBoxStyle(b.styles),
                  }}
                >
                  {cols.map((c, ci) => {
                    const inner = Array.isArray(c.blocks) ? c.blocks : [];
                    return (
                      <CanvasColumn key={c.id || ci} colId={c.id}>
                        <div
                          className="builder-column"
                          style={publishedBoxStyle(c.styles)}
                        >
                          {inner.length ? (
                            renderBlocks(
                              {
                                ...sec,
                                layout: "card",
                                blocks: inner,
                                __depth: depth + 1,
                                // Containers lay their elements out with flexbox.
                                __flex: isContainer
                                  ? {
                                      direction,
                                      justify,
                                      align: alignItems,
                                      gap,
                                      fill: minH > 0,
                                    }
                                  : null,
                              },
                              st,
                              pageSlug,
                              isNarrow,
                            )
                          ) : (
                            <CanvasEmptySection label="Empty column. Select it and use “+ Add block”." />
                          )}
                        </div>
                      </CanvasColumn>
                    );
                  })}
                </div>
              );
            }

            // default to richtext
            const html = String(b?.html || "");
            if (!html) return null;
            return (
              <div
                key={b.id || Math.random()}
                className="builder-richtext"
                style={publishedBlockStyle(b)}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
              />
            );
          })()}
        </CanvasBlock>
      ))}
    </div>
  );
}

function renderLegacy(sec, st, pageSlug, isNarrow) {
  const html = String(sec?.html || "").trim();
  const leftHtml = String(sec?.left_html || "").trim();
  const rightHtml = String(sec?.right_html || "").trim();

  // Two-column legacy HTML support
  if (isTwoColsLayout(sec?.layout) && (leftHtml || rightHtml)) {
    const leftStored = st?.col_left_pct ?? sec?.styles?.col_left_pct;
    const rightStored = st?.col_right_pct ?? sec?.styles?.col_right_pct;

    const leftPct = Number(
      leftStored != null
        ? leftStored
        : rightStored != null
          ? 100 - Number(rightStored || 50)
          : 50,
    );
    const rightPct = clampNum(100 - leftPct, 0, 100);

    const gapNum = String(st?.content_gap || "").trim()
      ? Number(String(st.content_gap).replace(/[^0-9.]/g, "")) || 18
      : 18;

    return (
      <div
        className="builder-twoCols"
        style={{
          display: "grid",
          gap: clampNum(gapNum, 0, 60),
          gridTemplateColumns: isNarrow
            ? "1fr"
            : `${clampNum(leftPct, 0, 100)}% ${clampNum(rightPct, 0, 100)}%`,
          alignItems: "start",
        }}
      >
        <div
          className="builder-twoColsLeft"
          style={{ padding: st?.col_left_padding || undefined }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(leftHtml) }}
        />
        <div
          className="builder-twoColsRight"
          style={{ padding: st?.col_right_padding || undefined }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(rightHtml) }}
        />
      </div>
    );
  }

  // Single-column legacy HTML support
  if (html) {
    return (
      <div
        className="builder-richtext"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      />
    );
  }

  return null;
}

function BuilderSection({ sec, pageSlug, isNarrow }) {
  const canvas = useCanvas(); // visual editor markers only
  const st = isObj(sec.styles) ? sec.styles : defaultSectionStyle(sec.theme);
  const t = themeDefaults(sec.theme);

  const isFull = sec.layout === "full";
  const isHighlight = sec.layout === "highlight";
  // Plain: no box. Content sits on the page at normal width; a background or
  // border appears only when set in Style.
  const isPlain = sec.layout === "plain";

  const maxW = String(st.max_width || "").trim();
  const wrapMaxWidth = maxW || (isFull ? "100%" : "1100px");

  const plainHasBox =
    isPlain &&
    !!(
      String(st.bg_color || "").trim() ||
      String(st.bg_image_url || "").trim() ||
      String(st.border_color || "").trim() ||
      String(st.border_width || "").trim()
    );
  const pad =
    st.padding ||
    (isFull ? "48px 0" : isPlain && !plainHasBox ? "22px 0" : "22px 18px");
  const mg = st.margin || (isFull ? "0" : "18px auto");
  const radius = clampNum(st.radius ?? 14, 0, 60);

  const bgColor =
    String(st.bg_color || "").trim() ||
    (isPlain ? "transparent" : isHighlight ? "rgba(154, 92, 255, 0.12)" : t.bg);

  const borderColor = String(st.border_color || "").trim() || t.border;
  const textColor = String(st.text_color || "").trim() || t.text;
  const titleColor = String(st.title_color || "").trim() || textColor;

  const overlayOpacityNumRaw =
    String(st.overlay_opacity ?? "").trim() === ""
      ? null
      : Number(st.overlay_opacity);
  const overlayOpacityNum = Number.isFinite(overlayOpacityNumRaw)
    ? Math.max(0, Math.min(0.9, overlayOpacityNumRaw))
    : Math.max(0, Math.min(0.9, Number(st.overlay ?? 0) || 0));

  const overlayColor = String(st.overlay_color || "").trim();
  const overlayLayer = overlayColor
    ? `linear-gradient(${overlayColor}, ${overlayColor})`
    : `linear-gradient(rgba(0,0,0,${overlayOpacityNum}), rgba(0,0,0,${overlayOpacityNum}))`;

  const bgImg =
    absUrl(st.bg_image_url) || (st.bg_image_url ? st.bg_image_url : null);
  const bgPosition = String(st.bg_image_pos || "center");
  const bgFit = String(st.bg_image_fit || "cover");

  const borderW = String(st.border_width || "").trim();
  const shadow = String(st.shadow || "soft");

  const outerStyle = { margin: mg, maxWidth: wrapMaxWidth };
  const innerStyle = {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    justifyContent: mapJustify(
      st?.justify || st?.justify_content || st?.justifyContent,
    ),
    alignItems: mapAlignItems(
      st?.items_align || st?.align_items || st?.alignItems,
    ),
    padding: pad,
    minHeight: String(st.min_height || "").trim() || undefined,
    height: String(st.height || "").trim() || undefined,
    borderRadius: isPlain && !plainHasBox ? 0 : radius,
    color: textColor,
    background: bgImg ? `${overlayLayer}, url(${bgImg})` : bgColor,
    backgroundSize: bgImg ? bgFit : undefined,
    backgroundPosition: bgImg ? bgPosition : undefined,
    border:
      isPlain && !String(st.border_color || "").trim() && !borderW
        ? "none"
        : `${borderW ? borderW : 1}px solid ${borderColor}`,
    boxShadow:
      isPlain || shadow === "none"
        ? "none"
        : shadow === "soft"
          ? "0 18px 54px rgba(0,0,0,0.35)"
          : "0 22px 70px rgba(0,0,0,0.50)",
  };

  const align = String(st.align || "center");
  const textAlign =
    align === "left" ? "left" : align === "right" ? "right" : "center";
  const showTitle = st.show_title !== false;

  return (
    <div
      style={outerStyle}
      className={`builder-sectionOuter ${visibilityClasses(st)} ${cssAttrs(st).classes}`.trim()}
      id={cssAttrs(st).id || undefined}
      data-bx-section={canvas ? String(sec?.id || "") : undefined}
      data-bx-sid={hasDeviceStyles(st) ? String(sec?.id || "") : undefined}
      // "1100px" is the renderer's own default (sectionStyleDefaults), so a
      // section with that value has not been given a custom width.
      data-width={
        isFull ? "full" : maxW && maxW !== "1100px" ? "custom" : "default"
      }
    >
      <div style={innerStyle}>
        {(() => {
          // Tablet / phone settings of this section and its elements.
          const css =
            sectionDeviceCss(sec?.id, st) + blocksDeviceCss(sec?.blocks);
          return css ? <style data-bx-device="">{css}</style> : null;
        })()}
        {showTitle && sec.title ? (
          <div
            style={{
              fontWeight: 900,
              color: titleColor,
              fontSize: 18,
              marginBottom: 12,
              textAlign,
            }}
          >
            {sec.title}
          </div>
        ) : null}
        <div style={{ textAlign }}>
          {canvas &&
          !(Array.isArray(sec.blocks) && sec.blocks.length) &&
          ![sec.html, sec.left_html, sec.right_html].some((x) =>
            String(x || "").trim(),
          ) ? (
            <CanvasEmptySection />
          ) : (
            renderBlocks(sec, st, pageSlug, isNarrow) ||
            renderLegacy(sec, st, pageSlug, isNarrow)
          )}
        </div>
      </div>
    </div>
  );
}

/* -----------------------------------------
   Main public builder page
----------------------------------------- */
// The older Partnership layout printed each section's name AND its own heading
// block, so titles appeared twice. Skip the name when a heading in the section
// says the same thing (letters only, so "CONNECTIO1N" matches "CONNECTION").
const lettersOnly = (t) =>
  String(t || "")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
function repeatsTitle(sec, blocks) {
  const t = lettersOnly(sec?.title);
  if (!t) return false;
  return blocks.some((b) => {
    const type = String(b?.type || "");
    if (type === "heading") return lettersOnly(b.text) === t;
    if (type === "richtext") {
      const m = String(b.html || "").match(
        /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i,
      );
      return m ? lettersOnly(m[1]) === t : false;
    }
    return false;
  });
}

export default function BuilderPage({
  slug,
  fallback = null,
  adminPreview = false,
  // Visual editor: the editor's unsaved draft, sent to the canvas; no fetch.
  canvasPage = null,
}) {
  const params = useParams();

  // Support multiple route param names: /p/:slug OR /p/:pageSlug
  const paramSlug =
    params?.pageSlug || params?.slug || params?.handle || params?.id || "";

  // prefer prop slug when provided (e.g. <BuilderPage slug="about" />)
  const pageSlug = String(slug || paramSlug || "")
    .replace(/^\//, "")
    .trim();

  const [vw, setVw] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isNarrow = vw < 920;

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      if (adminPreview) {
        const r = await safeGet(`/admin/pages/${params.id}`);
        if (!alive) return;
        setPage(r.ok ? upgradeAssets(r.data?.page || null) : null);
        setLoading(false);
        return;
      }

      // Faster pages: ONE request to the real address (/api/pages/:slug). The old
      // code tried five addresses one after another (four don't exist on this
      // server), so a page without an editor version waited for five failures —
      // and one of them logged "NaN" errors on the server.
      // Pages are also saved in the browser: a returning visitor sees the saved
      // copy at once while the fresh one loads.
      const key = `brtv:page:v1:${pageSlug}`;
      let shown = false;
      try {
        const raw = localStorage.getItem(key);
        const saved = raw ? JSON.parse(raw) : null;
        if (saved && saved.page) {
          setPage(upgradeAssets(saved.page));
          setLoading(false);
          shown = true;
        }
      } catch {
        /* no saved copy */
      }
      const r = await safeGet(`/pages/${encodeURIComponent(pageSlug)}`);
      if (!alive) return;
      if (r.ok && r.data) {
        const found = upgradeAssets(r.data?.page || r.data);
        setPage(found);
        try {
          const json = JSON.stringify({ page: found, at: Date.now() });
          if (json.length < 400000) localStorage.setItem(key, json);
        } catch {
          /* storage full or private mode */
        }
      } else if (r.status === 404 || r.status === 410) {
        setPage(null); // not published (anymore): show the built-in fallback
        try {
          localStorage.removeItem(key);
        } catch {
          /* ignore */
        }
      } else if (!shown) {
        setPage(null); // server unreachable and nothing saved
      }
      setLoading(false);
    }

    if (canvasPage) {
      setPage(canvasPage);
      setLoading(false);
    } else if (pageSlug || (adminPreview && params.id)) load();
    else {
      setPage(null);
      setLoading(false);
    }

    return () => {
      alive = false;
    };
  }, [pageSlug, adminPreview, params.id, canvasPage]);

  const sections = useMemo(() => {
    const cj =
      page?.content_json ||
      page?.contentJson ||
      page?.page?.content_json ||
      page?.page?.contentJson ||
      null;

    const extra =
      isObj(cj) && Array.isArray(cj.extra_sections) ? cj.extra_sections : [];
    return extra.filter(Boolean);
  }, [page]);

  // Load only Google Fonts referenced by published (or previewed) block
  // overrides, including blocks nested inside columns (Phase 4F).
  useBlockFonts(sections);

  // Phase 6: browser title, description and sharing tags for this page.
  // Draft previews are always hidden from search engines. The Home draft
  // preview is handled by the Home component itself.
  usePageMeta({
    enabled:
      !!page &&
      !(adminPreview && String(page?.slug || "").toLowerCase() === "home"),
    title: page?.seo_title || page?.title || "",
    titleIsFinal: !!page?.seo_title,
    description: page?.seo_description || page?.excerpt || "",
    image: page?.seo_image_url || page?.hero_image_url || "",
    noindex: !!page?.seo_noindex || !!adminPreview,
  });

  const isHomeDraft =
    adminPreview && String(page?.slug || "").toLowerCase() === "home";

  if (!loading && isHomeDraft) {
    return (
      <>
        <DraftPreviewBanner />
        <Suspense fallback={null}>
          <HomePage previewPage={page} />
        </Suspense>
      </>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "45vh",
          display: "grid",
          placeItems: "center",
          color: "rgba(255,255,255,0.72)",
        }}
      >
        Loading…
      </div>
    );
  }

  // Phase 4E: pages written only in the editor's Rich Text tab have no builder
  // sections; show their HTML instead of a blank page. Order for public pages:
  // builder sections, then a built-in page (About, Partnership, ...), then this.
  const htmlOnly = String(
    page?.content_html || page?.contentHtml || page?.page?.content_html || "",
  ).trim();

  if (!sections.length) {
    if (!adminPreview && fallback) return fallback;
    if (htmlOnly) {
      return (
        <PageContext.Provider
          value={page ? { id: page.id, slug: page.slug } : null}
        >
          <main className="home-root" style={{ paddingTop: 18 }}>
            {adminPreview ? <DraftPreviewBanner /> : null}
            <BuilderSection
              sec={{
                id: "page-html",
                title: "",
                layout: "card",
                theme: "default",
                blocks: [
                  { id: "page-html-block", type: "richtext", html: htmlOnly },
                ],
              }}
              pageSlug={pageSlug}
              isNarrow={isNarrow}
            />
          </main>
        </PageContext.Provider>
      );
    }
    return adminPreview ? (
      <>
        <DraftPreviewBanner />
        <div style={{ padding: 24 }}>
          This draft has no content yet. Add sections or text in the editor,
          then Preview again.
        </div>
      </>
    ) : (
      fallback
    );
  }

  const isPastoral =
    String(pageSlug || "").toLowerCase() === "pastoral-leadership";

  // The older Partnership layout is only for the older content; a page built
  // with the new design (story blocks, columns, or hidden section names) uses
  // the normal layout like every other page.
  const usesNewDesign = sections.some(
    (sec) =>
      sec?.styles?.show_title === false ||
      (Array.isArray(sec?.blocks) ? sec.blocks : []).some(
        (b) => STORY_TYPES.has(String(b?.type || "")) || b?.type === "columns",
      ),
  );
  const isPartnership =
    String(pageSlug || "").toLowerCase() === "partnership" && !usesNewDesign;

  if (isPastoral) {
    return (
      <div className="pl-page theme--dark">
        {adminPreview ? <DraftPreviewBanner /> : null}
        <div className="pl-wrap">
          <style>{`
        .builder-twoCols { width: 100%; }
        .builder-twoColsShell { width: 100%; }
        .builder-galleryFlexItem { width: 320px; max-width: 100%; }
        @media (max-width: 900px) {
          .builder-twoColsShell { grid-template-columns: 1fr !important; }
          .builder-galleryFlexItem { width: 100% !important; height: auto !important; }
        }
      `}</style>
          {page?.content_json?.page_css ? (
            <style data-page-css="">
              {cleanCss(page.content_json.page_css)}
            </style>
          ) : null}
          {sections.map((sec, idx) => (
            <BuilderSection
              key={sec.id || sec.title || idx}
              sec={sec}
              pageSlug={pageSlug}
              isNarrow={isNarrow}
            />
          ))}
        </div>
      </div>
    );
  }

  if (isPartnership) {
    const heroSec = sections[0];
    const contentSecs = sections.slice(1);

    const heroBlocks = heroSec
      ? renderBlocks(
          heroSec,
          { ...defaultSectionStyle("dark"), content_gap: 10 },
          pageSlug,
          isNarrow,
        )
      : null;

    return (
      <main className="partnership-page">
        {adminPreview ? <DraftPreviewBanner /> : null}
        <section className="partnership-hero">{heroBlocks}</section>

        <section className="partnership-content">
          {contentSecs.map((sec, idx) => {
            const blocks = Array.isArray(sec?.blocks)
              ? sec.blocks
              : Array.isArray(sec?.elements)
                ? sec.elements
                : [];

            const hasButton = blocks.some(
              (b) => String(b?.type || "") === "button",
            );

            if (hasButton) {
              return (
                <div key={sec.id || `cta-${idx}`} className="partnership-cta">
                  {renderBlocks(
                    sec,
                    { ...defaultSectionStyle("dark"), content_gap: 10 },
                    pageSlug,
                    isNarrow,
                  )}
                </div>
              );
            }

            return (
              <div
                key={sec.id || sec.title || idx}
                className="partnership-block"
              >
                {sec?.title && !repeatsTitle(sec, blocks) ? (
                  <h2>{sec.title}</h2>
                ) : null}
                {renderBlocks(
                  { ...sec, title: "" },
                  { ...defaultSectionStyle("dark"), content_gap: 12 },
                  pageSlug,
                  isNarrow,
                )}
              </div>
            );
          })}
        </section>
      </main>
    );
  }

  return (
    <PageContext.Provider
      value={page ? { id: page.id, slug: page.slug } : null}
    >
      <main className="home-root" style={{ paddingTop: 18 }}>
        {adminPreview ? <DraftPreviewBanner /> : null}
        <style>{`
        .builder-twoCols { width: 100%; }
        .builder-twoColsShell { width: 100%; }
        .builder-galleryFlexItem { width: 320px; max-width: 100%; }
        @media (max-width: 900px) {
          .builder-twoColsShell { grid-template-columns: 1fr !important; }
          .builder-galleryFlexItem { width: 100% !important; height: auto !important; }
        }
      `}</style>
        {page?.content_json?.page_css ? (
          <style data-page-css="">{cleanCss(page.content_json.page_css)}</style>
        ) : null}
        {sections.map((sec, idx) => (
          <BuilderSection
            key={sec.id || sec.title || idx}
            sec={sec}
            pageSlug={pageSlug}
            isNarrow={isNarrow}
          />
        ))}
      </main>
    </PageContext.Provider>
  );
}

// Phase 4F: renders a list of builder sections outside BuilderPage (used by the
// public Home page for sections added in the page builder).
export function BuilderSections({ sections, pageSlug = "" }) {
  const list = Array.isArray(sections) ? sections.filter(isObj) : [];
  const [vw, setVw] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useBlockFonts(list);
  if (!list.length) return null;
  const isNarrow = vw < 920;
  return (
    <div className="builder-embeddedSections">
      <style>{`
        .builder-twoCols { width: 100%; }
        .builder-twoColsShell { width: 100%; }
        .builder-galleryFlexItem { width: 320px; max-width: 100%; }
        @media (max-width: 900px) {
          .builder-twoColsShell { grid-template-columns: 1fr !important; }
          .builder-galleryFlexItem { width: 100% !important; height: auto !important; }
        }
      `}</style>
      {list.map((sec, idx) => (
        <BuilderSection
          key={sec.id || sec.title || idx}
          sec={sec}
          pageSlug={pageSlug}
          isNarrow={isNarrow}
        />
      ))}
    </div>
  );
}
