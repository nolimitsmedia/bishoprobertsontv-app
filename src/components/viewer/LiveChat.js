// src/components/viewer/LiveChat.js
//
// Release 2.2 Part B: chat on the live page. Anyone can read; signed-in members
// post (their account name is used); staff can delete messages.

import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import api from "../../api";
import { isSignedIn } from "./viewerStore";

function apiOrigin() {
  try {
    return new URL(api.defaults.baseURL || "", window.location.href).origin;
  } catch {
    return window.location.origin;
  }
}
const token = () => {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
  }
};
const timeOf = (d) => {
  const t = new Date(d);
  return Number.isNaN(t.getTime())
    ? ""
    : t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export default function LiveChat() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [moderator, setModerator] = useState(false);
  const [connected, setConnected] = useState(false);
  const sock = useRef(null);
  const list = useRef(null);
  const atBottom = useRef(true);
  const signedIn = isSignedIn();

  useEffect(() => {
    let alive = true;
    api
      .get("/live-chat/messages")
      .then(
        ({ data }) =>
          alive &&
          setMessages(Array.isArray(data?.messages) ? data.messages : []),
      )
      .catch(() => {});
    if (signedIn)
      api
        .get("/live-chat/me")
        .then(({ data }) => alive && setModerator(!!data?.moderator))
        .catch(() => {});
    const s = io(apiOrigin(), {
      transports: ["websocket"],
      auth: { token: token() },
    });
    sock.current = s;
    s.on("connect", () => {
      setConnected(true);
      s.emit("sitechat:join");
    });
    s.on("disconnect", () => setConnected(false));
    s.on("sitechat:new", (m) =>
      setMessages((x) =>
        x.some((y) => Number(y.id) === Number(m.id))
          ? x
          : [...x, m].slice(-200),
      ),
    );
    s.on("sitechat:deleted", ({ id }) =>
      setMessages((x) => x.filter((y) => Number(y.id) !== Number(id))),
    );
    return () => {
      alive = false;
      s.close();
      sock.current = null;
    };
  }, [signedIn]);

  useEffect(() => {
    const el = list.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function send(e) {
    e.preventDefault();
    const m = text.trim();
    if (!m || !sock.current) return;
    setSending(true);
    setErr("");
    sock.current
      .timeout(8000)
      .emit("sitechat:send", { message: m }, (timeoutErr, res) => {
        setSending(false);
        if (timeoutErr)
          return setErr(
            "Your message could not be sent. Check your connection.",
          );
        if (!res?.ok)
          return setErr(res?.error || "Your message could not be sent.");
        setText("");
        atBottom.current = true;
      });
  }

  async function remove(m) {
    try {
      await api.delete(`/live-chat/messages/${m.id}`);
      setMessages((x) => x.filter((y) => Number(y.id) !== Number(m.id)));
    } catch {
      setErr("Could not delete that message.");
    }
  }

  return (
    <section className="lc-chat" aria-labelledby="lc-title">
      <div className="lc-head">
        <h2 id="lc-title">Live chat</h2>
        <span
          className={`lc-dot${connected ? " is-on" : ""}`}
          aria-label={connected ? "Connected" : "Connecting"}
          role="img"
        />
      </div>
      <ol
        ref={list}
        className="lc-list"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {!messages.length ? (
          <li className="lc-empty">No messages yet. Say hello!</li>
        ) : null}
        {messages.map((m) => (
          <li key={m.id} className="lc-msg">
            <span className="lc-meta">
              <strong>{m.name}</strong>{" "}
              <time dateTime={m.created_at}>{timeOf(m.created_at)}</time>
            </span>
            <span className="lc-text">{m.message}</span>
            {moderator ? (
              <button
                type="button"
                className="lc-del"
                onClick={() => remove(m)}
                aria-label={`Delete message from ${m.name}`}
              >
                Delete
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      {signedIn ? (
        <form className="lc-form" onSubmit={send}>
          <label htmlFor="lc-input" className="vw-sr">
            Message
          </label>
          <input
            id="lc-input"
            className="lc-input"
            value={text}
            maxLength={500}
            placeholder="Say something…"
            autoComplete="off"
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit"
            className="lc-send"
            disabled={sending || !text.trim()}
          >
            {sending ? "…" : "Send"}
          </button>
        </form>
      ) : (
        <p className="lc-signin">
          <Link to="/login">Sign in</Link> to join the chat.
        </p>
      )}
      {err ? (
        <p className="lc-err" role="alert">
          {err}
        </p>
      ) : null}
    </section>
  );
}
