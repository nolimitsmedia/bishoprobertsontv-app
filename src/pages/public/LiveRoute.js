// src/pages/public/LiveRoute.js
//
// Release 2.2: the public live page for any provider (Integration › Live
// Streaming). NLM Stream Control keeps the existing live page; YouTube, custom
// embeds and direct HLS streams use this page. Schedule: the site's Calendar.

import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveStatus } from "../../components/viewer/liveStatus";
import LiveChat from "../../components/viewer/LiveChat";
import NotifyMe from "../../components/viewer/NotifyMe";
import "../../components/viewer/Viewer.css";

const LivePage = lazy(() => import("./LivePage"));

function HlsPlayer({ src, title }) {
  const ref = useRef(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return undefined;
    let hls;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src; // Safari plays HLS natively
    } else {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (!Hls.isSupported())
            return setErr("This browser can't play the live stream.");
          hls = new Hls({ lowLatencyMode: true });
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(
            Hls.Events.ERROR,
            (_e, d) =>
              d?.fatal && setErr("The live stream isn't available right now."),
          );
        })
        .catch(() => setErr("The player could not load."));
    }
    return () => hls?.destroy();
  }, [src]);
  return (
    <>
      <video
        ref={ref}
        className="lv-video"
        controls
        autoPlay
        playsInline
        aria-label={title || "Live stream"}
      />
      {err ? (
        <p className="lv-note" role="alert">
          {err}
        </p>
      ) : null}
    </>
  );
}

function useCountdown(iso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, (Date.parse(iso || "") || 0) - now);
  return {
    d: Math.floor(left / 86400000),
    h: Math.floor((left % 86400000) / 3600000),
    m: Math.floor((left % 3600000) / 60000),
    s: Math.floor((left % 60000) / 1000),
    done: !left,
  };
}

function GenericLive({ status }) {
  const cd = useCountdown(status.next_live_at);
  const live = status.state === "live";
  const when = status.next_live_at
    ? new Date(status.next_live_at).toLocaleString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  return (
    <main className="vw-page lv-page">
      <div className="vw-pageHead">
        <h1>
          {live ? (
            <span className="lv-pill" aria-hidden="true">
              ● LIVE
            </span>
          ) : null}{" "}
          {status.title || (live ? "Live now" : "Live")}
          {live ? <span className="vw-sr"> (live now)</span> : null}
        </h1>
      </div>
      <div className="vw-pageBody">
        {live && status.player ? (
          <div className={status.chat !== false ? "lv-layout" : undefined}>
            <div className="lv-player">
              {status.player.type === "hls" ? (
                <HlsPlayer src={status.player.src} title={status.title} />
              ) : (
                <iframe
                  src={status.player.src}
                  title={status.title || "Live stream"}
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                />
              )}
            </div>
            {status.chat !== false ? <LiveChat /> : null}
          </div>
        ) : status.state === "upcoming" ? (
          <section className="lv-wait" aria-label="Next live service">
            <p className="lv-next">
              Next live service: <strong>{when}</strong>
            </p>
            <div
              className="bx-cdBoxes"
              role="timer"
              aria-label={`Starts in ${cd.d} days ${cd.h} hours ${cd.m} minutes`}
            >
              {[
                [cd.d, "Days"],
                [cd.h, "Hours"],
                [cd.m, "Minutes"],
                [cd.s, "Seconds"],
              ].map(([v, l]) => (
                <div key={l} className="bx-cdBox" aria-hidden="true">
                  <span className="bx-cdNum">{String(v).padStart(2, "0")}</span>
                  <span className="bx-cdLabel">{l}</span>
                </div>
              ))}
            </div>
            <p className="lv-note">
              This page switches to the live stream when it starts.
            </p>
            <NotifyMe />
          </section>
        ) : (
          <section className="lv-wait">
            <p className="lv-next">We're not live right now.</p>
            <NotifyMe />
            <Link to="/catalog" className="vw-linkBtn">
              Watch recent messages ›
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}

export default function LiveRoute() {
  const status = useLiveStatus();
  if (!status)
    return (
      <main className="vw-page">
        <p className="vw-empty" role="status">
          Loading…
        </p>
      </main>
    );
  if (
    status.provider === "nlm" ||
    status.provider === "unknown" ||
    !status.provider
  )
    return (
      <Suspense fallback={null}>
        <div className="lv-nlm">
          <LivePage />
          {/* Release 2.2: chat while live, reminders otherwise (under the NLM page) */}
          <div className="lv-extras">
            {status.state === "live" && status.chat !== false ? (
              <LiveChat />
            ) : (
              <NotifyMe card next={status.next_live_at} />
            )}
          </div>
        </div>
      </Suspense>
    );
  if (status.state === "disabled")
    return (
      <main className="vw-page">
        <p className="vw-empty">Live streaming isn't available on this site.</p>
      </main>
    );
  return <GenericLive status={status} />;
}
