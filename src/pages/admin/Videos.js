import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import Sidebar from "../../components/Sidebar";

export default function Videos() {
  const [videos, setVideos] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const navigate = useNavigate();

  const fetchVideos = async () => {
    try {
      const res = await api.get("/videos");
      setVideos(res.data);
      setFiltered(res.data);
    } catch (err) {
      console.error("Failed to fetch videos:", err);
      setMessage("Error loading videos");
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await api.delete(`/videos/${id}`);
      setMessage("Video deleted.");
      fetchVideos();
    } catch (err) {
      console.error("Delete failed:", err);
      setMessage("Delete failed");
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value.toLowerCase();
    setSearch(value);
    setCurrentPage(1);
    setFiltered(videos.filter((v) => v.title.toLowerCase().includes(value)));
  };

  // Pagination calculations
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentVideos = filtered.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <h2>All Videos</h2>

        <input
          type="text"
          value={search}
          onChange={handleSearch}
          placeholder="Search by title..."
          style={{ marginBottom: "1rem", padding: "8px", width: "300px" }}
        />

        {message && <p>{message}</p>}

        <table>
          <thead>
            <tr>
              <th>Thumbnail</th>
              <th>Title</th>
              <th>Category</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentVideos.map((video) => (
              <tr key={video.id}>
                <td>
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt="thumb"
                      style={{
                        width: "100px",
                        height: "auto",
                        borderRadius: "4px",
                      }}
                    />
                  ) : (
                    <span>No thumbnail</span>
                  )}
                </td>
                <td>{video.title}</td>
                <td>
                  {video.category_name} ({video.category_type})
                </td>
                <td>{new Date(video.created_at).toLocaleString()}</td>
                <td>
                  <button onClick={() => navigate(`/videos/edit/${video.id}`)}>
                    Edit
                  </button>{" "}
                  <button onClick={() => handleDelete(video.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination controls */}
        <div style={{ marginTop: "1rem" }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setCurrentPage(n)}
              style={{
                margin: "0 5px",
                padding: "5px 10px",
                background: n === currentPage ? "#444" : "#ccc",
                color: n === currentPage ? "#fff" : "#000",
                border: "none",
                cursor: "pointer",
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
