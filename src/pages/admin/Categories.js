import React, { useEffect, useState } from "react";
import api from "../../api";
import Sidebar from "../../components/Sidebar";

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("sermon");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [editId, setEditId] = useState(null);

  const fetchCategories = async () => {
    const res = await api.get("/categories");
    setCategories(res.data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.put(`/categories/${editId}`, { name, type, description });
        setMessage("Category updated.");
      } else {
        await api.post("/categories", { name, type, description });
        setMessage("Category created.");
      }

      setName("");
      setType("sermon");
      setDescription("");
      setEditId(null);
      fetchCategories();
    } catch (err) {
      setMessage("Failed to save category");
    }
  };

  const handleEdit = (cat) => {
    setEditId(cat.id);
    setName(cat.name);
    setType(cat.type);
    setDescription(cat.description || "");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await api.delete(`/categories/${id}`);
      setMessage("Category deleted.");
      fetchCategories();
    } catch (err) {
      setMessage("Failed to delete category");
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <h2>{editId ? "Edit Category" : "Add Category"}</h2>
        {message && <p>{message}</p>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="sermon">Sermon</option>
            <option value="series">Series</option>
            <option value="event">Event</option>
          </select>
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button type="submit">{editId ? "Update" : "Add Category"}</button>
        </form>

        <h3>Existing Categories</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td>{cat.name}</td>
                <td>{cat.type}</td>
                <td>{cat.description}</td>
                <td>
                  <button onClick={() => handleEdit(cat)}>Edit</button>
                  <button onClick={() => handleDelete(cat.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
