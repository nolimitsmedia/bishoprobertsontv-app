// src/components/UploadVideosModal.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, { uploadApi } from "../api"; // <- use uploadApi for files (no timeout)
import "./UploadVideosModal.css";

const CREATE_TIMEOUT_MS = 20000; // only for the post-/videos step

function baseTitle(filename = "") {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

function slugFromName(name = "") {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^\w\d]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function CloudIcon({ size = 26 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="uvm-cloud"
    >
      <path
        d="M6 19a4 4 0 0 1-.6-7.96A6 6 0 0 1 17.9 9.2 4.5 4.5 0 0 1 18 18H8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <path
        d="M12 12v7m0-7 2.5 2.5M12 12 9.5 14.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Optional: parent can pass categorySlug if opening from a specific category view
export default function UploadVideosModal({
  open,
  onClose,
  onDone,
  categorySlug: initialCategorySlug,
}) {
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const inStudio = location.pathname.startsWith("/studio");
  const editHrefFor = (id) =>
    inStudio ? `/studio/videos/${id}` : `/admin/content/videos/${id}`;

  // -------- Category state --------
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Derive a default category slug from URL if provided (?category=...)
  const urlCategorySlug = useMemo(() => {
    const search = new URLSearchParams(location.search || "");
    const fromQuery =
      search.get("category") ||
      search.get("category_slug") ||
      search.get("cat") ||
      "";
    return fromQuery.trim() || "";
  }, [location.search]);

  // Load categories when modal opens
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadCategories() {
      setCategoriesLoading(true);
      setCategoriesError("");
      try {
        const res = await api.get("/categories");
        const list = Array.isArray(res?.data) ? res.data : [];
        if (cancelled) return;

        setCategories(list);

        // NEW: do NOT auto-select the first category.
        // Only preselect if a specific slug was provided.
        setSelectedCategoryId(null);
        setSelectedCategorySlug("");

        const desiredSlug = initialCategorySlug || urlCategorySlug || "";

        if (desiredSlug && list.length) {
          const match =
            list.find(
              (c) =>
                c.slug === desiredSlug ||
                slugFromName(c.name) === desiredSlug ||
                String(c.id) === String(desiredSlug)
            ) || null;

          if (match) {
            setSelectedCategoryId(match.id ?? null);
            setSelectedCategorySlug(
              match.slug || slugFromName(match.name || "")
            );
          }
        }
      } catch (err) {
        if (!cancelled) {
          setCategoriesError(
            err?.response?.data?.message ||
              err?.message ||
              "Failed to load categories"
          );
        }
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    }

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, [open, initialCategorySlug, urlCategorySlug]);

  // Handle category dropdown change
  const handleCategoryChange = (e) => {
    const value = e.target.value;
    if (!value) {
      setSelectedCategoryId(null);
      setSelectedCategorySlug("");
      return;
    }
    const cat = categories.find((c) => String(c.id) === String(value));
    setSelectedCategoryId(cat?.id ?? null);
    setSelectedCategorySlug(cat?.slug || slugFromName(cat?.name || ""));
  };

  // Create a new category
  const handleCreateCategory = async (e) => {
    e?.preventDefault?.();
    const name = newCategoryName.trim();
    if (!name) return;

    setCreatingCategory(true);
    setCategoriesError("");
    try {
      const res = await api.post("/categories", { name });
      const cat = res?.data || {};
      const slug = cat.slug || slugFromName(cat.name || name);

      setCategories((prev) => [...prev, cat]);
      setSelectedCategoryId(cat.id ?? null);
      setSelectedCategorySlug(slug);
      setNewCategoryName("");
    } catch (err) {
      setCategoriesError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create category"
      );
    } finally {
      setCreatingCategory(false);
    }
  };

  // -------- Upload state --------
  // items: [{id,file,progress,status,error,controller,url,videoId,title,durationSec,categoryId,categorySlug}]
  const [items, setItems] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!open) {
      setItems([]);
      setDragOver(false);
    }
  }, [open]);

  const pickFiles = () => inputRef.current?.click();

  const addFiles = useCallback(
    (fileList) => {
      const files = Array.from(fileList || []);
      if (!files.length) return;

      // Require a category before uploading
      if (!selectedCategoryId && !selectedCategorySlug) {
        alert("Please select or create a category before uploading videos.");
        return;
      }

      const entries = files.map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
        file: f,
        progress: 0,
        status: "queued", // queued | uploading | creating | done | error | canceled
        error: "",
        controller: null,
        url: "",
        videoId: null,
        title: baseTitle(f.name || "Untitled"),
        durationSec: null,
        // capture category at the moment of adding files
        categoryId: selectedCategoryId ?? null,
        categorySlug: selectedCategorySlug || "uncategorized",
      }));

      setItems((prev) => [...prev, ...entries]);
      entries.forEach((entry) => startUpload(entry));
    },
    [selectedCategoryId, selectedCategorySlug]
  );

  async function startUpload(entry) {
    const { id, file, categorySlug } = entry;

    // 1) upload (use uploadApi: no timeout)
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status: "uploading" } : it))
    );
    const uploadCtl = new AbortController();
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, controller: uploadCtl } : it))
    );

    let fileUrl = "";
    let durationSec = null;
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "videos"); // ensure backend treats it as video

      // Send category to backend so Bunny folder = category
      if (categorySlug) {
        fd.append("category", categorySlug);
      }

      const up = await uploadApi.post("/uploads/video", fd, {
        signal: uploadCtl.signal,
        onUploadProgress: (e) => {
          const total = e.total ?? e?.progressTotal ?? 0;
          const loaded = e.loaded ?? e?.progress ?? 0;
          if (!total) return;
          const pct = Math.round((loaded / total) * 100);
          setItems((prev) =>
            prev.map((it) =>
              it.id === id
                ? {
                    ...it,
                    progress: pct,
                    status: pct >= 100 ? "creating" : "uploading",
                  }
                : it
            )
          );
        },
      });

      const data = up?.data || {};
      fileUrl = data.url;
      durationSec = data.duration_sec ?? data.duration_seconds ?? null;
      if (!fileUrl) throw new Error("Upload succeeded but missing URL");

      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, url: fileUrl, durationSec } : it
        )
      );
    } catch (err) {
      const msg =
        err?.response?.data?.message || err?.message || "Upload failed";
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, status: "error", error: msg } : it
        )
      );
      return;
    }

    // 2) create video (with short timeout; avoids “stuck in Processing…”)
    await createVideoWithTimeout(
      id,
      fileUrl,
      entry.title,
      durationSec,
      entry.categoryId
    );
  }

  async function createVideoWithTimeout(
    id,
    fileUrl,
    title,
    durationSec,
    categoryId
  ) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), CREATE_TIMEOUT_MS);

    try {
      const created = await api.post(
        "/videos",
        {
          title,
          description: "",
          video_url: fileUrl,
          thumbnail_url: null,
          category_id: categoryId ?? null,
          // DEFAULTS: Unpublished + Gated
          visibility: "private",
          is_premium: true,
          duration_seconds: durationSec ?? undefined, // server can calculate if null
        },
        { signal: ctl.signal }
      );

      clearTimeout(to);
      const vid = created?.data?.id ?? null;
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? { ...it, progress: 100, status: "done", videoId: vid }
            : it
        )
      );
    } catch (err) {
      clearTimeout(to);
      const msg =
        err?.name === "CanceledError" || err?.code === "ERR_CANCELED"
          ? "Creating the video timed out. Please click Retry."
          : err?.response?.data?.message ||
            err?.message ||
            "Failed to create video";
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? { ...it, progress: 100, status: "error", error: msg }
            : it
        )
      );
    }
  }

  // Retry the create step (no re-upload)
  async function retryCreate(id) {
    const it = items.find((x) => x.id === id);
    if (!it?.url) return;
    setItems((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, status: "creating", error: "" } : x
      )
    );
    await createVideoWithTimeout(
      id,
      it.url,
      it.title,
      it.durationSec,
      it.categoryId
    );
  }

  function cancelUpload(id) {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it?.controller) it.controller.abort();
      return prev.map((x) => (x.id === id ? { ...x, status: "canceled" } : x));
    });
  }

  const allFinished = useMemo(
    () =>
      items.length > 0 &&
      items.every((i) => ["done", "error", "canceled"].includes(i.status)),
    [items]
  );
  const allSucceeded = useMemo(
    () => items.length > 0 && items.every((i) => i.status === "done"),
    [items]
  );

  // ---- refresh helpers (for list page to show new uploads) ----
  const refreshRoute = () => {
    try {
      navigate(0);
    } catch {
      window.location.reload();
    }
  };
  const handleClose = () => {
    onClose?.();
    const shouldRefresh = items.some((i) => i.status === "done");
    if (shouldRefresh) setTimeout(refreshRoute, 0);
  };
  const handleDone = () => {
    try {
      onDone?.(items.filter((i) => i.videoId).map((i) => i.videoId));
    } catch {}
    onClose?.();
    setTimeout(refreshRoute, 0);
  };

  if (!open) return null;

  return (
    <div className="uvm-overlay" onClick={handleClose}>
      <div
        className="uvm-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="uvm-head">
          <h3 className="uvm-title">Upload videos</h3>
          <button
            className="uvm-x"
            aria-label="Close"
            title="Close"
            onClick={handleClose}
          >
            ×
          </button>
        </div>

        {/* Category controls */}
        <div className="uvm-category-section">
          <div className="uvm-category-row">
            <label className="uvm-category-label">
              Category
              <select
                className="uvm-category-select"
                value={selectedCategoryId ?? ""}
                onChange={handleCategoryChange}
                disabled={categoriesLoading}
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </label>
            {categoriesLoading && (
              <div className="uvm-category-hint">Loading categories…</div>
            )}
          </div>

          <form
            className="uvm-category-new"
            onSubmit={handleCreateCategory}
            autoComplete="off"
          >
            <input
              type="text"
              className="uvm-category-input"
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
            <button
              type="submit"
              className="uvm-btn small"
              disabled={creatingCategory || !newCategoryName.trim()}
            >
              {creatingCategory ? "Adding…" : "Add category"}
            </button>
          </form>

          {categoriesError && (
            <div className="uvm-error uvm-error-small">{categoriesError}</div>
          )}
        </div>

        {allSucceeded && (
          <div className="uvm-alert success">
            <div className="uvm-alert-icon">✔</div>
            <div>
              All videos have been successfully uploaded and we are now
              processing them. You can close this window or upload more.
            </div>
          </div>
        )}

        {items.map((it) => (
          <div className="uvm-file-row" key={it.id}>
            <div className="uvm-file-main">
              <div className="uvm-file-name">{it.title}</div>
              <div className="uvm-file-sub">
                {it.status === "uploading"
                  ? "Uploading…"
                  : it.status === "creating"
                  ? "Processing…"
                  : it.status === "done"
                  ? "Uploaded"
                  : it.status === "canceled"
                  ? "Canceled"
                  : it.status === "error"
                  ? "Failed"
                  : "Queued"}
              </div>
            </div>

            <div className="uvm-file-progress">
              <div
                className={`uvm-bar ${it.status}`}
                style={{
                  width: `${
                    it.progress ||
                    (["creating", "done"].includes(it.status) ? 100 : 0)
                  }%`,
                }}
              />
            </div>

            <div className="uvm-file-actions">
              {it.status === "uploading" && (
                <button
                  className="uvm-btn ghost"
                  onClick={() => cancelUpload(it.id)}
                >
                  Cancel
                </button>
              )}
              {it.status === "error" && it.url && (
                <button
                  className="uvm-btn primary"
                  onClick={() => retryCreate(it.id)}
                >
                  Retry
                </button>
              )}
              {it.status === "done" && it.videoId && (
                <button
                  className="uvm-btn primary"
                  onClick={() => navigate(editHrefFor(it.videoId))}
                >
                  Edit video
                </button>
              )}
            </div>

            {it.status === "error" && (
              <div className="uvm-error">{it.error}</div>
            )}
          </div>
        ))}

        <div
          className={`uvm-drop ${dragOver ? "drag" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <CloudIcon />
          <div className="uvm-drop-text">Drag and drop files here</div>
          <button className="uvm-btn" onClick={pickFiles}>
            Select files
          </button>
          <input
            type="file"
            accept="video/*"
            multiple
            ref={inputRef}
            onChange={(e) => addFiles(e.target.files)}
            style={{ display: "none" }}
          />
        </div>

        <div className="uvm-footer">
          You can also upload video files via{" "}
          <a href="#" onClick={(e) => e.preventDefault()}>
            Dropbox here
          </a>
        </div>

        <div className="uvm-bottom">
          <button className="uvm-btn ghost" onClick={handleClose}>
            Close
          </button>
          <button
            className="uvm-btn primary"
            disabled={!allFinished}
            title={!allFinished ? "Wait for uploads to finish" : "Done"}
            onClick={handleDone}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
