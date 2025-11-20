// src/pages/public/channel/Watch.js
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../api";
import PublicHeader from "../../components/PublicHeader";

export default function Watch() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        const res = await api.get(`/videos/${id}`);
        const current = res.data;

        const all = await api.get("/videos");
        const related = all.data.filter(
          (v) => v.id !== current.id && v.category_id === current.category_id
        );

        setVideo({ ...current, related });
      } catch (err) {
        console.error("Failed to load video", err);
      }
    };
    fetchVideo();
  }, [id]);

  if (!video) {
    return (
      <>
        <PublicHeader />
        <div style={{ padding: "2rem" }}>
          <p>Loading video...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PublicHeader />
      <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <Link
            to="/videos"
            style={{ textDecoration: "none", color: "#007bff" }}
          >
            ← Back to Videos
          </Link>
        </div>

        <video
          controls
          style={{ width: "100%", maxHeight: "500px", borderRadius: "8px" }}
          src={video.video_url}
          poster={video.thumbnail_url || undefined}
        >
          Sorry, your browser doesn't support embedded video.
        </video>

        <h2 style={{ marginTop: "1rem" }}>{video.title}</h2>
        <p style={{ fontStyle: "italic", color: "#666" }}>
          {video.category_name} ({video.category_type})
        </p>
        <p>{video.description}</p>

        {/* Related Videos */}
        {video.related?.length > 0 && (
          <>
            <h3 style={{ marginTop: "2rem" }}>Related Videos</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "1rem",
                marginTop: "1rem",
              }}
            >
              {video.related.map((v) => (
                <Link
                  to={`/watch/${v.id}`}
                  key={v.id}
                  style={{
                    textDecoration: "none",
                    background: "#f9f9f9",
                    borderRadius: "6px",
                    overflow: "hidden",
                    border: "1px solid #ddd",
                  }}
                >
                  {v.thumbnail_url ? (
                    <img
                      src={v.thumbnail_url}
                      alt={v.title}
                      style={{
                        width: "100%",
                        height: "120px",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div style={{ height: "120px", background: "#eee" }} />
                  )}
                  <div style={{ padding: "0.5rem" }}>
                    <small>{v.title}</small>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
