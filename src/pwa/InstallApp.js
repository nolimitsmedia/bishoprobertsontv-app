// src/pwa/InstallApp.js
// "Get the app" banner (phones/tablets), the iPhone how-to sheet, and an
// install button for the menu and the Apps page.
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  isTouchScreen,
  promptInstall,
  rememberDismissed,
  useInstallApp,
  wasDismissedRecently,
} from "./installStore";
import "./InstallApp.css";
import { SITE } from "../config/site";

const ICON = `${process.env.PUBLIC_URL || ""}/pwa-icon-192.png`;
const BANNER_DELAY_MS = 20000; // or on the visitor's second page, if sooner
// No banner where it would get in the way.
const QUIET_ROUTES =
  /^\/(watch|login|signup|free-account|forgot|subscribe|admin|c)(\/|$)/;

function ShareIcon() {
  return (
    <svg
      className="ia-shareIcon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

function PlusSquareIcon() {
  return (
    <svg
      className="ia-shareIcon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

// iPhone/iPad: Apple has no install button for websites, so show the steps.
export function IosInstallGuide({ onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="ia-guideWrap">
      <button
        type="button"
        className="ia-guideDim"
        aria-label="Close"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        className="ia-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ia-guide-title"
      >
        <div className="ia-guideHead">
          <img src={ICON} alt="" className="ia-icon" />
          <h2 id="ia-guide-title">Add {SITE.shortName} to your home screen</h2>
        </div>
        <ol className="ia-steps">
          <li>
            Tap the Share button <ShareIcon /> — in Safari it’s at the bottom of
            the screen; in Chrome it’s next to the address bar.
          </li>
          <li>
            Scroll down and tap{" "}
            <span className="ia-nowrap">
              <strong>Add to Home Screen</strong> <PlusSquareIcon />
            </span>
          </li>
          <li>
            Tap <strong>Add</strong>. {SITE.shortName} appears on your home
            screen and opens full screen, like an app.
          </li>
        </ol>
        <button
          ref={closeRef}
          type="button"
          className="ia-btn ia-btn--primary ia-guideDone"
          onClick={onClose}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

// Button for the menu / Apps page. Renders nothing when installing is not
// possible on this browser (or the app is already installed).
export function InstallAppButton({
  className = "",
  label = "Install app",
  onDone,
}) {
  const s = useInstallApp();
  const [guide, setGuide] = useState(false);
  if (s.installed || (!s.canPrompt && !s.iosGuide)) return null;
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={async () => {
          if (s.canPrompt) {
            await promptInstall();
            onDone?.();
          } else setGuide(true);
        }}
      >
        {label}
      </button>
      {guide ? (
        <IosInstallGuide
          onClose={() => {
            setGuide(false);
            onDone?.();
          }}
        />
      ) : null}
    </>
  );
}

// Status line for the Apps page.
export function InstallAppStatus() {
  const s = useInstallApp();
  if (s.installed)
    return (
      <p className="ia-status">{SITE.shortName} is installed on this device.</p>
    );
  if (s.iosInApp)
    return (
      <p className="ia-status">
        To install, open this page in Safari first (tap ••• or the compass, then
        “Open in Safari”).
      </p>
    );
  if (!s.canPrompt && !s.iosGuide)
    return (
      <p className="ia-status">
        To install on this device, open {SITE.name} in Chrome (Android or
        computer) or Safari (iPhone and iPad).
      </p>
    );
  return null;
}

// The Crisp support chat bubble sits bottom-right: keep the banner above it.
function chatBubble() {
  try {
    return !!document.querySelector(".crisp-client");
  } catch {
    return false;
  }
}

// Bottom banner on phones and tablets.
export default function InstallAppBanner() {
  const s = useInstallApp();
  const loc = useLocation();
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(() => wasDismissedRecently());
  const [guide, setGuide] = useState(false);
  const firstPathRef = useRef(loc.pathname);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), BANNER_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (loc.pathname !== firstPathRef.current) setReady(true);
  }, [loc.pathname]);

  const available = s.canPrompt || s.iosGuide;
  const quiet = QUIET_ROUTES.test(loc.pathname);
  const show =
    ready && !hidden && available && !s.installed && !quiet && isTouchScreen();

  const dismiss = () => {
    rememberDismissed();
    setHidden(true);
  };

  return (
    <>
      {show && !guide ? (
        <aside
          className={`ia-banner${chatBubble() ? " ia-banner--aboveChat" : ""}`}
          aria-label={`Get the ${SITE.shortName} app`}
        >
          <img src={ICON} alt="" className="ia-icon" />
          <div className="ia-text">
            <p className="ia-title">Get the {SITE.shortName} app</p>
            <p className="ia-sub">
              One tap from your home screen, full screen.
            </p>
          </div>
          <div className="ia-actions">
            <button
              type="button"
              className="ia-btn ia-btn--ghost"
              onClick={dismiss}
            >
              Not now
            </button>
            <button
              type="button"
              className="ia-btn ia-btn--primary"
              onClick={async () => {
                if (s.canPrompt) {
                  const r = await promptInstall();
                  if (r !== "accepted") dismiss();
                } else setGuide(true);
              }}
            >
              {s.canPrompt ? "Install" : "Show me how"}
            </button>
          </div>
        </aside>
      ) : null}
      {guide ? (
        <IosInstallGuide
          onClose={() => {
            setGuide(false);
            dismiss();
          }}
        />
      ) : null}
    </>
  );
}
