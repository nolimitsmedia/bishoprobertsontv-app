// src/components/viewer/LiveSchedule.js
// Next live service with a countdown, the weekly services from the Calendar
// ("Every Sunday · 10:00 AM ET"), Notify me and a link to the live page.
// When the service is live it says so and links straight to it.

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";

const TZ = process.env.REACT_APP_CALENDAR_TIMEZONE || "America/New_York";
const pad = (n) => String(Math.max(0, n)).padStart(2, "0");

// "Notify me": members — one click (uses the account email), click again to
// turn it off; visitors — a small email field opens under the button.
function NotifyButton() {
  const signed = (() => {
    try {
      return !!(
        localStorage.getItem("token") || sessionStorage.getItem("token")
      );
    } catch {
      return false;
    }
  })();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!signed) return;
    api
      .get("/live-reminders/me")
      .then(({ data }) => setOn(!!data?.subscribed))
      .catch(() => {});
  }, [signed]);
  async function subscribe(addr) {
    setBusy(true);
    setMsg("");
    try {
      await api.post("/live-reminders", { email: addr });
      setOn(true);
      setOpen(false);
      setMsg(
        signed
          ? ""
          : "You’re on the list — we’ll email you before each live service.",
      );
    } catch (e) {
      setMsg(e?.response?.data?.error || "That didn’t work. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function unsubscribe() {
    setBusy(true);
    try {
      await api.delete("/live-reminders/me");
      setOn(false);
    } catch {
      /* keep state */
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ls-notify">
      <button
        type="button"
        className={`ls-btn ls-btn--primary${on ? " is-on" : ""}`}
        aria-pressed={signed ? on : undefined}
        aria-expanded={signed ? undefined : open}
        disabled={busy}
        onClick={() =>
          signed
            ? on
              ? unsubscribe()
              : subscribe(undefined)
            : on
              ? null
              : setOpen((o) => !o)
        }
      >
        {on ? "✓ You’ll be notified" : "Notify me"}
      </button>
      {!signed && open ? (
        <form
          className="ls-notifyForm"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) subscribe(email.trim());
          }}
        >
          <label className="vw-sr" htmlFor="ls-notify-email">
            Email for live service reminders
          </label>
          <input
            id="ls-notify-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={busy}>
            Notify me
          </button>
        </form>
      ) : null}
      {msg ? (
        <p className="ls-notifyMsg" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );
}

export default function LiveSchedule() {
  const [st, setSt] = useState(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let alive = true;
    api
      .get("/live-status")
      .then(({ data }) => alive && setSt(data || {}))
      .catch(() => alive && setSt({}));
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  if (!st || st.state === "disabled") return null;

  const live = st.state === "live";
  const next = st.next_live_at ? new Date(st.next_live_at) : null;
  const left = next ? Math.max(0, next.getTime() - now) : 0;
  const d = Math.floor(left / 86400000);
  const h = Math.floor((left % 86400000) / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const when = next
    ? `${next.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: TZ })} · ${next.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ })}${TZ === "America/New_York" ? " ET" : ""}`
    : "";
  const schedule = Array.isArray(st.schedule) ? st.schedule : [];

  return (
    <section className="ls-card" aria-labelledby="ls-title">
      <div className="ls-info">
        <span className={`ls-pill${live ? " is-live" : ""}`}>
          <span className="ls-dot" aria-hidden="true" />
          {live ? "LIVE NOW" : "NEXT LIVE SERVICE"}
        </span>
        <h2 id="ls-title" className="ls-title">
          {st.title || (live ? "We’re live" : "Live service")}
        </h2>
        {!live && when ? <p className="ls-when">{when}</p> : null}
        {schedule.length ? (
          <ul className="ls-chips" aria-label="Weekly services">
            {schedule.map((x) => (
              <li key={x.label}>{x.label}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="ls-side">
        {!live && next ? (
          <div
            className="ls-count"
            role="timer"
            aria-label={`Starts in ${d} days ${h} hours ${m} minutes`}
          >
            {[
              [pad(d), "DAYS"],
              [pad(h), "HRS"],
              [pad(m), "MIN"],
              [pad(s), "SEC"],
            ].map(([v, l]) => (
              <div key={l} className="ls-unit" aria-hidden="true">
                <strong>{v}</strong>
                <span>{l}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="ls-actions">
          {live ? (
            <Link to="/live-streaming" className="ls-btn ls-btn--primary">
              Watch live
            </Link>
          ) : (
            <NotifyButton />
          )}
          <Link to="/live-streaming" className="ls-btn">
            Live page
          </Link>
        </div>
      </div>
    </section>
  );
}
