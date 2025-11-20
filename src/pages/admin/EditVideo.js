import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api";
import Sidebar from "../../components/Sidebar";

export default function EditVideo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        const res = await api.get(`/videos/${id}`);
        setVideo(res.data);
      } catch {
        setMessage("Failed to load video");
      }
    };

    const fetchCategories = async () => {
      const res = await api.get("/categories");
      setCategories(res.data);
    };

    fetchVideo();
    fetchCategories();
  }, [id]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/videos/${id}`, video);
      setMessage("Video updated successfully");
      setTimeout(() => navigate("/videos"), 1000);
    } catch (err) {
      setMessage("Failed to update video");
    }
  };

  const handleChange = (e) => {
    setVideo({ ...video, [e.target.name]: e.target.value });
  };

  if (!video)
    return (
      <div className="layout">
        <Sidebar />
        <div className="main">Loading...</div>
      </div>
    );

  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <h2>Edit Video</h2>
        {message && <p>{message}</p>}
        <form onSubmit={handleUpdate}>
          <input
            type="text"
            name="title"
            value={video.title}
            onChange={handleChange}
            placeholder="Title"
            required
          />
          <textarea
            name="description"
            value={video.description}
            onChange={handleChange}
            placeholder="Description"
          />
          <select
            name="category_id"
            value={video.category_id || ""}
            onChange={handleChange}
            required
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.type})
              </option>
            ))}
          </select>
          <input
            type="text"
            name="thumbnail_url"
            value={video.thumbnail_url || ""}
            onChange={handleChange}
            placeholder="Thumbnail URL"
          />
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              name="is_premium"
              checked={!!video.is_premium}
              onChange={(e) =>
                setVideo({ ...video, is_premium: e.target.checked })
              }
            />
            Premium content (subscribers only)
          </label>
          <button type="submit">Update Video</button>
        </form>
      </div>
    </div>
  );
}
