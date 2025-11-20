// src/components/community/PostComposer.js
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";

/**
 * Props:
 *  - onPosted(post)   optional callback to prepend into the feed on success
 */
export default function PostComposer({ onPosted }) {
  const [me, setMe] = useState(null);
  const isAdmin = useMemo(
    () => (me?.role || me?.type || "").toLowerCase() === "admin",
    [me]
  );

  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [posting, setPosting] = useState(false);

  // Admin-only controls
  const [isPinned, setIsPinned] = useState(false);
  const [visibility, setVisibility] = useState("public"); // 'public' | 'members' | 'admins'

  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      try {
        const { data } = await api.get("/auth/me");
        if (!cancelled) setMe(data?.user || data || null);
      } catch {
        if (!cancelled) setMe(null);
      }
    }
    loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePost() {
    if (!body.trim() && !file) {
      alert("Nothing to post");
      return;
    }
    try {
      setPosting(true);
      const fd = new FormData();
      // API accepts body|text|content, and "media" or "file" for the upload
      fd.append("body", body.trim());
      if (file) fd.append("media", file);

      // admin-only extras
      if (isAdmin) {
        fd.append("is_pinned", isPinned ? "true" : "false");
        fd.append("visibility", visibility);
      }

      const { data } = await api.post("/community/posts", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const posted = data?.post || data; // API returns { post }
      // reset
      setBody("");
      setFile(null);
      setIsPinned(false);
      setVisibility("public");

      onPosted && onPosted(posted);
    } catch (e) {
      console.error("create post failed:", e);
      const msg =
        e?.response?.data?.message || e?.message || "Failed to create the post";
      alert(msg);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="mc-composer card">
      <div className="mc-title">Create a post</div>

      <textarea
        className="mc-textarea"
        placeholder="Share something with the community… (Markdown supported: **bold**, *italics*)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
      />

      <div className="mc-row">
        <label className="mc-file">
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file ? file.name : "Choose File"}
        </label>

        <div className="mc-spacer" />

        {isAdmin && (
          <div className="mc-admin">
            <label className="mc-checkbox">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
              />
              <span>Pin this post</span>
            </label>

            <label className="mc-select-wrap">
              <span className="mc-select-label">Visibility</span>
              <select
                className="mc-select"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
              >
                <option value="public">Public</option>
                <option value="members">Members</option>
                <option value="admins">Admins</option>
              </select>
            </label>
          </div>
        )}

        <button
          className="mc-postbtn"
          disabled={posting}
          onClick={handlePost}
          aria-busy={posting ? "true" : "false"}
        >
          {posting ? "Posting…" : "Post"}
        </button>
      </div>

      <div className="mc-help">
        Tip: Press <kbd>Shift</kbd> + <kbd>Enter</kbd> for a line break. Use
        Markdown like <code>**bold**</code> and <code>*italics*</code>.
      </div>

      {/* quick styles */}
      <style jsx>{`
        .card {
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 10px;
          padding: 16px;
          background: #fff;
        }
        .mc-title {
          font-weight: 700;
          margin-bottom: 8px;
        }
        .mc-textarea {
          width: 100%;
          resize: vertical;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px;
          outline: none;
          font: inherit;
        }
        .mc-textarea:focus {
          border-color: #b9c6ff;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }
        .mc-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 10px;
          flex-wrap: wrap;
        }
        .mc-file input {
          display: none;
        }
        .mc-file {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #f8fafc;
          cursor: pointer;
          font-size: 14px;
        }
        .mc-postbtn {
          padding: 10px 18px;
          border-radius: 8px;
          background: #111827;
          color: #fff;
          font-weight: 700;
          border: none;
          cursor: pointer;
        }
        .mc-postbtn[disabled] {
          opacity: 0.6;
          cursor: default;
        }
        .mc-spacer {
          flex: 1;
        }
        .mc-admin {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          margin-right: 8px;
          flex-wrap: wrap;
        }
        .mc-checkbox {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          user-select: none;
        }
        .mc-select-wrap {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .mc-select {
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
          background: #fff;
        }
        .mc-help {
          margin-top: 6px;
          font-size: 12px;
          color: #6b7280;
        }
        code {
          background: #f3f4f6;
          padding: 1px 4px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
