// src/layout/Layout.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import { MENU as rawMenu } from "../config/menu";
import "./Layout.css";

/** Normalize MENU into [{label, items:[{title,to,icon?,children?:[]}] }]. */
function normalizeMenu(input) {
  if (Array.isArray(input) && input.every((g) => Array.isArray(g?.items)))
    return input;
  return [{ label: "ADMIN", items: Array.isArray(input) ? input : [] }];
}

/** Render icon components (lucide-react etc.). Ignore strings. */
function RenderIcon({ icon }) {
  if (!icon) return null;
  if (React.isValidElement(icon)) return <span className="u-ico">{icon}</span>;
  if (typeof icon === "function") {
    const Ico = icon;
    return (
      <span className="u-ico">
        <Ico size={18} />
      </span>
    );
  }
  return null;
}

function initialsFrom(s = "") {
  const t = String(s).trim();
  if (!t) return "U";
  const parts = t.split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (t.includes("@")) return t[0].toUpperCase();
  return t.slice(0, 2).toUpperCase();
}

function UserMenu() {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState(null);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/auth/me");
        if (mounted) setMe(res.data || null);
      } catch {
        if (mounted) setMe(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function onDocClick(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const name = me?.name || me?.full_name || me?.email || "Admin User";

  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch {}
    localStorage.removeItem("token");
    setOpen(false);
    navigate("/login", { replace: true });
  }

  return (
    <div className="us-user" ref={ref}>
      <button
        className="us-userBtn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open user menu"
      >
        <span className="us-avatar">{initialsFrom(name)}</span>
      </button>
      {open && (
        <div className="us-menu card" role="menu">
          <div className="us-menuHead">
            <div className="us-avatar lg">{initialsFrom(name)}</div>
            <div className="us-name">{name}</div>
          </div>
          <button
            className="menu-item"
            onClick={() => (setOpen(false), navigate("/admin/settings"))}
          >
            My account
          </button>
          <div className="menu-sep" />
          <button className="menu-item danger" onClick={logout}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const groups = useMemo(() => normalizeMenu(rawMenu), []);
  const [sideOpen, setSideOpen] = useState(false); // mobile off-canvas

  // Close sidebar on route change (mobile) & handle ESC
  useEffect(() => setSideOpen(false), [location.pathname]);
  useEffect(() => {
    function onEsc(e) {
      if (e.key === "Escape") setSideOpen(false);
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, []);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (sideOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = prev || "";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [sideOpen]);

  const isPathActive = (to) =>
    to && (location.pathname === to || location.pathname.startsWith(to + "/"));

  return (
    <div className={`us-shell${sideOpen ? " side-open" : ""}`}>
      {/* Dimmer for mobile */}
      {sideOpen && (
        <button
          className="us-dim"
          onClick={() => setSideOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <aside
        id="admin-sidebar"
        className="us-side"
        role="navigation"
        aria-label="Main"
      >
        <div className="us-brand">
          <div className="us-dot">B</div>
          <div>
            <div className="us-brandName">BishopTV</div>
            <div className="us-brandSub">admin</div>
          </div>
        </div>

        <nav className="us-nav">
          {groups.map((g) => (
            <div className="us-group" key={g.label}>
              <div className="us-groupLabel">{g.label}</div>

              <div className="us-groupList">
                {(g.items || []).map((it) => {
                  const hasChildren =
                    Array.isArray(it.children) && it.children.length > 0;
                  const activeChild =
                    hasChildren && it.children.some((c) => isPathActive(c.to));
                  const active = isPathActive(it.to) || activeChild;

                  return (
                    <div className="us-itemBlock" key={it.title}>
                      <NavLink
                        to={it.to || "#"}
                        className={({ isActive }) =>
                          "us-link" + (isActive || active ? " is-active" : "")
                        }
                        onClick={(e) => {
                          if (!it.to && hasChildren) e.preventDefault();
                        }}
                        end={it.to === "/admin"}
                      >
                        <RenderIcon icon={it.icon} />
                        <span className="us-linkText">{it.title}</span>
                      </NavLink>

                      {hasChildren && (
                        <div className="us-subnav">
                          {it.children.map((c) => (
                            <NavLink
                              key={c.to}
                              to={c.to}
                              className={({ isActive }) =>
                                "us-sublink" + (isActive ? " is-active" : "")
                              }
                            >
                              <RenderIcon icon={c.icon} />
                              <span>{c.title}</span>
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="us-main">
        <header className="us-top">
          {/* Burger appears on mobile */}
          <button
            className="us-burger"
            aria-label="Toggle sidebar"
            aria-controls="admin-sidebar"
            aria-expanded={sideOpen}
            onClick={() => setSideOpen((v) => !v)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 6h16M4 12h16M4 18h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div className="us-topLeft">
            <input className="us-search" placeholder="Quick search..." />
          </div>
          <div className="us-topRight">
            <button className="us-btn ghost small">Changelog</button>
            <button className="us-btn primary small">Upgrade</button>
            <UserMenu />
          </div>
        </header>

        <main className="us-content">
          <Outlet key={location.pathname} />
        </main>
      </div>
    </div>
  );
}
