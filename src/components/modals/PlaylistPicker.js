// src/components/modals/PlaylistPicker.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";

export default function PlaylistPicker({ videoId, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState([]); // [{id,title,selected}]
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setLoading(true);
        const [listRes, selRes] = await Promise.all([
          api.get("/playlists"), // mine (or all, if admin)
          api.get(`/playlists/videos/${videoId}`),
        ]);
        const selectedSet = new Set(selRes.data?.playlist_ids || []);
        const items = (listRes.data?.items || []).map((p) => ({
          id: String(p.id),
          title: p.title || `Playlist ${p.id}`,
          selected: selectedSet.has(String(p.id)),
        }));
        setPlaylists(items);
      } catch (e) {
        alert(e?.response?.data?.message || "Failed to load playlists");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, videoId]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return playlists;
    return playlists.filter((p) => p.title.toLowerCase().includes(qq));
  }, [q, playlists]);

  const toggle = (id) =>
    setPlaylists((ps) =>
      ps.map((p) => (p.id === String(id) ? { ...p, selected: !p.selected } : p))
    );

  const createNow = async () => {
    if (!newTitle.trim()) return;
    try {
      setCreating(true);
      const { data } = await api.post("/playlists", {
        title: newTitle.trim(),
        visibility: "public",
      });
      setPlaylists((ps) => [
        ...ps,
        { id: String(data.id), title: data.title, selected: true },
      ]);
      setNewTitle("");
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to create playlist");
    } finally {
      setCreating(false);
    }
  };

  const save = async () => {
    try {
      setLoading(true);
      // Fetch current server-side selection to diff (in case of drift)
      const cur = await api.get(`/playlists/videos/${videoId}`);
      const curSet = new Set(cur.data?.playlist_ids || []);
      const wantSet = new Set(
        playlists.filter((p) => p.selected).map((p) => String(p.id))
      );

      // additions
      const adds = [...wantSet].filter((id) => !curSet.has(id));
      // removals
      const rems = [...curSet].filter((id) => !wantSet.has(id));

      await Promise.all([
        ...adds.map((id) =>
          api.post(`/playlists/${id}/videos`, { video_id: videoId })
        ),
        ...rems.map((id) => api.delete(`/playlists/${id}/videos/${videoId}`)),
      ]);

      onClose?.(true);
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to update playlists");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="vd-overlay" onClick={() => onClose?.(false)}>
      <div
        className="vd-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560 }}
      >
        <h3 className="vd-h">Add to playlist</h3>

        <input
          className="search"
          placeholder="Search playlists…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ marginTop: 6 }}
        />

        <div className="vd-gap" />
        <div className="vd-list" style={{ maxHeight: 280, overflow: "auto" }}>
          {loading ? (
            <div className="vd-muted">Loading…</div>
          ) : filtered.length ? (
            filtered.map((p) => (
              <label
                key={p.id}
                className="vd-list-row"
                style={{ cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={!!p.selected}
                  onChange={() => toggle(p.id)}
                  style={{ marginRight: 10 }}
                />
                {p.title}
              </label>
            ))
          ) : (
            <div className="vd-muted">No playlists</div>
          )}
        </div>

        <div className="vd-gap" />
        <div className="vd-row">
          <input
            className="search"
            placeholder="New playlist title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button
            className="btn"
            onClick={createNow}
            disabled={creating || !newTitle.trim()}
          >
            {creating ? "Creating…" : "Create + select"}
          </button>
        </div>

        <div className="vd-row right" style={{ marginTop: 14 }}>
          <button className="btn ghost" onClick={() => onClose?.(false)}>
            Cancel
          </button>
          <button className="btn" onClick={save} disabled={loading}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
