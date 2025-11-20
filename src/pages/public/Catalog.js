// src/pages/public/Catalog.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api";
import PlaylistCard from "../../components/cards/PlaylistCard";
import "./Catalog.css";

/* utils */
function absUrl(u) {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const base = (api?.defaults?.baseURL || "").replace(/\/api\/?$/i, "");
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}
function fmtDuration(sec) {
  const s = Math.max(0, Number(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${m}:${String(ss).padStart(2, "0")}`;
}
function byCreatedDesc(a, b) {
  return (
    new Date(b.created_at || b.created || 0) -
    new Date(a.created_at || a.created || 0)
  );
}
const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

/* hero slider */
function HeroSlider({ items, interval = 6000 }) {
  const [i, setI] = useState(0);
  const count = items?.length || 0;
  const timerRef = useRef(null);
  const hoveringRef = useRef(false);

  useEffect(() => {
    clearInterval(timerRef.current);
    if (count > 1) {
      timerRef.current = setInterval(() => {
        if (!hoveringRef.current) setI((x) => (x + 1) % count);
      }, interval);
    }
    return () => clearInterval(timerRef.current);
  }, [count, interval]);

  const startX = useRef(0);
  const onTouchStart = (e) => (startX.current = e.touches[0].clientX);
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 40)
      setI((x) => (dx > 0 ? (x - 1 + count) % count : (x + 1) % count));
  };

  if (!count) return null;

  return (
    <section
      className="hero hero--full theme--dark"
      onMouseEnter={() => (hoveringRef.current = true)}
      onMouseLeave={() => (hoveringRef.current = false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="hero__track"
        style={{ transform: `translateX(-${i * 100}%)` }}
      >
        {items.map((v) => {
          const thumb =
            v.thumbnail_url ||
            v.metadata?.thumbnail_url ||
            v.metadata?.thumbnail_vertical_url;
          return (
            <div key={`slide-${v.id}`} className="hero__slide">
              {thumb && (
                <img className="hero__img" src={absUrl(thumb)} alt="" />
              )}
              <div className="hero__overlay">
                <div className="hero__content">
                  <h2 className="hero__title">{v.title}</h2>

                  {v.short_description && (
                    <p className="hero__desc">{v.short_description}</p>
                  )}

                  <div className="hero__ctaRow">
                    <Link to={`/watch/${v.id}`} className="btn--purple">
                      ► Watch Here
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        className="hero__arrow hero__arrow--left"
        onClick={() => setI((x) => (x - 1 + count) % count)}
        aria-label="Previous"
      >
        ‹
      </button>
      <button
        className="hero__arrow hero__arrow--right"
        onClick={() => setI((x) => (x + 1) % count)}
        aria-label="Next"
      >
        ›
      </button>

      <div className="hero__dots">
        {items.map((_, idx) => (
          <div
            key={`dot-${idx}`}
            className={`hero__dot ${idx === i ? "hero__dot--active" : ""}`}
            onClick={() => setI(idx)}
            role="button"
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

/* cards / rows */
function VideoCard({ v, playlistKey }) {
  const href = playlistKey
    ? `/watch/${v.id}?playlist=${encodeURIComponent(playlistKey)}`
    : `/watch/${v.id}`;

  const thumb =
    v.thumbnail_url ||
    v.metadata?.thumbnail_vertical_url ||
    v.metadata?.thumbnail_url;

  return (
    <Link to={href} className="vd-card theme--dark">
      <div className="vd-thumb">
        {thumb ? (
          <img src={absUrl(thumb)} alt="" />
        ) : (
          <div className="vd-thumb__placeholder">No Image</div>
        )}
        {v.duration_seconds != null && (
          <div className="vd-pill vd-pill--dur">
            {fmtDuration(v.duration_seconds)}
          </div>
        )}
        {!v.is_premium && <div className="vd-pill vd-pill--free">Free</div>}
      </div>
      <div className="vd-title">{v.title}</div>
    </Link>
  );
}

function CategoryRow({
  title,
  href,
  items,
  playlistsForThisRow = [],
  playlistKeyForRow = null,
}) {
  const scroller = useRef(null);
  const scrollBy = (dx) =>
    scroller.current?.scrollBy({ left: dx, behavior: "smooth" });
  const hasAny =
    (Array.isArray(playlistsForThisRow) && playlistsForThisRow.length > 0) ||
    (Array.isArray(items) && items.length > 0);
  if (!hasAny) return null;

  return (
    <section className="cat-section">
      <div className="cat-section__head">
        <h3 className="cat-section__title">{title}</h3>
        {href && (
          <Link to={href} className="btn--white">
            See All
          </Link>
        )}
      </div>

      <div className="cat-row">
        <button
          className="cat-row__btn cat-row__btn--left"
          onClick={() => scrollBy(-420)}
          aria-label="scroll left"
        >
          ‹
        </button>
        <div ref={scroller} className="cat-row__scroller">
          {playlistsForThisRow.map((p) => (
            <div key={`pl-inline-${p.id}`} className="cat-row__item">
              <PlaylistCard p={p} />
            </div>
          ))}
          {items.map((v) => (
            <div key={`v-${v.id}`} className="cat-row__item">
              <VideoCard v={v} playlistKey={playlistKeyForRow} />
            </div>
          ))}
        </div>
        <button
          className="cat-row__btn cat-row__btn--right"
          onClick={() => scrollBy(420)}
          aria-label="scroll right"
        >
          ›
        </button>
      </div>
    </section>
  );
}

/* category extraction */
function extractCategoryForVideo(v) {
  let id =
    v.category_id ??
    v.categoryId ??
    v?.category?.id ??
    v?.metadata?.category_id;

  let name =
    v.category_name ??
    v?.category?.name ??
    (typeof v?.category === "string" ? v.category : undefined) ??
    v?.metadata?.category_name ??
    v?.metadata?.category;

  if (!id && !name && Array.isArray(v?.categories) && v.categories.length) {
    const c = v.categories[0];
    id = c?.id ?? null;
    name = c?.name ?? null;
  }
  if (id != null && id !== "" && id !== "null") {
    return { key: String(id), name: name || `Category ${id}` };
  }
  if (name) {
    return { key: `name:${slugify(name)}`, name };
  }
  return null;
}

/* main */
export default function Catalog() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [playlists, setPlaylists] = useState([]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [q, setQ] = useState(sp.get("q") || "");
  const [filterCat, setFilterCat] = useState(sp.get("cat") || "all");
  const [filterYear, setFilterYear] = useState(sp.get("year") || "all");
  const [filterSubject, setFilterSubject] = useState(sp.get("subj") || "all");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const catsRes = await api
          .get("/public/categories")
          .catch(() => ({ data: { items: [] } }));
        const rawCats = Array.isArray(catsRes.data?.items)
          ? catsRes.data.items
          : Array.isArray(catsRes.data)
          ? catsRes.data
          : [];
        setCategories(
          rawCats
            .map((c) => ({
              id:
                c.id ??
                c.category_id ??
                c.value ??
                c.slug ??
                (c.name ? slugify(c.name) : undefined),
              name: c.name ?? c.title ?? c.slug ?? `Category ${c.id ?? ""}`,
            }))
            .filter((c) => c.id != null && c.name)
        );

        let items = [];
        try {
          const r1 = await api.get("/videos/public", {
            params: { limit: 1000 },
          });
          items = Array.isArray(r1.data?.items) ? r1.data.items : r1.data || [];
        } catch {
          /* ignore */
        }
        if (!Array.isArray(items) || items.length === 0) {
          try {
            const r2 = await api.get("/public/videos", {
              params: { limit: 1000 },
            });
            items = Array.isArray(r2.data?.items)
              ? r2.data.items
              : r2.data || [];
          } catch {
            /* ignore */
          }
        }
        setVideos((items || []).sort(byCreatedDesc));

        const plsRes = await api
          .get("/playlists/public", { params: { limit: 200, nonempty: 1 } })
          .catch(() => ({ data: { items: [] } }));
        setPlaylists(
          Array.isArray(plsRes.data?.items) ? plsRes.data.items : []
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allCategorized = useMemo(
    () =>
      videos
        .map((v) => ({ v, cat: extractCategoryForVideo(v) }))
        .filter((x) => x.cat),
    [videos]
  );

  const idToName = useMemo(() => {
    const m = new Map();
    (categories || []).forEach((c) => {
      const id = c.id ?? c.category_id ?? c.value ?? c.slug ?? null;
      const name = c.name ?? c.title ?? c.slug ?? "";
      if (id != null && String(id).length) m.set(String(id), name);
    });
    return m;
  }, [categories]);

  const categoryOptions = useMemo(() => {
    const map = new Map();
    for (const { cat } of allCategorized) {
      const key = cat.key;
      const label = key.startsWith("name:")
        ? cat.name || "Uncategorized"
        : idToName.get(key) || cat.name || "Uncategorized";
      if (!map.has(key)) map.set(key, label);
    }
    return [{ key: "all", name: "All" }].concat(
      Array.from(map.entries()).map(([key, name]) => ({ key, name }))
    );
  }, [allCategorized, idToName]);

  const yearOptions = useMemo(() => {
    const set = new Set();
    for (const { v } of allCategorized) {
      const y = new Date(v.created_at || v.created || 0).getFullYear();
      if (Number.isFinite(y) && y > 1900) set.add(String(y));
    }
    const years = Array.from(set).sort((a, b) => Number(b) - Number(a));
    return [{ key: "all", name: "All" }].concat(
      years.map((y) => ({ key: y, name: y }))
    );
  }, [allCategorized]);

  const subjectOptions = useMemo(() => {
    const set = new Map();
    for (const { v } of allCategorized) {
      const tags = Array.isArray(v?.metadata?.tags) ? v.metadata.tags : [];
      for (const t of tags) {
        const disp = String(t).trim();
        const low = disp.toLowerCase();
        if (disp) set.set(low, disp);
      }
    }
    return [{ key: "all", name: "All" }].concat(
      Array.from(set.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([low, disp]) => ({ key: low, name: disp }))
    );
  }, [allCategorized]);

  const filtered = useMemo(() => {
    let out = videos;
    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      out = out.filter(
        (v) =>
          v.title?.toLowerCase().includes(qq) ||
          v.description?.toLowerCase().includes(qq) ||
          (Array.isArray(v?.metadata?.tags) &&
            v.metadata.tags.some((t) => String(t).toLowerCase().includes(qq)))
      );
    }
    if (filterCat !== "all") {
      out = out.filter((v) => extractCategoryForVideo(v)?.key === filterCat);
    }
    if (filterYear !== "all") {
      out = out.filter((v) => {
        const y = new Date(v.created_at || v.created || 0).getFullYear();
        return String(y) === String(filterYear);
      });
    }
    if (filterSubject !== "all") {
      out = out.filter((v) => {
        const tags = Array.isArray(v?.metadata?.tags) ? v.metadata.tags : [];
        return tags.some((t) => String(t).toLowerCase() === filterSubject);
      });
    }
    return out;
  }, [videos, q, filterCat, filterYear, filterSubject]);

  const withCat = useMemo(
    () =>
      filtered
        .map((v) => ({ v, cat: extractCategoryForVideo(v) }))
        .filter((x) => x.cat != null),
    [filtered]
  );

  const heroItems = useMemo(
    () => withCat.slice(0, 6).map((x) => x.v),
    [withCat]
  );

  const featuredPlaylistByCatId = useMemo(() => {
    const map = new Map();
    for (const p of playlists || []) {
      const cid = p.featured_category_id ?? p.featuredCategoryId ?? null;
      if (cid == null) continue;
      const key = String(cid);
      if (!map.has(key)) map.set(key, p);
    }
    return map;
  }, [playlists]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const { v, cat } of withCat) {
      const key = cat.key;
      const name = key.startsWith("name:")
        ? cat.name
        : idToName.get(key) || cat.name || "Category";
      if (!map.has(key)) map.set(key, { name, items: [], lastCreated: 0 });
      const g = map.get(key);
      g.items.push(v);
      const ts = new Date(v.created_at || v.created || 0).getTime() || 0;
      if (ts > g.lastCreated) g.lastCreated = ts;
    }
    const rows = Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
    rows.sort((a, b) => b.lastCreated - a.lastCreated);
    return rows;
  }, [withCat, idToName]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (filterCat !== "all") params.set("cat", filterCat);
    if (filterYear !== "all") params.set("year", filterYear);
    if (filterSubject !== "all") params.set("subj", filterSubject);
    navigate({ search: params.toString() }, { replace: true });
  }, [q, filterCat, filterYear, filterSubject, navigate]);

  if (loading)
    return (
      <div className="catalog-page theme--dark">
        <div className="card card--dark">Loading catalog…</div>
      </div>
    );

  return (
    <div className="catalog-page theme--dark">
      <HeroSlider items={heroItems} />

      <div className="card--dark">
        <div className="catalog-toolbar">
          <button
            className="btn--purple"
            onClick={() => setFiltersOpen((s) => !s)}
          >
            ☰ Filters
          </button>
          <div className="catalog-toolbar__right">
            <input
              className="search search--dark"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {filtersOpen && (
          <div className="filters-panel">
            <div className="filters-grid">
              <div className="filters-field">
                <div className="filters-label">Category</div>
                <select
                  className="search search--dark"
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value)}
                >
                  {categoryOptions.map((o) => (
                    <option key={`catopt-${o.key}`} value={o.key}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filters-field">
                <div className="filters-label">Year</div>
                <select
                  className="search search--dark"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                >
                  {yearOptions.map((o) => (
                    <option key={`yopt-${o.key}`} value={o.key}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filters-field">
                <div className="filters-label">Subjects</div>
                <select
                  className="search search--dark"
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                >
                  {subjectOptions.map((o) => (
                    <option key={`sopt-${o.key}`} value={o.key}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {grouped.map((g) => {
          const inlinePlaylists = g.key.startsWith("name:")
            ? []
            : (() => {
                const pl = featuredPlaylistByCatId.get(g.key);
                return pl ? [pl] : [];
              })();

          const playlistKeyForRow =
            inlinePlaylists.length > 0
              ? inlinePlaylists[0].slug ||
                inlinePlaylists[0].id ||
                inlinePlaylists[0].playlist_id
              : null;

          // NEW: "See All" links to the admin public playlist if available; otherwise fallback
          const seeAllHref =
            inlinePlaylists.length > 0
              ? `/playlist/${encodeURIComponent(
                  inlinePlaylists[0].slug || inlinePlaylists[0].id
                )}`
              : `/p/videos?category=${encodeURIComponent(g.key)}`;

          return (
            <CategoryRow
              key={`cat-${g.key}`}
              title={g.name}
              href={seeAllHref}
              items={g.items.slice(0, 12)}
              playlistsForThisRow={inlinePlaylists}
              playlistKeyForRow={playlistKeyForRow}
            />
          );
        })}

        {!grouped.length && (
          <div className="empty">
            Make sure each video has a category set (ID or name).
          </div>
        )}
      </div>
    </div>
  );
}
