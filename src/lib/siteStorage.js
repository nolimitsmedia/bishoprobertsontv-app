// src/lib/siteStorage.js
//
// Several ministries can share one web address, each in its own folder
// (tv.nolimitsmedia.com/<ministry>). Browsers give them ONE shared storage, so
// one ministry's sign-in would show up in another's. When this build is for
// a shared address (REACT_APP_SHARED_HOST=1, set by the client profile), every
// browser-storage key is kept under this site's own folder name, so each
// ministry only ever sees its own sign-ins and settings.
// Must be installed before anything else reads storage (src/index.js).
const BASE = String(process.env.PUBLIC_URL || "").replace(/\/+$/, "");
export const STORAGE_PREFIX = BASE ? `site:${BASE}:` : "site:/:";

export function installSiteStorage() {
  if (String(process.env.REACT_APP_SHARED_HOST || "") !== "1") return false;
  if (typeof window === "undefined" || typeof Storage === "undefined")
    return false;
  if (window.__siteStorageInstalled) return true;
  window.__siteStorageInstalled = true;
  const P = Storage.prototype;
  const get = P.getItem;
  const set = P.setItem;
  const del = P.removeItem;
  const keyAt = P.key;
  const own = (k) => STORAGE_PREFIX + String(k);
  P.getItem = function getItem(k) {
    return get.call(this, own(k));
  };
  P.setItem = function setItem(k, v) {
    return set.call(this, own(k), v);
  };
  P.removeItem = function removeItem(k) {
    return del.call(this, own(k));
  };
  // clear(): only this site's keys, never another ministry's.
  P.clear = function clear() {
    const mine = [];
    for (let i = 0; i < this.length; i += 1) {
      const k = keyAt.call(this, i);
      if (k && k.startsWith(STORAGE_PREFIX)) mine.push(k);
    }
    mine.forEach((k) => del.call(this, k));
  };
  return true;
}
