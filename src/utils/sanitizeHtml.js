// src/utils/sanitizeHtml.js
//
// Phase 4G-C3: sanitizes CMS-authored HTML before it is rendered on public
// pages. Reusable sections copy HTML between pages, so public rendering now
// removes scripts, inline event handlers and javascript: links, while keeping
// the formatting the editor produces (headings, lists, links, images, inline
// styles, classes) and HTTPS video/map embeds.

import DOMPurify from "dompurify";

let hooksInstalled = false;

// Several ministries can share one web address (tv.nolimitsmedia.com/<ministry>).
// A frame showing a page from that same address would get full access to the
// visitor's other ministry sign-ins, so frames may only show OTHER sites.
export function isSameSiteUrl(url) {
  try {
    if (typeof window === "undefined") return false;
    // Same host name, whatever the scheme or port: never a reason to frame it.
    return (
      new URL(String(url), window.location.href).hostname ===
      window.location.hostname
    );
  } catch {
    return true; // not a usable address: treat as unsafe
  }
}

function installHooks() {
  if (hooksInstalled || !DOMPurify.isSupported) return;
  hooksInstalled = true;

  DOMPurify.addHook("uponSanitizeElement", (node, data) => {
    // Embeds are allowed only from HTTPS sources (YouTube, Vimeo, Bunny,
    // Google Maps, etc.). Anything else is removed.
    if (data.tagName === "iframe") {
      const src = String(node.getAttribute("src") || "").trim();
      if (!/^https:\/\//i.test(src) || isSameSiteUrl(src))
        node.parentNode?.removeChild(node);
    }
  });

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    // Links that open a new tab must not give the new page access to ours.
    if (node.tagName === "A" && node.getAttribute("target") === "_blank") {
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

const CONFIG = {
  ADD_TAGS: ["iframe"],
  ADD_ATTR: [
    "target",
    "allow",
    "allowfullscreen",
    "frameborder",
    "scrolling",
    "loading",
    "referrerpolicy",
  ],
  FORBID_TAGS: ["script", "object", "embed", "base", "meta", "link"],
  FORBID_ATTR: ["srcdoc"],
};

export default function sanitizeHtml(html) {
  const raw = String(html ?? "");
  if (!raw) return "";
  if (!DOMPurify.isSupported) return ""; // never render unsanitized HTML
  installHooks();
  return DOMPurify.sanitize(raw, CONFIG);
}
