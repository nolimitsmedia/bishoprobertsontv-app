// src/components/builder/moreBlocks.js
//
// Release 1.2 Part C: Form, Icon, Icon list, Image slider, Testimonials,
// Countdown, Google Map, Social icons and Embed. Plugged into extraBlocks.js
// (defaults, public display, editor), so they get Style/Advanced, templates,
// nesting and per-device styles like every other element.

import React, {
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Calendar,
  Check,
  Church,
  Clock,
  Facebook,
  Flame,
  Gift,
  Globe,
  HandHeart,
  Headphones,
  Heart,
  Home,
  Info,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Mic,
  Music,
  Phone,
  Play,
  Radio,
  Shield,
  Sparkles,
  Star,
  Sun,
  Tv,
  Twitter,
  Users,
  Video,
  Youtube,
  Zap,
} from "lucide-react";
import api from "../../api";
import { CanvasHint, PageContext, useCanvas } from "./canvasContext";
import { MediaPickerContext } from "../media/MediaPicker";
import { mediaSrc } from "../../lib/mediaApi";
import { GalleryImagesEditor } from "./collectionEditors";
import { fetchLiveStatus } from "../viewer/liveStatus";
import {
  STORY_TYPES,
  STORY_LABELS,
  defaultStoryBlock,
  StoryBlockPublic,
  StoryBlockEditor,
} from "./storyBlocks";
import { isSameSiteUrl } from "../../utils/sanitizeHtml";

export const ICONS = {
  heart: Heart,
  "hand-heart": HandHeart,
  church: Church,
  "book-open": BookOpen,
  play: Play,
  video: Video,
  tv: Tv,
  radio: Radio,
  mic: Mic,
  music: Music,
  headphones: Headphones,
  calendar: Calendar,
  clock: Clock,
  "map-pin": MapPin,
  phone: Phone,
  mail: Mail,
  "message-circle": MessageCircle,
  users: Users,
  gift: Gift,
  star: Star,
  check: Check,
  "arrow-right": ArrowRight,
  globe: Globe,
  home: Home,
  info: Info,
  bell: Bell,
  sparkles: Sparkles,
  flame: Flame,
  sun: Sun,
  shield: Shield,
  zap: Zap,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
  linkedin: Linkedin,
};
const SOCIAL = {
  facebook: ["Facebook", Facebook],
  instagram: ["Instagram", Instagram],
  youtube: ["YouTube", Youtube],
  x: ["X (Twitter)", Twitter],
  tiktok: ["TikTok", Music],
  linkedin: ["LinkedIn", Linkedin],
  email: ["Email", Mail],
  website: ["Website", Globe],
  phone: ["Phone", Phone],
};

export const MORE_TYPES = new Set([
  "form",
  "icon",
  "iconlist",
  "slider",
  "testimonials",
  "countdown",
  "map",
  "social",
  "embed",
  // story blocks (About / Pastoral Leadership designs)
  ...STORY_TYPES,
]);
export const MORE_LABELS = {
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

let n = 0;
const fid = () => `f${Date.now().toString(36)}${(n++).toString(36)}`;

export function defaultMoreBlock(type, id) {
  if (STORY_TYPES.has(type)) return defaultStoryBlock(type, id);
  switch (type) {
    case "form":
      return {
        id,
        type,
        title: "Contact form",
        submit_text: "Send",
        notify_email: "",
        success_message: "Thank you! Your message has been sent.",
        fields: [
          { id: fid(), label: "Your name", type: "text", required: true },
          { id: fid(), label: "Email", type: "email", required: true },
          { id: fid(), label: "Message", type: "textarea", required: true },
        ],
      };
    case "icon":
      return {
        id,
        type,
        icon: "heart",
        size: 48,
        color: "",
        link: "",
        align: "center",
        label: "",
      };
    case "iconlist":
      return {
        id,
        type,
        color: "",
        size: 20,
        items: [
          { id: fid(), icon: "check", text: "First item", link: "" },
          { id: fid(), icon: "check", text: "Second item", link: "" },
        ],
      };
    case "slider":
      return {
        id,
        type,
        images: [],
        height: 420,
        autoplay: true,
        interval: 5,
        arrows: true,
        dots: true,
      };
    case "testimonials":
      return {
        id,
        type,
        layout: "grid",
        cols: 3,
        items: [
          {
            id: fid(),
            text: "This ministry changed my life.",
            name: "Name",
            role: "Member",
            image_url: "",
          },
          {
            id: fid(),
            text: "The teachings strengthen my walk every week.",
            name: "Name",
            role: "Partner",
            image_url: "",
          },
        ],
      };
    case "countdown":
      return {
        id,
        type,
        mode: "live",
        target: "",
        title: "Next live service",
        done_text: "We're live now!",
        link: "/live",
      };
    case "map":
      return { id, type, address: "", zoom: 14, height: 360 };
    case "social":
      return {
        id,
        type,
        items: [
          { id: fid(), network: "facebook", url: "" },
          { id: fid(), network: "youtube", url: "" },
        ],
        shape: "circle",
        size: 40,
        color: "",
        align: "center",
      };
    case "embed":
      return { id, type, code: "", height: 480, title: "Embedded content" };
    default:
      return { id, type };
  }
}

const clamp = (v, lo, hi, d) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
};
const hex = (v) =>
  /^#[0-9a-f]{6}$/i.test(String(v || "")) ||
  /^var\(--bx-gc-[a-z0-9-]{1,40}\)$/.test(String(v || ""))
    ? v
    : undefined;

function SmartLink({ href, children, className, label }) {
  const h = String(href || "").trim();
  if (!h) return children;
  if (h.startsWith("/"))
    return (
      <Link to={h} className={className} aria-label={label}>
        {children}
      </Link>
    );
  if (/^https?:\/\//i.test(h) || /^mailto:|^tel:/i.test(h))
    return (
      <a
        href={h}
        className={className}
        aria-label={label}
        target={/^https?:/i.test(h) ? "_blank" : undefined}
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  return children;
}

// ---------------- Form ----------------
function FormBlock({ b }) {
  const canvas = useCanvas();
  const page = useContext(PageContext);
  const uid = useId();
  const started = useRef(Date.now());
  const fields = Array.isArray(b.fields) ? b.fields : [];
  const [values, setValues] = useState({});
  const [state, setState] = useState({
    status: "idle",
    message: "",
    errors: {},
  });
  if (!fields.length)
    return <CanvasHint label="Form: add fields in the panel on the left." />;
  async function onSubmit(e) {
    e.preventDefault();
    if (canvas) return;
    setState({ status: "sending", message: "", errors: {} });
    try {
      const form = new FormData(e.currentTarget);
      const { data } = await api.post("/forms/submit", {
        page_id: page?.id,
        page_slug: page?.slug,
        form_id: b.id,
        values,
        website: form.get("website") || "",
        started_at: started.current,
      });
      setState({
        status: "sent",
        message: data?.message || "Thank you!",
        errors: {},
      });
      setValues({});
    } catch (err) {
      const d = err?.response?.data || {};
      setState({
        status: "error",
        message: d.error || "Your message could not be sent. Please try again.",
        errors: d.fields || {},
      });
    }
  }
  if (state.status === "sent")
    return (
      <div className="bx-formDone" role="status">
        {state.message}
      </div>
    );
  return (
    <form
      className="bx-form"
      onSubmit={onSubmit}
      noValidate
      aria-label={b.title || "Form"}
    >
      {fields.map((f) => {
        const id = `${uid}-${f.id}`;
        const err = state.errors?.[f.id];
        const common = {
          id,
          name: f.id,
          required: !!f.required,
          "aria-invalid": err ? "true" : undefined,
          "aria-describedby": err ? `${id}-e` : undefined,
          disabled: state.status === "sending",
        };
        const set = (v) => setValues((x) => ({ ...x, [f.id]: v }));
        return (
          <div key={f.id} className={`bx-formField bx-formField--${f.type}`}>
            {f.type === "checkbox" ? (
              <label className="bx-formCheck">
                <input
                  type="checkbox"
                  {...common}
                  checked={!!values[f.id]}
                  onChange={(e) => set(e.target.checked)}
                />
                {f.label}
                {f.required ? <span aria-hidden="true"> *</span> : null}
              </label>
            ) : (
              <>
                <label htmlFor={id}>
                  {f.label}
                  {f.required ? <span aria-hidden="true"> *</span> : null}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    {...common}
                    rows={5}
                    maxLength={5000}
                    value={values[f.id] || ""}
                    placeholder={f.placeholder || ""}
                    onChange={(e) => set(e.target.value)}
                  />
                ) : f.type === "select" ? (
                  <select
                    {...common}
                    value={values[f.id] || ""}
                    onChange={(e) => set(e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {(Array.isArray(f.options) ? f.options : []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    {...common}
                    type={
                      f.type === "email"
                        ? "email"
                        : f.type === "phone"
                          ? "tel"
                          : "text"
                    }
                    autoComplete={
                      f.type === "email"
                        ? "email"
                        : f.type === "phone"
                          ? "tel"
                          : undefined
                    }
                    maxLength={200}
                    value={values[f.id] || ""}
                    placeholder={f.placeholder || ""}
                    onChange={(e) => set(e.target.value)}
                  />
                )}
              </>
            )}
            {err ? (
              <p id={`${id}-e`} className="bx-formErr">
                {err}
              </p>
            ) : null}
          </div>
        );
      })}
      {/* Spam trap: hidden from people, left empty by them. */}
      <div className="bx-formHp" aria-hidden="true">
        <label htmlFor={`${uid}-w`}>Website</label>
        <input
          id={`${uid}-w`}
          name="website"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>
      {state.status === "error" ? (
        <p className="bx-formErr" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        className="bx-formBtn"
        disabled={state.status === "sending"}
        aria-disabled={canvas ? "true" : undefined}
      >
        {state.status === "sending" ? "Sending…" : b.submit_text || "Send"}
      </button>
      {canvas ? (
        <p className="bx-formNote">
          Preview: the form sends on the published page.
        </p>
      ) : null}
    </form>
  );
}

// ---------------- Carousel (Image slider, Testimonials) ----------------
function Carousel({
  slides,
  label,
  height,
  autoplay,
  interval,
  arrows = true,
  dots = true,
}) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const count = slides.length;
  useEffect(() => {
    if (!autoplay || paused || reduce || count < 2) return undefined;
    const t = setInterval(
      () => setI((x) => (x + 1) % count),
      clamp(interval, 3, 15, 5) * 1000,
    );
    return () => clearInterval(t);
  }, [autoplay, paused, reduce, count, interval]);
  if (!count) return null;
  const go = (k) => setI(((k % count) + count) % count);
  return (
    <section
      className="bx-carousel"
      aria-roledescription="carousel"
      aria-label={label}
      style={height ? { "--bx-car-h": `${height}px` } : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="bx-carTrack"
        style={{ transform: `translateX(-${i * 100}%)` }}
      >
        {slides.map((s, k) => (
          <div
            key={k}
            className="bx-carSlide"
            role="group"
            aria-roledescription="slide"
            aria-label={`${k + 1} of ${count}`}
            aria-hidden={k !== i}
          >
            {s}
          </div>
        ))}
      </div>
      {arrows && count > 1 ? (
        <>
          <button
            type="button"
            className="bx-carBtn bx-carPrev"
            aria-label="Previous slide"
            onClick={() => go(i - 1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="bx-carBtn bx-carNext"
            aria-label="Next slide"
            onClick={() => go(i + 1)}
          >
            ›
          </button>
        </>
      ) : null}
      {dots && count > 1 ? (
        <div className="bx-carDots">
          {slides.map((_, k) => (
            <button
              key={k}
              type="button"
              aria-label={`Go to slide ${k + 1}`}
              aria-current={k === i ? "true" : undefined}
              className={k === i ? "is-on" : ""}
              onClick={() => go(k)}
            />
          ))}
        </div>
      ) : null}
      {autoplay && !reduce && count > 1 ? (
        <button
          type="button"
          className="bx-carPause"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Play slideshow" : "Pause slideshow"}
        >
          {paused ? "▶" : "❚❚"}
        </button>
      ) : null}
    </section>
  );
}

// ---------------- Countdown ----------------
function Countdown({ b }) {
  const [target, setTarget] = useState(() =>
    b.mode === "date" ? Date.parse(b.target || "") || null : null,
  );
  const [live, setLive] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (b.mode === "date") {
      setTarget(Date.parse(b.target || "") || null);
      return undefined;
    }
    let alive = true;
    // Release 2.2: the site's live status (any provider; schedule from the Calendar)
    fetchLiveStatus()
      .then((st) => {
        if (!alive) return;
        if (st?.state === "live") return setLive(true);
        const t = Date.parse(st?.next_live_at || "");
        setTarget(Number.isFinite(t) ? t : null);
      })
      .catch(() => alive && setTarget(null));
    return () => {
      alive = false;
    };
  }, [b.mode, b.target]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = target ? Math.max(0, target - now) : 0;
  const done = live || (target && left === 0);
  if (!target && !live)
    return (
      <CanvasHint
        label={
          b.mode === "date"
            ? "Countdown: choose a date and time in the panel on the left."
            : "Countdown: no upcoming live service is scheduled yet."
        }
      />
    );
  if (done)
    return (
      <div className="bx-countdown bx-countdown--done">
        <SmartLink href={b.link} className="bx-cdLink">
          {b.done_text || "We're live now!"}
        </SmartLink>
      </div>
    );
  const d = Math.floor(left / 86400000);
  const h = Math.floor((left % 86400000) / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <div
      className="bx-countdown"
      role="timer"
      aria-label={`${b.title ? `${b.title}: ` : ""}${d} days ${h} hours ${m} minutes`}
    >
      {b.title ? <div className="bx-cdTitle">{b.title}</div> : null}
      <div className="bx-cdBoxes" aria-hidden="true">
        {[
          [d, "Days"],
          [h, "Hours"],
          [m, "Minutes"],
          [s, "Seconds"],
        ].map(([v, l]) => (
          <div key={l} className="bx-cdBox">
            <span className="bx-cdNum">{String(v).padStart(2, "0")}</span>
            <span className="bx-cdLabel">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Embed: only an https iframe address is used (from a link or pasted code).
export function embedSrc(code) {
  const s = String(code || "").trim();
  const m = s.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  const url = (m ? m[1] : s).replace(/&amp;/g, "&").trim();
  // Only other websites: a page from this same address would get full access
  // to visitors' sign-ins for every ministry on it.
  return /^https:\/\/[^\s<>"']+$/i.test(url) && !isSameSiteUrl(url) ? url : "";
}

function MoreBlockPublicBase({ block }) {
  const b = block || {};
  const canvas = useCanvas();
  const type = String(b.type || "");
  if (type === "form") return <FormBlock b={b} />;
  if (type === "icon") {
    const Ico = ICONS[b.icon] || Heart;
    const size = clamp(b.size, 16, 160, 48);
    const icon = (
      <Ico
        size={size}
        color={hex(b.color) || "currentColor"}
        aria-hidden={b.label ? undefined : "true"}
        role={b.label ? "img" : undefined}
        aria-label={b.label || undefined}
      />
    );
    return (
      <div
        className="bx-icon"
        style={{
          textAlign: ["left", "center", "right"].includes(b.align)
            ? b.align
            : "center",
        }}
      >
        <SmartLink href={b.link} label={b.label || undefined}>
          {icon}
        </SmartLink>
      </div>
    );
  }
  if (type === "iconlist") {
    const items = Array.isArray(b.items)
      ? b.items.filter((x) => String(x?.text || "").trim())
      : [];
    if (!items.length)
      return (
        <CanvasHint label="Icon list: add items in the panel on the left." />
      );
    const size = clamp(b.size, 12, 48, 20);
    return (
      <ul className="bx-iconList">
        {items.map((it) => {
          const Ico = ICONS[it.icon] || Check;
          return (
            <li key={it.id || it.text}>
              <Ico
                size={size}
                color={hex(b.color) || "currentColor"}
                aria-hidden="true"
              />
              <SmartLink href={it.link}>
                <span>{it.text}</span>
              </SmartLink>
            </li>
          );
        })}
      </ul>
    );
  }
  if (type === "slider") {
    const imgs = (Array.isArray(b.images) ? b.images : [])
      .map((x) => (typeof x === "string" ? { src: x } : x || {}))
      .filter((x) => x.src || x.url);
    if (!imgs.length)
      return (
        <CanvasHint label="Image slider: add images in the panel on the left." />
      );
    return (
      <Carousel
        label="Image slider"
        height={clamp(b.height, 160, 800, 420)}
        autoplay={!canvas && b.autoplay !== false}
        interval={b.interval}
        arrows={b.arrows !== false}
        dots={b.dots !== false}
        slides={imgs.map((im, k) => (
          <img
            key={k}
            src={mediaSrc(im.src || im.url)}
            alt={im.alt || ""}
            loading={k ? "lazy" : undefined}
          />
        ))}
      />
    );
  }
  if (type === "testimonials") {
    const items = Array.isArray(b.items)
      ? b.items.filter((x) => String(x?.text || "").trim())
      : [];
    if (!items.length)
      return (
        <CanvasHint label="Testimonials: add testimonials in the panel on the left." />
      );
    const card = (t) => (
      <figure className="bx-testi" key={t.id || t.text}>
        <blockquote>“{t.text}”</blockquote>
        <figcaption>
          {t.image_url ? <img src={mediaSrc(t.image_url)} alt="" /> : null}
          <span>
            <strong>{t.name}</strong>
            {t.role ? <small>{t.role}</small> : null}
          </span>
        </figcaption>
      </figure>
    );
    if (b.layout === "slider")
      return (
        <Carousel
          label="Testimonials"
          autoplay={!canvas}
          interval={7}
          slides={items.map(card)}
        />
      );
    return (
      <div
        className={`bx-testiGrid bx-vgrid--c${clamp(b.cols, 1, 4, 3)}`}
        style={{ "--bx-cols": clamp(b.cols, 1, 4, 3) }}
      >
        {items.map(card)}
      </div>
    );
  }
  if (type === "countdown") return <Countdown b={b} />;
  if (type === "map") {
    const addr = String(b.address || "").trim();
    if (!addr)
      return (
        <CanvasHint label="Google Map: enter an address in the panel on the left." />
      );
    const src = `https://www.google.com/maps?q=${encodeURIComponent(addr)}&z=${clamp(b.zoom, 1, 20, 14)}&output=embed`;
    return (
      <div
        className="bx-map"
        style={{ height: clamp(b.height, 200, 800, 360) }}
      >
        <iframe
          src={src}
          title={`Map of ${addr}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    );
  }
  if (type === "social") {
    const items = (Array.isArray(b.items) ? b.items : []).filter(
      (x) => SOCIAL[x?.network] && String(x?.url || "").trim(),
    );
    if (!items.length)
      return (
        <CanvasHint label="Social icons: add your profile links in the panel on the left." />
      );
    const size = clamp(b.size, 24, 80, 40);
    const href = (it) => {
      const u = String(it.url).trim();
      if (it.network === "email")
        return u.startsWith("mailto:") ? u : `mailto:${u}`;
      if (it.network === "phone")
        return u.startsWith("tel:") ? u : `tel:${u.replace(/[^0-9+]/g, "")}`;
      return /^https?:\/\//i.test(u) ? u : `https://${u}`;
    };
    return (
      <ul
        className={`bx-social bx-social--${["circle", "square", "plain"].includes(b.shape) ? b.shape : "circle"}`}
        style={{
          justifyContent:
            { left: "flex-start", right: "flex-end" }[b.align] || "center",
        }}
      >
        {items.map((it) => {
          const [name, Ico] = SOCIAL[it.network];
          return (
            <li key={it.id || it.network}>
              <a
                href={href(it)}
                target={/^https?:/i.test(href(it)) ? "_blank" : undefined}
                rel="noopener noreferrer"
                aria-label={name}
                style={{ width: size, height: size, color: hex(b.color) }}
              >
                <Ico size={Math.round(size * 0.5)} aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
    );
  }
  if (type === "embed") {
    const src = embedSrc(b.code);
    if (!src)
      return (
        <CanvasHint label="Embed: paste an https link or embed code in the panel on the left." />
      );
    return (
      <div
        className="bx-embed"
        style={{ height: clamp(b.height, 120, 1600, 480) }}
      >
        <iframe
          src={src}
          title={b.title || "Embedded content"}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="fullscreen; payment; clipboard-write"
        />
      </div>
    );
  }
  return null;
}

// ---------------- Editors ----------------
function F({ label, id, hint, children }) {
  return (
    <div className="bx-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <div className="bx-hint">{hint}</div> : null}
    </div>
  );
}
function move(list, a, b) {
  if (b < 0 || b >= list.length) return list;
  const x = list.slice();
  const [it] = x.splice(a, 1);
  x.splice(b, 0, it);
  return x;
}
function ItemBar({ i, count, label, onMove, onRemove }) {
  return (
    <span className="bx-faqEditActions">
      <button
        type="button"
        className="ap-btn"
        disabled={i === 0}
        aria-label={`Move ${label} up`}
        onClick={() => onMove(i, i - 1)}
      >
        ↑
      </button>
      <button
        type="button"
        className="ap-btn"
        disabled={i === count - 1}
        aria-label={`Move ${label} down`}
        onClick={() => onMove(i, i + 1)}
      >
        ↓
      </button>
      <button
        type="button"
        className="ap-btn ap-btnDanger"
        aria-label={`Remove ${label}`}
        onClick={() => onRemove(i)}
      >
        Remove
      </button>
    </span>
  );
}
function IconPicker({ value, onChange, label = "Icon" }) {
  return (
    <div className="bx-field">
      <span className="bx-label">{label}</span>
      <div className="bx-iconGrid" role="radiogroup" aria-label={label}>
        {Object.entries(ICONS).map(([k, Ico]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            aria-label={k.replace(/-/g, " ")}
            className={value === k ? "is-on" : ""}
            onClick={() => onChange(k)}
          >
            <Ico size={18} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

function MoreBlockEditorBase({ block, onPatch }) {
  const b = block || {};
  const id = useId();
  const pick = useContext(MediaPickerContext);
  const type = String(b.type || "");
  const listEdit = (key, render, make, label) => {
    const list = Array.isArray(b[key]) ? b[key] : [];
    const set = (next) => onPatch({ [key]: next });
    return (
      <>
        {list.map((it, i) => (
          <div className="bx-faqEdit" key={it.id || i}>
            <div className="bx-faqEditHead">
              <strong>
                {label} {i + 1}
              </strong>
              <ItemBar
                i={i}
                count={list.length}
                label={`${label.toLowerCase()} ${i + 1}`}
                onMove={(a, c) => set(move(list, a, c))}
                onRemove={(k) => set(list.filter((_, x) => x !== k))}
              />
            </div>
            {render(
              it,
              (patch) =>
                set(list.map((x, k) => (k === i ? { ...x, ...patch } : x))),
              i,
            )}
          </div>
        ))}
        <button
          type="button"
          className="ap-btn ap-btnPrimary"
          onClick={() => set([...list, make()])}
        >
          + Add {label.toLowerCase()}
        </button>
      </>
    );
  };

  if (type === "form")
    return (
      <div className="bx-editor">
        <F label="Form name (shown in Form Submissions)" id={`${id}-t`}>
          <input
            id={`${id}-t`}
            className="ap-input"
            value={b.title || ""}
            onChange={(e) => onPatch({ title: e.target.value })}
          />
        </F>
        {listEdit(
          "fields",
          (f, set, i) => (
            <>
              <input
                className="ap-input"
                aria-label={`Field ${i + 1} label`}
                value={f.label || ""}
                placeholder="Label"
                onChange={(e) => set({ label: e.target.value })}
              />
              <div className="bx-row">
                <select
                  className="ap-input"
                  aria-label={`Field ${i + 1} type`}
                  value={f.type || "text"}
                  onChange={(e) => set({ type: e.target.value })}
                >
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="textarea">Long text</option>
                  <option value="select">Dropdown</option>
                  <option value="checkbox">Checkbox</option>
                </select>
                <label className="bx-check">
                  <input
                    type="checkbox"
                    checked={!!f.required}
                    onChange={(e) => set({ required: e.target.checked })}
                  />{" "}
                  Required
                </label>
              </div>
              {f.type === "select" ? (
                <input
                  className="ap-input"
                  aria-label={`Field ${i + 1} choices`}
                  placeholder="Choices, separated by commas"
                  value={(f.options || []).join(", ")}
                  onChange={(e) =>
                    set({
                      options: e.target.value
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean)
                        .slice(0, 30),
                    })
                  }
                />
              ) : null}
            </>
          ),
          () => ({
            id: fid(),
            label: "New field",
            type: "text",
            required: false,
          }),
          "Field",
        )}
        <F label="Button text" id={`${id}-b`}>
          <input
            id={`${id}-b`}
            className="ap-input"
            value={b.submit_text || ""}
            onChange={(e) => onPatch({ submit_text: e.target.value })}
          />
        </F>
        <F label="Thank-you message" id={`${id}-s`}>
          <input
            id={`${id}-s`}
            className="ap-input"
            value={b.success_message || ""}
            onChange={(e) => onPatch({ success_message: e.target.value })}
          />
        </F>
        <F
          label="Email new submissions to (optional)"
          id={`${id}-n`}
          hint="Every submission is also saved in Content › Form Submissions."
        >
          <input
            id={`${id}-n`}
            className="ap-input"
            type="email"
            value={b.notify_email || ""}
            placeholder="office@example.com"
            onChange={(e) => onPatch({ notify_email: e.target.value.trim() })}
          />
        </F>
      </div>
    );
  if (type === "icon")
    return (
      <div className="bx-editor">
        <IconPicker value={b.icon} onChange={(v) => onPatch({ icon: v })} />
        <F label={`Size: ${clamp(b.size, 16, 160, 48)}px`} id={`${id}-z`}>
          <input
            id={`${id}-z`}
            type="range"
            min={16}
            max={160}
            value={clamp(b.size, 16, 160, 48)}
            onChange={(e) => onPatch({ size: Number(e.target.value) })}
          />
        </F>
        <div className="bx-row">
          <F label="Color (#rrggbb)" id={`${id}-c`}>
            <input
              id={`${id}-c`}
              className="ap-input"
              value={b.color || ""}
              placeholder="Text color"
              onChange={(e) => onPatch({ color: e.target.value.trim() })}
            />
          </F>
          <F label="Alignment" id={`${id}-a`}>
            <select
              id={`${id}-a`}
              className="ap-input"
              value={b.align || "center"}
              onChange={(e) => onPatch({ align: e.target.value })}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </F>
        </div>
        <F label="Link (optional)" id={`${id}-l`}>
          <input
            id={`${id}-l`}
            className="ap-input"
            value={b.link || ""}
            placeholder="/live or https://…"
            onChange={(e) => onPatch({ link: e.target.value })}
          />
        </F>
        <F
          label="Description for screen readers"
          id={`${id}-d`}
          hint="Leave empty if the icon is only decoration."
        >
          <input
            id={`${id}-d`}
            className="ap-input"
            value={b.label || ""}
            onChange={(e) => onPatch({ label: e.target.value })}
          />
        </F>
      </div>
    );
  if (type === "iconlist")
    return (
      <div className="bx-editor">
        {listEdit(
          "items",
          (it, set, i) => (
            <>
              <input
                className="ap-input"
                aria-label={`Item ${i + 1} text`}
                value={it.text || ""}
                onChange={(e) => set({ text: e.target.value })}
              />
              <input
                className="ap-input"
                aria-label={`Item ${i + 1} link`}
                placeholder="Link (optional)"
                value={it.link || ""}
                onChange={(e) => set({ link: e.target.value })}
              />
              <select
                className="ap-input"
                aria-label={`Item ${i + 1} icon`}
                value={it.icon || "check"}
                onChange={(e) => set({ icon: e.target.value })}
              >
                {Object.keys(ICONS).map((k) => (
                  <option key={k} value={k}>
                    {k.replace(/-/g, " ")}
                  </option>
                ))}
              </select>
            </>
          ),
          () => ({ id: fid(), icon: "check", text: "New item", link: "" }),
          "Item",
        )}
        <div className="bx-row">
          <F label="Icon color" id={`${id}-c`}>
            <input
              id={`${id}-c`}
              className="ap-input"
              value={b.color || ""}
              placeholder="#rrggbb"
              onChange={(e) => onPatch({ color: e.target.value.trim() })}
            />
          </F>
          <F label={`Icon size: ${clamp(b.size, 12, 48, 20)}px`} id={`${id}-z`}>
            <input
              id={`${id}-z`}
              type="range"
              min={12}
              max={48}
              value={clamp(b.size, 12, 48, 20)}
              onChange={(e) => onPatch({ size: Number(e.target.value) })}
            />
          </F>
        </div>
      </div>
    );
  if (type === "slider")
    return (
      <div className="bx-editor">
        <GalleryImagesEditor block={b} onPatch={onPatch} />
        <F label={`Height: ${clamp(b.height, 160, 800, 420)}px`} id={`${id}-h`}>
          <input
            id={`${id}-h`}
            type="range"
            min={160}
            max={800}
            step={10}
            value={clamp(b.height, 160, 800, 420)}
            onChange={(e) => onPatch({ height: Number(e.target.value) })}
          />
        </F>
        <label className="bx-check">
          <input
            type="checkbox"
            checked={b.autoplay !== false}
            onChange={(e) => onPatch({ autoplay: e.target.checked })}
          />{" "}
          Play automatically
        </label>
        <F
          label={`Seconds per slide: ${clamp(b.interval, 3, 15, 5)}`}
          id={`${id}-i`}
        >
          <input
            id={`${id}-i`}
            type="range"
            min={3}
            max={15}
            value={clamp(b.interval, 3, 15, 5)}
            onChange={(e) => onPatch({ interval: Number(e.target.value) })}
          />
        </F>
        <label className="bx-check">
          <input
            type="checkbox"
            checked={b.arrows !== false}
            onChange={(e) => onPatch({ arrows: e.target.checked })}
          />{" "}
          Arrows
        </label>
        <label className="bx-check">
          <input
            type="checkbox"
            checked={b.dots !== false}
            onChange={(e) => onPatch({ dots: e.target.checked })}
          />{" "}
          Dots
        </label>
      </div>
    );
  if (type === "testimonials")
    return (
      <div className="bx-editor">
        {listEdit(
          "items",
          (t, set, i) => (
            <>
              <textarea
                className="ap-textarea"
                rows={3}
                aria-label={`Testimonial ${i + 1} text`}
                value={t.text || ""}
                onChange={(e) => set({ text: e.target.value })}
              />
              <div className="bx-row">
                <input
                  className="ap-input"
                  aria-label={`Testimonial ${i + 1} name`}
                  placeholder="Name"
                  value={t.name || ""}
                  onChange={(e) => set({ name: e.target.value })}
                />
                <input
                  className="ap-input"
                  aria-label={`Testimonial ${i + 1} role`}
                  placeholder="Role (optional)"
                  value={t.role || ""}
                  onChange={(e) => set({ role: e.target.value })}
                />
              </div>
              {pick ? (
                <button
                  type="button"
                  className="ap-btn"
                  onClick={async () => {
                    const p = await pick({ title: "Photo" });
                    if (p?.url) set({ image_url: p.url });
                  }}
                >
                  {t.image_url ? "Change photo" : "Add photo"}
                </button>
              ) : null}
            </>
          ),
          () => ({
            id: fid(),
            text: "New testimonial.",
            name: "Name",
            role: "",
            image_url: "",
          }),
          "Testimonial",
        )}
        <div className="bx-row">
          <F label="Layout" id={`${id}-l`}>
            <select
              id={`${id}-l`}
              className="ap-input"
              value={b.layout || "grid"}
              onChange={(e) => onPatch({ layout: e.target.value })}
            >
              <option value="grid">Grid</option>
              <option value="slider">Slider</option>
            </select>
          </F>
          <F label="Per row" id={`${id}-c`}>
            <select
              id={`${id}-c`}
              className="ap-input"
              value={String(b.cols || 3)}
              onChange={(e) => onPatch({ cols: Number(e.target.value) })}
            >
              {[1, 2, 3, 4].map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </F>
        </div>
      </div>
    );
  if (type === "countdown")
    return (
      <div className="bx-editor">
        <F label="Count down to" id={`${id}-m`}>
          <select
            id={`${id}-m`}
            className="ap-input"
            value={b.mode || "live"}
            onChange={(e) => onPatch({ mode: e.target.value })}
          >
            <option value="live">
              The next live service (Calendar / Live Streaming)
            </option>
            <option value="date">A date and time</option>
          </select>
        </F>
        {b.mode === "date" ? (
          <F label="Date and time" id={`${id}-d`}>
            <input
              id={`${id}-d`}
              className="ap-input"
              type="datetime-local"
              value={b.target || ""}
              onChange={(e) => onPatch({ target: e.target.value })}
            />
          </F>
        ) : null}
        <F label="Title (optional)" id={`${id}-t`}>
          <input
            id={`${id}-t`}
            className="ap-input"
            value={b.title || ""}
            onChange={(e) => onPatch({ title: e.target.value })}
          />
        </F>
        <div className="bx-row">
          <F label="When it's time, show" id={`${id}-x`}>
            <input
              id={`${id}-x`}
              className="ap-input"
              value={b.done_text || ""}
              onChange={(e) => onPatch({ done_text: e.target.value })}
            />
          </F>
          <F label="…linking to" id={`${id}-k`}>
            <input
              id={`${id}-k`}
              className="ap-input"
              value={b.link || ""}
              placeholder="/live"
              onChange={(e) => onPatch({ link: e.target.value })}
            />
          </F>
        </div>
      </div>
    );
  if (type === "map")
    return (
      <div className="bx-editor">
        <F
          label="Address or place"
          id={`${id}-a`}
          hint="For example: 1500 Main St, Richmond, VA"
        >
          <input
            id={`${id}-a`}
            className="ap-input"
            value={b.address || ""}
            onChange={(e) => onPatch({ address: e.target.value })}
          />
        </F>
        <F label={`Zoom: ${clamp(b.zoom, 1, 20, 14)}`} id={`${id}-z`}>
          <input
            id={`${id}-z`}
            type="range"
            min={1}
            max={20}
            value={clamp(b.zoom, 1, 20, 14)}
            onChange={(e) => onPatch({ zoom: Number(e.target.value) })}
          />
        </F>
        <F label={`Height: ${clamp(b.height, 200, 800, 360)}px`} id={`${id}-h`}>
          <input
            id={`${id}-h`}
            type="range"
            min={200}
            max={800}
            step={10}
            value={clamp(b.height, 200, 800, 360)}
            onChange={(e) => onPatch({ height: Number(e.target.value) })}
          />
        </F>
      </div>
    );
  if (type === "social")
    return (
      <div className="bx-editor">
        {listEdit(
          "items",
          (it, set, i) => (
            <div className="bx-row">
              <select
                className="ap-input"
                aria-label={`Link ${i + 1} network`}
                value={it.network || "facebook"}
                onChange={(e) => set({ network: e.target.value })}
              >
                {Object.entries(SOCIAL).map(([k, [nm]]) => (
                  <option key={k} value={k}>
                    {nm}
                  </option>
                ))}
              </select>
              <input
                className="ap-input"
                aria-label={`Link ${i + 1} address`}
                placeholder={
                  it.network === "email"
                    ? "you@example.com"
                    : it.network === "phone"
                      ? "+1 804 555 0100"
                      : "https://…"
                }
                value={it.url || ""}
                onChange={(e) => set({ url: e.target.value })}
              />
            </div>
          ),
          () => ({ id: fid(), network: "instagram", url: "" }),
          "Link",
        )}
        <div className="bx-row">
          <F label="Shape" id={`${id}-s`}>
            <select
              id={`${id}-s`}
              className="ap-input"
              value={b.shape || "circle"}
              onChange={(e) => onPatch({ shape: e.target.value })}
            >
              <option value="circle">Circle</option>
              <option value="square">Rounded square</option>
              <option value="plain">Icon only</option>
            </select>
          </F>
          <F label="Alignment" id={`${id}-a`}>
            <select
              id={`${id}-a`}
              className="ap-input"
              value={b.align || "center"}
              onChange={(e) => onPatch({ align: e.target.value })}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </F>
        </div>
        <F label={`Size: ${clamp(b.size, 24, 80, 40)}px`} id={`${id}-z`}>
          <input
            id={`${id}-z`}
            type="range"
            min={24}
            max={80}
            value={clamp(b.size, 24, 80, 40)}
            onChange={(e) => onPatch({ size: Number(e.target.value) })}
          />
        </F>
        <F label="Icon color (#rrggbb)" id={`${id}-c`}>
          <input
            id={`${id}-c`}
            className="ap-input"
            value={b.color || ""}
            placeholder="Text color"
            onChange={(e) => onPatch({ color: e.target.value.trim() })}
          />
        </F>
      </div>
    );
  if (type === "embed") {
    const src = embedSrc(b.code);
    return (
      <div className="bx-editor">
        <F
          label="Link or embed code"
          id={`${id}-c`}
          hint="Paste an https link, or embed code from Tithe.ly, Google Forms, Spotify, Calendly and similar. Only the embedded page's address is used; scripts never run on your site."
        >
          <textarea
            id={`${id}-c`}
            className="ap-textarea ap-cssBox"
            rows={4}
            value={b.code || ""}
            onChange={(e) => onPatch({ code: e.target.value })}
          />
        </F>
        <p className="bx-hint" role="status">
          {b.code
            ? src
              ? `Will embed: ${src}`
              : "No https address found in this code."
            : ""}
        </p>
        <F
          label={`Height: ${clamp(b.height, 120, 1600, 480)}px`}
          id={`${id}-h`}
        >
          <input
            id={`${id}-h`}
            type="range"
            min={120}
            max={1600}
            step={10}
            value={clamp(b.height, 120, 1600, 480)}
            onChange={(e) => onPatch({ height: Number(e.target.value) })}
          />
        </F>
        <F label="Title (for screen readers)" id={`${id}-t`}>
          <input
            id={`${id}-t`}
            className="ap-input"
            value={b.title || ""}
            onChange={(e) => onPatch({ title: e.target.value })}
          />
        </F>
      </div>
    );
  }
  return null;
}

// Story blocks have their own components (storyBlocks.js); every other type
// keeps its original renderer / editor.
export function MoreBlockPublic({ block }) {
  if (STORY_TYPES.has(String(block?.type || "")))
    return <StoryBlockPublic block={block} />;
  return <MoreBlockPublicBase block={block} />;
}
export function MoreBlockEditor({ block, onPatch }) {
  if (STORY_TYPES.has(String(block?.type || "")))
    return <StoryBlockEditor block={block} onPatch={onPatch} />;
  return <MoreBlockEditorBase block={block} onPatch={onPatch} />;
}
