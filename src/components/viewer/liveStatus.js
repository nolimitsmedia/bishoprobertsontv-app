// src/components/viewer/liveStatus.js
//
// Release 2.2: the site's live status (any provider), shared by the header
// badge, the live page and the Countdown element. Checked every minute and
// when the tab becomes visible again.

import { useEffect, useState } from "react";
import api from "../../api";

let current = null;
let inflight = null;
let lastAt = 0;
const listeners = new Set();

export function fetchLiveStatus(force = false) {
  if (!force && current && Date.now() - lastAt < 30000)
    return Promise.resolve(current);
  if (!inflight) {
    inflight = api
      .get("/live-status")
      .then(({ data }) =>
        data && typeof data.state === "string" ? data : { state: "offline" },
      )
      .catch(() => ({ state: "offline" }))
      .then((s) => {
        current = s;
        lastAt = Date.now();
        inflight = null;
        listeners.forEach((fn) => fn(s));
        return s;
      });
  }
  return inflight;
}

export function useLiveStatus() {
  const [s, setS] = useState(current);
  useEffect(() => {
    listeners.add(setS);
    fetchLiveStatus();
    const t = setInterval(() => fetchLiveStatus(true), 60000);
    const onVis = () =>
      document.visibilityState === "visible" && fetchLiveStatus(true);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      listeners.delete(setS);
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return s; // null while loading
}
