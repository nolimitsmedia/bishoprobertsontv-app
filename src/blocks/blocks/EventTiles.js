import React from "react";
import "../blocks.css";

function Tile({ image, tag, actionText }) {
  return (
    <a className="b-event" href="#">
      {image && <img src={image} alt="" />}
      {tag && <div className="b-event-tag">{tag}</div>}
      {actionText && <span className="b-event-pill">{actionText}</span>}
    </a>
  );
}

export default function EventTiles({ items = [] }) {
  return (
    <div className="wrap b-events">
      {items.slice(0, 2).map((t, i) => (
        <Tile key={i} {...t} />
      ))}
    </div>
  );
}
