// src/components/AdminGuard.jsx
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../api";
import { getToken, ensureUser, isAdminUser } from "../auth";

export default function AdminGuard({ children }) {
  const loc = useLocation();
  const [state, setState] = useState({
    loading: true,
    allow: false,
    hasToken: false,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const token = getToken();
      if (!token) {
        if (alive) setState({ loading: false, allow: false, hasToken: false });
        return;
      }
      const user = await ensureUser(api); // decode or /auth/me
      const allow = isAdminUser(user);
      if (alive) setState({ loading: false, allow, hasToken: true });
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="vd-muted" style={{ padding: 24 }}>
        Checking permissions…
      </div>
    );
  }

  if (!state.hasToken) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ next: loc.pathname + loc.search }}
      />
    );
  }

  if (!state.allow) {
    return <Navigate to="/403" replace />;
  }

  return children;
}
