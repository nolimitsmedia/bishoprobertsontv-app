// src/components/community/Feed.js
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import PostCard from "./PostCard";

export default function Feed({ channel = "", isAdmin = false, onOpenPost }) {
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);

  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    setInitial(true);
  }, [channel]);

  useEffect(() => {
    loadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  async function loadMore(isFirst = false) {
    if (loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "10");
      if (channel) params.set("channel", channel);
      if (!isFirst && nextCursor) params.set("cursor", nextCursor);

      const { data } = await api.get(`/community/posts?${params.toString()}`);
      const got = data?.items || [];
      setItems((prev) =>
        isFirst
          ? got
          : [...prev, ...got.filter((n) => !prev.some((p) => p.id === n.id))]
      );
      setNextCursor(data?.nextCursor || null);
    } catch (e) {
      console.error("feed load error", e);
    } finally {
      setLoading(false);
    }
  }

  const pinned = useMemo(() => items.filter((i) => !!i.is_pinned), [items]);
  const regular = useMemo(() => items.filter((i) => !i.is_pinned), [items]);

  function applyUpdated(updated) {
    if (!updated) return;
    setItems((prev) =>
      prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
    );
  }

  function applyDeleted(id) {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div>
      {/* Pinned */}
      <div className="card" style={{ marginBottom: 16, padding: 12 }}>
        <div
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            color: "#6b7280",
            fontWeight: 700,
          }}
        >
          ★ Pinned posts
        </div>
        {pinned.length === 0 ? (
          <div style={{ paddingTop: 8, color: "#6b7280" }}>
            No pinned announcements.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
            {pinned.map((p) => (
              <PostCard
                key={`pin-${p.id}`}
                post={p}
                isAdmin={isAdmin}
                onComment={() => onOpenPost?.(p.id)}
                onOpen={() => onOpenPost?.(p.id)}
                onLike={() =>
                  setItems((prev) =>
                    prev.map((x) =>
                      x.id === p.id
                        ? { ...x, likes_count: (x.likes_count || 0) + 1 }
                        : x
                    )
                  )
                }
                onUpdated={applyUpdated}
                onDeleted={applyDeleted}
              />
            ))}
          </div>
        )}
      </div>

      {/* Regular */}
      <div style={{ display: "grid", gap: 12 }}>
        {regular.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            isAdmin={isAdmin}
            onComment={() => onOpenPost?.(p.id)}
            onOpen={() => onOpenPost?.(p.id)}
            onLike={() =>
              setItems((prev) =>
                prev.map((x) =>
                  x.id === p.id
                    ? { ...x, likes_count: (x.likes_count || 0) + 1 }
                    : x
                )
              )
            }
            onUpdated={applyUpdated}
            onDeleted={applyDeleted}
          />
        ))}
      </div>

      {/* Load more */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
        {nextCursor ? (
          <button
            className="btn btn-light"
            onClick={() => loadMore(false)}
            disabled={loading}
            style={{ color: "#111" }}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : (
          !loading &&
          items.length > 0 && (
            <div style={{ color: "#6b7280", padding: 8 }}>
              You’re all caught up.
            </div>
          )
        )}
      </div>
    </div>
  );
}
