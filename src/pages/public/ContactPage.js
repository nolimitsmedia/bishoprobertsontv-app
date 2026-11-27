// src/pages/public/ContactPage.js — /contact
// Fallback when the Contact page isn't published in Admin › Pages. Contact
// details come from this site's content/defaults.json ("contact") — Phase 2D.
// The form saves to Admin › Form Submissions ("Contact page").
import React, { useRef, useState } from "react";
import api from "../../api";
import { usePageMeta } from "../../utils/pageMeta";
import "./LegalPages.css";
import { siteDefaults, useSiteDefaults } from "../../lib/siteContent";
import { SITE } from "../../config/site";

export function contactInfo() {
  const c = siteDefaults().contact || {};
  return {
    email: String(c.email || ""),
    phone: String(c.phone || ""),
    address: Array.isArray(c.address) ? c.address.map(String) : [],
    hours: String(c.hours || ""),
  };
}

export default function ContactPage() {
  useSiteDefaults();
  const CONTACT = contactInfo();
  usePageMeta({
    title: "Contact",
    description: `Get in touch with the ${SITE.name} team.`,
  });
  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [state, setState] = useState({
    status: "idle",
    message: "",
    errors: {},
  });
  const started = useRef(Date.now());
  const hp = useRef(null);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setState({ status: "sending", message: "", errors: {} });
    try {
      const { data } = await api.post("/forms/submit", {
        form_id: "contact",
        page_slug: "contact",
        values,
        website: hp.current?.value || "",
        started_at: started.current,
      });
      setState({
        status: "sent",
        message: data?.message || "Thank you! We’ll get back to you soon.",
        errors: {},
      });
      setValues({ name: "", email: "", phone: "", message: "" });
    } catch (err) {
      const d = err?.response?.data || {};
      setState({
        status: "error",
        message:
          d.error || "Sorry, your message could not be sent. Please try again.",
        errors: d.fields || {},
      });
    }
  }
  const fieldError = (k) =>
    state.errors[k] ? (
      <span className="lg-err" id={`c-${k}-err`}>
        {state.errors[k]}
      </span>
    ) : null;

  return (
    <main className="lg-page">
      <header className="lg-hero">
        <p className="lg-kicker">We’d love to hear from you</p>
        <h1>Contact</h1>
        <p>
          Questions about your membership, a message, or the live services? Send
          us a note.
        </p>
      </header>

      <div className="lg-contactGrid">
        <section className="lg-cards" aria-label="Contact details">
          {CONTACT.email ? (
            <div className="lg-card">
              <h2>Email</h2>
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            </div>
          ) : null}
          {CONTACT.phone ? (
            <div className="lg-card">
              <h2>Phone</h2>
              <a href={`tel:${CONTACT.phone.replace(/[^0-9+]/g, "")}`}>
                {CONTACT.phone}
              </a>
              {CONTACT.hours ? (
                <span className="lg-muted">{CONTACT.hours}</span>
              ) : null}
            </div>
          ) : null}
          {CONTACT.address.length ? (
            <div className="lg-card">
              <h2>Address</h2>
              <address>
                {CONTACT.address.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </address>
            </div>
          ) : null}
        </section>

        <form
          className="lg-form"
          onSubmit={submit}
          noValidate
          aria-label="Send us a message"
        >
          <h2>Send us a message</h2>
          <label>
            <span>Name *</span>
            <input
              value={values.name}
              onChange={set("name")}
              required
              autoComplete="name"
              aria-invalid={!!state.errors.name}
              aria-describedby={state.errors.name ? "c-name-err" : undefined}
            />
            {fieldError("name")}
          </label>
          <label>
            <span>Email *</span>
            <input
              type="email"
              value={values.email}
              onChange={set("email")}
              required
              autoComplete="email"
              aria-invalid={!!state.errors.email}
              aria-describedby={state.errors.email ? "c-email-err" : undefined}
            />
            {fieldError("email")}
          </label>
          <label>
            <span>Phone</span>
            <input
              type="tel"
              value={values.phone}
              onChange={set("phone")}
              autoComplete="tel"
              aria-invalid={!!state.errors.phone}
              aria-describedby={state.errors.phone ? "c-phone-err" : undefined}
            />
            {fieldError("phone")}
          </label>
          <label>
            <span>Message *</span>
            <textarea
              rows={6}
              value={values.message}
              onChange={set("message")}
              required
              aria-invalid={!!state.errors.message}
              aria-describedby={
                state.errors.message ? "c-message-err" : undefined
              }
            />
            {fieldError("message")}
          </label>
          {/* spam trap: hidden from people */}
          <input
            ref={hp}
            name="website"
            tabIndex={-1}
            autoComplete="off"
            className="lg-hp"
            aria-hidden="true"
          />
          <button
            type="submit"
            className="lg-btn"
            disabled={state.status === "sending"}
          >
            {state.status === "sending" ? "Sending…" : "Send message"}
          </button>
          {state.status === "sent" ? (
            <p className="lg-ok" role="status">
              {state.message}
            </p>
          ) : null}
          {state.status === "error" ? (
            <p className="lg-bad" role="alert">
              {state.message}
            </p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
