import React from "react";

type Img = { id: string; url: string; alt?: string };
type AnyNode = { type: string; images?: Img[]; style?: any };

export default function Gallery({ node }: { node: AnyNode }) {
  const images = Array.isArray(node.images) ? node.images : [];
  const s = node.style || {};
  const cols = Number(s.cols ?? 3);
  const gap = Number(s.gap ?? 10);

  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gap,
  };
  const img: React.CSSProperties = {
    width: "100%",
    height: s.rowHeight ? Number(s.rowHeight) : "auto",
    objectFit: s.fit ?? "cover",
    borderRadius: s.radius ? Number(s.radius) : 6,
    display: "block",
  };

  return (
    <div style={grid}>
      {images.map((it) => (
        // eslint-disable-next-line jsx-a11y/alt-text
        <img key={it.id} src={it.url} alt={it.alt || ""} style={img} />
      ))}
    </div>
  );
}
