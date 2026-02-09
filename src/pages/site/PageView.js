// src/pages/site/PageView.js
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api";
import "./PageView.css";

export default function PageView() {
  const { slug } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");
      setPage(null);

      try {
        const res = await api.get(`/pages/${slug}`);
        if (!alive) return;
        if (!res?.data?.ok)
          throw new Error(res?.data?.message || "Failed to load page.");
        setPage(res.data.page);
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.message || e?.message || "Page not found.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="pv-wrap">
        <div className="pv-card">
          <div className="pv-muted">Loading…</div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="pv-wrap">
        <div className="pv-card pv-card--error">
          <div className="pv-errorTitle">We couldn’t load this page.</div>
          <div className="pv-errorText">{err}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pv-wrap">
      <div className="pv-card">
        <h1 className="pv-title">{page?.title || "Page"}</h1>
        <div
          className="pv-content"
          dangerouslySetInnerHTML={{ __html: page?.content_html || "" }}
        />
      </div>
    </div>
  );
}
