// src/components/viewer/viewerStore.js
//
// Release 2.0: My List state shared by every "+ My List" button on the page.

import { useEffect, useState } from "react";
import api from "../../api";

export const isSignedIn = () => {
  try {
    return !!localStorage.getItem("token");
  } catch {
    return false;
  }
};

let ids = null; // Set of video ids, or null until loaded
let loading = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(ids));

function load() {
  if (!isSignedIn()) {
    ids = new Set();
    return Promise.resolve(ids);
  }
  if (!loading) {
    loading = api
      .get("/viewer/list/ids")
      .then(({ data }) => {
        ids = new Set((data?.ids || []).map(Number));
        emit();
        return ids;
      })
      .catch(() => {
        ids = new Set();
        emit();
        return ids;
      });
  }
  return loading;
}

export function useMyList() {
  const [state, setState] = useState(ids);
  useEffect(() => {
    listeners.add(setState);
    if (!ids) load();
    return () => listeners.delete(setState);
  }, []);
  return state || new Set();
}

// true once My List ids have loaded (so pages can hide removed videos)
export const myListLoaded = () => ids !== null;

export async function toggleMyList(videoId) {
  const id = Number(videoId);
  if (!ids) await load();
  const had = ids.has(id);
  // update right away; undo if the server says no
  ids = new Set(ids);
  if (had) ids.delete(id);
  else ids.add(id);
  emit();
  try {
    if (had) await api.delete(`/viewer/list/${id}`);
    else await api.post("/viewer/list", { video_id: id });
    return !had;
  } catch (e) {
    ids = new Set(ids);
    if (had) ids.add(id);
    else ids.delete(id);
    emit();
    throw e;
  }
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}
