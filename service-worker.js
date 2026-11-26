/* BishopRobertson.TV — installed-app helper (service worker).
 *
 * What it does:
 *  - Pages: always loaded fresh from the internet. With no signal the app
 *    shows a "You're offline / Try again" screen.
 *  - The site's own code and pictures (/static/, icons): kept on the phone so
 *    the app opens fast. File names change with every deploy, so new versions
 *    are always picked up.
 * What it never touches: videos (Bunny), the API (sign-in, accounts, progress,
 * payments), uploads, or anything from another website. Only GET requests to
 * this site are handled; everything else goes straight to the network.
 */
const VERSION = "brtv-app-v1";
const PAGE_CACHE = `${VERSION}-pages`;
const STATIC_CACHE = `${VERSION}-static`;
const STATIC_MAX_ENTRIES = 150;
const OFFLINE_URL = "offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((c) => c.addAll([OFFLINE_URL, "pwa-icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("brtv-app-") && !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i += 1) await cache.delete(keys[i]);
}

// Pages: always from the internet. With no connection, a clear "You're
// offline / Try again" screen instead of a half-loaded app.
async function handlePage(request) {
  try {
    return await fetch(request);
  } catch (err) {
    const cache = await caches.open(PAGE_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    throw err;
  }
}

// Code/pictures with versioned names: saved copy first.
async function handleStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh && fresh.ok && fresh.type === "basic") {
    cache.put(request, fresh.clone()).then(() => trim(STATIC_CACHE, STATIC_MAX_ENTRIES));
  }
  return fresh;
}

// Icons/manifest: saved copy at once, refreshed in the background.
async function handleRefreshable(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  const update = fetch(request)
    .then((fresh) => {
      if (fresh && fresh.ok && fresh.type === "basic") cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => hit);
  return hit || update;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return; // API, Bunny, fonts...
  const scopePath = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(scopePath)) return;
  const rel = url.pathname.slice(scopePath.length);

  if (request.mode === "navigate") {
    event.respondWith(handlePage(request));
  } else if (rel.startsWith("static/")) {
    event.respondWith(handleStatic(request));
  } else if (rel === "pwa-icon-192.png") {
    event.respondWith(
      caches
        .match(request)
        .then((hit) => hit || fetch(request)),
    );
  } else if (/\.(png|ico|svg|webp|jpg|jpeg)$/i.test(rel) || rel === "manifest.json") {
    event.respondWith(handleRefreshable(request));
  }
  // anything else: browser default (network)
});
