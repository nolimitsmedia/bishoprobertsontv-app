import React from "react";

type AnyNode = { type: string; label?: string; href?: string; style?: any };

export default function ButtonView({ node }: { node: AnyNode }) {
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
    background: s.bg ?? "#111827",
    color: s.color ?? "#ffffff",
    padding: s.pad ?? "10px 16px",
    borderRadius: s.radius ? Number(s.radius) : 8,
    border: "none",
    textDecoration: "none",
    display: "inline-block",
  };
  return (
    <div style={wrap}>
      <a style={style} href={node.href || "#"}>
        {node.label ?? "Button"}
      </a>
    </div>
  );
}
