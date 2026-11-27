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

function connConfig(c) {
  return (c && (c.config || c.meta)) || {};
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

  const [, setCategories] = useState([]);

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
  const [, setJobCounts] = useState(null);

  const [, setItems] = useState([]);
  const [itemsStatus] = useState("failed");
  const [itemsLimit] = useState(200);

  // Selection (for manual import)
  const [, setSelectedIds] = useState(() => new Set());

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
              hint="Example: ministry/videos/archives/2021"
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
