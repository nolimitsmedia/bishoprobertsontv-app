// src/pages/admin/AdminEmailAutomations.js
// Email › Automations: every automatic email the site sends — switch on/off,
// edit the wording (with fill-in fields), preview, send a test — plus the
// email footer (mailing address) and a log of what was sent.
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import { confirmDialog } from "../../components/ui/Dialogs";
import "./AdminMedia.css";
import "./AdminTeam.css";
import "./AdminPages.css";
import "./AdminEmailIntegration.css";
import "./AdminEmailAutomations.css";

const errText = (e, f) => e?.response?.data?.error || f;

const GROUPS = [
  ["account", "Account emails", "Sent to a member about their own account."],
  [
    "essential",
    "Always sent",
    "Needed for the account to work, so they can’t be turned off. You can still change the wording.",
  ],
  [
    "updates",
    "Reminders and updates",
    "Optional: people can unsubscribe from these. New automations start switched off — preview one, then switch it on. Each only looks at recent activity, so switching one on never emails your whole list at once.",
  ],
  [
    "billing",
    "Billing emails",
    "For paid subscriptions (Release 2.1). Leave these off until subscriptions are live.",
  ],
  [
    "office",
    "Office alerts",
    "Sent to the office notifications address (set in Integration › Email).",
  ],
];

const DAY_NAMES = [
  ["sun", "Sunday"],
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
];
const hourLabel = (h) =>
  new Date(2026, 0, 1, h).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
const SETTING_KEYS = [
  "footer_address",
  "footer_note",
  "roundup_day",
  "roundup_hour",
  "continue_after_days",
  "miss_after_days",
];

const STATUS_LABEL = { sent: "Sent", failed: "Failed", skipped: "Not sent" };

function when(iso) {
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
}

/* ───────── editor ───────── */
function Editor({ tpl, onClose, onSaved, setNotice }) {
  const [draft, setDraft] = useState({
    subject: tpl.subject,
    heading: tpl.heading,
    body: tpl.body,
    button: tpl.button || "",
  });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const [testTo, setTestTo] = useState("");
  const lastField = useRef({ name: "body", el: null });
  const changed =
    draft.subject !== tpl.subject ||
    draft.heading !== tpl.heading ||
    draft.body !== tpl.body ||
    (draft.button || "") !== (tpl.button || "");

  // Live preview (after typing stops).
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post(
          `/admin/email/automations/${tpl.key}/preview`,
          draft,
        );
        setPreview(data);
      } catch {
        /* keep the last preview */
      }
    }, 450);
    return () => clearTimeout(t);
  }, [draft, tpl.key]);

  const bind = (name) => ({
    value: draft[name],
    onChange: (e) => setDraft((d) => ({ ...d, [name]: e.target.value })),
    onFocus: (e) => (lastField.current = { name, el: e.target }),
  });

  // Insert {field} where the cursor is, in the last field used.
  function insert(field) {
    const { name, el } = lastField.current;
    const token = `{${field}}`;
    setDraft((d) => {
      const v = d[name] || "";
      const at =
        el && typeof el.selectionStart === "number"
          ? el.selectionStart
          : v.length;
      const end =
        el && typeof el.selectionEnd === "number" ? el.selectionEnd : at;
      const next = v.slice(0, at) + token + v.slice(end);
      requestAnimationFrame(() => {
        if (el) {
          el.focus();
          el.setSelectionRange(at + token.length, at + token.length);
        }
      });
      return { ...d, [name]: next };
    });
  }

  async function save() {
    setBusy("save");
    try {
      await api.put(`/admin/email/automations/${tpl.key}`, draft);
      setNotice({ tone: "success", text: `“${tpl.name}” saved.` });
      onSaved();
    } catch (e) {
      setNotice({ tone: "error", text: errText(e, "Could not save.") });
    } finally {
      setBusy("");
    }
  }

  async function test() {
    setBusy("test");
    try {
      const { data } = await api.post(
        `/admin/email/automations/${tpl.key}/test`,
        {
          ...draft,
          to: testTo.trim() || undefined,
        },
      );
      setNotice({ tone: "success", text: data.message });
    } catch (e) {
      setNotice({
        tone: "error",
        text: errText(e, "The test could not be sent."),
      });
    } finally {
      setBusy("");
    }
  }

  async function resetDefault() {
    const ok = await confirmDialog({
      title: "Use the original wording?",
      message:
        "Your changes to this email will be replaced by the original wording.",
      confirmLabel: "Use original",
    });
    if (!ok) return;
    setBusy("reset");
    try {
      await api.put(`/admin/email/automations/${tpl.key}`, {
        reset: true,
        enabled: tpl.enabled,
      });
      setNotice({
        tone: "success",
        text: `“${tpl.name}” is back to the original wording.`,
      });
      onSaved();
    } catch (e) {
      setNotice({ tone: "error", text: errText(e, "Could not reset.") });
    } finally {
      setBusy("");
    }
  }

  const id = (n) => `ea-${tpl.key}-${n}`;
  return (
    <div className="ea-editor">
      <div className="ea-editForm">
        <label htmlFor={id("subject")}>Subject line</label>
        <input id={id("subject")} className="ml-input" {...bind("subject")} />
        <label htmlFor={id("heading")}>Heading</label>
        <input id={id("heading")} className="ml-input" {...bind("heading")} />
        <label htmlFor={id("body")}>Message</label>
        <textarea
          id={id("body")}
          className="ml-input ea-body"
          rows={8}
          aria-describedby={id("body-help")}
          {...bind("body")}
        />
        <p id={id("body-help")} className="ml-help">
          Leave a blank line between paragraphs.
        </p>
        {tpl.has_button ? (
          <>
            <label htmlFor={id("button")}>Button text</label>
            <input
              id={id("button")}
              className="ml-input"
              aria-describedby={id("button-help")}
              {...bind("button")}
            />
            <p id={id("button-help")} className="ml-help">
              Leave empty for no button.
            </p>
          </>
        ) : null}
        <div className="ea-fields" role="group" aria-label="Insert a detail">
          <span className="ea-fieldsLabel">Insert a detail:</span>
          {tpl.fields.map((f) => (
            <button
              key={f.key}
              type="button"
              className="ea-chip"
              onClick={() => insert(f.key)}
              title={`Inserts {${f.key}}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ea-editActions">
          <label className="ea-testTo">
            <span className="sr-only">Send the test to</span>
            <input
              className="ml-input"
              type="email"
              placeholder="Test to: your sign-in email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="ml-btn"
            disabled={!!busy}
            onClick={test}
          >
            {busy === "test" ? "Sending…" : "Send me a test"}
          </button>
        </div>
        <div className="ea-editActions">
          {tpl.customized ? (
            <button
              type="button"
              className="ml-link"
              disabled={!!busy}
              onClick={resetDefault}
            >
              Use original wording
            </button>
          ) : (
            <span />
          )}
          <span className="ea-grow" />
          <button
            type="button"
            className="ml-btn"
            disabled={!!busy}
            onClick={onClose}
          >
            {changed ? "Cancel" : "Close"}
          </button>
          <button
            type="button"
            className="ml-btn ml-btnPrimary"
            disabled={!!busy || !changed}
            onClick={save}
          >
            {busy === "save" ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <div className="ea-preview">
        <p className="ea-previewSubject">
          <span>Subject:</span> {preview?.subject || "…"}
        </p>
        {preview ? (
          <iframe
            title={`Preview of ${tpl.name}`}
            className="ea-previewFrame"
            sandbox=""
            srcDoc={preview.html}
          />
        ) : (
          <p className="ml-help" role="status">
            Loading preview…
          </p>
        )}
        <p className="ml-help">Preview with sample details (Grace Johnson).</p>
      </div>
    </div>
  );
}

/* ───────── log ───────── */
function SentLog({ templates }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [key, setKey] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const names = useMemo(
    () => Object.fromEntries(templates.map((t) => [t.key, t.name])),
    [templates],
  );

  const load = useCallback(
    async (offset = 0) => {
      setLoading(true);
      try {
        const { data } = await api.get("/admin/email/automations/log", {
          params: {
            key: key || undefined,
            status: status || undefined,
            q: q.trim() || undefined,
            limit: 50,
            offset,
          },
        });
        setRows((r) => (offset ? [...r, ...data.items] : data.items));
        setTotal(data.total);
        setErr("");
      } catch (e) {
        setErr(errText(e, "Could not load the log."));
      } finally {
        setLoading(false);
      }
    },
    [key, status, q],
  );

  useEffect(() => {
    const t = setTimeout(() => load(0), 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <section className="tm-card" aria-labelledby="ea-log">
      <h2 id="ea-log">Sent emails</h2>
      <div className="ea-logFilters">
        <label>
          Email
          <select
            className="ml-input"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          >
            <option value="">All automatic emails</option>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Result
          <select
            className="ml-input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Any</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="skipped">Not sent (unsubscribed)</option>
          </select>
        </label>
        <label>
          Recipient
          <input
            className="ml-input"
            type="search"
            placeholder="Search by email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      {err ? (
        <div className="ml-notice error" role="alert">
          {err}
        </div>
      ) : null}
      <div className="ea-tableWrap">
        <table className="ea-table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Email</th>
              <th scope="col">To</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{when(r.created_at)}</td>
                <td>{names[r.template_key] || r.template_key}</td>
                <td className="ea-mono">{r.email}</td>
                <td>
                  <span className={`ea-status is-${r.status}`}>
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                  {r.detail ? (
                    <div className="ea-detail">{r.detail}</div>
                  ) : null}
                </td>
              </tr>
            ))}
            {!rows.length && !loading ? (
              <tr>
                <td colSpan={4} className="ea-empty">
                  Nothing here yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="ml-help" role="status">
        {loading ? "Loading…" : `${rows.length} of ${total}`}
      </p>
      {rows.length < total ? (
        <button
          type="button"
          className="ml-btn"
          disabled={loading}
          onClick={() => load(rows.length)}
        >
          Show more
        </button>
      ) : null}
    </section>
  );
}

/* ───────── page ───────── */
export default function AdminEmailAutomations() {
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [notice, setNotice] = useState(null);
  const [open, setOpen] = useState("");
  const [tab, setTab] = useState("emails");
  const [footer, setFooter] = useState({});
  const [savingFooter, setSavingFooter] = useState(false);
  const setF = (k) => (e) => setFooter((f) => ({ ...f, [k]: e.target.value }));

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get("/admin/email/automations");
      setData(d);
      setFooter(
        Object.fromEntries(
          SETTING_KEYS.map((k) => [k, String(d.settings[k] ?? "")]),
        ),
      );
      setLoadErr("");
    } catch (e) {
      setLoadErr(errText(e, "The automatic emails could not be loaded."));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function toggle(t, on) {
    setData((d) => ({
      ...d,
      templates: d.templates.map((x) =>
        x.key === t.key ? { ...x, enabled: on } : x,
      ),
    }));
    try {
      await api.put(`/admin/email/automations/${t.key}`, { enabled: on });
      setNotice({
        tone: "success",
        text: `“${t.name}” is now ${on ? "on" : "off"}.`,
      });
    } catch (e) {
      setNotice({ tone: "error", text: errText(e, "Could not change it.") });
      load();
    }
  }

  async function saveFooter() {
    setSavingFooter(true);
    try {
      await api.put("/admin/email/automations/settings", footer);
      setNotice({ tone: "success", text: "Settings saved." });
      load();
    } catch (e) {
      setNotice({
        tone: "error",
        text: errText(e, "Could not save the settings."),
      });
    } finally {
      setSavingFooter(false);
    }
  }

  if (!data)
    return (
      <main className="ml-page tm-page">
        <h1>Email Automations</h1>
        {loadErr ? (
          <div className="ml-notice error" role="alert">
            {loadErr}
          </div>
        ) : (
          <p className="ml-help" role="status">
            Loading…
          </p>
        )}
      </main>
    );

  const noAddress = !data.settings.footer_address;
  const isOn = (k) => data.templates.find((t) => t.key === k)?.enabled;
  const bothNewContent = isOn("new_video") && isOn("weekly_roundup");

  return (
    <main className="ml-page tm-page eml-page">
      <div className="ml-header">
        <div>
          <h1>Email Automations</h1>
          <p>
            The emails the site sends by itself. Each uses the site’s logo and
            colour, and goes out through the account set in{" "}
            <Link to="/admin/content/email-integration">
              Integration › Email
            </Link>
            .
          </p>
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

      <div className="ea-tabs" role="tablist" aria-label="Email automations">
        {[
          ["emails", "Emails"],
          ["footer", "Settings"],
          ["log", "Sent emails"],
        ].map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            id={`ea-tab-${v}`}
            aria-selected={tab === v}
            aria-controls={`ea-panel-${v}`}
            className={`ea-tab${tab === v ? " is-on" : ""}`}
            onClick={() => setTab(v)}
          >
            {label}
            {v === "footer" && noAddress ? (
              <span className="ea-dotWarn" aria-label="needs attention" />
            ) : null}
          </button>
        ))}
      </div>

      {tab === "emails" ? (
        <div
          role="tabpanel"
          id="ea-panel-emails"
          aria-labelledby="ea-tab-emails"
        >
          {noAddress ? (
            <div className="ml-notice warn" role="status">
              <span>
                Add the ministry’s mailing address in the{" "}
                <strong>Footer</strong> tab. US law (CAN-SPAM) requires a postal
                address in emails like reminders and news.
              </span>
              <button
                type="button"
                className="ml-link"
                onClick={() => setTab("footer")}
              >
                Add address
              </button>
            </div>
          ) : null}
          {bothNewContent ? (
            <div className="ml-notice warn" role="status">
              <span>
                <strong>New sermon alert</strong> and{" "}
                <strong>Weekly roundup</strong> are both on, so people get an
                email for each new video and a weekly summary. Most ministries
                choose one.
              </span>
            </div>
          ) : null}
          {GROUPS.map(([cat, title, help]) => {
            const list = data.templates.filter((t) => t.category === cat);
            if (!list.length) return null;
            return (
              <section
                key={cat}
                className="tm-card"
                aria-labelledby={`ea-g-${cat}`}
              >
                <h2 id={`ea-g-${cat}`}>{title}</h2>
                <p className="ml-help">{help}</p>
                <ul className="ea-list">
                  {list.map((t) => (
                    <li
                      key={t.key}
                      className={`ea-item${open === t.key ? " is-open" : ""}`}
                    >
                      <div className="ea-row">
                        <div className="ea-info">
                          <h3>{t.name}</h3>
                          <p>{t.when}</p>
                          <p className="ea-stats">
                            Last 30 days: {t.stats.sent} sent
                            {t.stats.failed
                              ? ` · ${t.stats.failed} failed`
                              : ""}
                            {t.stats.skipped
                              ? ` · ${t.stats.skipped} not sent (unsubscribed)`
                              : ""}
                            {t.customized ? " · custom wording" : ""}
                          </p>
                        </div>
                        <div className="ea-controls">
                          {t.can_turn_off ? (
                            <label className="ea-switch">
                              <input
                                type="checkbox"
                                role="switch"
                                checked={t.enabled}
                                aria-label={`${t.name}: ${t.enabled ? "on" : "off"}`}
                                onChange={(e) => toggle(t, e.target.checked)}
                              />
                              <span aria-hidden="true" className="ea-track" />
                              <span
                                className="ea-switchText"
                                aria-hidden="true"
                              >
                                {t.enabled ? "On" : "Off"}
                              </span>
                            </label>
                          ) : (
                            <span className="ea-always">Always on</span>
                          )}
                          <button
                            type="button"
                            className="ml-btn"
                            aria-expanded={open === t.key}
                            onClick={() => setOpen(open === t.key ? "" : t.key)}
                          >
                            {open === t.key ? "Close" : "Edit"}
                          </button>
                        </div>
                      </div>
                      {open === t.key ? (
                        <Editor
                          tpl={t}
                          setNotice={setNotice}
                          onClose={() => setOpen("")}
                          onSaved={() => {
                            setOpen("");
                            load();
                          }}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}

      {tab === "footer" ? (
        <section
          role="tabpanel"
          id="ea-panel-footer"
          aria-labelledby="ea-tab-footer"
          className="tm-card"
        >
          <h2>Email footer</h2>
          <p className="ml-help">
            Shown at the bottom of every automatic email.
          </p>
          <div className="ss-grid">
            <label>
              Mailing address
              <textarea
                className="ml-input"
                rows={3}
                placeholder="Ministry name, street, city, state ZIP"
                value={footer.footer_address || ""}
                onChange={setF("footer_address")}
              />
            </label>
            <label>
              <span>
                Short note <span className="eml-optional">(optional)</span>
              </span>
              <textarea
                className="ml-input"
                rows={3}
                placeholder="e.g. Thank you for being part of this ministry."
                value={footer.footer_note || ""}
                onChange={setF("footer_note")}
              />
            </label>
          </div>
          <h2 className="ea-subhead">Timing</h2>
          <p className="ml-help">
            Times use the ministry’s time zone (the same as the Calendar).
          </p>
          <div className="ss-grid">
            <label>
              Weekly roundup day
              <select
                className="ml-input"
                aria-label="Weekly roundup day"
                value={footer.roundup_day || "mon"}
                onChange={setF("roundup_day")}
              >
                {DAY_NAMES.map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Weekly roundup time
              <select
                className="ml-input"
                aria-label="Weekly roundup time"
                value={footer.roundup_hour || "9"}
                onChange={setF("roundup_hour")}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={String(h)}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Continue watching: after
              <select
                className="ml-input"
                aria-label="Continue watching after"
                value={footer.continue_after_days || "3"}
                onChange={setF("continue_after_days")}
              >
                {[1, 2, 3, 5, 7, 10, 14].map((d) => (
                  <option key={d} value={String(d)}>
                    {d} day{d === 1 ? "" : "s"} without watching
                  </option>
                ))}
              </select>
            </label>
            <label>
              We miss you: after
              <select
                className="ml-input"
                aria-label="We miss you after"
                value={footer.miss_after_days || "30"}
                onChange={setF("miss_after_days")}
              >
                {[14, 21, 30, 45, 60, 90].map((d) => (
                  <option key={d} value={String(d)}>
                    {d} days without a visit
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="eml-actions">
            <button
              type="button"
              className="ml-btn ml-btnPrimary"
              disabled={savingFooter}
              onClick={saveFooter}
            >
              {savingFooter ? "Saving…" : "Save settings"}
            </button>
          </div>
        </section>
      ) : null}

      {tab === "log" ? (
        <div role="tabpanel" id="ea-panel-log" aria-labelledby="ea-tab-log">
          <SentLog templates={data.templates} />
        </div>
      ) : null}
    </main>
  );
}
