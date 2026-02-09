// src/pages/admin/WasabiImporterPage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api";
import "./WasabiImporterPage.css";

function safeStr(v) {
  return (v ?? "").toString();
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function fmtBytes(bytes = 0) {
  const b = Math.max(0, Number(bytes) || 0);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = b;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const digits = i === 0 ? 0 : i === 1 ? 1 : 2;
  return `${n.toFixed(digits)} ${units[i]}`;
}

function Badge({ children, tone = "gray" }) {
  return <span className={`wip-badge wip-${tone}`}>{children}</span>;
}

function Field({ label, children, hint }) {
  return (
    <div className="wip-field">
      <div className="wip-label">{label}</div>
      {children}
      {hint ? <div className="wip-hint">{hint}</div> : null}
    </div>
  );
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div
      className={`wip-toast wip-toast-${toast.type || "info"}`}
      role="status"
    >
      <div className="wip-toast-title">{toast.title || "Notice"}</div>
      {toast.message ? (
        <div className="wip-toast-msg">{toast.message}</div>
      ) : null}
      <button className="wip-toast-x" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}

function ProgressBar({
  label,
  percent = 0,
  tone = "blue",
  indeterminate = false,
}) {
  const p = clamp(Number(percent) || 0, 0, 100);

  const pctText = (() => {
    if (indeterminate) return "";
    if (p >= 100) return "100%";
    return `${p.toFixed(1)}%`;
  })();

  return (
    <div className="wip-progress">
      <div className="wip-progress-top">
        <div className="wip-progress-label">{label}</div>
        {!indeterminate ? (
          <div className="wip-progress-pct">{pctText}</div>
        ) : null}
      </div>
      <div className={`wip-progress-track wip-progress-${tone}`}>
        <div
          className={`wip-progress-fill ${
            indeterminate ? "wip-progress-indeterminate" : ""
          }`}
          style={indeterminate ? undefined : { width: `${p}%` }}
        />
      </div>
    </div>
  );
}

function connConfig(c) {
  return (c && (c.config || c.meta)) || {};
}

function basenameKey(key = "") {
  const s = String(key || "");
  const parts = s.split("/");
  return parts[parts.length - 1] || s;
}

/* -----------------------------
   Selected-run persistence
------------------------------ */
function runPlanKey(jobId) {
  return `wip_runplan_${jobId}`;
}
function runSnapKey(jobId) {
  return `wip_runplan_snapshot_${jobId}`;
}

function saveRunPlan(jobId, plan) {
  try {
    if (!jobId) return;
    if (!plan) {
      localStorage.removeItem(runPlanKey(jobId));
      return;
    }
    localStorage.setItem(runPlanKey(jobId), JSON.stringify(plan));
  } catch {
    // ignore
  }
}

function loadRunPlan(jobId) {
  try {
    if (!jobId) return null;
    const raw = localStorage.getItem(runPlanKey(jobId));
    if (!raw) return null;
    const plan = JSON.parse(raw);
    if (!plan || plan.jobId !== jobId) return null;
    return plan;
  } catch {
    return null;
  }
}

function saveRunSnapshot(jobId, snapshotList) {
  try {
    if (!jobId) return;
    if (!snapshotList) {
      localStorage.removeItem(runSnapKey(jobId));
      return;
    }
    const slim = (snapshotList || []).slice(0, 500).map((x) => ({
      id: x.id,
      status: x.status,
      source_key: x.source_key || "",
      dest_url: x.dest_url || "",
      error: x.error || "",
      updated_at: x.updated_at || null,
      source_size_bytes: x.source_size_bytes || null,
    }));
    localStorage.setItem(runSnapKey(jobId), JSON.stringify(slim));
  } catch {
    // ignore
  }
}

function loadRunSnapshot(jobId) {
  try {
    if (!jobId) return null;
    const raw = localStorage.getItem(runSnapKey(jobId));
    if (!raw) return null;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return null;
    return list;
  } catch {
    return null;
  }
}

export default function WasabiImporterPage() {
  const [toast, setToast] = useState(null);

  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState([]);

  const [categories, setCategories] = useState([]);

  // Wasabi form
  const [wMeta, setWMeta] = useState({
    region: "us-east-1",
    endpoint: "https://s3.us-east-1.wasabisys.com",
    bucket: "",
    import_prefix: "drm",
    access_mode: "auto",
    signed_url_ttl_seconds: 3600,
  });
  const [wSecrets, setWSecrets] = useState({
    accessKeyId: "",
    secretAccessKey: "",
  });

  // Bunny form
  const [bMeta, setBMeta] = useState({
    storage_zone: "",
    host: "ny.storage.bunnycdn.com",
    base_path: "",
    cdn_base_url: "",
  });
  const [bSecrets, setBSecrets] = useState({
    api_key: "",
  });

  // Job
  const [job, setJob] = useState(null);
  const [jobCounts, setJobCounts] = useState(null);
  const [jobLoading, setJobLoading] = useState(false);

  // UI phase flags for progress
  const [scanBusy, setScanBusy] = useState(false);
  const [startBusy, setStartBusy] = useState(false);

  const [jobForm, setJobForm] = useState({
    mode: "remote", // remote | copy_to_bunny
    prefix: "drm",
    visibility: "private", // private | unlisted | public
    category_id: "",
    default_title_mode: "filename_no_ext", // filename_no_ext | filename
  });

  const [scanLimit, setScanLimit] = useState(1000);
  const [scanResult, setScanResult] = useState(null);

  const [items, setItems] = useState([]);
  const [itemsStatus, setItemsStatus] = useState("failed");
  const [itemsLimit, setItemsLimit] = useState(200);

  // Selection (for manual import)
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // When user starts “Start Selected”, we track an explicit run plan
  const [runPlan, setRunPlan] = useState(null);

  // Snapshot of selected items across statuses
  const [selectedSnapshot, setSelectedSnapshot] = useState([]);

  const pollRef = useRef(null);

  // ✅ Poll lock (prevents overlapping refreshJob calls)
  const pollInFlightRef = useRef(false);

  // Toast only once when status transitions
  const prevJobStatusRef = useRef(null);

  // ✅ Long-timeout GET helper (60s) without needing longApi export
  const importerGet = (url, config = {}) =>
    api.get(url, { timeout: 60000, ...config });

  const activeWasabi = useMemo(
    () => connections.find((c) => c.provider === "wasabi"),
    [connections],
  );
  const activeBunny = useMemo(
    () => connections.find((c) => c.provider === "bunny"),
    [connections],
  );

  const wasabiCfg = useMemo(() => connConfig(activeWasabi), [activeWasabi]);
  const bunnyCfg = useMemo(() => connConfig(activeBunny), [activeBunny]);

  function showToast(type, title, message) {
    setToast({ type, title, message });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 4500);
  }

  async function loadConnections() {
    const r = await api.get("/admin/storage/active");
    setConnections(r.data?.connections || []);
  }

  async function loadCategories() {
    try {
      const r = await api.get("/categories");
      setCategories(r.data?.categories || r.data || []);
    } catch {
      setCategories([]);
    }
  }

  async function init() {
    setLoading(true);
    try {
      await Promise.all([loadConnections(), loadCategories()]);
    } catch (e) {
      showToast(
        "error",
        "Load failed",
        e?.response?.data?.message || e?.message || "Server error",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    init();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore runPlan on load / job change
  useEffect(() => {
    if (!job?.id) {
      setRunPlan(null);
      setSelectedSnapshot([]);
      return;
    }

    const restored = loadRunPlan(job.id);
    const cachedSnap = loadRunSnapshot(job.id);

    if (restored) setRunPlan(restored);
    if (cachedSnap?.length) setSelectedSnapshot(cachedSnap);

    if (restored?.ids?.length) {
      refreshSelectedSnapshot(job.id, restored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  // ✅ Poll job while running/scanning (4s) + lock
  useEffect(() => {
    if (!job?.id) return;

    const status = String(job.status || "");
    const shouldPoll = ["running", "scanning"].includes(status);

    if (!shouldPoll) {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;

      const plan = runPlan?.jobId === job.id ? runPlan : loadRunPlan(job.id);
      if (plan?.ids?.length) {
        refreshSelectedSnapshot(job.id, plan);
      }
      return;
    }

    if (pollRef.current) return;

    pollRef.current = window.setInterval(async () => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        await refreshJob(job.id, { silent: true });
      } catch {
        // ignore
      } finally {
        pollInFlightRef.current = false;
      }
    }, 4000);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status]);

  async function testProvider(provider, payload) {
    try {
      const r = await api.post(`/admin/storage/test/${provider}`, payload);
      showToast("success", `${provider} test OK`, `Status: OK`);
      return r.data;
    } catch (e) {
      showToast(
        "error",
        `${provider} test failed`,
        e?.response?.data?.message || e?.message || "Test failed",
      );
      throw e;
    }
  }

  async function connectProvider(provider, payload) {
    try {
      const r = await api.post(`/admin/storage/connect/${provider}`, payload);
      showToast("success", `${provider} connected`, "Connection saved.");
      await loadConnections();
      return r.data;
    } catch (e) {
      showToast(
        "error",
        `${provider} connect failed`,
        e?.response?.data?.message || e?.message || "Connect failed",
      );
      throw e;
    }
  }

  async function disconnectProvider(provider) {
    try {
      await api.post(`/admin/storage/disconnect/${provider}`);
      showToast("success", `${provider} disconnected`, "Connection removed.");
      await loadConnections();
    } catch (e) {
      showToast(
        "error",
        `${provider} disconnect failed`,
        e?.response?.data?.message || e?.message || "Disconnect failed",
      );
    }
  }

  async function createJob() {
    setJobLoading(true);
    try {
      const body = {
        mode: jobForm.mode,
        prefix: jobForm.prefix,
        visibility: jobForm.visibility,
        default_title_mode: jobForm.default_title_mode,
      };

      if (String(jobForm.category_id || "").trim()) {
        body.category_id = Number(jobForm.category_id);
      }

      const r = await api.post("/admin/import-jobs", body);
      setJob(r.data?.job || null);
      prevJobStatusRef.current = r.data?.job?.status || null;

      setScanResult(null);
      setItems([]);
      setSelectedIds(new Set());

      setRunPlan(null);
      setSelectedSnapshot([]);
      saveRunPlan(r.data?.job?.id, null);
      saveRunSnapshot(r.data?.job?.id, null);

      showToast("success", "Job created", `Job #${r.data?.job?.id}`);
      await refreshJob(r.data?.job?.id, { silent: true });
    } catch (e) {
      showToast(
        "error",
        "Create job failed",
        e?.response?.data?.message || e?.message || "Server error",
      );
    } finally {
      setJobLoading(false);
    }
  }

  async function fetchItemsByStatus(jobId, status, limit = 500) {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    qs.set("limit", String(clamp(Number(limit) || 500, 1, 500)));
    const r = await importerGet(
      `/admin/import-jobs/${jobId}/items?${qs.toString()}`,
    );
    return r.data?.items || [];
  }

  // Authoritative fetch for selected IDs
  async function fetchItemsByIds(jobId, ids = []) {
    const clean = (ids || [])
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n))
      .map((n) => Math.trunc(n))
      .filter((n) => n > 0)
      .slice(0, 500);

    if (!jobId || !clean.length) return [];

    const qs = new URLSearchParams();
    qs.set("ids", clean.join(","));
    const r = await importerGet(
      `/admin/import-jobs/${jobId}/items/by-ids?${qs.toString()}`,
    );
    return r.data?.items || [];
  }

  async function refreshSelectedSnapshot(jobId, plan) {
    if (!jobId || !plan?.ids?.length) {
      setSelectedSnapshot([]);
      saveRunSnapshot(jobId, null);
      return;
    }

    const ids = plan.ids.slice(0, 200);
    const idSet = new Set(ids);

    const cached = loadRunSnapshot(jobId) || [];
    const cachedById = new Map(cached.map((x) => [x.id, x]));

    const isTerminal = (s) =>
      ["completed", "failed", "skipped"].includes(String(s || ""));

    try {
      const direct = await fetchItemsByIds(jobId, ids);

      if (Array.isArray(direct) && direct.length) {
        const byId = new Map();

        for (const it of cached || []) {
          if (it?.id && idSet.has(it.id)) byId.set(it.id, it);
        }

        for (const it of direct) {
          if (!it?.id || !idSet.has(it.id)) continue;
          const prev = byId.get(it.id) || cachedById.get(it.id);
          const prevStatus = String(prev?.status || "");
          const nextStatus = String(it.status || "");
          if (prev && isTerminal(prevStatus) && !isTerminal(nextStatus))
            continue;
          byId.set(it.id, it);
        }

        const merged = ids
          .map((id) => byId.get(id) || { id, status: "queued", source_key: "" })
          .filter(Boolean);

        setSelectedSnapshot(merged);
        saveRunSnapshot(jobId, merged);

        // keep runPlan.bytesTotal accurate (frontend authoritative)
        if (plan?.jobId === jobId) {
          const bytesTotal = merged.reduce(
            (sum, it) => sum + (Number(it.source_size_bytes) || 0),
            0,
          );
          const nextPlan = { ...plan, bytesTotal };
          setRunPlan(nextPlan);
          saveRunPlan(jobId, nextPlan);
        }

        return;
      }
    } catch {
      // ignore; fallback below
    }

    // fallback (older behavior)
    const statuses = [
      "importing",
      "copying",
      "validating",
      "queued",
      "retrying",
      "completed",
      "failed",
      "skipped",
    ];

    const rank = (s) => {
      if (s === "importing") return 1;
      if (s === "copying") return 2;
      if (s === "validating") return 3;
      if (s === "retrying") return 4;
      if (s === "queued") return 5;
      if (s === "failed") return 6;
      if (s === "skipped") return 7;
      if (s === "completed") return 8;
      return 99;
    };

    try {
      const lists = await Promise.all(
        statuses.map((st) => fetchItemsByStatus(jobId, st, 500)),
      );
      const byId = new Map();

      for (const it of cached || []) {
        if (!it?.id) continue;
        if (!idSet.has(it.id)) continue;
        byId.set(it.id, it);
      }

      for (const list of lists) {
        for (const it of list || []) {
          if (!it?.id) continue;
          if (!idSet.has(it.id)) continue;

          const prev = byId.get(it.id) || cachedById.get(it.id);
          if (!prev) {
            byId.set(it.id, it);
            continue;
          }

          const prevStatus = String(prev.status || "");
          const nextStatus = String(it.status || "");

          if (isTerminal(prevStatus) && !isTerminal(nextStatus)) continue;

          if (rank(nextStatus) < rank(prevStatus)) byId.set(it.id, it);
          else if (isTerminal(nextStatus) && !isTerminal(prevStatus))
            byId.set(it.id, it);
        }
      }

      const merged = ids
        .map((id) => byId.get(id) || { id, status: "queued", source_key: "" })
        .filter(Boolean);

      setSelectedSnapshot(merged);
      saveRunSnapshot(jobId, merged);

      if (plan?.jobId === jobId) {
        const bytesTotal = merged.reduce(
          (sum, it) => sum + (Number(it.source_size_bytes) || 0),
          0,
        );
        const nextPlan = { ...plan, bytesTotal };
        setRunPlan(nextPlan);
        saveRunPlan(jobId, nextPlan);
      }
    } catch {
      const fallback = selectedSnapshot?.length
        ? selectedSnapshot
        : cached?.length
          ? cached
          : ids.map((id) => ({ id, status: "queued", source_key: "" }));
      setSelectedSnapshot(fallback);
      saveRunSnapshot(jobId, fallback);
    }
  }

  async function refreshJob(jobId, { silent = false } = {}) {
    if (!jobId) return;

    const r = await importerGet(`/admin/import-jobs/${jobId}`);
    const nextJob = r.data?.job || null;

    const prev = prevJobStatusRef.current;
    const next = nextJob?.status || null;
    prevJobStatusRef.current = next;

    if (prev && prev !== next) {
      if (next === "completed") {
        showToast(
          "success",
          "Import completed",
          `Job #${jobId} finished successfully.`,
        );
      } else if (next === "failed") {
        showToast(
          "error",
          "Import failed",
          nextJob?.last_error
            ? safeStr(nextJob.last_error)
            : `Job #${jobId} failed.`,
        );
      } else if (next === "canceled") {
        showToast("info", "Import canceled", `Job #${jobId} canceled.`);
      }
    }

    setJob(nextJob);
    setJobCounts(r.data?.counts || null);

    // ✅ Stop auto-load items while running/scanning
    const st = String(nextJob?.status || "");
    const canAutoLoadItems =
      nextJob && ["failed", "completed", "ready", "paused"].includes(st);

    if (canAutoLoadItems) {
      await loadItems(jobId, { silent: true });
    }

    const plan = runPlan?.jobId === jobId ? runPlan : loadRunPlan(jobId);
    if (plan?.ids?.length) {
      if (["canceled"].includes(st)) {
        setRunPlan(null);
        setSelectedSnapshot([]);
        saveRunPlan(jobId, null);
        saveRunSnapshot(jobId, null);
      } else {
        // If restored plan is missing baselines, fill them from current job totals
        if (
          plan &&
          (plan.baseJobBytesCopied == null || plan.baseJobBytesTotal == null)
        ) {
          const baseJobBytesCopied = Number(nextJob?.totals?.bytes_copied || 0);
          const baseJobBytesTotal = Number(nextJob?.totals?.bytes_total || 0);
          const patched = { ...plan, baseJobBytesCopied, baseJobBytesTotal };
          setRunPlan(patched);
          saveRunPlan(jobId, patched);
        }

        await refreshSelectedSnapshot(jobId, plan);
      }
    }

    if (!silent) showToast("success", "Refreshed", `Job #${jobId} updated`);
  }

  async function scanJob() {
    if (!job?.id) return showToast("error", "No job", "Create a job first.");
    setJobLoading(true);
    setScanBusy(true);
    try {
      const body = {
        prefix: jobForm.prefix,
        limit: clamp(Number(scanLimit) || 1000, 1, 1000),
      };
      const r = await api.post(`/admin/import-jobs/${job.id}/scan`, body);

      setScanResult(r.data || null);
      showToast(
        "success",
        "Scan complete",
        `Inserted: ${r.data?.inserted ?? 0}`,
      );

      await refreshJob(job.id, { silent: true });

      setItemsStatus("queued");
      await loadItems(job.id, { silent: true, nextStatus: "queued" });
    } catch (e) {
      showToast(
        "error",
        "Scan failed",
        e?.response?.data?.message || e?.message || "Server error",
      );
    } finally {
      setScanBusy(false);
      setJobLoading(false);
    }
  }

  async function startJob() {
    if (!job?.id) return showToast("error", "No job", "Create a job first.");
    setJobLoading(true);
    setStartBusy(true);
    try {
      setRunPlan(null);
      setSelectedSnapshot([]);
      saveRunPlan(job.id, null);
      saveRunSnapshot(job.id, null);

      await api.post(`/admin/import-jobs/${job.id}/start`);
      showToast("success", "Job started", `Job #${job.id} running`);
      await refreshJob(job.id, { silent: true });
    } catch (e) {
      showToast(
        "error",
        "Start failed",
        e?.response?.data?.message || e?.message || "Server error",
      );
    } finally {
      setStartBusy(false);
      setJobLoading(false);
    }
  }

  async function startSelected() {
    if (!job?.id) return showToast("error", "No job", "Create a job first.");

    const ids = Array.from(selectedIds || [])
      .map((n) => Number(n))
      .filter(Boolean);

    if (!ids.length)
      return showToast("error", "No selection", "Select at least 1 file.");

    setJobLoading(true);
    setStartBusy(true);
    try {
      // Baseline job bytes so progress is accurate even if job ran before
      const baseJobBytesCopied = Number(job?.totals?.bytes_copied || 0);
      const baseJobBytesTotal = Number(job?.totals?.bytes_total || 0);

      // Compute selected bytesTotal on the frontend
      let bytesTotal = 0;
      try {
        const selectedItems = await fetchItemsByIds(job.id, ids);
        bytesTotal = (selectedItems || []).reduce(
          (sum, it) => sum + (Number(it?.source_size_bytes) || 0),
          0,
        );

        // Prime snapshot with actual rows
        if (selectedItems?.length) {
          setSelectedSnapshot(selectedItems);
          saveRunSnapshot(job.id, selectedItems);
        } else {
          const primed = ids.map((id) => ({
            id,
            status: "queued",
            source_key: "",
          }));
          setSelectedSnapshot(primed);
          saveRunSnapshot(job.id, primed);
        }
      } catch {
        const primed = ids.map((id) => ({
          id,
          status: "queued",
          source_key: "",
        }));
        setSelectedSnapshot(primed);
        saveRunSnapshot(job.id, primed);
      }

      const plan = {
        jobId: job.id,
        total: ids.length,
        ids,
        startedAt: Date.now(),
        mode: jobForm.mode,
        bytesTotal,
        baseJobBytesCopied,
        baseJobBytesTotal,
      };

      setRunPlan(plan);
      saveRunPlan(job.id, plan);

      await api.post(`/admin/import-jobs/${job.id}/start`, { item_ids: ids });
      showToast("success", "Job started", `Selected: ${ids.length}`);

      await refreshSelectedSnapshot(job.id, plan);
      await refreshJob(job.id, { silent: true });
    } catch (e) {
      showToast(
        "error",
        "Start selected failed",
        e?.response?.data?.message || e?.message || "Server error",
      );
    } finally {
      setStartBusy(false);
      setJobLoading(false);
    }
  }

  async function pauseJob() {
    if (!job?.id) return;
    setJobLoading(true);
    try {
      await api.post(`/admin/import-jobs/${job.id}/pause`);
      showToast("success", "Paused", `Job #${job.id} paused`);
      await refreshJob(job.id, { silent: true });
    } catch (e) {
      showToast(
        "error",
        "Pause failed",
        e?.response?.data?.message || e?.message || "Server error",
      );
    } finally {
      setJobLoading(false);
    }
  }

  async function cancelJob() {
    if (!job?.id) return;
    setJobLoading(true);
    try {
      await api.post(`/admin/import-jobs/${job.id}/cancel`);
      showToast("success", "Canceled", `Job #${job.id} canceled`);

      setRunPlan(null);
      setSelectedSnapshot([]);
      saveRunPlan(job.id, null);
      saveRunSnapshot(job.id, null);

      await refreshJob(job.id, { silent: true });
    } catch (e) {
      showToast(
        "error",
        "Cancel failed",
        e?.response?.data?.message || e?.message || "Server error",
      );
    } finally {
      setJobLoading(false);
    }
  }

  async function loadItems(jobId, { silent = false, nextStatus = null } = {}) {
    if (!jobId) return;
    try {
      const qs = new URLSearchParams();
      const st = nextStatus ?? itemsStatus;
      if (st) qs.set("status", st);
      qs.set("limit", String(clamp(Number(itemsLimit) || 200, 1, 500)));

      const r = await importerGet(
        `/admin/import-jobs/${jobId}/items?${qs.toString()}`,
      );
      const nextItems = r.data?.items || [];
      setItems(nextItems);

      if (String(st) === "queued") {
        setSelectedIds(new Set(nextItems.map((x) => x.id).filter(Boolean)));
      } else {
        setSelectedIds((prev) => {
          const keep = new Set();
          const idsInList = new Set(nextItems.map((x) => x.id));
          (prev || new Set()).forEach((id) => {
            if (idsInList.has(id)) keep.add(id);
          });
          return keep;
        });
      }

      if (!silent) {
        showToast(
          "success",
          "Items loaded",
          `Showing ${r.data?.items?.length ?? 0}`,
        );
      }
    } catch (e) {
      if (!silent) {
        showToast(
          "error",
          "Load items failed",
          e?.response?.data?.message || e?.message || "Server error",
        );
      }
    }
  }

  function canCreateCopyToBunny() {
    if (jobForm.mode !== "copy_to_bunny") return true;
    return !!activeBunny;
  }

  const allVisibleIds = useMemo(
    () => (items || []).map((x) => x.id).filter(Boolean),
    [items],
  );

  const allVisibleSelected = useMemo(() => {
    if (!allVisibleIds.length) return false;
    for (const id of allVisibleIds) {
      if (!selectedIds.has(id)) return false;
    }
    return true;
  }, [allVisibleIds, selectedIds]);

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev || []);
      if (allVisibleSelected) {
        allVisibleIds.forEach((id) => next.delete(id));
      } else {
        allVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function selectNoneVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev || []);
      allVisibleIds.forEach((id) => next.delete(id));
      return next;
    });
  }

  function toggleRow(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev || []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelectedProgress() {
    if (!job?.id) return;
    setRunPlan(null);
    setSelectedSnapshot([]);
    saveRunPlan(job.id, null);
    saveRunSnapshot(job.id, null);
    showToast("info", "Cleared", "Selected progress cleared for this job.");
  }

  const jobProgressInfo = useMemo(() => {
    const completed = Number(
      jobCounts?.completed ?? job?.totals?.completed ?? 0,
    );
    const failed = Number(jobCounts?.failed ?? job?.totals?.failed ?? 0);
    const skipped = Number(jobCounts?.skipped ?? job?.totals?.skipped ?? 0);
    const pending = Number(jobCounts?.pending ?? 0);

    const total = Math.max(0, completed + failed + skipped + pending);
    const done = Math.max(0, completed + failed + skipped);

    const status = String(job?.status || "");
    let percent = total > 0 ? (done / total) * 100 : 0;

    if (status !== "completed") percent = Math.min(percent, 99.9);
    else if (total > 0) percent = 100;

    return { completed, failed, skipped, pending, total, done, percent };
  }, [jobCounts, job]);

  const selectedProgressInfo = useMemo(() => {
    if (!runPlan?.ids?.length || runPlan.jobId !== job?.id) return null;

    const total = Number(runPlan.total || runPlan.ids.length || 0);
    const terminals = new Set(["completed", "failed", "skipped"]);
    const activeOrder = [
      "importing",
      "copying",
      "validating",
      "retrying",
      "queued",
    ];

    const byId = new Map((selectedSnapshot || []).map((x) => [x.id, x]));
    const list = runPlan.ids.map((id) => byId.get(id)).filter(Boolean);

    const done = list.filter((x) => terminals.has(String(x.status))).length;

    let current = null;
    for (const st of activeOrder) {
      current = list.find((x) => String(x.status) === st);
      if (current) break;
    }

    const remaining = Math.max(0, total - done);
    let percent = total > 0 ? (done / total) * 100 : 0;

    if (total > 0 && done >= total) percent = 100;
    else percent = clamp(percent, 0, 99.9);

    // selected bytes progress (copy_to_bunny only)
    const bytesTotal = Math.max(0, Number(runPlan.bytesTotal || 0));
    const baseCopied = Math.max(0, Number(runPlan.baseJobBytesCopied || 0));
    const baseTotal = Math.max(0, Number(runPlan.baseJobBytesTotal || 0));
    const jobBytesCopied = Math.max(0, Number(job?.totals?.bytes_copied || 0));
    const jobBytesTotal = Math.max(0, Number(job?.totals?.bytes_total || 0));

    const selBytesCopied = Math.max(0, jobBytesCopied - baseCopied);
    const selBytesTotal =
      bytesTotal > 0 ? bytesTotal : Math.max(0, jobBytesTotal - baseTotal);

    const bytesPercent =
      selBytesTotal > 0
        ? clamp((selBytesCopied / selBytesTotal) * 100, 0, 99.9)
        : 0;

    const bytesDone = selBytesTotal > 0 && selBytesCopied >= selBytesTotal;
    const bytesPctFinal =
      selBytesTotal > 0 && done >= total && bytesDone ? 100 : bytesPercent;

    return {
      total,
      done,
      remaining,
      percent,
      current,
      bytes: {
        bytesTotal: selBytesTotal,
        bytesCopied: selBytesCopied,
        percent: selBytesTotal > 0 ? (bytesDone ? 100 : bytesPctFinal) : null,
      },
    };
  }, [runPlan, selectedSnapshot, job?.id, job?.totals]);

  const showImportProgress =
    Boolean(job?.id) &&
    ["running", "paused", "failed", "completed"].includes(String(job?.status));

  const importIndeterminate =
    Boolean(job?.id) &&
    ["running"].includes(String(job?.status)) &&
    jobProgressInfo.total === 0;

  const destinationText = useMemo(() => {
    const mode = String(job?.mode || jobForm.mode || "");
    if (mode === "copy_to_bunny") {
      const host = safeStr(bunnyCfg.host || "bunny storage");
      const zone = safeStr(bunnyCfg.storage_zone || "");
      const base = safeStr(bunnyCfg.base_path || "");
      const cdn = safeStr(bunnyCfg.cdn_base_url || "");
      const parts = [];
      if (zone) parts.push(zone);
      if (host) parts.push(`@ ${host}`);
      if (base) parts.push(`/${base.replace(/^\//, "")}`);
      const main = parts.filter(Boolean).join(" ");
      if (cdn) return `${main} (CDN: ${cdn})`;
      return main || "Bunny Storage";
    }
    const bucket = safeStr(wasabiCfg.bucket || "");
    const ep = safeStr(wasabiCfg.endpoint || "");
    if (bucket && ep) return `Wasabi (${bucket} @ ${ep})`;
    if (bucket) return `Wasabi (${bucket})`;
    return "Wasabi (remote URLs)";
  }, [job?.mode, jobForm.mode, bunnyCfg, wasabiCfg]);

  return (
    <div className="wip-wrap">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="wip-header">
        <div>
          <h1 className="wip-title">Wasabi Importer</h1>
          <div className="wip-sub">
            Connect storage, create an import job, scan a prefix, and run
            imports (remote or copy-to-bunny).
          </div>
        </div>

        <div className="wip-actions">
          <button
            className="wip-btn"
            onClick={init}
            disabled={loading}
            type="button"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Connections */}
      <div className="wip-grid">
        {/* Wasabi */}
        <section className="wip-card">
          <div className="wip-card-head">
            <div className="wip-card-title">
              Wasabi Connection{" "}
              {activeWasabi ? (
                <Badge tone="green">Active</Badge>
              ) : (
                <Badge tone="gray">Not Connected</Badge>
              )}
            </div>
            <div className="wip-card-right">
              {activeWasabi ? (
                <button
                  type="button"
                  className="wip-btn wip-danger"
                  onClick={() => disconnectProvider("wasabi")}
                >
                  Disconnect
                </button>
              ) : null}
            </div>
          </div>

          {activeWasabi ? (
            <div className="wip-kv">
              <div>
                <div className="wip-k">Bucket</div>
                <div className="wip-v">{safeStr(wasabiCfg.bucket)}</div>
              </div>
              <div>
                <div className="wip-k">Endpoint</div>
                <div className="wip-v">{safeStr(wasabiCfg.endpoint)}</div>
              </div>
              <div>
                <div className="wip-k">Region</div>
                <div className="wip-v">{safeStr(wasabiCfg.region)}</div>
              </div>
              <div>
                <div className="wip-k">Import Prefix</div>
                <div className="wip-v">
                  {safeStr(wasabiCfg.import_prefix || "")}
                </div>
              </div>
              <div>
                <div className="wip-k">Access Mode</div>
                <div className="wip-v">
                  {safeStr(wasabiCfg.access_mode || "auto")}
                </div>
              </div>
              <div>
                <div className="wip-k">Signed TTL</div>
                <div className="wip-v">
                  {safeStr(wasabiCfg.signed_url_ttl_seconds || 3600)} sec
                </div>
              </div>
            </div>
          ) : null}

          {/* ✅ Wrap credential inputs in a form so Chrome password manager warnings stop */}
          <form
            className="wip-form"
            onSubmit={(e) => e.preventDefault()}
            autoComplete="on"
          >
            <Field
              label="WASABI_REGION"
              hint="Usually us-east-1 unless your bucket differs."
            >
              <input
                value={wMeta.region}
                onChange={(e) =>
                  setWMeta((s) => ({ ...s, region: e.target.value }))
                }
              />
            </Field>

            <Field
              label="WASABI_ENDPOINT"
              hint="Example: https://s3.us-east-1.wasabisys.com"
            >
              <input
                value={wMeta.endpoint}
                onChange={(e) =>
                  setWMeta((s) => ({ ...s, endpoint: e.target.value }))
                }
              />
            </Field>

            <Field label="WASABI_BUCKET" hint="Bucket name only (no slashes).">
              <input
                value={wMeta.bucket}
                onChange={(e) =>
                  setWMeta((s) => ({ ...s, bucket: e.target.value }))
                }
              />
            </Field>

            <Field
              label="WASABI_IMPORT_PREFIX (optional)"
              hint="Example: drm (we normalize to drm/)."
            >
              <input
                value={wMeta.import_prefix}
                onChange={(e) =>
                  setWMeta((s) => ({ ...s, import_prefix: e.target.value }))
                }
              />
            </Field>

            <div className="wip-row2">
              <Field
                label="access_mode"
                hint="auto = public/unlisted direct, private signed at playtime."
              >
                <select
                  value={wMeta.access_mode}
                  onChange={(e) =>
                    setWMeta((s) => ({ ...s, access_mode: e.target.value }))
                  }
                >
                  <option value="auto">auto</option>
                  <option value="public">public</option>
                  <option value="private">private</option>
                </select>
              </Field>

              <Field
                label="signed_url_ttl_seconds"
                hint="For private playback. 60–86400 seconds."
              >
                <input
                  type="number"
                  value={wMeta.signed_url_ttl_seconds}
                  onChange={(e) =>
                    setWMeta((s) => ({
                      ...s,
                      signed_url_ttl_seconds: e.target.value,
                    }))
                  }
                />
              </Field>
            </div>

            <Field label="WASABI_ACCESS_KEY_ID">
              <input
                value={wSecrets.accessKeyId}
                onChange={(e) =>
                  setWSecrets((s) => ({ ...s, accessKeyId: e.target.value }))
                }
                autoComplete="off"
              />
            </Field>

            <Field label="WASABI_SECRET_ACCESS_KEY">
              <input
                type="password"
                value={wSecrets.secretAccessKey}
                onChange={(e) =>
                  setWSecrets((s) => ({
                    ...s,
                    secretAccessKey: e.target.value,
                  }))
                }
                autoComplete="new-password"
              />
            </Field>

            <div className="wip-buttons">
              <button
                type="button"
                className="wip-btn"
                onClick={() =>
                  testProvider("wasabi", { meta: wMeta, secrets: wSecrets })
                }
              >
                Test Wasabi
              </button>
              <button
                type="button"
                className="wip-btn wip-primary"
                onClick={() =>
                  connectProvider("wasabi", { meta: wMeta, secrets: wSecrets })
                }
              >
                Connect Wasabi
              </button>
            </div>
          </form>
        </section>

        {/* Bunny */}
        <section className="wip-card">
          <div className="wip-card-head">
            <div className="wip-card-title">
              Bunny Connection{" "}
              {activeBunny ? (
                <Badge tone="green">Active</Badge>
              ) : (
                <Badge tone="gray">Not Connected</Badge>
              )}
            </div>
            <div className="wip-card-right">
              {activeBunny ? (
                <button
                  type="button"
                  className="wip-btn wip-danger"
                  onClick={() => disconnectProvider("bunny")}
                >
                  Disconnect
                </button>
              ) : null}
            </div>
          </div>

          {activeBunny ? (
            <div className="wip-kv">
              <div>
                <div className="wip-k">Zone</div>
                <div className="wip-v">{safeStr(bunnyCfg.storage_zone)}</div>
              </div>
              <div>
                <div className="wip-k">Host</div>
                <div className="wip-v">{safeStr(bunnyCfg.host)}</div>
              </div>
              <div>
                <div className="wip-k">Base Path</div>
                <div className="wip-v">{safeStr(bunnyCfg.base_path)}</div>
              </div>
              <div>
                <div className="wip-k">CDN Base URL</div>
                <div className="wip-v">
                  {safeStr(bunnyCfg.cdn_base_url || "")}
                </div>
              </div>
            </div>
          ) : null}

          {/* ✅ Wrap password in a form as well */}
          <form
            className="wip-form"
            onSubmit={(e) => e.preventDefault()}
            autoComplete="on"
          >
            <Field
              label="BUNNY_STORAGE_ZONE"
              hint="Storage zone name (username)."
            >
              <input
                value={bMeta.storage_zone}
                onChange={(e) =>
                  setBMeta((s) => ({ ...s, storage_zone: e.target.value }))
                }
              />
            </Field>

            <Field
              label="BUNNY_STORAGE_HOST"
              hint="Example: ny.storage.bunnycdn.com"
            >
              <input
                value={bMeta.host}
                onChange={(e) =>
                  setBMeta((s) => ({ ...s, host: e.target.value }))
                }
              />
            </Field>

            <Field
              label="BUNNY_STORAGE_BASE_PATH"
              hint="Example: bishoprobertsontv/videos/archives/u_33"
            >
              <input
                value={bMeta.base_path}
                onChange={(e) =>
                  setBMeta((s) => ({ ...s, base_path: e.target.value }))
                }
              />
            </Field>

            <Field
              label="BUNNY_CDN_BASE_URL (optional)"
              hint="Example: https://xxx.b-cdn.net"
            >
              <input
                value={bMeta.cdn_base_url}
                onChange={(e) =>
                  setBMeta((s) => ({ ...s, cdn_base_url: e.target.value }))
                }
              />
            </Field>

            <Field
              label="BUNNY_STORAGE_API_KEY"
              hint="Storage password / AccessKey (keep private)."
            >
              <input
                type="password"
                value={bSecrets.api_key}
                onChange={(e) =>
                  setBSecrets((s) => ({ ...s, api_key: e.target.value }))
                }
                autoComplete="new-password"
              />
            </Field>

            <div className="wip-buttons">
              <button
                type="button"
                className="wip-btn"
                onClick={() =>
                  testProvider("bunny", { meta: bMeta, secrets: bSecrets })
                }
              >
                Test Bunny
              </button>
              <button
                type="button"
                className="wip-btn wip-primary"
                onClick={() =>
                  connectProvider("bunny", { meta: bMeta, secrets: bSecrets })
                }
              >
                Connect Bunny
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Import Job */}
      <section className="wip-card">
        {/* --- the rest of your file is unchanged --- */}
        {/* Keep everything below exactly as you already had it */}
        {/* (I did not touch job logic / table / progress, etc.) */}

        {/* ...PASTE YOUR EXISTING "Import Job" section and below here... */}
      </section>
    </div>
  );
}
