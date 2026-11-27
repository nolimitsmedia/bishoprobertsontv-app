// src/pages/public/Browse.js
//
// Release 2.0: Browse (Netflix / Uscreen style) — featured hero, Continue
// Watching, My List, New Releases and a row per category. The full catalog
// with search and filters is at /catalog/all.

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";
import { FeaturedHero, VideoRow } from "../../components/viewer/ViewerParts";
import "../../components/viewer/Viewer.css";

export default function Browse() {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    api
      .get("/viewer/browse")
      .then(({ data: d }) => {
        if (!alive) return;
        // Accept only the expected shape (an older API or an error page must not crash the site).
        if (!d || !Array.isArray(d.rows))
          return setError("Videos could not be loaded. Please try again.");
        setData({
          ...d,
          featured: Array.isArray(d.featured) ? d.featured : [],
          rows: d.rows.filter(
            (r) => r && Array.isArray(r.items) && r.items.length,
          ),
        });
      })
      .catch(
        () =>
          alive && setError("Videos could not be loaded. Please try again."),
      );
    return () => {
      alive = false;
    };
  }, []);

  async function removeFromContinue(v) {
    setData((d) => ({
      ...d,
      rows: d.rows
        .map((r) =>
          r.key === "continue"
            ? { ...r, items: r.items.filter((x) => x.id !== v.id) }
            : r,
        )
        .filter((r) => r.items.length),
    }));
    try {
      await api.delete(`/viewer/continue/${v.id}`);
    } catch {
      /* it will show again next time */
    }
  }

  return (
    <main className="vw-page">
      {error ? (
        <p className="vw-empty" role="alert">
          {error}
        </p>
      ) : null}
      {!data && !error ? (
        <p className="vw-empty" role="status">
          Loading…
        </p>
      ) : null}
      {data ? (
        <>
          {data.featured?.length ? (
            <FeaturedHero items={data.featured} />
          ) : null}
          <div
            className="vw-pageHead"
            style={data.featured?.length ? { paddingTop: 18 } : undefined}
          >
            {!data.featured?.length ? <h1>Watch</h1> : <span />}
            <span className="vw-headTools">
              {/* search lives in the site header (icon, or "/" on the keyboard) */}
              <Link to="/catalog/all" className="vw-linkBtn">
                All videos &amp; filters ›
              </Link>
            </span>
          </div>
          <div className="vw-rows">
            {data.rows.map((row) => (
              <VideoRow
                key={row.key}
                row={row}
                onRemove={
                  row.key === "continue" ? removeFromContinue : undefined
                }
                onSeeAll={
                  row.key === "my-list"
                    ? () => nav("/my-list")
                    : row.category_id && row.total > row.items.length
                      ? () => nav(`/catalog?cat=${row.category_id}`)
                      : undefined
                }
              />
            ))}
            {!data.rows.length ? (
              <p className="vw-empty">No videos yet. Check back soon!</p>
            ) : null}
          </div>
        </>
      ) : null}
    </main>
  );
}
