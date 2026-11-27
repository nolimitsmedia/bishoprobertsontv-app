// src/components/builder/canvasContext.js
//
// Visual editor (Stage 1): true only inside the editor's visual canvas.
// Renderers use it to add invisible section/block markers so a click on the
// page can be traced to the section or block to edit. On the public site the
// value is false and nothing is added, so the public HTML is unchanged.

import React, { createContext, useContext } from "react";

// The page being shown (id, slug), for elements that need it (e.g. Form).
export const PageContext = createContext(null);

export const CanvasContext = createContext(false);

export function useCanvas() {
  return useContext(CanvasContext);
}

// Visual editor (Stage 3): optional space above/below a block, from
// styles.margin_top / styles.margin_bottom (0-160 px). Blocks without these
// settings render exactly as before.
function blockSpacing(styles) {
  const st = styles && typeof styles === "object" ? styles : {};
  const px = (v) => {
    const n = Number.parseFloat(String(v ?? ""));
    return Number.isFinite(n) && n > 0 ? Math.min(160, Math.round(n)) : 0;
  };
  const top = px(st.margin_top);
  const bottom = px(st.margin_bottom);
  return top || bottom
    ? { marginTop: top || undefined, marginBottom: bottom || undefined }
    : null;
}

// A color from the Style panels: #rrggbb, or a linked global color
// (Site Settings › Global colors) stored as var(--bx-gc-<name>).
export function colorValue(v) {
  const s = String(v || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^var\(--bx-gc-[a-z0-9-]{1,40}\)$/.test(s)) return s;
  return null;
}

// Element style (Style panel) for blocks that have no styling of their own
// (Text and Button style themselves). Only safe, bounded values are used.
const FONT_STACKS = {
  Arial: "Arial, sans-serif",
  Georgia: "Georgia, serif",
  Montserrat: "Montserrat, sans-serif",
  Poppins: "Poppins, sans-serif",
  Inter: "Inter, sans-serif",
  Roboto: "Roboto, sans-serif",
  "Open Sans": "'Open Sans', sans-serif",
  Lato: "Lato, sans-serif",
  "Playfair Display": "'Playfair Display', serif",
  Merriweather: "Merriweather, serif",
};
const SELF_STYLED = new Set(["richtext", "button"]);
function elementStyle(type, styles) {
  if (SELF_STYLED.has(String(type || "richtext"))) return null;
  const st = styles && typeof styles === "object" ? styles : {};
  const out = {};
  const num = (v, lo, hi) => {
    const n = Number.parseFloat(String(v ?? ""));
    return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
  };
  const hex = (v) => colorValue(v);
  if (FONT_STACKS[st.font_family]) out.fontFamily = FONT_STACKS[st.font_family];
  const size = num(st.font_size, 10, 72);
  if (size) out.fontSize = `${size}px`;
  if (
    ["400", "500", "600", "700", "800"].includes(String(st.font_weight || ""))
  )
    out.fontWeight = Number(st.font_weight);
  if (hex(st.text_color)) out.color = hex(st.text_color);
  if (["left", "center", "right"].includes(st.align)) out.textAlign = st.align;
  if (hex(st.bg_color)) out.backgroundColor = hex(st.bg_color);
  const pad = num(st.padding_px, 0, 80);
  if (pad) out.padding = `${pad}px`;
  const r = num(st.radius_px, 0, 40);
  if (r) out.borderRadius = `${r}px`;
  return Object.keys(out).length ? out : null;
}

// Wraps one block. In the editor canvas it carries an invisible marker
// (display: contents keeps layout identical). Space above/below and element
// style, if set, are applied in both the canvas and the public site.
// Responsive visibility (Advanced tab): hide on desktop / tablet / phone.
export function visibilityClasses(styles) {
  const st = styles && typeof styles === "object" ? styles : {};
  return [
    st.hide_desktop && "bx-hide-d",
    st.hide_tablet && "bx-hide-t",
    st.hide_mobile && "bx-hide-m",
  ]
    .filter(Boolean)
    .join(" ");
}

// Advanced › Attributes: CSS ID and classes (letters, digits, - and _ only).
const CSS_NAME = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
export function cssAttrs(styles) {
  const st = styles && typeof styles === "object" ? styles : {};
  const id = CSS_NAME.test(String(st.css_id || "").trim())
    ? String(st.css_id).trim()
    : "";
  const classes = String(st.css_class || "")
    .split(/\s+/)
    .filter((c) => CSS_NAME.test(c))
    .slice(0, 10)
    .join(" ");
  return { id, classes };
}

// Release 1.3 effects: entrance animation, hover effect, shadow, border and
// gradient background — for every element type (on its wrapper).
export function effectProps(styles) {
  const st = styles && typeof styles === "object" ? styles : {};
  const cls = [];
  const style = {};
  const num = (v, lo, hi) => {
    const n = Number.parseFloat(String(v ?? ""));
    return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
  };
  if (["fade", "slide-up", "slide-left", "zoom"].includes(st.anim)) {
    cls.push("bx-anim", `bx-anim--${st.anim}`);
    const dur = num(st.anim_duration, 200, 2000);
    const delay = num(st.anim_delay, 0, 2000);
    if (dur != null) style["--bx-anim-dur"] = `${dur}ms`;
    if (delay != null) style["--bx-anim-delay"] = `${delay}ms`;
  }
  if (["grow", "lift", "glow"].includes(st.hover))
    cls.push(`bx-hover--${st.hover}`);
  if (st.shadow === "soft") style.boxShadow = "0 8px 24px rgba(0,0,0,.28)";
  if (st.shadow === "strong") style.boxShadow = "0 18px 48px rgba(0,0,0,.5)";
  const bw = num(st.border_w, 1, 12);
  if (bw != null) {
    const bstyle = ["solid", "dashed", "dotted"].includes(st.border_style)
      ? st.border_style
      : "solid";
    style.border = `${bw}px ${bstyle} ${colorValue(st.border_color) || "currentColor"}`;
  }
  const g1 = colorValue(st.grad_from);
  const g2 = colorValue(st.grad_to);
  if (g1 && g2)
    style.backgroundImage = `linear-gradient(${num(st.grad_angle, 0, 360) ?? 135}deg, ${g1}, ${g2})`;
  return cls.length || Object.keys(style).length
    ? { cls: cls.join(" "), style }
    : null;
}

export function CanvasBlock({ blockId, spacing, type, children }) {
  const canvas = useContext(CanvasContext);
  const margins = blockSpacing(spacing);
  const look = elementStyle(type, spacing);
  const vis = visibilityClasses(spacing);
  const { id: cssId, classes } = cssAttrs(spacing);
  const device = hasDeviceStyles(spacing);
  const fx = effectProps(spacing);
  const boxed =
    margins || look || vis || cssId || classes || device || fx
      ? {
          display: "block",
          ...(margins || {}),
          ...(look || {}),
          ...(fx?.style || {}),
        }
      : null;
  const cls = [vis, classes, fx?.cls].filter(Boolean).join(" ");
  if (!canvas || !blockId) {
    if (!boxed) return children ?? null;
    return (
      <div
        id={cssId || undefined}
        className={`builder-blockSpacing ${cls}`.trim()}
        style={boxed}
        data-bx-id={device ? String(blockId) : undefined}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      data-bx-block={String(blockId)}
      data-bx-id={device ? String(blockId) : undefined}
      id={cssId || undefined}
      className={cls || undefined}
      style={boxed || { display: "contents" }}
    >
      {children}
    </div>
  );
}

// A hint for an element that has no content yet (editor canvas only), so it
// can be seen and clicked.
export function CanvasHint({ label }) {
  const canvas = useContext(CanvasContext);
  if (!canvas) return null;
  return (
    <div
      className="builder-canvasHint"
      style={{
        padding: "18px 14px",
        border: "2px dashed rgba(167, 139, 250, 0.55)",
        borderRadius: 10,
        textAlign: "center",
        color: "rgba(255, 255, 255, 0.7)",
        font: "600 14px/1.45 system-ui, sans-serif",
      }}
    >
      {label}
    </div>
  );
}

// Marks one column of a Columns block in the editor canvas.
export function CanvasColumn({ colId, children }) {
  const canvas = useContext(CanvasContext);
  if (!canvas || !colId) return children ?? null;
  return (
    <div data-bx-column={String(colId)} style={{ display: "contents" }}>
      {children}
    </div>
  );
}

// Placeholder for an empty section, shown only in the editor canvas.
export function CanvasEmptySection({ label }) {
  const canvas = useContext(CanvasContext);
  if (!canvas) return null;
  return (
    <div
      className="builder-emptyPlaceholder"
      style={{
        padding: "28px 16px",
        border: "2px dashed rgba(167, 139, 250, 0.6)",
        borderRadius: 12,
        textAlign: "center",
        color: "rgba(255, 255, 255, 0.75)",
        font: "600 15px/1.5 system-ui, sans-serif",
      }}
    >
      {label || "This section is empty. Select it and use “+ Add block”."}
    </div>
  );
}

// Wraps one section (used by the Home page for its built-in parts). With a
// blockId, a click anywhere in the part selects its block (its content).
export function CanvasSection({ sectionId, blockId, children }) {
  const canvas = useContext(CanvasContext);
  if (!canvas || !sectionId) return children ?? null;
  return (
    <div data-bx-section={String(sectionId)}>
      {blockId ? (
        <div data-bx-block={String(blockId)} style={{ display: "contents" }}>
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// One editable text inside a Home built-in part (double-click to type).
export function CanvasField({ name, children }) {
  const canvas = useContext(CanvasContext);
  if (!canvas || !name) return children ?? null;
  return <span data-bx-field={String(name)}>{children}</span>;
}

// ---- Release 1.2: styles per device (Tablet / Mobile), like Elementor ----
// block.styles.tablet / block.styles.mobile (and the same on sections) hold
// overrides; they become media-query rules keyed to data-bx-id / data-bx-sid.
// Phones inherit tablet settings (the phone rule comes later in the CSS).
export const DEVICE_MEDIA = {
  tablet: "(max-width: 1024px)",
  mobile: "(max-width: 767px)",
};
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

export function hasDeviceStyles(styles) {
  const st = styles && typeof styles === "object" ? styles : {};
  return ["tablet", "mobile"].some(
    (d) => st[d] && typeof st[d] === "object" && Object.keys(st[d]).length,
  );
}

function px(v, lo, hi) {
  const n = Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n >= lo && n <= hi ? `${n}px` : null;
}

// Declarations for one device's overrides of an element.
function elementDecls(o, type) {
  const wrap = [];
  const text = [];
  const btn = [];
  const t = String(type || "richtext");
  const push = (list, prop, val) =>
    val != null && val !== "" && list.push(`${prop}:${val} !important`);
  push(wrap, "margin-top", px(o.margin_top, 0, 400));
  push(wrap, "margin-bottom", px(o.margin_bottom, 0, 400));
  const size = px(o.font_size, 10, 96);
  const fam = FONT_STACKS[o.font_family] || null;
  const weight = ["400", "500", "600", "700", "800"].includes(
    String(o.font_weight || ""),
  )
    ? String(o.font_weight)
    : null;
  const color = colorValue(o.text_color);
  const align = ["left", "center", "right"].includes(o.align) ? o.align : null;
  const bg = colorValue(o.bg_color);
  const pad = px(o.padding_px, 0, 120);
  const rad = px(o.radius_px, 0, 60);
  if (t === "button") {
    [
      ["font-size", size],
      ["font-family", fam],
      ["font-weight", weight],
      ["color", color],
      ["background-color", bg],
      ["padding", pad],
      ["border-radius", rad],
    ].forEach(([p, v]) => push(btn, p, v));
    if (align) push(wrap, "text-align", align);
  } else {
    [
      ["font-family", fam],
      ["font-weight", weight],
      ["color", color],
      ["text-align", align],
      ["background-color", bg],
      ["padding", pad],
      ["border-radius", rad],
    ].forEach(([p, v]) => push(wrap, p, v));
    push(wrap, "font-size", size);
    if (t === "richtext")
      [
        ["font-size", size],
        ["font-family", fam],
        ["color", color],
        ["text-align", align],
      ].forEach(([p, v]) => push(text, p, v));
    if (t === "heading") push(text, "font-size", size);
  }
  return { wrap, text, btn };
}

export function blockDeviceCss(blockId, styles, type) {
  if (!SAFE_ID.test(String(blockId || "")) || !hasDeviceStyles(styles))
    return "";
  const sel = `[data-bx-id="${blockId}"]`;
  let css = "";
  ["tablet", "mobile"].forEach((d) => {
    const o = styles[d];
    if (!o || typeof o !== "object") return;
    const { wrap, text, btn } = elementDecls(o, type);
    let rules = "";
    if (wrap.length) rules += `${sel}{${wrap.join(";")}}`;
    if (text.length)
      rules += `${sel} .builder-richtext,${sel} .bx-heading{${text.join(";")}}`;
    if (btn.length) rules += `${sel} .builder-buttonWrap>*{${btn.join(";")}}`;
    if (rules) css += `@media ${DEVICE_MEDIA[d]}{${rules}}`;
  });
  return css;
}

// Sections: padding (inner box) and margins (outer box) per device.
function spacingString(v) {
  const parts = String(v || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length || parts.length > 4) return null;
  return parts.every((x) => /^\d{1,3}(\.\d+)?px$|^0$/.test(x))
    ? parts.join(" ")
    : null;
}
export function sectionDeviceCss(sectionId, st) {
  if (!SAFE_ID.test(String(sectionId || "")) || !hasDeviceStyles(st)) return "";
  const sel = `[data-bx-sid="${sectionId}"]`;
  let css = "";
  ["tablet", "mobile"].forEach((d) => {
    const o = st[d];
    if (!o || typeof o !== "object") return;
    let rules = "";
    const pad = spacingString(o.padding);
    const mar = spacingString(o.margin);
    if (mar) rules += `${sel}{margin:${mar} !important}`;
    if (pad) rules += `${sel}>div{padding:${pad} !important}`;
    if (rules) css += `@media ${DEVICE_MEDIA[d]}{${rules}}`;
  });
  return css;
}

// Every element's per-device CSS in a block list (including inside containers).
export function blocksDeviceCss(blocks) {
  let css = "";
  (Array.isArray(blocks) ? blocks : []).forEach((b) => {
    css += blockDeviceCss(b?.id, b?.styles, b?.type);
    // Only Columns/Container blocks hold a LIST of columns; other blocks (e.g.
    // Cards) use "columns" as a number — that crashed pages like About.
    if (Array.isArray(b?.columns))
      b.columns.forEach((c) => {
        css += blocksDeviceCss(c?.blocks);
      });
  });
  return css;
}
