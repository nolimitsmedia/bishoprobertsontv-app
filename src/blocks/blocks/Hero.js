import React from "react";
import { Link } from "react-router-dom";
import "../blocks.css";

export default function Hero({
  kicker = "Where You Get The Cutting Edge",
  title = "Timely messages that sharpen your faith",
  desc = "Apostolic-level teaching to equip you for everyday breakthroughs.",
  ctaText = "Start watching",
  ctaHref = "/videos",
  bgImage,
}) {
  return (
    <div className="b-hero">
      {bgImage && (
        <div
          className="b-hero-bg"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      )}
      <div className="wrap b-hero-pad">
        <div className="b-card">
          <div className="b-kicker">{kicker}</div>
          <h1 className="b-title">{title}</h1>
          {desc && <p className="b-desc">{desc}</p>}
          {ctaText && (
            <Link className="btn btn-primary" to={ctaHref}>
              {ctaText}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
