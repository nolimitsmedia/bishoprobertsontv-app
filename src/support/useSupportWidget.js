// src/hooks/useSupportWidget.js  (or wherever you keep it)
import { useEffect } from "react";
import api from "../api";

// Read CRISP website ID from env (supports Vite & CRA)
function getCrispId() {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_CRISP_ID) {
    return import.meta.env.VITE_CRISP_ID;
  }
  return process.env.REACT_APP_CRISP_ID || "";
}

/**
 * Loads Crisp widget only if the authenticated user's
 * entitlements.features.support_level === 'chat'.
 *
 * NOTE:
 * - We skip the API call entirely when there is no auth token to avoid 401 noise.
 * - We load the script idempotently (won’t add it twice).
 */
export default function useSupportWidget() {
  useEffect(() => {
    let mounted = true;

    async function maybeLoad() {
      // Skip when the user is not authenticated yet
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const { data } = await api.get("/subscription/me"); // returns entitlements
        if (!mounted) return;

        const level =
          data?.entitlements?.features?.support_level ??
          data?.entitlements?.support_level ??
          data?.support_level;

        if (String(level || "").toLowerCase() !== "chat") return;

        const CRISP_ID = getCrispId();
        if (!CRISP_ID) return; // No Crisp ID configured

        // Idempotent load (don't inject multiple times)
        if (!window.$crisp || !window.CRISP_WEBSITE_ID) {
          window.$crisp = window.$crisp || [];
          window.CRISP_WEBSITE_ID = CRISP_ID;
        }
        if (!document.getElementById("crisp-sdk")) {
          const s = document.createElement("script");
          s.id = "crisp-sdk";
          s.src = "https://client.crisp.chat/l.js";
          s.async = true;
          document.head.appendChild(s);
        }
      } catch {
        // Silently ignore; widget is optional
      }
    }

    maybeLoad();
    return () => {
      mounted = false;
    };
  }, []);
}
