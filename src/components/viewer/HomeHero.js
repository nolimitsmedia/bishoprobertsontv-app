// src/components/viewer/HomeHero.js
// Home banner (as in the approved mockup):
//   NEW MESSAGE · NOV 11, 2026
//   “Title”
//   2026 Messages · 52 min · Bishop Robertson
//   description
//   [▶ Play] [Save] More info
//   • • •   (slides; change every 8 s, pause on hover / focus, no auto-advance
//            with "reduce motion")
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MyListButton } from "./ViewerParts";
import { siteDefaults } from "../../lib/siteContent";

const isNew = (v) => {
  const t = new Date(v?.published_at || "").getTime();
  return (
    Number.isFinite(t) && t <= Date.now() && Date.now() - t < 14 * 86400000
  );
};
const dateLabel = (v) => {
  const d = new Date(v?.published_at || "");
  return Number.isNaN(d.getTime())
    ? ""
    : d
        .toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        .toUpperCase();
};
function durationLabel(sec) {
  const s = Math.round(Number(sec) || 0);
  if (s < 60) return "";
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h} hr${m ? ` ${m} min` : ""}` : `${m} min`;
}
const keepDates = (t) => String(t || "").replace(/(\d)-(?=\d)/g, "$1\u2011");

// variant "catalog": CATALOG · FEATURED, category · date · duration, Play + Save
export default function HomeHero({ items = [], variant = "home" }) {
  const cat = variant === "catalog";
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const count = items.length;
  useEffect(() => {
    if (count < 2 || hold) return undefined;
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % count), 8000);
    return () => clearInterval(t);
  }, [count, hold]);
  if (!count) return null;
  const v = items[Math.min(i, count - 1)];
  const kicker = cat
    ? "CATALOG · FEATURED"
    : [isNew(v) ? "NEW MESSAGE" : "FEATURED", dateLabel(v)]
        .filter(Boolean)
        .join(" · ");
  const niceDate = (() => {
    const d = new Date(v?.published_at || "");
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  })();
  const meta = cat
    ? [v.category_name, niceDate, durationLabel(v.duration_seconds)].filter(
        Boolean,
      )
    : [
        v.category_name,
        durationLabel(v.duration_seconds),
        siteDefaults().labels?.speaker || "", // this site's speaker name (content/defaults.json)
      ].filter(Boolean);
  return (
    <section
      className={`hh${cat ? " hh--catalog" : ""}`}
      aria-roledescription="carousel"
      aria-label="Featured messages"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      <img
        className="hh-img"
        src={v.hero_image || v.thumbnail}
        alt=""
        fetchpriority="high"
        decoding="async"
      />
      <div className="hh-shade" aria-hidden="true" />
      <div className="hh-body" aria-live="polite">
        <span className="hh-kicker">{kicker}</span>
        <h1 className="hh-title">{keepDates(v.title)}</h1>
        <p className="hh-meta">
          {meta.map((m, n) => (
            <React.Fragment key={m}>
              {n ? <span aria-hidden="true">·</span> : null}
              <span>{m}</span>
            </React.Fragment>
          ))}
        </p>
        {v.description && !cat ? (
          <p className="hh-text">{v.description}</p>
        ) : null}
        <div className="hh-actions">
          <Link to={`/watch/${v.id}`} className="hh-play">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M7 4v16l13-8z" />
            </svg>
            Play
          </Link>
          <MyListButton videoId={v.id} title={v.title} variant="save" />
          {cat ? null : (
            <Link to={`/watch/${v.id}`} className="hh-more">
              More info
            </Link>
          )}
        </div>
        {count > 1 ? (
          <div
            className="hh-dots"
            role="group"
            aria-label="Choose a featured message"
          >
            {items.map((x, n) => (
              <button
                key={x.id}
                type="button"
                className={n === i ? "is-on" : ""}
                aria-label={`Show ${x.title}`}
                aria-current={n === i ? "true" : undefined}
                onClick={() => setI(n)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
