// src/pages/account/MyPlaylists.js
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import "./MyPlaylists.css";
import { confirmDialog } from "../../components/ui/Dialogs";

/** Try multiple endpoints until one works and normalize shapes. */
async function getMyPlaylists() {
  const candidates = [
    "/playlists?mine=1&include_private=1",
    "/playlists?scope=me&include_private=1",
    "/playlists?include_private=1",
    "/playlists?mine=1",
    "/playlists?scope=me",
    "/playlists",
  ];
  for (const u of candidates) {
    try {
      const r = await api.get(u);
      let items =
        r.data?.playlists ??
        r.data?.items ??
        (Array.isArray(r.data) ? r.data : []);
      if (!Array.isArray(items)) items = [];
      return items;
    } catch (e) {
      const code = e?.response?.status;
      // keep trying on auth-ish errors; otherwise only throw on last attempt
      if (
        code !== 401 &&
        code !== 403 &&
        u === candidates[candidates.length - 1]
      )
        throw e;
    }
  }
  return [];
}

export default function MyPlaylists() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ title: "", is_public: false }); // private by default
  const [creating, setCreating] = useState(false); // the create form opens on demand
  const [menuFor, setMenuFor] = useState(null); // which card's ⋯ menu is open
  const [copied, setCopied] = useState(null);

  const shareBase = useMemo(() => {
    if (typeof window !== "undefined")
      return `${window.location.origin}/playlists/`;
    return "/playlists/";
  }, []);

  async function load() {
    setLoading(true);
    setErr("");

    // Ensure Authorization header is present on hard refresh
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token && !api.defaults.headers.common.Authorization) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }

    try {
      const items = await getMyPlaylists();
      setList(items);
    } catch (e) {
      setErr(
        e?.response?.data?.message || e.message || "Failed to load playlists",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createPlaylist(e) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return;
    try {
      const r = await api.post("/playlists", {
        title,
        is_public: !!form.is_public,
      });
      const created = r.data?.playlist ?? r.data;
      setList((x) => [created, ...x]);
      setForm({ title: "", is_public: false });
      setCreating(false);
    } catch (e) {
      alert(e?.response?.data?.message || "Create failed");
    }
  }

  async function togglePublic(p) {
    try {
      const r = await api.put(`/playlists/${p.id}`, {
        is_public: !p.is_public,
      });
      const updated = r.data?.playlist ?? r.data;
      setList((xs) =>
        xs.map((x) => (x.id === p.id ? { ...x, ...updated } : x)),
      );
    } catch (e) {
      alert(e?.response?.data?.message || "Update failed");
    }
  }

  async function remove(id) {
    if (!(await confirmDialog("Delete this playlist?"))) return;
    try {
      await api.delete(`/playlists/${id}`);
      setList((xs) => xs.filter((x) => x.id !== id));
    } catch (e) {
      alert(e?.response?.data?.message || "Delete failed");
    }
  }

  async function copyShare(url) {
    try {
      await navigator.clipboard.writeText(url); // the card shows "Link copied"
    } catch {
      // no-op
    }
  }

  // close the ⋯ menu on outside click / Escape
  useEffect(() => {
    if (menuFor === null) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.(".mp-menuWrap")) setMenuFor(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenuFor(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuFor]);

  return (
    <div className="mp-page">
      <header className="mp-head">
        <div>
          <h1 className="mp-title">My Playlists</h1>
          <p className="mp-sub">
            Group messages to watch later or share with others.
          </p>
        </div>
        {!creating ? (
          <button
            type="button"
            className="mp-btn mp-btn--primary"
            onClick={() => setCreating(true)}
          >
            <span aria-hidden="true">+</span> New playlist
          </button>
        ) : null}
      </header>

      {creating ? (
        <form className="mp-card mp-create" onSubmit={createPlaylist}>
          <label className="mp-field">
            <span className="mp-label">Playlist name</span>
            <input
              className="mp-input"
              autoFocus
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g., Favorite Messages"
            />
          </label>
          <div className="mp-field">
            <span className="mp-label" id="mp-vis-label">
              Who can see it
            </span>
            <div
              className="mp-seg"
              role="radiogroup"
              aria-labelledby="mp-vis-label"
            >
              <button
                type="button"
                role="radio"
                aria-checked={!form.is_public}
                className={!form.is_public ? "is-on" : ""}
                onClick={() => setForm((f) => ({ ...f, is_public: false }))}
              >
                Private
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!!form.is_public}
                className={form.is_public ? "is-on" : ""}
                onClick={() => setForm((f) => ({ ...f, is_public: true }))}
              >
                Public
              </button>
            </div>
          </div>
          <p className="mp-hint">
            {form.is_public
              ? "Anyone with the link can view this playlist."
              : "Only you can see this playlist."}
          </p>
          <div className="mp-createActions">
            <button
              type="button"
              className="mp-btn mp-btn--ghost"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="mp-btn mp-btn--primary"
              disabled={!form.title.trim()}
            >
              Create
            </button>
          </div>
        </form>
      ) : null}

      {loading && (
        <p className="mp-state" role="status">
          Loading…
        </p>
      )}
      {err && (
        <p className="mp-error" role="alert">
          {err}
        </p>
      )}

      {!loading && !err && list.length === 0 && (
        <div className="mp-empty">
          <strong>No playlists yet</strong>
          <span>Create one, then use “Save” on any message to add it.</span>
        </div>
      )}

      <ul className="mp-grid">
        {list.map((p) => {
          const id = p?.id ?? p?.playlist_id;
          const slug = p?.slug;
          const shareUrl = slug ? shareBase + slug : shareBase + (id ?? "");
          const count =
            p.count ?? p.video_count ?? p.items_count ?? p.videos?.length ?? 0;
          const cover =
            p.thumbnail_url ||
            p.cover_url ||
            p.image_url ||
            p.first_thumbnail ||
            "";
          const openTo = `/playlists/${slug || id}`;
          return (
            <li key={id} className="mp-tile">
              <Link
                to={openTo}
                className="mp-cover"
                aria-label={`Open ${p.title || "playlist"}`}
              >
                {cover ? (
                  <img src={cover} alt="" loading="lazy" />
                ) : (
                  <span className="mp-coverIcon" aria-hidden="true">
                    ▶
                  </span>
                )}
                <span className="mp-count">
                  {count} {count === 1 ? "video" : "videos"}
                </span>
              </Link>
              <div className="mp-tileBody">
                <div className="mp-tileText">
                  <Link to={openTo} className="mp-tileTitle">
                    {p.title || "Untitled"}
                  </Link>
                  <span className="mp-tileMeta">
                    <span
                      className={`mp-dot${p.is_public ? " is-public" : ""}`}
                      aria-hidden="true"
                    />
                    {p.is_public ? "Public" : "Private"}
                    {copied === id ? (
                      <span className="mp-copied" role="status">
                        Link copied
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="mp-menuWrap">
                  <button
                    type="button"
                    className="mp-kebab"
                    aria-label={`More actions for ${p.title || "playlist"}`}
                    aria-haspopup="menu"
                    aria-expanded={menuFor === id}
                    onClick={() => setMenuFor((m) => (m === id ? null : id))}
                  >
                    ⋯
                  </button>
                  {menuFor === id ? (
                    <div className="mp-menu" role="menu">
                      <Link
                        role="menuitem"
                        to={`/account/playlists/${slug || id}/edit`}
                        className="mp-menuItem"
                      >
                        Edit
                      </Link>
                      <button
                        role="menuitem"
                        type="button"
                        className="mp-menuItem"
                        onClick={() => {
                          setMenuFor(null);
                          togglePublic(p);
                        }}
                      >
                        {p.is_public ? "Make private" : "Make public"}
                      </button>
                      {p.is_public ? (
                        <button
                          role="menuitem"
                          type="button"
                          className="mp-menuItem"
                          onClick={async () => {
                            setMenuFor(null);
                            await copyShare(shareUrl);
                            setCopied(id);
                            setTimeout(() => setCopied(null), 2000);
                          }}
                        >
                          Copy link
                        </button>
                      ) : null}
                      <button
                        role="menuitem"
                        type="button"
                        className="mp-menuItem is-danger"
                        onClick={() => {
                          setMenuFor(null);
                          remove(id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
