// src/lib/mediaApi.js
//
// Phase 4H: shared helpers for the CMS media library. Used by the Media
// Library admin page and (Phase 4H-2) the page-builder image picker.
//
// Uploads use the existing POST /api/uploads route exactly as the page editor
// already does (kind=images, category=pages), so files land in the same
// storage (Bunny, Wasabi or local). The returned URL is then registered in the
// library with POST /api/admin/media.

import api from "../api";
import { isSiteFile } from "./siteContent";

export const MEDIA_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,image/avif";
export const MEDIA_TYPES = new Set(MEDIA_ACCEPT.split(","));
export const MEDIA_MAX_BYTES = 15 * 1024 * 1024; // 15 MB, same as page uploads

// Turns a stored URL into one the browser can load. Server-relative
// "/uploads/..." paths are served by the API host, not the admin site.
export function mediaSrc(u) {
  const url = String(u || "");
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  // the site's own files (photos bundled with the site, e.g. in a starter
  // template) are served by the site itself, not by the API host
  if (isSiteFile(url)) return url;
  const base = String(api?.defaults?.baseURL || "").replace(/\/api\/?$/i, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
}

export function formatBytes(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return "";
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(v < 10240 ? 1 : 0)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

export function apiError(e, fallback) {
  return (
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.message ||
    fallback
  );
}

// Returns an error message for files the library won't accept, else "".
export function validateMediaFile(file) {
  if (!file) return "No file selected.";
  const type = String(file.type || "").toLowerCase();
  if (!MEDIA_TYPES.has(type))
    return "Only JPG, PNG, GIF, WebP and AVIF images can be uploaded.";
  if (file.size > MEDIA_MAX_BYTES)
    return `This image is ${formatBytes(file.size)}. The limit is ${formatBytes(MEDIA_MAX_BYTES)}.`;
  return "";
}

// Reads pixel dimensions in the browser. Resolves {width:null,height:null}
// if the browser can't decode the file.
export function readImageSize(file) {
  return new Promise((resolve) => {
    let url = "";
    try {
      url = URL.createObjectURL(file);
    } catch {
      resolve({ width: null, height: null });
      return;
    }
    const img = new window.Image();
    const done = (w, h) => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
      resolve({ width: w || null, height: h || null });
    };
    img.onload = () => done(img.naturalWidth, img.naturalHeight);
    img.onerror = () => done(null, null);
    img.src = url;
  });
}

// Uploads one image and adds it to the library. onProgress gets 0..100.
export async function uploadToLibrary(file, { onProgress } = {}) {
  const problem = validateMediaFile(file);
  if (problem) throw new Error(problem);

  const { width, height } = await readImageSize(file);

  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", "images");
  fd.append("category", "pages");
  fd.append("folder", "library");

  const up = await api.post("/uploads", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (evt) => {
      if (!onProgress || !evt.total) return;
      onProgress(Math.min(99, Math.round((evt.loaded / evt.total) * 100)));
    },
  });
  const url = up?.data?.url || "";
  if (!url)
    throw new Error("The upload finished but no file address came back.");

  const { data } = await api.post("/admin/media", {
    url,
    storage_key: up?.data?.key || "",
    filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    width,
    height,
  });
  if (onProgress) onProgress(100);
  return data?.item;
}

export async function listMedia({ q = "", limit = 48, offset = 0 } = {}) {
  const { data } = await api.get("/admin/media", {
    params: { q: q || undefined, limit, offset },
  });
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    total: Number(data?.total) || 0,
  };
}

export async function getMedia(id) {
  const { data } = await api.get(`/admin/media/${id}`);
  return data?.item;
}

export async function updateMedia(id, fields) {
  const { data } = await api.patch(`/admin/media/${id}`, fields);
  return data?.item;
}

export async function removeMedia(id) {
  await api.delete(`/admin/media/${id}`);
}

export async function importMediaFromPages() {
  const { data } = await api.post("/admin/media/import-from-pages");
  return { found: Number(data?.found) || 0, added: Number(data?.added) || 0 };
}

// Files an image that was uploaded somewhere else (for example from the page
// editor) into the library. Best effort: never throws, so a library problem
// can never break the upload that already succeeded.
export async function registerUploadedImage(file, url, storageKey = "") {
  try {
    const type = String(file?.type || "").toLowerCase();
    if (!url || !MEDIA_TYPES.has(type)) return null;
    const { width, height } = await readImageSize(file);
    const { data } = await api.post("/admin/media", {
      url,
      storage_key: storageKey || "",
      filename: file.name,
      mime_type: type,
      size_bytes: file.size,
      width,
      height,
    });
    return data?.item || null;
  } catch {
    return null;
  }
}
