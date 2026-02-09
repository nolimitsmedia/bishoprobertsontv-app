// src/hooks/useVideoAnalytics.js
import { useEffect, useRef } from "react";
import api from "../api";

export default function useVideoAnalytics({ videoId, videoElRef }) {
  const startedRef = useRef(false);
  const timerRef = useRef(null);
  const lastTickRef = useRef(0);

  useEffect(() => {
    const el = videoElRef?.current;
    if (!el || !videoId) return;

    const send = async (payload) => {
      try {
        await api.post("/analytics/event", payload);
      } catch {
        // silently ignore (don’t break playback)
      }
    };

    const onPlay = async () => {
      if (!startedRef.current) {
        startedRef.current = true;
        await send({ event_type: "video_play", video_id: videoId });
      }

      // Start 15s pings while playing
      lastTickRef.current = Date.now();
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        if (el.paused || el.ended) return;

        const now = Date.now();
        const diffSec = Math.round((now - lastTickRef.current) / 1000);
        lastTickRef.current = now;

        // keep increments bounded; we expect ~15
        const inc = Math.max(1, Math.min(30, diffSec));

        send({
          event_type: "video_progress",
          video_id: videoId,
          position_seconds: Math.floor(el.currentTime || 0),
          duration_seconds: Math.floor(el.duration || 0),
          watch_increment_seconds: inc,
        });
      }, 15000);
    };

    const onPauseOrEnd = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };

    const onEnded = async () => {
      onPauseOrEnd();
      await send({
        event_type: "video_complete",
        video_id: videoId,
        position_seconds: Math.floor(el.currentTime || 0),
        duration_seconds: Math.floor(el.duration || 0),
      });
    };

    // Safety: mark complete near end too (some players don’t fire ended reliably)
    const onTimeUpdate = async () => {
      if (!el.duration || !Number.isFinite(el.duration)) return;
      if (el.duration > 0 && el.currentTime / el.duration >= 0.97) {
        // send complete once
        if (!el.__brtvCompletedSent) {
          el.__brtvCompletedSent = true;
          await send({
            event_type: "video_complete",
            video_id: videoId,
            position_seconds: Math.floor(el.currentTime || 0),
            duration_seconds: Math.floor(el.duration || 0),
          });
        }
      }
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPauseOrEnd);
    el.addEventListener("ended", onEnded);
    el.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPauseOrEnd);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("timeupdate", onTimeUpdate);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      startedRef.current = false;
    };
  }, [videoId, videoElRef]);
}
