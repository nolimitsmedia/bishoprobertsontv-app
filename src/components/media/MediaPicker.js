// src/components/media/MediaPicker.js
//
// Phase 4H-2: choose images from the Media Library inside the page builder.
//
// The page editor owns the picker and exposes pickFromLibrary() through
// MediaPickerContext, so nested editors (rich text toolbar, style popup) can
// open it without new props. pickFromLibrary resolves with:
//   single:   { __fromLibrary: true, url, alt, title, name, type } or null
//   multiple: an array of those, or null when cancelled.
// The editor's uploadImage() returns a picked image's URL without uploading,
// so every existing image handler accepts a pick in place of a File.

import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  MEDIA_ACCEPT,
  apiError,
  listMedia,
  mediaSrc,
  updateMedia,
  uploadToLibrary,
  validateMediaFile,
} from "../../lib/mediaApi";
import "./MediaPicker.css";

export const MediaPickerContext = createContext(null);

const PAGE_SIZE = 36;

export function libraryPick(item) {
  return {
    __fromLibrary: true,
    id: item.id,
    url: item.url,
    alt: item.alt_text || "",
    title: item.title || "",
    name: item.filename || item.title || "image",
    type: item.mime_type || "image/*",
  };
}

export default function MediaPickerModal({
  open,
  multiple = false,
  title,
  onCancel,
  onConfirm,
}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]); // array of items, in click order
  const [altDraft, setAltDraft] = useState("");
  const [uploading, setUploading] = useState("");
  const [confirming, setConfirming] = useState(false);
  const fileInput = useRef(null);
  const reqId = useRef(0);
  const dialogRef = useRef(null);

  // Reset each time the picker opens.
  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setAltDraft("");
    setSearch("");
    setQuery("");
    setError("");
    setUploading("");
    setConfirming(false);
    window.setTimeout(() => dialogRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search, open]);

  const load = useCallback(async (q) => {
    const id = ++reqId.current;
    setLoading(true);
    setError("");
    try {
      const res = await listMedia({ q, limit: PAGE_SIZE, offset: 0 });
      if (id !== reqId.current) return;
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      if (id !== reqId.current) return;
      setError(apiError(e, "The media library could not be loaded."));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load(query);
  }, [open, query, load]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await listMedia({
        q: query,
        limit: PAGE_SIZE,
        offset: items.length,
      });
      setItems((cur) => {
        const seen = new Set(cur.map((x) => x.id));
        return [...cur, ...res.items.filter((x) => !seen.has(x.id))];
      });
      setTotal(res.total);
    } catch (e) {
      setError(apiError(e, "More images could not be loaded."));
    } finally {
      setLoadingMore(false);
    }
  }

  function toggle(item) {
    if (!multiple) {
      setSelected([item]);
      setAltDraft(item.alt_text || "");
      return;
    }
    setSelected((cur) =>
      cur.some((x) => x.id === item.id)
        ? cur.filter((x) => x.id !== item.id)
        : [...cur, item],
    );
  }

  async function onUpload(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const added = [];
    for (let i = 0; i < files.length; i += 1) {
      const f = files[i];
      const problem = validateMediaFile(f);
      if (problem) {
        setError(`${f.name}: ${problem}`);
        continue;
      }
      setUploading(
        files.length > 1
          ? `Uploading ${i + 1} of ${files.length}…`
          : "Uploading…",
      );
      try {
        // eslint-disable-next-line no-await-in-loop
        const item = await uploadToLibrary(f);
        if (item) added.push(item);
      } catch (err) {
        setError(`${f.name}: ${apiError(err, "Upload failed.")}`);
      }
    }
    setUploading("");
    if (!added.length) return;
    setSearch("");
    setQuery("");
    setItems((cur) => [
      ...added.slice().reverse(),
      ...cur.filter((x) => !added.some((a) => a.id === x.id)),
    ]);
    setTotal((n) => n + added.length);
    if (multiple) {
      setSelected((cur) => [
        ...cur,
        ...added.filter((a) => !cur.some((c) => c.id === a.id)),
      ]);
    } else {
      setSelected([added[added.length - 1]]);
      setAltDraft(added[added.length - 1].alt_text || "");
    }
  }

  async function confirm() {
    if (!selected.length || confirming) return;
    let picks = selected;
    // Single image: alt text typed here is used now and saved to the library.
    if (!multiple) {
      const item = selected[0];
      const alt = altDraft.replace(/\s+/g, " ").trim();
      if (alt !== (item.alt_text || "")) {
        setConfirming(true);
        try {
          const updated = await updateMedia(item.id, { alt_text: alt });
          picks = [{ ...item, ...updated }];
        } catch {
          picks = [{ ...item, alt_text: alt }];
        } finally {
          setConfirming(false);
        }
      }
    }
    const result = picks.map(libraryPick);
    onConfirm(multiple ? result : result[0]);
  }

  if (!open) return null;

  const single = !multiple && selected[0];
  const heading = title || (multiple ? "Choose images" : "Choose an image");

  return (
    <div
      className="mp-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !uploading && !confirming)
          onCancel();
      }}
    >
      <div
        className="mp-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mp-title"
        tabIndex={-1}
        ref={dialogRef}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !uploading && !confirming) {
            e.stopPropagation();
            onCancel();
          }
        }}
      >
        <div className="mp-head">
          <div>
            <h2 id="mp-title">{heading}</h2>
            <p>
              {multiple
                ? "Select one or more images from your Media Library, or upload new ones."
                : "Select an image from your Media Library, or upload a new one."}
            </p>
          </div>
          <button
            type="button"
            className="mp-btn"
            onClick={() => fileInput.current?.click()}
            disabled={!!uploading}
          >
            {uploading || (multiple ? "Upload new images" : "Upload new image")}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={MEDIA_ACCEPT}
            multiple={multiple}
            hidden
            onChange={onUpload}
          />
        </div>

        <div className="mp-toolbar">
          <input
            type="search"
            className="mp-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search images"
            aria-label="Search images"
          />
          <span className="mp-count">
            {loading ? "" : `${total} ${total === 1 ? "image" : "images"}`}
          </span>
        </div>

        {error ? (
          <div className="mp-error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="mp-link"
              onClick={() => setError("")}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="mp-body">
          {loading ? (
            <div className="mp-empty" role="status">
              Loading images…
            </div>
          ) : !items.length ? (
            <div className="mp-empty">
              {query ? (
                <>
                  <strong>No images match “{query}”</strong>
                  <button
                    type="button"
                    className="mp-link"
                    onClick={() => setSearch("")}
                  >
                    Clear search
                  </button>
                </>
              ) : (
                <>
                  <strong>Your Media Library is empty</strong>
                  <span>Upload an image to get started.</span>
                </>
              )}
            </div>
          ) : (
            <>
              <div
                className="mp-grid"
                role="listbox"
                aria-multiselectable={multiple}
                aria-label="Images"
              >
                {items.map((item) => {
                  const order = selected.findIndex((x) => x.id === item.id);
                  const isSel = order >= 0;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      role="option"
                      aria-selected={isSel}
                      className={`mp-tile ${isSel ? "is-selected" : ""}`}
                      onClick={() => toggle(item)}
                      onDoubleClick={() => {
                        if (!multiple) {
                          setSelected([item]);
                          onConfirm(libraryPick(item));
                        }
                      }}
                      title={item.title}
                    >
                      <span className="mp-thumb">
                        <img src={mediaSrc(item.url)} alt="" loading="lazy" />
                      </span>
                      <span className="mp-tileTitle">
                        {item.title || item.filename}
                      </span>
                      {isSel ? (
                        <span className="mp-check" aria-hidden="true">
                          {multiple ? order + 1 : "✓"}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {items.length < total ? (
                <div className="mp-more">
                  <button
                    type="button"
                    className="mp-btn"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore
                      ? "Loading…"
                      : `Load more (${total - items.length} left)`}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="mp-foot">
          {single ? (
            <div className="mp-altRow">
              <label htmlFor="mp-alt">
                Alt text for “{single.title || single.filename}”
              </label>
              <input
                id="mp-alt"
                className="mp-input"
                value={altDraft}
                maxLength={300}
                onChange={(e) => setAltDraft(e.target.value)}
                placeholder="Describe the image for screen readers"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirm();
                  }
                }}
              />
              <span className="mp-help">Saved to the Media Library too.</span>
            </div>
          ) : (
            <span className="mp-help">
              {multiple
                ? selected.length
                  ? `${selected.length} selected. They are added in the order you selected them.`
                  : "Click images to select them."
                : "Click an image to select it. Double-click to use it right away."}
            </span>
          )}
          <div className="mp-actions">
            <button
              type="button"
              className="mp-btn"
              onClick={onCancel}
              disabled={confirming}
            >
              Cancel
            </button>
            <button
              type="button"
              className="mp-btn mp-btnPrimary"
              onClick={confirm}
              disabled={!selected.length || !!uploading || confirming}
            >
              {confirming
                ? "Saving…"
                : multiple
                  ? selected.length > 1
                    ? `Add ${selected.length} images`
                    : "Add image"
                  : "Use image"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
