// src/lib/siteContent.js
//
// Phase 2C: each ministry's own pictures and default wording live in its site's
// public/content/ folder (set per ministry at build time), not in the code:
//   content/leader.png, about-2.jpg, about-3.jpg, home-banner.png,
//   catalog-banner.jpg, defaults.json  (Home wording, header menu)
// The code itself only holds neutral defaults for a new ministry.
import { useEffect, useState } from "react";

export const contentUrl = (file) =>
  `${process.env.PUBLIC_URL || ""}/content/${file}`;

// Files served by the website itself (its own pictures, bundled files) — not
// by the API server. Used by every place that turns a saved address into a URL.
export function isSiteFile(url) {
  const u = String(url || "");
  const base = String(process.env.PUBLIC_URL || "").replace(/\/+$/, "");
  return [`${base}/content/`, `${base}/static/`, "/content/", "/static/"].some(
    (p) => p !== "/" && u.startsWith(p),
  );
}

// Pages saved before Phase 2C may point at pictures that used to be bundled
// into the code (…/static/media/bishopimage.<hash>.png). Point them at the
// site's own files instead, so saved pages keep their pictures.
const LEGACY = [
  [/\/static\/media\/bishopimage\.[0-9a-f]+\.png$/i, "leader.png"],
  [/\/static\/media\/bishoppreaching\.[0-9a-f]+\.jpe?g$/i, "about-2.jpg"],
  [/\/static\/media\/bishopcopastor\.[0-9a-f]+\.jpe?g$/i, "about-3.jpg"],
  [/\/static\/media\/brtv-home-banner\.[0-9a-f]+\.png$/i, "home-banner.png"],
  [
    /\/static\/media\/brtv-catalog-banner\.[0-9a-f]+\.jpe?g$/i,
    "catalog-banner.jpg",
  ],
];
export function upgradeAssetUrl(s) {
  if (typeof s !== "string" || !s.includes("/static/media/")) return s;
  const clean = s.split(/[?#]/)[0];
  for (const [re, file] of LEGACY) if (re.test(clean)) return contentUrl(file);
  return s;
}
// Walk saved page content and fix any old picture addresses (returns a copy
// only when something changed).
export function upgradeAssets(value) {
  if (typeof value === "string") return upgradeAssetUrl(value);
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => {
      const n = upgradeAssets(v);
      if (n !== v) changed = true;
      return n;
    });
    return changed ? out : value;
  }
  if (value && typeof value === "object") {
    let changed = false;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const n = upgradeAssets(v);
      if (n !== v) changed = true;
      out[k] = n;
    }
    return changed ? out : value;
  }
  return value;
}

// The site's default wording (content/defaults.json). Missing → {}.
let defaults = null;
let pending = null;
const listeners = new Set();
export function siteDefaults() {
  return defaults || {};
}
// True once content/defaults.json has been read (or found missing).
export function siteDefaultsReady() {
  return defaults !== null;
}
export function loadSiteDefaults() {
  if (defaults) return Promise.resolve(defaults);
  if (!pending) {
    pending = fetch(contentUrl("defaults.json"), { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((d) => {
        defaults = d && typeof d === "object" ? d : {};
        listeners.forEach((fn) => fn());
        return defaults;
      });
  }
  return pending;
}
export function useSiteDefaults() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    loadSiteDefaults();
    return () => listeners.delete(fn);
  }, []);
  return siteDefaults();
}
