// src/auth/adminAccess.js
//
// Phase 8-1: what the signed-in person may use in the admin panel.
// The server enforces every rule; this only shapes the screens (sidebar,
// landing page, "no access" message). Access comes from /api/admin/access/me.

import React, { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../api";

// Admin addresses that belong to a team role. Anything else under /admin is
// for administrators only. Longest prefix wins.
export const AREA_BY_PATH = [
  ["/admin/pages", "website"],
  ["/admin/media", "website"],
  ["/admin/navigation", "website"],
  ["/admin/site-design", "website"],
  ["/admin/site-settings", "website"],
  ["/admin/forms", ["website", "support", "community"]],
  ["/admin/integrations/live", "website"],
  ["/admin/preview-clips", ["website", "content", "video_upload"]],
  // Videos: Content Managers and Video Uploaders
  ["/admin/content/videos", ["content", "video_upload"]],
  ["/admin/content/live", "content"],
  ["/admin/content/collections", "content"],
  ["/admin/content/calendar", "content"],
  ["/admin/content/resources", "content"],
  ["/admin/content/organize", "content"],
  ["/admin/content/wasabi-import", "content"],
  ["/admin/content/wasabi-importer", "content"],
  // Phase 8-2
  ["/admin/content/email-center", "marketing"],
  ["/admin/content/email-automations", "marketing"],
  ["/admin/users", "support"],
  ["/community", "community"],
];

export const ROLE_LABELS = {
  website: "Website Manager",
  content: "Content Manager",
  video_upload: "Video Uploader",
  community: "Community Manager",
  marketing: "Marketing Manager",
  support: "Customer Support",
};

export function areaForPath(path) {
  const p =
    String(path || "")
      .split(/[?#]/)[0]
      .replace(/\/+$/, "") || "/";
  let best = null;
  for (const [prefix, area] of AREA_BY_PATH) {
    if (
      (p === prefix || p.startsWith(prefix + "/")) &&
      (!best || prefix.length > best[0].length)
    )
      best = [prefix, area];
  }
  return best ? best[1] : "admin";
}

// area: a role name, a list of role names (any of them), or "admin".
export function canUseArea(access, area) {
  if (!access) return false;
  if (access.isAdmin) return true;
  if (area === "admin") return false;
  const roles = Array.isArray(access.teamRoles) ? access.teamRoles : [];
  return (Array.isArray(area) ? area : [area]).some((a) => roles.includes(a));
}

// First admin address this person can open (team members don't get the Dashboard).
export function homePathFor(access) {
  if (!access || access.isAdmin) return "/admin";
  const r = access.teamRoles || [];
  if (r.includes("website")) return "/admin/pages";
  if (r.includes("content") || r.includes("video_upload"))
    return "/admin/content/videos";
  if (r.includes("marketing")) return "/admin/content/email-center";
  if (r.includes("support")) return "/admin/users";
  if (r.includes("community")) return "/community/new";
  return "/account";
}

const AccessContext = createContext({ access: null, loading: true, error: "" });

export function useAdminAccess() {
  return useContext(AccessContext);
}

export function AdminAccessProvider({ children }) {
  const [state, setState] = useState({
    access: null,
    loading: true,
    error: "",
  });
  useEffect(() => {
    let alive = true;
    api
      .get("/admin/access/me")
      .then(({ data }) => {
        if (alive)
          setState({ access: data?.access || null, loading: false, error: "" });
      })
      .catch((e) => {
        if (!alive) return;
        const status = e?.response?.status;
        setState({
          access: null,
          loading: false,
          error: status === 401 ? "signed-out" : "unavailable",
        });
      });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <AccessContext.Provider value={state}>{children}</AccessContext.Provider>
  );
}

function GateInner({ area, children }) {
  const { access, loading, error } = useAdminAccess();
  const location = useLocation();
  if (loading) return null;
  if (error === "signed-out") {
    const target = location.pathname + location.search + location.hash;
    return (
      <Navigate to={`/login?next=${encodeURIComponent(target)}`} replace />
    );
  }
  if (error) {
    return (
      <div style={{ padding: 32, color: "#e5e7eb" }} role="alert">
        The admin panel could not check your access. Refresh the page to try
        again.
      </div>
    );
  }
  if (!access?.isStaff) return <Navigate to="/account" replace />;
  if (area && !canUseArea(access, area))
    return <Navigate to={homePathFor(access)} replace />;
  return children;
}

// Wrap admin routes: only administrators and team members get in.
export function AdminGate({ area = null, children }) {
  return (
    <AdminAccessProvider>
      <GateInner area={area}>{children}</GateInner>
    </AdminAccessProvider>
  );
}
