// src/pages/studio/UploadPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import StudioShell from "./StudioShell";

export default function UploadPage() {
  const nav = useNavigate();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    if (!file) return setErr("Choose a file first.");
    setErr("");
    setBusy(true);

    try {
      // 1) upload raw file
      const fd = new FormData();
      fd.append("file", file);
      const up = await api.post("/uploads", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const url = up?.data?.url;
      if (!url) throw new Error("Upload failed");

      // 2) create video row
      const create = await api.post("/videos", {
        title: title || file.name.replace(/\.[^.]+$/, ""),
        video_url: url,
        visibility: "private",
        is_premium: true,
      });

      const vid = create?.data;
      if (!vid?.id) throw new Error("Could not create video");

      // ✅ Go to the studio editor (not the public watch page)
      nav(`/studio/videos/${vid.id}`, { replace: true });
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.message || e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <StudioShell active="upload">
      <div className="card" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Upload a video</h2>
        {err && (
          <div className="vd-alert danger" style={{ marginBottom: 12 }}>
            {err}
          </div>
        )}
        <form onSubmit={onSubmit}>
          <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
            <label className="vd-label">
              <div>Title (optional)</div>
              <input
                className="vd-input"
                type="text"
                placeholder="My new video"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <label className="vd-label">
              <div>File</div>
              <input
                className="vd-input"
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn primary" disabled={busy}>
                {busy ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </StudioShell>
  );
}
