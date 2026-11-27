// src/pages/admin/AdminLiveSettings.js
//
// Release 2.2 — Integration › Live Streaming: choose the live platform.
// NLM Stream Control, YouTube Live, a custom embed, or a direct HLS stream.
// The schedule comes from the Calendar (live events) for every platform.

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import "./AdminMedia.css";
import "./AdminTeam.css";
import "./AdminPages.css";

const PROVIDERS = [
  [
    "nlm",
    "NLM Stream Control",
    "No Limits Media's live streaming platform. Live status comes from your channel.",
  ],
  [
    "youtube",
    "YouTube Live",
    "Stream on YouTube and show it here. Add an API key for automatic live detection.",
  ],
  [
    "embed",
    "Custom embed",
    "Any platform's embed code or player link (Restream, Boxcast, Facebook, Vimeo…).",
  ],
  [
    "hls",
    "Direct stream (HLS)",
    "An https .m3u8 address from your own streaming server.",
  ],
  ["none", "Off", "Hide live features (no LIVE badge, no live page player)."],
];
const errText = (e, f) => e?.response?.data?.error || f;

export default function AdminLiveSettings() {
  const [s, setS] = useState(null);
  const [envChannel, setEnvChannel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    api
      .get("/live-settings/admin")
      .then(({ data }) => {
        setS(data.settings);
        setEnvChannel(data.env_channel_id || "");
      })
      .catch((e) =>
        setNotice({
          tone: "error",
          text: errText(e, "Live settings could not be loaded."),
        }),
      );
  }, []);
  if (!s)
    return (
      <main className="ml-page tm-page">
        <h1>Live Platform</h1>
        {notice ? (
          <div className="ml-notice error" role="alert">
            {notice.text}
          </div>
        ) : (
          <p className="ml-help" role="status">
            Loading…
          </p>
        )}
      </main>
    );
  const set = (patch) => setS((x) => ({ ...x, ...patch }));
  const setP = (prov, patch) =>
    setS((x) => ({ ...x, [prov]: { ...x[prov], ...patch } }));
  const body = (extra = {}) => ({
    ...s,
    youtube: { ...s.youtube, api_key: newKey },
    ...extra,
  });
  async function save() {
    setBusy("save");
    setNotice(null);
    try {
      const { data } = await api.put("/live-settings/admin", body());
      setS(data.settings);
      setNewKey("");
      setNotice({
        tone: "success",
        text: "Live settings saved. The site uses them right away.",
      });
    } catch (e) {
      setNotice({ tone: "error", text: errText(e, "Could not save.") });
    } finally {
      setBusy("");
    }
  }
  async function test() {
    setBusy("test");
    setNotice(null);
    try {
      const { data } = await api.post("/live-settings/admin/test", body());
      setNotice({ tone: "success", text: data.message });
    } catch (e) {
      setNotice({ tone: "error", text: errText(e, "The test could not run.") });
    } finally {
      setBusy("");
    }
  }
  async function removeKey() {
    setBusy("save");
    try {
      const { data } = await api.put("/live-settings/admin", {
        ...s,
        youtube: { ...s.youtube, remove_api_key: true },
      });
      setS(data.settings);
      setNotice({ tone: "success", text: "API key removed." });
    } catch (e) {
      setNotice({
        tone: "error",
        text: errText(e, "Could not remove the key."),
      });
    } finally {
      setBusy("");
    }
  }
  return (
    <main className="ml-page tm-page">
      <div className="ml-header">
        <div>
          <h1>Live Platform</h1>
          <p>
            Choose the platform that streams your live services. Schedule them
            in the <Link to="/admin/content/calendar">Calendar</Link> as live
            events.
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

      <section className="tm-card" aria-labelledby="lv-provider">
        <h2 id="lv-provider">Platform</h2>
        <fieldset className="lvs-providers">
          <legend className="ml-help">Your live stream comes from</legend>
          {PROVIDERS.map(([v, label, help]) => (
            <label
              key={v}
              className={`lvs-provider${s.provider === v ? " is-on" : ""}`}
            >
              <input
                type="radio"
                name="provider"
                value={v}
                checked={s.provider === v}
                onChange={() => set({ provider: v })}
              />
              <span>
                <strong>{label}</strong>
                <small>{help}</small>
              </span>
            </label>
          ))}
        </fieldset>
      </section>

      {s.provider !== "none" ? (
        <section className="tm-card" aria-labelledby="lv-details">
          <h2 id="lv-details">Connection</h2>
          {s.provider === "nlm" ? (
            <div className="ss-grid">
              <label>
                Channel ID
                <input
                  className="ml-input"
                  value={s.nlm.channel_id || ""}
                  placeholder={
                    envChannel
                      ? `${envChannel} (from server settings)`
                      : "e.g. gworrdns"
                  }
                  onChange={(e) =>
                    setP("nlm", { channel_id: e.target.value.trim() })
                  }
                />
              </label>
              <p className="ml-help">
                Leave empty to use the channel set on the server. The API token
                stays in the server settings.
              </p>
            </div>
          ) : null}
          {s.provider === "youtube" ? (
            <div className="ss-grid">
              <label>
                YouTube channel ID
                <input
                  className="ml-input"
                  value={s.youtube.channel_id || ""}
                  placeholder="UC…"
                  onChange={(e) =>
                    setP("youtube", { channel_id: e.target.value.trim() })
                  }
                />
              </label>
              <label>
                Live video ID (optional)
                <input
                  className="ml-input"
                  value={s.youtube.video_id || ""}
                  placeholder="For a specific scheduled stream"
                  onChange={(e) =>
                    setP("youtube", { video_id: e.target.value.trim() })
                  }
                />
              </label>
              <label>
                YouTube API key (optional)
                <input
                  className="ml-input"
                  type="password"
                  autoComplete="off"
                  value={newKey}
                  placeholder={
                    s.youtube.has_api_key
                      ? `Saved, ending in ${s.youtube.api_key_last4}. Type to replace`
                      : "For automatic live detection"
                  }
                  onChange={(e) => setNewKey(e.target.value)}
                />
              </label>
              {s.youtube.has_api_key ? (
                <div className="tm-addRow">
                  <button
                    type="button"
                    className="ml-btn"
                    onClick={removeKey}
                    disabled={busy === "save"}
                  >
                    Remove API key
                  </button>
                </div>
              ) : null}
              <p className="ml-help">
                Without an API key, the page shows your channel's live player
                during Calendar live events or while “We're live now” is on.
              </p>
            </div>
          ) : null}
          {s.provider === "embed" ? (
            <div className="lvs-block">
              <label htmlFor="lvs-embed">Embed code or player link</label>
              <textarea
                id="lvs-embed"
                aria-describedby="lvs-embed-help"
                className="ml-input lvs-code"
                rows={4}
                value={s.embed.code || ""}
                placeholder='<iframe src="https://…"></iframe>'
                onChange={(e) => setP("embed", { code: e.target.value })}
              />
              <span id="lvs-embed-help" className="ml-help">
                Only the player's https address is used; scripts never run on
                your site.
              </span>
            </div>
          ) : null}
          {s.provider === "hls" ? (
            <div className="lvs-block">
              <label htmlFor="lvs-hls">Stream address (.m3u8)</label>
              <input
                id="lvs-hls"
                aria-describedby="lvs-hls-help"
                className="ml-input"
                value={s.hls.url || ""}
                placeholder="https://stream.example.org/live/index.m3u8"
                onChange={(e) => setP("hls", { url: e.target.value.trim() })}
              />
              <span id="lvs-hls-help" className="ml-help">
                The site checks this address to know when you're live.
              </span>
            </div>
          ) : null}
        </section>
      ) : null}

      {s.provider !== "none" ? (
        <section className="tm-card" aria-labelledby="lv-status">
          <h2 id="lv-status">Going live</h2>
          <label className="tm-check lvs-onair">
            <input
              type="checkbox"
              checked={!!s.on_air}
              onChange={(e) => set({ on_air: e.target.checked })}
            />
            <span>
              <strong>We're live now</strong> — show the LIVE badge and the
              player now, whatever the schedule says. Turn off when the stream
              ends.
            </span>
          </label>
          <label className="tm-check lvs-onair">
            <input
              type="checkbox"
              checked={s.chat_enabled !== false}
              onChange={(e) => set({ chat_enabled: e.target.checked })}
            />
            <span>
              <strong>Live chat</strong> — show a chat next to the live player.
              Signed-in members can post; Website and Community Managers can
              delete messages.
            </span>
          </label>
          <div className="ss-grid">
            <label>
              Live page title (optional)
              <input
                className="ml-input"
                value={s.title || ""}
                maxLength={120}
                placeholder="Uses the Calendar event's title"
                onChange={(e) => set({ title: e.target.value })}
              />
            </label>
            <label>
              Event length when the Calendar has no end time: {s.window_minutes}{" "}
              minutes
              <input
                type="range"
                min={15}
                max={600}
                step={15}
                value={s.window_minutes || 120}
                onChange={(e) =>
                  set({ window_minutes: Number(e.target.value) })
                }
              />
            </label>
          </div>
        </section>
      ) : null}

      <div className="tm-addRow">
        <button
          type="button"
          className="ml-btn"
          onClick={test}
          disabled={!!busy}
        >
          {busy === "test" ? "Testing…" : "Test connection"}
        </button>
        <button
          type="button"
          className="ml-btn ml-btnPrimary"
          onClick={save}
          disabled={!!busy}
        >
          {busy === "save" ? "Saving…" : "Save live settings"}
        </button>
      </div>
    </main>
  );
}
