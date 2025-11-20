// src/components/BlocksEditorV2.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ---------------------------------- schema --------------------------------- */

const WIDGETS = [
  "heading",
  "text",
  "image",
  "button",
  "live",
  "divider",
  "spacer",
  "icon",
  "gallery",
  "carousel",
  "accordion",
  "tabs",
  "video",
  "form",
];
const PALETTE = [
  { type: "section", label: "Section" },
  { type: "columns", label: "Columns (2)" },
  { type: "heading", label: "Heading" },
  { type: "text", label: "Text (HTML)" },
  { type: "image", label: "Image" },
  { type: "button", label: "Button" },
  { type: "divider", label: "Divider" },
  { type: "spacer", label: "Spacer" },
  { type: "icon", label: "Icon" },
  { type: "gallery", label: "Image Gallery" },
  { type: "carousel", label: "Carousel" },
  { type: "accordion", label: "Accordion" },
  { type: "tabs", label: "Tabs" },
  { type: "video", label: "Video" },
  { type: "form", label: "Form" },
  { type: "live", label: "Live Embed" },
];

function key() {
  return Math.random().toString(36).slice(2);
}

const DEFAULTS = {
  section: () => ({
    type: "section",
    id: key(),
    style: {
      // IMPORTANT: keep background as a SINGLE CSS shorthand string so it survives
      // backends that drop unknown keys.
      // Example we produce: "#000 url(\"...\") center / cover no-repeat"
      background: "",
      // the following keys are optional helpers we keep in memory;
      // they may not be saved by some backends, so "background" is source of truth.
      bgSize: "cover",
      bgPosition: "center",
      padding: "",
      textAlign: "left",
      maxWidth: "", // px
      center: true,
      // Kept for compatibility; we mirror these from the shorthand for previews.
      bgImage: "", // plain URL
      backgroundImage: "", // plain URL mirror
    },
    children: [],
  }),
  columns: () => ({
    type: "columns",
    id: key(),
    gap: 16,
    stackMobile: true,
    style: {},
    columns: [
      { type: "column", id: key(), style: { padding: "" }, children: [] },
      { type: "column", id: key(), style: { padding: "" }, children: [] },
    ],
  }),
  column: () => ({
    type: "column",
    id: key(),
    style: { padding: "" },
    children: [],
  }),
  heading: () => ({
    type: "heading",
    id: key(),
    content: "Heading",
    tag: "h2",
    style: {
      color: "",
      align: "left",
      size: "24",
      weight: "700",
      line: "",
      bg: "",
      pad: "",
      radius: "",
      inline: false,
    },
  }),
  text: () => ({
    type: "text",
    id: key(),
    html: "<p>Type your text…</p>",
    style: {
      color: "",
      align: "left",
      size: "",
      line: "",
      bg: "",
      pad: "",
      radius: "",
    },
  }),
  image: () => ({
    type: "image",
    id: key(),
    url: "",
    width: "100%",
    height: "",
    align: "center",
    alt: "",
    radius: "",
  }),
  button: () => ({
    type: "button",
    id: key(),
    label: "Get started",
    href: "/",
    bg: "#2563eb",
    color: "#ffffff",
    size: "md",
    radius: "10",
    align: "left",
  }),
  divider: () => ({
    type: "divider",
    id: key(),
    color: "#e2e8f0",
    thickness: "2",
    width: "100%",
    align: "center",
    margin: "16 0 16 0",
  }),
  spacer: () => ({
    type: "spacer",
    id: key(),
    height: "24",
  }),
  icon: () => ({
    type: "icon",
    id: key(),
    emoji: "⭐",
    size: "32",
    color: "#0b1220",
    align: "left",
  }),
  gallery: () => ({
    type: "gallery",
    id: key(),
    columns: 3,
    gap: 8,
    radius: 8,
    images: [
      { id: key(), url: "", alt: "" },
      { id: key(), url: "", alt: "" },
      { id: key(), url: "", alt: "" },
    ],
  }),
  carousel: () => ({
    type: "carousel",
    id: key(),
    height: "",
    radius: 8,
    showArrows: true,
    images: [
      { id: key(), url: "", alt: "" },
      { id: key(), url: "", alt: "" },
    ],
  }),
  accordion: () => ({
    type: "accordion",
    id: key(),
    radius: 8,
    items: [
      { id: key(), title: "Item 1", html: "<p>Accordion content 1…</p>" },
      { id: key(), title: "Item 2", html: "<p>Accordion content 2…</p>" },
    ],
  }),
  tabs: () => ({
    type: "tabs",
    id: key(),
    radius: 8,
    items: [
      { id: key(), label: "Tab 1", html: "<p>Tab content 1…</p>" },
      { id: key(), label: "Tab 2", html: "<p>Tab content 2…</p>" },
    ],
  }),
  video: () => ({
    type: "video",
    id: key(),
    url: "",
    poster: "",
    width: "100%",
    height: "",
    radius: "8",
    controls: true,
    autoplay: false,
    loop: false,
    align: "center",
  }),
  form: () => ({
    type: "form",
    id: key(),
    action: "",
    method: "POST",
    submitLabel: "Submit",
    width: "",
    gap: 10,
    align: "left",
    fields: [
      {
        id: key(),
        type: "text",
        label: "Name",
        name: "name",
        placeholder: "Your name",
        required: true,
      },
      {
        id: key(),
        type: "email",
        label: "Email",
        name: "email",
        placeholder: "you@example.com",
        required: true,
      },
    ],
  }),
  live: () => ({
    type: "live",
    id: key(),
    url: "",
    html: "",
  }),
};

/* ----------------------------- tiny HTML helpers ---------------------------- */

const stripInlineStyles = (html = "") =>
  String(html).replace(/\sstyle="[^"]*"/gi, "");

const parseStyleString = (s = "") => {
  const out = {};
  s.split(";")
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((rule) => {
      const [k, v] = rule.split(":");
      if (!k || v == null) return;
      out[k.trim().toLowerCase()] = v.trim();
    });
  return out;
};

const px = (v) => {
  if (v == null || v === "") return "";
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? `${n}px` : String(v);
};
const pxNum = (v) => {
  if (!v) return "";
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? String(n) : "";
};

const cssPaddingToNumbers = (css = "") =>
  css
    .trim()
    .split(/\s+/)
    .map((t) => String(t).replace(/px$/i, ""))
    .join(" ");

const peelSection = (html = "") => {
  const m = String(html)
    .trim()
    .match(/^<section\b([^>]*)>([\s\S]*?)<\/section>$/i);
  if (!m) return null;
  return { attrs: m[1] || "", inner: m[2] || "" };
};

const stripCssUrl = (v = "") => {
  let s = String(v || "").trim();
  const urlMatch = s.match(/^url\((.*)\)$/i);
  if (urlMatch) s = urlMatch[1];
  s = s.replace(/^['"]|['"]$/g, "");
  return s;
};

/* -------- background shorthand helpers (persist across saves) --------------- */

function parseBgShorthand(bg = "") {
  const out = { color: "", url: "", position: "center", size: "cover" };
  if (!bg) return out;
  const s = String(bg);

  // url(...)
  const mu = s.match(/url\(([^)]+)\)/i);
  if (mu) out.url = stripCssUrl(mu[1]);

  // size after slash
  const ms = s.match(/\/\s*([^\s]+)\s*/);
  if (ms) out.size = ms[1];

  // position keywords
  const mp = s.match(/\b(left|center|right|top|bottom)\b/i);
  if (mp) out.position = mp[1].toLowerCase();

  // color: remove url(...) & position/size/repeat and trim
  let colorCandidate = s
    .replace(/url\([^)]*\)/gi, " ")
    .replace(/\/\s*[^\s]+/g, " ")
    .replace(/\b(no-repeat|repeat-x|repeat-y|repeat)\b/gi, " ")
    .replace(/\b(left|center|right|top|bottom)\b/gi, " ")
    .trim();
  // if starts with # or rgb/rgba/hsl/hsla or a single token -> treat as color
  if (
    /^#|^rgb\(|^rgba\(|^hsl\(|^hsla\(/i.test(colorCandidate) ||
    /^[a-zA-Z]+$/.test(colorCandidate)
  ) {
    out.color = colorCandidate;
  }
  return out;
}

function buildBgShorthand(
  color = "",
  url = "",
  position = "center",
  size = "cover"
) {
  const parts = [];
  if (color) parts.push(color);
  if (url) parts.push(`url("${url}")`);
  if (position) parts.push(position);
  if (size) parts.push(`/ ${size}`);
  parts.push("no-repeat");
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/* ---------------------------- HTML → V2 migration --------------------------- */

function elStyle(el) {
  const s = el?.getAttribute?.("style") || "";
  return parseStyleString(s);
}

function numberFromPx(val) {
  const n = parseFloat(val);
  return Number.isFinite(n) ? String(n) : "";
}

function buildHeadingFromEl(h) {
  const n = DEFAULTS.heading();
  n.tag = h.tagName.toLowerCase();
  n.content = h.textContent?.trim() || "Heading";
  const st = elStyle(h);
  n.style = {
    ...n.style,
    align: st["text-align"] || h.getAttribute("align") || n.style.align,
    color: st["color"] || n.style.color,
    size: numberFromPx(st["font-size"]) || n.style.size,
    weight: st["font-weight"] || n.style.weight,
    line: st["line-height"] || n.style.line,
  };
  return n;
}

function looksLikeImageBlock(div) {
  if (!div) return false;
  const imgs = div.querySelectorAll("img");
  return (
    imgs.length === 1 &&
    (div.childElementCount === 1 || div.textContent.trim() === "")
  );
}
function buildImageFromEl(div) {
  const img = div.querySelector("img");
  const n = DEFAULTS.image();
  if (!img) return n;
  const stDiv = elStyle(div);
  const stImg = elStyle(img);
  n.url = img.getAttribute("src") || "";
  n.alt = img.getAttribute("alt") || "";
  n.width = img.getAttribute("width")
    ? px(img.getAttribute("width"))
    : stImg["width"] || "100%";
  n.height = img.getAttribute("height")
    ? px(img.getAttribute("height"))
    : stImg["height"] || "";
  n.radius = pxNum(stImg["border-radius"]) || "";
  const align =
    stDiv["text-align"] === "center"
      ? "center"
      : stDiv["text-align"] === "right"
      ? "right"
      : "left";
  n.align = align;
  return n;
}

function looksLikeButtonBlock(div) {
  if (!div) return false;
  const a = div.querySelector("a");
  return !!a && div.querySelectorAll("a").length === 1;
}
function buildButtonFromEl(div) {
  const a = div.querySelector("a");
  const n = DEFAULTS.button();
  if (!a) return n;
  const stDiv = elStyle(div);
  const stA = elStyle(a);
  n.href = a.getAttribute("href") || "#";
  n.label = (a.textContent || "Button").trim();
  n.bg = stA["background"] || stA["background-color"] || n.bg;
  n.color = stA["color"] || n.color;
  n.radius = pxNum(stA["border-radius"]) || n.radius;
  const align =
    stDiv["text-align"] === "center"
      ? "center"
      : stDiv["text-align"] === "right"
      ? "right"
      : "left";
  n.align = align;
  return n;
}

function looksLikeColumns(div) {
  const st = elStyle(div);
  const disp = (st["display"] || "").toLowerCase();
  if (disp !== "grid") return false;
  return Array.from(div.children).every((c) => c.tagName === "DIV");
}
function buildColumnsFromEl(div) {
  const st = elStyle(div);
  const gap = st["gap"] || st["column-gap"] || st["grid-gap"];
  const n = DEFAULTS.columns();
  if (gap) n.gap = parseFloat(gap) || 16;

  n.columns = Array.from(div.children).map((colEl) => {
    const col = DEFAULTS.column();
    const stCol = elStyle(colEl);
    if (stCol["padding"])
      col.style.padding = cssPaddingToNumbers(stCol["padding"]);
    col.children = parseChildren(colEl);
    return col;
  });
  return n;
}

function buildTextFromEl(el) {
  const n = DEFAULTS.text();
  const st = elStyle(el);
  n.style = {
    ...n.style,
    align: st["text-align"] || n.style.align,
    color: st["color"] || n.style.color,
    size: numberFromPx(st["font-size"]) || n.style.size,
    line: st["line-height"] || n.style.line,
  };
  n.html = stripInlineStyles(el.innerHTML || "");
  if (!/^\s*<.+>\s*$/s.test(n.html)) {
    n.html = `<p>${n.html}</p>`;
  }
  return n;
}

function parseChildren(rootEl) {
  const out = [];
  if (!rootEl) return out;
  Array.from(rootEl.children).forEach((el) => {
    const tag = el.tagName?.toLowerCase?.() || "";

    if (/^h[1-4]$/.test(tag)) {
      out.push(buildHeadingFromEl(el));
      return;
    }

    if (tag === "div") {
      if (looksLikeColumns(el)) {
        out.push(buildColumnsFromEl(el));
        return;
      }
      if (looksLikeImageBlock(el)) {
        out.push(buildImageFromEl(el));
        return;
      }
      if (looksLikeButtonBlock(el)) {
        out.push(buildButtonFromEl(el));
        return;
      }
      out.push(buildTextFromEl(el));
      return;
    }

    if (tag === "p") {
      const wrapper = el.ownerDocument.createElement("div");
      wrapper.setAttribute("style", el.getAttribute("style") || "");
      wrapper.innerHTML = el.outerHTML;
      out.push(buildTextFromEl(wrapper));
      return;
    }

    if (tag === "img") {
      const wrapper = el.ownerDocument.createElement("div");
      wrapper.appendChild(el.cloneNode(true));
      out.push(buildImageFromEl(wrapper));
      return;
    }

    if (tag === "a") {
      const wrapper = el.ownerDocument.createElement("div");
      wrapper.appendChild(el.cloneNode(true));
      out.push(buildButtonFromEl(wrapper));
      return;
    }

    const wrapper = el.ownerDocument.createElement("div");
    wrapper.innerHTML = el.outerHTML;
    out.push(buildTextFromEl(wrapper));
  });
  return out;
}

function migrateToV2(value) {
  if (value && value.version === 2) return value;

  const flat = Array.isArray(value) ? value : [];
  const root = [];

  if (flat.length === 0) {
    return { version: 2, root: [] };
  }

  flat.forEach((b) => {
    if (b.type === "hero") {
      const section = DEFAULTS.section();
      const col = DEFAULTS.column();
      section.children.push(col);
      const h = DEFAULTS.heading();
      h.content = b.heading || "Welcome";
      h.tag = "h2";
      const t = DEFAULTS.text();
      t.html = `<p>${b.subheading || "Add a short description here."}</p>`;
      col.children.push(h, t);
      if (b.cta_text) {
        const btn = DEFAULTS.button();
        btn.label = b.cta_text;
        btn.href = b.cta_url || "#";
        col.children.push(btn);
      }
      root.push(section);
      return;
    }

    if (b.type === "liveEmbed") {
      const section = DEFAULTS.section();
      const col = DEFAULTS.column();
      section.children.push(col);
      const lv = DEFAULTS.live();
      lv.url = b.url || "";
      lv.html = b.html || "";
      col.children.push(lv);
      root.push(section);
      return;
    }

    if (b.type === "richText") {
      let html = String(b.html || "");
      const section = DEFAULTS.section();
      const col = DEFAULTS.column();
      section.children.push(col);

      const peeled = peelSection(html);
      if (peeled) {
        const st = parseStyleString(
          (peeled.attrs.match(/\sstyle="([^"]*)"/i) || [, ""])[1]
        );
        // preserve background shorthand if present
        section.style.background = st["background"] || section.style.background;
        section.style.textAlign = st["text-align"] || section.style.textAlign;
        if (st["padding"]) {
          section.style.padding = cssPaddingToNumbers(st["padding"]);
        }
        html = peeled.inner;
      }

      const tmp = document.createElement("div");
      tmp.innerHTML = html;

      let contentRoot = tmp;
      if (tmp.childElementCount === 1) {
        const only = tmp.firstElementChild;
        if (only && only.tagName !== "SECTION") contentRoot = only;
      }

      col.children = parseChildren(contentRoot);

      if (col.children.length === 0) {
        const t = DEFAULTS.text();
        t.html = stripInlineStyles(html || "<p>…</p>");
        col.children.push(t);
      }

      root.push(section);
      return;
    }
  });

  return { version: 2, root };
}

/* --------------------------------- helpers ---------------------------------- */

const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * Normalize/repair background fields for EVERY section:
 * - Ensure style.background includes url(...) if any image is present
 * - Mirror plain URL into bgImage/backgroundImage for preview
 */
function sanitizeV2Doc(doc) {
  const out = clone(doc || { version: 2, root: [] });
  const walk = (nodes = []) => {
    for (const n of nodes) {
      if (!n) continue;
      if (n.type === "section") {
        const st = n.style || {};
        const parts = parseBgShorthand(st.background || "");
        const url = (
          st.bgImage ||
          st.backgroundImage ||
          parts.url ||
          ""
        ).trim();
        const pos = st.bgPosition || parts.position || "center";
        const size = st.bgSize || parts.size || "cover";
        const color = parts.color || st.backgroundColor || "";

        const nextBg = buildBgShorthand(color, url, pos, size);
        st.background = nextBg;
        st.bgImage = url;
        st.backgroundImage = url;
        st.bgPosition = pos;
        st.bgSize = size;
        n.style = st;
      }
      if (Array.isArray(n.children)) walk(n.children);
      if (n.type === "columns" && Array.isArray(n.columns)) {
        for (const c of n.columns) {
          if (Array.isArray(c.children)) walk(c.children);
        }
      }
    }
  };
  walk(out.root || []);
  return out;
}

function findContainerAndIndex(root, targetId) {
  for (const sec of root) {
    if (sec.id === targetId)
      return { container: root, index: root.indexOf(sec), parent: null };

    const i1 = (sec.children || []).findIndex((x) => x.id === targetId);
    if (i1 >= 0) return { container: sec.children, index: i1, parent: sec };

    for (const child of sec.children || []) {
      if (child?.type === "column") {
        const iCol = (child.children || []).findIndex((x) => x.id === targetId);
        if (iCol >= 0) {
          return { container: child.children, index: iCol, parent: child };
        }
      }
    }

    const cols = (sec.children || []).filter((c) => c.type === "columns");
    for (const cs of cols) {
      for (const col of cs.columns || []) {
        if (col.id === targetId)
          return {
            container: cs.columns,
            index: (cs.columns || []).findIndex((c) => c.id === targetId),
            parent: cs,
          };
        const i2 = (col.children || []).findIndex((x) => x.id === targetId);
        if (i2 >= 0) return { container: col.children, index: i2, parent: col };
      }
    }
  }
  return null;
}

function findNode(root, id) {
  if (!id) return null;
  for (const sec of root) {
    if (sec.id === id) return sec;

    for (const child of sec.children || []) {
      if (child.id === id) return child;

      if (child.type === "column") {
        for (const w of child.children || []) if (w.id === id) return w;
      }

      if (child.type === "columns") {
        for (const col of child.columns || []) {
          if (col.id === id) return col;
          for (const w of col.children || []) if (w.id === id) return w;
        }
      }
    }
  }
  return null;
}

function canDropInto(targetNode, itemType) {
  if (!targetNode) return false;
  if (targetNode === "root") return itemType === "section";
  if (targetNode.type === "section") {
    return (
      itemType === "columns" ||
      WIDGETS.includes(itemType) ||
      itemType === "column"
    );
  }
  if (targetNode.type === "columns") return itemType === "column";
  if (targetNode.type === "column") return WIDGETS.includes(itemType);
  return false;
}

/* ------------------------------- small pieces ------------------------------- */

function PxPad(pad) {
  if (!pad) return {};
  const arr = String(pad)
    .trim()
    .split(/\s+/)
    .map((n) => Number(n || 0));
  const [t = 0, r = t, b = t, l = r] = arr;
  return { paddingTop: t, paddingRight: r, paddingBottom: b, paddingLeft: l };
}

function PaletteItem({ type, label }) {
  return (
    <div
      className="be-chip"
      draggable
      onDragStart={(e) => e.dataTransfer.setData("application/x-widget", type)}
    >
      {label}
    </div>
  );
}

/* --------------------------------- Views ------------------------------------ */

function SectionView({ node, onDropIn, children }) {
  // render from the single background shorthand
  const bg = node.style?.background || "";
  const parts = parseBgShorthand(bg);
  const maxWidth = node.style?.maxWidth
    ? Number(node.style.maxWidth)
    : undefined;
  const center = node.style?.center !== false;

  return (
    <div
      className="be-drop be-section"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.stopPropagation();
        onDropIn(e, node);
      }}
      style={{
        background: bg || undefined,
        textAlign: node.style?.textAlign || "left",
        ...PxPad(node.style?.padding),
      }}
    >
      <div
        className="be-section-inner"
        style={{
          maxWidth: maxWidth ? `${maxWidth}px` : undefined,
          margin: center ? "0 auto" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ColumnsView({ node, children }) {
  const className = node.stackMobile ? "be-columns stack-sm" : "be-columns";
  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${node.columns?.length || 2}, 1fr)`,
        gap: `${node.gap ?? 16}px`,
      }}
    >
      {children}
    </div>
  );
}

function ColumnView({ node, onDropIn, children }) {
  return (
    <div
      className="be-drop be-column"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.stopPropagation();
        onDropIn(e, node);
      }}
      style={{ ...PxPad(node.style?.padding) }}
    >
      {children}
    </div>
  );
}

function HeadingView({ node }) {
  const Tag = node.tag || "h2";
  const align = node.style?.align || "left";
  const color = node.style?.color || "#0b1220";
  const size = Number(node.style?.size || 24);
  const weight = String(node.style?.weight || "700");
  const line = node.style?.line ? Number(node.style.line) : undefined;
  const bg = node.style?.bg || "";
  const pad = node.style?.pad || "";
  const radius = node.style?.radius ? Number(node.style.radius) : undefined;
  const inner = (
    <span
      style={{
        background: bg || undefined,
        borderRadius: radius,
        display: node.style?.inline ? "inline-block" : "block",
        ...PxPad(pad),
      }}
    >
      {node.content}
    </span>
  );
  return (
    <Tag
      style={{
        textAlign: align,
        color,
        fontSize: size,
        fontWeight: weight,
        lineHeight: line,
        margin: 0,
      }}
    >
      {inner}
    </Tag>
  );
}

function TextView({ node }) {
  const align = node.style?.align || "left";
  const color = node.style?.color || "#334155";
  const size = node.style?.size ? Number(node.style.size) : undefined;
  const line = node.style?.line ? Number(node.style.line) : undefined;
  const bg = node.style?.bg || "";
  const pad = node.style?.pad || "";
  const radius = node.style?.radius ? Number(node.style.radius) : undefined;
  return (
    <div
      style={{
        textAlign: align,
        color,
        fontSize: size,
        lineHeight: line,
        background: bg || undefined,
        borderRadius: radius,
        ...PxPad(pad),
      }}
      dangerouslySetInnerHTML={{ __html: node.html || "" }}
    />
  );
}

function ImageView({ node }) {
  const w = node.width || "100%";
  const h = node.height || "";
  const justify =
    node.align === "center"
      ? "center"
      : node.align === "right"
      ? "flex-end"
      : "flex-start";
  const radius = node.radius ? Number(node.radius) : undefined;
  return (
    <div style={{ display: "flex", justifyContent: justify }}>
      {node.url ? (
        <img
          src={node.url}
          alt={node.alt || ""}
          style={{
            width: w,
            height: h || "auto",
            display: "block",
            borderRadius: radius,
          }}
        />
      ) : (
        <div className="be-empty">Set image URL</div>
      )}
    </div>
  );
}

function ButtonView({ node }) {
  const size = node.size || "md";
  const pad =
    size === "sm" ? "8px 12px" : size === "lg" ? "14px 18px" : "10px 14px";
  const justify =
    node.align === "center"
      ? "center"
      : node.align === "right"
      ? "flex-end"
      : "flex-start";
  return (
    <div style={{ display: "flex", justifyContent: justify }}>
      <a
        href={node.href || "#"}
        onClick={(e) => e.preventDefault()}
        style={{
          display: "inline-block",
          padding: pad,
          borderRadius: `${Number(node.radius || 10)}px`,
          background: node.bg || "#2563eb",
          color: node.color || "#fff",
          textDecoration: "none",
          fontWeight: 700,
        }}
      >
        {node.label || "Button"}
      </a>
    </div>
  );
}

function DividerView({ node }) {
  const justify =
    node.align === "center"
      ? "center"
      : node.align === "right"
      ? "flex-end"
      : "flex-start";
  const thickness = Number(node.thickness || 1);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: justify,
        width: "100%",
        ...PxPad(node.margin),
      }}
    >
      <div
        style={{
          width: node.width || "100%",
          height: thickness,
          background: node.color || "#e2e8f0",
          borderRadius: thickness / 2,
        }}
      />
    </div>
  );
}

function SpacerView({ node }) {
  const h = Number(node.height || 16);
  return <div style={{ height: h }} />;
}

function IconView({ node }) {
  const size = Number(node.size || 24);
  const color = node.color || "#0b1220";
  const justify =
    node.align === "center"
      ? "center"
      : node.align === "right"
      ? "flex-end"
      : "flex-start";
  return (
    <div style={{ display: "flex", justifyContent: justify }}>
      <span style={{ fontSize: size, lineHeight: 1, color }}>
        {node.emoji || "⭐"}
      </span>
    </div>
  );
}

function GalleryView({ node }) {
  const cols = Math.max(1, Number(node.columns || 3));
  const gap = Number(node.gap || 8);
  const radius = Number(node.radius || 0);
  const imgs = Array.isArray(node.images) ? node.images : [];
  return (
    <div
      className="be-gallery"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap,
      }}
    >
      {imgs.map((img) =>
        img.url ? (
          <img
            key={img.id}
            src={img.url}
            alt={img.alt || ""}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              borderRadius: radius,
            }}
          />
        ) : (
          <div key={img.id} className="be-empty" style={{ minHeight: 60 }}>
            Image URL
          </div>
        )
      )}
    </div>
  );
}

function CarouselView({ node }) {
  const [idx, setIdx] = useState(0);
  const images = Array.isArray(node.images) ? node.images.filter(Boolean) : [];
  const visible = images.length > 0 ? images[idx % images.length] : null;
  const h = node.height ? Number(node.height) : undefined;
  const radius = Number(node.radius || 0);

  const go = (d) =>
    setIdx((i) =>
      images.length ? (i + d + images.length) % images.length : 0
    );

  return (
    <div className="be-carousel" style={{ position: "relative" }}>
      {visible?.url ? (
        <img
          src={visible.url}
          alt={visible.alt || ""}
          style={{
            width: "100%",
            height: h ? `${h}px` : "auto",
            objectFit: h ? "cover" : undefined,
            display: "block",
            borderRadius: radius,
          }}
        />
      ) : (
        <div className="be-empty" style={{ height: 160 }}>
          Add images
        </div>
      )}
      {node.showArrows && images.length > 1 && (
        <>
          <button
            className="be-car-btn left"
            onClick={() => go(-1)}
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            className="be-car-btn right"
            onClick={() => go(1)}
            aria-label="Next"
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}

function AccordionView({ node }) {
  const [open, setOpen] = useState(0);
  const items = Array.isArray(node.items) ? node.items : [];
  const radius = Number(node.radius || 8);
  return (
    <div className="be-accordion">
      {items.map((it, i) => (
        <div
          key={it.id}
          className="be-acc-item"
          style={{ borderRadius: radius }}
        >
          <button
            className="be-acc-title"
            onClick={() => setOpen((o) => (o === i ? -1 : i))}
          >
            {it.title || `Item ${i + 1}`}
            <span className="be-acc-icon">{open === i ? "–" : "+"}</span>
          </button>
          {open === i && (
            <div
              className="be-acc-body"
              dangerouslySetInnerHTML={{ __html: it.html || "<p>…</p>" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function TabsView({ node }) {
  const [active, setActive] = useState(0);
  const items = Array.isArray(node.items) ? node.items : [];
  const radius = Number(node.radius || 8);
  return (
    <div className="be-tabs">
      <div className="be-tablist">
        {items.map((it, i) => (
          <button
            key={it.id}
            className={`be-tab ${active === i ? "active" : ""}`}
            onClick={() => setActive(i)}
          >
            {it.label || `Tab ${i + 1}`}
          </button>
        ))}
      </div>
      {items[active] && (
        <div className="be-tabpanel" style={{ borderRadius: radius }}>
          <div
            dangerouslySetInnerHTML={{
              __html: items[active].html || "<p>…</p>",
            }}
          />
        </div>
      )}
    </div>
  );
}

function VideoView({ node }) {
  const justify =
    node.align === "center"
      ? "center"
      : node.align === "right"
      ? "flex-end"
      : "flex-start";
  const radius = node.radius ? Number(node.radius) : undefined;
  const w = node.width || "100%";
  const h = node.height || "";
  const url = node.url || "";

  const isYouTube = /youtu\.?be/.test(url);
  const ytId = (() => {
    if (!url) return "";
    const m1 = url.match(/youtu\.be\/([A-Za-z0-9_-]+)/i);
    if (m1) return m1[1];
    const m2 = url.match(/[?&]v=([A-Za-z0-9_-]+)/i);
    return m2 ? m2[1] : "";
  })();

  return (
    <div style={{ display: "flex", justifyContent: justify }}>
      {isYouTube && ytId ? (
        <div style={{ width: w }}>
          <div
            style={{
              position: "relative",
              paddingBottom: h ? undefined : "56.25%",
              height: h ? Number(h) : 0,
              borderRadius: radius,
              overflow: "hidden",
            }}
          >
            <iframe
              src={`https://www.youtube.com/embed/${ytId}`}
              title="Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: 0,
              }}
            />
          </div>
        </div>
      ) : url ? (
        <video
          src={url}
          poster={node.poster || undefined}
          style={{
            width: w,
            height: h || "auto",
            borderRadius: radius,
            display: "block",
          }}
          controls={!!node.controls}
          autoPlay={!!node.autoplay}
          loop={!!node.loop}
        />
      ) : (
        <div className="be-empty">Set video URL</div>
      )}
    </div>
  );
}

function FormView({ node }) {
  const align =
    node.align === "center"
      ? "center"
      : node.align === "right"
      ? "flex-end"
      : "flex-start";
  const w = node.width ? Number(node.width) : undefined;
  const gap = Number(node.gap || 10);
  return (
    <div style={{ display: "flex", justifyContent: align }}>
      <form
        action={node.action || "#"}
        method={node.method || "POST"}
        onSubmit={(e) => e.preventDefault()}
        style={{ width: w ? `${w}px` : "100%" }}
      >
        <div className="be-form" style={{ gap }}>
          {(node.fields || []).map((f) => (
            <div key={f.id} className="be-form-field">
              {f.label && <label className="be-form-label">{f.label}</label>}
              {f.type === "textarea" ? (
                <textarea
                  className="be-input"
                  placeholder={f.placeholder || ""}
                  required={!!f.required}
                  rows={4}
                />
              ) : f.type === "select" ? (
                <select className="be-input" required={!!f.required}>
                  <option value="">Select…</option>
                  {(f.options || "").split(",").map((opt, i) => (
                    <option key={i} value={opt.trim()}>
                      {opt.trim()}
                    </option>
                  ))}
                </select>
              ) : f.type === "checkbox" ? (
                <label className="be-checkbox">
                  <input type="checkbox" defaultChecked={!!f.checked} />{" "}
                  <span>{f.placeholder || f.label || "Checkbox"}</span>
                </label>
              ) : (
                <input
                  className="be-input"
                  type={f.type || "text"}
                  placeholder={f.placeholder || ""}
                  required={!!f.required}
                />
              )}
            </div>
          ))}
          <button className="be-btn be-btn-primary" type="submit">
            {node.submitLabel || "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}

function LiveView({ node }) {
  if (node.html) {
    return (
      <div
        className="be-live"
        dangerouslySetInnerHTML={{ __html: node.html }}
      />
    );
  }
  if (node.url) {
    return (
      <div className="be-live">
        <iframe
          src={node.url}
          title="Live"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          style={{ width: "100%", height: 360, border: 0 }}
        />
      </div>
    );
  }
  return <div className="be-empty">Set embed URL or HTML</div>;
}

/* ------------------------------ Sortable item ------------------------------- */

function SortableItem({ id, selected, children, onClickNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      className={`be-item ${selected ? "be-selected" : ""}`}
      style={style}
    >
      <button
        type="button"
        className="be-handle"
        title="Drag"
        aria-label="Drag"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        ⋮⋮
      </button>
      <div className="be-node" onClick={onClickNode}>
        {children}
      </div>
    </div>
  );
}

/* -------------------------------- Inspector -------------------------------- */

function Labeled({ label, children }) {
  return (
    <>
      <label className="be-label">{label}</label>
      {children}
    </>
  );
}

function NumberInput({ value, onChange, placeholder }) {
  return (
    <input
      type="number"
      className="be-input"
      value={value ?? ""}
      placeholder={placeholder || ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      className="be-input"
      value={value ?? ""}
      placeholder={placeholder || ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ColorInput({ value, onChange }) {
  return (
    <input
      type="color"
      className="be-input"
      value={value || "#000000"}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Inspector({ node, onChange, onDelete, onUpload }) {
  const fileRef = useRef(null);
  const secBgFileRef = useRef(null);

  // helper to update section.background shorthand consistently
  const updateSectionBg = (overrides = {}) => {
    const s = node.style || {};
    const parts = parseBgShorthand(s.background || "");
    const color = overrides.color !== undefined ? overrides.color : parts.color;
    const url =
      overrides.url !== undefined
        ? overrides.url
        : s.bgImage || s.backgroundImage || parts.url || "";
    const position =
      overrides.position !== undefined
        ? overrides.position
        : s.bgPosition || parts.position || "center";
    const size =
      overrides.size !== undefined
        ? overrides.size
        : s.bgSize || parts.size || "cover";
    const bg = buildBgShorthand(color, url, position, size);
    onChange({
      ...node,
      style: {
        ...s,
        background: bg,
        bgImage: url,
        backgroundImage: url,
        bgPosition: position,
        bgSize: size,
      },
    });
  };

  const pickSecBg = () => secBgFileRef.current?.click();
  const onSecBgFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let url = "";
      if (typeof onUpload === "function") {
        url = await onUpload(file);
      } else {
        url = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onerror = rej;
          fr.onload = () => res(String(fr.result || ""));
          fr.readAsDataURL(file);
        });
      }
      updateSectionBg({ url });
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      if (secBgFileRef.current) secBgFileRef.current.value = "";
    }
  };

  if (!node) {
    return (
      <div className="be-panel">
        <div className="be-title">Inspector</div>
        <div className="be-muted">Select an item on the canvas.</div>
      </div>
    );
  }

  const update = (patch) => onChange({ ...node, ...patch });
  const patchStyle = (k, v) =>
    update({ style: { ...(node.style || {}), [k]: v } });
  const padHelp = (
    <div className="be-help">
      Padding format: <code>top right bottom left</code>
    </div>
  );

  const handlePick = () => fileRef.current?.click();
  const handleFile = async (e, targetKey = "url") => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let url = "";
      if (typeof onUpload === "function") {
        url = await onUpload(file);
      } else {
        url = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onerror = rej;
          fr.onload = () => res(String(fr.result || ""));
          fr.readAsDataURL(file);
        });
      }
      if (targetKey === "__return") return url;
      update({ [targetKey]: url });
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="be-panel">
      <div className="be-title">Inspector</div>

      {node.type === "section" && (
        <>
          <Labeled label="Background color" />
          <ColorInput
            value={parseBgShorthand(node.style?.background || "").color || ""}
            onChange={(v) => updateSectionBg({ color: v })}
          />

          <Labeled label="Background image" />
          <div className="be-row">
            <input
              ref={secBgFileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={onSecBgFile}
            />
            <button type="button" className="be-btn" onClick={pickSecBg}>
              Upload background…
            </button>
            {parseBgShorthand(node.style?.background || "").url && (
              <button
                type="button"
                className="be-btn danger"
                onClick={() => updateSectionBg({ url: "" })}
              >
                Remove
              </button>
            )}
          </div>
          {parseBgShorthand(node.style?.background || "").url && (
            <div style={{ marginTop: 8 }}>
              <img
                src={parseBgShorthand(node.style?.background || "").url}
                alt="Section background preview"
                style={{
                  width: "100%",
                  maxHeight: 140,
                  objectFit: "cover",
                  borderRadius: 8,
                }}
              />
            </div>
          )}
          <div className="be-help">
            Optional: paste a URL (we'll normalize it).
          </div>
          <Labeled label="Background image URL (optional)" />
          <TextInput
            value={parseBgShorthand(node.style?.background || "").url || ""}
            onChange={(v) => updateSectionBg({ url: stripCssUrl(v) })}
          />

          <Labeled label="Background size" />
          <select
            className="be-input"
            value={node.style?.bgSize || "cover"}
            onChange={(e) => updateSectionBg({ size: e.target.value })}
          >
            <option value="cover">cover</option>
            <option value="contain">contain</option>
            <option value="auto">auto</option>
          </select>

          <Labeled label="Background position" />
          <select
            className="be-input"
            value={node.style?.bgPosition || "center"}
            onChange={(e) => updateSectionBg({ position: e.target.value })}
          >
            <option>left</option>
            <option>center</option>
            <option>right</option>
            <option>top</option>
            <option>bottom</option>
          </select>

          <Labeled label="Max content width (px)" />
          <NumberInput
            value={node.style?.maxWidth || ""}
            onChange={(v) => patchStyle("maxWidth", v)}
          />

          <Labeled label="Center content" />
          <select
            className="be-input"
            value={node.style?.center ? "yes" : "no"}
            onChange={(e) => patchStyle("center", e.target.value === "yes")}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>

          <Labeled label="Padding (t r b l)" />
          <TextInput
            value={node.style?.padding || ""}
            onChange={(v) => patchStyle("padding", v)}
          />
          {padHelp}

          <Labeled label="Text align" />
          <select
            className="be-input"
            value={node.style?.textAlign || "left"}
            onChange={(e) => patchStyle("textAlign", e.target.value)}
          >
            <option>left</option>
            <option>center</option>
            <option>right</option>
          </select>
        </>
      )}

      {node.type === "columns" && (
        <>
          <Labeled label="Gap (px)" />
          <NumberInput
            value={node.gap ?? 16}
            onChange={(v) => update({ gap: Number(v || 0) })}
          />

          <Labeled label="Stack on mobile" />
          <select
            className="be-input"
            value={node.stackMobile ? "yes" : "no"}
            onChange={(e) => update({ stackMobile: e.target.value === "yes" })}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </>
      )}

      {node.type === "column" && (
        <>
          <Labeled label="Padding (t r b l)" />
          <TextInput
            value={node.style?.padding || ""}
            onChange={(v) => patchStyle("padding", v)}
          />
          {padHelp}
        </>
      )}

      {node.type === "heading" && (
        <>
          <Labeled label="Text" />
          <TextInput
            value={node.content || ""}
            onChange={(v) => update({ content: v })}
          />

          <Labeled label="Tag" />
          <select
            className="be-input"
            value={node.tag || "h2"}
            onChange={(e) => update({ tag: e.target.value })}
          >
            <option>h1</option>
            <option>h2</option>
            <option>h3</option>
            <option>h4</option>
          </select>

          <Labeled label="Text color" />
          <ColorInput
            value={node.style?.color || "#000000"}
            onChange={(v) => patchStyle("color", v)}
          />

          <Labeled label="Font size (px)" />
          <NumberInput
            value={node.style?.size || "24"}
            onChange={(v) => patchStyle("size", String(v || "24"))}
          />

          <Labeled label="Font weight" />
          <select
            className="be-input"
            value={node.style?.weight || "700"}
            onChange={(e) => patchStyle("weight", e.target.value)}
          >
            <option value="400">Regular</option>
            <option value="600">Semi-bold</option>
            <option value="700">Bold</option>
            <option value="800">Extra-bold</option>
          </select>

          <Labeled label="Line height" />
          <NumberInput
            value={node.style?.line || ""}
            onChange={(v) => patchStyle("line", v)}
          />

          <Labeled label="Align" />
          <select
            className="be-input"
            value={node.style?.align || "left"}
            onChange={(e) => patchStyle("align", e.target.value)}
          >
            <option>left</option>
            <option>center</option>
            <option>right</option>
          </select>

          <Labeled label="Background (chip)" />
          <ColorInput
            value={node.style?.bg || ""}
            onChange={(v) => patchStyle("bg", v)}
          />

          <Labeled label="Padding around text (t r b l)" />
          <TextInput
            value={node.style?.pad || ""}
            onChange={(v) => patchStyle("pad", v)}
          />
          {padHelp}

          <Labeled label="Corner radius (px)" />
          <NumberInput
            value={node.style?.radius || ""}
            onChange={(v) => patchStyle("radius", v)}
          />

          <Labeled label="Display as inline block" />
          <select
            className="be-input"
            value={node.style?.inline ? "yes" : "no"}
            onChange={(e) => patchStyle("inline", e.target.value === "yes")}
          >
            <option value="no">No (full line)</option>
            <option value="yes">Yes</option>
          </select>
        </>
      )}

      {node.type === "text" && (
        <>
          <Labeled label="HTML" />
          <textarea
            className="be-textarea"
            rows={10}
            value={node.html || ""}
            onChange={(e) => update({ html: e.target.value })}
          />

          <Labeled label="Text color" />
          <ColorInput
            value={node.style?.color || "#000000"}
            onChange={(v) => patchStyle("color", v)}
          />

          <Labeled label="Font size (px)" />
          <NumberInput
            value={node.style?.size || ""}
            onChange={(v) => patchStyle("size", v)}
          />

          <Labeled label="Line height" />
          <NumberInput
            value={node.style?.line || ""}
            onChange={(v) => patchStyle("line", v)}
          />

          <Labeled label="Align" />
          <select
            className="be-input"
            value={node.style?.align || "left"}
            onChange={(e) => patchStyle("align", e.target.value)}
          >
            <option>left</option>
            <option>center</option>
            <option>right</option>
          </select>

          <Labeled label="Background color" />
          <ColorInput
            value={node.style?.bg || ""}
            onChange={(v) => patchStyle("bg", v)}
          />

          <Labeled label="Padding (t r b l)" />
          <TextInput
            value={node.style?.pad || ""}
            onChange={(v) => patchStyle("pad", v)}
          />
          {padHelp}

          <Labeled label="Corner radius (px)" />
          <NumberInput
            value={node.style?.radius || ""}
            onChange={(v) => patchStyle("radius", v)}
          />
        </>
      )}

      {node.type === "image" && (
        <>
          <Labeled label="Image URL" />
          <TextInput
            value={node.url || ""}
            onChange={(v) => update({ url: v })}
          />

          <div className="be-row">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e, "url")}
            />
            <button type="button" className="be-btn" onClick={handlePick}>
              Upload image…
            </button>
          </div>

          <Labeled label="Alt text" />
          <TextInput
            value={node.alt || ""}
            onChange={(v) => update({ alt: v })}
          />

          <Labeled label="Width (e.g. 100%, 320px)" />
          <TextInput
            value={node.width || ""}
            onChange={(v) => update({ width: v })}
          />

          <Labeled label="Height (optional)" />
          <TextInput
            value={node.height || ""}
            onChange={(v) => update({ height: v })}
          />

          <Labeled label="Border radius (px)" />
          <NumberInput
            value={node.radius || ""}
            onChange={(v) => update({ radius: v })}
          />

          <Labeled label="Align" />
          <select
            className="be-input"
            value={node.align || "center"}
            onChange={(e) => update({ align: e.target.value })}
          >
            <option>left</option>
            <option>center</option>
            <option>right</option>
          </select>
        </>
      )}

      {node.type === "button" && (
        <>
          <Labeled label="Label" />
          <TextInput
            value={node.label || ""}
            onChange={(v) => update({ label: v })}
          />

          <Labeled label="URL" />
          <TextInput
            value={node.href || ""}
            onChange={(v) => update({ href: v })}
          />

          <Labeled label="Background" />
          <ColorInput
            value={node.bg || "#2563eb"}
            onChange={(v) => update({ bg: v })}
          />

          <Labeled label="Text color" />
          <ColorInput
            value={node.color || "#ffffff"}
            onChange={(v) => update({ color: v })}
          />

          <Labeled label="Radius (px)" />
          <NumberInput
            value={node.radius || "10"}
            onChange={(v) => update({ radius: String(v || "10") })}
          />

          <Labeled label="Size" />
          <select
            className="be-input"
            value={node.size || "md"}
            onChange={(e) => update({ size: e.target.value })}
          >
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </select>

          <Labeled label="Align" />
          <select
            className="be-input"
            value={node.align || "left"}
            onChange={(e) => update({ align: e.target.value })}
          >
            <option>left</option>
            <option>center</option>
            <option>right</option>
          </select>
        </>
      )}

      {node.type === "divider" && (
        <>
          <Labeled label="Color" />
          <ColorInput
            value={node.color || "#e2e8f0"}
            onChange={(v) => update({ color: v })}
          />

          <Labeled label="Thickness (px)" />
          <NumberInput
            value={node.thickness || "2"}
            onChange={(v) => update({ thickness: v })}
          />

          <Labeled label="Width (e.g. 100%, 320px)" />
          <TextInput
            value={node.width || "100%"}
            onChange={(v) => update({ width: v })}
          />

          <Labeled label="Align" />
          <select
            className="be-input"
            value={node.align || "center"}
            onChange={(e) => update({ align: e.target.value })}
          >
            <option>left</option>
            <option>center</option>
            <option>right</option>
          </select>

          <Labeled label="Margin (t r b l)" />
          <TextInput
            value={node.margin || ""}
            onChange={(v) => update({ margin: v })}
          />
          {padHelp}
        </>
      )}

      {node.type === "spacer" && (
        <>
          <Labeled label="Height (px)" />
          <NumberInput
            value={node.height || "24"}
            onChange={(v) => update({ height: v })}
          />
        </>
      )}

      {node.type === "icon" && (
        <>
          <Labeled label="Emoji" />
          <TextInput
            value={node.emoji || "⭐"}
            onChange={(v) => update({ emoji: v })}
          />

          <Labeled label="Size (px)" />
          <NumberInput
            value={node.size || "32"}
            onChange={(v) => update({ size: v })}
          />

          <Labeled label="Color" />
          <ColorInput
            value={node.color || "#0b1220"}
            onChange={(v) => update({ color: v })}
          />

          <Labeled label="Align" />
          <select
            className="be-input"
            value={node.align || "left"}
            onChange={(e) => update({ align: e.target.value })}
          >
            <option>left</option>
            <option>center</option>
            <option>right</option>
          </select>
        </>
      )}

      {node.type === "gallery" && (
        <>
          <Labeled label="Columns" />
          <NumberInput
            value={node.columns || 3}
            onChange={(v) => update({ columns: Number(v || 1) })}
          />

          <Labeled label="Gap (px)" />
          <NumberInput
            value={node.gap || 8}
            onChange={(v) => update({ gap: Number(v || 0) })}
          />

          <Labeled label="Corner radius (px)" />
          <NumberInput
            value={node.radius || 0}
            onChange={(v) => update({ radius: Number(v || 0) })}
          />

          <div className="be-subtitle">Images</div>
          {(node.images || []).map((img, i) => (
            <div key={img.id} className="be-card">
              <Labeled label={`Image ${i + 1} URL`} />
              <TextInput
                value={img.url || ""}
                onChange={(v) =>
                  update({
                    images: (node.images || []).map((x) =>
                      x.id === img.id ? { ...x, url: v } : x
                    ),
                  })
                }
              />
              <div className="be-row">
                <label className="be-btn" style={{ display: "inline-block" }}>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      let url = "";
                      if (typeof onUpload === "function")
                        url = await onUpload(file);
                      else {
                        url = await new Promise((res, rej) => {
                          const fr = new FileReader();
                          fr.onerror = rej;
                          fr.onload = () => res(String(fr.result || ""));
                          fr.readAsDataURL(file);
                        });
                      }
                      update({
                        images: (node.images || []).map((x) =>
                          x.id === img.id ? { ...x, url } : x
                        ),
                      });
                    }}
                  />
                  Upload image…
                </label>
                <button
                  type="button"
                  className="be-btn danger"
                  onClick={() =>
                    update({
                      images: (node.images || []).filter(
                        (x) => x.id !== img.id
                      ),
                    })
                  }
                >
                  Remove
                </button>
              </div>

              <Labeled label="Alt text" />
              <TextInput
                value={img.alt || ""}
                onChange={(v) =>
                  update({
                    images: (node.images || []).map((x) =>
                      x.id === img.id ? { ...x, alt: v } : x
                    ),
                  })
                }
              />
            </div>
          ))}

          <div className="be-row">
            <button
              className="be-btn"
              type="button"
              onClick={() =>
                update({
                  images: [
                    ...(node.images || []),
                    { id: key(), url: "", alt: "" },
                  ],
                })
              }
            >
              + Add image
            </button>
          </div>
        </>
      )}

      {node.type === "carousel" && (
        <>
          <Labeled label="Height (px, optional)" />
          <NumberInput
            value={node.height || ""}
            onChange={(v) => update({ height: v })}
          />

          <Labeled label="Corner radius (px)" />
          <NumberInput
            value={node.radius || 8}
            onChange={(v) => update({ radius: Number(v || 0) })}
          />

          <Labeled label="Show arrows" />
          <select
            className="be-input"
            value={node.showArrows ? "yes" : "no"}
            onChange={(e) => update({ showArrows: e.target.value === "yes" })}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>

          <div className="be-subtitle">Images</div>
          {(node.images || []).map((img, i) => (
            <div key={img.id} className="be-card">
              <Labeled label={`Image ${i + 1} URL`} />
              <TextInput
                value={img.url || ""}
                onChange={(v) =>
                  update({
                    images: (node.images || []).map((x) =>
                      x.id === img.id ? { ...x, url: v } : x
                    ),
                  })
                }
              />
              <div className="be-row">
                <label className="be-btn" style={{ display: "inline-block" }}>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      let url = "";
                      if (typeof onUpload === "function")
                        url = await onUpload(file);
                      else {
                        url = await new Promise((res, rej) => {
                          const fr = new FileReader();
                          fr.onerror = rej;
                          fr.onload = () => res(String(fr.result || ""));
                          fr.readAsDataURL(file);
                        });
                      }
                      update({
                        images: (node.images || []).map((x) =>
                          x.id === img.id ? { ...x, url } : x
                        ),
                      });
                    }}
                  />
                  Upload image…
                </label>
                <button
                  type="button"
                  className="be-btn danger"
                  onClick={() =>
                    update({
                      images: (node.images || []).filter(
                        (x) => x.id !== img.id
                      ),
                    })
                  }
                >
                  Remove
                </button>
              </div>

              <Labeled label="Alt text" />
              <TextInput
                value={img.alt || ""}
                onChange={(v) =>
                  update({
                    images: (node.images || []).map((x) =>
                      x.id === img.id ? { ...x, alt: v } : x
                    ),
                  })
                }
              />
            </div>
          ))}

          <div className="be-row">
            <button
              className="be-btn"
              type="button"
              onClick={() =>
                update({
                  images: [
                    ...(node.images || []),
                    { id: key(), url: "", alt: "" },
                  ],
                })
              }
            >
              + Add image
            </button>
          </div>
        </>
      )}

      {node.type === "accordion" && (
        <>
          <Labeled label="Corner radius (px)" />
          <NumberInput
            value={node.radius || 8}
            onChange={(v) => update({ radius: Number(v || 0) })}
          />

          <div className="be-subtitle">Items</div>
          {(node.items || []).map((it, i) => (
            <div key={it.id} className="be-card">
              <Labeled label={`Item ${i + 1} title`} />
              <TextInput
                value={it.title || ""}
                onChange={(v) =>
                  update({
                    items: (node.items || []).map((x) =>
                      x.id === it.id ? { ...x, title: v } : x
                    ),
                  })
                }
              />
              <Labeled label="HTML content" />
              <textarea
                className="be-textarea"
                rows={6}
                value={it.html || ""}
                onChange={(e) =>
                  update({
                    items: (node.items || []).map((x) =>
                      x.id === it.id ? { ...x, html: e.target.value } : x
                    ),
                  })
                }
              />
              <div className="be-row">
                <button
                  type="button"
                  className="be-btn danger"
                  onClick={() =>
                    update({
                      items: (node.items || []).filter((x) => x.id !== it.id),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div className="be-row">
            <button
              className="be-btn"
              type="button"
              onClick={() =>
                update({
                  items: [
                    ...(node.items || []),
                    { id: key(), title: "New item", html: "<p>…</p>" },
                  ],
                })
              }
            >
              + Add item
            </button>
          </div>
        </>
      )}

      {node.type === "tabs" && (
        <>
          <Labeled label="Corner radius (px)" />
          <NumberInput
            value={node.radius || 8}
            onChange={(v) => update({ radius: Number(v || 0) })}
          />

          <div className="be-subtitle">Tabs</div>
          {(node.items || []).map((it, i) => (
            <div key={it.id} className="be-card">
              <Labeled label={`Tab ${i + 1} label`} />
              <TextInput
                value={it.label || ""}
                onChange={(v) =>
                  update({
                    items: (node.items || []).map((x) =>
                      x.id === it.id ? { ...x, label: v } : x
                    ),
                  })
                }
              />
              <Labeled label="HTML content" />
              <textarea
                className="be-textarea"
                rows={6}
                value={it.html || ""}
                onChange={(e) =>
                  update({
                    items: (node.items || []).map((x) =>
                      x.id === it.id ? { ...x, html: e.target.value } : x
                    ),
                  })
                }
              />
              <div className="be-row">
                <button
                  type="button"
                  className="be-btn danger"
                  onClick={() =>
                    update({
                      items: (node.items || []).filter((x) => x.id !== it.id),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div className="be-row">
            <button
              className="be-btn"
              type="button"
              onClick={() =>
                update({
                  items: [
                    ...(node.items || []),
                    { id: key(), label: "New tab", html: "<p>…</p>" },
                  ],
                })
              }
            >
              + Add tab
            </button>
          </div>
        </>
      )}

      {node.type === "video" && (
        <>
          <Labeled label="Video URL (YouTube or MP4)" />
          <TextInput
            value={node.url || ""}
            onChange={(v) => update({ url: v })}
          />

          <Labeled label="Poster image URL (optional)" />
          <TextInput
            value={node.poster || ""}
            onChange={(v) => update({ poster: v })}
          />

          <Labeled label="Width (e.g. 100%, 640px)" />
          <TextInput
            value={node.width || "100%"}
            onChange={(v) => update({ width: v })}
          />

          <Labeled label="Height (px, optional)" />
          <NumberInput
            value={node.height || ""}
            onChange={(v) => update({ height: v })}
          />

          <Labeled label="Corner radius (px)" />
          <NumberInput
            value={node.radius || "8"}
            onChange={(v) => update({ radius: v })}
          />

          <div className="be-row">
            <label className="be-checkpair">
              <input
                type="checkbox"
                checked={!!node.controls}
                onChange={(e) => update({ controls: !!e.target.checked })}
              />
              <span>Controls</span>
            </label>
            <label className="be-checkpair">
              <input
                type="checkbox"
                checked={!!node.autoplay}
                onChange={(e) => update({ autoplay: !!e.target.checked })}
              />
              <span>Autoplay</span>
            </label>
            <label className="be-checkpair">
              <input
                type="checkbox"
                checked={!!node.loop}
                onChange={(e) => update({ loop: !!e.target.checked })}
              />
              <span>Loop</span>
            </label>
          </div>

          <Labeled label="Align" />
          <select
            className="be-input"
            value={node.align || "center"}
            onChange={(e) => update({ align: e.target.value })}
          >
            <option>left</option>
            <option>center</option>
            <option>right</option>
          </select>
        </>
      )}

      {node.type === "form" && (
        <>
          <Labeled label="Form action (optional)" />
          <TextInput
            value={node.action || ""}
            onChange={(v) => update({ action: v })}
          />

          <Labeled label="Method" />
          <select
            className="be-input"
            value={node.method || "POST"}
            onChange={(e) => update({ method: e.target.value })}
          >
            <option>POST</option>
            <option>GET</option>
          </select>

          <Labeled label="Submit button label" />
          <TextInput
            value={node.submitLabel || "Submit"}
            onChange={(v) => update({ submitLabel: v })}
          />

          <Labeled label="Form width (px, optional)" />
          <NumberInput
            value={node.width || ""}
            onChange={(v) => update({ width: v })}
          />

          <Labeled label="Gap (px)" />
          <NumberInput
            value={node.gap || 10}
            onChange={(v) => update({ gap: Number(v || 0) })}
          />

          <Labeled label="Align" />
          <select
            className="be-input"
            value={node.align || "left"}
            onChange={(e) => update({ align: e.target.value })}
          >
            <option>left</option>
            <option>center</option>
            <option>right</option>
          </select>

          <div className="be-subtitle">Fields</div>
          {(node.fields || []).map((f) => (
            <div key={f.id} className="be-card">
              <Labeled label="Type" />
              <select
                className="be-input"
                value={f.type || "text"}
                onChange={(e) =>
                  update({
                    fields: (node.fields || []).map((x) =>
                      x.id === f.id ? { ...x, type: e.target.value } : x
                    ),
                  })
                }
              >
                <option>text</option>
                <option>email</option>
                <option>tel</option>
                <option>number</option>
                <option>textarea</option>
                <option>select</option>
                <option>checkbox</option>
              </select>

              <Labeled label="Label" />
              <TextInput
                value={f.label || ""}
                onChange={(v) =>
                  update({
                    fields: (node.fields || []).map((x) =>
                      x.id === f.id ? { ...x, label: v } : x
                    ),
                  })
                }
              />

              <Labeled label="Name (form field name)" />
              <TextInput
                value={f.name || ""}
                onChange={(v) =>
                  update({
                    fields: (node.fields || []).map((x) =>
                      x.id === f.id ? { ...x, name: v } : x
                    ),
                  })
                }
              />

              <Labeled label="Placeholder / Options (comma for select)" />
              <TextInput
                value={f.placeholder || f.options || ""}
                onChange={(v) =>
                  update({
                    fields: (node.fields || []).map((x) =>
                      x.id === f.id ? { ...x, placeholder: v, options: v } : x
                    ),
                  })
                }
              />

              <Labeled label="Required" />
              <select
                className="be-input"
                value={f.required ? "yes" : "no"}
                onChange={(e) =>
                  update({
                    fields: (node.fields || []).map((x) =>
                      x.id === f.id
                        ? { ...x, required: e.target.value === "yes" }
                        : x
                    ),
                  })
                }
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>

              <div className="be-row">
                <button
                  type="button"
                  className="be-btn danger"
                  onClick={() =>
                    update({
                      fields: (node.fields || []).filter((x) => x.id !== f.id),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="be-row">
            <button
              className="be-btn"
              type="button"
              onClick={() =>
                update({
                  fields: [
                    ...(node.fields || []),
                    {
                      id: key(),
                      type: "text",
                      label: "New field",
                      name: "field_" + (node.fields?.length || 0),
                      placeholder: "",
                      required: false,
                    },
                  ],
                })
              }
            >
              + Add field
            </button>
          </div>
        </>
      )}

      {node.type === "live" && (
        <>
          <div className="be-help">Use either an embed URL or iframe HTML.</div>

          <Labeled label="Embed URL" />
          <TextInput
            value={node.url || ""}
            onChange={(v) => update({ url: v })}
          />

          <Labeled label="Custom iframe HTML" />
          <textarea
            className="be-textarea"
            rows={8}
            value={node.html || ""}
            onChange={(e) => update({ html: e.target.value })}
          />
        </>
      )}

      <div className="be-row">
        <button className="be-btn danger" onClick={onDelete}>
          Delete block
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------- editor ---------------------------------- */

export default function BlocksEditorV2({ value, onChange, onUpload }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const normalizedProp = useMemo(() => {
    const base =
      value && value.version === 2 ? clone(value) : migrateToV2(value);
    return sanitizeV2Doc(base);
  }, [value]);

  const [doc, setDoc] = useState(() => normalizedProp);
  const lastPropJsonRef = useRef(JSON.stringify(normalizedProp));

  useEffect(() => {
    const nowProp = JSON.stringify(normalizedProp);
    if (nowProp !== lastPropJsonRef.current) {
      lastPropJsonRef.current = nowProp;
      setDoc(normalizedProp);
    }
  }, [normalizedProp]);

  useEffect(() => {
    const nowDoc = JSON.stringify(doc);
    if (nowDoc !== lastPropJsonRef.current) {
      lastPropJsonRef.current = nowDoc;
      onChange?.(doc);
    }
  }, [doc, onChange]);

  const [selectedId, setSelectedId] = useState("");
  const selectedNode = useMemo(
    () => findNode(doc.root, selectedId),
    [doc, selectedId]
  );

  function handleDropInto(e, targetNode) {
    const type = e.dataTransfer.getData("application/x-widget");
    if (!type) return;
    if (!canDropInto(targetNode || "root", type)) return;

    setDoc((prev) => {
      const next = clone(prev);
      if (targetNode === "root") {
        next.root.push(DEFAULTS.section());
        return next;
      }
      const tn = findNode(next.root, targetNode.id);
      if (!tn) return prev;

      if (type === "columns") {
        tn.children = tn.children || [];
        tn.children.push(DEFAULTS.columns());
      } else if (WIDGETS.includes(type)) {
        if (tn.type === "section" || tn.type === "column") {
          tn.children = tn.children || [];
          tn.children.push(DEFAULTS[type]());
        }
      } else if (type === "column" && tn.type === "section") {
        tn.children = tn.children || [];
        tn.children.push(DEFAULTS.column());
      }
      return next;
    });
  }

  function moveWithin(container, activeId, overId) {
    const from = container.findIndex((x) => x.id === activeId);
    const to = container.findIndex((x) => x.id === overId);
    if (from < 0 || to < 0 || from === to) return container;
    return arrayMove(container, from, to);
  }

  function onDragEnd(event) {
    const { active, over } = event;
    if (!over || !active || active.id === over.id) return;

    setDoc((prev) => {
      const next = clone(prev);
      const src = findContainerAndIndex(next.root, active.id);
      const dst = findContainerAndIndex(next.root, over.id);

      if (src && dst && src.container === dst.container) {
        src.container.splice(
          0,
          src.container.length,
          ...moveWithin(src.container, active.id, over.id)
        );
        return next;
      }

      if (src) {
        const node = src.container[src.index];
        src.container.splice(src.index, 1);

        const overNode = findNode(next.root, over.id);
        if (overNode && canDropInto(overNode, node.type)) {
          if (overNode.type === "section" || overNode.type === "column") {
            overNode.children = overNode.children || [];
            overNode.children.push(node);
            return next;
          }
        }

        if (dst) {
          dst.container.push(node);
          return next;
        }

        // fallback: put it back
        src.container.splice(src.index, 0, node);
      }
      return next;
    });
  }

  function deleteSelected() {
    if (!selectedId) return;
    setDoc((prev) => {
      const next = clone(prev);
      const atRoot = next.root.findIndex((x) => x.id === selectedId);
      if (atRoot >= 0) {
        next.root.splice(atRoot, 1);
        return next;
      }
      const hit = findContainerAndIndex(next.root, selectedId);
      if (hit) hit.container.splice(hit.index, 1);
      return next;
    });
    setSelectedId("");
  }

  function updateSelected(nextNode) {
    setDoc((prev) => {
      const next = clone(prev);
      if (!nextNode?.id) return prev;
      const rIdx = next.root.findIndex((x) => x.id === nextNode.id);
      if (rIdx >= 0) {
        next.root[rIdx] = nextNode;
        return next;
      }
      const n = findNode(next.root, nextNode.id);
      if (!n) return prev;
      Object.assign(n, nextNode);
      return next;
    });
  }

  /* ---------------------------------- styles -------------------------------- */

  const style = `
.be-wrap { display:grid; grid-template-columns: 260px 1fr 340px; gap:14px; }
.be-panel, .be-canvas { background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:12px; }
.be-title { font-weight:800; margin-bottom:8px; }
.be-subtitle { font-weight:700; margin:10px 0 6px; }
.be-muted { color:#64748b; }
.be-help { color:#64748b; font-size:12px; margin:6px 0 10px; }
.be-input, .be-textarea, .be-btn { width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:8px 10px; font:inherit; background:#fff; }
.be-textarea { min-height:110px; }
.be-label { font-size:12px; color:#475569; margin-top:8px; display:block; }
.be-btn { font-weight:700; cursor:pointer; }
.be-btn.danger { background:#fee2e2; border-color:#fecaca; color:#7f1d1d; }
.be-btn-primary { background:#0f172a; color:#fff; border-color:#0f172a; }
.be-row { margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; }
.be-list { display:grid; gap:8px; }
.be-card { border:1px solid #e5e7eb; border-radius:10px; padding:8px; }
.be-chip { border:1px solid #e5e7eb; border-radius:10px; padding:8px 10px; cursor:grab; user-select:none; background:#fff; }
.be-canvas { padding:14px; }
.be-drop { border:1px dashed #cbd5e1; border-radius:12px; padding:12px; }
.be-section { margin:8px 0; }
.be-columns > div { min-height:40px; }
.be-section-inner { width:100%; }

/* drag handle */
.be-item { position:relative; }
.be-handle {
  position:absolute; top:-8px; left:-8px;
  width:20px; height:20px; border-radius:10px;
  background:#f3f4f6; border:1px solid #e5e7eb;
  display:flex; align-items:center; justify-content:center;
  font-size:10px; line-height:1;
  cursor:grab; user-select:none;
  opacity:0; pointer-events:none;
  transition:opacity .15s ease, transform .15s ease;
}
.be-item:hover .be-handle,
.be-item:focus-within .be-handle,
.be-item.be-selected .be-handle {
  opacity:1; pointer-events:auto; transform: translateY(-2px);
}
.be-handle:active { cursor:grabbing; }

/* selection ring only on content wrapper */
.be-node { padding:0; border-radius:12px; }
.be-selected .be-node { outline:2px solid #2563eb; outline-offset:2px; border-radius:12px; }

.be-empty { color:#94a3b8; padding:8px 0; }

/* responsive columns */
@media (max-width: 640px) {
  .be-columns.stack-sm { grid-template-columns: 1fr !important; }
}

/* carousel */
.be-carousel .be-car-btn {
  position:absolute; top:50%; transform: translateY(-50%);
  width:28px; height:28px; border-radius:14px; border:1px solid #e5e7eb; background:#fff;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; font-size:18px; line-height:1;
}
.be-carousel .be-car-btn.left { left:8px; }
.be-carousel .be-car-btn.right { right:8px; }

/* accordion */
.be-accordion { display:grid; gap:8px; }
.be-acc-item { border:1px solid #e5e7eb; overflow:hidden; }
.be-acc-title { width:100%; text-align:left; background:#f8fafc; border:0; padding:10px 12px; font-weight:700; display:flex; align-items:center; justify-content:space-between; cursor:pointer; }
.be-acc-body { padding:12px; background:#fff; border-top:1px solid #e5e7eb; }
.be-acc-icon { font-weight:700; }

/* tabs */
.be-tabs { }
.be-tablist { display:flex; gap:6px; flex-wrap:wrap; border-bottom:1px solid #e5e7eb; margin-bottom:8px; }
.be-tab { border:1px solid #e5e7eb; border-bottom:0; background:#f8fafc; padding:8px 10px; border-top-left-radius:8px; border-top-right-radius:8px; cursor:pointer; }
.be-tab.active { background:#fff; font-weight:700; }
.be-tabpanel { border:1px solid #e5e7eb; padding:12px; background:#fff; }

/* form */
.be-form { display:flex; flex-direction:column; }
.be-form-field { display:flex; flex-direction:column; gap:6px; }
.be-form-label { font-size:12px; color:#475569; font-weight:700; }
.be-checkbox { display:flex; align-items:center; gap:8px; }
.be-checkpair { display:flex; align-items:center; gap:6px; }
`.trim();

  function NodeCard({ node }) {
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          setSelectedId(node.id);
        }}
      >
        {node.type === "heading" && <HeadingView node={node} />}
        {node.type === "text" && <TextView node={node} />}
        {node.type === "image" && <ImageView node={node} />}
        {node.type === "button" && <ButtonView node={node} />}
        {node.type === "divider" && <DividerView node={node} />}
        {node.type === "spacer" && <SpacerView node={node} />}
        {node.type === "icon" && <IconView node={node} />}
        {node.type === "gallery" && <GalleryView node={node} />}
        {node.type === "carousel" && <CarouselView node={node} />}
        {node.type === "accordion" && <AccordionView node={node} />}
        {node.type === "tabs" && <TabsView node={node} />}
        {node.type === "video" && <VideoView node={node} />}
        {node.type === "form" && <FormView node={node} />}
        {node.type === "live" && <LiveView node={node} />}

        {node.type === "column" && (
          <ColumnView node={node} onDropIn={handleDropInto}>
            <SortableContext
              items={(node.children || []).map((c) => c.id)}
              strategy={rectSortingStrategy}
            >
              {(node.children || []).map((child) => (
                <SortableItem
                  key={child.id}
                  id={child.id}
                  selected={selectedId === child.id}
                  onClickNode={() => setSelectedId(child.id)}
                >
                  <NodeCard node={child} />
                </SortableItem>
              ))}
            </SortableContext>
          </ColumnView>
        )}

        {node.type === "columns" && (
          <ColumnsView node={node}>
            <SortableContext
              items={(node.columns || []).map((c) => c.id)}
              strategy={rectSortingStrategy}
            >
              {(node.columns || []).map((col) => (
                <SortableItem
                  key={col.id}
                  id={col.id}
                  selected={selectedId === col.id}
                  onClickNode={() => setSelectedId(col.id)}
                >
                  <ColumnView node={col} onDropIn={handleDropInto}>
                    <SortableContext
                      items={(col.children || []).map((c) => c.id)}
                      strategy={rectSortingStrategy}
                    >
                      {(col.children || []).map((child) => (
                        <SortableItem
                          key={child.id}
                          id={child.id}
                          selected={selectedId === child.id}
                          onClickNode={() => setSelectedId(child.id)}
                        >
                          <NodeCard node={child} />
                        </SortableItem>
                      ))}
                    </SortableContext>
                  </ColumnView>
                </SortableItem>
              ))}
            </SortableContext>
          </ColumnsView>
        )}

        {node.type === "section" && (
          <SectionView
            node={node}
            onDropIn={(e, target) => handleDropInto(e, target)}
          >
            <SortableContext
              items={(node.children || []).map((c) => c.id)}
              strategy={rectSortingStrategy}
            >
              {(node.children || []).map((child) => (
                <SortableItem
                  key={child.id}
                  id={child.id}
                  selected={selectedId === child.id}
                  onClickNode={() => setSelectedId(child.id)}
                >
                  <NodeCard node={child} />
                </SortableItem>
              ))}
            </SortableContext>
          </SectionView>
        )}
      </div>
    );
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: style }} />
      <div className="be-wrap">
        {/* Palette */}
        <div className="be-panel">
          <div className="be-title">Blocks</div>
          <div className="be-list">
            {PALETTE.map((p) => (
              <PaletteItem key={p.type} type={p.type} label={p.label} />
            ))}
          </div>
          <div className="be-help">
            Tip: Drag items around. Drop on a container (Section / Column) to
            move or insert.
          </div>
        </div>

        {/* Canvas */}
        <div className="be-canvas">
          <div
            className="be-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDropInto(e, "root")}
            style={{ marginBottom: 8 }}
          >
            {doc.root.length === 0 && (
              <div className="be-empty">
                Drag a Section here to get started.
              </div>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={doc.root.map((s) => s.id)}
                strategy={rectSortingStrategy}
              >
                {doc.root.map((sec) => (
                  <SortableItem
                    key={sec.id}
                    id={sec.id}
                    selected={selectedId === sec.id}
                    onClickNode={() => setSelectedId(sec.id)}
                  >
                    <NodeCard node={sec} />
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* Inspector */}
        <Inspector
          node={selectedNode}
          onChange={updateSelected}
          onDelete={deleteSelected}
          onUpload={onUpload}
        />
      </div>
    </div>
  );
}
