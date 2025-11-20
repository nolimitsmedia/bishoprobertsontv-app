// src/pages/public/CommunityNew.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../api";
import "./Community.css";

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

export default function CommunityNew() {
  const qs = useQuery();
  const navigate = useNavigate();
  const isAdmin = getStoredRole() === "admin";

  const editingId = qs.get("edit"); // if present, we're editing

  // form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [channels, setChannels] = useState([]);
  const [channelId, setChannelId] = useState(""); // will store id

  const [visibility, setVisibility] = useState("public");
  const [isPinned, setIsPinned] = useState(false);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editingId);

  // load channel options
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/community/channels");
        setChannels(data.items || []);
        // default first item if none selected
        if (!channelId && data.items?.length) {
          setChannelId(String(data.items[0].id));
        }
      } catch (_) {}
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
        // show existing image
        if (p.media_url) setPreviewUrl(p.media_url);
      } catch (e) {
        console.error("edit load failed", e);
        alert("Post not found or you do not have access.");
        navigate("/community", { replace: true });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [editingId, navigate]);

  function onFileChange(e) {
    const f = e.target.files?.[0] || null;
    setFile(f || null);
    if (f) {
      const objUrl = URL.createObjectURL(f);
      setPreviewUrl(objUrl);
    } else {
      // if user clears selection but we’re editing and had a preview from server,
      // keep the previewUrl unless you want to clear it; here we leave it as-is.
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    try {
      setSaving(true);

      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("body", body.trim());
      if (channelId) fd.append("channel_id", channelId);

      // Admin-only options
      if (isAdmin) {
        fd.append("visibility", visibility || "public");
        fd.append("is_pinned", isPinned ? "true" : "false");
      }

      // Image (optional). Server PATCH currently doesn't update media,
      // but sending it won't hurt. If you want to enable replacement, I can
      // add a small server change to update media_url on PATCH.
      if (file) {
        fd.append("media", file);
      }

      if (editingId) {
        await api.patch(`/community/posts/${editingId}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post(`/community/posts`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      // success popup
      alert(editingId ? "Post updated!" : "Post created!");
      navigate("/community");
    } catch (err) {
      console.error("save failed", err);
      alert("Save failed. Please check your input and try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    navigate("/community");
  }

  return (
    <div className="comm-wrap comm-edit">
      <div className="comm-main">
        <div className="comm-header">
          <div className="comm-title">
            {editingId ? "Edit post" : "Create a post"}
          </div>
        </div>

        <form className="comm-form" onSubmit={handleSubmit}>
          {/* Title */}
          <label className="comm-label">Title</label>
          <input
            className="comm-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your post a short title"
            disabled={loading}
          />

          {/* Body */}
          <label className="comm-label">Message</label>
          <textarea
            className="comm-textarea"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share something with the community… (Markdown supported)"
            disabled={loading}
          />

          {/* Image picker + current preview */}
          <label className="comm-label">Image</label>
          {previewUrl && (
            <div style={{ marginBottom: 8 }}>
              <img
                src={previewUrl}
                alt="Current"
                style={{ maxWidth: "100%", borderRadius: 8 }}
              />
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={onFileChange}
            disabled={loading}
            className="comm-input"
          />

          {/* Channel */}
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

          {/* Admin-only options */}
          {isAdmin && (
            <div className="comm-grid-2">
              <div>
                <label className="comm-label">Pin post</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    disabled={loading}
                  />
                  <span style={{ fontSize: 13, color: "#4b5563" }}>
                    Pin post (show above normal posts)
                  </span>
                </div>
              </div>

              <div>
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
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <button
              type="submit"
              className="comm-btn comm-btn--primary"
              disabled={saving || loading}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="comm-btn"
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
