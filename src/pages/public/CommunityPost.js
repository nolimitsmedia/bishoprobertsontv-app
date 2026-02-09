// src/pages/public/CommunityPost.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import api from "../../api";
import Markdown from "../../components/community/Markdown";
import "./CommunityPost.css";

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

  // fetch single post (✅ always use the correct endpoint)
  useEffect(() => {
    let ignore = false;

    (async () => {
      if (!id) {
        if (!ignore) {
          setPost(null);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);

        const resp = await api.get(`/community/posts/${id}`);
        const p = resp?.data?.post || null;

        if (!ignore) setPost(p);
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
      <div className="cp-root">
        <div className="cp-container">
          <div className="cp-loading">Loading…</div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="cp-root">
        <div className="cp-container">
          <div className="cp-topbar">
            <Link to="/community" className="cp-btn cp-btn--ghost">
              ← Back to Community
            </Link>
          </div>

          <div className="cp-card">
            <h3 className="cp-notfound-title">Post not found</h3>
            <p className="cp-muted">
              This post may have been removed or you may not have access.
            </p>
          </div>
        </div>
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
    <div className="cp-root">
      <div className="cp-container">
        {/* Top bar */}
        <div className="cp-topbar">
          <Link to="/community" className="cp-btn cp-btn--ghost">
            ← Back
          </Link>

          <div className="cp-topmeta">
            <div className="cp-pill">Community</div>
          </div>
        </div>

        {/* Post */}
        <article className="cp-card cp-post">
          <header className="cp-posthead">
            <div className="cp-author">
              {post?.author_name || "Member"}
              <span className="cp-dot">•</span>
              <span className="cp-date">{when || ""}</span>
            </div>

            {!!post?.channel_slug && (
              <div className="cp-chip">#{post.channel_slug}</div>
            )}
          </header>

          {post?.media_url && (
            <div className="cp-media">
              <img src={post.media_url} alt="" loading="lazy" />
            </div>
          )}

          {!!post?.title && <h1 className="cp-title">{post.title}</h1>}

          {post?.body && (
            <div className="cp-body">
              <Markdown>{post.body}</Markdown>
            </div>
          )}
        </article>

        {/* Comments */}
        <section className="cp-card cp-comments" aria-label="Comments">
          <div className="cp-comments-head">
            <h2 className="cp-comments-title">
              Comments {comments.length ? `(${comments.length})` : ""}
            </h2>
          </div>

          {isAuthed ? (
            <form onSubmit={handleSubmit} className="cp-form">
              <textarea
                className="cp-textarea"
                placeholder="Write a comment…"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
              />
              <div className="cp-form-actions">
                <button
                  type="submit"
                  className="cp-btn cp-btn--primary"
                  disabled={submitting || !commentText.trim()}
                >
                  {submitting ? "Posting…" : "Post comment"}
                </button>

                <div className="cp-hint">
                  Be respectful. Keep it encouraging.
                </div>
              </div>
            </form>
          ) : (
            <div className="cp-loginbox">
              <p className="cp-logintext">You must be logged in to comment.</p>
              <button
                className="cp-btn cp-btn--primary"
                onClick={() => navigate(`/login?next=${nextUrl}`)}
                type="button"
              >
                Log in
              </button>
            </div>
          )}

          <div className="cp-list">
            {comments.length ? (
              <ul className="cp-ul">
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
                    <li key={c.id} className="cp-li">
                      <div className="cp-li-head">
                        <strong className="cp-li-author">
                          {c.author_name || "Member"}
                        </strong>
                        <span className="cp-li-date">{cWhen || ""}</span>
                      </div>
                      <div className="cp-li-body">{c.body}</div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="cp-empty">No comments yet — be the first!</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
