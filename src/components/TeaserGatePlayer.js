// src/components/TeaserGatePlayer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

// tiny helper: detect Bunny embed vs raw src
function isBunnyEmbed(url) {
  return /\/\/iframe\.mediadelivery\.net\/embed\//i.test(url || "");
}

export default function TeaserGatePlayer({
  url,
  title = "Video",
  isLoggedIn = false, // computed by your app (e.g., from /auth/me)
  isGated = false, // use your "is_premium" or visibility-level
  teaserSeconds = 300, // 5 minutes default
  onRequireLogin, // optional callback when gate appears
}) {
  const absUrl = String(url || "");
  const iframeRef = useRef(null);
  const videoRef = useRef(null);
  const [gated, setGated] = useState(false);
  const [started, setStarted] = useState(false);
  const [stoppedAt, setStoppedAt] = useState(null);

  const gatedActive = useMemo(
    () => isGated && !isLoggedIn,
    [isGated, isLoggedIn]
  );

  // --- Native <video> enforcement (accurate to media time) ---
  useEffect(() => {
    if (!absUrl || isBunnyEmbed(absUrl)) return;
    const el = videoRef.current;
    if (!el) return;

    const onTime = () => {
      if (!gatedActive) return;
      if (el.currentTime >= teaserSeconds) {
        el.pause();
        setGated(true);
        setStoppedAt(teaserSeconds);
        onRequireLogin?.();
      }
    };
    const onPlay = () => setStarted(true);

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
    };
  }, [absUrl, teaserSeconds, gatedActive, onRequireLogin]);

  // --- Bunny iframe enforcement (approximate wall time) ---
  // For a quick MVP without player.js, we use wall time since first play click.
  // (Good enough for teaser gating; full protection comes with signed playback.)
  useEffect(() => {
    if (!absUrl || !isBunnyEmbed(absUrl)) return;
    if (!gatedActive) return;

    let timerId = null;
    let startedAt = 0;

    const startIfNeeded = () => {
      if (started) return;
      setStarted(true);
      startedAt = Date.now();
      timerId = window.setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        if (elapsed >= teaserSeconds) {
          setGated(true);
          setStoppedAt(teaserSeconds);
          onRequireLogin?.();
          window.clearInterval(timerId);
          timerId = null;
        }
      }, 250);
    };

    // We can’t easily tap into the iframe internals without player.js.
    // So we start counting when user clicks anywhere on the iframe area.
    const clickTarget = iframeRef.current;
    clickTarget?.addEventListener("click", startIfNeeded);
    return () => {
      clickTarget?.removeEventListener("click", startIfNeeded);
      if (timerId) window.clearInterval(timerId);
    };
  }, [absUrl, teaserSeconds, gatedActive, started, onRequireLogin]);

  // Render
  return (
    <div style={{ position: "relative" }}>
      {!absUrl ? (
        <div className="vd-video-fallback">No video</div>
      ) : isBunnyEmbed(absUrl) ? (
        <iframe
          ref={iframeRef}
          src={absUrl}
          allow="autoplay; fullscreen; picture-in-picture"
          loading="lazy"
          style={{
            width: "100%",
            aspectRatio: "16/9",
            border: 0,
            display: "block",
          }}
          title={title}
        />
      ) : (
        <video
          ref={videoRef}
          src={absUrl}
          controls
          preload="metadata"
          playsInline
          crossOrigin="anonymous"
          style={{ width: "100%", display: "block" }}
        />
      )}

      {gated && gatedActive && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(0deg, rgba(0,0,0,0.75), rgba(0,0,0,0.5))",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            textAlign: "center",
            padding: 24,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
            Preview ended at {Math.floor(stoppedAt)}s
          </div>
          <div style={{ opacity: 0.85 }}>Log in to watch the full message.</div>
          <div style={{ height: 12 }} />
          <a className="btn" href="/login">
            Log in / Create account
          </a>
        </div>
      )}
    </div>
  );
}
