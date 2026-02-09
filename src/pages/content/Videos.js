// src/pages/admin/Videos.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "../../api";
import UploadVideosModal from "../../components/UploadVideosModal";
import DefaultThumb from "../../assets/BishopRobertsonTVLogo.png";
import "./Videos.css";

/* ---------- scoped styles ---------- */
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
  background: #ffffff; border-color:#e2e8f0; color:#0f172a; min-width: 120px;
}
.videos-page .btn.ghost:hover { background:#f8fafc; }
.videos-page .btn.danger { background:#ef4444; border-color:#ef4444; color:#fff; }
.videos-page .btn.danger:hover { background:#b91c1c; border-color:#b91c1c; color:#fff; }

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

/* ✅ Force action menu font color to black */
.videos-page .menu,
.videos-page .menu * {
  color: #000 !important;
}

.videos-page .menu-item {
  width:100%; text-align:left; padding: 10px 12px; border-radius:8px;
  background:transparent; border:none; cursor:pointer; font-weight:600;
}
.videos-page .menu-item:hover { background:#f1f5f9; }
.videos-page .menu-item.danger { color:#b91c1c !important; }
.videos-page .menu-item.danger:hover { background:#fee2e2; }

.videos-page .card { background:#fff; border:1px solid #e2e8f0; border-radius: 16px; }
.videos-page .table-card { overflow:hidden; }
.videos-page .table { border-collapse: separate; border-spacing: 0; width:100%; table-layout:auto; }
.videos-page .table thead th {
  text-align:left; font-size:12px; letter-spacing:.02em; color:#64748b;
  padding:14px 16px; background:#fafafa; border-bottom:1px solid #e2e8f0; font-weight:700;
}
.videos-page .table tbody td { padding: 14px 16px; border-bottom:1px solid #eef2f6; vertical-align: middle; }

/* Your admin UI is dark, keep titles readable */
.videos-page .row-title { font-weight:800; color:#fff !important; text-decoration:none; }
.videos-page .row-title:hover { text-decoration:underline; }

/* Thumbnail container */
.videos-page .thumb {
  height: 72px;
  border-radius: 10px;
  overflow: hidden;
  flex: 0 0 auto;
  background: linear-gradient(140deg,#0b1320,#1b2436);
  position: relative; border:1px solid rgba(255,255,255,.14);
  line-height: 0;
}
.videos-page .thumb img {
  width: 100% !important;
  height: 100% !important;
  display: block !important;
  object-fit: cover !important;
  object-position: center !important;
}
.videos-page .thumb .dur {
  position:absolute; right:6px; bottom:6px; font-size:11px; font-weight:700;
  background: rgba(15,23,42,.85); color:#fff; padding: 2px 6px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.18); backdrop-filter: blur(2px);
}

/* Default thumbnail (fills the whole container) */
.videos-page .thumb.thumb--default {
  background: radial-gradient(120% 120% at 30% 20%,
    rgba(168,85,247,.35),
    rgba(15,23,42,.95) 55%,
    rgba(2,6,23,1) 100%);
}
.videos-page .thumb.thumb--default .default-logo {
  position:absolute; inset:0;
  display:grid; place-items:center;
  padding: 10px;
}
.videos-page .thumb.thumb--default .default-logo img {
  width: 88%!important;
  height: 88%;
  object-fit: contain!important;
  opacity: .95;
  filter: drop-shadow(0 10px 18px rgba(0,0,0,.35));
}

.videos-page .badge { font-size:11px; font-weight:800; padding:6px 10px; border-radius: 999px; display:inline-block; white-space:nowrap; }
.videos-page .badge-green { background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; }
.videos-page .badge-red { background:#fef2f2; color:#7f1d1d; border:1px solid #fecaca; }

.videos-page .toolbar-grid { padding: 12px; }
.videos-page .toolbar-grid .search { height:40px; border-radius:10px; border:1px solid #e2e8f0; padding:0 12px; }
.videos-page .search-wrap { position:relative; }
.videos-page .search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); opacity:.5; }
.videos-page .search--with-icon { padding-left:32px!important; }

.videos-page .table-footer { padding: 12px 16px; color:#64748b; font-size: 12px; }

/* ✅ Select icons (Status chevron + Sort icon) */
.videos-page select.search {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding-right: 40px !important;
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px 16px;
}
.videos-page select.search.select-status {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M6 8l4 4 4-4' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}
.videos-page select.search.select-sort {
  background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M7 4v12' stroke='%2364748b' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M4.5 6.5L7 4l2.5 2.5' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M13 16V4' stroke='%2364748b' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M10.5 13.5L13 16l2.5-2.5' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\");
}

/* Confirm dialog */
.videos-page .confirm-overlay {
  position: fixed; inset: 0; background: rgba(2,6,23,.45);
  display: grid; place-items: center; z-index: 1000;
}
.videos-page .confirm-modal {
  width: min(440px, 92vw);
  background: #fff; border-radius: 14px; box-shadow: 0 24px 60px rgba(2,6,23,.25);
  border: 1px solid #e2e8f0; padding: 16px;
}
.videos-page .confirm-title { font-weight: 800; font-size: 18px; margin: 4px 0 6px; color:#000!important; }
.videos-page .confirm-msg { color:#475569!important; font-size: 14px; line-height: 1.4; }
.videos-page .confirm-row { display:flex; gap:10px; justify-content:flex-end; margin-top: 16px; }

/* Banner */
.videos-page .banner {
  margin-bottom: 12px; padding: 10px 12px; border-radius: 10px; font-weight: 600;
  display:flex; align-items:center; justify-content:space-between; gap:12px;
}
.videos-page .banner.error { background:#fee2e2; color:#7f1d1d; border:1px solid #fecaca; }
.videos-page .banner .x { cursor:pointer; opacity:.7; }

/* ✅ Toast */
.videos-page .vid-toast {
  position: fixed;
  right: 28px;
  bottom: 28px;
  min-width: 260px;
  max-width: 360px;
  padding: 14px 18px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  z-index: 9999;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
  animation: vid-toast-in 0.25s ease-out;
}
.videos-page .vid-toast.is-success {
  background: linear-gradient(135deg, #16a34a, #22c55e);
  color: #ffffff;
}
.videos-page .vid-toast.is-error {
  background: linear-gradient(135deg, #dc2626, #ef4444);
  color: #ffffff;
}
@keyframes vid-toast-in {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Mobile list */
@media (max-width: 640px) {
  .videos-page .table-card { overflow: visible; }
  .videos-page .table { display: none; }
  .videos-page .mobile-list { display:block; }
}
@media (min-width: 641px) {
  .videos-page .mobile-list { display:none; }
}
.videos-page .mobile-item {
  display:flex; align-items:center; gap:12px; padding:14px 16px;
  border-bottom: 1px solid #eef2f6; position: relative;
}
.videos-page .mobile-item .meta { min-width: 0; flex: 1 1 auto; }
.videos-page .mobile-item .title {
  font-weight:800; color:#fff !important; text-decoration:none; display:block;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.videos-page .mobile-item .sub {
  margin-top:4px; font-size:12px; color:#cbd5e1; display:flex; gap:8px; align-items:center; flex-wrap:wrap;
}
.videos-page .mobile-item .thumb { width: 120px; height: 68px; }

/* ------------------------------
   ✅ Modern loading (spinner + skeleton)
------------------------------ */
.videos-page .vid-loading {
  padding: 18px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #fff;
}
.videos-page .vid-loading-text { font-weight: 700; opacity: .9; }
.videos-page .sk-row {
  display: grid;
  grid-template-columns: 44px 1.3fr 160px 140px 160px 220px 60px;
  gap: 0;
  padding: 12px 0;
}
.videos-page .sk-cell { padding: 14px 16px; border-bottom: 1px solid #eef2f6; }
.videos-page .sk-line {
  height: 12px;
  border-radius: 10px;
  background: linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 100%);
  background-size: 200% 100%;
  animation: brtv-shimmer 1.2s ease-in-out infinite;
}
.videos-page .sk-thumb {
  width: 120px;
  height: 68px;
  border-radius: 10px;
  background: linear-gradient(140deg,#0b1320,#1b2436);
  border:1px solid rgba(255,255,255,.14);
  position: relative;
  overflow: hidden;
}
.videos-page .sk-thumb:before{
  content:"";
  position:absolute; inset:0;
  background: linear-gradient(90deg, rgba(255,255,255,0.00) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.00) 100%);
  background-size: 200% 100%;
  animation: brtv-shimmer 1.2s ease-in-out infinite;
}
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

function pickPublished(item) {
  if (typeof item?.is_published === "boolean") return item.is_published;
  const st = String(item?.status || "").toLowerCase();
  if (st) return st === "published" || st === "live";
  if (item?.published_at || item?.publishedAt || item?.published_on)
    return true;
  return item?.visibility === "public";
}
function pickPublishedAt(item) {
  return item?.published_at || item?.publishedAt || item?.published_on || null;
}

function pickThumbUrl(item) {
  const md = item?.metadata || {};
  return (
    item?.thumbnail_url ||
    item?.thumbnailUrl ||
    item?.thumb_url ||
    item?.poster_url ||
    item?.poster ||
    md?.thumbnail_url ||
    md?.thumbnailUrl ||
    md?.poster_url ||
    md?.poster ||
    ""
  );
}

const API_ORIGIN = (() => {
  try {
    const u = new URL(api.defaults.baseURL || "", window.location.href);
    return u.origin || window.location.origin;
  } catch {
    return window.location.origin;
  }
})();

export function absUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("//")) return window.location.protocol + raw;
  if (raw.startsWith("/")) return API_ORIGIN + raw;
  return API_ORIGIN + "/" + raw.replace(/^\.\//, "");
}

function useIsNarrow(bp = 900) {
  const [narrow, setNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth <= bp : false,
  );
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= bp);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bp]);
  return narrow;
}

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
          <button className="btn-cancel ghost" onClick={onCancel}>
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

/* -----------------------------------------
   Modern loading blocks (no UI break)
----------------------------------------- */
function CircularSpinner({ size = 34, label = "Loading…" }) {
  const ring = Math.max(4, Math.round(size / 10));
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
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
      <div aria-label={label} role="status">
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
    </div>
  );
}

function TableSkeletonDesktop({ rows = 8 }) {
  return (
    <div style={{ padding: 0 }}>
      <div className="sk-row" style={{ borderBottom: "1px solid #e2e8f0" }}>
        <div className="sk-cell">
          <div
            className="sk-line"
            style={{ width: 18, height: 18, borderRadius: 4 }}
          />
        </div>
        <div className="sk-cell">
          <div className="sk-line" style={{ width: 120 }} />
        </div>
        <div className="sk-cell">
          <div className="sk-line" style={{ width: 90 }} />
        </div>
        <div className="sk-cell">
          <div className="sk-line" style={{ width: 70 }} />
        </div>
        <div className="sk-cell">
          <div className="sk-line" style={{ width: 90 }} />
        </div>
        <div className="sk-cell">
          <div className="sk-line" style={{ width: 120 }} />
        </div>
        <div className="sk-cell">
          <div className="sk-line" style={{ width: 18 }} />
        </div>
      </div>

      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="sk-row">
          <div className="sk-cell">
            <div
              className="sk-line"
              style={{ width: 18, height: 18, borderRadius: 4 }}
            />
          </div>
          <div
            className="sk-cell"
            style={{ display: "flex", gap: 12, alignItems: "center" }}
          >
            <div className="sk-thumb" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                className="sk-line"
                style={{ width: `${70 + (i % 3) * 8}%` }}
              />
              <div style={{ height: 8 }} />
              <div
                className="sk-line"
                style={{
                  width: `${45 + (i % 4) * 10}%`,
                  height: 10,
                  opacity: 0.9,
                }}
              />
            </div>
          </div>
          <div className="sk-cell">
            <div className="sk-line" style={{ width: 90 }} />
          </div>
          <div className="sk-cell">
            <div className="sk-line" style={{ width: 70 }} />
          </div>
          <div className="sk-cell">
            <div className="sk-line" style={{ width: 90 }} />
          </div>
          <div className="sk-cell">
            <div className="sk-line" style={{ width: 120 }} />
          </div>
          <div className="sk-cell">
            <div className="sk-line" style={{ width: 18 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileSkeleton({ rows = 6 }) {
  return (
    <div style={{ padding: 0 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="mobile-item" aria-busy="true">
          <div
            className="sk-line"
            style={{ width: 18, height: 18, borderRadius: 4 }}
          />
          <div className="sk-thumb" />
          <div className="meta" style={{ width: "100%" }}>
            <div
              className="sk-line"
              style={{ width: `${70 + (i % 3) * 8}%` }}
            />
            <div style={{ height: 8 }} />
            <div
              className="sk-line"
              style={{ width: `${55 + (i % 4) * 8}%`, height: 10 }}
            />
          </div>
          <div
            className="sk-line"
            style={{ width: 18, height: 18, borderRadius: 6 }}
          />
        </div>
      ))}
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

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = (type, text, ms = 2200) => {
    setToast({ type, text });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), ms);
  };
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const [thumbErrors, setThumbErrors] = useState({});

  // ✅ Selection / bulk actions
  const [selected, setSelected] = useState(() => new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

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
          (v.description || "").toLowerCase().includes(query),
      );
    }

    if (statusFilter === "published")
      list = list.filter((v) => pickPublished(v));
    if (statusFilter === "unpublished")
      list = list.filter((v) => !pickPublished(v));

    if (sortBy === "newest") {
      list.sort(
        (a, b) =>
          // new Date(b.created_at || b.created || 0) -
          // new Date(a.created_at || a.created || 0)
          new Date(pickPublishedAt(b) || b.created_at || b.created || 0) -
          new Date(pickPublishedAt(a) || a.created_at || a.created || 0),
      );
    } else if (sortBy === "oldest") {
      list.sort(
        (a, b) =>
          // new Date(a.created_at || a.created || 0) -
          // new Date(b.created_at || b.created || 0)
          new Date(pickPublishedAt(a) || a.created_at || a.created || 0) -
          new Date(pickPublishedAt(b) || b.created_at || b.created || 0),
      );
    } else if (sortBy === "title") {
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
    return list;
  }, [items, q, statusFilter, sortBy]);

  useEffect(() => {
    const ids = new Set(items.map((x) => String(x.id)));
    setSelected((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (ids.has(String(id))) next.add(String(id));
      });
      return next;
    });
  }, [items]);

  const visibleIds = useMemo(
    () => filteredSorted.map((v) => String(v.id)),
    [filteredSorted],
  );

  const allVisibleSelected = useMemo(() => {
    if (visibleIds.length === 0) return false;
    for (const id of visibleIds) if (!selected.has(String(id))) return false;
    return true;
  }, [visibleIds, selected]);

  const someVisibleSelected = useMemo(() => {
    for (const id of visibleIds) if (selected.has(String(id))) return true;
    return false;
  }, [visibleIds, selected]);

  const selectedCount = selected.size;

  const toggleSelectOne = (id) => {
    const key = String(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(String(id)));
      } else {
        visibleIds.forEach((id) => next.add(String(id)));
      }
      return next;
    });
  };

  async function doBulk(action) {
    const ids = Array.from(selected);
    if (!ids.length) {
      showToast("error", "Select at least 1 video.");
      return;
    }

    const run = async () => {
      setBulkBusy(true);
      setBanner(null);
      try {
        const ops =
          action === "publish"
            ? ids.map((id) => api.post(`/videos/${id}/publish`))
            : action === "unpublish"
              ? ids.map((id) => api.post(`/videos/${id}/unpublish`))
              : ids.map((id) => api.delete(`/videos/${id}`));

        const results = await Promise.allSettled(ops);
        const ok = results.filter((r) => r.status === "fulfilled").length;
        const bad = results.length - ok;

        await load();

        setSelected(new Set());

        if (action === "publish")
          showToast("success", `Published ${ok} video(s).`);
        if (action === "unpublish")
          showToast("success", `Unpublished ${ok} video(s).`);
        if (action === "delete")
          showToast("success", `Deleted ${ok} video(s).`);

        if (bad) {
          showToast("error", `${bad} item(s) failed. Check console.`);
          console.warn("Bulk action failures:", results);
        }
      } catch (e) {
        console.error("bulk error:", e);
        showToast("error", e?.response?.data?.message || "Bulk action failed.");
      } finally {
        setBulkBusy(false);
      }
    };

    if (action === "delete") {
      setConfirm({
        open: true,
        title: `Delete ${ids.length} video(s)?`,
        message: `These videos will be permanently deleted. This cannot be undone.`,
        danger: true,
        confirmText: "Delete",
        onConfirm: async () => {
          setConfirm((c) => ({ ...c, open: false }));
          await run();
        },
      });
      return;
    }

    await run();
  }

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
          showToast("success", "Video deleted.");
        } catch (err) {
          console.error("delete error:", err);
          showToast("error", err?.response?.data?.message || "Delete failed");
          setBanner({
            type: "error",
            text: err?.response?.data?.message || "Delete failed",
          });
        }
      },
    });
  }

  async function rowPublish(video, makePublished) {
    setRowMenu(null);
    try {
      if (makePublished) await api.post(`/videos/${video.id}/publish`);
      else await api.post(`/videos/${video.id}/unpublish`);
      await load();
      showToast(
        "success",
        makePublished ? "Video published." : "Video unpublished.",
      );
    } catch (e) {
      console.error("publish/unpublish error:", e);
      showToast("error", e?.response?.data?.message || "Action failed.");
    }
  }

  const DefaultThumbCard = ({ durSec }) => (
    <div className="thumb thumb--default" aria-hidden="true">
      <div className="default-logo">
        <img src={DefaultThumb} alt="" />
      </div>
      {durSec ? <span className="dur">{formatDuration(durSec)}</span> : null}
    </div>
  );

  return (
    <div className="videos-page">
      <style dangerouslySetInnerHTML={{ __html: injectedStyles }} />

      {toast && (
        <div
          className={`vid-toast ${
            toast.type === "success" ? "is-success" : "is-error"
          }`}
        >
          {toast.text}
        </div>
      )}

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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{ margin: 0, fontWeight: 800, fontSize: 28 }}
          className="video-main-title"
        >
          Videos
        </h2>

        <div
          style={{
            marginLeft: "auto",
            position: "relative",
            display: "flex",
            gap: 10,
          }}
        >
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

              <Link
                className="menu-item"
                to="/admin/content/collections"
                onClick={() => setMoreOpen(false)}
              >
                Manage playlists
              </Link>
            </div>
          )}

          <button className="btn primary" onClick={() => setUploadOpen(true)}>
            ⬆️ Upload videos
          </button>
        </div>
      </div>

      <div className="" style={{ marginBottom: 16 }}>
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
            className="search select-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Status</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>

          <select
            className="search select-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="title">Sort: Title A–Z</option>
          </select>
        </div>
      </div>

      <div className="table-card">
        {/* ✅ Bulk Actions BAR (moved to top of table area) */}
        <div className="bulkbar">
          <div className="bulkbar-left">
            <div className="bulkbar-title">
              Bulk actions {selectedCount ? `(${selectedCount} selected)` : ""}
            </div>
            <div className="bulkbar-tip">
              Tip: select rows using the checkboxes.
            </div>
          </div>

          <div className="bulkbar-right">
            <select
              className="bulkbar-select"
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              disabled={bulkBusy}
            >
              <option value="">Choose…</option>
              <option value="publish">Publish</option>
              <option value="unpublish">Unpublish</option>
              <option value="delete">Delete</option>
            </select>

            <button
              className="btn ghost apply"
              style={{ height: 36, minWidth: 90 }}
              disabled={!bulkAction || selectedCount === 0 || bulkBusy}
              onClick={async () => {
                await doBulk(bulkAction);
                setBulkAction("");
              }}
            >
              {bulkBusy ? "Working…" : "Apply"}
            </button>

            <button
              className="btn secondary"
              style={{ height: 36, minWidth: 110 }}
              disabled={selectedCount === 0 || bulkBusy}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        </div>

        {/* ✅ Modern loading in table area (desktop + mobile) */}
        {!isMobile &&
          (loading ? (
            <div style={{ padding: 0 }}>
              <div className="vid-loading">
                <CircularSpinner size={34} label="Loading videos…" />
                <div className="vid-loading-text">Loading videos…</div>
              </div>
              <TableSkeletonDesktop rows={8} />
            </div>
          ) : filteredSorted.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                color: "#fff!important",
              }}
            >
              No videos yet.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el)
                          el.indeterminate =
                            !allVisibleSelected && someVisibleSelected;
                      }}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all"
                    />
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
                  const raw = pickThumbUrl(v);
                  const thumb = absUrl(raw);
                  const durSec = pickDurationSeconds(v);
                  const editHref = editHrefFor(v.id);
                  const showDefault = !thumb || !!thumbErrors[v.id];

                  return (
                    <tr key={v.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(String(v.id))}
                          onChange={() => toggleSelectOne(v.id)}
                          aria-label={`Select ${title}`}
                        />
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
                          {showDefault ? (
                            <DefaultThumbCard durSec={durSec} />
                          ) : (
                            <div className="thumb" aria-hidden="true">
                              <img
                                src={thumb}
                                alt=""
                                loading="lazy"
                                onError={() =>
                                  setThumbErrors((prev) => ({
                                    ...prev,
                                    [v.id]: true,
                                  }))
                                }
                              />
                              {durSec ? (
                                <span className="dur">
                                  {formatDuration(durSec)}
                                </span>
                              ) : null}
                            </div>
                          )}

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

                      <td style={{ whiteSpace: "nowrap" }}>
                        {pickCategoryName(v, catMap)}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {pickPriceLabel(v)}
                      </td>
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
                              onClick={() => rowPublish(v, true)}
                            >
                              Publish
                            </button>
                            <button
                              className="menu-item"
                              onClick={() => rowPublish(v, false)}
                            >
                              Unpublish
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
              <div style={{ padding: 0 }}>
                <div className="vid-loading">
                  <CircularSpinner size={34} label="Loading videos…" />
                  <div className="vid-loading-text">Loading videos…</div>
                </div>
                <MobileSkeleton rows={6} />
              </div>
            ) : filteredSorted.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#fff" }}>
                No videos yet.
              </div>
            ) : (
              filteredSorted.map((v) => {
                const title = v.title || "Untitled";
                const raw = pickThumbUrl(v);
                const thumb = absUrl(raw);
                const durSec = pickDurationSeconds(v);
                const editHref = editHrefFor(v.id);
                const showDefault = !thumb || !!thumbErrors[v.id];

                return (
                  <div key={v.id} className="mobile-item">
                    <input
                      type="checkbox"
                      checked={selected.has(String(v.id))}
                      onChange={() => toggleSelectOne(v.id)}
                      aria-label={`Select ${title}`}
                    />

                    {showDefault ? (
                      <div className="thumb thumb--default" aria-hidden="true">
                        <div className="default-logo">
                          <img src={DefaultThumb} alt="" />
                        </div>
                        {durSec ? (
                          <span className="dur">{formatDuration(durSec)}</span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="thumb" aria-hidden="true">
                        <img
                          src={thumb}
                          alt=""
                          loading="lazy"
                          onError={() =>
                            setThumbErrors((prev) => ({
                              ...prev,
                              [v.id]: true,
                            }))
                          }
                        />
                        {durSec ? (
                          <span className="dur">{formatDuration(durSec)}</span>
                        ) : null}
                      </div>
                    )}

                    <div className="meta">
                      <Link to={editHref} className="title">
                        {title}
                      </Link>
                      <div className="sub">
                        <StatusBadge video={v} />
                        <span>• {pickCategoryName(v, catMap)}</span>
                        <span>• {pickPriceLabel(v)}</span>
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
                            onClick={() => rowPublish(v, true)}
                          >
                            Publish
                          </button>
                          <button
                            className="menu-item"
                            onClick={() => rowPublish(v, false)}
                          >
                            Unpublish
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

        <div className="table-footer">
          Displaying {filteredSorted.length} • Selected {selectedCount}
        </div>
      </div>

      <UploadVideosModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onDone={load}
      />
    </div>
  );
}
