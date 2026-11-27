// src/pwa/installStore.js
// Installed app ("Add to Home Screen") state, shared by the banner, the menu
// button and the Apps page. Chrome/Edge (Android and computers) fire
// `beforeinstallprompt` once, early — so it is caught here as soon as the app
// loads (see src/index.js), not when a component happens to mount.
// iPhone/iPad never fire it: there the visitor uses Share → Add to Home Screen,
// and we show a short how-to instead.
import { useEffect, useState } from "react";

const DISMISS_KEY = "brtv_install_dismissed_at";
const DISMISS_DAYS = 30;

let deferredPrompt = null;
let installedNow = false;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export function isStandalone() {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

export function isAppleTouchDevice() {
  try {
    const ua = navigator.userAgent || "";
    return (
      /iP(hone|ad|od)/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  } catch {
    return false;
  }
}

// Apps like Facebook/Instagram open links in their own browser, which cannot
// add to the home screen.
export function isInAppBrowser() {
  try {
    return /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok|LinkedInApp|GSA\//.test(
      navigator.userAgent || "",
    );
  } catch {
    return false;
  }
}

export function isTouchScreen() {
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

export function initInstallCapture() {
  if (typeof window === "undefined" || window.__brtvInstallCapture) return;
  window.__brtvInstallCapture = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of Chrome's mini bar
    deferredPrompt = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedNow = true;
    notify();
  });
}

function snapshot() {
  const installed = installedNow || isStandalone();
  const ios = isAppleTouchDevice();
  return {
    installed,
    canPrompt: !installed && !!deferredPrompt,
    // iPhone/iPad: show the how-to (not inside Facebook/Instagram browsers).
    iosGuide: !installed && ios && !isInAppBrowser(),
    iosInApp: !installed && ios && isInAppBrowser(),
  };
}

// Opens the browser's own install window. Resolves "accepted" | "dismissed" |
// "unavailable".
export async function promptInstall() {
  const e = deferredPrompt;
  if (!e) return "unavailable";
  deferredPrompt = null; // a prompt can be used only once
  notify();
  try {
    await e.prompt();
    const choice = await e.userChoice;
    return choice?.outcome === "accepted" ? "accepted" : "dismissed";
  } catch {
    return "dismissed";
  }
}

export function useInstallApp() {
  const [state, setState] = useState(snapshot);
  useEffect(() => {
    const update = () => setState(snapshot());
    listeners.add(update);
    let mq = null;
    try {
      mq = window.matchMedia("(display-mode: standalone)");
      mq.addEventListener?.("change", update);
    } catch {
      /* old browsers */
    }
    update();
    return () => {
      listeners.delete(update);
      mq?.removeEventListener?.("change", update);
    };
  }, []);
  return state;
}

export function wasDismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function rememberDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* private mode */
  }
}
