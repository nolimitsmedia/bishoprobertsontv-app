// src/pages/admin/AdminMedia.js
//
// Phase 4H-1 — CMS Media Library.
// Upload, browse, search and describe images; see which pages use each one.
// Files are stored by the existing upload route; this page manages the
// library records (title, alt text, caption, description).

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  MEDIA_ACCEPT,
  apiError,
  formatBytes,
  getMedia,
  importMediaFromPages,
  listMedia,
  mediaSrc,
  removeMedia,
  updateMedia,
  uploadToLibrary,
  validateMediaFile,
} from "../../lib/mediaApi";
import "./AdminMedia.css";

const PAGE_SIZE = 48;
const EMPTY_FORM = { title: "", alt_text: "", caption: "", description: "" };

function formatDate(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function typeLabel(mime, filename) {
  const m = String(mime || "").toLowerCase();
  if (m.startsWith("image/"))
    return m.slice(6).toUpperCase().replace("JPEG", "JPG");
  const ext = String(filename || "")
    .split("?")[0]
    .split(".")
    .pop();
  return ext && ext.length <= 5 ? ext.toUpperCase() : "Image";
}

export default function AdminMedia() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState("");

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [savingDetail, setSavingDetail] = useState(false);
  const [naturalSize, setNaturalSize] = useState(null);
  const [copied, setCopied] = useState(false);

  const [uploads, setUploads] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState(null); // { tone, text }
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const fileInput = useRef(null);
  const listRequest = useRef(0);
  const dragDepth = useRef(0);

  // Debounce search typing.
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const loadFirstPage = useCallback(async (q) => {
    const req = ++listRequest.current;
    setLoading(true);
    setListError("");
    try {
      const res = await listMedia({ q, limit: PAGE_SIZE, offset: 0 });
      if (req !== listRequest.current) return;
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      if (req !== listRequest.current) return;
      setListError(apiError(e, "The media library could not be loaded."));
    } finally {
      if (req === listRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirstPage(query);
  }, [query, loadFirstPage]);

  async function loadMore() {
    if (loadingMore) return;
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
      setNotice({
        tone: "error",
        text: apiError(e, "More images could not be loaded."),
      });
    } finally {
      setLoadingMore(false);
    }
  }

  // --- Selection & details ----------------------------------------------------
  async function selectItem(id) {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setNaturalSize(null);
    setCopied(false);
    const fromList = items.find((x) => x.id === id);
    setForm(
      fromList
        ? {
            title: fromList.title || "",
            alt_text: fromList.alt_text || "",
            caption: fromList.caption || "",
            description: fromList.description || "",
          }
        : EMPTY_FORM,
    );
    setDetailLoading(true);
    try {
      const item = await getMedia(id);
      setDetail(item);
      setForm({
        title: item.title || "",
        alt_text: item.alt_text || "",
        caption: item.caption || "",
        description: item.description || "",
      });
    } catch (e) {
      setDetailError(apiError(e, "This image's details could not be loaded."));
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setConfirmRemove(false);
  }

  const dirty = useMemo(() => {
    if (!detail) return false;
    return Object.keys(EMPTY_FORM).some(
      (k) => String(form[k] ?? "") !== String(detail[k] ?? ""),
    );
  }, [form, detail]);

  async function saveDetail() {
    if (!detail || !dirty || savingDetail) return;
    if (!form.title.trim()) {
      setDetailError("Enter a title.");
      return;
    }
    setSavingDetail(true);
    setDetailError("");
    try {
      const updated = await updateMedia(detail.id, form);
      setDetail((cur) => ({ ...cur, ...updated }));
      setForm({
        title: updated.title,
        alt_text: updated.alt_text,
        caption: updated.caption,
        description: updated.description,
      });
      setItems((cur) =>
        cur.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)),
      );
      setNotice({
        tone: "success",
        text: `Saved details for “${updated.title}”.`,
      });
    } catch (e) {
      setDetailError(apiError(e, "The details could not be saved."));
    } finally {
      setSavingDetail(false);
    }
  }

  async function copyUrl() {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(mediaSrc(detail.url));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice({
        tone: "error",
        text: "Copy failed. Select the address and copy it manually.",
      });
    }
  }

  async function doRemove() {
    if (!detail || removing) return;
    setRemoving(true);
    try {
      await removeMedia(detail.id);
      setItems((cur) => cur.filter((x) => x.id !== detail.id));
      setTotal((n) => Math.max(0, n - 1));
      setNotice({
        tone: "success",
        text: `Removed “${detail.title}” from the library. Pages using it are unchanged.`,
      });
      closeDetail();
    } catch (e) {
      setDetailError(apiError(e, "The image could not be removed."));
      setConfirmRemove(false);
    } finally {
      setRemoving(false);
    }
  }

  // --- Uploads ----------------------------------------------------------------
  function patchUpload(key, patch) {
    setUploads((cur) =>
      cur.map((u) => (u.key === key ? { ...u, ...patch } : u)),
    );
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const queued = files.map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      file,
      name: file.name,
      progress: 0,
      status: "waiting",
      error: "",
    }));
    setUploads((cur) => [...queued, ...cur.filter((u) => u.status !== "done")]);

    let added = 0;
    let failed = 0;
    let firstAdded = null;
    // One at a time keeps progress readable and avoids overloading the server.
    for (const entry of queued) {
      const problem = validateMediaFile(entry.file);
      if (problem) {
        failed += 1;
        patchUpload(entry.key, { status: "error", error: problem });
        continue;
      }
      patchUpload(entry.key, { status: "uploading" });
      try {
        const item = await uploadToLibrary(entry.file, {
          onProgress: (p) => patchUpload(entry.key, { progress: p }),
        });
        added += 1;
        if (!firstAdded) firstAdded = item;
        patchUpload(entry.key, { status: "done", progress: 100 });
        if (item && !query) {
          setItems((cur) => [item, ...cur.filter((x) => x.id !== item.id)]);
          setTotal((n) => n + 1);
        }
      } catch (e) {
        failed += 1;
        patchUpload(entry.key, {
          status: "error",
          error: apiError(e, "Upload failed."),
        });
      }
    }

    if (query && added) loadFirstPage(query);
    window.setTimeout(
      () => setUploads((cur) => cur.filter((u) => u.status !== "done")),
      4000,
    );
    if (added && !failed) {
      setNotice({
        tone: "success",
        text:
          added === 1
            ? "1 image added. Add alt text so screen readers can describe it."
            : `${added} images added. Add alt text so screen readers can describe them.`,
      });
      if (added === 1 && firstAdded) selectItem(firstAdded.id);
    } else if (added && failed) {
      setNotice({
        tone: "error",
        text: `${added} added, ${failed} not uploaded. See the list for details.`,
      });
    } else if (failed) {
      setNotice({
        tone: "error",
        text: "No images were uploaded. See the list for details.",
      });
    }
  }

  function onPickFiles(e) {
    const files = e.target.files;
    handleFiles(files);
    e.target.value = "";
  }

  function onDragEnter(e) {
    if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  }
  function onDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDragOver(false);
  }
  function onDragOver(e) {
    if (Array.from(e.dataTransfer?.types || []).includes("Files"))
      e.preventDefault();
  }
  function onDrop(e) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    handleFiles(e.dataTransfer?.files);
  }

  // --- Import from pages ------------------------------------------------------
  async function runImport() {
    if (importing) return;
    setImporting(true);
    try {
      const { found, added } = await importMediaFromPages();
      setNotice({
        tone: "success",
        text: !found
          ? "No images were found on your pages."
          : added
            ? `Found ${found} images on your pages and added ${added} new ${added === 1 ? "one" : "ones"} to the library.`
            : `Found ${found} images on your pages. All of them are already in the library.`,
      });
      if (added) loadFirstPage(query);
    } catch (e) {
      setNotice({
        tone: "error",
        text: apiError(e, "Images could not be imported."),
      });
    } finally {
      setImporting(false);
    }
  }

  // --- Render -------------------------------------------------------------------
  const busyUploading = uploads.some(
    (u) => u.status === "uploading" || u.status === "waiting",
  );
  const selected = detail || items.find((x) => x.id === selectedId) || null;
  const usedOn = Array.isArray(detail?.used_on) ? detail.used_on : null;
  const dims =
    selected?.width && selected?.height
      ? `${selected.width} × ${selected.height} px`
      : naturalSize
        ? `${naturalSize.w} × ${naturalSize.h} px`
        : "";

  return (
    <main
      className={`ml-page ${dragOver ? "is-dragging" : ""}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="ml-header">
        <div>
          <h1>Media Library</h1>
          <p>
            Upload images once and reuse them across your website. Drop image
            files anywhere on this page to upload.
          </p>
        </div>
        <div className="ml-actions">
          <button
            type="button"
            className="ml-btn"
            onClick={runImport}
            disabled={importing}
            title="Adds images already used on your pages to the library"
          >
            {importing ? "Searching pages…" : "Find images on pages"}
          </button>
          <button
            type="button"
            className="ml-btn ml-btnPrimary"
            onClick={() => fileInput.current?.click()}
            disabled={busyUploading}
          >
            {busyUploading ? "Uploading…" : "Upload images"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={MEDIA_ACCEPT}
            multiple
            hidden
            onChange={onPickFiles}
          />
        </div>
      </div>

      {notice ? (
        <div
          className={`ml-notice ${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            className="ml-link"
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {uploads.length ? (
        <ul className="ml-uploads" aria-label="Uploads">
          {uploads.map((u) => (
            <li key={u.key} className={`ml-upload ${u.status}`}>
              <span className="ml-uploadName">{u.name}</span>
              {u.status === "error" ? (
                <span className="ml-uploadError">{u.error}</span>
              ) : (
                <span className="ml-uploadStatus">
                  {u.status === "done"
                    ? "Added"
                    : u.status === "waiting"
                      ? "Waiting…"
                      : `${u.progress}%`}
                </span>
              )}
              {u.status === "uploading" ? (
                <span className="ml-progress" aria-hidden="true">
                  <span style={{ width: `${u.progress}%` }} />
                </span>
              ) : null}
            </li>
          ))}
          {uploads.some((u) => u.status === "error") && !busyUploading ? (
            <li className="ml-uploadClear">
              <button
                type="button"
                className="ml-link"
                onClick={() =>
                  setUploads((cur) => cur.filter((u) => u.status !== "error"))
                }
              >
                Clear failed uploads
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className={`ml-body ${selectedId ? "has-detail" : ""}`}>
        <section className="ml-browser" aria-label="Images">
          <div className="ml-toolbar">
            <input
              type="search"
              className="ml-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, alt text, caption or file name"
              aria-label="Search images"
            />
            <span className="ml-count" aria-live="polite">
              {loading ? "" : `${total} ${total === 1 ? "image" : "images"}`}
            </span>
          </div>

          {loading ? (
            <div className="ml-empty" role="status">
              Loading images…
            </div>
          ) : listError ? (
            <div className="ml-empty" role="alert">
              <p>{listError}</p>
              <button
                type="button"
                className="ml-btn"
                onClick={() => loadFirstPage(query)}
              >
                Try again
              </button>
            </div>
          ) : !items.length ? (
            query ? (
              <div className="ml-empty">
                <strong>No images match “{query}”</strong>
                <button
                  type="button"
                  className="ml-btn"
                  onClick={() => setSearch("")}
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="ml-empty">
                <strong>Your media library is empty</strong>
                <p>
                  Upload images, or add the images your pages already use with
                  <b> Find images on pages</b>.
                </p>
              </div>
            )
          ) : (
            <>
              <div className="ml-grid">
                {items.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`ml-tile ${item.id === selectedId ? "is-selected" : ""}`}
                    onClick={() => selectItem(item.id)}
                    aria-pressed={item.id === selectedId}
                    title={item.title}
                  >
                    <span className="ml-thumb">
                      <img src={mediaSrc(item.url)} alt="" loading="lazy" />
                    </span>
                    <span className="ml-tileTitle">
                      {item.title || item.filename}
                    </span>
                    {!item.alt_text ? (
                      <span className="ml-tileFlag">No alt text</span>
                    ) : null}
                  </button>
                ))}
              </div>
              {items.length < total ? (
                <div className="ml-more">
                  <button
                    type="button"
                    className="ml-btn"
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
        </section>

        {selectedId ? (
          <aside
            className="ml-detail"
            aria-label="Image details"
            onKeyDown={(e) => {
              if (e.key === "Escape" && !confirmRemove) closeDetail();
            }}
          >
            <div className="ml-detailHead">
              <strong>Image details</strong>
              <button
                type="button"
                className="ml-btn ml-btnSmall"
                onClick={closeDetail}
              >
                Close
              </button>
            </div>

            {selected ? (
              <>
                <div className="ml-preview">
                  <img
                    src={mediaSrc(selected.url)}
                    alt={form.alt_text || ""}
                    onLoad={(e) =>
                      setNaturalSize({
                        w: e.currentTarget.naturalWidth,
                        h: e.currentTarget.naturalHeight,
                      })
                    }
                  />
                </div>

                <label className="ml-label" htmlFor="ml-title">
                  Title
                </label>
                <input
                  id="ml-title"
                  className="ml-input"
                  value={form.title}
                  maxLength={200}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />

                <label className="ml-label" htmlFor="ml-alt">
                  Alt text
                  {!form.alt_text.trim() ? (
                    <span className="ml-recommended">Recommended</span>
                  ) : null}
                </label>
                <input
                  id="ml-alt"
                  className="ml-input"
                  value={form.alt_text}
                  maxLength={300}
                  onChange={(e) =>
                    setForm({ ...form, alt_text: e.target.value })
                  }
                  aria-describedby="ml-altHelp"
                />
                <p className="ml-help" id="ml-altHelp">
                  Describe what the image shows for visitors using screen
                  readers. Leave empty only for purely decorative images.
                </p>

                <label className="ml-label" htmlFor="ml-caption">
                  Caption
                </label>
                <textarea
                  id="ml-caption"
                  className="ml-input"
                  rows={2}
                  maxLength={500}
                  value={form.caption}
                  onChange={(e) =>
                    setForm({ ...form, caption: e.target.value })
                  }
                />

                <label className="ml-label" htmlFor="ml-description">
                  Description
                </label>
                <textarea
                  id="ml-description"
                  className="ml-input"
                  rows={3}
                  maxLength={2000}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
                <p className="ml-help">
                  For your team only. Not shown on the website.
                </p>

                {detailError ? (
                  <div className="ml-fieldError" role="alert">
                    {detailError}
                  </div>
                ) : null}

                <div className="ml-saveRow">
                  <button
                    type="button"
                    className="ml-btn ml-btnPrimary"
                    onClick={saveDetail}
                    disabled={!dirty || savingDetail || !detail}
                  >
                    {savingDetail
                      ? "Saving…"
                      : dirty
                        ? "Save details"
                        : "Saved"}
                  </button>
                </div>

                <dl className="ml-info">
                  <div>
                    <dt>File name</dt>
                    <dd>{selected.filename}</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{typeLabel(selected.mime_type, selected.filename)}</dd>
                  </div>
                  {selected.size_bytes != null ? (
                    <div>
                      <dt>Size</dt>
                      <dd>{formatBytes(selected.size_bytes)}</dd>
                    </div>
                  ) : null}
                  {dims ? (
                    <div>
                      <dt>Dimensions</dt>
                      <dd>{dims}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Added</dt>
                    <dd>
                      {formatDate(selected.created_at)}
                      {selected.source === "import" ? " (found on pages)" : ""}
                    </dd>
                  </div>
                </dl>

                <div className="ml-urlRow">
                  <input
                    className="ml-input ml-url"
                    value={mediaSrc(selected.url)}
                    readOnly
                    aria-label="Image address"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    className="ml-btn ml-btnSmall"
                    onClick={copyUrl}
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <a
                  className="ml-link"
                  href={mediaSrc(selected.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open full size in a new tab
                </a>

                <div className="ml-usage">
                  <strong>Used on</strong>
                  {detailLoading ? (
                    <p className="ml-help">Checking pages…</p>
                  ) : usedOn && usedOn.length ? (
                    <ul>
                      {usedOn.map((p) => (
                        <li key={p.id}>
                          <Link to={`/admin/pages/${p.id}`}>{p.title}</Link>
                        </li>
                      ))}
                    </ul>
                  ) : usedOn ? (
                    <p className="ml-help">Not used on any page yet.</p>
                  ) : null}
                </div>

                {confirmRemove ? (
                  <div
                    className="ml-confirm"
                    role="alertdialog"
                    aria-labelledby="ml-confirmTitle"
                  >
                    <strong id="ml-confirmTitle">
                      Remove “{selected.title}” from the library?
                    </strong>
                    <p>
                      {usedOn && usedOn.length
                        ? `It is used on ${usedOn.length} ${usedOn.length === 1 ? "page" : "pages"}. Those pages will keep showing it; it just won’t appear in the library.`
                        : "The file itself is not deleted from storage."}
                    </p>
                    <div className="ml-confirmActions">
                      <button
                        type="button"
                        className="ml-btn"
                        onClick={() => setConfirmRemove(false)}
                        disabled={removing}
                        autoFocus
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="ml-btn ml-btnDanger"
                        onClick={doRemove}
                        disabled={removing}
                      >
                        {removing ? "Removing…" : "Remove from library"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ml-btn ml-btnDangerGhost"
                    onClick={() => setConfirmRemove(true)}
                    disabled={!detail}
                  >
                    Remove from library
                  </button>
                )}
              </>
            ) : detailLoading ? (
              <p className="ml-help" role="status">
                Loading…
              </p>
            ) : detailError ? (
              <div className="ml-fieldError" role="alert">
                {detailError}
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>

      {dragOver ? (
        <div className="ml-dropOverlay" aria-hidden="true">
          <span>Drop images to upload</span>
        </div>
      ) : null}
    </main>
  );
}
