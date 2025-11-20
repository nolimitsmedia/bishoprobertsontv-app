// src/auth/ProtectedRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../api";

/**
 * Usage:
 * <ProtectedRoute roles={["admin"]}>
 *   <AdminDashboard />
 * </ProtectedRoute>
 *
 * - If no token, saves the intended path and redirects to /login?next=...
 * - Accepts optional `roles` (array). If provided, user.role must be included.
 * - Reads token/user from localStorage OR sessionStorage (supports “Remember me”).
 */
export default function ProtectedRoute({ children, roles }) {
  const location = useLocation();

  // Token can live in localStorage (remembered) or sessionStorage.
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  // Helper to read stored user
  const getStoredUser = () => {
    try {
      const raw =
        localStorage.getItem("user") || sessionStorage.getItem("user") || "{}";
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  // No token → remember where we wanted to go and bounce to login
  if (!token) {
    const target =
      location.pathname + (location.search || "") + (location.hash || "");
    localStorage.setItem("pendingPath", target);
    return (
      <Navigate to={`/login?next=${encodeURIComponent(target)}`} replace />
    );
  }

  // Ensure API uses our token for subsequent requests (idempotent)
  if (!api.defaults.headers.common.Authorization) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  // Role enforcement (optional)
  if (roles && roles.length) {
    const user = getStoredUser();
    const role = String(user.role || "user").toLowerCase();
    if (!roles.includes(role)) {
      // Not authorized for this area → send them somewhere sensible
      return <Navigate to={role === "admin" ? "/admin" : "/account"} replace />;
    }
  }

  // Authenticated (and authorized if roles provided)
  return children;
}
