// src/layout/MemberLayout.jsx
import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import "./MemberLayout.css";

export default function MemberLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const [me, setMe] = useState(null);
  const [sub, setSub] = useState(null);
  const [open, setOpen] = useState(false);

  // Load user + subscription
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const [{ data: meData }, subRes] = await Promise.all([
          api.get("/auth/me"),
          api.get("/subscription/me").catch(() => ({ data: null })),
        ]);
        if (!ok) return;
        setMe(meData || null);
        setSub(subRes?.data || null);
      } catch {
        nav("/login", { replace: true });
      }
    })();
    return () => {
      ok = false;
    };
  }, [nav]);

  const logout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    delete api.defaults.headers.common.Authorization;
    nav("/", { replace: true });
  };

  const initial =
    (me?.name || me?.email || "U").slice(0, 1).toUpperCase() || "U";

  // Helper to build nav links
  const link = (to, label) => (
    <NavLink
      to={to}
      className={({ isActive }) => "ml-link" + (isActive ? " active" : "")}
      onClick={() => setOpen(false)}
    >
      {label}
    </NavLink>
  );

  /* ---------------------------------------------------------
     PLAN + ROLE DETECTION
  --------------------------------------------------------- */
  const planStr = (
    sub?.plan_code ||
    sub?.plan ||
    sub?.plan_title ||
    ""
  ).toLowerCase();

  const isFree =
    !sub?.status || sub?.status === "none" || planStr.includes("free");

  const isAdmin = me?.role === "admin";

  /* ---------------------------------------------------------
     BLOCK FREE USERS & BLOCK NON-ADMINS FROM LIVE EVENTS
  --------------------------------------------------------- */
  useEffect(() => {
    // Free users cannot open /account dashboard → redirect to playlists
    if (isFree && loc.pathname === "/account") {
      nav("/account/playlists", { replace: true });
    }

    // Non-admins cannot access live studio pages
    if (!isAdmin && loc.pathname.startsWith("/studio/live")) {
      nav("/account/playlists", { replace: true });
    }
  }, [isFree, isAdmin, loc.pathname, nav]);

  return (
    <div className={`ml-shell ${open ? "is-open" : ""}`}>
      {/* Sidebar */}
      <aside className="ml-aside">
        <div className="ml-user">
          <div className="ml-avatar" aria-hidden>
            {initial}
          </div>
          <div className="ml-user-meta">
            <div className="ml-user-name">{me?.name || "Member"}</div>
            <div className="ml-user-email">{me?.email || ""}</div>
          </div>
        </div>

        <nav className="ml-nav">
          <div className="ml-section">Account</div>
          {/* Dashboard hidden for Free */}
          {!isFree && link("/account", "Dashboard")}

          <div className="ml-section">Manage</div>
          {link("/account/playlists", "My Playlists")}

          {/* LIVE EVENTS — ONLY ADMINS CAN SEE */}
          {isAdmin && link("/studio/live", "Live events")}

          {/* Mobile & TV Apps — hidden on Free */}
          {!isFree && (
            <>
              <div className="ml-section">Mobile & TV Apps</div>
              {link("/account/apps", "Mobile & TV Apps")}
              {link("/tv/activate", "TV Activate (test)")}
            </>
          )}

          {/* Explore — hidden on Free */}
          {!isFree && (
            <>
              <div className="ml-section">Explore</div>
              {link("/p/videos", "Browse catalog")}
            </>
          )}
        </nav>

        <div className="ml-footer">
          <button className="ml-logout" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="ml-main">
        <header className="ml-topbar">
          <button
            className="ml-burger"
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
          <div className="ml-top-title">My Account</div>
        </header>

        <main className="ml-content">
          <Outlet />
        </main>
      </div>

      {/* Mobile dim background */}
      {open && (
        <button
          className="ml-dim"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        />
      )}
    </div>
  );
}
