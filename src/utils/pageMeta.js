// src/utils/pageMeta.js
//
// Phase 6: per-page browser title, description and sharing tags.
// Search engines that run JavaScript (Google) read these. Link-preview services
// (Facebook, WhatsApp, X...) read public/index.html only; see config/site.js.

import { useEffect } from "react";
import { SITE, siteImageUrl } from "../config/site";
import { mediaSrc } from "../lib/mediaApi";

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function removeMeta(attr, key) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

function apply({ title, description, image, noindex }) {
  document.title = title;
  setMeta("name", "description", description);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:image", image);
  setMeta("property", "og:site_name", SITE.name);
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  setMeta("name", "twitter:image", image);
  if (noindex) setMeta("name", "robots", "noindex, nofollow");
  else removeMeta("name", "robots");
}

const DEFAULTS = () => ({
  title: SITE.name,
  description: SITE.description,
  image: siteImageUrl(),
  noindex: false,
});

/**
 * title:       page title; " | Site name" is added unless titleIsFinal is true
 * description: falls back to the site description
 * image:       URL or /uploads path; falls back to the site image
 */
export function usePageMeta({
  title = "",
  titleIsFinal = false,
  description = "",
  image = "",
  noindex = false,
  enabled = true,
} = {}) {
  useEffect(() => {
    if (!enabled) return undefined;
    const t = String(title || "").trim();
    const d = String(description || "")
      .replace(/\s+/g, " ")
      .trim();
    const img = String(image || "").trim();
    apply({
      title: !t
        ? SITE.name
        : titleIsFinal || t.includes(SITE.name)
          ? t
          : `${t} | ${SITE.name}`,
      description: (d || SITE.description).slice(0, 320),
      image: img ? mediaSrc(img) : siteImageUrl(),
      noindex: !!noindex,
    });
    return () => apply(DEFAULTS());
  }, [title, titleIsFinal, description, image, noindex, enabled]);
}
