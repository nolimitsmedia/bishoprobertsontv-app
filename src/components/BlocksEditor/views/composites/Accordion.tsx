import React, { useState } from "react";

type Item = { id: string; title?: string; html?: string };
type AnyNode = { type: string; items?: Item[]; style?: any };

export default function Accordion({ node }: { node: AnyNode }) {
  const items = Array.isArray(node.items) ? node.items : [];
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  const card: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    marginBottom: 8,
    overflow: "hidden",
  };
  const head: React.CSSProperties = {
    padding: "10px 12px",
    cursor: "pointer",
    background: "#f9fafb",
    fontWeight: 600,
  };
  const body: React.CSSProperties = { padding: "12px" };

  return (
    <div>
      {items.map((it) => {
        const isOpen = openId === it.id;
        return (
          <div key={it.id} style={card}>
            <div style={head} onClick={() => setOpenId(isOpen ? null : it.id)}>
              {it.title ?? "Item"}
            </div>
            {isOpen ? (
              <div
                style={body}
                dangerouslySetInnerHTML={{ __html: it.html ?? "" }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
