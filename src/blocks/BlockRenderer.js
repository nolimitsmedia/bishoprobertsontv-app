import React from "react";
import * as Blocks from "./registry";

/** Renders an array of { type, props, id } blocks */
export default function BlockRenderer({ blocks = [] }) {
  return (
    <div className="br-page">
      {blocks.map((b, idx) => {
        const Cmp = Blocks[b.type];
        if (!Cmp) return null;
        return (
          <section className={`br-block br-${b.type}`} key={b.id || idx}>
            <Cmp {...(b.props || {})} />
          </section>
        );
      })}
    </div>
  );
}
