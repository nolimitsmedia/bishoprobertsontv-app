// src/pages/public/Community.js
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import api from "../../api";
import PostCard from "../../components/community/PostCard";
import "./Community.css";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function getStoredRole() {
  return (
    localStorage.getItem("role") ||
    sessionStorage.getItem("role") ||
    ""
  ).toLowerCase();
}

// ✅ Build an API origin from axios baseURL so we can convert /uploads/... to absolute
const API_ORIGIN = (() => {
  try {
    const u = new URL(api.defaults.baseURL || "", window.location.href);
    return u.origin || window.location.origin;
  } catch {
    return window.location.origin;
  }
})();

function absUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("//")) return window.location.protocol + raw;
  if (raw.startsWith("/")) return API_ORIGIN + raw;
  return API_ORIGIN + "/" + raw.replace(/^\.\//, "");
}

// ✅ Normalize image/media url for PostCard (without changing UI/layout)
function normalizePostMedia(p) {
  const raw =
    p?.media_url ||
    p?.image_url ||
    p?.image ||
    p?.media ||
    p?.imageUrl ||
    p?.mediaUrl ||
    "";

  if (!raw) return p;

  const fixed = absUrl(raw);

  // Keep original fields, but ensure PostCard has a working media_url
  return {
    ...p,
    media_url: fixed,
  };
}

/* -----------------------------------------
   Modern Loading Spinner (MUI-like, no deps)
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
        @keyframes brtv-shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
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

      <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 13 }}>
        {label}
      </div>
    </div>
  );
}

/* -----------------------------------------
   Skeleton UI (Card + Lines + Chips)
----------------------------------------- */
function ShimmerBlock({ style }) {
  return (
    <div
      style={{
        borderRadius: 10,
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 100%)",
        backgroundSize: "200% 100%",
        animation: "brtv-shimmer 1.2s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

function SkeletonPostCard() {
  // Try to mimic typical PostCard feel: media + title + short desc lines
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(0,0,0,0.35)",
        padding: 14,
      }}
    >
      <ShimmerBlock style={{ width: "100%", height: 190, borderRadius: 14 }} />
      <div style={{ height: 12 }} />
      <ShimmerBlock style={{ width: "62%", height: 14, borderRadius: 8 }} />
      <div style={{ height: 10 }} />
      <ShimmerBlock style={{ width: "92%", height: 12, borderRadius: 8 }} />
      <div style={{ height: 8 }} />
      <ShimmerBlock style={{ width: "78%", height: 12, borderRadius: 8 }} />
      <div style={{ height: 14 }} />
      <div style={{ display: "flex", gap: 10 }}>
        <ShimmerBlock style={{ width: 70, height: 26, borderRadius: 999 }} />
        <ShimmerBlock style={{ width: 92, height: 26, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function SkeletonChipRow({ count = 8 }) {
  return (
    <div className="comm-channel-list">
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerBlock
          key={i}
          style={{
            height: 32,
            borderRadius: 999,
            width: i % 3 === 0 ? 120 : i % 3 === 1 ? 90 : 140,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />
      ))}
    </div>
  );
}

export default function Community() {
  const navigate = useNavigate();
  const qs = useQuery();

  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);

  // loading states
  const [loadingPosts, setLoadingPosts] = useState(true); // initial feed load
  const [loadingMore, setLoadingMore] = useState(false); // "Load more" only
  const [loadingChannels, setLoadingChannels] = useState(true);

  const [channels, setChannels] = useState([]);
  const [channelSearch, setChannelSearch] = useState("");

  const isAdmin = getStoredRole() === "admin";
  const activeChannelSlug = qs.get("channel") || qs.get("channel_slug") || "";

  // load channels
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoadingChannels(true);
      try {
        const { data } = await api.get("/community/channels");
        if (!isMounted) return;
        setChannels(data.items || []);
      } catch (e) {
        /* silent */
      } finally {
        if (isMounted) setLoadingChannels(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // load posts
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoadingPosts(true);
      try {
        const params = { limit: 10 };
        if (activeChannelSlug) params.channel = activeChannelSlug;

        const { data } = await api.get("/community/posts", { params });
        if (!isMounted) return;

        const normalized = (data.items || []).map(normalizePostMedia);

        setItems(normalized);
        setNextCursor(data.nextCursor || null);
      } catch (e) {
        console.error("feed load error", e);
      } finally {
        if (isMounted) setLoadingPosts(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [activeChannelSlug]);

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = { limit: 10, cursor: nextCursor };
      if (activeChannelSlug) params.channel = activeChannelSlug;

      const { data } = await api.get("/community/posts", { params });

      const normalized = (data.items || []).map(normalizePostMedia);

      setItems((prev) => [...prev, ...(normalized || [])]);
      setNextCursor(data.nextCursor || null);
    } catch (e) {
      console.error("feed load error", e);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleLiked(postId, liked) {
    setItems((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              likes_count: Math.max(0, (p.likes_count || 0) + (liked ? 1 : -1)),
            }
          : p
      )
    );
  }

  async function handleDelete(post) {
    if (!isAdmin) return;
    const ok = window.confirm("Delete this post?");
    if (!ok) return;
    try {
      await api.delete(`/community/posts/${post.id}`);
      setItems((prev) => prev.filter((p) => p.id !== post.id));
    } catch (e) {
      alert("Delete failed.");
      console.error(e);
    }
  }

  function handleEdit(post) {
    if (!isAdmin) return;
    navigate(`/community/new?edit=${post.id}`);
  }

  function setChannel(slug) {
    const params = new URLSearchParams(window.location.search);
    if (slug) params.set("channel", slug);
    else params.delete("channel");
    navigate(`/community?${params.toString()}`, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const filteredChannels = useMemo(() => {
    const q = channelSearch.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) || c.slug?.toLowerCase().includes(q)
    );
  }, [channelSearch, channels]);

  // split pinned vs normal
  const pinnedPosts = items.filter((p) => p.is_pinned);
  const normalPosts = items.filter((p) => !p.is_pinned);

  return (
    <div className="comm-wrap">
      <div className="comm-layout">
        {/* Sidebar */}
        <aside className="comm-sidebar">
          <h4>Search in Community</h4>
          <input
            className="comm-input"
            placeholder="Search channels"
            value={channelSearch}
            onChange={(e) => setChannelSearch(e.target.value)}
          />

          <h4 style={{ marginTop: 14 }}>Channels</h4>

          {/* ✅ Skeleton chips while channels load */}
          {loadingChannels ? (
            <SkeletonChipRow count={9} />
          ) : (
            <div className="comm-channel-list">
              {filteredChannels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  className={`comm-chip ${
                    activeChannelSlug === ch.slug ? "is-active" : ""
                  }`}
                  onClick={() => setChannel(ch.slug)}
                  title={ch.slug}
                >
                  {ch.name || ch.slug}
                </button>
              ))}
              {!!activeChannelSlug && (
                <button
                  className="comm-chip"
                  type="button"
                  onClick={() => setChannel("")}
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
        </aside>

        {/* Main feed */}
        <main className="comm-main">
          <div className="comm-header">
            <div className="comm-title">Community Feed</div>
            {isAdmin && (
              <Link className="comm-btn comm-btn--primary" to="/community/new">
                New post
              </Link>
            )}
          </div>

          {/* ✅ Modern spinner while initial posts are loading */}
          {loadingPosts && (
            <div style={{ margin: "8px 0 14px" }}>
              <CircularSpinner label="Loading community feed…" />
            </div>
          )}

          {/* Pinned section */}
          <div className="comm-pinned">
            <strong>★ PINNED POSTS</strong>

            {loadingPosts ? (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <SkeletonPostCard />
              </div>
            ) : pinnedPosts.length === 0 ? (
              <p style={{ marginTop: 4, color: "#6b7280", fontSize: 13 }}>
                No pinned announcements.
              </p>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {pinnedPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={{
                      ...post,
                      can_edit: isAdmin,
                      can_delete: isAdmin,
                    }}
                    onLike={handleLiked}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Normal posts */}
          {loadingPosts ? (
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <SkeletonPostCard />
              <SkeletonPostCard />
              <SkeletonPostCard />
            </div>
          ) : (
            normalPosts.map((post) => (
              <PostCard
                key={post.id}
                post={{
                  ...post,
                  can_edit: isAdmin,
                  can_delete: isAdmin,
                }}
                onLike={(id, liked) => handleLiked(id, liked)}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          )}

          <div className="comm-load">
            {nextCursor ? (
              <button
                className="comm-btn"
                disabled={loadingMore}
                onClick={handleLoadMore}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {loadingMore ? (
                  <>
                    <span style={{ display: "inline-block" }}>
                      <CircularSpinner size={26} label="" />
                    </span>
                    <span>Loading…</span>
                  </>
                ) : (
                  "Load more"
                )}
              </button>
            ) : (
              <span style={{ color: "#6b7280", fontSize: 13 }}>
                {items.length ? "You've reached the end." : "No posts yet."}
              </span>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
