// src/components/community/PostCard.jsx
import React, { useState } from "react";
import api from "../../api";
import Markdown from "./Markdown";
import "./PostCard.css";

export default function PostCard({ post, onLike, onEdit, onDelete }) {
  const [liking, setLiking] = useState(false);

  const createdAt = post?.created_at ? new Date(post.created_at) : null;
  const when = createdAt
    ? createdAt.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  async function handleLike() {
    if (!post?.id || liking) return;
    try {
      setLiking(true);
      const { data } = await api.post(`/community/posts/${post.id}/like`);
      // optimistic notify parent to update count
      onLike?.(post.id, data?.liked === true);
    } catch (e) {
      console.error("like failed", e);
    } finally {
      setLiking(false);
    }
  }

  return (
    <article className="comm-card">
      {/* Header */}
      <div className="comm-card__head">
        <div className="comm-author">{post?.author_name || "Member"}</div>
        {!!when && <div className="comm-date">{when}</div>}
      </div>

      {/* Media (clickable to detail) */}
      {post?.media_url && (
        <a className="comm-card__media" href={`/community/${post.id}`}>
          <img src={post.media_url} alt="" loading="lazy" />
        </a>
      )}

      {/* Title under the image (also clickable) */}
      {post?.title && (
        <a href={`/community/${post.id}`} className="comm-card__title">
          {post.title}
        </a>
      )}

      {/* Body (markdown) */}
      {post?.body && (
        <div className="comm-card__body">
          <Markdown>{post.body}</Markdown>
        </div>
      )}

      {/* Actions */}
      <div className="comm-card__actions">
        <div className="comm-actions-left">
          <button
            onClick={handleLike}
            disabled={liking}
            className={`comm-btn ${liking ? "is-disabled" : ""}`}
            title="Like"
          >
            ♥ Like
            <span className="badge">{post?.likes_count ?? 0}</span>
          </button>

          <a
            href={`/community/${post?.id}`}
            className="comm-btn"
            title="View & comment"
          >
            💬 Comment
            {post?.comments_count ? (
              <span className="badge">{post.comments_count}</span>
            ) : null}
          </a>
        </div>

        {(post?.can_edit || post?.can_delete) && (
          <div className="comm-actions-right">
            {post?.can_edit && (
              <button className="comm-btn" onClick={() => onEdit?.(post)}>
                Edit
              </button>
            )}
            {post?.can_delete && (
              <button
                className="comm-btn comm-btn--danger"
                onClick={() => onDelete?.(post)}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
