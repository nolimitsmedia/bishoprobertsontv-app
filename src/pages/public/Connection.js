import React, { useEffect, useState } from "react";
import "./Connection.css";

export default function Connection() {
  const FORM_URL = "https://bishoprobertson.tv/join-the-connetion-today/";

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, []);

  return (
    <main className="connection-page">
      <header className="connection-hero">
        <div className="connection-hero-inner">
          <h1 className="connection-title">Join DRM: THE CONNECTION</h1>
          <p className="connection-subtitle">
            Fill out the Partner Registration form below to become a part of THE
            CONNECTION.
          </p>
        </div>
      </header>

      <section className="connection-shell">
        {!loaded && (
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
            src={FORM_URL}
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
