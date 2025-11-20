// src/layout/sidebarConfig.js
export const ADMIN_SIDEBAR = [
  { label: "Dashboard", to: "/admin", icon: "🏠" },
  { label: "Videos", to: "/admin/videos", icon: "🎬" },
  { label: "Categories", to: "/admin/categories", icon: "🗂️" },
  { label: "Collections", to: "/admin/collections", icon: "📚" },
  { label: "Live Streaming", to: "/admin/live", icon: "🔴" },
  { label: "Subscriptions", to: "/admin/subscriptions", icon: "💳" },
  { label: "Website Pages", to: "/admin/pages", icon: "📝" },
];

export const PUBLIC_SIDEBAR = [
  { label: "Home", to: "/", icon: "🏠" },
  { label: "Watch Live", to: "/live", icon: "🔴" },
  { label: "Videos", to: "/videos", icon: "🎬" },
  { label: "Collections", to: "/collections", icon: "📚" },
];
