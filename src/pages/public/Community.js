import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

export default function Community() {
  const navigate = useNavigate();
  const qs = useQuery();

  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState([]);
  const [channelSearch, setChannelSearch] = useState("");

  const isAdmin = getStoredRole() === "admin";
  const activeChannelSlug = qs.get("channel") || qs.get("channel_slug") || "";

  // load channels
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { data } = await api.get("/community/channels");
        if (!isMounted) return;
        setChannels(data.items || []);
      } catch (e) {
        /* silent */
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
      setLoading(true);
      try {
        const params = { limit: 10 };
        if (activeChannelSlug) params.channel = activeChannelSlug;
        const { data } = await api.get("/community/posts", { params });
        if (!isMounted) return;
        setItems(data.items || []);
        setNextCursor(data.nextCursor || null);
      } catch (e) {
        console.error("feed load error", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [activeChannelSlug]);

  async function handleLoadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    try {
      const params = { limit: 10, cursor: nextCursor };
      if (activeChannelSlug) params.channel = activeChannelSlug;
      const { data } = await api.get("/community/posts", { params });
      setItems((prev) => [...prev, ...(data.items || [])]);
      setNextCursor(data.nextCursor || null);
    } catch (e) {
      console.error("feed load error", e);
    } finally {
      setLoading(false);
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
        </aside>

        {/* Main feed */}
        <main className="comm-main">
          <div className="comm-header">
            <div className="comm-title">Community Feed</div>
            {isAdmin && (
              <a className="comm-btn comm-btn--primary" href="/community/new">
                New post
              </a>
            )}
          </div>

          {/* Pinned section */}
          <div className="comm-pinned">
            <strong>★ PINNED POSTS</strong>
            {pinnedPosts.length === 0 ? (
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
                    // tiny style tweak: make pinned look slightly different?
                  />
                ))}
              </div>
            )}
          </div>

          {/* Normal posts */}
          {normalPosts.map((post) => (
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
          ))}

          <div className="comm-load">
            {nextCursor ? (
              <button
                className="comm-btn"
                disabled={loading}
                onClick={handleLoadMore}
              >
                {loading ? "Loading…" : "Load more"}
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
