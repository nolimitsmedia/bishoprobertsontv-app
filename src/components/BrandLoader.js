// src/components/BrandLoader.js
//
// A visible, branded loading screen (logo + spinner). Replaces the old
// "Loading…" in dark text on a black background, which looked like a black screen.

import React from "react";
import { BrandLogo } from "../lib/brand";
import { cachedSiteOptions } from "../lib/siteOptions";

export default function BrandLoader({
  minHeight = "60vh",
  label = "Loading…",
}) {
  const brand = cachedSiteOptions()?.brand || {};
  return (
    <div
      className="brand-loader"
      style={{ minHeight }}
      role="status"
      aria-live="polite"
    >
      <BrandLogo brand={brand} alt="" className="brand-loader__logo" />
      <span className="brand-loader__spin" aria-hidden="true" />
      <span className="brand-loader__text">{label}</span>
      <style>{`
        .brand-loader { display: grid; place-items: center; align-content: center; gap: 14px; background: #000; color: rgba(255,255,255,.78); }
        .brand-loader__logo { width: min(260px, 60vw); height: auto; opacity: .95; }
        .brand-loader__spin { width: 28px; height: 28px; border-radius: 50%; border: 3px solid rgba(255,255,255,.18); border-top-color: #a78bfa; animation: brand-spin .8s linear infinite; }
        .brand-loader__text { font-weight: 600; font-size: 14px; }
        @keyframes brand-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .brand-loader__spin { animation: none; } }
      `}</style>
    </div>
  );
}
