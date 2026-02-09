// src/pages/admin/Integrations.js
import React, { useEffect, useState } from "react";
import api from "../../api";
import "./Integrations.css";

export default function Integrations() {
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState({
    googleDrive: false,
    dropbox: false,
  });

  useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      try {
        // Future-ready: backend can expose /api/integrations/status later
        const res = await api.get("/integrations/status").catch(() => null);

        if (!mounted) return;

        if (res?.data) {
          setConnections({
            googleDrive: !!res.data.googleDrive,
            dropbox: !!res.data.dropbox,
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadStatus();
    return () => {
      mounted = false;
    };
  }, []);

  const connect = (provider) => {
    // Placeholder – later you’ll wire OAuth here
    alert(
      `${provider} integration will be enabled soon.\n\nThis screen is ready for OAuth hookup.`
    );
  };

  return (
    <div className="integrations-page">
      <div className="integrations-header">
        <h1>Integrations</h1>
        <p>
          Connect third-party services to streamline uploads, automation, and
          content workflows.
        </p>
      </div>

      {loading ? (
        <div className="integrations-loading">Loading integrations…</div>
      ) : (
        <div className="integrations-grid">
          {/* Google Drive */}
          <div className="integration-card">
            <div className="integration-info">
              <h3>Google Drive</h3>
              <p>Import videos directly from your Google Drive storage.</p>
            </div>

            <div className="integration-actions">
              <span
                className={`integration-status ${
                  connections.googleDrive ? "connected" : "disconnected"
                }`}
              >
                {connections.googleDrive ? "Connected" : "Not Connected"}
              </span>

              <button
                className="integration-btn"
                onClick={() => connect("Google Drive")}
              >
                {connections.googleDrive ? "Manage" : "Connect"}
              </button>
            </div>
          </div>

          {/* Dropbox */}
          <div className="integration-card">
            <div className="integration-info">
              <h3>Dropbox</h3>
              <p>Import videos directly from your Dropbox folders.</p>
            </div>

            <div className="integration-actions">
              <span
                className={`integration-status ${
                  connections.dropbox ? "connected" : "disconnected"
                }`}
              >
                {connections.dropbox ? "Connected" : "Not Connected"}
              </span>

              <button
                className="integration-btn"
                onClick={() => connect("Dropbox")}
              >
                {connections.dropbox ? "Manage" : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
