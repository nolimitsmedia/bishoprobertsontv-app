// src/pages/studio/PageBuilder.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api";
import "./PageBuilder.css";

function safe(v) {
  return String(v ?? "");
}

function normalizeAccess(v) {
  const x = String(v || "").toLowerCase();
  if (x === "members" || x === "member") return "members";
  if (x === "admin") return "admin";
  return "public";
}

export default function PageBuilder() {
  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [page, setPage] = useState(null);

  // editable fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [access, setAccess] = useState("public");
  const [draftHtml, setDraftHtml] = useState("");
  const [published, setPublished] = useState(false);

  async function fetchPage() {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get(`/admin/pages/${id}`);
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Failed to load page.");
      const p = res.data.page;

      setPage(p);
      setTitle(safe(p.title));
      setSlug(safe(p.slug));
      setAccess(normalizeAccess(p.access));
      setDraftHtml(safe(p.draft_html || p.content_html || ""));
      setPublished(!!p.published);
    } catch (e) {
      setErr(
        e?.response?.data?.message || e?.message || "Failed to load page."
      );
      setPage(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const previewHtml = useMemo(
    () => draftHtml || "<div style='opacity:.7'>Start writing your page…</div>",
    [draftHtml]
  );

  async function saveDraft() {
    if (saving) return;
    const cleanTitle = title.trim();
    const cleanSlug = slug.trim();
    if (!cleanTitle) return alert("Title is required.");
    if (!cleanSlug) return alert("Slug is required.");

    setSaving(true);
    try {
      const res = await api.put(`/admin/pages/${id}`, {
        title: cleanTitle,
        slug: cleanSlug,
        access,
        draft_html: draftHtml,
        status: published ? "published" : "draft",
      });
      if (!res?.data?.ok) throw new Error(res?.data?.message || "Save failed");
      setPage((p) => ({ ...(p || {}), ...res.data.page }));
    } catch (e) {
      alert(
        e?.response?.data?.message || e?.message || "Failed to save draft."
      );
    } finally {
      setSaving(false);
    }
  }

  async function publishNow() {
    if (publishing) return;
    const cleanTitle = title.trim();
    const cleanSlug = slug.trim();
    if (!cleanTitle) return alert("Title is required.");
    if (!cleanSlug) return alert("Slug is required.");

    setPublishing(true);
    try {
      const res = await api.put(`/admin/pages/${id}`, {
        title: cleanTitle,
        slug: cleanSlug,
        access,
        published: true,
        status: "published",
        content_html: draftHtml, // publish the current draft html
      });
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Publish failed");
      setPublished(true);
      setPage((p) => ({ ...(p || {}), ...res.data.page, published: true }));
      alert("Page published.");
    } catch (e) {
      alert(
        e?.response?.data?.message || e?.message || "Failed to publish page."
      );
    } finally {
      setPublishing(false);
    }
  }

  async function unpublish() {
    if (publishing) return;
    setPublishing(true);
    try {
      const res = await api.put(`/admin/pages/${id}`, {
        published: false,
        status: "draft",
      });
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Update failed");
      setPublished(false);
      setPage((p) => ({ ...(p || {}), ...res.data.page, published: false }));
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "Failed to unpublish.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="pb-page">
      <div className="pb-wrap">
        <div className="pb-top">
          <div>
            <div className="pb-kicker">PAGES</div>
            <h1 className="pb-title">Page Builder</h1>
            <div className="pb-muted">{page?.id ? `ID: ${page.id}` : ""}</div>
          </div>

          <div className="pb-actions">
            <button
              className="pb-btn pb-btn--ghost"
              onClick={() => nav("/admin/pages")}
            >
              Back
            </button>
            <button
              className="pb-btn pb-btn--ghost"
              onClick={saveDraft}
              disabled={saving || loading}
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            {published ? (
              <button
                className="pb-btn pb-btn--ghost"
                onClick={unpublish}
                disabled={publishing || loading}
              >
                {publishing ? "Updating…" : "Unpublish"}
              </button>
            ) : (
              <button
                className="pb-btn pb-btn--primary"
                onClick={publishNow}
                disabled={publishing || loading}
              >
                {publishing ? "Publishing…" : "Publish"}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="pb-card">
            <div className="pb-muted">Loading page…</div>
          </div>
        ) : err ? (
          <div className="pb-card pb-card--error">
            <div className="pb-errorTitle">We couldn’t load this page.</div>
            <div className="pb-errorText">{err}</div>
          </div>
        ) : (
          <div className="pb-grid">
            <div className="pb-card">
              <div className="pb-formRow">
                <div className="pb-field">
                  <label>Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Page title"
                  />
                </div>
                <div className="pb-field">
                  <label>Slug</label>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="about"
                  />
                </div>
              </div>

              <div className="pb-formRow">
                <div className="pb-field">
                  <label>Access</label>
                  <select
                    value={access}
                    onChange={(e) => setAccess(e.target.value)}
                  >
                    <option value="public">Public</option>
                    <option value="members">Members</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="pb-field">
                  <label>Status</label>
                  <div className={`pb-pill ${published ? "is-on" : ""}`}>
                    {published ? "Published" : "Draft"}
                  </div>
                </div>
              </div>

              <div className="pb-field">
                <label>HTML Content</label>
                <textarea
                  value={draftHtml}
                  onChange={(e) => setDraftHtml(e.target.value)}
                  placeholder="<h2>About</h2><p>…</p>"
                  rows={14}
                />
                <div className="pb-muted" style={{ marginTop: 8 }}>
                  Tip: keep it simple—headings, paragraphs, lists, and links.
                </div>
              </div>
            </div>

            <div className="pb-card">
              <div className="pb-cardHead">
                <h3>Preview</h3>
                <span className="pb-muted">/{slug}</span>
              </div>
              <div
                className="pb-preview"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
