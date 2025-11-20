// src/pages/public/channel/Videos.js
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import PublicHeader from "../../components/PublicHeader";

export default function PublicVideos() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await api.get("/videos");
        setVideos(res.data);
      } catch (err) {
        console.error("Failed to load videos", err);
      }
    };
    fetchVideos();
  }, []);

  return (
    <>
      <PublicHeader />
      <div style={{ padding: "2rem" }}>
        <h2>All Videos</h2>
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
                boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
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
                <h3 style={{ margin: "0 0 0.5rem" }}>{video.title}</h3>
                <small>
                  {video.category_name} ({video.category_type})
                </small>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
