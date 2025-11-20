// src/pages/public/channel/ChannelPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import api from "../../../api";
import { renderHtml } from "../../../components/BlocksEditor/core/html";

/** Map any of the shapes we might store to { blocks: [...] } */
function normalizeModel(raw) {
  if (!raw) return { blocks: [] };
  if (Array.isArray(raw)) return { blocks: raw };
  if (Array.isArray(raw.blocks)) return { blocks: raw.blocks };
  if (raw.content && Array.isArray(raw.content.blocks)) {
    return { blocks: raw.content.blocks };
  }
  return { blocks: [] };
}

/* Load a single page (prefer public/live endpoint, fallback to private for dev) */
async function loadPagePublicFirst(channelSlug, pageKey) {
  const s = encodeURIComponent(channelSlug);
  const p = encodeURIComponent(String(pageKey));

  // Public (live)
  try {
    const res = await api
      .get(`/channels/p/${s}/pages/${p}`)
      .then((r) => r.data);
    return res?.page ?? res ?? null;
  } catch {}

  // Private (dev/local fallback)
  try {
    const res = await api.get(`/channels/${s}/pages/${p}`).then((r) => r.data);
    return res?.page ?? res ?? null;
  } catch {
    return null;
  }
}

/** Return true if the html contains an inline background-image declaration */
function htmlHasBackgroundImage(html) {
  if (typeof html !== "string") return false;
  return /background-image\s*:/i.test(html);
}

export default function ChannelPage() {
  const { channel, pages } = useOutletContext();
  const { slug, pageSlug } = useParams();
  const navigate = useNavigate();

  // pick the page from list (home or by slug/id)
  const candidate = useMemo(() => {
    if (!Array.isArray(pages)) return null;

    if (!pageSlug) {
      return (
        pages.find((p) => p.is_home) ||
        pages.find((p) => (p.slug || p.page_slug) === "home") ||
        pages[0] ||
        null
      );
    }

    const bySlug = pages.find(
      (p) =>
        (p.slug || p.page_slug || "").toLowerCase() ===
        String(pageSlug).toLowerCase()
    );
    if (bySlug) return bySlug;

    const n = Number(pageSlug);
    if (Number.isFinite(n)) {
      const byId = pages.find((p) => Number(p.id) === n);
      if (byId) return byId;
    }
    return null;
  }, [pages, pageSlug]);

  const [fullPage, setFullPage] = useState(null);
  const pageKey =
    candidate?.page_slug ||
    candidate?.slug ||
    candidate?.id ||
    pageSlug ||
    null;

  useEffect(() => {
    let alive = true;
    setFullPage(null);

    // If candidate already has enough data, use it
    if (
      candidate &&
      (candidate.published_html ||
        candidate.meta?.builder_html ||
        candidate.content_published ||
        candidate.content_draft)
    ) {
      setFullPage(candidate);
      return;
    }

    if (!slug || !pageKey) return;

    (async () => {
      const data = await loadPagePublicFirst(slug, pageKey);
      if (!alive) return;

      if (!data) {
        if (!pageSlug) navigate(`/c/${slug}`, { replace: true });
        setFullPage(null);
        return;
      }

      setFullPage(data);
    })();

    return () => {
      alive = false;
    };
  }, [slug, pageKey, candidate, pageSlug, navigate]);

  const page = fullPage || candidate;

  if (!channel || !page) {
    return (
      <div style={{ padding: 16 }}>
        <div className="note subtle">Not found.</div>
      </div>
    );
  }

  // 1) Prefer published_html if it ALREADY contains background-image
  if (page.published_html && htmlHasBackgroundImage(page.published_html)) {
    return (
      <main
        style={{ padding: "18px 16px 40px" }}
        dangerouslySetInnerHTML={{ __html: page.published_html }}
      />
    );
  }

  // 2) Prefer meta.builder_html if it contains background-image
  const builderHtml = page.meta?.builder_html;
  if (builderHtml && htmlHasBackgroundImage(builderHtml)) {
    return (
      <main
        style={{ padding: "18px 16px 40px" }}
        dangerouslySetInnerHTML={{ __html: builderHtml }}
      />
    );
  }

  // 3) Fallback: rebuild fresh from blocks with the updated renderer
  const model = normalizeModel(
    page.content_published ||
      page.content_draft ||
      page.blocks ||
      page.meta?.blocks
  );

  const html = renderHtml(model.blocks);

  return (
    <main
      style={{ padding: "18px 16px 40px" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
