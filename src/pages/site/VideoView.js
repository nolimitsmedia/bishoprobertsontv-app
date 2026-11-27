// src/pages/site/VideoView.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../../api";
import { MyListButton } from "../../components/viewer/ViewerParts";
import { fmtTime } from "../../components/viewer/viewerStore";
import "./VideoView.css";
// Play button in the ministry's brand color (no thumbnail).
import { DEFAULT_THUMB as DefaultThumb } from "../../lib/brand";
import { SeriesWatchBar } from "../public/SeriesPages";

const MAX_VISIBLE_COMMENTS = 6;
const isLocalhost = ["localhost", "127.0.0.1"].includes(
  window.location.hostname,
);
const log = (...args) => {
  if (isLocalhost) console.log("[VideoView]", ...args);
};

const VIDEO_VIEW_CACHE_TTL_MS = 60 * 1000;
const videoViewMemoryCache = new Map();

function readVideoViewCache(key) {
  const hit = videoViewMemoryCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.savedAt > VIDEO_VIEW_CACHE_TTL_MS) {
    videoViewMemoryCache.delete(key);
    return null;
  }
  return hit.data;
}

function writeVideoViewCache(key, data) {
  videoViewMemoryCache.set(key, { savedAt: Date.now(), data });
}

/* ---------------- resume / progress helpers ---------------- */
const PROGRESS_SAVE_MS = 3000;
const IFRAME_PROGRESS_SAVE_MS = 10000;

function progressKey(videoId) {
  return `vv_progress_${videoId}`;
}
function readProgressSeconds(videoId) {
  try {
    const raw = localStorage.getItem(progressKey(videoId));
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}
function writeProgressSeconds(videoId, seconds) {
  try {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    if (s > 0) localStorage.setItem(progressKey(videoId), String(s));
  } catch {}
}
function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

function readResumeSecondsFromSearch(search) {
  try {
    const qs = new URLSearchParams(search || "");
    const raw = qs.get("t") || qs.get("start") || qs.get("resume");
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function addOrReplaceQueryParam(url, key, value) {
  try {
    const s = String(url || "");
    if (!s) return s;
    const [path, hash = ""] = s.split("#");
    const [base, query = ""] = path.split("?");
    const qs = new URLSearchParams(query);
    qs.set(key, String(value));
    const out = `${base}?${qs.toString()}`;
    return hash ? `${out}#${hash}` : out;
  } catch {
    const hasQuery = String(url || "").includes("?");
    return `${url}${hasQuery ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
  }
}

/* ---------------- utils ---------------- */
function apiOrigin() {
  try {
    const u = new URL(api.defaults.baseURL || "", window.location.href);
    return u.origin;
  } catch {
    return window.location.origin;
  }
}
function absUrl(u) {
  if (!u) return "";
  if (/^(https?:|blob:|data:)/i.test(u)) return u;
  const base = apiOrigin();
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}
function isHlsUrl(u) {
  if (!u) return false;
  const clean = u.split("?")[0].split("#")[0];
  return /\.m3u8$/i.test(clean) || clean.includes(".m3u8");
}

function isBunnyStreamHost(url = "") {
  try {
    const host = new URL(String(url || "")).hostname.toLowerCase();
    return (
      /^vz-\d+\.b-cdn\.net$/i.test(host) ||
      host === "iframe.mediadelivery.net" ||
      host.endsWith(".mediadelivery.net")
    );
  } catch {
    return false;
  }
}

function getBunnyVideoId(video) {
  return (
    video?.bunny_video_id ||
    video?.bunny_stream_id ||
    video?.provider_key ||
    video?.stream_video_id ||
    video?.metadata?.bunny_video_id ||
    video?.metadata?.bunny_stream_id ||
    video?.metadata?.provider_key ||
    ""
  );
}

function getBunnyLibraryId(video) {
  return (
    video?.bunny_library_id ||
    video?.library_id ||
    video?.metadata?.bunny_library_id ||
    video?.metadata?.library_id ||
    ""
  );
}

function getBunnyEmbedUrlRaw(video) {
  return String(
    video?.embed_url ||
      video?.bunny_embed_url ||
      video?.metadata?.embed_url ||
      video?.metadata?.bunny_embed_url ||
      "",
  ).trim();
}

function isBunnyStreamVideo(video) {
  if (!video) return false;

  const provider = String(video?.provider || video?.source_type || "")
    .trim()
    .toLowerCase();

  return (
    provider === "bunny_stream" ||
    !!getBunnyVideoId(video) ||
    !!getBunnyLibraryId(video) ||
    !!getBunnyEmbedUrlRaw(video) ||
    isBunnyStreamHost(video?.playback_url || "") ||
    isBunnyStreamHost(video?.video_url || "") ||
    isBunnyStreamHost(video?.hls_url || "")
  );
}

// iPhone / iPad. Every browser there (Safari, Chrome, Firefox...) runs Apple's
// engine, so they all follow Apple's sound rules.
function isAppleTouchDevice() {
  try {
    const ua = navigator.userAgent || "";
    return (
      /iP(hone|ad|od)/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  } catch {
    return false;
  }
}
// Apple's engine anywhere: iPhone/iPad, plus Safari on a Mac.
function isAppleSafari() {
  try {
    const ua = navigator.userAgent || "";
    return (
      isAppleTouchDevice() ||
      (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Android|Edg/.test(ua))
    );
  } catch {
    return false;
  }
}

// Sound on iPhone/iPad: Apple only lets a video play WITH sound after a tap
// INSIDE the player (a tap on our page cannot unmute Bunny's player). So there
// the video does not start silently by itself: it waits, ready, and one tap on
// the player's play button starts it WITH sound.
// Set to true to go back to silent (muted) autoplay on iPhone/iPad.
const IPHONE_MUTED_AUTOPLAY = false;

function shouldAutoplayHere() {
  return IPHONE_MUTED_AUTOPLAY || !isAppleTouchDevice();
}

// Autoplay with sound: Chrome (Android and computers) allows it once the
// visitor has tapped/clicked anything on the site during this visit — e.g. the
// video's thumbnail. Opened straight from a link (nothing tapped yet), or on
// Safari, the video has to start muted ("Tap for sound" then turns it on).
function shouldStartMuted() {
  try {
    if (isAppleSafari()) return true;
    const activated = navigator.userActivation
      ? navigator.userActivation.hasBeenActive
      : true;
    return !activated;
  } catch {
    return false;
  }
}

function buildBunnyEmbedUrl(video, startSeconds = 0, shouldAutoplay = true) {
  const raw = getBunnyEmbedUrlRaw(video);
  const videoId = getBunnyVideoId(video);
  const libraryId = getBunnyLibraryId(video);

  let url = raw;
  if (!url && libraryId && videoId) {
    url = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
  }
  if (!url) return "";

  try {
    const u = new URL(url);

    // Logged-in Bunny Stream videos should start consistently.
    // The preview iframe uses buildPreviewBunnyEmbedUrl(), so this does not
    // affect logged-out preview gating.
    // Android/computers: starts by itself, WITH sound when the browser allows
    // it (see shouldStartMuted), otherwise muted + "Tap for sound".
    // iPhone/iPad: waits for one tap on the player's play button → sound.
    const autoplay = shouldAutoplay && shouldAutoplayHere();
    u.searchParams.set("autoplay", autoplay ? "true" : "false");
    if (autoplay && shouldStartMuted()) u.searchParams.set("muted", "true");
    else u.searchParams.delete("muted");
    if (!u.searchParams.has("preload")) u.searchParams.set("preload", "true");
    if (!u.searchParams.has("responsive"))
      u.searchParams.set("responsive", "true");

    // Bunny Stream supports the `t` parameter for iframe start time.
    // This lets a logged-in user resume where the logged-out preview ended
    // or where database watch progress says they left off.
    const t = Math.floor(Number(startSeconds) || 0);
    if (t > 0) {
      u.searchParams.set("t", String(t));
    } else {
      u.searchParams.delete("t");
    }

    return u.toString();
  } catch {
    return url;
  }
}
function buildPreviewBunnyEmbedUrl(video) {
  const raw = String(
    video?.preview_embed_url ||
      video?.preview_bunny_embed_url ||
      video?.metadata?.preview_embed_url ||
      "",
  ).trim();
  const videoId =
    video?.preview_bunny_video_id || video?.metadata?.preview_bunny_video_id;
  const libraryId = getBunnyLibraryId(video);

  let url = raw;
  if (!url && libraryId && videoId) {
    url = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
  }
  if (!url) return "";

  try {
    const u = new URL(url);
    const autoplay = shouldAutoplayHere();
    if (!autoplay) u.searchParams.set("autoplay", "false");
    else if (!u.searchParams.has("autoplay"))
      u.searchParams.set("autoplay", "true");
    if (autoplay && shouldStartMuted()) u.searchParams.set("muted", "true");
    else u.searchParams.delete("muted");
    if (!u.searchParams.has("preload")) u.searchParams.set("preload", "true");
    if (!u.searchParams.has("responsive"))
      u.searchParams.set("responsive", "true");
    return u.toString();
  } catch {
    return url;
  }
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
function formatDuration(secs) {
  const s = Math.max(0, Number(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const two = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(ss)}` : `${m}:${two(ss)}`;
}
function datePretty(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
async function tryGetFirst(urls) {
  for (const u of urls) {
    try {
      const r = await api.get(u);
      return r.data;
    } catch (e) {
      const code = e?.response?.status;
      if ([401, 403, 404].includes(code)) continue;
      continue;
    }
  }
  return null;
}

/* ---------------- auth helpers ---------------- */
function getAnyToken() {
  try {
    return (
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      localStorage.getItem("admin_token") ||
      sessionStorage.getItem("admin_token") ||
      localStorage.getItem("member_token") ||
      sessionStorage.getItem("member_token") ||
      null
    );
  } catch {
    return null;
  }
}

/* ---------------- analytics helpers ---------------- */
function safeInt(n, min = 0, max = 24 * 60 * 60) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const xi = Math.floor(x);
  return Math.max(min, Math.min(max, xi));
}
function beaconAnalyticsEvent(url, payload) {
  try {
    if (!navigator.sendBeacon) return false;
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    return navigator.sendBeacon(url, blob);
  } catch {
    return false;
  }
}
async function sendAnalyticsEventFetch(payload, { timeoutMs = 8000 } = {}) {
  const url = `${apiOrigin()}/api/analytics/event`;
  const token = getAnyToken();

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
      keepalive: true,
    });

    if (isLocalhost) log("analytics:", payload.event_type, res.status);
    return res.ok;
  } catch (e) {
    if (isLocalhost) {
      const msg =
        e?.name === "AbortError" ? `timeout after ${timeoutMs}ms` : e?.message;
      console.warn("[VideoView] analytics failed:", payload?.event_type, msg);
    }
    return false;
  } finally {
    clearTimeout(t);
  }
}

/* ---------------- date sorting helpers (published -> created fallback) ---------------- */
function getPublishedMs(v) {
  const cand = [
    v?.published_at,
    v?.publish_date,
    v?.published_date,
    v?.public_published_at,
    v?.metadata?.published_at,
    v?.metadata?.publish_date,
    v?.metadata?.published_date,
    v?.created_at,
    v?.created,
  ].filter(Boolean)[0];

  const ms = cand ? new Date(cand).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}
function sortLatestToOldestByPublished(a, b) {
  return getPublishedMs(b) - getPublishedMs(a);
}

/* ---------------- thumb component (fallback like Catalog) ---------------- */
function ThumbImg({ src, alt = "" }) {
  const [bad, setBad] = useState(false);
  const finalSrc = !src || bad ? DefaultThumb : src;

  return (
    <img
      src={finalSrc}
      alt={alt}
      loading="lazy"
      onError={() => setBad(true)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: src && !bad ? "cover" : "contain",
        padding: src && !bad ? 0 : 10,
      }}
    />
  );
}

/* ---------------- youtube-like loading skeleton ---------------- */
function SkeletonBox({ className = "", style = {} }) {
  return <div className={`vv-skel ${className}`} style={style} />;
}
function VideoViewSkeleton() {
  return (
    <div className="vv">
      <div className="vv-wrap">
        <div className="vv-grid">
          <div>
            <div className="vv-card">
              <div className="vv-skel-video">
                <SkeletonBox style={{ width: "100%", height: "100%" }} />
              </div>
              <div className="vv-pad">
                <div className="vv-row" style={{ marginBottom: 10 }}>
                  <SkeletonBox
                    style={{ width: 86, height: 36, borderRadius: 10 }}
                  />
                  <SkeletonBox
                    style={{ width: 140, height: 36, borderRadius: 10 }}
                  />
                  <SkeletonBox
                    style={{ width: 96, height: 36, borderRadius: 10 }}
                  />
                </div>
                <SkeletonBox
                  style={{
                    width: "78%",
                    height: 22,
                    borderRadius: 8,
                    margin: "10px 0",
                  }}
                />
                <SkeletonBox
                  style={{
                    width: "36%",
                    height: 14,
                    borderRadius: 8,
                    marginBottom: 14,
                  }}
                />
                <SkeletonBox
                  style={{ width: "100%", height: 120, borderRadius: 12 }}
                />
              </div>
            </div>
          </div>

          <aside>
            <div className="vv-side-card">
              <div className="vv-side-title">Up next</div>
              <div className="vv-rel">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="vv-rel-item">
                    <div className="vv-thumb">
                      <SkeletonBox style={{ width: "100%", height: "100%" }} />
                    </div>
                    <div className="vv-rel-meta" style={{ flex: 1 }}>
                      <SkeletonBox
                        style={{
                          width: "90%",
                          height: 14,
                          borderRadius: 8,
                          marginBottom: 8,
                        }}
                      />
                      <SkeletonBox
                        style={{ width: "60%", height: 12, borderRadius: 8 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function VideoView() {
  const { id } = useParams();
  const nav = useNavigate();
  const loc = useLocation();

  const search = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const playlistParam = search.get("playlist");
  const inPlaylistMode = !!playlistParam;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [video, setVideo] = useState(null);
  const [, setResources] = useState([]);

  const [categoryVideos, setCategoryVideos] = useState([]);
  const [moreGlobal, setMoreGlobal] = useState([]);

  const [playlistMeta, setPlaylistMeta] = useState(null);
  const [playlistRest, setPlaylistRest] = useState([]);

  const [isAuthed, setIsAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [previewHit, setPreviewHit] = useState(false);
  const [ctaHidden, setCtaHidden] = useState(false); // × on the "Free preview" bar
  const [soundOn, setSoundOn] = useState(false); // muted autoplay → sound turned on
  const playerSendRef = useRef(null); // send a player.js command to the Bunny player
  const [needsUnmute, setNeedsUnmute] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false); // iPhone refused
  const unmuteAtRef = useRef(0);
  // The player itself fell back to muted (browser refused sound) → show button.
  const [playerMuted, setPlayerMuted] = useState(false);
  // iPhone: video waits for a tap on the player's play button.
  const [playStarted, setPlayStarted] = useState(false);
  const [resumedHere, setResumedHere] = useState(false);
  const [dbProgressSeconds, setDbProgressSeconds] = useState(0);
  const [iframeStartSeconds, setIframeStartSeconds] = useState(0);

  const [showPL, setShowPL] = useState(false);
  const [myPlaylists, setMyPlaylists] = useState([]);
  const [memberOf, setMemberOf] = useState(new Set());
  const [plLoading, setPlLoading] = useState(false);

  const [comments, setComments] = useState([]);
  const [cmtTxt, setCmtTxt] = useState("");
  const [cmtLoading, setCmtLoading] = useState(false);
  const [cmtErr, setCmtErr] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);

  const [videoErr, setVideoErr] = useState(false);
  const [playerKey, setPlayerKey] = useState(0); // "Try again" reloads the player

  function unmuteNativeVideo() {
    const el = videoRef.current;
    if (!el) return;

    try {
      el.muted = false;
      el.defaultMuted = false;
      el.volume = 1;
      setNeedsUnmute(false);

      const p = el.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // If the browser still blocks playback, keep the button visible.
          setNeedsUnmute(true);
        });
      }
    } catch {
      setNeedsUnmute(true);
    }
  }

  // youtube-like autoplay controls
  const [autoNextOn, setAutoNextOn] = useState(() => {
    try {
      const raw = localStorage.getItem("vv_autonext");
      return raw == null ? true : raw === "true";
    } catch {
      return true;
    }
  });
  const [upNextCountdown, setUpNextCountdown] = useState(0);
  const autoNavRef = useRef(false);
  const countdownRef = useRef(null);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // resume/progress refs
  const lastWatchSecondsRef = useRef(0);
  const lastSavedAtRef = useRef(0);
  const restoredRef = useRef(false);
  const iframeStartLockedVideoRef = useRef("");
  const iframeEstimatedSecondsRef = useRef(0);
  // Release 2.0 Part B: real Bunny player events (player.js)
  const bunnyIframeRef = useRef(null);
  const playerReportsRef = useRef(false); // true once the player sends real times
  const playerDurationRef = useRef(0);
  const [upNextTarget, setUpNextTarget] = useState(null); // { url, title, thumbnail }
  const iframeLastTickRef = useRef(0);
  const iframeLastSavedAtRef = useRef(0);

  // build next path (preserves playlist param etc.)
  const watchPath = useMemo(
    () => loc.pathname + loc.search,
    [loc.pathname, loc.search],
  );
  const loginBase = useMemo(() => {
    const next = encodeURIComponent(watchPath || `/watch/${id}`);
    return `/login?next=${next}`;
  }, [watchPath, id]);

  const hasUrlResume = useMemo(
    () => readResumeSecondsFromSearch(loc.search) > 0,
    [loc.search],
  );

  const shouldUseSavedResume = useMemo(() => {
    // Rules:
    // 1) Overlay login resume uses ?t=seconds.
    // 2) Refresh/back-forward can resume saved DB/local progress.
    // 3) Normal logged-in open/click starts from 0:00.
    if (hasUrlResume) return true;

    try {
      const navEntry = performance.getEntriesByType?.("navigation")?.[0];
      const navType = navEntry?.type || "";
      return navType === "reload" || navType === "back_forward";
    } catch {
      return false;
    }
  }, [hasUrlResume]);

  function currentSecondsNow() {
    const el = videoRef.current;
    if (!el) return Math.floor(lastWatchSecondsRef.current || 0);
    const cur = Number(el.currentTime || 0);
    if (Number.isFinite(cur) && cur > 0) return Math.floor(cur);
    return Math.floor(lastWatchSecondsRef.current || 0);
  }

  function goLoginWithResume() {
    // Native HLS can read currentTime directly, so resume works for logged-out preview.
    // Use the current time if available, otherwise fall back to the preview limit
    // or the last saved local progress. This prevents returning to 00:00 after login.
    let t = currentSecondsNow();
    if (!(t > 0) && previewSeconds > 0) t = Math.max(0, previewSeconds - 1);
    if (!(t > 0)) t = readProgressSeconds(id);

    const safeT = Math.max(0, Math.floor(Number(t) || 0));
    if (safeT > 0) writeProgressSeconds(id, safeT);

    const loginUrl =
      safeT > 0 ? addOrReplaceQueryParam(loginBase, "t", safeT) : loginBase;
    nav(loginUrl);
  }

  async function loadWatchProgress() {
    if (!isAuthed || !id) {
      setDbProgressSeconds(0);
      return 0;
    }

    try {
      const r = await api.get(`/videos/${id}/progress`);
      const s = Math.max(
        0,
        Math.floor(Number(r?.data?.position_seconds || 0) || 0),
      );
      setDbProgressSeconds(s);
      if (s > 0) writeProgressSeconds(id, s);
      return s;
    } catch (e) {
      if (isLocalhost) log("watch progress load failed", e?.response?.status);
      setDbProgressSeconds(0);
      return 0;
    } finally {
    }
  }

  async function saveWatchProgress(
    seconds,
    durationSeconds = null,
    completed = false,
  ) {
    if (!isAuthed || !id) return false;

    const position = Math.max(0, Math.floor(Number(seconds) || 0));
    if (!(position > 0)) return false;

    try {
      writeProgressSeconds(id, position);
      await api.post(`/videos/${id}/progress`, {
        position_seconds: position,
        duration_seconds:
          durationSeconds == null || !Number.isFinite(Number(durationSeconds))
            ? null
            : Math.max(0, Math.floor(Number(durationSeconds))),
        completed: !!completed,
      });
      return true;
    } catch (e) {
      if (isLocalhost) log("watch progress save failed", e?.response?.status);
      return false;
    }
  }

  // the progress listener below always calls the latest version
  const saveWatchProgressRef = useRef(saveWatchProgress);
  saveWatchProgressRef.current = saveWatchProgress;

  const srcUrl = useMemo(() => {
    const candidate =
      video?.playback_url ||
      video?.video_url ||
      video?.hls_url ||
      video?.embed_url ||
      "";
    return candidate ? absUrl(candidate) : "";
  }, [video?.playback_url, video?.video_url, video?.hls_url, video?.embed_url]);

  const bunnyEmbedUrl = useMemo(
    () => buildBunnyEmbedUrl(video, isAuthed ? iframeStartSeconds : 0, true), // autoplay for everyone
    [video, isAuthed, iframeStartSeconds],
  );
  const previewBunnyEmbedUrl = useMemo(
    () => buildPreviewBunnyEmbedUrl(video),
    [video],
  );

  const isBunnyStream = useMemo(() => isBunnyStreamVideo(video), [video]);
  // Signed-out: a dedicated preview clip if there is one; otherwise (DRM fix) the
  // full video in the Bunny player, stopped at the preview length below.
  const activeBunnyEmbedUrl = useMemo(() => {
    if (!isBunnyStream) return "";
    if (isAuthed) return bunnyEmbedUrl;
    return previewBunnyEmbedUrl || bunnyEmbedUrl;
  }, [isBunnyStream, isAuthed, bunnyEmbedUrl, previewBunnyEmbedUrl]);

  // main poster fallback
  const poster = useMemo(() => {
    const t =
      video?.thumbnail_url ||
      video?.metadata?.thumbnail_url ||
      video?.metadata?.thumbnail_vertical_url ||
      video?.thumbnail ||
      "";
    const p = t ? absUrl(t) : "";
    return p || DefaultThumb;
  }, [video?.thumbnail_url, video?.metadata, video?.thumbnail]);

  const previewSeconds = useMemo(() => {
    const candidates = [
      video?.free_preview_seconds,
      video?.preview_seconds,
      video?.metadata?.free_preview_seconds,
      video?.metadata?.preview_seconds,
    ];
    for (const c of candidates) {
      const n = Number(c);
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }
    return 0;
  }, [video]);

  const requiresLoginForPlayback =
    !isAuthed && (video?.requires_login || video?.is_premium !== false);
  const previewActive = requiresLoginForPlayback && previewSeconds > 0;
  // Release 2.3: a real preview clip (Bunny) is itself the preview.
  const clipPreview = !isAuthed && previewActive && !!previewBunnyEmbedUrl;
  const hardLoginGate =
    requiresLoginForPlayback &&
    (!srcUrl || !(previewSeconds > 0)) &&
    !clipPreview;

  // const useBunnyStreamPlayer = useMemo(() => {
  //   return false;
  // }, []);
  // MediaCage DRM: Bunny videos only play in Bunny's player, so signed-out
  // previews use it too (the server can't build an HLS preview of DRM videos).
  const limitBunnyPreview =
    !isAuthed && isBunnyStream && previewActive && !previewBunnyEmbedUrl;
  const useBunnyStreamPlayer = useMemo(() => {
    return (
      (isAuthed || previewActive) && isBunnyStream && !!activeBunnyEmbedUrl
    );
  }, [isAuthed, previewActive, isBunnyStream, activeBunnyEmbedUrl]);
  const previewLimitRef = useRef({ on: false, seconds: 0, clip: false });
  previewLimitRef.current = {
    on: limitBunnyPreview,
    seconds: previewSeconds,
    clip: clipPreview,
  };

  /* ------------ analytics state (refs) -------------- */
  const playSentRef = useRef(false);
  const completeSentRef = useRef(false);
  const lastPingAtRef = useRef(0);

  const lastPosRef = useRef(null);
  const analyticsInFlightRef = useRef(false);
  const endedHandledRef = useRef(false);

  // --- NEW: ensure previous video is paused/unloaded and HLS destroyed
  // This prevents audio from the previous video continuing to play after navigation.
  useEffect(() => {
    // cleanup runs before effect for new id (and on unmount). It must read the
    // ref WHEN IT RUNS: the <video> may not exist yet when this effect starts.
    const ref = videoRef;
    return () => {
      try {
        const prevEl = ref.current;
        if (prevEl) {
          try {
            prevEl.pause();
          } catch {}
          try {
            // remove source and force reload to free any playing media
            prevEl.removeAttribute("src");
            if (typeof prevEl.load === "function") prevEl.load();
          } catch {}
        }
      } catch {}

      try {
        if (hlsRef.current) {
          try {
            hlsRef.current.destroy();
          } catch {}
          hlsRef.current = null;
        }
      } catch {}
    };
    // we want this cleanup to run when `id` changes (before new video mounts)
  }, [id]);

  useEffect(() => {
    playSentRef.current = false;
    completeSentRef.current = false;
    lastPingAtRef.current = 0;
    lastPosRef.current = null;
    analyticsInFlightRef.current = false;
    endedHandledRef.current = false;

    lastWatchSecondsRef.current = 0;
    lastSavedAtRef.current = 0;
    restoredRef.current = false;
    iframeStartLockedVideoRef.current = "";
    iframeEstimatedSecondsRef.current = 0;
    iframeLastTickRef.current = 0;
    iframeLastSavedAtRef.current = 0;
    setIframeStartSeconds(0);

    setVideoErr(false);

    // reset youtube autoplay state
    autoNavRef.current = false;
    setUpNextCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
  }, [id]);

  /* ------------ AUTH -------------- */
  useEffect(() => {
    let alive = true;

    const token = getAnyToken();
    const hasToken = !!token;

    setAuthChecked(false);
    setIsAuthed(false);

    if (isLocalhost) log("auth token present:", hasToken);

    if (!hasToken) {
      setAuthChecked(true);
      return () => {
        alive = false;
      };
    }

    api
      .get("/auth/me")
      .then((r) => {
        if (!alive) return;
        if (isLocalhost) log("/auth/me ok:", r?.status);
        setIsAuthed(true);
      })
      .catch((e) => {
        if (!alive) return;
        if (isLocalhost)
          log("/auth/me failed (treating as logged out):", e?.response?.status);
        setIsAuthed(false);
      })
      .finally(() => {
        if (alive) setAuthChecked(true);
      });

    return () => {
      alive = false;
    };
  }, []);

  /* ------------ LOAD DB WATCH PROGRESS -------------- */
  useEffect(() => {
    let alive = true;

    if (!authChecked) return;

    if (!isAuthed) {
      setDbProgressSeconds(0);
      return;
    }

    (async () => {
      const s = await loadWatchProgress();
      if (!alive) return;
      if (s > 0 && shouldUseSavedResume) {
        iframeEstimatedSecondsRef.current = Math.max(
          iframeEstimatedSecondsRef.current || 0,
          s,
        );
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, isAuthed, id, shouldUseSavedResume]);

  /* ------------ FREEZE BUNNY IFRAME START TIME -------------- */
  useEffect(() => {
    if (!isAuthed || !isBunnyStream || !video?.id) {
      setIframeStartSeconds(0);
      return;
    }

    const videoKey = String(video.id);
    if (iframeStartLockedVideoRef.current === videoKey) return;

    const fromSearch = readResumeSecondsFromSearch(loc.search);
    const fromDb = Math.max(0, Math.floor(Number(dbProgressSeconds || 0)));
    const fromLocal = readProgressSeconds(id);

    // Important: this value is used ONLY to build the iframe URL once.
    // Do not keep tying the iframe src to changing progress values or Bunny
    // will reload the player every few seconds while progress is saved.
    //
    // Normal logged-in open starts at 0:00. Saved DB/local progress is used
    // only for refresh/back-forward, or when the overlay-login ?t= handoff exists.
    const start =
      fromSearch > 0
        ? fromSearch
        : shouldUseSavedResume
          ? Math.max(fromDb, fromLocal)
          : 0;

    iframeStartLockedVideoRef.current = videoKey;
    setIframeStartSeconds(start);
    iframeEstimatedSecondsRef.current = start;
  }, [
    isAuthed,
    isBunnyStream,
    video?.id,
    id,
    loc.search,
    dbProgressSeconds,
    shouldUseSavedResume,
  ]);

  /* ------------ CLEAN ONE-TIME LOGIN RESUME PARAM -------------- */
  useEffect(() => {
    if (!isAuthed) return;

    const qs = new URLSearchParams(loc.search || "");
    if (!qs.has("t") && !qs.has("start") && !qs.has("resume")) return;

    const fromUrl = readResumeSecondsFromSearch(loc.search);
    if (fromUrl > 0) {
      writeProgressSeconds(id, fromUrl);
      iframeEstimatedSecondsRef.current = Math.max(
        iframeEstimatedSecondsRef.current || 0,
        fromUrl,
      );
      saveWatchProgress(fromUrl);
    }

    qs.delete("t");
    qs.delete("start");
    qs.delete("resume");

    nav(
      {
        pathname: loc.pathname,
        search: qs.toString() ? `?${qs.toString()}` : "",
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, id]);

  /* ------------ LOAD VIDEO -------------- */
  useEffect(() => {
    if (!authChecked) return;

    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      setVideo(null);
      setPreviewHit(false);
      setNeedsUnmute(false);

      try {
        const urls = isAuthed
          ? [`/videos/${id}`, `/videos/public/${id}`]
          : [`/videos/public/${id}`];

        const data = await tryGetFirst(urls);
        if (!alive) return;
        if (!data) setErr("Video not found.");
        else {
          setVideo(data);
          log("Loaded video:", data);
        }
      } catch {
        if (alive) setErr("Video not found.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, authChecked, isAuthed]);

  /* ------------ LOAD CATEGORY VIDEOS -------------- */
  useEffect(() => {
    if (!video?.category_id) {
      setCategoryVideos([]);
      return;
    }

    let alive = true;
    const cacheKey = `category:${video.category_id}`;
    const cached = readVideoViewCache(cacheKey);
    if (cached) setCategoryVideos(cached);

    (async () => {
      try {
        const res =
          (await tryGetFirst([
            `/videos/public?category_id=${video.category_id}&limit=60`,
          ])) ||
          (await tryGetFirst([
            `/videos?category_id=${video.category_id}&limit=60`,
          ]));

        const items = Array.isArray(res?.items) ? res.items : res || [];
        const sorted = [...items].sort(sortLatestToOldestByPublished);

        if (!alive) return;
        setCategoryVideos(sorted);
        writeVideoViewCache(cacheKey, sorted);
        log("Category videos:", sorted);
      } catch (e) {
        if (!alive) return;
        log("Category load failed", e);
        if (!cached) setCategoryVideos([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [video?.category_id]);

  /* ------------ GLOBAL FALLBACK -------------- */
  useEffect(() => {
    if (!id) return;

    let alive = true;
    const cacheKey = "global:latest";
    const cached = readVideoViewCache(cacheKey);
    if (cached)
      setMoreGlobal(cached.filter((v) => String(v.id) !== String(id)));

    (async () => {
      const data =
        (await tryGetFirst([`/videos/public?limit=72`])) ||
        (await tryGetFirst([`/videos?limit=72`]));
      const arr = Array.isArray(data) ? data : data?.items || [];
      const sorted = [...arr].sort(sortLatestToOldestByPublished);

      if (!alive) return;
      writeVideoViewCache(cacheKey, sorted);
      setMoreGlobal(sorted.filter((v) => String(v.id) !== String(id)));
      log("Global fallback list:", sorted);
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  /* ------------ LOAD PLAYLIST FOR WATCH -------------- */
  useEffect(() => {
    let alive = true;

    if (!playlistParam) {
      setPlaylistMeta(null);
      setPlaylistRest([]);
      return;
    }

    // IMPORTANT: playlist mode logic stays here (as requested)
    (async () => {
      try {
        setPlaylistMeta(null);
        setPlaylistRest([]);

        const data = await tryGetFirst([
          `/playlists/public/${playlistParam}`,
          `/playlists/${playlistParam}`,
        ]);
        if (!alive || !data) return;

        const rawVideos = Array.isArray(data.videos)
          ? data.videos
          : data.items || [];

        const ordered = [...rawVideos].sort((a, b) => {
          const pa = Number.isFinite(+a.position) ? +a.position : 1e9;
          const pb = Number.isFinite(+b.position) ? +b.position : 1e9;
          if (pa !== pb) return pa - pb;
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        });

        const currentIdx = ordered.findIndex(
          (v) => String(v.id) === String(id),
        );
        const rest = currentIdx >= 0 ? ordered.slice(currentIdx + 1) : ordered;

        setPlaylistMeta({ id: data.id, title: data.title });
        setPlaylistRest(rest);
        log("Loaded playlist for watch:", data, rest);
      } catch (e) {
        if (!alive) return;
        log("Playlist load failed", e);
        setPlaylistMeta(null);
        setPlaylistRest([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [playlistParam, id]);

  /* ------------ RESOURCES -------------- */
  useEffect(() => {
    if (!id) return;
    let alive = true;
    const cacheKey = `resources:${id}`;
    const cached = readVideoViewCache(cacheKey);
    if (cached) setResources(cached);

    api
      .get(`/resources/by-video/${id}`, { timeout: 15000 })
      .then((r) => {
        const items = r.data?.items || [];
        writeVideoViewCache(cacheKey, items);
        if (alive) setResources(items);
      })
      .catch(() => {
        if (alive && !cached) setResources([]);
      });

    return () => {
      alive = false;
    };
  }, [id]);

  /* ------------ PLAYLISTS (for "+ Add to playlist") -------------- */
  useEffect(() => {
    let alive = true;

    if (!isAuthed) {
      setMyPlaylists([]);
      setMemberOf(new Set());
      return;
    }

    // Do not fetch playlist membership on every video load. Load it only when
    // the user opens the "+ Add to playlist" menu.
    if (!showPL) return;

    (async () => {
      try {
        setPlLoading(true);

        const data =
          (await tryGetFirst([
            `/playlists/my`,
            `/playlists/me`,
            `/playlists`,
          ])) || [];
        const items = Array.isArray(data?.items) ? data.items : data || [];
        if (!alive) return;
        setMyPlaylists(items);

        const m =
          (await tryGetFirst([
            `/playlists/by-video/${id}`,
            `/playlists/for-video/${id}`,
            `/playlists/videos/${id}`,
          ])) || null;

        const raw = Array.isArray(m?.items)
          ? m.items
          : Array.isArray(m?.playlist_ids)
            ? m.playlist_ids
            : Array.isArray(m)
              ? m
              : [];

        const inSet = new Set(
          raw.map((x) => String(x?.playlist_id ?? x?.id ?? x)),
        );

        if (!alive) return;
        setMemberOf(inSet);
      } catch (e) {
        if (!alive) return;
        setMyPlaylists([]);
        setMemberOf(new Set());
      } finally {
        alive && setPlLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthed, id, showPL]);

  /* ------------ HLS SETUP (improved + recovery) -------------- */
  useEffect(() => {
    const el = videoRef.current;

    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }

    if (!el || !srcUrl || useBunnyStreamPlayer) return;
    const hls = isHlsUrl(srcUrl);

    // Mobile fix: Android Chrome answers "maybe" to canPlayType(HLS) but often
    // can't play it — so use hls.js wherever it works, and the browser's own
    // HLS only on Apple devices (iPhone/iPad/Safari), where it is reliable.
    const apple =
      /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ||
      (/Safari/.test(navigator.userAgent) &&
        !/Chrome|Chromium|Android|Edg/.test(navigator.userAgent));
    if (hls && apple && el.canPlayType("application/vnd.apple.mpegURL")) {
      el.src = srcUrl;
      try {
        el.load();
      } catch {}
      return;
    }

    if (hls) {
      let cancelled = false;

      (async () => {
        try {
          const HlsMod = await import("hls.js");
          const Hls = HlsMod.default || HlsMod;
          if (cancelled) return;

          if (Hls.isSupported()) {
            const instance = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
              backBufferLength: 90,
              maxBufferSize: 30 * 1000 * 1000,

              fragLoadingTimeOut: 20000,
              fragLoadingMaxRetry: 6,
              fragLoadingRetryDelay: 1000,
              fragLoadingMaxRetryTimeout: 64000,
              manifestLoadingTimeOut: 20000,
              manifestLoadingMaxRetry: 4,
              manifestLoadingRetryDelay: 1000,
              levelLoadingTimeOut: 20000,
              levelLoadingMaxRetry: 4,
              levelLoadingRetryDelay: 1000,
            });

            instance.loadSource(srcUrl);
            instance.attachMedia(el);

            instance.on(Hls.Events.ERROR, function (_, data) {
              if (!data?.fatal) return;
              try {
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR)
                  instance.startLoad();
                else if (data.type === Hls.ErrorTypes.MEDIA_ERROR)
                  instance.recoverMediaError();
                else instance.destroy();
              } catch {
                try {
                  instance.destroy();
                } catch {}
              }
            });

            hlsRef.current = instance;
          } else {
            el.src = srcUrl; // no MediaSource: the browser's own HLS (if any)
            try {
              el.load();
            } catch {}
          }
        } catch {
          el.src = srcUrl;
          try {
            el.load();
          } catch {}
        }
      })();

      return () => {
        cancelled = true;
        if (hlsRef.current) {
          try {
            hlsRef.current.destroy();
          } catch {}
          hlsRef.current = null;
        }
      };
    }

    el.src = srcUrl;
    try {
      el.load();
    } catch {}
  }, [srcUrl, useBunnyStreamPlayer, playerKey]);

  /* ------------ FORCE UNMUTE (default) -------------- */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    // ensure default is unmuted whenever video changes
    el.muted = false;
    el.defaultMuted = false;
  }, [id, srcUrl]);

  /* ------------ PREVIEW GATE -------------- */
  useEffect(() => {
    setPreviewHit(false);
    setNeedsUnmute(false);
  }, [id, srcUrl]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (!previewActive) {
      el.controls = true;
      el.style.pointerEvents = "auto";
      return;
    }

    const clampPreview = () => {
      const t = Math.max(0, previewSeconds - 0.01);
      try {
        el.currentTime = t;
      } catch {}
    };

    const stop = () => {
      try {
        el.pause();
      } catch {}
      clampPreview();
      setPreviewHit(true);
      el.controls = false;
      el.style.pointerEvents = "none";
    };

    const onTime = () => {
      if (el.currentTime >= previewSeconds && !previewHit) stop();
    };
    const onPlay = () => previewHit && stop();
    const onSeek = () => {
      if (el.currentTime >= previewSeconds) {
        clampPreview();
        stop();
      }
    };
    const onRate = () => {
      if (el.playbackRate > 1) el.playbackRate = 1;
    };

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("seeking", onSeek);
    el.addEventListener("seeked", onSeek);
    el.addEventListener("ratechange", onRate);

    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("seeking", onSeek);
      el.removeEventListener("seeked", onSeek);
      el.removeEventListener("ratechange", onRate);
    };
  }, [previewActive, previewSeconds, previewHit]);

  /* ------------ SAVE PROGRESS (always) -------------- */
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !id) return;

    const onTime = () => {
      const cur = Number(el.currentTime || 0);
      lastWatchSecondsRef.current = cur;

      const now = Date.now();
      if (now - lastSavedAtRef.current > PROGRESS_SAVE_MS) {
        lastSavedAtRef.current = now;
        writeProgressSeconds(id, cur);
        if (isAuthed) {
          saveWatchProgressRef.current(cur, el.duration || null);
        }
      }
    };

    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
    // srcUrl: the <video> only exists once the video has loaded, so attach again
    // then (before, the listener was never attached and progress was not saved)
  }, [id, isAuthed, srcUrl]);

  /* ------------ RESTORE PROGRESS (robust for HLS) -------------- */
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !id || !srcUrl) return;
    if (restoredRef.current) return;

    const qs = new URLSearchParams(loc.search);
    const tFromUrl = Number(qs.get("t"));
    const tFromStorage = readProgressSeconds(id);
    const tFromDb = Number(dbProgressSeconds || 0);

    let desired =
      Number.isFinite(tFromUrl) && tFromUrl > 0
        ? tFromUrl
        : shouldUseSavedResume
          ? Math.max(tFromDb, tFromStorage)
          : 0;

    if (!desired || desired <= 0) {
      restoredRef.current = true;
      return;
    }

    let attempts = 0;
    const MAX_ATTEMPTS = 8;

    const computeTarget = () => {
      const dur = Number(el.duration || 0);
      let safe =
        dur > 0
          ? clamp(desired, 0, Math.max(0, dur - 2))
          : Math.max(0, desired);

      if (previewActive && previewSeconds) {
        safe = Math.min(safe, Math.max(0, previewSeconds - 0.25));
      }

      return safe;
    };

    const trySeekOnce = () => {
      const target = computeTarget();
      if (!Number.isFinite(target) || target <= 0) return false;

      try {
        el.currentTime = target;
      } catch {
        return false;
      }

      const ok = Math.abs(Number(el.currentTime || 0) - target) < 1;
      if (ok) {
        restoredRef.current = true;

        if (qs.get("t")) {
          qs.delete("t");
          const newSearch = qs.toString();
          nav(
            {
              pathname: loc.pathname,
              search: newSearch ? `?${newSearch}` : "",
            },
            { replace: true },
          );
        }

        return true;
      }
      return false;
    };

    const tick = () => {
      attempts++;
      if (el.readyState >= 1) {
        if (trySeekOnce()) return;
      }
      if (attempts >= MAX_ATTEMPTS) {
        restoredRef.current = true;
        return;
      }
      setTimeout(tick, 250);
    };

    if (el.readyState >= 1) tick();
    else el.addEventListener("loadedmetadata", tick, { once: true });

    const onCanPlay = () => {
      if (!restoredRef.current) tick();
    };
    el.addEventListener("canplay", onCanPlay, { once: true });

    return () => {
      el.removeEventListener("loadedmetadata", tick);
      el.removeEventListener("canplay", onCanPlay);
    };
  }, [
    id,
    srcUrl,
    loc.pathname,
    loc.search,
    nav,
    previewActive,
    previewSeconds,
    dbProgressSeconds,
    shouldUseSavedResume,
  ]);

  /* ------------ VOD ANALYTICS (play/progress/complete) -------------- */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (!isAuthed) return;
    if (hardLoginGate) return;
    if (previewActive) return;
    if (!id) return;

    const PING_SECONDS = 15;

    const rawVid = video?.id ?? id;
    const videoIdNum = Number(rawVid);
    const safeVideoId = Number.isFinite(videoIdNum)
      ? videoIdNum
      : String(rawVid);

    const payloadBase = () => {
      const dur = safeInt(el.duration);
      const pos = safeInt(el.currentTime);
      return {
        video_id: safeVideoId,
        position_seconds: pos,
        duration_seconds: dur,
        page: window.location.pathname + window.location.search,
        meta: {},
      };
    };

    const isActuallyPlaying = () =>
      !el.paused && !el.ended && el.readyState >= 2;

    const calcDeltaSeconds = () => {
      const cur = Number(el.currentTime || 0);

      if (lastPosRef.current == null || !Number.isFinite(lastPosRef.current)) {
        lastPosRef.current = cur;
        return 0;
      }

      const raw = cur - Number(lastPosRef.current || 0);
      const delta = Math.floor(raw);

      if (!Number.isFinite(delta) || delta < 0) {
        lastPosRef.current = cur;
        return 0;
      }

      const capped = Math.min(delta, 60);
      lastPosRef.current = cur;
      return capped;
    };

    const sendOne = async (payload, { force = false } = {}) => {
      if (analyticsInFlightRef.current) {
        if (!force) return false;
      }
      analyticsInFlightRef.current = true;
      try {
        return await sendAnalyticsEventFetch(payload, { timeoutMs: 8000 });
      } finally {
        analyticsInFlightRef.current = false;
      }
    };

    const sendPlayOnce = async () => {
      if (playSentRef.current) return;
      playSentRef.current = true;

      lastPosRef.current = Number(el.currentTime || 0);
      await sendOne(
        { event_type: "video_play", ...payloadBase() },
        { force: true },
      );
    };

    const sendProgress = async (force = false) => {
      if (!force && !isActuallyPlaying()) return;

      const now = Date.now();
      if (!force && now - lastPingAtRef.current < PING_SECONDS * 1000) return;
      lastPingAtRef.current = now;

      const delta_seconds = calcDeltaSeconds();

      await sendOne(
        {
          event_type: "video_progress",
          ...payloadBase(),
          meta: { delta_seconds },
        },
        { force },
      );
    };

    const sendCompleteOnce = async () => {
      if (completeSentRef.current) return;
      completeSentRef.current = true;

      await sendProgress(true);

      await sendOne(
        {
          event_type: "video_complete",
          ...payloadBase(),
          meta: { delta_seconds: 0 },
        },
        { force: true },
      );
    };

    const onPlay = async () => {
      endedHandledRef.current = false;
      // mark user interacted so we can autoplay unmuted next time (like youtube)
      try {
        localStorage.setItem("vv_user_interacted", "true");
      } catch {}
      await sendPlayOnce();
      await sendProgress(true);
    };

    const onPause = async () => {
      await sendProgress(true);
    };

    const onTimeUpdate = async () => {
      const dur = Number(el.duration || 0);
      const cur = Number(el.currentTime || 0);

      if (dur > 0 && cur >= dur - 0.75 && !endedHandledRef.current) {
        endedHandledRef.current = true;
        await sendCompleteOnce();
        return;
      }

      await sendProgress(false);
    };

    const onEnded = async () => {
      if (endedHandledRef.current) return;
      endedHandledRef.current = true;
      await sendCompleteOnce();
    };

    const onVisibility = async () => {
      if (document.visibilityState === "hidden") {
        await sendProgress(true);
      }
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    document.addEventListener("visibilitychange", onVisibility);

    const intv = setInterval(() => {
      sendProgress(false);
    }, PING_SECONDS * 1000);

    const onBeforeUnload = () => {
      const base = payloadBase();
      const payload = {
        event_type: "video_progress",
        ...base,
        meta: { delta_seconds: calcDeltaSeconds() },
      };
      beaconAnalyticsEvent(`${apiOrigin()}/api/analytics/event`, payload);
    };

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      clearInterval(intv);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [id, video?.id, isAuthed, hardLoginGate, previewActive]);

  /* ------------ COMMENTS -------------- */
  useEffect(() => {
    let alive = true;
    setCmtErr("");
    setCmtLoading(true);
    api
      .get(`/comments?video_id=${id}`)
      .then((r) => {
        if (!alive) return;
        const items = r.data?.items || r.data || [];
        setComments(items);
        setShowAllComments(false);
      })
      .catch(() => alive && setComments([]))
      .finally(() => alive && setCmtLoading(false));

    return () => {
      alive = false;
    };
  }, [id]);

  async function postComment(e) {
    e.preventDefault();
    if (!isAuthed) return goLoginWithResume();

    const body = cmtTxt.trim();
    if (!body) return;

    setCmtErr("");
    try {
      const r = await api.post("/comments", { video_id: id, body });
      const saved = r?.data?.comment || r?.data?.item || r?.data;
      setComments((prev) => [saved, ...prev]);
      setCmtTxt("");
    } catch {
      setCmtErr("Failed to post comment.");
    }
  }

  async function share() {
    const shareUrl =
      window.location.origin +
      loc.pathname +
      (inPlaylistMode ? `?playlist=${playlistParam}` : "");

    try {
      if (navigator.share) {
        await navigator.share({ title: video?.title, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link copied!");
      }
    } catch {}
  }

  async function toggleMembership(pid) {
    const pidStr = String(pid);
    const inNow = memberOf.has(pidStr);
    try {
      if (inNow) {
        await api.delete(`/playlists/${pid}/videos/${id}`);
        const next = new Set(memberOf);
        next.delete(pidStr);
        setMemberOf(next);
      } else {
        await api.post(`/playlists/${pid}/videos`, { video_id: id });
        const next = new Set(memberOf);
        next.add(pidStr);
        setMemberOf(next);
      }
    } catch {
      alert("Unable to update playlist.");
    }
  }

  // compute next/related using published date sorting (public view)
  const categoryWithoutCurrent = categoryVideos.filter(
    (v) => String(v.id) !== String(id),
  );
  const globalWithoutCurrent = moreGlobal.filter(
    (v) => String(v.id) !== String(id),
  );

  let nextVideos = [];
  let relatedVideos = [];

  if (categoryVideos.length > 0 && video) {
    nextVideos = [...categoryWithoutCurrent]
      .sort(sortLatestToOldestByPublished)
      .slice(0, 30);

    relatedVideos = [...globalWithoutCurrent]
      .filter((v) => v.category_id !== video.category_id)
      .sort(sortLatestToOldestByPublished)
      .slice(0, 18);
  } else {
    const sortedGlobal = [...globalWithoutCurrent].sort(
      sortLatestToOldestByPublished,
    );
    nextVideos = sortedGlobal.slice(0, 30);
    relatedVideos = sortedGlobal.slice(30, 48);
  }

  const nextVideo = nextVideos[0] || null;
  const remainingNext = nextVideos.slice(1);

  const nextCountTotal = 1 + remainingNext.length;
  const shouldScrollNext = !inPlaylistMode && nextCountTotal > 10;

  /* ------------ BUNNY IFRAME WATCH PROGRESS (ESTIMATED) -------------- */
  useEffect(() => {
    if (!isAuthed || !useBunnyStreamPlayer || !id) return;

    const startAt = Math.max(
      0,
      Number(iframeEstimatedSecondsRef.current || 0),
      Number(iframeStartSeconds || 0),
    );

    iframeEstimatedSecondsRef.current = startAt;
    iframeLastTickRef.current = Date.now();
    iframeLastSavedAtRef.current = 0;

    const saveNow = (force = false) => {
      const position = Math.max(
        0,
        Math.floor(Number(iframeEstimatedSecondsRef.current || 0)),
      );
      if (!(position > 0)) return;

      const now = Date.now();
      if (
        !force &&
        now - iframeLastSavedAtRef.current < IFRAME_PROGRESS_SAVE_MS
      ) {
        return;
      }

      iframeLastSavedAtRef.current = now;
      writeProgressSeconds(id, position);
      saveWatchProgress(position, playerDurationRef.current || null);
    };

    const tick = window.setInterval(() => {
      const now = Date.now();
      const delta = Math.max(
        0,
        Math.round((now - iframeLastTickRef.current) / 1000),
      );
      iframeLastTickRef.current = now;

      // Bunny iframe does not expose reliable currentTime to React here.
      // We estimate progress only while the tab is visible, which fixes refresh
      // resume for normal watching without changing the Bunny iframe player.
      if (document.visibilityState === "visible" && delta > 0) {
        // Real times from the player (player.js) replace the estimate.
        if (!playerReportsRef.current)
          iframeEstimatedSecondsRef.current += Math.min(delta, 5);
        saveNow(false);
      }
    }, 1000);

    const onVisibility = () => {
      iframeLastTickRef.current = Date.now();
      saveNow(true);
    };

    const onBeforeUnload = () => {
      saveNow(true);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      saveNow(true);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, useBunnyStreamPlayer, id, iframeStartSeconds]);

  /* ------------ YOUTUBE-STYLE MAIN AUTOPLAY -------------- */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (!srcUrl || useBunnyStreamPlayer) return;
    if (hardLoginGate) return;
    if (previewActive && previewHit) return;

    // reset countdown if user starts playing again
    setUpNextCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    autoNavRef.current = false;

    let cancelled = false;
    let didStart = false;

    const attempt = async () => {
      if (cancelled || didStart) return;
      if (!videoRef.current) return;
      const player = videoRef.current;
      if (player.readyState < 1 && isHlsUrl(srcUrl)) return;

      // Browser rule: unmuted autoplay is often blocked on first load until
      // the user interacts with the page. Try unmuted first, then fall back to
      // muted autoplay so the video still starts. The UI shows an Unmute button.
      try {
        player.muted = false;
        player.defaultMuted = false;
        const p = player.play();
        if (p && typeof p.then === "function") await p;
        if (cancelled) return;
        didStart = true;
        setNeedsUnmute(false);
        return;
      } catch {}

      try {
        player.muted = true;
        player.defaultMuted = true;
        const p = player.play();
        if (p && typeof p.then === "function") await p;
        if (cancelled) return;
        didStart = true;
        setNeedsUnmute(true);
      } catch {
        if (!cancelled) setNeedsUnmute(false);
      }
    };

    // Try immediately and retry when the native/HLS player becomes ready.
    const timers = [120, 450, 1000].map((ms) => setTimeout(attempt, ms));
    const events = [
      "loadedmetadata",
      "loadeddata",
      "canplay",
      "canplaythrough",
    ];
    events.forEach((evt) => el.addEventListener(evt, attempt));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      events.forEach((evt) => el.removeEventListener(evt, attempt));
    };
  }, [
    id,
    srcUrl,
    hardLoginGate,
    previewActive,
    previewHit,
    useBunnyStreamPlayer,
  ]);

  /* ------------ Sound for muted autoplay -------------- */
  // A video opened directly (or on iPhone/Safari) must start muted. One tap on
  // "Tap for sound" — or, on Chrome/Edge/Android, the first click or key press
  // anywhere on the page — turns the sound on through the player.
  // Muted because we asked for it (URL), or because the browser made the
  // player fall back to muted when we asked for sound (reported by player.js).
  const startedMuted =
    /[?&]muted=true/.test(activeBunnyEmbedUrl || "") || playerMuted;
  // iPhone/iPad: the video waits for a tap on the player's play button.
  const tapToPlay = /[?&]autoplay=false/.test(activeBunnyEmbedUrl || "");
  // iPhone/iPad/Safari only accept a tap INSIDE the player for sound (a tap
  // outside can pause the video), so there no tap-anywhere listener is used.
  const appleSafari = useMemo(() => isAppleSafari(), []);
  const turnSoundOn = useCallback(() => {
    const send = playerSendRef.current;
    if (!send) return;
    unmuteAtRef.current = Date.now(); // see the "pause" handler: iPhone check
    send("unmute");
    send("setVolume", 100);
    setSoundOn(true);
  }, []);
  useEffect(() => {
    setSoundOn(false);
    setSoundBlocked(false);
    setPlayerMuted(false);
    setPlayStarted(false);
    setCtaHidden(false);
  }, [activeBunnyEmbedUrl]);
  useEffect(() => {
    setResumedHere(false);
  }, [id]);
  useEffect(() => {
    if (!useBunnyStreamPlayer || !startedMuted || soundOn || appleSafari)
      return undefined;
    const once = () => turnSoundOn();
    window.addEventListener("pointerdown", once, { once: true });
    window.addEventListener("keydown", once, { once: true });
    return () => {
      window.removeEventListener("pointerdown", once);
      window.removeEventListener("keydown", once);
    };
  }, [useBunnyStreamPlayer, startedMuted, soundOn, turnSoundOn, appleSafari]);

  /* ------------ Release 2.0 Part B: shared "Up next" -------------- */
  // Playlist continuation first, then the next video. Used by the built-in
  // player and the Bunny iframe player alike.
  const beginUpNextRef = useRef(() => {});
  beginUpNextRef.current = () => {
    if (!autoNextOn || autoNavRef.current) return;
    let target = null;
    if (inPlaylistMode && playlistRest && playlistRest.length > 0) {
      const nxt = playlistRest[0];
      target = {
        url: `/watch/${nxt.id}?playlist=${playlistParam}`,
        title: nxt.title,
        thumbnail: nxt.thumbnail_url || "",
      };
    } else if (nextVideo?.id) {
      target = {
        url: `/watch/${nextVideo.id}`,
        title: nextVideo.title,
        thumbnail: nextVideo.thumbnail_url || "",
      };
    }
    if (!target) return;
    autoNavRef.current = true;
    setUpNextTarget(target);
    let s = 8;
    setUpNextCountdown(s);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      s -= 1;
      setUpNextCountdown(s);
      if (s <= 0) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
        setUpNextCountdown(0);
        nav(target.url);
      }
    }, 1000);
  };

  // Bunny Stream player events (player.js): real position, pause, end.
  useEffect(() => {
    if (!useBunnyStreamPlayer) return undefined;
    playerReportsRef.current = false;
    playerDurationRef.current = 0;
    let origin = "*";
    try {
      origin = new URL(activeBunnyEmbedUrl).origin;
    } catch {
      /* keep * */
    }
    const send = (method, value) => {
      const w = bunnyIframeRef.current?.contentWindow;
      if (!w) return;
      w.postMessage(
        JSON.stringify({
          context: "player.js",
          version: "0.0.11",
          method,
          value,
          listener: `brtv-${value}`,
        }),
        origin,
      );
    };
    // player.js getter: the answer comes back as an event named `listener`.
    const ask = (method, listener) => {
      const w = bunnyIframeRef.current?.contentWindow;
      if (!w) return;
      w.postMessage(
        JSON.stringify({
          context: "player.js",
          version: "0.0.11",
          method,
          listener,
        }),
        origin,
      );
    };
    const subscribe = () =>
      ["timeupdate", "pause", "play", "ended"].forEach((ev) =>
        send("addEventListener", ev),
      );
    playerSendRef.current = send;
    // Did the browser silently start the video muted although we asked for
    // sound? Checked once, shortly after it first plays (not on iPhone, where
    // the play tap itself happens inside the player and gives sound).
    const askedForSound = !/[?&]muted=true/.test(activeBunnyEmbedUrl || "");
    let mutedChecked = false;
    let mutedTimer = null;
    // Signed-out preview safety net (if the player never reports its time).
    // When the video waits for a tap (iPhone) the clock starts at that tap.
    const lim = previewLimitRef.current;
    const waitsForTap = /[?&]autoplay=false/.test(activeBunnyEmbedUrl || "");
    let safety = null;
    const startSafety = () => {
      if (safety || !(lim.on && lim.seconds > 0)) return;
      safety = window.setTimeout(
        () => {
          if (!playerReportsRef.current) setPreviewHit(true);
        },
        (lim.seconds + 120) * 1000,
      );
    };
    const onMsg = (e) => {
      if (
        !bunnyIframeRef.current ||
        e.source !== bunnyIframeRef.current.contentWindow
      )
        return;
      let d = e.data;
      if (typeof d === "string") {
        try {
          d = JSON.parse(d);
        } catch {
          return;
        }
      }
      if (!d || d.context !== "player.js") return;
      if (d.event === "ready") subscribe();
      else if (d.event === "brtv-muted") {
        if (d.value === true || d.value === "true") setPlayerMuted(true);
      } else if (d.event === "timeupdate" && d.value) {
        const sec = Number(d.value.seconds);
        const dur = Number(d.value.duration);
        if (Number.isFinite(sec) && sec >= 0) {
          playerReportsRef.current = true;
          iframeEstimatedSecondsRef.current = sec;
          if (dur > 0) playerDurationRef.current = dur;
          // Signed-out preview: stop at the preview length (or a skip past it).
          const lim = previewLimitRef.current;
          if (lim.on && lim.seconds > 0 && sec >= lim.seconds) {
            send("pause");
            setPreviewHit(true);
          }
        }
      } else if (d.event === "pause") {
        // iPhone can refuse sound from a tap outside the player by PAUSING
        // the video: keep it playing (muted) and point to the player's
        // own speaker button instead.
        if (Date.now() - unmuteAtRef.current < 1500) {
          unmuteAtRef.current = 0;
          send("mute");
          send("play");
          setSoundOn(false);
          setSoundBlocked(true);
          return;
        }
        saveWatchProgress(
          iframeEstimatedSecondsRef.current,
          playerDurationRef.current || null,
        );
      } else if (d.event === "play") {
        setPlayStarted(true);
        startSafety();
        if (askedForSound && !mutedChecked && !isAppleTouchDevice()) {
          mutedChecked = true;
          mutedTimer = window.setTimeout(
            () => ask("getMuted", "brtv-muted"),
            900,
          );
        }
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
        setUpNextCountdown(0);
        autoNavRef.current = false;
      } else if (d.event === "ended") {
        // Preview clip finished: show the sign-in screen (not "Up next").
        if (previewLimitRef.current.clip) {
          setPreviewHit(true);
          return;
        }
        const dur =
          playerDurationRef.current || iframeEstimatedSecondsRef.current;
        saveWatchProgress(dur, dur || null, true);
        beginUpNextRef.current();
      }
    };
    window.addEventListener("message", onMsg);
    const retry = window.setTimeout(subscribe, 1500); // in case "ready" came first
    // A tap inside the player (cross-origin iframe) blurs our window.
    if (waitsForTap) window.addEventListener("blur", startSafety);
    else startSafety();
    return () => {
      window.removeEventListener("message", onMsg);
      window.removeEventListener("blur", startSafety);
      window.clearTimeout(retry);
      if (mutedTimer) window.clearTimeout(mutedTimer);
      if (safety) window.clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useBunnyStreamPlayer, activeBunnyEmbedUrl]);

  /* ------------ YOUTUBE-STYLE AUTOPLAY NEXT -------------- */
  useEffect(() => {
    const el = videoRef.current;
    if (!el || useBunnyStreamPlayer) return;

    const clearCountdown = () => {
      setUpNextCountdown(0);
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = null;
    };

    const onEnded = () => {
      if (hardLoginGate) return;
      if (previewActive) return;
      beginUpNextRef.current();
    };

    const onPlay = () => {
      // If user manually resumes/plays, cancel countdown
      clearCountdown();
      autoNavRef.current = false;
    };

    el.addEventListener("ended", onEnded);
    el.addEventListener("play", onPlay);

    return () => {
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("play", onPlay);
      clearCountdown();
      autoNavRef.current = false;
    };
  }, [
    nav,
    autoNextOn,
    nextVideo?.id,
    hardLoginGate,
    previewActive,
    inPlaylistMode,
    playlistRest,
    playlistParam,
    useBunnyStreamPlayer,
  ]);

  function toggleAutoNext() {
    setAutoNextOn((v) => {
      const next = !v;
      try {
        localStorage.setItem("vv_autonext", String(next));
      } catch {}
      return next;
    });
  }

  function cancelUpNext() {
    setUpNextCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    autoNavRef.current = false;
  }

  // ✅ YouTube-style loading (no “Loading…” text)
  if (loading) return <VideoViewSkeleton />;

  if (err || !video)
    return (
      <div className="vv">
        <div className="vv-wrap">
          <div className="vv-card vv-pad">{err || "Video not found."}</div>
        </div>
      </div>
    );

  const created = video.created_at || video.created;
  const author = video?.metadata?.authors?.[0];
  const currentPublishedLabel = (() => {
    const ms = getPublishedMs(video);
    return ms
      ? datePretty(new Date(ms).toISOString())
      : created
        ? datePretty(created)
        : "";
  })();

  const visibleComments = showAllComments
    ? comments
    : comments.slice(0, MAX_VISIBLE_COMMENTS);
  const hasMoreComments = comments.length > MAX_VISIBLE_COMMENTS;

  return (
    <div className="vv">
      <div className="vv-wrap">
        <div className="vv-grid">
          <div>
            <div className="vv-card">
              <div style={{ background: "#000", position: "relative" }}>
                {useBunnyStreamPlayer &&
                (limitBunnyPreview || clipPreview) &&
                previewHit ? (
                  <div
                    className="vv-bunny-player-wrap vv-preview-ended"
                    style={{
                      backgroundImage: poster ? `url("${poster}")` : undefined,
                    }}
                    aria-hidden="true"
                  />
                ) : useBunnyStreamPlayer ? (
                  <div className="vv-bunny-player-wrap">
                    <iframe
                      key={activeBunnyEmbedUrl}
                      ref={bunnyIframeRef}
                      className="vv-bunny-player"
                      src={activeBunnyEmbedUrl}
                      title={video?.title || "Bunny Stream Player"}
                      loading="eager"
                      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                      allowFullScreen
                    />
                    {startedMuted && !soundOn && !soundBlocked ? (
                      <button
                        type="button"
                        className="vv-soundBtn vv-soundBtn--big"
                        onClick={turnSoundOn}
                      >
                        <span aria-hidden="true">🔊</span> Tap for sound
                      </button>
                    ) : null}
                    {tapToPlay && !playStarted && !soundBlocked ? (
                      <p className="vv-soundBtn vv-soundHint" role="status">
                        <span aria-hidden="true">▶</span> Tap play for sound
                      </p>
                    ) : null}
                    {soundBlocked ? (
                      <p className="vv-soundBtn vv-soundHint" role="status">
                        <span aria-hidden="true">🔈</span> Tap the speaker on
                        the player for sound
                      </p>
                    ) : null}
                    {!isAuthed &&
                      !ctaHidden &&
                      (previewBunnyEmbedUrl || limitBunnyPreview) && (
                        <div className="vv-bunny-preview-cta">
                          <span>
                            {`Free preview: first ${Math.round(previewSeconds / 60) || 1} min`}
                          </span>
                          <button
                            className="vv-btn primary"
                            onClick={goLoginWithResume}
                          >
                            Log in to watch full video
                          </button>
                          <button
                            type="button"
                            className="vv-ctaClose"
                            aria-label="Hide this message"
                            title="Hide"
                            onClick={() => setCtaHidden(true)}
                          >
                            ×
                          </button>
                        </div>
                      )}
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    poster={poster || undefined}
                    style={{
                      width: "100%",
                      display: "block",
                      background: "#000",
                      pointerEvents:
                        (previewActive && previewHit) || hardLoginGate
                          ? "none"
                          : "auto",
                    }}
                    controls
                    autoPlay={!hardLoginGate && !(previewActive && previewHit)}
                    playsInline
                    preload="auto"
                    controlsList="nodownload"
                    disablePictureInPicture
                    onContextMenu={(e) => e.preventDefault()}
                    onError={() => setVideoErr(true)}
                    onLoadedData={() => setVideoErr(false)}
                  />
                )}

                {!useBunnyStreamPlayer &&
                  needsUnmute &&
                  !previewHit &&
                  !hardLoginGate && (
                    <button
                      type="button"
                      className="vv-btn primary"
                      onClick={unmuteNativeVideo}
                      style={{
                        position: "absolute",
                        right: 14,
                        bottom: 14,
                        zIndex: 5,
                        boxShadow: "0 10px 30px rgba(0,0,0,.35)",
                      }}
                    >
                      🔊 Unmute
                    </button>
                  )}

                {/* fallback image layer */}
                {!useBunnyStreamPlayer &&
                  (hardLoginGate || !srcUrl || videoErr) && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background:
                          "radial-gradient(800px 400px at 20% 30%, rgba(99,102,241,.22), rgba(0,0,0,0) 55%)",
                        pointerEvents: "none",
                      }}
                      aria-hidden="true"
                    >
                      <img
                        src={DefaultThumb}
                        alt=""
                        style={{
                          width: "min(420px, 60%)",
                          opacity: 0.92,
                          filter: "drop-shadow(0 18px 60px rgba(0,0,0,.55))",
                        }}
                      />
                    </div>
                  )}
                {/* Playback error: say so, and offer to try again */}
                {!useBunnyStreamPlayer &&
                videoErr &&
                srcUrl &&
                !hardLoginGate ? (
                  <div className="vv-playErr" role="alert">
                    <p>This video couldn't play on this device.</p>
                    <button
                      type="button"
                      className="vv-btn"
                      onClick={() => {
                        setVideoErr(false);
                        setPlayerKey((k) => k + 1);
                      }}
                    >
                      Try again
                    </button>
                  </div>
                ) : null}

                {/* Up Next countdown overlay (YouTube-like) */}
                {upNextCountdown > 0 && (
                  <div
                    className="vv-upnext-overlay"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="vv-upnext-card">
                      <div className="vv-upnext-title">Up next</div>
                      {upNextTarget?.thumbnail ? (
                        <img
                          className="vv-upnext-thumb"
                          src={upNextTarget.thumbnail}
                          alt=""
                        />
                      ) : null}
                      {upNextTarget?.title ? (
                        <div className="vv-upnext-name">
                          {upNextTarget.title}
                        </div>
                      ) : null}
                      <div className="vv-upnext-sub">
                        Playing next in <strong>{upNextCountdown}</strong>s
                      </div>
                      <div className="vv-upnext-actions">
                        {upNextTarget?.url ? (
                          <button
                            className="vv-btn primary"
                            onClick={() => {
                              cancelUpNext();
                              nav(upNextTarget.url);
                            }}
                          >
                            ▶ Play now
                          </button>
                        ) : null}
                        <button className="vv-btn" onClick={cancelUpNext}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {(!useBunnyStreamPlayer || limitBunnyPreview || clipPreview) &&
                  (hardLoginGate || (previewActive && previewHit)) && (
                    <div className="vv-gate">
                      <div className="vv-gate-inner">
                        <p style={{ marginTop: 0 }}>
                          Please log in to watch the full video.
                        </p>
                        <button
                          className="vv-btn primary"
                          onClick={goLoginWithResume}
                        >
                          Log in
                        </button>
                      </div>
                    </div>
                  )}
              </div>

              <div className="vv-pad">
                {/* opened from a series: "Episode 3 of 8" + Next episode */}
                {new URLSearchParams(loc.search).get("series") ? (
                  <SeriesWatchBar
                    slug={new URLSearchParams(loc.search).get("series")}
                    videoId={video.id}
                  />
                ) : null}
                {/* Title first, then one clean action row (Save = My List + playlists) */}
                <h1 className="vv-h1">{video.title}</h1>

                <div className="vv-byline">
                  {author && <span className="vv-badge">{author}</span>}
                  {currentPublishedLabel && (
                    <span>{currentPublishedLabel}</span>
                  )}
                </div>

                <div className="vv-row vv-actionsRow">
                  <button
                    className="vv-btn vv-iconBtn"
                    onClick={() => nav(-1)}
                    aria-label="Go back"
                    title="Back"
                  >
                    <span aria-hidden="true">←</span>
                  </button>

                  {isAuthed ? (
                    <div className="vv-pop">
                      <button
                        className={`vv-btn vv-saveBtn${showPL ? " is-open" : ""}`}
                        onClick={() => setShowPL((s) => !s)}
                        aria-haspopup="true"
                        aria-expanded={showPL}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M6 3h12v18l-6-4-6 4z" />
                        </svg>
                        Save
                      </button>

                      {showPL && (
                        <div className="vv-popmenu vv-saveMenu">
                          <div className="vv-saveSection">Quick save</div>
                          <MyListButton
                            videoId={video.id || id}
                            title={video.title}
                          />
                          <div className="vv-saveSection">Your playlists</div>
                          {plLoading && (
                            <div className="vv-muted">Loading…</div>
                          )}
                          {!plLoading && myPlaylists.length === 0 && (
                            <div className="vv-muted vv-saveEmpty">
                              No playlists yet.
                            </div>
                          )}
                          {!plLoading &&
                            myPlaylists.map((p) => {
                              const inList = memberOf.has(String(p.id));
                              return (
                                <label
                                  key={p.id}
                                  className="vv-poprow"
                                  onClick={() => toggleMembership(p.id)}
                                >
                                  <input
                                    type="checkbox"
                                    checked={inList}
                                    readOnly
                                  />
                                  <span>{p.title}</span>
                                </label>
                              );
                            })}
                          <button
                            type="button"
                            className="vv-saveManage"
                            onClick={() => nav("/account/playlists")}
                          >
                            Manage playlists →
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      className="vv-btn vv-saveBtn"
                      onClick={goLoginWithResume}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6 3h12v18l-6-4-6 4z" />
                      </svg>
                      Save
                    </button>
                  )}

                  <button className="vv-btn vv-share" onClick={share}>
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" />
                    </svg>
                    Share
                  </button>
                  {isAuthed &&
                  !resumedHere &&
                  !hasUrlResume &&
                  !shouldUseSavedResume &&
                  Number(dbProgressSeconds) >= 15 ? (
                    <button
                      type="button"
                      className="vv-btn vv-resume"
                      onClick={() => {
                        const secs = Math.floor(Number(dbProgressSeconds));
                        const send = playerSendRef.current;
                        // Bunny player (not iPhone): jump inside the player.
                        // No page reload, so the sound stays allowed.
                        if (
                          useBunnyStreamPlayer &&
                          send &&
                          !isAppleTouchDevice()
                        ) {
                          send("setCurrentTime", secs);
                          send("play");
                          iframeEstimatedSecondsRef.current = secs;
                          setResumedHere(true);
                          return;
                        }
                        nav(`/watch/${id}?t=${secs}`, { replace: true });
                        window.setTimeout(() => window.location.reload(), 0);
                      }}
                    >
                      ▶ Resume from {fmtTime(dbProgressSeconds)}
                    </button>
                  ) : null}
                </div>

                <hr className="vv-hr" />

                {/* Comments (kept) */}
                <div className="vv-comments">
                  <h2 className="vv-commentsTitle">
                    Comments{comments.length ? ` (${comments.length})` : ""}
                  </h2>

                  {isAuthed ? (
                    <form onSubmit={postComment}>
                      <textarea
                        rows={3}
                        value={cmtTxt}
                        onChange={(e) => setCmtTxt(e.target.value)}
                        placeholder="Add a comment…"
                        aria-label="Add a comment"
                        style={{
                          width: "100%",
                          background: "#0b1020",
                          color: "#e5e7eb",
                          border: "1px solid rgba(148,163,184,.18)",
                          borderRadius: 8,
                          padding: 8,
                        }}
                      />

                      <div className="vv-commentActions">
                        <button
                          className="vv-btn primary vv-postBtn"
                          disabled={!String(cmtTxt || "").trim()}
                        >
                          Post
                        </button>
                      </div>
                      {cmtErr && (
                        <span style={{ color: "#ef4444" }}>{cmtErr}</span>
                      )}
                    </form>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={goLoginWithResume}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#93c5fd",
                          padding: 0,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Sign in
                      </button>{" "}
                      to comment.
                    </div>
                  )}

                  <div style={{ marginTop: 14 }}>
                    {cmtLoading ? (
                      <div className="vv-muted">Loading comments…</div>
                    ) : comments.length === 0 ? (
                      <div className="vv-muted">No comments yet.</div>
                    ) : (
                      <>
                        {visibleComments.map((c) => (
                          <div
                            key={c.id}
                            style={{
                              borderBottom: "1px solid rgba(148,163,184,.18)",
                              padding: "8px 0",
                            }}
                          >
                            <div style={{ color: "#cbd5e1", fontSize: 13 }}>
                              {c.user_name || "Member"} •{" "}
                              {datePretty(c.created_at)}
                            </div>
                            <div>{c.body}</div>
                          </div>
                        ))}

                        {hasMoreComments && (
                          <button
                            className="vv-btn"
                            onClick={() => setShowAllComments((x) => !x)}
                            style={{ marginTop: 6 }}
                          >
                            {showAllComments
                              ? "Show less"
                              : `Show more (${comments.length - MAX_VISIBLE_COMMENTS})`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside>
            {inPlaylistMode ? (
              <>
                {playlistRest.length > 0 && (
                  <div className="vv-side-card">
                    <div className="vv-side-title">{playlistMeta?.title}</div>
                    <div className="vv-rel">
                      {playlistRest.map((v) => {
                        const dur = secsFromAny(
                          v.duration_seconds ??
                            v.duration_sec ??
                            v.duration ??
                            v?.metadata?.duration,
                        );
                        const thumb = v.thumbnail_url
                          ? absUrl(v.thumbnail_url)
                          : "";
                        const ms = getPublishedMs(v);

                        return (
                          <Link
                            key={v.id}
                            to={`/watch/${v.id}?playlist=${playlistParam}`}
                            className="vv-rel-item"
                          >
                            <div className="vv-thumb">
                              <ThumbImg src={thumb} alt="" />
                              {dur && (
                                <span className="vv-dur">
                                  {formatDuration(dur)}
                                </span>
                              )}
                            </div>
                            <div className="vv-rel-meta">
                              <div className="vv-rel-title">{v.title}</div>
                              <div className="vv-rel-date">
                                {ms
                                  ? datePretty(new Date(ms).toISOString())
                                  : ""}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {(nextVideo || remainingNext.length > 0) && (
                  <div className="vv-side-card">
                    <div
                      className="vv-side-title"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span>Up next</span>

                      <div className="vv-autonext">
                        <span
                          style={{
                            fontSize: 11,
                            color: "#94a3b8",
                            fontWeight: 800,
                          }}
                        >
                          Autoplay
                        </span>
                        <button
                          type="button"
                          className={`vv-toggle ${autoNextOn ? "on" : ""}`}
                          onClick={toggleAutoNext}
                          aria-pressed={autoNextOn}
                          title="Autoplay next video"
                        >
                          <span className="vv-toggle-knob" />
                        </button>
                      </div>
                    </div>

                    <div
                      className={
                        shouldScrollNext ? "vv-side-scroll" : undefined
                      }
                    >
                      {/* Playing row (YouTube-style pinned) */}
                      <div
                        className="vv-rel-item vv-playing"
                        style={{ cursor: "default", pointerEvents: "none" }}
                      >
                        <div className="vv-thumb">
                          <ThumbImg src={poster} alt="" />
                        </div>
                        <div className="vv-rel-meta">
                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "center",
                            }}
                          >
                            <div className="vv-rel-title">{video.title}</div>
                            <span className="vv-playing-pill">Playing</span>
                          </div>
                          <div className="vv-rel-date">
                            {currentPublishedLabel}
                          </div>
                        </div>
                      </div>

                      {nextVideo && (
                        <Link
                          to={`/watch/${nextVideo.id}`}
                          className="vv-rel-item"
                        >
                          <div className="vv-thumb">
                            <ThumbImg
                              src={
                                nextVideo.thumbnail_url
                                  ? absUrl(nextVideo.thumbnail_url)
                                  : ""
                              }
                              alt=""
                            />
                            {(() => {
                              const dur = secsFromAny(
                                nextVideo.duration_seconds ??
                                  nextVideo.duration_sec ??
                                  nextVideo.duration ??
                                  nextVideo?.metadata?.duration,
                              );
                              return dur ? (
                                <span className="vv-dur">
                                  {formatDuration(dur)}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <div className="vv-rel-meta">
                            <div className="vv-rel-title">
                              {nextVideo.title}
                            </div>
                            <div className="vv-rel-date">
                              {(() => {
                                const ms = getPublishedMs(nextVideo);
                                return ms
                                  ? datePretty(new Date(ms).toISOString())
                                  : "";
                              })()}
                            </div>
                          </div>
                        </Link>
                      )}

                      {remainingNext.length > 0 && (
                        <div className="vv-rel">
                          {remainingNext.map((v) => {
                            const thumb = v.thumbnail_url
                              ? absUrl(v.thumbnail_url)
                              : "";
                            const dur = secsFromAny(
                              v.duration_seconds ??
                                v.duration_sec ??
                                v.duration ??
                                v?.metadata?.duration,
                            );
                            const ms = getPublishedMs(v);

                            return (
                              <Link
                                key={v.id}
                                to={`/watch/${v.id}`}
                                className="vv-rel-item"
                              >
                                <div className="vv-thumb">
                                  <ThumbImg src={thumb} alt="" />
                                  {dur && (
                                    <span className="vv-dur">
                                      {formatDuration(dur)}
                                    </span>
                                  )}
                                </div>
                                <div className="vv-rel-meta">
                                  <div className="vv-rel-title">{v.title}</div>
                                  <div className="vv-rel-date">
                                    {ms
                                      ? datePretty(new Date(ms).toISOString())
                                      : ""}
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {relatedVideos.length > 0 && (
                  <div className="vv-side-card">
                    <div className="vv-side-title">Related</div>
                    <div className="vv-rel">
                      {relatedVideos.map((v) => {
                        const thumb = v.thumbnail_url
                          ? absUrl(v.thumbnail_url)
                          : "";
                        const dur = secsFromAny(
                          v.duration_seconds ??
                            v.duration_sec ??
                            v.duration ??
                            v?.metadata?.duration,
                        );
                        const ms = getPublishedMs(v);

                        return (
                          <Link
                            key={v.id}
                            to={`/watch/${v.id}`}
                            className="vv-rel-item"
                          >
                            <div className="vv-thumb">
                              <ThumbImg src={thumb} alt="" />
                              {dur && (
                                <span className="vv-dur">
                                  {formatDuration(dur)}
                                </span>
                              )}
                            </div>
                            <div className="vv-rel-meta">
                              <div className="vv-rel-title">{v.title}</div>
                              <div className="vv-rel-date">
                                {ms
                                  ? datePretty(new Date(ms).toISOString())
                                  : ""}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
