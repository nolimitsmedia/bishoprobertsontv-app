// src/pwa/registerServiceWorker.js
// Turns on the installed-app helper (public/service-worker.js) on the live
// site only — never while developing with `npm start`.
// Emergency off switch: build with REACT_APP_PWA=off and deploy; every visitor's
// helper is then removed and its saved files deleted on their next visit.
export function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production") return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const base = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");

  if (String(process.env.REACT_APP_PWA || "").toLowerCase() === "off") {
    // Only THIS site's helper and caches: other ministries may share the address.
    const myScope = new URL(`${base}/`, window.location.origin).href;
    const myCaches = `app:${new URL(myScope).pathname}:`;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) =>
        regs.filter((r) => r.scope === myScope).forEach((r) => r.unregister()),
      )
      .catch(() => {});
    if (window.caches) {
      caches
        .keys()
        .then((keys) =>
          keys
            .filter((k) => k.startsWith(myCaches) || k.startsWith("brtv-app-"))
            .forEach((k) => caches.delete(k)),
        )
        .catch(() => {});
    }
    return;
  }

  const register = () => {
    navigator.serviceWorker
      .register(`${base}/service-worker.js`, { scope: `${base}/` })
      .then((reg) => {
        // Check for a new version when the app comes back to the screen.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible")
            reg.update().catch(() => {});
        });
      })
      .catch(() => {
        /* the site works normally without it */
      });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
