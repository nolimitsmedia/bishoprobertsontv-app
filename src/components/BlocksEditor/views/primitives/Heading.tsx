import React from "react";

type AnyNode = { type: string; content?: string; tag?: string; style?: any };

export default function Heading({ node }: { node: AnyNode }) {
  const Tag: any = node.tag || "h2";
  const s = node.style || {};
  const style: React.CSSProperties = {
    fontSize: s.size ? Number(s.size) : 28,
    fontWeight: s.weight ?? "700",
    color: s.color ?? "#111827",
    lineHeight: s.line ? Number(s.line) : undefined,
    background: s.bg ?? undefined,
    padding: s.pad ?? undefined,
    borderRadius: s.radius ? Number(s.radius) : undefined,
    display: s.inline === "yes" ? "inline-block" : "block",
    textAlign: s.align ?? "left",
    margin: 0,
  };
  return <Tag style={style}>{node.content ?? "Heading"}</Tag>;
}
