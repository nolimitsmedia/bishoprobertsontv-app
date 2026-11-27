// src/components/admin/SeriesPanel.js — "Series page" settings on a collection
// (Content › Collections › a collection): show it as a series, tagline, cover,
// trailer and the episode order. Uses /api/series/admin/:id.
import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "../../api";
import { notify } from "../ui/Dialogs";

export default function SeriesPanel({ collectionId, videos = [] }) {
  const [s, setS] = useState(null);
  const [form, setForm] = useState({
    is_series: false,
    tagline: "",
    cover_url: "",
    trailer_video_id: "",
    series_order: 0,
  });
  const [eps, setEps] = useState([]);
  const [orderDirty, setOrderDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/series/admin/${collectionId}`);
      setS(data);
      setForm({
        is_series: !!data.is_series,
        tagline: data.tagline || "",
        cover_url: data.cover_url || "",
        trailer_video_id: data.trailer_video_id
          ? String(data.trailer_video_id)
          : "",
        series_order: data.series_order || 0,
      });
      setEps(data.episodes || []);
      setOrderDirty(false);
    } catch (e) {
      setS({
        error:
          e?.response?.data?.message || "Series settings could not be loaded.",
      });
    }
  }, [collectionId]);
  useEffect(() => {
    if (collectionId && collectionId !== "new") load();
  }, [collectionId, load]);

  if (!collectionId || collectionId === "new") return null;
  if (!s) return null;
  if (s.error)
    return (
      <div className="cd-card sp-card">
        <h2 className="sp-h">Series page</h2>
        <p className="sp-hint">{s.error}</p>
      </div>
    );

  async function save() {
    setBusy(true);
    try {
      await api.put(`/series/admin/${collectionId}`, {
        ...form,
        trailer_video_id: form.trailer_video_id || null,
      });
      if (orderDirty)
        await api.put(`/series/admin/${collectionId}/order`, {
          video_ids: eps.map((e) => e.id),
        });
      notify(
        form.is_series
          ? "Series page saved."
          : "Saved — this collection is not shown as a series.",
        "success",
      );
      load();
    } catch (e) {
      notify(
        e?.response?.data?.message || "Could not save the series settings.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }
  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = data?.url || data?.path || data?.Location || "";
      if (!url) throw new Error("No address returned");
      setForm((f) => ({ ...f, cover_url: url }));
    } catch (err) {
      notify(err?.response?.data?.message || "Upload failed.", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  const move = (i, d) => {
    const n = [...eps];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    setEps(n);
    setOrderDirty(true);
  };
  const pageUrl = `${window.location.origin}${window.location.pathname}#/series/${encodeURIComponent(s.slug)}`;
  const trailerChoices = videos.filter((v) => v && v.id);

  return (
    <div className="cd-card sp-card">
      <div className="sp-head">
        <h2 className="sp-h">Series page</h2>
        {s.is_series ? (
          <a
            href={pageUrl}
            target="_blank"
            rel="noreferrer"
            className="sp-link"
          >
            View series page ↗
          </a>
        ) : null}
      </div>
      <p className="sp-hint">
        Show this collection as a series: its own page with a cover, the
        episodes in order, and “Resume episode N” for members.
      </p>
      <label className="sp-check">
        <input
          type="checkbox"
          checked={form.is_series}
          onChange={(e) => setForm({ ...form, is_series: e.target.checked })}
        />
        <span>Show as a series</span>
      </label>
      <div className="sp-grid">
        <label className="sp-field">
          <span>Tagline</span>
          <input
            className="ap-input"
            value={form.tagline}
            maxLength={300}
            placeholder="One line about the series"
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
          />
        </label>
        <label className="sp-field">
          <span>Trailer (optional)</span>
          <select
            className="ap-input"
            value={form.trailer_video_id}
            onChange={(e) =>
              setForm({ ...form, trailer_video_id: e.target.value })
            }
          >
            <option value="">No trailer</option>
            {trailerChoices.map((v) => (
              <option key={v.id} value={String(v.id)}>
                {v.title}
              </option>
            ))}
          </select>
        </label>
        <div className="sp-field sp-cover">
          <span>
            Cover image (wide; the collection thumbnail is used if empty)
          </span>
          <div className="sp-coverRow">
            {form.cover_url ? <img src={form.cover_url} alt="" /> : null}
            <input
              className="ap-input"
              value={form.cover_url}
              placeholder="Image address"
              onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
              aria-label="Cover image address"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={upload}
            />
            <button
              type="button"
              className="btn"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>
        </div>
      </div>
      <fieldset className="sp-eps">
        <legend>Episode order</legend>
        {eps.length ? (
          <ol>
            {eps.map((e, i) => (
              <li key={e.id}>
                <span className="sp-num">{i + 1}</span>
                <span className="sp-title">
                  {e.title}
                  {!e.published ? (
                    <em> (not published — hidden on the series page)</em>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="btn"
                  aria-label={`Move ${e.title} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-label={`Move ${e.title} down`}
                  disabled={i === eps.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="sp-hint">
            Add videos to this collection first; they become the episodes.
          </p>
        )}
      </fieldset>
      <div className="sp-actions">
        <button
          type="button"
          className="btn primary"
          onClick={save}
          disabled={busy}
        >
          {busy ? "Saving…" : "Save series settings"}
        </button>
        {orderDirty ? (
          <span className="sp-hint">
            The new episode order is saved with the settings.
          </span>
        ) : null}
      </div>
    </div>
  );
}
