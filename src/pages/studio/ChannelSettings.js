// src/pages/studio/ChannelSettings.jsx
import React, { useEffect, useState } from "react";
import api from "../../api";

export default function ChannelSettings() {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function load(initial = false) {
    setErr("");
    try {
      const r = await api.get("/channels/me");
      setData(r.data);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404 && initial) {
        // lazily create a channel, then refetch
        try {
          await api.post("/channels/me/ensure", { title: "My Channel" });
          const r2 = await api.get("/channels/me");
          setData(r2.data);
          return;
        } catch (ee) {
          setErr(ee?.response?.data?.message || "Failed to create channel");
        }
      } else {
        setErr(e?.response?.data?.message || "Not found");
      }
    }
  }

  useEffect(() => {
    load(true);
  }, []);

  function onChange(k, v) {
    setData((d) => ({ ...d, [k]: v }));
  }

  async function onSave(e) {
    e?.preventDefault?.();
    if (!data) return;
    setSaving(true);
    setErr("");
    try {
      const payload = {
        title: data.title,
        slug: data.slug,
        about: data.about,
        theme_color: data.theme_color,
        text_color: data.text_color,
        hero_url: data.hero_url,
        avatar_url: data.avatar_url,
        website: data.website,
        youtube: data.youtube,
        facebook: data.facebook,
        twitter: data.twitter,
        instagram: data.instagram,
        tiktok: data.tiktok,
      };
      const r = await api.put("/channels/me", payload);
      setData(r.data);
    } catch (e) {
      setErr(e?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <div className="card">
        <div>Loading…</div>
        {err ? (
          <div className="auth-alert" style={{ marginTop: 8 }}>
            {err}
          </div>
        ) : null}
      </div>
    );
  }

  const publicUrl = data?.slug ? `/c/${data.slug}` : "";

  return (
    <div className="card">
      <h2>Channel</h2>
      {err ? (
        <div className="auth-alert" style={{ marginBottom: 12 }}>
          {err}
        </div>
      ) : null}

      <form onSubmit={onSave} className="form">
        <div
          className="grid"
          style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          <label className="field">
            <span>Title</span>
            <input
              value={data.title || ""}
              onChange={(e) => onChange("title", e.target.value)}
              placeholder="My Channel"
            />
          </label>
          <label className="field">
            <span>Slug</span>
            <input
              value={data.slug || ""}
              onChange={(e) =>
                onChange(
                  "slug",
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]+/g, "-")
                    .replace(/^-+|-+$/g, "")
                )
              }
              placeholder="my-channel"
            />
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
              Public URL —{" "}
              {publicUrl ? (
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  {publicUrl}
                </a>
              ) : (
                "—"
              )}
            </div>
          </label>

          <label className="field" style={{ gridColumn: "1 / span 2" }}>
            <span>About</span>
            <textarea
              rows={4}
              value={data.about || ""}
              onChange={(e) => onChange("about", e.target.value)}
              placeholder="What viewers should know about your channel…"
            />
          </label>

          <label className="field">
            <span>Theme color</span>
            <input
              type="color"
              value={data.theme_color || "#0b1320"}
              onChange={(e) => onChange("theme_color", e.target.value)}
            />
          </label>
          <label className="field">
            <span>Text color</span>
            <input
              type="color"
              value={data.text_color || "#ffffff"}
              onChange={(e) => onChange("text_color", e.target.value)}
            />
          </label>

          <label className="field">
            <span>Hero image URL</span>
            <input
              value={data.hero_url || ""}
              onChange={(e) => onChange("hero_url", e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label className="field">
            <span>Avatar URL</span>
            <input
              value={data.avatar_url || ""}
              onChange={(e) => onChange("avatar_url", e.target.value)}
              placeholder="/uploads/avatar.png"
            />
          </label>

          <label className="field">
            <span>Website</span>
            <input
              value={data.website || ""}
              onChange={(e) => onChange("website", e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label className="field">
            <span>YouTube</span>
            <input
              value={data.youtube || ""}
              onChange={(e) => onChange("youtube", e.target.value)}
              placeholder="https://youtube.com/…"
            />
          </label>
          <label className="field">
            <span>Facebook</span>
            <input
              value={data.facebook || ""}
              onChange={(e) => onChange("facebook", e.target.value)}
              placeholder="https://facebook.com/…"
            />
          </label>
          <label className="field">
            <span>Twitter/X</span>
            <input
              value={data.twitter || ""}
              onChange={(e) => onChange("twitter", e.target.value)}
              placeholder="https://twitter.com/…"
            />
          </label>
          <label className="field">
            <span>Instagram</span>
            <input
              value={data.instagram || ""}
              onChange={(e) => onChange("instagram", e.target.value)}
              placeholder="https://instagram.com/…"
            />
          </label>
          <label className="field">
            <span>TikTok</span>
            <input
              value={data.tiktok || ""}
              onChange={(e) => onChange("tiktok", e.target.value)}
              placeholder="https://tiktok.com/@…"
            />
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="primarycta" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
