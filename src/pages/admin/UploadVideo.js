import React, { useState, useEffect } from "react";
import api from "../../api";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";

export default function UploadVideo() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in as admin to upload.");
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get("/categories");
        setCategories(res.data);
      } catch (err) {
        console.error("Failed to load categories", err);
        setMessage("Failed to load categories");
      }
    };
    fetchCategories();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!title.trim()) return setMessage("Please enter a title.");
    if (!categoryId) return setMessage("Please select a category.");
    if (!videoFile) return setMessage("Please choose a video file.");

    try {
      setUploading(true);

      // 1) Upload video to Wasabi
      const formData = new FormData();
      formData.append("video", videoFile);

      const uploadRes = await api.post("/upload/video", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const videoUrl = uploadRes.data?.url;
      if (!videoUrl) throw new Error("Upload did not return a URL");

      // 2) Save video metadata (now includes is_premium)
      await api.post("/videos", {
        title,
        description,
        category_id: categoryId,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl || null,
        duration: 0, // TODO: implement duration extractor later
        is_premium: isPremium, // ✅ send to backend
      });

      setMessage("✅ Video uploaded successfully");
      // Reset form
      setTitle("");
      setDescription("");
      setCategoryId("");
      setVideoFile(null);
      setThumbnailUrl("");
      setIsPremium(false);
    } catch (err) {
      console.error(err);
      setMessage("❌ Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <h2>Upload New Video</h2>
        {message && <p>{message}</p>}

        <form onSubmit={handleUpload}>
          <input
            type="text"
            placeholder="Video Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={isPremium}
              onChange={(e) => setIsPremium(e.target.checked)}
            />
            Premium content (subscribers only)
          </label>

          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">Select Category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.type})
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Thumbnail URL (optional)"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
          />

          {thumbnailUrl ? (
            <div style={{ marginBottom: 12 }}>
              <img
                src={thumbnailUrl}
                alt="thumbnail preview"
                style={{ width: 160, height: "auto", borderRadius: 6 }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
          ) : null}

          <input
            type="file"
            accept="video/*"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
            required
          />

          {videoFile && (
            <small style={{ display: "block", marginTop: 6 }}>
              Selected: {videoFile.name}
            </small>
          )}

          <button type="submit" disabled={uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </form>
      </div>
    </div>
  );
}
