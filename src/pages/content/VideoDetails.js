// src/pages/content/VideoDetails.js
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../../api";
import "./VideoDetails.css";
import PlaylistPicker from "../../components/modals/PlaylistPicker";

/* -------------------- utils -------------------- */
function absUrl(u) {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const base = (api?.defaults?.baseURL || "").replace(/\/api\/?$/i, "");
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function withTimeout(promise, ms = 15000) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error("Request timed out")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

/**
 * Publish date input helpers (TEXT INPUT)
 * - UI expects: "MM/DD/YYYY" (no native date picker to avoid reset while typing)
 * - we store ISO in state at local midnight
 */
function pad2(n) {
  return String(n).padStart(2, "0");
}
// Display ISO -> "MM/DD/YYYY"
function toUsDateInput(isoOrDate) {
  if (!isoOrDate) return "";
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return "";
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const yyyy = String(d.getFullYear());
  return `${mm}/${dd}/${yyyy}`;
}
// Parse "MM/DD/YYYY" -> ISO at local midnight
function fromUsDateInput(v) {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;

  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const yyyy = Number(m[3]);

  if (!Number.isFinite(mm) || !Number.isFinite(dd) || !Number.isFinite(yyyy))
    return null;
  if (yyyy < 1000 || yyyy > 9999) return null;
  if (mm < 1 || mm > 12) return null;

  const daysInMonth = new Date(yyyy, mm, 0).getDate(); // month is 1-based here
  if (dd < 1 || dd > daysInMonth) return null;

  // local midnight
  const d = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;

  return d.toISOString();
}
function isValidUsDateInput(v) {
  return !!fromUsDateInput(v);
}

/* -----------------------------------------
   Modern Loading Spinner (same as Community.js)
----------------------------------------- */
function CircularSpinner({ size = 40, label = "Loading…" }) {
  const ring = Math.max(4, Math.round(size / 10));

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        gap: 10,
        padding: "14px 0",
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
            style={{ animation: "brtv-dash 1.4s ease-in-out infinite" }}
          />
        </svg>
      </div>

      {!!label && (
        <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 13 }}>
          {label}
        </div>
      )}
    </div>
  );
}

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
          Use ISO country codes (US, CA, GB, etc.)
        </div>

        <div className="vd-gap" />

        <label className="vd-label">Allow</label>
        <input
          className="search"
          value={allow}
          onChange={(e) => setAllow(e.target.value)}
        />

        <div className="vd-gap" />

        <label className="vd-label">Block</label>
        <input
          className="search"
          value={block}
          onChange={(e) => setBlock(e.target.value)}
        />

        <div className="vd-row right" style={{ marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={() => {
              onSave({
                geo_allow: toArr(allow),
                geo_block: toArr(block),
              });
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

/* ---------------- helpers ---------------- */
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

/* ---------------- Main ---------------- */
export default function VideoDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const isStudio = location.pathname.startsWith("/studio");
  const LIST_HREF = isStudio ? "/studio/videos" : "/admin/content/videos";

  const videoRef = useRef(null);
  const thumbHRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pubBusy, setPubBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ✅ single primary action busy (Save & Publish / Save changes)
  const [primaryBusy, setPrimaryBusy] = useState(false);

  const [cats, setCats] = useState([]);
  const [catModalOpen, setCatModalOpen] = useState(false);

  const [geoOpen, setGeoOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [videoReloadKey, setVideoReloadKey] = useState(0);
  const [assignedPlaylists, setAssignedPlaylists] = useState([]);

  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");

  const [authors, setAuthors] = useState([]);
  const [authorInput, setAuthorInput] = useState("");

  const [resources, setResources] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [audioTrack, setAudioTrack] = useState(null);
  const [trailer, setTrailer] = useState(null);
  const [customFilters, setCustomFilters] = useState([]);

  const [geo, setGeo] = useState({ geo_allow: [], geo_block: [] });

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
    free_preview_seconds: 0,
    duration_seconds: null,
    is_published: false,
    published_at: null,
  });

  // ✅ raw string state for the publish date input (MM/DD/YYYY)
  const [publishDateStr, setPublishDateStr] = useState("");

  const [loadErr, setLoadErr] = useState("");
  const previewMemoryRef = useRef(0);

  // ✅ Keep the input string in sync when data loads / changes
  useEffect(() => {
    setPublishDateStr(toUsDateInput(form.published_at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.published_at]);

  /* ---------------- Load ---------------- */
  async function loadAssigned(aliveRef) {
    try {
      const [idsRes, listRes] = await Promise.all([
        withTimeout(api.get(`playlists/videos/${id}`), 15000),
        withTimeout(api.get("playlists"), 15000),
      ]);

      const ids = new Set((idsRes.data?.playlist_ids || []).map(String));
      const items = (listRes.data?.items || []).filter((p) =>
        ids.has(String(p.id)),
      );

      if (aliveRef.current) setAssignedPlaylists(items);
    } catch (e) {
      if (aliveRef.current) setAssignedPlaylists([]);
    }
  }

  async function loadAll(aliveRef) {
    try {
      setLoadErr("");
      setLoading(true);

      const [meRes, vRes, cRes] = await Promise.all([
        withTimeout(api.get("auth/me"), 15000),
        withTimeout(api.get(`videos/${id}`), 15000),
        withTimeout(api.get("categories?mine=1"), 15000),
      ]);

      if (!aliveRef.current) return;

      const me = meRes.data;
      const vd = vRes.data;
      const md = vd.metadata || {};

      setForm((f) => ({
        ...f,
        title: vd.title || "",
        description: vd.description || "",
        short_description: vd.short_description || "",
        category_id: vd.category_id || "",
        thumbnail_url: vd.thumbnail_url || "",
        thumbnail_vertical_url: md.thumbnail_vertical_url || "",
        video_url: vd.video_url || "",
        visibility: vd.visibility || "private",
        is_premium: vd.is_premium ?? true,
        created_at: vd.created_at || null,
        duration_seconds: vd.duration_seconds || null,
        free_preview_seconds:
          vd.free_preview_seconds ??
          md.free_preview_seconds ??
          md.preview_seconds ??
          0,
        is_published: !!vd.is_published,
        published_at: vd.published_at || null,
      }));

      previewMemoryRef.current =
        vd.free_preview_seconds ??
        md.free_preview_seconds ??
        md.preview_seconds ??
        0;

      const mineCats = scopeToMe(normalizeCategories(cRes.data), me);
      setCats(mineCats);

      setSeoTitle(md.seo_title || "");
      setSeoDescription(md.seo_description || "");

      setTags(md.tags || []);

      setResources(md.resources || []);
      setSubtitles(md.subtitles || []);
      setAudioTrack(md.audio_track || null);
      setTrailer(md.trailer || null);
      setCustomFilters(md.custom_filters || []);

      setAuthors(md.authors || []);

      setGeo({
        geo_allow: md.geo_allow || [],
        geo_block: md.geo_block || [],
      });

      loadAssigned(aliveRef);
      setVideoReloadKey((k) => k + 1);
    } catch (e) {
      console.error(e);
      if (!aliveRef.current) return;

      const msg =
        e?.response?.status === 401
          ? "Session expired. Please login again."
          : e?.response?.status === 404
            ? "Video not found."
            : e?.message === "Request timed out"
              ? "Request timed out. Please try again."
              : "Failed to load video. Please try again.";

      setLoadErr(msg);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    const aliveRef = { current: true };
    loadAll(aliveRef);
    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ---------------- Payload builder (used by Save + Save&Publish) ---------------- */
  function buildSavePayload() {
    const effectivePreview =
      form.is_premium === true
        ? clamp(Number(form.free_preview_seconds), 0, 7200)
        : 0;

    return {
      // base columns
      title: form.title,
      description: form.description,
      short_description: form.short_description,
      category_id: form.category_id || null,
      thumbnail_url: form.thumbnail_url || null,
      video_url: form.video_url || null,
      visibility: form.visibility,
      is_premium: !!form.is_premium,
      free_preview_seconds: effectivePreview,
      preview_seconds: effectivePreview,

      // ✅ publish date editor
      published_at: form.published_at || null,

      // metadata
      seo_title: seoTitle,
      seo_description: seoDescription,
      tags,
      authors,
      resources,
      subtitles,
      audio_track: audioTrack,
      trailer,
      custom_filters: customFilters,

      geo_allow: geo.geo_allow,
      geo_block: geo.geo_block,

      thumbnail_vertical_url: form.thumbnail_vertical_url || "",
    };
  }

  /* ---------------- Save ---------------- */
  async function saveAll() {
    try {
      setSaving(true);

      await withTimeout(api.put(`videos/${id}`, buildSavePayload()), 20000);

      const aliveRef = { current: true };
      await loadAll(aliveRef);
    } catch (e) {
      alert("Failed to save");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  // ✅ internal save that can skip reload (keeps your existing saveAll intact)
  async function saveAllInternal({ reload = true } = {}) {
    await withTimeout(api.put(`videos/${id}`, buildSavePayload()), 20000);
    if (reload) {
      const aliveRef = { current: true };
      await loadAll(aliveRef);
    }
  }

  /* ---------------- Publish ---------------- */
  async function publishVideo(state) {
    try {
      setPubBusy(true);

      if (state) await withTimeout(api.post(`videos/${id}/publish`), 20000);
      else await withTimeout(api.post(`videos/${id}/unpublish`), 20000);

      const aliveRef = { current: true };
      await loadAll(aliveRef);
    } catch (e) {
      alert("Failed");
    } finally {
      setPubBusy(false);
    }
  }

  /* ---------------- PRIMARY ACTION: Save & Publish / Save changes ---------------- */
  async function primaryAction() {
    // published -> just save changes
    if (form.is_published) {
      await saveAll();
      return;
    }

    // unpublished -> Save & Publish (single button flow)
    try {
      setPrimaryBusy(true);

      // Make sure publish date typed is committed into form before saving
      if (publishDateStr && isValidUsDateInput(publishDateStr)) {
        const iso = fromUsDateInput(publishDateStr);
        if (iso && iso !== form.published_at) {
          setForm((f) => ({ ...f, published_at: iso }));
        }
      } else if (publishDateStr === "") {
        // allow clearing date
        // (form already set in onChange/onBlur, but keep safe)
      }

      // ✅ Save everything FIRST, so /publish won't replace published_at with NOW()
      await saveAllInternal({ reload: false });

      // ✅ Then publish
      await withTimeout(api.post(`videos/${id}/publish`), 20000);

      const aliveRef = { current: true };
      await loadAll(aliveRef);
    } catch (e) {
      console.error(e);
      alert("Failed");
    } finally {
      setPrimaryBusy(false);
    }
  }

  /* ---------------- Uploads ---------------- */
  async function uploadStorage(file) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await withTimeout(api.post("uploads/video", fd), 120000);
    return res.data?.url;
  }

  /* ---------------- Delete ---------------- */
  async function doDelete() {
    if (!window.confirm("Delete this video?")) return;
    try {
      setDeleting(true);
      await withTimeout(api.delete(`videos/${id}`), 20000);
      navigate(LIST_HREF);
    } catch (e) {
      alert("Failed");
    } finally {
      setDeleting(false);
    }
  }

  /* ---------------- Free Preview ---------------- */
  const previewM = Math.floor((form.free_preview_seconds || 0) / 60);
  const previewS = (form.free_preview_seconds || 0) % 60;

  const setPreview = (m, s) => {
    const tot = clamp(m * 60 + s, 0, 7200);
    setForm((f) => ({ ...f, free_preview_seconds: tot }));
    previewMemoryRef.current = tot;
  };

  const anyBusy = loading || saving || pubBusy || deleting || primaryBusy;

  if (loadErr) {
    return (
      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Couldn’t load</div>
        <div style={{ color: "#6b7280", marginBottom: 12 }}>{loadErr}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => navigate(LIST_HREF)}>
            Back to videos
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              const aliveRef = { current: true };
              loadAll(aliveRef);
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {loading && (
        <div style={{ margin: "8px 0 14px" }}>
          <CircularSpinner label="Loading video details…" />
        </div>
      )}

      <GeoModal
        open={geoOpen}
        onClose={() => setGeoOpen(false)}
        value={geo}
        onSave={setGeo}
      />

      <PlaylistPicker
        videoId={id}
        open={pickerOpen}
        onClose={(changed) => {
          setPickerOpen(false);
          if (changed) {
            const aliveRef = { current: true };
            loadAssigned(aliveRef);
          }
        }}
      />

      <NewCategoryModal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        onCreate={(cat) => {
          setCats((c) => [...c, cat]);
          setForm((f) => ({ ...f, category_id: cat.id }));
        }}
      />

      <div
        style={{
          opacity: loading ? 0.6 : 1,
          pointerEvents: loading ? "none" : "auto",
          transition: "opacity 160ms ease",
        }}
      >
        <div className="vd-grid">
          {/* ---------- LEFT ---------- */}
          <div className="vd-col">
            <div className="vd-header">
              <div className="vd-breadcrumbs">
                <Link to={LIST_HREF} className="vd-link">
                  All videos
                </Link>
                <span>›</span>
                <span>{form.title || "Untitled"}</span>
              </div>

              {/* ✅ Primary action: Save&Publish (if unpublished) / Save changes (if published) */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {/* Secondary: Save draft (only when unpublished) */}
                {!form.is_published && (
                  <button
                    className="btn ghost"
                    onClick={saveAll}
                    disabled={anyBusy}
                    title="Save without publishing"
                  >
                    {saving ? "Saving…" : "Save draft"}
                  </button>
                )}

                <button
                  className="btn"
                  onClick={primaryAction}
                  disabled={anyBusy}
                >
                  {primaryBusy
                    ? "Working…"
                    : form.is_published
                      ? saving
                        ? "Saving…"
                        : "Save changes"
                      : "Save & Publish"}
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
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />

              <div className="vd-gap" />

              <label className="vd-label">Description</label>
              <textarea
                className="search"
                rows={5}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />

              <div className="vd-gap" />

              <label className="vd-label">Short description</label>
              <textarea
                className="search"
                maxLength={140}
                rows={3}
                value={form.short_description}
                onChange={(e) =>
                  setForm({ ...form, short_description: e.target.value })
                }
              />
              <div className="vd-small right">
                {140 - (form.short_description?.length || 0)} chars left
              </div>
            </section>

            {/* Organize */}
            <section className="card">
              <h3 className="vd-h">Organize</h3>

              <label className="vd-label">Categories</label>
              <div className="vd-row">
                <select
                  className="search"
                  value={form.category_id}
                  onChange={(e) =>
                    setForm({ ...form, category_id: e.target.value })
                  }
                >
                  <option value="">— No category —</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
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
              </div>

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
                      const next = authorInput.trim();
                      setAuthors((a) => (a.includes(next) ? a : [...a, next]));
                      setAuthorInput("");
                    }
                  }}
                />
              </div>
              <div className="vd-token-wrap">
                {authors.map((a, i) => (
                  <span
                    key={`${a}-${i}`}
                    className="badge badge-green"
                    onClick={() => setAuthors(authors.filter((x) => x !== a))}
                    title="Remove"
                  >
                    {a} ✕
                  </span>
                ))}
              </div>

              <div className="vd-gap" />

              <h3 className="vd-h">Playlists</h3>
              {assignedPlaylists.length ? (
                <div className="vd-token-wrap">
                  {assignedPlaylists.map((p) => (
                    <span key={p.id} className="badge badge-green">
                      {p.title}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="vd-muted">No playlists yet</div>
              )}

              <div className="vd-row" style={{ marginTop: 6 }}>
                <button className="btn" onClick={() => setPickerOpen(true)}>
                  Add to playlist
                </button>
              </div>
            </section>

            {/* Thumbnails */}
            <section className="card">
              <h3 className="vd-h">Thumbnails</h3>

              <div
                className="vd-thumb"
                onClick={() => thumbHRef.current?.click()}
              >
                {form.thumbnail_url ? (
                  <img src={absUrl(form.thumbnail_url)} alt="" />
                ) : (
                  <div className="vd-thumb-fallback">CHANGE IMAGE</div>
                )}
              </div>

              <input
                type="file"
                accept="image/*"
                ref={thumbHRef}
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const url = await uploadStorage(file);
                    await api.put(`videos/${id}`, { thumbnail_url: url });
                    setForm((f) => ({ ...f, thumbnail_url: url }));
                  } catch {
                    alert("Failed");
                  }
                }}
              />

              <div className="vd-gap" />
              <label className="vd-label">Thumbnail URL</label>
              <input
                className="search"
                value={form.thumbnail_url || ""}
                onChange={(e) =>
                  setForm({ ...form, thumbnail_url: e.target.value })
                }
              />
            </section>

            {/* Tags */}
            <section className="card">
              <h3 className="vd-h">Search tags</h3>

              <input
                className="search"
                placeholder="Type tag and press Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    const next = tagInput.trim();
                    setTags((t) => (t.includes(next) ? t : [...t, next]));
                    setTagInput("");
                  }
                }}
              />

              <div className="vd-token-wrap">
                {tags.map((t, i) => (
                  <span
                    key={`${t}-${i}`}
                    className="badge badge-green"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    title="Remove"
                  >
                    {t} ✕
                  </span>
                ))}
              </div>
            </section>

            {/* Danger zone */}
            <section className="card">
              <h3 className="vd-h" style={{ color: "rgba(255,255,255,0.9)" }}>
                Danger zone
              </h3>
              <div className="vd-row">
                <button
                  className="btn ghost"
                  onClick={doDelete}
                  disabled={deleting || anyBusy}
                >
                  {deleting ? "Deleting…" : "Delete video"}
                </button>
              </div>
            </section>
          </div>

          {/* ---------- RIGHT ---------- */}
          <aside className="vd-col">
            {/* Video */}
            <section className="card">
              <h3 className="vd-h">Video</h3>

              <div className="vd-video">
                {form.video_url ? (
                  <video
                    key={videoReloadKey}
                    ref={videoRef}
                    controls
                    style={{ width: "100%" }}
                    src={absUrl(form.video_url)}
                  />
                ) : (
                  <div className="vd-video-fallback">No video uploaded</div>
                )}
              </div>
            </section>

            {/* Visibility */}
            <section className="card">
              <h3 className="vd-h">Visibility</h3>

              <label className="radio">
                <input
                  type="radio"
                  checked={form.visibility === "public"}
                  onChange={() => setForm({ ...form, visibility: "public" })}
                />
                Public
              </label>

              <label className="radio">
                <input
                  type="radio"
                  checked={form.visibility === "private"}
                  onChange={() => setForm({ ...form, visibility: "private" })}
                />
                Members-only
              </label>

              <label className="radio">
                <input
                  type="radio"
                  checked={form.visibility === "unlisted"}
                  onChange={() => setForm({ ...form, visibility: "unlisted" })}
                />
                Unlisted
              </label>
            </section>

            {/* Publish */}
            <section className="card" style={{ overflow: "visible" }}>
              <h3 className="vd-h">Publish</h3>

              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                <label className="vd-label" style={{ marginBottom: -2 }}>
                  Publish date
                </label>

                {/* ✅ Text input avoids native date field caret/reset issues */}
                <input
                  className="search"
                  type="text"
                  inputMode="numeric"
                  placeholder="MM/DD/YYYY"
                  value={publishDateStr}
                  onChange={(e) => {
                    let v = e.target.value.replace(/[^\d/]/g, "");
                    v = v.replace(/\/+/g, "/");

                    const digits = v.replace(/\//g, "");
                    if (digits.length <= 2) v = digits;
                    else if (digits.length <= 4)
                      v = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                    else
                      v = `${digits.slice(0, 2)}/${digits.slice(
                        2,
                        4,
                      )}/${digits.slice(4, 8)}`;

                    setPublishDateStr(v);

                    if (isValidUsDateInput(v)) {
                      setForm((f) => ({
                        ...f,
                        published_at: fromUsDateInput(v),
                      }));
                    } else if (v === "") {
                      setForm((f) => ({ ...f, published_at: null }));
                    }
                  }}
                  onBlur={() => {
                    if (!publishDateStr) {
                      setForm((f) => ({ ...f, published_at: null }));
                      setPublishDateStr("");
                      return;
                    }

                    if (isValidUsDateInput(publishDateStr)) {
                      const iso = fromUsDateInput(publishDateStr);
                      setForm((f) => ({ ...f, published_at: iso }));
                      setPublishDateStr(toUsDateInput(iso));
                      return;
                    }

                    // invalid partial -> revert to last committed value
                    setPublishDateStr(toUsDateInput(form.published_at));
                  }}
                  style={{ width: "100%" }}
                />

                <div className="vd-muted vd-small" style={{ marginTop: -2 }}>
                  Used for sorting videos. Newer dates appear first.
                </div>

                <button
                  className="btn ghost"
                  onClick={() => {
                    setForm((f) => ({ ...f, published_at: null }));
                    setPublishDateStr("");
                  }}
                  disabled={anyBusy}
                  style={{ justifySelf: "start" }}
                  title="Clears published_at (saved on Save draft / Save & Publish / Save changes)"
                >
                  Clear date
                </button>
              </div>

              <div className="vd-gap" />

              {/* ✅ Publishing is now handled by the primary button when unpublished */}
              {form.is_published ? (
                <button
                  className="btn ghost"
                  onClick={() => publishVideo(false)}
                  disabled={anyBusy}
                >
                  {pubBusy ? "Working…" : "Unpublish"}
                </button>
              ) : (
                <button
                  className="btn"
                  onClick={primaryAction}
                  disabled={anyBusy}
                  title="Saves everything and publishes in one step"
                >
                  {primaryBusy ? "Working…" : "Save & Publish"}
                </button>
              )}

              <div className="vd-muted" style={{ marginTop: 6 }}>
                Publishing controls visibility.
              </div>
            </section>

            {/* Access */}
            <section className="card">
              <h3 className="vd-h">Access</h3>

              <label className="radio">
                <input
                  type="radio"
                  checked={form.is_premium === true}
                  onChange={() => setForm({ ...form, is_premium: true })}
                />
                Gated
              </label>
              <div className="vd-muted">
                Only users with access may watch this content.
              </div>

              {form.is_premium && (
                <>
                  <div className="vd-gap" />
                  <label className="vd-label">Free preview</label>

                  <div className="vd-row" style={{ gap: 6 }}>
                    <input
                      className="search"
                      type="number"
                      value={previewM}
                      onChange={(e) =>
                        setPreview(Number(e.target.value), previewS)
                      }
                      style={{ width: 70 }}
                    />
                    <span className="vd-muted">min</span>

                    <input
                      className="search"
                      type="number"
                      value={previewS}
                      onChange={(e) =>
                        setPreview(previewM, Number(e.target.value))
                      }
                      style={{ width: 70 }}
                    />
                    <span className="vd-muted">sec</span>
                  </div>

                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {[30, 60, 120, 300].map((sec) => (
                      <button
                        key={sec}
                        className="btn ghost"
                        onClick={() => setPreview(0, sec)}
                        disabled={anyBusy}
                      >
                        {sec < 60 ? `${sec}s` : `${sec / 60}m`}
                      </button>
                    ))}
                  </div>

                  <div className="vd-muted vd-small" style={{ marginTop: 4 }}>
                    Guests can watch up to this point.
                  </div>
                </>
              )}

              <div style={{ marginTop: 12 }}>
                <label className="radio">
                  <input
                    type="radio"
                    checked={form.is_premium === false}
                    onChange={() => setForm({ ...form, is_premium: false })}
                  />
                  Free for all users
                </label>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

/* ---------------- New Category Modal ---------------- */
function NewCategoryModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  if (!open) return null;

  async function submit() {
    if (!name.trim()) return;
    try {
      setSaving(true);
      const { data } = await api.post("categories", { name: name.trim() });
      onCreate(data);
      onClose();
    } catch (e) {
      alert("Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="vd-overlay" onClick={onClose}>
      <div className="vd-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="vd-h">New Category</h3>

        <label className="vd-label">Category Title</label>
        <input
          className="search"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="vd-row right" style={{ marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={saving} onClick={submit}>
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
