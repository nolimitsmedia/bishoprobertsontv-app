// RenderBlocksV2.jsx
import React from "react";

/* ---------- helpers ---------- */
function pxPad(str = "") {
  if (!str) return {};
  const parts = String(str)
    .trim()
    .split(/\s+/)
    .map((n) => Number(n || 0));
  const [t = 0, r = t, b = t, l = r] = parts;
  return {
    paddingTop: t,
    paddingRight: r,
    paddingBottom: b,
    paddingLeft: l,
  };
}

function AlignRow({ align = "left", children }) {
  const justify =
    align === "center"
      ? "center"
      : align === "right"
      ? "flex-end"
      : "flex-start";
  return (
    <div style={{ display: "flex", justifyContent: justify }}>{children}</div>
  );
}

/* ---------- widgets ---------- */
function Heading({ node }) {
  const Tag = node.tag || "h2";
  const style = {
    color: node.style?.color || "#0b1220",
    textAlign: node.style?.align || "left",
    fontSize: Number(node.style?.size || 24),
    margin: 0,
  };
  return <Tag style={style}>{node.content || ""}</Tag>;
}

function RichText({ node }) {
  const style = {
    color: node.style?.color || "#334155",
    textAlign: node.style?.align || "left",
  };
  return (
    <div style={style} dangerouslySetInnerHTML={{ __html: node.html || "" }} />
  );
}

function Img({ node }) {
  const w = node.width || "100%";
  const h = node.height || "";
  return (
    <AlignRow align={node.align || "center"}>
      {node.url ? (
        <img
          src={node.url}
          alt=""
          style={{ width: w, height: h || "auto", display: "block" }}
        />
      ) : (
        <div style={{ color: "#94a3b8" }}>Set image URL</div>
      )}
    </AlignRow>
  );
}

function Btn({ node }) {
  const size = node.size || "md";
  const pad =
    size === "sm" ? "8px 12px" : size === "lg" ? "14px 18px" : "10px 14px";
  return (
    <AlignRow align={node.align || "left"}>
      <a
        href={node.href || "#"}
        style={{
          display: "inline-block",
          padding: pad,
          borderRadius: `${Number(node.radius || 10)}px`,
          background: node.bg || "#2563eb",
          color: node.color || "#fff",
          textDecoration: "none",
          fontWeight: 700,
        }}
      >
        {node.label || "Button"}
      </a>
    </AlignRow>
  );
}

function Live({ node }) {
  if (node.html) {
    return <div dangerouslySetInnerHTML={{ __html: node.html }} />;
  }
  if (node.url) {
    return (
      <div>
        <iframe
          src={node.url}
          title="Live"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          style={{ width: "100%", height: 360, border: 0 }}
        />
      </div>
    );
  }
  return <div style={{ color: "#94a3b8" }}>Set embed URL or HTML</div>;
}

/* ---------- recursive renderer ---------- */
function renderNode(node) {
  switch (node.type) {
    case "heading":
      return <Heading node={node} />;
    case "text":
      return <RichText node={node} />;
    case "image":
      return <Img node={node} />;
    case "button":
      return <Btn node={node} />;
    case "live":
      return <Live node={node} />;
    case "columns":
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${node.columns?.length || 2}, 1fr)`,
            gap: `${node.gap ?? 16}px`,
          }}
        >
          {(node.columns || []).map((c) => (
            <div key={c.id} style={pxPad(c.style?.padding)}>
              {(c.children || []).map((child) => (
                <div key={child.id}>{renderNode(child)}</div>
              ))}
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

export default function RenderBlocksV2({ doc }) {
  if (!doc || doc.version !== 2) return null;

  return (
    <div>
      {(doc.root || []).map((sec) => (
        <section
          key={sec.id}
          style={{
            background: sec.style?.background || "transparent",
            ...pxPad(sec.style?.padding),
            textAlign: sec.style?.textAlign || "left",
          }}
        >
          {/* content width container (optional) */}
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            {(sec.children || []).map((child) => (
              <div key={child.id} style={{ margin: "12px 0" }}>
                {renderNode(child)}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
