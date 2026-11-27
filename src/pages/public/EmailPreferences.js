// src/pages/public/EmailPreferences.js
// Linked from every email: #/email-preferences?token=… (no sign-in needed).
// Signed-in members can also open it from their account (no token: we fetch it).
import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../api";
import AuthShell from "../../components/auth/AuthShell";
import "./EmailPreferences.css";

const DONE_TEXT = {
  all: "You’re unsubscribed from all optional emails.",
  live: "You won’t get live service reminders anymore.",
  updates: "You won’t get new sermon and series emails anymore.",
  activity: "You won’t get continue-watching reminders anymore.",
  news: "You won’t get news and announcements anymore.",
};

export default function EmailPreferences() {
  const [params, setParams] = useSearchParams();
  const [token, setToken] = useState(params.get("token") || "");
  const unsubscribed = params.get("unsubscribed") || "";
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let t = token;
        if (!t) {
          // Signed-in member without a link: get their own.
          const r = await api.get("/email-preferences/me");
          t = r.data.token;
          if (!alive) return;
          setToken(t);
        }
        const { data: d } = await api.get("/email-preferences", {
          params: { token: t },
        });
        if (alive) setData(d);
      } catch (e) {
        if (!alive) return;
        setErr(
          e?.response?.status === 401
            ? "Open this page from the link at the bottom of one of our emails, or sign in first."
            : e?.response?.data?.error ||
                "Your email preferences could not be loaded.",
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  async function save(patch, message) {
    setBusy(true);
    setSaved("");
    try {
      const { data: d } = await api.post("/email-preferences", {
        token,
        ...patch,
      });
      setData(d);
      setSaved(message);
      if (unsubscribed) {
        params.delete("unsubscribed");
        setParams(params, { replace: true });
      }
    } catch (e) {
      setErr(e?.response?.data?.error || "Your choices could not be saved.");
      // Put back what is really saved.
      try {
        const { data: d } = await api.get("/email-preferences", {
          params: { token },
        });
        setData(d);
      } catch {
        /* keep showing the error */
      }
    } finally {
      setBusy(false);
    }
  }

  const allOff = !!data?.unsubscribed_all;

  return (
    <AuthShell
      headline="Email preferences"
      points={[
        "Choose which emails you get",
        "Account emails like password resets always arrive",
        "Change your mind any time",
      ]}
      title="Your emails"
      subtitle={data?.email ? `For ${data.email}` : ""}
      footer={
        <Link to="/" className="as-link">
          ← Back to the website
        </Link>
      }
    >
      {err ? (
        <div className="as-alert" role="alert">
          {err}
        </div>
      ) : !data ? (
        <p role="status">
          <span className="as-spinner" aria-hidden="true" /> Loading…
        </p>
      ) : (
        <>
          {unsubscribed &&
          unsubscribed !== "invalid" &&
          DONE_TEXT[unsubscribed] ? (
            <div className="as-success" role="status">
              {DONE_TEXT[unsubscribed]} You can change that below.
            </div>
          ) : null}
          {unsubscribed === "invalid" ? (
            <div className="as-alert" role="alert">
              That unsubscribe link isn’t valid. Use the link from a recent
              email.
            </div>
          ) : null}
          {saved ? (
            <div className="as-success" role="status">
              {saved}
            </div>
          ) : null}

          <fieldset className="ep-lists" disabled={allOff}>
            <legend className="ep-legend">Send me:</legend>
            {data.lists.map((l) => (
              <label key={l.key} className="ep-row">
                <input
                  type="checkbox"
                  checked={!allOff && l.on}
                  onChange={(e) => {
                    const on = e.target.checked;
                    // Show the change at once; save in the background.
                    setData((d) => ({
                      ...d,
                      lists: d.lists.map((x) =>
                        x.key === l.key ? { ...x, on } : x,
                      ),
                    }));
                    save(
                      { lists: { [l.key]: on } },
                      `${l.label}: ${on ? "on" : "off"}. Saved.`,
                    );
                  }}
                />
                <span>
                  <strong>{l.label}</strong>
                  <small>{l.help}</small>
                </span>
              </label>
            ))}
          </fieldset>

          {allOff ? (
            <button
              type="button"
              className="as-btn"
              disabled={busy}
              onClick={() =>
                save(
                  { unsubscribed_all: false },
                  "Welcome back — your emails are on again.",
                )
              }
            >
              Turn my emails back on
            </button>
          ) : (
            <button
              type="button"
              className="ep-unsubAll"
              disabled={busy}
              onClick={() =>
                save(
                  { unsubscribed_all: true },
                  "You’re unsubscribed from all optional emails.",
                )
              }
            >
              Unsubscribe from all optional emails
            </button>
          )}
          <p className="ep-note">
            Emails about your account — password resets and payment receipts —
            are always sent.
          </p>
        </>
      )}
    </AuthShell>
  );
}
