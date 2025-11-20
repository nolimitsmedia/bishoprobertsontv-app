// src/pages/tv/Activate.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";

const CODE_LEN = 6;

const CSS = `
:root { --h:56px; --r:14px; }
.wrap { max-width: 560px; margin: 0 auto; padding: 24px 16px 48px; }
.h1 { font-size: 28px; font-weight: 800; letter-spacing: -.01em; margin: 0 0 6px; }
.muted { color:#64748b; font-size:14px; }
.card { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:18px; }

.code-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin: 14px 0 12px; }
.code {
  height: var(--h); border-radius: var(--r); border: 1px solid #e2e8f0;
  text-align: center; font-size: 28px; font-weight: 800; text-transform: uppercase;
  outline: none; background:#f8fafc; transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
}
.code:focus { border-color:#93c5fd; background:#fff; box-shadow:0 0 0 3px rgba(147,197,253,.45); }

.btn { height:44px; border-radius:12px; padding:0 16px; font-weight:800; border:1px solid transparent; cursor:pointer; }
.btn.primary { background:#2563eb; color:#fff; }
.btn.primary:hover { background:#1e40af; }
.btn.ghost { background:#fff; border-color:#e2e8f0; color:#0f172a; }
.btn.danger { background:#ef4444; color:#fff; }

.row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
.top { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px; }
.pill { background:#2563eb; color:#fff; border-radius:999px; padding:6px 12px; font-weight:700; text-decoration:none; }

.success {
  display:flex; gap:12px; align-items:flex-start; padding:12px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:12px; color:#064e3b; font-weight:700;
}
.err { padding:10px; background:#fef2f2; color:#7f1d1d; border:1px solid #fecaca; border-radius:10px; font-weight:700; margin-bottom:10px; }
`;

export default function TvActivate() {
  const nav = useNavigate();

  const [vals, setVals] = useState(Array(CODE_LEN).fill(""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [linked, setLinked] = useState(null); // {device}

  const refs = useRef(
    Array.from({ length: CODE_LEN }, () => React.createRef())
  );

  // focus first box on mount
  useEffect(() => {
    refs.current[0]?.current?.focus();
  }, []);

  const code = useMemo(() => vals.join("").toUpperCase(), [vals]);
  const full = code.length === CODE_LEN && !code.includes("");

  function setBox(i, v) {
    const up = v.replace(/[^a-z0-9]/gi, "").toUpperCase();
    if (!up) return;
    setVals((prev) => {
      const next = prev.slice();
      // allow pasting multiple chars into a single box
      if (up.length > 1) {
        for (let k = 0; k < up.length && i + k < CODE_LEN; k++)
          next[i + k] = up[k];
        // move focus
        const to = Math.min(CODE_LEN - 1, i + up.length);
        setTimeout(() => refs.current[to]?.current?.focus(), 0);
        return next;
      }
      next[i] = up;
      // move to next
      if (i < CODE_LEN - 1)
        setTimeout(() => refs.current[i + 1]?.current?.focus(), 0);
      return next;
    });
  }

  function onKey(i, e) {
    if (e.key === "Backspace") {
      if (vals[i]) {
        setVals((prev) => {
          const next = prev.slice();
          next[i] = "";
          return next;
        });
      } else if (i > 0) {
        refs.current[i - 1]?.current?.focus();
        setVals((prev) => {
          const next = prev.slice();
          next[i - 1] = "";
          return next;
        });
      }
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.current?.focus();
    if (e.key === "ArrowRight" && i < CODE_LEN - 1)
      refs.current[i + 1]?.current?.focus();
  }

  async function submit(e) {
    e?.preventDefault();
    if (!full || busy) return;
    setBusy(true);
    setErr("");
    try {
      const { data } = await api.post("/devices/activation/complete", {
        code,
        device_type: "tv",
        device_name: "Browser TV Mock",
      });
      setLinked(data?.device || { name: "TV App" });
    } catch (e2) {
      setErr(
        e2?.response?.data?.message || "Invalid or expired code. Try again."
      );
      setLinked(null);
    } finally {
      setBusy(false);
    }
  }

  function clearAll() {
    setVals(Array(CODE_LEN).fill(""));
    setErr("");
    setLinked(null);
    setTimeout(() => refs.current[0]?.current?.focus(), 0);
  }

  return (
    <div className="wrap">
      <style>{CSS}</style>

      <div className="top">
        <div>
          <h1 className="h1">Activate on TV</h1>
          <div className="muted">
            Enter the 6-character code you got on your account.
          </div>
        </div>
        <Link className="pill" to="/account/apps">
          Mobile & TV Apps
        </Link>
      </div>

      <div className="card">
        {err ? <div className="err">{err}</div> : null}

        {linked ? (
          <>
            <div className="success" role="status">
              ✅ Device linked: {linked.name || "TV"} (id #{linked.id})
            </div>
            <div style={{ marginTop: 12 }} className="row">
              <Link className="btn ghost" to="/account/apps">
                View my devices
              </Link>
              <button className="btn danger" onClick={clearAll}>
                Link another
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="code-grid" aria-label="Activation code input">
              {Array.from({ length: CODE_LEN }).map((_, i) => (
                <input
                  key={i}
                  ref={refs.current[i]}
                  className="code"
                  inputMode="latin"
                  autoComplete="one-time-code"
                  maxLength={CODE_LEN} // enables multi-char paste
                  value={vals[i]}
                  onChange={(e) => setBox(i, e.target.value)}
                  onKeyDown={(e) => onKey(i, e)}
                />
              ))}
            </div>

            <div className="row">
              <button
                className="btn primary"
                disabled={!full || busy}
                onClick={submit}
              >
                {busy ? "Linking…" : "Link device"}
              </button>
              <button type="button" className="btn ghost" onClick={clearAll}>
                Clear
              </button>
            </div>
          </form>
        )}

        <div className="muted" style={{ marginTop: 12 }}>
          Tip: you can paste the whole code into any box — it’ll auto-fill the
          rest.
        </div>
      </div>
    </div>
  );
}
