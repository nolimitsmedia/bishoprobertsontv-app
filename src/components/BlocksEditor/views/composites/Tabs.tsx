import React, { useState } from "react";

type Item = { id: string; label?: string; html?: string };
type AnyNode = { type: string; items?: Item[]; style?: any };

export default function Tabs({ node }: { node: AnyNode }) {
  const items = Array.isArray(node.items) ? node.items : [];
  const [active, setActive] = useState(items[0]?.id);

  const bar: React.CSSProperties = {
    display: "flex",
    gap: 8,
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 8,
  };
  const tab = (on: boolean): React.CSSProperties => ({
    padding: "8px 12px",
    borderRadius: "8px 8px 0 0",
    background: on ? "#eef2ff" : "transparent",
    cursor: "pointer",
    fontWeight: on ? 700 : 600,
  });

  return (
    <div>
      <div style={bar}>
        {items.map((it) => (
          <div
            key={it.id}
            style={tab(active === it.id)}
            onClick={() => setActive(it.id)}
          >
            {it.label ?? "Tab"}
          </div>
        ))}
      </div>
      <div>
        {items.map((it) =>
          it.id === active ? (
            <div
              key={it.id}
              dangerouslySetInnerHTML={{ __html: it.html ?? "" }}
            />
          ) : null
        )}
      </div>
    </div>
  );
}
