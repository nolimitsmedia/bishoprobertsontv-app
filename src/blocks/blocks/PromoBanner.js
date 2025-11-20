import React from "react";
import { Link } from "react-router-dom";
import "../blocks.css";

export default function PromoBanner({
  theme = "dark", // "dark" | "maroon" | "light"
  kicker,
  title,
  text,
  ctaText = "Watch Playlist",
  ctaHref = "/videos",
  image,
}) {
  return (
    <div className={`wrap b-promo b-${theme}`}>
      <div className="b-promo-copy">
        {kicker && <div className="b-kicker">{kicker}</div>}
        {title && <h3 className="b-promo-title">{title}</h3>}
        {text && <p className="b-promo-text">{text}</p>}
        <Link className="btn btn-primary" to={ctaHref}>
          {ctaText}
        </Link>
      </div>
      {image && <img className="b-promo-art" src={image} alt="" />}
    </div>
  );
}
