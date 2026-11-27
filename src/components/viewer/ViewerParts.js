// src/components/viewer/ViewerParts.js
//
// Release 2.0: video card, scrolling row and featured hero (Netflix / Uscreen style).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fmtTime, isSignedIn, toggleMyList, useMyList } from "./viewerStore";
import "./Viewer.css";

export function MyListButton({
  videoId,
  compact = false,
  title = "",
  variant = "",
}) {
  const list = useMyList();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const inList = list.has(Number(videoId));
  const label = inList
    ? `Remove ${title || "video"} from My List`
    : `Add ${title || "video"} to My List`;
  return (
    <button
      type="button"
      className={`vw-listBtn${inList ? " is-on" : ""}${compact ? " vw-listBtn--compact" : ""}${variant === "save" ? " vw-saveBtn" : ""}`}
      aria-pressed={inList}
      aria-label={label}
      title={inList ? "In My List" : "Add to My List"}
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isSignedIn()) return nav("/login");
        setBusy(true);
        try {
          await toggleMyList(videoId);
        } catch {
          /* state already restored */
        } finally {
          setBusy(false);
        }
      }}
    >
      {variant === "save" ? (
        <>
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill={inList ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 3h12v18l-6-4-6 4z" />
          </svg>
          <span>{inList ? "Saved" : "Save"}</span>
        </>
      ) : (
        <>
          <span aria-hidden="true">{inList ? "✓" : "+"}</span>
          {compact ? null : <span>{inList ? "In My List" : "My List"}</span>}
        </>
      )}
    </button>
  );
}

// "New" for messages published in the last 14 days
function isNew(v) {
  const t = new Date(v?.published_at || "").getTime();
  return (
    Number.isFinite(t) && Date.now() - t < 14 * 86400000 && t <= Date.now()
  );
}

export function VideoCard({ v, onRemove, showCategory = false }) {
  // a thumbnail that fails to load (e.g. a failed Bunny copy) shows the placeholder
  const [imgFailed, setImgFailed] = useState(false);
  const href = v.progress?.position
    ? `/watch/${v.id}?t=${v.progress.position}`
    : `/watch/${v.id}`;
  return (
    <div className="vw-card">
      <Link
        to={href}
        className="vw-cardLink"
        aria-label={`${v.title}${v.progress?.pct ? `, ${v.progress.pct}% watched` : ""}`}
      >
        <span className="vw-thumb">
          {v.thumbnail && !imgFailed ? (
            <img
              src={v.thumbnail}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <span className="vw-thumbEmpty" aria-hidden="true">
              ▶
            </span>
          )}
          {isNew(v) && !v.progress ? <span className="vw-new">New</span> : null}
          {v.is_premium ? <span className="vw-badge">Premium</span> : null}
          {v.duration_seconds && !v.progress ? (
            <span className="vw-dur">{fmtTime(v.duration_seconds)}</span>
          ) : null}
          {v.progress?.pct != null ? (
            <span className="vw-progress" aria-hidden="true">
              <span style={{ width: `${v.progress.pct}%` }} />
            </span>
          ) : null}
        </span>
        <span className="vw-cardTitle">{v.title}</span>
        {v.progress?.position ? (
          <span className="vw-cardMeta">
            Resume at {fmtTime(v.progress.position)}
          </span>
        ) : showCategory && v.category_name ? (
          <span className="vw-cardMeta">{v.category_name}</span>
        ) : null}
      </Link>
      <div className="vw-cardActions">
        <MyListButton videoId={v.id} compact title={v.title} />
        {onRemove ? (
          <button
            type="button"
            className="vw-listBtn vw-listBtn--compact"
            aria-label={`Remove ${v.title} from Continue Watching`}
            title="Remove from row"
            onClick={() => onRemove(v)}
          >
            <span aria-hidden="true">✕</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function VideoRow({
  row,
  onSeeAll,
  onRemove,
  kicker = "",
  seeAllLabel = "See all",
  headerNav = false,
  showCategory = false,
  countLabel = null, // e.g. 58, shown small and grey after the title
  plain = false, // a simple grid of the first `limit` cards (no arrows / dots)
  limit = 0,
  cols = 4,
}) {
  const ref = useRef(null);
  const [st, setSt] = useState({ start: true, end: false, page: 0, pages: 1 });
  const headingId = `vw-row-${row.key}`;
  const update = () => {
    const el = ref.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    const pages = Math.max(1, Math.ceil((el.scrollWidth - 4) / w));
    const atEnd = el.scrollLeft + w >= el.scrollWidth - 8;
    setSt({
      start: el.scrollLeft < 8,
      end: atEnd,
      pages,
      page: atEnd
        ? pages - 1
        : Math.min(pages - 1, Math.round(el.scrollLeft / w)),
    });
  };
  useEffect(() => {
    update();
    const onResize = () => update();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [row.items?.length]);
  const scroll = (dir) =>
    ref.current?.scrollBy({
      left: dir * ref.current.clientWidth * 0.9,
      behavior: "smooth",
    });
  const goPage = (i) =>
    ref.current?.scrollTo({
      left: i * ref.current.clientWidth,
      behavior: "smooth",
    });
  return (
    <section className="vw-row" aria-labelledby={headingId}>
      <div className={`vw-rowHead${headerNav ? " vw-rowHead--nav" : ""}`}>
        <div className="vw-rowTitles">
          {kicker ? <span className="vw-kicker">{kicker}</span> : null}
          <h2 id={headingId}>
            {row.title}
            {countLabel != null ? (
              <span className="vw-rowCount"> {countLabel}</span>
            ) : null}
          </h2>
        </div>
        <div className="vw-rowTools">
          {onSeeAll ? (
            <button type="button" className="vw-seeAll" onClick={onSeeAll}>
              {seeAllLabel}
              <span className="vw-sr"> {row.title}</span>
              {headerNav ? null : " ›"}
            </button>
          ) : null}
          {headerNav ? (
            <>
              <button
                type="button"
                className="vw-navBtn"
                aria-label={`Scroll ${row.title} back`}
                disabled={st.start}
                onClick={() => scroll(-1)}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                className="vw-navBtn"
                aria-label={`Scroll ${row.title} forward`}
                disabled={st.end}
                onClick={() => scroll(1)}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          ) : null}
        </div>
      </div>
      {plain ? (
        <div className="vw-grid" style={{ "--vw-cols": cols }}>
          {(limit ? row.items.slice(0, limit) : row.items).map((v) => (
            <VideoCard
              key={v.id}
              v={v}
              onRemove={onRemove}
              showCategory={showCategory}
            />
          ))}
        </div>
      ) : (
        <div className={`vw-rowWrap${st.end ? "" : " has-more"}`}>
          {!st.start && !headerNav ? (
            <button
              type="button"
              className="vw-arrow vw-arrow--prev"
              aria-label={`Scroll ${row.title} back`}
              onClick={() => scroll(-1)}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
          ) : null}
          <div className="vw-track" ref={ref} onScroll={update}>
            {row.items.map((v) => (
              <VideoCard
                key={v.id}
                v={v}
                onRemove={onRemove}
                showCategory={showCategory}
              />
            ))}
          </div>
          {!st.end && !headerNav ? (
            <button
              type="button"
              className="vw-arrow vw-arrow--next"
              aria-label={`Scroll ${row.title} forward`}
              onClick={() => scroll(1)}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : null}
        </div>
      )}
      {st.pages > 1 && !headerNav && !plain ? (
        <div className="vw-pager" aria-label={`${row.title} pages`}>
          {Array.from({ length: st.pages }, (_, i) => (
            <button
              key={i}
              type="button"
              className={i === st.page ? "is-on" : ""}
              aria-label={`${row.title}, page ${i + 1} of ${st.pages}`}
              aria-current={i === st.page ? "true" : undefined}
              onClick={() => goPage(i)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function FeaturedHero({ items }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const count = items.length;
  useEffect(() => {
    if (paused || reduce || count < 2) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % count), 8000);
    return () => clearInterval(t);
  }, [paused, reduce, count]);
  if (!count) return null;
  const v = items[i];
  return (
    <section
      className="vw-hero"
      aria-roledescription="carousel"
      aria-label="Featured"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <img
        className="vw-heroImg"
        src={v.hero_image || v.thumbnail}
        alt=""
        fetchpriority="high"
        decoding="async"
      />
      <div className="vw-heroShade" />
      <div
        className="vw-heroBody"
        role="group"
        aria-roledescription="slide"
        aria-label={`${i + 1} of ${count}`}
      >
        {v.is_premium ? (
          <span className="vw-badge vw-badge--hero">Premium</span>
        ) : null}
        {/* dates like 11-11-26 never break at a hyphen */}
        <h1 className="vw-heroTitle" title={v.title}>
          {String(v.title || "").replace(/(\d)-(?=\d)/g, "$1\u2011")}
        </h1>
        {v.description ? <p className="vw-heroText">{v.description}</p> : null}
        <div className="vw-heroActions">
          <Link to={`/watch/${v.id}`} className="vw-play">
            <span aria-hidden="true">▶</span> Play
          </Link>
          <MyListButton videoId={v.id} title={v.title} />
        </div>
      </div>
      {count > 1 ? (
        <div className="vw-heroDots">
          {items.map((x, k) => (
            <button
              key={x.id}
              type="button"
              aria-label={`Show featured video ${k + 1}: ${x.title}`}
              aria-current={k === i ? "true" : undefined}
              className={k === i ? "is-on" : ""}
              onClick={() => setI(k)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
