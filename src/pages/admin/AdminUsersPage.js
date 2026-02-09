// src/pages/admin/AdminUsersPage.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api";
import "./Dashboard.css"; // reuse same admin styling

function safeStr(v) {
  return (v ?? "").toString();
}

function isEmailLike(v) {
  const s = String(v || "").trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/* -----------------------------
   Minimal inline icons (no deps)
------------------------------ */
function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true,
  };

  switch (name) {
    case "back":
      return (
        <svg {...common}>
          <path
            d="M14 7l-5 5 5 5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "refresh":
      return (
        <svg {...common}>
          <path
            d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 12.65-5.65Z"
            fill="currentColor"
            opacity="0.9"
          />
        </svg>
      );
    case "edit":
      return (
        <svg {...common}>
          <path
            d="M3 17.25V21h3.75L17.8 9.95l-3.75-3.75L3 17.25Zm18-11.5a1 1 0 0 0 0-1.41l-1.34-1.34a1 1 0 0 0-1.41 0l-1.13 1.13 3.75 3.75L21 5.75Z"
            fill="currentColor"
            opacity="0.9"
          />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path
            d="M6 7h12l-1 14H7L6 7Zm3-3h6l1 2H8l1-2Z"
            fill="currentColor"
            opacity="0.9"
          />
        </svg>
      );
    case "first":
      return (
        <svg {...common}>
          <path
            d="M6 6v12M18 6l-6 6 6 6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "prev":
      return (
        <svg {...common}>
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "next":
      return (
        <svg {...common}>
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "last":
      return (
        <svg {...common}>
          <path
            d="M18 6v12M6 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "eye":
      return (
        <svg {...common}>
          <path
            d="M12 5c5.5 0 9.5 5.2 9.5 7s-4 7-9.5 7S2.5 14.8 2.5 12 6.5 5 12 5Zm0 3.2A3.8 3.8 0 1 0 12 19.8a3.8 3.8 0 0 0 0-7.6Zm0 2A1.8 1.8 0 1 1 12 14a1.8 1.8 0 0 1 0-3.6Z"
            fill="currentColor"
            opacity="0.9"
          />
        </svg>
      );
    case "eyeOff":
      return (
        <svg {...common}>
          <path
            d="M3 4.5 20 21.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M12 5c5.5 0 9.5 5.2 9.5 7 0 1-.8 2.6-2.2 4.1l-2-2c.9-.9 1.5-1.8 1.5-2.1 0-1.8-3-5-6.8-5-1.1 0-2.1.2-3 .6L6.7 6.2C8.2 5.4 10 5 12 5Zm-9.5 7c0-1 .8-2.6 2.2-4.1l2 2C5.8 10.8 5.2 11.7 5.2 12c0 1.8 3 5 6.8 5 1.1 0 2.1-.2 3-.6l2.3 2.3c-1.5.8-3.3 1.3-5.3 1.3C6.5 20 2.5 14.8 2.5 12Z"
            fill="currentColor"
            opacity="0.9"
          />
        </svg>
      );
    default:
      return null;
  }
}

function IconBtn({
  title,
  onClick,
  disabled,
  kind = "primary", // primary | ghost | danger
  children,
  compact = false,
  style,
}) {
  const bg =
    kind === "danger"
      ? "rgba(255, 77, 77, 0.18)"
      : kind === "ghost"
        ? "rgba(255,255,255,0.06)"
        : "linear-gradient(180deg, rgba(122,35,214,0.95), rgba(92,20,165,0.95))";

  const border =
    kind === "danger"
      ? "1px solid rgba(255, 77, 77, 0.28)"
      : "1px solid rgba(255,255,255,0.12)";

  return (
    <button
      type="button"
      className="btn"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: compact ? "8px 10px" : "10px 12px",
        borderRadius: 12,
        background: bg,
        border,
        color: "#fff",
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        userSelect: "none",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* -----------------------------
   Tiny Toast system (no deps)
------------------------------ */
function Toast({ t, onClose }) {
  const isError = t?.type === "error";
  const accent = isError
    ? "rgba(255, 77, 77, 0.95)"
    : "rgba(154, 92, 255, 0.95)";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        width: "min(420px, calc(100vw - 24px))",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(20,20,22,0.96)",
        boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 3,
          background: accent,
          opacity: 0.95,
        }}
      />
      <div
        style={{
          padding: 12,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>
            {t.title || (isError ? "Action failed" : "Success")}
          </div>
          {t.message ? (
            <div className="dash-muted" style={{ fontSize: 13 }}>
              {t.message}
            </div>
          ) : null}
        </div>

        <IconBtn
          title="Dismiss"
          onClick={() => onClose(t.id)}
          kind="ghost"
          compact
        >
          ✕
        </IconBtn>
      </div>
    </div>
  );
}

/* -----------------------------
   Small Modal (no deps)
------------------------------ */
function ModalShell({ open, title, subtitle, children, onClose, footer }) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: "min(720px, 96vw)",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(20,20,22,0.98)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
              {subtitle ? (
                <div className="dash-muted" style={{ marginTop: 4 }}>
                  {subtitle}
                </div>
              ) : null}
            </div>

            <IconBtn title="Close" onClick={onClose} kind="ghost" compact>
              ✕
            </IconBtn>
          </div>
        </div>

        <div style={{ padding: 16 }}>{children}</div>

        {footer ? (
          <div
            style={{
              padding: 16,
              borderTop: "1px solid rgba(255,255,255,0.10)",
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        {hint ? (
          <span className="dash-muted" style={{ fontSize: 12 }}>
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </label>
  );
}

function Input({ ...props }) {
  return (
    <input
      {...props}
      className="input"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "#fff",
        borderRadius: 10,
        padding: "10px 12px",
        outline: "none",
        ...props.style,
      }}
    />
  );
}

function Select({ ...props }) {
  return (
    <select
      {...props}
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "#fff",
        borderRadius: 10,
        padding: "10px 12px",
        outline: "none",
        ...props.style,
      }}
    />
  );
}

/* Password input with eye toggle */
function PasswordField({
  value,
  onChange,
  placeholder = "••••••••",
  autoComplete = "new-password",
}) {
  const [show, setShow] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{ paddingRight: 44 }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          width: 34,
          height: 34,
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
        }}
      >
        <Icon name={show ? "eyeOff" : "eye"} size={18} />
      </button>
    </div>
  );
}

/* -----------------------------
   Page
------------------------------ */
export default function AdminUsersPage() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();

  // URL-driven state
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const limit = Math.max(
    5,
    Math.min(100, parseInt(sp.get("limit") || "25", 10) || 25),
  );
  const sort = safeStr(sp.get("sort") || "created_at");
  const order = safeStr(sp.get("order") || "desc");
  const q = safeStr(sp.get("search") || "");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  // Toasts
  const [toasts, setToasts] = useState([]);
  const toastSeqRef = useRef(1);

  const pushToast = useCallback((t) => {
    const id = `${Date.now()}_${toastSeqRef.current++}`;
    const toast = {
      id,
      type: t?.type || "success",
      title: t?.title || "",
      message: t?.message || "",
      ttl: Number.isFinite(t?.ttl) ? t.ttl : 3200,
    };

    setToasts((prev) => {
      const next = [toast, ...prev];
      return next.slice(0, 3);
    });

    // auto-dismiss
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, toast.ttl);
  }, []);

  const closeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("user");
  const [formPassword, setFormPassword] = useState("");
  const [formPassword2, setFormPassword2] = useState("");

  // Delete modal state
  const [delOpen, setDelOpen] = useState(false);
  const [delUser, setDelUser] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState("");

  const totalPages = useMemo(() => {
    const t = Number(total) || 0;
    return Math.max(1, Math.ceil(t / limit));
  }, [total, limit]);

  const aliveRef = useRef(true);

  const setParams = useCallback(
    (next) => {
      const merged = { page, limit, sort, order, search: q, ...next };
      const cleaned = {};
      Object.entries(merged).forEach(([k, v]) => {
        const s = (v ?? "").toString();
        if (s !== "") cleaned[k] = s;
      });
      setSp(cleaned, { replace: false });
    },
    [page, limit, sort, order, q, setSp],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const res = await api.get("/admin/users", {
        params: { page, limit, sort, order, search: q || undefined },
        timeout: 30000,
      });

      if (!aliveRef.current) return;

      if (!res.data?.ok)
        throw new Error(res.data?.message || "Failed to load users");

      setRows(Array.isArray(res.data.users) ? res.data.users : []);
      setTotal(Number(res.data.total) || 0);
    } catch (e) {
      if (!aliveRef.current) return;

      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Failed to load registered members.";
      setErr(msg);
      setRows([]);
      setTotal(0);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [page, limit, sort, order, q]);

  useEffect(() => {
    aliveRef.current = true;
    load();
    return () => {
      aliveRef.current = false;
    };
  }, [load]);

  // Local input with debounce
  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => setSearchInput(q), [q]);

  useEffect(() => {
    const t = setTimeout(() => {
      setParams({ search: searchInput.trim(), page: 1 });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const toggleOrder = () =>
    setParams({ order: order === "asc" ? "desc" : "asc", page: 1 });

  const setSort = (key) => setParams({ sort: key, page: 1 });

  const goPage = (p) =>
    setParams({ page: Math.max(1, Math.min(totalPages, p)) });

  /* -----------------------------
     Actions: Edit / Delete
  ------------------------------ */
  const openEdit = (u) => {
    setEditErr("");
    setEditUser(u);
    setFormName(u?.name || "");
    setFormEmail(u?.email || "");
    setFormRole((u?.role || "user").toString());
    setFormPassword("");
    setFormPassword2("");
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (editSaving) return;
    setEditOpen(false);
    setEditUser(null);
    setEditErr("");
  };

  const saveEdit = async () => {
    setEditErr("");

    const id = editUser?.id;
    if (!id) return;

    const name = formName.trim();
    const email = formEmail.trim();
    const role = (formRole || "user").toString();

    if (!name) return setEditErr("Name is required.");
    if (!email) return setEditErr("Email is required.");
    if (!isEmailLike(email))
      return setEditErr("Please enter a valid email address.");

    const pw = formPassword.trim();
    const pw2 = formPassword2.trim();
    if ((pw || pw2) && pw !== pw2) return setEditErr("Passwords do not match.");
    if (pw && pw.length < 6)
      return setEditErr("Password must be at least 6 characters.");

    const payload = { name, email, role };
    if (pw) payload.password = pw;

    try {
      setEditSaving(true);

      const res = await api.put(`/admin/users/${id}`, payload, {
        timeout: 30000,
      });

      if (!res.data?.ok)
        throw new Error(res.data?.message || "Failed to update user.");

      await load();
      closeEdit();

      pushToast({
        type: "success",
        title: "Member updated",
        message: `${name} was saved successfully.`,
      });
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Failed to update this user. (Check if PUT /api/admin/users/:id exists)";
      setEditErr(msg);

      pushToast({
        type: "error",
        title: "Update failed",
        message: msg,
        ttl: 4200,
      });
    } finally {
      setEditSaving(false);
    }
  };

  const openDelete = (u) => {
    setDelErr("");
    setDelUser(u);
    setDelOpen(true);
  };

  const closeDelete = () => {
    if (delBusy) return;
    setDelOpen(false);
    setDelUser(null);
    setDelErr("");
  };

  const confirmDelete = async () => {
    const id = delUser?.id;
    if (!id) return;

    const nameOrEmail = delUser?.name || delUser?.email || "Member";

    try {
      setDelBusy(true);
      setDelErr("");

      const res = await api.delete(`/admin/users/${id}`, { timeout: 30000 });

      if (!res.data?.ok)
        throw new Error(res.data?.message || "Failed to delete user.");

      const willBeEmpty = rows.length === 1 && page > 1;
      closeDelete();

      if (willBeEmpty) {
        setParams({ page: page - 1 });
      } else {
        await load();
      }

      pushToast({
        type: "success",
        title: "Member deleted",
        message: `${nameOrEmail} was removed successfully.`,
      });
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Failed to delete this user. (Check if DELETE /api/admin/users/:id exists)";
      setDelErr(msg);

      pushToast({
        type: "error",
        title: "Delete failed",
        message: msg,
        ttl: 4200,
      });
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <div className="dash-page">
      {/* Toast stack */}
      <div
        style={{
          position: "fixed",
          top: 14,
          right: 14,
          zIndex: 10000,
          display: "grid",
          gap: 10,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: "auto" }}>
            <Toast t={t} onClose={closeToast} />
          </div>
        ))}
      </div>

      <div className="dash-wrap">
        {/* Responsive helpers */}
        <style>{`
          @media (max-width: 720px) {
            .au-hide-sm { display: none; }
            .au-actions { justify-content: flex-start !important; }
            .au-table td, .au-table th { white-space: nowrap; }
          }
        `}</style>

        <div
          className="dash-hero"
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 240 }}>
            <h1 className="dash-title" style={{ marginBottom: 6 }}>
              Registered Members
            </h1>
            <p className="dash-muted" style={{ margin: 0 }}>
              View all user accounts (admin-only)
            </p>
          </div>

          <div
            className="au-actions"
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <IconBtn
              title="Back to Dashboard"
              onClick={() => nav("/admin")}
              kind="primary"
            >
              <Icon name="back" />
              <span className="au-hide-sm">Back</span>
            </IconBtn>

            <IconBtn
              title="Refresh"
              onClick={load}
              disabled={loading}
              kind="ghost"
            >
              <Icon name="refresh" />
              <span className="au-hide-sm">Refresh</span>
            </IconBtn>
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-cardHead" style={{ alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Members</h3>
            <span className="dash-muted">
              Total: <b>{total}</b>
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 12,
            }}
          >
            <input
              className="input"
              style={{
                minWidth: 220,
                flex: 1,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
                borderRadius: 10,
                padding: "10px 12px",
                outline: "none",
              }}
              placeholder="Search name or email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />

            <select
              value={limit}
              onChange={(e) => setParams({ limit: e.target.value, page: 1 })}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
                borderRadius: 10,
                padding: "10px 12px",
                outline: "none",
                minWidth: 120,
              }}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}/page
                </option>
              ))}
            </select>

            <IconBtn
              title={`Toggle order (${order.toUpperCase()})`}
              onClick={toggleOrder}
              kind="ghost"
            >
              <span style={{ fontWeight: 700 }}>Order</span>
              <span style={{ opacity: 0.9 }}>{order.toUpperCase()}</span>
            </IconBtn>
          </div>

          {err ? (
            <div style={{ marginTop: 14 }}>
              <div className="dash-errorTitle">Couldn’t load members</div>
              <div className="dash-errorText">{err}</div>
            </div>
          ) : null}

          <div style={{ marginTop: 14, overflowX: "auto" }}>
            <table
              className="au-table"
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
                overflow: "hidden",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                  <th
                    onClick={() => setSort("name")}
                    style={{
                      textAlign: "left",
                      padding: "12px 12px",
                      cursor: "pointer",
                    }}
                    title="Sort by name"
                  >
                    Name
                  </th>
                  <th
                    onClick={() => setSort("email")}
                    style={{
                      textAlign: "left",
                      padding: "12px 12px",
                      cursor: "pointer",
                    }}
                    title="Sort by email"
                  >
                    Email
                  </th>
                  <th
                    onClick={() => setSort("role")}
                    style={{
                      textAlign: "left",
                      padding: "12px 12px",
                      cursor: "pointer",
                    }}
                    title="Sort by role"
                  >
                    Role
                  </th>
                  <th style={{ textAlign: "left", padding: "12px 12px" }}>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{ padding: 14 }}
                      className="dash-muted"
                    >
                      Loading members…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{ padding: 14 }}
                      className="dash-muted"
                    >
                      No members found.
                    </td>
                  </tr>
                ) : (
                  rows.map((u) => (
                    <tr
                      key={u.id}
                      style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <td style={{ padding: "12px 12px" }}>{u.name || "—"}</td>
                      <td style={{ padding: "12px 12px" }}>{u.email || "—"}</td>
                      <td style={{ padding: "12px 12px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: "rgba(255,255,255,0.06)",
                          }}
                        >
                          {(u.role || "user").toString()}
                        </span>
                      </td>

                      <td style={{ padding: "12px 12px" }}>
                        <div
                          style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                        >
                          <IconBtn
                            title="Edit member"
                            onClick={() => openEdit(u)}
                            kind="primary"
                            compact
                          >
                            <Icon name="edit" />
                            <span className="au-hide-sm">Edit</span>
                          </IconBtn>

                          <IconBtn
                            title="Delete member"
                            onClick={() => openDelete(u)}
                            kind="danger"
                            compact
                          >
                            <Icon name="trash" />
                            <span className="au-hide-sm">Delete</span>
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination (icon-first + responsive) */}
          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 10,
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <span className="dash-muted">
              Page <b>{page}</b> of <b>{totalPages}</b>
            </span>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <IconBtn
                title="First page"
                onClick={() => goPage(1)}
                disabled={page <= 1 || loading}
                kind="ghost"
                compact
              >
                <Icon name="first" />
                <span className="au-hide-sm">First</span>
              </IconBtn>

              <IconBtn
                title="Previous page"
                onClick={() => goPage(page - 1)}
                disabled={page <= 1 || loading}
                kind="ghost"
                compact
              >
                <Icon name="prev" />
                <span className="au-hide-sm">Prev</span>
              </IconBtn>

              <IconBtn
                title="Next page"
                onClick={() => goPage(page + 1)}
                disabled={page >= totalPages || loading}
                kind="ghost"
                compact
              >
                <Icon name="next" />
                <span className="au-hide-sm">Next</span>
              </IconBtn>

              <IconBtn
                title="Last page"
                onClick={() => goPage(totalPages)}
                disabled={page >= totalPages || loading}
                kind="ghost"
                compact
              >
                <Icon name="last" />
                <span className="au-hide-sm">Last</span>
              </IconBtn>
            </div>
          </div>

          <div className="dash-muted" style={{ marginTop: 10, fontSize: 12 }}>
            Tip: Click column headers to sort.
          </div>
        </div>
      </div>

      {/* -----------------------------
          Edit Modal
      ------------------------------ */}
      <ModalShell
        open={editOpen}
        title="Edit member"
        subtitle={editUser ? `Editing user #${editUser.id}` : ""}
        onClose={closeEdit}
        footer={
          <>
            <IconBtn
              title="Cancel"
              onClick={closeEdit}
              disabled={editSaving}
              kind="ghost"
            >
              Cancel
            </IconBtn>
            <IconBtn
              title="Save changes"
              onClick={saveEdit}
              disabled={editSaving}
              kind="primary"
            >
              {editSaving ? "Saving…" : "Save changes"}
            </IconBtn>
          </>
        }
      >
        {editErr ? (
          <div style={{ marginBottom: 12 }}>
            <div className="dash-errorTitle">Update failed</div>
            <div className="dash-errorText">{editErr}</div>
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <Field label="Name">
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Full name"
              />
            </Field>

            <Field label="Role" hint="admin or user">
              <Select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </Select>
            </Field>
          </div>

          <Field label="Email">
            <Input
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </Field>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <Field label="New password" hint="Leave blank to keep current">
              <PasswordField
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>

            <Field label="Confirm password" hint="Only if changing">
              <PasswordField
                value={formPassword2}
                onChange={(e) => setFormPassword2(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
          </div>

          <div className="dash-muted" style={{ fontSize: 12 }}>
            Note: Password updates require your backend to support{" "}
            <b>PUT /api/admin/users/:id</b> with a <b>password</b> field.
          </div>
        </div>
      </ModalShell>

      {/* -----------------------------
          Delete Confirm Modal
      ------------------------------ */}
      <ModalShell
        open={delOpen}
        title="Confirm delete"
        subtitle={
          delUser
            ? `This will permanently delete "${
                delUser.name || delUser.email || "this user"
              }".`
            : ""
        }
        onClose={closeDelete}
        footer={
          <>
            <IconBtn
              title="Cancel"
              onClick={closeDelete}
              disabled={delBusy}
              kind="ghost"
            >
              Cancel
            </IconBtn>
            <IconBtn
              title="Yes, delete"
              onClick={confirmDelete}
              disabled={delBusy}
              kind="danger"
            >
              {delBusy ? "Deleting…" : "Yes, delete"}
            </IconBtn>
          </>
        }
      >
        {delErr ? (
          <div style={{ marginBottom: 12 }}>
            <div className="dash-errorTitle">Delete failed</div>
            <div className="dash-errorText">{delErr}</div>
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 10 }}>
          <div className="dash-muted">
            User ID: <b>{delUser?.id ?? "—"}</b>
          </div>
          <div className="dash-muted">
            Email: <b>{delUser?.email ?? "—"}</b>
          </div>

          <div
            style={{
              borderRadius: 12,
              padding: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Heads up</div>
            <div className="dash-muted" style={{ fontSize: 13 }}>
              If this account has subscriptions, purchases, playlists, or
              activity logs tied to it, you may want to do a “soft delete”
              instead (disable the account) depending on your business rules.
            </div>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
