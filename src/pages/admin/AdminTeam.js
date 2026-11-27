// src/pages/admin/AdminTeam.js
//
// Phase 8-1: Team — who can work in the admin panel, and in which areas.
// Administrators see everything; team members see only their areas.
// Administrators themselves are managed in Users (only the Owner can add or
// remove them).

import React, { useEffect, useState } from "react";
import api from "../../api";
import { ROLE_LABELS, useAdminAccess } from "../../auth/adminAccess";
import "./AdminMedia.css";
import "./AdminTeam.css";

const ROLE_HELP = {
  website:
    "Pages, templates, Media Library, navigation, design settings, SEO and publishing",
  content:
    "Videos, collections, live streaming, calendar, resources and organize",
  video_upload:
    "Upload videos and see the library; can edit or delete only their own uploads",
  community: "Moderate community posts and video comments",
  marketing: "Email Center: send emails to members and see sent emails",
  support:
    "Users: view and edit member accounts (not staff accounts, roles or deleting)",
};

function errText(e, fallback) {
  return e?.response?.data?.error || e?.response?.data?.message || fallback;
}

export default function AdminTeam() {
  const { access } = useAdminAccess();
  const [members, setMembers] = useState(null);
  const [roles, setRoles] = useState([
    "website",
    "content",
    "video_upload",
    "community",
    "marketing",
    "support",
  ]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [drafts, setDrafts] = useState({}); // userId -> roles being edited
  const [busy, setBusy] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRoles, setAddRoles] = useState([]);
  const [transferTo, setTransferTo] = useState("");
  const [confirmTransfer, setConfirmTransfer] = useState(false);

  async function load() {
    setError("");
    try {
      const { data } = await api.get("/admin/team");
      setMembers(data.members || []);
      if (Array.isArray(data.roles)) setRoles(data.roles);
      setDrafts({});
    } catch (e) {
      setError(errText(e, "The team could not be loaded."));
      setMembers([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function toggle(list, role) {
    return list.includes(role)
      ? list.filter((r) => r !== role)
      : [...list, role];
  }

  async function saveRoles(m) {
    const next = drafts[m.id];
    if (!next) return;
    setBusy(`roles-${m.id}`);
    try {
      const { data } = await api.put(`/admin/team/${m.id}/roles`, {
        roles: next,
      });
      setMembers(data.members || []);
      setDrafts((d) => {
        const c = { ...d };
        delete c[m.id];
        return c;
      });
      setNotice({
        tone: "success",
        text: next.length
          ? `Updated ${m.name || m.email}.`
          : `${m.name || m.email} was removed from the team. Their member account is unchanged.`,
      });
    } catch (e) {
      setNotice({
        tone: "error",
        text: errText(e, "Roles could not be saved."),
      });
    } finally {
      setBusy("");
    }
  }

  async function addMember() {
    if (!addEmail.trim() || !addRoles.length) {
      setNotice({
        tone: "error",
        text: "Enter an email address and choose at least one role.",
      });
      return;
    }
    setBusy("add");
    try {
      const { data } = await api.post("/admin/team/members", {
        email: addEmail.trim(),
        roles: addRoles,
      });
      setMembers(data.members || []);
      setNotice({
        tone: "success",
        text: `Added ${addEmail.trim()} to the team.`,
      });
      setAddEmail("");
      setAddRoles([]);
    } catch (e) {
      setNotice({
        tone: "error",
        text: errText(e, "The team member could not be added."),
      });
    } finally {
      setBusy("");
    }
  }

  async function transfer() {
    setBusy("transfer");
    try {
      const { data } = await api.post("/admin/team/transfer-ownership", {
        userId: Number(transferTo),
      });
      setMembers(data.members || []);
      setConfirmTransfer(false);
      setTransferTo("");
      setNotice({
        tone: "success",
        text: "Ownership transferred. Reload the page to see your updated access.",
      });
    } catch (e) {
      setNotice({
        tone: "error",
        text: errText(e, "Ownership was not transferred."),
      });
    } finally {
      setBusy("");
    }
  }

  const admins = (members || []).filter((m) => m.isAdmin);
  const team = (members || []).filter((m) => !m.isAdmin);
  const isOwner = !!access?.isOwner;

  return (
    <main className="ml-page tm-page">
      <div className="ml-header">
        <div>
          <h1>Team</h1>
          <p>
            Give people access to the parts of the admin they work on.
            Administrators can use everything; team members see only their
            areas. Team members keep their regular member account.
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
      {error ? (
        <div className="ml-notice error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      <section className="tm-card" aria-labelledby="tm-add">
        <h2 id="tm-add">Add a team member</h2>
        <p className="ml-help">
          The person needs an account first (they can register on the website).
        </p>
        <div className="tm-addRow">
          <input
            className="ml-input"
            type="email"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            placeholder="Email address"
            aria-label="Email address"
          />
          <div
            className="tm-roles"
            role="group"
            aria-label="Roles for the new team member"
          >
            {roles.map((r) => (
              <label key={r} className="tm-check">
                <input
                  type="checkbox"
                  checked={addRoles.includes(r)}
                  onChange={() => setAddRoles((cur) => toggle(cur, r))}
                />
                {ROLE_LABELS[r] || r}
              </label>
            ))}
          </div>
          <button
            type="button"
            className="ml-btn ml-btnPrimary"
            onClick={addMember}
            disabled={busy === "add"}
          >
            {busy === "add" ? "Adding…" : "Add to team"}
          </button>
        </div>
        <ul className="tm-roleHelp">
          {roles.map((r) => (
            <li key={r}>
              <b>{ROLE_LABELS[r] || r}:</b> {ROLE_HELP[r] || ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="tm-card" aria-labelledby="tm-members">
        <h2 id="tm-members">Team members</h2>
        {members === null ? (
          <p className="ml-help" role="status">
            Loading…
          </p>
        ) : !team.length ? (
          <p className="ml-help">No team members yet.</p>
        ) : (
          <ul className="tm-list">
            {team.map((m) => {
              const current = drafts[m.id] || m.teamRoles;
              const changed = !!drafts[m.id];
              return (
                <li key={m.id} className="tm-row">
                  <div className="tm-who">
                    <strong>{m.name || m.email}</strong>
                    <span>{m.email}</span>
                  </div>
                  <div
                    className="tm-roles"
                    role="group"
                    aria-label={`Roles for ${m.name || m.email}`}
                  >
                    {roles.map((r) => (
                      <label key={r} className="tm-check">
                        <input
                          type="checkbox"
                          checked={current.includes(r)}
                          onChange={() =>
                            setDrafts((d) => ({
                              ...d,
                              [m.id]: toggle(current, r),
                            }))
                          }
                        />
                        {ROLE_LABELS[r] || r}
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={`ml-btn ${changed && !current.length ? "ml-btnDanger" : "ml-btnPrimary"}`}
                    onClick={() => saveRoles(m)}
                    disabled={!changed || busy === `roles-${m.id}`}
                  >
                    {busy === `roles-${m.id}`
                      ? "Saving…"
                      : changed && !current.length
                        ? "Remove from team"
                        : "Save"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="tm-card" aria-labelledby="tm-admins">
        <h2 id="tm-admins">Administrators</h2>
        <p className="ml-help">
          Administrators can use every area. Only the Owner can add or remove
          administrators (in Users), and nobody can remove the Owner.
        </p>
        <ul className="tm-list">
          {admins.map((m) => (
            <li key={m.id} className="tm-row">
              <div className="tm-who">
                <strong>{m.name || m.email}</strong>
                <span>{m.email}</span>
              </div>
              <span className={`tm-badge ${m.isOwner ? "owner" : ""}`}>
                {m.isOwner ? "Owner" : "Administrator"}
              </span>
            </li>
          ))}
        </ul>

        {isOwner && admins.length > 1 ? (
          <div className="tm-transfer">
            <h3>Transfer ownership</h3>
            <p className="ml-help">
              The new Owner will manage administrators. You stay an
              administrator.
            </p>
            {confirmTransfer ? (
              <div
                className="ml-confirm"
                role="alertdialog"
                aria-labelledby="tm-confirmTitle"
              >
                <strong id="tm-confirmTitle">
                  Make{" "}
                  {admins.find((a) => String(a.id) === String(transferTo))
                    ?.name || "this administrator"}{" "}
                  the Owner?
                </strong>
                <p>
                  You will no longer be able to add or remove administrators.
                </p>
                <div className="ml-confirmActions">
                  <button
                    type="button"
                    className="ml-btn"
                    onClick={() => setConfirmTransfer(false)}
                    autoFocus
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="ml-btn ml-btnDanger"
                    onClick={transfer}
                    disabled={busy === "transfer"}
                  >
                    {busy === "transfer"
                      ? "Transferring…"
                      : "Transfer ownership"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="tm-addRow">
                <select
                  className="ml-input"
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  aria-label="New Owner"
                >
                  <option value="">Choose an administrator…</option>
                  {admins
                    .filter((a) => !a.isOwner)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name || a.email}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="ml-btn"
                  onClick={() => setConfirmTransfer(true)}
                  disabled={!transferTo}
                >
                  Transfer…
                </button>
              </div>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
