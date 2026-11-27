// src/pages/public/Catalog.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api";
// Play button in the ministry's brand color (no thumbnail).
import { DEFAULT_THUMB as DefaultThumb } from "../../lib/brand";
import { contentUrl } from "../../lib/siteContent";
import "./Catalog.css";

// This site's own banner (public/content/, set per ministry at build time).
const CatalogBanner = contentUrl("catalog-banner.jpg");

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

const CATALOG_CACHE_KEY = "brtv_catalog_cache_v3";
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeItems(data) {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.videos)) return data.videos;
  if (Array.isArray(data)) return data;
  return [];
}

function readCatalogCache() {
  try {
    const raw = sessionStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed?.savedAt ||
      Date.now() - parsed.savedAt > CATALOG_CACHE_TTL_MS
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCatalogCache(payload) {
  try {
    sessionStorage.setItem(
      CATALOG_CACHE_KEY,
      JSON.stringify({ ...payload, savedAt: Date.now() }),
    );
  } catch {}
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

  const realSrc = cardThumb(absUrl(thumb));
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
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          ref={markIfLoaded}
          onLoad={(e) => markLoaded(e.currentTarget)}
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
  const href =
    c._source === "collection"
      ? `/catalog?collection=${c.id}`
      : `/admin-collections/${c.id}`;

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
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          ref={markIfLoaded}
          onLoad={(e) => markLoaded(e.currentTarget)}
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
  // Collections have no category column in the current database schema.
  // Group them by their own title rather than dropping them.
  if (c._source === "collection") {
    const title = c.title || c.name || "Collection";
    return { key: `collection:${c.id}`, name: title };
  }
  if (c._source === "playlist") {
    const title = c.title || c.name || "Playlist";
    return { key: `playlist:${c.id}`, name: title };
  }
  return null;
}

/* -----------------------------------------
   Catalog sections: merge and hide (client requests)
   - MERGE: show a category's messages inside another one
   - HIDE:  don't show a category in the Catalog (or in the Category filter)
   Names are matched without capitals / extra spaces.
----------------------------------------- */
const CATALOG_MERGE = { "2026 archives": "2026 messages" };
const CATALOG_HIDE = new Set(["archives"]);
const normName = (n) =>
  String(n || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
const canonName = (n) => CATALOG_MERGE[normName(n)] || normName(n);

function mergeAndHideGroups(groups) {
  const out = [];
  const byName = new Map();
  for (const g of groups) {
    if (CATALOG_HIDE.has(normName(g.name))) continue;
    const target = CATALOG_MERGE[normName(g.name)];
    if (!target) {
      out.push(g);
      byName.set(normName(g.name), g);
    }
  }
  for (const g of groups) {
    const target = CATALOG_MERGE[normName(g.name)];
    if (!target || CATALOG_HIDE.has(normName(g.name))) continue;
    let dest = byName.get(target);
    if (!dest) {
      // the target has no messages of its own yet: show it under its name
      dest = {
        ...g,
        key: `merged:${target}`,
        name: target.replace(/\b\w/g, (ch) => ch.toUpperCase()),
        videos: [],
        collections: [],
      };
      out.push(dest);
      byName.set(target, dest);
    }
    const seenV = new Set(dest.videos.map((v) => String(v.id)));
    const seenC = new Set(dest.collections.map((c) => String(c.id)));
    dest.videos = [
      ...dest.videos,
      ...g.videos.filter((v) => !seenV.has(String(v.id))),
    ].sort(sortWithinCategory);
    dest.collections = [
      ...dest.collections,
      ...g.collections.filter((c) => !seenC.has(String(c.id))),
    ];
  }
  return out;
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

/* Message date: the date at the end of the title ("… 12-31-25") is the real
   service date; some saved publish dates are wrong, which put rows out of
   order. Falls back to the publish date. */
function titleDateMs(title) {
  const m = String(title || "").match(
    /(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})(?!.*\d{1,2}-\d{1,2}-\d{2})/,
  );
  if (!m) return 0;
  const mo = Number(m[1]);
  const d = Number(m[2]);
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return 0;
  return Date.UTC(y, mo - 1, d, 12);
}
function messageDateMs(x) {
  return titleDateMs(x?.title) || getPublishOrCreateMs(x);
}
function sortWithinCategory(a, b) {
  return messageDateMs(b) - messageDateMs(a);
}

// Fade a card image in (and stop its placeholder) once it has arrived.
function markLoaded(img) {
  img.classList.add("is-loaded");
  img.parentElement?.classList.add("is-loaded");
}
function markIfLoaded(img) {
  if (img && img.complete && img.naturalWidth > 0) markLoaded(img);
}

/* Card-size thumbnails when Bunny's image optimizer is on (REACT_APP_BUNNY_OPTIMIZER=true):
   much smaller files, so cards fill in faster. */
function cardThumb(url) {
  if (
    !url ||
    String(process.env.REACT_APP_BUNNY_OPTIMIZER || "").toLowerCase() !== "true"
  )
    return url;
  try {
    const u = new URL(url);
    if (!/\.b-cdn\.net$/i.test(u.hostname)) return url;
    u.searchParams.set("width", "640");
    u.searchParams.set("quality", "75");
    return u.toString();
  } catch {
    return url;
  }
}

/* -----------------------------------------
   MAIN PAGE
----------------------------------------- */
// Display newest message archive first, exclusives second, then older archives.
function sortCatalogGroups(groups) {
  const info = (name) => {
    const label = String(name || "");
    const year = label.match(/\b(?:19|20)\d{2}\b/);
    return {
      exclusive: /exclusive/i.test(label),
      year: year ? Number(year[0]) : null,
    };
  };
  const years = groups.map((g) => info(g.name).year).filter((y) => y !== null);
  const latest = years.length ? Math.max(...years) : null;
  return groups.sort((a, b) => {
    const x = info(a.name),
      y = info(b.name);
    const tier = (v) =>
      v.year === latest && !v.exclusive && latest !== null
        ? 0
        : v.exclusive
          ? 1
          : v.year !== null
            ? 2
            : 3;
    return (
      tier(x) - tier(y) ||
      (x.year !== null && y.year !== null ? y.year - x.year : 0) ||
      a.name.localeCompare(b.name)
    );
  });
}

export default function Catalog() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const [loading, setLoading] = useState(true);

  const [videos, setVideos] = useState([]);
  const [collections, setCollections] = useState([]);
  const [collectionVideos, setCollectionVideos] = useState([]);
  const [categories, setCategories] = useState([]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [q, setQ] = useState(sp.get("q") || "");
  const [filterCat, setFilterCat] = useState(sp.get("cat") || "all");
  const [filterYear, setFilterYear] = useState(sp.get("year") || "all");
  const [filterSubject, setFilterSubject] = useState(sp.get("subj") || "all");

  useEffect(() => {
    let alive = true;

    const cached = readCatalogCache();
    if (cached) {
      setVideos(cached.videos || []);
      setCollections(cached.collections || []);
      setCollectionVideos(cached.collectionVideos || []);
      setCategories(cached.categories || []);
      setLoading(false);
    } else {
      setLoading(true);
    }

    (async () => {
      try {
        // Fetch all independent public sources. Playlists and collections are
        // different database tables; one must never suppress the other.
        const [catsRes, videosRes, playlistsRes, collectionRes] =
          await Promise.all([
            safeGet("/public/categories"),
            safeGet("/videos/public", { params: { limit: 600 } }),
            safeGet("/playlists/public", { params: { limit: 200 } }),
            safeGet("/collections/public", { params: { limit: 200 } }),
          ]);
        if (!alive) return;

        const rawCats = catsRes.ok ? normalizeItems(catsRes.data) : [];
        const fromApi = rawCats.map((c) => ({
          id: c.id ?? c.slug ?? slugify(c.name),
          name: c.name ?? c.title ?? c.slug ?? "Untitled",
        }));

        let items = videosRes.ok ? normalizeItems(videosRes.data) : [];
        if (!videosRes.ok) {
          const alternate = await safeGet("/public/videos", {
            params: { limit: 500 },
          });
          if (!alive) return;
          if (alternate.ok) items = normalizeItems(alternate.data);
        }

        const playlists = playlistsRes.ok
          ? normalizeItems(playlistsRes.data).map((c) => ({
              ...c,
              _source: "playlist",
            }))
          : [];
        const rawCollections = collectionRes.ok
          ? normalizeItems(collectionRes.data).filter(isCollectionPublished)
          : [];

        // A collection is a named archive containing its own published videos.
        // Load its videos from the collection membership endpoint; do not
        // depend on category_id being present on each member video.
        const details = await Promise.all(
          rawCollections.map(async (c) => {
            const r = await safeGet(
              `/collections/public/${encodeURIComponent(c.id)}/videos`,
            );
            return {
              collection: c,
              videos: r.ok ? normalizeItems(r.data) : [],
            };
          }),
        );
        if (!alive) return;
        const validDetails = details.filter((d) => d.videos.length > 0);
        const publishedCols = [
          ...playlists.filter(isCollectionPublished),
          ...validDetails.map(({ collection }) => ({
            ...collection,
            _source: "collection",
          })),
        ];
        const memberVideos = validDetails.flatMap(
          ({ collection, videos: memberItems }) =>
            memberItems.map((v) => ({
              ...v,
              _collectionId: collection.id,
              _collectionTitle: collection.title,
            })),
        );

        const fromVideos = items
          .map(extractCategory)
          .filter(Boolean)
          .map((c) => ({ id: c.key, name: c.name }));
        const fromCollections = publishedCols
          .map(extractCollectionCategory)
          .filter(Boolean)
          .map((c) => ({ id: c.key, name: c.name }));
        const allCats = [...fromApi, ...fromVideos, ...fromCollections];
        const deduped = Array.from(
          new Map(allCats.map((c) => [String(c.id), c])).values(),
        );

        setVideos(items || []);
        setCollections(publishedCols);
        setCollectionVideos(memberVideos);
        setCategories(deduped);
        writeCatalogCache({
          videos: items || [],
          collections: publishedCols,
          collectionVideos: memberVideos,
          categories: deduped,
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
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
      const want = canonName(
        categories.find((c) => String(c.id) === filterCat)?.name,
      );
      out = out.filter(
        (v) =>
          extractCategory(v)?.key === filterCat ||
          (want && canonName(extractCategory(v)?.name) === want),
      );
    }

    if (filterYear !== "all") {
      out = out.filter((v) => {
        const ms = getPublishOrCreateMs(v);
        if (!ms) return false;
        return new Date(ms).getFullYear() === Number(filterYear);
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
  }, [videos, q, filterCat, filterYear, filterSubject, categories]);

  const filteredCollections = useMemo(() => {
    let out = [...collections].filter(isCollectionPublished);

    if (filterCat !== "all") {
      const want = canonName(
        categories.find((x) => String(x.id) === filterCat)?.name,
      );
      out = out.filter(
        (c) =>
          extractCollectionCategory(c)?.key === filterCat ||
          (want && canonName(extractCollectionCategory(c)?.name) === want),
      );
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
  }, [collections, filterCat, q, categories]);

  const filteredCollectionVideos = useMemo(() => {
    let out = collectionVideos;
    if (filterCat !== "all")
      out = out.filter((v) => `collection:${v._collectionId}` === filterCat);
    if (q.trim()) {
      const term = q.trim().toLowerCase();
      out = out.filter(
        (v) =>
          String(v.title || "")
            .toLowerCase()
            .includes(term) ||
          String(v._collectionTitle || "")
            .toLowerCase()
            .includes(term) ||
          String(v.description || "")
            .toLowerCase()
            .includes(term),
      );
    }
    if (filterYear !== "all")
      out = out.filter((v) => {
        const date = getPublishOrCreateMs(v);
        return date && new Date(date).getFullYear() === Number(filterYear);
      });
    if (filterSubject !== "all")
      out = out.filter((v) =>
        v.metadata?.tags?.some(
          (t) => String(t).toLowerCase() === filterSubject,
        ),
      );
    return out;
  }, [collectionVideos, filterCat, q, filterYear, filterSubject]);

  const grouped = useMemo(() => {
    const map = new Map();

    filteredVideos.forEach((v) => {
      const cat = extractCategory(v);
      if (!cat) return;
      if (!map.has(cat.key))
        map.set(cat.key, { name: cat.name, videos: [], collections: [] });
      map.get(cat.key).videos.push(v);
    });

    filteredCollectionVideos.forEach((v) => {
      const key = `collection:${v._collectionId}`;
      if (!map.has(key))
        map.set(key, {
          name: v._collectionTitle || "Collection",
          videos: [],
          collections: [],
        });
      map.get(key).videos.push(v);
    });

    filteredCollections.forEach((c) => {
      const cat = extractCollectionCategory(c);
      if (!cat) return;
      if (!map.has(cat.key))
        map.set(cat.key, { name: cat.name, videos: [], collections: [] });
      // Collection videos are rendered directly as playable cards, because
      // App.js has no public collection-detail route.
      if (c._source !== "collection") map.get(cat.key).collections.push(c);
    });

    return sortCatalogGroups(
      mergeAndHideGroups(
        [...map.entries()].map(([key, val]) => ({
          key,
          name: val.name,
          videos: [...val.videos].sort(sortWithinCategory),
          collections: [...val.collections].sort((a, b) => {
            const da = getPublishOrCreateMs(a);
            const db = getPublishOrCreateMs(b);
            return db - da;
          }),
        })),
      ),
    );
  }, [filteredVideos, filteredCollections, filteredCollectionVideos]);

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
                {categories
                  .filter(
                    (c) =>
                      !CATALOG_HIDE.has(normName(c.name)) &&
                      !CATALOG_MERGE[normName(c.name)],
                  )
                  .map((c) => (
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
                    [...videos, ...collectionVideos]
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
                    [...videos, ...collectionVideos].flatMap(
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
