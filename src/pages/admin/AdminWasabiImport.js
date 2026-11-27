// src/pages/admin/AdminWasabiImport.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { uploadApi } from "../../api";
import "./AdminWasabiImport.css";
import "./WasabiModern.css";

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

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function normalizePrefixInput(raw = "") {
  let p = String(raw || "").trim();
  if (!p) return "";

  try {
    if (/^https?:\/\//i.test(p)) {
      const u = new URL(p);
      p = (u.pathname || "").replace(/^\/+/, "");
      if (p.includes("/")) {
        const parts = p.split("/").filter(Boolean);
        const last = parts[parts.length - 1] || "";
        if (/\.[a-z0-9]{2,5}$/i.test(last)) parts.pop();
        p = parts.join("/");
      }
    }
  } catch {
    // ignore
  }

  p = p.replace(/^\/+/, "");
  p = p.replace(/\/{2,}/g, "/");
  p = p.replace(/\/+$/, "");

  const m = p.match(/^([^/]+)\/\1(?:\/|$)/);
  if (m && m[1]) {
    p = p.replace(new RegExp(`^${m[1]}/${m[1]}`), m[1]);
    p = p.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  }

  return p;
}

export default function AdminWasabiImport() {
  const nav = useNavigate();

  const [prefix, setPrefix] = useState("drm");
  const [q, setQ] = useState("");

  // DB index pagination
  const LIMIT = 200; // 5,000 / 200 = 25 pages, smooth

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [selected, setSelected] = useState(() => new Set());
  const [selectAllPage, setSelectAllPage] = useState(false);

  // import settings
  const [visibility, setVisibility] = useState("private");
  const [categoryId, setCategoryId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // sort
  const [sortByDate, setSortByDate] = useState("newest"); // newest | oldest

  // Imported filter/counters
  const [importedFilter, setImportedFilter] = useState("all"); // all | imported | not_imported
  const [importedCount, setImportedCount] = useState(0);
  const [notImportedCount, setNotImportedCount] = useState(0);

  // Duplicate behavior
  const [dupMode, setDupMode] = useState("skip"); // safest default // skip | replace

  // Index status
  const [indexStatus, setIndexStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Scroll container
  const tableWrapRef = useRef(null);

  /* -----------------------------
     Toast (no deps) + actions
  ------------------------------ */
  const [toast, setToast] = useState({
    open: false,
    type: "success",
    message: "",
    sticky: false,
    actions: null,
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

    progressTimerRef.current = setInterval(() => {
      setProgress((p) => {
        if (!p.active) return p;
        const current = Number(p.pct || 0);
        if (current >= 92) return p;
        const step = current < 40 ? 6 : current < 70 ? 3 : 1.2;
        return { ...p, pct: clamp(current + step, 0, 92) };
      });
    }, 700);
  }

  function finishProgress(finalLabel = "Done") {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;
    setProgress((p) => ({ ...p, active: true, pct: 100, label: finalLabel }));
    setTimeout(() => setProgress({ active: false, pct: 0, label: "" }), 900);
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

  async function fetchIndexStatus() {
    try {
      const safePrefix = normalizePrefixInput(prefix);
      const r = await api.get(
        `/admin/wasabi/index/status?prefix=${encodeURIComponent(safePrefix)}&_=${Date.now()}`,
      );
      if (r?.data?.ok) setIndexStatus(r.data.status || null);
    } catch {
      // ignore
    }
  }

  async function fetchIndexPage({ reset = false, offsetOverride = null } = {}) {
    setLoading(true);
    setErr("");

    try {
      const safePrefix = normalizePrefixInput(prefix);
      const off = reset
        ? 0
        : offsetOverride != null
          ? Number(offsetOverride)
          : offset;

      const url =
        `/admin/wasabi/index?prefix=${encodeURIComponent(safePrefix)}` +
        `&sort=${encodeURIComponent(sortByDate)}` +
        `&limit=${LIMIT}` +
        `&offset=${off}` +
        `&imported=${encodeURIComponent(importedFilter)}` +
        (q.trim() ? `&q=${encodeURIComponent(q.trim())}` : "") +
        `&_=${Date.now()}`;

      const res = await api.get(url);
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Failed to load index");

      const list = Array.isArray(res.data.items) ? res.data.items : [];
      const t = Number(res.data.total || 0);

      setTotal(t);
      setOffset(off);
      setImportedCount(Number(res.data.imported_count || 0));
      setNotImportedCount(Number(res.data.not_imported_count || 0));

      setItems((prev) => (reset ? list : [...prev, ...list]));

      // normalize visible input if needed
      if (safePrefix !== prefix) {
        setPrefix(safePrefix);
        showToast("info", `Prefix corrected to "${safePrefix}"`);
      }

      return { ok: true, items: list, total: t, offset: off };
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Server error");
      if (reset) {
        setItems([]);
        setTotal(0);
        setOffset(0);
        setImportedCount(0);
        setNotImportedCount(0);
      }
      return { ok: false, items: [], total: 0, offset: 0 };
    } finally {
      setLoading(false);
    }
  }

  async function syncNow() {
    if (syncing) return;
    setSyncing(true);
    setErr("");

    showToast("info", "Syncing Wasabi → index…", 999999, { sticky: true });

    try {
      const safePrefix = normalizePrefixInput(prefix);
      const r = await uploadApi.post(`/admin/wasabi/index/sync`, {
        prefix: safePrefix,
      });
      if (!r?.data?.ok) throw new Error(r?.data?.message || "Sync failed");

      showToast("success", `Sync complete. Indexed ${r.data.indexed} item(s).`);
      await fetchIndexStatus();

      // Reload list after sync
      setItems([]);
      setSelected(new Set());
      setSelectAllPage(false);
      setImportResult(null);
      await fetchIndexPage({ reset: true });
      if (tableWrapRef.current) tableWrapRef.current.scrollTop = 0;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Sync failed";
      showToast("error", msg, 6000);
      setErr(msg);
      await fetchIndexStatus();
    } finally {
      setSyncing(false);
    }
  }

  // Initial load / prefix change
  useEffect(() => {
    setItems([]);
    setTotal(0);
    setOffset(0);
    setSelected(new Set());
    setSelectAllPage(false);
    setImportResult(null);

    fetchIndexStatus();
    fetchIndexPage({ reset: true });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefix, sortByDate, importedFilter]);

  function runSearchReset() {
    setItems([]);
    setTotal(0);
    setOffset(0);
    setSelected(new Set());
    setSelectAllPage(false);
    fetchIndexPage({ reset: true });
  }

  const displayedItems = useMemo(() => {
    // already sorted on backend; just return
    return Array.isArray(items) ? items : [];
  }, [items]);

  const selectedCount = selected.size;

  function toggleKey(key, meta = {}) {
    const already = meta?.alreadyImported === true;

    if (already) {
      if (dupMode === "skip") {
        showToast("error", "This file was already imported. (Mode: Skip)");
        return;
      }
      showToast("info", "Already imported — will REPLACE on import.");
    }

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

      if (on) {
        displayedItems.forEach((it) => {
          if (it?.alreadyImported && dupMode === "skip") return;
          next.add(it.key);
        });

        if (dupMode === "skip") {
          const skippedDup = displayedItems.filter(
            (it) => it?.alreadyImported,
          ).length;
          if (skippedDup > 0) {
            showToast(
              "info",
              `Skipped ${skippedDup} already-imported file(s) while selecting page (Mode: Skip).`,
            );
          }
        }
      } else {
        displayedItems.forEach((it) => next.delete(it.key));
      }

      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setSelectAllPage(false);
  }

  async function loadMore() {
    if (loading || syncing || importing) return;
    if (items.length >= total) return;

    const nextOff = offset + LIMIT;
    await fetchIndexPage({ reset: false, offsetOverride: nextOff });
  }

  // Infinite scroll (optional)
  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;

    let ticking = false;
    const onScroll = async () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(async () => {
        ticking = false;
        if (loading || syncing || importing) return;
        if (items.length >= total) return;

        const nearBottom =
          el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
        if (!nearBottom) return;

        await loadMore();
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, syncing, importing, items.length, total, offset]);

  async function doImport() {
    if (!selectedCount || importing) return;

    setImporting(true);
    setImportResult(null);
    startProgress(`Importing ${selectedCount} file(s)…`);

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
        mode: dupMode, // skip | replace
      };

      if (String(categoryId || "").trim())
        body.category_id = Number(categoryId);

      const res = await uploadApi.post(`/admin/wasabi/import`, body);
      if (!res?.data?.ok)
        throw new Error(res?.data?.message || "Import failed");

      setImportResult(res.data);

      const imported = Number(res.data.imported || 0);
      const skipped = Number(res.data.skipped || 0);
      const errors = Number(res.data.errors || 0);
      const replaced = Number(res.data.replaced || 0);

      finishProgress(errors > 0 ? "Imported with errors" : "Import complete");

      const extra = replaced ? ` • Replaced: ${replaced}` : "";

      showToast(
        errors > 0 ? "error" : "success",
        errors > 0
          ? `Imported ${imported}. Skipped ${skipped}. Errors ${errors}.${extra}`
          : `Import complete: ${imported} imported${skipped ? `, ${skipped} skipped` : ""}.${extra}`,
        999999,
        {
          sticky: true,
          actions: [
            {
              label: "Continue Import",
              variant: "primary",
              onClick: hideToast,
            },
            {
              label: "Back to Videos",
              variant: "ghost",
              onClick: () => nav("/admin/content/videos"),
            },
          ],
        },
      );

      clearSelection();

      // Refresh current page list to update "Imported" badges
      setItems([]);
      setOffset(0);
      await fetchIndexPage({ reset: true });
    } catch (e) {
      stopProgress();
      const msg = e?.response?.data?.message || e?.message || "Import failed";
      setImportResult({ ok: false, message: msg });

      showToast("error", msg, 999999, {
        sticky: true,
        actions: [
          { label: "Continue Import", variant: "primary", onClick: hideToast },
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

  const canLoadMore = items.length < total;

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
            This screen uses a local index (DB) so search + newest sorting
            always shows everything.
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
              onBlur={() => setPrefix((p) => normalizePrefixInput(p))}
              placeholder="drm"
            />

            <div className="wasabi-actionsRow" style={{ marginTop: 10 }}>
              <button
                className="wasabi-btn wasabi-btn--ghost"
                type="button"
                onClick={syncNow}
                disabled={syncing || importing}
                title="Scan Wasabi and update the DB index"
              >
                {syncing ? "Syncing…" : "Sync from Wasabi"}
              </button>

              <div
                className="wasabi-pill"
                title="Total indexed files for this prefix (last sync)"
              >
                Indexed: {indexStatus?.synced_count ?? "—"}
              </div>

              <div className="wasabi-pill" title="Last sync time">
                Last sync:{" "}
                {indexStatus?.last_sync_at
                  ? new Date(indexStatus.last_sync_at).toLocaleString()
                  : "—"}
              </div>
            </div>

            {indexStatus?.last_error ? (
              <div className="wasabi-error" style={{ marginTop: 10 }}>
                Last sync error: {indexStatus.last_error}
              </div>
            ) : null}
          </div>

          <div className="wasabi-field">
            <label>Search (filename)</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. BRTV-123125_1"
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearchReset();
              }}
            />
            <button
              className="wasabi-btn wasabi-btn--ghost"
              onClick={runSearchReset}
              disabled={loading || syncing}
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

            <div style={{ marginTop: 12 }}>
              <div className="wasabi-miniLabel">Sort by date</div>
              <select
                value={sortByDate}
                onChange={(e) => setSortByDate(e.target.value)}
                disabled={importing}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="wasabi-miniLabel">Show items</div>
              <select
                value={importedFilter}
                onChange={(e) => setImportedFilter(e.target.value)}
                disabled={importing}
              >
                <option value="all">All Wasabi videos</option>
                <option value="not_imported">Not imported only</option>
                <option value="imported">Imported only</option>
              </select>
              <div className="wasabi-hint" style={{ marginTop: 6 }}>
                Imported: <b>{importedCount}</b> • Not imported:{" "}
                <b>{notImportedCount}</b>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="wasabi-miniLabel">
                If the message is already on the site
              </div>
              <select
                value={dupMode}
                onChange={(e) => setDupMode(e.target.value)}
                disabled={importing}
              >
                <option value="skip">Skip (recommended — no duplicates)</option>
                <option value="replace">
                  Re-import into the existing message
                </option>
                <option value="new">Import as new (allow duplicates)</option>
              </select>
              <div className="wasabi-hint" style={{ marginTop: 6 }}>
                A file counts as already on the site when it was imported
                before, or when a message has the same date in its title
                (BRTV-042626 = 4-26-26). Either way, a message whose video
                FAILED gets this file put into it. Skip leaves working messages
                alone; Re-import puts the file into them again (they keep their
                title and details); “Import as new” always creates a new
                message.
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
              Showing: <b>{items.length}</b> / <b>{total}</b> • Imported:{" "}
              <b>{importedCount}</b> • Not imported: <b>{notImportedCount}</b> •
              Selected: <b>{selectedCount}</b>
            </div>

            <button
              className="wasabi-btn wasabi-btn--primary"
              onClick={doImport}
              disabled={!selectedCount || importing}
              type="button"
            >
              {importing
                ? "Importing…"
                : dupMode === "replace"
                  ? "Import / Replace"
                  : "Import Selected"}
            </button>
          </div>
        </div>

        {err ? <div className="wasabi-error">{err}</div> : null}

        <div className="wasabi-tableWrap" ref={tableWrapRef}>
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
              {displayedItems.length === 0 && !loading && !syncing ? (
                <tr>
                  <td colSpan={5} style={{ padding: 18, opacity: 0.8 }}>
                    No MP4 objects found in the index for this prefix.
                    <div style={{ marginTop: 10 }}>
                      Click <b>Sync from Wasabi</b> to build the index.
                    </div>
                  </td>
                </tr>
              ) : null}

              {displayedItems.map((it) => {
                const on = selected.has(it.key);
                const already = it?.alreadyImported === true;

                return (
                  <tr
                    key={it.key}
                    className={`${on ? "is-selected" : ""} ${already ? "is-duplicate" : ""}`}
                    title={already ? "Already imported" : ""}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          toggleKey(it.key, { alreadyImported: already })
                        }
                        disabled={importing || (already && dupMode === "skip")}
                        title={
                          already && dupMode === "skip"
                            ? "Already imported (blocked in Skip mode)"
                            : ""
                        }
                      />
                    </td>
                    <td>
                      <div className="wasabi-file">
                        <div className="wasabi-fileName">
                          {cleanKeyLabel(it.key)}
                          {already ? (
                            <span
                              className="wasabi-pill"
                              style={{ marginLeft: 10 }}
                            >
                              Imported
                            </span>
                          ) : null}
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
            onClick={loadMore}
            disabled={loading || syncing || importing || !canLoadMore}
            type="button"
          >
            {loading
              ? "Loading…"
              : canLoadMore
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
                  Imported: <b>{importResult.imported}</b> • Replaced:{" "}
                  <b>{importResult.replaced || 0}</b> • Skipped:{" "}
                  <b>{importResult.skipped}</b> • Errors:{" "}
                  <b>{importResult.errors}</b>
                </div>
                {importResult.fixed_by_date?.length ? (
                  <div className="wasabi-resultText">
                    Failed messages fixed with their file:{" "}
                    {importResult.fixed_by_date
                      .map((f) => f.message || f.key)
                      .join(" · ")}
                  </div>
                ) : null}
                {importResult.skipped_same_date?.length ? (
                  <div className="wasabi-resultText">
                    Skipped — already on the site (
                    {importResult.skipped_same_date.length}):{" "}
                    {importResult.skipped_same_date
                      .slice(0, 5)
                      .map(
                        (f) =>
                          `${String(f.key).split("/").pop()} → ${f.message || "existing message"}`,
                      )
                      .join(" · ")}
                    {importResult.skipped_same_date.length > 5 ? " …" : ""}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
