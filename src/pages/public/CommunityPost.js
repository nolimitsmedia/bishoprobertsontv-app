import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import api from "../../api";
import Markdown from "../../components/community/Markdown"; // your markdown helper

function useAuthToken() {
  return (
    localStorage.getItem("token") || sessionStorage.getItem("token") || null
  );
}

export default function CommunityPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthToken();
  const isAuthed = !!token;

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [commentText, setCommentText] = useState("");

  const nextUrl = useMemo(
    () => encodeURIComponent(location.pathname + location.search),
    [location.pathname, location.search]
  );

  // fetch single post
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        // try via list endpoint
        const { data } = await api
          .get(`/community/posts?limit=1&cursor=&channel_id=&post_id=${id}`)
          .catch(() => ({ data: null }));

        let p = data?.items?.[0];

        // fallback direct endpoint
        if (!p) {
          const resp = await api
            .get(`/community/posts/${id}`)
            .catch(() => null);
          p = resp?.data?.post || null;
        }

        if (!ignore) setPost(p || null);
      } catch (e) {
        if (!ignore) setPost(null);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  // fetch comments
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!id) return;
      try {
        const { data } = await api.get(`/community/posts/${id}/comments`);
        if (!ignore) setComments(data.items || []);
      } catch {
        if (!ignore) setComments([]);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isAuthed) {
      navigate(`/login?next=${nextUrl}`);
      return;
    }
    const text = commentText.trim();
    if (!text) return;

    try {
      setSubmitting(true);
      const { data } = await api.post(`/community/posts/${id}/comments`, {
        body: text,
      });
      setComments((prev) => [...prev, data.comment]);
      setCommentText("");
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        navigate(`/login?next=${nextUrl}`);
        return;
      }
      console.error("comment failed", err);
      alert("Couldn't post your comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div
        className="container"
        style={{
          minHeight: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p>Loading…</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container" style={{ minHeight: 300, padding: 16 }}>
        <h3>Post not found</h3>
        <Link
          to="/community"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#f1f5f9",
            color: "#0f172a",
            padding: "6px 14px",
            borderRadius: 999,
            textDecoration: "none",
          }}
        >
          <span>←</span> Back to Community
        </Link>
      </div>
    );
  }

  const createdAt = post?.created_at ? new Date(post.created_at) : null;
  const when =
    createdAt &&
    createdAt.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "20px 12px 50px",
      }}
    >
      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
        }}
      >
        {/* Back button */}
        <div style={{ marginBottom: 16 }}>
          <Link
            to="/community"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#e2e8f0",
              color: "#0f172a",
              padding: "6px 14px",
              borderRadius: 999,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            <span style={{ fontSize: 16 }}>←</span>
            Back
          </Link>
        </div>

        {/* Post card */}
        <article
          className="comm-card"
          style={{
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
            padding: 20,
            marginBottom: 20,
            border: "1px solid rgba(148, 163, 184, 0.25)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {post?.author_name || "Member"}
            </div>
            {!!when && <div style={{ opacity: 0.6, fontSize: 12 }}>{when}</div>}
          </div>

          {/* Image */}
          {post?.media_url && (
            <div style={{ marginBottom: 14 }}>
              <img
                src={post.media_url}
                alt=""
                loading="lazy"
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: 12,
                  display: "block",
                  objectFit: "cover",
                }}
              />
            </div>
          )}

          {/* Title */}
          {!!post?.title && (
            <h3
              style={{
                margin: "0 0 10px 0",
                fontSize: 22,
                color: "#0f172a",
              }}
            >
              {post.title}
            </h3>
          )}

          {/* Body */}
          {post?.body && (
            <div
              style={{
                color: "#111827",
                lineHeight: 1.6,
                marginBottom: 4,
                fontSize: 15,
              }}
            >
              <Markdown>{post.body}</Markdown>
            </div>
          )}
        </article>

        {/* Comments */}
        <section
          aria-label="Comments"
          style={{
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
            padding: 20,
            border: "1px solid rgba(148, 163, 184, 0.25)",
          }}
        >
          <h4 style={{ margin: "0 0 12px 0" }}>
            Comments {comments.length ? `(${comments.length})` : ""}
          </h4>

          {/* Comment form or login prompt */}
          {isAuthed ? (
            <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
              <textarea
                placeholder="Write a comment…"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  resize: "vertical",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  outline: "none",
                  background: "#f8fafc",
                }}
              />
              <div style={{ marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={submitting || !commentText.trim()}
                  style={{
                    background: "#2563eb",
                    color: "#fff",
                    border: "none",
                    borderRadius: 999,
                    padding: "8px 16px",
                    cursor: "pointer",
                    opacity: submitting || !commentText.trim() ? 0.6 : 1,
                    fontWeight: 500,
                  }}
                >
                  {submitting ? "Posting…" : "Post comment"}
                </button>
              </div>
            </form>
          ) : (
            <div
              style={{
                border: "1px dashed #e2e8f0",
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
                background: "#f8fafc",
              }}
            >
              <p style={{ margin: 0 }}>
                You must be logged in to comment.{" "}
                <button
                  onClick={() => navigate(`/login?next=${nextUrl}`)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    textDecoration: "underline",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Log in
                </button>
              </p>
            </div>
          )}

          {/* Comment list (scrollable) */}
          <div
            style={{
              maxHeight: 320, // adjust if you want shorter/taller
              overflowY: "auto",
              margin: "0 -20px 0 -20px", // stretch to card edges
              padding: "0 20px 0 20px",
            }}
          >
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {comments.map((c) => {
                const cAt = c?.created_at ? new Date(c.created_at) : null;
                const cWhen =
                  cAt &&
                  cAt.toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                return (
                  <li
                    key={c.id}
                    style={{
                      borderTop: "1px solid #f1f5f9",
                      padding: "12px 0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <strong>{c.author_name || "Member"}</strong>
                      <span style={{ opacity: 0.6, fontSize: 12 }}>
                        {cWhen}
                      </span>
                    </div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
                  </li>
                );
              })}
              {!comments.length && (
                <li style={{ opacity: 0.7 }}>
                  No comments yet — be the first!
                </li>
              )}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
