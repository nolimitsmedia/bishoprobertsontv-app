// src/pages/admin/CloudStoragePage.js — Cloud Storage (replaces the old Wasabi importer)
// Connect the customer's own Bunny Stream library and any cloud storage
// (alphabetical list), browse video files and import them into Bunny Stream.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import "./CloudStorage.css";
import { confirmDialog } from "../../components/ui/Dialogs";

const fmtSize = (n) => {
  const b = Number(n) || 0;
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(2)} GB`;
  if (b >= 1048576) return `${(b / 1048576).toFixed(0)} MB`;
  return b ? `${Math.max(1, Math.round(b / 1024))} KB` : "";
};
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
const errText = (e, fallback) => e?.response?.data?.message || fallback;

function BunnyCard({ notify }) {
  const [st, setSt] = useState(null);
  const [form, setForm] = useState({
    library_id: "",
    api_key: "",
    cdn_host: "",
  });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/cloud-storage/bunny");
      setSt(data);
      setForm((f) => ({
        ...f,
        library_id: data.library_id || "",
        cdn_host: data.source === "connected" ? data.cdn_host || "" : "",
      }));
    } catch {
      setSt({ source: "none" });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put("/admin/cloud-storage/bunny", form);
      setSt(data);
      setForm((f) => ({ ...f, api_key: "" }));
      notify(
        "success",
        "Bunny Stream library connected. New uploads and imports use it now.",
      );
    } catch (err) {
      notify("error", errText(err, "Could not connect Bunny Stream."));
    } finally {
      setBusy(false);
    }
  }
  async function useServer() {
    if (
      !(await confirmDialog(
        "Stop using this Bunny library and go back to the server settings?",
      ))
    )
      return;
    try {
      const { data } = await api.delete("/admin/cloud-storage/bunny");
      setSt(data);
      notify("success", "Using the server's Bunny settings again.");
    } catch (err) {
      notify("error", errText(err, "Could not change the Bunny settings."));
    }
  }
  const label =
    st?.source === "connected"
      ? "Connected here"
      : st?.source === "server"
        ? "Using server settings"
        : "Not connected";
  return (
    <section className="cs-card" aria-labelledby="cs-bunny-h">
      <div className="cs-cardHead">
        <h2 id="cs-bunny-h">Bunny Stream</h2>
        <span
          className={`cs-pill ${st?.source === "none" ? "is-off" : "is-on"}`}
        >
          {st ? label : "…"}
        </span>
      </div>
      <p className="cs-hint">
        Where imported videos are stored and played. Paste your own Bunny Stream
        library (Bunny › Stream › your library › API).
        {st?.library_id
          ? ` Library ${st.library_id}${st.api_key ? ` · key ${st.api_key}` : ""}${st.cdn_host ? ` · ${st.cdn_host}` : ""}.`
          : ""}
      </p>
      <form className="cs-grid3" onSubmit={save}>
        <label className="cs-field">
          <span>Library ID</span>
          <input
            value={form.library_id}
            onChange={(e) => setForm({ ...form, library_id: e.target.value })}
            placeholder="e.g. 653405"
            inputMode="numeric"
          />
        </label>
        <label className="cs-field">
          <span>
            API key {st?.source === "connected" ? "(leave blank to keep)" : ""}
          </span>
          <input
            type="password"
            autoComplete="off"
            value={form.api_key}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            placeholder="Library API key"
          />
        </label>
        <label className="cs-field">
          <span>Delivery hostname (optional)</span>
          <input
            value={form.cdn_host}
            onChange={(e) => setForm({ ...form, cdn_host: e.target.value })}
            placeholder="vz-xxxx.b-cdn.net"
          />
        </label>
        <div className="cs-row">
          <button className="cs-btn" disabled={busy}>
            {busy ? "Testing…" : "Save & test"}
          </button>
          {st?.source === "connected" ? (
            <button
              type="button"
              className="cs-btn cs-btn--ghost"
              onClick={useServer}
            >
              Use server settings
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function ConnectionForm({ provider, connection, onDone, onCancel, notify }) {
  const [name, setName] = useState(connection?.name || provider.name);
  const [fields, setFields] = useState(() => {
    const f = {};
    for (const d of provider.fields)
      f[d.name] = d.secret
        ? ""
        : (connection?.fields?.[d.name] ?? provider.defaults?.[d.name] ?? "");
    return f;
  });
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { provider: provider.id, name, fields };
      const { data } = connection
        ? await api.put(
            `/admin/cloud-storage/connections/${connection.id}`,
            body,
          )
        : await api.post("/admin/cloud-storage/connections", body);
      notify("success", `${data.connection.name} connected.`);
      onDone(data.connection);
    } catch (err) {
      notify("error", errText(err, "Could not connect."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="cs-card cs-form"
      onSubmit={submit}
      aria-label={`Connect ${provider.name}`}
    >
      <div className="cs-cardHead">
        <h3>
          {connection ? `Edit ${connection.name}` : `Connect ${provider.name}`}
        </h3>
      </div>
      {provider.help ? <p className="cs-hint">{provider.help}</p> : null}
      <div className="cs-grid2">
        <label className="cs-field">
          <span>Name on this page</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {provider.fields.map((d) => (
          <label key={d.name} className="cs-field">
            <span>
              {d.label}
              {d.required ? " *" : ""}
              {d.secret && connection
                ? ` (saved ${connection.fields?.[d.name] || ""} — leave blank to keep)`
                : ""}
            </span>
            <input
              type={d.secret ? "password" : "text"}
              autoComplete="off"
              value={fields[d.name]}
              placeholder={d.placeholder || ""}
              onChange={(e) =>
                setFields({ ...fields, [d.name]: e.target.value })
              }
            />
          </label>
        ))}
      </div>
      <p className="cs-hint">
        Keys are stored encrypted and never shown again. Read-only access is
        enough.
      </p>
      <div className="cs-row">
        <button className="cs-btn" disabled={busy}>
          {busy ? "Testing…" : connection ? "Save & test" : "Connect"}
        </button>
        <button
          type="button"
          className="cs-btn cs-btn--ghost"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Browser({ connection, notify, onImported, onClose }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [cats, setCats] = useState([]);
  const [opts, setOpts] = useState({ category_id: "", visibility: "private" });
  const [importing, setImporting] = useState(false);
  const load = useCallback(
    async (more = false, search = q) => {
      setLoading(true);
      try {
        const { data } = await api.get(
          `/admin/cloud-storage/connections/${connection.id}/files`,
          {
            params: {
              q: search || undefined,
              cursor: more ? cursor : undefined,
            },
          },
        );
        setItems((cur) =>
          more ? [...cur, ...(data.items || [])] : data.items || [],
        );
        setCursor(data.cursor || null);
      } catch (err) {
        notify("error", errText(err, "Could not list the files."));
      } finally {
        setLoading(false);
      }
    },
    [connection.id, cursor, q, notify],
  );
  useEffect(() => {
    load(false, "");
    api
      .get("/categories")
      .then(({ data }) =>
        setCats(Array.isArray(data) ? data : data?.items || []),
      )
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.id]);
  const toggle = (k) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  async function doImport() {
    setImporting(true);
    try {
      const { data } = await api.post(
        `/admin/cloud-storage/connections/${connection.id}/import`,
        { keys: [...sel], ...opts },
      );
      notify(
        data.failed ? "error" : "success",
        `Started ${data.started} import${data.started === 1 ? "" : "s"}${data.failed ? ` · ${data.failed} failed (see history)` : ""}. They appear in Videos as unpublished messages.`,
      );
      setSel(new Set());
      onImported();
      load(false);
    } catch (err) {
      notify("error", errText(err, "Import failed."));
    } finally {
      setImporting(false);
    }
  }
  return (
    <section className="cs-card" aria-labelledby="cs-browse-h">
      <div className="cs-cardHead">
        <h2 id="cs-browse-h">Files in {connection.name}</h2>
        <button
          type="button"
          className="cs-btn cs-btn--ghost"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <form
        className="cs-row"
        onSubmit={(e) => {
          e.preventDefault();
          load(false);
        }}
      >
        <label className="cs-sr" htmlFor="cs-q">
          Search files
        </label>
        <input
          id="cs-q"
          className="cs-input"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by file name…"
        />
        <button className="cs-btn cs-btn--ghost" disabled={loading}>
          {loading ? "Loading…" : "Search"}
        </button>
      </form>
      <div className="cs-tableWrap">
        <table className="cs-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="cs-sr">Select</span>
              </th>
              <th scope="col">File</th>
              <th scope="col">Size</th>
              <th scope="col">Modified</th>
            </tr>
          </thead>
          <tbody>
            {items.map((f) => (
              <tr key={f.key}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${f.name}`}
                    checked={sel.has(f.key)}
                    onChange={() => toggle(f.key)}
                  />
                </td>
                <td>
                  <span className="cs-file">{f.name}</span>
                  {f.imported ? (
                    <span className="cs-pill is-on">Imported</span>
                  ) : null}
                  <span className="cs-path">{f.key}</span>
                </td>
                <td>{fmtSize(f.size)}</td>
                <td>{fmtDate(f.last_modified)}</td>
              </tr>
            ))}
            {!items.length && !loading ? (
              <tr>
                <td colSpan={4} className="cs-empty">
                  No video files found{q ? ` for “${q}”` : ""}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {cursor ? (
        <button
          type="button"
          className="cs-btn cs-btn--ghost"
          onClick={() => load(true)}
          disabled={loading}
        >
          Load more
        </button>
      ) : null}
      <div className="cs-importBar">
        <label className="cs-field">
          <span>Category</span>
          <select
            value={opts.category_id}
            onChange={(e) => setOpts({ ...opts, category_id: e.target.value })}
          >
            <option value="">No category</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="cs-field">
          <span>Visibility</span>
          <select
            value={opts.visibility}
            onChange={(e) => setOpts({ ...opts, visibility: e.target.value })}
          >
            <option value="private">Members-only</option>
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
          </select>
        </label>
        <button
          type="button"
          className="cs-btn"
          disabled={!sel.size || importing}
          onClick={doImport}
        >
          {importing
            ? "Importing…"
            : `Import selected (${sel.size}) to Bunny Stream`}
        </button>
      </div>
      <p className="cs-hint">
        Bunny fetches each file straight from your storage. New messages start
        unpublished — edit their details in Videos.
      </p>
    </section>
  );
}

export default function CloudStoragePage() {
  const [providers, setProviders] = useState([]);
  const [conns, setConns] = useState([]);
  const [imports, setImports] = useState([]);
  const [adding, setAdding] = useState(null); // provider
  const [editing, setEditing] = useState(null); // connection
  const [browsing, setBrowsing] = useState(null); // connection
  const [toast, setToast] = useState(null);
  const notify = useCallback((type, text) => {
    setToast({ type, text });
    window.clearTimeout(notify.t);
    notify.t = window.setTimeout(() => setToast(null), 7000);
  }, []);
  const loadConns = useCallback(
    () =>
      api
        .get("/admin/cloud-storage/connections")
        .then(({ data }) => setConns(data.connections || []))
        .catch(() => {}),
    [],
  );
  const loadImports = useCallback(
    () =>
      api
        .get("/admin/cloud-storage/imports")
        .then(({ data }) => setImports(data.imports || []))
        .catch(() => {}),
    [],
  );
  useEffect(() => {
    api
      .get("/admin/cloud-storage/providers")
      .then(({ data }) => setProviders(data.providers || []))
      .catch(() => {});
    loadConns();
    loadImports();
  }, [loadConns, loadImports]);
  // refresh the history while imports are running
  const running = useMemo(
    () =>
      imports.some((i) => i.status === "processing" || i.status === "fetching"),
    [imports],
  );
  useEffect(() => {
    if (!running) return undefined;
    const t = window.setInterval(loadImports, 15000);
    return () => window.clearInterval(t);
  }, [running, loadImports]);
  const providerOf = (id) => providers.find((p) => p.id === id);

  async function test(c) {
    try {
      await api.post(`/admin/cloud-storage/connections/${c.id}/test`);
      notify("success", `${c.name}: connection works.`);
    } catch (err) {
      notify("error", `${c.name}: ${errText(err, "connection failed")}`);
    }
    loadConns();
  }
  async function remove(c) {
    if (
      !(await confirmDialog(
        `Remove ${c.name}? Imported videos stay in Bunny Stream.`,
      ))
    )
      return;
    await api
      .delete(`/admin/cloud-storage/connections/${c.id}`)
      .catch(() => {});
    if (browsing?.id === c.id) setBrowsing(null);
    loadConns();
  }
  async function retry(i) {
    try {
      const { data } = await api.post(
        `/admin/cloud-storage/imports/${i.id}/retry`,
      );
      notify(
        data.ok ? "success" : "error",
        data.ok ? "Import restarted." : data.error || "Retry failed.",
      );
    } catch (err) {
      notify("error", errText(err, "Retry failed."));
    }
    loadImports();
  }

  return (
    <div className="cs-page">
      <header className="cs-head">
        <div>
          <h1>Cloud Storage</h1>
          <p>
            Connect your Bunny Stream library and the cloud storage where your
            video files are, then import them into Bunny Stream.
          </p>
        </div>
      </header>
      {toast ? (
        <div
          className={`cs-toast is-${toast.type}`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          {toast.text}
        </div>
      ) : null}

      <BunnyCard notify={notify} />

      <section className="cs-card" aria-labelledby="cs-conns-h">
        <div className="cs-cardHead">
          <h2 id="cs-conns-h">Your storage</h2>
        </div>
        {conns.length ? (
          <ul className="cs-conns">
            {conns.map((c) => (
              <li key={c.id}>
                <div>
                  <strong>{c.name}</strong>
                  <span className="cs-sub">
                    {c.provider_name}
                    {c.fields?.bucket ? ` · ${c.fields.bucket}` : ""}
                    {c.fields?.prefix ? `/${c.fields.prefix}` : ""}
                  </span>
                  {c.status === "error" && c.last_error ? (
                    <span className="cs-err">{c.last_error}</span>
                  ) : null}
                </div>
                <span
                  className={`cs-pill ${c.status === "error" ? "is-err" : "is-on"}`}
                >
                  {c.status === "error" ? "Error" : "Connected"}
                </span>
                <div className="cs-row">
                  <button
                    type="button"
                    className="cs-btn"
                    onClick={() => setBrowsing(c)}
                  >
                    Browse
                  </button>
                  <button
                    type="button"
                    className="cs-btn cs-btn--ghost"
                    onClick={() => test(c)}
                  >
                    Test
                  </button>
                  <button
                    type="button"
                    className="cs-btn cs-btn--ghost"
                    onClick={() => {
                      setAdding(null);
                      setEditing(c);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="cs-btn cs-btn--danger"
                    onClick={() => remove(c)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cs-hint">
            No storage connected yet — choose one below.
          </p>
        )}
      </section>

      {browsing ? (
        <Browser
          connection={browsing}
          notify={notify}
          onImported={loadImports}
          onClose={() => setBrowsing(null)}
        />
      ) : null}

      {editing && providerOf(editing.provider) ? (
        <ConnectionForm
          provider={providerOf(editing.provider)}
          connection={editing}
          notify={notify}
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            loadConns();
          }}
        />
      ) : null}
      {adding ? (
        <ConnectionForm
          provider={adding}
          notify={notify}
          onCancel={() => setAdding(null)}
          onDone={(c) => {
            setAdding(null);
            loadConns();
            setBrowsing(c);
          }}
        />
      ) : null}

      <section className="cs-card" aria-labelledby="cs-add-h">
        <div className="cs-cardHead">
          <h2 id="cs-add-h">Add storage</h2>
        </div>
        <ul className="cs-providers">
          {providers.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="cs-provider"
                disabled={!p.available}
                onClick={() => {
                  setEditing(null);
                  setAdding(p);
                }}
                aria-label={
                  p.available ? `Connect ${p.name}` : `${p.name} — coming soon`
                }
              >
                <span className="cs-providerName">{p.name}</span>
                <span className={`cs-pill ${p.available ? "is-on" : "is-off"}`}>
                  {p.available ? "Connect" : "Coming soon"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="cs-card" aria-labelledby="cs-hist-h">
        <div className="cs-cardHead">
          <h2 id="cs-hist-h">Import history</h2>
          <button
            type="button"
            className="cs-btn cs-btn--ghost"
            onClick={loadImports}
          >
            Refresh
          </button>
        </div>
        <div className="cs-tableWrap">
          <table className="cs-table">
            <thead>
              <tr>
                <th scope="col">File</th>
                <th scope="col">Storage</th>
                <th scope="col">Message</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="cs-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {imports.map((i) => (
                <tr key={i.id}>
                  <td>
                    <span className="cs-file">
                      {String(i.key).split("/").pop()}
                    </span>
                  </td>
                  <td>{i.connection_name || "—"}</td>
                  <td>
                    {i.video_id ? (
                      <Link to={`/admin/content/videos/${i.video_id}`}>
                        {i.video_title || `#${i.video_id}`}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <span
                      className={`cs-pill ${i.status === "failed" ? "is-err" : i.status === "ready" ? "is-on" : "is-wait"}`}
                    >
                      {i.status === "processing"
                        ? "Encoding"
                        : i.status === "fetching"
                          ? "Fetching"
                          : i.status === "ready"
                            ? "Ready"
                            : "Failed"}
                    </span>
                    {i.mode === "replace" ? (
                      <span className="cs-sub"> into existing message</span>
                    ) : null}
                    {i.error ? <span className="cs-err">{i.error}</span> : null}
                  </td>
                  <td>
                    {i.status === "failed" ? (
                      <button
                        type="button"
                        className="cs-btn cs-btn--ghost"
                        onClick={() => retry(i)}
                      >
                        Retry
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!imports.length ? (
                <tr>
                  <td colSpan={5} className="cs-empty">
                    No imports yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
