// src/pages/admin/AdminPreviewClips.js
//
// Release 2.3 Part B — Content › Preview Clips. Each premium video with a free
// preview gets a real short clip (cut from the original file) so signed-out
// visitors can only ever watch the clip, never the full message.

import React, { useCallback, useEffect, useState } from "react";
import api from "../../api";
import "./AdminMedia.css";
import "./AdminTeam.css";
import "./AdminPages.css";

const LABEL = {
  ready: "Ready",
  missing: "No clip yet",
  outdated: "Outdated (preview length changed)",
  failed: "Failed",
  queued: "Waiting",
  processing: "Making clip…",
};
const mins = (s) => `${Math.round((Number(s) || 0) / 60) || 1} min`;

export default function AdminPreviewClips() {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [filter, setFilter] = useState("all");
  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get("/admin/preview-clips");
      setData(d);
    } catch (e) {
      setNotice({
        tone: "error",
        text: e?.response?.data?.error || "Preview clips could not be loaded.",
      });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const busy =
    !!data && (data.summary.queued > 0 || data.summary.processing > 0);
  useEffect(() => {
    if (!busy) return undefined;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [busy, load]);

  async function run(body, label) {
    try {
      const { data: d } = await api.post("/admin/preview-clips/run", body);
      setNotice({
        tone: "success",
        text: d.queued
          ? `${d.queued} ${label} started. Clips are made one at a time.`
          : "Nothing to do.",
      });
      load();
    } catch (e) {
      setNotice({
        tone: "error",
        text: e?.response?.data?.error || "Could not start.",
      });
    }
  }

  const s = data?.summary || {};
  const items = (data?.items || []).filter(
    (v) => filter === "all" || v.status === filter,
  );
  return (
    <main className="ml-page tm-page">
      <div className="ml-header">
        <div>
          <h1>Preview Clips</h1>
          <p>
            Signed-out visitors watch a short clip of each premium message (its
            free preview length), never the full message. Clips are cut from the
            original file and kept in Bunny's "Preview clips" collection.
          </p>
        </div>
      </div>
      {notice ? (
        <div
          className={`ml-notice ${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            className="ml-link"
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {!data && !notice ? (
        <p className="ml-help" role="status">
          Loading…
        </p>
      ) : null}
      {!data && notice?.tone === "error" ? (
        <section className="tm-card">
          <p className="ml-help">
            The server didn't answer for Preview Clips. If this is the live
            site, the API needs the Release 2.3 Part B backend
            (routes/previewClips.js, services/previewClips.js, and{" "}
            <code>npm install</code> for the video tool). Then reload this page.
          </p>
          <button
            type="button"
            className="ml-btn"
            onClick={() => {
              setNotice(null);
              load();
            }}
          >
            Try again
          </button>
        </section>
      ) : null}
      {data ? (
        <>
          <section className="tm-card" aria-label="Summary">
            <div className="pc-stats">
              {[
                ["ready", s.ready],
                ["missing", s.missing],
                ["outdated", s.outdated],
                ["failed", s.failed],
                ["queued", (s.queued || 0) + (s.processing || 0)],
              ].map(([k, n]) => (
                <button
                  key={k}
                  type="button"
                  className={`pc-stat pc-${k}${filter === k ? " is-on" : ""}`}
                  aria-pressed={filter === k}
                  onClick={() => setFilter(filter === k ? "all" : k)}
                >
                  <strong>{n || 0}</strong>
                  <span>{k === "queued" ? "In progress" : LABEL[k]}</span>
                </button>
              ))}
            </div>
            <div className="tm-addRow">
              <button
                type="button"
                className="ml-btn ml-btnPrimary"
                disabled={!s.missing}
                onClick={() => run({ scope: "missing" }, "clips")}
              >
                Make missing clips ({s.missing || 0})
              </button>
              <button
                type="button"
                className="ml-btn"
                disabled={!s.outdated}
                onClick={() => run({ scope: "outdated" }, "clips")}
              >
                Re-make outdated ({s.outdated || 0})
              </button>
              <button
                type="button"
                className="ml-btn"
                disabled={!s.failed}
                onClick={() => run({ scope: "failed" }, "clips")}
              >
                Retry failed ({s.failed || 0})
              </button>
            </div>
            <p className="ml-help" role="status">
              {busy
                ? `Working: ${s.processing ? "making a clip" : ""}${s.queued ? `, ${s.queued} waiting` : ""}. This page updates by itself.`
                : data.auto
                  ? "Automatic mode is on: new videos get clips within about 15 minutes."
                  : "Tip: set PREVIEW_CLIPS_AUTO=true on the server to make clips for new videos automatically."}
            </p>
          </section>
          <section className="tm-card" aria-label="Videos">
            {!items.length ? <p className="ml-help">No videos here.</p> : null}
            <ul className="pc-list">
              {items.map((v) => (
                <li key={v.id} className="pc-row">
                  <span className="pc-title">
                    <strong>{v.title}</strong>
                    <small>
                      Preview {mins(v.preview_seconds)}
                      {v.error ? ` · ${v.error}` : ""}
                    </small>
                  </span>
                  <span className={`pc-badge pc-${v.status}`}>
                    {LABEL[v.status] || v.status}
                  </span>
                  {["missing", "outdated", "failed", "ready"].includes(
                    v.status,
                  ) ? (
                    <button
                      type="button"
                      className="ml-btn"
                      onClick={() => run({ ids: [v.id] }, "clip")}
                    >
                      {v.status === "ready" ? "Re-make" : "Make clip"}
                    </button>
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  );
}
