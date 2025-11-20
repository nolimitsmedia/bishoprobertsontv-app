// src/components/community/ChannelSidebar.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import "./channel-sidebar.css"; // optional

export default function ChannelSidebar({ value, onChange, q, onSearch }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);

  // tiny debounce for search
  const [draft, setDraft] = useState(q || "");
  useEffect(() => setDraft(q || ""), [q]);
  useEffect(() => {
    const t = setTimeout(() => onSearch?.(draft.trim()), 300);
    return () => clearTimeout(t);
  }, [draft, onSearch]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get("/community/channels")
      .then(({ data }) => !cancelled && setChannels(data?.items || []))
      .finally(() => !cancelled && setLoading(false));
    return () => (cancelled = true);
  }, []);

  return (
    <aside className="chan-wrap">
      <div className="chan-search">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search in Community"
        />
      </div>

      <div className="chan-list">
        <button
          className={`chan-item ${!value ? "active" : ""}`}
          onClick={() => onChange?.("")}
        >
          🏠 Home
        </button>

        <div className="chan-section">Public</div>
        {loading && <div className="chan-loading">Loading…</div>}

        {channels.map((c) => (
          <button
            key={c.id}
            className={`chan-item ${value === c.slug ? "active" : ""}`}
            onClick={() => onChange?.(c.slug)}
          >
            {c.name}
          </button>
        ))}
      </div>
    </aside>
  );
}
