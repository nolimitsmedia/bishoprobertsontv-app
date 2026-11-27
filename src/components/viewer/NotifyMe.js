// src/components/viewer/NotifyMe.js
//
// Release 2.2 Part B: "Notify me" — an email reminder before live services.
// Members: one click (their account email). Visitors: enter an email.

import React, { useEffect, useState } from "react";
import api from "../../api";
import { isSignedIn } from "./viewerStore";

// e.g. "Sunday, Nov 15 · 10:00 AM ET"
function nextLabel(iso) {
  const d = new Date(iso || "");
  if (!iso || Number.isNaN(d.getTime()) || d.getTime() < Date.now()) return "";
  const tz = process.env.REACT_APP_CALENDAR_TIMEZONE || "America/New_York";
  const day = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: tz,
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  return `${day} · ${time} ${tz === "America/New_York" ? "ET" : ""}`.trim();
}

// card: a titled panel ("Never miss a live service"), used under the live player.
// next: the next live service time (ISO), shown on the card in Eastern Time.
export default function NotifyMe({ card = false, next = null }) {
  const signedIn = isSignedIn();
  const [subscribed, setSubscribed] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!signedIn) return;
    api
      .get("/live-reminders/me")
      .then(({ data }) => setSubscribed(!!data?.subscribed))
      .catch(() => {});
  }, [signedIn]);
  async function subscribe(e) {
    e?.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const hp = e?.currentTarget?.elements?.website?.value || "";
      await api.post("/live-reminders", {
        email: signedIn ? undefined : email.trim(),
        website: hp,
      });
      setSubscribed(true);
      setMsg({
        ok: true,
        text: "You're on the list. We'll email you before each live service.",
      });
    } catch (err) {
      setMsg({
        ok: false,
        text: err?.response?.data?.error || "Could not save your reminder.",
      });
    } finally {
      setBusy(false);
    }
  }
  async function stop() {
    setBusy(true);
    try {
      await api.delete("/live-reminders/me");
      setSubscribed(false);
      setMsg({ ok: true, text: "Live service reminders turned off." });
    } catch {
      setMsg({ ok: false, text: "Could not update. Please try again." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={card ? "nm-box nm-card" : "nm-box"}>
      {card ? (
        <div className="nm-cardText">
          {nextLabel(next) ? (
            <p className="nm-next">
              <span aria-hidden="true">📅</span> Next live service:{" "}
              <strong>{nextLabel(next)}</strong>
            </p>
          ) : null}
          <h2 className="nm-title">Never miss a live service</h2>
          <p className="nm-sub">
            We'll email you about 30 minutes before we go live.
          </p>
        </div>
      ) : null}
      {signedIn && subscribed ? (
        <p className="nm-on">
          <span aria-hidden="true">🔔</span> You'll get an email before each
          live service.{" "}
          <button
            type="button"
            className="nm-link"
            onClick={stop}
            disabled={busy}
          >
            Turn off
          </button>
        </p>
      ) : signedIn ? (
        <button
          type="button"
          className="nm-btn"
          onClick={() => subscribe()}
          disabled={busy}
        >
          <span aria-hidden="true">🔔</span> Notify me before live services
        </button>
      ) : (
        <form className="nm-form" onSubmit={subscribe}>
          <label htmlFor="nm-email">
            Get an email before each live service
          </label>
          <span className="nm-row">
            <input
              id="nm-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="nm-btn" disabled={busy}>
              <span aria-hidden="true">🔔</span> Notify me
            </button>
          </span>
          <span className="nm-hp" aria-hidden="true">
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </span>
        </form>
      )}
      {msg ? (
        <p
          className={msg.ok ? "nm-msg" : "nm-msg nm-err"}
          role={msg.ok ? "status" : "alert"}
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
