// src/auth.js
export const TOKEN_KEY = "token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("currentUser");
}

export function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Try to get the logged-in user:
 * 1) localStorage cache
 * 2) decode JWT for { role, email, sub/id }
 * 3) call /auth/me
 */
export async function ensureUser(api) {
  const token = getToken();
  if (!token) return null;

  try {
    const cached = JSON.parse(localStorage.getItem("currentUser") || "null");
    if (cached) return cached;
  } catch {}

  const payload = parseJwt(token);
  if (payload && payload.role) {
    const u = {
      id: payload.sub || payload.id || null,
      email: payload.email || null,
      role: payload.role,
    };
    localStorage.setItem("currentUser", JSON.stringify(u));
    return u;
  }

  // fallback to server
  try {
    const { data } = await api.get("/auth/me");
    localStorage.setItem("currentUser", JSON.stringify(data));
    return data;
  } catch {
    return null;
  }
}

export function isAdminUser(u) {
  return !!u && (u.role === "admin" || u.role === "superadmin");
}
