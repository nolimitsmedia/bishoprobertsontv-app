// src/components/admin/TrimVideo.js — "Trim video" on the video edit page.
// The server cuts the message's ORIGINAL file (Wasabi / Bunny Storage / Bunny
// Stream's kept original) between Start and End without re-encoding the
// picture, and the safe Replace flow switches the message over when Bunny is
// ready. The original file is not changed, so a trim can be undone with
// Replace video file › From Wasabi › Re-import.
import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "../../api";
import { confirmDialog } from "../ui/Dialogs";

// "1:05:30", "65:30" or "3930" → seconds (NaN when invalid)
export function parseTime(v) {
  const s = String(v || "").trim();
  if (!s) return NaN;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const parts = s.split(":").map((x) => x.trim());
  if (parts.length > 3 || parts.some((x) => !/^\d+(\.\d+)?$/.test(x)))
    return NaN;
  return parts.reduce((acc, x) => acc * 60 + Number(x), 0);
}
export function fmtTime(sec) {
  const t = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export default function TrimVideo({ videoId, duration, onDone }) {
  // a trimmed message: times are on the FULL recording (trims always cut from it)
  const [trimmed, setTrimmed] = useState(null); // { start, end, full_duration }
  const total = Number(trimmed?.full_duration) || Number(duration) || 0;
  const [start, setStart] = useState("0:00");
  const [end, setEnd] = useState(total ? fmtTime(total) : "");
  const loadTrim = useCallback(async () => {
    try {
      const { data } = await api.get(`/bunny/stream/source/${videoId}`);
      const t = data?.trim || null;
      setTrimmed(t);
      if (t) {
        setStart(fmtTime(t.start));
        setEnd(fmtTime(t.end));
      }
    } catch {
      /* keep defaults */
    }
  }, [videoId]);
  useEffect(() => {
    loadTrim();
  }, [loadTrim]);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const timer = useRef(null);

  useEffect(() => {
    if (total) setEnd((cur) => cur || fmtTime(total));
  }, [total]);

  const poll = useCallback(async () => {
    try {
      const { data } = await api.get(`/bunny/stream/repair/${videoId}`);
      // only trims: a repair (or a job without a type) is shown by the Replace card
      if (data?.kind !== "trim") return;
      setJob(data);
      if (data?.state === "done") {
        onDone?.();
        loadTrim();
        return;
      }
      if (data?.state && !["error", "none"].includes(data.state))
        timer.current = setTimeout(poll, 3000);
    } catch {
      timer.current = setTimeout(poll, 6000);
    }
  }, [videoId, onDone, loadTrim]);
  // pick up a trim that is already running
  useEffect(() => {
    poll();
    return () => clearTimeout(timer.current);
  }, [poll]);

  const s = parseTime(start);
  const e = parseTime(end);
  const valid =
    Number.isFinite(s) &&
    Number.isFinite(e) &&
    s >= 0 &&
    e > s &&
    e - s >= 10 &&
    (!total || e <= total + 1) &&
    !(s === 0 && total && e >= total);
  const running =
    job &&
    ["queued", "downloading", "repairing", "uploading", "encoding"].includes(
      job.state,
    );

  async function trim() {
    setError("");
    if (!valid) {
      setError(
        "Enter a start and an end time (at least 10 seconds apart, within the video).",
      );
      return;
    }
    const ok = await confirmDialog({
      title: "Trim this message?",
      message: `Keep ${fmtTime(s)} – ${fmtTime(e)} (${fmtTime(e - s)}).\n\n${"The message keeps playing its full video until the trimmed one is ready. The original file is not changed, so you can undo this later with Replace video file › From Wasabi."}`,
      confirmLabel: "Trim",
    });
    if (!ok) return;
    try {
      const { data } = await api.post(`/bunny/stream/trim/${videoId}`, {
        start: s,
        end: e,
      });
      setJob(data);
      clearTimeout(timer.current);
      timer.current = setTimeout(poll, 2000);
    } catch (err) {
      setError(err?.response?.data?.message || "The trim could not start.");
    }
  }

  async function restore() {
    const ok = await confirmDialog({
      title: "Restore the full video?",
      message: `The message will play the whole recording again (${fmtTime(total)}). It keeps playing the trimmed video until the full one is ready.`,
      confirmLabel: "Restore",
    });
    if (!ok) return;
    setError("");
    try {
      const { data } = await api.post(`/bunny/stream/trim/${videoId}`, {
        restore: true,
      });
      setJob(data);
      clearTimeout(timer.current);
      timer.current = setTimeout(poll, 2000);
    } catch (err) {
      setError(err?.response?.data?.message || "The restore could not start.");
    }
  }

  const label = (j) =>
    j.state === "queued"
      ? j.message || "Waiting…"
      : j.state === "downloading"
        ? `Downloading the original file… ${j.progress || 0}%`
        : j.state === "repairing"
          ? `Cutting the video… ${j.progress || 0}%`
          : j.state === "uploading"
            ? `Sending the trimmed video to Bunny… ${j.progress || 0}%`
            : `Bunny is encoding the trimmed video… ${j.progress || 0}%`;

  return (
    <div className="rv-box tv-box">
      <div className="rv-head">
        <strong>Trim video</strong>
        {total ? (
          <span className="tv-len">
            {trimmed ? "Full recording" : "Length"} {fmtTime(total)}
          </span>
        ) : null}
      </div>
      <p className="rv-hint">
        Cut the start or end, for example a countdown before the service. Times
        as 1:05:30 or 65:30.
      </p>
      {trimmed && !running ? (
        <div className="tv-note">
          <span>
            Trimmed: keeps {fmtTime(trimmed.start)} – {fmtTime(trimmed.end)} of
            the full {fmtTime(total)} recording. The times below are on the full
            recording.
          </span>
          <button
            type="button"
            className="rv-btn rv-btn--ghost"
            onClick={restore}
          >
            Restore full video
          </button>
        </div>
      ) : null}
      {!running ? (
        <>
          <div className="tv-row">
            <label className="tv-field">
              <span>Start</span>
              <input
                value={start}
                onChange={(ev) => setStart(ev.target.value)}
                placeholder="0:00"
                inputMode="numeric"
              />
            </label>
            <label className="tv-field">
              <span>End</span>
              <input
                value={end}
                onChange={(ev) => setEnd(ev.target.value)}
                placeholder={total ? fmtTime(total) : "1:00:00"}
                inputMode="numeric"
              />
            </label>
            <button
              type="button"
              className="rv-btn"
              onClick={trim}
              disabled={!valid}
            >
              Trim
            </button>
          </div>
          {valid ? (
            <p className="rv-hint">
              Keeps {fmtTime(e - s)}
              {total ? ` of ${fmtTime(total)}` : ""}. The cut lands on the
              nearest keyframe, usually within a second or two.
            </p>
          ) : null}
          {!total ? (
            <p className="rv-hint">
              Length unknown — Videos › More actions › “Sync durations from
              Bunny” fills it in.
            </p>
          ) : null}
        </>
      ) : (
        <div className="rv-progressWrap" role="status">
          <div className="rv-progressLabel">{label(job)}</div>
          <div className="rv-bar" aria-hidden="true">
            <span style={{ width: `${Math.max(4, job.progress || 0)}%` }} />
          </div>
          <p className="rv-hint">
            You can leave this page — the message switches to the trimmed video
            when Bunny is ready.
          </p>
        </div>
      )}
      {job?.state === "done" ? (
        <p className="rv-status is-ok" role="status">
          ✓ {job.message}
        </p>
      ) : null}
      {job?.state === "error" ? (
        <p className="rv-status is-error" role="alert">
          {job.message}
        </p>
      ) : null}
      {error ? (
        <p className="rv-status is-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
