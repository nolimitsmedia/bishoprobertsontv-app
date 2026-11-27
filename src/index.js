// Must stay the first import: keeps each ministry's browser storage separate
// when several ministries share one web address (Phase 3 hardening).
import "./lib/installSiteStorage";
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { initInstallCapture } from "./pwa/installStore";
import { registerServiceWorker } from "./pwa/registerServiceWorker";

// Installed app: catch Chrome's install offer early, and turn on the helper
// that lets the app open fast (production only).
initInstallCapture();
registerServiceWorker();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
