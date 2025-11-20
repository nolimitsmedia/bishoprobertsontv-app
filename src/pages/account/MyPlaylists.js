// src/pages/account/MyPlaylists.js
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";

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
  const [form, setForm] = useState({ title: "", is_public: true });

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
        e?.response?.data?.message || e.message || "Failed to load playlists"
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
      setForm({ title: "", is_public: true });
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
        xs.map((x) => (x.id === p.id ? { ...x, ...updated } : x))
      );
    } catch (e) {
      alert(e?.response?.data?.message || "Update failed");
    }
  }

  async function remove(id) {
    if (!window.confirm("Delete this playlist?")) return;
    try {
      await api.delete(`/playlists/${id}`);
      setList((xs) => xs.filter((x) => x.id !== id));
    } catch (e) {
      alert(e?.response?.data?.message || "Delete failed");
    }
  }

  async function copyShare(url) {
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
    } catch {
      // no-op
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header with Back to Catalog */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          My Playlists
        </h1>
        <Link to="/catalog" className="btn-outline">
          ← Back to Catalog
        </Link>
      </div>

      {/* Create form */}
      <form
        onSubmit={createPlaylist}
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Playlist name (e.g., Favorite Messages)"
          style={{
            minWidth: 260,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #dde3ea",
            outline: "none",
          }}
        />
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            color: "#334155",
          }}
        >
          <input
            type="checkbox"
            checked={!!form.is_public}
            onChange={(e) =>
              setForm((f) => ({ ...f, is_public: e.target.checked }))
            }
          />
          Public (shareable)
        </label>
        <button
          type="submit"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #0b5cff",
            background: "#0b5cff",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          Create
        </button>
      </form>

      {loading && <div>Loading…</div>}
      {err && <div style={{ color: "crimson", marginTop: 8 }}>{err}</div>}

      {!loading && !err && list.length === 0 && (
        <div
          style={{
            border: "1px dashed #cbd5e1",
            borderRadius: 12,
            padding: 16,
            color: "#64748b",
            background: "#f8fafc",
          }}
        >
          You don’t have any playlists yet. Use the form above to create one,
          then add videos from any video page using “Add to playlist”.
        </div>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {list.map((p) => {
          const id = p?.id ?? p?.playlist_id;
          const slug = p?.slug;
          const shareUrl = slug ? shareBase + slug : shareBase + (id ?? "");
          const count =
            p.count ?? p.video_count ?? p.items_count ?? p.videos?.length ?? 0;

          return (
            <div
              key={id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                alignItems: "center",
                border: "1px solid #eef2f7",
                borderRadius: 12,
                padding: 14,
                background: "#fff",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{p.title || "Untitled"}</div>
                <div style={{ fontSize: 13, color: "#667085", marginTop: 2 }}>
                  {p.is_public ? "Public" : "Private"} · {count}{" "}
                  {count === 1 ? "video" : "videos"}
                </div>
                {p.is_public && (
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    Share link:{" "}
                    <a href={shareUrl} target="_blank" rel="noreferrer">
                      {shareUrl}
                    </a>{" "}
                    <button
                      className="btn-mini"
                      type="button"
                      onClick={() => copyShare(shareUrl)}
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <Link to={`/playlists/${slug || id}`} className="btn-outline">
                  Open
                </Link>
                <Link
                  to={`/account/playlists/${slug || id}/edit`}
                  className="btn-outline"
                >
                  Edit
                </Link>
                <button className="btn-outline" onClick={() => togglePublic(p)}>
                  {p.is_public ? "Make Private" : "Make Public"}
                </button>
                <button className="btn-danger" onClick={() => remove(id)}>
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .btn-outline {
          padding: 8px 12px; border-radius: 10px; border: 1px solid #cbd5e1;
          background: #fff; color: #0b5cff; text-decoration: none; font-weight: 600;
        }
        .btn-outline:hover { background: #f8fafc; }
        .btn-danger {
          padding: 8px 12px; border-radius: 10px; border: 1px solid #fee2e2;
          background: #fff; color: #b91c1c; font-weight: 600;
        }
        .btn-danger:hover { background: #fff1f2; }
        .btn-mini {
          padding: 4px 8px; border-radius: 8px; border: 1px solid #cbd5e1;
          background: #fff; color: #0b5cff; font-weight: 600; margin-left: 6px;
        }
        .btn-mini:hover { background: #f8fafc; }
      `}</style>
    </div>
  );
}
