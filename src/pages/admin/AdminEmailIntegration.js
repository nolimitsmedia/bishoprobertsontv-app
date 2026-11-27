// src/pages/admin/AdminEmailIntegration.js
//
// Integrations › Email: the account that sends EVERY email the site sends —
// welcome and password-reset emails, receipts, live service reminders, form
// notifications and Email Center campaigns. No server settings needed.
// Passwords and API keys are stored encrypted on the server and never shown.

import React, { useCallback, useEffect, useState } from "react";
import api from "../../api";
import { confirmDialog } from "../../components/ui/Dialogs";
import "./AdminMedia.css";
import "./AdminTeam.css";
import "./AdminPages.css";
import "./AdminEmailIntegration.css";
import { SITE } from "../../config/site";

const errText = (e, f) => e?.response?.data?.error || f;

// [value, name, one-line description]
const WEB_SERVICES = [
  ["mailgun", "Mailgun", "Email sending service. Best for large lists."],
  [
    "sendgrid",
    "SendGrid",
    "Email sending service by Twilio, with a free plan.",
  ],
  [
    "postmark",
    "Postmark",
    "Fast delivery for account emails like password resets.",
  ],
  ["brevo", "Brevo", "Email sending service with a generous free plan."],
  ["resend", "Resend", "Simple email sending service with a free plan."],
];
const MAIL_ACCOUNTS = [
  [
    "gmail",
    "Gmail / Google Workspace",
    "Send from a Gmail or Google Workspace address.",
  ],
  ["microsoft365", "Microsoft 365", "Send from a Microsoft 365 work address."],
  ["zoho", "Zoho Mail", "Send from a Zoho Mail address."],
  [
    "smtp",
    "Other email host",
    "Any provider that gives you mail-server (SMTP) settings.",
  ],
];
const MAIL_ACCOUNT_IDS = MAIL_ACCOUNTS.map(([v]) => v);
const LABEL = Object.fromEntries(
  [...WEB_SERVICES, ...MAIL_ACCOUNTS].map(([v, n]) => [v, n]),
);
const SECRET = (p) => (MAIL_ACCOUNT_IDS.includes(p) ? "password" : "api_key");

const EMPTY_SETTINGS = {
  from_name: SITE.name,
  from_email: "",
  reply_to: "",
  notify_to: "",
  domain: "",
  region: "us",
  username: "",
  zoho_region: "com",
  host: "",
  port: "587",
  security: "starttls",
};

function ago(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const ExtLink = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

// Where to find the key/password, per service.
function ProviderHelp({ provider }) {
  switch (provider) {
    case "mailgun":
      return (
        <p className="ml-help">
          In Mailgun: <strong>Send › Sending › Domains</strong> for the domain,
          and <strong>API Security</strong> for the API key. A “sandbox” domain
          only sends to addresses you list as Authorized Recipients.
        </p>
      );
    case "sendgrid":
      return (
        <p className="ml-help">
          In SendGrid: <strong>Settings › API Keys › Create API Key</strong>{" "}
          (Restricted, with “Mail Send” on). Verify the From address under{" "}
          <strong>Settings › Sender Authentication</strong>.
        </p>
      );
    case "postmark":
      return (
        <p className="ml-help">
          In Postmark: open your Server, then <strong>API Tokens</strong> and
          copy the Server API token. Add the From address (or its domain) under{" "}
          <strong>Sender Signatures</strong>.
        </p>
      );
    case "brevo":
      return (
        <p className="ml-help">
          In Brevo: <strong>SMTP &amp; API › API Keys › Generate</strong> (the
          key starts with “xkeysib-”). Add the From address under{" "}
          <strong>Senders, Domains &amp; Dedicated IPs</strong>.
        </p>
      );
    case "resend":
      return (
        <p className="ml-help">
          In Resend: <strong>API Keys › Create API Key</strong> (Sending
          access). The From address must be on a domain verified under{" "}
          <strong>Domains</strong>.
        </p>
      );
    case "gmail":
      return (
        <p className="ml-help">
          Use an <strong>App Password</strong>, not the normal Gmail password:
          turn on 2-Step Verification, then create one at{" "}
          <ExtLink href="https://myaccount.google.com/apppasswords">
            myaccount.google.com/apppasswords
          </ExtLink>
          . Google limits sending to about 500 emails a day (2,000 on Google
          Workspace), so Gmail suits account emails, not large campaigns.
        </p>
      );
    case "microsoft365":
      return (
        <p className="ml-help">
          Your Microsoft 365 administrator must turn on{" "}
          <strong>Authenticated SMTP</strong> for this mailbox. Microsoft plans
          to turn it off by default at the end of December 2026 (administrators
          can turn it back on). Personal Outlook.com and Hotmail addresses can’t
          be used.
        </p>
      );
    case "zoho":
      return (
        <p className="ml-help">
          If two-factor sign-in is on, create an{" "}
          <strong>Application-Specific Password</strong> in Zoho (My Account ›
          Security) and use it here. Choose the data center that matches your
          Zoho address (zoho.com, zoho.eu…).
        </p>
      );
    default:
      return (
        <p className="ml-help">
          Your email host lists these as “SMTP” or “outgoing mail server”
          settings. Port 465 uses SSL; port 587 uses STARTTLS.
        </p>
      );
  }
}

export default function AdminEmailIntegration() {
  const [info, setInfo] = useState(null); // GET /connection
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState("");
  const [provider, setProvider] = useState("mailgun");
  const [st, setSt] = useState(EMPTY_SETTINGS);
  const [secret, setSecret] = useState("");
  const [testTo, setTestTo] = useState("");

  const load = useCallback(async (prefill = true) => {
    try {
      const { data } = await api.get("/admin/email/connection");
      setInfo(data);
      setLoadError("");
      const cur = data.current;
      if (prefill && cur && cur.source === "admin") {
        setProvider(cur.provider);
        setSt({
          ...EMPTY_SETTINGS,
          ...Object.fromEntries(
            Object.entries(cur.settings || {}).map(([k, v]) => [k, String(v)]),
          ),
        });
      }
      return data;
    } catch (e) {
      setLoadError(errText(e, "Email settings could not be loaded."));
      return null;
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  const cur = info?.current || null;
  const savedHere =
    cur?.source === "admin" && cur.provider === provider && cur.has_secret;
  const secretName = SECRET(provider);
  const set = (patch) => setSt((x) => ({ ...x, ...patch }));
  const field = (key) => ({
    value: st[key] ?? "",
    onChange: (e) => set({ [key]: e.target.value }),
  });

  const formBody = () => ({
    provider,
    settings: { ...st, port: Number(st.port) || undefined },
    secrets: { [secretName]: secret },
  });

  async function run(kind, fn) {
    setBusy(kind);
    setNotice(null);
    try {
      await fn();
    } finally {
      setBusy("");
    }
  }

  const save = () =>
    run("save", async () => {
      try {
        await api.post("/admin/email/connect", formBody());
        setSecret("");
        await load(true);
        setNotice({
          tone: "success",
          text: `Saved. The site now sends its emails with ${LABEL[provider]}. Send a test to make sure they arrive.`,
        });
      } catch (e) {
        setNotice({ tone: "error", text: errText(e, "Could not save.") });
      }
    });

  const test = (useForm) =>
    run(useForm ? "testForm" : "testCurrent", async () => {
      try {
        const body = { to: testTo.trim() || undefined };
        const { data } = await api.post(
          "/admin/email/test",
          useForm ? { ...body, ...formBody() } : body,
        );
        if (!useForm) await load(false);
        setNotice({
          tone: "success",
          text:
            data.message +
            (useForm && !(cur?.source === "admin" && cur.provider === provider)
              ? " If it arrived, press Save to start using this account."
              : ""),
        });
      } catch (e) {
        if (!useForm) await load(false);
        setNotice({
          tone: "error",
          text: errText(e, "The test email could not be sent."),
        });
      }
    });

  const disconnect = () =>
    run("disconnect", async () => {
      const ok = await confirmDialog({
        title: "Disconnect this email account?",
        message: info?.server_fallback
          ? "The server’s built-in settings will send the site’s emails instead."
          : "The site will stop sending emails until another account is connected.",
        confirmLabel: "Disconnect",
        danger: true,
      });
      if (!ok) return;
      try {
        await api.post("/admin/email/disconnect");
        await load(false);
        setNotice({ tone: "success", text: "Email account disconnected." });
      } catch (e) {
        setNotice({ tone: "error", text: errText(e, "Could not disconnect.") });
      }
    });

  if (!info)
    return (
      <main className="ml-page tm-page">
        <h1>Email</h1>
        {loadError ? (
          <div className="ml-notice error" role="alert">
            {loadError}
          </div>
        ) : (
          <p className="ml-help" role="status">
            Loading…
          </p>
        )}
      </main>
    );

  const status = cur?.status || {};
  const mailAccount = MAIL_ACCOUNT_IDS.includes(provider);

  return (
    <main className="ml-page tm-page eml-page">
      <div className="ml-header">
        <div>
          <h1>Email</h1>
          <p>
            Choose the account that sends the site’s emails: welcome and
            password-reset emails, receipts, live service reminders, form
            notifications and Email Center campaigns.
          </p>
        </div>
      </div>

      {notice ? (
        <div
          className={`ml-notice ${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            className="ml-link"
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {!info.encryption_ready ? (
        <div className="ml-notice error" role="alert">
          <span>
            The server can’t store passwords safely yet: it’s missing the
            APP_ENCRYPTION_KEY setting. Ask your developer to add it in Render ›
            Environment before connecting an account.
          </span>
        </div>
      ) : null}

      {/* What sends the emails right now */}
      <section className="tm-card" aria-labelledby="eml-now">
        <h2 id="eml-now">Sending now</h2>
        {cur ? (
          <div className="eml-status">
            <p className="eml-statusMain">
              <span
                className={`eml-dot ${status.last_error && (!status.last_sent_at || new Date(status.last_error_at) > new Date(status.last_sent_at)) ? "is-warn" : "is-ok"}`}
                aria-hidden="true"
              />
              <span>
                <strong>{cur.provider_label}</strong>
                {cur.settings?.from_email
                  ? ` · ${cur.settings.from_email}`
                  : ""}
              </span>
            </p>
            {cur.source === "server" ? (
              <p className="ml-help">
                Using the server’s built-in settings. Connect an account below
                to manage it here instead.
              </p>
            ) : null}
            <p className="ml-help">
              {status.last_sent_at
                ? `Last email sent ${ago(status.last_sent_at)}.`
                : "No email sent yet with this account."}
              {status.last_test_at
                ? ` Last test ${ago(status.last_test_at)}: ${status.last_test_ok ? "delivered to the email service" : "failed"}.`
                : ""}
            </p>
            {status.last_error &&
            (!status.last_sent_at ||
              new Date(status.last_error_at) >
                new Date(status.last_sent_at)) ? (
              <p className="eml-problem" role="alert">
                Last problem ({ago(status.last_error_at)}): {status.last_error}
              </p>
            ) : null}
            {cur.warning ? (
              <p className="eml-problem" role="alert">
                {cur.warning}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="eml-problem" role="alert">
            {info.error ||
              "No email account is connected, so the site isn’t sending emails. Connect one below."}
          </p>
        )}
        <div className="eml-testRow">
          <label className="eml-testTo">
            Send test emails to
            <input
              className="ml-input"
              type="email"
              value={testTo}
              placeholder="Your sign-in email"
              autoComplete="email"
              onChange={(e) => setTestTo(e.target.value)}
            />
          </label>
          {cur ? (
            <button
              type="button"
              className="ml-btn"
              disabled={!!busy}
              onClick={() => test(false)}
            >
              {busy === "testCurrent" ? "Sending…" : "Send a test email"}
            </button>
          ) : null}
          {cur?.source === "admin" ? (
            <button
              type="button"
              className="ml-btn ml-btnDanger"
              disabled={!!busy}
              onClick={disconnect}
            >
              {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
            </button>
          ) : null}
        </div>
      </section>

      {/* Choose a service */}
      <section className="tm-card" aria-labelledby="eml-service">
        <h2 id="eml-service">
          {cur?.source === "admin"
            ? "Change the email account"
            : "Connect an email account"}
        </h2>
        <fieldset className="lvs-providers eml-providers">
          <legend className="eml-groupTitle">
            Email sending services
            <small>Work with any server. Best for many emails.</small>
          </legend>
          {WEB_SERVICES.map(([v, name, help]) => (
            <label
              key={v}
              className={`lvs-provider${provider === v ? " is-on" : ""}`}
            >
              <input
                type="radio"
                name="eml-provider"
                value={v}
                checked={provider === v}
                onChange={() => {
                  setProvider(v);
                  setSecret("");
                }}
              />
              <span>
                <strong>{name}</strong>
                <small>{help}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="lvs-providers eml-providers">
          <legend className="eml-groupTitle">
            Your own email address
            <small>
              Sends through your email provider’s mail server (SMTP).
              {info.host === "render"
                ? " Render’s free plan blocks these connections; they work on paid Render plans."
                : ""}
            </small>
          </legend>
          {MAIL_ACCOUNTS.map(([v, name, help]) => (
            <label
              key={v}
              className={`lvs-provider${provider === v ? " is-on" : ""}`}
            >
              <input
                type="radio"
                name="eml-provider"
                value={v}
                checked={provider === v}
                onChange={() => {
                  setProvider(v);
                  setSecret("");
                }}
              />
              <span>
                <strong>{name}</strong>
                <small>{help}</small>
              </span>
            </label>
          ))}
        </fieldset>
      </section>

      {/* Connection details */}
      <section className="tm-card" aria-labelledby="eml-details">
        <h2 id="eml-details">{LABEL[provider]} details</h2>
        <ProviderHelp provider={provider} />
        <div className="ss-grid">
          {provider === "mailgun" ? (
            <>
              <label>
                Sending domain
                <input
                  className="ml-input"
                  placeholder="mg.yourdomain.com"
                  autoComplete="off"
                  {...field("domain")}
                />
              </label>
              <label>
                Region
                <select
                  className="ml-input"
                  aria-label="Region"
                  {...field("region")}
                >
                  <option value="us">United States (api.mailgun.net)</option>
                  <option value="eu">Europe (api.eu.mailgun.net)</option>
                </select>
              </label>
            </>
          ) : null}
          {provider === "smtp" ? (
            <>
              <label>
                Mail server
                <input
                  className="ml-input"
                  placeholder="smtp.yourhost.com"
                  autoComplete="off"
                  {...field("host")}
                />
              </label>
              <label>
                Port
                <input
                  className="ml-input"
                  inputMode="numeric"
                  {...field("port")}
                  onChange={(e) => {
                    const port = e.target.value.replace(/\D/g, "");
                    set({
                      port,
                      ...(port === "465" ? { security: "ssl" } : {}),
                      ...(port === "587" ? { security: "starttls" } : {}),
                    });
                  }}
                />
              </label>
              <label>
                Security
                <select
                  className="ml-input"
                  aria-label="Security"
                  {...field("security")}
                >
                  <option value="ssl">SSL/TLS (usually port 465)</option>
                  <option value="starttls">STARTTLS (usually port 587)</option>
                  <option value="none">None (not recommended)</option>
                </select>
              </label>
            </>
          ) : null}
          {provider === "zoho" ? (
            <label>
              Zoho data center
              <select
                className="ml-input"
                aria-label="Zoho data center"
                {...field("zoho_region")}
              >
                <option value="com">zoho.com (United States)</option>
                <option value="eu">zoho.eu (Europe)</option>
                <option value="in">zoho.in (India)</option>
                <option value="au">zoho.com.au (Australia)</option>
                <option value="jp">zoho.jp (Japan)</option>
                <option value="ca">zohocloud.ca (Canada)</option>
              </select>
            </label>
          ) : null}
          {mailAccount ? (
            <label>
              {provider === "smtp" ? "Username" : "Email account"}
              <input
                className="ml-input"
                type={provider === "smtp" ? "text" : "email"}
                autoComplete="off"
                placeholder={
                  provider === "gmail"
                    ? "name@gmail.com"
                    : provider === "smtp"
                      ? "Usually the full email address"
                      : "name@yourdomain.com"
                }
                {...field("username")}
              />
            </label>
          ) : null}
          <label>
            {secretName === "password"
              ? provider === "gmail"
                ? "App password"
                : "Password"
              : provider === "postmark"
                ? "Server API token"
                : "API key"}
            <input
              className="ml-input"
              type="password"
              autoComplete="new-password"
              value={secret}
              placeholder={savedHere ? "Saved — leave empty to keep it" : ""}
              onChange={(e) => setSecret(e.target.value)}
            />
          </label>
        </div>
      </section>

      {/* Sender */}
      <section className="tm-card" aria-labelledby="eml-sender">
        <h2 id="eml-sender">Sender</h2>
        <div className="ss-grid">
          <label>
            From name
            <input className="ml-input" {...field("from_name")} />
          </label>
          <label>
            From address
            <input
              className="ml-input"
              type="email"
              placeholder="hello@yourdomain.com"
              {...field("from_email")}
            />
          </label>
          <label>
            <span>
              Replies go to <span className="eml-optional">(optional)</span>
            </span>
            <input
              className="ml-input"
              type="email"
              placeholder="Same as the From address"
              {...field("reply_to")}
            />
          </label>
          <label>
            <span>
              Office notifications go to{" "}
              <span className="eml-optional">(optional)</span>
            </span>
            <input
              className="ml-input"
              type="email"
              placeholder="Where new sign-up alerts are sent"
              {...field("notify_to")}
            />
          </label>
        </div>
        {provider === "gmail" ? (
          <p className="ml-help">
            Gmail sends from the signed-in account. To use a different From
            address, add it first in Gmail › Settings › Accounts › “Send mail
            as”.
          </p>
        ) : null}
        <div className="eml-actions">
          <button
            type="button"
            className="ml-btn"
            disabled={!!busy}
            onClick={() => test(true)}
          >
            {busy === "testForm"
              ? "Sending…"
              : "Send a test with these settings"}
          </button>
          <button
            type="button"
            className="ml-btn ml-btnPrimary"
            disabled={!!busy || !info.encryption_ready}
            onClick={save}
          >
            {busy === "save" ? "Saving…" : "Save"}
          </button>
        </div>
      </section>
    </main>
  );
}
