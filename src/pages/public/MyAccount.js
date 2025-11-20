// src/pages/MyAccount.js
import React, { useEffect, useState } from "react";
import api from "../../api";
import { useNavigate } from "react-router-dom";

export default function MyAccount() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get("/auth/me");
        if (!alive) return;
        setMe(res.data);
        setErr("");
      } catch (e) {
        const status = e?.response?.status;
        if (status === 401) {
          // token missing/expired – force re-login
          localStorage.removeItem("token");
          navigate("/login");
          return;
        }
        setErr(
          e?.response?.data?.message || e?.message || "Failed to load profile"
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Loading your account…</h2>
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Error loading account</h2>
        <pre
          style={{
            background: "#fee",
            color: "#900",
            padding: 12,
            overflowX: "auto",
          }}
        >
          {String(err)}
        </pre>
      </div>
    );
  }

  if (!me) {
    return (
      <div style={{ padding: 24 }}>
        <h2>No data returned.</h2>
        <p>Try logging out and in again.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1>My Account</h1>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginTop: 12,
          marginBottom: 24,
        }}
      >
        <img
          src={me.avatar_url || "https://via.placeholder.com/96?text=Avatar"}
          alt="avatar"
          width={96}
          height={96}
          style={{ borderRadius: "50%", objectFit: "cover" }}
          onError={(e) => {
            e.currentTarget.src = "https://via.placeholder.com/96?text=Avatar";
          }}
        />
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {me.name || "(no name)"}
          </div>
          <div>{me.email || "(no email)"}</div>
          <div style={{ marginTop: 4, opacity: 0.7 }}>
            Role: {me.role || "user"}
          </div>
        </div>
      </div>

      <h3>Raw response</h3>
      <pre
        style={{
          background: "#f6f8fa",
          padding: 12,
          borderRadius: 8,
          overflowX: "auto",
        }}
      >
        {JSON.stringify(me, null, 2)}
      </pre>
    </div>
  );
}
