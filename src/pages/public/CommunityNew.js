// src/pages/public/CommunityNew.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import api from "../../api";
import "./CommunityNew.css";

function getStoredRole() {
  return (
    localStorage.getItem("role") ||
    sessionStorage.getItem("role") ||
    ""
  ).toLowerCase();
}

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

// Helps legacy/relative URLs and works with absolute Bunny CDN URLs too
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
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("//")) return window.location.protocol + raw;
  if (raw.startsWith("/")) return API_ORIGIN + raw;
  return API_ORIGIN + "/" + raw.replace(/^\.\//, "");
}

export default function CommunityNew() {
  const qs = useQuery();
  const navigate = useNavigate();
  const isAdmin = getStoredRole() === "admin";
  const editingId = qs.get("edit");

  const fileInputRef = useRef(null);

  // form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [channels, setChannels] = useState([]);
  const [channelId, setChannelId] = useState("");

  const [visibility, setVisibility] = useState("public");
  const [isPinned, setIsPinned] = useState(false);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editingId);

  // toast state
  const [notice, setNotice] = useState(null); // { type: "success"|"error", text: string }

  // cleanup blob URL when replaced/unmounted
  useEffect(() => {
    return () => {
      if (previewUrl && String(previewUrl).startsWith("blob:")) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch {
          /* no-op */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load channel options
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/community/channels");
        const items = data.items || [];
        setChannels(items);

        if (!channelId && items.length) setChannelId(String(items[0].id));
      } catch (e) {
        console.error("channel load failed", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // if editing, load the post and populate the form
  useEffect(() => {
    if (!editingId) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/community/posts/${editingId}`);
        if (!alive) return;

        const p = data.post;
        setTitle(p.title || "");
        setBody(p.body || "");
        setVisibility(p.visibility || "public");
        setIsPinned(!!p.is_pinned);
        setChannelId(p.channel_id ? String(p.channel_id) : "");

        if (p.media_url) setPreviewUrl(absUrl(p.media_url));
      } catch (e) {
        console.error("edit load failed", e);
        setNotice({ type: "error", text: "Post not found or access denied." });
        setTimeout(() => setNotice(null), 3000);
        setTimeout(() => navigate("/community", { replace: true }), 650);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [editingId, navigate]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function clearSelectedImage() {
    setFile(null);
    // Keep server preview if editing and no new file picked
    if (!editingId) setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onFileChange(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);

    // cleanup previous blob preview
    if (previewUrl && String(previewUrl).startsWith("blob:")) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {
        /* no-op */
      }
    }

    if (f) {
      const objUrl = URL.createObjectURL(f);
      setPreviewUrl(objUrl);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    setNotice(null);

    const cleanTitle = title.trim();
    const cleanBody = body.trim();

    if (!cleanTitle) {
      setNotice({ type: "error", text: "Title is required." });
      setTimeout(() => setNotice(null), 2500);
      return;
    }
    if (!cleanBody) {
      setNotice({ type: "error", text: "Message is required." });
      setTimeout(() => setNotice(null), 2500);
      return;
    }

    try {
      setSaving(true);

      const fd = new FormData();
      fd.append("title", cleanTitle);
      fd.append("body", cleanBody); // backend supports body/content/text; we send body

      if (channelId) fd.append("channel_id", channelId);

      if (isAdmin) {
        fd.append("visibility", visibility || "public");
        fd.append("is_pinned", isPinned ? "true" : "false");
      }

      if (file) fd.append("media", file);

      if (editingId) {
        await api.patch(`/community/posts/${editingId}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post(`/community/posts`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      setNotice({
        type: "success",
        text: editingId
          ? "Post updated successfully."
          : "Post created successfully.",
      });

      // hide toast after a moment
      setTimeout(() => setNotice(null), 2500);

      // navigate after a short delay (keeps the UX feeling responsive)
      setTimeout(() => navigate("/community"), 650);
    } catch (err) {
      console.error("save failed", err);
      setNotice({
        type: "error",
        text: "Save failed. Please check your input and try again.",
      });
      setTimeout(() => setNotice(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="commnew-root">
      <div className="comm-main">
        {/* Page header */}
        <div className="comm-pagehead">
          <div className="comm-pagehead-left">
            <Link
              to="/community"
              className="comm-btn comm-btn--ghost"
              aria-label="Back"
            >
              ← Back
            </Link>

            <div className="comm-pagehead-titles">
              <div className="comm-page-title">
                {editingId ? "Edit post" : "Create a post"}
              </div>
              <div className="comm-page-subtitle">
                Share updates, announcements, photos, and encouragement with the
                community.
              </div>
            </div>
          </div>

          <div className="comm-pagehead-right">
            <span className="comm-pill">
              {isAdmin ? "Admin tools enabled" : "Standard post"}
            </span>
          </div>
        </div>

        {/* Form card */}
        <form className="comm-formcard" onSubmit={handleSubmit}>
          <div className="comm-formgrid">
            {/* Left column */}
            <div className="comm-col">
              <label className="comm-label">Title</label>
              <input
                className="comm-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your post a short title"
                disabled={loading}
              />

              <label className="comm-label">Message</label>
              <textarea
                className="comm-textarea"
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your post… (Markdown supported)"
                disabled={loading}
              />
              <div className="comm-hint">
                Tip: Use short paragraphs. Add an image for better engagement.
              </div>
            </div>

            {/* Right column */}
            <div className="comm-col">
              <label className="comm-label">Image</label>

              <div className="comm-drop">
                {previewUrl ? (
                  <div className="comm-drop-preview">
                    <img src={previewUrl} alt="Preview" />
                    <div className="comm-drop-actions">
                      <button
                        type="button"
                        className="comm-btn comm-btn--ghost"
                        onClick={openFilePicker}
                        disabled={loading}
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        className="comm-btn comm-btn--danger"
                        onClick={clearSelectedImage}
                        disabled={loading}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="comm-drop-empty"
                    onClick={openFilePicker}
                    disabled={loading}
                  >
                    <div className="comm-drop-icon">＋</div>
                    <div className="comm-drop-title">Add a photo</div>
                    <div className="comm-drop-sub">PNG, JPG up to ~10MB</div>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  disabled={loading}
                  className="comm-file"
                />
              </div>

              <label className="comm-label">Channel</label>
              <select
                className="comm-input"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                disabled={loading}
              >
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.slug}
                  </option>
                ))}
              </select>

              {isAdmin && (
                <div className="comm-adminbox">
                  <div className="comm-adminrow">
                    <label className="comm-label" style={{ margin: 0 }}>
                      Pin post
                    </label>

                    <label className="comm-switch">
                      <input
                        type="checkbox"
                        checked={isPinned}
                        onChange={(e) => setIsPinned(e.target.checked)}
                        disabled={loading}
                      />
                      <span className="comm-switch-ui" />
                    </label>
                  </div>

                  <div className="comm-hint">
                    Pinned posts appear above normal posts.
                  </div>

                  <label className="comm-label">Visibility</label>
                  <select
                    className="comm-input"
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    disabled={loading}
                  >
                    <option value="public">Public</option>
                    <option value="members">Members</option>
                    <option value="admins">Admins</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Actions footer */}
          <div className="comm-formactions">
            <button
              type="submit"
              className="comm-btn comm-btn--primary"
              disabled={saving || loading}
            >
              {saving ? "Saving…" : "Save post"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/community")}
              className="comm-btn"
              disabled={saving}
            >
              Cancel
            </button>

            <div className="comm-actions-spacer" />

            <div className="comm-hint" style={{ margin: 0 }}>
              {loading
                ? "Loading…"
                : "Your post will appear in the Community feed."}
            </div>
          </div>
        </form>
      </div>

      {/* Toast */}
      {notice && (
        <div
          className={`comm-toast ${
            notice.type === "error" ? "is-error" : "is-success"
          }`}
        >
          {notice.text}
        </div>
      )}
    </div>
  );
}
