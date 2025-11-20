import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";

export default function MyVideos() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Server already scopes to owner for non-admins
        const { data } = await api.get("/videos", { params: { limit: 200 } });
        setItems(data?.items || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>My Videos</h2>
        <Link to="/account/upload" className="btn">
          Upload
        </Link>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: 16 }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 16 }}>No uploads yet.</div>
        ) : (
          <table className="table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Visibility</th>
                <th>Created</th>
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Link to={`/watch/${v.id}`} className="row-title">
                      {v.title || "Untitled"}
                    </Link>
                  </td>
                  <td>{v.visibility || "private"}</td>
                  <td>
                    {new Date(v.created_at || v.created).toLocaleDateString()}
                  </td>
                  <td>
                    <Link to={`/content/videos/${v.id}`} className="btn ghost">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
