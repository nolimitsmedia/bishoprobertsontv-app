// src/components/NotificationBell.jsx
import React, { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import axios from "axios";

export default function NotificationBell({ apiBase, token, onOpen }) {
  const [unread, setUnread] = useState(0);
  const sockRef = useRef(null);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  async function fetchUnread() {
    try {
      const { data } = await axios.get(
        `${apiBase}/notifications/unread-count`,
        {
          headers: authHeaders,
        }
      );
      setUnread(data.unread ?? 0);
    } catch (_) {}
  }

  useEffect(() => {
    if (!token) return;
    fetchUnread();

    // Socket.IO live updates
    const sock = io(apiBase.replace("/api", ""), {
      transports: ["websocket"],
      extraHeaders: authHeaders,
    });
    sockRef.current = sock;

    // (optional) if your server joins user room based on token, just listen:
    sock.on("connect", () => {
      // console.log("socket connected");
    });
    sock.on("notify:update", (payload) => {
      if (typeof payload?.unread === "number") setUnread(payload.unread);
    });

    return () => {
      try {
        sock.disconnect();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <button
      onClick={() => onOpen?.()}
      style={{
        position: "relative",
        background: "transparent",
        border: 0,
        cursor: "pointer",
      }}
      aria-label="Notifications"
      title="Notifications"
    >
      {/* bell icon */}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          stroke="currentColor"
          strokeWidth="2"
          d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm8-6V11a8 8 0 1 0-16 0v5l-2 2v1h20v-1l-2-2Z"
        />
      </svg>

      {/* bubble */}
      {unread > 0 && (
        <span
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            background: "#fd3b3b",
            color: "#fff",
            borderRadius: 9,
            fontSize: 11,
            lineHeight: "18px",
            textAlign: "center",
            fontWeight: 700,
          }}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
