// src/layout/PublicLayout.jsx
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import "./PublicLayout.css";
import AccountMenu from "../components/AccountMenu";
import useSupportWidget from "../support/useSupportWidget";
import api from "../api";
import SiteFooter from "../components/SiteFooter";
import { cleanCss, globalColorsCss, useSiteOptions } from "../lib/siteOptions";
import { useEntranceAnimations } from "../components/builder/effects";
import { SITE } from "../config/site";
import { SearchButton } from "../components/viewer/SearchOverlay";
import { useLiveStatus } from "../components/viewer/liveStatus";
import { BrandLogo } from "../lib/brand";
import {
  DEFAULT_HEADER_ITEMS,
  loadDefaultHeaderItems,
} from "../config/headerNavigation";
import InstallAppBanner, { InstallAppButton } from "../pwa/InstallApp";

export default function PublicLayout() {
  const siteOptions = useSiteOptions(); // site-wide custom CSS (Site settings)
  useEntranceAnimations(); // Release 1.3: element entrance animations
  const liveStatus = useLiveStatus(); // Release 2.2: "● LIVE" badge (any provider)
  // Release 1.3: header settings and brand (white-label), with today's look as default.
  const hdr = siteOptions?.header || {};
  const brand = siteOptions?.brand || {};
  const siteLink = (to, className, children) =>
    /^\//.test(to) ? (
      <NavLink to={to} className={className}>
        {children}
      </NavLink>
    ) : (
      <a
        href={to}
        className={className}
        target={/^https:/i.test(to) ? "_blank" : undefined}
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  useSupportWidget();
  useEffect(() => {
    let active = true;
    let fontLink = null;
    api
      .get("/site-design/public")
      .then(({ data }) => {
        if (!active) return;
        const v = data?.settings || {};
        const family = String(v.fontFamily || "Inter");
        const size = Number(v.baseFontSize);
        const accent = String(v.accentColor || "");
        if (/^[a-zA-Z0-9 ,+.'-]{2,80}$/.test(family)) {
          document.documentElement.style.setProperty(
            "--site-font-family",
            `"${family}", sans-serif`,
          );
          fontLink = document.getElementById("brtv-site-google-font");
          if (!fontLink) {
            fontLink = document.createElement("link");
            fontLink.id = "brtv-site-google-font";
            fontLink.rel = "stylesheet";
            document.head.appendChild(fontLink);
          }
          fontLink.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;
        }
        if (Number.isInteger(size) && size >= 10 && size <= 36)
          document.documentElement.style.setProperty(
            "--site-base-font-size",
            `${size}px`,
          );
        if (/^#[0-9a-fA-F]{6}$/.test(accent))
          document.documentElement.style.setProperty("--accent", accent);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const headerRef = useRef(null);
  const brandRef = useRef(null);
  const actionsRef = useRef(null);
  const measureRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [open, setOpen] = useState(false); // mobile menu
  const [, setAboutDrawerOpen] = useState(false); // mobile submenu
  const [headerItems, setHeaderItems] = useState(DEFAULT_HEADER_ITEMS);
  const [mobileExpanded, setMobileExpanded] = useState({});
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

  // Authentication state must be initialized before adaptive layout effects.
  const isAdmin = (me?.role || me?.type || "").toLowerCase() === "admin";
  const isAuthed = !!token;
  const showBell = isAuthed && !isChannelRoute && !isAdminRoute;

  // Published navigation only; retain the existing default menu on API failure.
  useEffect(() => {
    let active = true;
    api
      .get("/navigation/header")
      .then(({ data }) => {
        if (active && data?.configured && Array.isArray(data.items))
          setHeaderItems(data.items);
        else
          loadDefaultHeaderItems().then(
            (items) => active && setHeaderItems(items),
          );
      })
      .catch(() =>
        loadDefaultHeaderItems().then(
          (items) => active && setHeaderItems(items),
        ),
      );
    return () => {
      active = false;
    };
  }, []);
  const visibleHeader = headerItems.filter((item) => item.visible !== false);
  const topHeader = visibleHeader.filter((item) => !item.parentId);
  // re-measure the menu when its items change
  const topHeaderKey = topHeader
    .map((item) => `${item.id}:${item.label}`)
    .join("|");
  const childrenFor = (id) =>
    visibleHeader.filter((item) => item.parentId === id);

  // Measure actual menu-label widths, logo, and account controls. Preserve CMS order.
  // ResizeObserver handles browser zoom, text changes, and auth-state changes.
  useLayoutEffect(() => {
    const calculate = () => {
      const header = headerRef.current;
      const brand = brandRef.current;
      const actions = actionsRef.current;
      const measure = measureRef.current;
      if (!header || !brand || !actions || !measure) return;
      const widths = [...measure.querySelectorAll("[data-measure-item]")].map(
        (el) => el.getBoundingClientRect().width,
      );
      if (!widths.length) {
        setVisibleCount(0);
        return;
      }
      const moreWidth =
        measure.querySelector("[data-measure-more]")?.getBoundingClientRect()
          .width || 78;
      const headerStyle = window.getComputedStyle(header);
      const gap = parseFloat(headerStyle.columnGap) || 10;
      const available = Math.max(
        0,
        header.clientWidth -
          parseFloat(headerStyle.paddingLeft) -
          parseFloat(headerStyle.paddingRight) -
          brand.getBoundingClientRect().width -
          actions.getBoundingClientRect().width -
          2 * gap,
      );
      const itemGap = 3;
      const total =
        widths.reduce((a, b) => a + b, 0) +
        Math.max(0, widths.length - 1) * itemGap;
      if (total <= available) {
        setVisibleCount(widths.length);
        return;
      }
      let used = moreWidth + itemGap;
      let count = 0;
      for (const width of widths) {
        if (used + width + itemGap > available) break;
        used += width + itemGap;
        count++;
      }
      setVisibleCount(count);
    };
    calculate();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(calculate)
        : null;
    [
      headerRef.current,
      brandRef.current,
      actionsRef.current,
      measureRef.current,
    ].forEach((el) => {
      if (el && observer) observer.observe(el);
    });
    window.addEventListener("resize", calculate);
    if (document.fonts?.ready)
      document.fonts.ready.then(calculate).catch(() => {});
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", calculate);
    };
  }, [topHeaderKey, isAdmin, isAuthed, showBell]);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  // A menu item without a page of its own (e.g. "About" that only opens a
  // dropdown) has an empty or "#" address. As a router link that would mean
  // "this page", so it showed as active everywhere. It is a plain label
  // instead, active only while one of its sub-pages is open.
  const hasOwnPage = (item) => {
    const h = String(item?.href || "").trim();
    return h !== "" && h !== "#" && h !== "/#";
  };
  const onPage = (href) => {
    const h = String(href || "").trim();
    if (!h.startsWith("/") || h === "/")
      return h === "/" && location.pathname === "/";
    return location.pathname === h || location.pathname.startsWith(`${h}/`);
  };
  const childOpen = (item) => childrenFor(item.id).some((c) => onPage(c.href));

  const navLink = (item, className, extra = {}) =>
    !hasOwnPage(item) ? (
      <button
        key={item.id}
        type="button"
        className={
          typeof className === "function"
            ? className({ isActive: childOpen(item) })
            : className
        }
        aria-haspopup={childrenFor(item.id).length ? "true" : undefined}
        {...extra}
      >
        {item.label}
      </button>
    ) : /^https:\/\//i.test(item.href) ? (
      <a
        key={item.id}
        href={item.href}
        // Links to other sites (e.g. Give) are plain <a>: a function class name
        // (used by NavLink for the active page) was dropped, so they showed as
        // blue underlined links. Use the same class as the other menu items.
        className={
          typeof className === "function"
            ? className({ isActive: false })
            : className
        }
        target="_blank"
        rel="noopener noreferrer"
        {...extra}
      >
        {item.label}
      </a>
    ) : (
      <NavLink
        key={item.id}
        to={item.href}
        end={item.href === "/"}
        className={className}
        {...extra}
      >
        {item.label}
      </NavLink>
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

  function logout() {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    setMe(null);
    navigate("/login", { replace: true });
  }

  const linkClass = ({ isActive }) => "pl-link" + (isActive ? " active" : "");

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

  // Notification bell (one implementation, shown in the desktop header and,
  // on phones/tablets, next to the search icon).
  const renderBell = (extraClass) =>
    showBell ? (
      <div className={"pl-notif-wrap" + extraClass}>
        <button
          type="button"
          className="pl-notif-btn"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          aria-expanded={notifOpen}
          aria-haspopup="true"
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
                <div className="pl-notif-empty">Loading notifications…</div>
              )}

              {!loadingNotifs && notifications.length === 0 && (
                <div className="pl-notif-empty">No notifications yet.</div>
              )}

              {!loadingNotifs &&
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={"pl-notif-item" + (n.is_read ? "" : " unread")}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="pl-notif-title">
                      {n.title || "Notification"}
                    </div>
                    {n.body && <div className="pl-notif-sub">{n.body}</div>}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    ) : null;

  // close the notifications on outside tap/click or Escape
  useEffect(() => {
    if (!notifOpen) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.(".pl-notif-wrap")) setNotifOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setNotifOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [notifOpen]);

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

  return (
    <div className={`pl-shell ${open ? "nav-open" : ""}`}>
      {/* Bishop TV global header — hidden on channel pages */}
      {!isChannelRoute && (
        <>
          {hdr.topbar_enabled && hdr.topbar_text ? (
            <div
              className="pl-topbar"
              style={{
                background: hdr.topbar_bg || undefined,
                color: hdr.topbar_color || undefined,
              }}
            >
              {hdr.topbar_link ? (
                siteLink(hdr.topbar_link, "pl-topbarLink", hdr.topbar_text)
              ) : (
                <span>{hdr.topbar_text}</span>
              )}
            </div>
          ) : null}
          <header
            className={`pl-header${hdr.sticky === false ? " pl-header--static" : ""}`}
            ref={headerRef}
            style={{
              background: hdr.bg || undefined,
              color: hdr.text || undefined,
            }}
          >
            <div className="pl-brand" ref={brandRef}>
              <NavLink to="/" className="pl-logo">
                <BrandLogo
                  brand={brand}
                  name={SITE.name}
                  alt={`${brand.name || SITE.name} home`}
                  style={
                    hdr.logo_height
                      ? { height: hdr.logo_height, width: "auto" }
                      : undefined
                  }
                />
              </NavLink>
              {liveStatus?.state === "live" ? (
                <NavLink
                  to="/live-streaming"
                  className="pl-liveBadge"
                  aria-label="We're live now: watch the live stream"
                >
                  <span className="pl-liveDot" aria-hidden="true" />
                  LIVE
                </NavLink>
              ) : null}
              {/* phones and tablets: notifications and search next to the menu button */}
              {renderBell(" pl-notifMobile")}
              <SearchButton className="pl-searchMobile" label="Search videos" />
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

            <nav className="pl-nav pl-primary-nav" aria-label="Main navigation">
              {topHeader.slice(0, visibleCount).map((item) => {
                const children = childrenFor(item.id);
                if (!children.length) return navLink(item, linkClass);
                return (
                  <div key={item.id} className="pl-dropdown">
                    {navLink(item, linkClass)}
                    <span className="pl-caret" aria-hidden="true">
                      <svg
                        className="pl-caretIcon"
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 3.5 5 6.5 8 3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <div className="pl-dropdown-menu" role="menu">
                      {children.map((child) =>
                        navLink(child, "pl-dd-item", { role: "menuitem" }),
                      )}
                    </div>
                  </div>
                );
              })}
              {visibleCount < topHeader.length && (
                <div className="pl-dropdown pl-more-wrap">
                  <button
                    type="button"
                    className="pl-link pl-more-button"
                    aria-expanded={moreOpen}
                    aria-haspopup="true"
                    onClick={() => setMoreOpen((v) => !v)}
                  >
                    More{" "}
                    <span className="pl-caret" aria-hidden="true">
                      <svg
                        className="pl-caretIcon"
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 3.5 5 6.5 8 3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>
                  {moreOpen && (
                    <div className="pl-dropdown-menu pl-more-menu" role="menu">
                      {topHeader.slice(visibleCount).map((item) => (
                        <div key={item.id} className="pl-more-group">
                          {navLink(item, "pl-dd-item", {
                            role: "menuitem",
                            onClick: () => setMoreOpen(false),
                          })}
                          {childrenFor(item.id).map((child) =>
                            navLink(child, "pl-dd-item pl-more-child", {
                              role: "menuitem",
                              onClick: () => setMoreOpen(false),
                            }),
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </nav>
            {/* Offscreen measurement uses the same labels and spacing as the visible menu. */}
            <div className="pl-nav-measure" ref={measureRef} aria-hidden="true">
              {topHeader.map((item) => (
                <span
                  key={item.id}
                  data-measure-item
                  className="pl-link pl-measure-item"
                >
                  {item.label}
                  {childrenFor(item.id).length > 0 && (
                    <span className="pl-caret" aria-hidden="true">
                      <svg
                        className="pl-caretIcon"
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 3.5 5 6.5 8 3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                </span>
              ))}
              <span data-measure-more className="pl-link pl-measure-item">
                More ▾
              </span>
            </div>
            <div className="pl-actions" ref={actionsRef}>
              <SearchButton label="Search videos" shortcut />
              {hdr.button_label && hdr.button_link
                ? siteLink(
                    hdr.button_link,
                    "pl-btn outline pl-headerBtn",
                    hdr.button_label,
                  )
                : null}
              {/* Notification Bell (only on public, non-admin routes) */}
              {renderBell("")}
              <AccountMenu
                me={me}
                isAuthed={isAuthed}
                isAdmin={isAdmin}
                onLogout={logout}
              />
            </div>
          </header>

          {/* Mobile drawer */}
          <div className="pl-drawer">
            {topHeader.map((item) => {
              const children = childrenFor(item.id);
              if (!children.length)
                return navLink(item, "pl-drawer-link", {
                  onClick: () => setOpen(false),
                });
              return (
                <React.Fragment key={item.id}>
                  <button
                    type="button"
                    className="pl-drawer-link pl-drawer-toggle"
                    aria-expanded={!!mobileExpanded[item.id]}
                    onClick={() =>
                      setMobileExpanded((prev) => ({
                        ...prev,
                        [item.id]: !prev[item.id],
                      }))
                    }
                  >
                    <span>{item.label}</span>
                    <span className="pl-drawer-caret" aria-hidden="true">
                      <svg
                        className="pl-caretIcon"
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 3.5 5 6.5 8 3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>
                  {mobileExpanded[item.id] && (
                    <div className="pl-drawer-sub">
                      {navLink(item, "pl-drawer-sublink", {
                        onClick: () => setOpen(false),
                      })}
                      {children.map((child) =>
                        navLink(child, "pl-drawer-sublink", {
                          onClick: () => setOpen(false),
                        }),
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            <div className="pl-drawer-sep" />

            <div className="pl-drawerSection">Account</div>
            <InstallAppButton
              className="pl-drawer-link ia-drawerBtn"
              label={`Install the ${SITE.shortName} app`}
              onDone={() => setOpen(false)}
            />
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
                  Register
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
        {siteOptions?.global_colors?.length ? (
          <style data-site-colors="">
            {globalColorsCss(siteOptions.global_colors)}
          </style>
        ) : null}
        {siteOptions?.custom_css ? (
          <style data-site-css="">{cleanCss(siteOptions.custom_css)}</style>
        ) : null}
        <Outlet />
      </main>
      <SiteFooter />
      <InstallAppBanner />
    </div>
  );
}
