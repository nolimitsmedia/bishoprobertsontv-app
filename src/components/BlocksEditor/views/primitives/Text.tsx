import React from "react";

type AnyNode = { type: string; html?: string; style?: any };

export default function Text({ node }: { node: AnyNode }) {
  const s = node.style || {};
  const style: React.CSSProperties = {
    color: s.color ?? "#111827",
    textAlign: s.align ?? "left",
    background: s.bg ?? undefined,
    padding: s.pad ?? undefined,
    borderRadius: s.radius ? Number(s.radius) : undefined,
  };
  return (
    <div style={style} dangerouslySetInnerHTML={{ __html: node.html ?? "" }} />
  );
}
