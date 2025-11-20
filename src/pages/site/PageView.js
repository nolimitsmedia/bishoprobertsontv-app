// src/pages/site/PageView.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../api";

/* --------------------------- light blocks renderer --------------------------- */
const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function BlocksRenderer({ blocks }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  const Section = ({ b }) => {
    const pad = b.props?.padding || {
      top: 24,
      right: 24,
      bottom: 24,
      left: 24,
    };
    const bg = b.props?.background;
    const bgImage = b.props?.backgroundImage;
    const style = {
      paddingTop: (pad.top ?? 0) + "px",
      paddingRight: (pad.right ?? 0) + "px",
      paddingBottom: (pad.bottom ?? 0) + "px",
      paddingLeft: (pad.left ?? 0) + "px",
      background: bg || undefined,
      backgroundImage: bgImage ? `url(${bgImage})` : undefined,
      backgroundSize: bgImage ? "cover" : undefined,
      backgroundPosition: bgImage ? "center" : undefined,
      backgroundRepeat: bgImage ? "no-repeat" : undefined,
      width: "100%",
    };
    return (
      <section style={style}>
        {toArray(b.children).map((c, i) => (
          <Render key={c?.id || i} b={c} />
        ))}
      </section>
    );
  };

  const Columns = ({ b }) => {
    const cols = Math.max(
      1,
      Math.min(4, parseInt(b.props?.cols || b.props?.columns || 2, 10))
    );
    const gap = parseInt(b.props?.gap || 16, 10);
    const colsChildren = toArray(b.children).every(Array.isArray)
      ? b.children
      : [toArray(b.children)];
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
          gap,
        }}
      >
        {colsChildren.map((col, i) => (
          <div key={i}>
            {toArray(col).map((c, j) => (
              <Render key={c?.id || j} b={c} />
            ))}
          </div>
        ))}
      </div>
    );
  };

  const Heading = ({ b }) => {
    const Tag = b.props?.tag || "h2";
    const style = {
      margin: 0,
      fontSize: (b.props?.fontSize ?? b.props?.size ?? 28) + "px",
      fontWeight: b.props?.fontWeight ?? b.props?.weight ?? 700,
      textAlign: b.props?.textAlign ?? b.props?.align ?? "left",
      color: b.props?.color || undefined,
      lineHeight: 1.2,
    };
    return <Tag style={style}>{b.props?.text ?? "Heading"}</Tag>;
  };

  const Text = ({ b }) => {
    const style = {
      margin: "0.5rem 0",
      fontSize: (b.props?.fontSize ?? b.props?.size ?? 16) + "px",
      textAlign: b.props?.textAlign ?? b.props?.align ?? "left",
      color: b.props?.color || undefined,
    };
    return <p style={style}>{b.props?.text || ""}</p>;
  };

  const ImageBlock = ({ b }) => {
    const src = b.props?.src || b.props?.url;
    if (!src) return null;
    const style = {
      maxWidth: "100%",
      height: "auto",
      width: b.props?.width ? `${b.props.width}px` : undefined,
      display: "block",
    };
    return <img alt={b.props?.alt || ""} src={src} style={style} />;
  };

  const Button = ({ b }) => {
    const label = b.props?.label || "Button";
    const href = b.props?.href || "#";
    const align = b.props?.textAlign ?? b.props?.align;
    const link = (
      <a
        href={href}
        style={{
          display: "inline-block",
          padding: "10px 16px",
          borderRadius: 8,
          background: b.props?.background || "#2563eb",
          color: b.props?.color || "#fff",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        {label}
      </a>
    );
    return align && align !== "left" ? (
      <div style={{ textAlign: align }}>{link}</div>
    ) : (
      link
    );
  };

  const Render = ({ b }) => {
    if (!b || typeof b !== "object") return null;
    switch (b.type) {
      case "section":
        return <Section b={b} />;
      case "columns":
        return <Columns b={b} />;
      case "heading":
        return <Heading b={b} />;
      case "text":
        return <Text b={b} />;
      case "image":
        return <ImageBlock b={b} />;
      case "button":
        return <Button b={b} />;
      default:
        return toArray(b.children).map((c, i) => (
          <Render key={c?.id || i} b={c} />
        ));
    }
  };

  return (
    <>
      {blocks.map((b, i) => (
        <Render key={b?.id || i} b={b} />
      ))}
    </>
  );
}

/* ------------------------- payload normalization helpers ------------------------- */
function coercePage(payload) {
  // Backend may return { page: {...} } or bare object
  const p = payload?.page ?? payload ?? {};

  // Title
  const title = p.title ?? "Untitled";

  // (A) First-class HTML snapshot from the builder publish flow
  const published_html = (p.published_html && String(p.published_html)) || "";

  // (B) Blocks can be v2 shape or plain array
  let blocks = [];
  const b = p.blocks;
  if (b && b.version === 2 && Array.isArray(b.root)) blocks = b.root;
  else if (Array.isArray(b)) blocks = b;

  // (C) Legacy {content} html (homepage compatibility)
  const content = p.content || "";

  return { title, published_html, blocks, content };
}

export default function PageView() {
  const { slug } = useParams();
  const [status, setStatus] = useState("loading"); // loading | ready | notfound | error
  const [page, setPage] = useState(null);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function tryGet(url) {
      try {
        const res = await api.get(url);
        if (cancelled) return { ok: false };
        return { ok: true, data: res.data };
      } catch (err) {
        if (cancelled) return { ok: false };
        const sc = err?.response?.status;
        if (sc === 404) return { ok: false, notFound: true };
        return {
          ok: false,
          error: true,
          message:
            err?.response?.data?.message || err?.message || "Unknown error",
        };
      }
    }

    async function load() {
      setStatus("loading");
      setErrMsg("");

      if (slug) {
        const r = await tryGet(`/site/public/${encodeURIComponent(slug)}`);
        if (r.ok) {
          setPage(coercePage(r.data));
          setStatus("ready");
          return;
        }
        if (r.notFound) {
          setStatus("notfound");
        } else {
          setStatus("error");
          setErrMsg(r.message || "Failed to load page.");
        }
        return;
      }

      // Homepage fallbacks
      const candidates = ["/site/public/homepage", "/site/public"];
      for (const url of candidates) {
        const r = await tryGet(url);
        if (r.ok) {
          setPage(coercePage(r.data));
          setStatus("ready");
          return;
        }
        if (r.error) setErrMsg(r.message || errMsg);
      }
      setStatus("notfound");
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const contentNode = useMemo(() => {
    if (!page) return null;

    // Prefer published HTML snapshot
    if (page.published_html && page.published_html.trim()) {
      return <div dangerouslySetInnerHTML={{ __html: page.published_html }} />;
    }

    // Then blocks (render reactively)
    if (Array.isArray(page.blocks) && page.blocks.length > 0) {
      return <BlocksRenderer blocks={page.blocks} />;
    }

    // Finally legacy content field
    if (page.content && page.content.trim()) {
      return <div dangerouslySetInnerHTML={{ __html: page.content }} />;
    }

    return null;
  }, [page]);

  if (status === "loading")
    return (
      <div className="container">
        <p>Loading…</p>
      </div>
    );

  if (status === "error")
    return (
      <div className="container">
        <h2>We’re having trouble loading this page.</h2>
        {errMsg ? <p style={{ opacity: 0.7 }}>{String(errMsg)}</p> : null}
        <p>
          Try again later or{" "}
          <Link to="/admin/website/pages/new">create a homepage</Link>.
        </p>
      </div>
    );

  if (status === "notfound") {
    return (
      <div className="container">
        <h2>Not found</h2>
        {!slug && (
          <div className="card" style={{ marginTop: 16 }}>
            <p>No homepage found. Create one and set it as default.</p>
            <Link to="/admin/website/pages/new" className="btn primary">
              Create homepage
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container">
      <h1>{page?.title}</h1>
      {contentNode || <p>No content yet.</p>}
    </div>
  );
}
