// src/components/builder/storyBlocks.js
//
// Page-editor blocks for story pages (About Bishop, Pastoral Leadership):
// eyebrow, buttons, numbers, timeline, tags, then & now, video card, feature
// cards, book shelf and call to action. Each block is plain data (editable in
// the visual editor's panel) + a renderer for the site. Wired in through
// moreBlocks.js (MORE_TYPES / defaultMoreBlock / MoreBlockPublic / Editor).
import React, { useContext, useId } from "react";
import { Link } from "react-router-dom";
import { MediaPickerContext } from "../media/MediaPicker";
import { mediaSrc } from "../../lib/mediaApi";
import "./storyBlocks.css";

let seq = 0;
const nid = () => `sb${Date.now().toString(36)}${(seq++).toString(36)}`;

/* ---------- icons (inline stroke SVG) ---------- */
const ICON_PATHS = {
  check: ["M5 12l5 5L20 7"],
  chart: ["M3 3v18h18", "M7 15l4-4 3 3 6-6"],
  team: [
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6",
    "M17 11.5a2.5 2.5 0 1 0 0-5",
    "M15 14.5c3 .2 6 2.4 6 5.5",
  ],
  building: ["M3 21h18", "M5 21V10l7-5 7 5v11", "M10 21v-6h4v6"],
  coins: [
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
    "M12 7v10",
    "M9.5 9.5c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2-1.1 1.8-2.5 2.2-2.5 1-2.5 2.3 1.1 2 2.5 2 2.5-.8 2.5-2",
  ],
  book: ["M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z", "M4 19V5"],
  globe: [
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
    "M3 12h18",
    "M12 3c2.5 2.5 3.8 5.5 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z",
  ],
  heart: [
    "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  ],
  pin: [
    "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z",
    "M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  ],
  calendar: [
    "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
    "M3 10h18",
    "M8 3v4",
    "M16 3v4",
  ],
  phone: [
    "M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z",
  ],
  mail: ["M4 5h16v14H4z", "M4 7l8 6 8-6"],
  share: [
    "M18 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
    "M6 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
    "M18 16.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
    "M8.2 10.8l7.6-4.4",
    "M8.2 13.2l7.6 4.4",
  ],
  star: [
    "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z",
  ],
};
export const STORY_ICON_KEYS = Object.keys(ICON_PATHS);
function Icon({ name, size = 26 }) {
  const paths = ICON_PATHS[name] || ICON_PATHS.check;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// internal paths go through the router (the site uses #/ addresses)
function SmartLink({ href, className, children, ...rest }) {
  const h = String(href || "").trim();
  if (h.startsWith("/") && !h.startsWith("//"))
    return (
      <Link to={h} className={className} {...rest}>
        {children}
      </Link>
    );
  const ext = /^https?:\/\//i.test(h);
  return (
    <a
      href={h || "#"}
      className={className}
      {...(ext ? { target: "_blank", rel: "noreferrer" } : {})}
      {...rest}
    >
      {children}
    </a>
  );
}

/* ---------- the blocks: label, editing fields, starting content ---------- */
const BUTTON_FIELDS = [
  ["label", "Label"],
  ["href", "Link (/catalog, https://…, tel:…)"],
  ["style", "Style", "select", ["primary", "outline"]],
];
const SCHEMA = {
  eyebrow: {
    label: "Eyebrow",
    glyph: "ᵃ",
    fields: [
      ["text", "Text"],
      ["align", "Alignment", "select", ["left", "center"]],
    ],
    make: () => ({ text: "ABOUT", align: "left" }),
  },
  buttons: {
    label: "Buttons",
    glyph: "▭▭",
    fields: [["align", "Alignment", "select", ["left", "center", "right"]]],
    lists: [
      {
        key: "buttons",
        label: "Button",
        fields: BUTTON_FIELDS,
        make: () => ({ label: "Button", href: "/", style: "primary" }),
      },
    ],
    make: () => ({
      align: "left",
      buttons: [
        {
          id: nid(),
          label: "Watch messages",
          href: "/catalog",
          style: "primary",
        },
      ],
    }),
  },
  stats: {
    label: "Numbers",
    glyph: "123",
    fields: [["cols", "Columns", "select", ["2", "3", "4"]]],
    lists: [
      {
        key: "items",
        label: "Number",
        fields: [
          ["value", "Number"],
          ["label", "Text"],
        ],
        make: () => ({ value: "10", label: "Describe the number" }),
      },
    ],
    make: () => ({
      cols: "4",
      items: [{ id: nid(), value: "10", label: "Describe the number" }],
    }),
  },
  timeline: {
    label: "Timeline",
    glyph: "⟶",
    lists: [
      {
        key: "items",
        label: "Step",
        fields: [
          ["when", "Year / label"],
          ["text", "Text", "textarea"],
        ],
        make: () => ({ when: "2026", text: "What happened" }),
      },
    ],
    make: () => ({
      items: [{ id: nid(), when: "2026", text: "What happened" }],
    }),
  },
  tags: {
    label: "Tags",
    glyph: "#",
    fields: [["caption", "Caption under the tags (optional)"]],
    lists: [
      {
        key: "items",
        label: "Tag",
        fields: [["text", "Text"]],
        make: () => ({ text: "Tag" }),
      },
    ],
    make: () => ({ caption: "", items: [{ id: nid(), text: "Tag" }] }),
  },
  compare: {
    label: "Then & now",
    glyph: "⇢",
    fields: [
      ["before_label", "Then — heading"],
      ["after_label", "Now — heading"],
      ["after_text", "Now — text (optional)", "textarea"],
    ],
    lists: [
      {
        key: "before_items",
        label: "Then — number",
        fields: [
          ["value", "Number"],
          ["label", "Text"],
        ],
        make: () => ({ value: "1", label: "Then" }),
      },
      {
        key: "after_items",
        label: "Now — number",
        fields: [
          ["value", "Number"],
          ["label", "Text"],
        ],
        make: () => ({ value: "10", label: "Now" }),
      },
    ],
    make: () => ({
      before_label: "Then",
      after_label: "Today",
      after_text: "",
      before_items: [{ id: nid(), value: "1", label: "Then" }],
      after_items: [{ id: nid(), value: "10", label: "Now" }],
    }),
  },
  videocard: {
    label: "Video card",
    glyph: "▶",
    fields: [
      ["image_url", "Photo", "image"],
      ["kicker", "Small heading"],
      ["title", "Title"],
      ["subtitle", "Line under the title (optional)"],
      ["link", "Video link"],
    ],
    make: () => ({
      image_url: "",
      kicker: "VIDEO",
      title: "Watch the video",
      subtitle: "",
      link: "",
    }),
  },
  features: {
    label: "Feature cards",
    glyph: "◫",
    fields: [["cols", "Columns", "select", ["2", "3", "4"]]],
    lists: [
      {
        key: "items",
        label: "Card",
        fields: [
          ["icon", "Icon", "select", STORY_ICON_KEYS],
          ["title", "Title"],
          ["text", "Text", "textarea"],
        ],
        make: () => ({ icon: "check", title: "Title", text: "Describe it." }),
      },
    ],
    make: () => ({
      cols: "3",
      items: [
        { id: nid(), icon: "check", title: "Title", text: "Describe it." },
      ],
    }),
  },
  books: {
    label: "Book shelf",
    glyph: "▮▮",
    lists: [
      {
        key: "items",
        label: "Book",
        fields: [
          ["title", "Title"],
          ["text", "Text", "textarea"],
          ["image_url", "Cover (optional)", "image"],
          ["badge", "Badge (optional, e.g. ON CD)"],
        ],
        make: () => ({
          title: "Book title",
          text: "",
          image_url: "",
          badge: "",
        }),
      },
    ],
    make: () => ({
      items: [
        { id: nid(), title: "Book title", text: "", image_url: "", badge: "" },
      ],
    }),
  },
  contactcards: {
    label: "Contact cards",
    glyph: "☎",
    lists: [
      {
        key: "items",
        label: "Card",
        fields: [
          ["icon", "Icon", "select", STORY_ICON_KEYS],
          ["label", "Label"],
          ["value", "Value (shown)"],
          ["link", "Link (mailto:, tel:, https://…)"],
          ["note", "Note (optional)"],
        ],
        make: () => ({
          icon: "mail",
          label: "Email",
          value: "",
          link: "",
          note: "",
        }),
      },
    ],
    make: () => ({
      items: [
        {
          id: nid(),
          icon: "mail",
          label: "Email",
          value: "you@example.com",
          link: "mailto:you@example.com",
          note: "",
        },
      ],
    }),
  },
  ctaband: {
    label: "Call to action",
    glyph: "➜",
    fields: [
      ["title", "Title"],
      ["text", "Text", "textarea"],
    ],
    lists: [
      {
        key: "buttons",
        label: "Button",
        fields: BUTTON_FIELDS,
        make: () => ({ label: "Button", href: "/", style: "primary" }),
      },
    ],
    make: () => ({
      title: "Title",
      text: "",
      buttons: [
        {
          id: nid(),
          label: "Watch messages",
          href: "/catalog",
          style: "primary",
        },
      ],
    }),
  },
};

export const STORY_TYPES = new Set(Object.keys(SCHEMA));
export const STORY_LABELS = Object.fromEntries(
  Object.entries(SCHEMA).map(([k, v]) => [k, v.label]),
);
export const STORY_PANEL = Object.entries(SCHEMA).map(([k, v]) => [
  k,
  v.label,
  v.glyph,
]);
export function defaultStoryBlock(type, id) {
  const s = SCHEMA[type];
  return { id, type, ...(s ? s.make() : {}) };
}
const listOf = (v) => (Array.isArray(v) ? v : []);

/* ---------- on the site ---------- */
function Btns({ buttons, align = "left" }) {
  const list = listOf(buttons).filter((x) => x && x.label);
  if (!list.length) return null;
  return (
    <div className={`sb-btns is-${align}`}>
      {list.map((x) => (
        <SmartLink
          key={x.id || x.label}
          href={x.href}
          className={`sb-btn ${x.style === "outline" ? "sb-btn--outline" : "sb-btn--primary"}`}
        >
          {x.label}
        </SmartLink>
      ))}
    </div>
  );
}

export function StoryBlockPublic({ block }) {
  const b = block || {};
  switch (b.type) {
    case "eyebrow":
      return <p className={`sb-eyebrow is-${b.align || "left"}`}>{b.text}</p>;
    case "buttons":
      return <Btns buttons={b.buttons} align={b.align} />;
    case "stats":
      return (
        <div className="sb-stats" style={{ "--sb-cols": Number(b.cols) || 4 }}>
          {listOf(b.items).map((it) => (
            <div key={it.id || it.value} className="sb-stat">
              <div className="sb-statValue">{it.value}</div>
              <div className="sb-statLabel">{it.label}</div>
            </div>
          ))}
        </div>
      );
    case "timeline":
      return (
        <ol
          className="sb-timeline"
          style={{ "--sb-cols": Math.max(1, listOf(b.items).length) }}
        >
          {listOf(b.items).map((it) => (
            <li key={it.id || it.when} className="sb-step">
              <div className="sb-when">{it.when}</div>
              <div className="sb-stepText">{it.text}</div>
            </li>
          ))}
        </ol>
      );
    case "tags":
      return (
        <div className="sb-tagsWrap">
          <ul className="sb-tags">
            {listOf(b.items).map((it) => (
              <li key={it.id || it.text} className="sb-tag">
                {it.text}
              </li>
            ))}
          </ul>
          {b.caption ? <p className="sb-caption">{b.caption}</p> : null}
        </div>
      );
    case "compare": {
      const nums = (items) => (
        <div className="sb-cmpNums">
          {listOf(items).map((it) => (
            <div key={it.id || it.value}>
              <div className="sb-cmpValue">{it.value}</div>
              <div className="sb-cmpLabel">{it.label}</div>
            </div>
          ))}
        </div>
      );
      return (
        <div className="sb-compare">
          <div className="sb-cmpCard">
            <span className="sb-cmpHead">{b.before_label}</span>
            {nums(b.before_items)}
          </div>
          <div className="sb-cmpArrow" aria-hidden="true">
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </div>
          <div className="sb-cmpCard is-now">
            <span className="sb-cmpHead">{b.after_label}</span>
            {nums(b.after_items)}
            {b.after_text ? <p className="sb-cmpText">{b.after_text}</p> : null}
          </div>
        </div>
      );
    }
    case "videocard": {
      const img = mediaSrc(b.image_url);
      return (
        <SmartLink
          href={b.link}
          className="sb-video"
          aria-label={b.title || "Watch the video"}
        >
          {img ? (
            <img src={img} alt="" loading="lazy" />
          ) : (
            <span className="sb-videoEmpty" />
          )}
          <span className="sb-videoShade" />
          <span className="sb-videoBody">
            <span className="sb-play" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" fill="#fff" />
              </svg>
            </span>
            <span className="sb-videoText">
              {b.kicker ? (
                <span className="sb-videoKicker">{b.kicker}</span>
              ) : null}
              <span className="sb-videoTitle">{b.title}</span>
              {b.subtitle ? (
                <span className="sb-videoSub">{b.subtitle}</span>
              ) : null}
            </span>
          </span>
        </SmartLink>
      );
    }
    case "features":
      return (
        <div
          className="sb-features"
          style={{ "--sb-cols": Number(b.cols) || 3 }}
        >
          {listOf(b.items).map((it) => (
            <div key={it.id || it.title} className="sb-feature">
              <span className="sb-featureIcon">
                <Icon name={it.icon} />
              </span>
              <h3 className="sb-featureTitle">{it.title}</h3>
              {it.text ? <p className="sb-featureText">{it.text}</p> : null}
            </div>
          ))}
        </div>
      );
    case "books":
      return (
        <div
          className="sb-books"
          style={{
            "--sb-cols": Math.min(5, Math.max(2, listOf(b.items).length)),
          }}
        >
          {listOf(b.items).map((it, i) => {
            const img = mediaSrc(it.image_url);
            return (
              <div key={it.id || it.title} className="sb-book">
                <div className={`sb-cover sb-cover--${i % 5}`}>
                  {img ? (
                    <img src={img} alt={`${it.title} cover`} loading="lazy" />
                  ) : (
                    <>
                      {it.badge ? (
                        <span className="sb-coverBadge">{it.badge}</span>
                      ) : (
                        <span />
                      )}
                      <span className="sb-coverTitle">{it.title}</span>
                    </>
                  )}
                </div>
                {img ? <div className="sb-bookTitle">{it.title}</div> : null}
                {it.text ? <div className="sb-bookText">{it.text}</div> : null}
              </div>
            );
          })}
        </div>
      );
    case "contactcards":
      return (
        <ul className="sb-contact">
          {listOf(b.items).map((it) => (
            <li key={it.id || it.label} className="sb-contactCard">
              <span className="sb-contactIcon">
                <Icon name={it.icon} size={22} />
              </span>
              <span className="sb-contactText">
                <span className="sb-contactLabel">{it.label}</span>
                {it.link ? (
                  <SmartLink href={it.link} className="sb-contactValue">
                    {it.value}
                  </SmartLink>
                ) : (
                  <span className="sb-contactValue">{it.value}</span>
                )}
                {it.note ? (
                  <span className="sb-contactNote">{it.note}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      );
    case "ctaband":
      return (
        <div className="sb-cta">
          <div className="sb-ctaText">
            <h2 className="sb-ctaTitle">{b.title}</h2>
            {b.text ? <p>{b.text}</p> : null}
          </div>
          <Btns buttons={b.buttons} align="left" />
        </div>
      );
    default:
      return null;
  }
}

/* ---------- in the editor ---------- */
function FieldInput({ f, value, onChange, idBase }) {
  const [key, label, kind, options] = f;
  const pick = useContext(MediaPickerContext);
  const id = `${idBase}-${key}`;
  return (
    <div className="bx-field sb-field">
      <label className="bx-label" htmlFor={id}>
        {label}
      </label>
      {kind === "textarea" ? (
        <textarea
          id={id}
          className="ap-input"
          rows={3}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : kind === "select" ? (
        <select
          id={id}
          className="ap-input"
          value={String(value ?? options[0])}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : kind === "image" ? (
        <div className="sb-imageField">
          <input
            id={id}
            className="ap-input"
            value={value ?? ""}
            placeholder="Image address"
            onChange={(e) => onChange(e.target.value)}
          />
          {pick ? (
            <button
              type="button"
              className="ap-btn"
              onClick={async () => {
                const r = await pick({ title: `Choose: ${label}` });
                if (r?.url) onChange(r.url);
              }}
            >
              Media Library
            </button>
          ) : null}
        </div>
      ) : (
        <input
          id={id}
          className="ap-input"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export function StoryBlockEditor({ block, onPatch }) {
  const b = block || {};
  const s = SCHEMA[b.type];
  const uid = useId().replace(/[^a-z0-9]/gi, "");
  if (!s) return null;
  return (
    <div className="bx-editor sb-editor">
      {(s.fields || []).map((f) => (
        <FieldInput
          key={f[0]}
          f={f}
          value={b[f[0]]}
          idBase={`sb${uid}`}
          onChange={(v) => onPatch({ [f[0]]: v })}
        />
      ))}
      {(s.lists || []).map((L) => {
        const items = listOf(b[L.key]);
        const setItems = (next) => onPatch({ [L.key]: next });
        return (
          <fieldset key={L.key} className="sb-list">
            <legend className="bx-label">{L.label}s</legend>
            {items.map((it, i) => (
              <div key={it.id || i} className="sb-item">
                <div className="sb-itemHead">
                  <strong>
                    {L.label} {i + 1}
                  </strong>
                  <span className="sb-itemTools">
                    <button
                      type="button"
                      className="ap-btn"
                      aria-label={`Move ${L.label} ${i + 1} up`}
                      disabled={i === 0}
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
                      aria-label={`Move ${L.label} ${i + 1} down`}
                      disabled={i === items.length - 1}
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
                      className="ap-btn"
                      aria-label={`Remove ${L.label} ${i + 1}`}
                      onClick={() => setItems(items.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </span>
                </div>
                {L.fields.map((f) => (
                  <FieldInput
                    key={f[0]}
                    f={f}
                    value={it[f[0]]}
                    idBase={`sb${uid}-${L.key}-${i}`}
                    onChange={(v) =>
                      setItems(
                        items.map((x, j) =>
                          j === i ? { ...x, [f[0]]: v } : x,
                        ),
                      )
                    }
                  />
                ))}
              </div>
            ))}
            <button
              type="button"
              className="ap-btn ap-btnPrimary"
              onClick={() => setItems([...items, { id: nid(), ...L.make() }])}
            >
              + Add {L.label.toLowerCase()}
            </button>
          </fieldset>
        );
      })}
    </div>
  );
}
