import React, { useMemo, useState } from "react";

type Img = { id: string; url: string; alt?: string };
type AnyNode = { type: string; images?: Img[]; style?: any };

export default function Carousel({ node }: { node: AnyNode }) {
  const imgs = useMemo(
    () => (Array.isArray(node.images) ? node.images : []),
    [node.images]
  );
  const [i, setI] = useState(0);
  const s = node.style || {};
  const radius = s.radius ? Number(s.radius) : 8;

  function prev() {
    setI((p) => (p - 1 + imgs.length) % Math.max(1, imgs.length));
  }
  function next() {
    setI((p) => (p + 1) % Math.max(1, imgs.length));
  }

  const frame: React.CSSProperties = {
    position: "relative",
    overflow: "hidden",
    borderRadius: radius,
  };
  const slide: React.CSSProperties = {
    width: "100%",
    display: "block",
    objectFit: s.fit ?? "cover",
  };
  const btn: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    background: "rgba(0,0,0,.5)",
    color: "#fff",
    border: "none",
    width: 36,
    height: 36,
    borderRadius: 18,
    cursor: "pointer",
  };

  if (imgs.length === 0) return null;

  return (
    <div style={frame}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img src={imgs[i].url} alt={imgs[i].alt || ""} style={slide} />
      <button style={{ ...btn, left: 8 }} onClick={prev}>
        ‹
      </button>
      <button style={{ ...btn, right: 8 }} onClick={next}>
        ›
      </button>
    </div>
  );
}
