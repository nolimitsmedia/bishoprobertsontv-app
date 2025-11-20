import React from "react";
import { Link } from "react-router-dom";
import "../blocks.css";

export default function JoinStrip({
  headline = "Join over 18,000+ people",
  sub = "Be the first to receive new releases.",
  ctaText = "Sign up",
  ctaHref = "/signup",
  bgImage,
}) {
  return (
    <div className="b-strip">
      {bgImage && (
        <div
          className="b-strip-bg"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      )}
      <div className="wrap b-strip-row">
        <div>
          <div className="b-strong">{headline}</div>
          {sub && <div className="b-sub">{sub}</div>}
        </div>
        <Link className="btn btn-ghost" to={ctaHref}>
          {ctaText}
        </Link>
      </div>
    </div>
  );
}
