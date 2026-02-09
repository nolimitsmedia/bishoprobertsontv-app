// src/components/SiteFooter.js
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "./SiteFooter.css";
import Logo from "../assets/BishopRobertsonTVLogo.png";

// Feature flag: only fetch /public/site when explicitly enabled.
// Turn on via any of:
//  - window.APP_ENABLE_SITE_META = true
//  - localStorage.setItem('enableSiteMeta','1')
//  - REACT_APP_ENABLE_SITE_META=1 (in your env)
const shouldFetchPublicSite =
  (typeof window !== "undefined" && window.APP_ENABLE_SITE_META === true) ||
  (typeof window !== "undefined" &&
    localStorage.getItem("enableSiteMeta") === "1") ||
  String(process.env.REACT_APP_ENABLE_SITE_META || "") === "1";

export default function SiteFooter() {
  const [meta, setMeta] = useState({
    brand: "Bishop Robertson TV",
    tagline: "",
    links: [
      { label: "Terms & Conditions", to: "/terms" },
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Contact", to: "/contact" },
    ],
    socials: [], // e.g., { label:'YouTube', href:'https://…' }
  });

  useEffect(() => {
    if (!shouldFetchPublicSite) return; // skip request entirely (prevents 404 noise)

    (async () => {
      try {
        // Accept any status; keep fallbacks if endpoint is missing or returns non-200
        const { data, status } = await api.get("/public/site", {
          validateStatus: () => true,
        });
        if (!data || status >= 400) return;

        setMeta((m) => ({
          ...m,
          brand: data.brand || m.brand,
          tagline: data.tagline || m.tagline,
          links:
            Array.isArray(data.footer_links) && data.footer_links.length
              ? data.footer_links
              : m.links,
          socials:
            Array.isArray(data.socials) && data.socials.length
              ? data.socials
              : m.socials,
        }));
      } catch {
        /* keep fallbacks silently */
      }
    })();
  }, []);

  const year = new Date().getFullYear();

  return (
    <footer className="sf theme--dark" role="contentinfo">
      <div className="sf__wrap">
        <div className="sf__brand">
          {/* use dynamic brand (fixes hard-coded/typo’d text) */}
          <Link to="/" className="sf__logoWrap">
            <img src={Logo} alt="BishopRobertson.TV" className="sf__logoImg" />
            {/* <div className="sf__logoText">BishopRobertson.TV</div> */}
          </Link>
          {meta.tagline ? <div className="sf__tag">{meta.tagline}</div> : null}
        </div>

        <nav className="sf__links" aria-label="Footer">
          {meta.links.map((l, i) =>
            l.to ? (
              <Link key={i} to={l.to} className="sf__a">
                {l.label}
              </Link>
            ) : (
              <a
                key={i}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="sf__a"
              >
                {l.label}
              </a>
            )
          )}
        </nav>

        {!!meta.socials.length && (
          <div className="sf__socials">
            {meta.socials.map((s, i) => (
              <a
                key={i}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="sf__soc"
                aria-label={s.label}
              >
                {s.label}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="sf__meta">
        <span>
          © {year} {meta.brand}.
        </span>
        <span className="sf__sep">•</span>
        <span>Powered by No Limits Media</span>
      </div>
    </footer>
  );
}
