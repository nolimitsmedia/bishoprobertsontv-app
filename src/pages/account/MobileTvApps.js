import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";

/* icons */
const IconApple = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M16.365 12.45c-.02-2.044 1.67-3.023 1.747-3.07c-.952-1.39-2.431-1.58-2.955-1.6c-1.256-.127-2.454.73-3.09.73c-.635 0-1.63-.712-2.68-.694c-1.377.02-2.657.8-3.368 2.03c-1.447 2.51-.37 6.22 1.04 8.26c.69.996 1.505 2.11 2.58 2.07c1.04-.04 1.43-.67 2.68-.67s1.6.67 2.69.65c1.11-.02 1.82-1.02 2.5-2.02c.79-1.14 1.11-2.23 1.13-2.29c-.025-.01-2.17-.83-2.223-3.39ZM14.41 6.61c.56-.69.94-1.64.84-2.59c-.81.03-1.8.54-2.38 1.23c-.52.6-.98 1.57-.86 2.5c.91.07 1.85-.46 2.4-1.14Z"
    />
  </svg>
);
const IconGooglePlay = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M3 2.9v18.2c0 .45.49.73.88.5L16.9 13 4.02 2.4A.6.6 0 0 0 3 2.9Z"
    />
    <path
      fill="currentColor"
      d="M19.25 9.9 6.78 2.03l9.3 10.1z"
      opacity=".35"
    />
    <path
      fill="currentColor"
      d="M16.08 13.88 6.77 24l12.48-7.87z"
      opacity=".35"
    />
    <path fill="currentColor" d="M19.25 14.1 6.78 22l9.3-10.12z" />
  </svg>
);
const IconAppleTV = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect
      x="3"
      y="5"
      width="18"
      height="12"
      rx="3"
      fill="currentColor"
      opacity=".12"
    />
    <rect
      x="3"
      y="5"
      width="18"
      height="12"
      rx="3"
      stroke="currentColor"
      fill="none"
    />
    <path
      fill="currentColor"
      d="M10 14h-1l-2-4h1.2l1.3 2.8L10 10h1l-1.4 2.9c-.2.4-.4.74-.6 1.1Zm6.7 0h-1.1l-2-4h1.2l1.3 2.8L18 10h1l-1.4 2.9c-.2.4-.4.74-.6 1.1Z"
    />
  </svg>
);

function Mono({ children }) {
  return (
    <span
      style={{
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      }}
    >
      {children}
    </span>
  );
}

export default function MobileTVApps() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // activation state
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [tick, setTick] = useState(0); // just to force re-renders
  const [activating, setActivating] = useState(false);
  const tickRef = useRef(null);

  // ✅ compute fresh on every render (no memoization with stale deps)
  const secondsLeft = expiresAt
    ? Math.max(
        0,
        Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)
      )
    : 0;

  const startTicker = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setTick((s) => s + 1), 1000);
  };
  const stopTicker = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  useEffect(() => {
    if (secondsLeft <= 0 && code) {
      // expire UX
      stopTicker();
      setCode("");
      setExpiresAt(null);
    }
  }, [secondsLeft, code]);

  useEffect(() => {
    loadDevices();
    return () => stopTicker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDevices() {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/devices");
      setDevices(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      console.error("load devices error:", e);
      setErr("Failed to load devices.");
    } finally {
      setLoading(false);
    }
  }

  async function makeActivationCode() {
    setErr("");
    setActivating(true);
    try {
      const { data } = await api.post("/devices/activation");
      setCode(data?.code || "");
      setExpiresAt(data?.expires_at || null);
      startTicker();
    } catch (e) {
      console.error("activation start error:", e);
      setErr(
        e?.response?.data?.message ||
          "Could not generate an activation code. Please try again."
      );
    } finally {
      setActivating(false);
    }
  }

  async function revoke(id) {
    if (!window.confirm("Remove this device?")) return;
    try {
      await api.delete(`/devices/${id}`);
      await loadDevices();
    } catch {
      alert("Failed to remove device.");
    }
  }

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
    } catch {}
  };

  return (
    <div>
      <style>{`
        .stores { display:flex; gap:12px; flex-wrap:wrap; margin-top:8px; }
        .store-btn {
          display:inline-flex; align-items:center; gap:8px;
          padding:10px 14px; height:40px;
          background:#ffffff; color:#0f172a; text-decoration:none;
          border:1px solid #e2e8f0; border-radius:10px; font-weight:700;
          transition: background .15s ease, border-color .15s ease, transform .02s ease;
        }
        .store-btn:hover { background:#f8fafc; border-color:#dbe3ef; }
        .store-btn:active { transform: translateY(.5px); }
        .store-icon { width:16px; height:16px; opacity:.9; }

        .tv-card {
          padding:14px; display:grid; grid-template-columns: 1fr auto; gap:10px;
          align-items:center; border:1px dashed #bfdbfe; background:#f8fbff;
          border-radius:12px;
        }

        .btn { height:40px; border-radius:10px; font-weight:700; padding:0 14px; }
        .btn.primary { background:#2563eb; color:#fff; border:1px solid transparent; }
        .btn.primary:hover { background:#1e40af; }
        .btn.outline { background:#fff; color:#0f172a; border:1px solid #e2e8f0; }
        .btn.outline:hover { background:#f8fafc; }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <Link className="chip-btn" to="/account">
          ← Back to account
        </Link>
      </div>

      {err && (
        <div className="auth-alert" style={{ marginBottom: 12 }}>
          {err}
        </div>
      )}

      {/* Apps + Link a TV */}
      <div
        className="card"
        style={{
          padding: 16,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div>
          <h3 style={{ marginTop: 0 }}>Mobile & TV apps</h3>
          <div className="stores">
            <a
              className="store-btn"
              href="#"
              onClick={(e) => e.preventDefault()}
            >
              <span className="store-icon">
                <IconApple />
              </span>
              iOS App Store
            </a>
            <a
              className="store-btn"
              href="#"
              onClick={(e) => e.preventDefault()}
            >
              <span className="store-icon">
                <IconGooglePlay />
              </span>
              Google Play
            </a>
            <a
              className="store-btn"
              href="#"
              onClick={(e) => e.preventDefault()}
            >
              <span className="store-icon">
                <IconAppleTV />
              </span>
              Apple TV
            </a>
          </div>
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>Link a TV</h3>
          {code ? (
            <div className="tv-card">
              <div>
                <div
                  style={{ color: "#64748b", fontSize: 13, marginBottom: 6 }}
                >
                  Enter this code on your TV
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    letterSpacing: "0.14em",
                    marginBottom: 6,
                  }}
                >
                  <Mono>{code}</Mono>
                </div>
                <div style={{ color: "#64748b", fontSize: 12 }}>
                  Expires in <b>{secondsLeft}s</b>
                </div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <button className="btn outline" onClick={() => copy(code)}>
                  Copy
                </button>
                {/* Public route below makes this always accessible */}
                <Link className="btn primary" to={`/activate?code=${code}`}>
                  Open activation mock
                </Link>
              </div>
            </div>
          ) : (
            <button
              className="btn primary"
              onClick={makeActivationCode}
              disabled={activating}
              style={{ width: 280 }}
            >
              {activating ? "Generating…" : "Generate activation code"}
            </button>
          )}
        </div>
      </div>

      {/* Devices list */}
      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Linked devices</h3>
        {loading ? (
          <div>Loading…</div>
        ) : devices.length === 0 ? (
          <div className="vd-muted">No devices yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Platform</th>
                  <th>Linked</th>
                  <th>Last seen</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name || "TV"}</td>
                    <td>{d.platform || "—"}</td>
                    <td>
                      {d.created_at
                        ? new Date(d.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      {d.last_seen_at
                        ? new Date(d.last_seen_at).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      <button
                        className="btn outline"
                        onClick={() => revoke(d.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
