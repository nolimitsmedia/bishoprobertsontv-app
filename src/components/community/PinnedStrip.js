// src/components/community/PinnedStrip.jsx
import React, { useEffect, useState } from "react";
import api from "../../api";
import PostCard from "./PostCard";

export default function PinnedStrip({ channel, q, isAdmin, me }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "10");
        params.set("pinnedOnly", "true");
        if (channel) params.set("channel", channel);
        if (q) params.set("q", q);
        const { data } = await api.get(`/community/posts?${params.toString()}`);
        if (!cancelled) setItems(data?.items || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => (cancelled = true);
  }, [channel, q]);

  if (loading && items.length === 0) return null;
  if (!items.length) return null;

  return (
    <section style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "#3b82f6",
          margin: "0 0 8px",
        }}
      >
        ★ PINNED POSTS
      </div>
      {items.map((post) => (
        <PostCard
          key={`pin-${post.id}`}
          post={post}
          isAdmin={isAdmin}
          me={me}
        />
      ))}
    </section>
  );
}
