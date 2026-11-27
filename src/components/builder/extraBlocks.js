// src/components/builder/extraBlocks.js
//
// Phase 5: four more page-builder blocks, shared by the editor (both
// builders, previews) and the public site, so they look the same everywhere.
//   video    YouTube, Vimeo, Bunny Stream or Facebook link, or an .mp4/.webm file
//   spacer   vertical space, optionally with a divider line
//   quote    quote or testimonial with name, role and optional photo
//   faq      questions and answers that open and close (accordion)
//
// Security: the embed address is never taken from what the editor pasted. The
// link is parsed and a clean embed address is rebuilt for known services only.
// All text renders as plain text (no HTML).

import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import { MediaPickerContext } from "../media/MediaPicker";
import { CanvasHint } from "./canvasContext";
import {
  MORE_LABELS,
  MORE_TYPES,
  MoreBlockEditor,
  MoreBlockPublic,
  defaultMoreBlock,
} from "./moreBlocks";
import { mediaSrc } from "../../lib/mediaApi";
import "./extraBlocks.css";

export const EXTRA_BLOCK_TYPES = new Set([
  "video",
  "spacer",
  "quote",
  "faq",
  // Elementor-style additions
  "heading",
  "image",
  "divider",
  "videos",
  // Release 1.2 Part C
  ...MORE_TYPES,
]);

export const EXTRA_BLOCK_LABELS = {
  video: "Video",
  spacer: "Spacer",
  quote: "Quote",
  faq: "FAQ",
  heading: "Heading",
  image: "Image",
  divider: "Divider",
  videos: "Video gallery",
  ...MORE_LABELS,
};

export const EXTRA_PALETTE = [
  { type: "video", label: "Video", glyph: "▶" },
  { type: "quote", label: "Quote / Testimonial", glyph: "❝" },
  { type: "faq", label: "FAQ", glyph: "?" },
  { type: "spacer", label: "Spacer", glyph: "↕" },
  { type: "heading", label: "Heading", glyph: "H" },
  { type: "image", label: "Image", glyph: "🖼" },
  { type: "divider", label: "Divider", glyph: "—" },
  { type: "videos", label: "Video gallery", glyph: "▶▶" },
];

export function defaultExtraBlock(type, makeId) {
  const id = makeId();
  if (type === "video") return { id, type, url: "", title: "", aspect: "16:9" };
  if (type === "spacer") return { id, type, height: 40, divider: false };
  if (type === "quote")
    return {
      id,
      type,
      text: "Add your quote here.",
      name: "Name",
      role: "",
      image_url: "",
      align: "center",
    };
  if (type === "faq")
    return {
      id,
      type,
      open_first: false,
      items: [{ id: makeId(), q: "Your question?", a: "Your answer." }],
    };
  if (MORE_TYPES.has(type)) return defaultMoreBlock(type, id);
  if (type === "heading")
    return { id, type, text: "Your heading here", level: "h2", link: "" };
  if (type === "image")
    return {
      id,
      type,
      src: "",
      alt: "",
      link: "",
      width: 100,
      align: "center",
    };
  if (type === "divider")
    return { id, type, line: "solid", thickness: 2, width: 100, color: "" };
  if (type === "videos")
    return {
      id,
      type,
      source: "latest",
      collection: "",
      order: "newest",
      count: 6,
      cols: 3,
      show_titles: true,
    };
  return { id, type: "richtext", html: "" };
}

const HEADING_LEVELS = ["h1", "h2", "h3", "h4", "h5", "h6"];

// Links: site pages ("/catalog") stay in the app; others open in a new tab.
function SmartLink({ href, children, className }) {
  const h = String(href || "").trim();
  if (!h) return children;
  if (h.startsWith("/"))
    return (
      <Link to={h} className={className}>
        {children}
      </Link>
    );
  if (/^https?:\/\//i.test(h) || /^mailto:|^tel:/i.test(h))
    return (
      <a
        href={h}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  return children;
}

// Video gallery order: newest / oldest first, title A–Z / Z–A.
const VIDEO_ORDERS = {
  newest: { label: "Newest first", sort: "published_at", dir: "desc" },
  oldest: { label: "Oldest first", sort: "published_at", dir: "asc" },
  az: { label: "Title A–Z", sort: "title", dir: "asc" },
  za: { label: "Title Z–A", sort: "title", dir: "desc" },
};
function sortVideos(list, order) {
  const o = VIDEO_ORDERS[order] || VIDEO_ORDERS.newest;
  const when = (v) => Date.parse(v?.published_at || v?.created_at || "") || 0;
  const out = list.slice();
  if (o.sort === "title")
    out.sort((a, b) =>
      String(a?.title || "").localeCompare(String(b?.title || ""), undefined, {
        sensitivity: "base",
      }),
    );
  else out.sort((a, b) => when(a) - when(b));
  if (o.dir === "desc") out.reverse();
  return out;
}

// Video gallery: the site's own videos (newest, or one collection).
function VideoGallery({ block }) {
  const b = block || {};
  const [state, setState] = useState({ loading: true, videos: [] });
  const source =
    b.source === "collection" && b.collection ? "collection" : "latest";
  const count = Math.max(1, Math.min(Number(b.count) || 6, 24));
  const order = VIDEO_ORDERS[b.order] ? b.order : "newest";
  const cols = Math.max(1, Math.min(Number(b.cols) || 3, 4));
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let list = [];
        const o = VIDEO_ORDERS[order];
        if (source === "collection") {
          const { data } = await api.get(
            `/playlists/public/${encodeURIComponent(String(b.collection))}`,
          );
          list = sortVideos(
            Array.isArray(data?.videos) ? data.videos : [],
            order,
          );
        } else {
          // All published videos, in the chosen order (sorted by the server).
          const { data } = await api.get("/public/videos", {
            params: {
              sort: o.sort,
              order: o.dir,
              limit: count,
              any_category: 1,
            },
          });
          list = Array.isArray(data)
            ? data
            : data?.items || data?.videos || data?.rows || [];
        }
        if (alive) setState({ loading: false, videos: list.slice(0, count) });
      } catch {
        if (alive) setState({ loading: false, videos: [] });
      }
    })();
    return () => {
      alive = false;
    };
  }, [source, b.collection, count, order]);
  if (state.loading)
    return (
      <div
        className={`bx-vgrid bx-vgrid--c${cols} bx-vgrid--loading`}
        aria-busy="true"
        style={{ "--bx-cols": cols }}
      />
    );
  if (!state.videos.length)
    return (
      <CanvasHint label="Video gallery: no published videos found for this source yet." />
    );
  return (
    <div
      className={`bx-vgrid bx-vgrid--c${cols}`}
      style={{ "--bx-cols": cols }}
    >
      {state.videos.map((v) => {
        const thumb =
          v.thumbnail_url ||
          v?.metadata?.thumbnail_url ||
          v?.metadata?.thumbnail_vertical_url ||
          "";
        return (
          <Link key={v.id} to={`/watch/${v.id}`} className="bx-vcard">
            <span className="bx-vthumb">
              {thumb ? <img src={thumb} alt="" loading="lazy" /> : null}
              <span className="bx-vplay" aria-hidden="true">
                ▶
              </span>
            </span>
            {b.show_titles !== false ? (
              <span className="bx-vtitle">{v.title || "Video"}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

/* -------- video links -------- */
const YT_ID = /^[A-Za-z0-9_-]{6,20}$/;

// Returns { kind, label, src } or null. src is always rebuilt, never copied.
export function parseVideoUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\.|^m\./, "");
  const parts = u.pathname.split("/").filter(Boolean);

  if (host === "youtu.be" && YT_ID.test(parts[0] || ""))
    return {
      kind: "youtube",
      label: "YouTube",
      src: `https://www.youtube-nocookie.com/embed/${parts[0]}`,
    };
  if (
    host === "youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "music.youtube.com"
  ) {
    let id = u.searchParams.get("v") || "";
    if (!id && ["embed", "shorts", "live", "v"].includes(parts[0]))
      id = parts[1] || "";
    if (YT_ID.test(id))
      return {
        kind: "youtube",
        label: "YouTube",
        src: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    return null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = [...parts].reverse().find((p) => /^\d{5,12}$/.test(p));
    return id
      ? {
          kind: "vimeo",
          label: "Vimeo",
          src: `https://player.vimeo.com/video/${id}`,
        }
      : null;
  }
  if (
    host === "iframe.mediadelivery.net" ||
    host === "player.mediadelivery.net"
  ) {
    const i = parts.findIndex((p) => p === "embed" || p === "play");
    const lib = parts[i + 1];
    const vid = parts[i + 2];
    if (
      i >= 0 &&
      /^\d{1,10}$/.test(lib || "") &&
      /^[0-9a-f-]{20,40}$/i.test(vid || "")
    )
      return {
        kind: "bunny",
        label: "Bunny Stream",
        src: `https://iframe.mediadelivery.net/embed/${lib}/${vid}`,
      };
    return null;
  }
  if (
    (host === "facebook.com" || host === "fb.watch") &&
    u.protocol === "https:"
  ) {
    const href = `https://${u.hostname}${u.pathname}${u.search}`;
    return {
      kind: "facebook",
      label: "Facebook",
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=false`,
    };
  }
  if (u.protocol === "https:" && /\.(mp4|webm|mov|m4v)$/i.test(u.pathname))
    return { kind: "file", label: "Video file", src: u.toString() };
  return null;
}

const ASPECTS = {
  "16:9": "16 / 9",
  "4:3": "4 / 3",
  "1:1": "1 / 1",
  "9:16": "9 / 16",
};

function clampNum(n, lo, hi, dflt) {
  const v = Number(n);
  if (!Number.isFinite(v)) return dflt;
  return Math.min(hi, Math.max(lo, v));
}

/* -------- public display (also used in editor previews) -------- */
export function ExtraBlockPublic({ block }) {
  if (MORE_TYPES.has(String(block?.type || "")))
    return <MoreBlockPublic block={block} />;
  const b = block && typeof block === "object" ? block : {};
  const type = String(b.type || "");

  if (type === "heading") {
    const text = String(b.text || "").trim();
    if (!text)
      return (
        <CanvasHint label="Heading: write the heading in the panel on the left." />
      );
    const Tag = HEADING_LEVELS.includes(b.level) ? b.level : "h2";
    // A size set in the Style tab is the heading's exact size.
    const sized = Number.parseFloat(String(b?.styles?.font_size || "")) >= 10;
    return (
      <Tag
        className="bx-heading"
        style={sized ? { fontSize: "1em" } : undefined}
      >
        <SmartLink href={b.link}>{text}</SmartLink>
      </Tag>
    );
  }

  if (type === "image") {
    const src = String(b.src || "").trim();
    if (!src)
      return (
        <CanvasHint label="Image: choose an image in the panel on the left." />
      );
    const w = clampNum(b.width, 10, 100, 100);
    const align = ["left", "center", "right"].includes(b.align)
      ? b.align
      : "center";
    return (
      <figure className="bx-image" style={{ textAlign: align }}>
        <SmartLink href={b.link}>
          <img
            src={mediaSrc(src)}
            alt={String(b.alt || "")}
            loading="lazy"
            style={{ width: `${w}%` }}
          />
        </SmartLink>
      </figure>
    );
  }

  if (type === "divider") {
    const t = clampNum(b.thickness, 1, 12, 2);
    const w = clampNum(b.width, 10, 100, 100);
    const line = ["solid", "dashed", "dotted", "double"].includes(b.line)
      ? b.line
      : "solid";
    const color = /^#[0-9a-f]{6}$/i.test(String(b.color || ""))
      ? b.color
      : "currentColor";
    return (
      <div
        className="bx-divider2"
        role="separator"
        style={{
          borderTop: `${line === "double" ? Math.max(3, t) : t}px ${line} ${color}`,
          width: `${w}%`,
        }}
      />
    );
  }

  if (type === "videos") return <VideoGallery block={b} />;

  if (type === "spacer") {
    const h = clampNum(b.height, 0, 240, 40);
    return (
      <div className="bx-spacer" style={{ height: h }} aria-hidden="true">
        {b.divider ? <hr className="bx-divider" /> : null}
      </div>
    );
  }

  if (type === "video") {
    const v = parseVideoUrl(b.url);
    if (!v)
      return (
        <CanvasHint label="Video: paste a YouTube, Vimeo or Bunny link in the panel on the left." />
      );
    const ratio = ASPECTS[b.aspect] || ASPECTS["16:9"];
    const title = String(b.title || "").trim() || "Video";
    return (
      <div
        className={`bx-video ${b.aspect === "9:16" ? "is-vertical" : ""}`}
        style={{ aspectRatio: ratio }}
      >
        {v.kind === "file" ? (
          <video
            src={v.src}
            controls
            preload="metadata"
            playsInline
            title={title}
          />
        ) : (
          <iframe
            src={v.src}
            title={title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
    );
  }

  if (type === "quote") {
    const text = String(b.text || "").trim();
    if (!text)
      return (
        <CanvasHint label="Quote: write the quote in the panel on the left." />
      );
    const img = String(b.image_url || "").trim();
    return (
      <figure
        className={`bx-quote align-${b.align === "left" ? "left" : "center"}`}
      >
        <blockquote>
          <p>{text}</p>
        </blockquote>
        {b.name || b.role || img ? (
          <figcaption>
            {img ? (
              <img
                src={mediaSrc(img)}
                alt=""
                className="bx-quotePhoto"
                loading="lazy"
              />
            ) : null}
            <span>
              {b.name ? <strong>{b.name}</strong> : null}
              {b.role ? <span className="bx-quoteRole">{b.role}</span> : null}
            </span>
          </figcaption>
        ) : null}
      </figure>
    );
  }

  if (type === "faq") {
    const items = (Array.isArray(b.items) ? b.items : []).filter(
      (it) => it && String(it.q || "").trim(),
    );
    if (!items.length)
      return (
        <CanvasHint label="FAQ: add questions in the panel on the left." />
      );
    return (
      <div className="bx-faq">
        {items.map((it, i) => (
          <details
            key={it.id || i}
            className="bx-faqItem"
            open={!!b.open_first && i === 0}
          >
            <summary>{String(it.q).trim()}</summary>
            {String(it.a || "").trim() ? (
              <div className="bx-faqAnswer">{String(it.a).trim()}</div>
            ) : null}
          </details>
        ))}
      </div>
    );
  }
  return null;
}

/* -------- editor controls -------- */
let fieldSeq = 0;
function useFieldId(prefix) {
  const ref = React.useRef(null);
  if (!ref.current) ref.current = `${prefix}-${++fieldSeq}`;
  return ref.current;
}

function Field({ label, children, hint, id }) {
  return (
    <div className="bx-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <div className="bx-hint">{hint}</div> : null}
    </div>
  );
}

export function ExtraBlockEditor({ block, onPatch }) {
  const pickFromLibrary = useContext(MediaPickerContext);
  const b = block && typeof block === "object" ? block : {};
  const type = String(b.type || "");
  const fid = useFieldId(`bx-${type}`);
  if (MORE_TYPES.has(type))
    return <MoreBlockEditor block={block} onPatch={onPatch} />; // Part C

  if (type === "video") {
    const v = parseVideoUrl(b.url);
    return (
      <div className="bx-editor">
        <Field
          label="Video link"
          id={`${fid}-url`}
          hint={
            !b.url
              ? "Paste a YouTube, Vimeo, Bunny Stream or Facebook link, or the address of an .mp4 file."
              : v
                ? `Recognized: ${v.label}`
                : "This link isn't recognized. Use a YouTube, Vimeo, Bunny Stream or Facebook video link, or an https address ending in .mp4 or .webm."
          }
        >
          <input
            id={`${fid}-url`}
            className="ap-input"
            value={b.url || ""}
            placeholder="https://www.youtube.com/watch?v=..."
            onChange={(e) => onPatch({ url: e.target.value })}
            aria-invalid={b.url && !v ? "true" : "false"}
          />
        </Field>
        <div className="bx-row">
          <Field label="Title (for screen readers)" id={`${fid}-title`}>
            <input
              id={`${fid}-title`}
              className="ap-input"
              value={b.title || ""}
              placeholder="Sunday service, November 2"
              onChange={(e) => onPatch({ title: e.target.value })}
            />
          </Field>
          <Field label="Shape" id={`${fid}-aspect`}>
            <select
              id={`${fid}-aspect`}
              className="ap-input"
              value={b.aspect || "16:9"}
              onChange={(e) => onPatch({ aspect: e.target.value })}
            >
              <option value="16:9">Widescreen (16:9)</option>
              <option value="4:3">Standard (4:3)</option>
              <option value="1:1">Square (1:1)</option>
              <option value="9:16">Vertical (9:16)</option>
            </select>
          </Field>
        </div>
        {v ? (
          <div className="bx-editorPreview">
            <ExtraBlockPublic block={b} />
          </div>
        ) : null}
      </div>
    );
  }

  if (type === "heading") {
    return (
      <div className="bx-editor">
        <Field label="Heading" id={`${fid}-t`}>
          <textarea
            id={`${fid}-t`}
            className="ap-textarea"
            rows={2}
            value={b.text || ""}
            onChange={(e) => onPatch({ text: e.target.value })}
          />
        </Field>
        <div className="bx-row">
          <Field
            label="HTML tag"
            id={`${fid}-l`}
            hint="H1 is the page's main title; use it once per page."
          >
            <select
              id={`${fid}-l`}
              className="ap-input"
              value={b.level || "h2"}
              onChange={(e) => onPatch({ level: e.target.value })}
            >
              {HEADING_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Link (optional)" id={`${fid}-k`}>
            <input
              id={`${fid}-k`}
              className="ap-input"
              value={b.link || ""}
              placeholder="/catalog or https://…"
              onChange={(e) => onPatch({ link: e.target.value })}
            />
          </Field>
        </div>
      </div>
    );
  }

  if (type === "image") {
    return (
      <div className="bx-editor">
        <div className="bx-photoRow">
          {b.src ? (
            <img
              src={mediaSrc(b.src)}
              alt=""
              style={{
                width: 96,
                height: 64,
                objectFit: "cover",
                borderRadius: 8,
              }}
            />
          ) : null}
          {pickFromLibrary ? (
            <button
              type="button"
              className="ap-btn ap-btnPrimary"
              onClick={async () => {
                const pick = await pickFromLibrary({
                  title: "Choose an image",
                });
                if (pick?.url)
                  onPatch({ src: pick.url, alt: b.alt || pick.alt || "" });
              }}
            >
              {b.src ? "Change image" : "Choose image"}
            </button>
          ) : null}
        </div>
        <Field label="Description (for screen readers)" id={`${fid}-a`}>
          <input
            id={`${fid}-a`}
            className="ap-input"
            value={b.alt || ""}
            onChange={(e) => onPatch({ alt: e.target.value })}
          />
        </Field>
        <Field label="Link (optional)" id={`${fid}-k`}>
          <input
            id={`${fid}-k`}
            className="ap-input"
            value={b.link || ""}
            placeholder="/catalog or https://…"
            onChange={(e) => onPatch({ link: e.target.value })}
          />
        </Field>
        <div className="bx-row">
          <Field
            label={`Width: ${clampNum(b.width, 10, 100, 100)}%`}
            id={`${fid}-w`}
          >
            <input
              id={`${fid}-w`}
              type="range"
              min={10}
              max={100}
              value={clampNum(b.width, 10, 100, 100)}
              onChange={(e) => onPatch({ width: Number(e.target.value) })}
            />
          </Field>
          <Field label="Alignment" id={`${fid}-al`}>
            <select
              id={`${fid}-al`}
              className="ap-input"
              value={b.align || "center"}
              onChange={(e) => onPatch({ align: e.target.value })}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </Field>
        </div>
      </div>
    );
  }

  if (type === "divider") {
    return (
      <div className="bx-editor">
        <div className="bx-row">
          <Field label="Line" id={`${fid}-s`}>
            <select
              id={`${fid}-s`}
              className="ap-input"
              value={b.line || "solid"}
              onChange={(e) => onPatch({ line: e.target.value })}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
              <option value="double">Double</option>
            </select>
          </Field>
          <Field label="Color (#rrggbb)" id={`${fid}-c`}>
            <input
              id={`${fid}-c`}
              className="ap-input"
              value={b.color || ""}
              placeholder="Text color"
              onChange={(e) => onPatch({ color: e.target.value.trim() })}
            />
          </Field>
        </div>
        <Field
          label={`Thickness: ${clampNum(b.thickness, 1, 12, 2)}px`}
          id={`${fid}-t`}
        >
          <input
            id={`${fid}-t`}
            type="range"
            min={1}
            max={12}
            value={clampNum(b.thickness, 1, 12, 2)}
            onChange={(e) => onPatch({ thickness: Number(e.target.value) })}
          />
        </Field>
        <Field
          label={`Width: ${clampNum(b.width, 10, 100, 100)}%`}
          id={`${fid}-w`}
        >
          <input
            id={`${fid}-w`}
            type="range"
            min={10}
            max={100}
            value={clampNum(b.width, 10, 100, 100)}
            onChange={(e) => onPatch({ width: Number(e.target.value) })}
          />
        </Field>
      </div>
    );
  }

  if (type === "videos")
    return <VideoGalleryEditor block={b} onPatch={onPatch} fid={fid} />;

  if (type === "spacer") {
    return (
      <div className="bx-editor bx-row">
        <Field label="Height (pixels)" id={`${fid}-h`} hint="0 to 240">
          <input
            id={`${fid}-h`}
            className="ap-input"
            type="number"
            min={0}
            max={240}
            step={4}
            value={b.height ?? 40}
            onChange={(e) =>
              onPatch({ height: clampNum(e.target.value, 0, 240, 40) })
            }
          />
        </Field>
        <label className="bx-check">
          <input
            type="checkbox"
            checked={!!b.divider}
            onChange={(e) => onPatch({ divider: e.target.checked })}
          />
          Show a divider line
        </label>
      </div>
    );
  }

  if (type === "quote") {
    return (
      <div className="bx-editor">
        <Field label="Quote" id={`${fid}-text`}>
          <textarea
            id={`${fid}-text`}
            className="ap-textarea"
            rows={3}
            value={b.text || ""}
            placeholder="What they said…"
            onChange={(e) => onPatch({ text: e.target.value })}
          />
        </Field>
        <div className="bx-row">
          <Field label="Name" id={`${fid}-name`}>
            <input
              id={`${fid}-name`}
              className="ap-input"
              value={b.name || ""}
              onChange={(e) => onPatch({ name: e.target.value })}
            />
          </Field>
          <Field label="Role or place" id={`${fid}-role`}>
            <input
              id={`${fid}-role`}
              className="ap-input"
              value={b.role || ""}
              placeholder="Member since 2015"
              onChange={(e) => onPatch({ role: e.target.value })}
            />
          </Field>
          <Field label="Alignment" id={`${fid}-align`}>
            <select
              id={`${fid}-align`}
              className="ap-input"
              value={b.align || "center"}
              onChange={(e) => onPatch({ align: e.target.value })}
            >
              <option value="center">Centered</option>
              <option value="left">Left</option>
            </select>
          </Field>
        </div>
        <div className="bx-photoRow">
          {b.image_url ? (
            <img src={mediaSrc(b.image_url)} alt="" className="bx-quotePhoto" />
          ) : null}
          {pickFromLibrary ? (
            <button
              type="button"
              className="ap-btn"
              onClick={async () => {
                const pick = await pickFromLibrary({ title: "Choose a photo" });
                if (pick?.url) onPatch({ image_url: pick.url });
              }}
            >
              {b.image_url ? "Change photo" : "Add photo from library"}
            </button>
          ) : null}
          {b.image_url ? (
            <button
              type="button"
              className="ap-btn"
              onClick={() => onPatch({ image_url: "" })}
            >
              Remove photo
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (type === "faq") {
    const items = Array.isArray(b.items) ? b.items : [];
    const setItems = (next) => onPatch({ items: next });
    const newId = () =>
      `faq-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    return (
      <div className="bx-editor">
        {items.map((it, i) => (
          <div className="bx-faqEdit" key={it.id || i}>
            <div className="bx-faqEditHead">
              <strong>Question {i + 1}</strong>
              <span className="bx-faqEditActions">
                <button
                  type="button"
                  className="ap-btn"
                  disabled={i === 0}
                  aria-label={`Move question ${i + 1} up`}
                  onClick={() => {
                    const n = [...items];
                    [n[i - 1], n[i]] = [n[i], n[i - 1]];
                    setItems(n);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="ap-btn"
                  disabled={i === items.length - 1}
                  aria-label={`Move question ${i + 1} down`}
                  onClick={() => {
                    const n = [...items];
                    [n[i + 1], n[i]] = [n[i], n[i + 1]];
                    setItems(n);
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="ap-btn ap-btnDanger"
                  aria-label={`Remove question ${i + 1}`}
                  onClick={() => setItems(items.filter((_, k) => k !== i))}
                >
                  Remove
                </button>
              </span>
            </div>
            <input
              className="ap-input"
              aria-label={`Question ${i + 1}`}
              value={it.q || ""}
              placeholder="Question"
              onChange={(e) =>
                setItems(
                  items.map((x, k) =>
                    k === i ? { ...x, q: e.target.value } : x,
                  ),
                )
              }
            />
            <textarea
              className="ap-textarea"
              aria-label={`Answer ${i + 1}`}
              rows={3}
              value={it.a || ""}
              placeholder="Answer"
              onChange={(e) =>
                setItems(
                  items.map((x, k) =>
                    k === i ? { ...x, a: e.target.value } : x,
                  ),
                )
              }
            />
          </div>
        ))}
        <div className="bx-row">
          <button
            type="button"
            className="ap-btn ap-btnPrimary"
            onClick={() => setItems([...items, { id: newId(), q: "", a: "" }])}
          >
            + Add question
          </button>
          <label className="bx-check">
            <input
              type="checkbox"
              checked={!!b.open_first}
              onChange={(e) => onPatch({ open_first: e.target.checked })}
            />
            Open the first question by default
          </label>
        </div>
      </div>
    );
  }
  return null;
}

function VideoGalleryEditor({ block, onPatch, fid }) {
  const b = block || {};
  const [collections, setCollections] = useState(null);
  useEffect(() => {
    let alive = true;
    api
      .get("/playlists/public", { params: { limit: 200 } })
      .then(
        ({ data }) =>
          alive && setCollections(Array.isArray(data?.items) ? data.items : []),
      )
      .catch(() => alive && setCollections([]));
    return () => {
      alive = false;
    };
  }, []);
  const source = b.source === "collection" ? "collection" : "latest";
  return (
    <div className="bx-editor">
      <Field label="Videos to show" id={`${fid}-src`}>
        <select
          id={`${fid}-src`}
          className="ap-input"
          value={source}
          onChange={(e) => onPatch({ source: e.target.value })}
        >
          <option value="latest">All videos</option>
          <option value="collection">A collection</option>
        </select>
      </Field>
      {source === "collection" ? (
        <Field
          label="Collection"
          id={`${fid}-col`}
          hint={
            collections && !collections.length
              ? "No public collections yet."
              : ""
          }
        >
          <select
            id={`${fid}-col`}
            className="ap-input"
            value={String(b.collection || "")}
            onChange={(e) => onPatch({ collection: e.target.value })}
          >
            <option value="">Choose a collection…</option>
            {(collections || []).map((c) => (
              <option key={c.id} value={c.slug || c.id}>
                {c.title} ({c.item_count || 0})
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label="Order" id={`${fid}-o`}>
        <select
          id={`${fid}-o`}
          className="ap-input"
          value={VIDEO_ORDERS[b.order] ? b.order : "newest"}
          onChange={(e) => onPatch({ order: e.target.value })}
        >
          {Object.entries(VIDEO_ORDERS).map(([k, o]) => (
            <option key={k} value={k}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="bx-row">
        <Field label="How many" id={`${fid}-n`} hint="Up to 24.">
          <input
            id={`${fid}-n`}
            className="ap-input"
            type="number"
            min={1}
            max={24}
            value={b.count || 6}
            onChange={(e) => onPatch({ count: Number(e.target.value) })}
          />
        </Field>
        <Field label="Per row" id={`${fid}-c`}>
          <select
            id={`${fid}-c`}
            className="ap-input"
            value={String(b.cols || 3)}
            onChange={(e) => onPatch({ cols: Number(e.target.value) })}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="bx-check">
        <input
          type="checkbox"
          checked={b.show_titles !== false}
          onChange={(e) => onPatch({ show_titles: e.target.checked })}
        />
        Show video titles
      </label>
      <p className="bx-hint" style={{ margin: 0 }}>
        Videos come from your video library (Bunny); each opens its watch page.
        New videos appear automatically.
      </p>
    </div>
  );
}
