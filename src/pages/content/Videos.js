// src/pages/admin/Videos.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "../../api";
import UploadVideosModal from "../../components/UploadVideosModal";
import "./Videos.css";

/* ---------- scoped styles (adds responsive mobile list + confirm + playlist modal) ---------- */
const injectedStyles = `
.videos-page .btn {
  --h:40px; --radius:10px; --pad-x:14px;
  height: var(--h); border-radius: var(--radius);
  padding: 0 var(--pad-x); font-weight: 600; font-size: 14px;
  border: 1px solid transparent; cursor: pointer;
  transition: background-color .15s ease, box-shadow .15s ease, border-color .15s ease, transform .02s ease;
}
.videos-page .btn:active { transform: translateY(1px); }
.videos-page .btn.primary {
  background: #2563eb; color: #fff; min-width: 160px;
  box-shadow: 0 1px 0 rgba(0,0,0,.05), 0 8px 16px -8px rgba(37,99,235,.55);
}
.videos-page .btn.primary:hover { background:#1e40af; }
.videos-page .btn.secondary {
  background: #f8fafc; color:#0f172a; border-color: #e2e8f0; min-width: 140px;
}
.videos-page .btn.secondary:hover { background:#eef2ff; border-color:#c7d2fe; }
.videos-page .btn.ghost {
  background: #ffffff; border-color:#e2e8f0; color:#0f172a; min-width: 140px;
}
.videos-page .btn.ghost:hover { background:#f8fafc; }

.videos-page .icon-btn {
  width: 34px; height: 34px; border-radius: 8px; border: 1px solid #e2e8f0;
  background: #fff; cursor: pointer; display:grid; place-items:center;
}
.videos-page .icon-btn:hover { background:#f8fafc; }

.videos-page .menu {
  position: absolute; right: 0; top: 40px; background:#fff; border:1px solid #e2e8f0;
  border-radius: 10px; box-shadow: 0 12px 30px rgba(2,6,23,.12);
  min-width: 180px; padding: 6px; z-index: 10;
}
.videos-page .menu-item {
  width:100%; text-align:left; padding: 10px 12px; border-radius:8px;
  background:transparent; border:none; cursor:pointer; font-weight:600; color:#0f172a;
}
.videos-page .menu-item:hover { background:#f1f5f9; }
.videos-page .menu-item.danger { color:#b91c1c; }
.videos-page .menu-item.danger:hover { background:#fee2e2; }

.videos-page .card { background:#fff; border:1px solid #e2e8f0; border-radius: 16px; }
.videos-page .table-card { overflow:hidden; }
.videos-page .table { border-collapse: separate; border-spacing: 0; width:100%; table-layout:auto; }
.videos-page .table thead th {
  text-align:left; font-size:12px; letter-spacing:.02em; color:#64748b;
  padding:14px 16px; background:#fafafa; border-bottom:1px solid #e2e8f0; font-weight:700;
}
.videos-page .table tbody td { padding: 14px 16px; border-bottom:1px solid #eef2f6; vertical-align: middle; }
.videos-page .row-title { font-weight:800; color:#0b1220; text-decoration:none; }
.videos-page .row-title:hover { text-decoration:underline; }

.videos-page .thumb {
  width: 128px; height: 72px; border-radius: 10px; overflow: hidden; flex: 0 0 auto;
  background: linear-gradient(140deg,#0b1320,#1b2436);
  position: relative; border:1px solid #e2e8f0;
}
.videos-page .thumb img { width:100%; height:100%; object-fit:cover; display:block; }
.videos-page .thumb .dur {
  position:absolute; right:6px; bottom:6px; font-size:11px; font-weight:700;
  background: rgba(15,23,42,.85); color:#fff; padding: 2px 6px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.18); backdrop-filter: blur(2px);
}

.videos-page .badge { font-size:11px; font-weight:800; padding:6px 10px; border-radius: 999px; display:inline-block; white-space:nowrap; }
.videos-page .badge-green { background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; }
.videos-page .badge-red { background:#fef2f2; color:#7f1d1d; border:1px solid #fecaca; }

.videos-page .toolbar-grid { padding: 12px; }
.videos-page .toolbar-grid .search { height:40px; border-radius:10px; border:1px solid #e2e8f0; padding:0 12px; }
.videos-page .search-wrap { position:relative; }
.videos-page .search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); opacity:.5; }
.videos-page .search--with-icon { padding-left:32px; }

.videos-page .table-footer { padding: 12px 16px; color:#64748b; font-size: 12px; }

/* ---------- Mobile list (<=640px) ---------- */
@media (max-width: 640px) {
  .videos-page .table-card { overflow: visible; }
  .videos-page .table { display: none; } /* hide desktop table */
  .videos-page .mobile-list { display:block; }
}
@media (min-width: 641px) {
  .videos-page .mobile-list { display:none; }
}

/* mobile item */
.videos-page .mobile-item {
  display:flex; align-items:center; gap:12px; padding:14px 16px;
  border-bottom: 1px solid #eef2f6; position: relative;
}
.videos-page .mobile-item .meta { min-width: 0; flex: 1 1 auto; }
.videos-page .mobile-item .title {
  font-weight:800; color:#0b1220; text-decoration:none; display:block;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.videos-page .mobile-item .sub {
  margin-top:4px; font-size:12px; color:#64748b; display:flex; gap:8px; align-items:center; flex-wrap:wrap;
}
.videos-page .mobile-item .thumb { width: 120px; height: 68px; }

/* ---------- Confirm dialog & banner ---------- */
.videos-page .confirm-overlay {
  position: fixed; inset: 0; background: rgba(2,6,23,.45);
  display: grid; place-items: center; z-index: 1000;
}
.videos-page .confirm-modal {
  width: min(440px, 92vw);
  background: #fff; border-radius: 14px; box-shadow: 0 24px 60px rgba(2,6,23,.25);
  border: 1px solid #e2e8f0; padding: 16px;
}
.videos-page .confirm-title { font-weight: 800; font-size: 18px; margin: 4px 0 6px; }
.videos-page .confirm-msg { color:#475569; font-size: 14px; line-height: 1.4; }
.videos-page .confirm-row { display:flex; gap:10px; justify-content:flex-end; margin-top: 16px; }
.videos-page .btn.danger { background:#ef4444; border-color:#ef4444; color:#fff; }
.videos-page .btn.danger:hover { background:#b91c1c; border-color:#b91c1c; color:#fff; }

.videos-page .banner {
  margin-bottom: 12px; padding: 10px 12px; border-radius: 10px; font-weight: 600;
  display:flex; align-items:center; justify-content:space-between; gap:12px;
}
.videos-page .banner.error { background:#fee2e2; color:#7f1d1d; border:1px solid #fecaca; }
.videos-page .banner .x { cursor:pointer; opacity:.7; }

/* ---------- Playlist Picker Modal ---------- */
.videos-page .pl-overlay { position: fixed; inset: 0; background: rgba(2,6,23,.45); display:grid; place-items:center; z-index:1000; }
.videos-page .pl-modal {
  width: min(560px, 94vw); background:#fff; border-radius:14px; border:1px solid #e2e8f0;
  box-shadow: 0 24px 60px rgba(2,6,23,.25); padding: 16px;
}
.videos-page .pl-title { font-weight:800; font-size:18px; margin-bottom:6px; }
.videos-page .pl-sub { color:#475569; margin-bottom: 12px; }
.videos-page .pl-list { max-height: 46vh; overflow:auto; border:1px solid #eef2f6; border-radius:10px; }
.videos-page .pl-row { display:flex; align-items:center; gap:10px; padding:10px 12px; border-bottom:1px solid #f1f5f9; }
.videos-page .pl-row:last-child { border-bottom:none; }
.videos-page .pl-new { display:flex; gap:8px; flex-wrap:wrap; }
.videos-page .pl-new .search { height:40px; border-radius:10px; border:1px solid #e2e8f0; padding:0 12px; }
.videos-page .pl-footer { display:flex; gap:10px; justify-content:flex-end; margin-top:12px; }
`;

/* -------- utils -------- */
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
function formatDuration(secs) {
  const s = Math.max(0, Number(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const two = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(ss)}` : `${m}:${two(ss)}`;
}
function currencySymbol(c) {
  const map = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CAD: "C$",
    AUD: "A$",
    JPY: "¥",
    PHP: "₱",
  };
  return map[String(c || "").toUpperCase()] || "";
}
function formatMoney(cur, val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return "—";
  const sym = currencySymbol(cur);
  return `${sym}${n.toFixed(2)}${sym ? "" : ` ${cur || ""}`}`.trim();
}

// Try to read seconds from any common field/shape
function secsFromAny(v) {
  if (v == null) return null;
  if (typeof v === "number" || /^\d+(\.\d+)?$/.test(String(v))) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return n > 36000 ? Math.round(n / 1000) : Math.round(n);
  }
  const s = String(v).trim();
  if (/^\d+:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }
  return null;
}
function pickDurationSeconds(item) {
  const m = item?.metadata || {};
  const candidates = [
    item.duration_seconds,
    item.duration_sec,
    item.duration,
    m.duration_seconds,
    m.duration_sec,
    m.duration,
  ];
  for (const c of candidates) {
    const sec = secsFromAny(c);
    if (sec) return sec;
  }
  return null;
}
function pickCategoryName(item, catMap) {
  if (item?.category_name) return item.category_name;
  const id = item?.category_id;
  if (!id) return "—";
  return catMap.get(Number(id)) || "—";
}
function pickPriceLabel(item) {
  const md = item?.metadata || {};
  const pricing = md.pricing || item?.pricing || {};
  const purchase = pricing?.purchase;
  const rental = pricing?.rental;
  if (purchase && Number(purchase.price) > 0)
    return formatMoney(purchase.currency || "USD", purchase.price);
  if (rental && Number(rental.price) > 0)
    return formatMoney(rental.currency || "USD", rental.price);
  return "—";
}

// ---------- Published helpers (NEW) ----------
function pickPublished(item) {
  // primary flag
  if (typeof item?.is_published === "boolean") return item.is_published;
  // status string
  const st = String(item?.status || "").toLowerCase();
  if (st) return st === "published" || st === "live";
  // timestamps commonly used
  if (item?.published_at || item?.publishedAt || item?.published_on)
    return true;
  // fallback legacy heuristic (avoid breaking older content)
  return item?.visibility === "public";
}
function pickPublishedAt(item) {
  return item?.published_at || item?.publishedAt || item?.published_on || null;
}

// Figure out the API origin from axios baseURL
const API_ORIGIN = (() => {
  try {
    const u = new URL(api.defaults.baseURL || "", window.location.href);
    return u.origin || window.location.origin;
  } catch {
    return window.location.origin;
  }
})();

// Make absolute URLs for /uploads/…
export function absUrl(url) {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith("//")) return window.location.protocol + url;
  if (url.startsWith("/")) return API_ORIGIN + url;
  return API_ORIGIN + "/" + url.replace(/^\.\//, "");
}

// SVG fallback thumbnail
function thumbFallbackSVG(title = "Video") {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="160" height="100" viewBox="0 0 160 100">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0b1320"/>
        <stop offset="100%" stop-color="#1b2436"/>
      </linearGradient>
    </defs>
    <rect width="160" height="100" rx="10" fill="url(#g)"/>
    <circle cx="80" cy="50" r="22" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)"/>
    <polygon points="74,40 92,50 74,60" fill="#ffffff"/>
    <text x="80" y="88" font-size="10" text-anchor="middle" fill="#aeb5c0" font-family="Inter,Arial,sans-serif">${(
      title || "Video"
    )
      .slice(0, 24)
      .replace(/&/g, "&amp;")}</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

/* -------- small hooks -------- */
function useIsNarrow(bp = 900) {
  const [narrow, setNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth <= bp : false
  );
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= bp);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bp]);
  return narrow;
}

/* -------- UI bits -------- */
function StatusBadge({ video }) {
  const published = pickPublished(video);
  return (
    <span
      className={`badge ${published ? "badge-green" : "badge-red"}`}
      title={
        published
          ? `Published${
              pickPublishedAt(video)
                ? " · " + formatDate(pickPublishedAt(video))
                : ""
            }`
          : "Unpublished"
      }
    >
      {published ? "PUBLISHED" : "UNPUBLISHED"}
    </span>
  );
}

/* ---------- Confirm dialog component ---------- */
function ConfirmDialog({
  open,
  title = "Are you sure?",
  message = "Please confirm this action.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) {
  const btnRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => btnRef.current?.focus(), 0);
    const onKey = (e) => e.key === "Escape" && onCancel?.();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div
      className="confirm-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-title">{title}</div>
        <div className="confirm-msg">{message}</div>
        <div className="confirm-row">
          <button className="btn ghost" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            ref={btnRef}
            className={`btn ${danger ? "danger" : ""}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Playlist Picker Modal ---------- */
function PlaylistPickerModal({ open, video, onClose }) {
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [checked, setChecked] = useState(new Set());
  const [initialChecked, setInitialChecked] = useState(new Set());
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // load playlists + membership
  useEffect(() => {
    if (!open || !video?.id) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [pls, mem] = await Promise.all([
          api.get("/playlists"),
          api.get(`/playlists/videos/${video.id}`),
        ]);
        const items = Array.isArray(pls.data?.items)
          ? pls.data.items
          : Array.isArray(pls.data)
          ? pls.data
          : [];
        setPlaylists(items);
        const ids = new Set((mem.data?.playlist_ids || []).map(String));
        setChecked(new Set(ids));
        setInitialChecked(new Set(ids));
      } catch (e) {
        console.error("playlist picker load error", e);
        setError(e?.response?.data?.message || "Failed to load playlists.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, video]);

  const toggle = (id) => {
    setChecked((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  async function createNew() {
    if (!newTitle.trim()) return;
    try {
      setCreating(true);
      const { data } = await api.post("/playlists", {
        title: newTitle.trim(),
        visibility: "public",
      });
      setPlaylists((p) => [{ ...data, item_count: 0 }, ...p]);
      setChecked((s) => new Set([...s, String(data.id)]));
      setNewTitle("");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to create playlist.");
    } finally {
      setCreating(false);
    }
  }

  async function save() {
    try {
      setLoading(true);
      setError("");
      const before = initialChecked;
      const after = checked;

      const toAdd = [...after].filter((id) => !before.has(id));
      const toRemove = [...before].filter((id) => !after.has(id));

      await Promise.all([
        ...toAdd.map((id) =>
          api.post(`/playlists/${id}/videos`, { video_id: video.id })
        ),
        ...toRemove.map((id) =>
          api.delete(`/playlists/${id}/videos/${video.id}`)
        ),
      ]);

      onClose?.(true);
    } catch (e) {
      console.error("playlist save error", e);
      setError(e?.response?.data?.message || "Failed to update playlists.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="pl-overlay" onClick={() => onClose?.(false)}>
      <div className="pl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pl-title">Add to playlist</div>
        <div className="pl-sub">
          Choose one or more playlists for “{video?.title || "Untitled"}”.
        </div>

        <div className="pl-new" style={{ marginBottom: 10 }}>
          <input
            className="search"
            style={{ flex: "1 1 260px", minWidth: 200 }}
            placeholder="New playlist title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createNew()}
          />
          <button
            className="btn ghost"
            onClick={createNew}
            disabled={!newTitle.trim() || creating}
          >
            {creating ? "Creating…" : "+ Create"}
          </button>
          <Link to="/admin/content/collections" className="btn ghost">
            Manage playlists
          </Link>
        </div>

        <div className="pl-list">
          {loading ? (
            <div style={{ padding: 12 }}>Loading…</div>
          ) : playlists.length === 0 ? (
            <div style={{ padding: 12, color: "#475569" }}>
              No playlists yet. Create one above.
            </div>
          ) : (
            playlists.map((p) => {
              const id = String(p.id);
              return (
                <label key={id} className="pl-row">
                  <input
                    type="checkbox"
                    checked={checked.has(id)}
                    onChange={() => toggle(id)}
                  />
                  <div style={{ fontWeight: 700 }}>{p.title}</div>
                  <div
                    style={{
                      marginLeft: "auto",
                      color: "#64748b",
                      fontSize: 12,
                    }}
                  >
                    {p.item_count ?? p.video_count ?? 0} items
                  </div>
                </label>
              );
            })
          )}
        </div>

        {error && (
          <div style={{ color: "#b91c1c", marginTop: 8, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div className="pl-footer">
          <button
            className="btn ghost"
            onClick={() => onClose?.(false)}
            disabled={loading}
          >
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={loading}>
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VideosPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isNarrow = useIsNarrow(900);
  const isMobile = useIsNarrow(640);

  const inStudio = location.pathname.startsWith("/studio");
  const editHrefFor = (id) =>
    inStudio ? `/studio/videos/${id}` : `/admin/content/videos/${id}`;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [catMap, setCatMap] = useState(new Map());

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const [banner, setBanner] = useState(null);
  const [confirm, setConfirm] = useState({
    open: false,
    title: "",
    message: "",
    danger: true,
    confirmText: "Delete",
    onConfirm: null,
  });

  const [playlistFor, setPlaylistFor] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [v, c] = await Promise.allSettled([
        api.get("/videos", { params: { limit: 200 } }),
        api.get("/categories?mine=1"),
      ]);

      const arr =
        v.status === "fulfilled"
          ? Array.isArray(v.value.data)
            ? v.value.data
            : v.value.data?.items || []
          : [];

      setItems(arr);

      if (c.status === "fulfilled") {
        const list = c.value.data || [];
        const m = new Map();
        for (const cat of list) m.set(Number(cat.id), cat.name);
        setCatMap(m);
      }
    } catch (err) {
      console.error("load videos error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredSorted = useMemo(() => {
    let list = [...items];
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (v) =>
          (v.title || "").toLowerCase().includes(query) ||
          (v.description || "").toLowerCase().includes(query)
      );
    }

    if (statusFilter === "published")
      list = list.filter((v) => pickPublished(v));
    if (statusFilter === "unpublished")
      list = list.filter((v) => !pickPublished(v));

    if (sortBy === "newest") {
      list.sort(
        (a, b) =>
          new Date(b.created_at || b.created || 0) -
          new Date(a.created_at || a.created || 0)
      );
    } else if (sortBy === "oldest") {
      list.sort(
        (a, b) =>
          new Date(a.created_at || a.created || 0) -
          new Date(b.created_at || b.created || 0)
      );
    } else if (sortBy === "title") {
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
    return list;
  }, [items, q, statusFilter, sortBy]);

  function askDelete(video) {
    setRowMenu(null);
    setConfirm({
      open: true,
      title: "Delete video?",
      message: `“${
        video.title || "Untitled"
      }” will be permanently deleted. This cannot be undone.`,
      danger: true,
      confirmText: "Delete",
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, open: false }));
        try {
          await api.delete(`/videos/${video.id}`);
          await load();
        } catch (err) {
          console.error("delete error:", err);
          setBanner({
            type: "error",
            text: err?.response?.data?.message || "Delete failed",
          });
        }
      },
    });
  }

  return (
    <div className="videos-page">
      <style dangerouslySetInnerHTML={{ __html: injectedStyles }} />

      {banner && (
        <div className={`banner ${banner.type || "error"}`}>
          <span>{banner.text}</span>
          <span className="x" onClick={() => setBanner(null)}>
            ✕
          </span>
        </div>
      )}

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        danger={confirm.danger}
        confirmText={confirm.confirmText}
        onCancel={() => setConfirm((c) => ({ ...c, open: false }))}
        onConfirm={confirm.onConfirm}
      />

      <PlaylistPickerModal
        open={!!playlistFor}
        video={playlistFor}
        onClose={async (changed) => {
          setPlaylistFor(null);
          if (changed) {
          }
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontWeight: 800, fontSize: 28 }}>Videos</h2>

        <div style={{ marginLeft: "auto", position: "relative" }}>
          <button
            className="btn secondary"
            onClick={() => setMoreOpen((s) => !s)}
          >
            More actions ▾
          </button>
          {moreOpen && (
            <div className="menu" onMouseLeave={() => setMoreOpen(false)}>
              <button
                className="menu-item"
                onClick={() => alert("Export CSV (todo)")}
              >
                Export CSV
              </button>
              <button
                className="menu-item"
                onClick={() => alert("Bulk edit (todo)")}
              >
                Bulk edit
              </button>
              <Link
                className="menu-item"
                to="/admin/content/collections"
                onClick={() => setMoreOpen(false)}
              >
                Manage playlists
              </Link>
            </div>
          )}
        </div>

        <button className="btn primary" onClick={() => setUploadOpen(true)}>
          ⬆️ Upload videos
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div
          className="toolbar-grid"
          style={{
            display: "grid",
            gridTemplateColumns: isNarrow ? "1fr" : "1fr 220px 180px",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              className="search search--with-icon"
            />
          </div>

          <select
            className="search"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Status</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>

          <select
            className="search"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="title">Sort: Title A–Z</option>
          </select>
        </div>
      </div>

      <div className="card table-card">
        {!isMobile &&
          (loading ? (
            <div style={{ padding: 24 }}>Loading…</div>
          ) : filteredSorted.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center" }}>
              No videos yet.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>
                    <input type="checkbox" disabled />
                  </th>
                  <th>VIDEOS</th>
                  <th style={{ width: 160 }}>CATEGORY</th>
                  <th style={{ width: 140 }}>PRICE</th>
                  <th style={{ width: 160 }}>STATUS</th>
                  <th style={{ width: 220 }}>UPLOADED ON</th>
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {filteredSorted.map((v) => {
                  const title = v.title || "Untitled";
                  const imgSrc = absUrl(v.thumbnail_url || "");
                  const fallback = thumbFallbackSVG(title);
                  const editHref = editHrefFor(v.id);
                  const durSec = pickDurationSeconds(v);
                  const catName = pickCategoryName(v, catMap);
                  const price = pickPriceLabel(v);

                  return (
                    <tr key={v.id}>
                      <td>
                        <input type="checkbox" />
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: 12,
                            alignItems: "center",
                            minWidth: 0,
                          }}
                        >
                          <div className="thumb" aria-hidden="true">
                            {imgSrc ? (
                              <img
                                src={imgSrc}
                                alt=""
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = fallback;
                                }}
                              />
                            ) : (
                              <img src={fallback} alt="" />
                            )}
                            {durSec ? (
                              <span className="dur">
                                {formatDuration(durSec)}
                              </span>
                            ) : null}
                          </div>
                          <Link
                            to={editHref}
                            className="row-title"
                            title="Edit video"
                            style={{
                              minWidth: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {title}
                          </Link>
                        </div>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{catName}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{price}</td>
                      <td>
                        <StatusBadge video={v} />
                      </td>
                      <td>{formatDate(v.created_at || v.created)}</td>
                      <td style={{ position: "relative" }}>
                        <button
                          className="icon-btn"
                          onClick={() =>
                            setRowMenu((cur) => (cur === v.id ? null : v.id))
                          }
                          aria-label="Actions"
                          title="Actions"
                        >
                          ⋮
                        </button>
                        {rowMenu === v.id && (
                          <div
                            className="menu"
                            onMouseLeave={() => setRowMenu(null)}
                          >
                            <button
                              className="menu-item"
                              onClick={() => navigate(editHref)}
                            >
                              Edit
                            </button>
                            <button
                              className="menu-item"
                              onClick={() => {
                                setRowMenu(null);
                                setPlaylistFor(v);
                              }}
                            >
                              Add to playlist…
                            </button>
                            <button
                              className="menu-item danger"
                              onClick={() => askDelete(v)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}

        {isMobile && (
          <div className="mobile-list">
            {loading ? (
              <div style={{ padding: 24 }}>Loading…</div>
            ) : filteredSorted.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center" }}>
                No videos yet.
              </div>
            ) : (
              filteredSorted.map((v) => {
                const title = v.title || "Untitled";
                const imgSrc = absUrl(v.thumbnail_url || "");
                const fallback = thumbFallbackSVG(title);
                const editHref = editHrefFor(v.id);
                const durSec = pickDurationSeconds(v);
                const catName = pickCategoryName(v, catMap);
                const price = pickPriceLabel(v);

                return (
                  <div key={v.id} className="mobile-item">
                    <div className="thumb" aria-hidden="true">
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt=""
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = fallback;
                          }}
                        />
                      ) : (
                        <img src={fallback} alt="" />
                      )}
                      {durSec ? (
                        <span className="dur">{formatDuration(durSec)}</span>
                      ) : null}
                    </div>

                    <div className="meta">
                      <Link to={editHref} className="title">
                        {title}
                      </Link>
                      <div className="sub">
                        <StatusBadge video={v} />
                        <span>• {catName}</span>
                        <span>• {price}</span>
                        <span>• {formatDate(v.created_at || v.created)}</span>
                      </div>
                    </div>

                    <div style={{ position: "relative" }}>
                      <button
                        className="icon-btn"
                        onClick={() =>
                          setRowMenu((cur) => (cur === v.id ? null : v.id))
                        }
                        aria-label="Actions"
                        title="Actions"
                      >
                        ⋮
                      </button>
                      {rowMenu === v.id && (
                        <div
                          className="menu"
                          onMouseLeave={() => setRowMenu(null)}
                          style={{ right: 0, top: 38 }}
                        >
                          <button
                            className="menu-item"
                            onClick={() => navigate(editHref)}
                          >
                            Edit
                          </button>
                          <button
                            className="menu-item"
                            onClick={() => {
                              setRowMenu(null);
                              setPlaylistFor(v);
                            }}
                          >
                            Add to playlist…
                          </button>
                          <button
                            className="menu-item danger"
                            onClick={() => askDelete(v)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="table-footer">Displaying {filteredSorted.length}</div>
      </div>

      <UploadVideosModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onDone={load}
      />
    </div>
  );
}
