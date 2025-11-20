// src/pages/public/channel/Categories.js
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api";
import PublicHeader from "../../components/PublicHeader";

export default function CategoryPage() {
  const { type } = useParams();
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await api.get("/videos");
        const filtered = res.data.filter(
          (v) => v.category_type?.toLowerCase() === type.toLowerCase()
        );
        setVideos(filtered);
      } catch (err) {
        console.error("Failed to load videos", err);
      }
    };
    fetchVideos();
  }, [type]);

  return (
    <>
      <PublicHeader />
      <div style={{ padding: "2rem" }}>
        <h2>{type.charAt(0).toUpperCase() + type.slice(1)} Videos</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: "1.5rem",
            marginTop: "1rem",
          }}
        >
          {videos.map((video) => (
            <Link
              to={`/watch/${video.id}`}
              key={video.id}
              style={{
                textDecoration: "none",
                color: "#000",
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              {video.thumbnail_url ? (
                <img
                  src={video.thumbnail_url}
                  alt={video.title}
                  style={{ width: "100%", height: "150px", objectFit: "cover" }}
                />
              ) : (
                <div style={{ height: "150px", background: "#eee" }} />
              )}
              <div style={{ padding: "0.8rem" }}>
                <h3 style={{ margin: 0 }}>{video.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
