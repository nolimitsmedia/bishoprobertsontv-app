// src/lib/brand.js
//
// White-label branding (Phase 2B). Nothing here is specific to one ministry:
//  - DEFAULT_THUMB: shown when a video has no thumbnail — a play button in the
//    ministry's brand color (Site Settings › Brand › Brand color).
//  - <BrandLogo>: the Site Settings logo; else the site's own logo file
//    (public/brand-logo.png, set per ministry at build time); else the
//    ministry's name as text.
import React, { useEffect, useState } from "react";
import { mediaSrc } from "./mediaApi";

export const DEFAULT_BRAND_COLOR = "#7c3aed";
export const SITE_LOGO_FILE = `${process.env.PUBLIC_URL || ""}/brand-logo.png`;

const HEX = /^#[0-9a-fA-F]{6}$/;

export function brandColorOf(opts) {
  const c = opts?.brand?.color;
  if (HEX.test(c || "")) return c;
  const first = (opts?.global_colors || []).find((g) => HEX.test(g?.hex || ""));
  return first ? first.hex : DEFAULT_BRAND_COLOR;
}

const thumbCache = new Map();
// 16:9 play-button image in the brand color (an inline SVG, no file needed).
export function playThumb(color = DEFAULT_BRAND_COLOR) {
  const c = HEX.test(color) ? color : DEFAULT_BRAND_COLOR;
  if (thumbCache.has(c)) return thumbCache.get(c);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
<defs><radialGradient id="g" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>
<rect width="1280" height="720" fill="#0c0a12"/><rect width="1280" height="720" fill="url(#g)"/>
<circle cx="640" cy="360" r="112" fill="${c}"/><path d="M606 296 L606 424 L712 360 Z" fill="#fff"/></svg>`;
  // Brackets and quotes encoded too, so it is safe inside CSS url(...).
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/'/g, "%27")}`;
  thumbCache.set(c, uri);
  return uri;
}

// Live binding: modules importing DEFAULT_THUMB see the brand color once the
// site's options have loaded (updateBrandAssets is called by siteOptions.js).
// eslint-disable-next-line import/no-mutable-exports
export let DEFAULT_THUMB = playThumb(DEFAULT_BRAND_COLOR);
let currentBrand = {};
const listeners = new Set();

export function updateBrandAssets(opts) {
  DEFAULT_THUMB = playThumb(brandColorOf(opts));
  currentBrand = opts?.brand || {};
  listeners.forEach((fn) => fn());
}

function useBrand() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return currentBrand;
}

/** The ministry's logo. Falls back to the site's logo file, then to its name. */
export function BrandLogo({ brand: brandProp, name, alt, className, style }) {
  const live = useBrand();
  const brand = brandProp || live;
  const siteName = brand.name || name || "";
  const primary = brand.logo_url ? mediaSrc(brand.logo_url) : SITE_LOGO_FILE;
  const [src, setSrc] = useState(primary);
  useEffect(() => setSrc(primary), [primary]);
  if (!src)
    return (
      <span
        className={`brand-logo-text${className ? ` ${className}` : ""}`}
        style={{
          fontWeight: 800,
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
          ...style,
          width: "auto",
          height: "auto",
        }}
      >
        {siteName || "Home"}
      </span>
    );
  return (
    <img
      src={src}
      alt={alt ?? (siteName ? `${siteName} logo` : "Logo")}
      className={className}
      style={style}
      onError={() =>
        setSrc((cur) => (cur !== SITE_LOGO_FILE ? SITE_LOGO_FILE : ""))
      }
    />
  );
}
