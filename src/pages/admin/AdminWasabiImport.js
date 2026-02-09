// src/pages/admin/AdminWasabiImport.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { uploadApi } from "../../api";
import "./AdminWasabiImport.css";

function fmtBytes(bytes = 0) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function cleanKeyLabel(key = "") {
  return String(key).split("/").pop() || key;
}

// Lightweight "progress" (client-side) while importing.
// Since the API imports server-side and returns at the end, we can show a
// determinate bar that advances up to ~92% while waiting, then finishes on response.
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export default function AdminWasabiImport() {
  const nav = useNavigate();

  const [prefix, setPrefix] = useState("drm");
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [selected, setSelected] = useState(() => new Set());
  const [selectAllPage, setSelectAllPage] = useState(false);

  // preview becomes optional/manual (to avoid timeouts)
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErr, setPreviewErr] = useState("");

  // import settings
  const [visibility, setVisibility] = useState("private");
  const [categoryId, setCategoryId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  /* -----------------------------
     Toast (no deps) + actions
  ------------------------------ */
  const [toast, setToast] = useState({
    open: false,
    type: "success", // success | error | info
    message: "",
    sticky: false,
    actions: null, // [{ label, onClick, variant }]
  });

  const toastTimerRef = useRef(null);

  function hideToast() {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setToast((t) => ({ ...t, open: false, actions: null, sticky: false }));
  }

  function showToast(type, message, ms = 3500, opts = {}) {
    const { sticky = false, actions = null } = opts || {};

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ open: true, type, message, sticky, actions });

    if (!sticky) {
      toastTimerRef.current = setTimeout(() => {
        setToast((t) => ({ ...t, open: false }));
        toastTimerRef.current = null;
      }, ms);
    }
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  /* -----------------------------
     Import progress (client-side)
  ------------------------------ */
  const [progress, setProgress] = useState({
    active: false,
    pct: 0,
    label: "",
  });

  const progressTimerRef = useRef(null);

  function startProgress(label = "Importing…") {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setProgress({ active: true, pct: 3, label });

    // Smoothly move toward 92% while waiting for server response.
    progressTimerRef.current = setInterval(() => {
      setProgress((p) => {
        if (!p.active) return p;
        const current = Number(p.pct || 0);
        if (current >= 92) return p;
        // Ease-out: smaller steps as it gets higher.
        const step = current < 40 ? 6 : current < 70 ? 3 : 1.2;
        return { ...p, pct: clamp(current + step, 0, 92) };
      });
    }, 700);
  }

  function finishProgress(finalLabel = "Done") {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;

    setProgress((p) => ({ ...p, active: true, pct: 100, label: finalLabel }));
    // small delay then hide
    setTimeout(() => {
      setProgress({ active: false, pct: 0, label: "" });
    }, 900);
  }

  function stopProgress() {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;
    setProgress({ active: false, pct: 0, label: "" });
  }

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  async function fetchObjects({ reset = false } = {}) {
    setLoading(true);
    setErr("");
    try {
      const cursor = reset ? "" : nextCursor || "";
      const url =
        `/admin/wasabi/objects?prefix=${encodeURIComponent(prefix)}` +
        `&type=mp4&limit=50` +
        (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "") +
        (q.trim() ? `&q=${encodeURIComponent(q.trim())}` : "") +
        `&_=${Date.now()}`;

      const res = await api.get(url);
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Failed to load objects");

      const list = Array.isArray(res.data.items) ? res.data.items : [];
      setItems((prev) => (reset ? list : [...prev, ...list]));
      setNextCursor(res.data.next_cursor || null);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Server error");
      if (reset) {
        setItems([]);
        setNextCursor(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadPreviewManual() {
    setPreviewLoading(true);
    setPreviewErr("");
    try {
      const res = await api.get(
        `/admin/wasabi/preview?prefix=${encodeURIComponent(prefix)}&_=${Date.now()}`,
      );
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Preview failed");
      setPreview(res.data);
      showToast(
        "success",
        `Preview loaded. MP4: ${res.data?.counts?.mp4 ?? 0}, PNG: ${res.data?.counts?.png ?? 0}`,
      );
    } catch (e) {
      setPreview(null);
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Preview timed out. You can still import normally.";
      setPreviewErr(msg);
      showToast("error", msg);
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    // prefix changes: refresh list, selection, and clear preview
    setItems([]);
    setNextCursor(null);
    setSelected(new Set());
    setSelectAllPage(false);
    setImportResult(null);

    setPreview(null);
    setPreviewErr("");
    setPreviewLoading(false);

    fetchObjects({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefix]);

  const selectedCount = selected.size;
  const pageKeys = useMemo(() => items.map((x) => x.key), [items]);

  function toggleKey(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectPage(on) {
    setSelectAllPage(on);
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) pageKeys.forEach((k) => next.add(k));
      else pageKeys.forEach((k) => next.delete(k));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setSelectAllPage(false);
  }

  async function doImport() {
    if (!selectedCount || importing) return;

    setImporting(true);
    setImportResult(null);
    startProgress(`Importing ${selectedCount} file(s)…`);

    // Sticky toast while importing (with progress bar)
    showToast("info", `Importing ${selectedCount} selected…`, 999999, {
      sticky: true,
      actions: [
        {
          label: "Back to Videos",
          variant: "ghost",
          onClick: () => nav("/admin/content/videos"),
        },
      ],
    });

    try {
      const body = {
        keys: Array.from(selected),
        visibility,
        default_title_mode: "filename_no_ext",
      };

      if (String(categoryId || "").trim()) {
        body.category_id = Number(categoryId);
      }

      // ✅ IMPORTANT FIX:
      // Use uploadApi (timeout: 0) so large Wasabi→Bunny imports don't fail at 15s
      const res = await uploadApi.post(`/admin/wasabi/import`, body);

      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Import failed");

      setImportResult(res.data);

      const imported = Number(res.data.imported || 0);
      const skipped = Number(res.data.skipped || 0);
      const errors = Number(res.data.errors || 0);

      finishProgress(errors > 0 ? "Imported with errors" : "Import complete");

      // After import: show action toast w/ buttons
      if (errors > 0) {
        showToast(
          "error",
          `Imported ${imported}. Skipped ${skipped}. Errors ${errors}.`,
          999999,
          {
            sticky: true,
            actions: [
              {
                label: "Continue Import",
                variant: "primary",
                onClick: () => {
                  // keep page, let them import more (no navigation)
                  hideToast();
                },
              },
              {
                label: "Back to Videos",
                variant: "ghost",
                onClick: () => nav("/admin/content/videos"),
              },
            ],
          },
        );
      } else {
        showToast(
          "success",
          `Import complete: ${imported} imported${skipped ? `, ${skipped} skipped` : ""}.`,
          999999,
          {
            sticky: true,
            actions: [
              {
                label: "Continue Import",
                variant: "primary",
                onClick: () => {
                  hideToast();
                },
              },
              {
                label: "Back to Videos",
                variant: "ghost",
                onClick: () => nav("/admin/content/videos"),
              },
            ],
          },
        );
      }

      // Optional: clear selection after success so user doesn’t re-import same list
      // (server already skips duplicates, but this makes UX cleaner)
      clearSelection();
    } catch (e) {
      stopProgress();
      const msg = e?.response?.data?.message || e?.message || "Import failed";
      setImportResult({ ok: false, message: msg });

      showToast("error", msg, 999999, {
        sticky: true,
        actions: [
          {
            label: "Continue Import",
            variant: "primary",
            onClick: () => hideToast(),
          },
          {
            label: "Back to Videos",
            variant: "ghost",
            onClick: () => nav("/admin/content/videos"),
          },
        ],
      });
    } finally {
      setImporting(false);
    }
  }

  function runSearchReset() {
    setItems([]);
    setNextCursor(null);
    setSelected(new Set());
    setSelectAllPage(false);
    fetchObjects({ reset: true });
  }

  return (
    <div className="wasabi-page">
      {/* Toast */}
      {toast.open ? (
        <div
          className={`wasabi-toast ${toast.type}`}
          role="status"
          aria-live="polite"
        >
          <div className="wasabi-toast__top">
            <div className="wasabi-toast__left">
              <div className="wasabi-toast__dot" />
              <div className="wasabi-toast__msg">{toast.message}</div>
            </div>

            <button
              type="button"
              className="wasabi-toast__close"
              onClick={hideToast}
              aria-label="Dismiss"
              title="Dismiss"
            >
              ×
            </button>
          </div>

          {/* Progress bar (only while importing/progress active) */}
          {progress.active ? (
            <div className="wasabi-toast__progress">
              <div className="wasabi-toast__progressLabel">
                <span>{progress.label}</span>
                <span>{Math.round(progress.pct)}%</span>
              </div>
              <div className="wasabi-toast__bar">
                <div
                  className="wasabi-toast__barFill"
                  style={{ width: `${clamp(progress.pct, 0, 100)}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Actions */}
          {Array.isArray(toast.actions) && toast.actions.length ? (
            <div className="wasabi-toast__actions">
              {toast.actions.map((a, idx) => (
                <button
                  key={`${a.label}-${idx}`}
                  type="button"
                  className={
                    a.variant === "primary"
                      ? "wasabi-toastBtn wasabi-toastBtn--primary"
                      : "wasabi-toastBtn wasabi-toastBtn--ghost"
                  }
                  onClick={a.onClick}
                >
                  {a.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="wasabi-head">
        <div>
          <div className="wasabi-kicker">ADMIN</div>
          <h1 className="wasabi-title">Wasabi Import</h1>
          <div className="wasabi-sub">
            Preview and import MP4 files directly from the client’s Wasabi
            bucket.
          </div>
        </div>
      </div>

      <div className="wasabi-card">
        <div className="wasabi-row">
          <div className="wasabi-field">
            <label>Prefix / Folder</label>
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="drm"
            />
            <div className="wasabi-hint">
              Example: <b>drm</b> (we’ll treat it as <b>drm/</b>)
            </div>

            <div className="wasabi-actionsRow">
              <button
                className="wasabi-btn wasabi-btn--ghost"
                onClick={loadPreviewManual}
                disabled={previewLoading}
                type="button"
              >
                {previewLoading
                  ? "Loading Preview…"
                  : "Load Preview (optional)"}
              </button>

              {preview?.counts ? (
                <>
                  <div className="wasabi-pill">MP4: {preview.counts.mp4}</div>
                  <div className="wasabi-pill">PNG: {preview.counts.png}</div>
                </>
              ) : null}
            </div>

            {previewErr ? (
              <div className="wasabi-error" style={{ marginTop: 10 }}>
                {previewErr}
              </div>
            ) : null}
          </div>

          <div className="wasabi-field">
            <label>Search (filename)</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. Bishop 1130am"
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearchReset();
              }}
            />
            <button
              className="wasabi-btn wasabi-btn--ghost"
              onClick={runSearchReset}
              disabled={loading}
              style={{ marginTop: 10 }}
              type="button"
            >
              Apply Search
            </button>
          </div>

          <div className="wasabi-field">
            <label>Defaults on Import</label>

            <div className="wasabi-miniRow">
              <div style={{ flex: 1 }}>
                <div className="wasabi-miniLabel">Visibility</div>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  disabled={importing}
                >
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="public">Public</option>
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <div className="wasabi-miniLabel">Category ID (optional)</div>
                <input
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  placeholder="e.g. 12"
                  inputMode="numeric"
                  disabled={importing}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="wasabi-toolbar">
          <label className="wasabi-check">
            <input
              type="checkbox"
              checked={selectAllPage}
              onChange={(e) => selectPage(e.target.checked)}
              disabled={importing}
            />
            Select all on this page
          </label>

          <div className="wasabi-toolbarRight">
            <div className="wasabi-selected">
              Selected: <b>{selectedCount}</b>
            </div>
            <button
              className="wasabi-btn wasabi-btn--primary"
              onClick={doImport}
              disabled={!selectedCount || importing}
              title={!selectedCount ? "Select MP4 files to import" : ""}
              type="button"
            >
              {importing ? "Importing…" : "Import Selected"}
            </button>
          </div>
        </div>

        {err ? <div className="wasabi-error">{err}</div> : null}

        <div className="wasabi-tableWrap">
          <table className="wasabi-table">
            <thead>
              <tr>
                <th style={{ width: 46 }} />
                <th>File</th>
                <th className="col-size">Size</th>
                <th className="col-modified">Last Modified</th>
                <th className="col-link">Link</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: 18, opacity: 0.8 }}>
                    No MP4 objects found for this prefix.
                  </td>
                </tr>
              ) : null}

              {items.map((it) => {
                const on = selected.has(it.key);
                return (
                  <tr key={it.key} className={on ? "is-selected" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleKey(it.key)}
                        disabled={importing}
                      />
                    </td>
                    <td>
                      <div className="wasabi-file">
                        <div className="wasabi-fileName">
                          {cleanKeyLabel(it.key)}
                        </div>
                        <div className="wasabi-fileKey">{it.key}</div>
                      </div>
                    </td>
                    <td className="col-size">{fmtBytes(it.size)}</td>
                    <td className="col-modified">
                      {it.lastModified
                        ? new Date(it.lastModified).toLocaleString()
                        : "-"}
                    </td>
                    <td className="col-link">
                      <a href={it.url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="wasabi-footer">
          <button
            className="wasabi-btn wasabi-btn--ghost"
            onClick={() => fetchObjects({ reset: false })}
            disabled={loading || !nextCursor || importing}
            type="button"
          >
            {loading
              ? "Loading…"
              : nextCursor
                ? "Load more"
                : "No more results"}
          </button>
        </div>

        {importResult ? (
          <div className="wasabi-result">
            {importResult.ok === false ? (
              <>
                <div className="wasabi-resultTitle">Import failed</div>
                <div className="wasabi-resultText">{importResult.message}</div>
              </>
            ) : (
              <>
                <div className="wasabi-resultTitle">Import complete</div>
                <div className="wasabi-resultText">
                  Imported: <b>{importResult.imported}</b> • Skipped:{" "}
                  <b>{importResult.skipped}</b> • Errors:{" "}
                  <b>{importResult.errors}</b>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
