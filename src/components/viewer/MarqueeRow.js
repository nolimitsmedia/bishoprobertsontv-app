// src/components/viewer/MarqueeRow.js
//
// Full-width carousel that drifts to the left and loops seamlessly.
// Pauses on hover and while a card has keyboard focus; a Pause / Play button
// stops it for anyone (auto-moving content must be stoppable). With "reduce
// motion" switched on in the device settings it doesn't move: it becomes a
// normal swipeable row.

import React, { useState } from "react";
import { VideoCard } from "./ViewerParts";

export default function MarqueeRow({ row, onSeeAll }) {
  const [paused, setPaused] = useState(false);
  const items = Array.isArray(row?.items) ? row.items : [];
  if (!items.length) return null;
  const headingId = `vw-marquee-${row.key}`;
  // ~6 seconds per card keeps the drift calm
  const duration = `${Math.max(24, items.length * 6)}s`;
  return (
    <section className="vw-marquee" aria-labelledby={headingId}>
      <div className="vw-marqueeHead">
        <h2 id={headingId}>{row.title}</h2>
        <div className="vw-marqueeTools">
          <button
            type="button"
            className="vw-marqueePause"
            aria-pressed={paused}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? (
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M7 4v16l13-8z" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            )}
            <span className="vw-sr">
              {paused ? `Play ${row.title}` : `Pause ${row.title}`}
            </span>
          </button>
          {onSeeAll ? (
            <button type="button" className="vw-seeAll" onClick={onSeeAll}>
              See all<span className="vw-sr"> {row.title}</span> ›
            </button>
          ) : null}
        </div>
      </div>
      <div className={`vw-marqueeViewport${paused ? " is-paused" : ""}`}>
        <div
          className="vw-marqueeTrack"
          style={{ "--vw-marquee-duration": duration }}
        >
          {items.map((v) => (
            <div className="vw-marqueeItem" key={`a-${v.id}`}>
              <VideoCard v={v} />
            </div>
          ))}
          {/* second copy for the seamless loop — hidden from screen readers and keyboard */}
          {items.map((v) => (
            <div
              className="vw-marqueeItem"
              key={`b-${v.id}`}
              aria-hidden="true"
              inert=""
            >
              <VideoCard v={v} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
