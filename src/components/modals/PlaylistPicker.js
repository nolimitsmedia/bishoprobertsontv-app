// src/components/modals/PlaylistPicker.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import api from "../../api";
import "./PlaylistPicker.css"; // ← ensure this exists

export default function PlaylistPicker({ videoId, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  /* ------------------------------
     TRUE DEBOUNCE SEARCH
  ------------------------------ */
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim().toLowerCase());
      setDropdownOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  /* ------------------------------
     LOAD PLAYLISTS WHEN OPEN
  ------------------------------ */
  useEffect(() => {
    if (!open) return;

    (async () => {
      try {
        setLoading(true);

        const [listRes, selRes] = await Promise.all([
          api.get("/playlists"),
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
        console.error(e);
        alert("Failed to load playlists");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, videoId]);

  /* ------------------------------
     FILTER PLAYLIST OPTIONS
  ------------------------------ */
  const filtered = useMemo(() => {
    if (!debouncedQ) return playlists;
    return playlists.filter((p) => p.title.toLowerCase().includes(debouncedQ));
  }, [debouncedQ, playlists]);

  /* ------------------------------
     TOGGLE SELECT
  ------------------------------ */
  const toggleSelect = (id) => {
    setPlaylists((ps) =>
      ps.map((p) =>
        p.id === String(id) ? { ...p, selected: !p.selected } : p,
      ),
    );
  };

  /* ------------------------------
     SAVE SELECTION
  ------------------------------ */
  const save = async () => {
    try {
      setLoading(true);

      const cur = await api.get(`/playlists/videos/${videoId}`);
      const curSet = new Set(cur.data?.playlist_ids || []);
      const wantSet = new Set(
        playlists.filter((p) => p.selected).map((p) => String(p.id)),
      );

      const adds = [...wantSet].filter((id) => !curSet.has(id));
      const rems = [...curSet].filter((id) => !wantSet.has(id));

      await Promise.all([
        ...adds.map((id) =>
          api.post(`/playlists/${id}/videos`, { video_id: videoId }),
        ),
        ...rems.map((id) => api.delete(`/playlists/${id}/videos/${videoId}`)),
      ]);

      onClose?.(true);
    } catch (e) {
      console.error(e);
      alert("Failed to update playlists");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------
     CREATE PLAYLIST
  ------------------------------ */
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
    } catch {
      alert("Failed to create playlist");
    } finally {
      setCreating(false);
    }
  };

  /* ------------------------------
     CLOSE DROPDOWN ON OUTSIDE CLICK
  ------------------------------ */
  useEffect(() => {
    function clickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  if (!open) return null;

  /* ------------------------------
     RENDER
  ------------------------------ */
  return (
    <div className="vd-overlay" onClick={() => onClose?.(false)}>
      <div
        className="vd-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560 }}
      >
        <h3 className="vd-h">Add to playlist</h3>

        {/* SEARCH INPUT */}
        <div className="pp-input-wrapper" ref={dropdownRef}>
          <input
            className="search"
            placeholder="Search playlists…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setDropdownOpen(true)}
          />

          {/* DROPDOWN */}
          {dropdownOpen && (
            <div className="pp-dropdown">
              {loading ? (
                <div className="pp-empty">Loading…</div>
              ) : filtered.length ? (
                filtered.map((p) => (
                  <div
                    key={p.id}
                    className={`pp-item ${p.selected ? "selected" : ""}`}
                    onClick={() => toggleSelect(p.id)}
                  >
                    {p.title}
                  </div>
                ))
              ) : (
                <div className="pp-empty">No results</div>
              )}
            </div>
          )}
        </div>

        {/* SELECTED TAGS */}
        <div className="pp-tag-row">
          {playlists
            .filter((p) => p.selected)
            .map((p) => (
              <span
                key={p.id}
                className="pp-tag"
                onClick={() => toggleSelect(p.id)}
              >
                {p.title} ✕
              </span>
            ))}
        </div>

        {/* CREATE NEW PLAYLIST */}
        <div className="vd-gap" />
        <div className="vd-row">
          <input
            className="search"
            placeholder="New playlist title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button className="btn" onClick={createNow} disabled={creating}>
            {creating ? "Creating…" : "Create + select"}
          </button>
        </div>

        {/* ACTION BUTTONS */}
        <div className="vd-row right" style={{ marginTop: 14 }}>
          <button className="btn ghost" onClick={() => onClose?.(false)}>
            Cancel
          </button>
          <button className="btn save" onClick={save} disabled={loading}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
