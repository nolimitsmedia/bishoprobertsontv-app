// src/components/viewer/SearchOverlay.js
//
// Release 2.0 Part B: global search (videos, categories, collections), opened
// from the header. Esc closes; focus returns to the button that opened it.

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";
import { fmtTime } from "./viewerStore";
import "./Viewer.css";

// shortcut: only ONE button per page should own the "/" key (the header's).
export function SearchButton({
  className = "",
  label = "Search",
  shortcut = false,
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  useEffect(() => {
    if (!shortcut) return undefined;
    // "/" opens search (when not typing in a field)
    const onKey = (e) => {
      if (e.key !== "/" || open) return;
      const t = e.target;
      if (
        t &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      )
        return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, shortcut]);
  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`vw-searchBtn ${className}`.trim()}
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="vw-searchBtnText">{label}</span>
      </button>
      {open
        ? // Rendered at the top of the page, so a hidden parent (e.g. the header's
          // collapsed menu on phones) can never hide the search window.
          createPortal(
            <SearchOverlay
              onClose={() => {
                setOpen(false);
                window.setTimeout(() => btn.current?.focus(), 0);
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}

export default function SearchOverlay({ onClose }) {
  const nav = useNavigate();
  const input = useRef(null);
  const panel = useRef(null);
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    input.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRes(null);
      return undefined;
    }
    let alive = true;
    setBusy(true);
    const t = window.setTimeout(() => {
      api
        .get("/viewer/search", { params: { q: term } })
        .then(
          ({ data }) =>
            alive &&
            setRes(
              data && Array.isArray(data.videos)
                ? data
                : { videos: [], categories: [], collections: [] },
            ),
        )
        .catch(
          () =>
            alive &&
            setRes({
              error: true,
              videos: [],
              categories: [],
              collections: [],
            }),
        )
        .finally(() => alive && setBusy(false));
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [q]);
  const go = (to) => {
    onClose();
    nav(to);
  };
  // keep keyboard focus inside the dialog
  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const f = [
      ...panel.current.querySelectorAll("a[href],button,input"),
    ].filter((x) => !x.disabled);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) {
      e.preventDefault();
      f[f.length - 1].focus();
    } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
      e.preventDefault();
      f[0].focus();
    }
  };
  const term = q.trim();
  const total = res
    ? (res.videos?.length || 0) +
      (res.categories?.length || 0) +
      (res.collections?.length || 0)
    : 0;
  return (
    <div
      className="vw-searchLayer"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        className="vw-searchPanel"
        role="dialog"
        aria-modal="true"
        aria-label="Search videos"
        onKeyDown={onKeyDown}
      >
        <form
          className="vw-searchBar"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (term.length >= 2) go(`/catalog?q=${encodeURIComponent(term)}`);
          }}
        >
          <input
            ref={input}
            type="search"
            className="vw-searchInput"
            placeholder="Search videos, series and topics…"
            aria-label="Search"
            value={q}
            maxLength={80}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            type="button"
            className="vw-searchClose"
            onClick={onClose}
            aria-label="Close search"
          >
            Esc
          </button>
        </form>
        <div
          className="vw-searchResults"
          aria-live="polite"
          aria-busy={busy ? "true" : "false"}
        >
          {term.length < 2 ? (
            <p className="vw-empty">Type at least 2 letters.</p>
          ) : null}
          {res?.error ? (
            <p className="vw-empty" role="alert">
              Search is unavailable right now. Please try again.
            </p>
          ) : null}
          {res && !res.error && term.length >= 2 && !total && !busy ? (
            <p className="vw-empty">No results for “{term}”.</p>
          ) : null}
          {res?.categories?.length || res?.collections?.length ? (
            <div
              className="vw-searchChips"
              aria-label="Categories and collections"
            >
              {res.categories.map((c) => (
                <Link
                  key={`c${c.id}`}
                  to={`/catalog?cat=${c.id}`}
                  className="vw-chip"
                  onClick={onClose}
                >
                  {c.name} <span>· {c.count} videos</span>
                </Link>
              ))}
              {res.collections.map((c) => (
                <Link
                  key={`p${c.id}`}
                  to={`/catalog?collection=${c.id}`}
                  className="vw-chip"
                  onClick={onClose}
                >
                  {c.title} <span>· collection</span>
                </Link>
              ))}
            </div>
          ) : null}
          {res?.videos?.length ? (
            <ul className="vw-searchList" aria-label="Videos">
              {res.videos.map((v) => (
                <li key={v.id}>
                  <Link
                    to={`/watch/${v.id}`}
                    className="vw-searchItem"
                    onClick={onClose}
                  >
                    <span className="vw-searchThumb">
                      {v.thumbnail ? (
                        <img src={v.thumbnail} alt="" loading="lazy" />
                      ) : null}
                    </span>
                    <span className="vw-searchText">
                      <strong>{v.title}</strong>
                      <small>
                        {[
                          v.is_premium ? "Premium" : "",
                          v.duration_seconds ? fmtTime(v.duration_seconds) : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {term.length >= 2 ? (
            <Link
              to={`/catalog?q=${encodeURIComponent(term)}`}
              className="vw-linkBtn vw-searchAll"
              onClick={onClose}
            >
              See all results in the catalog ›
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
