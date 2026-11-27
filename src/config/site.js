// src/config/site.js
//
// Phase 6: site-wide identity used for browser titles, search results and
// link previews. One place to change it (and, for the white-label version,
// the values that will later come from Brand settings).
//
// Keep DESCRIPTION in sync with public/index.html, which link-preview services
// read directly (they do not run the app's code).

// White-label (Release 1.3): each customer's deployment can set these with
// REACT_APP_SITE_NAME / REACT_APP_SITE_URL / REACT_APP_SITE_DESCRIPTION; the
// brand name from Site Settings › Brand replaces the name at runtime.
export const SITE = {
  // Phase 2D: set per ministry by client-profile/profile.json (scripts/apply-profile.js).
  name: process.env.REACT_APP_SITE_NAME || "Our Ministry",
  // Home-screen / short label (e.g. "Install the BRTV app").
  shortName:
    process.env.REACT_APP_SITE_SHORT_NAME ||
    process.env.REACT_APP_SITE_NAME ||
    "our",
  url: process.env.REACT_APP_SITE_URL || "",
  description:
    process.env.REACT_APP_SITE_DESCRIPTION ||
    "Watch sermons, live services and teachings.",
  // Relative to the site address; used when a page has no sharing image.
  image: "/share-image.png",
};

export function siteImageUrl() {
  return `${SITE.url}${SITE.image}`;
}
