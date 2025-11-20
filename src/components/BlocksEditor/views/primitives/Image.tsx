import React from "react";

type AnyNode = { type: string; url?: string; alt?: string; style?: any };

export default function ImageView({ node }: { node: AnyNode }) {
  const s = node.style || {};
  const wrap: React.CSSProperties = {
    display: "flex",
    justifyContent:
      s.align === "center"
        ? "center"
        : s.align === "right"
        ? "flex-end"
        : "flex-start",
  };
  const style: React.CSSProperties = {
    width: s.width ?? "auto",
    height: s.height ?? "auto",
    objectFit: s.fit ?? "cover",
    borderRadius: s.radius ? Number(s.radius) : 0,
    display: "block",
    maxWidth: "100%",
  };
  return (
    <div style={wrap}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img src={node.url || ""} alt={node.alt || ""} style={style} />
    </div>
  );
}
