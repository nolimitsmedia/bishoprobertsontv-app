// src/api.js
import axios from "axios";

/** Decide a sensible default for the current environment. */
function defaultApiBase() {
  if (typeof window !== "undefined") {
    const { location } = window;
    // Local dev: frontend :5001, API :5000
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      return "http://localhost:5000/api";
    }
    // Otherwise same-origin '/api'
    return `${location.origin.replace(/\/+$/, "")}/api`;
  }
  // SSR / node fallback
  return "http://localhost:5000/api";
}

/** Normalize base: strip trailing slashes and ensure it ends with '/api'. */
function normalizeApiBase(v) {
  let base = String(v || "").trim();
  if (!base) return defaultApiBase();
  base = base.replace(/\/+$/, "");
  if (!/\/api(?:$|\/|\?)/i.test(base)) base += "/api";
  return base;
}

/** Resolve API base (precedence: runtime override → env → default). */
function resolveBase() {
  // 1) Runtime override (inject window.__API_BASE__ before app boot if needed)
  const winBase =
    typeof window !== "undefined" ? window.__API_BASE__ : undefined;

  // 2) Env (Vite & CRA)
  const envBase =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_API_BASE) ||
    process.env.REACT_APP_API_BASE ||
    process.env.API_BASE;

  return normalizeApiBase(winBase || envBase || defaultApiBase());
}

export const API_BASE = resolveBase();

/* -------------------- Token helpers -------------------- */
export function getToken() {
  try {
    return (
      localStorage.getItem("token") || sessionStorage.getItem("token") || null
    );
  } catch {
    return null;
  }
}

export function setToken(token, persist = true) {
  clearToken();
  try {
    if (persist) localStorage.setItem("token", token);
    else sessionStorage.setItem("token", token);
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
  } catch {
    /* ignore */
  }
}

/* -------------------- Axios instances -------------------- */
/**
 * General JSON client.
 * Keep a normal timeout for quick API calls (or omit entirely).
 */
export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false, // flip true if you switch to cookie auth
  // timeout: 20000, // optional; DO NOT use a short timeout for uploads
  headers: {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

/**
 * Upload client — NO TIMEOUT.
 * Use this for video/file uploads so the browser doesn’t abort at 20s.
 * Example:
 *   const fd = new FormData(); fd.append('file', file);
 *   await uploadApi.post('/uploads/video', fd, {
 *     onUploadProgress: (e) => { ... }
 *   });
 */
export const uploadApi = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  timeout: 0, // 0 = no timeout in Axios
  headers: {
    Accept: "application/json",
    // Do NOT set 'Content-Type' here; let the browser set proper multipart boundary.
  },
});

/* -------------------- Interceptors -------------------- */
function attachAuth(config) {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
}

api.interceptors.request.use(attachAuth);
uploadApi.interceptors.request.use(attachAuth);

// Optional: on 401, clear token so the app can redirect/login cleanly
function onResponseError(err) {
  const status = err?.response?.status;
  if (status === 401) {
    clearToken();
  }
  return Promise.reject(err);
}

api.interceptors.response.use((res) => res, onResponseError);
uploadApi.interceptors.response.use((res) => res, onResponseError);

export default api;
