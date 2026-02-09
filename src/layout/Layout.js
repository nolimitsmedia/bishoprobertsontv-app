// src/layout/Layout.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import { MENU as rawMenu } from "../config/menu";
import "./Layout.css";
import Logo from "../assets/BishopRobertsonTVLogo.png";

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
  const parts = t.split(" ").filter(Boolean);
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
        type="button"
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
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/admin/settings");
            }}
          >
            My account
          </button>

          <div className="menu-sep" />

          <button className="menu-item danger" type="button" onClick={logout}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

/** Build stable keys for React + drawer state (no Math.random). */
function makeGroupKey(g, gi) {
  return `group:${String(g?.label || "GROUP")}:${gi}`;
}
function makeItemKey(g, gi, it, ii) {
  const base =
    (it?.to && `to:${it.to}`) ||
    (it?.id && `id:${it.id}`) ||
    (it?.title && `title:${it.title}`) ||
    "item";
  return `item:${String(g?.label || "GROUP")}:${gi}:${base}:${ii}`;
}
function makeChildKey(parentKey, c, ci) {
  const base =
    (c?.to && `to:${c.to}`) || (c?.title && `title:${c.title}`) || "child";
  return `child:${parentKey}:${base}:${ci}`;
}

export default function Layout() {
  const location = useLocation();
  const groups = useMemo(() => normalizeMenu(rawMenu), []);
  const [sideOpen, setSideOpen] = useState(false); // mobile off-canvas

  // Drawer state for submenus
  const [openDrawers, setOpenDrawers] = useState({});

  const isPathActive = (to) =>
    !!to &&
    (location.pathname === to || location.pathname.startsWith(to + "/"));

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

  // Auto-open drawer if a child route is active (Uscreen-like)
  useEffect(() => {
    const next = {};

    groups.forEach((g, gi) => {
      (g.items || []).forEach((it, ii) => {
        const hasChildren =
          Array.isArray(it.children) && it.children.length > 0;
        if (!hasChildren) return;

        const activeChild = it.children.some((c) => isPathActive(c.to));
        if (activeChild) {
          const k = makeItemKey(g, gi, it, ii);
          next[k] = true;
        }
      });
    });

    // merge: keep user's manual open drawers, but ensure active ones are open
    setOpenDrawers((prev) => ({ ...prev, ...next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]); // groups is memo-stable

  function toggleDrawer(key) {
    setOpenDrawers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className={`us-shell${sideOpen ? " side-open" : ""}`}>
      {/* Mobile top bar (shows only on small screens via CSS) */}
      <header className="us-mtop">
        {/* Logo first */}
        <NavLink to="/" className="us-mbrand" aria-label="Home">
          <img src={Logo} alt="Bishop Robertson TV Logo" />
        </NavLink>

        {/* Burger after logo */}
        <button
          className="us-burger"
          aria-label="Open menu"
          aria-controls="admin-sidebar"
          aria-expanded={sideOpen}
          onClick={() => setSideOpen(true)}
          type="button"
        >
          <svg
            width="22"
            height="22"
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

        <div className="us-mright">
          <UserMenu />
        </div>
      </header>

      {/* Dimmer for mobile */}
      {sideOpen && (
        <button
          className="us-dim"
          onClick={() => setSideOpen(false)}
          aria-label="Close sidebar"
          type="button"
        />
      )}

      {/* Sidebar */}
      <aside
        id="admin-sidebar"
        className="us-side"
        role="navigation"
        aria-label="Main"
      >
        {/* Mobile header inside drawer */}
        <div className="us-sideTop">
          <NavLink to="/" className="pl-logo">
            <img src={Logo} alt="Bishop Robertson TV Logo" />
          </NavLink>

          <button
            className="us-x"
            aria-label="Close menu"
            onClick={() => setSideOpen(false)}
            type="button"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Keep desktop brand block (hidden on mobile via CSS) */}
        <div className="us-brand us-brandDesktop">
          <NavLink to="/" className="pl-logo">
            <img src={Logo} alt="Bishop Robertson TV Logo" />
          </NavLink>
        </div>

        <nav className="us-nav">
          {groups.map((g, gi) => {
            const groupKey = makeGroupKey(g, gi);

            return (
              <div className="us-group" key={groupKey}>
                <div className="us-groupLabel">{g.label}</div>

                <div className="us-groupList">
                  {(g.items || []).map((it, ii) => {
                    const hasChildren =
                      Array.isArray(it.children) && it.children.length > 0;

                    const activeChild =
                      hasChildren &&
                      it.children.some((c) => isPathActive(c.to));
                    const active = isPathActive(it.to) || activeChild;

                    const key = makeItemKey(g, gi, it, ii);
                    const expanded = !!openDrawers[key] || !!activeChild;

                    return (
                      <div className="us-itemBlock" key={key}>
                        <div
                          className={
                            "us-linkRow" + (active ? " is-active" : "")
                          }
                        >
                          {it.to ? (
                            <NavLink
                              to={it.to}
                              className={
                                "us-link" + (active ? " is-active" : "")
                              }
                              end={it.to === "/admin"}
                            >
                              <RenderIcon icon={it.icon} />
                              <span className="us-linkText">{it.title}</span>
                            </NavLink>
                          ) : (
                            <button
                              type="button"
                              className={
                                "us-link btnlike" + (active ? " is-active" : "")
                              }
                              onClick={() => hasChildren && toggleDrawer(key)}
                            >
                              <RenderIcon icon={it.icon} />
                              <span className="us-linkText">{it.title}</span>
                            </button>
                          )}

                          {hasChildren && (
                            <button
                              type="button"
                              className={
                                "us-chevronBtn" + (expanded ? " is-open" : "")
                              }
                              onClick={() => toggleDrawer(key)}
                              aria-label={`${expanded ? "Collapse" : "Expand"} ${it.title}`}
                              aria-expanded={expanded}
                            >
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                aria-hidden="true"
                              >
                                <path
                                  d="M9 6l6 6-6 6"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          )}
                        </div>

                        {hasChildren && (
                          <div
                            className={
                              "us-subnavDrawer" + (expanded ? " open" : "")
                            }
                          >
                            <div className="us-subnavInner">
                              {it.children.map((c, ci) => (
                                <NavLink
                                  key={makeChildKey(key, c, ci)}
                                  to={c.to}
                                  className={({ isActive }) =>
                                    "us-sublink" +
                                    (isActive ? " is-active" : "")
                                  }
                                >
                                  <RenderIcon icon={c.icon} />
                                  <span>{c.title}</span>
                                </NavLink>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="us-main">
        <main className="us-content">
          <Outlet key={location.pathname} />
        </main>
      </div>
    </div>
  );
}
