// src/pages/studio/LiveList.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";

export default function LiveList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const { data } = await api.get("/live/events");
        if (!ok) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        setErr("Failed to load events");
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => {
      ok = false;
    };
  }, []);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Link className="btn ghost" to="/account">
          ← Back to account
        </Link>
        <div style={{ flex: 1 }} />
        <Link className="btn primary" to="/studio/live/new">
          Create live event
        </Link>
      </div>

      <div className="card" style={{ marginTop: 16, padding: 0 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 160px 130px",
            gap: 0,
            padding: "12px 16px",
            fontWeight: 700,
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div>Title</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {loading ? (
          <div style={{ padding: 16, color: "#64748b" }}>Loading…</div>
        ) : err ? (
          <div style={{ padding: 16, color: "crimson" }}>{err}</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 16, color: "#64748b" }}>
            No live events yet.
          </div>
        ) : (
          items.map((ev) => (
            <div
              key={ev.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 160px 130px",
                padding: "12px 16px",
                borderTop: "1px solid var(--line)",
                alignItems: "center",
              }}
            >
              {/* Make title clickable -> management page */}
              <Link
                to={`/studio/live/${ev.id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  fontWeight: 600,
                }}
              >
                {ev.title || `Event #${ev.id}`}
              </Link>

              <div>{ev.status || "scheduled"}</div>

              <div style={{ display: "flex", gap: 8 }}>
                <Link className="btn outline" to={`/studio/live/${ev.id}`}>
                  Manage
                </Link>
                <Link className="btn ghost" to={`/watch/live/${ev.id}`}>
                  Open
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
