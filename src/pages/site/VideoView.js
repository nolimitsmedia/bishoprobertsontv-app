// src/pages/site/VideoView.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../../api";
import "./VideoView.css";
import BishopRobertsonTVLogo from "../../assets/BishopRobertsonTVLogo.png";

const MAX_VISIBLE_COMMENTS = 6;
const isLocalhost = ["localhost", "127.0.0.1"].includes(
  window.location.hostname,
);
const log = (...args) => {
  if (isLocalhost) console.log("[VideoView]", ...args);
};

/* ---------------- resume / progress helpers ---------------- */
const PROGRESS_SAVE_MS = 3000;

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
  const finalSrc = !src || bad ? BishopRobertsonTVLogo : src;

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
  const [resources, setResources] = useState([]);

  const [categoryVideos, setCategoryVideos] = useState([]);
  const [moreGlobal, setMoreGlobal] = useState([]);

  const [playlistMeta, setPlaylistMeta] = useState(null);
  const [playlistRest, setPlaylistRest] = useState([]);

  const [isAuthed, setIsAuthed] = useState(false);
  const [previewHit, setPreviewHit] = useState(false);

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

  // build next path (preserves playlist param etc.)
  const watchPath = useMemo(
    () => loc.pathname + loc.search,
    [loc.pathname, loc.search],
  );
  const loginBase = useMemo(() => {
    const next = encodeURIComponent(watchPath || `/watch/${id}`);
    return `/login?next=${next}`;
  }, [watchPath, id]);

  function currentSecondsNow() {
    const el = videoRef.current;
    if (!el) return Math.floor(lastWatchSecondsRef.current || 0);
    const cur = Number(el.currentTime || 0);
    if (Number.isFinite(cur) && cur > 0) return Math.floor(cur);
    return Math.floor(lastWatchSecondsRef.current || 0);
  }

  function goLoginWithResume() {
    const t = currentSecondsNow();
    writeProgressSeconds(id, t);
    nav(`${loginBase}${t ? `&t=${t}` : ""}`);
  }

  const srcUrl = useMemo(
    () => (video?.video_url ? absUrl(video.video_url) : ""),
    [video?.video_url],
  );

  // main poster fallback
  const poster = useMemo(() => {
    const p = video?.thumbnail_url ? absUrl(video.thumbnail_url) : "";
    return p || BishopRobertsonTVLogo;
  }, [video?.thumbnail_url]);

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

  const previewActive = !isAuthed && previewSeconds > 0;
  const hardLoginGate = !isAuthed && !srcUrl;

  /* ------------ analytics state (refs) -------------- */
  const playSentRef = useRef(false);
  const completeSentRef = useRef(false);
  const lastPingAtRef = useRef(0);

  const lastPosRef = useRef(null);
  const analyticsInFlightRef = useRef(false);
  const endedHandledRef = useRef(false);

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

    setVideoErr(false);

    // reset youtube autoplay state
    autoNavRef.current = false;
    setUpNextCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
  }, [id]);

  /* ------------ AUTH -------------- */
  useEffect(() => {
    const token = getAnyToken();
    const hasToken = !!token;
    setIsAuthed(hasToken);

    if (isLocalhost) log("auth token present:", hasToken);
    if (!hasToken) return;

    api
      .get("/auth/me")
      .then((r) => {
        if (isLocalhost) log("/auth/me ok:", r?.status);
        setIsAuthed(true);
      })
      .catch((e) => {
        if (isLocalhost)
          log("/auth/me failed (keeping authed):", e?.response?.status);
        setIsAuthed(true);
      });
  }, []);

  /* ------------ LOAD VIDEO -------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const data =
          (await tryGetFirst([`/videos/public/${id}`])) ||
          (await tryGetFirst([`/videos/${id}`]));
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
  }, [id]);

  /* ------------ LOAD CATEGORY VIDEOS -------------- */
  useEffect(() => {
    if (!video?.category_id) return;

    (async () => {
      try {
        const res =
          (await tryGetFirst([
            `/videos/public?category_id=${video.category_id}&limit=200`,
          ])) ||
          (await tryGetFirst([
            `/videos?category_id=${video.category_id}&limit=200`,
          ]));

        const items = Array.isArray(res?.items) ? res.items : res || [];
        const sorted = [...items].sort(sortLatestToOldestByPublished);

        setCategoryVideos(sorted);
        log("Category videos:", sorted);
      } catch (e) {
        log("Category load failed", e);
        setCategoryVideos([]);
      }
    })();
  }, [video?.category_id]);

  /* ------------ GLOBAL FALLBACK -------------- */
  useEffect(() => {
    if (!id) return;
    (async () => {
      const data =
        (await tryGetFirst([`/videos/public?limit=200`])) ||
        (await tryGetFirst([`/videos?limit=200`]));
      const arr = Array.isArray(data) ? data : data?.items || [];
      const sorted = [...arr].sort(sortLatestToOldestByPublished);

      setMoreGlobal(sorted.filter((v) => String(v.id) !== String(id)));
      log("Global fallback list:", sorted);
    })();
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
    api
      .get(`/resources/by-video/${id}`)
      .then((r) => setResources(r.data?.items || []))
      .catch(() => setResources([]));
  }, [id]);

  /* ------------ PLAYLISTS (for "+ Add to playlist") -------------- */
  useEffect(() => {
    let alive = true;

    if (!isAuthed) {
      setMyPlaylists([]);
      setMemberOf(new Set());
      return;
    }

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
  }, [isAuthed, id]);

  /* ------------ HLS SETUP (improved + recovery) -------------- */
  useEffect(() => {
    const el = videoRef.current;

    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }

    if (!el || !srcUrl) return;
    const hls = isHlsUrl(srcUrl);

    if (hls && el.canPlayType("application/vnd.apple.mpegURL")) {
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
            el.src = srcUrl;
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
  }, [srcUrl]);

  /* ------------ PREVIEW GATE -------------- */
  useEffect(() => {
    setPreviewHit(false);
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
      if (el.currentTime > previewSeconds) clampPreview();
    };

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("seeking", onSeek);

    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("seeking", onSeek);
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
      }
    };

    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [id]);

  /* ------------ RESTORE PROGRESS (robust for HLS) -------------- */
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !id || !srcUrl) return;
    if (restoredRef.current) return;

    const qs = new URLSearchParams(loc.search);
    const tFromUrl = Number(qs.get("t"));
    const tFromStorage = readProgressSeconds(id);

    let desired =
      Number.isFinite(tFromUrl) && tFromUrl > 0 ? tFromUrl : tFromStorage;

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

  /* ------------ YOUTUBE-STYLE MAIN AUTOPLAY -------------- */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (!srcUrl) return;
    if (hardLoginGate) return;
    if (previewActive && previewHit) return;

    // reset countdown if user starts playing again
    setUpNextCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    autoNavRef.current = false;

    const attempt = async () => {
      try {
        const interacted = (() => {
          try {
            return localStorage.getItem("vv_user_interacted") === "true";
          } catch {
            return false;
          }
        })();

        // YouTube-like: try unmuted if user interacted; otherwise try muted
        if (!interacted) el.muted = true;

        const p = el.play();
        if (p && typeof p.then === "function") await p;
      } catch {
        // fallback: try muted autoplay
        try {
          el.muted = true;
          const p2 = el.play();
          if (p2 && typeof p2.then === "function") await p2;
        } catch {}
      }
    };

    // slight delay to allow HLS attach / metadata
    const t = setTimeout(attempt, 60);
    return () => clearTimeout(t);
  }, [id, srcUrl, hardLoginGate, previewActive, previewHit]);

  /* ------------ YOUTUBE-STYLE AUTOPLAY NEXT -------------- */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const clearCountdown = () => {
      setUpNextCountdown(0);
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = null;
    };

    const startCountdownAndGo = (targetUrl) => {
      if (!targetUrl) return;
      if (autoNavRef.current) return;
      autoNavRef.current = true;

      let s = 5;
      setUpNextCountdown(s);

      countdownRef.current = setInterval(() => {
        s -= 1;
        setUpNextCountdown(s);

        if (s <= 0) {
          clearCountdown();
          nav(targetUrl);
        }
      }, 1000);
    };

    const onEnded = () => {
      if (!autoNextOn) return;
      if (hardLoginGate) return;
      if (previewActive) return;

      // Prefer playlist continuation when in playlist mode
      if (inPlaylistMode && playlistRest && playlistRest.length > 0) {
        const nxt = playlistRest[0];
        startCountdownAndGo(`/watch/${nxt.id}?playlist=${playlistParam}`);
        return;
      }

      // Otherwise go to Up Next
      if (nextVideo?.id) {
        startCountdownAndGo(`/watch/${nextVideo.id}`);
      }
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
                  playsInline
                  preload="metadata"
                  crossOrigin="anonymous"
                  controlsList="nodownload"
                  disablePictureInPicture
                  onContextMenu={(e) => e.preventDefault()}
                  onError={() => setVideoErr(true)}
                  onLoadedData={() => setVideoErr(false)}
                />

                {/* fallback image layer */}
                {(hardLoginGate || !srcUrl || videoErr) && (
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
                      src={BishopRobertsonTVLogo}
                      alt=""
                      style={{
                        width: "min(420px, 60%)",
                        opacity: 0.92,
                        filter: "drop-shadow(0 18px 60px rgba(0,0,0,.55))",
                      }}
                    />
                  </div>
                )}

                {/* Up Next countdown overlay (YouTube-like) */}
                {upNextCountdown > 0 && (
                  <div
                    className="vv-upnext-overlay"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="vv-upnext-card">
                      <div className="vv-upnext-title">Up next</div>
                      <div className="vv-upnext-sub">
                        Playing next in <strong>{upNextCountdown}</strong>s
                      </div>
                      <div className="vv-upnext-actions">
                        <button className="vv-btn" onClick={cancelUpNext}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {(hardLoginGate || (previewActive && previewHit)) && (
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
                <div className="vv-row">
                  <button className="vv-btn" onClick={() => nav(-1)}>
                    ← Back
                  </button>

                  {isAuthed ? (
                    <div className="vv-pop">
                      <button
                        className="vv-btn"
                        onClick={() => setShowPL((s) => !s)}
                      >
                        + Add to playlist
                      </button>

                      {showPL && (
                        <div className="vv-popmenu">
                          {plLoading && (
                            <div className="vv-muted">Loading…</div>
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
                        </div>
                      )}
                    </div>
                  ) : (
                    <button className="vv-btn" onClick={goLoginWithResume}>
                      + Add to playlist
                    </button>
                  )}

                  <button className="vv-btn vv-share" onClick={share}>
                    📤 Share
                  </button>
                </div>

                <h1 className="vv-h1">{video.title}</h1>

                <div className="vv-byline">
                  {author && <span className="vv-badge">{author}</span>}
                  {currentPublishedLabel && (
                    <span>{currentPublishedLabel}</span>
                  )}
                </div>

                <hr className="vv-hr" />

                {/* Comments (kept) */}
                <div>
                  <strong>Comments</strong>

                  {isAuthed ? (
                    <form onSubmit={postComment}>
                      <textarea
                        rows={3}
                        value={cmtTxt}
                        onChange={(e) => setCmtTxt(e.target.value)}
                        placeholder="Write a comment…"
                        style={{
                          width: "100%",
                          background: "#0b1020",
                          color: "#e5e7eb",
                          border: "1px solid rgba(148,163,184,.18)",
                          borderRadius: 8,
                          padding: 8,
                        }}
                      />

                      <button
                        className="vv-btn primary"
                        style={{ marginTop: 6 }}
                      >
                        Post
                      </button>
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
