// src/layout/PublicLayout.jsx
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import "./PublicLayout.css";
import useSupportWidget from "../support/useSupportWidget";
import api from "../api";
import SiteFooter from "../components/SiteFooter";
import Logo from "../assets/BishopRobertsonTVLogo.png";

export default function PublicLayout() {
  useSupportWidget();

  const [open, setOpen] = useState(false); // mobile menu
  const [aboutDrawerOpen, setAboutDrawerOpen] = useState(false); // mobile submenu
  const [me, setMe] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  // Hide Bishop TV global header on channel routes (/c, /c/:slug, /c/:slug/*)
  const isChannelRoute = /^\/c(\/|$)/.test(location.pathname);
  const isAdminRoute = /^\/admin(\/|$)/.test(location.pathname);

  const token = useMemo(
    () => localStorage.getItem("token") || sessionStorage.getItem("token"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.key],
  );

  // Close mobile menu on route change
  useEffect(() => {
    setOpen(false);
    setAboutDrawerOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  // Lock body scroll on mobile menu
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : prev || "";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [open]);

  // ESC to close mobile menu
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Load current user (to show Admin/Account links)
  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      if (!token) {
        setMe(null);
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        if (!cancelled) setMe(data?.user || data || null);
      } catch {
        if (!cancelled) setMe(null);
      }
    }
    loadMe();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const isAdmin = (me?.role || me?.type || "").toLowerCase() === "admin";
  const isAuthed = !!token;

  function logout() {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    setMe(null);
    navigate("/login", { replace: true });
  }

  const linkClass = ({ isActive }) => "pl-link" + (isActive ? " active" : "");

  const aboutActive =
    location.pathname === "/about" ||
    location.pathname.startsWith("/about/") ||
    location.pathname === "/pastoral-leadership" ||
    location.pathname.startsWith("/pastoral-leadership/");

  /* ----------------------- Notifications ----------------------- */

  // Fetch unread count whenever token changes or page loads
  useEffect(() => {
    if (!isAuthed) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }
    let cancelled = false;
    async function fetchCount() {
      try {
        const { data } = await api.get("/notifications/unread-count");
        if (!cancelled) {
          setUnreadCount(Number(data?.count || 0));
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[notif] unread-count failed", e);
      }
    }
    fetchCount();
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  async function fetchNotifications() {
    if (!isAuthed || loadingNotifs) return;
    setLoadingNotifs(true);
    try {
      const { data } = await api.get("/notifications", {
        params: { limit: 20, offset: 0 },
      });
      setNotifications(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      console.warn("[notif] list failed", e);
    } finally {
      setLoadingNotifs(false);
    }
  }

  function toggleNotifOpen() {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) {
      fetchNotifications();
    }
  }

  async function handleNotificationClick(notif) {
    if (!notif) return;

    // Optimistically mark read locally
    if (!notif.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await api.post(`/notifications/${notif.id}/read`);
      } catch (e) {
        console.warn("[notif] mark read failed", e);
      }
    }

    // Navigate based on payload
    const payload = notif.payload || {};
    if (payload.route) {
      navigate(payload.route);
      setNotifOpen(false);
      return;
    }
    if (payload.video_id) {
      navigate(`/watch/${payload.video_id}`);
      setNotifOpen(false);
      return;
    }

    setNotifOpen(false);
  }

  async function handleMarkAllRead() {
    try {
      await api.post("/notifications/mark-all-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.warn("[notif] mark-all-read failed", e);
    }
  }

  const showBell = isAuthed && !isChannelRoute && !isAdminRoute;

  return (
    <div className={`pl-shell ${open ? "nav-open" : ""}`}>
      {/* Bishop TV global header — hidden on channel pages */}
      {!isChannelRoute && (
        <>
          <header className="pl-header">
            <div className="pl-brand">
              <NavLink to="/" className="pl-logo">
                <img src={Logo} alt="Bishop Robertson TV Logo" />
              </NavLink>
              <button
                className="pl-burger"
                aria-label="Open menu"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 6h16M4 12h16M4 18h16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <nav className="pl-nav">{/* primary nav left (unused) */}</nav>

            <div className="pl-actions">
              <nav className="pl-nav">
                <NavLink end to="/" className={linkClass}>
                  Home
                </NavLink>

                {/* ✅ About Bishop dropdown (hover on desktop) */}
                <div className={`pl-dropdown ${aboutActive ? "active" : ""}`}>
                  <NavLink
                    to="/about"
                    className={() => "pl-link" + (aboutActive ? " active" : "")}
                    aria-haspopup="menu"
                    aria-expanded="false"
                  >
                    About Bishop
                    <span className="pl-caret" aria-hidden="true">
                      ▾
                    </span>
                  </NavLink>

                  <div className="pl-dropdown-menu" role="menu">
                    <NavLink to="/about" className="pl-dd-item" role="menuitem">
                      Bio
                    </NavLink>
                    <NavLink
                      to="/pastoral-leadership"
                      className="pl-dd-item"
                      role="menuitem"
                    >
                      Pastoral Leadership
                    </NavLink>
                  </div>
                </div>

                <NavLink to="/catalog" className={linkClass}>
                  Watch
                </NavLink>
                <NavLink to="/live-streaming" className={linkClass}>
                  Live
                </NavLink>
                <NavLink to="/community" className={linkClass}>
                  Community
                </NavLink>
                <NavLink to="/partnership" className={linkClass}>
                  Become a Partner
                </NavLink>
                <NavLink to="/store" className={linkClass}>
                  Store
                </NavLink>
                <NavLink
                  to="https://secure.myvanco.com/L-YRQM"
                  className={linkClass}
                >
                  Give
                </NavLink>
              </nav>

              {/* Notification Bell (only on public, non-admin routes) */}
              {showBell && (
                <div className="pl-notif-wrap">
                  <button
                    type="button"
                    className="pl-notif-btn"
                    aria-label="Notifications"
                    onClick={toggleNotifOpen}
                  >
                    <span className="pl-notif-icon">🔔</span>
                    {unreadCount > 0 && (
                      <span className="pl-notif-badge">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className="pl-notif-dropdown">
                      <div className="pl-notif-head">
                        <span>Notifications</span>
                        {notifications.some((n) => !n.is_read) && (
                          <button
                            type="button"
                            className="pl-notif-markall"
                            onClick={handleMarkAllRead}
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="pl-notif-list">
                        {loadingNotifs && (
                          <div className="pl-notif-empty">
                            Loading notifications…
                          </div>
                        )}

                        {!loadingNotifs && notifications.length === 0 && (
                          <div className="pl-notif-empty">
                            No notifications yet.
                          </div>
                        )}

                        {!loadingNotifs &&
                          notifications.map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              className={
                                "pl-notif-item" + (n.is_read ? "" : " unread")
                              }
                              onClick={() => handleNotificationClick(n)}
                            >
                              <div className="pl-notif-title">
                                {n.title || "Notification"}
                              </div>
                              {n.body && (
                                <div className="pl-notif-sub">{n.body}</div>
                              )}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isAdmin && (
                <NavLink to="/admin" className="pl-btn ghost">
                  Admin
                </NavLink>
              )}
              {isAuthed ? (
                <>
                  <NavLink to="/account" className="pl-btn outline">
                    My Account
                  </NavLink>
                  <button className="logout-btn" onClick={logout}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className="pl-btn ghost">
                    Login
                  </NavLink>
                  <NavLink to="/free-account" className="pl-btn outline">
                    Register
                  </NavLink>
                </>
              )}
            </div>
          </header>

          {/* Mobile drawer */}
          <div className="pl-drawer">
            <NavLink
              end
              to="/"
              className="pl-drawer-link"
              onClick={() => setOpen(false)}
            >
              Home
            </NavLink>

            {/* ✅ Mobile About Bishop submenu */}
            <button
              type="button"
              className="pl-drawer-link pl-drawer-toggle"
              aria-expanded={aboutDrawerOpen}
              onClick={() => setAboutDrawerOpen((v) => !v)}
            >
              <span>About Bishop</span>
              <span
                className={`pl-drawer-caret ${aboutDrawerOpen ? "open" : ""}`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>

            {aboutDrawerOpen && (
              <div className="pl-drawer-sub">
                <NavLink
                  to="/about"
                  className="pl-drawer-sublink"
                  onClick={() => setOpen(false)}
                >
                  Bio
                </NavLink>
                <NavLink
                  to="/pastoral-leadership"
                  className="pl-drawer-sublink"
                  onClick={() => setOpen(false)}
                >
                  Pastoral Leadership
                </NavLink>
              </div>
            )}

            <NavLink
              to="/catalog"
              className="pl-drawer-link"
              onClick={() => setOpen(false)}
            >
              Watch
            </NavLink>

            <NavLink
              to="/live-streaming"
              className="pl-drawer-link"
              onClick={() => setOpen(false)}
            >
              Live
            </NavLink>
            <NavLink
              to="/community"
              className="pl-drawer-link"
              onClick={() => setOpen(false)}
            >
              Community
            </NavLink>
            <NavLink
              to="/partnership"
              className="pl-drawer-link"
              onClick={() => setOpen(false)}
            >
              Become a Partner
            </NavLink>
            <NavLink
              to="/store"
              className="pl-drawer-link"
              onClick={() => setOpen(false)}
            >
              Store
            </NavLink>
            <NavLink
              to="https://secure.myvanco.com/L-YRQM/home"
              className="pl-drawer-link"
              onClick={() => setOpen(false)}
            >
              Give
            </NavLink>

            <div className="pl-drawer-sep" />

            {isAdmin && (
              <NavLink
                to="/admin"
                className="pl-drawer-link"
                onClick={() => setOpen(false)}
              >
                Admin
              </NavLink>
            )}

            {isAuthed ? (
              <>
                <NavLink
                  to="/account"
                  className="pl-drawer-link"
                  onClick={() => setOpen(false)}
                >
                  My Account
                </NavLink>
                <button
                  className="pl-drawer-link logout-btn"
                  onClick={() => {
                    setOpen(false);
                    logout();
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink
                  to="/login"
                  className="pl-drawer-link"
                  onClick={() => setOpen(false)}
                >
                  Login
                </NavLink>
                <NavLink
                  to="/free-account"
                  className="pl-drawer-link"
                  onClick={() => setOpen(false)}
                >
                  Start for Free
                </NavLink>
              </>
            )}
          </div>

          {open && (
            <button
              className="pl-dim"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            />
          )}
        </>
      )}

      {/* Full-width content */}
      <main className="pl-main">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
