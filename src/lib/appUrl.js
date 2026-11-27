// src/lib/appUrl.js
//
// Release 1.3 (white-label): the app can use clean addresses ("/about") instead
// of "#/about". Set REACT_APP_ROUTER=browser for a customer whose hosting sends
// every address to index.html (see WHITE_LABEL_GUIDE.md). Default: "#".

export const CLEAN_URLS =
  String(process.env.REACT_APP_ROUTER || "").toLowerCase() === "browser";

// The base path the app is served from (e.g. "/bishoprobertsontv-app"), or "".
export function basePath() {
  const raw = process.env.PUBLIC_URL || "";
  try {
    const p = new URL(raw || "/", window.location.origin).pathname.replace(
      /\/+$/,
      "",
    );
    return p === "/" ? "" : p;
  } catch {
    return "";
  }
}

// Full in-app address for a route like "/admin/pages/5/canvas".
export function appUrl(route) {
  const r = String(route || "/").startsWith("/") ? route : `/${route}`;
  return CLEAN_URLS ? `${basePath()}${r}` : `${window.location.pathname}#${r}`;
}
