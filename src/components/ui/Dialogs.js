// src/components/ui/Dialogs.js — the site's own pop-ups (instead of the
// browser's confirm / alert boxes).
//   await confirmDialog("Delete this page?")          → true / false
//   await confirmDialog({ title, message, confirmLabel, danger })
//   notify("Saved")  /  notify("Could not save", "error")
// <DialogHost /> is mounted once (App.js). It also takes over window.alert,
// so any remaining alert(...) shows as a styled message instead.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./Dialogs.css";

let pushDialog = null;
let pushToast = null;

const DESTRUCTIVE =
  /^\s*(delete|remove|discard|cancel the|stop|revoke|unpublish|disconnect)\b/i;

export function confirmDialog(opts) {
  const o = typeof opts === "string" ? { message: opts } : { ...(opts || {}) };
  const verb = (String(o.message || "").match(DESTRUCTIVE) || [])[1];
  const danger = o.danger ?? !!verb;
  const item = {
    title: o.title || (danger ? "Please confirm" : "Are you sure?"),
    message: o.message || "",
    confirmLabel:
      o.confirmLabel ||
      (verb ? verb[0].toUpperCase() + verb.slice(1).toLowerCase() : "OK"),
    cancelLabel: o.cancelLabel || "Cancel",
    danger,
  };
  return new Promise((resolve) => {
    if (!pushDialog) return resolve(window.confirm(item.message)); // host not mounted
    pushDialog({ ...item, resolve });
  });
}

// one button per choice → the chosen value, or null (Cancel / Escape)
//   await chooseDialog({ title, message, options: [{ value, label, danger }] })
export function chooseDialog(opts) {
  const o = { ...(opts || {}) };
  return new Promise((resolve) => {
    if (!pushDialog) return resolve(null);
    pushDialog({
      kind: "choose",
      title: o.title || "Choose",
      message: o.message || "",
      options: o.options || [],
      cancelLabel: o.cancelLabel || "Cancel",
      resolve,
    });
  });
}

// a text box → the text, or null (Cancel / Escape)
//   await promptDialog({ title, message, defaultValue, placeholder, confirmLabel, readOnly })
export function promptDialog(opts) {
  const o = typeof opts === "string" ? { message: opts } : { ...(opts || {}) };
  return new Promise((resolve) => {
    if (!pushDialog)
      return resolve(window.prompt(o.message || "", o.defaultValue || ""));
    pushDialog({
      kind: "prompt",
      title: o.title || "",
      message: o.message || "",
      defaultValue: o.defaultValue ?? "",
      placeholder: o.placeholder || "",
      readOnly: !!o.readOnly,
      confirmLabel: o.confirmLabel || (o.readOnly ? "Done" : "OK"),
      cancelLabel: o.cancelLabel || "Cancel",
      resolve,
    });
  });
}

const typeOf = (m) =>
  /fail|error|could not|couldn.t|cannot|can.t|invalid|unable|not allowed|denied|required|please (enter|choose|select|fill)/i.test(
    m,
  )
    ? "error"
    : /saved|success|done|created|updated|deleted|removed|copied|sent|published|added|uploaded/i.test(
          m,
        )
      ? "success"
      : "info";

export function notify(message, type) {
  const text = String(message ?? "");
  if (!text) return;
  const item = {
    id: `${Date.now()}-${Math.random()}`,
    text,
    type: type || typeOf(text),
  };
  if (pushToast) pushToast(item);
  else console.info(text);
}

function ConfirmBox({ d, onClose }) {
  const box = useRef(null);
  const cancelRef = useRef(null);
  const okRef = useRef(null);
  const inputRef = useRef(null);
  const [text, setText] = useState(d.defaultValue ?? "");
  const kind = d.kind || "confirm";
  const cancelValue = kind === "confirm" ? false : null;
  useEffect(() => {
    const prev = document.activeElement;
    if (kind === "prompt") {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (kind === "choose") {
      box.current?.querySelector(".ui-dlgChoice")?.focus();
    } else {
      // destructive: focus Cancel, so a stray Enter does not delete
      (d.danger ? cancelRef : okRef).current?.focus();
    }
    return () => prev?.focus?.();
  }, [d, kind]);
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose(cancelValue);
    } else if (
      e.key === "Enter" &&
      kind === "prompt" &&
      e.target === inputRef.current
    ) {
      e.preventDefault();
      onClose(d.readOnly ? text : text);
    } else if (e.key === "Tab") {
      const f = [...(box.current?.querySelectorAll("button, input") || [])];
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? f.length - 1 : 1) + f.length) % f.length]?.focus();
    }
  };
  return (
    <div
      className="ui-dlgBackdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose(cancelValue)}
    >
      <div
        ref={box}
        className="ui-dlg"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ui-dlg-title"
        aria-describedby="ui-dlg-msg"
        onKeyDown={onKey}
      >
        {d.title ? (
          <h2 id="ui-dlg-title" className="ui-dlgTitle">
            {d.title}
          </h2>
        ) : null}
        {d.message ? (
          <p id="ui-dlg-msg" className="ui-dlgMsg">
            {d.message}
          </p>
        ) : null}
        {kind === "prompt" ? (
          <input
            ref={inputRef}
            className="ui-dlgInput"
            value={text}
            readOnly={d.readOnly}
            placeholder={d.placeholder}
            aria-label={d.message || d.title}
            onChange={(e) => setText(e.target.value)}
          />
        ) : null}
        {kind === "choose" ? (
          <div className="ui-dlgChoices">
            {d.options.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`ui-dlgBtn ui-dlgChoice ${o.danger ? "ui-dlgBtn--danger" : ""}`}
                onClick={() => onClose(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="ui-dlgActions">
          {kind === "prompt" && d.readOnly ? null : (
            <button
              ref={cancelRef}
              type="button"
              className="ui-dlgBtn ui-dlgBtn--ghost"
              onClick={() => onClose(cancelValue)}
            >
              {d.cancelLabel}
            </button>
          )}
          {kind === "choose" ? null : (
            <button
              ref={okRef}
              type="button"
              className={`ui-dlgBtn ${d.danger ? "ui-dlgBtn--danger" : ""}`}
              onClick={() => onClose(kind === "prompt" ? text : true)}
            >
              {d.confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DialogHost() {
  const [dialogs, setDialogs] = useState([]);
  const [toasts, setToasts] = useState([]);
  const dropToast = useCallback(
    (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  );
  useEffect(() => {
    pushDialog = (d) => setDialogs((q) => [...q, d]);
    pushToast = (t) => {
      setToasts((q) => [...q.slice(-3), t]);
      window.setTimeout(
        () => dropToast(t.id),
        t.type === "error" ? 9000 : 5000,
      );
    };
    const original = window.alert;
    window.alert = (m) => notify(m);
    return () => {
      pushDialog = null;
      pushToast = null;
      window.alert = original;
    };
  }, [dropToast]);
  const current = dialogs[0];
  const close = (answer) => {
    current?.resolve(answer);
    setDialogs((q) => q.slice(1));
  };
  return createPortal(
    <>
      {current ? <ConfirmBox d={current} onClose={close} /> : null}
      <div className="ui-toasts" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`ui-toast is-${t.type}`}
            role={t.type === "error" ? "alert" : "status"}
          >
            <span>{t.text}</span>
            <button
              type="button"
              className="ui-toastX"
              aria-label="Close message"
              onClick={() => dropToast(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>,
    document.body,
  );
}
