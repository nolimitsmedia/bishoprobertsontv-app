// src/pages/admin/CollectionDetail.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api";
// import "./Videos.css";
import "./Collections.css";

/* ------------ small helpers/styles ------------ */
const injectedStyles = `
.select-caret {
  appearance:none; -webkit-appearance:none; -moz-appearance:none;
  background:#fff; border:1px solid #e2e8f0; border-radius:10px; height:40px;
  padding:0 38px 0 12px;
  background-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M4 6l4 4 4-4" fill="none" stroke="%2364758b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
  background-repeat:no-repeat; background-position:right 12px center; background-size:16px 16px;
}
.select-caret:focus{ outline:none; box-shadow:0 0 0 3px rgba(59,130,246,.25); border-color:#93c5fd; }

.cd-card { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:16px; }
.cd-grid { display:grid; gap:14px; grid-template-columns:240px 1fr; }
.cd-thumb { width:100%; height:160px; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; display:grid; place-items:center; background:linear-gradient(140deg,#0b1320,#1b2436); color:#cbd5e1; }
.cd-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
.cd-actions { display:flex; gap:8px; flex-wrap:wrap; }
.cd-row { display:grid; grid-template-columns: 1fr 200px 1fr; gap:12px; }
.cd-field { display:flex; flex-direction:column; gap:6px; }
.cd-input { height:40px; border-radius:10px; border:1px solid #e2e8f0; padding:0 12px; }
.cd-textarea { min-height:140px; border-radius:10px; border:1px solid #e2e8f0; padding:10px 12px; resize:vertical; }

/* list sections */
.section { background:#fff; border:1px solid #e2e8f0; border-radius:16px; margin-top:16px; }
.section__head { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid #eef2f6; font-weight:800; }
.section__body { padding:8px 12px; }

.row { display:grid; grid-template-columns: 1fr 160px; align-items:center; padding:10px 8px; border-bottom:1px solid #f1f5f9; gap:12px; }
.row:last-child{ border-bottom:none; }
.row-left { display:flex; align-items:center; gap:12px; min-width:0; }
.row .thumb { width:64px; height:36px; border-radius:8px; overflow:hidden; border:1px solid #e2e8f0; background:#0b1320; display:grid; place-items:center; }
.row .thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
.row .title { font-weight:800; color:#0b1220; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.small { font-size:12px; color:#64748b; }
.badge { font-size:11px; font-weight:800; padding:6px 10px; border-radius:999px; display:inline-block; }
.badge-green { background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; }
.badge-red { background:#fef2f2; color:#7f1d1d; border:1px solid #fecaca; }

.thumb-fallback { font-size:10px; color:#cbd5e1; opacity:.8; padding:0 6px; }
`;

function StatusBadge({ visibility }) {
  const published = visibility === "public";
  return (
    <span className={`badge ${published ? "badge-green" : "badge-red"}`}>
      {published ? "PUBLISHED" : "UNPUBLISHED"}
    </span>
  );
}

/**
 * ✅ IMPORTANT FIX:
 * Never return "" for an image src.
 * Return null when empty/invalid so we can conditionally render <img>.
 */
function absUrl(u) {
  const s = String(u || "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return s.startsWith("/") ? s : `/${s}`;
}

function Thumb({ url, alt = "" }) {
  const src = absUrl(url);
  if (!src) return <div className="thumb-fallback">No image</div>;
  return <img src={src} alt={alt} />;
}

export default function CollectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  /* playlist form state */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [slug, setSlug] = useState("");
  const [featuredCategoryId, setFeaturedCategoryId] = useState("");

  const [categories, setCategories] = useState([]);

  /* upload */
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  /* videos sections */
  const [allVideos, setAllVideos] = useState([]);
  const [memberIds, setMemberIds] = useState(new Set()); // Set<string>
  const [busyVideo, setBusyVideo] = useState(null);
  const [searchAdd, setSearchAdd] = useState("");

  // ---------- load meta + categories + videos ----------
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [pls, cats, vids] = await Promise.all([
          api.get("/playlists", { params: { limit: 200 } }),
          api.get("/categories?mine=1"),
          api.get("/videos", { params: { limit: 500 } }),
        ]);

        const items = Array.isArray(pls.data)
          ? pls.data
          : pls.data?.items || [];
        const row = items.find((p) => String(p.id) === String(id));
        if (!row) {
          setError("Playlist not found.");
        } else {
          setTitle(row.title || "");
          setDescription(row.description || "");
          setThumbnailUrl(row.thumbnail_url || "");
          setVisibility(row.visibility || "public");
          setSlug(row.slug || "");
          setFeaturedCategoryId(
            row.featured_category_id ? String(row.featured_category_id) : ""
          );
        }

        const catList = Array.isArray(cats.data)
          ? cats.data
          : cats.data?.items || [];
        setCategories(catList.map((c) => ({ id: String(c.id), name: c.name })));

        const vlist = Array.isArray(vids.data)
          ? vids.data
          : vids.data?.items || [];
        setAllVideos(vlist);

        // Try fast path: public detail
        let memberSet = new Set();
        try {
          const det = await api.get(`/playlists/public/${id}`);
          const vs = Array.isArray(det.data?.videos) ? det.data.videos : [];
          memberSet = new Set(vs.map((x) => String(x.id)));
        } catch {
          // fallback for private playlists: ask membership per video
          const results = await Promise.allSettled(
            vlist.map((v) => api.get(`/playlists/for-video/${v.id}`))
          );
          results.forEach((r, idx) => {
            if (r.status === "fulfilled") {
              const ids =
                r.value.data?.items || r.value.data?.playlist_ids || [];
              if (ids.map(String).includes(String(id))) {
                memberSet.add(String(vlist[idx].id));
              }
            }
          });
        }
        setMemberIds(memberSet);
      } catch (e) {
        console.error("load detail error", e);
        setError(e?.response?.data?.message || "Failed to load playlist.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  /* ---------- upload thumbnail ---------- */
  async function onUploadChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      setUploadPct(0);
      const form = new FormData();
      form.append("file", file);
      const resp = await api.post("/uploads", form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (p) => {
          if (p.total) setUploadPct(Math.round((p.loaded / p.total) * 100));
        },
      });
      const url =
        resp.data?.url || resp.data?.path || resp.data?.Location || "";
      if (!url) throw new Error("No URL returned from upload.");
      setThumbnailUrl(url);
    } catch (e) {
      console.error("upload error", e);
      alert(e?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
      setUploadPct(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /* ---------- save meta ---------- */
  async function save() {
    setSaving(true);
    setError("");
    try {
      await api.put(`/playlists/${id}`, {
        title,
        description,
        thumbnail_url: thumbnailUrl || null,
        visibility,
        slug: slug || null,
        featured_category_id: featuredCategoryId || null,
      });
      navigate("/admin/content/collections");
    } catch (e) {
      console.error("save playlist error", e);
      setError(e?.response?.data?.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- membership actions ---------- */
  const inThis = useMemo(
    () => allVideos.filter((v) => memberIds.has(String(v.id))),
    [allVideos, memberIds]
  );

  const canAdd = useMemo(() => {
    const q = searchAdd.trim().toLowerCase();
    const base = allVideos.filter((v) => !memberIds.has(String(v.id)));
    if (!q) return base;
    return base.filter(
      (v) =>
        v.title?.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q)
    );
  }, [allVideos, memberIds, searchAdd]);

  async function addVideo(videoId) {
    try {
      setBusyVideo(videoId);
      await api.post(`/playlists/${id}/videos`, { video_id: videoId });
      setMemberIds((s) => new Set(s).add(String(videoId)));
    } catch (e) {
      console.error("add video error", e);
      alert(e?.response?.data?.message || "Failed to add video.");
    } finally {
      setBusyVideo(null);
    }
  }

  async function removeVideo(videoId) {
    try {
      setBusyVideo(videoId);
      await api.delete(`/playlists/${id}/videos/${videoId}`);
      setMemberIds((s) => {
        const n = new Set(s);
        n.delete(String(videoId));
        return n;
      });
    } catch (e) {
      console.error("remove video error", e);
      alert(e?.response?.data?.message || "Failed to remove video.");
    } finally {
      setBusyVideo(null);
    }
  }

  const thumbPreview = absUrl(thumbnailUrl);

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: injectedStyles }} />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontWeight: 800 }}>
          {title?.trim() || "New Playlist"}
        </h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Link to="/admin/content/collections" className="btn ghost">
            ← Back to Playlists
          </Link>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {error && (
        <div className="banner error" style={{ marginBottom: 12 }}>
          <span>{error}</span>
          <span className="x" onClick={() => setError("")}>
            ✕
          </span>
        </div>
      )}

      {/* Top form */}
      <div className="cd-card">
        {loading ? (
          <div>Loading…</div>
        ) : (
          <div className="cd-grid">
            {/* left: thumbnail */}
            <div>
              <div className="cd-thumb" style={{ marginBottom: 10 }}>
                {thumbPreview ? (
                  <img src={thumbPreview} alt="" />
                ) : (
                  <span>Thumbnail</span>
                )}
              </div>
              <div className="cd-actions">
                <button
                  className="btn ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? `Uploading… ${uploadPct}%` : "Upload"}
                </button>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  ref={fileInputRef}
                  onChange={onUploadChange}
                />
                <input
                  className="cd-input"
                  style={{ flex: "1 1 220px" }}
                  placeholder="…or paste image URL"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                />
              </div>
            </div>

            {/* right: fields */}
            <div style={{ display: "grid", gap: 12 }}>
              <div className="cd-field">
                <label>Title</label>
                <input
                  className="cd-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="cd-field">
                <label>Description</label>
                <textarea
                  className="cd-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="cd-row">
                <div className="cd-field">
                  <label>Visibility</label>
                  <select
                    className="select-caret"
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                  >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                </div>

                <div className="cd-field">
                  <label>Slug</label>
                  <input
                    className="cd-input"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </div>

                <div className="cd-field">
                  <label>Displays In (Category row)</label>
                  <select
                    className="select-caret"
                    value={featuredCategoryId}
                    onChange={(e) => setFeaturedCategoryId(e.target.value)}
                  >
                    <option value="">— Do not feature —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <StatusBadge visibility={visibility} />
                <span className="small">Changes are not live until saved.</span>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn primary"
                  onClick={save}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <Link to="/admin/content/collections" className="btn ghost">
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== Videos in this playlist ==================== */}
      <div className="section">
        <div className="brtv-collection-playlist">
          <div className="brtv-collection-head">Videos in this playlist</div>
          <div className="small">
            {inThis.length} item{inThis.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="section__body">
          {inThis.length === 0 ? (
            <div className="small" style={{ padding: 8 }}>
              No videos yet.
            </div>
          ) : (
            inThis.map((v) => (
              <div key={v.id} className="row">
                <div className="row-left">
                  <div className="thumb">
                    <Thumb url={v.thumbnail_url} alt="" />
                  </div>
                  <div className="title">{v.title || "Untitled"}</div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    className="btn ghost"
                    onClick={() => removeVideo(v.id)}
                    disabled={busyVideo === v.id}
                  >
                    {busyVideo === v.id ? "Removing…" : "Remove"}
                  </button>
                  <Link
                    className="btn"
                    to={`/admin/content/videos/${v.id}`}
                    target="_blank"
                  >
                    Open video
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ==================== Add videos ==================== */}
      <div className="section">
        <div className="brtv-collection-head">Add videos</div>
        <div className="section__body">
          <div style={{ padding: 8 }}>
            <input
              className="cd-input"
              placeholder="Search videos to add…"
              value={searchAdd}
              onChange={(e) => setSearchAdd(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          {canAdd.length === 0 ? (
            <div className="small" style={{ padding: 8 }}>
              {searchAdd.trim()
                ? "No matches."
                : "All videos are already added."}
            </div>
          ) : (
            canAdd.map((v) => {
              const added = memberIds.has(String(v.id));
              return (
                <div key={v.id} className="row">
                  <div className="row-left">
                    <div className="thumb">
                      <Thumb url={v.thumbnail_url} alt="" />
                    </div>
                    <div className="title">{v.title || "Untitled"}</div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      className="btn"
                      onClick={() => addVideo(v.id)}
                      disabled={added || busyVideo === v.id}
                    >
                      {added ? "Added" : busyVideo === v.id ? "Adding…" : "Add"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
