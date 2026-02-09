// src/pages/public/Catalog.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api";
import DefaultThumb from "../../assets/BishopRobertsonTVLogo.png";
import CatalogBanner from "../../assets/brtv-catalog-banner.jpg";
import "./Catalog.css";

/* -----------------------------------------
   Utilities
----------------------------------------- */
const absUrl = (u) => {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;

  const base = (api?.defaults?.baseURL || "").replace(/\/api\/?$/i, "");
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
};

const fmtDuration = (sec) => {
  const s = Math.max(0, Number(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${m}:${String(ss).padStart(2, "0")}`;
};

const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

/**
 * Safe GET that never throws. Returns:
 * { ok: boolean, status: number, data: any }
 */
async function safeGet(path, opts = {}) {
  try {
    const res = await api.get(path, {
      ...opts,
      // prevents axios from throwing on 4xx/5xx
      validateStatus: () => true,
    });
    const status = res?.status ?? 0;
    const ok = status >= 200 && status < 300;
    return { ok, status, data: res?.data };
  } catch (e) {
    return { ok: false, status: 0, data: null };
  }
}

/* -----------------------------------------
   Publish guard (Collections / Playlists)
----------------------------------------- */
function isCollectionPublished(c) {
  if (!c || typeof c !== "object") return true;

  if (
    c.is_published === false ||
    c.isPublished === false ||
    c.published === false
  )
    return false;
  if (c.is_published === true || c.isPublished === true || c.published === true)
    return true;

  if (c.published_at || c.publishedAt) return true;
  if (c.unpublished_at || c.unpublishedAt) return false;

  const raw =
    c.status ??
    c.publish_status ??
    c.visibility ??
    c.state ??
    c.lifecycle ??
    c.publishState ??
    null;

  if (raw != null) {
    const s = String(raw).toLowerCase();
    if (s.includes("unpublish") || s.includes("draft") || s.includes("private"))
      return false;
    if (s.includes("publish") || s.includes("public") || s === "live")
      return true;
  }

  return true;
}

/* -----------------------------------------
   Modern Loading Spinner (MUI-like, no deps)
----------------------------------------- */
function CircularSpinner({ size = 44, label = "Loading…" }) {
  const ring = Math.max(4, Math.round(size / 10));

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        gap: 10,
        padding: "18px 0",
      }}
    >
      <style>{`
        @keyframes brtv-spin { to { transform: rotate(360deg); } }
        @keyframes brtv-dash {
          0%   { stroke-dasharray: 1, 200; stroke-dashoffset: 0; }
          50%  { stroke-dasharray: 90, 200; stroke-dashoffset: -35; }
          100% { stroke-dasharray: 90, 200; stroke-dashoffset: -125; }
        }
      `}</style>

      <div
        aria-label={label}
        role="status"
        style={{
          width: size,
          height: size,
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 50 50"
          style={{
            animation: "brtv-spin 1.2s linear infinite",
            filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.35))",
          }}
        >
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={ring}
          />
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="rgba(154, 92, 255, 0.95)"
            strokeLinecap="round"
            strokeWidth={ring}
            style={{
              animation: "brtv-dash 1.4s ease-in-out infinite",
            }}
          />
        </svg>
      </div>

      <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 14 }}>
        {label}
      </div>
    </div>
  );
}

/* -----------------------------------------
   Video Card
   ✅ FIX: Hide duration badge when duration is 0
----------------------------------------- */
function VideoCard({ v }) {
  const href = `/watch/${v.id}`;

  const thumb =
    v.thumbnail_url ||
    v.metadata?.thumbnail_vertical_url ||
    v.metadata?.thumbnail_url;

  const realSrc = absUrl(thumb);
  const src = realSrc || DefaultThumb;
  const isDefault = !realSrc;

  const dur = Number(v.duration_seconds || 0);
  const showDuration = Number.isFinite(dur) && dur > 0;

  return (
    <Link to={href} className="nf-card">
      <div className="nf-thumb">
        <img
          src={src}
          alt={v.title || "Video"}
          className={
            isDefault ? "nf-thumb-img nf-thumb-img--default" : "nf-thumb-img"
          }
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = DefaultThumb;
            e.currentTarget.className = "nf-thumb-img nf-thumb-img--default";
          }}
        />

        {showDuration && <div className="nf-duration">{fmtDuration(dur)}</div>}

        <div className="nf-overlay" />
        <div className="nf-play-btn">▶</div>
      </div>

      <div className="nf-title">{v.title}</div>
    </Link>
  );
}

/* -----------------------------------------
   Admin Collection Card (Playlist)
   ✅ FIX: Hide count badge when count is 0
----------------------------------------- */
function CollectionCard({ c, categoryTitle }) {
  const href = `/admin-collections/${c.id}`;

  const thumb =
    c.thumbnail_url ||
    c.cover_url ||
    c.image_url ||
    c.poster_url ||
    c?.metadata?.thumbnail_url ||
    c?.metadata?.cover_url;

  const realSrc = absUrl(thumb);
  const src = realSrc || DefaultThumb;
  const isDefault = !realSrc;

  const title = c.title || c.name || "Playlist";
  const count =
    c.item_count ??
    c.items_count ??
    c.video_count ??
    c.videos_count ??
    c.count ??
    (Array.isArray(c.items) ? c.items.length : null);

  const showCount = Number(count) > 0;

  return (
    <Link to={href} className="nf-card">
      <div className="nf-thumb">
        <img
          src={src}
          alt={title}
          className={
            isDefault ? "nf-thumb-img nf-thumb-img--default" : "nf-thumb-img"
          }
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = DefaultThumb;
            e.currentTarget.className = "nf-thumb-img nf-thumb-img--default";
          }}
        />
        <div className="nf-overlay" />

        <div
          style={{
            position: "absolute",
            left: 10,
            bottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 3,
          }}
        >
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              letterSpacing: "0.04em",
            }}
          >
            PLAYLIST
          </div>

          {showCount && (
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                background: "rgba(0,0,0,0.55)",
                color: "#fff",
              }}
            >
              {count}
            </div>
          )}
        </div>
      </div>

      <div className="nf-title">
        {categoryTitle
          ? `${categoryTitle} - (Playlist)`
          : `${title} - (Playlist)`}
      </div>
    </Link>
  );
}

/* -----------------------------------------
   Extract Category (Videos)
----------------------------------------- */
function extractCategory(v) {
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
    id = c.id ?? null;
    name = c.name ?? null;
  }

  if (id) return { key: String(id), name: name || "Untitled Category" };
  if (name) return { key: `slug:${slugify(name)}`, name };
  return null;
}

/* -----------------------------------------
   Extract Category (Collections / Playlists)
----------------------------------------- */
function extractCollectionCategory(c) {
  const id =
    c.featured_category_id ??
    c.display_category_id ??
    c.display_in_category_id ??
    c.displays_in_category_id ??
    c.category_id ??
    c.categoryId ??
    c?.category?.id ??
    c?.metadata?.category_id ??
    null;

  const name =
    c.featured_category_name ??
    c.display_category_name ??
    c.category_name ??
    c?.category?.name ??
    (typeof c?.category === "string" ? c.category : undefined) ??
    c?.metadata?.category_name ??
    c?.metadata?.category ??
    null;

  if (id) return { key: String(id), name: name || "Untitled Category" };
  if (name) return { key: `slug:${slugify(name)}`, name };
  return null;
}

/* -----------------------------------------
   Helper: publish-aware date
----------------------------------------- */
function getPublishOrCreateMs(x) {
  const raw =
    x?.published_at ??
    x?.publishedAt ??
    x?.metadata?.published_at ??
    x?.metadata?.publishedAt ??
    x?.created_at ??
    x?.createdAt ??
    null;

  const d = raw ? new Date(raw) : null;
  const ms = d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
  return ms;
}

/* ✅ Publish-date sort for items in a category (publish wins) */
function sortWithinCategory(a, b) {
  const da = getPublishOrCreateMs(a);
  const db = getPublishOrCreateMs(b);
  return db - da;
}

/* -----------------------------------------
   MAIN PAGE
----------------------------------------- */
export default function Catalog() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const [loading, setLoading] = useState(true);

  const [videos, setVideos] = useState([]);
  const [collections, setCollections] = useState([]);
  const [categories, setCategories] = useState([]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [q, setQ] = useState(sp.get("q") || "");
  const [filterCat, setFilterCat] = useState(sp.get("cat") || "all");
  const [filterYear, setFilterYear] = useState(sp.get("year") || "all");
  const [filterSubject, setFilterSubject] = useState(sp.get("subj") || "all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Categories
        let rawCats = [];
        {
          const catsRes = await safeGet("/public/categories");
          if (catsRes.ok) rawCats = catsRes?.data?.items || catsRes?.data || [];
        }

        const fromApi = (rawCats || []).map((c) => ({
          id: c.id ?? c.slug ?? slugify(c.name),
          name: c.name ?? c.title ?? c.slug ?? "Untitled",
        }));

        // Videos
        let items = [];
        {
          const r1 = await safeGet("/videos/public", {
            params: { limit: 1000 },
          });
          if (r1.ok) items = r1.data?.items || r1.data || [];
        }

        if (!items.length) {
          const r2 = await safeGet("/public/videos");
          if (r2.ok) items = r2.data?.items || r2.data || [];
        }

        setVideos(items || []);

        // Collections/Playlists (published only)
        let cols = [];

        // Prefer collections endpoints first
        const collectionEndpoints = [
          ["/public/collections", { limit: 200 }],
          ["/collections/public", { limit: 200 }],
        ];

        for (const [path, params] of collectionEndpoints) {
          const rr = await safeGet(path, { params });
          if (rr.ok) {
            const got = rr?.data?.items || rr?.data || [];
            if (Array.isArray(got) && got.length) {
              cols = got;
              break;
            }
          }
        }

        // If no collections found, try playlists endpoints safely
        if (!cols.length) {
          const playlistEndpoints = [
            ["/public/playlists", null],
            ["/playlists/public", null],
            ["/public/playlists", { limit: 200 }],
            ["/playlists/public", { limit: 200 }],
          ];

          for (const [path, params] of playlistEndpoints) {
            const rr = await safeGet(path, params ? { params } : undefined);
            if (!rr.ok) continue;

            const got = rr?.data?.items || rr?.data || [];
            if (Array.isArray(got) && got.length) {
              cols = got;
              break;
            }
          }
        }

        const publishedCols = (cols || []).filter(isCollectionPublished);
        setCollections(publishedCols);

        const fromVideos = (items || [])
          .map((v) => extractCategory(v))
          .filter(Boolean)
          .map((c) => ({ id: c.key, name: c.name }));

        const fromCollections = (publishedCols || [])
          .map((c) => extractCollectionCategory(c))
          .filter(Boolean)
          .map((c) => ({ id: c.key, name: c.name }));

        const allCats = [...fromApi, ...fromVideos, ...fromCollections];
        const deduped = Array.from(
          new Map(allCats.map((c) => [String(c.id), c])).values(),
        );

        setCategories(deduped);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredVideos = useMemo(() => {
    let out = [...videos];

    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      out = out.filter(
        (v) =>
          v.title?.toLowerCase().includes(qq) ||
          v.description?.toLowerCase().includes(qq) ||
          v.metadata?.tags?.some((t) => String(t).toLowerCase().includes(qq)),
      );
    }

    if (filterCat !== "all") {
      out = out.filter((v) => extractCategory(v)?.key === filterCat);
    }

    if (filterYear !== "all") {
      out = out.filter((v) => {
        const ms = getPublishOrCreateMs(v);
        if (!ms) return false;
        return new Date(ms).getFullYear() == filterYear;
      });
    }

    if (filterSubject !== "all") {
      out = out.filter((v) =>
        v.metadata?.tags?.some(
          (t) => String(t).toLowerCase() === filterSubject,
        ),
      );
    }

    return out;
  }, [videos, q, filterCat, filterYear, filterSubject]);

  const filteredCollections = useMemo(() => {
    let out = [...collections].filter(isCollectionPublished);

    if (filterCat !== "all") {
      out = out.filter((c) => extractCollectionCategory(c)?.key === filterCat);
    }

    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      out = out.filter(
        (c) =>
          (c.title || c.name || "").toLowerCase().includes(qq) ||
          (c.description || "").toLowerCase().includes(qq),
      );
    }

    return out;
  }, [collections, filterCat, q]);

  const grouped = useMemo(() => {
    const map = new Map();

    filteredVideos.forEach((v) => {
      const cat = extractCategory(v);
      if (!cat) return;
      if (!map.has(cat.key))
        map.set(cat.key, { name: cat.name, videos: [], collections: [] });
      map.get(cat.key).videos.push(v);
    });

    filteredCollections.forEach((c) => {
      const cat = extractCollectionCategory(c);
      if (!cat) return;
      if (!map.has(cat.key))
        map.set(cat.key, { name: cat.name, videos: [], collections: [] });
      map.get(cat.key).collections.push(c);
    });

    return [...map.entries()].map(([key, val]) => ({
      key,
      name: val.name,
      videos: [...val.videos].sort(sortWithinCategory),
      collections: [...val.collections].sort((a, b) => {
        const da = getPublishOrCreateMs(a);
        const db = getPublishOrCreateMs(b);
        return db - da;
      }),
    }));
  }, [filteredVideos, filteredCollections]);

  useEffect(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (filterCat !== "all") p.set("cat", filterCat);
    if (filterYear !== "all") p.set("year", filterYear);
    if (filterSubject !== "all") p.set("subj", filterSubject);

    navigate({ search: p.toString() }, { replace: true });
  }, [q, filterCat, filterYear, filterSubject, navigate]);

  if (loading)
    return (
      <div className="catalog-page theme--dark">
        <div className="card--dark">
          <CircularSpinner label="Loading catalog…" />
        </div>
      </div>
    );

  return (
    <div className="catalog-page theme--dark">
      <div
        className="catalog-hero"
        style={{ backgroundImage: `url(${CatalogBanner})` }}
      >
        <div className="catalog-hero-overlay" />
        <div className="catalog-hero-inner">
          <h1 className="catalog-hero-title">Catalog</h1>
          <div className="catalog-hero-subtitle">
            Browse by category and watch your favorite messages.
          </div>
        </div>
      </div>

      <div className="catalog-controls">
        <div className="catalog-toolbar">
          <button
            className="filter-btn"
            onClick={() => setFiltersOpen((s) => !s)}
            type="button"
          >
            ☰ Filters
          </button>

          <input
            className="search search--dark"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {filtersOpen && (
          <div className="filters-panel">
            <div className="filter-block">
              <label>Category</label>
              <select
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value)}
              >
                <option value="all">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-block">
              <label>Year</label>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              >
                <option value="all">All</option>
                {Array.from(
                  new Set(
                    videos
                      .map((v) => getPublishOrCreateMs(v))
                      .filter(Boolean)
                      .map((ms) => new Date(ms).getFullYear()),
                  ),
                )
                  .sort((a, b) => b - a)
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
            </div>

            <div className="filter-block">
              <label>Subject</label>
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
              >
                <option value="all">All</option>

                {Array.from(
                  new Set(
                    videos.flatMap(
                      (v) =>
                        v.metadata?.tags?.map((t) => t.toLowerCase()) || [],
                    ),
                  ),
                ).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="filter-reset-btn"
              type="button"
              onClick={() => {
                setFilterCat("all");
                setFilterYear("all");
                setFilterSubject("all");
                setQ("");
              }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      <div className="catalog-content">
        {grouped.map((g) => (
          <CategoryGrid
            key={g.key}
            title={g.name}
            items={g.videos}
            collections={g.collections}
          />
        ))}

        {!grouped.length && <div className="empty">No categories found.</div>}
      </div>
    </div>
  );
}

/* -----------------------------------------
   CATEGORY GRID
----------------------------------------- */
function CategoryGrid({ title, items, collections }) {
  const [limit, setLimit] = useState(8);

  const hasCollection = Array.isArray(collections) && collections.length > 0;
  const videoSlots = hasCollection ? Math.max(0, limit - 1) : limit;

  const visibleVideos = items.slice(0, videoSlots);
  const hasMore = items.length > videoSlots;

  const firstCollection = hasCollection ? collections[0] : null;

  return (
    <section className="cat-grid-section">
      <h2 className="section-title">{title}</h2>

      <div className="nf-grid">
        {firstCollection && (
          <CollectionCard c={firstCollection} categoryTitle={title} />
        )}

        {visibleVideos.map((v) => (
          <VideoCard key={v.id} v={v} />
        ))}
      </div>

      {hasMore && (
        <button
          className="nf-showmore"
          type="button"
          onClick={() => setLimit((l) => l + 8)}
        >
          Show More
        </button>
      )}
    </section>
  );
}
