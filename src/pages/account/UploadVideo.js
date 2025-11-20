import React, { useState } from "react";
import api from "../../api";

export default function UploadVideo() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  async function onUpload(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/uploads", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
    } catch (e) {
      setErr(e?.response?.data?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Upload Video</h2>
      <form
        onSubmit={onUpload}
        style={{ display: "grid", gap: 10, maxWidth: 480 }}
      >
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button className="btn" disabled={!file || busy}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </form>

      {err && (
        <div className="auth-alert" style={{ marginTop: 10 }}>
          {err}
        </div>
      )}

      {result && (
        <div className="card" style={{ marginTop: 16, padding: 12 }}>
          <div>
            <b>URL:</b> <code>{result.url}</code>
          </div>
          {result.duration_hours != null && (
            <div style={{ color: "var(--muted)" }}>
              Detected duration: {result.duration_hours.toFixed(3)} hours
            </div>
          )}
          <div style={{ color: "var(--muted)" }}>
            Stored via: {result.key?.startsWith("videos/") ? "Wasabi" : "Local"}
          </div>
        </div>
      )}
    </div>
  );
}
