import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api";
import "./Community.css";

export default function CommunityEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // post fields
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState(null);
  const [file, setFile] = useState(null);

  // admin/owner fields
  const [isPinned, setIsPinned] = useState(false);
  const [visibility, setVisibility] = useState("public");
  const [channelId, setChannelId] = useState("");
  const [channels, setChannels] = useState([]);

  // live preview if a new file was chosen
  const previewSrc = useMemo(
    () => (file ? URL.createObjectURL(file) : mediaUrl),
    [file, mediaUrl]
  );

  // load post + channels
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [{ data: postRes }, { data: chRes }] = await Promise.all([
          api.get(`/api/community/posts/${id}`),
          api
            .get("/api/community/channels")
            .catch(() => ({ data: { items: [] } })),
        ]);
        if (!alive) return;

        const p = postRes.post;
        setTitle(p.title || "");
        setBody(p.body || "");
        setMediaUrl(p.media_url || null);
        setIsPinned(!!p.is_pinned);
        setVisibility(p.visibility || "public");
        setChannelId(p.channel_id ?? "");
        setChannels(chRes.items || []);
      } catch (e) {
        if (!alive) return;
        setError(e?.response?.data?.message || "Unable to load the post.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (file) URL.revokeObjectURL(previewSrc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onSelectFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");

    try {
      const fd = new FormData();
      fd.append("title", title || "");
      fd.append("content", body || "");
      if (file) fd.append("media", file);
      // backend enforces who can set these
      fd.append("is_pinned", isPinned ? "true" : "false");
      fd.append("visibility", visibility || "public");
      if (channelId !== "") fd.append("channel_id", String(channelId));

      const { data } = await api.patch(`/api/community/posts/${id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      navigate(`/community/${data.post.id}`);
    } catch (e) {
      setError(e?.response?.data?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => navigate("/community");

  return (
    <div className="container-narrow comm-edit">
      <div className="page-title-row">
        <h1 className="page-title">Edit post</h1>
        <div className="page-title-actions">
          <button type="button" className="btn btn-light" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            form="edit-post-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="card p-24">Loading…</div>
      ) : (
        <form id="edit-post-form" onSubmit={onSubmit}>
          <div className="card p-24">
            <div className="form-grid">
              {/* LEFT: image */}
              <div className="form-grid-left">
                <label className="form-label">Image</label>
                <div className="media-preview">
                  {previewSrc ? (
                    <img src={previewSrc} alt="preview" />
                  ) : (
                    <div className="media-empty">No image</div>
                  )}
                </div>
                <input type="file" accept="image/*" onChange={onSelectFile} />
                <div className="hint">PNG/JPG, up to ~10MB</div>
              </div>

              {/* RIGHT: fields */}
              <div className="form-grid-right">
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input
                    className="form-control"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Give your post a short title"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Message</label>
                  <textarea
                    className="form-control"
                    rows={8}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Share something with the community…"
                  />
                  <div className="hint">
                    Markdown supported: <b>**bold**</b>, <i>*italics*</i>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Channel</label>
                    <select
                      className="form-control"
                      value={channelId}
                      onChange={(e) => setChannelId(e.target.value)}
                    >
                      <option value="">— none —</option>
                      {channels.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.slug}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Visibility</label>
                    <select
                      className="form-control"
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value)}
                    >
                      <option value="public">Public</option>
                      <option value="members">Members</option>
                      <option value="admins">Admins</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-between">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                    />
                    <span>Pin post (show above normal posts)</span>
                  </label>

                  <div className="actions-inline">
                    <button
                      type="button"
                      className="btn btn-light"
                      onClick={onCancel}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
