import React from "react";

type AnyNode = { type: string; style?: any };

export default function DividerView({ node }: { node: AnyNode }) {
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
  const line: React.CSSProperties = {
    height: s.thickness ? Number(s.thickness) : 1,
    background: s.color ?? "#e5e7eb",
    width: s.width ?? "100%",
  };
  return (
    <div style={wrap}>
      <div style={line} />
    </div>
  );
}
