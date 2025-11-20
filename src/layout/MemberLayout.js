// src/layout/MemberLayout.jsx
import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import "./MemberLayout.css";

export default function MemberLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const [me, setMe] = useState(null);
  const [sub, setSub] = useState(null); // <- subscription
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const [{ data: meData }, subRes] = await Promise.all([
          api.get("/auth/me"),
          // best-effort; if it fails we'll just show full menu
          api.get("/subscription/me").catch(() => ({ data: null })),
        ]);
        if (!ok) return;
        setMe(meData || null);
        setSub(subRes?.data || null);
      } catch {
        // if token invalid, push to login
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

  const link = (to, label) => (
    <NavLink
      to={to}
      className={({ isActive }) => "ml-link" + (isActive ? " active" : "")}
      onClick={() => setOpen(false)}
    >
      {label}
    </NavLink>
  );

  // ── Free-plan detection (status none/missing OR code/title contains "free")
  const planStr = (
    sub?.plan_code ||
    sub?.plan ||
    sub?.plan_title ||
    ""
  ).toLowerCase();
  const isFree =
    !sub?.status || sub?.status === "none" || planStr.includes("free");

  // If Free and user opens /account (dashboard index), redirect to /account/playlists
  useEffect(() => {
    if (isFree && loc.pathname === "/account") {
      nav("/account/playlists", { replace: true });
    }
  }, [isFree, loc.pathname, nav]);

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
          {/* Hide Dashboard for Free */}
          {!isFree && link("/account", "Dashboard")}

          <div className="ml-section">Manage</div>
          {/* Replace "My videos" -> "My Playlists" */}
          {link("/account/playlists", "My Playlists")}
          {link("/studio/live", "Live events")}

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

      {/* Main */}
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

      {/* Mobile dimmer */}
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
