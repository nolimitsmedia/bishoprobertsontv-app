// src/pages/admin/AdminFormSubmissions.js
//
// Release 1.2 Part C — Form Submissions inbox: messages sent with the Form
// element (contact, prayer requests…). Administrators, Website Managers,
// Customer Support and Community Managers.

import React, { useCallback, useEffect, useState } from "react";
import api from "../../api";
import "./AdminMedia.css";
import "./AdminTeam.css";
import "./AdminPages.css";
import { confirmDialog } from "../../components/ui/Dialogs";

const errText = (e, f) => e?.response?.data?.error || f;
const when = (d) => {
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? "" : t.toLocaleString();
};

export default function AdminFormSubmissions() {
  const [forms, setForms] = useState([]);
  const [formId, setFormId] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [rows, setRows] = useState(null);
  const [counts, setCounts] = useState({ total: 0, unread: 0 });
  const [open, setOpen] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    try {
      const [{ data: list }, { data: f }] = await Promise.all([
        api.get("/forms/admin/submissions", {
          params: {
            form_id: formId || undefined,
            unread: unreadOnly ? 1 : undefined,
            limit: 200,
          },
        }),
        api.get("/forms/admin/forms"),
      ]);
      setRows(Array.isArray(list?.submissions) ? list.submissions : []);
      setCounts({ total: list?.total || 0, unread: list?.unread || 0 });
      setForms(Array.isArray(f?.forms) ? f.forms : []);
    } catch (e) {
      setRows([]);
      setNotice({
        tone: "error",
        text: errText(e, "Submissions could not be loaded."),
      });
    }
  }, [formId, unreadOnly]);
  useEffect(() => {
    load();
  }, [load]);

  async function setRead(r, read) {
    try {
      const { data } = await api.patch(`/forms/admin/submissions/${r.id}`, {
        read,
      });
      setRows((list) =>
        list.map((x) =>
          x.id === r.id
            ? { ...x, read_at: data?.submission?.read_at || null }
            : x,
        ),
      );
      setCounts((c) => ({
        ...c,
        unread: Math.max(
          0,
          c.unread + (read ? (r.read_at ? 0 : -1) : r.read_at ? 1 : 0),
        ),
      }));
    } catch (e) {
      setNotice({ tone: "error", text: errText(e, "Could not update.") });
    }
  }
  async function remove(r) {
    if (
      !(await confirmDialog("Delete this submission? This cannot be undone."))
    )
      return;
    try {
      await api.delete(`/forms/admin/submissions/${r.id}`);
      setRows((list) => list.filter((x) => x.id !== r.id));
      setCounts((c) => ({
        total: c.total - 1,
        unread: c.unread - (r.read_at ? 0 : 1),
      }));
    } catch (e) {
      setNotice({ tone: "error", text: errText(e, "Could not delete.") });
    }
  }
  async function exportCsv() {
    try {
      const res = await api.get("/forms/admin/export.csv", {
        params: { form_id: formId || undefined },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "form-submissions.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      setNotice({ tone: "error", text: errText(e, "Could not export.") });
    }
  }

  return (
    <main className="ml-page tm-page">
      <div className="ml-header">
        <div>
          <h1>Form Submissions</h1>
          <p>
            Messages sent with the Form element on your pages (contact, prayer
            requests…).
          </p>
        </div>
        <button
          type="button"
          className="ml-btn"
          onClick={exportCsv}
          disabled={!counts.total}
        >
          Export CSV
        </button>
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
      <div className="tm-addRow" style={{ flexWrap: "wrap", gap: 12 }}>
        <select
          className="ml-input"
          aria-label="Form"
          value={formId}
          onChange={(e) => setFormId(e.target.value)}
        >
          <option value="">All forms</option>
          {forms.map((f) => (
            <option key={f.form_id} value={f.form_id}>
              {f.form_title} (/{f.page_slug}) — {f.unread} unread
            </option>
          ))}
        </select>
        <label className="tm-check">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />{" "}
          Unread only
        </label>
        <span className="ml-help" role="status">
          {counts.total} submissions · {counts.unread} unread
        </span>
      </div>
      {rows === null ? (
        <p className="ml-help" role="status">
          Loading…
        </p>
      ) : null}
      {rows && !rows.length ? (
        <p className="ml-help">No submissions yet.</p>
      ) : null}
      <ul className="fs-list" aria-label="Submissions">
        {(rows || []).map((r) => {
          const isOpen = open === r.id;
          const entries = Object.entries(r.data || {});
          return (
            <li
              key={r.id}
              className={`tm-card fs-item${r.read_at ? "" : " is-unread"}`}
            >
              <button
                type="button"
                className="fs-head"
                aria-expanded={isOpen}
                onClick={() => {
                  setOpen(isOpen ? null : r.id);
                  if (!isOpen && !r.read_at) setRead(r, true);
                }}
              >
                <span
                  className="fs-dot"
                  aria-label={r.read_at ? "Read" : "Unread"}
                />
                <strong>{r.form_title}</strong>
                <span className="fs-preview">
                  {entries
                    .slice(0, 2)
                    .map(([, v]) => v)
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="fs-when">{when(r.created_at)}</span>
              </button>
              {isOpen ? (
                <div className="fs-body">
                  <dl>
                    {entries.map(([k, v]) => (
                      <React.Fragment key={k}>
                        <dt>{k}</dt>
                        <dd>{v || "—"}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                  <p className="ml-help">From the page /{r.page_slug}</p>
                  <div className="tm-addRow">
                    <button
                      type="button"
                      className="ml-btn"
                      onClick={() => setRead(r, !r.read_at)}
                    >
                      Mark as {r.read_at ? "unread" : "read"}
                    </button>
                    <button
                      type="button"
                      className="ml-btn ml-btnDanger"
                      onClick={() => remove(r)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
