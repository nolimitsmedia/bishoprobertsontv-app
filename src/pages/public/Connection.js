import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { siteDefaultsReady, useSiteDefaults } from "../../lib/siteContent";
import "./Connection.css";

// Partner sign-up form embedded from the ministry's own website. Set per site
// in content/defaults.json ("partner_form": { url, title, subtitle }) — Phase 2D.
// Without one, visitors go to the Partnership page.
export default function Connection() {
  const form = useSiteDefaults().partner_form || {};
  const FORM_URL = /^https:\/\//i.test(form.url || "") ? form.url : "";

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, []);

  // Wait for this site's settings before deciding there is no form.
  if (!FORM_URL && siteDefaultsReady())
    return <Navigate to="/partnership" replace />;

  return (
    <main className="connection-page">
      <header className="connection-hero">
        <div className="connection-hero-inner">
          <h1 className="connection-title">
            {form.title || "Become a partner"}
          </h1>
          <p className="connection-subtitle">
            {form.subtitle ||
              "Fill out the partner registration form below to join."}
          </p>
        </div>
      </header>

      <section className="connection-shell">
        {(!loaded || !FORM_URL) && (
          <div className="connection-loader">
            <div className="connection-spinner" aria-hidden="true" />
            <div className="connection-loader-text">
              Loading Partner Registration…
            </div>
          </div>
        )}

        <div className={`connection-frameWrap ${loaded ? "is-loaded" : ""}`}>
          <iframe
            title="Partner Registration Form"
            src={FORM_URL || undefined}
            className="connection-iframe"
            onLoad={() => setLoaded(true)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div className="connection-help">
          <p className="connection-help-text">
            If the form doesn’t load,{" "}
            <a
              className="connection-link"
              href={FORM_URL}
              target="_blank"
              rel="noreferrer"
            >
              click here to open it in a new tab
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
