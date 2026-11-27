// src/api.js
import axios from "axios";

/* -----------------------------
   Detect environment correctly
----------------------------- */
function defaultApiBase() {
  if (typeof window !== "undefined") {
    const { location } = window;

    // Local DEV: open on localhost
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      return "http://localhost:5000/api";
    }

    // GitHub Pages OR ANY production host → FORCE Render backend
    return "https://bishoprobertsontv-app-backend.onrender.com/api";
  }

  // fallback for SSR (not used)
  return "https://bishoprobertsontv-app-backend.onrender.com/api";
}

/* No trailing slash / ensure /api */
function normalizeApiBase(v) {
  let base = String(v || "").trim();
  if (!base) return defaultApiBase();
  base = base.replace(/\/+$/, "");
  if (!/\/api/i.test(base)) base += "/api";
  return base;
}

export const API_BASE = normalizeApiBase(defaultApiBase());

console.log("[api] Using API base:", API_BASE);

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
  } catch {}
}

export function clearToken() {
  try {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
  } catch {}
}

/* -------------------- Axios Instances -------------------- */
const COMMON_HEADERS = {
  Accept: "application/json",
  "X-Requested-With": "XMLHttpRequest",
};

// ✅ Increase timeout for slow admin ops (scan/list/import)
export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  timeout: 120000, // 120 seconds (was 15 seconds)
  headers: COMMON_HEADERS,
});

export const uploadApi = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  timeout: 0, // keep unlimited for large uploads (your choice)
  headers: {
    Accept: "application/json",
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

function onResponseError(err) {
  const status = err?.response?.status;

  // ✅ if backend never responded (timeout / network)
  if (err?.code === "ECONNABORTED") {
    console.error("[api] Request timed out:", err?.config?.url);
  }

  if (status === 401) clearToken();
  return Promise.reject(err);
}

api.interceptors.response.use((r) => r, onResponseError);
uploadApi.interceptors.response.use((r) => r, onResponseError);

export default api;
