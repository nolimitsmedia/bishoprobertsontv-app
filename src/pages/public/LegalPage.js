// src/pages/public/LegalPage.js — /terms and /privacy
// Fallback Terms/Privacy (only when the page isn't published in Admin › Pages).
// Drafts to be reviewed by the ministry (and ideally a lawyer). Fill in the
// bracketed parts. The site name comes from the client profile (Phase 2D).
import React from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "../../utils/pageMeta";
import { contactInfo } from "./ContactPage";
import { useSiteDefaults } from "../../lib/siteContent";
import { SITE as SITE_CONFIG } from "../../config/site";
import "./LegalPages.css";

const SITE = SITE_CONFIG.name;
const OWNER = "[Legal name of the ministry or company]";
const UPDATED = "November 2026";
const STATE = "[State, e.g. Virginia]";

const TERMS = [
  [
    "About these terms",
    [
      `These Terms and Conditions (“Terms”) govern your use of ${SITE}, its website, apps and live services (the “Service”), operated by ${OWNER} (“we”, “us”). By creating an account or using the Service you agree to these Terms. If you do not agree, please do not use the Service.`,
    ],
  ],
  [
    "Your account",
    [
      "You must provide accurate information and keep your password secure. You are responsible for activity on your account. Tell us promptly if you believe your account has been used without your permission.",
      "You must be at least 13 years old to create an account. If you are under the age of majority where you live, a parent or guardian must agree to these Terms for you.",
    ],
  ],
  [
    "Free accounts, memberships and payments",
    [
      "Some content is free; other content is for members or requires a paid membership or purchase. Prices, what is included and the billing period are shown before you buy.",
      "Paid memberships renew automatically at the end of each billing period until you cancel. You can cancel at any time in your account; cancellation takes effect at the end of the current period and you keep access until then. Except where the law requires otherwise, payments are not refundable.",
      "Payments are processed by our payment provider (Stripe). We do not store your full card details. We may change prices with notice; changes apply from your next billing period.",
    ],
  ],
  [
    "Using the content",
    [
      "Messages, videos, live services, music, artwork and other content on the Service belong to us or our licensors and are protected by copyright and other laws.",
      "We give you a personal, non-transferable, non-exclusive permission to watch the content for your own, non-commercial use through the Service. You may not copy, download (except where we offer a download), record, re-broadcast, resell, publicly show or share the content, or share your account or password, or try to get around access controls or content protection.",
    ],
  ],
  [
    "Community, comments and live chat",
    [
      "You are responsible for what you post. Be respectful. Do not post anything unlawful, hateful, harassing, sexually explicit, misleading, spam or advertising, or anything that infringes someone else’s rights or shares their private information.",
      "By posting you give us permission to display your post on the Service. We may remove posts and suspend or close accounts that break these rules, at our discretion.",
    ],
  ],
  [
    "Live services and availability",
    [
      "We aim to keep the Service available, but it may sometimes be unavailable, interrupted or changed, including live services, which depend on third-party providers. Content may be added or removed over time.",
    ],
  ],
  [
    "Ending your use",
    [
      "You may stop using the Service and close your account at any time. We may suspend or end your access if you break these Terms or if we stop providing the Service. Sections that by their nature should continue (for example ownership of content, limits of liability) continue after your access ends.",
    ],
  ],
  [
    "Disclaimers and limitation of liability",
    [
      "The Service is provided “as is” and “as available”, without warranties of any kind to the fullest extent allowed by law. Teaching and other content is for spiritual and general information and is not professional (for example medical, legal or financial) advice.",
      `To the fullest extent allowed by law, ${OWNER} is not liable for indirect, incidental, special or consequential damages, and our total liability for any claim relating to the Service is limited to the amount you paid us in the 12 months before the claim.`,
    ],
  ],
  [
    "Governing law",
    [
      `These Terms are governed by the laws of ${STATE}, United States, without regard to its conflict of law rules.`,
    ],
  ],
  [
    "Changes to these terms",
    [
      "We may update these Terms. If the changes are significant we will tell you (for example by email or a notice on the Service). Continuing to use the Service after the changes take effect means you accept them.",
    ],
  ],
];

const PRIVACY = [
  [
    "About this policy",
    [
      `This Privacy Policy explains what personal information ${OWNER} (“we”, “us”) collects when you use ${SITE} (the “Service”), how we use it and the choices you have.`,
    ],
  ],
  [
    "Information we collect",
    [
      "Account information: your name, email address, password (stored securely, never in plain text) and profile picture if you add one.",
      "Membership and payment information: your membership, purchases and billing history. Card payments are handled by Stripe; we do not receive or store your full card number.",
      "Viewing activity: what you watch, where you stopped (so you can resume), your My List and playlists, and reminders you set for live services.",
      "Things you post: comments, community posts and live chat messages, and messages you send us through the contact form.",
      "Technical information: device and browser type, IP address, pages viewed and similar log data, and information stored in your browser (cookies and local storage) to keep you signed in and remember your preferences.",
    ],
  ],
  [
    "How we use it",
    [
      "To provide the Service: your account, streaming, resuming where you left off, memberships and purchases.",
      "To communicate with you: account and billing emails, reminders you asked for (for example “Notify me” for a live service) and, if you agreed, news about new messages and events. You can unsubscribe from non-essential emails at any time.",
      "To keep the Service safe and working: preventing fraud and abuse, moderating posts, fixing problems and understanding how the Service is used so we can improve it.",
      "To meet legal obligations.",
    ],
  ],
  [
    "Who we share it with",
    [
      "We do not sell your personal information. We share it only with service providers that help us run the Service, under agreements to protect it: video delivery (Bunny.net), payments (Stripe), hosting and databases, file storage, and email delivery; and when required by law or to protect our rights and users’ safety.",
    ],
  ],
  [
    "How long we keep it",
    [
      "We keep your information while your account is open and as long as needed for the purposes above, including legal, tax and accounting requirements. When you close your account we delete or anonymize your information within a reasonable time, except where we must keep it.",
    ],
  ],
  [
    "Your choices and rights",
    [
      "You can view and update your account details in your account. You can ask us for a copy of your information, to correct it or to delete your account by contacting us (details below). Depending on where you live you may have additional rights under local law, which we will respect.",
      "You can control cookies in your browser settings; blocking them may stop you staying signed in.",
    ],
  ],
  [
    "Children",
    [
      "The Service is not directed to children under 13 and we do not knowingly collect their personal information. If you believe a child has given us information, contact us and we will delete it.",
    ],
  ],
  [
    "Security",
    [
      "We use reasonable technical and organizational measures to protect your information, such as encrypted connections and secure password storage. No method of transmission or storage is completely secure.",
    ],
  ],
  [
    "Changes to this policy",
    [
      "We may update this policy. If the changes are significant we will tell you, for example by email or a notice on the Service.",
    ],
  ],
];

const PAGES = {
  terms: {
    title: "Terms and Conditions",
    intro: `Please read these terms before using ${SITE}.`,
    sections: TERMS,
  },
  privacy: {
    title: "Privacy Policy",
    intro: "How we collect, use and protect your information.",
    sections: PRIVACY,
  },
};
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function LegalPage({ kind = "terms" }) {
  useSiteDefaults();
  const CONTACT = contactInfo();
  const page = PAGES[kind] || PAGES.terms;
  usePageMeta({ title: page.title, description: page.intro });
  return (
    <main className="lg-page lg-page--doc">
      <header className="lg-hero">
        <p className="lg-kicker">Last updated: {UPDATED}</p>
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
      </header>
      <nav className="lg-toc" aria-label="On this page">
        <strong>On this page</strong>
        <ol>
          {page.sections.map(([h]) => (
            <li key={h}>
              <a
                href={`#${slug(h)}`}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById(slug(h))
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {h}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <article className="lg-doc">
        {page.sections.map(([h, paras]) => (
          <section key={h} id={slug(h)}>
            <h2>{h}</h2>
            {paras.map((p) => (
              <p key={p.slice(0, 40)}>{p}</p>
            ))}
          </section>
        ))}
        <section id="contact-us">
          <h2>Contact us</h2>
          <p>
            Questions about this {kind === "privacy" ? "policy" : "agreement"}?
            {CONTACT.email ? (
              <>
                Email <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> or
                use our{" "}
              </>
            ) : (
              "Use our "
            )}
            <Link to="/contact">contact page</Link>.
          </p>
        </section>
      </article>
    </main>
  );
}
