// src/components/Sidebar.js
import React from "react";
import { Link, useLocation } from "react-router-dom";
import "./Sidebar.css";

export default function Sidebar() {
  const { pathname } = useLocation();

  const isActive = (to) => (pathname === to ? "active" : "");

  return (
    <aside className="sidebar">
      <h3 className="sidebar-title">Bishop Panel</h3>
      <nav className="sidebar-nav">
        <Link className={isActive("/admin")} to="/admin">
          Dashboard
        </Link>
        <Link className={isActive("/admin/upload")} to="/admin/upload">
          Upload Video
        </Link>
        <Link className={isActive("/admin/videos")} to="/admin/videos">
          Videos
        </Link>
        <Link className={isActive("/admin/categories")} to="/admin/categories">
          Categories
        </Link>
      </nav>
    </aside>
  );
}
