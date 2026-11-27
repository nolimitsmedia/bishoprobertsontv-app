// src/pages/public/SeriesPages.js — /series and /series/:slug (Uscreen-style programs)
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api";
import { mediaSrc } from "../../lib/mediaApi";
import { usePageMeta } from "../../utils/pageMeta";
import "./Series.css";
import { SITE } from "../../config/site";
import { siteDefaults } from "../../lib/siteContent";

export function fmtLength(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m || 1} min`;
}
const epLabel = (n) => `${n} episode${n === 1 ? "" : "s"}`;
export const episodeHref = (id, slug) =>
  `/watch/${id}?series=${encodeURIComponent(slug)}`;

export function SeriesCard({ s }) {
  const img = mediaSrc(s.cover_url || s.thumbnail_url);
  return (
    <Link to={`/series/${encodeURIComponent(s.slug)}`} className="sr-card">
      <span className="sr-cardArt">
        {img ? (
          <img src={img} alt="" loading="lazy" />
        ) : (
          <span className="sr-cardEmpty" />
        )}
        <span className="sr-cardBadge">Series</span>
      </span>
      <span className="sr-cardTitle">{s.title}</span>
      <span className="sr-cardMeta">
        {epLabel(s.episode_count)}
        {s.total_seconds ? ` · ${fmtLength(s.total_seconds)}` : ""}
      </span>
      {s.tagline ? <span className="sr-cardTag">{s.tagline}</span> : null}
    </Link>
  );
}

export function SeriesList() {
  usePageMeta({
    title: "Series",
    description:
      siteDefaults().labels?.series_description ||
      `Teaching series and programs from ${SITE.name}.`,
  });
  const [items, setItems] = useState(null);
  useEffect(() => {
    api
      .get("/series")
      .then(({ data }) => setItems(data?.items || []))
      .catch(() => setItems([]));
  }, []);
  return (
    <main className="sr-page">
      <header className="sr-listHead">
        <p className="sr-eyebrow">Series</p>
        <h1>Teaching series</h1>
        <p>
          Messages grouped into series — watch them in order and pick up where
          you left off.
        </p>
      </header>
      {items === null ? (
        <div className="sr-grid" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="sr-card sr-skeleton" />
          ))}
        </div>
      ) : items.length ? (
        <div className="sr-grid">
          {items.map((s) => (
            <SeriesCard key={s.id} s={s} />
          ))}
        </div>
      ) : (
        <p className="sr-empty">No series yet.</p>
      )}
    </main>
  );
}

export function SeriesPage() {
  const { slug } = useParams();
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let on = true;
    setS(null);
    setErr("");
    api
      .get(`/series/${encodeURIComponent(slug)}`)
      .then(({ data }) => on && setS(data))
      .catch(
        (e) =>
          on &&
          setErr(
            e?.response?.status === 404
              ? "This series is not available."
              : "The series could not be loaded.",
          ),
      );
    return () => {
      on = false;
    };
  }, [slug]);
  usePageMeta({
    title: s?.title || "Series",
    description: s?.tagline || s?.description || "",
  });

  if (err)
    return (
      <main className="sr-page">
        <p className="sr-empty">
          {err} <Link to="/series">See all series</Link>
        </p>
      </main>
    );
  if (!s)
    return (
      <main className="sr-page" aria-busy="true">
        <div className="sr-hero sr-skeleton" />
      </main>
    );

  const first = s.episodes[0];
  const r = s.progress?.resume;
  const target = r
    ? s.episodes.find((e) => e.id === r.episode_id) || first
    : first;
  const mainLabel = !r
    ? "Start series"
    : r.kind === "resume"
      ? `Resume episode ${r.number}`
      : r.kind === "next"
        ? `Next: episode ${r.number}`
        : "Watch again from episode 1";
  const cover = mediaSrc(s.cover_url || s.thumbnail_url);
  const pct = s.progress
    ? Math.round((s.progress.watched / Math.max(1, s.progress.total)) * 100)
    : 0;

  return (
    <main className="sr-page sr-page--detail">
      <section
        className="sr-hero"
        style={cover ? { "--sr-cover": `url("${cover}")` } : undefined}
      >
        <div className="sr-heroInner">
          <p className="sr-eyebrow">
            <Link to="/series">Series</Link>
          </p>
          <h1 className="sr-title">{s.title}</h1>
          {s.tagline ? <p className="sr-tagline">{s.tagline}</p> : null}
          <p className="sr-meta">
            {epLabel(s.episode_count)}
            {s.total_seconds ? ` · ${fmtLength(s.total_seconds)}` : ""}
          </p>
          {s.description ? (
            <p className="sr-desc">
              {String(s.description)
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()}
            </p>
          ) : null}
          <div className="sr-actions">
            {target ? (
              <Link
                to={episodeHref(target.id, s.slug)}
                className="sr-btn sr-btn--primary"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" fill="currentColor" />
                </svg>
                {mainLabel}
              </Link>
            ) : null}
            {s.trailer ? (
              <Link
                to={`/watch/${s.trailer.id}`}
                className="sr-btn sr-btn--ghost"
              >
                Watch trailer
              </Link>
            ) : null}
          </div>
          {s.progress ? (
            <div
              className="sr-progress"
              aria-label={`${s.progress.watched} of ${s.progress.total} episodes watched`}
            >
              <div className="sr-bar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </div>
              <span>
                {s.progress.watched} of {s.progress.total} watched
              </span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="sr-episodes" aria-labelledby="sr-eps">
        <h2 id="sr-eps">Episodes</h2>
        <ol className="sr-epList">
          {s.episodes.map((e) => {
            const img = mediaSrc(e.thumbnail_url);
            const done = e.progress?.completed;
            const pctE = e.progress?.percent || 0;
            const current = target && target.id === e.id && s.progress;
            return (
              <li key={e.id} className={`sr-ep ${current ? "is-current" : ""}`}>
                <Link to={episodeHref(e.id, s.slug)} className="sr-epLink">
                  <span className="sr-epNum" aria-hidden="true">
                    {e.number}
                  </span>
                  <span className="sr-epArt">
                    {img ? (
                      <img src={img} alt="" loading="lazy" />
                    ) : (
                      <span className="sr-cardEmpty" />
                    )}
                    {e.duration_seconds ? (
                      <span className="sr-epLen">
                        {fmtLength(e.duration_seconds)}
                      </span>
                    ) : null}
                    {pctE > 0 && !done ? (
                      <span className="sr-epBar" aria-hidden="true">
                        <span style={{ width: `${pctE}%` }} />
                      </span>
                    ) : null}
                  </span>
                  <span className="sr-epText">
                    <span className="sr-epTitle">
                      <span className="sr-sr">Episode {e.number}: </span>
                      {e.title}
                    </span>
                    {e.summary ? (
                      <span className="sr-epSum">{e.summary}</span>
                    ) : null}
                    <span className="sr-epState">
                      {done ? (
                        <span className="sr-done">✓ Watched</span>
                      ) : pctE > 0 ? (
                        <span>{pctE}% watched</span>
                      ) : null}
                      {current ? (
                        <span className="sr-up">
                          {r?.kind === "resume" ? "Continue here" : "Up next"}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}

// The bar on the watch page: "Episode 3 of 8 · Series" with Next episode.
export function SeriesWatchBar({ slug, videoId }) {
  const [s, setS] = useState(null);
  useEffect(() => {
    let on = true;
    if (!slug) return undefined;
    api
      .get(`/series/${encodeURIComponent(slug)}`)
      .then(({ data }) => on && setS(data))
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [slug, videoId]);
  if (!s) return null;
  const i = s.episodes.findIndex((e) => String(e.id) === String(videoId));
  if (i < 0) return null;
  const next = s.episodes[i + 1];
  return (
    <nav className="sr-watchBar" aria-label="Series">
      <span className="sr-watchWhere">
        <Link to={`/series/${encodeURIComponent(s.slug)}`}>{s.title}</Link>
        <span>
          Episode {i + 1} of {s.episodes.length}
        </span>
      </span>
      <span className="sr-watchNav">
        <Link
          to={`/series/${encodeURIComponent(s.slug)}`}
          className="sr-btn sr-btn--ghost sr-btn--sm"
        >
          All episodes
        </Link>
        {next ? (
          <Link
            to={episodeHref(next.id, s.slug)}
            className="sr-btn sr-btn--primary sr-btn--sm"
          >
            Next episode ›
          </Link>
        ) : (
          <span className="sr-done">Last episode</span>
        )}
      </span>
    </nav>
  );
}
