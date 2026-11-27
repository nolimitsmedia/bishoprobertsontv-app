// src/pages/public/CatalogModern.js
//
// Catalog (redesign): featured banner, sticky category chips + search, and
// rows with arrows — Continue Watching and My List (signed-in members only),
// New Releases, then one row per category. The previous full grid with
// filters stays at /catalog/all.

import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { fetchBrowse, readSavedBrowse, saveBrowse } from "../../lib/browseData";
import { VideoRow } from "../../components/viewer/ViewerParts";
import HomeHero from "../../components/viewer/HomeHero";
import "../../components/viewer/Viewer.css";
import "./CatalogModern.css";
import { SeriesCard } from "./SeriesPages";
import api from "../../api";

// Same rules as the full catalog: merge one category into another, hide one.
const CATALOG_MERGE = { "2026 archives": "2026 messages" };
const CATALOG_HIDE = new Set(["archives"]);
const norm = (n) =>
  String(n || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

// the real service date at the end of a title ("… 12-31-25"), else the publish date
function messageDate(v) {
  const m = String(v?.title || "").match(
    /(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})(?!.*\d{1,2}-\d{1,2}-\d{2})/,
  );
  if (m) {
    const mo = +m[1];
    const d = +m[2];
    let y = +m[3];
    if (y < 100) y += 2000;
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31)
      return Date.UTC(y, mo - 1, d, 12);
  }
  return new Date(v?.published_at || 0).getTime() || 0;
}
// "2025 Message Archives" → "2025"; other names stay
function chipLabel(title) {
  const m = String(title).match(/^(\d{4})\b.*archive/i);
  return m ? m[1] : title;
}
const slug = (s) => `row-${norm(s).replace(/[^a-z0-9]+/g, "-")}`;

export default function CatalogModern() {
  // Links with a filter (?cat=, ?collection=, ?category=, ?q=) open the full catalog with filters.
  const { search } = useLocation();
  const filtered = /[?&](cat|category|collection|q)=/.test(search || "");
  return filtered ? (
    <Navigate to={`/catalog/all${search}`} replace />
  ) : (
    <CatalogRows />
  );
}

const SAVED_KEY = "brtv:catalog-browse:v1";

function CatalogRows() {
  const navigate = useNavigate();
  // the chips bar sticks just BELOW the site header (both used to stick at the
  // top, so the bar slid underneath the header when scrolling)
  useEffect(() => {
    const set = () => {
      const h = document.querySelector(".pl-header");
      const pos = h ? getComputedStyle(h).position : "";
      const top =
        h && (pos === "sticky" || pos === "fixed")
          ? Math.round(h.getBoundingClientRect().height)
          : 0;
      document.documentElement.style.setProperty("--cm-bar-top", `${top}px`);
    };
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);
  // a saved copy of the public rows shows at once; fresh data replaces it
  const [data, setData] = useState(() => {
    const c = readSavedBrowse(SAVED_KEY);
    return c
      ? { featured: Array.isArray(c.featured) ? c.featured : [], rows: c.rows }
      : null;
  });
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [series, setSeries] = useState([]);
  useEffect(() => {
    api
      .get("/series")
      .then(({ data }) => setSeries(data?.items || []))
      .catch(() => {});
  }, []);
  const [active, setActive] = useState("all");

  useEffect(() => {
    let alive = true;
    const hadSaved = !!readSavedBrowse(SAVED_KEY);
    fetchBrowse()
      .then((d) => {
        if (!alive) return;
        setError("");
        setData({
          featured: Array.isArray(d.featured) ? d.featured : [],
          rows: d.rows,
        });
        saveBrowse(SAVED_KEY, d);
      })
      .catch(() => {
        // keep the saved copy on screen if there is one; otherwise explain
        if (alive && !hadSaved)
          setError("Videos could not be loaded. Please try again.");
      });
    return () => {
      alive = false;
    };
  }, []);

  // merge / hide categories, newest first inside category rows
  const rows = useMemo(() => {
    if (!data) return [];
    const out = [];
    const byName = new Map();
    for (const r of data.rows) {
      if (!r || !Array.isArray(r.items) || !r.items.length) continue;
      if (r.key === "new") continue; // New Releases repeated the newest category row
      const n = norm(r.title);
      if (r.category_id != null && CATALOG_HIDE.has(n)) continue;
      const target = r.category_id != null ? CATALOG_MERGE[n] : null;
      if (target) {
        const dest = byName.get(target);
        if (dest) {
          const seen = new Set(dest.items.map((x) => x.id));
          dest.items = [
            ...dest.items,
            ...r.items.filter((x) => !seen.has(x.id)),
          ];
          continue;
        }
      }
      const row = { ...r, items: [...r.items] };
      out.push(row);
      byName.set(n, row);
    }
    for (const r of out)
      if (r.category_id != null)
        r.items.sort((a, b) => messageDate(b) - messageDate(a));
    // Category rows like the old Catalog: newest year first; a category without a
    // year (e.g. Exclusive) right after the newest year.
    const yearOf = (t) =>
      Number((String(t).match(/\b(20\d{2})\b/) || [])[1] || 0);
    const special = out.filter((r) => r.category_id == null);
    const cats = out.filter((r) => r.category_id != null);
    const dated = cats
      .filter((r) => yearOf(r.title))
      .sort((a, b) => yearOf(b.title) - yearOf(a.title));
    const undated = cats.filter((r) => !yearOf(r.title));
    return [...special, ...dated.slice(0, 1), ...undated, ...dated.slice(1)];
  }, [data]);

  // search filters every row as you type
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows
      .map((r) => ({
        ...r,
        key: `${r.key}-q`,
        items: r.items.filter((v) =>
          String(v.title || "")
            .toLowerCase()
            .includes(t),
        ),
      }))
      .filter((r) => r.items.length);
  }, [rows, q]);
  const categories = rows.filter((r) => r.category_id != null);

  function jump(r) {
    setActive(r ? r.key : "all");
    const el = r
      ? document.getElementById(slug(r.title))
      : document.getElementById("cm-rows");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="cm-page vw-page">
      {error ? (
        <p className="vw-empty" role="alert">
          {error}
        </p>
      ) : null}
      {!data && !error ? (
        <p className="vw-empty" role="status">
          Loading…
        </p>
      ) : null}
      {data ? (
        <>
          {data.featured.length ? (
            <div className="cm-hero">
              <HomeHero items={data.featured} variant="catalog" />
            </div>
          ) : (
            <header className="cm-head">
              <h1>Catalog</h1>
              <p>Browse by category and watch your favorite messages.</p>
            </header>
          )}

          <div className="cm-bar">
            <div className="cm-barInner">
              <nav className="cm-chips" aria-label="Categories">
                <button
                  type="button"
                  className={active === "all" ? "is-on" : ""}
                  aria-pressed={active === "all"}
                  onClick={() => jump(null)}
                >
                  All
                </button>
                {categories.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    className={active === r.key ? "is-on" : ""}
                    aria-pressed={active === r.key}
                    onClick={() => jump(r)}
                  >
                    {chipLabel(r.title)}
                  </button>
                ))}
              </nav>
              <label className="cm-search">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <span className="vw-sr">Search messages</span>
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search messages…"
                />
              </label>
            </div>
          </div>

          <div id="cm-rows" className="vw-rows cm-rows">
            {q.trim() ? (
              <p className="cm-results" role="status">
                {shown.reduce((n, r) => n + r.items.length, 0)} result(s) for “
                {q.trim()}”
              </p>
            ) : null}
            {series.length && !q.trim() && active === "all" ? (
              <section className="cm-series" aria-labelledby="cm-series-h">
                <div className="cm-seriesHead">
                  <h2 id="cm-series-h">Series</h2>
                  <Link to="/series" className="cm-seriesAll">
                    See all ›
                  </Link>
                </div>
                <div className="cm-seriesRow">
                  {series.slice(0, 8).map((s) => (
                    <SeriesCard key={s.id} s={s} />
                  ))}
                </div>
              </section>
            ) : null}
            {shown.map((row) => (
              <div
                key={row.key}
                id={row.category_id != null ? slug(row.title) : undefined}
                className="cm-rowAnchor"
              >
                {row.key === "continue" ? (
                  <VideoRow
                    row={{ ...row, title: "Continue watching" }}
                    plain
                    limit={4}
                    cols={4}
                  />
                ) : row.key === "my-list" ? (
                  <VideoRow
                    row={row}
                    plain
                    limit={5}
                    cols={5}
                    onSeeAll={() => navigate("/my-list")}
                  />
                ) : (
                  <VideoRow
                    row={row}
                    headerNav
                    countLabel={row.total ?? row.items.length}
                  />
                )}
              </div>
            ))}
            {shown.length ? (
              <p className="cm-more">
                <Link to="/catalog/all" className="cm-all">
                  Browse all videos with filters ›
                </Link>
              </p>
            ) : null}
            {!shown.length ? (
              <p className="vw-empty">
                {q.trim()
                  ? "No messages match your search."
                  : "No videos yet. Check back soon!"}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </main>
  );
}
