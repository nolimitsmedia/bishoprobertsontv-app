// src/lib/siteOptions.js
//
// Site options (homepage choice, site-wide custom CSS), loaded once per page
// view and shared. Also the CSS cleaner used for page and site custom CSS
// (same rules as the server).

import { useEffect, useState } from "react";
import api from "../api";
import { SITE } from "../config/site";
import { updateBrandAssets } from "./brand";

const DEFAULTS = {
  home_page_slug: "",
  custom_css: "",
  global_colors: [],
  brand: {},
  header: {},
  footer: {},
};
let cache = null;

// Faster loading: the last site options are kept in the browser, so returning
// visitors see the right homepage, header and footer immediately; the fresh
// copy from the server replaces it as soon as it arrives.
const STORE_KEY = "brtv:site-options:v1";
let stored;
export function cachedSiteOptions() {
  if (stored === undefined) {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      stored = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : null;
    } catch {
      stored = null;
    }
    if (stored?.brand?.name) SITE.name = stored.brand.name;
    if (stored) updateBrandAssets(stored);
  }
  return stored;
}

export function loadSiteOptions(force = false) {
  if (!cache || force) {
    cache = api
      .get("/site-options/public")
      .then(({ data }) => {
        const o = { ...DEFAULTS, ...(data?.options || {}) };
        // White-label: the brand name (Site Settings › Brand) is used in page titles.
        if (o.brand?.name) SITE.name = o.brand.name;
        stored = o;
        updateBrandAssets(o);
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(o));
        } catch {
          /* private mode / full storage: fine */
        }
        return o;
      })
      .catch(() => cachedSiteOptions() || { ...DEFAULTS });
  }
  return cache;
}

export function useSiteOptions() {
  const [options, setOptions] = useState(() => cachedSiteOptions());
  useEffect(() => {
    let alive = true;
    loadSiteOptions().then((o) => alive && setOptions(o));
    return () => {
      alive = false;
    };
  }, []);
  return options; // null only on a first visit, until the server answers
}

// Custom CSS cannot run scripts in modern browsers; this also removes ways to
// break out of the <style> element or pull in outside code.
export function cleanCss(input) {
  return String(input || "")
    .slice(0, 50000)
    .replace(/<\/?\s*style[^>]*>/gi, "")
    .replace(/<\/?\s*script[^>]*>/gi, "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/expression\s*\(/gi, "(")
    .replace(/-moz-binding\s*:/gi, "")
    .replace(/behavior\s*:/gi, "");
}

// Global colors as CSS variables (--bx-gc-<slug>) for linked colors.
export function globalColorsCss(colors) {
  const list = Array.isArray(colors) ? colors : [];
  const decls = list
    .filter(
      (c) =>
        /^[a-z0-9][a-z0-9-]{0,39}$/.test(String(c?.slug || "")) &&
        /^#[0-9a-fA-F]{6}$/.test(String(c?.hex || "")),
    )
    .map((c) => `--bx-gc-${c.slug}:${c.hex}`);
  return decls.length ? `:root{${decls.join(";")}}` : "";
}

// Brand color and logo from the last visit, before the first request returns.
cachedSiteOptions();
