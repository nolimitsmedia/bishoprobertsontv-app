// src/pages/admin/AdminPageEditor.js
import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../api";
import sanitizeHtml from "../../utils/sanitizeHtml";
import MediaPickerModal, {
  MediaPickerContext,
} from "../../components/media/MediaPicker";
import { registerUploadedImage, mediaSrc } from "../../lib/mediaApi";
import { SITE } from "../../config/site";
import {
  BlockSpacing,
  CssAttributes,
  ElementEffects,
  ElementStyle,
  MotionEffects,
  ResponsiveVisibility,
  SectionDesign,
} from "../../components/builder/designControls";
import {
  CardsEditor,
  GalleryImagesEditor,
} from "../../components/builder/collectionEditors";
import { STARTER_PAGES } from "../../components/builder/starterTemplates";
import { appUrl } from "../../lib/appUrl";
import {
  HOME_BLOCK_FIELDS,
  HomeBlockEditor,
  isTypableHomeField,
} from "../../components/builder/homeBlockFields";
import {
  EXTRA_BLOCK_TYPES,
  EXTRA_PALETTE,
  ExtraBlockEditor,
  ExtraBlockPublic,
  defaultExtraBlock,
} from "../../components/builder/extraBlocks";
import ModernPageEditor from "../../components/editor/ModernPageEditor";
import "./AdminPages.css";
// This site's own pictures (public/content/); old addresses repointed.
import { contentUrl, upgradeAssets } from "../../lib/siteContent";
import { promptDialog } from "../../components/ui/Dialogs";
import {
  STORY_LABELS,
  STORY_PANEL,
} from "../../components/builder/storyBlocks";

const AboutImg1 = contentUrl("leader.png");
const AboutImg2 = contentUrl("about-2.jpg");
const AboutImg3 = contentUrl("about-3.jpg");

/* -----------------------------
   utils
----------------------------- */
function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function pickErr(e, fallback = "Something went wrong") {
  return (
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.message ||
    fallback
  );
}

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isTwoColsLayout(layout) {
  // Accept legacy/label values (e.g. "Two Columns") and stored keys (e.g. "two_columns", "twoCols", "two_cols").
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

  // Normalize: remove non-alphanumerics (spaces/underscores/hyphens)
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

// "Save as template": a button that opens a small name field.
function SaveTemplateBox({ label, onSave }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fid = React.useId();
  if (!open)
    return (
      <button
        type="button"
        className="ap-btn ap-tplSaveBtn"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
    );
  return (
    <form
      className="ap-tplSave"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr("");
        try {
          await onSave(name);
          setOpen(false);
          setName("");
        } catch (x) {
          setErr(x?.message || "Could not save");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor={fid}>Template name</label>
      <input
        id={fid}
        className="ap-input"
        value={name}
        maxLength={120}
        autoFocus
        onChange={(e) => setName(e.target.value)}
      />
      {err ? (
        <p className="ap-help" role="alert">
          {err}
        </p>
      ) : null}
      <div className="bx-row">
        <button
          type="submit"
          className="ap-btn ap-btnPrimary"
          disabled={busy || !name.trim()}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="ap-btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// Release 1.2: what a device shows = Desktop values, then Tablet, then (for
// phones) Mobile overrides; empty override values mean "inherit".
function deviceView(styles, device) {
  const st = styles && typeof styles === "object" ? styles : {};
  const pick = (o) =>
    Object.fromEntries(
      Object.entries(o && typeof o === "object" ? o : {}).filter(
        ([, v]) => v !== "" && v != null,
      ),
    );
  return {
    ...st,
    ...pick(st.tablet),
    ...(device === "mobile" ? pick(st.mobile) : {}),
  };
}

function DeviceBanner({ device, section = false, hasOverrides, onReset }) {
  const name = device === "mobile" ? "Mobile" : "Tablet";
  return (
    <div className="ap-deviceBanner" role="status">
      <span aria-hidden="true">{device === "mobile" ? "📱" : "▭"}</span>
      <span>
        Editing <strong>{name}</strong> {section ? "spacing" : "styles"}:
        changes apply to {device === "mobile" ? "phones" : "tablets and phones"}{" "}
        only. Everything else follows Desktop.
      </span>
      {hasOverrides ? (
        <button type="button" className="ap-btn" onClick={onReset}>
          Reset {name}
        </button>
      ) : null}
    </div>
  );
}

// Nested containers: read / update the node at a path [colId, blockId, ...]
// from a top-level Columns/Container block.
function treeGet(block, path) {
  let node = block;
  for (let i = 0; i < path.length && node; i++) {
    const id = String(path[i]);
    node =
      i % 2 === 0
        ? (Array.isArray(node.columns) ? node.columns : []).find(
            (c) => String(c?.id) === id,
          ) || null
        : (Array.isArray(node.blocks) ? node.blocks : []).find(
            (b) => String(b?.id) === id,
          ) || null;
  }
  return node;
}
function treeUpdate(block, path, fn) {
  if (!path.length) return fn(block);
  const [colId, ...rest] = path;
  return {
    ...block,
    columns: (Array.isArray(block.columns) ? block.columns : []).map((c) => {
      if (String(c?.id) !== String(colId)) return c;
      if (!rest.length) return fn(c);
      const [bid, ...rest2] = rest;
      return {
        ...c,
        blocks: (Array.isArray(c.blocks) ? c.blocks : []).map((b) =>
          String(b?.id) === String(bid) ? treeUpdate(b, rest2, fn) : b,
        ),
      };
    }),
  };
}

// Display name of a block (a Container is a one-column Columns block).
function blockLabel(block) {
  if (block?.type === "columns" && block?.variant === "container")
    return "Container";
  return blockTypeLabel(block?.type);
}

// Short, readable description of a block for lists ("Text: Welcome to…").
function blockSnippet(block) {
  const b = block && typeof block === "object" ? block : {};
  const raw =
    b.type === "richtext" || !b.type
      ? String(b.html || "").replace(/<[^>]*>/g, " ")
      : String(b.text || b.title || b.name || b.q || b.url || b.kicker || "");
  const t = raw.replace(/\s+/g, " ").trim();
  return t.length > 28 ? `${t.slice(0, 28)}…` : t;
}

// Phase 6: per-page search & sharing settings, kept together as one value.
// normalizeSeo takes the editor's own { title, description, image, noindex }.
function normalizeSeo(v) {
  const o = v && typeof v === "object" ? v : {};
  return {
    title: String(o.title ?? "").slice(0, 120),
    description: String(o.description ?? "").slice(0, 320),
    image: String(o.image ?? ""),
    noindex: o.noindex === true,
  };
}
// seoFromPage reads a page record from the API (seo_* columns only; a page's
// own "title" is the page title, never the search title).
function seoFromPage(p) {
  const o = p && typeof p === "object" ? p : {};
  return normalizeSeo({
    title: o.seo_title ?? "",
    description: o.seo_description ?? "",
    image: o.seo_image_url ?? "",
    noindex: o.seo_noindex === true || o.seo_noindex === "true",
  });
}

// Phase 4E-2: plain-language names for block types shown in the editor.
const BLOCK_TYPE_LABELS = {
  richtext: "Text",
  gallery: "Gallery",
  grid: "Cards",
  columns: "Columns",
  button: "Button",
  hero: "Hero",
  home_hero: "Home hero",
  home_join: "Join strip",
  home_cta: "Call to action",
  home_about: "About",
  featured_live: "Featured live",
  latest_teaching: "Latest teaching",
  // Phase 5
  video: "Video",
  spacer: "Spacer",
  quote: "Quote",
  faq: "FAQ",
  heading: "Heading",
  image: "Image",
  divider: "Divider",
  videos: "Video gallery",
  form: "Form",
  icon: "Icon",
  iconlist: "Icon list",
  slider: "Image slider",
  testimonials: "Testimonials",
  countdown: "Countdown",
  map: "Google Map",
  social: "Social icons",
  embed: "Embed",
  ...STORY_LABELS,
};
function blockTypeLabel(type) {
  const t = String(type || "richtext");
  return BLOCK_TYPE_LABELS[t] || t;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* -----------------------------
   Phase 4G-C3: one shared way to copy builder content.
   Deep-clones a section, block or any nested value and gives every object
   that has an "id" a brand-new one. Used by template insertion, section and
   block duplication, and saved-section insertion, so every copy is fully
   independent of its source (no shared React keys, selection or edits).
----------------------------- */
function cloneWithFreshIds(value) {
  if (value === undefined) return undefined;
  const copy = JSON.parse(JSON.stringify(value));
  const renew = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(renew);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(node, "id")) node.id = uid();
    Object.values(node).forEach(renew);
  };
  renew(copy);
  return copy;
}
/* -----------------------------
   stable stringify for dirty-check
----------------------------- */
function stableStringify(value) {
  const seen = new WeakSet();
  const sorter = (v) => {
    if (!v || typeof v !== "object") return v;
    if (seen.has(v)) return null;
    seen.add(v);
    if (Array.isArray(v)) return v.map(sorter);
    const out = {};
    Object.keys(v)
      .sort()
      .forEach((k) => {
        out[k] = sorter(v[k]);
      });
    return out;
  };
  try {
    return JSON.stringify(sorter(value));
  } catch (_e) {
    try {
      return JSON.stringify(value);
    } catch (_e2) {
      return String(value);
    }
  }
}

/* Helper for hero preview */
function absUrl(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  const base = (api?.defaults?.baseURL || "").replace(/\/api\/?$/i, "");
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}

function clampNum(n, min, max) {
  const v = Number(n);
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function clamp(n, min, max) {
  n = Number(n) || 0;
  return Math.max(min, Math.min(max, n));
}

/* -----------------------------
   seed templates -> blocks
   Used to convert legacy About.js into editable builder blocks
----------------------------- */
function seedBlocksForSlug(slug) {
  const s = String(slug || "")
    .toLowerCase()
    .trim();

  if (s === "about") {
    const aboutHtml = `
      <h1>[Pastor's full name]</h1>
      <p>[Introduce your pastor: their role, the church they lead and where, and how long they have served.]</p>
      <p>[Their calling and story — what God has placed on their heart for this ministry.]</p>
      <p>[Books, missions or other work they are known for.]</p>
      <p>[Family, if they would like to share it.]</p>
    `;

    return [
      {
        title: "About",
        layout: "full",
        theme: "default",
        style: {
          alignment: "center",
          max_width: "1180px",
          padding: "40px 24px",
        },
        blocks: [
          {
            type: "gallery",
            cols: 1,
            gap: 18,
            items: [
              { url: AboutImg1, alt: "" },
              { url: AboutImg2, alt: "" },
              { url: AboutImg3, alt: "" },
            ],
          },
          { type: "richtext", html: aboutHtml },
        ],
      },
    ];
  }

  return null;
}

/* Phase 4D: inspector-only visual styling; retains existing block data shape. */
const AP_FONT_CHOICES = [
  "Inherit website font",
  "Arial",
  "Georgia",
  "Montserrat",
  "Poppins",
  "Lato",
  "Roboto",
  "Open Sans",
  "Inter",
  "Nunito",
  "Oswald",
  "Raleway",
  "Merriweather",
  "Playfair Display",
  "Source Sans 3",
  "DM Sans",
  "Libre Baskerville",
  "Work Sans",
  "Ubuntu",
  "Rubik",
];
const AP_SWATCHES = [
  "#FFFFFF",
  "#000000",
  "#111827",
  "#374151",
  "#6B7280",
  "#9CA3AF",
  "#EF4444",
  "#F97316",
  "#FD9D00",
  "#FACC15",
  "#22C55E",
  "#14B8A6",
  "#06B6D4",
  "#136AFE",
  "#2CC8FF",
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
];
function APColorField({ label, value, fallback, onChange }) {
  const raw = String(value || "");
  const valid = /^#[0-9a-f]{6}$/i.test(raw);
  return (
    <div className="ap-visualColorField">
      <label>{label}</label>
      <div className="ap-visualColorRow">
        <input
          type="color"
          aria-label={`${label} color picker`}
          value={valid ? raw : fallback}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          className="ap-input"
          aria-label={`${label} CSS value`}
          value={raw}
          placeholder="Inherit / CSS color"
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          className="ap-btn"
          type="button"
          title="Use default color"
          onClick={() => onChange("")}
        >
          Reset
        </button>
      </div>
      <div className="ap-visualSwatches" aria-label={`${label} palette`}>
        {AP_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={`Set ${label} to ${color}`}
            className={
              raw.toLowerCase() === color.toLowerCase() ? "is-selected" : ""
            }
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    </div>
  );
}
function APButtonVisualInspector({ block, onPatch }) {
  const styles = isObj(block.styles) ? block.styles : {};
  const patch = (key, value) =>
    onPatch({ styles: { ...styles, [key]: value } });
  const size = clampNum(parseInt(styles.font_size, 10) || 16, 8, 72);
  const font = String(styles.font_family || "");
  const bg = styles.bg_color || "#FD9D00";
  const fg = styles.text_color || "#0b0d12";
  return (
    <div className="ap-buttonVisualInspector" data-pane="style">
      <h4>Visual button styling</h4>
      <p className="ap-help">
        Adjust this button without changing the website-wide design settings.
      </p>
      <label htmlFor="ap-button-visual-font">Font family</label>
      <select
        id="ap-button-visual-font"
        className="ap-input"
        value={font}
        onChange={(e) => patch("font_family", e.target.value)}
      >
        {AP_FONT_CHOICES.map((name) => (
          <option
            key={name}
            value={name === "Inherit website font" ? "" : name}
          >
            {name}
          </option>
        ))}
      </select>
      <label>Font size</label>
      <div className="ap-fontStepper">
        <button
          type="button"
          aria-label="Decrease font size"
          onClick={() => patch("font_size", `${Math.max(8, size - 1)}px`)}
        >
          −
        </button>
        <input
          aria-label="Font size in pixels"
          type="number"
          min="8"
          max="72"
          value={size}
          onChange={(e) =>
            patch("font_size", `${clampNum(e.target.value, 8, 72)}px`)
          }
        />
        <span>px</span>
        <button
          type="button"
          aria-label="Increase font size"
          onClick={() => patch("font_size", `${Math.min(72, size + 1)}px`)}
        >
          +
        </button>
        <button
          type="button"
          className="ap-fontReset"
          onClick={() => patch("font_size", "")}
        >
          Reset
        </button>
      </div>
      <APColorField
        label="Background color"
        value={styles.bg_color}
        fallback="#FD9D00"
        onChange={(v) => patch("bg_color", v)}
      />
      <APColorField
        label="Text color"
        value={styles.text_color}
        fallback="#0B0D12"
        onChange={(v) => patch("text_color", v)}
      />
      <APColorField
        label="Border color"
        value={styles.border_color}
        fallback="#8B5CF6"
        onChange={(v) => patch("border_color", v)}
      />
      <div className="ap-buttonPreviewBox">
        <span>Live styling preview</span>
        <span
          className="ap-buttonPreviewSample"
          style={{
            backgroundColor: bg,
            color: fg,
            fontFamily: font || "inherit",
            fontSize: `${size}px`,
            padding: styles.padding || "12px 16px",
            borderRadius: `${Number(styles.radius ?? 14)}px`,
            border: `${Number(styles.border_width ?? 1)}px solid ${styles.border_color || "transparent"}`,
          }}
        >
          {block.text || "Button preview"}
        </span>
      </div>
      <p className="ap-help">
        Google Fonts require an internet connection. The published website must
        support the saved font_family and font_size style keys to display these
        overrides.
      </p>
    </div>
  );
}

/* Phase 4F-D: one active inline editor, section headings and formatted text. */
function APInlineCanvasBlock({
  block,
  type,
  selected,
  onSelect,
  onPatch,
  children,
  active,
  requestEdit,
  closeEdit,
}) {
  const editing = active;
  const [buttonText, setButtonText] = useState(String(block.text || ""));
  const richRef = useRef(null);
  const originalRef = useRef("");
  const inputRef = useRef(null);
  useEffect(() => {
    if (!editing) setButtonText(String(block.text || ""));
  }, [block.text, editing]);
  useEffect(() => {
    if (editing && type === "button") inputRef.current?.focus();
  }, [editing, type]);
  const start = () => {
    if (type !== "richtext" && type !== "button") return;
    onSelect();
    originalRef.current = String(block.html || "");
    setButtonText(String(block.text || ""));
    requestEdit();
  };
  const commit = () => {
    if (!editing) return;
    if (type === "button") {
      const next = buttonText.trim();
      if (next && next !== String(block.text || "")) onPatch({ text: next });
    } else if (type === "richtext" && richRef.current) {
      const next = richRef.current.innerHTML;
      if (next !== originalRef.current) onPatch({ html: next });
    }
    closeEdit();
  };
  const cancel = () => {
    setButtonText(String(block.text || ""));
    closeEdit();
  };
  const format = (command, value) => {
    richRef.current?.focus();
    // Native contenteditable formatting retains existing HTML, unlike plain-text replacements.
    document.execCommand(command, false, value || null);
  };
  return (
    <div
      className={`ap-liveBlock ${selected ? "is-selected" : ""} ${editing ? "is-inline-editing" : ""}`}
      role="group"
      tabIndex={0}
      onClick={() => {
        if (!editing) onSelect();
      }}
      onDoubleClick={start}
      onKeyDown={(e) => {
        if (e.key === "Escape" && editing) {
          e.preventDefault();
          e.stopPropagation();
          cancel();
        } else if (
          !editing &&
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          start();
        } else if (editing && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      aria-label={`${type} block. Double-click to edit; single-click to select.`}
    >
      <span className="ap-liveBlockTag">{editing ? "Editing" : type}</span>
      {editing && type === "button" ? (
        <div className="ap-liveInlineEdit">
          <input
            ref={inputRef}
            className="ap-input"
            value={buttonText}
            aria-label="Edit button label"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setButtonText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") cancel();
            }}
          />
          <div className="ap-liveInlineActions">
            <button
              type="button"
              className="ap-btn ap-btnPrimary"
              onClick={(e) => {
                e.stopPropagation();
                commit();
              }}
            >
              Apply
            </button>
            <button
              type="button"
              className="ap-btn"
              onClick={(e) => {
                e.stopPropagation();
                cancel();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : editing && type === "richtext" ? (
        <div className="ap-liveInlineEdit" onClick={(e) => e.stopPropagation()}>
          <div
            className="ap-liveFormatToolbar"
            role="toolbar"
            aria-label="Rich text formatting"
            onMouseDown={(e) => e.preventDefault()}
          >
            <button type="button" title="Bold" onClick={() => format("bold")}>
              <b>B</b>
            </button>
            <button
              type="button"
              title="Italic"
              onClick={() => format("italic")}
            >
              <i>I</i>
            </button>
            <button
              type="button"
              title="Underline"
              onClick={() => format("underline")}
            >
              <u>U</u>
            </button>
            <button
              type="button"
              title="Heading 2"
              onClick={() => format("formatBlock", "h2")}
            >
              H2
            </button>
            <button
              type="button"
              title="Paragraph"
              onClick={() => format("formatBlock", "p")}
            >
              P
            </button>
            <button
              type="button"
              title="Bulleted list"
              onClick={() => format("insertUnorderedList")}
            >
              • List
            </button>
            <button
              type="button"
              title="Numbered list"
              onClick={() => format("insertOrderedList")}
            >
              1. List
            </button>
            <button
              type="button"
              title="Insert link"
              onClick={async () => {
                // keep the selected text: the pop-up's text box takes the focus
                const sel = window.getSelection();
                const saved =
                  sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
                const url = await promptDialog({
                  title: "Insert link",
                  message: "Link address (https://… or /page)",
                  placeholder: "https://",
                });
                if (saved) {
                  richRef.current?.focus();
                  const s2 = window.getSelection();
                  s2.removeAllRanges();
                  s2.addRange(saved);
                }
                if (url && (/^https?:\/\//i.test(url) || url.startsWith("/")))
                  format("createLink", url);
              }}
            >
              Link
            </button>
          </div>
          <div
            key={String(block.id)}
            ref={richRef}
            className="ap-liveEditableRichtext"
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(originalRef.current),
            }}
            aria-label="Edit rich text"
          />
          <div className="ap-liveInlineActions">
            <button
              type="button"
              className="ap-btn ap-btnPrimary"
              onClick={commit}
            >
              Apply
            </button>
            <button type="button" className="ap-btn" onClick={cancel}>
              Cancel
            </button>
          </div>
          <span className="ap-liveEditShortcut">
            Ctrl/Cmd + Enter to apply · Esc to cancel
          </span>
        </div>
      ) : (
        <div className="ap-liveBlockContent">{children}</div>
      )}
      {!editing && (type === "richtext" || type === "button") ? (
        <span className="ap-liveEditHint">Double-click to edit</span>
      ) : null}
    </div>
  );
}

function APDraftCanvas({
  sections,
  selectedSectionIndex,
  selectedBlockId,
  onSelect,
  onPatchBlock,
  onPatchSection,
  device,
}) {
  const list = Array.isArray(sections) ? sections : [];
  const [activeEditor, setActiveEditor] = useState(null);
  const [sectionTitleDraft, setSectionTitleDraft] = useState("");
  const previewImage = (item) => {
    const src =
      typeof item === "string"
        ? item
        : item?.src || item?.url || item?.image_url || "";
    return absUrl(src) || "";
  };
  const renderBlock = (block) => {
    const type = String(block?.type || "richtext");
    // Phase 5: video, spacer, quote and FAQ show as they will on the site.
    if (EXTRA_BLOCK_TYPES.has(type)) return <ExtraBlockPublic block={block} />;
    const style = isObj(block?.styles) ? block.styles : {};
    const typography = {
      fontFamily: style.font_family || "inherit",
      fontSize: style.font_size || undefined,
      color: style.text_color || undefined,
      textAlign: style.align || undefined,
    };
    if (type === "richtext")
      return (
        <div
          className="ap-liveRichtext"
          style={typography}
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(String(block.html || "")),
          }}
        />
      );
    if (type === "button")
      return (
        <div style={{ textAlign: block.align || "left" }}>
          <span
            className="ap-liveButton"
            style={{
              ...typography,
              backgroundColor: style.bg_color || "#FD9D00",
              color: style.text_color || "#0b0d12",
              borderRadius: Number(style.radius ?? 14),
              padding: style.padding || "12px 16px",
              border: `${Number(style.border_width ?? 1)}px solid ${style.border_color || "transparent"}`,
            }}
          >
            {block.text || "Button"}
          </span>
        </div>
      );
    if (type === "gallery") {
      const imgs = Array.isArray(block.images)
        ? block.images
        : Array.isArray(block.items)
          ? block.items
          : [];
      return (
        <div className="ap-liveGallery">
          {imgs.map((it, i) =>
            previewImage(it) ? (
              <img key={i} src={previewImage(it)} alt={it?.alt || ""} />
            ) : null,
          )}
        </div>
      );
    }
    if (type === "hero")
      return (
        <div
          className="ap-liveHero"
          style={{
            backgroundImage: block.bg_url
              ? `url(${absUrl(block.bg_url)})`
              : undefined,
          }}
        >
          <strong>{block.title || "Hero"}</strong>
          <p>{block.sub || ""}</p>
        </div>
      );
    if (type === "grid")
      return (
        <div className="ap-livePlaceholder">
          ▦ Grid block — select to edit cards
        </div>
      );
    if (type === "columns")
      return (
        <div className="ap-livePlaceholder">
          ▥ Columns block — select to edit columns
        </div>
      );
    return (
      <div className="ap-livePlaceholder">{type} block — select to edit</div>
    );
  };
  return (
    <div className={`ap-liveCanvas ap-liveCanvas-${device}`}>
      <div className="ap-liveCanvasNote">
        Live draft canvas · Double-click text, button or section title to edit ·
        One editor at a time · Apply, then Save Draft
      </div>
      <div className="ap-livePage">
        {list.length === 0 ? (
          <div className="ap-liveEmpty">
            No builder sections yet. Add a section using the Builder tab.
          </div>
        ) : (
          list.map((section, si) => {
            const blocks = Array.isArray(section.blocks)
              ? section.blocks
              : Array.isArray(section.elements)
                ? section.elements
                : [];
            const st = isObj(section.styles)
              ? section.styles
              : isObj(section.style)
                ? section.style
                : {};
            const titleKey = `section-${si}`;
            const titleEditing = activeEditor === titleKey;
            return (
              <section
                className={`ap-liveSection ${String(selectedSectionIndex) === String(si) ? "is-section-selected" : ""}`}
                key={section.id || si}
                style={{
                  backgroundColor: st.bg_color || undefined,
                  color: st.text_color || undefined,
                  borderColor: st.border_color || undefined,
                  borderRadius: Number(st.radius ?? 14),
                  padding: st.padding || "20px",
                }}
              >
                {titleEditing ? (
                  <div className="ap-liveSectionTitleEdit">
                    <input
                      autoFocus
                      className="ap-input"
                      aria-label="Edit section title"
                      value={sectionTitleDraft}
                      onChange={(e) => setSectionTitleDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setActiveEditor(null);
                        if (e.key === "Enter") {
                          onPatchSection(si, { title: sectionTitleDraft });
                          setActiveEditor(null);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="ap-btn ap-btnPrimary"
                      onClick={() => {
                        onPatchSection(si, { title: sectionTitleDraft });
                        setActiveEditor(null);
                      }}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      className="ap-btn"
                      onClick={() => setActiveEditor(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : section.title && st.show_title !== false ? (
                  <h3
                    className="ap-liveEditableSectionTitle"
                    title="Double-click to edit section title"
                    onDoubleClick={() => {
                      setSectionTitleDraft(String(section.title || ""));
                      setActiveEditor(titleKey);
                    }}
                  >
                    {section.title}
                  </h3>
                ) : null}
                {blocks.map((block, bi) => {
                  const blockKey = `block-${si}-${block.id || bi}`;
                  return (
                    <APInlineCanvasBlock
                      key={block.id || bi}
                      block={block}
                      type={String(block.type || "richtext")}
                      active={activeEditor === blockKey}
                      requestEdit={() => setActiveEditor(blockKey)}
                      closeEdit={() => setActiveEditor(null)}
                      selected={
                        String(selectedSectionIndex) === String(si) &&
                        String(selectedBlockId) ===
                          String(block.id || `index-${bi}`)
                      }
                      onSelect={() => onSelect(si, block.id || `index-${bi}`)}
                      onPatch={(patch) => onPatchBlock(si, block.id, patch)}
                    >
                      {renderBlock(block)}
                    </APInlineCanvasBlock>
                  );
                })}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

/* -----------------------------
   Phase 4G-C4: read-only section preview
   Used by the template library to show a section before inserting it.
   Nothing here is editable and HTML is sanitized.
----------------------------- */
function APSectionPreview({ section }) {
  const sec = isObj(section) ? section : {};
  const st = isObj(sec.styles) ? sec.styles : {};
  const blocks = Array.isArray(sec.blocks) ? sec.blocks : [];
  const imgSrc = (item) =>
    absUrl(
      typeof item === "string"
        ? item
        : item?.src || item?.url || item?.image_url || "",
    ) || "";

  const renderBlock = (block, key, depth = 0) => {
    const b = isObj(block) ? block : {};
    const type = String(b.type || "richtext");
    if (EXTRA_BLOCK_TYPES.has(type))
      return <ExtraBlockPublic key={key} block={b} />;
    const style = isObj(b.styles) ? b.styles : {};
    const typography = {
      fontFamily: style.font_family || "inherit",
      fontSize: style.font_size || undefined,
      color: style.text_color || undefined,
      textAlign: style.align || undefined,
    };
    if (type === "richtext") {
      const html = sanitizeHtml(b.html);
      return html ? (
        <div
          key={key}
          className="ap-liveRichtext"
          style={typography}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
        />
      ) : (
        <div key={key} className="ap-previewEmptyText">
          Empty text block
        </div>
      );
    }
    if (type === "button")
      return (
        <div key={key} style={{ textAlign: b.align || "left" }}>
          <span
            className="ap-liveButton"
            style={{
              ...typography,
              backgroundColor: style.bg_color || "#FD9D00",
              color: style.text_color || "#0b0d12",
              borderRadius: Number(style.radius ?? 14),
              padding: style.padding || "12px 16px",
            }}
          >
            {b.text || "Button"}
          </span>
        </div>
      );
    if (type === "gallery") {
      const imgs = (
        Array.isArray(b.images) && b.images.length
          ? b.images
          : Array.isArray(b.items)
            ? b.items
            : []
      ).filter((it) => imgSrc(it));
      return imgs.length ? (
        <div key={key} className="ap-liveGallery">
          {imgs.map((it, i) => (
            <img key={i} src={imgSrc(it)} alt={it?.alt || ""} />
          ))}
        </div>
      ) : (
        <div key={key} className="ap-livePlaceholder">
          Gallery (no images yet)
        </div>
      );
    }
    if (type === "hero")
      return (
        <div
          key={key}
          className="ap-liveHero"
          style={{
            backgroundImage: b.bg_url ? `url(${absUrl(b.bg_url)})` : undefined,
          }}
        >
          <strong>{b.title || "Hero"}</strong>
          <p>{b.sub || ""}</p>
        </div>
      );
    if (type === "grid") {
      const items = Array.isArray(b.items) ? b.items : [];
      const cols = Math.min(4, Math.max(1, Number(b.cols) || 3));
      return (
        <div
          key={key}
          className="ap-previewGrid"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {items.map((it, i) => (
            <div className="ap-previewGridCard" key={it?.id || i}>
              {imgSrc(it) ? <img src={imgSrc(it)} alt="" /> : null}
              {it?.title ? <strong>{it.title}</strong> : null}
              {it?.text ? <p>{it.text}</p> : null}
            </div>
          ))}
        </div>
      );
    }
    if (type === "columns" && depth < 3) {
      const cols = Array.isArray(b.columns) ? b.columns : [];
      return (
        <div key={key} className="ap-previewColumns">
          {cols.map((col, ci) => (
            <div
              className="ap-previewColumn"
              key={col?.id || ci}
              style={{ flexBasis: `${Number(col?.width_pct) || 50}%` }}
            >
              {(Array.isArray(col?.blocks) ? col.blocks : []).map((nb, ni) =>
                renderBlock(nb, nb?.id || ni, depth + 1),
              )}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div key={key} className="ap-livePlaceholder">
        {type} block
      </div>
    );
  };

  // Mirror the public page (BuilderPage.js): a two-column section with text
  // puts non-text blocks on the left and the section title + text on the right.
  const layoutRaw = isObj(sec.layout)
    ? (sec.layout.value ?? sec.layout.layout ?? sec.layout.key ?? sec.layout.id)
    : sec.layout;
  const layoutNorm = String(layoutRaw || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const isTwoCols =
    /^(two|2)col(umn)?s?$/.test(layoutNorm) || layoutNorm.includes("twocol");
  const types = blocks.map((b) => String(b?.type || "richtext"));
  const hasRich = types.includes("richtext");
  const useTwoCols =
    isTwoCols && hasRich && (types.includes("gallery") || blocks.length > 1);

  const leftStored = st.col_left_pct;
  const rightStored = st.col_right_pct;
  const leftPct = Number(
    leftStored != null
      ? leftStored
      : rightStored != null
        ? 100 - Number(rightStored || 50)
        : 50,
  );

  const sectionStyle = {
    backgroundColor: st.bg_color || undefined,
    color: st.text_color || undefined,
    borderColor: st.border_color || undefined,
    borderRadius: Number(st.radius ?? 14),
    padding: st.padding || "20px",
  };

  return (
    <div className="ap-sectionPreview">
      <section
        className="ap-liveSection"
        style={
          String(sec.layout || "") === "plain" &&
          !st.bg_color &&
          !st.border_color
            ? {
                ...sectionStyle,
                backgroundColor: "transparent",
                border: "none",
                boxShadow: "none",
              }
            : sectionStyle
        }
      >
        {useTwoCols && sec.title && st.show_title !== false ? (
          <h3 className="ap-previewSectionTitle">{sec.title}</h3>
        ) : null}
        {useTwoCols ? (
          <div
            className="ap-previewTwoCols"
            style={{
              gridTemplateColumns: `minmax(0, ${leftPct}fr) minmax(0, ${100 - leftPct}fr)`,
            }}
          >
            <div className="ap-previewColumn">
              {blocks
                .filter((b) => String(b?.type || "richtext") !== "richtext")
                .map((b, i) => renderBlock(b, b?.id || `l${i}`))}
            </div>
            <div className="ap-previewColumn">
              {sec.title && st.show_title === false ? (
                <div className="ap-previewKicker">{sec.title}</div>
              ) : null}
              {blocks
                .filter((b) => String(b?.type || "richtext") === "richtext")
                .map((b, i) => renderBlock(b, b?.id || `r${i}`))}
            </div>
          </div>
        ) : (
          <>
            {sec.title && st.show_title !== false ? (
              <h3 className="ap-previewSectionTitle">{sec.title}</h3>
            ) : null}
            {blocks.length ? (
              blocks.map((b, i) => renderBlock(b, b?.id || i))
            ) : (
              <div className="ap-previewEmptyText">
                This section has no blocks.
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/* -----------------------------
   Toast
----------------------------- */
function ToastHost({ items, onDismiss }) {
  if (!items.length) return null;
  return (
    <div className="ap-toastHost">
      {items.map((t) => (
        <div
          key={t.id}
          className={`ap-toast ${t.tone || "info"}`}
          onClick={() => onDismiss(t.id)}
          role="status"
          aria-live="polite"
          title="Click to dismiss"
        >
          <div className="ap-toastTitle">{t.title}</div>
          {t.message ? <div className="ap-toastMsg">{t.message}</div> : null}
        </div>
      ))}
    </div>
  );
}

/* -----------------------------
   Confirm Modal
----------------------------- */
function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirm",
  danger,
  onClose,
  onConfirm,
}) {
  if (!open) return null;
  return (
    <div className="ap-modalOverlay" role="dialog" aria-modal="true">
      <div className="ap-modal">
        <div className="ap-modalTitle">{title}</div>
        <div className="ap-modalMsg">{message}</div>

        <div className="ap-modalActions">
          <button className="ap-btn" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={`ap-btn ${danger ? "ap-btnDanger" : "ap-btnPrimary"}`}
            onClick={onConfirm}
            type="button"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
   Loading overlay
----------------------------- */
function BusyOverlay({ show, label = "Working…" }) {
  if (!show) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        padding: 18,
      }}
      aria-live="polite"
      role="status"
    >
      <div
        style={{
          width: "min(520px, 92vw)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(20,20,26,0.92)",
          boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
          padding: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              border: "2px solid rgba(255,255,255,0.2)",
              borderTopColor: "rgba(154,92,255,0.95)",
              animation: "apSpin 0.9s linear infinite",
            }}
          />
          <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>{label}</div>
        </div>

        <div
          style={{
            marginTop: 12,
            height: 8,
            borderRadius: 999,
            overflow: "hidden",
            background: "rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              width: "50%",
              height: "100%",
              borderRadius: 999,
              background: "rgba(154,92,255,0.85)",
              animation: "apIndeterminate 1.2s ease-in-out infinite",
            }}
          />
        </div>

        <style>{`
          @keyframes apSpin { to { transform: rotate(360deg); } }
          @keyframes apIndeterminate {
            0%   { transform: translateX(-60%); }
            50%  { transform: translateX(60%); }
            100% { transform: translateX(180%); }
          }
        `}</style>
      </div>
    </div>
  );
}

/* -----------------------------
   Upload helpers
----------------------------- */
async function uploadPageImage(file, kind = "inline") {
  const fd = new FormData();

  // Backend expects: upload.single("file")
  // IMPORTANT: do not append the same file under a different field name,
  // or Multer will throw "Unexpected field".
  fd.append("file", file);

  // Production-style storage: Bunny (via /api/uploads)
  // upload.js supports kind in: videos|resources|images|docs|files
  // For page images we use kind=images and category=pages.
  fd.append("kind", "images");
  fd.append("category", "pages");
  fd.append("folder", String(kind || "inline"));

  const r = await api.post("/uploads", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  const url = r?.data?.url || "";
  if (!url) {
    const d = r?.data;
    const keys = d && typeof d === "object" ? Object.keys(d) : [];
    throw new Error(`Upload did not return URL (keys: ${keys.join(",")})`);
  }
  // Phase 4H-2: file every editor upload into the Media Library so it can be
  // reused. Runs in the background and never affects the upload result.
  registerUploadedImage(file, url, r?.data?.key || "");
  return url;
}

/* -----------------------------
   Templates
----------------------------- */
const HOME_DEFAULTS = {
  hero: {
    kicker: "Sermons • Teaching • Live services",
    title: "Experience the Message",
    sub: "Watch sermons, teachings and live services anytime, anywhere.",
    cta_text: "Start Watching",
    cta_href: "/catalog",
    background_url: "",
  },
  join: {
    eyebrow: "Join us",
    title: "Become part of the family",
    sub: "Create a free account to save your place and get live service reminders.",
    cta_text: "Join Now",
    cta_href: "/signup",
  },
  watch_more: {
    title: "Go Deeper Into The Word",
    sub: "Stream powerful teachings anytime, anywhere.",
    cta_text: "Browse Catalog",
    cta_href: "/catalog",
  },
  about: {
    name: "Our Pastor",
    text: "Introduce your pastor here: their calling, their story and what God has placed on their heart for this ministry.",
    avatar_url: "",
  },
  extra_sections: [],
};

const SECTION_LAYOUT_OPTIONS = [
  { value: "plain", label: "Plain (no box)" },
  { value: "card", label: "Card" },
  { value: "full", label: "Full Width" },
  { value: "highlight", label: "Highlight" },
  { value: "two_columns", label: "Two Columns" },
];

const SECTION_THEME_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "dark", label: "Dark" },
  { value: "purple", label: "Purple" },
  { value: "blue", label: "Blue" },
  { value: "light", label: "Light" },
];

const TITLE_TAG_OPTIONS = [
  { value: "h2", label: "H2" },
  { value: "h3", label: "H3" },
  { value: "h4", label: "H4" },
  { value: "div", label: "Div" },
];

function ensureHomeCoreSections(model) {
  const m = isObj(model) ? model : {};
  const extraRaw = Array.isArray(m.extra_sections) ? m.extra_sections : [];
  const extra = extraRaw;

  const hasCore = extra.some((s) =>
    (Array.isArray(s.blocks) ? s.blocks : []).some(
      (b) => String(b?.type || "") === "home_hero",
    ),
  );
  if (hasCore) return { ...m, extra_sections: extra };

  const hero = m.hero || HOME_DEFAULTS.hero;
  const join = m.join || HOME_DEFAULTS.join;
  const cta = m.watch_more || HOME_DEFAULTS.watch_more;
  const about = m.about || HOME_DEFAULTS.about;

  const core = [
    {
      id: "core-hero",
      title: "Hero",
      layout: "full",
      theme: "default",
      collapsed: false,
      blocks: [
        {
          id: uid(),
          type: "home_hero",
          kicker: hero.kicker || "",
          title: hero.title || "",
          sub: hero.sub || "",
          cta_text: hero.cta_text || "Start Watching",
          cta_href: hero.cta_href || "/catalog",
          background_url: hero.background_url || "",
        },
      ],
    },
    {
      id: "core-join",
      title: "Join Strip",
      layout: "full",
      theme: "default",
      collapsed: false,
      blocks: [
        {
          id: uid(),
          type: "home_join",
          eyebrow: join.eyebrow || "",
          title: join.title || "",
          sub: join.sub || "",
          cta_text: join.cta_text || "Join Now",
          cta_href: join.cta_href || "/signup",
        },
      ],
    },
    {
      id: "core-featured-live",
      title: "Featured Live Highlight",
      layout: "full",
      theme: "default",
      collapsed: true,
      blocks: [
        {
          id: uid(),
          type: "featured_live",
          show: true,
        },
      ],
    },

    {
      id: "core-latest-teaching",
      title: "Latest Teaching",
      layout: "full",
      theme: "default",
      collapsed: true,
      blocks: [
        {
          id: uid(),
          type: "latest_teaching",
          show: true,
        },
      ],
    },
    {
      id: "core-cta",
      title: "Watch More CTA",
      layout: "full",
      theme: "default",
      collapsed: false,
      blocks: [
        {
          id: uid(),
          type: "home_cta",
          title: cta.title || "",
          sub: cta.sub || "",
          cta_text: cta.cta_text || "Browse Catalog",
          cta_href: cta.cta_href || "/catalog",
        },
      ],
    },
    {
      id: "core-about",
      title: "About Section",
      layout: "full",
      theme: "default",
      collapsed: false,
      blocks: [
        {
          id: uid(),
          type: "home_about",
          name: about.name || "",
          text: about.text || "",
          avatar_url: about.avatar_url || "",
        },
      ],
    },
  ];

  return { ...m, extra_sections: [...core, ...extra] };
}

function ensureGenericModel(model) {
  const m = isObj(model) ? model : {};
  const extraRaw = Array.isArray(m.extra_sections) ? m.extra_sections : [];
  return { ...m, extra_sections: extraRaw };
}

function stripHomeBlocksFromGeneric(model) {
  const m = ensureGenericModel(model);
  const extra = Array.isArray(m.extra_sections) ? m.extra_sections : [];

  const cleaned = extra
    .map((sec) => {
      const s = isObj(sec) ? sec : {};
      const blocksRaw = Array.isArray(s.blocks) ? s.blocks : [];
      const blocks = blocksRaw.filter(
        (b) =>
          !String(b?.type || "")
            .toLowerCase()
            .startsWith("home_"),
      );
      return { ...s, blocks };
    })
    .filter((s) => {
      // drop empty "core" injected sections or sections that become empty after stripping
      const blocks = Array.isArray(s.blocks) ? s.blocks : [];
      const hasHtml =
        String(s.html || "").trim() ||
        String(s.left_html || "").trim() ||
        String(s.right_html || "").trim();
      const isCoreId = String(s.id || "").startsWith("core-");
      // NOTE: hasAnyHome here uses already-stripped blocks, so will be false; we use isCoreId as core marker.
      if (isCoreId && blocks.length === 0 && !hasHtml) return false;
      if (blocks.length === 0 && !hasHtml) return false;
      return true;
    });

  return { ...m, extra_sections: cleaned };
}

function hasHomeBlocks(model) {
  const m = isObj(model) ? model : {};
  const extra = Array.isArray(m.extra_sections) ? m.extra_sections : [];
  return extra.some((sec) =>
    (Array.isArray(sec?.blocks) ? sec.blocks : []).some((b) =>
      String(b?.type || "")
        .toLowerCase()
        .startsWith("home_"),
    ),
  );
}

function deepMergeHomeDefaults(incoming) {
  const src = isObj(incoming) ? incoming : {};
  const merged = {
    ...HOME_DEFAULTS,
    // keep other page settings (e.g. page_css) instead of dropping them
    ...src,
    hero: { ...HOME_DEFAULTS.hero, ...(src.hero || {}) },
    join: { ...HOME_DEFAULTS.join, ...(src.join || {}) },
    watch_more: { ...HOME_DEFAULTS.watch_more, ...(src.watch_more || {}) },
    about: { ...HOME_DEFAULTS.about, ...(src.about || {}) },
    extra_sections: Array.isArray(src.extra_sections) ? src.extra_sections : [],
  };
  return ensureHomeCoreSections(merged);
}

function detectTemplateType(slug) {
  const s = String(slug || "").toLowerCase();
  if (s === "home") return "home";
  return "generic";
}

function SectionCard({ title, children, right }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 14,
        background: "rgba(255,255,255,0.04)",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ fontWeight: 800 }}>{title}</div>
        {right ? <div>{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, help }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.8)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
      {help ? (
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.55)",
            marginTop: 6,
          }}
        >
          {help}
        </div>
      ) : null}
    </div>
  );
}

/* -----------------------------
   Style Popup (Modal)
----------------------------- */
function StylePopup({
  open,
  section,
  titleTagOptions,
  onClose,
  onPatch,
  onUploadBackground,
}) {
  const [tab, setTab] = useState("section"); // section | title | bg | image
  // Phase 4H-2: Media Library picker, provided by the page editor.
  const pickFromLibrary = useContext(MediaPickerContext);

  // keep hook order stable
  useEffect(() => {
    if (!open) setTab("section");
  }, [open]);

  if (!open) return null;

  const sec = isObj(section) ? section : {};
  const st = isObj(sec.styles) ? sec.styles : {};

  function patchStyles(stylesPatch) {
    onPatch?.({ styles: { ...(st || {}), ...(stylesPatch || {}) } });
  }

  return (
    <div className="ap-modalOverlay" role="dialog" aria-modal="true">
      <div
        className="ap-modal ap-styleSettingsModal"
        style={{ width: "min(920px, 96vw)" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div>
            <div className="ap-modalTitle">Style Settings</div>
            <div className="ap-help" style={{ marginTop: 6 }}>
              {sec.title ? `Editing: ${sec.title}` : "Editing section styles"}
            </div>
          </div>

          <button className="ap-btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          <button
            className={`ap-btn ${tab === "section" ? "ap-btnPrimary" : ""}`}
            type="button"
            onClick={() => setTab("section")}
          >
            Section
          </button>
          <button
            className={`ap-btn ${tab === "columns" ? "ap-btnPrimary" : ""} ${!isTwoColsLayout(sec.layout) ? "ap-btnDisabled" : ""}`}
            type="button"
            onClick={() => setTab("columns")}
            style={!isTwoColsLayout(sec.layout) ? { opacity: 0.55 } : undefined}
            title={
              !isTwoColsLayout(sec.layout)
                ? "Enable Two Columns layout to edit column settings"
                : ""
            }
          >
            Columns
          </button>

          <button
            className={`ap-btn ${tab === "title" ? "ap-btnPrimary" : ""}`}
            type="button"
            onClick={() => setTab("title")}
          >
            Title
          </button>
          <button
            className={`ap-btn ${tab === "bg" ? "ap-btnPrimary" : ""}`}
            type="button"
            onClick={() => setTab("bg")}
          >
            Background
          </button>
          <button
            className={`ap-btn ${tab === "image" ? "ap-btnPrimary" : ""}`}
            type="button"
            onClick={() => setTab("image")}
          >
            Image Defaults
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          {tab === "section" ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <Field label="Alignment">
                  <select
                    className="ap-input"
                    value={st.align || "left"}
                    onChange={(e) => patchStyles({ align: e.target.value })}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </Field>
                <Field
                  label="Justify Content"
                  help="Controls vertical placement inside the section (requires a height/min-height)."
                >
                  <select
                    className="ap-input"
                    value={st.justify || "flex-start"}
                    onChange={(e) => patchStyles({ justify: e.target.value })}
                  >
                    <option value="flex-start">Top</option>
                    <option value="center">Center</option>
                    <option value="flex-end">Bottom</option>
                    <option value="space-between">Space Between</option>
                  </select>
                </Field>

                <Field
                  label="Align Items"
                  help="Controls horizontal placement of blocks inside the section."
                >
                  <select
                    className="ap-input"
                    value={st.items_align || "stretch"}
                    onChange={(e) =>
                      patchStyles({ items_align: e.target.value })
                    }
                  >
                    <option value="stretch">Stretch</option>
                    <option value="flex-start">Left</option>
                    <option value="center">Center</option>
                    <option value="flex-end">Right</option>
                  </select>
                </Field>

                <Field
                  label="Max Width"
                  help='Optional. Example: "1100px" or "100%"'
                >
                  <input
                    className="ap-input"
                    defaultValue={st.max_width || ""}
                    onBlur={(e) => patchStyles({ max_width: e.target.value })}
                    placeholder="e.g. 1100px"
                  />
                </Field>

                {sec.layout === "two_columns" ? (
                  <>
                    <Field
                      label="Left Column Width (%)"
                      help="Desktop only. Mobile will stack automatically."
                    >
                      <input
                        className="ap-input"
                        type="number"
                        min={20}
                        max={80}
                        defaultValue={Number(
                          st.col_left_pct ??
                            (st.col_right_pct != null
                              ? 100 - Number(st.col_right_pct || 50)
                              : 50),
                        )}
                        onBlur={(e) => {
                          const n = Math.max(
                            20,
                            Math.min(80, Number(e.target.value) || 50),
                          );
                          patchStyles({
                            col_left_pct: n,
                            col_right_pct: 100 - n,
                          });
                        }}
                        placeholder="50"
                      />
                    </Field>

                    <Field
                      label="Right Column Width (%)"
                      help="Desktop only. Mobile will stack automatically."
                    >
                      <input
                        className="ap-input"
                        type="number"
                        min={20}
                        max={80}
                        defaultValue={Number(
                          st.col_right_pct ??
                            (st.col_left_pct != null
                              ? 100 - Number(st.col_left_pct || 50)
                              : 50),
                        )}
                        onBlur={(e) => {
                          const n = Math.max(
                            20,
                            Math.min(80, Number(e.target.value) || 50),
                          );
                          patchStyles({
                            col_right_pct: n,
                            col_left_pct: 100 - n,
                          });
                        }}
                        placeholder="50"
                      />
                    </Field>
                  </>
                ) : null}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <Field
                  label="Min Height"
                  help='Optional. Example: "420px" or "60vh" (blank = auto)'
                >
                  <input
                    className="ap-input"
                    defaultValue={st.min_height || ""}
                    onBlur={(e) => patchStyles({ min_height: e.target.value })}
                    placeholder="e.g. 420px or 60vh"
                  />
                </Field>

                <Field
                  label="Height"
                  help='Optional. Example: "500px" or "auto" (blank = auto)'
                >
                  <input
                    className="ap-input"
                    defaultValue={st.height || ""}
                    onBlur={(e) => patchStyles({ height: e.target.value })}
                    placeholder="e.g. 500px or auto"
                  />
                </Field>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <Field
                  label="Padding"
                  help='Example: "24px" or "24px 18px" (blank = default)'
                >
                  <input
                    className="ap-input"
                    defaultValue={st.padding || ""}
                    onBlur={(e) => patchStyles({ padding: e.target.value })}
                    placeholder="e.g. 24px 18px"
                  />
                </Field>

                <Field
                  label="Margin"
                  help='Example: "18px 0" (blank = default)'
                >
                  <input
                    className="ap-input"
                    defaultValue={st.margin || ""}
                    onBlur={(e) => patchStyles({ margin: e.target.value })}
                    placeholder="e.g. 18px 0"
                  />
                </Field>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <Field
                  label="Border Width"
                  help='Optional. Example: "1px" (blank = default)'
                >
                  <input
                    className="ap-input"
                    value={st.border_width || ""}
                    onChange={(e) =>
                      patchStyles({
                        border_width: String(e.target.value || ""),
                      })
                    }
                    placeholder="e.g. 1px"
                  />
                </Field>

                <Field
                  label="Content Gap"
                  help='Optional. Example: "18px" (blank = default)'
                >
                  <input
                    className="ap-input"
                    value={st.content_gap || ""}
                    onChange={(e) =>
                      patchStyles({
                        content_gap: e.target.value,
                      })
                    }
                    placeholder="e.g. 18px"
                  />
                </Field>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <Field
                  label="Font Size"
                  help='Optional. Example: "16px" (blank = default)'
                >
                  <input
                    className="ap-input"
                    value={st.font_size || ""}
                    onChange={(e) =>
                      patchStyles({ font_size: String(e.target.value || "") })
                    }
                    placeholder="e.g. 16px"
                  />
                </Field>

                <Field
                  label="Line Height"
                  help='Optional. Example: "1.6" or "24px" (blank = default)'
                >
                  <input
                    className="ap-input"
                    value={st.line_height || ""}
                    onChange={(e) =>
                      patchStyles({ line_height: String(e.target.value || "") })
                    }
                    placeholder="e.g. 1.6"
                  />
                </Field>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <Field label="Background Color" help="Optional (hex or rgba)">
                  <input
                    className="ap-input"
                    defaultValue={st.bg_color || ""}
                    onBlur={(e) => patchStyles({ bg_color: e.target.value })}
                    placeholder="e.g. rgba(124,58,237,0.12)"
                  />
                </Field>

                <Field label="Text Color" help="Optional">
                  <input
                    className="ap-input"
                    defaultValue={st.text_color || ""}
                    onBlur={(e) => patchStyles({ text_color: e.target.value })}
                    placeholder="e.g. rgba(255,255,255,0.92)"
                  />
                </Field>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <Field label="Border Color" help="Optional">
                  <input
                    className="ap-input"
                    defaultValue={st.border_color || ""}
                    onBlur={(e) =>
                      patchStyles({ border_color: e.target.value })
                    }
                    placeholder="e.g. rgba(255,255,255,0.12)"
                  />
                </Field>

                <Field label="Corner Radius">
                  <input
                    className="ap-input"
                    type="number"
                    min={0}
                    max={60}
                    value={Number(st.radius ?? 14)}
                    onChange={(e) =>
                      patchStyles({ radius: clampNum(e.target.value, 0, 60) })
                    }
                  />
                </Field>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <Field label="Shadow">
                  <select
                    className="ap-input"
                    value={st.shadow || "soft"}
                    onChange={(e) => patchStyles({ shadow: e.target.value })}
                  >
                    <option value="none">None</option>
                    <option value="soft">Soft</option>
                    <option value="strong">Strong</option>
                  </select>
                </Field>

                <Field label="Title Color" help="Optional">
                  <input
                    className="ap-input"
                    defaultValue={st.title_color || ""}
                    onBlur={(e) => patchStyles({ title_color: e.target.value })}
                    placeholder="e.g. rgba(255,255,255,0.95)"
                  />
                </Field>
              </div>
            </>
          ) : null}

          {tab === "columns" ? (
            <>
              {!isTwoColsLayout(sec.layout) ? (
                <div className="ap-help" style={{ marginTop: 6 }}>
                  Column settings are available when the section layout is{" "}
                  <b>Two Columns</b>.
                  <div style={{ marginTop: 8 }}>
                    <button
                      className="ap-btn ap-btnPrimary"
                      type="button"
                      onClick={() => onPatch({ layout: "two_cols" })}
                    >
                      Switch section to Two Columns
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <Field label="Left Column Width (%)">
                      <input
                        className="ap-input"
                        type="number"
                        min="10"
                        max="90"
                        step="1"
                        value={sec?.styles?.col_left_pct ?? 50}
                        onChange={(e) => {
                          const v = clamp(Number(e.target.value || 0), 10, 90);
                          onPatch({
                            styles: {
                              ...(sec.styles || {}),
                              col_left_pct: v,
                              col_right_pct: 100 - v,
                            },
                          });
                        }}
                      />
                    </Field>

                    <Field label="Right Column Width (%)">
                      <input
                        className="ap-input"
                        type="number"
                        min="10"
                        max="90"
                        step="1"
                        value={sec?.styles?.col_right_pct ?? 50}
                        onChange={(e) => {
                          const v = clamp(Number(e.target.value || 0), 10, 90);
                          onPatch({
                            styles: {
                              ...(sec.styles || {}),
                              col_right_pct: v,
                              col_left_pct: 100 - v,
                            },
                          });
                        }}
                      />
                    </Field>

                    <Field label="Left Column Padding">
                      <input
                        className="ap-input"
                        placeholder="e.g. 0 or 12px 16px"
                        value={sec?.styles?.col_left_padding ?? ""}
                        onChange={(e) =>
                          onPatch({
                            styles: {
                              ...(sec.styles || {}),
                              col_left_padding: e.target.value,
                            },
                          })
                        }
                      />
                    </Field>

                    <Field label="Right Column Padding">
                      <input
                        className="ap-input"
                        placeholder="e.g. 0 or 12px 16px"
                        value={sec?.styles?.col_right_padding ?? ""}
                        onChange={(e) =>
                          onPatch({
                            styles: {
                              ...(sec.styles || {}),
                              col_right_padding: e.target.value,
                            },
                          })
                        }
                      />
                    </Field>
                  </div>

                  <div className="ap-help" style={{ marginTop: 8 }}>
                    Tip: On mobile, columns automatically stack and widths reset
                    to 100%.
                  </div>
                </>
              )}
            </>
          ) : null}

          {tab === "title" ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <Field label="Show Title">
                  <select
                    className="ap-input"
                    value={st.show_title ? "yes" : "no"}
                    onChange={(e) =>
                      patchStyles({ show_title: e.target.value === "yes" })
                    }
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </Field>

                <Field label="Title Tag">
                  <select
                    className="ap-input"
                    value={st.title_tag || "h3"}
                    onChange={(e) => patchStyles({ title_tag: e.target.value })}
                  >
                    {(titleTagOptions || []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <Field label="Title Size (px)">
                  <input
                    className="ap-input"
                    type="number"
                    min={10}
                    max={64}
                    value={Number(st.title_size ?? 22)}
                    onChange={(e) =>
                      patchStyles({
                        title_size: clampNum(e.target.value, 10, 64),
                      })
                    }
                  />
                </Field>

                <Field label="Title Weight">
                  <input
                    className="ap-input"
                    type="number"
                    min={200}
                    max={900}
                    step={100}
                    value={Number(st.title_weight ?? 800)}
                    onChange={(e) =>
                      patchStyles({
                        title_weight: clampNum(e.target.value, 200, 900),
                      })
                    }
                  />
                </Field>
              </div>
            </>
          ) : null}

          {/* ✅ FIXED BG TAB JSX (your pasted file had broken nesting here) */}
          {tab === "bg" ? (
            <>
              <div className="ap-help" style={{ marginBottom: 10 }}>
                Upload a background image for this section. You can also set
                fit, position, and overlay darkness.
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label
                  className="ap-btn"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                  }}
                >
                  Upload Background
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      await onUploadBackground?.(file);
                    }}
                  />
                </label>

                {pickFromLibrary && onUploadBackground ? (
                  <button
                    className="ap-btn"
                    type="button"
                    title="Choose from the Media Library"
                    onClick={async () => {
                      const libPick = await pickFromLibrary({
                        title: "Choose a section background",
                      });
                      if (libPick) await onUploadBackground(libPick);
                    }}
                  >
                    Choose from library
                  </button>
                ) : null}

                <button
                  className="ap-btn"
                  type="button"
                  onClick={() => patchStyles({ bg_image_url: "" })}
                  disabled={!String(st.bg_image_url || "").trim()}
                >
                  Remove Background
                </button>
              </div>

              {st.bg_image_url ? (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      width: "100%",
                      height: 160,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: `url(${absUrl(st.bg_image_url) || st.bg_image_url}) center/cover no-repeat`,
                    }}
                  />
                  <div className="ap-help" style={{ marginTop: 8 }}>
                    {st.bg_image_url}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                      marginTop: 10,
                    }}
                  >
                    <Field label="Background Fit">
                      <select
                        className="ap-input"
                        value={st.bg_image_fit || "cover"}
                        onChange={(e) =>
                          patchStyles({ bg_image_fit: e.target.value })
                        }
                      >
                        <option value="cover">Cover</option>
                        <option value="contain">Contain</option>
                      </select>
                    </Field>

                    <Field label="Background Position">
                      <select
                        className="ap-input"
                        value={st.bg_image_pos || "center"}
                        onChange={(e) =>
                          patchStyles({ bg_image_pos: e.target.value })
                        }
                      >
                        <option value="center">Center</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </Field>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                      marginTop: 10,
                    }}
                  >
                    <Field
                      label="Overlay Color"
                      help='Optional. Example: "rgba(0,0,0,0.65)"'
                    >
                      <input
                        className="ap-input"
                        value={st.overlay_color || ""}
                        onChange={(e) =>
                          patchStyles({
                            overlay_color: String(e.target.value || ""),
                          })
                        }
                        placeholder="rgba(0,0,0,0.65)"
                      />
                    </Field>

                    <Field
                      label="Overlay Opacity"
                      help="Optional. 0 to 0.9 (blank = use Overlay Darkness)"
                    >
                      <input
                        className="ap-input"
                        type="number"
                        min={0}
                        max={0.9}
                        step={0.05}
                        value={
                          st.overlay_opacity === "" ||
                          st.overlay_opacity == null
                            ? ""
                            : Number(st.overlay_opacity)
                        }
                        onChange={(e) =>
                          patchStyles({ overlay_opacity: e.target.value })
                        }
                        placeholder="e.g. 0.65"
                      />
                    </Field>
                  </div>

                  <Field
                    label="Overlay Darkness (0 to 0.9)"
                    help="Adds a dark overlay on top of the background image so text stays readable."
                  >
                    <input
                      className="ap-input"
                      type="number"
                      min={0}
                      max={0.9}
                      step={0.05}
                      value={Number(st.overlay ?? 0)}
                      onChange={(e) =>
                        patchStyles({
                          overlay: Math.max(
                            0,
                            Math.min(0.9, Number(e.target.value) || 0),
                          ),
                        })
                      }
                    />
                  </Field>
                </div>
              ) : null}
            </>
          ) : null}

          {tab === "image" ? (
            <>
              <div className="ap-help" style={{ marginBottom: 10 }}>
                These values are saved per-section and can be applied by Home.js
                when rendering images inside the section.
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <Field label="Image Corner Radius">
                  <input
                    className="ap-input"
                    type="number"
                    min={0}
                    max={60}
                    value={Number(st.img_radius ?? 12)}
                    onChange={(e) =>
                      patchStyles({
                        img_radius: clampNum(e.target.value, 0, 60),
                      })
                    }
                  />
                </Field>

                <Field label="Image Shadow">
                  <select
                    className="ap-input"
                    value={st.img_shadow || "none"}
                    onChange={(e) =>
                      patchStyles({ img_shadow: e.target.value })
                    }
                  >
                    <option value="none">None</option>
                    <option value="soft">Soft</option>
                  </select>
                </Field>
              </div>
            </>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 14,
          }}
        >
          <button className="ap-btn" type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
   Main component
----------------------------- */
// visualOnly: the full-screen visual editor (route /admin/pages/:id/visual).
export default function AdminPageEditor({ visualOnly = false } = {}) {
  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorWidth, setInspectorWidth] = useState(360);
  const [patternLibraryOpen, setPatternLibraryOpen] = useState(false);
  // Phase 4G-C3: reusable section library.
  const [libraryTab, setLibraryTab] = useState("templates"); // templates | saved
  const [savedSections, setSavedSections] = useState(null); // null = not loaded
  const [savedSectionsLoading, setSavedSectionsLoading] = useState(false);
  const [savedSectionsError, setSavedSectionsError] = useState("");
  const [insertingSavedId, setInsertingSavedId] = useState(null);
  const [saveSectionDialog, setSaveSectionDialog] = useState(null); // { section, name, category, error }
  const [savingSection, setSavingSection] = useState(false);
  // Phase 4G-C4: template management.
  const [savedSearch, setSavedSearch] = useState("");
  const [savedCategory, setSavedCategory] = useState("all"); // all | __none | <name>
  const [editSavedDialog, setEditSavedDialog] = useState(null); // { item, name, category, error }
  const [updatingSaved, setUpdatingSaved] = useState(false);
  const [deletingSavedId, setDeletingSavedId] = useState(null);
  const [templatePreview, setTemplatePreview] = useState(null); // { kind, title, subtitle, section, item, pattern, loading, error }
  // Phase 4H-2: Media Library picker. pickFromLibrary() resolves with a pick
  // (or an array of picks when multiple) or null if cancelled.
  const [mediaPicker, setMediaPicker] = useState(null); // { multiple, title, resolve }
  const pickFromLibrary = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        setMediaPicker((cur) => {
          if (cur?.resolve) cur.resolve(null);
          return {
            multiple: !!options.multiple,
            title: options.title || "",
            resolve,
          };
        });
      }),
    [],
  );
  function closeMediaPicker(result) {
    setMediaPicker((cur) => {
      if (cur?.resolve) cur.resolve(result ?? null);
      return null;
    });
  }
  const [inserterOpen, setInserterOpen] = useState(false);
  const [blockSearch, setBlockSearch] = useState("");
  const [targetSection, setTargetSection] = useState("");
  const [inspectorTab, setInspectorTab] = useState(
    visualOnly ? "elements" : "page",
  );
  const [selectedSectionIndex, setSelectedSectionIndex] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState("");
  // Element inside a Columns block: { columnsId, colId, innerId } (innerId ""
  // when the column itself is selected).
  const [selectedInner, setSelectedInner] = useState(null);
  // Elementor-style panel tabs: element Content | Style | Advanced,
  // section Layout | Style | Advanced.
  const [elementPane, setElementPane] = useState("content");
  const [sectionPane, setSectionPane] = useState("layout");
  const [previewDevice, setPreviewDevice] = useState("desktop");
  const [canvasMode, setCanvasMode] = useState(
    visualOnly ? "visual" : "builder",
  );

  const [page, setPage] = useState(null);

  // common fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [seo, setSeo] = useState(() => normalizeSeo(null)); // Phase 6
  const [hero, setHero] = useState(""); // generic pages
  const [contentHtml, setContentHtml] = useState("");
  const [contentJson, setContentJson] = useState(null);

  // last-saved snapshot for accurate dirty detection
  const lastSavedRef = useRef("");
  const hasLoadedRef = useRef(false);
  /* -----------------------------
     Undo / Redo (builder session history)
  ----------------------------- */
  const HISTORY_LIMIT = 60;

  const historyRef = useRef([]);
  const futureRef = useRef([]);
  const isTimeTravelRef = useRef(false);
  const prevContentJsonRef = useRef(null);
  const [, setHistoryVersion] = useState(0);

  const bumpHistory = useCallback(() => {
    setHistoryVersion((v) => v + 1);
  }, []);

  const cloneJson = useCallback((v) => {
    try {
      return v == null ? null : JSON.parse(JSON.stringify(v));
    } catch (e) {
      // fallback: keep reference if something non-serializable sneaks in
      return v ?? null;
    }
  }, []);

  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const undo = useCallback(() => {
    if (!historyRef.current.length) return;
    isTimeTravelRef.current = true;

    const prev = historyRef.current.pop();
    futureRef.current.push(cloneJson(contentJson));

    setContentJson(prev ?? null);
    bumpHistory();

    Promise.resolve().then(() => {
      isTimeTravelRef.current = false;
    });
  }, [contentJson, cloneJson, bumpHistory]);

  const redo = useCallback(() => {
    if (!futureRef.current.length) return;
    isTimeTravelRef.current = true;

    const next = futureRef.current.pop();
    historyRef.current.push(cloneJson(contentJson));

    setContentJson(next ?? null);
    bumpHistory();

    Promise.resolve().then(() => {
      isTimeTravelRef.current = false;
    });
  }, [contentJson, cloneJson, bumpHistory]);

  // Track contentJson changes and store history snapshots (builder edits only)
  useEffect(() => {
    // Wait until initial load completes
    if (!hasLoadedRef.current) {
      prevContentJsonRef.current = cloneJson(contentJson);
      return;
    }
    if (isTimeTravelRef.current) {
      prevContentJsonRef.current = cloneJson(contentJson);
      return;
    }

    const prev = prevContentJsonRef.current;
    const next = contentJson;

    const prevS = stableStringify(prev ?? null);
    const nextS = stableStringify(next ?? null);
    if (prevS !== nextS) {
      historyRef.current.push(cloneJson(prev));
      if (historyRef.current.length > HISTORY_LIMIT) {
        historyRef.current = historyRef.current.slice(-HISTORY_LIMIT);
      }
      futureRef.current = [];
      bumpHistory();
      prevContentJsonRef.current = cloneJson(next);
    }
  }, [contentJson, cloneJson, bumpHistory]);

  const status = page?.status || "draft";
  const templateType = useMemo(
    () => detectTemplateType(slug || page?.slug),
    [slug, page?.slug],
  );

  const makeSnapshot = useCallback(
    (override = {}) => {
      const snap = {
        title: String((override.title ?? title) || ""),
        slug: String((override.slug ?? slug) || ""),
        excerpt: String((override.excerpt ?? excerpt) || ""),
        hero: String((override.hero ?? hero) || ""),
        contentHtml: String((override.contentHtml ?? contentHtml) || ""),
        contentJson: override.contentJson ?? contentJson ?? null,
        templateType: String(templateType || ""),
        seo: normalizeSeo(override.seo ?? seo),
      };
      return stableStringify(snap);
    },
    [title, slug, excerpt, hero, contentHtml, contentJson, templateType, seo],
  );
  const [activeTab, setActiveTab] = useState("builder");
  useEffect(() => {
    // Builder is available for all templates (home + generic + custom templates).
    // Do not force-switch tabs on load; only recover if state is invalid.
    if (activeTab !== "builder" && activeTab !== "rich")
      setActiveTab("builder");
  }, [templateType, activeTab]);

  // Keep hook order stable
  useEffect(() => {
    if (templateType === "home") {
      setContentJson((prev) => deepMergeHomeDefaults(prev || {}));
    }
  }, [templateType]);

  /* -----------------------------
     Toast state
  ----------------------------- */
  const [toasts, setToasts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("Uploading…");
  function toast(tone, titleText, message) {
    const tid = uid();
    const next = { id: tid, tone, title: titleText, message };
    setToasts((prev) => [next, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== tid));
    }, 4200);
  }
  function dismissToast(tid) {
    setToasts((prev) => prev.filter((x) => x.id !== tid));
  }

  /* -----------------------------
     Confirm modals
  ----------------------------- */
  const [confirm, setConfirm] = useState({ open: false });
  function openConfirm(cfg) {
    setConfirm({ open: true, ...cfg });
  }
  function closeConfirm() {
    setConfirm({ open: false });
  }

  /* -----------------------------
     Style modal
  ----------------------------- */
  const [styleModal, setStyleModal] = useState({ open: false, idx: -1 });
  function openStyleModal(idx) {
    setStyleModal({ open: true, idx });
  }
  function closeStyleModal() {
    setStyleModal({ open: false, idx: -1 });
  }

  // Template-aware content_json updater:
  // - Home uses deepMergeHomeDefaults (includes home core sections)
  // - Generic pages use ensureGenericModel (NO home injection)
  function setBuilder(patchFn) {
    setContentJson((prev) => {
      const base =
        templateType === "home"
          ? deepMergeHomeDefaults(prev || {})
          : ensureGenericModel(prev || {});
      return patchFn(base);
    });
  }

  function defaultSectionStyle(theme = "default") {
    return {
      padding: "",
      margin: "",
      max_width: "",
      min_height: "",
      height: "",
      bg_color: "",
      text_color: "",
      title_color: "",
      border_color: "",
      border_width: "",
      radius: 14,
      shadow: "soft",
      align: "left",
      justify: "flex-start",
      items_align: "stretch",
      content_gap: "",
      font_size: "",
      line_height: "",
      show_title: true,
      title_tag: "h3",
      title_size: 22,
      title_weight: 800,
      bg_image_url: "",
      bg_image_fit: "cover",
      bg_image_pos: "center",
      overlay: 0.0,
      overlay_color: "",
      overlay_opacity: "",
      img_radius: 12,
      img_shadow: "none",
    };
  }

  function ensureSectionShape(s) {
    const sec = isObj(s) ? s : {};
    const layout = String(sec.layout || "card");
    const theme = String(sec.theme || "default");

    const styles = isObj(sec.styles) ? sec.styles : {};
    const baseStyle = defaultSectionStyle(theme);

    const rawBlocks = Array.isArray(sec.blocks) ? sec.blocks : [];
    const blocks = rawBlocks
      .map((b) => (isObj(b) ? b : {}))
      .map((b) => ({
        id: String(b.id || uid()),
        type: String(b.type || "richtext"),
        ...b,
      }));

    return {
      id: String(sec.id || uid()),
      title: String(sec.title || "New Section"),
      html: String(sec.html || ""),
      layout,
      theme,
      left_html: String(
        sec.left_html || (layout === "two_columns" ? sec.html || "" : ""),
      ),
      right_html: String(sec.right_html || ""),
      blocks,
      collapsed: !!sec.collapsed,
      styles: {
        // Alignment comes only from the section's own settings: the public site
        // centres sections that have none, so filling in the editor's "left"
        // here would shift such a section the first time it is edited.
        ...(() => {
          const { align: _ignoredAlign, ...rest } = baseStyle;
          return rest;
        })(),
        ...styles,
        padding: String(styles.padding ?? baseStyle.padding ?? ""),
        margin: String(styles.margin ?? baseStyle.margin ?? ""),
        max_width: String(styles.max_width ?? baseStyle.max_width ?? ""),
        min_height: String(styles.min_height ?? baseStyle.min_height ?? ""),
        height: String(styles.height ?? baseStyle.height ?? ""),
        border_width: String(
          styles.border_width ?? baseStyle.border_width ?? "",
        ),
        content_gap: String(styles.content_gap ?? baseStyle.content_gap ?? ""),
        font_size: String(styles.font_size ?? baseStyle.font_size ?? ""),
        line_height: String(styles.line_height ?? baseStyle.line_height ?? ""),
        overlay_color: String(
          styles.overlay_color ?? baseStyle.overlay_color ?? "",
        ),
        overlay_opacity: String(
          styles.overlay_opacity ?? baseStyle.overlay_opacity ?? "",
        ),
        radius: clampNum(styles.radius ?? baseStyle.radius, 0, 60),
        title_size: clampNum(styles.title_size ?? baseStyle.title_size, 10, 64),
        title_weight: clampNum(
          styles.title_weight ?? baseStyle.title_weight,
          200,
          900,
        ),
        overlay: Math.max(
          0,
          Math.min(0.9, Number(styles.overlay ?? baseStyle.overlay) || 0),
        ),
        img_radius: clampNum(styles.img_radius ?? baseStyle.img_radius, 0, 60),
      },
    };
  }

  function updateExtraSection(idx, patch) {
    setBuilder((b) => {
      const arr = Array.isArray(b.extra_sections)
        ? b.extra_sections.slice()
        : [];
      const cur = ensureSectionShape(arr[idx]);
      const next = { ...cur, ...(patch || {}) };
      if (patch && isObj(patch.styles)) {
        next.styles = { ...(cur.styles || {}), ...(patch.styles || {}) };
      }
      arr[idx] = next;
      return { ...b, extra_sections: arr };
    });
  }

  // Phase 4G-C1: self-contained starter patterns. Inserted sections are ordinary
  // page-specific CMS blocks; no browser storage or new API endpoints are used.
  const sectionPatterns = [
    {
      key: "hero",
      name: "Hero / Welcome",
      description: "Headline, introduction, and call-to-action button",
      title: "Welcome",
      layout: "card",
      blocks: [
        {
          type: "richtext",
          html: "<h1>Welcome to Our Community</h1><p>Share your mission and invite visitors to explore.</p>",
        },
        {
          type: "button",
          text: "Learn More",
          href: "/about",
          align: "left",
          styles: {
            bg_color: "#FD9D00",
            text_color: "#0b0d12",
            padding: "12px 20px",
            radius: 12,
          },
        },
      ],
    },
    {
      key: "about",
      name: "About / Our Story",
      description: "Introduce your organization and its purpose",
      title: "Our Story",
      layout: "card",
      blocks: [
        {
          type: "richtext",
          html: "<h2>Who We Are</h2><p>Tell your visitors about your history, mission, and the people you serve.</p><p>Replace this example with your own story.</p>",
        },
      ],
    },
    {
      key: "columns",
      name: "Two-Column Introduction",
      description: "Split information into two balanced columns",
      title: "What We Do",
      layout: "two_columns",
      blocks: [
        {
          type: "richtext",
          html: "<h2>Our Mission</h2><p>Describe the impact you want to make.</p>",
        },
        {
          type: "button",
          text: "Get Involved",
          href: "/partnership",
          align: "left",
        },
      ],
    },
    {
      key: "gallery",
      name: "Image Gallery",
      description: "A ready-to-fill image gallery section",
      title: "Gallery",
      layout: "card",
      blocks: [
        {
          type: "richtext",
          html: "<h2>Moments That Matter</h2><p>Add your photos to the gallery below.</p>",
        },
        { type: "gallery", images: [], cols: 3, gap: 12 },
      ],
    },
    {
      key: "testimonials",
      name: "Testimonials",
      description: "Share a story or quote from your community",
      title: "Testimonials",
      layout: "card",
      blocks: [
        {
          type: "richtext",
          html: "<h2>What People Are Saying</h2><blockquote>“Add a meaningful testimonial here.”</blockquote><p><strong>— Community Member</strong></p>",
        },
      ],
    },
    {
      key: "contact",
      name: "Contact / Call to Action",
      description: "Help visitors take their next step",
      title: "Connect With Us",
      layout: "card",
      blocks: [
        {
          type: "richtext",
          html: "<h2>Let's Connect</h2><p>Have a question or want to learn more? We'd love to hear from you.</p>",
        },
        {
          type: "button",
          text: "Contact Us",
          href: "/contact",
          align: "left",
          styles: { bg_color: "#FD9D00", text_color: "#0b0d12" },
        },
      ],
    },
  ];

  function insertSectionPattern(pattern) {
    if (!pattern || !Array.isArray(pattern.blocks)) return;

    // Each insertion receives fresh IDs for the section and every nested block
    // object (shared cloneWithFreshIds helper). This prevents duplicated React
    // keys or accidental selection/edit coupling when the same template is
    // inserted more than once.
    const section = ensureSectionShape({
      id: uid(),
      title: pattern.title || "New Section",
      layout: pattern.layout || "card",
      theme: "default",
      collapsed: false,
      styles: defaultSectionStyle("default"),
      blocks: pattern.blocks.map((block) => {
        const cloned = cloneWithFreshIds(block);
        return { ...cloned, id: uid() };
      }),
    });

    setBuilder((current) => ({
      ...current,
      extra_sections: [
        ...(Array.isArray(current.extra_sections)
          ? current.extra_sections
          : []),
        section,
      ],
    }));
    setPatternLibraryOpen(false);
    toast(
      "success",
      "Template inserted",
      `${section.title} was added as an independent section. Customize it, then Save Draft.`,
    );
  }

  /* -----------------------------
     Phase 4G-C3: Reusable Section Library
     Phase 4G-C4: Template Management (preview, rename, categories, delete)
     Saved sections are snapshots stored by /api/admin/sections. Inserting one
     copies it into this page with fresh IDs, so the saved original and every
     other page stay unchanged. Renaming or deleting a saved section never
     changes a page that already contains a copy.
  ----------------------------- */
  async function loadSavedSections() {
    setSavedSectionsLoading(true);
    setSavedSectionsError("");
    try {
      const { data } = await api.get("/admin/sections");
      // Page templates (Release 1.2) are inserted from the visual editor only.
      setSavedSections(
        Array.isArray(data?.sections)
          ? data.sections.filter((x) => x?.kind !== "page")
          : [],
      );
    } catch (e) {
      setSavedSectionsError(pickErr(e, "Saved sections could not be loaded."));
    } finally {
      setSavedSectionsLoading(false);
    }
  }

  function openSavedSectionsTab() {
    setLibraryTab("saved");
    if (savedSections === null && !savedSectionsLoading) loadSavedSections();
  }

  const savedCategories = useMemo(() => {
    const names = new Set();
    (Array.isArray(savedSections) ? savedSections : []).forEach((x) => {
      const c = String(x?.category || "").trim();
      if (c) names.add(c);
    });
    return [...names].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [savedSections]);

  // Replaces the saved list and clears a category filter that no longer
  // matches anything (after a rename, recategorize or delete).
  function applySavedList(next) {
    setSavedSections(next);
    if (savedCategory === "all") return;
    const stillUsed =
      savedCategory === "__none"
        ? next.some((x) => !x.category)
        : next.some((x) => x.category === savedCategory);
    if (!stillUsed) setSavedCategory("all");
  }

  function normalizeName(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function validateNameCategory(name, category) {
    if (!name) return "Enter a name for this section.";
    if (name.length > 120) return "Names can be up to 120 characters.";
    if (category.length > 60) return "Categories can be up to 60 characters.";
    return "";
  }

  function openSaveSectionDialog(sec) {
    if (!sec) return;
    setSaveSectionDialog({
      section: JSON.parse(JSON.stringify(sec)),
      name: String(sec.title || "")
        .trim()
        .slice(0, 120),
      category:
        savedCategory !== "all" && savedCategory !== "__none"
          ? savedCategory
          : "",
      error: "",
    });
    // Load categories in the background so the category suggestions are ready.
    if (savedSections === null && !savedSectionsLoading) loadSavedSections();
  }

  function closeSaveSectionDialog() {
    if (savingSection) return;
    setSaveSectionDialog(null);
  }

  async function submitSaveSection() {
    const dialog = saveSectionDialog;
    if (!dialog || savingSection) return;
    const name = normalizeName(dialog.name);
    const category = normalizeName(dialog.category);
    const problem = validateNameCategory(name, category);
    if (problem) {
      setSaveSectionDialog({ ...dialog, error: problem });
      return;
    }
    setSavingSection(true);
    try {
      const { data } = await api.post("/admin/sections", {
        name,
        category,
        section: dialog.section,
      });
      const saved = data?.section;
      if (saved) {
        setSavedSections((list) =>
          Array.isArray(list)
            ? [saved, ...list.filter((x) => x.id !== saved.id)]
            : list,
        );
      }
      setSaveSectionDialog(null);
      toast(
        "success",
        "Saved to library",
        `“${name}” is now in Browse Templates → Saved sections. This page was not changed.`,
      );
    } catch (e) {
      setSaveSectionDialog({
        ...dialog,
        name,
        category,
        error: pickErr(e, "The section could not be saved. Try again."),
      });
    } finally {
      setSavingSection(false);
    }
  }

  async function fetchSavedSectionJson(item) {
    const { data } = await api.get(`/admin/sections/${item.id}`);
    const source = data?.section?.section_json;
    if (!isObj(source)) throw new Error("This saved section has no content.");
    return source;
  }

  function appendSectionCopy(source) {
    const copy = cloneWithFreshIds(source);
    delete copy.__template_kind;
    const section = ensureSectionShape({
      ...copy,
      id: uid(),
      collapsed: false,
    });
    setBuilder((current) => ({
      ...current,
      extra_sections: [
        ...(Array.isArray(current.extra_sections)
          ? current.extra_sections
          : []),
        section,
      ],
    }));
  }

  async function insertSavedSection(item, preloaded) {
    if (!item || insertingSavedId) return;
    setInsertingSavedId(item.id);
    try {
      const source = isObj(preloaded)
        ? preloaded
        : await fetchSavedSectionJson(item);
      appendSectionCopy(source);
      setTemplatePreview(null);
      setPatternLibraryOpen(false);
      toast(
        "success",
        "Saved section inserted",
        `“${item.name}” was added at the end of the page as an independent copy. Customize it, then Save Draft.`,
      );
    } catch (e) {
      toast(
        "error",
        "Section not inserted",
        pickErr(e, "The saved section could not be loaded. Try again."),
      );
    } finally {
      setInsertingSavedId(null);
    }
  }

  async function openSavedPreview(item) {
    if (!item) return;
    setTemplatePreview({
      kind: "saved",
      item,
      title: item.name,
      subtitle: item.category
        ? `Saved section · ${item.category}`
        : "Saved section",
      section: null,
      loading: true,
      error: "",
    });
    try {
      const source = await fetchSavedSectionJson(item);
      setTemplatePreview((cur) =>
        cur && cur.kind === "saved" && cur.item?.id === item.id
          ? { ...cur, section: source, loading: false }
          : cur,
      );
    } catch (e) {
      setTemplatePreview((cur) =>
        cur && cur.kind === "saved" && cur.item?.id === item.id
          ? {
              ...cur,
              loading: false,
              error: pickErr(e, "The preview could not be loaded. Try again."),
            }
          : cur,
      );
    }
  }

  function openStarterPreview(pattern) {
    if (!pattern) return;
    setTemplatePreview({
      kind: "starter",
      pattern,
      title: pattern.name,
      subtitle: "Built-in template",
      section: {
        title: pattern.title,
        layout: pattern.layout || "card",
        styles: defaultSectionStyle("default"),
        blocks: pattern.blocks,
      },
      loading: false,
      error: "",
    });
  }

  function closeTemplatePreview() {
    if (insertingSavedId) return;
    setTemplatePreview(null);
  }

  function insertFromPreview() {
    const pv = templatePreview;
    if (!pv) return;
    if (pv.kind === "starter") {
      setTemplatePreview(null);
      insertSectionPattern(pv.pattern);
    } else if (pv.item) {
      insertSavedSection(pv.item, pv.section);
    }
  }

  function openEditSavedDialog(item) {
    if (!item) return;
    setEditSavedDialog({
      item,
      name: item.name || "",
      category: item.category || "",
      error: "",
    });
  }

  function closeEditSavedDialog() {
    if (updatingSaved) return;
    setEditSavedDialog(null);
  }

  async function submitEditSaved() {
    const dialog = editSavedDialog;
    if (!dialog || updatingSaved) return;
    const name = normalizeName(dialog.name);
    const category = normalizeName(dialog.category);
    const problem = validateNameCategory(name, category);
    if (problem) {
      setEditSavedDialog({ ...dialog, error: problem });
      return;
    }
    if (
      name === dialog.item.name &&
      category === (dialog.item.category || "")
    ) {
      setEditSavedDialog(null);
      return;
    }
    setUpdatingSaved(true);
    try {
      const { data } = await api.patch(`/admin/sections/${dialog.item.id}`, {
        name,
        category,
      });
      const updated = data?.section;
      if (updated) {
        applySavedList(
          (Array.isArray(savedSections) ? savedSections : []).map((x) =>
            x.id === updated.id ? updated : x,
          ),
        );
      }
      setEditSavedDialog(null);
      toast("success", "Saved section updated", `Now named “${name}”.`);
    } catch (e) {
      setEditSavedDialog({
        ...dialog,
        name,
        category,
        error: pickErr(e, "The changes could not be saved. Try again."),
      });
    } finally {
      setUpdatingSaved(false);
    }
  }

  async function deleteSavedSection(item) {
    if (!item) return;
    setDeletingSavedId(item.id);
    try {
      await api.delete(`/admin/sections/${item.id}`);
      applySavedList(
        (Array.isArray(savedSections) ? savedSections : []).filter(
          (x) => x.id !== item.id,
        ),
      );
      setTemplatePreview((cur) =>
        cur && cur.kind === "saved" && cur.item?.id === item.id ? null : cur,
      );
      toast(
        "success",
        "Saved section deleted",
        `“${item.name}” was removed from the library. Pages that use a copy keep it.`,
      );
    } catch (e) {
      toast(
        "error",
        "Section not deleted",
        pickErr(e, "The saved section could not be deleted. Try again."),
      );
    } finally {
      setDeletingSavedId(null);
    }
  }

  function confirmDeleteSaved(item) {
    if (!item) return;
    openConfirm({
      title: `Delete “${item.name}”?`,
      message:
        "This removes it from the section library. Pages that already contain a copy of this section keep their copy.",
      confirmText: "Delete",
      danger: true,
      onConfirm: async () => {
        closeConfirm();
        await deleteSavedSection(item);
      },
    });
  }

  function formatSavedDate(value) {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function renderNameCategoryFields(dialog, setDialog, busy, onSubmit, idBase) {
    const onEnter = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onSubmit();
      }
    };
    return (
      <>
        <label className="ap-saveSectionLabel" htmlFor={`${idBase}Name`}>
          Name in library
        </label>
        <input
          id={`${idBase}Name`}
          className="ap-input"
          value={dialog.name}
          maxLength={120}
          autoFocus
          disabled={busy}
          onKeyDown={onEnter}
          onChange={(e) =>
            setDialog({ ...dialog, name: e.target.value, error: "" })
          }
          aria-invalid={dialog.error ? "true" : "false"}
          aria-describedby={dialog.error ? `${idBase}Error` : undefined}
        />
        <label className="ap-saveSectionLabel" htmlFor={`${idBase}Category`}>
          Category <span className="ap-optional">(optional)</span>
        </label>
        <input
          id={`${idBase}Category`}
          className="ap-input"
          value={dialog.category}
          maxLength={60}
          list="ap-savedCategoryOptions"
          placeholder="For example: Home, Events, Ministries"
          disabled={busy}
          onKeyDown={onEnter}
          onChange={(e) =>
            setDialog({ ...dialog, category: e.target.value, error: "" })
          }
        />
        <datalist id="ap-savedCategoryOptions">
          {savedCategories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {dialog.error ? (
          <div
            className="ap-saveSectionError"
            id={`${idBase}Error`}
            role="alert"
          >
            {dialog.error}
          </div>
        ) : null}
      </>
    );
  }

  function renderSaveSectionDialog() {
    const dialog = saveSectionDialog;
    if (!dialog) return null;
    const blocks = Array.isArray(dialog.section?.blocks)
      ? dialog.section.blocks
      : [];
    return (
      <div
        className="ap-modalOverlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-saveSectionTitle"
        onKeyDown={(e) => {
          if (e.key === "Escape") closeSaveSectionDialog();
        }}
      >
        <div className="ap-modal ap-saveSectionModal">
          <div className="ap-modalTitle" id="ap-saveSectionTitle">
            Save section to library
          </div>
          <div className="ap-modalMsg">
            Saves a copy of “{dialog.section?.title || "Untitled section"}” (
            {blocks.length} {blocks.length === 1 ? "block" : "blocks"}) so you
            can insert it on other pages. Later edits to this page won’t change
            the saved copy.
          </div>
          {renderNameCategoryFields(
            dialog,
            setSaveSectionDialog,
            savingSection,
            submitSaveSection,
            "ap-saveSection",
          )}
          <div className="ap-modalActions">
            <button
              className="ap-btn"
              type="button"
              onClick={closeSaveSectionDialog}
              disabled={savingSection}
            >
              Cancel
            </button>
            <button
              className="ap-btn ap-btnPrimary"
              type="button"
              onClick={submitSaveSection}
              disabled={savingSection}
            >
              {savingSection ? "Saving…" : "Save to library"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderEditSavedDialog() {
    const dialog = editSavedDialog;
    if (!dialog) return null;
    return (
      <div
        className="ap-modalOverlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-editSavedTitle"
        onKeyDown={(e) => {
          if (e.key === "Escape") closeEditSavedDialog();
        }}
      >
        <div className="ap-modal ap-saveSectionModal">
          <div className="ap-modalTitle" id="ap-editSavedTitle">
            Edit saved section details
          </div>
          <div className="ap-modalMsg">
            Changes the name and category in the library only. Pages that use
            this section are not affected.
          </div>
          {renderNameCategoryFields(
            dialog,
            setEditSavedDialog,
            updatingSaved,
            submitEditSaved,
            "ap-editSaved",
          )}
          <div className="ap-modalActions">
            <button
              className="ap-btn"
              type="button"
              onClick={closeEditSavedDialog}
              disabled={updatingSaved}
            >
              Cancel
            </button>
            <button
              className="ap-btn ap-btnPrimary"
              type="button"
              onClick={submitEditSaved}
              disabled={updatingSaved}
            >
              {updatingSaved ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderTemplatePreview() {
    const pv = templatePreview;
    if (!pv) return null;
    const busy = pv.kind === "saved" && insertingSavedId === pv.item?.id;
    return (
      <div
        className="ap-modalOverlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-templatePreviewTitle"
        onKeyDown={(e) => {
          if (e.key === "Escape") closeTemplatePreview();
        }}
      >
        <div className="ap-modal ap-templatePreviewModal">
          <div className="ap-templatePreviewHeader">
            <div>
              <div className="ap-modalTitle" id="ap-templatePreviewTitle">
                {pv.title}
              </div>
              <div className="ap-templatePreviewSub">{pv.subtitle}</div>
            </div>
          </div>
          <div className="ap-templatePreviewBody">
            {pv.loading ? (
              <div className="ap-savedEmpty" role="status">
                Loading preview…
              </div>
            ) : pv.error ? (
              <div className="ap-savedEmpty" role="alert">
                <p>{pv.error}</p>
                <button
                  type="button"
                  className="ap-btn"
                  onClick={() => openSavedPreview(pv.item)}
                >
                  Try again
                </button>
              </div>
            ) : (
              <APSectionPreview section={pv.section} />
            )}
          </div>
          <div className="ap-templatePreviewNote">
            Preview uses the editor’s styles. The published page uses your
            website design settings, so fonts and spacing may differ slightly.
          </div>
          <div className="ap-modalActions">
            <button
              type="button"
              className="ap-btn"
              onClick={closeTemplatePreview}
              autoFocus
            >
              Close
            </button>
            <button
              type="button"
              className="ap-btn ap-btnPrimary"
              onClick={insertFromPreview}
              disabled={pv.loading || !!pv.error || !!insertingSavedId}
            >
              {busy
                ? "Inserting…"
                : pv.kind === "starter"
                  ? "+ Insert template"
                  : "+ Insert section"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderSavedSectionsPanel() {
    if (savedSectionsLoading && savedSections === null) {
      return (
        <div className="ap-savedEmpty" role="status">
          Loading saved sections…
        </div>
      );
    }
    if (savedSectionsError && savedSections === null) {
      return (
        <div className="ap-savedEmpty" role="alert">
          <p>{savedSectionsError}</p>
          <button type="button" className="ap-btn" onClick={loadSavedSections}>
            Try again
          </button>
        </div>
      );
    }
    const all = Array.isArray(savedSections) ? savedSections : [];
    if (!all.length) {
      return (
        <div className="ap-savedEmpty">
          <strong>No saved sections yet</strong>
          <p>
            To reuse a section, click <b>Save to library</b> in its toolbar. It
            will appear here for every page.
          </p>
        </div>
      );
    }

    const q = savedSearch.trim().toLowerCase();
    const list = all.filter((item) => {
      const cat = String(item.category || "");
      if (savedCategory === "__none" && cat) return false;
      if (
        savedCategory !== "all" &&
        savedCategory !== "__none" &&
        cat !== savedCategory
      )
        return false;
      if (!q) return true;
      return [item.name, item.title, cat]
        .map((v) => String(v || "").toLowerCase())
        .some((v) => v.includes(q));
    });
    const hasUncategorized = all.some((x) => !x.category);

    return (
      <>
        {savedSectionsError ? (
          <div className="ap-saveSectionError" role="alert">
            {savedSectionsError}
          </div>
        ) : null}
        <div className="ap-savedFilters">
          <input
            className="ap-input"
            type="search"
            value={savedSearch}
            onChange={(e) => setSavedSearch(e.target.value)}
            placeholder="Search saved sections"
            aria-label="Search saved sections"
          />
          <select
            className="ap-input"
            value={savedCategory}
            onChange={(e) => setSavedCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {savedCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {hasUncategorized ? (
              <option value="__none">Uncategorized</option>
            ) : null}
          </select>
        </div>
        {!list.length ? (
          <div className="ap-savedEmpty">
            <strong>No saved sections match</strong>
            <p>Try a different search or category.</p>
            <button
              type="button"
              className="ap-btn"
              onClick={() => {
                setSavedSearch("");
                setSavedCategory("all");
              }}
            >
              Show all saved sections
            </button>
          </div>
        ) : (
          <div className="ap-patternGrid">
            {list.map((item) => {
              const inserting = insertingSavedId === item.id;
              const deleting = deletingSavedId === item.id;
              const types = Array.isArray(item.block_types)
                ? item.block_types
                : [];
              const date = formatSavedDate(item.updated_at || item.created_at);
              return (
                <div className="ap-patternCard ap-savedCard" key={item.id}>
                  <div className="ap-patternThumbnail" aria-hidden="true">
                    <span className="ap-patternThumbnailTitle">
                      {item.title || item.name}
                    </span>
                    <span className="ap-patternThumbnailLine" />
                    <span className="ap-patternThumbnailLine short" />
                    {types.includes("button") && (
                      <span className="ap-patternThumbnailButton" />
                    )}
                    {types.includes("gallery") && (
                      <span className="ap-patternThumbnailGallery">▦ ▦ ▦</span>
                    )}
                  </div>
                  <div className="ap-cardBadges">
                    <span className="ap-cardBadge custom">Custom</span>
                    {item.category ? (
                      <span className="ap-cardBadge">{item.category}</span>
                    ) : null}
                  </div>
                  <strong>{item.name}</strong>
                  <p>
                    {item.block_count}{" "}
                    {item.block_count === 1 ? "block" : "blocks"}
                    {date ? `, saved ${date}` : ""}
                  </p>
                  <div className="ap-cardActions">
                    <button
                      type="button"
                      className="ap-btn ap-btnPrimary"
                      onClick={() => insertSavedSection(item)}
                      disabled={!!insertingSavedId || deleting}
                      aria-busy={inserting ? "true" : "false"}
                    >
                      {inserting ? "Inserting…" : "+ Insert section"}
                    </button>
                    <div className="ap-cardSecondaryActions">
                      <button
                        type="button"
                        className="ap-btn"
                        onClick={() => openSavedPreview(item)}
                        disabled={deleting}
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        className="ap-btn"
                        onClick={() => openEditSavedDialog(item)}
                        disabled={deleting}
                        aria-label={`Edit details of ${item.name}`}
                      >
                        Edit details
                      </button>
                      <button
                        type="button"
                        className="ap-btn ap-btnDanger"
                        onClick={() => confirmDeleteSaved(item)}
                        disabled={deleting || inserting}
                        aria-label={`Delete ${item.name}`}
                      >
                        {deleting ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  function renderSectionPatternLibrary() {
    if (!patternLibraryOpen) return null;
    const onSaved = libraryTab === "saved";
    return (
      <div
        className="ap-patternLibrary"
        role="region"
        aria-label="Section library"
      >
        <div className="ap-patternLibraryHeader">
          <div>
            <strong>Section library</strong>
            <p>
              {onSaved
                ? "Sections you saved from any page. Inserting one adds an independent copy here; the saved original stays the same."
                : "Built-in starting layouts. Every inserted section is fully editable and independent."}
            </p>
          </div>
          <button
            type="button"
            className="ap-btn"
            onClick={() => setPatternLibraryOpen(false)}
          >
            Close
          </button>
        </div>
        <div className="ap-libraryTabs" role="tablist" aria-label="Library">
          <button
            type="button"
            role="tab"
            aria-selected={!onSaved}
            className={`ap-libraryTab ${!onSaved ? "active" : ""}`}
            onClick={() => setLibraryTab("templates")}
          >
            Starter templates
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={onSaved}
            className={`ap-libraryTab ${onSaved ? "active" : ""}`}
            onClick={openSavedSectionsTab}
          >
            Saved sections
            {Array.isArray(savedSections) && savedSections.length ? (
              <span className="ap-libraryCount">{savedSections.length}</span>
            ) : null}
          </button>
          {onSaved ? (
            <button
              type="button"
              className="ap-btn ap-libraryRefresh"
              onClick={loadSavedSections}
              disabled={savedSectionsLoading}
            >
              {savedSectionsLoading ? "Refreshing…" : "Refresh"}
            </button>
          ) : null}
        </div>
        {onSaved ? (
          renderSavedSectionsPanel()
        ) : (
          <div className="ap-patternGrid">
            {sectionPatterns.map((pattern) => (
              <div className="ap-patternCard" key={pattern.key}>
                <div className="ap-patternThumbnail" aria-hidden="true">
                  <span className="ap-patternThumbnailTitle">
                    {pattern.title}
                  </span>
                  <span className="ap-patternThumbnailLine" />
                  <span className="ap-patternThumbnailLine short" />
                  {pattern.blocks.some((b) => b.type === "button") && (
                    <span className="ap-patternThumbnailButton" />
                  )}
                  {pattern.blocks.some((b) => b.type === "gallery") && (
                    <span className="ap-patternThumbnailGallery">▦ ▦ ▦</span>
                  )}
                </div>
                <div className="ap-cardBadges">
                  <span className="ap-cardBadge">Built-in</span>
                </div>
                <strong>{pattern.name}</strong>
                <p>{pattern.description}</p>
                <div className="ap-cardActions">
                  <button
                    type="button"
                    className="ap-btn ap-btnPrimary"
                    onClick={() => insertSectionPattern(pattern)}
                  >
                    + Insert template
                  </button>
                  <div className="ap-cardSecondaryActions">
                    <button
                      type="button"
                      className="ap-btn"
                      onClick={() => openStarterPreview(pattern)}
                    >
                      Preview
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function addExtraSection() {
    setBuilder((b) => {
      const arr = Array.isArray(b.extra_sections)
        ? b.extra_sections.slice()
        : [];
      arr.push(
        ensureSectionShape({
          title: "New Section",
          html: "",
          collapsed: false,
          theme: "default",
          layout: "plain", // Phase 11: new sections start without a box
          styles: defaultSectionStyle("default"),
        }),
      );
      return { ...b, extra_sections: arr };
    });
    toast("success", "Section added", "Don’t forget to click Save Draft.");
  }

  function deleteExtraSection(idx) {
    setBuilder((b) => {
      const arr = Array.isArray(b.extra_sections)
        ? b.extra_sections.slice()
        : [];
      arr.splice(idx, 1);
      return { ...b, extra_sections: arr };
    });
  }

  // Phase 4G-B: duplicate sections with fresh identifiers, including nested blocks.
  function duplicateExtraSection(idx) {
    setBuilder((current) => {
      const sections = Array.isArray(current.extra_sections)
        ? [...current.extra_sections]
        : [];
      if (!sections[idx]) return current;
      const clone = cloneWithFreshIds(sections[idx]);
      clone.title = `${clone.title || "Section"} (Copy)`;
      sections.splice(idx + 1, 0, clone);
      return { ...current, extra_sections: sections };
    });
  }

  function moveExtraSection(idx, dir) {
    setBuilder((b) => {
      const arr = Array.isArray(b.extra_sections)
        ? b.extra_sections.slice()
        : [];
      const to = idx + dir;
      if (to < 0 || to >= arr.length) return b;
      const tmp = arr[idx];
      arr[idx] = arr[to];
      arr[to] = tmp;
      return { ...b, extra_sections: arr };
    });
  }

  function moveArrayItem(arr, from, to) {
    const a = Array.isArray(arr) ? arr.slice() : [];
    if (from < 0 || from >= a.length) return a;
    let t = Number(to);
    if (Number.isNaN(t)) t = from;
    if (t < 0) t = 0;
    if (t >= a.length) t = a.length - 1;
    const [it] = a.splice(from, 1);
    a.splice(t, 0, it);
    return a;
  }

  function reorderExtraSections(fromIdx, toIdx) {
    setBuilder((b) => {
      const arr = Array.isArray(b.extra_sections) ? b.extra_sections : [];
      const next = moveArrayItem(arr, fromIdx, toIdx);
      return { ...b, extra_sections: next };
    });
  }

  function reorderBlocks(sectionIdx, fromIdx, toIdx) {
    const cur = ensureSectionShape(
      (contentJson?.extra_sections || [])[sectionIdx],
    );
    const blocks = normalizeBlocksForSection(cur);
    const next = moveArrayItem(blocks, fromIdx, toIdx);
    updateSectionBlocks(sectionIdx, next);
  }

  // drag state
  const dragSectionRef = useRef({ idx: -1 });
  const dragBlockRef = useRef({ sectionIdx: -1, idx: -1 });

  /* -----------------------------
     Blocks / Elements (Grid, Gallery, etc.)
     Saved into content_json.extra_sections[i].blocks
     Back-compat: if blocks is empty, we keep using legacy html / left_html / right_html.
  ----------------------------- */
  function normalizeBlocksForSection(sec) {
    const s = ensureSectionShape(sec);
    const raw = Array.isArray(s.blocks) ? s.blocks : [];
    return raw
      .map((b) => (isObj(b) ? b : {}))
      .map((b) => ({
        id: String(b.id || uid()),
        type: String(b.type || "richtext"),
        ...b,
      }));
  }

  function updateSectionBlocks(idx, nextBlocks) {
    updateExtraSection(idx, {
      blocks: Array.isArray(nextBlocks) ? nextBlocks : [],
    });
  }

  function convertLegacyHtmlToBlocks(idx) {
    const cur = ensureSectionShape((contentJson?.extra_sections || [])[idx]);
    const existing = normalizeBlocksForSection(cur);
    if (existing.length) return;

    const isTwo = String(cur.layout || "card") === "two_columns";
    const blocks = [];

    if (isTwo) {
      const left = String(cur.left_html || "").trim();
      const right = String(cur.right_html || "").trim();
      if (left)
        blocks.push({ id: uid(), type: "richtext", html: cur.left_html || "" });
      if (right)
        blocks.push({
          id: uid(),
          type: "richtext",
          html: cur.right_html || "",
        });
      if (!blocks.length && String(cur.html || "").trim()) {
        blocks.push({ id: uid(), type: "richtext", html: cur.html || "" });
      }
    } else if (String(cur.html || "").trim()) {
      blocks.push({ id: uid(), type: "richtext", html: cur.html || "" });
    }

    if (!blocks.length) blocks.push({ id: uid(), type: "richtext", html: "" });

    updateSectionBlocks(idx, blocks);
    toast(
      "success",
      "Converted to Blocks",
      "Your legacy HTML is preserved, but blocks will be used for rendering.",
    );
  }

  // A fresh block of the given type (used by "+ Add block", the Elements panel
  // and drag-and-drop). "container" is a styled one-column Columns block.
  function newBlockOf(type) {
    if (type === "container") {
      return {
        id: uid(),
        type: "columns",
        variant: "container",
        gap: 14,
        stack_on_mobile: true,
        styles: {
          padding: "24px",
          bg_color: "",
          border_color: "",
          border_width: "",
          radius: 14,
        },
        columns: [{ id: uid(), width_pct: 100, styles: {}, blocks: [] }],
      };
    }
    return type === "grid"
      ? {
          id: uid(),
          type: "grid",
          cols: 3,
          gap: 12,
          items: [
            {
              id: uid(),
              title: "Card Title",
              text: "Card description…",
              image_url: "",
            },
          ],
        }
      : type === "gallery"
        ? {
            id: uid(),
            type: "gallery",
            cols: 4,
            gap: 10,
            images: [],
            items: [],
          }
        : type === "button"
          ? {
              id: uid(),
              type: "button",
              text: "Learn More",
              href: "/catalog",
              target: "",
              align: "left",
              variant: "solid", // solid | outline | ghost
              size: "md", // sm | md | lg
              styles: {
                padding: "12px 16px",
                radius: 14,
                bg_color: "#FD9D00",
                text_color: "#0b0d12",
                border_color: "rgba(255,255,255,0.12)",
                border_width: 1,
              },
            }
          : type === "columns"
            ? {
                id: uid(),
                type: "columns",
                gap: 14,
                stack_on_mobile: true,
                styles: {
                  padding: "",
                  bg_color: "",
                  border_color: "",
                  border_width: "",
                  radius: 14,
                },
                columns: [
                  {
                    id: uid(),
                    width_pct: 50,
                    styles: {
                      padding: "",
                      bg_color: "",
                      border_color: "",
                      border_width: "",
                      radius: 14,
                    },
                    blocks: [{ id: uid(), type: "richtext", html: "" }],
                  },
                  {
                    id: uid(),
                    width_pct: 50,
                    styles: {
                      padding: "",
                      bg_color: "",
                      border_color: "",
                      border_width: "",
                      radius: 14,
                    },
                    blocks: [{ id: uid(), type: "richtext", html: "" }],
                  },
                ],
              }
            : EXTRA_BLOCK_TYPES.has(type)
              ? defaultExtraBlock(type, uid) // Phase 5
              : {
                  id: uid(),
                  type: "richtext",
                  html: "<p>Add your text here.</p>",
                };
  }

  function addBlock(idx, type) {
    const cur = ensureSectionShape((contentJson?.extra_sections || [])[idx]);
    const blocks = normalizeBlocksForSection(cur);
    if (!blocks.length) convertLegacyHtmlToBlocks(idx);

    const base = newBlockOf(type);

    const next = normalizeBlocksForSection(
      ensureSectionShape((contentJson?.extra_sections || [])[idx]),
    );
    updateSectionBlocks(idx, [...next, base]);
  }

  function patchBlock(idx, blockId, patch) {
    const cur = ensureSectionShape((contentJson?.extra_sections || [])[idx]);
    const blocks = normalizeBlocksForSection(cur);
    const next = blocks.map((b) =>
      String(b.id) === String(blockId) ? { ...b, ...(patch || {}) } : b,
    );
    updateSectionBlocks(idx, next);
  }

  function deleteBlock(idx, blockId) {
    const cur = ensureSectionShape((contentJson?.extra_sections || [])[idx]);
    const blocks = normalizeBlocksForSection(cur);
    updateSectionBlocks(
      idx,
      blocks.filter((b) => String(b.id) !== String(blockId)),
    );
  }

  function duplicateBlock(idx, blockId) {
    const section = ensureSectionShape(
      (contentJson?.extra_sections || [])[idx],
    );
    const blocks = normalizeBlocksForSection(section);
    const position = blocks.findIndex(
      (block) => String(block.id) === String(blockId),
    );
    if (position < 0) return;
    const copy = cloneWithFreshIds(blocks[position]);
    const next = blocks.slice();
    next.splice(position + 1, 0, copy);
    updateSectionBlocks(idx, next);
  }

  function moveBlock(idx, blockId, dir) {
    const cur = ensureSectionShape((contentJson?.extra_sections || [])[idx]);
    const blocks = normalizeBlocksForSection(cur);
    const i = blocks.findIndex((b) => String(b.id) === String(blockId));
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = blocks.slice();
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
    updateSectionBlocks(idx, next);
  }

  /* -----------------------------
   Columns block (nested blocks)
   block.type === "columns"
   Shape:
     { id, type:"columns", gap, stack_on_mobile, styles, columns:[{id,width_pct,styles,blocks:[...]}, ...] }
----------------------------- */
  function normalizeBlocksArray(arr) {
    const raw = Array.isArray(arr) ? arr : [];
    return raw
      .map((b) => (isObj(b) ? b : {}))
      .map((b) => ({
        id: String(b.id || uid()),
        type: String(b.type || "richtext"),
        ...b,
      }));
  }

  function normalizeColumnsBlock(block) {
    const b = isObj(block) ? block : {};
    const cols = Array.isArray(b.columns) ? b.columns : [];
    const columns = cols.map((c) => {
      const cc = isObj(c) ? c : {};
      return {
        id: String(cc.id || uid()),
        width_pct: clampNum(cc.width_pct ?? 50, 10, 90),
        styles: isObj(cc.styles) ? cc.styles : {},
        blocks: normalizeBlocksArray(cc.blocks),
      };
    });

    if (!columns.length) {
      return {
        ...b,
        columns: [
          {
            id: uid(),
            width_pct: 50,
            styles: {},
            blocks: [{ id: uid(), type: "richtext", html: "" }],
          },
          {
            id: uid(),
            width_pct: 50,
            styles: {},
            blocks: [{ id: uid(), type: "richtext", html: "" }],
          },
        ],
      };
    }
    return { ...b, columns };
  }

  function updateColumnsBlock(sectionIdx, columnsBlockId, updater) {
    const cur = ensureSectionShape(
      (contentJson?.extra_sections || [])[sectionIdx],
    );
    const blocks = normalizeBlocksForSection(cur);

    const next = blocks.map((blk) => {
      if (String(blk.id) !== String(columnsBlockId)) return blk;
      const norm = normalizeColumnsBlock(blk);
      const updated = typeof updater === "function" ? updater(norm) : norm;
      return isObj(updated) ? updated : norm;
    });

    updateSectionBlocks(sectionIdx, next);
  }

  function addColumn(sectionIdx, columnsBlockId) {
    updateColumnsBlock(sectionIdx, columnsBlockId, (blk) => {
      const cols = Array.isArray(blk.columns) ? blk.columns.slice() : [];
      cols.push({
        id: uid(),
        width_pct: 50,
        styles: {},
        blocks: [{ id: uid(), type: "richtext", html: "" }],
      });
      return { ...blk, columns: cols };
    });
  }

  function deleteColumn(sectionIdx, columnsBlockId, colId) {
    updateColumnsBlock(sectionIdx, columnsBlockId, (blk) => {
      const cols = Array.isArray(blk.columns) ? blk.columns.slice() : [];
      const nextCols = cols.filter((c) => String(c.id) !== String(colId));
      return { ...blk, columns: nextCols.length ? nextCols : cols };
    });
  }

  function moveColumn(sectionIdx, columnsBlockId, fromIdx, toIdx) {
    updateColumnsBlock(sectionIdx, columnsBlockId, (blk) => {
      const cols = Array.isArray(blk.columns) ? blk.columns : [];
      return { ...blk, columns: moveArrayItem(cols, fromIdx, toIdx) };
    });
  }

  function patchColumn(sectionIdx, columnsBlockId, colId, patch) {
    updateColumnsBlock(sectionIdx, columnsBlockId, (blk) => {
      const cols = Array.isArray(blk.columns) ? blk.columns : [];
      const nextCols = cols.map((c) =>
        String(c.id) === String(colId) ? { ...c, ...(patch || {}) } : c,
      );
      return { ...blk, columns: nextCols };
    });
  }

  function addColumnBlock(sectionIdx, columnsBlockId, colId, type) {
    updateColumnsBlock(sectionIdx, columnsBlockId, (blk) => {
      const cols = Array.isArray(blk.columns) ? blk.columns : [];
      const nextCols = cols.map((c) => {
        if (String(c.id) !== String(colId)) return c;
        const blocks = normalizeBlocksArray(c.blocks);

        const base =
          type === "grid"
            ? {
                id: uid(),
                type: "grid",
                cols: 3,
                gap: 12,
                items: [
                  {
                    id: uid(),
                    title: "Card Title",
                    text: "Card description…",
                    image_url: "",
                  },
                ],
              }
            : type === "gallery"
              ? {
                  id: uid(),
                  type: "gallery",
                  cols: 4,
                  gap: 10,
                  images: [],
                  items: [],
                }
              : type === "button"
                ? {
                    id: uid(),
                    type: "button",
                    text: "Learn More",
                    href: "/catalog",
                    target: "",
                    align: "left",
                    variant: "solid",
                    size: "md",
                    styles: {
                      padding: "12px 16px",
                      radius: 14,
                      bg_color: "#FD9D00",
                      text_color: "#0b0d12",
                      border_color: "rgba(255,255,255,0.12)",
                      border_width: 1,
                    },
                  }
                : EXTRA_BLOCK_TYPES.has(type)
                  ? defaultExtraBlock(type, uid) // Phase 5 blocks inside columns too
                  : {
                      id: uid(),
                      type: "richtext",
                      html: "<p>Add your text here.</p>",
                    };

        return { ...c, blocks: [...blocks, base] };
      });
      return { ...blk, columns: nextCols };
    });
  }

  function patchColumnBlock(
    sectionIdx,
    columnsBlockId,
    colId,
    innerBlockId,
    patch,
  ) {
    updateColumnsBlock(sectionIdx, columnsBlockId, (blk) => {
      const nextCols = (blk.columns || []).map((c) => {
        if (String(c.id) !== String(colId)) return c;
        const blocks = normalizeBlocksArray(c.blocks).map((b) =>
          String(b.id) === String(innerBlockId)
            ? { ...b, ...(patch || {}) }
            : b,
        );
        return { ...c, blocks };
      });
      return { ...blk, columns: nextCols };
    });
  }

  function deleteColumnBlock(sectionIdx, columnsBlockId, colId, innerBlockId) {
    updateColumnsBlock(sectionIdx, columnsBlockId, (blk) => {
      const nextCols = (blk.columns || []).map((c) => {
        if (String(c.id) !== String(colId)) return c;
        const blocks = normalizeBlocksArray(c.blocks).filter(
          (b) => String(b.id) !== String(innerBlockId),
        );
        return { ...c, blocks };
      });
      return { ...blk, columns: nextCols };
    });
  }

  function moveColumnBlock(
    sectionIdx,
    columnsBlockId,
    colId,
    innerBlockId,
    dir,
  ) {
    updateColumnsBlock(sectionIdx, columnsBlockId, (blk) => {
      const nextCols = (blk.columns || []).map((c) => {
        if (String(c.id) !== String(colId)) return c;
        const blocks = normalizeBlocksArray(c.blocks);
        const i = blocks.findIndex(
          (b) => String(b.id) === String(innerBlockId),
        );
        const j = i + dir;
        if (i < 0 || j < 0 || j >= blocks.length) return c;
        const nextBlocks = blocks.slice();
        const tmp = nextBlocks[i];
        nextBlocks[i] = nextBlocks[j];
        nextBlocks[j] = tmp;
        return { ...c, blocks: nextBlocks };
      });
      return { ...blk, columns: nextCols };
    });
  }

  function moveColumnGalleryImage(
    sectionIdx,
    columnsBlockId,
    colId,
    galleryBlockId,
    imgId,
    dir,
  ) {
    updateColumnsBlock(sectionIdx, columnsBlockId, (blk) => {
      const nextCols = (blk.columns || []).map((c) => {
        if (String(c.id) !== String(colId)) return c;
        const blocks = normalizeBlocksArray(c.blocks).map((b) => {
          if (String(b.id) !== String(galleryBlockId)) return b;
          const images = Array.isArray(b.images) ? b.images.slice() : [];
          const i = images.findIndex((im) => String(im.id) === String(imgId));
          const j = i + dir;
          if (i < 0 || j < 0 || j >= images.length) return b;
          const nextImages = images.slice();
          const tmp = nextImages[i];
          nextImages[i] = nextImages[j];
          nextImages[j] = tmp;
          return { ...b, images: nextImages, items: nextImages };
        });
        return { ...c, blocks };
      });
      return { ...blk, columns: nextCols };
    });
  }

  function addColumnGridItem(sectionIdx, columnsBlockId, colId, gridBlockId) {
    patchColumnBlock(
      sectionIdx,
      columnsBlockId,
      colId,
      gridBlockId,
      (prev) => prev,
    );
    updateColumnsBlock(sectionIdx, columnsBlockId, (blk) => {
      const nextCols = (blk.columns || []).map((c) => {
        if (String(c.id) !== String(colId)) return c;
        const blocks = normalizeBlocksArray(c.blocks).map((b) => {
          if (String(b.id) !== String(gridBlockId)) return b;
          const items = Array.isArray(b.items) ? b.items.slice() : [];
          items.push({
            id: uid(),
            title: "Card Title",
            text: "Card description…",
            image_url: "",
          });
          return { ...b, items };
        });
        return { ...c, blocks };
      });
      return { ...blk, columns: nextCols };
    });
  }

  function patchColumnGridItem(
    sectionIdx,
    columnsBlockId,
    colId,
    gridBlockId,
    itemId,
    patch,
  ) {
    updateColumnsBlock(sectionIdx, columnsBlockId, (blk) => {
      const nextCols = (blk.columns || []).map((c) => {
        if (String(c.id) !== String(colId)) return c;
        const blocks = normalizeBlocksArray(c.blocks).map((b) => {
          if (String(b.id) !== String(gridBlockId)) return b;
          const items = Array.isArray(b.items) ? b.items : [];
          return {
            ...b,
            items: items.map((it) =>
              String(it.id) === String(itemId)
                ? { ...it, ...(patch || {}) }
                : it,
            ),
          };
        });
        return { ...c, blocks };
      });
      return { ...blk, columns: nextCols };
    });
  }

  function deleteColumnGridItem(
    sectionIdx,
    columnsBlockId,
    colId,
    gridBlockId,
    itemId,
  ) {
    updateColumnsBlock(sectionIdx, columnsBlockId, (blk) => {
      const nextCols = (blk.columns || []).map((c) => {
        if (String(c.id) !== String(colId)) return c;
        const blocks = normalizeBlocksArray(c.blocks).map((b) => {
          if (String(b.id) !== String(gridBlockId)) return b;
          const items = Array.isArray(b.items) ? b.items : [];
          return {
            ...b,
            items: items.filter((it) => String(it.id) !== String(itemId)),
          };
        });
        return { ...c, blocks };
      });
      return { ...blk, columns: nextCols };
    });
  }

  async function uploadColumnGridItemImage(
    sectionIdx,
    columnsBlockId,
    colId,
    gridBlockId,
    itemId,
    file,
  ) {
    if (!file) return;
    setSaving(true);
    try {
      const url = await uploadImage(file, "inline");
      patchColumnGridItem(
        sectionIdx,
        columnsBlockId,
        colId,
        gridBlockId,
        itemId,
        { image_url: url },
      );
      toast("success", "Image added", "Save Draft to publish changes.");
    } catch (e) {
      toast("error", "Upload failed", pickErr(e, "Upload failed"));
    } finally {
      setUploading(false);
      setUploadLabel("Uploading…");
      setSaving(false);
    }
  }

  async function addColumnGalleryImages(
    sectionIdx,
    columnsBlockId,
    colId,
    galleryBlockId,
    files,
  ) {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    // Phase 4H-2: images picked from the Media Library are added, not uploaded.
    const fromLibrary = list.every((f) => f && f.__fromLibrary);
    const countLabel = `${list.length} image${list.length === 1 ? "" : "s"}`;
    setUploading(true);
    setUploadLabel(
      fromLibrary ? `Adding ${countLabel}…` : `Uploading ${countLabel}…`,
    );
    if (!fromLibrary) {
      toast("info", "Uploading…", `Uploading ${countLabel} to Bunny…`);
    }
    setSaving(true);
    try {
      const urls = [];
      const alts = [];
      for (const f of list) {
        // eslint-disable-next-line no-await-in-loop
        const url = await uploadImage(f, "gallery");
        urls.push(url);
        alts.push(f && f.__fromLibrary ? String(f.alt || "") : "");
      }

      updateColumnsBlock(sectionIdx, columnsBlockId, (blk) => {
        const nextCols = (blk.columns || []).map((c) => {
          if (String(c.id) !== String(colId)) return c;
          const blocks = normalizeBlocksArray(c.blocks).map((b) => {
            if (String(b.id) !== String(galleryBlockId)) return b;
            const base = Array.isArray(b.images)
              ? b.images
              : Array.isArray(b.items)
                ? b.items
                : [];
            const images = base.slice();
            urls.forEach((u, i) => {
              images.push({
                id: uid(),
                url: u,
                src: u,
                image_url: u,
                alt: alts[i] || "",
              });
            });
            return { ...b, images, items: images };
          });
          return { ...c, blocks };
        });
        return { ...blk, columns: nextCols };
      });

      toast("success", "Gallery updated", "Save Draft to publish changes.");
    } catch (e) {
      toast("error", "Upload failed", pickErr(e, "Upload failed"));
    } finally {
      setUploading(false);
      setUploadLabel("Uploading…");
      setSaving(false);
    }
  }

  function patchColumnGalleryImage(
    sectionIdx,
    columnsBlockId,
    colId,
    galleryBlockId,
    imgId,
    patch,
  ) {
    updateColumnsBlock(sectionIdx, columnsBlockId, (blk) => {
      const nextCols = (blk.columns || []).map((c) => {
        if (String(c.id) !== String(colId)) return c;
        const blocks = normalizeBlocksArray(c.blocks).map((b) => {
          if (String(b.id) !== String(galleryBlockId)) return b;
          const images = Array.isArray(b.images) ? b.images : [];
          return {
            ...b,
            images: images.map((im) =>
              String(im.id) === String(imgId)
                ? { ...im, ...(patch || {}) }
                : im,
            ),
            items: images.map((im) =>
              String(im.id) === String(imgId)
                ? { ...im, ...(patch || {}) }
                : im,
            ),
          };
        });
        return { ...c, blocks };
      });
      return { ...blk, columns: nextCols };
    });
  }

  function deleteColumnGalleryImage(
    sectionIdx,
    columnsBlockId,
    colId,
    galleryBlockId,
    imgId,
  ) {
    updateColumnsBlock(sectionIdx, columnsBlockId, (blk) => {
      const nextCols = (blk.columns || []).map((c) => {
        if (String(c.id) !== String(colId)) return c;
        const blocks = normalizeBlocksArray(c.blocks).map((b) => {
          if (String(b.id) !== String(galleryBlockId)) return b;
          const images = Array.isArray(b.images) ? b.images : [];
          const nextImages = images.filter(
            (im) => String(im.id) !== String(imgId),
          );
          return { ...b, images: nextImages, items: nextImages };
        });
        return { ...c, blocks };
      });
      return { ...blk, columns: nextCols };
    });
  }

  function addGridItem(idx, blockId) {
    const cur = ensureSectionShape((contentJson?.extra_sections || [])[idx]);
    const blocks = normalizeBlocksForSection(cur);
    const next = blocks.map((b) => {
      if (String(b.id) !== String(blockId)) return b;
      const items = Array.isArray(b.items) ? b.items.slice() : [];
      items.push({
        id: uid(),
        title: "Card Title",
        text: "Card description…",
        image_url: "",
      });
      return { ...b, items };
    });
    updateSectionBlocks(idx, next);
  }

  function patchGridItem(idx, blockId, itemId, patch) {
    const cur = ensureSectionShape((contentJson?.extra_sections || [])[idx]);
    const blocks = normalizeBlocksForSection(cur);
    const next = blocks.map((b) => {
      if (String(b.id) !== String(blockId)) return b;
      const items = Array.isArray(b.items) ? b.items : [];
      return {
        ...b,
        items: items.map((it) =>
          String(it.id) === String(itemId) ? { ...it, ...(patch || {}) } : it,
        ),
      };
    });
    updateSectionBlocks(idx, next);
  }

  function deleteGridItem(idx, blockId, itemId) {
    const cur = ensureSectionShape((contentJson?.extra_sections || [])[idx]);
    const blocks = normalizeBlocksForSection(cur);
    const next = blocks.map((b) => {
      if (String(b.id) !== String(blockId)) return b;
      const items = Array.isArray(b.items) ? b.items : [];
      return {
        ...b,
        items: items.filter((it) => String(it.id) !== String(itemId)),
      };
    });
    updateSectionBlocks(idx, next);
  }

  async function uploadGridItemImage(idx, blockId, itemId, file) {
    if (!file) return;
    setSaving(true);
    try {
      const url = await uploadImage(file, "inline");
      patchGridItem(idx, blockId, itemId, { image_url: url });
      toast("success", "Image added", "Save Draft to publish changes.");
    } catch (e) {
      toast("error", "Upload failed", pickErr(e, "Upload failed"));
    } finally {
      setUploading(false);
      setUploadLabel("Uploading…");
      setSaving(false);
    }
  }

  async function addGalleryImages(idx, blockId, files) {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    // Phase 4H-2: images picked from the Media Library are added, not uploaded.
    const fromLibrary = list.every((f) => f && f.__fromLibrary);
    const countLabel = `${list.length} image${list.length === 1 ? "" : "s"}`;
    setUploading(true);
    setUploadLabel(
      fromLibrary ? `Adding ${countLabel}…` : `Uploading ${countLabel}…`,
    );
    if (!fromLibrary) {
      toast("info", "Uploading…", `Uploading ${countLabel} to Bunny…`);
    }
    setSaving(true);
    try {
      const urls = [];
      const alts = [];
      for (const f of list) {
        // eslint-disable-next-line no-await-in-loop
        const url = await uploadImage(f, "gallery");
        urls.push(url);
        alts.push(f && f.__fromLibrary ? String(f.alt || "") : "");
      }

      // IMPORTANT: update via builder state (not contentJson snapshot)
      // so the editor preview updates immediately and persists on save.
      setBuilder((b) => {
        const next = { ...(b || {}) };
        const secs = Array.isArray(next.extra_sections)
          ? next.extra_sections.slice()
          : [];
        const sec = ensureSectionShape(secs[idx]);
        const blocks = normalizeBlocksForSection(sec);

        const updatedBlocks = blocks.map((blk) => {
          if (String(blk.id) !== String(blockId)) return blk;

          const base = Array.isArray(blk.images)
            ? blk.images
            : Array.isArray(blk.items)
              ? blk.items
              : [];

          const images = base.slice();
          urls.forEach((u, i) => {
            images.push({
              id: uid(),
              url: u,
              src: u,
              image_url: u,
              alt: alts[i] || "",
            });
          });

          // Write to BOTH keys for max compatibility.
          return { ...blk, images, items: images };
        });

        secs[idx] = { ...sec, blocks: updatedBlocks };
        next.extra_sections = secs;
        return next;
      });

      toast("success", "Gallery updated", "Save Draft to publish changes.");
    } catch (e) {
      toast("error", "Upload failed", pickErr(e, "Upload failed"));
    } finally {
      setUploading(false);
      setUploadLabel("Uploading…");
      setSaving(false);
    }
  }

  function patchGalleryImage(idx, blockId, imgId, patch) {
    const cur = ensureSectionShape((contentJson?.extra_sections || [])[idx]);
    const blocks = normalizeBlocksForSection(cur);
    const next = blocks.map((b) => {
      if (String(b.id) !== String(blockId)) return b;
      const images = Array.isArray(b.images) ? b.images : [];
      return {
        ...b,
        images: images.map((im) =>
          String(im.id) === String(imgId) ? { ...im, ...(patch || {}) } : im,
        ),
      };
    });
    updateSectionBlocks(idx, next);
  }

  function deleteGalleryImage(idx, blockId, imgId) {
    const cur = ensureSectionShape((contentJson?.extra_sections || [])[idx]);
    const blocks = normalizeBlocksForSection(cur);
    const next = blocks.map((b) => {
      if (String(b.id) !== String(blockId)) return b;
      const images = Array.isArray(b.images) ? b.images : [];
      return {
        ...b,
        images: images.filter((im) => String(im.id) !== String(imgId)),
      };
    });
    updateSectionBlocks(idx, next);
  }

  function moveGalleryImage(idx, blockId, imgId, dir) {
    const cur = ensureSectionShape((contentJson?.extra_sections || [])[idx]);
    const blocks = normalizeBlocksForSection(cur);
    const next = blocks.map((b) => {
      if (String(b.id) !== String(blockId)) return b;
      const images = Array.isArray(b.images) ? b.images.slice() : [];
      const i = images.findIndex((im) => String(im.id) === String(imgId));
      const j = i + dir;
      if (i < 0 || j < 0 || j >= images.length) return b;
      const tmp = images[i];
      images[i] = images[j];
      images[j] = tmp;
      return { ...b, images, items: images };
    });
    updateSectionBlocks(idx, next);
  }

  function clearBlocksUseLegacy(idx) {
    openConfirm({
      title: "Use legacy HTML?",
      message:
        "This will remove all blocks from this section. The legacy HTML fields will be used again (your previous HTML is still saved).",
      confirmText: "Use Legacy",
      danger: true,
      onConfirm: async () => {
        closeConfirm();
        updateSectionBlocks(idx, []);
      },
    });
  }

  /* -----------------------------
     Upload handler used by Hero upload + editor image upload
  ----------------------------- */
  const uploadImage = useCallback(async (file, kind = "inline") => {
    if (!file) throw new Error("No file selected");
    // Phase 4H-2: an image chosen from the Media Library is already stored;
    // use its address as-is (no upload).
    if (file.__fromLibrary) {
      if (!file.url) throw new Error("This library image has no address.");
      return file.url;
    }
    if (!String(file.type || "").startsWith("image/")) {
      throw new Error("Please choose an image file.");
    }
    const url = await uploadPageImage(file, kind);
    return url;
  }, []);

  async function insertImageIntoSection(idx, file) {
    if (!file) return;

    setSaving(true);
    try {
      const url = await uploadImage(file, "inline");
      const tag = `<p><img src="${url}" alt="" style="max-width:100%;height:auto;" /></p>`;

      setBuilder((b) => {
        const arr = Array.isArray(b.extra_sections)
          ? b.extra_sections.slice()
          : [];
        const cur = ensureSectionShape(arr[idx]);
        const isTwoCols = String(cur.layout || "card") === "two_columns";

        if (isTwoCols) {
          arr[idx] = {
            ...cur,
            left_html: `${cur.left_html || ""}${cur.left_html ? "\n" : ""}${tag}`,
          };
        } else {
          arr[idx] = {
            ...cur,
            html: `${cur.html || ""}${cur.html ? "\n" : ""}${tag}`,
          };
        }

        return { ...b, extra_sections: arr };
      });

      toast("success", "Image inserted", "Save Draft to publish changes.");
    } catch (e) {
      toast("error", "Upload failed", pickErr(e, "Upload failed"));
    } finally {
      setUploading(false);
      setUploadLabel("Uploading…");
      setSaving(false);
    }
  }

  async function uploadSectionBackground(idx, file) {
    if (!file) return;

    setSaving(true);
    try {
      const url = await uploadImage(file, "inline");
      updateExtraSection(idx, { styles: { bg_image_url: url || "" } });
      toast("success", "Background set", "Save Draft to publish changes.");
    } catch (e) {
      toast("error", "Upload failed", pickErr(e, "Upload failed"));
    } finally {
      setUploading(false);
      setUploadLabel("Uploading…");
      setSaving(false);
    }
  }

  /* -----------------------------
     Compute styleSection EARLY (no hooks after early returns)
  ----------------------------- */
  const styleSection = useMemo(() => {
    const model =
      templateType === "home"
        ? deepMergeHomeDefaults(contentJson || {})
        : ensureGenericModel(contentJson || {});
    const arr = Array.isArray(model.extra_sections) ? model.extra_sections : [];
    const idx = Number(styleModal.idx);
    if (Number.isNaN(idx) || idx < 0 || idx >= arr.length) return null;
    return ensureSectionShape(arr[idx]);
    // ensureSectionShape is pure (it only reshapes the section it is given)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateType, contentJson, styleModal.idx]);

  /* -----------------------------
     Load page
  ----------------------------- */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/pages/${id}`);
      // Old bundled-picture addresses → this site's own files (saved on next save).
      const p = upgradeAssets(r.data.page);

      setPage(p);
      setTitle(p.title || "");
      setSlug(p.slug || "");
      setExcerpt(p.excerpt || "");
      setSeo(seoFromPage(p));
      setHero(p.hero_image_url || "");
      setContentHtml(p.content_html || "");

      const rawJson = p.content_json || {};
      const nextTemplate = detectTemplateType(p.slug);

      // Home uses its core sections; all other pages are generic builder pages.
      let nextJson =
        nextTemplate === "home"
          ? deepMergeHomeDefaults(rawJson)
          : ensureGenericModel(rawJson);

      // Auto-seed: convert legacy templates (e.g., About.js) into editable builder blocks
      const seed = seedBlocksForSlug(p.slug);
      const needsSeed =
        !!seed &&
        (!Array.isArray(nextJson.extra_sections) ||
          nextJson.extra_sections.length === 0);
      if (needsSeed) {
        nextJson.extra_sections = seed.map(ensureSectionShape);
      }

      // Auto-clean: if a non-home page accidentally has Home core blocks injected, strip them and persist silently.
      if (nextTemplate !== "home" && hasHomeBlocks(nextJson)) {
        const cleaned = stripHomeBlocksFromGeneric(nextJson);
        // only persist if something changed
        if (stableStringify(cleaned) !== stableStringify(nextJson)) {
          nextJson = cleaned;
          try {
            await api.put(`/admin/pages/${id}`, {
              title: String(p.title || "").trim(),
              slug: String(p.slug || "").trim(),
              excerpt: p.excerpt || null,
              hero_image_url: p.hero_image_url || null,
              content_html: p.content_html || "",
              content_json: nextJson ?? null,
            });
          } catch (e) {
            // if cleanup save fails, we still proceed with cleaned state locally
            // (user can manually Save Draft later)
          }
        }
      }

      setContentJson(nextJson);

      // Reset undo/redo history on load
      historyRef.current = [];
      futureRef.current = [];
      prevContentJsonRef.current = cloneJson(nextJson);
      bumpHistory();

      // mark current state as "saved" (prevents unload prompt after a successful load)
      lastSavedRef.current = stableStringify({
        title: String(p.title || ""),
        slug: String(p.slug || ""),
        excerpt: String(p.excerpt || ""),
        hero: String(p.hero_image_url || ""),
        contentHtml: String(p.content_html || ""),
        contentJson: nextJson,
        templateType: String(nextTemplate || ""),
        seo: seoFromPage(p),
      });
      hasLoadedRef.current = true;
    } catch (e) {
      toast("error", "Failed to load page", pickErr(e, "Load failed"));
    } finally {
      setLoading(false);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const dirty =
    hasLoadedRef.current && makeSnapshot() !== (lastSavedRef.current || "");

  // Warn on refresh/close if dirty
  useEffect(() => {
    function onBeforeUnload(e) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const saveDraft = useCallback(async () => {
    if (!page) return;
    setSaving(true);
    try {
      const finalSlug = slugify(slug || title);

      const payload = {
        title: String(title || "").trim(),
        slug: finalSlug,
        excerpt: excerpt || null,
        hero_image_url: hero || null,
        content_html: contentHtml || "",
        content_json: contentJson ?? null,
        seo_title: seo.title.trim(),
        seo_description: seo.description.trim(),
        seo_image_url: seo.image.trim(),
        seo_noindex: !!seo.noindex,
      };

      const r = await api.put(`/admin/pages/${id}`, payload);
      setPage(r.data.page);
      setSlug(r.data.page.slug || finalSlug);

      // Save Draft must never publish automatically. Publishing is a separate action.
      // update "saved" snapshot so refresh prompts only appear when truly unsaved
      lastSavedRef.current = stableStringify({
        title: payload.title,
        slug: String(r.data.page.slug || finalSlug),
        excerpt: String(excerpt || ""),
        hero: String(hero || ""),
        contentHtml: String(contentHtml || ""),
        contentJson: payload.content_json ?? null,
        templateType: String(templateType || ""),
        seo: normalizeSeo(seo),
      });

      toast("success", "Saved", "Draft changes saved successfully.");
      return true;
    } catch (e) {
      toast("error", "Save failed", pickErr(e, "Save failed"));
      return false;
    } finally {
      setSaving(false);
    }
  }, [page, id, slug, title, excerpt, hero, contentHtml, contentJson, seo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl/Cmd+S shortcut
  useEffect(() => {
    function onKeyDown(e) {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      const key = String(e.key || "").toLowerCase();

      // Undo / Redo shortcuts
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          if (!saving) redo();
        } else {
          if (!saving) undo();
        }
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        if (!saving) redo();
        return;
      }

      // Save shortcut
      if (mod && key === "s") {
        e.preventDefault();
        if (!saving) saveDraft();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveDraft, undo, redo, saving]);

  /* -----------------------------
     Phase 4E: safe editing
     - Preview shows what is on screen (saves the draft first when needed).
     - Leaving the editor with unsaved changes asks first.
     - Unsaved changes are backed up in this browser and can be restored.
  ----------------------------- */
  const backupKey = `brtv:pageDraftBackup:${id}`;
  const previewUrlRef = useRef("");
  const [leavePrompt, setLeavePrompt] = useState(null); // { to } | null
  const [leaving, setLeaving] = useState(false);
  const [recovery, setRecovery] = useState(null); // { savedAt, data, newerOnServer }
  const [backupReady, setBackupReady] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  async function openPreview() {
    // Open the tab right away (inside the click) so pop-up blockers allow it.
    const win = window.open("", "_blank");
    if (dirty) {
      // Note: don't write into the blank tab. Writing gives it this page's
      // address, and the preview address would then only change the "#" part
      // and never load.
      const saved = await saveDraft();
      if (!saved) {
        try {
          win?.close();
        } catch {}
        return;
      }
    }
    if (win) win.location.href = previewUrlRef.current;
    else window.open(previewUrlRef.current, "_blank");
  }

  // Ask before leaving with unsaved changes (back arrow and in-app links).
  function requestLeave(to) {
    if (!dirtyRef.current) {
      nav(to);
      return;
    }
    setLeavePrompt({ to });
  }

  function forgetBackup() {
    try {
      window.localStorage.removeItem(backupKey);
    } catch {}
  }

  async function confirmLeave(mode) {
    const target = leavePrompt?.to;
    if (!target) return;
    if (mode === "save") {
      setLeaving(true);
      const saved = await saveDraft();
      setLeaving(false);
      if (!saved) return; // keep the prompt open; the error toast explains why
    } else {
      forgetBackup();
    }
    setLeavePrompt(null);
    dirtyRef.current = false;
    nav(target);
  }

  useEffect(() => {
    function onClickCapture(e) {
      if (!dirtyRef.current) return;
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target?.closest?.("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") || "";
      let path = "";
      if (href.startsWith("#/")) path = href.slice(1);
      else {
        try {
          const u = new URL(a.href, window.location.href);
          if (
            u.origin === window.location.origin &&
            u.pathname === window.location.pathname &&
            u.hash.startsWith("#/")
          )
            path = u.hash.slice(1);
        } catch {}
      }
      if (!path) return; // external links leave the page: beforeunload covers them
      if (path === `/admin/pages/${id}`) return;
      e.preventDefault();
      e.stopPropagation();
      setLeavePrompt({ to: path });
    }
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [id]);

  // Offer to restore a backup that differs from what the server has.
  useEffect(() => {
    if (!page || !hasLoadedRef.current || backupReady) return;
    let backup = null;
    try {
      backup = JSON.parse(window.localStorage.getItem(backupKey) || "null");
    } catch {
      backup = null;
    }
    const data = backup && typeof backup === "object" ? backup.data : null;
    if (data && typeof data === "object") {
      const snap = makeSnapshot({
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        hero: data.hero,
        contentHtml: data.contentHtml,
        contentJson: data.contentJson,
        seo: data.seo,
      });
      if (snap !== (lastSavedRef.current || "")) {
        const serverTime = Date.parse(page.updated_at || page.updatedAt || "");
        setRecovery({
          savedAt: Number(backup.savedAt) || null,
          data,
          newerOnServer:
            Number.isFinite(serverTime) &&
            Number(backup.savedAt) > 0 &&
            serverTime > Number(backup.savedAt),
        });
      } else {
        forgetBackup();
      }
    }
    setBackupReady(true);
  }, [page, backupReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the backup in step with the editor (paused while a restore is offered).
  useEffect(() => {
    if (!backupReady || recovery) return undefined;
    if (!dirty) {
      forgetBackup();
      return undefined;
    }
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          backupKey,
          JSON.stringify({
            v: 1,
            savedAt: Date.now(),
            data: { title, slug, excerpt, hero, contentHtml, contentJson, seo },
          }),
        );
      } catch {
        // Storage full or blocked: editing continues without a backup.
      }
    }, 800);
    return () => window.clearTimeout(t);
    // backupKey is fixed for this page; forgetBackup only clears it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    backupReady,
    recovery,
    dirty,
    title,
    slug,
    excerpt,
    hero,
    contentHtml,
    contentJson,
    seo,
  ]);

  function restoreBackup() {
    const d = recovery?.data;
    if (!d) return;
    setTitle(String(d.title ?? ""));
    setSlug(String(d.slug ?? ""));
    setExcerpt(String(d.excerpt ?? ""));
    setHero(String(d.hero ?? ""));
    setContentHtml(String(d.contentHtml ?? ""));
    setContentJson(d.contentJson ?? null);
    if (d.seo) setSeo(normalizeSeo(d.seo));
    setRecovery(null);
    toast(
      "success",
      "Unsaved changes restored",
      "Review them, then Save Draft to keep them.",
    );
  }

  function discardBackup() {
    forgetBackup();
    setRecovery(null);
  }

  function renderRecoveryBanner() {
    if (!recovery) return null;
    const when = recovery.savedAt
      ? new Date(recovery.savedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "an earlier session";
    return (
      <div className="ap-recovery" role="alert">
        <div>
          <strong>Unsaved changes found</strong>
          <p>
            This browser kept changes to this page from {when} that were never
            saved.
            {recovery.newerOnServer
              ? " The page has been saved since then, possibly by someone else; restoring replaces that newer version in the editor."
              : ""}
          </p>
        </div>
        <div className="ap-recoveryActions">
          <button type="button" className="ap-btn" onClick={discardBackup}>
            Discard them
          </button>
          <button
            type="button"
            className="ap-btn ap-btnPrimary"
            onClick={restoreBackup}
          >
            Restore changes
          </button>
        </div>
      </div>
    );
  }

  /* -----------------------------
     Phase 7: revision history
  ----------------------------- */
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState(null);
  const [historyError, setHistoryError] = useState("");
  const [historySel, setHistorySel] = useState(null); // full revision
  const [historySelLoading, setHistorySelLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState(false);

  async function openHistory() {
    setHistoryOpen(true);
    setHistorySel(null);
    setRestoreConfirm(false);
    setHistoryError("");
    setHistoryList(null);
    try {
      const { data } = await api.get(`/admin/pages/${id}/revisions`);
      const list = Array.isArray(data?.revisions) ? data.revisions : [];
      setHistoryList(list);
      if (list.length) selectRevision(list[0].id);
    } catch (e) {
      setHistoryError(pickErr(e, "The history could not be loaded."));
      setHistoryList([]);
    }
  }

  async function selectRevision(revId) {
    setRestoreConfirm(false);
    setHistorySelLoading(true);
    try {
      const { data } = await api.get(`/admin/pages/${id}/revisions/${revId}`);
      setHistorySel(data?.revision || null);
    } catch (e) {
      setHistorySel(null);
      setHistoryError(pickErr(e, "This version could not be loaded."));
    } finally {
      setHistorySelLoading(false);
    }
  }

  async function restoreRevision() {
    if (!historySel || restoring) return;
    setRestoring(true);
    try {
      await api.post(`/admin/pages/${id}/revisions/${historySel.id}/restore`);
      forgetBackup();
      setHistoryOpen(false);
      await load();
      toast(
        "success",
        "Version restored to the draft",
        "Preview it, then Publish Changes to make it live. The previous draft is kept in History.",
      );
    } catch (e) {
      setHistoryError(pickErr(e, "This version could not be restored."));
    } finally {
      setRestoring(false);
      setRestoreConfirm(false);
    }
  }

  function revisionKindLabel(kind) {
    return kind === "publish"
      ? "Published"
      : kind === "before_restore"
        ? "Before a restore"
        : "Draft saved";
  }

  function renderHistory() {
    if (!historyOpen) return null;
    const list = historyList;
    const sel = historySel;
    const secs = Array.isArray(sel?.content_json?.extra_sections)
      ? sel.content_json.extra_sections
      : [];
    const when = (v) =>
      new Date(v).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    return (
      <div
        className="ap-modalOverlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-historyTitle"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !restoring) setHistoryOpen(false);
        }}
      >
        <div className="ap-modal ap-historyModal">
          <div className="ap-historyHead">
            <div>
              <div className="ap-modalTitle" id="ap-historyTitle">
                Page history
              </div>
              <div className="ap-historySub">
                Restoring puts a version back into the draft. The live page
                changes only when you publish.
              </div>
            </div>
            <button
              type="button"
              className="ap-btn"
              onClick={() => setHistoryOpen(false)}
              disabled={restoring}
              autoFocus
            >
              Close
            </button>
          </div>
          {historyError ? (
            <div className="ap-saveSectionError" role="alert">
              {historyError}
            </div>
          ) : null}
          <div className="ap-historyBody">
            <ul className="ap-historyList" aria-label="Versions">
              {list === null ? (
                <li className="ap-historyEmpty">Loading…</li>
              ) : !list.length ? (
                <li className="ap-historyEmpty">
                  No history yet. Versions are recorded when you save a draft or
                  publish.
                </li>
              ) : (
                list.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={`ap-historyItem ${sel?.id === r.id ? "is-active" : ""}`}
                      onClick={() => selectRevision(r.id)}
                      aria-current={sel?.id === r.id ? "true" : undefined}
                    >
                      <span className={`ap-historyKind kind-${r.kind}`}>
                        {revisionKindLabel(r.kind)}
                      </span>
                      <span className="ap-historyWhen">
                        {when(r.created_at)}
                      </span>
                      <span className="ap-historyMeta">
                        {r.author ? `${r.author} · ` : ""}
                        {r.section_count}{" "}
                        {Number(r.section_count) === 1 ? "section" : "sections"}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <div className="ap-historyPreview">
              {historySelLoading ? (
                <p className="ap-seoHelp">Loading version…</p>
              ) : sel ? (
                <>
                  <div className="ap-historyPreviewHead">
                    <strong>{sel.title || "Untitled"}</strong>
                    <span>
                      {revisionKindLabel(sel.kind)} · {when(sel.created_at)}
                    </span>
                  </div>
                  <div className="ap-historySections">
                    {secs.length ? (
                      secs.map((sec, i) => (
                        <APSectionPreview key={sec?.id || i} section={sec} />
                      ))
                    ) : sel.content_html ? (
                      <div
                        className="ap-liveRichtext"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(sel.content_html),
                        }}
                      />
                    ) : (
                      <p className="ap-seoHelp">This version has no content.</p>
                    )}
                  </div>
                  {restoreConfirm ? (
                    <div className="ap-historyConfirm" role="alertdialog">
                      <strong>Restore this version to the draft?</strong>
                      <p>
                        {dirty
                          ? "Your unsaved changes in the editor will be replaced. "
                          : ""}
                        The current draft is kept in History, so you can undo
                        this. The live page does not change until you publish.
                      </p>
                      <div className="ap-modalActions">
                        <button
                          type="button"
                          className="ap-btn"
                          onClick={() => setRestoreConfirm(false)}
                          disabled={restoring}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="ap-btn ap-btnPrimary"
                          onClick={restoreRevision}
                          disabled={restoring}
                        >
                          {restoring ? "Restoring…" : "Restore to draft"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="ap-modalActions">
                      <button
                        type="button"
                        className="ap-btn ap-btnPrimary"
                        onClick={() => setRestoreConfirm(true)}
                      >
                        Restore this version
                      </button>
                    </div>
                  )}
                </>
              ) : list && list.length ? (
                <p className="ap-seoHelp">Choose a version on the left.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -----------------------------
     Phase 7-2: scheduled publishing
  ----------------------------- */
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleValue, setScheduleValue] = useState(""); // datetime-local text
  const [scheduleError, setScheduleError] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const scheduledAt = page?.publish_at ? new Date(page.publish_at) : null;
  const scheduledLabel =
    scheduledAt && !Number.isNaN(scheduledAt.getTime())
      ? scheduledAt.toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";
  const timeZoneName =
    (typeof Intl !== "undefined" &&
      Intl.DateTimeFormat().resolvedOptions().timeZone) ||
    "your time zone";

  function toLocalInputValue(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function openSchedule() {
    let start = scheduledAt;
    if (!start || Number.isNaN(start.getTime())) {
      start = new Date();
      start.setDate(start.getDate() + 1);
      start.setHours(9, 0, 0, 0); // tomorrow 9:00 AM
    }
    setScheduleValue(toLocalInputValue(start));
    setScheduleError("");
    setScheduleOpen(true);
  }

  async function submitSchedule() {
    if (scheduling) return;
    const when = new Date(scheduleValue); // datetime-local is read as local time
    if (!scheduleValue || Number.isNaN(when.getTime())) {
      setScheduleError("Choose a date and time.");
      return;
    }
    if (when.getTime() < Date.now() + 60 * 1000) {
      setScheduleError("Choose a time at least one minute from now.");
      return;
    }
    setScheduling(true);
    setScheduleError("");
    try {
      if (dirty) {
        const saved = await saveDraft();
        if (!saved) {
          setScheduleError(
            "Your draft could not be saved, so nothing was scheduled.",
          );
          return;
        }
      }
      const { data } = await api.post(`/admin/pages/${id}/schedule`, {
        publish_at: when.toISOString(),
      });
      setPage((cur) => ({
        ...(cur || {}),
        publish_at: data?.page?.publish_at || when.toISOString(),
      }));
      setScheduleOpen(false);
      toast(
        "success",
        "Publish scheduled",
        `This page will be published ${when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`,
      );
    } catch (e) {
      setScheduleError(pickErr(e, "The page could not be scheduled."));
    } finally {
      setScheduling(false);
    }
  }

  async function cancelSchedule() {
    if (scheduling) return;
    setScheduling(true);
    try {
      await api.delete(`/admin/pages/${id}/schedule`);
      setPage((cur) => ({ ...(cur || {}), publish_at: null }));
      setScheduleOpen(false);
      toast(
        "success",
        "Schedule cancelled",
        "The page will not be published automatically.",
      );
    } catch (e) {
      setScheduleError(pickErr(e, "The schedule could not be cancelled."));
    } finally {
      setScheduling(false);
    }
  }

  function renderScheduleDialog() {
    if (!scheduleOpen) return null;
    return (
      <div
        className="ap-modalOverlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-scheduleTitle"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !scheduling) setScheduleOpen(false);
        }}
      >
        <div className="ap-modal ap-saveSectionModal">
          <div className="ap-modalTitle" id="ap-scheduleTitle">
            {scheduledLabel ? "Change scheduled publish" : "Schedule publish"}
          </div>
          <div className="ap-modalMsg">
            At this time the page’s draft goes live, including any changes you
            save before then.
            {scheduledLabel
              ? ` Currently scheduled for ${scheduledLabel}.`
              : ""}
          </div>
          <label className="ap-saveSectionLabel" htmlFor="ap-scheduleAt">
            Publish on
          </label>
          <input
            id="ap-scheduleAt"
            type="datetime-local"
            className="ap-input"
            value={scheduleValue}
            min={toLocalInputValue(new Date(Date.now() + 60 * 1000))}
            onChange={(e) => {
              setScheduleValue(e.target.value);
              setScheduleError("");
            }}
            autoFocus
            disabled={scheduling}
          />
          <p className="ap-seoHelp" style={{ marginTop: 6 }}>
            Time zone: {timeZoneName}
            {dirty ? ". Your unsaved changes will be saved first." : "."}
          </p>
          {scheduleError ? (
            <div className="ap-saveSectionError" role="alert">
              {scheduleError}
            </div>
          ) : null}
          <div className="ap-modalActions ap-leaveActions">
            {scheduledLabel ? (
              <button
                type="button"
                className="ap-btn ap-btnDanger"
                onClick={cancelSchedule}
                disabled={scheduling}
              >
                Cancel schedule
              </button>
            ) : null}
            <button
              type="button"
              className="ap-btn"
              onClick={() => setScheduleOpen(false)}
              disabled={scheduling}
            >
              Close
            </button>
            <button
              type="button"
              className="ap-btn ap-btnPrimary"
              onClick={submitSchedule}
              disabled={scheduling}
            >
              {scheduling
                ? "Scheduling…"
                : scheduledLabel
                  ? "Update schedule"
                  : "Schedule"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedInnerKey = (selectedInner?.path || []).join("/");
  useEffect(() => {
    setElementPane("content");
  }, [selectedBlockId, selectedInnerKey]);
  useEffect(() => {
    setSectionPane("layout");
  }, [selectedSectionIndex]);

  // Release 1.2: the device whose styles are being edited ("" = Desktop).
  const deviceEditing =
    visualOnly && (previewDevice === "tablet" || previewDevice === "mobile")
      ? previewDevice
      : "";

  // ---- Nested containers (Elementor-style) ----
  // A selection inside a Columns/Container block is a path from the top-level
  // block: [colId, blockId, colId, blockId, ...]. Ending in a column = the column
  // is selected; ending in a block = that element (at any depth).
  const activeInner =
    selectedInner &&
    String(selectedInner.columnsId) === String(selectedBlockId) &&
    Array.isArray(selectedInner.path) &&
    selectedInner.path.length
      ? selectedInner
      : null;
  const selSectionObj = (contentJson?.extra_sections || [])[
    Number(selectedSectionIndex)
  ];
  const selTopBlock =
    (selSectionObj?.blocks || []).find(
      (b) => String(b?.id) === String(selectedBlockId),
    ) || null;
  const innerKind = activeInner
    ? activeInner.path.length % 2 === 1
      ? "column"
      : "block"
    : null;
  // Path to the block shown in the inspector: the element, or the Columns /
  // Container that holds the selected column.
  const targetPath = !activeInner
    ? []
    : innerKind === "block"
      ? activeInner.path
      : activeInner.path.slice(0, -1);
  const activeInnerBlock =
    activeInner && targetPath.length ? treeGet(selTopBlock, targetPath) : null;

  function updateTopBlock(secIdx, topId, fn) {
    const cur = ensureSectionShape((contentJson?.extra_sections || [])[secIdx]);
    const blocks = normalizeBlocksForSection(cur);
    updateSectionBlocks(
      secIdx,
      blocks.map((b) => (String(b?.id) === String(topId) ? fn(b) : b)),
    );
  }
  function updateAtPath(secIdx, topId, path, fn) {
    updateTopBlock(secIdx, topId, (top) => treeUpdate(top, path, fn));
  }

  // Inspector edits are saved to the shown block, however deeply nested.
  function patchBlockAny(blockId, patch) {
    const idx = Number(selectedSectionIndex);
    if (activeInnerBlock && String(blockId) === String(activeInnerBlock.id)) {
      updateAtPath(idx, selectedBlockId, targetPath, (b) => ({
        ...b,
        ...(patch || {}),
      }));
      return;
    }
    patchBlock(idx, blockId, patch);
  }

  function selectPath(secIdx, topId, path) {
    setSelectedSectionIndex(String(secIdx));
    setSelectedBlockId(String(topId));
    setSelectedInner(
      path && path.length
        ? { columnsId: String(topId), path: path.map(String) }
        : null,
    );
    setInspectorTab("block");
    setInspectorOpen(true);
  }

  // Insert a new element (any type, including Container) into a column.
  function insertIntoColumn(secIdx, topId, colPath, type, index = null) {
    const blk = newBlockOf(type);
    updateAtPath(secIdx, topId, colPath, (c) => {
      const list = Array.isArray(c.blocks) ? c.blocks.slice() : [];
      const at =
        Number.isInteger(index) && index >= 0 && index <= list.length
          ? index
          : list.length;
      list.splice(at, 0, blk);
      return { ...c, blocks: list };
    });
    selectPath(secIdx, topId, [...colPath, String(blk.id)]);
  }

  // Move / duplicate / delete an element inside a column (path ends with its id).
  function innerListOp(secIdx, topId, path, op) {
    const colPath = path.slice(0, -1);
    const id = String(path[path.length - 1]);
    updateAtPath(secIdx, topId, colPath, (c) => {
      const list = Array.isArray(c.blocks) ? c.blocks.slice() : [];
      const at = list.findIndex((b) => String(b?.id) === id);
      if (at < 0) return c;
      if (op === "up" || op === "down") {
        const to = at + (op === "up" ? -1 : 1);
        if (to < 0 || to >= list.length) return c;
        const [x] = list.splice(at, 1);
        list.splice(to, 0, x);
      } else if (op === "duplicate") {
        list.splice(at + 1, 0, cloneWithFreshIds(list[at]));
      } else if (op === "delete") {
        list.splice(at, 1);
      }
      return { ...c, blocks: list };
    });
  }

  // Columns / Container panel: layout like Elementor's container settings.
  function renderColumnsPanel(block) {
    const idx = Number(selectedSectionIndex);
    const top = selectedBlockId;
    const bPath =
      activeInnerBlock && String(activeInnerBlock.id) === String(block.id)
        ? targetPath
        : [];
    const patchThis = (patch) =>
      updateAtPath(idx, top, bPath, (b) => ({ ...b, ...patch }));
    const cols = Array.isArray(block.columns) ? block.columns : [];
    const isContainer = block.variant === "container";
    const types = [
      ["heading", "Heading"],
      ["richtext", "Text"],
      ["button", "Button"],
      ["image", "Image"],
      ["video", "Video"],
      ["videos", "Video gallery"],
      ["gallery", "Gallery"],
      ["grid", "Cards"],
      ["quote", "Quote"],
      ["faq", "FAQ"],
      ["divider", "Divider"],
      ["spacer", "Spacer"],
      ["container", "Container"],
      ["columns", "Columns"],
      ["form", "Form"],
      ["icon", "Icon"],
      ["iconlist", "Icon list"],
      ["slider", "Image slider"],
      ["testimonials", "Testimonials"],
      ["countdown", "Countdown"],
      ["map", "Google Map"],
      ["social", "Social icons"],
      ["embed", "Embed"],
      ...STORY_PANEL.map(([t, l]) => [t, l]),
    ];
    const seg = (label, value, options, onChange) => (
      <div className="bx-field">
        <span className="bx-label">{label}</span>
        <div className="dc-seg" role="radiogroup" aria-label={label}>
          {options.map(([v, t]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={value === v}
              className={value === v ? "is-on" : ""}
              onClick={() => onChange(v)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    );
    const widthMode = block.width_mode || "full";
    return (
      <div
        className="bx-editor"
        aria-label={isContainer ? "Container" : "Columns"}
      >
        <div className="dc-panel" aria-label="Layout">
          <h4>Layout</h4>
          {seg(
            "Width",
            widthMode,
            [
              ["full", "Full"],
              ["boxed", "Boxed"],
              ["custom", "Custom"],
            ],
            (v) => patchThis({ width_mode: v }),
          )}
          {widthMode === "custom" ? (
            <div className="bx-field">
              <label htmlFor={`cw-${block.id}`}>
                Width: {Math.round(Number(block.width_pct) || 100)}%
              </label>
              <input
                id={`cw-${block.id}`}
                type="range"
                min={10}
                max={100}
                value={Math.round(Number(block.width_pct) || 100)}
                onChange={(e) =>
                  patchThis({ width_pct: Number(e.target.value) })
                }
              />
            </div>
          ) : null}
          {isContainer
            ? seg(
                "Direction",
                block.direction || "column",
                [
                  ["column", "Stacked ↓"],
                  ["row", "Side by side →"],
                ],
                (v) => patchThis({ direction: v }),
              )
            : null}
          {seg(
            "Justify",
            block.justify || "start",
            [
              ["start", "Start"],
              ["center", "Center"],
              ["end", "End"],
              ["between", "Space between"],
            ],
            (v) => patchThis({ justify: v }),
          )}
          {seg(
            "Align items",
            block.align_items || "stretch",
            [
              ["start", "Top"],
              ["center", "Middle"],
              ["end", "Bottom"],
              ["stretch", "Stretch"],
            ],
            (v) => patchThis({ align_items: v }),
          )}
          <div className="bx-field">
            <label htmlFor={`cg-${block.id}`}>
              Gap: {Number.isFinite(Number(block.gap)) ? Number(block.gap) : 14}
              px
            </label>
            <input
              id={`cg-${block.id}`}
              type="range"
              min={0}
              max={60}
              value={
                Number.isFinite(Number(block.gap)) ? Number(block.gap) : 14
              }
              onChange={(e) => patchThis({ gap: Number(e.target.value) })}
            />
          </div>
          <div className="bx-field">
            <label htmlFor={`ch-${block.id}`}>
              Minimum height: {Number(block.min_height) || 0}px
            </label>
            <input
              id={`ch-${block.id}`}
              type="range"
              min={0}
              max={900}
              step={10}
              value={Number(block.min_height) || 0}
              onChange={(e) =>
                patchThis({ min_height: Number(e.target.value) })
              }
            />
          </div>
          <label className="bx-check">
            <input
              type="checkbox"
              checked={block.stack_on_mobile !== false}
              onChange={(e) => patchThis({ stack_on_mobile: e.target.checked })}
            />
            Stack on phones (one under another)
          </label>
        </div>
        {cols.map((c, ci) => (
          <div className="bx-faqEdit" key={c.id || ci}>
            <div className="bx-faqEditHead">
              <strong>
                {isContainer && cols.length === 1
                  ? "Elements in this container"
                  : `Column ${ci + 1}`}
              </strong>
              {cols.length > 1 ? (
                <button
                  type="button"
                  className="ap-btn ap-btnDanger"
                  onClick={() =>
                    updateAtPath(idx, top, bPath, (b) => ({
                      ...b,
                      columns: (b.columns || []).filter(
                        (x) => String(x.id) !== String(c.id),
                      ),
                    }))
                  }
                  aria-label={`Remove column ${ci + 1}`}
                >
                  Remove
                </button>
              ) : null}
            </div>
            {cols.length > 1 ? (
              <>
                <label className="bx-hint" htmlFor={`colw-${c.id}`}>
                  Width: {Math.round(Number(c.width_pct) || 100 / cols.length)}%
                </label>
                <input
                  id={`colw-${c.id}`}
                  type="range"
                  min={10}
                  max={90}
                  value={Math.round(Number(c.width_pct) || 100 / cols.length)}
                  onChange={(e) =>
                    updateAtPath(idx, top, [...bPath, c.id], (col) => ({
                      ...col,
                      width_pct: Number(e.target.value),
                    }))
                  }
                />
              </>
            ) : null}
            {(c.blocks || []).map((ib, bi) => (
              <button
                key={ib.id || bi}
                type="button"
                className="ap-phase4BlockChoice"
                onClick={() =>
                  selectPath(idx, top, [...bPath, String(c.id), String(ib.id)])
                }
              >
                <span>
                  {bi + 1}. {blockLabel(ib)}
                  {blockSnippet(ib) ? `: ${blockSnippet(ib)}` : ""}
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
            <label className="bx-hint" htmlFor={`coladd-${c.id}`}>
              Add an element here
            </label>
            <select
              id={`coladd-${c.id}`}
              className="ap-input"
              value=""
              onChange={(e) => {
                if (e.target.value)
                  insertIntoColumn(
                    idx,
                    top,
                    [...bPath, String(c.id)],
                    e.target.value,
                  );
              }}
            >
              <option value="">Choose an element…</option>
              {types.map(([t, l]) => (
                <option key={t} value={t}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        ))}
        <button
          type="button"
          className="ap-btn ap-btnPrimary"
          onClick={() =>
            updateAtPath(idx, top, bPath, (b) => {
              const list = Array.isArray(b.columns) ? b.columns : [];
              const n = list.length + 1;
              return {
                ...b,
                columns: [
                  ...list.map((x) => ({
                    ...x,
                    width_pct: Math.round(100 / n),
                  })),
                  {
                    id: uid(),
                    width_pct: Math.round(100 / n),
                    styles: {},
                    blocks: [],
                  },
                ],
              };
            })
          }
        >
          + Add column
        </button>
      </div>
    );
  }

  /* -----------------------------
     Visual editor (Stage 1): the real page in an iframe, fed the unsaved draft
  ----------------------------- */
  const visualFrameRef = useRef(null);
  const [visualReady, setVisualReady] = useState(false);
  const visualCanvasSrc = appUrl(`/admin/pages/${id}/canvas`);

  const visualPage = useMemo(
    () => ({
      ...(page || {}),
      id,
      title,
      slug,
      excerpt,
      hero_image_url: hero || null,
      content_html: contentHtml,
      content_json: contentJson,
      seo_title: seo.title,
      seo_description: seo.description,
      seo_image_url: seo.image,
      seo_noindex: seo.noindex,
    }),
    [page, id, title, slug, excerpt, hero, contentHtml, contentJson, seo],
  );

  // Switching to another page (same editor screen): start with nothing selected.
  const lastPageIdRef = useRef(id);
  useEffect(() => {
    if (lastPageIdRef.current === id) return;
    lastPageIdRef.current = id;
    setSelectedSectionIndex("");
    setSelectedBlockId("");
    setInspectorTab(visualOnly ? "elements" : "page");
  }, [id, visualOnly]);

  const visualPageRef = useRef(visualPage);
  visualPageRef.current = visualPage;

  // Send the draft to the canvas (shortly after each change).
  useEffect(() => {
    if (canvasMode !== "visual" || !visualReady) return undefined;
    const t = window.setTimeout(() => {
      visualFrameRef.current?.contentWindow?.postMessage(
        { type: "brtv:draft", page: visualPage },
        window.location.origin,
      );
    }, 120);
    return () => window.clearTimeout(t);
  }, [canvasMode, visualReady, visualPage]);

  useEffect(() => {
    if (canvasMode !== "visual") setVisualReady(false);
  }, [canvasMode]);

  // Opened from the full-screen editor at a block (?block=ID): show it.
  const location = useLocation();
  const focusBlockId =
    new URLSearchParams(location.search || "").get("block") || "";
  useEffect(() => {
    if (visualOnly || loading || !focusBlockId) return undefined;
    const t = window.setTimeout(() => {
      const el = document.querySelector(
        `[data-block-id="${CSS.escape(focusBlockId)}"]`,
      );
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    return () => window.clearTimeout(t);
  }, [visualOnly, loading, focusBlockId]);

  // Full-screen editor: Esc clears the selection (when no dialog is open and
  // you're not typing in a field). The canvas handles Esc while it has focus.
  useEffect(() => {
    if (!visualOnly) return undefined;
    function onKey(e) {
      if (e.key !== "Escape") return;
      if (document.querySelector(".ap-modalOverlay, .mp-dialog")) return;
      const t = e.target;
      if (
        t &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      )
        return;
      setSelectedInner(null);
      setSelectedBlockId("");
      setSelectedSectionIndex("");
      setInspectorTab(visualOnly ? "elements" : "page");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visualOnly]);

  // Add an element: into a column, at a position in a section, or (no section)
  // in a new section placed after afterSectionId or at the end of the page.
  function insertElement({
    type,
    sectionIdx = -1,
    index = null,
    columnsId = "",
    colPath = null,
    afterSectionIdx = null,
  }) {
    const sections = Array.isArray(contentJson?.extra_sections)
      ? contentJson.extra_sections
      : [];
    if (
      sectionIdx >= 0 &&
      columnsId &&
      Array.isArray(colPath) &&
      colPath.length
    ) {
      insertIntoColumn(
        sectionIdx,
        columnsId,
        colPath,
        type,
        Number.isInteger(index) ? index : null,
      );
      return;
    }
    if (sectionIdx >= 0 && sections[sectionIdx]) {
      const blocks = Array.isArray(sections[sectionIdx].blocks)
        ? sections[sectionIdx].blocks
        : [];
      pendingNewBlockRef.current = {
        sectionId: String(sections[sectionIdx].id),
        count: blocks.length,
        after: -1,
        at: Number.isInteger(index) ? index : null,
      };
      addBlock(sectionIdx, type);
      return;
    }
    // New section holding the element.
    const blk = newBlockOf(type);
    const fresh = ensureSectionShape({
      title: "New Section",
      html: "",
      collapsed: false,
      theme: "default",
      layout: "plain",
      styles: { ...defaultSectionStyle("default"), show_title: false },
      blocks: [blk],
    });
    const at =
      Number.isInteger(afterSectionIdx) && afterSectionIdx >= 0
        ? afterSectionIdx + 1
        : sections.length;
    setBuilder((b) => {
      const arr = Array.isArray(b.extra_sections)
        ? b.extra_sections.slice()
        : [];
      arr.splice(Math.min(at, arr.length), 0, fresh);
      return { ...b, extra_sections: arr };
    });
    setSelectedSectionIndex(String(at));
    setSelectedBlockId(String(blk.id));
    setSelectedInner(null);
    setInspectorTab("block");
    setInspectorOpen(true);
  }

  // Elements panel (full-screen editor), like Elementor's widget panel.
  const ELEMENT_GROUPS = [
    [
      "Basic",
      [
        ["heading", "Heading", "H"],
        ["richtext", "Text", "¶"],
        ["button", "Button", "▣"],
        ["image", "Image", "🖼"],
        ["divider", "Divider", "—"],
        ["spacer", "Spacer", "↕"],
      ],
    ],
    [
      "Layout",
      [
        ["container", "Container", "▢"],
        ["columns", "Columns", "▥"],
      ],
    ],
    [
      "Media",
      [
        ["video", "Video", "▶"],
        ["videos", "Video gallery", "▶▶"],
        ["gallery", "Gallery", "▦"],
      ],
    ],
    [
      "Content",
      [
        ["quote", "Quote", "❝"],
        ["faq", "FAQ", "?"],
        ["grid", "Cards", "▤"],
        ["testimonials", "Testimonials", "❞"],
        ["iconlist", "Icon list", "☰"],
        ["icon", "Icon", "★"],
      ],
    ],
    [
      "Forms & more",
      [
        ["form", "Form", "✉"],
        ["countdown", "Countdown", "⏱"],
        ["slider", "Image slider", "⇆"],
        ["map", "Google Map", "⌖"],
        ["social", "Social icons", "＠"],
        ["embed", "Embed", "</>"],
      ],
    ],
    // About / Pastoral Leadership design blocks
    ["Story", STORY_PANEL],
  ];
  const [elementSearch, setElementSearch] = useState("");
  function addFromPanel(type) {
    const idx =
      selectedSectionIndex === "" || selectedSectionIndex == null
        ? -1
        : Number(selectedSectionIndex);
    const sections = Array.isArray(contentJson?.extra_sections)
      ? contentJson.extra_sections
      : [];
    const sec = idx >= 0 ? sections[idx] : null;
    const core =
      sec &&
      (String(sec.id || "").startsWith("core-") ||
        (sec.blocks || []).some((b) =>
          /^home_|^featured_live$|^latest_teaching$/.test(
            String(b?.type || ""),
          ),
        ));
    if (sec && !core && activeInner) {
      const path = activeInner.path;
      if (innerKind === "column") {
        insertElement({
          type,
          sectionIdx: idx,
          columnsId: activeInner.columnsId,
          colPath: path,
        });
      } else {
        const colPath = path.slice(0, -1);
        const col = treeGet(selTopBlock, colPath);
        const at = (col?.blocks || []).findIndex(
          (x) => String(x?.id) === path[path.length - 1],
        );
        insertElement({
          type,
          sectionIdx: idx,
          columnsId: activeInner.columnsId,
          colPath,
          index: at >= 0 ? at + 1 : null,
        });
      }
    } else if (sec && !core) {
      const blocks = sec.blocks || [];
      const bi = blocks.findIndex(
        (b) => String(b?.id) === String(selectedBlockId),
      );
      insertElement({ type, sectionIdx: idx, index: bi >= 0 ? bi + 1 : null });
    } else {
      insertElement({ type, afterSectionIdx: idx >= 0 ? idx : null });
    }
  }
  function renderElementsPanel() {
    const q = elementSearch.trim().toLowerCase();
    return (
      <div className="ap-elPanel" aria-label="Elements">
        <input
          className="ap-input ap-elSearch"
          type="search"
          placeholder="Search elements…"
          aria-label="Search elements"
          value={elementSearch}
          onChange={(e) => setElementSearch(e.target.value)}
        />
        <p className="ap-help">
          Click an element to add it, or drag it onto the page.
        </p>
        {ELEMENT_GROUPS.map(([group, items]) => {
          const list = items.filter(
            ([, label]) => !q || label.toLowerCase().includes(q),
          );
          if (!list.length) return null;
          return (
            <div key={group} className="ap-elGroup">
              <h4>{group}</h4>
              <div className="ap-elGrid">
                {list.map(([type, label, icon]) => (
                  <button
                    key={type}
                    type="button"
                    className="ap-elTile"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "application/x-brtv-element",
                        type,
                      );
                      e.dataTransfer.setData("text/plain", type);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => addFromPanel(type)}
                    aria-label={`Add ${label}`}
                  >
                    <span className="ap-elIcon" aria-hidden="true">
                      {icon}
                    </span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Stage 2: after "+ Add block" in the canvas, move the new block right after
  // the selected one and select it.
  const pendingNewBlockRef = useRef(null);
  useEffect(() => {
    const p = pendingNewBlockRef.current;
    if (!p) return;
    const sections = Array.isArray(contentJson?.extra_sections)
      ? contentJson.extra_sections
      : [];
    const idx = sections.findIndex((x) => String(x?.id) === p.sectionId);
    const blocks =
      idx >= 0 && Array.isArray(sections[idx]?.blocks)
        ? sections[idx].blocks
        : [];
    if (idx < 0 || blocks.length <= p.count) return;
    pendingNewBlockRef.current = null;
    const newBlock = blocks[blocks.length - 1];
    if (Number.isInteger(p.at) && p.at >= 0 && p.at < blocks.length - 1)
      reorderBlocks(idx, blocks.length - 1, p.at);
    else if (p.after >= 0 && p.after < blocks.length - 2)
      reorderBlocks(idx, blocks.length - 1, p.after + 1);
    setSelectedSectionIndex(String(idx));
    setSelectedBlockId(String(newBlock?.id || ""));
    setInspectorTab("block");
    setInspectorOpen(true);
  }, [contentJson]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clicks in the canvas select the section/block here.
  useEffect(() => {
    function onMessage(e) {
      if (e.origin !== window.location.origin) return;
      if (e.source !== visualFrameRef.current?.contentWindow) return;
      const d = e.data || {};
      if (d.type === "brtv:canvas-ready") {
        setVisualReady(true);
        // A (re)loaded canvas needs the current page right away: it may have
        // loaded after the last change was sent (e.g. switching pages).
        e.source.postMessage(
          { type: "brtv:draft", page: visualPageRef.current },
          window.location.origin,
        );
        return;
      }
      const sections = Array.isArray(contentJson?.extra_sections)
        ? contentJson.extra_sections
        : [];
      const secIdx = sections.findIndex(
        (x) => String(x?.id) === String(d.sectionId),
      );
      const sec = secIdx >= 0 ? sections[secIdx] : null;
      const secBlocks = Array.isArray(sec?.blocks) ? sec.blocks : [];
      const blockIdx = secBlocks.findIndex(
        (b) => String(b?.id) === String(d.blockId),
      );

      // Stage 2: actions from the canvas, applied with the editor's own functions.
      if (d.type === "brtv:copy" || d.type === "brtv:paste") {
        const p = Array.isArray(d.path) ? d.path.map(String) : [];
        const sIdx = sections.findIndex(
          (x) => String(x?.id) === String(d.sectionId || ""),
        );
        if (sIdx < 0) return;
        if (d.type === "brtv:copy") copyNode(sIdx, String(d.blockId || ""), p);
        else pasteNode(sIdx, String(d.blockId || ""), p);
        return;
      }
      if (d.type === "brtv:deselect") {
        setSelectedInner(null);
        setSelectedBlockId("");
        setSelectedSectionIndex("");
        setInspectorTab(visualOnly ? "elements" : "page");
        return;
      }
      if (d.type === "brtv:edit-field") {
        const blk = blockIdx >= 0 ? secBlocks[blockIdx] : null;
        if (
          blk &&
          isTypableHomeField(String(blk.type || ""), String(d.field || ""))
        ) {
          patchBlock(secIdx, String(d.blockId), {
            [String(d.field)]: String(d.value ?? "").slice(0, 2000),
          });
        }
        return;
      }
      const dPath = Array.isArray(d.path) ? d.path.map(String) : [];
      if (d.type === "brtv:edit-html" && dPath.length) {
        if (secIdx >= 0 && blockIdx >= 0)
          updateAtPath(secIdx, String(d.blockId), dPath, (b) => ({
            ...b,
            html: String(d.html || ""),
          }));
        return;
      }
      if (d.type === "brtv:edit-html") {
        if (secIdx >= 0 && blockIdx >= 0)
          patchBlock(secIdx, String(d.blockId), { html: String(d.html || "") });
        return;
      }
      if (d.type === "brtv:add-section") {
        const fresh = ensureSectionShape({
          title: "New Section",
          html: "",
          collapsed: false,
          theme: "default",
          layout: "plain",
          styles: defaultSectionStyle("default"),
        });
        const at = secIdx >= 0 ? secIdx + 1 : sections.length;
        setBuilder((b) => {
          const arr = Array.isArray(b.extra_sections)
            ? b.extra_sections.slice()
            : [];
          arr.splice(Math.min(at, arr.length), 0, fresh);
          return { ...b, extra_sections: arr };
        });
        setSelectedSectionIndex(String(at));
        setSelectedBlockId("");
        setInspectorTab("section");
        toast(
          "success",
          "Section added",
          "Add blocks with “+ Add block”, then Save Draft.",
        );
        return;
      }
      if (d.type === "brtv:insert-block") {
        const type = String(d.blockType || "");
        if (!type) return;
        if (secIdx >= 0 && blockIdx >= 0 && dPath.length % 2 === 1) {
          insertIntoColumn(
            secIdx,
            String(d.blockId),
            dPath,
            type,
            Number.isInteger(d.index) ? d.index : null,
          );
        } else if (secIdx >= 0 && !String(sec?.id || "").startsWith("core-")) {
          insertElement({
            type,
            sectionIdx: secIdx,
            index: Number.isInteger(d.index) ? d.index : null,
          });
        } else {
          insertElement({ type, afterSectionIdx: secIdx >= 0 ? secIdx : null });
        }
        return;
      }
      if (d.type === "brtv:add-block" && dPath.length && blockIdx >= 0) {
        const type = String(d.blockType || "richtext");
        if (dPath.length % 2 === 1) {
          insertIntoColumn(secIdx, String(d.blockId), dPath, type);
        } else {
          // an element inside a column is selected: add right after it
          const colPath = dPath.slice(0, -1);
          const col = treeGet(secBlocks[blockIdx], colPath);
          const at = (col?.blocks || []).findIndex(
            (x) => String(x?.id) === dPath[dPath.length - 1],
          );
          insertIntoColumn(
            secIdx,
            String(d.blockId),
            colPath,
            type,
            at >= 0 ? at + 1 : null,
          );
        }
        return;
      }
      if (d.type === "brtv:add-block") {
        if (secIdx < 0) return;
        pendingNewBlockRef.current = {
          sectionId: String(sec.id),
          count: secBlocks.length,
          after: blockIdx,
        };
        addBlock(secIdx, String(d.blockType || "richtext"));
        return;
      }
      if (d.type === "brtv:move-section") {
        if (secIdx >= 0) {
          const to = Number(d.toIndex);
          reorderExtraSections(secIdx, to);
          setSelectedSectionIndex(
            String(Math.max(0, Math.min(to, sections.length - 1))),
          );
        }
        return;
      }
      if (
        d.type === "brtv:move-block" &&
        dPath.length % 2 === 0 &&
        dPath.length
      ) {
        if (blockIdx >= 0)
          innerListOp(
            secIdx,
            String(d.blockId),
            dPath,
            Number(d.dir) < 0 ? "up" : "down",
          );
        return;
      }
      if (d.type === "brtv:move-block") {
        if (secIdx >= 0 && blockIdx >= 0)
          reorderBlocks(secIdx, blockIdx, Number(d.toIndex));
        return;
      }
      if (
        d.type === "brtv:duplicate" &&
        dPath.length % 2 === 0 &&
        dPath.length
      ) {
        if (blockIdx >= 0)
          innerListOp(secIdx, String(d.blockId), dPath, "duplicate");
        return;
      }
      if (d.type === "brtv:duplicate") {
        if (secIdx < 0) return;
        if (blockIdx >= 0) duplicateBlock(secIdx, String(d.blockId));
        else duplicateExtraSection(secIdx);
        return;
      }
      if (d.type === "brtv:delete" && dPath.length % 2 === 0 && dPath.length) {
        if (blockIdx < 0) return;
        openConfirm({
          title: "Delete this element?",
          message:
            "It is removed from its container. You can undo, or restore from History after saving.",
          confirmText: "Delete",
          danger: true,
          onConfirm: () => {
            closeConfirm();
            innerListOp(secIdx, String(d.blockId), dPath, "delete");
            selectPath(secIdx, String(d.blockId), dPath.slice(0, -1));
          },
        });
        return;
      }
      if (d.type === "brtv:delete") {
        if (secIdx < 0) return;
        const isBlock = blockIdx >= 0;
        openConfirm({
          title: isBlock
            ? "Delete this block?"
            : `Delete the section “${sec?.title || "Section"}”?`,
          message: isBlock
            ? "The block is removed from the draft. You can undo, or restore from History after saving."
            : "The section and everything in it are removed from the draft. You can undo, or restore from History after saving.",
          confirmText: "Delete",
          danger: true,
          onConfirm: () => {
            closeConfirm();
            if (isBlock) deleteBlock(secIdx, String(d.blockId));
            else deleteExtraSection(secIdx);
            setSelectedBlockId("");
            if (!isBlock) setSelectedSectionIndex("");
          },
        });
        return;
      }

      if (d.type !== "brtv:selected") return;
      const idx = sections.findIndex(
        (x) => String(x?.id) === String(d.sectionId),
      );
      if (idx < 0) {
        toast(
          "info",
          "Not editable here yet",
          "This part of the page isn't a builder section. Use List view to edit it.",
        );
        return;
      }
      const blocks = Array.isArray(sections[idx]?.blocks)
        ? sections[idx].blocks
        : [];
      const blockId =
        d.blockId && blocks.some((b) => String(b?.id) === String(d.blockId))
          ? String(d.blockId)
          : "";
      setSelectedSectionIndex(String(idx));
      setSelectedBlockId(blockId);
      const selBlock = blocks.find((b) => String(b?.id) === blockId);
      const selPath = Array.isArray(d.path) ? d.path.map(String) : [];
      setSelectedInner(
        selBlock?.type === "columns" &&
          selPath.length &&
          treeGet(selBlock, selPath)
          ? { columnsId: blockId, path: selPath }
          : null,
      );
      setInspectorTab(blockId ? "block" : "section");
      setInspectorOpen(true);
      if (blockId && d.field) {
        // Show the matching field on the left. Focus is not moved, so typing
        // on the page (double-click) is not interrupted.
        const field = String(d.field);
        let tries = 0;
        const show = () => {
          const box = document.querySelector(
            `.ap-gbInspector [data-home-field="${CSS.escape(field)}"]`,
          );
          if (!box) {
            if (++tries < 15) window.setTimeout(show, 80);
            return;
          }
          box.scrollIntoView({ behavior: "smooth", block: "center" });
          box.classList.remove("ap-fieldFlash");
          void box.offsetWidth; // restart the highlight
          box.classList.add("ap-fieldFlash");
        };
        window.setTimeout(show, 60);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [contentJson]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show the current selection in the canvas.
  useEffect(() => {
    if (canvasMode !== "visual" || !visualReady) return;
    const sections = Array.isArray(contentJson?.extra_sections)
      ? contentJson.extra_sections
      : [];
    const sec =
      selectedSectionIndex !== "" && selectedSectionIndex != null
        ? sections[Number(selectedSectionIndex)]
        : null;
    const block =
      sec && Array.isArray(sec.blocks)
        ? sec.blocks.find((b) => String(b?.id) === String(selectedBlockId))
        : null;
    const inner =
      block && activeInner && String(activeInner.columnsId) === String(block.id)
        ? activeInner
        : null;
    const innerNode = inner ? treeGet(block, inner.path) : null;
    visualFrameRef.current?.contentWindow?.postMessage(
      {
        type: "brtv:select",
        sectionId: sec?.id || "",
        blockId: block?.id || "",
        path: inner ? inner.path : [],
        label: block
          ? innerNode && inner.path.length % 2 === 0
            ? `${blockLabel(innerNode)} (inside ${blockLabel(block)})`
            : `${blockLabel(block)} · ${sec?.title || "Section"}`
          : sec
            ? sec.title || "Section"
            : "",
      },
      window.location.origin,
    );
    // activeInner is left out on purpose: the selection is re-sent only when
    // these change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canvasMode,
    visualReady,
    selectedSectionIndex,
    selectedBlockId,
    contentJson,
    selectedInner,
  ]);

  // Render at the real device width and scale down to fit, so "Desktop" shows
  // the desktop layout even when the editor column is narrower.
  // The stage element is tracked in state so measuring starts whenever it
  // appears (in the full-screen editor it mounts after the page loads).
  const [visualStageEl, visualStageRef] = useState(null);
  const [visualStageWidth, setVisualStageWidth] = useState(0);
  useEffect(() => {
    const el = visualStageEl;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) =>
      setVisualStageWidth(Math.floor(entry.contentRect.width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [visualStageEl]);

  function renderVisualCanvas() {
    const deviceWidth =
      previewDevice === "mobile"
        ? 390
        : previewDevice === "tablet"
          ? 820
          : 1280;
    const avail = visualStageWidth || deviceWidth;
    const scale = Math.min(1, avail / deviceWidth);
    const visibleHeight = visualOnly
      ? Math.max(480, window.innerHeight - 92)
      : Math.max(640, window.innerHeight - 230);
    return (
      <div className="ap-visualWrap">
        <p className="ap-visualHelp">
          Click any part of the page to edit it on the right. Changes show here
          as you make them; nothing is saved until you click Save Draft.
        </p>
        <div className="ap-visualStage" ref={visualStageRef}>
          <div
            className="ap-visualScaler"
            style={{ width: deviceWidth * scale, height: visibleHeight }}
          >
            <iframe
              ref={visualFrameRef}
              title="Visual page editor"
              className="ap-visualFrame"
              src={visualCanvasSrc}
              style={{
                width: deviceWidth,
                height: visibleHeight / scale,
                transform: scale < 1 ? `scale(${scale})` : undefined,
                transformOrigin: "top left",
              }}
            />
          </div>
        </div>
        {scale < 1 ? (
          <p className="ap-visualHelp">
            Showing the {previewDevice === "tablet" ? "tablet" : "desktop"}{" "}
            layout at {Math.round(scale * 100)}% to fit.
          </p>
        ) : null}
      </div>
    );
  }

  function goToListView(blockId) {
    // Full-screen editor: open the classic editor at this block (asks about
    // unsaved changes first).
    if (visualOnly) {
      requestLeave(
        `/admin/pages/${id}${blockId ? `?block=${encodeURIComponent(String(blockId))}` : ""}`,
      );
      return;
    }
    setCanvasMode("builder");
    window.setTimeout(() => {
      const el = blockId
        ? document.querySelector(
            `[data-block-id="${CSS.escape(String(blockId))}"]`,
          )
        : null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
  }

  // Phase 4E-2: where the inspector is pointing, e.g. "About › About Bishop › Gallery".
  // Breadcrumb: every level is clickable (select the page, section, or any
  // parent container), like Elementor's "select parent".
  function renderInspectorBreadcrumb() {
    const sections = Array.isArray(contentJson?.extra_sections)
      ? contentJson.extra_sections
      : [];
    const secIdx =
      selectedSectionIndex !== "" && selectedSectionIndex != null
        ? Number(selectedSectionIndex)
        : -1;
    const sec = secIdx >= 0 ? sections[secIdx] : null;
    const block =
      sec && Array.isArray(sec.blocks)
        ? sec.blocks.find((b) => String(b?.id) === String(selectedBlockId))
        : null;
    const parts = [
      { label: title || "Page", go: () => setInspectorTab("page") },
    ];
    if (inspectorTab !== "page" && sec)
      parts.push({
        label: sec.title || "Untitled section",
        go: () => {
          setSelectedInner(null);
          setSelectedBlockId("");
          setInspectorTab("section");
        },
      });
    if (inspectorTab === "block" && block)
      parts.push({
        label: blockLabel(block),
        go: () => selectPath(secIdx, block.id, []),
      });
    if (inspectorTab === "block" && block?.type === "columns" && activeInner) {
      let node = block;
      activeInner.path.forEach((id, i) => {
        if (!node) return;
        const upTo = activeInner.path.slice(0, i + 1);
        if (i % 2 === 0) {
          const cols = node.columns || [];
          const ci = cols.findIndex((c) => String(c?.id) === String(id));
          node = cols[ci] || null;
          if (cols.length > 1 && ci >= 0)
            parts.push({
              label: `Column ${ci + 1}`,
              go: () => selectPath(secIdx, block.id, upTo),
            });
        } else {
          node =
            (node.blocks || []).find((b) => String(b?.id) === String(id)) ||
            null;
          if (node)
            parts.push({
              label: blockLabel(node),
              go: () => selectPath(secIdx, block.id, upTo),
            });
        }
      });
    }
    return (
      <nav className="ap-inspectorCrumbs" aria-label="Editing">
        {parts.map((part, i) => {
          const last = i === parts.length - 1;
          return (
            <span key={i}>
              {i ? (
                <span className="ap-crumbSep" aria-hidden="true">
                  ›
                </span>
              ) : null}
              {last ? (
                <span aria-current="true">{part.label}</span>
              ) : (
                <button
                  type="button"
                  className="ap-crumbBtn"
                  onClick={part.go}
                  title={`Select ${part.label}`}
                >
                  {part.label}
                </button>
              )}
            </span>
          );
        })}
      </nav>
    );
  }

  // Layers (Elementor's Navigator): the page as a tree; click to select.
  function renderNavigator() {
    const sections = Array.isArray(contentJson?.extra_sections)
      ? contentJson.extra_sections
      : [];
    const curSec =
      selectedSectionIndex === "" || selectedSectionIndex == null
        ? -1
        : Number(selectedSectionIndex);
    const curKey = activeInner
      ? `${selectedBlockId}/${activeInner.path.join("/")}`
      : String(selectedBlockId || "");
    const row = (key, depth, label, onClick, active, kind) => (
      <li key={key}>
        <button
          type="button"
          className={`ap-navRow ap-navRow--${kind}${active ? " is-active" : ""}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={onClick}
          aria-current={active ? "true" : undefined}
        >
          <span className="ap-navIcon" aria-hidden="true">
            {kind === "section" ? "▭" : kind === "column" ? "▥" : "•"}
          </span>
          {label}
        </button>
      </li>
    );
    const walk = (secIdx, topId, blk, path, depth, out) => {
      const key = path.length ? `${topId}/${path.join("/")}` : String(topId);
      const label = `${blockLabel(blk)}${blockSnippet(blk) ? `: ${blockSnippet(blk)}` : ""}`;
      out.push(
        row(
          `b-${key}`,
          depth,
          label,
          () => selectPath(secIdx, topId, path),
          curSec === secIdx && curKey === key,
          "block",
        ),
      );
      // only a LIST of columns (Cards use "columns" as a number)
      const colList = Array.isArray(blk?.columns) ? blk.columns : [];
      colList.forEach((c, ci) => {
        const cPath = [...path, String(c.id)];
        const cKey = `${topId}/${cPath.join("/")}`;
        const multi = colList.length > 1;
        if (multi)
          out.push(
            row(
              `c-${cKey}`,
              depth + 1,
              `Column ${ci + 1}`,
              () => selectPath(secIdx, topId, cPath),
              curSec === secIdx && curKey === cKey,
              "column",
            ),
          );
        (c.blocks || []).forEach((ib) =>
          walk(
            secIdx,
            topId,
            ib,
            [...cPath, String(ib.id)],
            depth + (multi ? 2 : 1),
            out,
          ),
        );
      });
    };
    const items = [];
    sections.forEach((sec, si) => {
      items.push(
        row(
          `s-${sec.id || si}`,
          0,
          sec.title || `Section ${si + 1}`,
          () => {
            setSelectedSectionIndex(String(si));
            setSelectedInner(null);
            setSelectedBlockId("");
            setInspectorTab("section");
          },
          curSec === si && !selectedBlockId,
          "section",
        ),
      );
      (sec.blocks || []).forEach((b) =>
        walk(si, String(b.id), b, [], 1, items),
      );
    });
    return (
      <div className="ap-navPanel" aria-label="Layers">
        <p className="ap-help">
          Click any item to select it. Use this to reach elements inside
          containers.
        </p>
        {items.length ? (
          <ul className="ap-navTree">{items}</ul>
        ) : (
          <p className="ap-help">This page has no sections yet.</p>
        )}
      </div>
    );
  }

  // Copy / paste (Ctrl/Cmd+C, Ctrl/Cmd+V), kept across pages like Elementor.
  const CLIP_KEY = "brtv:clipboard";
  function copyNode(secIdx, topId, path) {
    const sec = (contentJson?.extra_sections || [])[secIdx];
    const top = (sec?.blocks || []).find(
      (b) => String(b?.id) === String(topId),
    );
    const node = path.length ? treeGet(top, path) : top;
    if (!node || path.length % 2 === 1) return;
    try {
      window.localStorage.setItem(CLIP_KEY, JSON.stringify(node));
      toast(
        "success",
        "Copied",
        `${blockLabel(node)} copied. Select a place and press Ctrl+V to paste.`,
      );
    } catch {
      toast("error", "Copy failed", "Your browser blocked the clipboard.");
    }
  }
  function pasteNode(secIdx, topId, path) {
    let node = null;
    try {
      node = JSON.parse(window.localStorage.getItem(CLIP_KEY) || "null");
    } catch {
      node = null;
    }
    if (!node || typeof node !== "object" || !node.type) {
      toast("error", "Nothing to paste", "Copy an element first (Ctrl+C).");
      return;
    }
    if (insertNodeAt(secIdx, topId, path, node))
      toast("success", "Pasted", `${blockLabel(node)} pasted.`);
  }

  // Insert a copy of an element at a selection: inside a column (or after an
  // element in one), after a top-level element, or at the end of the section.
  function insertNodeAt(secIdx, topId, path, node) {
    const sec = (contentJson?.extra_sections || [])[secIdx];
    if (!sec) return false;
    const fresh = cloneWithFreshIds(node);
    if (topId && path.length) {
      const colPath = path.length % 2 === 1 ? path : path.slice(0, -1);
      const top = (sec.blocks || []).find(
        (b) => String(b?.id) === String(topId),
      );
      const col = treeGet(top, colPath);
      const at =
        path.length % 2 === 1
          ? (col?.blocks || []).length
          : (col?.blocks || []).findIndex(
              (x) => String(x?.id) === String(path[path.length - 1]),
            ) + 1;
      updateAtPath(secIdx, topId, colPath, (c) => {
        const list = Array.isArray(c.blocks) ? c.blocks.slice() : [];
        list.splice(Math.max(0, at), 0, fresh);
        return { ...c, blocks: list };
      });
      selectPath(secIdx, topId, [...colPath, String(fresh.id)]);
    } else {
      const blocks = normalizeBlocksForSection(ensureSectionShape(sec));
      const at = topId
        ? blocks.findIndex((b) => String(b?.id) === String(topId)) + 1
        : blocks.length;
      const next = blocks.slice();
      next.splice(at > 0 ? at : blocks.length, 0, fresh);
      updateSectionBlocks(secIdx, next);
      selectPath(secIdx, String(fresh.id), []);
    }
    return true;
  }

  // ---- Release 1.2 Part B: templates ----
  const [elementsView, setElementsView] = useState("elements");
  const [templates, setTemplates] = useState(null); // null = not loaded
  const [templatesError, setTemplatesError] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  async function loadTemplates() {
    setTemplatesError("");
    try {
      const { data } = await api.get("/admin/sections");
      setTemplates(Array.isArray(data?.sections) ? data.sections : []);
    } catch (e) {
      setTemplates([]);
      setTemplatesError(pickErr(e, "Saved templates could not be loaded."));
    }
  }
  useEffect(() => {
    if (visualOnly && elementsView === "templates" && templates === null)
      loadTemplates();
  }, [visualOnly, elementsView, templates]); // eslint-disable-line react-hooks/exhaustive-deps

  const isCoreSec = (sec) =>
    String(sec?.id || "").startsWith("core-") ||
    (sec?.blocks || []).some((b) =>
      /^home_|^featured_live$|^latest_teaching$/.test(String(b?.type || "")),
    );

  function insertSectionsCopy(list, mode) {
    const copies = (Array.isArray(list) ? list : []).map((x) => {
      const c = cloneWithFreshIds(x);
      delete c.__template_kind;
      delete c.page_sections;
      return ensureSectionShape({ ...c, id: uid(), collapsed: false });
    });
    if (!copies.length) return;
    const cur = Array.isArray(contentJson?.extra_sections)
      ? contentJson.extra_sections
      : [];
    const selIdx =
      selectedSectionIndex === "" || selectedSectionIndex == null
        ? -1
        : Number(selectedSectionIndex);
    let at = cur.length;
    if (mode === "after" && selIdx >= 0) at = selIdx + 1;
    setBuilder((b) => {
      const arr = Array.isArray(b.extra_sections)
        ? b.extra_sections.slice()
        : [];
      if (mode === "replace")
        return { ...b, extra_sections: [...arr.filter(isCoreSec), ...copies] };
      arr.splice(Math.min(at, arr.length), 0, ...copies);
      return { ...b, extra_sections: arr };
    });
    const firstIdx =
      mode === "replace"
        ? cur.filter(isCoreSec).length
        : Math.min(at, cur.length);
    setSelectedInner(null);
    setSelectedBlockId("");
    setSelectedSectionIndex(String(firstIdx));
    setInspectorTab("section");
  }

  function applyPageTemplate(name, sections, mode) {
    if (mode === "replace") {
      openConfirm({
        title: `Replace this page with "${name}"?`,
        message:
          "The page's current sections are replaced by the template (Home's built-in parts stay). Nothing is saved until Save Draft, and you can undo.",
        confirmText: "Replace page",
        danger: true,
        onConfirm: () => {
          closeConfirm();
          insertSectionsCopy(sections, "replace");
          toast(
            "success",
            "Template applied",
            `${name} replaced the page content.`,
          );
        },
      });
      return;
    }
    insertSectionsCopy(sections, "end");
    toast(
      "success",
      "Template added",
      `${name} was added to the end of the page.`,
    );
  }

  async function insertSavedTemplate(item, mode) {
    try {
      const { data } = await api.get(`/admin/sections/${item.id}`);
      const json = data?.section?.section_json;
      if (!isObj(json)) throw new Error("This template has no content.");
      const kind = item.kind || json.__template_kind || "section";
      if (kind === "page")
        return applyPageTemplate(item.name, json.page_sections, mode);
      if (kind === "element") {
        const node = (json.blocks || [])[0];
        const secIdx =
          selectedSectionIndex === "" || selectedSectionIndex == null
            ? -1
            : Number(selectedSectionIndex);
        const sec =
          secIdx >= 0 ? (contentJson?.extra_sections || [])[secIdx] : null;
        if (sec && !isCoreSec(sec)) {
          insertNodeAt(
            secIdx,
            selectedBlockId || "",
            activeInner ? activeInner.path : [],
            node,
          );
        } else {
          insertSectionsCopy(
            [
              {
                title: item.name,
                layout: "plain",
                styles: { show_title: false },
                blocks: [node],
              },
            ],
            "after",
          );
        }
        toast("success", "Template inserted", `${item.name} was added.`);
        return;
      }
      insertSectionsCopy([json], "after");
      toast("success", "Template inserted", `${item.name} was added.`);
    } catch (e) {
      toast(
        "error",
        "Could not insert",
        pickErr(e, "The template could not be inserted."),
      );
    }
  }

  async function saveTemplate(kind, name) {
    const nm = String(name || "").trim();
    if (!nm) throw new Error("Enter a name");
    const sections = Array.isArray(contentJson?.extra_sections)
      ? contentJson.extra_sections
      : [];
    let section;
    if (kind === "element") {
      const node = activeInnerBlock || selTopBlock;
      if (!node) throw new Error("Select an element first");
      section = {
        title: nm,
        layout: "plain",
        styles: { show_title: false },
        __template_kind: "element",
        blocks: [node],
      };
    } else if (kind === "section") {
      const sec = sections[Number(selectedSectionIndex)];
      if (!sec || isCoreSec(sec))
        throw new Error("Select one of your sections first");
      section = { ...sec, __template_kind: "section" };
    } else {
      const own = sections.filter((x) => !isCoreSec(x));
      if (!own.length) throw new Error("This page has no sections to save yet");
      section = {
        title: nm,
        layout: "plain",
        blocks: [],
        __template_kind: "page",
        page_sections: own,
      };
    }
    try {
      await api.post("/admin/sections", { name: nm, category: kind, section });
    } catch (e) {
      throw new Error(pickErr(e, "The template could not be saved."));
    }
    setTemplates(null); // reload next time the list is shown
    toast("success", "Template saved", `"${nm}" is in Templates.`);
  }

  function deleteTemplate(item) {
    openConfirm({
      title: `Delete the template "${item.name}"?`,
      message:
        "Pages that already used it keep their content. This cannot be undone.",
      confirmText: "Delete template",
      danger: true,
      onConfirm: async () => {
        closeConfirm();
        try {
          await api.delete(`/admin/sections/${item.id}`);
          setTemplates((t) =>
            Array.isArray(t) ? t.filter((x) => x.id !== item.id) : t,
          );
        } catch (e) {
          toast(
            "error",
            "Could not delete",
            pickErr(e, "The template could not be deleted."),
          );
        }
      },
    });
  }

  function renderTemplatesPanel() {
    const q = templateSearch.trim().toLowerCase();
    const match = (n) =>
      !q ||
      String(n || "")
        .toLowerCase()
        .includes(q);
    const homePage = templateType === "home";
    const saved = Array.isArray(templates) ? templates : [];
    const group = (title, kind) => {
      const list = saved.filter(
        (t) => (t.kind || "section") === kind && match(t.name),
      );
      if (!list.length) return null;
      return (
        <div className="ap-elGroup" key={kind}>
          <h4>{title}</h4>
          <ul className="ap-tplList">
            {list.map((t) => (
              <li key={t.id} className="ap-tplItem">
                <div className="ap-tplName">
                  <strong>{t.name}</strong>
                  <span className="ap-tplMeta">
                    {kind === "page"
                      ? `${t.section_count} sections`
                      : kind === "element"
                        ? (t.block_types || []).map(blockTypeLabel).join(", ")
                        : `${t.block_count} blocks`}
                  </span>
                </div>
                <div className="ap-tplActions">
                  {kind === "page" ? (
                    <>
                      <button
                        type="button"
                        className="ap-btn"
                        onClick={() => insertSavedTemplate(t, "end")}
                      >
                        Add to page
                      </button>
                      {!homePage ? (
                        <button
                          type="button"
                          className="ap-btn"
                          onClick={() => insertSavedTemplate(t, "replace")}
                        >
                          Replace page
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <button
                      type="button"
                      className="ap-btn ap-btnPrimary"
                      onClick={() => insertSavedTemplate(t, "insert")}
                    >
                      Insert
                    </button>
                  )}
                  <button
                    type="button"
                    className="ap-btn ap-btnDanger"
                    aria-label={`Delete template ${t.name}`}
                    onClick={() => deleteTemplate(t)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      );
    };
    const starters = STARTER_PAGES.filter(
      (p) => match(p.name) || match(p.description),
    );
    return (
      <div className="ap-elPanel" aria-label="Templates">
        <input
          className="ap-input ap-elSearch"
          type="search"
          placeholder="Search templates…"
          aria-label="Search templates"
          value={templateSearch}
          onChange={(e) => setTemplateSearch(e.target.value)}
        />
        {templatesError ? (
          <p className="ap-help" role="alert">
            {templatesError}
          </p>
        ) : null}
        {templates === null ? (
          <p className="ap-help" role="status">
            Loading templates…
          </p>
        ) : null}
        {group("My pages", "page")}
        {group("My sections", "section")}
        {group("My elements", "element")}
        {templates && !saved.length ? (
          <p className="ap-help">
            No saved templates yet. Use “Save as template” on an element, a
            section or the page.
          </p>
        ) : null}
        {starters.length ? (
          <div className="ap-elGroup">
            <h4>Starter pages</h4>
            <ul className="ap-tplList">
              {starters.map((p) => (
                <li key={p.id} className="ap-tplItem">
                  <div className="ap-tplName">
                    <strong>{p.name}</strong>
                    <span className="ap-tplMeta">{p.description}</span>
                  </div>
                  <div className="ap-tplActions">
                    <button
                      type="button"
                      className="ap-btn"
                      onClick={() =>
                        applyPageTemplate(p.name, p.sections, "end")
                      }
                    >
                      Add to page
                    </button>
                    {!homePage ? (
                      <button
                        type="button"
                        className="ap-btn"
                        onClick={() =>
                          applyPageTemplate(p.name, p.sections, "replace")
                        }
                      >
                        Replace page
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  function renderLeavePrompt() {
    if (!leavePrompt) return null;
    return (
      <div
        className="ap-modalOverlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-leaveTitle"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !leaving) setLeavePrompt(null);
        }}
      >
        <div className="ap-modal">
          <div className="ap-modalTitle" id="ap-leaveTitle">
            Leave without saving?
          </div>
          <div className="ap-modalMsg">
            This page has changes that haven’t been saved as a draft.
          </div>
          <div className="ap-modalActions ap-leaveActions">
            <button
              type="button"
              className="ap-btn"
              onClick={() => setLeavePrompt(null)}
              disabled={leaving}
              autoFocus
            >
              Stay on page
            </button>
            <button
              type="button"
              className="ap-btn ap-btnDanger"
              onClick={() => confirmLeave("discard")}
              disabled={leaving}
            >
              Leave without saving
            </button>
            <button
              type="button"
              className="ap-btn ap-btnPrimary"
              onClick={() => confirmLeave("save")}
              disabled={leaving}
            >
              {leaving ? "Saving…" : "Save draft and leave"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function doPublish() {
    if (dirty) {
      const saved = await saveDraft();
      if (!saved) return;
    }
    setSaving(true);
    try {
      await api.post(`/admin/pages/${id}/publish`);
      await load();
      toast("success", "Published", "This page is now live.");
    } catch (e) {
      toast("error", "Publish failed", pickErr(e, "Publish failed"));
    } finally {
      setUploading(false);
      setUploadLabel("Uploading…");
      setSaving(false);
    }
  }

  async function doUnpublish() {
    setSaving(true);
    try {
      await api.post(`/admin/pages/${id}/unpublish`);
      await load();
      toast("success", "Unpublished", "This page is now in draft mode.");
    } catch (e) {
      toast("error", "Unpublish failed", pickErr(e, "Unpublish failed"));
    } finally {
      setUploading(false);
      setUploadLabel("Uploading…");
      setSaving(false);
    }
  }

  async function doDelete() {
    setSaving(true);
    try {
      await api.delete(`/admin/pages/${id}`);
      toast("success", "Deleted", "Page deleted.");
      nav("/admin/pages");
    } catch (e) {
      toast("error", "Delete failed", pickErr(e, "Delete failed"));
    } finally {
      setUploading(false);
      setUploadLabel("Uploading…");
      setSaving(false);
    }
  }

  async function onHeroFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    try {
      const url = await uploadImage(file, "hero");

      if (templateType === "home") {
        setContentJson((prev) => {
          const base = deepMergeHomeDefaults(prev || {});
          return {
            ...base,
            hero: { ...(base.hero || {}), background_url: url || "" },
          };
        });
      } else {
        setHero(url);
      }

      toast(
        "success",
        file.__fromLibrary ? "Image selected" : "Uploaded",
        file.__fromLibrary
          ? "Hero image set from the Media Library. Save Draft to keep it."
          : "Image uploaded successfully.",
      );
    } catch (err) {
      toast("error", "Upload failed", pickErr(err, "Upload failed"));
    } finally {
      setSaving(false);
      e.target.value = "";
    }
  }

  /* -----------------------------
     Home Builder renderer
  ----------------------------- */
  function renderHomeBuilder() {
    const model =
      templateType === "home"
        ? deepMergeHomeDefaults(contentJson || {})
        : ensureGenericModel(contentJson || {});
    const extra = Array.isArray(model.extra_sections)
      ? model.extra_sections.map(ensureSectionShape)
      : [];

    return (
      <div>
        <div className="ap-help" style={{ marginBottom: 12 }}>
          {templateType === "home" ? (
            <>
              Home is now fully builder-driven. Reorder sections with ↑ ↓ (or
              drag & drop) and edit each section’s blocks to update what appears
              on Home.
            </>
          ) : (
            <>
              This page is builder-driven. Add sections/blocks below and reorder
              them to control what appears on the public page.
            </>
          )}
        </div>

        {/* Extra sections */}
        <SectionCard
          title="Page Builder Sections"
          right={
            <>
              <button
                className="ap-btn ap-btnPrimary"
                type="button"
                onClick={addExtraSection}
              >
                + Add Section
              </button>
              <button
                type="button"
                className="ap-btn"
                onClick={() => setPatternLibraryOpen((open) => !open)}
              >
                {patternLibraryOpen ? "Close Templates" : "Browse Templates"}
              </button>
            </>
          }
        >
          <div className="ap-help" style={{ marginBottom: 10 }}>
            Add sections to build your page. Each section can hold text, images,
            cards, buttons and columns.
          </div>

          {renderSectionPatternLibrary()}

          {!extra.length ? (
            <div
              className="ap-card"
              style={{
                padding: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px dashed rgba(255,255,255,0.14)",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 6 }}>
                No sections yet
              </div>
              <div className="ap-help">Click “Add Section” to create one.</div>
            </div>
          ) : (
            extra.map((sec, idx) => {
              const collapsed = !!sec.collapsed;
              const blocks = Array.isArray(sec.blocks) ? sec.blocks : [];
              const hasBlocks = blocks.length > 0;

              return (
                <div
                  key={sec.id}
                  draggable
                  onDragEnd={(e) => {
                    e.currentTarget.classList.remove("ap-phase4gbDragging");
                    document
                      .querySelectorAll(".ap-phase4gbDropTarget")
                      .forEach((node) =>
                        node.classList.remove("ap-phase4gbDropTarget"),
                      );
                  }}
                  onDragStart={(e) => {
                    dragSectionRef.current = { idx };
                    e.currentTarget.classList.add("ap-phase4gbDragging");
                    try {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(idx));
                    } catch (_e) {}
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add("ap-phase4gbDropTarget");
                    try {
                      e.dataTransfer.dropEffect = "move";
                    } catch (_e) {}
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("ap-phase4gbDropTarget");
                    const from = Number(dragSectionRef.current?.idx);
                    const to = idx;
                    if (!Number.isNaN(from) && from >= 0 && from !== to) {
                      reorderExtraSections(from, to);
                    }
                    dragSectionRef.current = { idx: -1 };
                  }}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 14,
                    padding: 12,
                    background: "rgba(0,0,0,0.18)",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <button
                        className="ap-btn"
                        type="button"
                        onClick={() =>
                          updateExtraSection(idx, { collapsed: !collapsed })
                        }
                        title={collapsed ? "Expand" : "Collapse"}
                        style={{ padding: "6px 10px" }}
                      >
                        {collapsed ? "▸" : "▾"}
                      </button>
                      <div style={{ fontWeight: 900 }}>
                        {sec.title || `Section ${idx + 1}`}
                      </div>
                    </div>

                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <button
                        className="ap-btn"
                        type="button"
                        onClick={() => moveExtraSection(idx, -1)}
                        disabled={idx === 0}
                        title="Move up"
                        style={{ padding: "6px 10px" }}
                      >
                        ↑
                      </button>
                      <button
                        className="ap-btn"
                        type="button"
                        onClick={() => moveExtraSection(idx, 1)}
                        disabled={idx === extra.length - 1}
                        title="Move down"
                        style={{ padding: "6px 10px" }}
                      >
                        ↓
                      </button>
                      <button
                        className="ap-btn"
                        type="button"
                        onClick={() => duplicateExtraSection(idx)}
                        title="Duplicate section and its blocks"
                      >
                        Duplicate
                      </button>
                      <button
                        className="ap-btn"
                        type="button"
                        onClick={() => openSaveSectionDialog(sec)}
                        title="Save a copy of this section so you can insert it on other pages"
                      >
                        Save to library
                      </button>
                      <button
                        className="ap-btn ap-btnDanger"
                        type="button"
                        onClick={() =>
                          openConfirm({
                            title: "Delete section?",
                            message:
                              "This removes the section from the page builder.",
                            confirmText: "Delete",
                            danger: true,
                            onConfirm: async () => {
                              closeConfirm();
                              deleteExtraSection(idx);
                            },
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {!collapsed ? (
                    <>
                      <Field label="Section Title">
                        <input
                          className="ap-input"
                          value={sec.title || ""}
                          onChange={(e) =>
                            updateExtraSection(idx, { title: e.target.value })
                          }
                        />
                      </Field>
                      <details className="ap-sectionSettings">
                        <summary>
                          Section settings: layout, theme and style
                        </summary>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 10,
                          }}
                        >
                          <Field label="Layout">
                            <select
                              className="ap-input"
                              value={sec.layout || "card"}
                              onChange={(e) => {
                                const nextLayout = e.target.value;
                                const prevLayout = String(sec.layout || "card");
                                const wasTwo = prevLayout === "two_columns";
                                const goingTwo = nextLayout === "two_columns";

                                if (
                                  goingTwo &&
                                  !sec.left_html &&
                                  !sec.right_html
                                ) {
                                  updateExtraSection(idx, {
                                    layout: nextLayout,
                                    left_html: sec.html || "",
                                    right_html: "",
                                  });
                                  return;
                                }

                                if (wasTwo && !goingTwo) {
                                  const legacyEmpty = !String(
                                    sec.html || "",
                                  ).trim();
                                  const leftHas = !!String(
                                    sec.left_html || "",
                                  ).trim();
                                  updateExtraSection(idx, {
                                    layout: nextLayout,
                                    html:
                                      legacyEmpty && leftHas
                                        ? sec.left_html
                                        : sec.html || "",
                                  });
                                  return;
                                }

                                updateExtraSection(idx, { layout: nextLayout });
                              }}
                            >
                              {SECTION_LAYOUT_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </Field>

                          <Field label="Theme">
                            <select
                              className="ap-input"
                              value={sec.theme || "default"}
                              onChange={(e) =>
                                updateExtraSection(idx, {
                                  theme: e.target.value,
                                })
                              }
                            >
                              {SECTION_THEME_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            marginTop: 10,
                            marginBottom: 10,
                          }}
                        >
                          <button
                            className="ap-btn"
                            type="button"
                            onClick={() => openStyleModal(idx)}
                            title="Open style settings"
                          >
                            🎨 Style
                          </button>

                          <button
                            className="ap-btn"
                            type="button"
                            onClick={() =>
                              updateExtraSection(idx, {
                                styles: defaultSectionStyle(
                                  sec.theme || "default",
                                ),
                              })
                            }
                            title="Reset style controls to defaults"
                          >
                            Reset Styles
                          </button>
                        </div>
                      </details>

                      {/* Blocks / Elements */}
                      <div
                        className="ap-blockWrap"
                        style={{
                          marginTop: 10,
                          marginBottom: 12,
                          padding: 12,
                          borderRadius: 14,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(255,255,255,0.03)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            marginBottom: 10,
                          }}
                        >
                          <div style={{ fontWeight: 900 }}>
                            Add to this section
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            {!hasBlocks ? (
                              <button
                                className="ap-btn"
                                type="button"
                                onClick={() => convertLegacyHtmlToBlocks(idx)}
                                title="Convert current HTML into blocks"
                              >
                                Convert to Blocks
                              </button>
                            ) : (
                              <button
                                className="ap-btn"
                                type="button"
                                onClick={() => clearBlocksUseLegacy(idx)}
                                title="Remove blocks and use legacy HTML again"
                              >
                                HTML (advanced)
                              </button>
                            )}

                            <button
                              className="ap-btn ap-btnPrimary"
                              type="button"
                              onClick={() => addBlock(idx, "richtext")}
                            >
                              + Rich Text
                            </button>
                            <button
                              className="ap-btn"
                              type="button"
                              onClick={() => addBlock(idx, "grid")}
                            >
                              + Grid
                            </button>
                            <button
                              className="ap-btn"
                              type="button"
                              onClick={() => addBlock(idx, "gallery")}
                            >
                              + Gallery
                            </button>
                            <button
                              className="ap-btn"
                              type="button"
                              onClick={() => addBlock(idx, "button")}
                            >
                              + Button
                            </button>
                            <button
                              className="ap-btn"
                              type="button"
                              onClick={() => addBlock(idx, "columns")}
                              title="Add a multi-column container"
                            >
                              + Columns
                            </button>
                            <button
                              className="ap-btn"
                              type="button"
                              onClick={() => addBlock(idx, "video")}
                            >
                              + Video
                            </button>
                            <button
                              className="ap-btn"
                              type="button"
                              onClick={() => addBlock(idx, "quote")}
                            >
                              + Quote
                            </button>
                            <button
                              className="ap-btn"
                              type="button"
                              onClick={() => addBlock(idx, "faq")}
                            >
                              + FAQ
                            </button>
                            <button
                              className="ap-btn"
                              type="button"
                              onClick={() => addBlock(idx, "spacer")}
                            >
                              + Spacer
                            </button>

                            {templateType === "home" ? (
                              <>
                                <button
                                  className="ap-btn"
                                  type="button"
                                  onClick={() => addBlock(idx, "home_hero")}
                                  title="Add a Home Hero block"
                                >
                                  + Home Hero
                                </button>
                                <button
                                  className="ap-btn"
                                  type="button"
                                  onClick={() => addBlock(idx, "home_join")}
                                  title="Add a Join Strip block"
                                >
                                  + Join Strip
                                </button>
                                <button
                                  className="ap-btn"
                                  type="button"
                                  onClick={() => addBlock(idx, "featured_live")}
                                  title="Add the Featured Live Highlight block"
                                >
                                  + Featured Live
                                </button>
                                <button
                                  className="ap-btn"
                                  type="button"
                                  onClick={() =>
                                    addBlock(idx, "latest_teaching")
                                  }
                                  title="Add the Latest Teaching section"
                                >
                                  + Latest Teaching
                                </button>
                                <button
                                  className="ap-btn"
                                  type="button"
                                  onClick={() => addBlock(idx, "home_cta")}
                                  title="Add a Watch More CTA block"
                                >
                                  + Watch CTA
                                </button>
                                <button
                                  className="ap-btn"
                                  type="button"
                                  onClick={() => addBlock(idx, "home_about")}
                                  title="Add an About block"
                                >
                                  + About
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {!hasBlocks ? (
                          <div className="ap-help">
                            Add elements like Grid and Image Gallery. If you
                            keep blocks empty, the section will continue using
                            the legacy HTML editor below.
                          </div>
                        ) : (
                          <div className="ap-blockList">
                            {blocks.map((b, bi) => (
                              <div
                                key={b.id}
                                className={
                                  "ap-blockCard ap-phase4faSelectable" +
                                  (selectedSectionIndex === String(idx) &&
                                  selectedBlockId === String(b.id)
                                    ? " ap-phase4faSelected"
                                    : "")
                                }
                                data-block-id={String(b.id)}
                                onClick={(event) => {
                                  // Preserve native inputs, rich text editing, and controls.
                                  // Selecting the block never mutates its saved content.
                                  if (
                                    event.target.closest(
                                      "button, input, select, textarea, a, [contenteditable='true']",
                                    )
                                  )
                                    return;
                                  setSelectedSectionIndex(String(idx));
                                  setSelectedBlockId(String(b.id));
                                  setInspectorTab("block");
                                  setInspectorOpen(true);
                                }}
                                draggable
                                onDragStart={(e) => {
                                  dragBlockRef.current = {
                                    sectionIdx: idx,
                                    idx: bi,
                                  };
                                  try {
                                    e.dataTransfer.effectAllowed = "move";
                                    e.dataTransfer.setData(
                                      "text/plain",
                                      `${idx}:${bi}`,
                                    );
                                  } catch (_e) {}
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  try {
                                    e.dataTransfer.dropEffect = "move";
                                  } catch (_e) {}
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const from = dragBlockRef.current || {
                                    sectionIdx: -1,
                                    idx: -1,
                                  };
                                  const to = { sectionIdx: idx, idx: bi };
                                  if (
                                    from.sectionIdx === to.sectionIdx &&
                                    from.idx >= 0 &&
                                    from.idx !== to.idx
                                  ) {
                                    reorderBlocks(idx, from.idx, to.idx);
                                  }
                                  dragBlockRef.current = {
                                    sectionIdx: -1,
                                    idx: -1,
                                  };
                                }}
                              >
                                <div className="ap-blockHead">
                                  <button
                                    type="button"
                                    className={
                                      "ap-phase4SelectBlock" +
                                      (selectedSectionIndex === String(idx) &&
                                      selectedBlockId === String(b.id)
                                        ? " is-selected"
                                        : "")
                                    }
                                    aria-label={
                                      "Select " +
                                      String(b.type || "richtext") +
                                      " block for editing"
                                    }
                                    onClick={() => {
                                      setSelectedSectionIndex(String(idx));
                                      setSelectedBlockId(String(b.id));
                                      setInspectorTab("block");
                                      setInspectorOpen(true);
                                    }}
                                  >
                                    <span aria-hidden="true">◎</span> Select
                                  </button>
                                  <div className="ap-blockTitle">
                                    <span className="ap-badge">
                                      {blockTypeLabel(b.type)}
                                    </span>
                                    <span style={{ fontWeight: 900 }}>
                                      {b.type === "richtext"
                                        ? "Text"
                                        : b.type === "grid"
                                          ? "Grid"
                                          : b.type === "gallery"
                                            ? "Gallery"
                                            : b.type === "button"
                                              ? "Button"
                                              : b.type === "columns"
                                                ? "Columns"
                                                : blockTypeLabel(b.type)}
                                    </span>
                                  </div>

                                  <div className="ap-blockActions">
                                    <button
                                      className="ap-btn"
                                      type="button"
                                      onClick={() => moveBlock(idx, b.id, -1)}
                                      disabled={bi === 0}
                                      title="Move up"
                                      style={{ padding: "6px 10px" }}
                                    >
                                      ↑
                                    </button>
                                    <button
                                      className="ap-btn"
                                      type="button"
                                      onClick={() => moveBlock(idx, b.id, 1)}
                                      disabled={bi === blocks.length - 1}
                                      title="Move down"
                                      style={{ padding: "6px 10px" }}
                                    >
                                      ↓
                                    </button>
                                    <button
                                      className="ap-btn"
                                      type="button"
                                      onClick={() => duplicateBlock(idx, b.id)}
                                      title="Duplicate this block"
                                    >
                                      Duplicate
                                    </button>
                                    <button
                                      className="ap-btn ap-btnDanger"
                                      type="button"
                                      onClick={() =>
                                        openConfirm({
                                          title: "Delete element?",
                                          message:
                                            "This removes the element from this section.",
                                          confirmText: "Delete",
                                          danger: true,
                                          onConfirm: async () => {
                                            closeConfirm();
                                            deleteBlock(idx, b.id);
                                          },
                                        })
                                      }
                                      style={{ padding: "6px 10px" }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>

                                {/* Phase 5: video, spacer, quote, FAQ */}
                                {EXTRA_BLOCK_TYPES.has(String(b.type || "")) ? (
                                  <ExtraBlockEditor
                                    block={b}
                                    onPatch={(patch) =>
                                      patchBlock(idx, b.id, patch)
                                    }
                                  />
                                ) : null}
                                {String(b.type || "richtext") === "richtext" ? (
                                  <div className="ap-editorWrap">
                                    <ModernPageEditor
                                      value={String(b.html || "")}
                                      onChangeHtml={(html) =>
                                        patchBlock(idx, b.id, { html })
                                      }
                                      onChange={(html) =>
                                        patchBlock(idx, b.id, { html })
                                      }
                                      onUploadImage={async (file) =>
                                        uploadImage(file, "inline")
                                      }
                                    />
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") === "button" ? (
                                  <div className="ap-blockBody">
                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 10,
                                      }}
                                    >
                                      <Field label="Button Text">
                                        <input
                                          className="ap-input"
                                          value={String(b.text || "")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              text: e.target.value,
                                            })
                                          }
                                        />
                                      </Field>
                                      <Field label="Link (href)">
                                        <input
                                          className="ap-input"
                                          value={String(b.href || "")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              href: e.target.value,
                                            })
                                          }
                                          placeholder="/catalog or https://..."
                                        />
                                      </Field>
                                    </div>

                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr 1fr",
                                        gap: 10,
                                        marginTop: 10,
                                      }}
                                    >
                                      <Field label="Align">
                                        <select
                                          className="ap-input"
                                          value={String(b.align || "left")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              align: e.target.value,
                                            })
                                          }
                                        >
                                          {["left", "center", "right"].map(
                                            (v) => (
                                              <option key={v} value={v}>
                                                {v}
                                              </option>
                                            ),
                                          )}
                                        </select>
                                      </Field>

                                      <Field label="Variant">
                                        <select
                                          className="ap-input"
                                          value={String(b.variant || "solid")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              variant: e.target.value,
                                            })
                                          }
                                        >
                                          {["solid", "outline", "ghost"].map(
                                            (v) => (
                                              <option key={v} value={v}>
                                                {v}
                                              </option>
                                            ),
                                          )}
                                        </select>
                                      </Field>

                                      <Field label="Size">
                                        <select
                                          className="ap-input"
                                          value={String(b.size || "md")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              size: e.target.value,
                                            })
                                          }
                                        >
                                          {["sm", "md", "lg"].map((v) => (
                                            <option key={v} value={v}>
                                              {v}
                                            </option>
                                          ))}
                                        </select>
                                      </Field>
                                    </div>

                                    <details style={{ marginTop: 10 }}>
                                      <summary
                                        style={{
                                          cursor: "pointer",
                                          fontWeight: 900,
                                        }}
                                      >
                                        Styling Options
                                      </summary>

                                      <div
                                        style={{
                                          display: "grid",
                                          gridTemplateColumns: "1fr 1fr",
                                          gap: 10,
                                          marginTop: 10,
                                        }}
                                      >
                                        <Field label="Padding">
                                          <input
                                            className="ap-input"
                                            value={String(
                                              b.styles?.padding || "",
                                            )}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                styles: {
                                                  ...(b.styles || {}),
                                                  padding: e.target.value,
                                                },
                                              })
                                            }
                                            placeholder="e.g. 12px 16px"
                                          />
                                        </Field>

                                        <Field label="Radius">
                                          <input
                                            className="ap-input"
                                            type="number"
                                            value={String(
                                              b.styles?.radius ?? 14,
                                            )}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                styles: {
                                                  ...(b.styles || {}),
                                                  radius:
                                                    Number(e.target.value) || 0,
                                                },
                                              })
                                            }
                                          />
                                        </Field>

                                        <Field label="Background Color">
                                          <input
                                            className="ap-input"
                                            value={String(
                                              b.styles?.bg_color || "",
                                            )}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                styles: {
                                                  ...(b.styles || {}),
                                                  bg_color: e.target.value,
                                                },
                                              })
                                            }
                                            placeholder="#FD9D00"
                                          />
                                        </Field>

                                        <Field label="Text Color">
                                          <input
                                            className="ap-input"
                                            value={String(
                                              b.styles?.text_color || "",
                                            )}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                styles: {
                                                  ...(b.styles || {}),
                                                  text_color: e.target.value,
                                                },
                                              })
                                            }
                                            placeholder="#0b0d12"
                                          />
                                        </Field>

                                        <Field label="Border Color">
                                          <input
                                            className="ap-input"
                                            value={String(
                                              b.styles?.border_color || "",
                                            )}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                styles: {
                                                  ...(b.styles || {}),
                                                  border_color: e.target.value,
                                                },
                                              })
                                            }
                                            placeholder="rgba(255,255,255,0.12)"
                                          />
                                        </Field>

                                        <Field label="Border Width">
                                          <input
                                            className="ap-input"
                                            type="number"
                                            value={String(
                                              b.styles?.border_width ?? 1,
                                            )}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                styles: {
                                                  ...(b.styles || {}),
                                                  border_width:
                                                    Number(e.target.value) || 0,
                                                },
                                              })
                                            }
                                          />
                                        </Field>

                                        <Field label="Target (optional)">
                                          <select
                                            className="ap-input"
                                            value={String(b.target || "")}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                target: e.target.value,
                                              })
                                            }
                                          >
                                            <option value="">Same tab</option>
                                            <option value="_blank">
                                              New tab
                                            </option>
                                          </select>
                                        </Field>
                                      </div>
                                    </details>
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") === "columns" ? (
                                  <div className="ap-blockBody">
                                    {(() => {
                                      const blk = normalizeColumnsBlock(b);
                                      const cols = Array.isArray(blk.columns)
                                        ? blk.columns
                                        : [];
                                      return (
                                        <>
                                          <div
                                            style={{
                                              display: "grid",
                                              gridTemplateColumns: "1fr 1fr",
                                              gap: 10,
                                              alignItems: "end",
                                            }}
                                          >
                                            <Field label="Gap (px)">
                                              <input
                                                className="ap-input"
                                                type="number"
                                                value={String(blk.gap ?? 14)}
                                                onChange={(e) =>
                                                  patchBlock(idx, b.id, {
                                                    gap: Math.max(
                                                      0,
                                                      Number(e.target.value) ||
                                                        0,
                                                    ),
                                                  })
                                                }
                                              />
                                            </Field>

                                            <Field label="Stack on mobile">
                                              <select
                                                className="ap-input"
                                                value={String(
                                                  blk.stack_on_mobile ?? true,
                                                )}
                                                onChange={(e) =>
                                                  patchBlock(idx, b.id, {
                                                    stack_on_mobile:
                                                      String(e.target.value) ===
                                                      "true",
                                                  })
                                                }
                                              >
                                                <option value="true">
                                                  Yes
                                                </option>
                                                <option value="false">
                                                  No
                                                </option>
                                              </select>
                                            </Field>
                                          </div>

                                          <details style={{ marginTop: 10 }}>
                                            <summary
                                              style={{
                                                cursor: "pointer",
                                                fontWeight: 900,
                                              }}
                                            >
                                              Container Styling
                                            </summary>

                                            <div
                                              style={{
                                                display: "grid",
                                                gridTemplateColumns: "1fr 1fr",
                                                gap: 10,
                                                marginTop: 10,
                                              }}
                                            >
                                              <Field label="Padding">
                                                <input
                                                  className="ap-input"
                                                  value={String(
                                                    blk.styles?.padding || "",
                                                  )}
                                                  onChange={(e) =>
                                                    patchBlock(idx, b.id, {
                                                      styles: {
                                                        ...(blk.styles || {}),
                                                        padding: e.target.value,
                                                      },
                                                    })
                                                  }
                                                  placeholder="e.g. 16px"
                                                />
                                              </Field>
                                              <Field label="Background">
                                                <input
                                                  className="ap-input"
                                                  value={String(
                                                    blk.styles?.bg_color || "",
                                                  )}
                                                  onChange={(e) =>
                                                    patchBlock(idx, b.id, {
                                                      styles: {
                                                        ...(blk.styles || {}),
                                                        bg_color:
                                                          e.target.value,
                                                      },
                                                    })
                                                  }
                                                  placeholder="rgba(...) or #..."
                                                />
                                              </Field>
                                              <Field label="Border Color">
                                                <input
                                                  className="ap-input"
                                                  value={String(
                                                    blk.styles?.border_color ||
                                                      "",
                                                  )}
                                                  onChange={(e) =>
                                                    patchBlock(idx, b.id, {
                                                      styles: {
                                                        ...(blk.styles || {}),
                                                        border_color:
                                                          e.target.value,
                                                      },
                                                    })
                                                  }
                                                />
                                              </Field>
                                              <Field label="Border Width">
                                                <input
                                                  className="ap-input"
                                                  type="number"
                                                  value={String(
                                                    blk.styles?.border_width ??
                                                      "",
                                                  )}
                                                  onChange={(e) =>
                                                    patchBlock(idx, b.id, {
                                                      styles: {
                                                        ...(blk.styles || {}),
                                                        border_width:
                                                          Number(
                                                            e.target.value,
                                                          ) || 0,
                                                      },
                                                    })
                                                  }
                                                />
                                              </Field>
                                              <Field label="Radius">
                                                <input
                                                  className="ap-input"
                                                  type="number"
                                                  value={String(
                                                    blk.styles?.radius ?? 14,
                                                  )}
                                                  onChange={(e) =>
                                                    patchBlock(idx, b.id, {
                                                      styles: {
                                                        ...(blk.styles || {}),
                                                        radius:
                                                          Number(
                                                            e.target.value,
                                                          ) || 0,
                                                      },
                                                    })
                                                  }
                                                />
                                              </Field>
                                            </div>
                                          </details>

                                          <div
                                            style={{
                                              display: "flex",
                                              gap: 10,
                                              flexWrap: "wrap",
                                              marginTop: 10,
                                            }}
                                          >
                                            <button
                                              className="ap-btn ap-btnPrimary"
                                              type="button"
                                              onClick={() =>
                                                addColumn(idx, b.id)
                                              }
                                            >
                                              + Add Column
                                            </button>
                                          </div>

                                          <div
                                            style={{
                                              marginTop: 12,
                                              display: "grid",
                                              gap: 12,
                                            }}
                                          >
                                            {cols.map((c, ci) => {
                                              const innerBlocks =
                                                normalizeBlocksArray(c.blocks);
                                              return (
                                                <div
                                                  key={c.id}
                                                  className="ap-card"
                                                  style={{ padding: 12 }}
                                                >
                                                  <div
                                                    style={{
                                                      display: "flex",
                                                      justifyContent:
                                                        "space-between",
                                                      gap: 10,
                                                      alignItems: "center",
                                                      flexWrap: "wrap",
                                                    }}
                                                  >
                                                    <div
                                                      style={{
                                                        fontWeight: 900,
                                                      }}
                                                    >
                                                      Column {ci + 1}{" "}
                                                      <span
                                                        style={{
                                                          opacity: 0.7,
                                                          fontWeight: 700,
                                                        }}
                                                      >
                                                        (
                                                        {Math.round(
                                                          clampNum(
                                                            c.width_pct ?? 50,
                                                            10,
                                                            90,
                                                          ),
                                                        )}
                                                        %)
                                                      </span>
                                                    </div>
                                                    <div
                                                      style={{
                                                        display: "flex",
                                                        gap: 8,
                                                        flexWrap: "wrap",
                                                      }}
                                                    >
                                                      <button
                                                        className="ap-btn"
                                                        type="button"
                                                        onClick={() =>
                                                          moveColumn(
                                                            idx,
                                                            b.id,
                                                            ci,
                                                            ci - 1,
                                                          )
                                                        }
                                                        disabled={ci === 0}
                                                        title="Move left"
                                                        style={{
                                                          padding: "6px 10px",
                                                        }}
                                                      >
                                                        ←
                                                      </button>
                                                      <button
                                                        className="ap-btn"
                                                        type="button"
                                                        onClick={() =>
                                                          moveColumn(
                                                            idx,
                                                            b.id,
                                                            ci,
                                                            ci + 1,
                                                          )
                                                        }
                                                        disabled={
                                                          ci === cols.length - 1
                                                        }
                                                        title="Move right"
                                                        style={{
                                                          padding: "6px 10px",
                                                        }}
                                                      >
                                                        →
                                                      </button>
                                                      <button
                                                        className="ap-btn ap-btnDanger"
                                                        type="button"
                                                        onClick={() =>
                                                          openConfirm({
                                                            title:
                                                              "Delete column?",
                                                            message:
                                                              "This will remove the entire column and its contents.",
                                                            confirmText:
                                                              "Delete",
                                                            danger: true,
                                                            onConfirm:
                                                              async () => {
                                                                closeConfirm();
                                                                deleteColumn(
                                                                  idx,
                                                                  b.id,
                                                                  c.id,
                                                                );
                                                              },
                                                          })
                                                        }
                                                        style={{
                                                          padding: "6px 10px",
                                                        }}
                                                      >
                                                        Delete
                                                      </button>
                                                    </div>
                                                  </div>

                                                  <div
                                                    style={{
                                                      display: "grid",
                                                      gridTemplateColumns:
                                                        "1fr 1fr",
                                                      gap: 10,
                                                      marginTop: 10,
                                                    }}
                                                  >
                                                    <Field label="Width %">
                                                      <input
                                                        className="ap-input"
                                                        type="number"
                                                        value={String(
                                                          c.width_pct ?? 50,
                                                        )}
                                                        onChange={(e) =>
                                                          patchColumn(
                                                            idx,
                                                            b.id,
                                                            c.id,
                                                            {
                                                              width_pct:
                                                                clampNum(
                                                                  Number(
                                                                    e.target
                                                                      .value,
                                                                  ) || 50,
                                                                  10,
                                                                  90,
                                                                ),
                                                            },
                                                          )
                                                        }
                                                      />
                                                    </Field>
                                                    <Field label="Padding">
                                                      <input
                                                        className="ap-input"
                                                        value={String(
                                                          c.styles?.padding ||
                                                            "",
                                                        )}
                                                        onChange={(e) =>
                                                          patchColumn(
                                                            idx,
                                                            b.id,
                                                            c.id,
                                                            {
                                                              styles: {
                                                                ...(c.styles ||
                                                                  {}),
                                                                padding:
                                                                  e.target
                                                                    .value,
                                                              },
                                                            },
                                                          )
                                                        }
                                                        placeholder="e.g. 12px"
                                                      />
                                                    </Field>
                                                    <Field label="Background">
                                                      <input
                                                        className="ap-input"
                                                        value={String(
                                                          c.styles?.bg_color ||
                                                            "",
                                                        )}
                                                        onChange={(e) =>
                                                          patchColumn(
                                                            idx,
                                                            b.id,
                                                            c.id,
                                                            {
                                                              styles: {
                                                                ...(c.styles ||
                                                                  {}),
                                                                bg_color:
                                                                  e.target
                                                                    .value,
                                                              },
                                                            },
                                                          )
                                                        }
                                                      />
                                                    </Field>
                                                    <Field label="Radius">
                                                      <input
                                                        className="ap-input"
                                                        type="number"
                                                        value={String(
                                                          c.styles?.radius ??
                                                            14,
                                                        )}
                                                        onChange={(e) =>
                                                          patchColumn(
                                                            idx,
                                                            b.id,
                                                            c.id,
                                                            {
                                                              styles: {
                                                                ...(c.styles ||
                                                                  {}),
                                                                radius:
                                                                  Number(
                                                                    e.target
                                                                      .value,
                                                                  ) || 0,
                                                              },
                                                            },
                                                          )
                                                        }
                                                      />
                                                    </Field>
                                                  </div>

                                                  <div
                                                    style={{
                                                      display: "flex",
                                                      gap: 10,
                                                      flexWrap: "wrap",
                                                      marginTop: 10,
                                                    }}
                                                  >
                                                    <button
                                                      className="ap-btn"
                                                      type="button"
                                                      onClick={() =>
                                                        addColumnBlock(
                                                          idx,
                                                          b.id,
                                                          c.id,
                                                          "richtext",
                                                        )
                                                      }
                                                    >
                                                      + Text
                                                    </button>
                                                    <button
                                                      className="ap-btn"
                                                      type="button"
                                                      onClick={() =>
                                                        addColumnBlock(
                                                          idx,
                                                          b.id,
                                                          c.id,
                                                          "button",
                                                        )
                                                      }
                                                    >
                                                      + Button
                                                    </button>
                                                    <button
                                                      className="ap-btn"
                                                      type="button"
                                                      onClick={() =>
                                                        addColumnBlock(
                                                          idx,
                                                          b.id,
                                                          c.id,
                                                          "grid",
                                                        )
                                                      }
                                                    >
                                                      + Grid
                                                    </button>
                                                    <button
                                                      className="ap-btn"
                                                      type="button"
                                                      onClick={() =>
                                                        addColumnBlock(
                                                          idx,
                                                          b.id,
                                                          c.id,
                                                          "gallery",
                                                        )
                                                      }
                                                    >
                                                      + Gallery
                                                    </button>
                                                  </div>

                                                  <div
                                                    style={{
                                                      marginTop: 12,
                                                      display: "grid",
                                                      gap: 10,
                                                    }}
                                                  >
                                                    {innerBlocks.map(
                                                      (ib, ibi) => (
                                                        <div
                                                          key={ib.id}
                                                          className="ap-blockCard"
                                                          style={{ margin: 0 }}
                                                        >
                                                          <div className="ap-blockHead">
                                                            <div className="ap-blockTitle">
                                                              <span className="ap-badge">
                                                                {String(
                                                                  ib.type ||
                                                                    "richtext",
                                                                )}
                                                              </span>
                                                              <span
                                                                style={{
                                                                  fontWeight: 900,
                                                                }}
                                                              >
                                                                {ib.type ===
                                                                "richtext"
                                                                  ? "Text"
                                                                  : ib.type ===
                                                                      "grid"
                                                                    ? "Grid"
                                                                    : ib.type ===
                                                                        "gallery"
                                                                      ? "Gallery"
                                                                      : ib.type ===
                                                                          "button"
                                                                        ? "Button"
                                                                        : "Block"}
                                                              </span>
                                                            </div>

                                                            <div className="ap-blockActions">
                                                              <button
                                                                className="ap-btn"
                                                                type="button"
                                                                onClick={() =>
                                                                  moveColumnBlock(
                                                                    idx,
                                                                    b.id,
                                                                    c.id,
                                                                    ib.id,
                                                                    -1,
                                                                  )
                                                                }
                                                                disabled={
                                                                  ibi === 0
                                                                }
                                                                title="Move up"
                                                                style={{
                                                                  padding:
                                                                    "6px 10px",
                                                                }}
                                                              >
                                                                ↑
                                                              </button>
                                                              <button
                                                                className="ap-btn"
                                                                type="button"
                                                                onClick={() =>
                                                                  moveColumnBlock(
                                                                    idx,
                                                                    b.id,
                                                                    c.id,
                                                                    ib.id,
                                                                    1,
                                                                  )
                                                                }
                                                                disabled={
                                                                  ibi ===
                                                                  innerBlocks.length -
                                                                    1
                                                                }
                                                                title="Move down"
                                                                style={{
                                                                  padding:
                                                                    "6px 10px",
                                                                }}
                                                              >
                                                                ↓
                                                              </button>
                                                              <button
                                                                className="ap-btn ap-btnDanger"
                                                                type="button"
                                                                onClick={() =>
                                                                  openConfirm({
                                                                    title:
                                                                      "Delete element?",
                                                                    message:
                                                                      "This removes the element from this column.",
                                                                    confirmText:
                                                                      "Delete",
                                                                    danger: true,
                                                                    onConfirm:
                                                                      async () => {
                                                                        closeConfirm();
                                                                        deleteColumnBlock(
                                                                          idx,
                                                                          b.id,
                                                                          c.id,
                                                                          ib.id,
                                                                        );
                                                                      },
                                                                  })
                                                                }
                                                                style={{
                                                                  padding:
                                                                    "6px 10px",
                                                                }}
                                                              >
                                                                Delete
                                                              </button>
                                                            </div>
                                                          </div>

                                                          {String(
                                                            ib.type ||
                                                              "richtext",
                                                          ) === "richtext" ? (
                                                            <div className="ap-editorWrap">
                                                              <ModernPageEditor
                                                                value={String(
                                                                  ib.html || "",
                                                                )}
                                                                onChangeHtml={(
                                                                  html,
                                                                ) =>
                                                                  patchColumnBlock(
                                                                    idx,
                                                                    b.id,
                                                                    c.id,
                                                                    ib.id,
                                                                    { html },
                                                                  )
                                                                }
                                                                onChange={(
                                                                  html,
                                                                ) =>
                                                                  patchColumnBlock(
                                                                    idx,
                                                                    b.id,
                                                                    c.id,
                                                                    ib.id,
                                                                    { html },
                                                                  )
                                                                }
                                                                onUploadImage={async (
                                                                  file,
                                                                ) =>
                                                                  uploadImage(
                                                                    file,
                                                                    "inline",
                                                                  )
                                                                }
                                                              />
                                                            </div>
                                                          ) : null}

                                                          {String(
                                                            ib.type ||
                                                              "richtext",
                                                          ) === "button" ? (
                                                            <div className="ap-blockBody">
                                                              <div
                                                                style={{
                                                                  display:
                                                                    "grid",
                                                                  gridTemplateColumns:
                                                                    "1fr 1fr",
                                                                  gap: 10,
                                                                }}
                                                              >
                                                                <Field label="Text">
                                                                  <input
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.text ||
                                                                        "",
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          text: e
                                                                            .target
                                                                            .value,
                                                                        },
                                                                      )
                                                                    }
                                                                  />
                                                                </Field>
                                                                <Field label="Link">
                                                                  <input
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.href ||
                                                                        "",
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          href: e
                                                                            .target
                                                                            .value,
                                                                        },
                                                                      )
                                                                    }
                                                                    placeholder="/page or https://..."
                                                                  />
                                                                </Field>
                                                              </div>

                                                              <div
                                                                style={{
                                                                  display:
                                                                    "grid",
                                                                  gridTemplateColumns:
                                                                    "1fr 1fr 1fr",
                                                                  gap: 10,
                                                                  marginTop: 10,
                                                                }}
                                                              >
                                                                <Field label="Align">
                                                                  <select
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.align ||
                                                                        "left",
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          align:
                                                                            e
                                                                              .target
                                                                              .value,
                                                                        },
                                                                      )
                                                                    }
                                                                  >
                                                                    {[
                                                                      "left",
                                                                      "center",
                                                                      "right",
                                                                    ].map(
                                                                      (v) => (
                                                                        <option
                                                                          key={
                                                                            v
                                                                          }
                                                                          value={
                                                                            v
                                                                          }
                                                                        >
                                                                          {v}
                                                                        </option>
                                                                      ),
                                                                    )}
                                                                  </select>
                                                                </Field>
                                                                <Field label="Variant">
                                                                  <select
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.variant ||
                                                                        "solid",
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          variant:
                                                                            e
                                                                              .target
                                                                              .value,
                                                                        },
                                                                      )
                                                                    }
                                                                  >
                                                                    {[
                                                                      "solid",
                                                                      "outline",
                                                                      "ghost",
                                                                    ].map(
                                                                      (v) => (
                                                                        <option
                                                                          key={
                                                                            v
                                                                          }
                                                                          value={
                                                                            v
                                                                          }
                                                                        >
                                                                          {v}
                                                                        </option>
                                                                      ),
                                                                    )}
                                                                  </select>
                                                                </Field>
                                                                <Field label="Size">
                                                                  <select
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.size ||
                                                                        "md",
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          size: e
                                                                            .target
                                                                            .value,
                                                                        },
                                                                      )
                                                                    }
                                                                  >
                                                                    {[
                                                                      "sm",
                                                                      "md",
                                                                      "lg",
                                                                    ].map(
                                                                      (v) => (
                                                                        <option
                                                                          key={
                                                                            v
                                                                          }
                                                                          value={
                                                                            v
                                                                          }
                                                                        >
                                                                          {v}
                                                                        </option>
                                                                      ),
                                                                    )}
                                                                  </select>
                                                                </Field>
                                                              </div>

                                                              <details
                                                                style={{
                                                                  marginTop: 10,
                                                                }}
                                                              >
                                                                <summary
                                                                  style={{
                                                                    cursor:
                                                                      "pointer",
                                                                    fontWeight: 900,
                                                                  }}
                                                                >
                                                                  Styling
                                                                </summary>
                                                                <div
                                                                  style={{
                                                                    display:
                                                                      "grid",
                                                                    gridTemplateColumns:
                                                                      "1fr 1fr",
                                                                    gap: 10,
                                                                    marginTop: 10,
                                                                  }}
                                                                >
                                                                  <Field label="Padding">
                                                                    <input
                                                                      className="ap-input"
                                                                      value={String(
                                                                        ib
                                                                          .styles
                                                                          ?.padding ||
                                                                          "",
                                                                      )}
                                                                      onChange={(
                                                                        e,
                                                                      ) =>
                                                                        patchColumnBlock(
                                                                          idx,
                                                                          b.id,
                                                                          c.id,
                                                                          ib.id,
                                                                          {
                                                                            styles:
                                                                              {
                                                                                ...(ib.styles ||
                                                                                  {}),
                                                                                padding:
                                                                                  e
                                                                                    .target
                                                                                    .value,
                                                                              },
                                                                          },
                                                                        )
                                                                      }
                                                                    />
                                                                  </Field>
                                                                  <Field label="Radius">
                                                                    <input
                                                                      className="ap-input"
                                                                      type="number"
                                                                      value={String(
                                                                        ib
                                                                          .styles
                                                                          ?.radius ??
                                                                          14,
                                                                      )}
                                                                      onChange={(
                                                                        e,
                                                                      ) =>
                                                                        patchColumnBlock(
                                                                          idx,
                                                                          b.id,
                                                                          c.id,
                                                                          ib.id,
                                                                          {
                                                                            styles:
                                                                              {
                                                                                ...(ib.styles ||
                                                                                  {}),
                                                                                radius:
                                                                                  Number(
                                                                                    e
                                                                                      .target
                                                                                      .value,
                                                                                  ) ||
                                                                                  0,
                                                                              },
                                                                          },
                                                                        )
                                                                      }
                                                                    />
                                                                  </Field>
                                                                  <Field label="BG">
                                                                    <input
                                                                      className="ap-input"
                                                                      value={String(
                                                                        ib
                                                                          .styles
                                                                          ?.bg_color ||
                                                                          "",
                                                                      )}
                                                                      onChange={(
                                                                        e,
                                                                      ) =>
                                                                        patchColumnBlock(
                                                                          idx,
                                                                          b.id,
                                                                          c.id,
                                                                          ib.id,
                                                                          {
                                                                            styles:
                                                                              {
                                                                                ...(ib.styles ||
                                                                                  {}),
                                                                                bg_color:
                                                                                  e
                                                                                    .target
                                                                                    .value,
                                                                              },
                                                                          },
                                                                        )
                                                                      }
                                                                    />
                                                                  </Field>
                                                                  <Field label="Text">
                                                                    <input
                                                                      className="ap-input"
                                                                      value={String(
                                                                        ib
                                                                          .styles
                                                                          ?.text_color ||
                                                                          "",
                                                                      )}
                                                                      onChange={(
                                                                        e,
                                                                      ) =>
                                                                        patchColumnBlock(
                                                                          idx,
                                                                          b.id,
                                                                          c.id,
                                                                          ib.id,
                                                                          {
                                                                            styles:
                                                                              {
                                                                                ...(ib.styles ||
                                                                                  {}),
                                                                                text_color:
                                                                                  e
                                                                                    .target
                                                                                    .value,
                                                                              },
                                                                          },
                                                                        )
                                                                      }
                                                                    />
                                                                  </Field>
                                                                </div>
                                                              </details>
                                                            </div>
                                                          ) : null}

                                                          {String(
                                                            ib.type ||
                                                              "richtext",
                                                          ) === "grid" ? (
                                                            <div className="ap-blockBody">
                                                              <div
                                                                style={{
                                                                  display:
                                                                    "grid",
                                                                  gridTemplateColumns:
                                                                    "1fr 1fr",
                                                                  gap: 10,
                                                                  alignItems:
                                                                    "end",
                                                                }}
                                                              >
                                                                <Field label="Columns">
                                                                  <select
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.cols ||
                                                                        3,
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          cols: Math.max(
                                                                            1,
                                                                            Math.min(
                                                                              4,
                                                                              Number(
                                                                                e
                                                                                  .target
                                                                                  .value,
                                                                              ) ||
                                                                                3,
                                                                            ),
                                                                          ),
                                                                        },
                                                                      )
                                                                    }
                                                                  >
                                                                    {[
                                                                      1, 2, 3,
                                                                      4,
                                                                    ].map(
                                                                      (n) => (
                                                                        <option
                                                                          key={
                                                                            n
                                                                          }
                                                                          value={
                                                                            n
                                                                          }
                                                                        >
                                                                          {n}
                                                                        </option>
                                                                      ),
                                                                    )}
                                                                  </select>
                                                                </Field>
                                                                <Field label="Gap (px)">
                                                                  <input
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.gap ??
                                                                        12,
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          gap: Math.max(
                                                                            0,
                                                                            Number(
                                                                              e
                                                                                .target
                                                                                .value,
                                                                            ) ||
                                                                              0,
                                                                          ),
                                                                        },
                                                                      )
                                                                    }
                                                                  />
                                                                </Field>
                                                              </div>

                                                              <div
                                                                style={{
                                                                  display:
                                                                    "flex",
                                                                  gap: 10,
                                                                  flexWrap:
                                                                    "wrap",
                                                                  marginTop: 10,
                                                                }}
                                                              >
                                                                <button
                                                                  className="ap-btn ap-btnPrimary"
                                                                  type="button"
                                                                  onClick={() =>
                                                                    addColumnGridItem(
                                                                      idx,
                                                                      b.id,
                                                                      c.id,
                                                                      ib.id,
                                                                    )
                                                                  }
                                                                >
                                                                  + Add Card
                                                                </button>
                                                              </div>

                                                              <div
                                                                style={{
                                                                  marginTop: 10,
                                                                  display:
                                                                    "grid",
                                                                  gap: 10,
                                                                }}
                                                              >
                                                                {(Array.isArray(
                                                                  ib.items,
                                                                )
                                                                  ? ib.items
                                                                  : []
                                                                ).map(
                                                                  (it, ii) => (
                                                                    <div
                                                                      key={
                                                                        it.id
                                                                      }
                                                                      className="ap-card"
                                                                      style={{
                                                                        padding: 12,
                                                                      }}
                                                                    >
                                                                      <div
                                                                        style={{
                                                                          display:
                                                                            "flex",
                                                                          justifyContent:
                                                                            "space-between",
                                                                          gap: 10,
                                                                          alignItems:
                                                                            "center",
                                                                          flexWrap:
                                                                            "wrap",
                                                                        }}
                                                                      >
                                                                        <div
                                                                          style={{
                                                                            fontWeight: 900,
                                                                          }}
                                                                        >
                                                                          Item{" "}
                                                                          {ii +
                                                                            1}
                                                                        </div>
                                                                        <button
                                                                          className="ap-btn ap-btnDanger"
                                                                          type="button"
                                                                          onClick={() =>
                                                                            deleteColumnGridItem(
                                                                              idx,
                                                                              b.id,
                                                                              c.id,
                                                                              ib.id,
                                                                              it.id,
                                                                            )
                                                                          }
                                                                          style={{
                                                                            padding:
                                                                              "6px 10px",
                                                                          }}
                                                                        >
                                                                          Delete
                                                                        </button>
                                                                      </div>

                                                                      <Field label="Title">
                                                                        <input
                                                                          className="ap-input"
                                                                          value={String(
                                                                            it.title ||
                                                                              "",
                                                                          )}
                                                                          onChange={(
                                                                            e,
                                                                          ) =>
                                                                            patchColumnGridItem(
                                                                              idx,
                                                                              b.id,
                                                                              c.id,
                                                                              ib.id,
                                                                              it.id,
                                                                              {
                                                                                title:
                                                                                  e
                                                                                    .target
                                                                                    .value,
                                                                              },
                                                                            )
                                                                          }
                                                                        />
                                                                      </Field>

                                                                      <Field label="Text">
                                                                        <textarea
                                                                          className="ap-textarea"
                                                                          rows={
                                                                            3
                                                                          }
                                                                          value={String(
                                                                            it.text ||
                                                                              "",
                                                                          )}
                                                                          onChange={(
                                                                            e,
                                                                          ) =>
                                                                            patchColumnGridItem(
                                                                              idx,
                                                                              b.id,
                                                                              c.id,
                                                                              ib.id,
                                                                              it.id,
                                                                              {
                                                                                text: e
                                                                                  .target
                                                                                  .value,
                                                                              },
                                                                            )
                                                                          }
                                                                        />
                                                                      </Field>

                                                                      <Field label="Image (optional)">
                                                                        <div
                                                                          style={{
                                                                            display:
                                                                              "flex",
                                                                            gap: 10,
                                                                            alignItems:
                                                                              "center",
                                                                            flexWrap:
                                                                              "wrap",
                                                                          }}
                                                                        >
                                                                          <input
                                                                            className="ap-input"
                                                                            value={String(
                                                                              it.image_url ||
                                                                                "",
                                                                            )}
                                                                            onChange={(
                                                                              e,
                                                                            ) =>
                                                                              patchColumnGridItem(
                                                                                idx,
                                                                                b.id,
                                                                                c.id,
                                                                                ib.id,
                                                                                it.id,
                                                                                {
                                                                                  image_url:
                                                                                    e
                                                                                      .target
                                                                                      .value,
                                                                                },
                                                                              )
                                                                            }
                                                                            placeholder="https://..."
                                                                          />
                                                                          <label
                                                                            className="ap-btn"
                                                                            style={{
                                                                              cursor:
                                                                                "pointer",
                                                                            }}
                                                                          >
                                                                            Upload
                                                                            <input
                                                                              type="file"
                                                                              accept="image/*"
                                                                              style={{
                                                                                display:
                                                                                  "none",
                                                                              }}
                                                                              onChange={async (
                                                                                e,
                                                                              ) => {
                                                                                const file =
                                                                                  e
                                                                                    .target
                                                                                    .files?.[0];
                                                                                e.target.value =
                                                                                  "";
                                                                                await uploadColumnGridItemImage(
                                                                                  idx,
                                                                                  b.id,
                                                                                  c.id,
                                                                                  ib.id,
                                                                                  it.id,
                                                                                  file,
                                                                                );
                                                                              }}
                                                                            />
                                                                          </label>
                                                                          <button
                                                                            type="button"
                                                                            className="ap-btn"
                                                                            title="Choose from the Media Library"
                                                                            onClick={async () => {
                                                                              const libPick =
                                                                                await pickFromLibrary(
                                                                                  {
                                                                                    title:
                                                                                      "Choose a card image",
                                                                                  },
                                                                                );
                                                                              if (
                                                                                libPick
                                                                              )
                                                                                await uploadColumnGridItemImage(
                                                                                  idx,
                                                                                  b.id,
                                                                                  c.id,
                                                                                  ib.id,
                                                                                  it.id,
                                                                                  libPick,
                                                                                );
                                                                            }}
                                                                          >
                                                                            Library
                                                                          </button>
                                                                        </div>
                                                                      </Field>
                                                                    </div>
                                                                  ),
                                                                )}
                                                              </div>
                                                            </div>
                                                          ) : null}

                                                          {String(
                                                            ib.type ||
                                                              "richtext",
                                                          ) === "gallery" ? (
                                                            <div className="ap-blockBody">
                                                              <div
                                                                style={{
                                                                  display:
                                                                    "grid",
                                                                  gridTemplateColumns:
                                                                    "1fr 1fr",
                                                                  gap: 10,
                                                                  alignItems:
                                                                    "end",
                                                                }}
                                                              >
                                                                <Field label="Columns">
                                                                  <select
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.cols ||
                                                                        4,
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          cols: Math.max(
                                                                            2,
                                                                            Math.min(
                                                                              8,
                                                                              Number(
                                                                                e
                                                                                  .target
                                                                                  .value,
                                                                              ) ||
                                                                                4,
                                                                            ),
                                                                          ),
                                                                        },
                                                                      )
                                                                    }
                                                                  >
                                                                    {[
                                                                      2, 3, 4,
                                                                      5, 6, 7,
                                                                      8,
                                                                    ].map(
                                                                      (n) => (
                                                                        <option
                                                                          key={
                                                                            n
                                                                          }
                                                                          value={
                                                                            n
                                                                          }
                                                                        >
                                                                          {n}
                                                                        </option>
                                                                      ),
                                                                    )}
                                                                  </select>
                                                                </Field>

                                                                <Field label="Gap (px)">
                                                                  <input
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.gap ??
                                                                        10,
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          gap: Math.max(
                                                                            0,
                                                                            Number(
                                                                              e
                                                                                .target
                                                                                .value,
                                                                            ) ||
                                                                              0,
                                                                          ),
                                                                        },
                                                                      )
                                                                    }
                                                                  />
                                                                </Field>
                                                              </div>

                                                              <div
                                                                style={{
                                                                  display:
                                                                    "flex",
                                                                  gap: 10,
                                                                  flexWrap:
                                                                    "wrap",
                                                                  marginBottom: 10,
                                                                  marginTop: 10,
                                                                }}
                                                              >
                                                                <label
                                                                  className="ap-btn ap-btnPrimary"
                                                                  style={{
                                                                    cursor:
                                                                      "pointer",
                                                                  }}
                                                                >
                                                                  + Upload
                                                                  Images
                                                                  <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    multiple
                                                                    style={{
                                                                      display:
                                                                        "none",
                                                                    }}
                                                                    onChange={async (
                                                                      e,
                                                                    ) => {
                                                                      const picked =
                                                                        Array.from(
                                                                          e
                                                                            .target
                                                                            .files ||
                                                                            [],
                                                                        );
                                                                      e.target.value =
                                                                        "";
                                                                      await addColumnGalleryImages(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        picked,
                                                                      );
                                                                    }}
                                                                  />
                                                                </label>
                                                                <button
                                                                  type="button"
                                                                  className="ap-btn"
                                                                  title="Choose from the Media Library"
                                                                  onClick={async () => {
                                                                    const libPick =
                                                                      await pickFromLibrary(
                                                                        {
                                                                          multiple: true,
                                                                          title:
                                                                            "Add images to gallery",
                                                                        },
                                                                      );
                                                                    if (libPick)
                                                                      await addColumnGalleryImages(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        libPick,
                                                                      );
                                                                  }}
                                                                >
                                                                  + From library
                                                                </button>
                                                              </div>

                                                              <div
                                                                className="ap-galleryGrid"
                                                                style={{
                                                                  display:
                                                                    "grid",
                                                                  gridTemplateColumns: `repeat(${Math.max(2, Math.min(8, Number(ib.cols) || 4))}, 1fr)`,
                                                                  gap: Math.max(
                                                                    0,
                                                                    Number(
                                                                      ib.gap,
                                                                    ) || 0,
                                                                  ),
                                                                }}
                                                              >
                                                                {(Array.isArray(
                                                                  ib.images,
                                                                )
                                                                  ? ib.images
                                                                  : []
                                                                ).map(
                                                                  (im, imi) => (
                                                                    <div
                                                                      key={
                                                                        im.id
                                                                      }
                                                                      className="ap-galleryItem"
                                                                    >
                                                                      <img
                                                                        alt={
                                                                          im.alt ||
                                                                          ""
                                                                        }
                                                                        src={
                                                                          absUrl(
                                                                            im.src,
                                                                          ) ||
                                                                          im.src
                                                                        }
                                                                      />
                                                                      <div className="ap-galleryMeta">
                                                                        <div
                                                                          style={{
                                                                            display:
                                                                              "flex",
                                                                            gap: 8,
                                                                            marginBottom: 8,
                                                                            flexWrap:
                                                                              "wrap",
                                                                          }}
                                                                        >
                                                                          <button
                                                                            className="ap-btn"
                                                                            type="button"
                                                                            onClick={() =>
                                                                              moveColumnGalleryImage(
                                                                                idx,
                                                                                b.id,
                                                                                c.id,
                                                                                ib.id,
                                                                                im.id,
                                                                                -1,
                                                                              )
                                                                            }
                                                                            disabled={
                                                                              imi ===
                                                                              0
                                                                            }
                                                                            title="Move left"
                                                                            style={{
                                                                              padding:
                                                                                "6px 10px",
                                                                            }}
                                                                          >
                                                                            ←
                                                                          </button>
                                                                          <button
                                                                            className="ap-btn"
                                                                            type="button"
                                                                            onClick={() =>
                                                                              moveColumnGalleryImage(
                                                                                idx,
                                                                                b.id,
                                                                                c.id,
                                                                                ib.id,
                                                                                im.id,
                                                                                1,
                                                                              )
                                                                            }
                                                                            disabled={
                                                                              imi ===
                                                                              (Array.isArray(
                                                                                ib.images,
                                                                              )
                                                                                ? ib
                                                                                    .images
                                                                                    .length -
                                                                                  1
                                                                                : 0)
                                                                            }
                                                                            title="Move right"
                                                                            style={{
                                                                              padding:
                                                                                "6px 10px",
                                                                            }}
                                                                          >
                                                                            →
                                                                          </button>
                                                                          <input
                                                                            className="ap-input"
                                                                            type="number"
                                                                            placeholder="W"
                                                                            style={{
                                                                              width: 90,
                                                                            }}
                                                                            defaultValue={
                                                                              im.w ??
                                                                              ""
                                                                            }
                                                                            onBlur={(
                                                                              e,
                                                                            ) => {
                                                                              const v =
                                                                                e
                                                                                  .target
                                                                                  .value ===
                                                                                ""
                                                                                  ? ""
                                                                                  : Math.max(
                                                                                      0,
                                                                                      Number(
                                                                                        e
                                                                                          .target
                                                                                          .value,
                                                                                      ) ||
                                                                                        0,
                                                                                    );
                                                                              patchColumnGalleryImage(
                                                                                idx,
                                                                                b.id,
                                                                                c.id,
                                                                                ib.id,
                                                                                im.id,
                                                                                {
                                                                                  w:
                                                                                    v ===
                                                                                    ""
                                                                                      ? null
                                                                                      : v,
                                                                                },
                                                                              );
                                                                            }}
                                                                          />
                                                                          <input
                                                                            className="ap-input"
                                                                            type="number"
                                                                            placeholder="H"
                                                                            style={{
                                                                              width: 90,
                                                                            }}
                                                                            defaultValue={
                                                                              im.h ??
                                                                              ""
                                                                            }
                                                                            onBlur={(
                                                                              e,
                                                                            ) => {
                                                                              const v =
                                                                                e
                                                                                  .target
                                                                                  .value ===
                                                                                ""
                                                                                  ? ""
                                                                                  : Math.max(
                                                                                      0,
                                                                                      Number(
                                                                                        e
                                                                                          .target
                                                                                          .value,
                                                                                      ) ||
                                                                                        0,
                                                                                    );
                                                                              patchColumnGalleryImage(
                                                                                idx,
                                                                                b.id,
                                                                                c.id,
                                                                                ib.id,
                                                                                im.id,
                                                                                {
                                                                                  h:
                                                                                    v ===
                                                                                    ""
                                                                                      ? null
                                                                                      : v,
                                                                                },
                                                                              );
                                                                            }}
                                                                          />
                                                                        </div>

                                                                        <input
                                                                          className="ap-input"
                                                                          value={String(
                                                                            im.alt ||
                                                                              "",
                                                                          )}
                                                                          onChange={(
                                                                            e,
                                                                          ) =>
                                                                            patchColumnGalleryImage(
                                                                              idx,
                                                                              b.id,
                                                                              c.id,
                                                                              ib.id,
                                                                              im.id,
                                                                              {
                                                                                alt: e
                                                                                  .target
                                                                                  .value,
                                                                              },
                                                                            )
                                                                          }
                                                                          placeholder="Alt text (optional)"
                                                                        />
                                                                        <button
                                                                          className="ap-btn ap-btnDanger"
                                                                          type="button"
                                                                          style={{
                                                                            padding:
                                                                              "6px 10px",
                                                                          }}
                                                                          onClick={() =>
                                                                            deleteColumnGalleryImage(
                                                                              idx,
                                                                              b.id,
                                                                              c.id,
                                                                              ib.id,
                                                                              im.id,
                                                                            )
                                                                          }
                                                                        >
                                                                          ✕
                                                                        </button>
                                                                      </div>
                                                                    </div>
                                                                  ),
                                                                )}
                                                              </div>
                                                            </div>
                                                          ) : null}
                                                        </div>
                                                      ),
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") ===
                                "home_hero" ? (
                                  <div className="ap-blockBody">
                                    <Field label="Kicker">
                                      <input
                                        className="ap-input"
                                        value={String(b.kicker || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            kicker: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label="Headline (H1)">
                                      <input
                                        className="ap-input"
                                        value={String(b.title || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            title: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                    {/* Phase 1: customer-friendly hero typography controls. */}
                                    <div
                                      style={{
                                        border:
                                          "1px solid rgba(160,150,180,.25)",
                                        borderRadius: 10,
                                        padding: 12,
                                        margin: "12px 0",
                                      }}
                                    >
                                      <strong
                                        style={{
                                          display: "block",
                                          marginBottom: 10,
                                        }}
                                      >
                                        Typography
                                      </strong>
                                      <div
                                        style={{
                                          display: "grid",
                                          gridTemplateColumns:
                                            "repeat(auto-fit, minmax(190px, 1fr))",
                                          gap: 10,
                                        }}
                                      >
                                        <Field label="Heading font">
                                          <select
                                            className="ap-input"
                                            value={String(
                                              b.heading_font || "inherit",
                                            )}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                heading_font: e.target.value,
                                              })
                                            }
                                          >
                                            <option value="inherit">
                                              Website default
                                            </option>
                                            <option value="Poppins">
                                              Poppins
                                            </option>
                                            <option value="Montserrat">
                                              Montserrat
                                            </option>
                                            <option value="Arial">Arial</option>
                                            <option value="Georgia">
                                              Georgia
                                            </option>
                                          </select>
                                        </Field>
                                        <Field label="Heading size (px)">
                                          <input
                                            className="ap-input"
                                            type="number"
                                            min="24"
                                            max="96"
                                            step="1"
                                            placeholder="Website default"
                                            value={b.heading_size ?? ""}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                heading_size: e.target.value,
                                              })
                                            }
                                          />
                                        </Field>
                                        <Field label="Heading weight">
                                          <select
                                            className="ap-input"
                                            value={String(
                                              b.heading_weight || "default",
                                            )}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                heading_weight: e.target.value,
                                              })
                                            }
                                          >
                                            <option value="default">
                                              Website default
                                            </option>
                                            <option value="400">Regular</option>
                                            <option value="500">Medium</option>
                                            <option value="600">
                                              Semi-bold
                                            </option>
                                            <option value="700">Bold</option>
                                            <option value="800">
                                              Extra bold
                                            </option>
                                          </select>
                                        </Field>
                                        <Field label="Heading alignment">
                                          <select
                                            className="ap-input"
                                            value={String(
                                              b.heading_align || "default",
                                            )}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                heading_align: e.target.value,
                                              })
                                            }
                                          >
                                            <option value="default">
                                              Website default
                                            </option>
                                            <option value="left">Left</option>
                                            <option value="center">
                                              Center
                                            </option>
                                            <option value="right">Right</option>
                                          </select>
                                        </Field>
                                        <Field label="Heading color">
                                          <input
                                            className="ap-input"
                                            type="text"
                                            placeholder="Website default or #ffffff"
                                            value={String(
                                              b.heading_color || "",
                                            )}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                heading_color: e.target.value,
                                              })
                                            }
                                          />
                                        </Field>
                                      </div>
                                      <div
                                        className="ap-help"
                                        style={{ marginTop: 8 }}
                                      >
                                        Leave a value at Website default to
                                        preserve the original design. Save Draft
                                        and Preview before publishing.
                                      </div>
                                    </div>
                                    <Field label="Subtext">
                                      <textarea
                                        className="ap-textarea"
                                        rows={3}
                                        value={String(b.sub || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            sub: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>

                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 10,
                                      }}
                                    >
                                      <Field label="CTA Text">
                                        <input
                                          className="ap-input"
                                          value={String(b.cta_text || "")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              cta_text: e.target.value,
                                            })
                                          }
                                        />
                                      </Field>
                                      <Field label="CTA Link">
                                        <input
                                          className="ap-input"
                                          value={String(b.cta_href || "")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              cta_href: e.target.value,
                                            })
                                          }
                                        />
                                      </Field>
                                    </div>

                                    <Field
                                      label="Hero Background"
                                      help="Paste an image URL or upload a file."
                                    >
                                      <input
                                        className="ap-input"
                                        value={String(b.background_url || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            background_url: e.target.value,
                                          })
                                        }
                                      />
                                      <div style={{ marginTop: 8 }}>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={async (e) => {
                                            const f = e.target.files?.[0];
                                            if (!f) return;
                                            try {
                                              const url = await uploadImage(
                                                f,
                                                "hero",
                                              );
                                              patchBlock(idx, b.id, {
                                                background_url: url,
                                              });
                                            } catch (_) {}
                                            e.target.value = "";
                                          }}
                                        />
                                        <button
                                          type="button"
                                          className="ap-btn"
                                          style={{ marginLeft: 8 }}
                                          title="Choose from the Media Library"
                                          onClick={async () => {
                                            const libPick =
                                              await pickFromLibrary({
                                                title:
                                                  "Choose a hero background",
                                              });
                                            if (libPick)
                                              patchBlock(idx, b.id, {
                                                background_url: libPick.url,
                                              });
                                          }}
                                        >
                                          Choose from library
                                        </button>
                                      </div>
                                    </Field>
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") ===
                                "home_join" ? (
                                  <div className="ap-blockBody">
                                    <Field label="Eyebrow">
                                      <input
                                        className="ap-input"
                                        value={String(b.eyebrow || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            eyebrow: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label="Title">
                                      <input
                                        className="ap-input"
                                        value={String(b.title || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            title: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label="Subtext">
                                      <textarea
                                        className="ap-textarea"
                                        rows={3}
                                        value={String(b.sub || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            sub: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>

                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 10,
                                      }}
                                    >
                                      <Field label="CTA Text">
                                        <input
                                          className="ap-input"
                                          value={String(b.cta_text || "")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              cta_text: e.target.value,
                                            })
                                          }
                                        />
                                      </Field>
                                      <Field label="CTA Link">
                                        <input
                                          className="ap-input"
                                          value={String(b.cta_href || "")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              cta_href: e.target.value,
                                            })
                                          }
                                        />
                                      </Field>
                                    </div>
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") === "home_cta" ? (
                                  <div className="ap-blockBody">
                                    <Field label="Title">
                                      <input
                                        className="ap-input"
                                        value={String(b.title || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            title: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label="Subtext">
                                      <textarea
                                        className="ap-textarea"
                                        rows={3}
                                        value={String(b.sub || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            sub: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>

                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 10,
                                      }}
                                    >
                                      <Field label="CTA Text">
                                        <input
                                          className="ap-input"
                                          value={String(b.cta_text || "")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              cta_text: e.target.value,
                                            })
                                          }
                                        />
                                      </Field>
                                      <Field label="CTA Link">
                                        <input
                                          className="ap-input"
                                          value={String(b.cta_href || "")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              cta_href: e.target.value,
                                            })
                                          }
                                        />
                                      </Field>
                                    </div>
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") ===
                                "home_about" ? (
                                  <div className="ap-blockBody">
                                    <Field label="Name">
                                      <input
                                        className="ap-input"
                                        value={String(b.name || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            name: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label="Bio Text">
                                      <textarea
                                        className="ap-textarea"
                                        rows={4}
                                        value={String(b.text || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            text: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label="Avatar URL (optional)">
                                      <input
                                        className="ap-input"
                                        value={String(b.avatar_url || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            avatar_url: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") ===
                                "latest_teaching" ? (
                                  <div className="ap-blockBody">
                                    <div
                                      className="ap-help"
                                      style={{ marginBottom: 10 }}
                                    >
                                      This renders the “Latest Teaching” section
                                      on Home.
                                    </div>
                                    <label
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={b.show !== false}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            show: e.target.checked,
                                          })
                                        }
                                      />
                                      <span>Show this section</span>
                                    </label>
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") ===
                                "featured_live" ? (
                                  <div className="ap-blockBody">
                                    <div
                                      className="ap-help"
                                      style={{ marginBottom: 10 }}
                                    >
                                      This renders the Live Stream highlight +
                                      countdown area on Home.
                                    </div>
                                    <label
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={b.show !== false}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            show: e.target.checked,
                                          })
                                        }
                                      />
                                      <span>Show this section</span>
                                    </label>
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") === "grid" ? (
                                  <div className="ap-blockBody">
                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 10,
                                        alignItems: "end",
                                      }}
                                    >
                                      <Field label="Columns">
                                        <select
                                          className="ap-input"
                                          value={String(b.cols || 3)}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              cols: Math.max(
                                                2,
                                                Math.min(
                                                  6,
                                                  Number(e.target.value) || 3,
                                                ),
                                              ),
                                            })
                                          }
                                        >
                                          {[2, 3, 4, 5, 6].map((n) => (
                                            <option key={n} value={n}>
                                              {n}
                                            </option>
                                          ))}
                                        </select>
                                      </Field>

                                      <Field label="Gap (px)">
                                        <input
                                          className="ap-input"
                                          value={String(b.gap ?? 12)}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              gap: Math.max(
                                                0,
                                                Number(e.target.value) || 0,
                                              ),
                                            })
                                          }
                                        />
                                      </Field>
                                    </div>

                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 10,
                                        flexWrap: "wrap",
                                        marginBottom: 10,
                                      }}
                                    >
                                      <button
                                        className="ap-btn"
                                        type="button"
                                        onClick={() => addGridItem(idx, b.id)}
                                      >
                                        + Add Card
                                      </button>
                                    </div>

                                    <div className="ap-gridCards">
                                      {(Array.isArray(b.items)
                                        ? b.items
                                        : []
                                      ).map((it) => (
                                        <div
                                          key={it.id}
                                          className="ap-gridCard"
                                        >
                                          <div className="ap-gridCardTop">
                                            <div style={{ fontWeight: 900 }}>
                                              Card
                                            </div>
                                            <button
                                              className="ap-btn ap-btnDanger"
                                              type="button"
                                              style={{ padding: "6px 10px" }}
                                              onClick={() =>
                                                deleteGridItem(idx, b.id, it.id)
                                              }
                                            >
                                              Delete
                                            </button>
                                          </div>

                                          <Field label="Title">
                                            <input
                                              className="ap-input"
                                              value={String(it.title || "")}
                                              onChange={(e) =>
                                                patchGridItem(
                                                  idx,
                                                  b.id,
                                                  it.id,
                                                  { title: e.target.value },
                                                )
                                              }
                                            />
                                          </Field>

                                          <Field label="Text">
                                            <textarea
                                              className="ap-textarea"
                                              rows={3}
                                              value={String(it.text || "")}
                                              onChange={(e) =>
                                                patchGridItem(
                                                  idx,
                                                  b.id,
                                                  it.id,
                                                  { text: e.target.value },
                                                )
                                              }
                                            />
                                          </Field>

                                          <Field label="Image (optional)">
                                            <div
                                              style={{
                                                display: "flex",
                                                gap: 10,
                                                alignItems: "center",
                                                flexWrap: "wrap",
                                              }}
                                            >
                                              <input
                                                className="ap-input"
                                                value={String(
                                                  it.image_url || "",
                                                )}
                                                onChange={(e) =>
                                                  patchGridItem(
                                                    idx,
                                                    b.id,
                                                    it.id,
                                                    {
                                                      image_url: e.target.value,
                                                    },
                                                  )
                                                }
                                                placeholder="https://..."
                                              />
                                              <label
                                                className="ap-btn"
                                                style={{ cursor: "pointer" }}
                                              >
                                                Upload
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  style={{ display: "none" }}
                                                  onChange={async (e) => {
                                                    const file =
                                                      e.target.files?.[0];
                                                    e.target.value = "";
                                                    await uploadGridItemImage(
                                                      idx,
                                                      b.id,
                                                      it.id,
                                                      file,
                                                    );
                                                  }}
                                                />
                                              </label>
                                              <button
                                                type="button"
                                                className="ap-btn"
                                                title="Choose from the Media Library"
                                                onClick={async () => {
                                                  const libPick =
                                                    await pickFromLibrary({
                                                      title:
                                                        "Choose a card image",
                                                    });
                                                  if (libPick)
                                                    await uploadGridItemImage(
                                                      idx,
                                                      b.id,
                                                      it.id,
                                                      libPick,
                                                    );
                                                }}
                                              >
                                                Library
                                              </button>
                                            </div>

                                            {String(
                                              it.image_url || "",
                                            ).trim() ? (
                                              <div className="ap-imgMini">
                                                <img
                                                  alt=""
                                                  src={
                                                    absUrl(it.image_url) ||
                                                    it.image_url
                                                  }
                                                />
                                              </div>
                                            ) : null}
                                          </Field>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") === "gallery" ? (
                                  <div className="ap-blockBody">
                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 10,
                                        alignItems: "end",
                                      }}
                                    >
                                      <Field label="Columns">
                                        <select
                                          className="ap-input"
                                          value={String(b.cols || 4)}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              cols: Math.max(
                                                2,
                                                Math.min(
                                                  8,
                                                  Number(e.target.value) || 4,
                                                ),
                                              ),
                                            })
                                          }
                                        >
                                          {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                                            <option key={n} value={n}>
                                              {n}
                                            </option>
                                          ))}
                                        </select>
                                      </Field>

                                      <Field label="Gap (px)">
                                        <input
                                          className="ap-input"
                                          value={String(b.gap ?? 10)}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              gap: Math.max(
                                                0,
                                                Number(e.target.value) || 0,
                                              ),
                                            })
                                          }
                                        />
                                      </Field>
                                    </div>

                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 10,
                                        flexWrap: "wrap",
                                        marginBottom: 10,
                                      }}
                                    >
                                      <label
                                        className="ap-btn ap-btnPrimary"
                                        style={{ cursor: "pointer" }}
                                      >
                                        + Upload Images
                                        <input
                                          type="file"
                                          accept="image/*"
                                          multiple
                                          style={{ display: "none" }}
                                          onChange={async (e) => {
                                            const picked = Array.from(
                                              e.target.files || [],
                                            );
                                            e.target.value = "";
                                            await addGalleryImages(
                                              idx,
                                              b.id,
                                              picked,
                                            );
                                          }}
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        className="ap-btn"
                                        title="Choose from the Media Library"
                                        onClick={async () => {
                                          const libPick = await pickFromLibrary(
                                            {
                                              multiple: true,
                                              title: "Add images to gallery",
                                            },
                                          );
                                          if (libPick)
                                            await addGalleryImages(
                                              idx,
                                              b.id,
                                              libPick,
                                            );
                                        }}
                                      >
                                        + From library
                                      </button>
                                    </div>

                                    <div
                                      className="ap-galleryGrid"
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: `repeat(${Math.max(
                                          2,
                                          Math.min(8, Number(b.cols) || 4),
                                        )}, 1fr)`,
                                        gap: Math.max(0, Number(b.gap) || 0),
                                      }}
                                    >
                                      {(Array.isArray(b.images)
                                        ? b.images
                                        : []
                                      ).map((im, imi) => (
                                        <div
                                          key={im.id}
                                          className="ap-galleryItem"
                                        >
                                          <img
                                            alt={im.alt || ""}
                                            src={absUrl(im.src) || im.src}
                                          />
                                          <div className="ap-galleryMeta">
                                            <div
                                              style={{
                                                display: "flex",
                                                gap: 8,
                                                marginBottom: 8,
                                              }}
                                            >
                                              <button
                                                className="ap-btn"
                                                type="button"
                                                onClick={() =>
                                                  moveGalleryImage(
                                                    idx,
                                                    b.id,
                                                    im.id,
                                                    -1,
                                                  )
                                                }
                                                disabled={imi === 0}
                                                title="Move left"
                                                style={{ padding: "6px 10px" }}
                                              >
                                                ←
                                              </button>
                                              <button
                                                className="ap-btn"
                                                type="button"
                                                onClick={() =>
                                                  moveGalleryImage(
                                                    idx,
                                                    b.id,
                                                    im.id,
                                                    1,
                                                  )
                                                }
                                                disabled={
                                                  imi ===
                                                  (Array.isArray(b.images)
                                                    ? b.images.length - 1
                                                    : 0)
                                                }
                                                title="Move right"
                                                style={{ padding: "6px 10px" }}
                                              >
                                                →
                                              </button>
                                              <input
                                                className="ap-input"
                                                type="number"
                                                placeholder="W"
                                                style={{ width: 90 }}
                                                defaultValue={im.w ?? ""}
                                                onBlur={(e) => {
                                                  const v =
                                                    e.target.value === ""
                                                      ? ""
                                                      : Math.max(
                                                          0,
                                                          Number(
                                                            e.target.value,
                                                          ) || 0,
                                                        );
                                                  patchGalleryImage(
                                                    idx,
                                                    b.id,
                                                    im.id,
                                                    { w: v === "" ? null : v },
                                                  );
                                                }}
                                              />
                                              <input
                                                className="ap-input"
                                                type="number"
                                                placeholder="H"
                                                style={{ width: 90 }}
                                                defaultValue={im.h ?? ""}
                                                onBlur={(e) => {
                                                  const v =
                                                    e.target.value === ""
                                                      ? ""
                                                      : Math.max(
                                                          0,
                                                          Number(
                                                            e.target.value,
                                                          ) || 0,
                                                        );
                                                  patchGalleryImage(
                                                    idx,
                                                    b.id,
                                                    im.id,
                                                    { h: v === "" ? null : v },
                                                  );
                                                }}
                                              />
                                            </div>

                                            <input
                                              className="ap-input"
                                              value={String(im.alt || "")}
                                              onChange={(e) =>
                                                patchGalleryImage(
                                                  idx,
                                                  b.id,
                                                  im.id,
                                                  { alt: e.target.value },
                                                )
                                              }
                                              placeholder="Alt text (optional)"
                                            />
                                            <button
                                              className="ap-btn ap-btnDanger"
                                              type="button"
                                              style={{ padding: "6px 10px" }}
                                              onClick={() =>
                                                deleteGalleryImage(
                                                  idx,
                                                  b.id,
                                                  im.id,
                                                )
                                              }
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ✅ FIXED: legacy editor JSX (this is the error you posted) */}
                      {!hasBlocks ? (
                        String(sec.layout || "card") === "two_columns" ? (
                          <>
                            <Field label="Left Column">
                              <div className="ap-editorWrap">
                                <ModernPageEditor
                                  value={sec.left_html || sec.html || ""}
                                  onChangeHtml={(html) =>
                                    updateExtraSection(idx, { left_html: html })
                                  }
                                  onChange={(html) =>
                                    updateExtraSection(idx, { left_html: html })
                                  }
                                  onUploadImage={async (file) =>
                                    uploadImage(file, "inline")
                                  }
                                />
                              </div>
                            </Field>

                            <Field label="Right Column">
                              <div className="ap-editorWrap">
                                <ModernPageEditor
                                  value={sec.right_html || ""}
                                  onChangeHtml={(html) =>
                                    updateExtraSection(idx, {
                                      right_html: html,
                                    })
                                  }
                                  onChange={(html) =>
                                    updateExtraSection(idx, {
                                      right_html: html,
                                    })
                                  }
                                  onUploadImage={async (file) =>
                                    uploadImage(file, "inline")
                                  }
                                />
                              </div>
                            </Field>
                          </>
                        ) : (
                          <Field label="Section Content">
                            <div className="ap-editorWrap">
                              <ModernPageEditor
                                value={sec.html || ""}
                                onChangeHtml={(html) =>
                                  updateExtraSection(idx, { html })
                                }
                                onChange={(html) =>
                                  updateExtraSection(idx, { html })
                                }
                                onUploadImage={async (file) =>
                                  uploadImage(file, "inline")
                                }
                              />
                            </div>
                          </Field>
                        )
                      ) : null}

                      {!hasBlocks ? (
                        <div
                          style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                        >
                          <label
                            className="ap-btn"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              cursor: "pointer",
                            }}
                            title="Upload an image and auto-insert into this section"
                          >
                            + Insert Image
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                await insertImageIntoSection(idx, file);
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="ap-btn"
                            title="Choose from the Media Library"
                            onClick={async () => {
                              const libPick = await pickFromLibrary({
                                title: "Insert an image",
                              });
                              if (libPick)
                                await insertImageIntoSection(idx, libPick);
                            }}
                          >
                            + From library
                          </button>

                          <button
                            className="ap-btn"
                            type="button"
                            onClick={() => {
                              const isTwo =
                                String(sec.layout || "card") === "two_columns";
                              updateExtraSection(
                                idx,
                                isTwo
                                  ? { html: "", left_html: "", right_html: "" }
                                  : { html: "" },
                              );
                            }}
                          >
                            Clear Content
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              );
            })
          )}
        </SectionCard>
      </div>
    );
  }

  function renderGenericBuilder() {
    const extra = Array.isArray(contentJson?.extra_sections)
      ? contentJson.extra_sections.map(ensureSectionShape)
      : [];

    return (
      <div>
        <div className="ap-help" style={{ marginBottom: 12 }}>
          This page is builder-driven. Add sections/blocks below and reorder
          them to control what appears on the public page.
        </div>

        <SectionCard
          title="Page Builder Sections"
          right={
            <>
              <button
                className="ap-btn ap-btnPrimary"
                type="button"
                onClick={addExtraSection}
              >
                + Add Section
              </button>
              <button
                type="button"
                className="ap-btn"
                onClick={() => setPatternLibraryOpen((open) => !open)}
              >
                {patternLibraryOpen ? "Close Templates" : "Browse Templates"}
              </button>
            </>
          }
        >
          <div className="ap-help" style={{ marginBottom: 10 }}>
            Add sections to build your page. Each section can hold text, images,
            cards, buttons and columns.
          </div>

          {renderSectionPatternLibrary()}

          {!extra.length ? (
            <div
              className="ap-card"
              style={{
                padding: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px dashed rgba(255,255,255,0.14)",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 6 }}>
                No sections yet
              </div>
              <div className="ap-help">Click “Add Section” to create one.</div>
            </div>
          ) : (
            extra.map((sec, idx) => {
              const collapsed = !!sec.collapsed;
              const blocks = Array.isArray(sec.blocks) ? sec.blocks : [];
              const hasBlocks = blocks.length > 0;

              return (
                <div
                  key={sec.id}
                  draggable
                  onDragEnd={(e) => {
                    e.currentTarget.classList.remove("ap-phase4gbDragging");
                    document
                      .querySelectorAll(".ap-phase4gbDropTarget")
                      .forEach((node) =>
                        node.classList.remove("ap-phase4gbDropTarget"),
                      );
                  }}
                  onDragStart={(e) => {
                    dragSectionRef.current = { idx };
                    e.currentTarget.classList.add("ap-phase4gbDragging");
                    try {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(idx));
                    } catch (_e) {}
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add("ap-phase4gbDropTarget");
                    try {
                      e.dataTransfer.dropEffect = "move";
                    } catch (_e) {}
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("ap-phase4gbDropTarget");
                    const from = Number(dragSectionRef.current?.idx);
                    const to = idx;
                    if (!Number.isNaN(from) && from >= 0 && from !== to) {
                      reorderExtraSections(from, to);
                    }
                    dragSectionRef.current = { idx: -1 };
                  }}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 14,
                    padding: 12,
                    background: "rgba(0,0,0,0.18)",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <button
                        className="ap-btn"
                        type="button"
                        onClick={() =>
                          updateExtraSection(idx, { collapsed: !collapsed })
                        }
                        title={collapsed ? "Expand" : "Collapse"}
                        style={{ padding: "6px 10px" }}
                      >
                        {collapsed ? "▸" : "▾"}
                      </button>
                      <div style={{ fontWeight: 900 }}>
                        {sec.title || `Section ${idx + 1}`}
                      </div>
                    </div>

                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <button
                        className="ap-btn"
                        type="button"
                        onClick={() => moveExtraSection(idx, -1)}
                        disabled={idx === 0}
                        title="Move up"
                        style={{ padding: "6px 10px" }}
                      >
                        ↑
                      </button>
                      <button
                        className="ap-btn"
                        type="button"
                        onClick={() => moveExtraSection(idx, 1)}
                        disabled={idx === extra.length - 1}
                        title="Move down"
                        style={{ padding: "6px 10px" }}
                      >
                        ↓
                      </button>
                      <button
                        className="ap-btn"
                        type="button"
                        onClick={() => duplicateExtraSection(idx)}
                        title="Duplicate section and its blocks"
                      >
                        Duplicate
                      </button>
                      <button
                        className="ap-btn"
                        type="button"
                        onClick={() => openSaveSectionDialog(sec)}
                        title="Save a copy of this section so you can insert it on other pages"
                      >
                        Save to library
                      </button>
                      <button
                        className="ap-btn ap-btnDanger"
                        type="button"
                        onClick={() =>
                          openConfirm({
                            title: "Delete section?",
                            message:
                              "This removes the section from the page builder.",
                            confirmText: "Delete",
                            danger: true,
                            onConfirm: async () => {
                              closeConfirm();
                              deleteExtraSection(idx);
                            },
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {!collapsed ? (
                    <>
                      <Field label="Section Title">
                        <input
                          className="ap-input"
                          value={sec.title || ""}
                          onChange={(e) =>
                            updateExtraSection(idx, { title: e.target.value })
                          }
                        />
                      </Field>
                      <details className="ap-sectionSettings">
                        <summary>
                          Section settings: layout, theme and style
                        </summary>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 10,
                          }}
                        >
                          <Field label="Layout">
                            <select
                              className="ap-input"
                              value={sec.layout || "card"}
                              onChange={(e) => {
                                const nextLayout = e.target.value;
                                const prevLayout = String(sec.layout || "card");
                                const wasTwo = prevLayout === "two_columns";
                                const goingTwo = nextLayout === "two_columns";

                                if (
                                  goingTwo &&
                                  !sec.left_html &&
                                  !sec.right_html
                                ) {
                                  updateExtraSection(idx, {
                                    layout: nextLayout,
                                    left_html: sec.html || "",
                                    right_html: "",
                                  });
                                  return;
                                }

                                if (wasTwo && !goingTwo) {
                                  const legacyEmpty = !String(
                                    sec.html || "",
                                  ).trim();
                                  const leftHas = !!String(
                                    sec.left_html || "",
                                  ).trim();
                                  updateExtraSection(idx, {
                                    layout: nextLayout,
                                    html:
                                      legacyEmpty && leftHas
                                        ? sec.left_html
                                        : sec.html || "",
                                  });
                                  return;
                                }

                                updateExtraSection(idx, { layout: nextLayout });
                              }}
                            >
                              {SECTION_LAYOUT_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </Field>

                          <Field label="Theme">
                            <select
                              className="ap-input"
                              value={sec.theme || "default"}
                              onChange={(e) =>
                                updateExtraSection(idx, {
                                  theme: e.target.value,
                                })
                              }
                            >
                              {SECTION_THEME_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            marginTop: 10,
                            marginBottom: 10,
                          }}
                        >
                          <button
                            className="ap-btn"
                            type="button"
                            onClick={() => openStyleModal(idx)}
                            title="Open style settings"
                          >
                            🎨 Style
                          </button>

                          <button
                            className="ap-btn"
                            type="button"
                            onClick={() =>
                              updateExtraSection(idx, {
                                styles: defaultSectionStyle(
                                  sec.theme || "default",
                                ),
                              })
                            }
                            title="Reset style controls to defaults"
                          >
                            Reset Styles
                          </button>
                        </div>
                      </details>

                      {/* Blocks / Elements */}
                      <div
                        className="ap-blockWrap"
                        style={{
                          marginTop: 10,
                          marginBottom: 12,
                          padding: 12,
                          borderRadius: 14,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(255,255,255,0.03)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            marginBottom: 10,
                          }}
                        >
                          <div style={{ fontWeight: 900 }}>
                            Add to this section
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            {!hasBlocks ? (
                              <button
                                className="ap-btn"
                                type="button"
                                onClick={() => convertLegacyHtmlToBlocks(idx)}
                                title="Convert current HTML into blocks"
                              >
                                Convert to Blocks
                              </button>
                            ) : (
                              <button
                                className="ap-btn"
                                type="button"
                                onClick={() => clearBlocksUseLegacy(idx)}
                                title="Remove blocks and use legacy HTML again"
                              >
                                HTML (advanced)
                              </button>
                            )}

                            <button
                              className="ap-btn ap-btnPrimary"
                              type="button"
                              onClick={() => addBlock(idx, "richtext")}
                            >
                              + Rich Text
                            </button>
                            <button
                              className="ap-btn"
                              type="button"
                              onClick={() => addBlock(idx, "grid")}
                            >
                              + Grid
                            </button>
                            <button
                              className="ap-btn"
                              type="button"
                              onClick={() => addBlock(idx, "gallery")}
                            >
                              + Gallery
                            </button>
                            <button
                              className="ap-btn"
                              type="button"
                              onClick={() => addBlock(idx, "button")}
                            >
                              + Button
                            </button>
                            <button
                              className="ap-btn"
                              type="button"
                              onClick={() => addBlock(idx, "columns")}
                              title="Add a multi-column container"
                            >
                              + Columns
                            </button>
                            <button
                              className="ap-btn"
                              type="button"
                              onClick={() => addBlock(idx, "video")}
                            >
                              + Video
                            </button>
                            <button
                              className="ap-btn"
                              type="button"
                              onClick={() => addBlock(idx, "quote")}
                            >
                              + Quote
                            </button>
                            <button
                              className="ap-btn"
                              type="button"
                              onClick={() => addBlock(idx, "faq")}
                            >
                              + FAQ
                            </button>
                            <button
                              className="ap-btn"
                              type="button"
                              onClick={() => addBlock(idx, "spacer")}
                            >
                              + Spacer
                            </button>

                            {templateType === "home" ? (
                              <>
                                <button
                                  className="ap-btn"
                                  type="button"
                                  onClick={() => addBlock(idx, "home_hero")}
                                  title="Add a Home Hero block"
                                >
                                  + Home Hero
                                </button>
                                <button
                                  className="ap-btn"
                                  type="button"
                                  onClick={() => addBlock(idx, "home_join")}
                                  title="Add a Join Strip block"
                                >
                                  + Join Strip
                                </button>
                                <button
                                  className="ap-btn"
                                  type="button"
                                  onClick={() => addBlock(idx, "featured_live")}
                                  title="Add the Featured Live Highlight block"
                                >
                                  + Featured Live
                                </button>
                                <button
                                  className="ap-btn"
                                  type="button"
                                  onClick={() =>
                                    addBlock(idx, "latest_teaching")
                                  }
                                  title="Add the Latest Teaching section"
                                >
                                  + Latest Teaching
                                </button>
                                <button
                                  className="ap-btn"
                                  type="button"
                                  onClick={() => addBlock(idx, "home_cta")}
                                  title="Add a Watch More CTA block"
                                >
                                  + Watch CTA
                                </button>
                                <button
                                  className="ap-btn"
                                  type="button"
                                  onClick={() => addBlock(idx, "home_about")}
                                  title="Add an About block"
                                >
                                  + About
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {!hasBlocks ? (
                          <div className="ap-help">
                            Add elements like Grid and Image Gallery. If you
                            keep blocks empty, the section will continue using
                            the legacy HTML editor below.
                          </div>
                        ) : (
                          <div className="ap-blockList">
                            {blocks.map((b, bi) => (
                              <div
                                key={b.id}
                                className={
                                  "ap-blockCard ap-phase4faSelectable" +
                                  (selectedSectionIndex === String(idx) &&
                                  selectedBlockId === String(b.id)
                                    ? " ap-phase4faSelected"
                                    : "")
                                }
                                data-block-id={String(b.id)}
                                onClick={(event) => {
                                  // Preserve native inputs, rich text editing, and controls.
                                  // Selecting the block never mutates its saved content.
                                  if (
                                    event.target.closest(
                                      "button, input, select, textarea, a, [contenteditable='true']",
                                    )
                                  )
                                    return;
                                  setSelectedSectionIndex(String(idx));
                                  setSelectedBlockId(String(b.id));
                                  setInspectorTab("block");
                                  setInspectorOpen(true);
                                }}
                                draggable
                                onDragStart={(e) => {
                                  dragBlockRef.current = {
                                    sectionIdx: idx,
                                    idx: bi,
                                  };
                                  try {
                                    e.dataTransfer.effectAllowed = "move";
                                    e.dataTransfer.setData(
                                      "text/plain",
                                      `${idx}:${bi}`,
                                    );
                                  } catch (_e) {}
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  try {
                                    e.dataTransfer.dropEffect = "move";
                                  } catch (_e) {}
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const from = dragBlockRef.current || {
                                    sectionIdx: -1,
                                    idx: -1,
                                  };
                                  const to = { sectionIdx: idx, idx: bi };
                                  if (
                                    from.sectionIdx === to.sectionIdx &&
                                    from.idx >= 0 &&
                                    from.idx !== to.idx
                                  ) {
                                    reorderBlocks(idx, from.idx, to.idx);
                                  }
                                  dragBlockRef.current = {
                                    sectionIdx: -1,
                                    idx: -1,
                                  };
                                }}
                              >
                                <div className="ap-blockHead">
                                  <button
                                    type="button"
                                    className={
                                      "ap-phase4SelectBlock" +
                                      (selectedSectionIndex === String(idx) &&
                                      selectedBlockId === String(b.id)
                                        ? " is-selected"
                                        : "")
                                    }
                                    aria-label={
                                      "Select " +
                                      String(b.type || "richtext") +
                                      " block for editing"
                                    }
                                    onClick={() => {
                                      setSelectedSectionIndex(String(idx));
                                      setSelectedBlockId(String(b.id));
                                      setInspectorTab("block");
                                      setInspectorOpen(true);
                                    }}
                                  >
                                    <span aria-hidden="true">◎</span> Select
                                  </button>
                                  <div className="ap-blockTitle">
                                    <span className="ap-badge">
                                      {blockTypeLabel(b.type)}
                                    </span>
                                    <span style={{ fontWeight: 900 }}>
                                      {b.type === "richtext"
                                        ? "Text"
                                        : b.type === "grid"
                                          ? "Grid"
                                          : b.type === "gallery"
                                            ? "Gallery"
                                            : b.type === "button"
                                              ? "Button"
                                              : b.type === "columns"
                                                ? "Columns"
                                                : blockTypeLabel(b.type)}
                                    </span>
                                  </div>

                                  <div className="ap-blockActions">
                                    <button
                                      className="ap-btn"
                                      type="button"
                                      onClick={() => moveBlock(idx, b.id, -1)}
                                      disabled={bi === 0}
                                      title="Move up"
                                      style={{ padding: "6px 10px" }}
                                    >
                                      ↑
                                    </button>
                                    <button
                                      className="ap-btn"
                                      type="button"
                                      onClick={() => moveBlock(idx, b.id, 1)}
                                      disabled={bi === blocks.length - 1}
                                      title="Move down"
                                      style={{ padding: "6px 10px" }}
                                    >
                                      ↓
                                    </button>
                                    <button
                                      className="ap-btn"
                                      type="button"
                                      onClick={() => duplicateBlock(idx, b.id)}
                                      title="Duplicate this block"
                                    >
                                      Duplicate
                                    </button>
                                    <button
                                      className="ap-btn ap-btnDanger"
                                      type="button"
                                      onClick={() =>
                                        openConfirm({
                                          title: "Delete element?",
                                          message:
                                            "This removes the element from this section.",
                                          confirmText: "Delete",
                                          danger: true,
                                          onConfirm: async () => {
                                            closeConfirm();
                                            deleteBlock(idx, b.id);
                                          },
                                        })
                                      }
                                      style={{ padding: "6px 10px" }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>

                                {/* Phase 5: video, spacer, quote, FAQ */}
                                {EXTRA_BLOCK_TYPES.has(String(b.type || "")) ? (
                                  <ExtraBlockEditor
                                    block={b}
                                    onPatch={(patch) =>
                                      patchBlock(idx, b.id, patch)
                                    }
                                  />
                                ) : null}
                                {String(b.type || "richtext") === "richtext" ? (
                                  <div className="ap-editorWrap">
                                    <ModernPageEditor
                                      value={String(b.html || "")}
                                      onChangeHtml={(html) =>
                                        patchBlock(idx, b.id, { html })
                                      }
                                      onChange={(html) =>
                                        patchBlock(idx, b.id, { html })
                                      }
                                      onUploadImage={async (file) =>
                                        uploadImage(file, "inline")
                                      }
                                    />
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") === "button" ? (
                                  <div className="ap-blockBody">
                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 10,
                                      }}
                                    >
                                      <Field label="Button Text">
                                        <input
                                          className="ap-input"
                                          value={String(b.text || "")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              text: e.target.value,
                                            })
                                          }
                                        />
                                      </Field>
                                      <Field label="Link (href)">
                                        <input
                                          className="ap-input"
                                          value={String(b.href || "")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              href: e.target.value,
                                            })
                                          }
                                          placeholder="/catalog or https://..."
                                        />
                                      </Field>
                                    </div>

                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr 1fr",
                                        gap: 10,
                                        marginTop: 10,
                                      }}
                                    >
                                      <Field label="Align">
                                        <select
                                          className="ap-input"
                                          value={String(b.align || "left")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              align: e.target.value,
                                            })
                                          }
                                        >
                                          {["left", "center", "right"].map(
                                            (v) => (
                                              <option key={v} value={v}>
                                                {v}
                                              </option>
                                            ),
                                          )}
                                        </select>
                                      </Field>

                                      <Field label="Variant">
                                        <select
                                          className="ap-input"
                                          value={String(b.variant || "solid")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              variant: e.target.value,
                                            })
                                          }
                                        >
                                          {["solid", "outline", "ghost"].map(
                                            (v) => (
                                              <option key={v} value={v}>
                                                {v}
                                              </option>
                                            ),
                                          )}
                                        </select>
                                      </Field>

                                      <Field label="Size">
                                        <select
                                          className="ap-input"
                                          value={String(b.size || "md")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              size: e.target.value,
                                            })
                                          }
                                        >
                                          {["sm", "md", "lg"].map((v) => (
                                            <option key={v} value={v}>
                                              {v}
                                            </option>
                                          ))}
                                        </select>
                                      </Field>
                                    </div>

                                    <details style={{ marginTop: 10 }}>
                                      <summary
                                        style={{
                                          cursor: "pointer",
                                          fontWeight: 900,
                                        }}
                                      >
                                        Styling Options
                                      </summary>

                                      <div
                                        style={{
                                          display: "grid",
                                          gridTemplateColumns: "1fr 1fr",
                                          gap: 10,
                                          marginTop: 10,
                                        }}
                                      >
                                        <Field label="Padding">
                                          <input
                                            className="ap-input"
                                            value={String(
                                              b.styles?.padding || "",
                                            )}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                styles: {
                                                  ...(b.styles || {}),
                                                  padding: e.target.value,
                                                },
                                              })
                                            }
                                            placeholder="e.g. 12px 16px"
                                          />
                                        </Field>

                                        <Field label="Radius">
                                          <input
                                            className="ap-input"
                                            type="number"
                                            value={String(
                                              b.styles?.radius ?? 14,
                                            )}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                styles: {
                                                  ...(b.styles || {}),
                                                  radius:
                                                    Number(e.target.value) || 0,
                                                },
                                              })
                                            }
                                          />
                                        </Field>

                                        <Field label="Background Color">
                                          <input
                                            className="ap-input"
                                            value={String(
                                              b.styles?.bg_color || "",
                                            )}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                styles: {
                                                  ...(b.styles || {}),
                                                  bg_color: e.target.value,
                                                },
                                              })
                                            }
                                            placeholder="#FD9D00"
                                          />
                                        </Field>

                                        <Field label="Text Color">
                                          <input
                                            className="ap-input"
                                            value={String(
                                              b.styles?.text_color || "",
                                            )}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                styles: {
                                                  ...(b.styles || {}),
                                                  text_color: e.target.value,
                                                },
                                              })
                                            }
                                            placeholder="#0b0d12"
                                          />
                                        </Field>

                                        <Field label="Border Color">
                                          <input
                                            className="ap-input"
                                            value={String(
                                              b.styles?.border_color || "",
                                            )}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                styles: {
                                                  ...(b.styles || {}),
                                                  border_color: e.target.value,
                                                },
                                              })
                                            }
                                            placeholder="rgba(255,255,255,0.12)"
                                          />
                                        </Field>

                                        <Field label="Border Width">
                                          <input
                                            className="ap-input"
                                            type="number"
                                            value={String(
                                              b.styles?.border_width ?? 1,
                                            )}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                styles: {
                                                  ...(b.styles || {}),
                                                  border_width:
                                                    Number(e.target.value) || 0,
                                                },
                                              })
                                            }
                                          />
                                        </Field>

                                        <Field label="Target (optional)">
                                          <select
                                            className="ap-input"
                                            value={String(b.target || "")}
                                            onChange={(e) =>
                                              patchBlock(idx, b.id, {
                                                target: e.target.value,
                                              })
                                            }
                                          >
                                            <option value="">Same tab</option>
                                            <option value="_blank">
                                              New tab
                                            </option>
                                          </select>
                                        </Field>
                                      </div>
                                    </details>
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") === "columns" ? (
                                  <div className="ap-blockBody">
                                    {(() => {
                                      const blk = normalizeColumnsBlock(b);
                                      const cols = Array.isArray(blk.columns)
                                        ? blk.columns
                                        : [];
                                      return (
                                        <>
                                          <div
                                            style={{
                                              display: "grid",
                                              gridTemplateColumns: "1fr 1fr",
                                              gap: 10,
                                              alignItems: "end",
                                            }}
                                          >
                                            <Field label="Gap (px)">
                                              <input
                                                className="ap-input"
                                                type="number"
                                                value={String(blk.gap ?? 14)}
                                                onChange={(e) =>
                                                  patchBlock(idx, b.id, {
                                                    gap: Math.max(
                                                      0,
                                                      Number(e.target.value) ||
                                                        0,
                                                    ),
                                                  })
                                                }
                                              />
                                            </Field>

                                            <Field label="Stack on mobile">
                                              <select
                                                className="ap-input"
                                                value={String(
                                                  blk.stack_on_mobile ?? true,
                                                )}
                                                onChange={(e) =>
                                                  patchBlock(idx, b.id, {
                                                    stack_on_mobile:
                                                      String(e.target.value) ===
                                                      "true",
                                                  })
                                                }
                                              >
                                                <option value="true">
                                                  Yes
                                                </option>
                                                <option value="false">
                                                  No
                                                </option>
                                              </select>
                                            </Field>
                                          </div>

                                          <details style={{ marginTop: 10 }}>
                                            <summary
                                              style={{
                                                cursor: "pointer",
                                                fontWeight: 900,
                                              }}
                                            >
                                              Container Styling
                                            </summary>

                                            <div
                                              style={{
                                                display: "grid",
                                                gridTemplateColumns: "1fr 1fr",
                                                gap: 10,
                                                marginTop: 10,
                                              }}
                                            >
                                              <Field label="Padding">
                                                <input
                                                  className="ap-input"
                                                  value={String(
                                                    blk.styles?.padding || "",
                                                  )}
                                                  onChange={(e) =>
                                                    patchBlock(idx, b.id, {
                                                      styles: {
                                                        ...(blk.styles || {}),
                                                        padding: e.target.value,
                                                      },
                                                    })
                                                  }
                                                  placeholder="e.g. 16px"
                                                />
                                              </Field>
                                              <Field label="Background">
                                                <input
                                                  className="ap-input"
                                                  value={String(
                                                    blk.styles?.bg_color || "",
                                                  )}
                                                  onChange={(e) =>
                                                    patchBlock(idx, b.id, {
                                                      styles: {
                                                        ...(blk.styles || {}),
                                                        bg_color:
                                                          e.target.value,
                                                      },
                                                    })
                                                  }
                                                  placeholder="rgba(...) or #..."
                                                />
                                              </Field>
                                              <Field label="Border Color">
                                                <input
                                                  className="ap-input"
                                                  value={String(
                                                    blk.styles?.border_color ||
                                                      "",
                                                  )}
                                                  onChange={(e) =>
                                                    patchBlock(idx, b.id, {
                                                      styles: {
                                                        ...(blk.styles || {}),
                                                        border_color:
                                                          e.target.value,
                                                      },
                                                    })
                                                  }
                                                />
                                              </Field>
                                              <Field label="Border Width">
                                                <input
                                                  className="ap-input"
                                                  type="number"
                                                  value={String(
                                                    blk.styles?.border_width ??
                                                      "",
                                                  )}
                                                  onChange={(e) =>
                                                    patchBlock(idx, b.id, {
                                                      styles: {
                                                        ...(blk.styles || {}),
                                                        border_width:
                                                          Number(
                                                            e.target.value,
                                                          ) || 0,
                                                      },
                                                    })
                                                  }
                                                />
                                              </Field>
                                              <Field label="Radius">
                                                <input
                                                  className="ap-input"
                                                  type="number"
                                                  value={String(
                                                    blk.styles?.radius ?? 14,
                                                  )}
                                                  onChange={(e) =>
                                                    patchBlock(idx, b.id, {
                                                      styles: {
                                                        ...(blk.styles || {}),
                                                        radius:
                                                          Number(
                                                            e.target.value,
                                                          ) || 0,
                                                      },
                                                    })
                                                  }
                                                />
                                              </Field>
                                            </div>
                                          </details>

                                          <div
                                            style={{
                                              display: "flex",
                                              gap: 10,
                                              flexWrap: "wrap",
                                              marginTop: 10,
                                            }}
                                          >
                                            <button
                                              className="ap-btn ap-btnPrimary"
                                              type="button"
                                              onClick={() =>
                                                addColumn(idx, b.id)
                                              }
                                            >
                                              + Add Column
                                            </button>
                                          </div>

                                          <div
                                            style={{
                                              marginTop: 12,
                                              display: "grid",
                                              gap: 12,
                                            }}
                                          >
                                            {cols.map((c, ci) => {
                                              const innerBlocks =
                                                normalizeBlocksArray(c.blocks);
                                              return (
                                                <div
                                                  key={c.id}
                                                  className="ap-card"
                                                  style={{ padding: 12 }}
                                                >
                                                  <div
                                                    style={{
                                                      display: "flex",
                                                      justifyContent:
                                                        "space-between",
                                                      gap: 10,
                                                      alignItems: "center",
                                                      flexWrap: "wrap",
                                                    }}
                                                  >
                                                    <div
                                                      style={{
                                                        fontWeight: 900,
                                                      }}
                                                    >
                                                      Column {ci + 1}{" "}
                                                      <span
                                                        style={{
                                                          opacity: 0.7,
                                                          fontWeight: 700,
                                                        }}
                                                      >
                                                        (
                                                        {Math.round(
                                                          clampNum(
                                                            c.width_pct ?? 50,
                                                            10,
                                                            90,
                                                          ),
                                                        )}
                                                        %)
                                                      </span>
                                                    </div>
                                                    <div
                                                      style={{
                                                        display: "flex",
                                                        gap: 8,
                                                        flexWrap: "wrap",
                                                      }}
                                                    >
                                                      <button
                                                        className="ap-btn"
                                                        type="button"
                                                        onClick={() =>
                                                          moveColumn(
                                                            idx,
                                                            b.id,
                                                            ci,
                                                            ci - 1,
                                                          )
                                                        }
                                                        disabled={ci === 0}
                                                        title="Move left"
                                                        style={{
                                                          padding: "6px 10px",
                                                        }}
                                                      >
                                                        ←
                                                      </button>
                                                      <button
                                                        className="ap-btn"
                                                        type="button"
                                                        onClick={() =>
                                                          moveColumn(
                                                            idx,
                                                            b.id,
                                                            ci,
                                                            ci + 1,
                                                          )
                                                        }
                                                        disabled={
                                                          ci === cols.length - 1
                                                        }
                                                        title="Move right"
                                                        style={{
                                                          padding: "6px 10px",
                                                        }}
                                                      >
                                                        →
                                                      </button>
                                                      <button
                                                        className="ap-btn ap-btnDanger"
                                                        type="button"
                                                        onClick={() =>
                                                          openConfirm({
                                                            title:
                                                              "Delete column?",
                                                            message:
                                                              "This will remove the entire column and its contents.",
                                                            confirmText:
                                                              "Delete",
                                                            danger: true,
                                                            onConfirm:
                                                              async () => {
                                                                closeConfirm();
                                                                deleteColumn(
                                                                  idx,
                                                                  b.id,
                                                                  c.id,
                                                                );
                                                              },
                                                          })
                                                        }
                                                        style={{
                                                          padding: "6px 10px",
                                                        }}
                                                      >
                                                        Delete
                                                      </button>
                                                    </div>
                                                  </div>

                                                  <div
                                                    style={{
                                                      display: "grid",
                                                      gridTemplateColumns:
                                                        "1fr 1fr",
                                                      gap: 10,
                                                      marginTop: 10,
                                                    }}
                                                  >
                                                    <Field label="Width %">
                                                      <input
                                                        className="ap-input"
                                                        type="number"
                                                        value={String(
                                                          c.width_pct ?? 50,
                                                        )}
                                                        onChange={(e) =>
                                                          patchColumn(
                                                            idx,
                                                            b.id,
                                                            c.id,
                                                            {
                                                              width_pct:
                                                                clampNum(
                                                                  Number(
                                                                    e.target
                                                                      .value,
                                                                  ) || 50,
                                                                  10,
                                                                  90,
                                                                ),
                                                            },
                                                          )
                                                        }
                                                      />
                                                    </Field>
                                                    <Field label="Padding">
                                                      <input
                                                        className="ap-input"
                                                        value={String(
                                                          c.styles?.padding ||
                                                            "",
                                                        )}
                                                        onChange={(e) =>
                                                          patchColumn(
                                                            idx,
                                                            b.id,
                                                            c.id,
                                                            {
                                                              styles: {
                                                                ...(c.styles ||
                                                                  {}),
                                                                padding:
                                                                  e.target
                                                                    .value,
                                                              },
                                                            },
                                                          )
                                                        }
                                                        placeholder="e.g. 12px"
                                                      />
                                                    </Field>
                                                    <Field label="Background">
                                                      <input
                                                        className="ap-input"
                                                        value={String(
                                                          c.styles?.bg_color ||
                                                            "",
                                                        )}
                                                        onChange={(e) =>
                                                          patchColumn(
                                                            idx,
                                                            b.id,
                                                            c.id,
                                                            {
                                                              styles: {
                                                                ...(c.styles ||
                                                                  {}),
                                                                bg_color:
                                                                  e.target
                                                                    .value,
                                                              },
                                                            },
                                                          )
                                                        }
                                                      />
                                                    </Field>
                                                    <Field label="Radius">
                                                      <input
                                                        className="ap-input"
                                                        type="number"
                                                        value={String(
                                                          c.styles?.radius ??
                                                            14,
                                                        )}
                                                        onChange={(e) =>
                                                          patchColumn(
                                                            idx,
                                                            b.id,
                                                            c.id,
                                                            {
                                                              styles: {
                                                                ...(c.styles ||
                                                                  {}),
                                                                radius:
                                                                  Number(
                                                                    e.target
                                                                      .value,
                                                                  ) || 0,
                                                              },
                                                            },
                                                          )
                                                        }
                                                      />
                                                    </Field>
                                                  </div>

                                                  <div
                                                    style={{
                                                      display: "flex",
                                                      gap: 10,
                                                      flexWrap: "wrap",
                                                      marginTop: 10,
                                                    }}
                                                  >
                                                    <button
                                                      className="ap-btn"
                                                      type="button"
                                                      onClick={() =>
                                                        addColumnBlock(
                                                          idx,
                                                          b.id,
                                                          c.id,
                                                          "richtext",
                                                        )
                                                      }
                                                    >
                                                      + Text
                                                    </button>
                                                    <button
                                                      className="ap-btn"
                                                      type="button"
                                                      onClick={() =>
                                                        addColumnBlock(
                                                          idx,
                                                          b.id,
                                                          c.id,
                                                          "button",
                                                        )
                                                      }
                                                    >
                                                      + Button
                                                    </button>
                                                    <button
                                                      className="ap-btn"
                                                      type="button"
                                                      onClick={() =>
                                                        addColumnBlock(
                                                          idx,
                                                          b.id,
                                                          c.id,
                                                          "grid",
                                                        )
                                                      }
                                                    >
                                                      + Grid
                                                    </button>
                                                    <button
                                                      className="ap-btn"
                                                      type="button"
                                                      onClick={() =>
                                                        addColumnBlock(
                                                          idx,
                                                          b.id,
                                                          c.id,
                                                          "gallery",
                                                        )
                                                      }
                                                    >
                                                      + Gallery
                                                    </button>
                                                  </div>

                                                  <div
                                                    style={{
                                                      marginTop: 12,
                                                      display: "grid",
                                                      gap: 10,
                                                    }}
                                                  >
                                                    {innerBlocks.map(
                                                      (ib, ibi) => (
                                                        <div
                                                          key={ib.id}
                                                          className="ap-blockCard"
                                                          style={{ margin: 0 }}
                                                        >
                                                          <div className="ap-blockHead">
                                                            <div className="ap-blockTitle">
                                                              <span className="ap-badge">
                                                                {String(
                                                                  ib.type ||
                                                                    "richtext",
                                                                )}
                                                              </span>
                                                              <span
                                                                style={{
                                                                  fontWeight: 900,
                                                                }}
                                                              >
                                                                {ib.type ===
                                                                "richtext"
                                                                  ? "Text"
                                                                  : ib.type ===
                                                                      "grid"
                                                                    ? "Grid"
                                                                    : ib.type ===
                                                                        "gallery"
                                                                      ? "Gallery"
                                                                      : ib.type ===
                                                                          "button"
                                                                        ? "Button"
                                                                        : "Block"}
                                                              </span>
                                                            </div>

                                                            <div className="ap-blockActions">
                                                              <button
                                                                className="ap-btn"
                                                                type="button"
                                                                onClick={() =>
                                                                  moveColumnBlock(
                                                                    idx,
                                                                    b.id,
                                                                    c.id,
                                                                    ib.id,
                                                                    -1,
                                                                  )
                                                                }
                                                                disabled={
                                                                  ibi === 0
                                                                }
                                                                title="Move up"
                                                                style={{
                                                                  padding:
                                                                    "6px 10px",
                                                                }}
                                                              >
                                                                ↑
                                                              </button>
                                                              <button
                                                                className="ap-btn"
                                                                type="button"
                                                                onClick={() =>
                                                                  moveColumnBlock(
                                                                    idx,
                                                                    b.id,
                                                                    c.id,
                                                                    ib.id,
                                                                    1,
                                                                  )
                                                                }
                                                                disabled={
                                                                  ibi ===
                                                                  innerBlocks.length -
                                                                    1
                                                                }
                                                                title="Move down"
                                                                style={{
                                                                  padding:
                                                                    "6px 10px",
                                                                }}
                                                              >
                                                                ↓
                                                              </button>
                                                              <button
                                                                className="ap-btn ap-btnDanger"
                                                                type="button"
                                                                onClick={() =>
                                                                  openConfirm({
                                                                    title:
                                                                      "Delete element?",
                                                                    message:
                                                                      "This removes the element from this column.",
                                                                    confirmText:
                                                                      "Delete",
                                                                    danger: true,
                                                                    onConfirm:
                                                                      async () => {
                                                                        closeConfirm();
                                                                        deleteColumnBlock(
                                                                          idx,
                                                                          b.id,
                                                                          c.id,
                                                                          ib.id,
                                                                        );
                                                                      },
                                                                  })
                                                                }
                                                                style={{
                                                                  padding:
                                                                    "6px 10px",
                                                                }}
                                                              >
                                                                Delete
                                                              </button>
                                                            </div>
                                                          </div>

                                                          {String(
                                                            ib.type ||
                                                              "richtext",
                                                          ) === "richtext" ? (
                                                            <div className="ap-editorWrap">
                                                              <ModernPageEditor
                                                                value={String(
                                                                  ib.html || "",
                                                                )}
                                                                onChangeHtml={(
                                                                  html,
                                                                ) =>
                                                                  patchColumnBlock(
                                                                    idx,
                                                                    b.id,
                                                                    c.id,
                                                                    ib.id,
                                                                    { html },
                                                                  )
                                                                }
                                                                onChange={(
                                                                  html,
                                                                ) =>
                                                                  patchColumnBlock(
                                                                    idx,
                                                                    b.id,
                                                                    c.id,
                                                                    ib.id,
                                                                    { html },
                                                                  )
                                                                }
                                                                onUploadImage={async (
                                                                  file,
                                                                ) =>
                                                                  uploadImage(
                                                                    file,
                                                                    "inline",
                                                                  )
                                                                }
                                                              />
                                                            </div>
                                                          ) : null}

                                                          {String(
                                                            ib.type ||
                                                              "richtext",
                                                          ) === "button" ? (
                                                            <div className="ap-blockBody">
                                                              <div
                                                                style={{
                                                                  display:
                                                                    "grid",
                                                                  gridTemplateColumns:
                                                                    "1fr 1fr",
                                                                  gap: 10,
                                                                }}
                                                              >
                                                                <Field label="Text">
                                                                  <input
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.text ||
                                                                        "",
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          text: e
                                                                            .target
                                                                            .value,
                                                                        },
                                                                      )
                                                                    }
                                                                  />
                                                                </Field>
                                                                <Field label="Link">
                                                                  <input
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.href ||
                                                                        "",
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          href: e
                                                                            .target
                                                                            .value,
                                                                        },
                                                                      )
                                                                    }
                                                                    placeholder="/page or https://..."
                                                                  />
                                                                </Field>
                                                              </div>

                                                              <div
                                                                style={{
                                                                  display:
                                                                    "grid",
                                                                  gridTemplateColumns:
                                                                    "1fr 1fr 1fr",
                                                                  gap: 10,
                                                                  marginTop: 10,
                                                                }}
                                                              >
                                                                <Field label="Align">
                                                                  <select
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.align ||
                                                                        "left",
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          align:
                                                                            e
                                                                              .target
                                                                              .value,
                                                                        },
                                                                      )
                                                                    }
                                                                  >
                                                                    {[
                                                                      "left",
                                                                      "center",
                                                                      "right",
                                                                    ].map(
                                                                      (v) => (
                                                                        <option
                                                                          key={
                                                                            v
                                                                          }
                                                                          value={
                                                                            v
                                                                          }
                                                                        >
                                                                          {v}
                                                                        </option>
                                                                      ),
                                                                    )}
                                                                  </select>
                                                                </Field>
                                                                <Field label="Variant">
                                                                  <select
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.variant ||
                                                                        "solid",
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          variant:
                                                                            e
                                                                              .target
                                                                              .value,
                                                                        },
                                                                      )
                                                                    }
                                                                  >
                                                                    {[
                                                                      "solid",
                                                                      "outline",
                                                                      "ghost",
                                                                    ].map(
                                                                      (v) => (
                                                                        <option
                                                                          key={
                                                                            v
                                                                          }
                                                                          value={
                                                                            v
                                                                          }
                                                                        >
                                                                          {v}
                                                                        </option>
                                                                      ),
                                                                    )}
                                                                  </select>
                                                                </Field>
                                                                <Field label="Size">
                                                                  <select
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.size ||
                                                                        "md",
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          size: e
                                                                            .target
                                                                            .value,
                                                                        },
                                                                      )
                                                                    }
                                                                  >
                                                                    {[
                                                                      "sm",
                                                                      "md",
                                                                      "lg",
                                                                    ].map(
                                                                      (v) => (
                                                                        <option
                                                                          key={
                                                                            v
                                                                          }
                                                                          value={
                                                                            v
                                                                          }
                                                                        >
                                                                          {v}
                                                                        </option>
                                                                      ),
                                                                    )}
                                                                  </select>
                                                                </Field>
                                                              </div>

                                                              <details
                                                                style={{
                                                                  marginTop: 10,
                                                                }}
                                                              >
                                                                <summary
                                                                  style={{
                                                                    cursor:
                                                                      "pointer",
                                                                    fontWeight: 900,
                                                                  }}
                                                                >
                                                                  Styling
                                                                </summary>
                                                                <div
                                                                  style={{
                                                                    display:
                                                                      "grid",
                                                                    gridTemplateColumns:
                                                                      "1fr 1fr",
                                                                    gap: 10,
                                                                    marginTop: 10,
                                                                  }}
                                                                >
                                                                  <Field label="Padding">
                                                                    <input
                                                                      className="ap-input"
                                                                      value={String(
                                                                        ib
                                                                          .styles
                                                                          ?.padding ||
                                                                          "",
                                                                      )}
                                                                      onChange={(
                                                                        e,
                                                                      ) =>
                                                                        patchColumnBlock(
                                                                          idx,
                                                                          b.id,
                                                                          c.id,
                                                                          ib.id,
                                                                          {
                                                                            styles:
                                                                              {
                                                                                ...(ib.styles ||
                                                                                  {}),
                                                                                padding:
                                                                                  e
                                                                                    .target
                                                                                    .value,
                                                                              },
                                                                          },
                                                                        )
                                                                      }
                                                                    />
                                                                  </Field>
                                                                  <Field label="Radius">
                                                                    <input
                                                                      className="ap-input"
                                                                      type="number"
                                                                      value={String(
                                                                        ib
                                                                          .styles
                                                                          ?.radius ??
                                                                          14,
                                                                      )}
                                                                      onChange={(
                                                                        e,
                                                                      ) =>
                                                                        patchColumnBlock(
                                                                          idx,
                                                                          b.id,
                                                                          c.id,
                                                                          ib.id,
                                                                          {
                                                                            styles:
                                                                              {
                                                                                ...(ib.styles ||
                                                                                  {}),
                                                                                radius:
                                                                                  Number(
                                                                                    e
                                                                                      .target
                                                                                      .value,
                                                                                  ) ||
                                                                                  0,
                                                                              },
                                                                          },
                                                                        )
                                                                      }
                                                                    />
                                                                  </Field>
                                                                  <Field label="BG">
                                                                    <input
                                                                      className="ap-input"
                                                                      value={String(
                                                                        ib
                                                                          .styles
                                                                          ?.bg_color ||
                                                                          "",
                                                                      )}
                                                                      onChange={(
                                                                        e,
                                                                      ) =>
                                                                        patchColumnBlock(
                                                                          idx,
                                                                          b.id,
                                                                          c.id,
                                                                          ib.id,
                                                                          {
                                                                            styles:
                                                                              {
                                                                                ...(ib.styles ||
                                                                                  {}),
                                                                                bg_color:
                                                                                  e
                                                                                    .target
                                                                                    .value,
                                                                              },
                                                                          },
                                                                        )
                                                                      }
                                                                    />
                                                                  </Field>
                                                                  <Field label="Text">
                                                                    <input
                                                                      className="ap-input"
                                                                      value={String(
                                                                        ib
                                                                          .styles
                                                                          ?.text_color ||
                                                                          "",
                                                                      )}
                                                                      onChange={(
                                                                        e,
                                                                      ) =>
                                                                        patchColumnBlock(
                                                                          idx,
                                                                          b.id,
                                                                          c.id,
                                                                          ib.id,
                                                                          {
                                                                            styles:
                                                                              {
                                                                                ...(ib.styles ||
                                                                                  {}),
                                                                                text_color:
                                                                                  e
                                                                                    .target
                                                                                    .value,
                                                                              },
                                                                          },
                                                                        )
                                                                      }
                                                                    />
                                                                  </Field>
                                                                </div>
                                                              </details>
                                                            </div>
                                                          ) : null}

                                                          {String(
                                                            ib.type ||
                                                              "richtext",
                                                          ) === "grid" ? (
                                                            <div className="ap-blockBody">
                                                              <div
                                                                style={{
                                                                  display:
                                                                    "grid",
                                                                  gridTemplateColumns:
                                                                    "1fr 1fr",
                                                                  gap: 10,
                                                                  alignItems:
                                                                    "end",
                                                                }}
                                                              >
                                                                <Field label="Columns">
                                                                  <select
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.cols ||
                                                                        3,
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          cols: Math.max(
                                                                            1,
                                                                            Math.min(
                                                                              4,
                                                                              Number(
                                                                                e
                                                                                  .target
                                                                                  .value,
                                                                              ) ||
                                                                                3,
                                                                            ),
                                                                          ),
                                                                        },
                                                                      )
                                                                    }
                                                                  >
                                                                    {[
                                                                      1, 2, 3,
                                                                      4,
                                                                    ].map(
                                                                      (n) => (
                                                                        <option
                                                                          key={
                                                                            n
                                                                          }
                                                                          value={
                                                                            n
                                                                          }
                                                                        >
                                                                          {n}
                                                                        </option>
                                                                      ),
                                                                    )}
                                                                  </select>
                                                                </Field>
                                                                <Field label="Gap (px)">
                                                                  <input
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.gap ??
                                                                        12,
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          gap: Math.max(
                                                                            0,
                                                                            Number(
                                                                              e
                                                                                .target
                                                                                .value,
                                                                            ) ||
                                                                              0,
                                                                          ),
                                                                        },
                                                                      )
                                                                    }
                                                                  />
                                                                </Field>
                                                              </div>

                                                              <div
                                                                style={{
                                                                  display:
                                                                    "flex",
                                                                  gap: 10,
                                                                  flexWrap:
                                                                    "wrap",
                                                                  marginTop: 10,
                                                                }}
                                                              >
                                                                <button
                                                                  className="ap-btn ap-btnPrimary"
                                                                  type="button"
                                                                  onClick={() =>
                                                                    addColumnGridItem(
                                                                      idx,
                                                                      b.id,
                                                                      c.id,
                                                                      ib.id,
                                                                    )
                                                                  }
                                                                >
                                                                  + Add Card
                                                                </button>
                                                              </div>

                                                              <div
                                                                style={{
                                                                  marginTop: 10,
                                                                  display:
                                                                    "grid",
                                                                  gap: 10,
                                                                }}
                                                              >
                                                                {(Array.isArray(
                                                                  ib.items,
                                                                )
                                                                  ? ib.items
                                                                  : []
                                                                ).map(
                                                                  (it, ii) => (
                                                                    <div
                                                                      key={
                                                                        it.id
                                                                      }
                                                                      className="ap-card"
                                                                      style={{
                                                                        padding: 12,
                                                                      }}
                                                                    >
                                                                      <div
                                                                        style={{
                                                                          display:
                                                                            "flex",
                                                                          justifyContent:
                                                                            "space-between",
                                                                          gap: 10,
                                                                          alignItems:
                                                                            "center",
                                                                          flexWrap:
                                                                            "wrap",
                                                                        }}
                                                                      >
                                                                        <div
                                                                          style={{
                                                                            fontWeight: 900,
                                                                          }}
                                                                        >
                                                                          Item{" "}
                                                                          {ii +
                                                                            1}
                                                                        </div>
                                                                        <button
                                                                          className="ap-btn ap-btnDanger"
                                                                          type="button"
                                                                          onClick={() =>
                                                                            deleteColumnGridItem(
                                                                              idx,
                                                                              b.id,
                                                                              c.id,
                                                                              ib.id,
                                                                              it.id,
                                                                            )
                                                                          }
                                                                          style={{
                                                                            padding:
                                                                              "6px 10px",
                                                                          }}
                                                                        >
                                                                          Delete
                                                                        </button>
                                                                      </div>

                                                                      <Field label="Title">
                                                                        <input
                                                                          className="ap-input"
                                                                          value={String(
                                                                            it.title ||
                                                                              "",
                                                                          )}
                                                                          onChange={(
                                                                            e,
                                                                          ) =>
                                                                            patchColumnGridItem(
                                                                              idx,
                                                                              b.id,
                                                                              c.id,
                                                                              ib.id,
                                                                              it.id,
                                                                              {
                                                                                title:
                                                                                  e
                                                                                    .target
                                                                                    .value,
                                                                              },
                                                                            )
                                                                          }
                                                                        />
                                                                      </Field>

                                                                      <Field label="Text">
                                                                        <textarea
                                                                          className="ap-textarea"
                                                                          rows={
                                                                            3
                                                                          }
                                                                          value={String(
                                                                            it.text ||
                                                                              "",
                                                                          )}
                                                                          onChange={(
                                                                            e,
                                                                          ) =>
                                                                            patchColumnGridItem(
                                                                              idx,
                                                                              b.id,
                                                                              c.id,
                                                                              ib.id,
                                                                              it.id,
                                                                              {
                                                                                text: e
                                                                                  .target
                                                                                  .value,
                                                                              },
                                                                            )
                                                                          }
                                                                        />
                                                                      </Field>

                                                                      <Field label="Image (optional)">
                                                                        <div
                                                                          style={{
                                                                            display:
                                                                              "flex",
                                                                            gap: 10,
                                                                            alignItems:
                                                                              "center",
                                                                            flexWrap:
                                                                              "wrap",
                                                                          }}
                                                                        >
                                                                          <input
                                                                            className="ap-input"
                                                                            value={String(
                                                                              it.image_url ||
                                                                                "",
                                                                            )}
                                                                            onChange={(
                                                                              e,
                                                                            ) =>
                                                                              patchColumnGridItem(
                                                                                idx,
                                                                                b.id,
                                                                                c.id,
                                                                                ib.id,
                                                                                it.id,
                                                                                {
                                                                                  image_url:
                                                                                    e
                                                                                      .target
                                                                                      .value,
                                                                                },
                                                                              )
                                                                            }
                                                                            placeholder="https://..."
                                                                          />
                                                                          <label
                                                                            className="ap-btn"
                                                                            style={{
                                                                              cursor:
                                                                                "pointer",
                                                                            }}
                                                                          >
                                                                            Upload
                                                                            <input
                                                                              type="file"
                                                                              accept="image/*"
                                                                              style={{
                                                                                display:
                                                                                  "none",
                                                                              }}
                                                                              onChange={async (
                                                                                e,
                                                                              ) => {
                                                                                const file =
                                                                                  e
                                                                                    .target
                                                                                    .files?.[0];
                                                                                e.target.value =
                                                                                  "";
                                                                                await uploadColumnGridItemImage(
                                                                                  idx,
                                                                                  b.id,
                                                                                  c.id,
                                                                                  ib.id,
                                                                                  it.id,
                                                                                  file,
                                                                                );
                                                                              }}
                                                                            />
                                                                          </label>
                                                                          <button
                                                                            type="button"
                                                                            className="ap-btn"
                                                                            title="Choose from the Media Library"
                                                                            onClick={async () => {
                                                                              const libPick =
                                                                                await pickFromLibrary(
                                                                                  {
                                                                                    title:
                                                                                      "Choose a card image",
                                                                                  },
                                                                                );
                                                                              if (
                                                                                libPick
                                                                              )
                                                                                await uploadColumnGridItemImage(
                                                                                  idx,
                                                                                  b.id,
                                                                                  c.id,
                                                                                  ib.id,
                                                                                  it.id,
                                                                                  libPick,
                                                                                );
                                                                            }}
                                                                          >
                                                                            Library
                                                                          </button>
                                                                        </div>
                                                                      </Field>
                                                                    </div>
                                                                  ),
                                                                )}
                                                              </div>
                                                            </div>
                                                          ) : null}

                                                          {String(
                                                            ib.type ||
                                                              "richtext",
                                                          ) === "gallery" ? (
                                                            <div className="ap-blockBody">
                                                              <div
                                                                style={{
                                                                  display:
                                                                    "grid",
                                                                  gridTemplateColumns:
                                                                    "1fr 1fr",
                                                                  gap: 10,
                                                                  alignItems:
                                                                    "end",
                                                                }}
                                                              >
                                                                <Field label="Columns">
                                                                  <select
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.cols ||
                                                                        4,
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          cols: Math.max(
                                                                            2,
                                                                            Math.min(
                                                                              8,
                                                                              Number(
                                                                                e
                                                                                  .target
                                                                                  .value,
                                                                              ) ||
                                                                                4,
                                                                            ),
                                                                          ),
                                                                        },
                                                                      )
                                                                    }
                                                                  >
                                                                    {[
                                                                      2, 3, 4,
                                                                      5, 6, 7,
                                                                      8,
                                                                    ].map(
                                                                      (n) => (
                                                                        <option
                                                                          key={
                                                                            n
                                                                          }
                                                                          value={
                                                                            n
                                                                          }
                                                                        >
                                                                          {n}
                                                                        </option>
                                                                      ),
                                                                    )}
                                                                  </select>
                                                                </Field>

                                                                <Field label="Gap (px)">
                                                                  <input
                                                                    className="ap-input"
                                                                    value={String(
                                                                      ib.gap ??
                                                                        10,
                                                                    )}
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      patchColumnBlock(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        {
                                                                          gap: Math.max(
                                                                            0,
                                                                            Number(
                                                                              e
                                                                                .target
                                                                                .value,
                                                                            ) ||
                                                                              0,
                                                                          ),
                                                                        },
                                                                      )
                                                                    }
                                                                  />
                                                                </Field>
                                                              </div>

                                                              <div
                                                                style={{
                                                                  display:
                                                                    "flex",
                                                                  gap: 10,
                                                                  flexWrap:
                                                                    "wrap",
                                                                  marginBottom: 10,
                                                                  marginTop: 10,
                                                                }}
                                                              >
                                                                <label
                                                                  className="ap-btn ap-btnPrimary"
                                                                  style={{
                                                                    cursor:
                                                                      "pointer",
                                                                  }}
                                                                >
                                                                  + Upload
                                                                  Images
                                                                  <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    multiple
                                                                    style={{
                                                                      display:
                                                                        "none",
                                                                    }}
                                                                    onChange={async (
                                                                      e,
                                                                    ) => {
                                                                      const picked =
                                                                        Array.from(
                                                                          e
                                                                            .target
                                                                            .files ||
                                                                            [],
                                                                        );
                                                                      e.target.value =
                                                                        "";
                                                                      await addColumnGalleryImages(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        picked,
                                                                      );
                                                                    }}
                                                                  />
                                                                </label>
                                                                <button
                                                                  type="button"
                                                                  className="ap-btn"
                                                                  title="Choose from the Media Library"
                                                                  onClick={async () => {
                                                                    const libPick =
                                                                      await pickFromLibrary(
                                                                        {
                                                                          multiple: true,
                                                                          title:
                                                                            "Add images to gallery",
                                                                        },
                                                                      );
                                                                    if (libPick)
                                                                      await addColumnGalleryImages(
                                                                        idx,
                                                                        b.id,
                                                                        c.id,
                                                                        ib.id,
                                                                        libPick,
                                                                      );
                                                                  }}
                                                                >
                                                                  + From library
                                                                </button>
                                                              </div>

                                                              <div
                                                                className="ap-galleryGrid"
                                                                style={{
                                                                  display:
                                                                    "grid",
                                                                  gridTemplateColumns: `repeat(${Math.max(2, Math.min(8, Number(ib.cols) || 4))}, 1fr)`,
                                                                  gap: Math.max(
                                                                    0,
                                                                    Number(
                                                                      ib.gap,
                                                                    ) || 0,
                                                                  ),
                                                                }}
                                                              >
                                                                {(Array.isArray(
                                                                  ib.images,
                                                                )
                                                                  ? ib.images
                                                                  : []
                                                                ).map(
                                                                  (im, imi) => (
                                                                    <div
                                                                      key={
                                                                        im.id
                                                                      }
                                                                      className="ap-galleryItem"
                                                                    >
                                                                      <img
                                                                        alt={
                                                                          im.alt ||
                                                                          ""
                                                                        }
                                                                        src={
                                                                          absUrl(
                                                                            im.src,
                                                                          ) ||
                                                                          im.src
                                                                        }
                                                                      />
                                                                      <div className="ap-galleryMeta">
                                                                        <div
                                                                          style={{
                                                                            display:
                                                                              "flex",
                                                                            gap: 8,
                                                                            marginBottom: 8,
                                                                            flexWrap:
                                                                              "wrap",
                                                                          }}
                                                                        >
                                                                          <button
                                                                            className="ap-btn"
                                                                            type="button"
                                                                            onClick={() =>
                                                                              moveColumnGalleryImage(
                                                                                idx,
                                                                                b.id,
                                                                                c.id,
                                                                                ib.id,
                                                                                im.id,
                                                                                -1,
                                                                              )
                                                                            }
                                                                            disabled={
                                                                              imi ===
                                                                              0
                                                                            }
                                                                            title="Move left"
                                                                            style={{
                                                                              padding:
                                                                                "6px 10px",
                                                                            }}
                                                                          >
                                                                            ←
                                                                          </button>
                                                                          <button
                                                                            className="ap-btn"
                                                                            type="button"
                                                                            onClick={() =>
                                                                              moveColumnGalleryImage(
                                                                                idx,
                                                                                b.id,
                                                                                c.id,
                                                                                ib.id,
                                                                                im.id,
                                                                                1,
                                                                              )
                                                                            }
                                                                            disabled={
                                                                              imi ===
                                                                              (Array.isArray(
                                                                                ib.images,
                                                                              )
                                                                                ? ib
                                                                                    .images
                                                                                    .length -
                                                                                  1
                                                                                : 0)
                                                                            }
                                                                            title="Move right"
                                                                            style={{
                                                                              padding:
                                                                                "6px 10px",
                                                                            }}
                                                                          >
                                                                            →
                                                                          </button>
                                                                          <input
                                                                            className="ap-input"
                                                                            type="number"
                                                                            placeholder="W"
                                                                            style={{
                                                                              width: 90,
                                                                            }}
                                                                            defaultValue={
                                                                              im.w ??
                                                                              ""
                                                                            }
                                                                            onBlur={(
                                                                              e,
                                                                            ) => {
                                                                              const v =
                                                                                e
                                                                                  .target
                                                                                  .value ===
                                                                                ""
                                                                                  ? ""
                                                                                  : Math.max(
                                                                                      0,
                                                                                      Number(
                                                                                        e
                                                                                          .target
                                                                                          .value,
                                                                                      ) ||
                                                                                        0,
                                                                                    );
                                                                              patchColumnGalleryImage(
                                                                                idx,
                                                                                b.id,
                                                                                c.id,
                                                                                ib.id,
                                                                                im.id,
                                                                                {
                                                                                  w:
                                                                                    v ===
                                                                                    ""
                                                                                      ? null
                                                                                      : v,
                                                                                },
                                                                              );
                                                                            }}
                                                                          />
                                                                          <input
                                                                            className="ap-input"
                                                                            type="number"
                                                                            placeholder="H"
                                                                            style={{
                                                                              width: 90,
                                                                            }}
                                                                            defaultValue={
                                                                              im.h ??
                                                                              ""
                                                                            }
                                                                            onBlur={(
                                                                              e,
                                                                            ) => {
                                                                              const v =
                                                                                e
                                                                                  .target
                                                                                  .value ===
                                                                                ""
                                                                                  ? ""
                                                                                  : Math.max(
                                                                                      0,
                                                                                      Number(
                                                                                        e
                                                                                          .target
                                                                                          .value,
                                                                                      ) ||
                                                                                        0,
                                                                                    );
                                                                              patchColumnGalleryImage(
                                                                                idx,
                                                                                b.id,
                                                                                c.id,
                                                                                ib.id,
                                                                                im.id,
                                                                                {
                                                                                  h:
                                                                                    v ===
                                                                                    ""
                                                                                      ? null
                                                                                      : v,
                                                                                },
                                                                              );
                                                                            }}
                                                                          />
                                                                        </div>

                                                                        <input
                                                                          className="ap-input"
                                                                          value={String(
                                                                            im.alt ||
                                                                              "",
                                                                          )}
                                                                          onChange={(
                                                                            e,
                                                                          ) =>
                                                                            patchColumnGalleryImage(
                                                                              idx,
                                                                              b.id,
                                                                              c.id,
                                                                              ib.id,
                                                                              im.id,
                                                                              {
                                                                                alt: e
                                                                                  .target
                                                                                  .value,
                                                                              },
                                                                            )
                                                                          }
                                                                          placeholder="Alt text (optional)"
                                                                        />
                                                                        <button
                                                                          className="ap-btn ap-btnDanger"
                                                                          type="button"
                                                                          style={{
                                                                            padding:
                                                                              "6px 10px",
                                                                          }}
                                                                          onClick={() =>
                                                                            deleteColumnGalleryImage(
                                                                              idx,
                                                                              b.id,
                                                                              c.id,
                                                                              ib.id,
                                                                              im.id,
                                                                            )
                                                                          }
                                                                        >
                                                                          ✕
                                                                        </button>
                                                                      </div>
                                                                    </div>
                                                                  ),
                                                                )}
                                                              </div>
                                                            </div>
                                                          ) : null}
                                                        </div>
                                                      ),
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") ===
                                "home_hero" ? (
                                  <div className="ap-blockBody">
                                    <Field label="Kicker">
                                      <input
                                        className="ap-input"
                                        value={String(b.kicker || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            kicker: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label="Headline (H1)">
                                      <input
                                        className="ap-input"
                                        value={String(b.title || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            title: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label="Subtext">
                                      <textarea
                                        className="ap-textarea"
                                        rows={3}
                                        value={String(b.sub || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            sub: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>

                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 10,
                                      }}
                                    >
                                      <Field label="CTA Text">
                                        <input
                                          className="ap-input"
                                          value={String(b.cta_text || "")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              cta_text: e.target.value,
                                            })
                                          }
                                        />
                                      </Field>
                                      <Field label="CTA Link">
                                        <input
                                          className="ap-input"
                                          value={String(b.cta_href || "")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              cta_href: e.target.value,
                                            })
                                          }
                                        />
                                      </Field>
                                    </div>

                                    <Field
                                      label="Hero Background"
                                      help="Paste an image URL or upload a file."
                                    >
                                      <input
                                        className="ap-input"
                                        value={String(b.background_url || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            background_url: e.target.value,
                                          })
                                        }
                                      />
                                      <div style={{ marginTop: 8 }}>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={async (e) => {
                                            const f = e.target.files?.[0];
                                            if (!f) return;
                                            try {
                                              const url = await uploadImage(
                                                f,
                                                "hero",
                                              );
                                              patchBlock(idx, b.id, {
                                                background_url: url,
                                              });
                                            } catch (_) {}
                                            e.target.value = "";
                                          }}
                                        />
                                        <button
                                          type="button"
                                          className="ap-btn"
                                          style={{ marginLeft: 8 }}
                                          title="Choose from the Media Library"
                                          onClick={async () => {
                                            const libPick =
                                              await pickFromLibrary({
                                                title:
                                                  "Choose a hero background",
                                              });
                                            if (libPick)
                                              patchBlock(idx, b.id, {
                                                background_url: libPick.url,
                                              });
                                          }}
                                        >
                                          Choose from library
                                        </button>
                                      </div>
                                    </Field>
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") ===
                                "home_join" ? (
                                  <div className="ap-blockBody">
                                    <Field label="Eyebrow">
                                      <input
                                        className="ap-input"
                                        value={String(b.eyebrow || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            eyebrow: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label="Title">
                                      <input
                                        className="ap-input"
                                        value={String(b.title || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            title: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label="Subtext">
                                      <textarea
                                        className="ap-textarea"
                                        rows={3}
                                        value={String(b.sub || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            sub: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>

                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 10,
                                      }}
                                    >
                                      <Field label="CTA Text">
                                        <input
                                          className="ap-input"
                                          value={String(b.cta_text || "")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              cta_text: e.target.value,
                                            })
                                          }
                                        />
                                      </Field>
                                      <Field label="CTA Link">
                                        <input
                                          className="ap-input"
                                          value={String(b.cta_href || "")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              cta_href: e.target.value,
                                            })
                                          }
                                        />
                                      </Field>
                                    </div>
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") === "home_cta" ? (
                                  <div className="ap-blockBody">
                                    <Field label="Title">
                                      <input
                                        className="ap-input"
                                        value={String(b.title || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            title: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label="Subtext">
                                      <textarea
                                        className="ap-textarea"
                                        rows={3}
                                        value={String(b.sub || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            sub: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>

                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 10,
                                      }}
                                    >
                                      <Field label="CTA Text">
                                        <input
                                          className="ap-input"
                                          value={String(b.cta_text || "")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              cta_text: e.target.value,
                                            })
                                          }
                                        />
                                      </Field>
                                      <Field label="CTA Link">
                                        <input
                                          className="ap-input"
                                          value={String(b.cta_href || "")}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              cta_href: e.target.value,
                                            })
                                          }
                                        />
                                      </Field>
                                    </div>
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") ===
                                "home_about" ? (
                                  <div className="ap-blockBody">
                                    <Field label="Name">
                                      <input
                                        className="ap-input"
                                        value={String(b.name || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            name: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label="Bio Text">
                                      <textarea
                                        className="ap-textarea"
                                        rows={4}
                                        value={String(b.text || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            text: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label="Avatar URL (optional)">
                                      <input
                                        className="ap-input"
                                        value={String(b.avatar_url || "")}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            avatar_url: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") ===
                                "latest_teaching" ? (
                                  <div className="ap-blockBody">
                                    <div
                                      className="ap-help"
                                      style={{ marginBottom: 10 }}
                                    >
                                      This renders the “Latest Teaching” section
                                      on Home.
                                    </div>
                                    <label
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={b.show !== false}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            show: e.target.checked,
                                          })
                                        }
                                      />
                                      <span>Show this section</span>
                                    </label>
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") ===
                                "featured_live" ? (
                                  <div className="ap-blockBody">
                                    <div
                                      className="ap-help"
                                      style={{ marginBottom: 10 }}
                                    >
                                      This renders the Live Stream highlight +
                                      countdown area on Home.
                                    </div>
                                    <label
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={b.show !== false}
                                        onChange={(e) =>
                                          patchBlock(idx, b.id, {
                                            show: e.target.checked,
                                          })
                                        }
                                      />
                                      <span>Show this section</span>
                                    </label>
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") === "grid" ? (
                                  <div className="ap-blockBody">
                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 10,
                                        alignItems: "end",
                                      }}
                                    >
                                      <Field label="Columns">
                                        <select
                                          className="ap-input"
                                          value={String(b.cols || 3)}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              cols: Math.max(
                                                2,
                                                Math.min(
                                                  6,
                                                  Number(e.target.value) || 3,
                                                ),
                                              ),
                                            })
                                          }
                                        >
                                          {[2, 3, 4, 5, 6].map((n) => (
                                            <option key={n} value={n}>
                                              {n}
                                            </option>
                                          ))}
                                        </select>
                                      </Field>

                                      <Field label="Gap (px)">
                                        <input
                                          className="ap-input"
                                          value={String(b.gap ?? 12)}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              gap: Math.max(
                                                0,
                                                Number(e.target.value) || 0,
                                              ),
                                            })
                                          }
                                        />
                                      </Field>
                                    </div>

                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 10,
                                        flexWrap: "wrap",
                                        marginBottom: 10,
                                      }}
                                    >
                                      <button
                                        className="ap-btn"
                                        type="button"
                                        onClick={() => addGridItem(idx, b.id)}
                                      >
                                        + Add Card
                                      </button>
                                    </div>

                                    <div className="ap-gridCards">
                                      {(Array.isArray(b.items)
                                        ? b.items
                                        : []
                                      ).map((it) => (
                                        <div
                                          key={it.id}
                                          className="ap-gridCard"
                                        >
                                          <div className="ap-gridCardTop">
                                            <div style={{ fontWeight: 900 }}>
                                              Card
                                            </div>
                                            <button
                                              className="ap-btn ap-btnDanger"
                                              type="button"
                                              style={{ padding: "6px 10px" }}
                                              onClick={() =>
                                                deleteGridItem(idx, b.id, it.id)
                                              }
                                            >
                                              Delete
                                            </button>
                                          </div>

                                          <Field label="Title">
                                            <input
                                              className="ap-input"
                                              value={String(it.title || "")}
                                              onChange={(e) =>
                                                patchGridItem(
                                                  idx,
                                                  b.id,
                                                  it.id,
                                                  { title: e.target.value },
                                                )
                                              }
                                            />
                                          </Field>

                                          <Field label="Text">
                                            <textarea
                                              className="ap-textarea"
                                              rows={3}
                                              value={String(it.text || "")}
                                              onChange={(e) =>
                                                patchGridItem(
                                                  idx,
                                                  b.id,
                                                  it.id,
                                                  { text: e.target.value },
                                                )
                                              }
                                            />
                                          </Field>

                                          <Field label="Image (optional)">
                                            <div
                                              style={{
                                                display: "flex",
                                                gap: 10,
                                                alignItems: "center",
                                                flexWrap: "wrap",
                                              }}
                                            >
                                              <input
                                                className="ap-input"
                                                value={String(
                                                  it.image_url || "",
                                                )}
                                                onChange={(e) =>
                                                  patchGridItem(
                                                    idx,
                                                    b.id,
                                                    it.id,
                                                    {
                                                      image_url: e.target.value,
                                                    },
                                                  )
                                                }
                                                placeholder="https://..."
                                              />
                                              <label
                                                className="ap-btn"
                                                style={{ cursor: "pointer" }}
                                              >
                                                Upload
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  style={{ display: "none" }}
                                                  onChange={async (e) => {
                                                    const file =
                                                      e.target.files?.[0];
                                                    e.target.value = "";
                                                    await uploadGridItemImage(
                                                      idx,
                                                      b.id,
                                                      it.id,
                                                      file,
                                                    );
                                                  }}
                                                />
                                              </label>
                                              <button
                                                type="button"
                                                className="ap-btn"
                                                title="Choose from the Media Library"
                                                onClick={async () => {
                                                  const libPick =
                                                    await pickFromLibrary({
                                                      title:
                                                        "Choose a card image",
                                                    });
                                                  if (libPick)
                                                    await uploadGridItemImage(
                                                      idx,
                                                      b.id,
                                                      it.id,
                                                      libPick,
                                                    );
                                                }}
                                              >
                                                Library
                                              </button>
                                            </div>

                                            {String(
                                              it.image_url || "",
                                            ).trim() ? (
                                              <div className="ap-imgMini">
                                                <img
                                                  alt=""
                                                  src={
                                                    absUrl(it.image_url) ||
                                                    it.image_url
                                                  }
                                                />
                                              </div>
                                            ) : null}
                                          </Field>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                {String(b.type || "richtext") === "gallery" ? (
                                  <div className="ap-blockBody">
                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 10,
                                        alignItems: "end",
                                      }}
                                    >
                                      <Field label="Columns">
                                        <select
                                          className="ap-input"
                                          value={String(b.cols || 4)}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              cols: Math.max(
                                                2,
                                                Math.min(
                                                  8,
                                                  Number(e.target.value) || 4,
                                                ),
                                              ),
                                            })
                                          }
                                        >
                                          {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                                            <option key={n} value={n}>
                                              {n}
                                            </option>
                                          ))}
                                        </select>
                                      </Field>

                                      <Field label="Gap (px)">
                                        <input
                                          className="ap-input"
                                          value={String(b.gap ?? 10)}
                                          onChange={(e) =>
                                            patchBlock(idx, b.id, {
                                              gap: Math.max(
                                                0,
                                                Number(e.target.value) || 0,
                                              ),
                                            })
                                          }
                                        />
                                      </Field>
                                    </div>

                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 10,
                                        flexWrap: "wrap",
                                        marginBottom: 10,
                                      }}
                                    >
                                      <label
                                        className="ap-btn ap-btnPrimary"
                                        style={{ cursor: "pointer" }}
                                      >
                                        + Upload Images
                                        <input
                                          type="file"
                                          accept="image/*"
                                          multiple
                                          style={{ display: "none" }}
                                          onChange={async (e) => {
                                            const picked = Array.from(
                                              e.target.files || [],
                                            );
                                            e.target.value = "";
                                            await addGalleryImages(
                                              idx,
                                              b.id,
                                              picked,
                                            );
                                          }}
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        className="ap-btn"
                                        title="Choose from the Media Library"
                                        onClick={async () => {
                                          const libPick = await pickFromLibrary(
                                            {
                                              multiple: true,
                                              title: "Add images to gallery",
                                            },
                                          );
                                          if (libPick)
                                            await addGalleryImages(
                                              idx,
                                              b.id,
                                              libPick,
                                            );
                                        }}
                                      >
                                        + From library
                                      </button>
                                    </div>

                                    <div
                                      className="ap-galleryGrid"
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: `repeat(${Math.max(
                                          2,
                                          Math.min(8, Number(b.cols) || 4),
                                        )}, 1fr)`,
                                        gap: Math.max(0, Number(b.gap) || 0),
                                      }}
                                    >
                                      {(Array.isArray(b.images)
                                        ? b.images
                                        : []
                                      ).map((im, imi) => (
                                        <div
                                          key={im.id}
                                          className="ap-galleryItem"
                                        >
                                          <img
                                            alt={im.alt || ""}
                                            src={absUrl(im.src) || im.src}
                                          />
                                          <div className="ap-galleryMeta">
                                            <div
                                              style={{
                                                display: "flex",
                                                gap: 8,
                                                marginBottom: 8,
                                                flexWrap: "wrap",
                                              }}
                                            >
                                              <button
                                                className="ap-btn"
                                                type="button"
                                                onClick={() =>
                                                  moveGalleryImage(
                                                    idx,
                                                    b.id,
                                                    im.id,
                                                    -1,
                                                  )
                                                }
                                                disabled={imi === 0}
                                                title="Move left"
                                                style={{ padding: "6px 10px" }}
                                              >
                                                ←
                                              </button>
                                              <button
                                                className="ap-btn"
                                                type="button"
                                                onClick={() =>
                                                  moveGalleryImage(
                                                    idx,
                                                    b.id,
                                                    im.id,
                                                    1,
                                                  )
                                                }
                                                disabled={
                                                  imi ===
                                                  (Array.isArray(b.images)
                                                    ? b.images.length - 1
                                                    : 0)
                                                }
                                                title="Move right"
                                                style={{ padding: "6px 10px" }}
                                              >
                                                →
                                              </button>
                                            </div>
                                            <input
                                              className="ap-input"
                                              value={String(im.alt || "")}
                                              onChange={(e) =>
                                                patchGalleryImage(
                                                  idx,
                                                  b.id,
                                                  im.id,
                                                  { alt: e.target.value },
                                                )
                                              }
                                              placeholder="Alt text (optional)"
                                            />
                                            <button
                                              className="ap-btn ap-btnDanger"
                                              type="button"
                                              style={{ padding: "6px 10px" }}
                                              onClick={() =>
                                                deleteGalleryImage(
                                                  idx,
                                                  b.id,
                                                  im.id,
                                                )
                                              }
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ✅ FIXED: legacy editor JSX (this is the error you posted) */}
                      {!hasBlocks ? (
                        String(sec.layout || "card") === "two_columns" ? (
                          <>
                            <Field label="Left Column">
                              <div className="ap-editorWrap">
                                <ModernPageEditor
                                  value={sec.left_html || sec.html || ""}
                                  onChangeHtml={(html) =>
                                    updateExtraSection(idx, { left_html: html })
                                  }
                                  onChange={(html) =>
                                    updateExtraSection(idx, { left_html: html })
                                  }
                                  onUploadImage={async (file) =>
                                    uploadImage(file, "inline")
                                  }
                                />
                              </div>
                            </Field>

                            <Field label="Right Column">
                              <div className="ap-editorWrap">
                                <ModernPageEditor
                                  value={sec.right_html || ""}
                                  onChangeHtml={(html) =>
                                    updateExtraSection(idx, {
                                      right_html: html,
                                    })
                                  }
                                  onChange={(html) =>
                                    updateExtraSection(idx, {
                                      right_html: html,
                                    })
                                  }
                                  onUploadImage={async (file) =>
                                    uploadImage(file, "inline")
                                  }
                                />
                              </div>
                            </Field>
                          </>
                        ) : (
                          <Field label="Section Content">
                            <div className="ap-editorWrap">
                              <ModernPageEditor
                                value={sec.html || ""}
                                onChangeHtml={(html) =>
                                  updateExtraSection(idx, { html })
                                }
                                onChange={(html) =>
                                  updateExtraSection(idx, { html })
                                }
                                onUploadImage={async (file) =>
                                  uploadImage(file, "inline")
                                }
                              />
                            </div>
                          </Field>
                        )
                      ) : null}

                      {!hasBlocks ? (
                        <div
                          style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                        >
                          <label
                            className="ap-btn"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              cursor: "pointer",
                            }}
                            title="Upload an image and auto-insert into this section"
                          >
                            + Insert Image
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                await insertImageIntoSection(idx, file);
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="ap-btn"
                            title="Choose from the Media Library"
                            onClick={async () => {
                              const libPick = await pickFromLibrary({
                                title: "Insert an image",
                              });
                              if (libPick)
                                await insertImageIntoSection(idx, libPick);
                            }}
                          >
                            + From library
                          </button>

                          <button
                            className="ap-btn"
                            type="button"
                            onClick={() => {
                              const isTwo =
                                String(sec.layout || "card") === "two_columns";
                              updateExtraSection(
                                idx,
                                isTwo
                                  ? { html: "", left_html: "", right_html: "" }
                                  : { html: "" },
                              );
                            }}
                          >
                            Clear Content
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              );
            })
          )}
        </SectionCard>
      </div>
    );
  }

  /* -----------------------------
     Sticky Save Bar (responsive)
  ----------------------------- */

  /* -----------------------------
     UI states
  ----------------------------- */
  if (loading) {
    return (
      <div className="ap-root">
        <ToastHost items={toasts} onDismiss={dismissToast} />
        <div className="ap-card">
          <div className="ap-loading">Loading…</div>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="ap-root">
        <ToastHost items={toasts} onDismiss={dismissToast} />
        <div className="ap-card">
          <div className="ap-empty">Page not found.</div>
        </div>
      </div>
    );
  }

  const previewUrl = appUrl(`/admin/pages/${id}/preview`);
  // Phase 6: the title visitors see when "Search title" is blank. The public
  // Home page shows just the site name; other pages show "Title | Site name".
  const seoDefaultTitle =
    templateType === "home" || String(slug || "").toLowerCase() === "home"
      ? SITE.name
      : `${title || "Page title"} | ${SITE.name}`;
  previewUrlRef.current = previewUrl;

  return (
    <MediaPickerContext.Provider value={pickFromLibrary}>
      <div
        className={`ap-root ap-editorPage${visualOnly ? " ap-visualOnly" : ""}`}
      >
        <ToastHost items={toasts} onDismiss={dismissToast} />
        <MediaPickerModal
          open={!!mediaPicker}
          multiple={!!mediaPicker?.multiple}
          title={mediaPicker?.title}
          onCancel={() => closeMediaPicker(null)}
          onConfirm={(result) => closeMediaPicker(result)}
        />
        <BusyOverlay
          show={loading || saving || uploading}
          label={
            loading
              ? "Loading editor…"
              : uploading
                ? uploadLabel
                : "Saving changes…"
          }
        />
        {renderSaveSectionDialog()}
        {renderLeavePrompt()}
        {renderHistory()}
        {renderScheduleDialog()}
        {renderEditSavedDialog()}
        {renderTemplatePreview()}
        <ConfirmModal
          open={!!confirm.open}
          title={confirm.title}
          message={confirm.message}
          confirmText={confirm.confirmText}
          danger={confirm.danger}
          onClose={closeConfirm}
          onConfirm={confirm.onConfirm}
        />

        <StylePopup
          open={!!styleModal.open}
          section={styleSection}
          titleTagOptions={TITLE_TAG_OPTIONS}
          onClose={closeStyleModal}
          onPatch={(patch) => {
            const idx = Number(styleModal.idx);
            if (Number.isNaN(idx) || idx < 0) return;
            updateExtraSection(idx, patch);
          }}
          onUploadBackground={async (file) => {
            const idx = Number(styleModal.idx);
            if (Number.isNaN(idx) || idx < 0) return;
            await uploadSectionBackground(idx, file);
          }}
        />

        {renderRecoveryBanner()}

        <div
          className="ap-gbToolbar"
          role="toolbar"
          aria-label="Page editor controls"
        >
          <div className="ap-gbToolbarGroup">
            <button
              className="ap-gbIcon"
              type="button"
              title="Back to pages"
              onClick={() => requestLeave("/admin/pages")}
            >
              ←
            </button>
            <button
              className={`ap-gbIcon ${inserterOpen ? "is-active" : ""}`}
              type="button"
              title="Toggle block library"
              aria-pressed={inserterOpen}
              onClick={() => setInserterOpen((v) => !v)}
            >
              ＋
            </button>
            <button
              className="ap-gbIcon"
              type="button"
              title="Undo"
              onClick={undo}
              disabled={saving || !canUndo}
            >
              ↶
            </button>
            <button
              className="ap-gbIcon"
              type="button"
              title="Redo"
              onClick={redo}
              disabled={saving || !canRedo}
            >
              ↷
            </button>
          </div>
          <div className="ap-gbToolbarTitle">
            <strong>{title || "Untitled page"}</strong>
            <small aria-live="polite">
              {saving
                ? "Saving…"
                : dirty
                  ? "Unsaved changes"
                  : `All changes saved · ${status === "published" ? "Published" : "Draft"}`}
              {scheduledLabel && !saving
                ? ` · Publishes ${scheduledLabel}`
                : ""}
            </small>
          </div>
          {visualOnly ? (
            <div className="ap-veDevices" role="group" aria-label="Screen size">
              {[
                ["desktop", "Desktop"],
                ["tablet", "Tablet"],
                ["mobile", "Mobile"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={previewDevice === key ? "is-active" : ""}
                  aria-pressed={previewDevice === key}
                  onClick={() => setPreviewDevice(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="ap-gbToolbarGroup ap-gbToolbarRight">
            {visualOnly ? (
              <button
                type="button"
                className="ap-btn"
                onClick={() => requestLeave(`/admin/pages/${id}`)}
                title="Switch to the classic editor"
              >
                List view
              </button>
            ) : null}
            <button
              className={`ap-btn ${scheduledLabel ? "ap-btnScheduled" : ""}`}
              type="button"
              onClick={openSchedule}
              title={
                scheduledLabel
                  ? `Scheduled to publish ${scheduledLabel}. Click to change or cancel.`
                  : "Publish this page automatically at a date and time"
              }
            >
              {scheduledLabel ? "Scheduled" : "Schedule"}
            </button>
            <button
              className="ap-btn"
              type="button"
              onClick={openHistory}
              title="See earlier versions of this page and restore one"
            >
              History
            </button>
            <button
              className="ap-btn"
              type="button"
              onClick={openPreview}
              disabled={saving}
              title={
                dirty
                  ? "Saves your draft, then opens the preview"
                  : "Opens the saved draft in a new tab"
              }
            >
              Preview
            </button>
            <button
              className="ap-btn"
              type="button"
              onClick={saveDraft}
              disabled={saving || !dirty}
            >
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button
              className="ap-btn ap-btnPrimary"
              type="button"
              disabled={saving}
              onClick={() =>
                openConfirm({
                  title:
                    status === "published"
                      ? "Publish changes?"
                      : "Publish page?",
                  message:
                    status === "published"
                      ? "Replace the live page with your saved draft?"
                      : "Make the latest saved draft live on the website?",
                  confirmText:
                    status === "published" ? "Publish Changes" : "Publish",
                  onConfirm: async () => {
                    closeConfirm();
                    await doPublish();
                  },
                })
              }
            >
              {status === "published" ? "Publish Changes" : "Publish"}
            </button>
            <button
              className={`ap-gbIcon ${inspectorOpen ? "is-active" : ""}`}
              type="button"
              title="Toggle page settings"
              aria-label="Toggle page settings"
              aria-pressed={inspectorOpen}
              onClick={() => setInspectorOpen((v) => !v)}
            >
              ⚙
            </button>
          </div>
        </div>
        <div className="ap-gbStatusLine">
          <span className={`ap-badge ${status === "published" ? "ok" : ""}`}>
            {status}
          </span>
          <span>Page editor</span>
          <span>Ctrl/Cmd + S to save</span>
        </div>
        <div
          className="ap-phase3DeviceBar"
          role="group"
          aria-label="Editor canvas width"
        >
          <span>Canvas</span>
          {[
            ["desktop", "Desktop"],
            ["tablet", "Tablet"],
            ["mobile", "Mobile"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`ap-phase3Device ${previewDevice === key ? "is-active" : ""}`}
              aria-pressed={previewDevice === key}
              onClick={() => setPreviewDevice(key)}
            >
              {label}
            </button>
          ))}
          <small>
            Canvas width only. Use Preview to check the rendered website.
          </small>
        </div>
        <div
          className={`ap-editorStack ap-gbWorkspace ap-phase4gaWorkspace ${inspectorOpen ? "" : "ap-gbNoInspector"} ${inserterOpen ? "ap-phase3WithLibrary" : ""}`}
          style={{ "--ap-inspector-width": `${inspectorWidth}px` }}
        >
          {inserterOpen && (
            <aside className="ap-phase3Library" aria-label="Block library">
              <div className="ap-phase3LibraryTop">
                <strong>Block library</strong>
                <button
                  type="button"
                  className="ap-gbIcon"
                  aria-label="Close block library"
                  onClick={() => setInserterOpen(false)}
                >
                  ×
                </button>
              </div>
              <p>
                Add blocks to an existing section, or create a new section
                first.
              </p>
              <label htmlFor="ap-block-search">Search blocks</label>
              <input
                id="ap-block-search"
                className="ap-input"
                placeholder="Search blocks…"
                value={blockSearch}
                onChange={(e) => setBlockSearch(e.target.value)}
              />
              <label htmlFor="ap-block-target">Insert into section</label>
              <select
                id="ap-block-target"
                className="ap-input"
                value={targetSection}
                onChange={(e) => setTargetSection(e.target.value)}
              >
                <option value="">Choose a section…</option>
                {(Array.isArray(contentJson?.extra_sections)
                  ? contentJson.extra_sections
                  : []
                ).map((section, index) => (
                  <option key={section.id || index} value={String(index)}>
                    {index + 1}. {section.title || "Untitled section"}
                  </option>
                ))}
              </select>
              <button
                className="ap-btn ap-phase3NewSection"
                type="button"
                onClick={() => {
                  addExtraSection();
                  setActiveTab("builder");
                }}
              >
                + New section
              </button>
              <div className="ap-phase3BlockGrid">
                {[
                  { type: "richtext", label: "Text", glyph: "¶" },
                  { type: "gallery", label: "Gallery", glyph: "▦" },
                  { type: "grid", label: "Cards / Grid", glyph: "⊞" },
                  { type: "columns", label: "Columns", glyph: "▥" },
                  { type: "button", label: "Button", glyph: "▣" },
                  ...EXTRA_PALETTE, // Phase 5
                ]
                  .filter((item) =>
                    item.label
                      .toLowerCase()
                      .includes(blockSearch.trim().toLowerCase()),
                  )
                  .map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      className="ap-phase3Block"
                      disabled={targetSection === ""}
                      title={
                        targetSection === ""
                          ? "Select a section first"
                          : `Add ${item.label}`
                      }
                      onClick={() => {
                        addBlock(Number(targetSection), item.type);
                        setActiveTab("builder");
                      }}
                    >
                      <span aria-hidden="true">{item.glyph}</span>
                      <strong>{item.label}</strong>
                    </button>
                  ))}
              </div>
              {targetSection === "" && (
                <div className="ap-help">
                  Choose a section to enable blocks. Gallery and image controls
                  are available inside the added block.
                </div>
              )}
              <div className="ap-phase3LibraryFooter">
                <button
                  type="button"
                  className="ap-btn"
                  onClick={() => {
                    setActiveTab("builder");
                    setInserterOpen(false);
                  }}
                >
                  Visual Builder
                </button>
                <button
                  type="button"
                  className="ap-btn"
                  onClick={() => {
                    setActiveTab("rich");
                    setInserterOpen(false);
                  }}
                >
                  Rich Text
                </button>
              </div>
            </aside>
          )}
          {inspectorOpen && (
            <div className="ap-side ap-gbInspector">
              <div className="ap-phase4gaInspectorControls">
                <label htmlFor="ap-phase4ga-width">Inspector width</label>
                <input
                  id="ap-phase4ga-width"
                  type="range"
                  min="300"
                  max="520"
                  step="10"
                  value={inspectorWidth}
                  onChange={(e) => setInspectorWidth(Number(e.target.value))}
                  aria-label="Inspector width"
                />
                <span>{inspectorWidth}px</span>
                <button
                  type="button"
                  className="ap-btn"
                  onClick={() => setInspectorOpen(false)}
                  aria-label="Collapse inspector"
                  title="Collapse inspector"
                >
                  Hide
                </button>
              </div>
              <div className="ap-card ap-sideCard">
                <div className="ap-settingsHead">
                  <div>
                    <span className="ap-eyebrow">SETTINGS</span>
                    <h2>Inspector</h2>
                    <p>
                      Page details, the selected section, and the selected
                      block.
                    </p>
                  </div>
                  <span className="ap-settingsIcon" aria-hidden="true">
                    ⚙
                  </span>
                </div>
                <div
                  className="ap-phase3InspectorTabs"
                  role="tablist"
                  aria-label="Editor settings"
                >
                  {visualOnly ? (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={inspectorTab === "elements"}
                      className={inspectorTab === "elements" ? "is-active" : ""}
                      onClick={() => setInspectorTab("elements")}
                    >
                      ＋ Elements
                    </button>
                  ) : null}
                  {visualOnly ? (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={inspectorTab === "layers"}
                      className={inspectorTab === "layers" ? "is-active" : ""}
                      onClick={() => setInspectorTab("layers")}
                    >
                      Layers
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inspectorTab === "page"}
                    className={inspectorTab === "page" ? "is-active" : ""}
                    onClick={() => setInspectorTab("page")}
                  >
                    Page
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inspectorTab === "section"}
                    className={inspectorTab === "section" ? "is-active" : ""}
                    onClick={() => setInspectorTab("section")}
                  >
                    Section
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inspectorTab === "block"}
                    className={inspectorTab === "block" ? "is-active" : ""}
                    onClick={() => setInspectorTab("block")}
                  >
                    {visualOnly ? "Element" : "Block"}
                  </button>
                </div>
                {renderInspectorBreadcrumb()}
                {inspectorTab === "elements" ? (
                  <>
                    <div
                      className="dc-seg ap-elViewSwitch"
                      role="tablist"
                      aria-label="Add"
                    >
                      {[
                        ["elements", "Elements"],
                        ["templates", "Templates"],
                      ].map(([k, l]) => (
                        <button
                          key={k}
                          type="button"
                          role="tab"
                          aria-selected={elementsView === k}
                          className={elementsView === k ? "is-on" : ""}
                          onClick={() => setElementsView(k)}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    {elementsView === "templates"
                      ? renderTemplatesPanel()
                      : renderElementsPanel()}
                  </>
                ) : inspectorTab === "layers" ? (
                  renderNavigator()
                ) : inspectorTab === "section" || inspectorTab === "block" ? (
                  <div
                    className={`ap-phase3InspectorHelp ap-phase4Inspector ap-inspectorMode--${inspectorTab}`}
                  >
                    <h3>{inspectorTab === "section" ? "Section" : "Block"}</h3>
                    <p>
                      {visualOnly
                        ? inspectorTab === "section"
                          ? "Click any section on the page to edit it here."
                          : "Click anything on the page to edit it here."
                        : inspectorTab === "section"
                          ? "Choose a section, then change its title, layout and theme."
                          : "Choose a block below, or click it on the page."}
                    </p>
                    <label htmlFor="ap-phase4-section">Selected section</label>
                    <select
                      id="ap-phase4-section"
                      className="ap-input"
                      value={selectedSectionIndex}
                      onChange={(e) => {
                        setSelectedSectionIndex(e.target.value);
                        setSelectedBlockId("");
                      }}
                    >
                      <option value="">Choose a section…</option>
                      {(Array.isArray(contentJson?.extra_sections)
                        ? contentJson.extra_sections
                        : []
                      ).map((section, index) => (
                        <option key={section.id || index} value={String(index)}>
                          {index + 1}. {section.title || "Untitled section"}
                        </option>
                      ))}
                    </select>
                    {selectedSectionIndex !== "" &&
                    contentJson?.extra_sections?.[
                      Number(selectedSectionIndex)
                    ] ? (
                      <div
                        className="ap-phase4SectionControls"
                        data-section-pane={sectionPane}
                        data-device={
                          inspectorTab === "section" && deviceEditing
                            ? deviceEditing
                            : "desktop"
                        }
                      >
                        {inspectorTab === "section" &&
                        visualOnly &&
                        !isCoreSec(
                          contentJson.extra_sections[
                            Number(selectedSectionIndex)
                          ],
                        ) ? (
                          <SaveTemplateBox
                            label="Save section as template"
                            onSave={(n) => saveTemplate("section", n)}
                          />
                        ) : null}
                        {inspectorTab === "section" ? (
                          <div
                            className="ap-elTabs"
                            role="tablist"
                            aria-label="Section settings"
                          >
                            {[
                              ["layout", "Layout", "▤"],
                              ["style", "Style", "◐"],
                              ["advanced", "Advanced", "⚙"],
                            ].map(([k, label, icon]) => (
                              <button
                                key={k}
                                type="button"
                                role="tab"
                                aria-selected={sectionPane === k}
                                className={sectionPane === k ? "is-active" : ""}
                                onClick={() => setSectionPane(k)}
                              >
                                <span aria-hidden="true">{icon}</span>
                                {label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <label htmlFor="ap-phase4-title" data-pane="layout">
                          Section title
                        </label>
                        <input
                          data-pane="layout"
                          id="ap-phase4-title"
                          className="ap-input"
                          value={
                            contentJson.extra_sections[
                              Number(selectedSectionIndex)
                            ].title || ""
                          }
                          onChange={(e) =>
                            updateExtraSection(Number(selectedSectionIndex), {
                              title: e.target.value,
                            })
                          }
                        />
                        <label data-pane="layout" htmlFor="ap-phase4-layout">
                          Layout
                        </label>
                        <select
                          data-pane="layout"
                          id="ap-phase4-layout"
                          className="ap-input"
                          value={
                            contentJson.extra_sections[
                              Number(selectedSectionIndex)
                            ].layout || "card"
                          }
                          onChange={(e) =>
                            updateExtraSection(Number(selectedSectionIndex), {
                              layout: e.target.value,
                            })
                          }
                        >
                          {SECTION_LAYOUT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <label data-pane="layout" htmlFor="ap-phase4-theme">
                          Theme
                        </label>
                        <select
                          data-pane="layout"
                          id="ap-phase4-theme"
                          className="ap-input"
                          value={
                            contentJson.extra_sections[
                              Number(selectedSectionIndex)
                            ].theme || "default"
                          }
                          onChange={(e) =>
                            updateExtraSection(Number(selectedSectionIndex), {
                              theme: e.target.value,
                            })
                          }
                        >
                          {SECTION_THEME_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {/* Visual editor (Stage 3): live design controls */}
                        {(() => {
                          const idx = Number(selectedSectionIndex);
                          const cur = (contentJson?.extra_sections || [])[idx];
                          if (!cur) return null;
                          // Only the settings changed here are saved. (Filling in the
                          // editor's defaults could change how an older section looks,
                          // e.g. its alignment.)
                          const base = isObj(cur.styles) ? cur.styles : {};
                          return (
                            <>
                              {deviceEditing ? (
                                <DeviceBanner
                                  device={deviceEditing}
                                  section
                                  hasOverrides={
                                    isObj(base[deviceEditing]) &&
                                    Object.keys(base[deviceEditing]).length > 0
                                  }
                                  onReset={() =>
                                    updateExtraSection(idx, {
                                      styles: { ...base, [deviceEditing]: {} },
                                    })
                                  }
                                />
                              ) : null}
                              <SectionDesign
                                styles={
                                  deviceEditing
                                    ? deviceView(base, deviceEditing)
                                    : base
                                }
                                layout={String(cur.layout || "card")}
                                onPatchStyles={(patch) =>
                                  deviceEditing
                                    ? updateExtraSection(idx, {
                                        styles: {
                                          ...base,
                                          [deviceEditing]: {
                                            ...(isObj(base[deviceEditing])
                                              ? base[deviceEditing]
                                              : {}),
                                            // only spacing varies per device for sections
                                            ...Object.fromEntries(
                                              Object.entries(patch).filter(
                                                ([k]) =>
                                                  k === "padding" ||
                                                  k === "margin",
                                              ),
                                            ),
                                          },
                                        },
                                      })
                                    : updateExtraSection(idx, {
                                        styles: { ...base, ...patch },
                                      })
                                }
                              />
                              <div data-pane="advanced">
                                <ResponsiveVisibility
                                  styles={base}
                                  onPatchStyles={(patch) =>
                                    updateExtraSection(idx, {
                                      styles: { ...base, ...patch },
                                    })
                                  }
                                />
                                <CssAttributes
                                  styles={base}
                                  onPatchStyles={(patch) =>
                                    updateExtraSection(idx, {
                                      styles: { ...base, ...patch },
                                    })
                                  }
                                />
                              </div>
                            </>
                          );
                        })()}
                        <div className="ap-phase4BlockInspector">
                          <h4 className="ap-blockListHead">
                            Blocks in this section
                          </h4>
                          {(Array.isArray(
                            contentJson.extra_sections[
                              Number(selectedSectionIndex)
                            ].blocks,
                          )
                            ? contentJson.extra_sections[
                                Number(selectedSectionIndex)
                              ].blocks
                            : []
                          ).length === 0 ? (
                            <p className="ap-help">
                              No blocks yet. Add one in the builder.
                            </p>
                          ) : (
                            <div className="ap-phase4BlockChoices">
                              {contentJson.extra_sections[
                                Number(selectedSectionIndex)
                              ].blocks.map((block, blockIndex) => (
                                <button
                                  key={block.id || blockIndex}
                                  type="button"
                                  className={
                                    "ap-phase4BlockChoice" +
                                    (selectedBlockId === String(block.id)
                                      ? " is-selected"
                                      : "")
                                  }
                                  onClick={() => {
                                    setSelectedInner(null);
                                    setSelectedBlockId(String(block.id));
                                  }}
                                >
                                  <span>
                                    {blockIndex + 1}. {blockLabel(block)}
                                    {blockSnippet(block)
                                      ? `: ${blockSnippet(block)}`
                                      : ""}
                                  </span>
                                  <span aria-hidden="true">›</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {(activeInnerBlock
                            ? [activeInnerBlock]
                            : contentJson.extra_sections[
                                Number(selectedSectionIndex)
                              ].blocks?.filter(
                                (block) => String(block.id) === selectedBlockId,
                              ) || []
                          ).map((block) => (
                            <div
                              className="ap-phase4BlockFields"
                              key={block.id}
                              data-pane-active={elementPane}
                              data-device={deviceEditing || "desktop"}
                            >
                              <div className="ap-elHead">
                                <strong>Edit {blockLabel(block)}</strong>
                                {visualOnly &&
                                !/^home_|^featured_live$|^latest_teaching$/.test(
                                  String(block.type || ""),
                                ) ? (
                                  <SaveTemplateBox
                                    label="Save as template"
                                    onSave={(n) => saveTemplate("element", n)}
                                  />
                                ) : null}
                              </div>
                              <div
                                className="ap-elTabs"
                                role="tablist"
                                aria-label="Element settings"
                              >
                                {[
                                  ["content", "Content", "✎"],
                                  ["style", "Style", "◐"],
                                  ["advanced", "Advanced", "⚙"],
                                ].map(([k, label, icon]) => (
                                  <button
                                    key={k}
                                    type="button"
                                    role="tab"
                                    aria-selected={elementPane === k}
                                    className={
                                      elementPane === k ? "is-active" : ""
                                    }
                                    onClick={() => setElementPane(k)}
                                  >
                                    <span aria-hidden="true">{icon}</span>
                                    {label}
                                  </button>
                                ))}
                              </div>
                              {activeInner && innerKind === "block" ? (
                                <div
                                  className="bx-row"
                                  style={{ margin: "6px 0" }}
                                >
                                  <span className="bx-hint">
                                    Inside:{" "}
                                    {blockLabel(
                                      treeGet(
                                        selTopBlock,
                                        activeInner.path.slice(0, -2),
                                      ) || selTopBlock,
                                    )}
                                  </span>
                                  <button
                                    type="button"
                                    className="ap-btn"
                                    onClick={() => {
                                      const parent = activeInner.path.slice(
                                        0,
                                        -2,
                                      );
                                      setSelectedInner(
                                        parent.length
                                          ? {
                                              columnsId: activeInner.columnsId,
                                              path: parent,
                                            }
                                          : null,
                                      );
                                    }}
                                  >
                                    ‹ Select parent
                                  </button>
                                </div>
                              ) : null}

                              <div className="ap-paneContent">
                                {block.type === "button" ? (
                                  <>
                                    <label htmlFor="ap-phase4-button-text">
                                      Button label
                                    </label>
                                    <input
                                      id="ap-phase4-button-text"
                                      className="ap-input"
                                      value={block.text || ""}
                                      onChange={(e) =>
                                        patchBlockAny(block.id, {
                                          text: e.target.value,
                                        })
                                      }
                                    />
                                    <label htmlFor="ap-phase4-button-href">
                                      Button URL
                                    </label>
                                    <input
                                      id="ap-phase4-button-href"
                                      className="ap-input"
                                      value={block.href || ""}
                                      onChange={(e) =>
                                        patchBlockAny(block.id, {
                                          href: e.target.value,
                                        })
                                      }
                                    />
                                    <APButtonVisualInspector
                                      block={block}
                                      onPatch={(patch) =>
                                        patchBlockAny(block.id, patch)
                                      }
                                    />
                                    <label
                                      data-pane="style"
                                      htmlFor="ap-phase4-button-align"
                                    >
                                      Alignment
                                    </label>
                                    <select
                                      data-pane="style"
                                      id="ap-phase4-button-align"
                                      className="ap-input"
                                      value={block.align || "left"}
                                      onChange={(e) =>
                                        patchBlockAny(block.id, {
                                          align: e.target.value,
                                        })
                                      }
                                    >
                                      {["left", "center", "right"].map((v) => (
                                        <option key={v} value={v}>
                                          {v}
                                        </option>
                                      ))}
                                    </select>
                                  </>
                                ) : block.type === "columns" ? (
                                  renderColumnsPanel(block)
                                ) : block.type === "grid" ? (
                                  <CardsEditor
                                    block={block}
                                    onPatch={(patch) =>
                                      patchBlockAny(block.id, patch)
                                    }
                                  />
                                ) : HOME_BLOCK_FIELDS[
                                    String(block.type || "")
                                  ] ? (
                                  <HomeBlockEditor
                                    block={block}
                                    onPatch={(patch) =>
                                      patchBlockAny(block.id, patch)
                                    }
                                  />
                                ) : EXTRA_BLOCK_TYPES.has(
                                    String(block.type || ""),
                                  ) ? (
                                  <ExtraBlockEditor
                                    block={block}
                                    onPatch={(patch) =>
                                      patchBlockAny(block.id, patch)
                                    }
                                  />
                                ) : block.type === "richtext" ? (
                                  <>
                                    <div className="ap-inspectorText">
                                      <ModernPageEditor
                                        value={String(block.html || "")}
                                        onChangeHtml={(html) =>
                                          patchBlockAny(block.id, { html })
                                        }
                                        onChange={(html) =>
                                          patchBlockAny(block.id, { html })
                                        }
                                        onUploadImage={async (file) =>
                                          uploadImage(file, "inline")
                                        }
                                      />
                                    </div>
                                    <div
                                      data-pane="style"
                                      className="ap-paneGroup"
                                    >
                                      <p className="ap-help">
                                        Typography overrides for this text
                                        block. Leave font and color blank to
                                        inherit the website design.
                                      </p>
                                      <label htmlFor="ap-4e-rich-font">
                                        Font family
                                      </label>
                                      <select
                                        id="ap-4e-rich-font"
                                        className="ap-input"
                                        value={block.styles?.font_family || ""}
                                        onChange={(e) =>
                                          patchBlockAny(block.id, {
                                            styles: {
                                              ...(block.styles || {}),
                                              font_family: e.target.value,
                                            },
                                          })
                                        }
                                      >
                                        {AP_FONT_CHOICES.map((name) => (
                                          <option
                                            key={name}
                                            value={
                                              name === "Inherit website font"
                                                ? ""
                                                : name
                                            }
                                          >
                                            {name}
                                          </option>
                                        ))}
                                      </select>
                                      <label>Font size</label>
                                      <div className="ap-fontStepper">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            patchBlockAny(block.id, {
                                              styles: {
                                                ...(block.styles || {}),
                                                font_size: `${Math.max(8, (parseInt(block.styles?.font_size, 10) || 16) - 1)}px`,
                                              },
                                            })
                                          }
                                        >
                                          −
                                        </button>
                                        <input
                                          aria-label="Text font size"
                                          type="number"
                                          min="8"
                                          max="72"
                                          value={
                                            parseInt(
                                              block.styles?.font_size,
                                              10,
                                            ) || 16
                                          }
                                          onChange={(e) =>
                                            patchBlockAny(block.id, {
                                              styles: {
                                                ...(block.styles || {}),
                                                font_size: `${clampNum(e.target.value, 8, 72)}px`,
                                              },
                                            })
                                          }
                                        />
                                        <span>px</span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            patchBlockAny(block.id, {
                                              styles: {
                                                ...(block.styles || {}),
                                                font_size: `${Math.min(72, (parseInt(block.styles?.font_size, 10) || 16) + 1)}px`,
                                              },
                                            })
                                          }
                                        >
                                          +
                                        </button>
                                        <button
                                          type="button"
                                          className="ap-fontReset"
                                          onClick={() =>
                                            patchBlockAny(block.id, {
                                              styles: {
                                                ...(block.styles || {}),
                                                font_size: "",
                                              },
                                            })
                                          }
                                        >
                                          Reset
                                        </button>
                                      </div>
                                      <APColorField
                                        label="Text color"
                                        value={block.styles?.text_color || ""}
                                        fallback="#FFFFFF"
                                        onChange={(v) =>
                                          patchBlockAny(block.id, {
                                            styles: {
                                              ...(block.styles || {}),
                                              text_color: v,
                                            },
                                          })
                                        }
                                      />
                                      <label htmlFor="ap-4e-rich-align">
                                        Text alignment
                                      </label>
                                      <select
                                        id="ap-4e-rich-align"
                                        className="ap-input"
                                        value={block.styles?.align || ""}
                                        onChange={(e) =>
                                          patchBlockAny(block.id, {
                                            styles: {
                                              ...(block.styles || {}),
                                              align: e.target.value,
                                            },
                                          })
                                        }
                                      >
                                        <option value="">Inherit</option>
                                        <option value="left">Left</option>
                                        <option value="center">Center</option>
                                        <option value="right">Right</option>
                                        <option value="justify">Justify</option>
                                      </select>
                                      <p className="ap-help">
                                        Heading tags and paragraphs inside this
                                        rich-text block inherit these settings
                                        unless they have their own explicit
                                        formatting.
                                      </p>
                                    </div>
                                  </>
                                ) : block.type === "gallery" ? (
                                  <>
                                    <GalleryImagesEditor
                                      block={block}
                                      onPatch={(patch) =>
                                        patchBlockAny(block.id, patch)
                                      }
                                    />
                                    <label htmlFor="ap-phase4-gallery-columns">
                                      Gallery columns
                                    </label>
                                    <select
                                      id="ap-phase4-gallery-columns"
                                      className="ap-input"
                                      value={String(block.columns || 3)}
                                      onChange={(e) =>
                                        patchBlockAny(block.id, {
                                          columns: Number(e.target.value),
                                        })
                                      }
                                    >
                                      {[1, 2, 3, 4, 5, 6].map((v) => (
                                        <option key={v} value={v}>
                                          {v}
                                        </option>
                                      ))}
                                    </select>
                                    <label htmlFor="ap-phase4-gallery-gap">
                                      Image gap (px)
                                    </label>
                                    <input
                                      id="ap-phase4-gallery-gap"
                                      className="ap-input"
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={block.gap ?? 10}
                                      onChange={(e) =>
                                        patchBlockAny(block.id, {
                                          gap: Math.max(
                                            0,
                                            Math.min(
                                              100,
                                              Number(e.target.value) || 0,
                                            ),
                                          ),
                                        })
                                      }
                                    />
                                  </>
                                ) : (
                                  <>
                                    <p className="ap-help">
                                      This block's content is edited in List
                                      view.
                                    </p>
                                    <button
                                      type="button"
                                      className="ap-btn"
                                      onClick={() => goToListView(block.id)}
                                    >
                                      Edit in List view
                                    </button>
                                  </>
                                )}
                              </div>
                              {(() => {
                                const bs = isObj(block.styles)
                                  ? block.styles
                                  : {};
                                const patchBlockStyles = (patch) =>
                                  patchBlockAny(block.id, {
                                    styles: { ...bs, ...patch },
                                  });
                                const t = String(block.type || "richtext");
                                const ownStyle = [
                                  "richtext",
                                  "button",
                                  "home_hero",
                                ].includes(t);
                                const builtIn =
                                  /^home_|^featured_live$|^latest_teaching$/.test(
                                    t,
                                  );
                                // Release 1.2: on Tablet / Mobile, Style and Spacing edit that
                                // device's overrides (others inherit Desktop), like Elementor.
                                const dev = deviceEditing;
                                const devView = dev ? deviceView(bs, dev) : bs;
                                const patchDev = dev
                                  ? (patch) =>
                                      patchBlockStyles({
                                        [dev]: {
                                          ...(isObj(bs[dev]) ? bs[dev] : {}),
                                          ...patch,
                                        },
                                      })
                                  : patchBlockStyles;
                                return (
                                  <>
                                    {dev && !builtIn ? (
                                      <DeviceBanner
                                        device={dev}
                                        hasOverrides={
                                          isObj(bs[dev]) &&
                                          Object.keys(bs[dev]).length > 0
                                        }
                                        onReset={() =>
                                          patchBlockStyles({ [dev]: {} })
                                        }
                                      />
                                    ) : null}
                                    <div className="ap-paneStyle">
                                      {!builtIn &&
                                      (!ownStyle ||
                                        (dev && t !== "home_hero")) ? (
                                        <ElementStyle
                                          styles={devView}
                                          onPatchStyles={patchDev}
                                        />
                                      ) : null}
                                      {!builtIn && !dev ? (
                                        <ElementEffects
                                          styles={bs}
                                          onPatchStyles={patchBlockStyles}
                                        />
                                      ) : null}
                                      {builtIn && !ownStyle ? (
                                        <p className="ap-help">
                                          This built-in part uses the website
                                          design (Design settings).
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="ap-paneAdvanced">
                                      {builtIn ? (
                                        <p className="ap-help">
                                          Built-in Home parts keep a fixed
                                          layout.
                                        </p>
                                      ) : (
                                        <>
                                          <BlockSpacing
                                            styles={devView}
                                            onPatchStyles={patchDev}
                                          />
                                          <ResponsiveVisibility
                                            styles={bs}
                                            onPatchStyles={patchBlockStyles}
                                          />
                                          <MotionEffects
                                            styles={bs}
                                            onPatchStyles={patchBlockStyles}
                                          />
                                          <CssAttributes
                                            styles={bs}
                                            onPatchStyles={patchBlockStyles}
                                          />
                                        </>
                                      )}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          data-pane="style"
                          className="ap-btn ap-btnPrimary"
                          onClick={() =>
                            openStyleModal(Number(selectedSectionIndex))
                          }
                        >
                          Open detailed style settings
                        </button>
                        <p className="ap-help">
                          Typography, background, spacing, borders and image
                          settings are available in the detailed style dialog.
                        </p>
                      </div>
                    ) : (
                      <p className="ap-help">
                        Choose a section above to begin editing.
                      </p>
                    )}
                    {!visualOnly ? (
                      <button
                        type="button"
                        className="ap-btn"
                        onClick={() => {
                          setInserterOpen(true);
                          setActiveTab("builder");
                        }}
                      >
                        Open block library
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="ap-settingsFields">
                    <div className="ap-field ap-titleField">
                      <label htmlFor="ap-page-title">Page title</label>
                      <input
                        id="ap-page-title"
                        className="ap-input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Page title"
                      />
                    </div>
                    <div className="ap-field">
                      <label>Slug</label>
                      <input
                        className="ap-input"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="e.g. home"
                      />
                      <div className="ap-help">
                        Part of the page’s web address (letters, numbers and
                        dashes).
                      </div>
                      <div
                        className="ap-help ap-phase4gaPreviewUrl"
                        style={{ marginTop: 6 }}
                      >
                        <strong>Preview URL</strong>
                        <code>{previewUrl}</code>
                        <button
                          type="button"
                          className="ap-btn"
                          onClick={() =>
                            navigator.clipboard?.writeText(
                              `${window.location.origin}${previewUrl}`,
                            )
                          }
                          title="Copy preview URL"
                        >
                          Copy URL
                        </button>
                      </div>
                    </div>

                    <div className="ap-field">
                      <label>Excerpt (optional)</label>
                      <textarea
                        className="ap-textarea"
                        value={excerpt}
                        onChange={(e) => setExcerpt(e.target.value)}
                        placeholder="Short summary (optional)"
                        rows={4}
                      />
                    </div>

                    {/* Custom CSS for this page (like Elementor's page Custom CSS) */}
                    <div className="ap-cssCard">
                      <strong>Custom CSS (this page)</strong>
                      <p className="ap-seoHelp">
                        Applies only to this page and shows in the editor as you
                        type. For the whole site, use Site Settings › Custom
                        CSS.
                      </p>
                      <textarea
                        className="ap-textarea ap-cssBox"
                        aria-label="Custom CSS for this page"
                        spellCheck={false}
                        rows={6}
                        maxLength={50000}
                        placeholder=".gold-title { color: #d4af37; }"
                        value={String(contentJson?.page_css || "")}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBuilder((b) => ({ ...b, page_css: v }));
                        }}
                      />
                    </div>
                    {visualOnly ? (
                      <div className="ap-cssCard">
                        <strong>Templates</strong>
                        <p className="ap-seoHelp">
                          Save this whole page to reuse it for new pages (＋
                          Elements › Templates).
                        </p>
                        <SaveTemplateBox
                          label="Save page as template"
                          onSave={(n) => saveTemplate("page", n)}
                        />
                      </div>
                    ) : null}
                    {/* Phase 6: search & sharing */}
                    <div className="ap-seoBox">
                      <strong>Search &amp; sharing</strong>
                      <p className="ap-seoHelp">
                        How this page appears in search results and when its
                        link is shared. Leave blank to use the page title and
                        excerpt.
                      </p>
                      <div className="ap-field">
                        <label htmlFor="ap-seo-title">
                          Search title
                          <span className="ap-seoCount">
                            {(seo.title || "").length}/60
                          </span>
                        </label>
                        <input
                          id="ap-seo-title"
                          className="ap-input"
                          value={seo.title}
                          maxLength={120}
                          placeholder={seoDefaultTitle}
                          onChange={(e) =>
                            setSeo((cur) => ({ ...cur, title: e.target.value }))
                          }
                        />
                      </div>
                      <div className="ap-field">
                        <label htmlFor="ap-seo-desc">
                          Search description
                          <span className="ap-seoCount">
                            {(seo.description || "").length}/160
                          </span>
                        </label>
                        <textarea
                          id="ap-seo-desc"
                          className="ap-textarea"
                          rows={3}
                          maxLength={320}
                          value={seo.description}
                          placeholder={excerpt || SITE.description}
                          onChange={(e) =>
                            setSeo((cur) => ({
                              ...cur,
                              description: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="ap-field">
                        <label>Sharing image</label>
                        {seo.image ? (
                          <img
                            className="ap-seoImage"
                            src={mediaSrc(seo.image)}
                            alt=""
                          />
                        ) : (
                          <p className="ap-seoHelp">
                            None chosen: uses the hero image, or the site image.
                          </p>
                        )}
                        <div className="ap-seoActions">
                          <button
                            type="button"
                            className="ap-btn"
                            onClick={async () => {
                              const pick = await pickFromLibrary({
                                title: "Choose a sharing image",
                              });
                              if (pick?.url)
                                setSeo((cur) => ({ ...cur, image: pick.url }));
                            }}
                          >
                            Choose from library
                          </button>
                          {seo.image ? (
                            <button
                              type="button"
                              className="ap-btn"
                              onClick={() =>
                                setSeo((cur) => ({ ...cur, image: "" }))
                              }
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <label className="ap-seoCheck">
                        <input
                          type="checkbox"
                          checked={!!seo.noindex}
                          onChange={(e) =>
                            setSeo((cur) => ({
                              ...cur,
                              noindex: e.target.checked,
                            }))
                          }
                        />
                        Hide this page from search engines
                      </label>
                      <div
                        className="ap-seoPreview"
                        aria-label="Search result preview"
                      >
                        <span className="ap-seoPreviewUrl">
                          {SITE.url.replace(/^https?:\/\//, "")} ›{" "}
                          {slug || "page"}
                        </span>
                        <span className="ap-seoPreviewTitle">
                          {seo.title.trim() || seoDefaultTitle}
                        </span>
                        <span className="ap-seoPreviewDesc">
                          {seo.description.trim() ||
                            excerpt ||
                            SITE.description}
                        </span>
                      </div>
                    </div>

                    {templateType !== "home" ? (
                      <div className="ap-field">
                        <label>Hero Image</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={onHeroFile}
                        />
                        <button
                          type="button"
                          className="ap-btn"
                          style={{ marginTop: 8, display: "block" }}
                          title="Choose from the Media Library"
                          onClick={async () => {
                            const libPick = await pickFromLibrary({
                              title: "Choose a hero image",
                            });
                            if (libPick)
                              await onHeroFile({
                                target: { files: [libPick] },
                              });
                          }}
                        >
                          Choose from library
                        </button>
                        <div className="ap-help">
                          Upload a hero image for the top of the page.
                        </div>

                        {hero ? (
                          <div style={{ marginTop: 10 }}>
                            <div
                              style={{
                                width: "100%",
                                height: 140,
                                borderRadius: 12,
                                border: "1px solid rgba(255,255,255,0.12)",
                                background: `url(${absUrl(hero) || hero}) center/cover no-repeat`,
                              }}
                            />
                            <div
                              className="ap-help"
                              style={{ marginTop: 8, wordBreak: "break-all" }}
                            >
                              {hero}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="ap-field">
                        <label>Home Builder Tip</label>
                        <div className="ap-help">
                          Home is template-driven. Use the <b>Builder</b> tab to
                          edit sections and extra containers.
                        </div>
                      </div>
                    )}

                    <div className="ap-divider" />
                    <div className="ap-gbDangerZone">
                      <strong>Danger zone</strong>
                      <p>
                        Unpublishing removes this page from public view.
                        Deletion cannot be undone.
                      </p>
                      {status === "published" && (
                        <button
                          className="ap-btn"
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            openConfirm({
                              title: "Unpublish page?",
                              message:
                                "This will remove the page from the public website until it is published again.",
                              confirmText: "Unpublish",
                              danger: true,
                              onConfirm: async () => {
                                closeConfirm();
                                await doUnpublish();
                              },
                            })
                          }
                        >
                          Unpublish page
                        </button>
                      )}
                      <button
                        className="ap-btn ap-btnDanger"
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          openConfirm({
                            title: "Delete page permanently?",
                            message:
                              "This permanently deletes the page and cannot be undone.",
                            confirmText: "Delete Permanently",
                            danger: true,
                            onConfirm: async () => {
                              closeConfirm();
                              await doDelete();
                            },
                          })
                        }
                      >
                        Delete Permanently
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {visualOnly ? (
            <div className="ap-main ap-gbCanvas ap-visualMain">
              {renderVisualCanvas()}
            </div>
          ) : (
            <div
              className={`ap-main ap-gbCanvas ap-phase3Canvas ap-phase3-${canvasMode === "visual" ? "desktop" : previewDevice}`}
            >
              <div className="ap-builderHead">
                <div>
                  <span className="ap-eyebrow">CONTENT WORKSPACE</span>
                  <h2>Visual page builder</h2>
                  <p>
                    Build and arrange the sections that appear on your page.
                  </p>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                <button
                  className={`ap-btn ${activeTab === "builder" ? "ap-btnPrimary" : ""}`}
                  onClick={() => setActiveTab("builder")}
                  type="button"
                >
                  Builder
                </button>
                <button
                  className={`ap-btn ${activeTab === "rich" ? "ap-btnPrimary" : ""}`}
                  onClick={() => setActiveTab("rich")}
                  type="button"
                >
                  Rich Text
                </button>
              </div>

              {activeTab === "builder" ? (
                <>
                  <div
                    className="ap-liveModeSwitch"
                    role="group"
                    aria-label="Builder display mode"
                  >
                    <button
                      type="button"
                      className={`ap-btn ${canvasMode === "visual" ? "ap-btnPrimary" : ""}`}
                      onClick={() => requestLeave(`/admin/pages/${id}/visual`)}
                      title="Open the full-screen visual editor"
                    >
                      Visual page
                    </button>
                    <button
                      type="button"
                      className={`ap-btn ${canvasMode === "builder" ? "ap-btnPrimary" : ""}`}
                      onClick={() => setCanvasMode("builder")}
                    >
                      List view
                    </button>
                    {/* "Live draft canvas" retired: the full-screen visual editor replaces it. */}
                  </div>
                  {canvasMode === "visual" ? (
                    renderVisualCanvas()
                  ) : canvasMode === "canvas" ? (
                    <APDraftCanvas
                      sections={contentJson?.extra_sections}
                      selectedSectionIndex={selectedSectionIndex}
                      selectedBlockId={selectedBlockId}
                      device={previewDevice}
                      onPatchBlock={patchBlock}
                      onPatchSection={updateExtraSection}
                      onSelect={(sectionIndex, blockId) => {
                        setSelectedSectionIndex(String(sectionIndex));
                        setSelectedBlockId(String(blockId));
                        setInspectorTab("block");
                        setInspectorOpen(true);
                      }}
                    />
                  ) : templateType === "home" ? (
                    renderHomeBuilder()
                  ) : (
                    renderGenericBuilder()
                  )}
                </>
              ) : activeTab === "rich" ? (
                <div className="ap-field">
                  <label>Content</label>
                  <div className="ap-editorWrap">
                    <ModernPageEditor
                      value={contentHtml}
                      onChangeHtml={setContentHtml}
                      onChange={setContentHtml}
                      onUploadImage={async (file) =>
                        uploadImage(file, "inline")
                      }
                    />
                  </div>
                  <div className="ap-help" style={{ marginTop: 8 }}>
                    This is used for generic pages rendered via <b>/p/:slug</b>.
                    Home and other template pages can use the Builder tab;
                    generic pages can also use Rich Text.
                  </div>
                </div>
              ) : (
                <div className="ap-card">
                  <div className="ap-help">
                    This page uses a template. Use the <b>Builder</b> tab to
                    edit sections.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MediaPickerContext.Provider>
  );
}
