// src/components/builder/designControls.js
//
// Visual editor (Stage 3): Elementor-style design controls shown in the
// inspector. Every change patches the draft immediately, so the visual page
// updates as you drag a slider or pick a color.
//   SectionDesign  background, spacing, width, text, corners, border, shadow
//   BlockSpacing   space above / below any block
// (Buttons keep their existing "Visual button styling" controls.)
// Values use the same style keys the public renderer already understands.

import { useSiteOptions } from "../../lib/siteOptions";
import React, { useContext, useId } from "react";
import { MediaPickerContext } from "../media/MediaPicker";
import { mediaSrc } from "../../lib/mediaApi";
import "./designControls.css";

const num = (v, d = 0) => {
  const n = Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : d;
};

// "22px 18px" / "22px 18px 30px" / "10px 12px 14px 16px" → {top, side, bottom}
export function parsePadding(
  value,
  fallback = { top: 22, side: 18, bottom: 22 },
) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => num(p, NaN));
  if (!parts.length || parts.some((n) => Number.isNaN(n)))
    return { ...fallback };
  const [a, b = a, c = a, d = b] = parts;
  return { top: a, side: Math.round((b + d) / 2), bottom: c };
}
export const padString = ({ top, side, bottom }) =>
  `${top}px ${side}px ${bottom}px`;

// "18px auto" → {top, bottom}
export function parseMargin(value, fallback = { top: 18, bottom: 18 }) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { ...fallback };
  const t = num(parts[0], fallback.top);
  const btm = parts.length >= 3 ? num(parts[2], t) : t;
  return { top: t, bottom: btm };
}
export const marginString = ({ top, bottom }) => `${top}px auto ${bottom}px`;

function Slider({ label, value, min, max, step = 1, unit = "px", onChange }) {
  const id = useId();
  return (
    <div className="dc-row">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output htmlFor={id}>
        {value}
        {unit}
      </output>
    </div>
  );
}

// Global colors from Site Settings (shown as swatches; linked when used).
function useGlobalColors() {
  const o = useSiteOptions();
  return Array.isArray(o?.global_colors) ? o.global_colors : [];
}

function ColorField({ label, value, onChange, placeholder = "Default" }) {
  const id = useId();
  const palette = useGlobalColors();
  const v = String(value || "");
  const linked = palette.find((c) => v === `var(--bx-gc-${c.slug})`);
  const safe = linked ? linked.hex : /^#[0-9a-f]{6}$/i.test(v) ? v : "#000000";
  return (
    <div className="dc-row dc-colorRow">
      <label htmlFor={id}>{label}</label>
      <input
        type="color"
        aria-label={`${label} picker`}
        value={safe}
        onChange={(e) => onChange(e.target.value)}
      />
      {linked ? (
        <span
          className="dc-globalChip"
          id={id}
          title="Linked to a global color (Site Settings)"
        >
          <span
            className="dc-swatch"
            style={{ background: linked.hex }}
            aria-hidden="true"
          />
          {linked.name}
        </span>
      ) : (
        <input
          id={id}
          className="dc-hex"
          value={v}
          placeholder={placeholder}
          maxLength={40}
          onChange={(e) => onChange(e.target.value.trim())}
        />
      )}
      {v ? (
        <button
          type="button"
          className="dc-clear"
          onClick={() => onChange("")}
          aria-label={`Reset ${label}`}
        >
          Reset
        </button>
      ) : null}
      {palette.length ? (
        <div
          className="dc-palette"
          role="group"
          aria-label={`${label}: global colors`}
        >
          {palette.map((c) => (
            <button
              key={c.slug}
              type="button"
              className={`dc-swatch dc-swatchBtn${linked?.slug === c.slug ? " is-on" : ""}`}
              style={{ background: c.hex }}
              aria-label={`Use global color ${c.name}`}
              aria-pressed={linked?.slug === c.slug}
              title={c.name}
              onClick={() => onChange(`var(--bx-gc-${c.slug})`)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Segmented({ label, value, options, onChange }) {
  return (
    <div className="dc-row">
      <span className="dc-label">{label}</span>
      <div className="dc-seg" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            className={value === v ? "is-on" : ""}
            onClick={() => onChange(v)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

const WIDTHS = [
  ["760px", "Narrow"],
  ["1100px", "Normal"],
  ["1280px", "Wide"],
  ["100%", "Full"],
];

export function SectionDesign({ styles, layout, onPatchStyles }) {
  const st = styles && typeof styles === "object" ? styles : {};
  const pickFromLibrary = useContext(MediaPickerContext);
  const isFull = layout === "full";
  const isPlain = layout === "plain";
  const pad = parsePadding(
    st.padding,
    isFull
      ? { top: 48, side: 0, bottom: 48 }
      : isPlain
        ? { top: 22, side: 0, bottom: 22 }
        : undefined,
  );
  const mar = parseMargin(
    st.margin,
    isFull ? { top: 0, bottom: 0 } : undefined,
  );
  const width = String(st.max_width || "").trim() || "1100px";

  return (
    <div className="dc-panel" aria-label="Section design">
      <div data-pane="style">
        <h4>Background</h4>
        <ColorField
          label="Color"
          value={st.bg_color}
          onChange={(v) => onPatchStyles({ bg_color: v })}
          placeholder="None"
        />
        <div className="dc-row dc-imageRow">
          <span className="dc-label">Image</span>
          {st.bg_image_url ? (
            <img src={mediaSrc(st.bg_image_url)} alt="" />
          ) : null}
          {pickFromLibrary ? (
            <button
              type="button"
              className="ap-btn"
              onClick={async () => {
                const pick = await pickFromLibrary({
                  title: "Choose a section background",
                });
                if (pick?.url)
                  onPatchStyles({
                    bg_image_url: pick.url,
                    bg_image_fit: st.bg_image_fit || "cover",
                  });
              }}
            >
              {st.bg_image_url ? "Change" : "Choose"}
            </button>
          ) : null}
          {st.bg_image_url ? (
            <button
              type="button"
              className="ap-btn"
              onClick={() => onPatchStyles({ bg_image_url: "" })}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <div data-pane="advanced">
        <h4>Spacing</h4>
        <Slider
          label="Inside, top"
          value={pad.top}
          min={0}
          max={200}
          onChange={(v) =>
            onPatchStyles({ padding: padString({ ...pad, top: v }) })
          }
        />
        <Slider
          label="Inside, bottom"
          value={pad.bottom}
          min={0}
          max={200}
          onChange={(v) =>
            onPatchStyles({ padding: padString({ ...pad, bottom: v }) })
          }
        />
        <Slider
          label="Inside, sides"
          value={pad.side}
          min={0}
          max={120}
          onChange={(v) =>
            onPatchStyles({ padding: padString({ ...pad, side: v }) })
          }
        />
        {!isFull ? (
          <>
            <Slider
              label="Space above"
              value={mar.top}
              min={0}
              max={160}
              onChange={(v) =>
                onPatchStyles({ margin: marginString({ ...mar, top: v }) })
              }
            />
            <Slider
              label="Space below"
              value={mar.bottom}
              min={0}
              max={160}
              onChange={(v) =>
                onPatchStyles({ margin: marginString({ ...mar, bottom: v }) })
              }
            />
          </>
        ) : null}
      </div>
      {!isFull ? (
        <div data-pane="layout">
          <h4>Width</h4>
          <Segmented
            label="Content width"
            value={width}
            options={WIDTHS}
            onChange={(v) => onPatchStyles({ max_width: v })}
          />
        </div>
      ) : null}
      <div data-pane="style">
        <h4>Text</h4>
        <ColorField
          label="Text color"
          value={st.text_color}
          onChange={(v) => onPatchStyles({ text_color: v })}
        />
        <ColorField
          label="Title color"
          value={st.title_color}
          onChange={(v) => onPatchStyles({ title_color: v })}
        />
        <Segmented
          label="Alignment"
          value={st.align || "center"}
          options={[
            ["left", "Left"],
            ["center", "Center"],
            ["right", "Right"],
          ]}
          onChange={(v) => onPatchStyles({ align: v })}
        />
        <label className="dc-check">
          <input
            type="checkbox"
            checked={st.show_title !== false}
            onChange={(e) => onPatchStyles({ show_title: e.target.checked })}
          />
          Show the section title
        </label>

        <h4>Frame</h4>
        <Slider
          label="Rounded corners"
          value={num(st.radius, 14)}
          min={0}
          max={48}
          onChange={(v) => onPatchStyles({ radius: v })}
        />
        <ColorField
          label="Border color"
          value={st.border_color}
          onChange={(v) => onPatchStyles({ border_color: v })}
          placeholder="None"
        />
        <Slider
          label="Border width"
          value={num(st.border_width, st.border_color ? 1 : 0)}
          min={0}
          max={12}
          onChange={(v) => onPatchStyles({ border_width: v ? String(v) : "" })}
        />
        {!isPlain ? (
          <Segmented
            label="Shadow"
            value={st.shadow === "none" ? "none" : "soft"}
            options={[
              ["soft", "Soft"],
              ["none", "None"],
            ]}
            onChange={(v) => onPatchStyles({ shadow: v })}
          />
        ) : null}
      </div>
    </div>
  );
}

export function BlockSpacing({ styles, onPatchStyles }) {
  const st = styles && typeof styles === "object" ? styles : {};
  return (
    <div className="dc-panel" aria-label="Block spacing">
      <h4>Spacing</h4>
      <Slider
        label="Space above"
        value={num(st.margin_top, 0)}
        min={0}
        max={160}
        onChange={(v) => onPatchStyles({ margin_top: v ? String(v) : "" })}
      />
      <Slider
        label="Space below"
        value={num(st.margin_bottom, 0)}
        min={0}
        max={160}
        onChange={(v) => onPatchStyles({ margin_bottom: v ? String(v) : "" })}
      />
    </div>
  );
}

// Element style (Style panel) for blocks without their own styling controls
// (Video, Quote, FAQ, Cards, Gallery, Spacer, Columns). Stored in block.styles;
// applied by CanvasBlock on the page.
const ELEMENT_FONTS = [
  "Arial",
  "Georgia",
  "Inter",
  "Lato",
  "Merriweather",
  "Montserrat",
  "Open Sans",
  "Playfair Display",
  "Poppins",
  "Roboto",
];

export function ElementStyle({ styles, onPatchStyles }) {
  const st = styles && typeof styles === "object" ? styles : {};
  const fid = useId();
  const hasAny = [
    "font_family",
    "font_size",
    "font_weight",
    "text_color",
    "align",
    "bg_color",
    "padding_px",
    "radius_px",
  ].some((k) => String(st[k] ?? "").trim());
  return (
    <div className="dc-panel" aria-label="Element style">
      <h4>Style</h4>
      <div className="dc-row">
        <label htmlFor={`${fid}-font`}>Font</label>
        <select
          id={`${fid}-font`}
          className="ap-input"
          style={{ gridColumn: "2 / -1" }}
          value={st.font_family || ""}
          onChange={(e) => onPatchStyles({ font_family: e.target.value })}
        >
          <option value="">Website font</option>
          {ELEMENT_FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <Slider
        label="Text size"
        value={num(st.font_size, 0)}
        min={0}
        max={72}
        onChange={(v) => onPatchStyles({ font_size: v >= 10 ? String(v) : "" })}
      />
      <Segmented
        label="Weight"
        value={String(st.font_weight || "")}
        options={[
          ["", "Default"],
          ["400", "Normal"],
          ["600", "Semi-bold"],
          ["700", "Bold"],
          ["800", "Heavy"],
        ]}
        onChange={(v) => onPatchStyles({ font_weight: v })}
      />
      <ColorField
        label="Text color"
        value={st.text_color}
        onChange={(v) => onPatchStyles({ text_color: v })}
      />
      <Segmented
        label="Alignment"
        value={st.align || ""}
        options={[
          ["", "Default"],
          ["left", "Left"],
          ["center", "Center"],
          ["right", "Right"],
        ]}
        onChange={(v) => onPatchStyles({ align: v })}
      />
      <ColorField
        label="Background"
        value={st.bg_color}
        onChange={(v) => onPatchStyles({ bg_color: v })}
        placeholder="None"
      />
      <Slider
        label="Padding"
        value={num(st.padding_px, 0)}
        min={0}
        max={80}
        onChange={(v) => onPatchStyles({ padding_px: v ? String(v) : "" })}
      />
      <Slider
        label="Corners"
        value={num(st.radius_px, 0)}
        min={0}
        max={40}
        onChange={(v) => onPatchStyles({ radius_px: v ? String(v) : "" })}
      />
      {hasAny ? (
        <button
          type="button"
          className="ap-btn"
          onClick={() =>
            onPatchStyles({
              font_family: "",
              font_size: "",
              font_weight: "",
              text_color: "",
              align: "",
              bg_color: "",
              padding_px: "",
              radius_px: "",
            })
          }
        >
          Reset style
        </button>
      ) : null}
      <p className="dc-note">
        Text size 0 = the element’s normal size. Colors need a #rrggbb code or
        the picker.
      </p>
    </div>
  );
}

// Advanced tab: responsive visibility, like Elementor's "Responsive" group.
export function ResponsiveVisibility({ styles, onPatchStyles }) {
  const st = styles && typeof styles === "object" ? styles : {};
  const opts = [
    ["hide_desktop", "Hide on desktop"],
    ["hide_tablet", "Hide on tablet"],
    ["hide_mobile", "Hide on phone"],
  ];
  return (
    <div className="dc-panel" aria-label="Responsive">
      <h4>Responsive</h4>
      {opts.map(([k, label]) => (
        <label key={k} className="dc-check">
          <input
            type="checkbox"
            checked={!!st[k]}
            onChange={(e) => onPatchStyles({ [k]: e.target.checked })}
          />
          {label}
        </label>
      ))}
      <p className="dc-note">
        Hidden items stay visible (faded) in the editor so you can still edit
        them.
      </p>
    </div>
  );
}

// Advanced tab: CSS ID and classes, for Custom CSS (Site Settings or page CSS).
const CSS_NAME_RE = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
export function CssAttributes({ styles, onPatchStyles }) {
  const st = styles && typeof styles === "object" ? styles : {};
  const id = useId();
  const idVal = String(st.css_id || "");
  const clsVal = String(st.css_class || "");
  const idBad = idVal.trim() && !CSS_NAME_RE.test(idVal.trim());
  const badClasses = clsVal
    .split(/\s+/)
    .filter((c) => c && !CSS_NAME_RE.test(c));
  return (
    <div className="dc-panel" aria-label="Attributes">
      <h4>Attributes</h4>
      <div className="bx-field">
        <label htmlFor={`${id}-i`}>CSS ID</label>
        <input
          id={`${id}-i`}
          className="dc-hex"
          value={idVal}
          placeholder="e.g. welcome"
          aria-invalid={idBad ? "true" : "false"}
          onChange={(e) =>
            onPatchStyles({ css_id: e.target.value.replace(/\s+/g, "") })
          }
        />
        {idBad ? (
          <p className="dc-note" role="alert">
            Use letters, numbers, - or _ (start with a letter).
          </p>
        ) : null}
      </div>
      <div className="bx-field">
        <label htmlFor={`${id}-c`}>CSS classes</label>
        <input
          id={`${id}-c`}
          className="dc-hex"
          value={clsVal}
          placeholder="e.g. gold-title wide"
          aria-invalid={badClasses.length ? "true" : "false"}
          onChange={(e) => onPatchStyles({ css_class: e.target.value })}
        />
        {badClasses.length ? (
          <p className="dc-note" role="alert">
            Ignored: {badClasses.join(", ")}. Use letters, numbers, - or _.
          </p>
        ) : (
          <p className="dc-note">
            Separate classes with spaces. Style them in Site Settings › Custom
            CSS or this page's Custom CSS.
          </p>
        )}
      </div>
    </div>
  );
}

// Release 1.3: Style › Effects (border, shadow, gradient) for any element.
export function ElementEffects({ styles, onPatchStyles }) {
  const st = styles && typeof styles === "object" ? styles : {};
  const fid = useId();
  return (
    <div className="dc-panel" aria-label="Effects">
      <h4>Effects</h4>
      <Segmented
        label="Shadow"
        value={st.shadow || ""}
        options={[
          ["", "None"],
          ["soft", "Soft"],
          ["strong", "Strong"],
        ]}
        onChange={(v) => onPatchStyles({ shadow: v })}
      />
      <Slider
        label="Border width"
        value={num(st.border_w, 0)}
        min={0}
        max={12}
        onChange={(v) => onPatchStyles({ border_w: v ? String(v) : "" })}
      />
      {num(st.border_w, 0) ? (
        <>
          <div className="dc-row">
            <label htmlFor={`${fid}-bs`}>Border style</label>
            <select
              id={`${fid}-bs`}
              className="ap-input"
              style={{ gridColumn: "2 / -1" }}
              value={st.border_style || "solid"}
              onChange={(e) => onPatchStyles({ border_style: e.target.value })}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
          <ColorField
            label="Border color"
            value={st.border_color}
            onChange={(v) => onPatchStyles({ border_color: v })}
            placeholder="Text color"
          />
        </>
      ) : null}
      <ColorField
        label="Gradient from"
        value={st.grad_from}
        onChange={(v) => onPatchStyles({ grad_from: v })}
        placeholder="None"
      />
      <ColorField
        label="Gradient to"
        value={st.grad_to}
        onChange={(v) => onPatchStyles({ grad_to: v })}
        placeholder="None"
      />
      {st.grad_from && st.grad_to ? (
        <Slider
          label="Gradient angle"
          value={num(st.grad_angle, 135)}
          min={0}
          max={360}
          onChange={(v) => onPatchStyles({ grad_angle: String(v) })}
        />
      ) : null}
      <p className="dc-note">
        A gradient needs both colors. Effects apply on all screen sizes.
      </p>
    </div>
  );
}

// Release 1.3: Advanced › Motion effects (entrance animation, hover).
export function MotionEffects({ styles, onPatchStyles }) {
  const st = styles && typeof styles === "object" ? styles : {};
  const fid = useId();
  return (
    <div className="dc-panel" aria-label="Motion effects">
      <h4>Motion effects</h4>
      <div className="dc-row">
        <label htmlFor={`${fid}-a`}>Entrance animation</label>
        <select
          id={`${fid}-a`}
          className="ap-input"
          style={{ gridColumn: "2 / -1" }}
          value={st.anim || ""}
          onChange={(e) => onPatchStyles({ anim: e.target.value })}
        >
          <option value="">None</option>
          <option value="fade">Fade in</option>
          <option value="slide-up">Slide up</option>
          <option value="slide-left">Slide in from the left</option>
          <option value="zoom">Zoom in</option>
        </select>
      </div>
      {st.anim ? (
        <>
          <Slider
            label="Duration (ms)"
            value={num(st.anim_duration, 700)}
            min={200}
            max={2000}
            onChange={(v) => onPatchStyles({ anim_duration: String(v) })}
          />
          <Slider
            label="Delay (ms)"
            value={num(st.anim_delay, 0)}
            min={0}
            max={2000}
            onChange={(v) => onPatchStyles({ anim_delay: String(v) })}
          />
        </>
      ) : null}
      <div className="dc-row">
        <label htmlFor={`${fid}-h`}>Hover effect</label>
        <select
          id={`${fid}-h`}
          className="ap-input"
          style={{ gridColumn: "2 / -1" }}
          value={st.hover || ""}
          onChange={(e) => onPatchStyles({ hover: e.target.value })}
        >
          <option value="">None</option>
          <option value="grow">Grow</option>
          <option value="lift">Lift with shadow</option>
          <option value="glow">Glow</option>
        </select>
      </div>
      <p className="dc-note">
        Animations play as the element scrolls into view. Visitors who turn on
        “reduce motion” see no animation.
      </p>
    </div>
  );
}
