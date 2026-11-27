// src/components/admin/ReplaceVideoFile.js
//
// "Replace video file": upload a new file into the SAME message. Its title,
// details, comments, viewing history, My List / playlists and address stay the
// same. The current file keeps playing until Bunny has encoded the new one;
// then the message switches over (also in the background if this page is
// closed) and the old Bunny copy is removed.
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import api from "../../api";

export default function ReplaceVideoFile({
  videoId,
  onReplaced,
  highlight = false,
}) {
  const [state, setState] = useState("idle"); // idle | starting | uploading | processing | done | error
  const [pct, setPct] = useState(0);
  const [message, setMessage] = useState("");
  // From Wasabi
  const [wasabiOpen, setWasabiOpen] = useState(false);
  const [savedKey, setSavedKey] = useState("");
  // Source file: the names this message's file has had + possible Wasabi files
  const [source, setSource] = useState(null);
  const [copied, setCopied] = useState("");
  // Quick repair & re-import (server repairs the original with ffmpeg)
  const [repair, setRepair] = useState(null); // { state, progress, message }
  const repairTimer = useRef(null);
  const [byDate, setByDate] = useState(false);
  const [dateMatches, setDateMatches] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const uploadRef = useRef(null);
  const pollRef = useRef(null);
  const alive = useRef(true);

  const stopPolling = () => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = null;
  };

  const poll = useCallback(async () => {
    stopPolling();
    try {
      const { data } = await api.get(`/bunny/stream/replace/${videoId}/status`);
      if (!alive.current) return;
      if (data?.state === "done") {
        setState("done");
        setMessage("Replaced — the message now plays the new file.");
        onReplaced?.();
        return;
      }
      if (data?.state === "error") {
        setState("error");
        setMessage(data.message || "The new file could not be processed.");
        return;
      }
      if (data?.state === "processing" || data?.state === "uploading") {
        setState("processing");
        setPct(Math.max(0, Math.min(100, Number(data.progress) || 0)));
        pollRef.current = setTimeout(poll, 5000);
      }
    } catch {
      if (alive.current) pollRef.current = setTimeout(poll, 10000);
    }
  }, [videoId, onReplaced]);

  // on open: pick up a replacement that is still being processed
  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const { data } = await api.get(
          `/bunny/stream/replace/${videoId}/status`,
        );
        if (!alive.current) return;
        if (data?.state === "processing" || data?.state === "uploading") {
          setState("processing");
          setPct(Number(data.progress) || 0);
          pollRef.current = setTimeout(poll, 5000);
        } else if (data?.state === "error") {
          setState("error");
          setMessage(
            data.message || "The last replacement could not be processed.",
          );
        }
      } catch {
        /* idle */
      }
    })();
    return () => {
      alive.current = false;
      stopPolling();
    };
  }, [videoId, poll]);

  useEffect(() => {
    let on = true;
    api
      .get(`/bunny/stream/source/${videoId}`)
      .then(
        ({ data }) =>
          on &&
          setSource({
            files: data?.files || [],
            matches: data?.wasabi_matches || [],
            errors: data?.bunny_errors || [],
          }),
      )
      .catch(() => on && setSource({ files: [], matches: [] }));
    return () => {
      on = false;
    };
  }, [videoId]);
  async function copyName(name) {
    try {
      await navigator.clipboard.writeText(name);
      setCopied(name);
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  useEffect(() => {
    if (!highlight || !boxRef.current) return;
    boxRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    boxRef.current.querySelector("button")?.focus({ preventScroll: true });
  }, [highlight]);

  async function start(file) {
    if (!file) return;
    setState("starting");
    setPct(0);
    setMessage("");
    try {
      const { data: p } = await api.post(
        `/bunny/stream/replace/${videoId}/start`,
        { filename: file.name },
      );
      const upload = new tus.Upload(file, {
        endpoint: p.tusEndpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
        headers: {
          AuthorizationSignature: String(p.signature),
          AuthorizationExpire: String(p.expires),
          VideoId: String(p.videoId),
          LibraryId: String(p.libraryId),
        },
        metadata: {
          filename: file.name || "upload.mp4",
          filetype: file.type || "application/octet-stream",
        },
        onError: (err) => {
          if (!alive.current) return;
          setState("error");
          setMessage(
            `The upload stopped: ${err?.message || "network error"}. The message still uses its old file.`,
          );
        },
        onProgress: (sent, total) =>
          alive.current && setPct(total ? Math.round((sent / total) * 100) : 0),
        onSuccess: () => {
          if (!alive.current) return;
          setState("processing");
          setPct(0);
          pollRef.current = setTimeout(poll, 4000);
        },
      });
      uploadRef.current = upload;
      setState("uploading");
      upload.start();
    } catch (e) {
      setState("error");
      setMessage(e?.response?.data?.message || "Could not start the upload.");
    }
  }

  async function openWasabi() {
    setWasabiOpen(true);
    setResults([]);
    try {
      const { data } = await api.get(
        `/bunny/stream/replace/${videoId}/wasabi-suggest`,
      );
      setSavedKey(data?.key || "");
      setByDate(!!data?.matchedByDate);
      const cands = Array.isArray(data?.candidates) ? data.candidates : [];
      setDateMatches(cands.length > 1);
      if (cands.length > 1)
        setResults(
          cands.map((k) => ({ key: k, filename: String(k).split("/").pop() })),
        );
    } catch {
      setSavedKey("");
    }
  }
  async function searchWasabi(e) {
    e?.preventDefault?.();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const { data } = await api.get("/admin/wasabi/index", {
        params: { q, limit: 15 },
      });
      setResults(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }
  async function startFromWasabi(key) {
    setWasabiOpen(false);
    setState("starting");
    setPct(0);
    setMessage("");
    try {
      await api.post(`/bunny/stream/replace/${videoId}/from-wasabi`, { key });
      setState("processing");
      pollRef.current = setTimeout(poll, 4000);
    } catch (e) {
      setState("error");
      setMessage(
        e?.response?.data?.message || "Could not start the import from Wasabi.",
      );
    }
  }
  const fileName = (k) =>
    String(k || "")
      .split("/")
      .pop();
  const mb = (n) =>
    Number(n) > 0 ? `${(Number(n) / 1048576).toFixed(0)} MB` : "";

  const pollRepair = useCallback(async () => {
    try {
      const { data } = await api.get(`/bunny/stream/repair/${videoId}`);
      setRepair(data);
      if (data?.state === "done") {
        onReplaced?.();
        return;
      }
      if (data?.state && data.state !== "error" && data.state !== "none")
        repairTimer.current = setTimeout(pollRepair, 3000);
    } catch {
      repairTimer.current = setTimeout(pollRepair, 6000);
    }
  }, [videoId, onReplaced]);
  useEffect(() => () => clearTimeout(repairTimer.current), []);
  async function startRepair(mode = "quick") {
    setState("idle");
    setMessage("");
    try {
      const { data } = await api.post(`/bunny/stream/repair/${videoId}`, {
        mode,
      });
      setRepair(data);
      clearTimeout(repairTimer.current);
      repairTimer.current = setTimeout(pollRepair, 2000);
    } catch (e) {
      setRepair({
        state: "error",
        message: e?.response?.data?.message || "The repair could not start.",
      });
    }
  }
  const repairBusy =
    repair &&
    ["queued", "downloading", "repairing", "uploading", "encoding"].includes(
      repair.state,
    );
  const repairLabel = (r) =>
    r.state === "queued"
      ? r.message || "Waiting…"
      : r.state === "downloading"
        ? `Downloading the original file… ${r.progress || 0}%`
        : r.state === "repairing"
          ? r.mode === "full"
            ? `Converting the file… ${r.progress || 0}% (full conversion — slow)`
            : /second attempt/.test(r.message || "")
              ? `Repairing the file (second attempt)… ${r.progress || 0}%`
              : `Repairing the file… ${r.progress || 0}%`
          : r.state === "uploading"
            ? `Sending the repaired file to Bunny… ${r.progress || 0}%`
            : `Bunny is encoding the repaired file… ${r.progress || 0}%`;

  async function cancel() {
    try {
      await uploadRef.current?.abort(true);
    } catch {
      /* ignore */
    }
    stopPolling();
    try {
      await api.delete(`/bunny/stream/replace/${videoId}`);
    } catch {
      /* ignore */
    }
    setState("idle");
    setPct(0);
    setMessage("Cancelled. The message still uses its current file.");
  }

  const busy =
    state === "starting" || state === "uploading" || state === "processing";
  return (
    <div ref={boxRef} className={`rv-box${highlight ? " is-highlight" : ""}`}>
      <div className="rv-head">
        <strong>Replace video file</strong>
        {busy ? null : (
          <div className="rv-actions">
            <button
              type="button"
              className="rv-btn"
              onClick={() => inputRef.current?.click()}
            >
              {state === "error" ? "Choose another file" : "Choose new file"}
            </button>
            <button
              type="button"
              className="rv-btn rv-btn--ghost"
              aria-expanded={wasabiOpen}
              onClick={() => (wasabiOpen ? setWasabiOpen(false) : openWasabi())}
            >
              From Wasabi
            </button>
          </div>
        )}
      </div>
      <p className="rv-hint">
        Uploads a new file into this message. Its title, details, comments,
        viewing history, My List and playlists, and its address stay the same.
        The current file keeps playing until the new one is ready.
      </p>
      {source ? (
        <div className="rv-source">
          <div className="rv-sourceTitle">Source file</div>
          {source.errors?.length ? (
            <div className="rv-why" role="note">
              <strong>Why Bunny couldn’t encode it</strong>
              {source.errors.map((e) => (
                <span key={e.label}>
                  {e.label}:{" "}
                  {e.reasons?.length
                    ? e.reasons.join(" · ")
                    : `no reason given by Bunny${e.status ? ` (status ${e.status})` : ""}`}
                </span>
              ))}
              <span className="rv-whyTip">
                If every copy of the file fails, convert it (free HandBrake,
                preset “Fast 1080p30”, MP4) and upload the converted file with
                “Choose new file”.
              </span>
            </div>
          ) : null}
          {source.files.length ? (
            <ul className="rv-sourceList">
              {source.files.map((f) => (
                <li key={`${f.label}-${f.name}`}>
                  <div className="rv-sourceText">
                    <span className="rv-sourceLabel">{f.label}</span>
                    <strong className="rv-sourceName">{f.name}</strong>
                    {f.path && f.path !== f.name ? (
                      <small className="rv-sourcePath" title={f.path}>
                        {f.path}
                      </small>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="rv-btn rv-btn--ghost"
                    onClick={() => copyName(f.name)}
                    aria-label={`Copy ${f.name}`}
                  >
                    {copied === f.name ? "Copied" : "Copy"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rv-hint">
              No file name is saved for this message. Search for it under “From
              Wasabi”.
            </p>
          )}
          {source.matches.length && !busy ? (
            <>
              <div className="rv-sourceTitle">Possible Wasabi files</div>
              <ul className="rv-results">
                {source.matches.map((k) => (
                  <li key={k}>
                    <span className="rv-file" title={k}>
                      {fileName(k)}
                    </span>
                    <button
                      type="button"
                      className="rv-btn rv-btn--ghost"
                      onClick={() => startFromWasabi(k)}
                      aria-label={`Use ${fileName(k)}`}
                    >
                      Use
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          start(f);
        }}
      />
      {wasabiOpen && !busy ? (
        <div className="rv-wasabi">
          {savedKey ? (
            <div className="rv-saved">
              <span>
                {byDate
                  ? "Matched by the date in the title:"
                  : "Saved Wasabi file:"}{" "}
                <strong>{fileName(savedKey)}</strong>
              </span>
              <button
                type="button"
                className="rv-btn"
                onClick={() => startFromWasabi(savedKey)}
              >
                Re-import this file
              </button>
            </div>
          ) : (
            <p className="rv-hint">
              {dateMatches
                ? "Several Wasabi files have this message’s date — pick the right one below, or search."
                : "No Wasabi file is saved for this message — search for it below."}
            </p>
          )}
          <form className="rv-search" onSubmit={searchWasabi}>
            <label className="rv-sr" htmlFor={`rv-q-${videoId}`}>
              Search Wasabi files
            </label>
            <input
              id={`rv-q-${videoId}`}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Wasabi files by name…"
            />
            <button
              type="submit"
              className="rv-btn rv-btn--ghost"
              disabled={searching || !query.trim()}
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          {results.length ? (
            <ul className="rv-results">
              {results.map((r) => (
                <li key={r.key}>
                  <span className="rv-file" title={r.key}>
                    {r.filename || fileName(r.key)} <small>{mb(r.size)}</small>
                  </span>
                  <button
                    type="button"
                    className="rv-btn rv-btn--ghost"
                    onClick={() => startFromWasabi(r.key)}
                  >
                    Use
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim() && !searching ? (
            <p className="rv-hint">
              No match. Not listed? Refresh the file list on the Wasabi Import
              page.
            </p>
          ) : null}
        </div>
      ) : null}
      {(source?.errors?.length || state === "error" || repair) && !busy ? (
        <div className="rv-repair">
          {!repairBusy && repair?.state !== "done" ? (
            <>
              <button
                type="button"
                className="rv-btn"
                onClick={() => startRepair("quick")}
              >
                Repair &amp; re-import
              </button>
              <span className="rv-hint">
                For files Bunny can’t encode: the server repairs the original
                file (timing and sound; the picture is kept as is) and sends it
                to Bunny. Takes a few minutes.
              </span>
            </>
          ) : null}
          {repairBusy ? (
            <div className="rv-progressWrap" role="status">
              <div className="rv-progressLabel">{repairLabel(repair)}</div>
              <div className="rv-bar" aria-hidden="true">
                <span
                  style={{ width: `${Math.max(4, repair.progress || 0)}%` }}
                />
              </div>
              <p className="rv-hint">
                You can leave this page — it carries on, and the message
                switches over when Bunny is ready.
              </p>
            </div>
          ) : null}
          {repair?.state === "done" ? (
            <p className="rv-status is-ok" role="status">
              ✓ {repair.message}
            </p>
          ) : null}
          {repair?.state === "error" ? (
            <>
              <p className="rv-status is-error" role="alert">
                {repair.message}
              </p>
              {repair.suggestFull ? (
                <div className="rv-full">
                  <button
                    type="button"
                    className="rv-btn rv-btn--ghost"
                    onClick={() => startRepair("full")}
                  >
                    Full conversion (slow)
                  </button>
                  <span className="rv-hint">
                    Re-encodes the picture as well, like HandBrake on a
                    computer. Takes about as long as the video or more; it runs
                    in the background, one at a time.
                  </span>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      {state === "starting" ? (
        <p className="rv-status" role="status">
          Preparing the upload…
        </p>
      ) : null}
      {state === "uploading" || state === "processing" ? (
        <div className="rv-progressWrap" role="status">
          <div className="rv-progressLabel">
            {state === "uploading"
              ? `Uploading… ${pct}%`
              : `Bunny is encoding the new file… ${pct}%`}
          </div>
          <div className="rv-bar" aria-hidden="true">
            <span
              style={{ width: `${state === "processing" && !pct ? 6 : pct}%` }}
            />
          </div>
          {state === "processing" ? (
            <p className="rv-hint">
              You can leave this page — the message switches to the new file
              automatically when it is ready.
            </p>
          ) : null}
          <button
            type="button"
            className="rv-btn rv-btn--ghost"
            onClick={cancel}
          >
            Cancel
          </button>
        </div>
      ) : null}
      {state === "done" ? (
        <p className="rv-status is-ok" role="status">
          ✓ {message}
        </p>
      ) : null}
      {state === "error" ? (
        <p className="rv-status is-error" role="alert">
          {message}
        </p>
      ) : null}
      {state === "idle" && message ? (
        <p className="rv-status" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
