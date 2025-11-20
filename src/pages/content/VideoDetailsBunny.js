// src/pages/content/VideoDetails.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../../api";
import "./VideoDetails.css";

/* 🆕 Bunny Stream direct upload helper */
import { uploadAndSaveToVideoRecord } from "../../lib/bunnyStreamUpload";

/* -------------------- utils -------------------- */
function fmtDate(d) {
  if (!d) return "—";
  const x = new Date(d);
  return x.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
function currencyList() {
  return ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "PHP"];
}
function absUrl(u) {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const base = (api?.defaults?.baseURL || "").replace(/\/api\/?$/i, "");
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}

/* ---------------- Pricing editor (stable + post-render parent update) ---------------- */
const PricingEditor = React.memo(function PricingEditor({ value, onChange }) {
  // Normalize incoming value to strings for smooth typing
  const normalized = useMemo(
    () => ({
      upsell_text: value?.upsell_text || "",
      rental: value?.rental
        ? {
            currency: value.rental.currency || "USD",
            price:
              value.rental.price === 0 || value.rental.price
                ? String(value.rental.price)
                : "",
            duration_days:
              value.rental.duration_days === 0 || value.rental.duration_days
                ? String(value.rental.duration_days)
                : "",
          }
        : null,
      purchase: value?.purchase
        ? {
            currency: value.purchase.currency || "USD",
            price:
              value.purchase.price === 0 || value.purchase.price
                ? String(value.purchase.price)
                : "",
          }
        : null,
    }),
    [value]
  );

  const [local, setLocal] = useState(normalized);

  // Sync DOWN from parent to child (only when it really changed)
  useEffect(() => {
    if (JSON.stringify(local) !== JSON.stringify(normalized)) {
      setLocal(normalized);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized]);

  // Notify parent AFTER render when local changes (avoids setState-in-render warning)
  useEffect(() => {
    if (!onChange) return;
    if (JSON.stringify(local) !== JSON.stringify(value || {})) {
      onChange(local);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  const setL = (patch) => setLocal((prev) => ({ ...prev, ...patch }));

  const rental = local.rental ?? {
    currency: "USD",
    price: "",
    duration_days: "",
  };
  const purchase = local.purchase ?? { currency: "USD", price: "" };

  return (
    <>
      <div className="vd-label">Additional pricing options (rental)</div>
      <div className="vd-row">
        <select
          className="search"
          style={{ maxWidth: 110 }}
          value={rental.currency}
          onChange={(e) =>
            setL({ rental: { ...rental, currency: e.target.value } })
          }
        >
          {currencyList().map((c) => (
            <option key={`currency-${c}`}>{c}</option>
          ))}
        </select>
        <input
          className="search"
          type="text"
          inputMode="decimal"
          style={{ maxWidth: 120 }}
          value={rental.price}
          onChange={(e) =>
            setL({ rental: { ...rental, price: e.target.value } })
          }
          placeholder="0.00"
        />
        <input
          className="search"
          type="text"
          inputMode="numeric"
          style={{ maxWidth: 160 }}
          value={rental.duration_days}
          onChange={(e) =>
            setL({ rental: { ...rental, duration_days: e.target.value } })
          }
          placeholder="days"
        />
        <button className="btn ghost" onClick={() => setL({ rental: null })}>
          Remove
        </button>
      </div>

      <div className="vd-gap" />
      <div className="vd-label">One-time purchase price</div>
      <div className="vd-row">
        <select
          className="search"
          style={{ maxWidth: 110 }}
          value={purchase.currency}
          onChange={(e) =>
            setL({ purchase: { ...purchase, currency: e.target.value } })
          }
        >
          {currencyList().map((c) => (
            <option key={`purchase-currency-${c}`}>{c}</option>
          ))}
        </select>
        <input
          className="search"
          type="text"
          inputMode="decimal"
          style={{ maxWidth: 160 }}
          value={purchase.price}
          onChange={(e) =>
            setL({ purchase: { ...purchase, price: e.target.value } })
          }
          placeholder="0.00"
        />
        <button className="btn ghost" onClick={() => setL({ purchase: null })}>
          Remove
        </button>
      </div>

      <div className="vd-gap" />
      <div className="vd-label">Why should customers buy this?</div>
      <textarea
        className="search"
        rows={3}
        value={local.upsell_text || ""}
        onChange={(e) => setL({ upsell_text: e.target.value })}
      />
      <div className="vd-small right">
        Characters left: {Math.max(0, 140 - (local.upsell_text?.length || 0))}
      </div>

      {!local.rental && (
        <button
          className="btn ghost"
          style={{ marginTop: 8 }}
          onClick={() =>
            setL({ rental: { currency: "USD", price: "", duration_days: "" } })
          }
        >
          + Add rental option
        </button>
      )}
      {!local.purchase && (
        <button
          className="btn ghost"
          style={{ marginTop: 8, marginLeft: 8 }}
          onClick={() => setL({ purchase: { currency: "USD", price: "" } })}
        >
          + Add purchase option
        </button>
      )}
    </>
  );
});

/* ------------- Geo-blocking Modal ------------- */
function GeoModal({ open, onClose, value, onSave }) {
  const [allow, setAllow] = useState("");
  const [block, setBlock] = useState("");
  useEffect(() => {
    if (open) {
      setAllow((value?.geo_allow || []).join(", "));
      setBlock((value?.geo_block || []).join(", "));
    }
  }, [open, value]);
  if (!open) return null;

  const toArr = (s) =>
    String(s || "")
      .split(",")
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean);

  return (
    <div className="vd-overlay" onClick={onClose}>
      <div className="vd-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="vd-h">Geo-blocking</h3>
        <div className="vd-muted vd-small" style={{ marginTop: -6 }}>
          Use ISO 3166-1 alpha-2 country codes (e.g. <code>US, CA, GB</code>).
        </div>

        <div className="vd-gap" />
        <label className="vd-label">Allow only these countries</label>
        <input
          className="search"
          placeholder="e.g. US, CA"
          value={allow}
          onChange={(e) => setAllow(e.target.value)}
        />

        <div className="vd-gap" />
        <label className="vd-label">Block these countries</label>
        <input
          className="search"
          placeholder="e.g. RU, CN"
          value={block}
          onChange={(e) => setBlock(e.target.value)}
        />

        <div className="vd-row right" style={{ marginTop: 14 }}>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={() => {
              onSave?.({ geo_allow: toArr(allow), geo_block: toArr(block) });
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- helpers: categories scoping ---------------- */
function normalizeCategories(raw) {
  const list = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw)
    ? raw
    : [];
  return list
    .map((c) => ({
      id:
        c.id ??
        c.category_id ??
        c.value ??
        c.slug ??
        (c.name
          ? String(c.name).toLowerCase().replace(/\s+/g, "-")
          : undefined),
      name: c.name ?? c.title ?? c.slug ?? `Category ${c.id ?? ""}`,
      ownerId:
        c.created_by ??
        c.user_id ??
        c.owner_id ??
        c.account_id ??
        c.createdBy ??
        c.userId ??
        null,
    }))
    .filter((c) => c.id != null && c.name);
}
function scopeToMe(categories, me) {
  if (!me?.id) return categories;
  const anyOwner = categories.some((c) => c.ownerId != null);
  if (!anyOwner) return categories;
  return categories.filter((c) => String(c.ownerId) === String(me.id));
}

/* ---------------- Main Page ---------------- */
export default function VideoDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const isStudio = location.pathname.startsWith("/studio");
  const LIST_HREF = isStudio ? "/studio/videos" : "/admin/content/videos";

  const videoRef = useRef(null);
  const thumbHRef = useRef(null);
  const thumbVRef = useRef(null);
  const subFileRef = useRef(null);
  const trailerFileRef = useRef(null);
  const audioFileRef = useRef(null);

  const pricingCardRef = useRef(null);
  const [pricingPulse, setPricingPulse] = useState(false);

  const [moreOpen, setMoreOpen] = useState(false);
  const [geoOpen, setGeoOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cats, setCats] = useState([]);
  const [catModalOpen, setCatModalOpen] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    short_description: "",
    category_id: "",
    thumbnail_url: "",
    thumbnail_vertical_url: "",
    video_url: "",
    visibility: "private",
    is_premium: true,
    created_at: null,
  });

  const [videoReloadKey, setVideoReloadKey] = useState(0);

  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");

  const [resources, setResources] = useState([]);
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");

  const [subtitles, setSubtitles] = useState([]);
  const [subLang, setSubLang] = useState("en");

  const [audioTrack, setAudioTrack] = useState(null);
  const [trailer, setTrailer] = useState(null);

  // Pricing lives in parent; editor is stable child
  const [pricing, setPricing] = useState({
    rental: null,
    purchase: null,
    upsell_text: "",
  });

  const [authors, setAuthors] = useState([]);
  const [authorInput, setAuthorInput] = useState("");
  const [customFilters, setCustomFilters] = useState([]);
  const [filterInput, setFilterInput] = useState("");

  const [geo, setGeo] = useState({ geo_allow: [], geo_block: [] });

  const [hoverH, setHoverH] = useState(false);
  const [hoverV, setHoverV] = useState(false);
  const [replaceState, setReplaceState] = useState({
    working: false,
    progress: 0,
    error: "",
  });

  // 🆕 teaser preview seconds (for gated videos)
  const [teaserSeconds, setTeaserSeconds] = useState(300);

  /* ---------------- Load ---------------- */
  async function load() {
    try {
      setLoading(true);
      const [meRes, vRes, cRes] = await Promise.all([
        api.get("/auth/me"),
        api.get(`/videos/${id}`),
        api.get("/categories?mine=1"),
      ]);

      const me = meRes.data || null;
      const vd = vRes.data || {};
      const md = vd.metadata || {};

      setForm((prev) => ({
        ...prev,
        title: vd.title || "",
        description: vd.description || "",
        short_description: vd.short_description || "",
        category_id: vd.category_id || "",
        thumbnail_url: vd.thumbnail_url || "",
        thumbnail_vertical_url: md.thumbnail_vertical_url || "",
        video_url: vd.video_url || "",
        visibility: vd.visibility || "private",
        is_premium: vd.is_premium ?? true,
        created_at: vd.created_at || vd.created || null,
      }));

      setTeaserSeconds(Number(md.teaser_seconds ?? 300) || 300);

      const mineOnly = scopeToMe(normalizeCategories(cRes.data), me);
      const uniqueCats = Array.from(
        new Map(mineOnly.map((c) => [String(c.id), c])).values()
      );
      setCats(uniqueCats);

      setSeoTitle(md.seo_title || "");
      setSeoDescription(md.seo_description || "");
      setTags(md.tags || []);
      setResources(md.resources || []);
      setSubtitles(md.subtitles || []);
      setAudioTrack(md.audio_track || null);
      setTrailer(md.trailer || null);

      setPricing({
        rental: md.pricing?.rental
          ? {
              currency: md.pricing.rental.currency || "USD",
              price:
                md.pricing.rental.price === 0 || md.pricing.rental.price
                  ? String(md.pricing.rental.price)
                  : "",
              duration_days:
                md.pricing.rental.duration_days === 0 ||
                md.pricing.rental.duration_days
                  ? String(md.pricing.rental.duration_days)
                  : "",
            }
          : null,
        purchase: md.pricing?.purchase
          ? {
              currency: md.pricing.purchase.currency || "USD",
              price:
                md.pricing.purchase.price === 0 || md.pricing.purchase.price
                  ? String(md.pricing.purchase.price)
                  : "",
            }
          : null,
        upsell_text: md.pricing?.upsell_text || "",
      });

      setAuthors(md.authors || []);
      setCustomFilters(md.custom_filters || []);
      setGeo({
        geo_allow: Array.isArray(md.geo_allow) ? md.geo_allow : [],
        geo_block: Array.isArray(md.geo_block) ? md.geo_block : [],
      });

      setVideoReloadKey((k) => k + 1);
    } catch (e) {
      console.error("load video error:", e);
      alert("Video not found");
      navigate(LIST_HREF, { replace: true });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, location.pathname]);

  // Robust video/iframe preview init
  useEffect(() => {
    const url = absUrl(form.video_url || "");
    const el = videoRef.current;
    if (!url) return;

    // If this is a Bunny embed URL, we render via <iframe> in the JSX below.
    // So skip <video> wiring entirely in that case.
    const isBunnyEmbed = /\/\/iframe\.mediadelivery\.net\/embed\//i.test(url);
    if (isBunnyEmbed) return;

    // Otherwise, treat it as a direct video/HLS URL and wire up the <video> element.
    if (!el) return;
    let hls = null;
    const setSrcAndLoad = (u) => {
      el.src = u;
      try {
        el.load();
      } catch {}
    };

    const ext = url.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
    const isHLS = url.includes(".m3u8") || ext === "m3u8";

    if (!isHLS) {
      setSrcAndLoad(url);
      return () => {
        if (hls) {
          try {
            hls.destroy();
          } catch {}
          hls = null;
        }
      };
    }

    if (el.canPlayType("application/vnd.apple.mpegURL")) {
      setSrcAndLoad(url);
      return () => {
        if (hls) {
          try {
            hls.destroy();
          } catch {}
          hls = null;
        }
      };
    }

    let cancelled = false;
    import("hls.js")
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: true });
          hls.loadSource(url);
          hls.attachMedia(el);
        } else {
          setSrcAndLoad(url);
        }
      })
      .catch(() => setSrcAndLoad(url));

    return () => {
      cancelled = true;
      if (hls) {
        try {
          hls.destroy();
        } catch {}
        hls = null;
      }
    };
  }, [form.video_url, videoReloadKey]);

  function setF(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  /* ---------------- Save ---------------- */
  async function saveAll() {
    try {
      setSaving(true);

      const pricingPayload = {
        upsell_text: pricing.upsell_text || "",
        rental: pricing.rental
          ? {
              currency: pricing.rental.currency || "USD",
              price: Number.parseFloat(pricing.rental.price ?? "") || 0,
              duration_days:
                Number.parseInt(pricing.rental.duration_days ?? "", 10) || 1,
            }
          : null,
        purchase: pricing.purchase
          ? {
              currency: pricing.purchase.currency || "USD",
              price: Number.parseFloat(pricing.purchase.price ?? "") || 0,
            }
          : null,
      };

      await api.put(`/videos/${id}`, {
        title: form.title,
        description: form.description || null,
        short_description: form.short_description || null,
        category_id: form.category_id || null,
        thumbnail_url: form.thumbnail_url || null,
        video_url: form.video_url || null,
        visibility: form.visibility || "private",
        is_premium: !!form.is_premium,

        // metadata (flattened fields your API already accepts)
        seo_title: seoTitle,
        seo_description: seoDescription,
        thumbnail_vertical_url: form.thumbnail_vertical_url || null,
        tags,
        resources,
        subtitles,
        audio_track: audioTrack,
        trailer,
        pricing: pricingPayload,
        authors,
        custom_filters: customFilters,
        geo_allow: geo.geo_allow,
        geo_block: geo.geo_block,

        // 🆕 teaser seconds stored alongside other metadata keys
        teaser_seconds: Number(teaserSeconds) || 0,
      });

      setVideoReloadKey((k) => k + 1);
      await load();
    } catch (e) {
      console.error("save error:", e);
      alert(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  /* ---------------- Upload helpers ---------------- */
  async function uploadToStorage(file) {
    const fd = new FormData();
    fd.append("file", file);
    const up = await api.post("/uploads/video", fd);
    return up?.data?.url;
  }

  // 🆕 Replace video via Bunny Stream (direct browser upload with resumable TUS)
  async function replaceVideo(file) {
    if (!file) return;
    try {
      setReplaceState({ working: true, progress: 0, error: "" });

      const title = form?.title || "Untitled";
      const { embedUrl } = await uploadAndSaveToVideoRecord({
        videoIdLocal: id,
        file,
        title,
        onProgress: (pct) =>
          setReplaceState((s) => ({ ...s, progress: Number(pct) || 0 })),
      });

      setF("video_url", embedUrl);
      setVideoReloadKey((k) => k + 1);
      setReplaceState({ working: false, progress: 100, error: "" });
    } catch (e) {
      setReplaceState({
        working: false,
        progress: 0,
        error: e?.response?.data?.message || e?.message || "Replace failed",
      });
    }
  }

  async function uploadThumb(file, kind) {
    if (!file) return;
    try {
      const url = await uploadToStorage(file);
      if (!url) throw new Error("Upload succeeded but URL missing");
      if (kind === "h") {
        await api.put(`/videos/${id}`, { thumbnail_url: url });
        setF("thumbnail_url", url);
      } else {
        await api.put(`/videos/${id}`, { thumbnail_vertical_url: url });
        setF("thumbnail_vertical_url", url);
      }
    } catch (e) {
      alert(e?.response?.data?.message || "Thumbnail upload failed");
    }
  }

  /* ---------------- Actions menu ---------------- */
  function gotoEcommerce() {
    try {
      pricingCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setPricingPulse(true);
      window.setTimeout(() => setPricingPulse(false), 1200);
    } catch {}
  }

  async function doDelete() {
    if (!window.confirm("Delete this video? This cannot be undone.")) return;
    try {
      setDeleting(true);
      await api.delete(`/videos/${id}`);
      navigate(LIST_HREF);
    } catch (e) {
      console.error("delete error:", e);
      alert(e?.response?.data?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div>Loading video…</div>
      </div>
    );
  }

  const videoUrlAbs = absUrl(form.video_url || "");
  const isBunnyEmbed = /\/\/iframe\.mediadelivery\.net\/embed\//i.test(
    videoUrlAbs
  );

  return (
    <>
      {/* Geo modal */}
      <GeoModal
        open={geoOpen}
        onClose={() => setGeoOpen(false)}
        value={geo}
        onSave={(v) => setGeo(v)}
      />

      {/* New Category modal */}
      <NewCategoryModal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        onCreate={(cat) => {
          const created = {
            id: cat.id,
            name: cat.name || cat.title || "",
            ownerId:
              cat.created_by ??
              cat.user_id ??
              cat.owner_id ??
              cat.account_id ??
              null,
          };
          setCats((prev) => {
            const map = new Map(prev.map((c) => [String(c.id), c]));
            map.set(String(created.id), created);
            return Array.from(map.values());
          });
          setF("category_id", created.id);
        }}
      />

      <div className="vd-grid">
        {/* LEFT */}
        <div className="vd-col">
          <div className="vd-header">
            <div className="vd-breadcrumbs">
              <Link to={LIST_HREF} className="vd-link">
                All videos
              </Link>
              <span>›</span>
              <span className="vd-crumb">{form.title || "Untitled"}</span>
            </div>
            <div className="vd-actions" style={{ position: "relative" }}>
              <button
                className="btn ghost"
                onClick={() => setMoreOpen((s) => !s)}
              >
                More actions ▾
              </button>
              {moreOpen && (
                <div
                  className="menu"
                  onMouseLeave={() => setMoreOpen(false)}
                  style={{ minWidth: 220, right: 0 }}
                >
                  <button
                    className="menu-item"
                    onClick={() => {
                      setMoreOpen(false);
                      gotoEcommerce();
                    }}
                  >
                    eCommerce
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setMoreOpen(false);
                      setGeoOpen(true);
                    }}
                  >
                    Geo-blocking
                  </button>
                  <div className="menu-sep" />
                  <button
                    className="menu-item danger"
                    onClick={() => {
                      setMoreOpen(false);
                      doDelete();
                    }}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting…" : "Delete video"}
                  </button>
                </div>
              )}
              <button className="btn" onClick={saveAll} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>

          {/* About */}
          <section className="card">
            <h3 className="vd-h">About</h3>
            <label className="vd-label">Title</label>
            <input
              className="search"
              value={form.title}
              onChange={(e) => setF("title", e.target.value)}
            />

            <div className="vd-gap" />
            <label className="vd-label">Description</label>
            <textarea
              className="search"
              rows={5}
              value={form.description}
              onChange={(e) => setF("description", e.target.value)}
              placeholder="Explain to the viewer what to expect from your video…"
            />

            <div className="vd-gap" />
            <label className="vd-label">Short description</label>
            <textarea
              className="search"
              rows={3}
              maxLength={140}
              value={form.short_description}
              onChange={(e) => setF("short_description", e.target.value)}
              placeholder="Appears in playlists or tight spaces."
            />
            <div className="vd-small right">
              {140 - (form.short_description?.length || 0)} characters left
            </div>
          </section>

          {/* Organize */}
          <section className="card">
            <h3 className="vd-h">Organize</h3>
            <label className="vd-label">Categories</label>
            <div className="vd-row">
              <select
                className="search"
                style={{ minWidth: 220 }}
                value={form.category_id || ""}
                onChange={(e) => setF("category_id", e.target.value)}
              >
                <option value="">— No category —</option>
                {cats.map((c, i) => (
                  <option key={`cat-${c.id}-${i}`} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                className="btn ghost"
                onClick={() => setCatModalOpen(true)}
              >
                + Add new category
              </button>
              {!isStudio && (
                <Link to="/admin/content/categories" className="btn ghost">
                  Manage categories
                </Link>
              )}
            </div>

            {/* Authors */}
            <div className="vd-gap" />
            <b>Authors</b>
            <div className="vd-row">
              <input
                className="search"
                placeholder="Add author and press Enter"
                value={authorInput}
                onChange={(e) => setAuthorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && authorInput.trim()) {
                    setAuthors((a) => [...a, authorInput.trim()]);
                    setAuthorInput("");
                  }
                }}
              />
            </div>
            <div className="vd-token-wrap">
              {authors.map((a, i) => (
                <span
                  key={`author-${i}-${a}`}
                  className="badge badge-green"
                  onClick={() => setAuthors(authors.filter((x) => x !== a))}
                >
                  {a} ✕
                </span>
              ))}
            </div>

            {/* Custom Filters */}
            <div className="vd-gap" />
            <b>Custom filters</b>
            <div className="vd-row">
              <input
                className="search"
                placeholder="Add filter and press Enter"
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filterInput.trim()) {
                    setCustomFilters((f) => [...f, filterInput.trim()]);
                    setFilterInput("");
                  }
                }}
              />
            </div>
            <div className="vd-token-wrap">
              {customFilters.map((f, i) => (
                <span
                  key={`filter-${i}-${f}`}
                  className="badge badge-green"
                  onClick={() =>
                    setCustomFilters(customFilters.filter((x) => x !== f))
                  }
                >
                  {f} ✕
                </span>
              ))}
            </div>
          </section>

          {/* Thumbnails */}
          <section className="card">
            <h3 className="vd-h">Thumbnails</h3>
            <div className="vd-thumbs">
              {/* Horizontal */}
              <div className="vd-thumb-block">
                <div className="vd-thumb-title">
                  Horizontal thumbnail (1480×840px)
                </div>
                <div
                  className="vd-thumb"
                  onMouseEnter={() => setHoverH(true)}
                  onMouseLeave={() => setHoverH(false)}
                  onClick={() => thumbHRef.current?.click()}
                  title="Change image"
                >
                  {form.thumbnail_url ? (
                    <img src={absUrl(form.thumbnail_url)} alt="" />
                  ) : (
                    <div className="vd-thumb-fallback">CHANGE IMAGE</div>
                  )}
                  {hoverH && (
                    <div className="vd-thumb-overlay">Change image</div>
                  )}
                </div>
                <div className="vd-muted">
                  Appears as a thumbnail on your catalog page
                </div>

                <input
                  type="file"
                  accept="image/*"
                  ref={thumbHRef}
                  style={{ display: "none" }}
                  onChange={(e) => uploadThumb(e.target.files?.[0], "h")}
                />

                <div className="vd-gap" />
                <label className="vd-label">Horizontal Thumbnail URL</label>
                <input
                  className="search"
                  placeholder="https://…"
                  value={form.thumbnail_url || ""}
                  onChange={(e) => setF("thumbnail_url", e.target.value)}
                  onBlur={saveAll}
                />
              </div>

              {/* Vertical */}
              <div className="vd-thumb-block">
                <div className="vd-thumb-title">
                  Vertical thumbnail (1188×1682px)
                </div>
                <div
                  className="vd-thumb vd-thumb-vert"
                  onMouseEnter={() => setHoverV(true)}
                  onMouseLeave={() => setHoverV(false)}
                  onClick={() => thumbVRef.current?.click()}
                  title="Change image"
                >
                  {form.thumbnail_vertical_url ? (
                    <img src={absUrl(form.thumbnail_vertical_url)} alt="" />
                  ) : (
                    <div className="vd-thumb-fallback">CHANGE IMAGE</div>
                  )}
                  {hoverV && (
                    <div className="vd-thumb-overlay">Change image</div>
                  )}
                </div>
                <div className="vd-muted">
                  Appears when assigned to vertical thumbnails
                </div>

                <input
                  type="file"
                  accept="image/*"
                  ref={thumbVRef}
                  style={{ display: "none" }}
                  onChange={(e) => uploadThumb(e.target.files?.[0], "v")}
                />

                <div className="vd-gap" />
                <label className="vd-label">Vertical Thumbnail URL</label>
                <input
                  className="search"
                  placeholder="https://…"
                  value={form.thumbnail_vertical_url || ""}
                  onChange={(e) =>
                    setF("thumbnail_vertical_url", e.target.value)
                  }
                  onBlur={saveAll}
                />
              </div>
            </div>
          </section>

          {/* SEO */}
          <section className="card">
            <h3 className="vd-h">SEO</h3>
            <label className="vd-label">Website page title</label>
            <input
              className="search"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="SEO title"
            />

            <div className="vd-gap" />
            <label className="vd-label">Website URL</label>
            <div className="vd-row">
              <input
                className="search"
                value="/programs/"
                readOnly
                style={{ maxWidth: 160 }}
              />
              <input
                className="search"
                value={`${slugify(form.title)}-${id}`}
                readOnly
              />
            </div>

            <div className="vd-gap" />
            <label className="vd-label">Meta description</label>
            <textarea
              className="search"
              rows={3}
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              placeholder="Not visible on website or apps"
            />
            <div className="vd-small right">
              Characters left:{" "}
              {Math.max(0, 170 - (seoDescription?.length || 0))}
            </div>
          </section>

          {/* Search tags */}
          <section className="card">
            <h3 className="vd-h">Search tags</h3>
            <div className="vd-row">
              <input
                className="search"
                placeholder="Type a tag and press Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    setTags((t) => [...t, tagInput.trim()]);
                    setTagInput("");
                  }
                }}
              />
            </div>
            <div className="vd-token-wrap">
              {tags.map((t, i) => (
                <span
                  key={`tag-${i}-${t}`}
                  className="badge badge-green"
                  title="Click to remove"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                >
                  {t} ✕
                </span>
              ))}
            </div>
          </section>

          {/* Resources */}
          <section className="card">
            <h3 className="vd-h">Resources</h3>
            <div className="vd-row">
              <input
                className="search"
                placeholder="Title"
                style={{ minWidth: 240 }}
                value={resTitle}
                onChange={(e) => setResTitle(e.target.value)}
              />
              <input
                className="search"
                placeholder="https://url"
                style={{ minWidth: 280 }}
                value={resUrl}
                onChange={(e) => setResUrl(e.target.value)}
              />
              <button
                className="btn"
                onClick={() => {
                  if (!resTitle.trim() || !resUrl.trim()) return;
                  setResources((r) => [
                    ...r,
                    { title: resTitle.trim(), url: resUrl.trim() },
                  ]);
                  setResTitle("");
                  setResUrl("");
                }}
              >
                Add
              </button>
            </div>
            <ul className="vd-list">
              {resources.map((r, i) => (
                <li
                  key={`res-${i}-${r.title}-${r.url}`}
                  className="vd-list-row"
                >
                  <a href={absUrl(r.url)} target="_blank" rel="noreferrer">
                    {r.title}
                  </a>
                  <span className="vd-muted vd-small">{absUrl(r.url)}</span>
                  <button
                    className="btn ghost"
                    onClick={() =>
                      setResources(resources.filter((_, idx) => idx !== i))
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* RIGHT */}
        <aside className="vd-col">
          {/* Video preview / Replace */}
          <section className="card">
            <h3 className="vd-h">Video</h3>

            <div className="vd-video">
              {!form.video_url ? (
                <div className="vd-video-fallback">No video</div>
              ) : isBunnyEmbed ? (
                // 🆕 If the URL is a Bunny embed, render an iframe
                <iframe
                  key={videoReloadKey}
                  src={videoUrlAbs}
                  allow="autoplay; fullscreen; picture-in-picture"
                  loading="lazy"
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    border: 0,
                    display: "block",
                  }}
                  title={form.title || "Video"}
                />
              ) : (
                // Otherwise, use native <video> with optional HLS wiring
                <video
                  key={videoReloadKey}
                  ref={videoRef}
                  controls
                  preload="metadata"
                  playsInline
                  crossOrigin="anonymous"
                  style={{ width: "100%", display: "block" }}
                />
              )}
            </div>

            <div className="vd-row" style={{ marginTop: 8 }}>
              {form.video_url ? (
                <a
                  className="btn ghost"
                  href={videoUrlAbs}
                  download
                  target="_blank"
                  rel="noreferrer"
                >
                  ⬇ Download
                </a>
              ) : (
                <button className="btn ghost" disabled>
                  ⬇ Download
                </button>
              )}

              <label className="btn ghost">
                ⤴ Replace
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => replaceVideo(e.target.files?.[0])}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            {replaceState.working && (
              <div className="vd-progress">
                <div
                  className="vd-progress-bar"
                  style={{ width: `${replaceState.progress}%` }}
                />
              </div>
            )}
            {replaceState.error && (
              <div className="vd-error">{replaceState.error}</div>
            )}
          </section>

          {/* 🆕 Preview / Teaser settings */}
          <section className="card">
            <h3 className="vd-h">Preview / Teaser</h3>
            <div className="vd-muted" style={{ marginBottom: 6 }}>
              For <b>gated</b> videos, viewers can watch this long before login
              is required on the watch page.
            </div>
            <label className="vd-label">Teaser length (seconds)</label>
            <input
              className="search"
              type="number"
              min={0}
              value={teaserSeconds}
              onChange={(e) =>
                setTeaserSeconds(Math.max(0, Number(e.target.value || 0)))
              }
              onBlur={saveAll}
              style={{ maxWidth: 160 }}
            />
          </section>

          {/* Visibility */}
          <section className="card">
            <h3 className="vd-h">Visibility</h3>
            <label className="radio">
              <input
                type="radio"
                name="vis"
                checked={form.visibility === "private"}
                onChange={() => setF("visibility", "private")}
              />
              Unpublished
            </label>
            <label className="radio">
              <input
                type="radio"
                name="vis"
                checked={form.visibility === "public"}
                onChange={() => setF("visibility", "public")}
              />
              Published
            </label>
            <label className="radio">
              <input
                type="radio"
                name="vis"
                checked={form.visibility === "unlisted"}
                onChange={() => setF("visibility", "unlisted")}
              />
              Scheduled (UI)
            </label>

            <div className="vd-small vd-muted" style={{ marginTop: 8 }}>
              Uploaded on {fmtDate(form.created_at)}
            </div>
            <button className="btn ghost" style={{ marginTop: 8 }}>
              + Add expiration date
            </button>
          </section>

          {/* Access */}
          <section className="card">
            <h3 className="vd-h">Access</h3>
            <label className="radio">
              <input
                type="radio"
                name="acc"
                checked={!!form.is_premium}
                onChange={() => setF("is_premium", true)}
              />
              Gated
            </label>
            <div className="vd-muted">
              Only users with access will be able to watch this content
            </div>

            <label className="radio" style={{ marginTop: 8 }}>
              <input
                type="radio"
                name="acc"
                checked={!form.is_premium}
                onChange={() => setF("is_premium", false)}
              />
              Free for all users
            </label>
            <div className="vd-muted">
              All users will be able to watch this content, including logged-out
              users
            </div>

            <button className="btn ghost" style={{ marginTop: 8 }}>
              ▸ Advanced settings
            </button>
          </section>

          {/* Subscription / Pricing */}
          <section
            className={`card ${pricingPulse ? "pulse" : ""}`}
            ref={pricingCardRef}
          >
            <h3 className="vd-h">Subscription</h3>
            <div className="vd-muted" style={{ marginBottom: 6 }}>
              Manage rental/purchase pricing options.
            </div>
            <PricingEditor value={pricing} onChange={setPricing} />
          </section>

          {/* Subtitles & captions */}
          <section className="card">
            <h3 className="vd-h">Subtitles and captions</h3>
            <div className="vd-row">
              <select
                className="search"
                value={subLang}
                onChange={(e) => setSubLang(e.target.value)}
                style={{ maxWidth: 140 }}
              >
                <option value="en">English (en)</option>
                <option value="es">Spanish (es)</option>
                <option value="fr">French (fr)</option>
                <option value="de">German (de)</option>
                <option value="jp">Japanese (jp)</option>
              </select>
              <label className="btn ghost">
                + Upload .vtt
                <input
                  ref={subFileRef}
                  type="file"
                  accept=".vtt,text/vtt"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const url = await uploadToStorage(f);
                      setSubtitles((s) => [
                        ...s,
                        { lang: subLang || "en", url },
                      ]);
                    } catch {
                      alert("Subtitle upload failed");
                    }
                  }}
                />
              </label>
            </div>
            <ul className="vd-list">
              {subtitles.map((s, i) => (
                <li key={`sub-${i}-${s.lang}-${s.url}`} className="vd-list-row">
                  <span style={{ width: 60 }}>{s.lang}</span>
                  <a
                    href={absUrl(s.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="vd-link"
                  >
                    {absUrl(s.url)}
                  </a>
                  <button
                    className="btn ghost"
                    onClick={() =>
                      setSubtitles(subtitles.filter((_, idx) => idx !== i))
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Audio track */}
          <section className="card">
            <h3 className="vd-h">Audio track</h3>
            {!audioTrack ? (
              <label className="btn ghost">
                + Upload audio
                <input
                  ref={audioFileRef}
                  type="file"
                  accept="audio/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const url = await uploadToStorage(f);
                      setAudioTrack({ url });
                    } catch {
                      alert("Audio upload failed");
                    }
                  }}
                />
              </label>
            ) : (
              <div className="vd-row">
                <a
                  href={absUrl(audioTrack.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="vd-link"
                >
                  {absUrl(audioTrack.url)}
                </a>
                <button
                  className="btn ghost"
                  onClick={() => setAudioTrack(null)}
                >
                  Remove
                </button>
              </div>
            )}
          </section>

          {/* Trailer */}
          <section className="card">
            <h3 className="vd-h">Trailer</h3>
            {!trailer ? (
              <label className="btn ghost">
                + Upload trailer
                <input
                  ref={trailerFileRef}
                  type="file"
                  accept="video/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const url = await uploadToStorage(f);
                      setTrailer({ url });
                    } catch {
                      alert("Trailer upload failed");
                    }
                  }}
                />
              </label>
            ) : (
              <div className="vd-row">
                <a
                  href={absUrl(trailer.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="vd-link"
                >
                  {absUrl(trailer.url)}
                </a>
                <button className="btn ghost" onClick={() => setTrailer(null)}>
                  Remove
                </button>
              </div>
            )}
          </section>

          {/* Music playlist (static) */}
          <section className="card">
            <h3 className="vd-h">Music playlist: Apps</h3>
            <div className="vd-muted">
              Integrate popular music providers in your apps. Upgrade your plan
              to get access.
            </div>
            <button className="btn" style={{ marginTop: 8 }}>
              Request Access
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}

/* ---------------- Modal: New Category ---------------- */
function NewCategoryModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setName("");
  }, [open]);
  if (!open) return null;

  const submit = async () => {
    if (!name.trim()) return;
    try {
      setSaving(true);
      const { data } = await api.post("/categories", { name: name.trim() });
      onCreate?.(data);
      onClose();
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to create category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vd-overlay" onClick={onClose}>
      <div className="vd-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="vd-h">New Category</h3>
        <div className="vd-label">Category Title</div>
        <input
          className="search"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="vd-muted" style={{ marginTop: 6 }}>
          This is the category title that will appear in the catalog and will be
          visible to your customers.
        </div>
        <div className="vd-row right" style={{ marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={submit}
            disabled={saving || !name.trim()}
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
