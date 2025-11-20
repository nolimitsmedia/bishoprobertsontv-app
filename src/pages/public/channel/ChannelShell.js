import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import api from "../../../api";

/* utils */
const slugify = (s = "") =>
  String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80) || "page";

const normLabel = (p) => {
  const src = (p.title || p.slug || p.page_slug || "").trim();
  const s = slugify(src);
  if (s.includes("about")) return "about";
  if (s.includes("video")) return "videos";
  if (s.includes("live")) return "live";
  if (s.includes("contact")) return "contact";
  if (s === "home") return "home";
  return s;
};

/* fetch channel + pages using LIVE (public) endpoints first */
async function loadChannelAndPagesPublicFirst(slug) {
  const s = encodeURIComponent(slug);

  // Public (live)
  try {
    const chRes = await api.get(`/channels/public/${s}`).then((r) => r.data);
    const channel = chRes?.channel ?? chRes ?? null;

    const listRes = await api
      .get(`/channels/public/${s}/pages`)
      .then((r) => r.data);
    const pages = listRes?.pages ?? listRes ?? [];

    if (channel || pages?.length) {
      return { channel, pages: Array.isArray(pages) ? pages : [] };
    }
  } catch {}

  // Private (fallback for local/dev)
  try {
    const chRes = await api.get(`/channels/${s}`).then((r) => r.data);
    const channel = chRes?.channel ?? chRes ?? null;

    const listRes = await api.get(`/channels/${s}/pages`).then((r) => r.data);
    const pages = listRes?.pages ?? listRes ?? [];

    return { channel, pages: Array.isArray(pages) ? pages : [] };
  } catch {
    return { channel: null, pages: [] };
  }
}

export default function ChannelShell() {
  const { slug } = useParams();
  const [channel, setChannel] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");

      const { channel, pages } = await loadChannelAndPagesPublicFirst(slug);
      if (!alive) return;

      if (!channel) {
        setErr("Failed to load channel");
        setLoading(false);
        return;
      }

      // normalize minimal page shape; ALWAYS keep a slug
      const normalized = (pages || []).map((p, idx) => ({
        id: p.id ?? `${p.slug || p.page_slug || idx}`,
        title: p.title || p.slug || p.page_slug || "Page",
        slug: p.slug || p.page_slug || slugify(p.title || "page"),
        is_visible: p.is_visible !== false,
        position: Number(p.nav_order ?? p.sort_order ?? idx) || idx,
        is_home: !!p.is_home || (p.slug || p.page_slug) === "home",
        kind: p.kind || "",
      }));

      setChannel(channel);
      setPages(normalized);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  const nav = useMemo(() => {
    const home = { label: "Home", to: `/c/${slug}` };
    const itemsRaw = pages
      .filter((p) => p.is_visible && !p.is_home)
      .map((p, idx) => ({
        key: p.id ?? idx,
        label: p.title,
        to: `/c/${slug}/page/${p.slug}`,
        norm: normLabel(p),
        position: p.position,
      }));

    const desiredOrder = ["about", "videos", "live", "contact"];
    const desired = [];
    const rest = [];
    for (const it of itemsRaw) {
      const pos = desiredOrder.indexOf(it.norm);
      if (pos >= 0) desired[pos] = it;
      else rest.push(it);
    }
    rest.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return { home, items: [...desired.filter(Boolean), ...rest] };
  }, [pages, slug]);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

  if (err || !channel) {
    return (
      <div style={{ padding: 16 }}>
        <div className="note error">Error</div>
        <div className="note subtle">{err || "Not found"}</div>
      </div>
    );
  }

  const linkClass = ({ isActive }) =>
    "c-nav-link" + (isActive ? " active" : "");

  return (
    <div className="channel-shell">
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "#fff",
          borderBottom: "1px solid #eef2f6",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "10px 16px",
          }}
        >
          <div
            title={channel.title || "Channel"}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#eef2ff",
              border: "1px solid #e2e8f0",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              color: "#334155",
              flex: "0 0 auto",
            }}
          >
            {(channel.title || "M").slice(0, 1).toUpperCase()}
          </div>

          <div
            title={channel.title}
            style={{
              fontWeight: 800,
              color: "#0b1220",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {channel.title}
          </div>

          <div style={{ marginLeft: "auto" }} />

          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              overflow: "auto",
            }}
          >
            <NavLink end to={nav.home.to} className={linkClass}>
              Home
            </NavLink>
            {nav.items.map((it) => (
              <NavLink key={it.key} to={it.to} className={linkClass}>
                {it.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main style={{ padding: "18px 16px 40px" }}>
        {/* pass to child */}
        <Outlet context={{ channel, pages }} />
      </main>
    </div>
  );
}
