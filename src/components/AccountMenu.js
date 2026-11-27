// src/components/AccountMenu.js
//
// One "Account" dropdown in the site header (replaces the separate Admin,
// My Account and Logout / Login, Register buttons).
//   Signed in:  name/email, Admin (administrators only), My account, Log out
//   Signed out: Log in, Create free account
// Keyboard: Enter/Space/↓ opens, ↑/↓ move, Escape closes (focus returns to the
// button), Tab leaves; clicking outside closes.

import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function AccountMenu({ me, isAuthed, isAdmin, onLogout }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const location = useLocation();

  const name = me?.name || me?.full_name || "";
  const email = me?.email || "";
  const initial = (name || email || "").trim().slice(0, 1).toUpperCase();

  // close on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // close on outside click
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (
        !menuRef.current?.contains(e.target) &&
        !btnRef.current?.contains(e.target)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const items = () => [
    ...(menuRef.current?.querySelectorAll('[role="menuitem"]') || []),
  ];
  const focusItem = (i) => {
    const list = items();
    if (list.length) list[(i + list.length) % list.length].focus();
  };
  // when the menu opens, move focus to its first item
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      const first = menuRef.current?.querySelector('[role="menuitem"]');
      if (first) first.focus();
    });
  }, [open]);

  function onButtonKey(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    }
  }
  function onMenuKey(e) {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(i + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(list.length - 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      btnRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="pl-acct">
      <button
        ref={btnRef}
        type="button"
        className={`pl-acctBtn${open ? " is-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="pl-acct-menu"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onButtonKey}
      >
        <span
          className={`pl-acctAvatar${isAuthed && initial ? "" : " is-guest"}`}
          aria-hidden="true"
        >
          {isAuthed && initial ? (
            initial
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          )}
        </span>
        <span className="pl-acctLabel">Account</span>
        <svg
          className="pl-acctChev"
          viewBox="0 0 10 10"
          width="10"
          height="10"
          aria-hidden="true"
        >
          <path
            d="M2 3.5 5 6.5 8 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          id="pl-acct-menu"
          ref={menuRef}
          className="pl-acctMenu"
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKey}
        >
          {isAuthed ? (
            <>
              {name || email ? (
                <div className="pl-acctHead" role="presentation">
                  {name ? <strong>{name}</strong> : null}
                  {email ? <span>{email}</span> : null}
                </div>
              ) : null}
              {isAdmin ? (
                <Link
                  to="/admin"
                  role="menuitem"
                  className="pl-acctItem"
                  tabIndex={-1}
                >
                  Admin
                </Link>
              ) : null}
              <Link
                to="/account"
                role="menuitem"
                className="pl-acctItem"
                tabIndex={-1}
              >
                My account
              </Link>
              <div className="pl-acctSep" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="pl-acctItem is-danger"
                tabIndex={-1}
                onClick={() => {
                  setOpen(false);
                  onLogout?.();
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                role="menuitem"
                className="pl-acctItem"
                tabIndex={-1}
              >
                Log in
              </Link>
              <Link
                to="/free-account"
                role="menuitem"
                className="pl-acctItem is-primary"
                tabIndex={-1}
              >
                Create free account
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
