// src/pages/site/StaticPage.js
import React, { useEffect, useState } from "react";
import api from "../../api";
import "./StaticPage.css";
import sanitizeHtml from "../../utils/sanitizeHtml";

export default function StaticPage({ slug }) {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await api.get(`/pages/${slug}`);
        if (!alive) return;
        setPage(r.data.page);
      } catch (e) {
        if (!alive) return;
        setPage(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  if (loading)
    return (
      <div className="sp-wrap">
        <div className="sp-loading">Loading…</div>
      </div>
    );
  if (!page)
    return (
      <div className="sp-wrap">
        <div className="sp-notfound">Page not found.</div>
      </div>
    );

  return (
    <div className="sp-wrap">
      {page.hero_image_url ? (
        <div
          className="sp-hero"
          style={{ backgroundImage: `url(${page.hero_image_url})` }}
        >
          <div className="sp-heroOverlay" />
          <div className="sp-heroInner">
            <h1>{page.title}</h1>
            {page.excerpt ? <p>{page.excerpt}</p> : null}
          </div>
        </div>
      ) : (
        <div className="sp-titleOnly">
          <h1>{page.title}</h1>
          {page.excerpt ? <p>{page.excerpt}</p> : null}
        </div>
      )}

      <div
        className="sp-content"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content_html) }}
      />
    </div>
  );
}
