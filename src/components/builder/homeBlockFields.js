// src/components/builder/homeBlockFields.js
//
// Visual editor: edit the Home page's built-in parts (Hero, Join strip,
// Call to action, About) element by element. Field names are the ones the
// public Home page reads (Home.js) and List view already edits.

import React, { useContext, useId } from "react";
import { MediaPickerContext } from "../media/MediaPicker";
import { mediaSrc } from "../../lib/mediaApi";
import { useSiteOptions } from "../../lib/siteOptions";

// [field, label, kind] — kind: text | long | link | image
export const HOME_BLOCK_FIELDS = {
  home_hero: [
    ["kicker", "Small label above the headline", "text"],
    ["title", "Headline", "long"],
    [
      "title_accent",
      "Highlighted words (the end of the headline, shown in purple)",
      "text",
    ],
    ["sub", "Text under the headline", "long"],
    ["cta_text", "Button text", "text"],
    ["cta_href", "Button link", "link"],
    ["background_url", "Background image", "image"],
  ],
  home_join: [
    ["eyebrow", "Small label", "text"],
    ["title", "Title", "text"],
    ["sub", "Text", "long"],
    ["cta_text", "Button text", "text"],
    ["cta_href", "Button link", "link"],
  ],
  home_cta: [
    ["title", "Title", "text"],
    ["sub", "Text", "long"],
    ["cta_text", "Button text", "text"],
    ["cta_href", "Button link", "link"],
  ],
  home_about: [
    ["name", "Name", "text"],
    ["text", "Text", "long"],
    ["avatar_url", "Photo", "image"],
  ],
};

// Fields that may be typed directly on the page (plain text).
export function isTypableHomeField(type, field) {
  const f = (HOME_BLOCK_FIELDS[type] || []).find(([name]) => name === field);
  return !!f && (f[2] === "text" || f[2] === "long");
}

function Field({ block, def, onPatch, pickFromLibrary }) {
  const [name, label, kind] = def;
  const id = useId();
  const value = block?.[name] == null ? "" : String(block[name]);
  if (kind === "image") {
    return (
      <div
        className="bx-field"
        data-home-field={name}
        role="group"
        aria-labelledby={id}
      >
        {/* A group label (not a <label>), so each button keeps its own name. */}
        <span className="bx-label" id={id}>
          {label}
        </span>
        {value ? (
          <img
            src={mediaSrc(value)}
            alt=""
            style={{
              width: "100%",
              maxHeight: 120,
              objectFit: "cover",
              borderRadius: 8,
            }}
          />
        ) : (
          <div className="bx-hint">Using the default image.</div>
        )}
        <div className="bx-row">
          {pickFromLibrary ? (
            <button
              type="button"
              className="ap-btn"
              onClick={async () => {
                const pick = await pickFromLibrary({
                  title: `Choose: ${label}`,
                });
                if (pick?.url) onPatch({ [name]: pick.url });
              }}
            >
              {value ? "Change image" : "Choose image"}
            </button>
          ) : null}
          {value ? (
            <button
              type="button"
              className="ap-btn"
              onClick={() => onPatch({ [name]: "" })}
            >
              Use default
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div className="bx-field" data-home-field={name}>
      <label htmlFor={id}>{label}</label>
      {kind === "long" ? (
        <textarea
          id={id}
          className="ap-textarea"
          rows={name === "text" ? 6 : 3}
          value={value}
          onChange={(e) => onPatch({ [name]: e.target.value })}
        />
      ) : (
        <input
          id={id}
          className="ap-input"
          value={value}
          placeholder={
            kind === "link"
              ? "/catalog or https://…"
              : name === "title_accent"
                ? "Without Limits (default)"
                : ""
          }
          onChange={(e) => onPatch({ [name]: e.target.value })}
        />
      )}
      {kind === "link" ? (
        <div className="bx-hint">
          A page on this site (like /catalog) or a full web address.
        </div>
      ) : null}
    </div>
  );
}

// Hero headline style: the settings Home.js already accepts (whitelisted there).
function HeroHeadingStyle({ block, onPatch }) {
  const id = useId();
  const v = (k) => (block?.[k] == null ? "" : String(block[k]));
  const size = Number(v("heading_size")) || 0;
  return (
    <div className="dc-panel" aria-label="Headline style" data-pane="style">
      <h4>Headline style</h4>
      <div className="bx-field">
        <label htmlFor={`${id}-f`}>Font</label>
        <select
          id={`${id}-f`}
          className="ap-input"
          value={v("heading_font")}
          onChange={(e) => onPatch({ heading_font: e.target.value })}
        >
          <option value="">Default</option>
          {["Poppins", "Montserrat", "Arial", "Georgia"].map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <div className="bx-field">
        <label htmlFor={`${id}-s`}>
          Size: {size ? `${size}px` : "default"}
        </label>
        <input
          id={`${id}-s`}
          type="range"
          min={0}
          max={96}
          value={size}
          onChange={(e) => {
            const n = Number(e.target.value);
            onPatch({ heading_size: n >= 24 ? String(n) : "" });
          }}
        />
        <div className="bx-hint">
          From 24px to 96px; 0 uses the default size.
        </div>
      </div>
      <div className="bx-field">
        <label htmlFor={`${id}-w`}>Weight</label>
        <select
          id={`${id}-w`}
          className="ap-input"
          value={v("heading_weight")}
          onChange={(e) => onPatch({ heading_weight: e.target.value })}
        >
          <option value="">Default</option>
          <option value="400">Normal</option>
          <option value="500">Medium</option>
          <option value="600">Semi-bold</option>
          <option value="700">Bold</option>
          <option value="800">Heavy</option>
        </select>
      </div>
      <div className="bx-field">
        <label htmlFor={`${id}-a`}>Alignment</label>
        <select
          id={`${id}-a`}
          className="ap-input"
          value={v("heading_align")}
          onChange={(e) => onPatch({ heading_align: e.target.value })}
        >
          <option value="">Default</option>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div className="bx-field">
        <label htmlFor={`${id}-c`}>Color (#rrggbb)</label>
        <div className="bx-row">
          <input
            type="color"
            aria-label="Headline color picker"
            value={
              /^#[0-9a-f]{6}$/i.test(v("heading_color"))
                ? v("heading_color")
                : "#ffffff"
            }
            onChange={(e) => onPatch({ heading_color: e.target.value })}
          />
          <input
            id={`${id}-c`}
            className="ap-input"
            value={v("heading_color")}
            placeholder="Default"
            onChange={(e) => onPatch({ heading_color: e.target.value.trim() })}
          />
          {v("heading_color") ? (
            <button
              type="button"
              className="ap-btn"
              onClick={() => onPatch({ heading_color: "" })}
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function HomeBlockEditor({ block, onPatch }) {
  const pickFromLibrary = useContext(MediaPickerContext);
  const defs = HOME_BLOCK_FIELDS[String(block?.type || "")];
  const siteOptions = useSiteOptions();
  const featuredCount = Array.isArray(siteOptions?.featured)
    ? siteOptions.featured.length
    : 0;
  if (!defs) return null;
  return (
    <div className="bx-editor">
      {block?.type === "home_hero" && featuredCount > 0 ? (
        <p className="bx-note" role="note">
          <strong>
            The banner shows {featuredCount} featured message
            {featuredCount === 1 ? "" : "s"}.
          </strong>{" "}
          Change them in{" "}
          <a href="#/admin/site-settings" target="_blank" rel="noreferrer">
            Site Settings › Featured
          </a>
          . The texts below are used only when no messages are featured.
        </p>
      ) : null}
      <p className="bx-hint" style={{ margin: 0 }}>
        An empty field shows nothing on the page. Tip: double-click text on the
        page to type there.
      </p>
      {defs.map((def) => (
        <Field
          key={def[0]}
          block={block}
          def={def}
          onPatch={onPatch}
          pickFromLibrary={pickFromLibrary}
        />
      ))}
      {block?.type === "home_hero" ? (
        <HeroHeadingStyle block={block} onPatch={onPatch} />
      ) : null}
    </div>
  );
}
