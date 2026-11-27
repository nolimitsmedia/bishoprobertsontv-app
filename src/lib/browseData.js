// src/lib/browseData.js
// One shared copy of /viewer/browse for Home and the Catalog:
//  - reused for 60 s within a visit (no second download when moving between pages)
//  - a saved copy of the PUBLIC part (featured + category rows) for instant
//    first paint on return visits; members' rows are never saved.
import api from "../api";

let mem = { at: 0, signed: null, promise: null };
const signedIn = () => {
  try {
    return !!(localStorage.getItem("token") || sessionStorage.getItem("token"));
  } catch {
    return false;
  }
};

export function fetchBrowse() {
  const signed = signedIn();
  if (mem.promise && mem.signed === signed && Date.now() - mem.at < 60000)
    return mem.promise;
  const promise = api.get("/viewer/browse").then(({ data }) => {
    if (!data || !Array.isArray(data.rows)) throw new Error("bad response");
    return data;
  });
  mem = { at: Date.now(), signed, promise };
  promise.catch(() => {
    if (mem.promise === promise) mem = { at: 0, signed: null, promise: null };
  });
  return promise;
}

const PERSONAL = new Set(["continue", "my-list"]);
export function readSavedBrowse(key) {
  try {
    const c = JSON.parse(localStorage.getItem(key) || "null");
    return c && Array.isArray(c.rows) ? c : null;
  } catch {
    return null;
  }
}
export function saveBrowse(key, data, keepRow = () => true) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        featured: data.featured || [],
        rows: (data.rows || []).filter(
          (r) => r && !PERSONAL.has(r.key) && keepRow(r),
        ),
      }),
    );
  } catch {
    /* storage full / private mode */
  }
}
