// src/components/SiteFooter.js
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "./SiteFooter.css";
import { BrandLogo } from "../lib/brand";
import {
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  Music,
  Phone,
  Twitter,
  Youtube,
} from "lucide-react";
import { useSiteOptions } from "../lib/siteOptions";
import { SITE } from "../config/site";

// Release 1.3: footer settings (Site Settings › Footer) and brand (white-label).
const SOCIAL = {
  facebook: ["Facebook", Facebook],
  instagram: ["Instagram", Instagram],
  youtube: ["YouTube", Youtube],
  x: ["X (Twitter)", Twitter],
  tiktok: ["TikTok", Music],
  linkedin: ["LinkedIn", Linkedin],
  email: ["Email", Mail],
  website: ["Website", Globe],
  phone: ["Phone", Phone],
};
function socialHref(network, url) {
  const u = String(url || "").trim();
  if (network === "email") return u.startsWith("mailto:") ? u : `mailto:${u}`;
  if (network === "phone")
    return u.startsWith("tel:") ? u : `tel:${u.replace(/[^0-9+]/g, "")}`;
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}
function FooterLink({ to, children }) {
  return /^\//.test(to) ? (
    <Link to={to} className="sf__a">
      {children}
    </Link>
  ) : (
    <a
      href={to}
      className="sf__a"
      target={/^https:/i.test(to) ? "_blank" : undefined}
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

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
    brand: SITE.name,
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
  const options = useSiteOptions();
  const brand = options?.brand || {};
  const ft = options?.footer || {};
  const brandName = brand.name || meta.brand || SITE.name;
  const columns = (Array.isArray(ft.columns) ? ft.columns : []).filter(
    (c) => (c.links || []).length,
  );
  const socials = (Array.isArray(ft.socials) ? ft.socials : []).filter(
    (x) => SOCIAL[x.network] && x.url,
  );

  return (
    <footer
      className="sf theme--dark"
      role="contentinfo"
      style={{ background: ft.bg || undefined, color: ft.text || undefined }}
    >
      <div className="sf__wrap">
        <div className="sf__brand">
          <Link to="/" className="sf__logoWrap">
            <BrandLogo
              brand={brand}
              name={brandName}
              alt={`${brandName} home`}
              className="sf__logoImg"
            />
          </Link>
          {brand.tagline || meta.tagline ? (
            <div className="sf__tag">{brand.tagline || meta.tagline}</div>
          ) : null}
        </div>

        {columns.length ? (
          <div className="sf__cols">
            {columns.map((c, ci) => (
              <nav
                key={ci}
                className="sf__col"
                aria-label={c.title || `Footer links ${ci + 1}`}
              >
                {c.title ? <h2 className="sf__colTitle">{c.title}</h2> : null}
                <ul>
                  {c.links.map((l, i) => (
                    <li key={i}>
                      <FooterLink to={l.to}>{l.label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        ) : (
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
              ),
            )}
          </nav>
        )}

        {socials.length ? (
          <ul className="sf__socials sf__socialIcons" aria-label="Social media">
            {socials.map((x, i) => {
              const [label, Ico] = SOCIAL[x.network];
              const href = socialHref(x.network, x.url);
              return (
                <li key={i}>
                  <a
                    href={href}
                    target={/^https?:/i.test(href) ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="sf__soc"
                    aria-label={label}
                  >
                    <Ico size={18} aria-hidden="true" />
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          !!meta.socials.length && (
            <div className="sf__socials">
              {meta.socials.map((x, i) => (
                <a
                  key={i}
                  href={x.href}
                  target="_blank"
                  rel="noreferrer"
                  className="sf__soc"
                  aria-label={x.label}
                >
                  {x.label}
                </a>
              ))}
            </div>
          )
        )}
      </div>

      <div className="sf__meta">
        <span>
          {ft.copyright
            ? ft.copyright.replace(/\{year\}/g, String(year))
            : `© ${year} ${brandName}.`}
        </span>
        {ft.show_powered_by !== false ? (
          <>
            <span className="sf__sep">•</span>
            <span>Powered by No Limits Media</span>
          </>
        ) : null}
      </div>
    </footer>
  );
}
