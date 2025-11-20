// src/pages/studio/PageBuilder.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api";
import BlocksEditor from "../../components/BlocksEditor/index";

/* -------------------------- tiny inline popup -------------------------- */
function Popup({ open, title, body, viewUrl, onClose }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "grid",
        placeItems: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: "90vw",
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,.2)",
          padding: 18,
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontWeight: 800 }}>{title}</h3>
        <p style={{ margin: "0 0 14px", color: "#374151" }}>{body}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {viewUrl && (
            <a className="btn" href={viewUrl} target="_blank" rel="noreferrer">
              View page
            </a>
          )}
          <button className="btn primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------ helpers ------------------------ */
function styleObjToString(style = {}) {
  return Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(
      ([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`
    )
    .join(";");
}

function cleanUrl(input) {
  if (!input) return "";
  let s = String(input);
  s = s
    .replace(/^[\u0000-\u001F\u007F\u200B-\u200D\uFEFF\s]+/, "")
    .replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF\s]+$/, "");
  s = s.replace(/\s+/g, " ");
  s = s.replace(/"/g, "%22").replace(/'/g, "%27");
  try {
    s = encodeURI(s);
  } catch {}
  return s;
}

const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function withUnit(val, unit = "px") {
  if (val === null || val === undefined || val === "") return undefined;
  if (typeof val === "string") {
    if (/[a-z%]+$/i.test(val.trim())) return val.trim();
    const n = Number(val);
    if (Number.isFinite(n)) return `${n}${unit}`;
    return val.trim();
  }
  if (Number.isFinite(val)) return `${val}${unit}`;
  return undefined;
}

function normalizeDraft(raw) {
  if (!raw) return { blocks: [] };
  if (raw.version === 2 && Array.isArray(raw.root)) return { blocks: raw.root };
  if (Array.isArray(raw)) return { blocks: raw };
  if (Array.isArray(raw.blocks)) return { blocks: raw.blocks };
  return { blocks: [] };
}

function normalizeColumnsChildren(children) {
  const ch = toArray(children);
  if (ch.length === 0) return [];
  if (ch.every((c) => Array.isArray(c))) return ch;

  if (
    ch.every(
      (c) =>
        c &&
        typeof c === "object" &&
        (Array.isArray(c.blocks) || Array.isArray(c.children))
    )
  ) {
    return ch.map((c) => toArray(c.blocks ?? c.children));
  }

  if (ch.every((c) => c && typeof c === "object" && c.type)) {
    return [ch];
  }

  return ch.map((c) => (Array.isArray(c) ? c : [c]));
}

/* ---- video id helpers ---- */
function getYouTubeId(url = "") {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = url.match(/\/embed\/([^?&]+)/);
    if (m) return m[1];
  } catch {}
  const m = String(url).match(/(v=|\/)([A-Za-z0-9_-]{11})(?:[?&/]|$)/);
  return m ? m[2] : "";
}
function getVimeoId(url = "") {
  const m = String(url).match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : "";
}

/* ----------------------------- HTML renderer ---------------------------- */
function renderHtml(blocks = []) {
  const renderNode = (b) => {
    if (!b) return "";

    switch (b.type) {
      case "section": {
        const padObj = b.props?.padding;
        const padArr = Array.isArray(padObj) ? padObj : null;
        const pad = padArr
          ? {
              top: padArr[0] ?? 0,
              right: padArr[1] ?? 0,
              bottom: padArr[2] ?? 0,
              left: padArr[3] ?? 0,
            }
          : typeof padObj === "object"
          ? {
              top: padObj.top ?? 24,
              right: padObj.right ?? 24,
              bottom: padObj.bottom ?? 24,
              left: padObj.left ?? 24,
            }
          : { top: 24, right: 24, bottom: 24, left: 24 };

        const bg = b.props?.background ?? b.props?.bg ?? "";
        const rawBgImg =
          (b.props?.backgroundImage ?? b.props?.bgImage ?? "") + "";
        const safeBgImg = cleanUrl(rawBgImg);
        const overlay = b.props?.overlay || "";

        const textAlign = b.props?.textAlign ?? b.props?.align ?? "left";

        const width = b.props?.width || "100%";
        const maxWidth = b.props?.maxWidth || "";
        const heightVal = b.props?.height ?? "";
        const heightUnit = b.props?.heightUnit || "px";
        const minHeightVal =
          b.props?.minHeight ?? b.props?.minHeightValue ?? "";
        const minHeightUnit = b.props?.minHeightUnit || "px";
        const borderRadius = b.props?.borderRadius ?? "";

        const bgPos = b.props?.backgroundPosition || "center";
        const bgSize = b.props?.backgroundSize || "cover";
        const bgRepeat = b.props?.backgroundRepeat || "no-repeat";

        /* ---------- tolerant alignment keys ---------- */
        const hKey =
          b.props?.contentAlignH ??
          b.props?.contentHAlign ??
          b.props?.contentAlign ??
          b.props?.hAlign ??
          b.props?.alignItems; // last one if someone saved raw css value
        const vKey =
          b.props?.contentAlignV ??
          b.props?.contentVAlign ??
          b.props?.vAlign ??
          b.props?.justifyContent;

        const h = (hKey || "left").toString().toLowerCase();
        const v = (vKey || "top").toString().toLowerCase();

        const justifyMap = {
          left: "flex-start",
          center: "center",
          right: "flex-end",
          "flex-start": "flex-start",
          "flex-end": "flex-end",
        };
        const alignMap = {
          top: "flex-start",
          center: "center",
          bottom: "flex-end",
          "flex-start": "flex-start",
          "flex-end": "flex-end",
        };

        const contentGap = Number(b.props?.contentGap || 0);

        const style = {
          width,
          maxWidth: maxWidth || undefined,
          margin: maxWidth ? "0 auto" : undefined,

          paddingTop: `${pad.top || 0}px`,
          paddingRight: `${pad.right || 0}px`,
          paddingBottom: `${pad.bottom || 0}px`,
          paddingLeft: `${pad.left || 0}px`,

          background: bg || undefined,
          backgroundImage: safeBgImg
            ? overlay
              ? `linear-gradient(${overlay}, ${overlay}), url(${safeBgImg})`
              : `url(${safeBgImg})`
            : overlay
            ? `linear-gradient(${overlay}, ${overlay})`
            : undefined,
          backgroundSize: safeBgImg ? bgSize : undefined,
          backgroundPosition: safeBgImg ? bgPos : undefined,
          backgroundRepeat: safeBgImg ? bgRepeat : undefined,

          height: withUnit(heightVal, heightUnit),
          minHeight:
            withUnit(heightVal, heightUnit) ??
            withUnit(minHeightVal, minHeightUnit),

          borderRadius:
            borderRadius !== "" && borderRadius !== null
              ? `${borderRadius}px`
              : undefined,

          textAlign,
          display: "flex",
          flexDirection: "column",
          alignItems: justifyMap[h] || "flex-start", // horizontal axis
          justifyContent: alignMap[v] || "flex-start", // vertical axis
          gap: contentGap ? `${contentGap}px` : undefined,
        };

        const children = toArray(b.children).map(renderNode).join("");
        return `<section style="${styleObjToString(
          style
        )}">${children}</section>`;
      }

      case "columns": {
        const cols = Math.max(
          1,
          Math.min(4, parseInt(b.props?.cols || b.props?.columns || 2, 10))
        );
        const gap = parseInt(b.props?.gap || 16, 10);
        const style = {
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
          gap: `${gap}px`,
          width: "100%",
        };
        const columnsChildren = normalizeColumnsChildren(b.children);
        const flattened = columnsChildren
          .map((col) => toArray(col).map(renderNode).join(""))
          .join("");
        return `<div style="${styleObjToString(style)}">${flattened}</div>`;
      }

      case "heading": {
        const text = b.props?.text ?? "Heading";
        const tag = b.props?.tag || "h2";
        const size = parseInt(b.props?.fontSize ?? b.props?.size ?? 28, 10);
        const weight = parseInt(
          b.props?.fontWeight ?? b.props?.weight ?? 700,
          10
        );
        const align = b.props?.textAlign ?? b.props?.align ?? "left";
        const color = b.props?.color || "";
        const style = {
          margin: 0,
          fontSize: `${size}px`,
          fontWeight: weight,
          textAlign: align,
          lineHeight: 1.2,
          color: color || undefined,
        };
        return `<${tag} style="${styleObjToString(style)}">${text}</${tag}>`;
      }

      case "text": {
        const text = b.props?.text || "";
        const align = b.props?.textAlign ?? b.props?.align ?? "left";
        const size = parseInt(b.props?.fontSize ?? b.props?.size ?? 16, 10);
        const color = b.props?.color || "";
        const style = {
          margin: "0.5rem 0",
          fontSize: `${size}px`,
          textAlign: align,
          color: color || undefined,
        };
        return `<p style="${styleObjToString(style)}">${text}</p>`;
      }

      case "image": {
        const rawSrc = (b.props?.src ?? b.props?.url ?? "") + "";
        const src = cleanUrl(rawSrc);
        const alt = b.props?.alt || "";
        const w = b.props?.width ? `${b.props.width}px` : "auto";
        const style = {
          maxWidth: "100%",
          height: "auto",
          width: b.props?.width ? w : undefined,
          display: "block",
        };
        if (!src) return "";
        return `<img src="${src}" alt="${alt}" style="${styleObjToString(
          style
        )}" />`;
      }

      case "button": {
        const label = b.props?.label || "Button";
        const href = b.props?.href || "#";
        const align = b.props?.textAlign ?? b.props?.align;
        const link = `<a href="${href}" style="${styleObjToString({
          display: "inline-block",
          padding: "10px 16px",
          borderRadius: "8px",
          background: b.props?.background || "#2563eb",
          color: b.props?.color || "#fff",
          textDecoration: "none",
          fontWeight: 600,
        })}">${label}</a>`;
        if (align && align !== "left") {
          return `<div style="text-align:${align}">${link}</div>`;
        }
        return link;
      }

      case "video": {
        const src = (b.props?.src || "").trim();
        const provider = b.props?.provider || "auto";
        const title = b.props?.title || "Video";
        if (!src) return "";

        const isYT = /youtu\.be|youtube\.com/.test(src);
        const isVimeo = /vimeo\.com/.test(src);

        const wrapStart =
          '<div style="position:relative;padding-top:56.25%;width:100%;">';
        const wrapEnd = "</div>";

        if (provider === "youtube" || (provider === "auto" && isYT)) {
          const id = getYouTubeId(src);
          if (!id) return "";
          const iframe = `<iframe title="${title}" src="https://www.youtube.com/embed/${id}" style="position:absolute;inset:0;border:0;width:100%;height:100%;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
          return wrapStart + iframe + wrapEnd;
        }

        if (provider === "vimeo" || (provider === "auto" && isVimeo)) {
          const id = getVimeoId(src);
          if (!id) return "";
          const iframe = `<iframe title="${title}" src="https://player.vimeo.com/video/${id}" style="position:absolute;inset:0;border:0;width:100%;height:100%;" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
          return wrapStart + iframe + wrapEnd;
        }

        return `<video controls style="display:block;width:100%;max-width:100%;"><source src="${cleanUrl(
          src
        )}" /></video>`;
      }

      case "embed": {
        const html = b.props?.html || "";
        return html;
      }

      default:
        return toArray(b.children).map(renderNode).join("");
    }
  };

  const html = toArray(blocks).map(renderNode).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body>${html}</body></html>`;
}

/* -------------------------- normalization helpers -------------------------- */
function normalizeDraftToBlocks(draft) {
  return normalizeDraft(draft).blocks;
}

function migrateIn(blocks = []) {
  const mapBlock = (b) => {
    if (!b || typeof b !== "object") return b;
    const p = { ...(b.props || {}) };

    if (Array.isArray(p.padding)) {
      const [t = 0, r = 0, bm = 0, l = 0] = p.padding;
      p.padding = { top: t, right: r, bottom: bm, left: l };
    }
    if (p.bg !== undefined) p.background = p.bg;
    if (p.bgImage !== undefined) p.backgroundImage = p.bgImage;
    if (p.align !== undefined) p.textAlign = p.align;
    if (p.size !== undefined) p.fontSize = p.size;
    if (p.weight !== undefined) p.fontWeight = p.weight;

    let kids;
    if (b.type === "columns") {
      kids = normalizeColumnsChildren(b.children).map((col) =>
        toArray(col).map(mapBlock)
      );
    } else {
      kids = toArray(b.children).map(mapBlock);
    }

    return { ...b, props: p, children: kids };
  };

  return toArray(blocks).map(mapBlock);
}

function normalizeOut(blocks = []) {
  const mapBlock = (b) => {
    if (!b || typeof b !== "object") return b;
    const p = { ...(b.props || {}) };

    if (p && typeof p.padding === "object" && !Array.isArray(p.padding)) {
      const pad = p.padding;
      p.padding = [
        pad.top ?? 0,
        pad.right ?? 0,
        pad.bottom ?? 0,
        pad.left ?? 0,
      ];
    }
    if (p.background !== undefined) p.bg = p.background;
    if (p.backgroundImage !== undefined) p.bgImage = p.backgroundImage;
    if (p.textAlign !== undefined) p.align = p.textAlign;
    if (p.fontSize !== undefined) p.size = p.fontSize;
    if (p.fontWeight !== undefined) p.weight = p.fontWeight;

    let kids;
    if (b.type === "columns") {
      kids = normalizeColumnsChildren(b.children).map((col) =>
        toArray(col).map(mapBlock)
      );
    } else {
      kids = toArray(b.children).map(mapBlock);
    }

    return { ...b, props: p, children: kids };
  };

  return toArray(blocks).map(mapBlock);
}

function ensureDraftShape(blocks) {
  return toArray(blocks);
}

/* -------------------------------- Component ------------------------------- */
export default function PageBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [pageSlug, setPageSlug] = useState(null);

  const [popup, setPopup] = useState({
    open: false,
    title: "",
    body: "",
    viewUrl: null,
  });

  useMemo(() => {
    const walk = (items) => {
      if (!Array.isArray(items)) return null;
      for (const b of items) {
        if (!b) continue;
        if (b.id === selectedId) return b;
        const found =
          b.type === "columns"
            ? walk([].concat(...normalizeColumnsChildren(b.children)))
            : walk(toArray(b.children));
        if (found) return found;
      }
      return null;
    };
    return walk(blocks);
  }, [blocks, selectedId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data } = await api.get(`/channels/me/pages/${id}`);
        const page = data?.page || data;

        const draft =
          page?.content_draft ??
          page?.draft_json ??
          page?.json ??
          page?.builder_json ??
          [];

        const nextBlocks = migrateIn(normalizeDraftToBlocks(draft));

        if (mounted) {
          setBlocks(nextBlocks);
          setPageSlug(page?.slug || page?.page_slug || null);
        }
      } catch (e) {
        if (e?.response?.status === 404) {
          if (mounted) {
            setBlocks([]);
            setError(null);
          }
        } else {
          console.error("[PageBuilder] load error", e);
          if (mounted) setError("Page not found");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleBack = useCallback(() => navigate("/admin/pages"), [navigate]);

  const onChange = useCallback(
    (next) => setBlocks(Array.isArray(next) ? next : []),
    []
  );
  const clearCanvas = useCallback(() => {
    setBlocks([]);
    setSelectedId(null);
  }, []);
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    const removeById = (items) =>
      toArray(items)
        .filter((b) => b && b.id !== selectedId)
        .map((b) => ({
          ...b,
          children:
            b.type === "columns"
              ? normalizeColumnsChildren(b.children).map((col) =>
                  removeById(col)
                )
              : removeById(b.children),
        }));
    setBlocks((prev) => removeById(prev));
    setSelectedId(null);
  }, [selectedId]);

  const saveDraft = useCallback(
    async (draftBlocks) => {
      const editorBlocks = ensureDraftShape(draftBlocks);
      const compactBlocks = normalizeOut(editorBlocks);
      const html = renderHtml(editorBlocks);
      await api.put(`/channels/me/pages/${id}`, {
        content_draft: { blocks: compactBlocks },
        meta: { builder_html: html },
      });
    },
    [id]
  );

  const handlePublish = useCallback(async () => {
    try {
      setPublishing(true);
      await saveDraft(blocks);
      await api.post(`/channels/me/pages/${id}/publish`, {});
      const viewUrl = pageSlug ? `/p/${encodeURIComponent(pageSlug)}` : null;
      setPopup({
        open: true,
        title: "Published",
        body: "Your page has been published successfully.",
        viewUrl,
      });
    } catch (e) {
      console.error("[PageBuilder] publish failed", e?.response?.data || e);
      setPopup({
        open: true,
        title: "Publish failed",
        body: "Something went wrong while publishing. Please check the console/logs.",
        viewUrl: null,
      });
    } finally {
      setPublishing(false);
    }
  }, [blocks, id, pageSlug, saveDraft]);

  if (loading) {
    return (
      <div className="card">
        <h2>Page Builder</h2>
        <p>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>Page Builder</h2>
        <p style={{ color: "crimson" }}>{error}</p>
        <button className="btn" onClick={handleBack}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "flex-end",
          marginBottom: 12,
        }}
      >
        <button className="btn" onClick={handleBack}>
          Back
        </button>
        <button
          className="btn primary"
          disabled={publishing}
          onClick={handlePublish}
        >
          {publishing ? "Publishing…" : "Publish"}
        </button>
      </div>

      <BlocksEditor
        blocks={blocks}
        onChange={onChange}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onClearCanvas={clearCanvas}
        onDeleteSelected={deleteSelected}
      />

      <Popup
        open={popup.open}
        title={popup.title}
        body={popup.body}
        viewUrl={popup.viewUrl}
        onClose={() =>
          setPopup({ open: false, title: "", body: "", viewUrl: null })
        }
      />
    </div>
  );
}
