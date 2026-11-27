#!/usr/bin/env node
// admin-panel/scripts/apply-profile.js
//
// Phase 2D: builds this website for ONE ministry from its client profile.
// Runs automatically before every build (npm run build / npm run deploy).
//
//   client-profile/
//     profile.json          name, addresses, colors, time zone (see below)
//     icon-192.png          square app icon, 192×192   (required)
//     icon-512.png          square app icon, 512×512   (required)
//     maskable-192.png      Android icon with safe margin (optional → icon)
//     maskable-512.png      (optional → icon)
//     apple-touch-icon.png  180×180 for iPhone (optional → icon-192)
//     favicon.png           browser tab icon (optional → icon-192)
//     share-image.png       link-preview picture (optional → icon-512)
//     logo.png              wide logo for the header (optional → name as text)
//     content/              this site's own pictures + defaults.json (optional)
//
// Without a client-profile folder nothing is changed.
// Check only:  node scripts/apply-profile.js --check
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
// Which ministry: client-profile/ (this repository's own site), or another
// folder, e.g. PROFILE_DIR=ministries/grace-church (automated deploys).
const DIR = path.resolve(ROOT, process.env.PROFILE_DIR || "client-profile");
const PUB = path.join(ROOT, "public");
const CHECK = process.argv.includes("--check");
const log = (...a) => console.log("[profile]", ...a);
const fail = (m) => {
  console.error(`\n[profile] ✗ ${m}\n`);
  process.exit(1);
};

if (!fs.existsSync(path.join(DIR, "profile.json"))) {
  if (process.env.PROFILE_DIR)
    fail(`no profile.json in ${process.env.PROFILE_DIR}`);
  log("no client-profile/profile.json — building with the current files.");
  process.exit(0);
}

let P;
try {
  P = JSON.parse(fs.readFileSync(path.join(DIR, "profile.json"), "utf8"));
} catch (e) {
  fail(`profile.json is not valid JSON: ${e.message}`);
}

// Build the same ministry for another address (e.g. a demo copy):
//   PROFILE_SITE_URL=https://tv.nolimitsmedia.com/bishoprobertson-tv npm run build
if (process.env.PROFILE_SITE_URL) P.site_url = process.env.PROFILE_SITE_URL;

// Addresses where several ministries share one site, each in its own folder.
const SHARED_HOSTS = ["tv.nolimitsmedia.com"];
// Folder names already used on those addresses (sales page, lead service…).
const RESERVED = [
  "api",
  "leads",
  "private",
  "cgi-bin",
  "content",
  "static",
  "assets",
  "admin",
  "www",
  "mail",
];

const HEX = /^#[0-9a-fA-F]{6}$/;
const str = (v) => (v == null ? "" : String(v).trim());
const problems = [];
const need = (k, ok, msg) =>
  !ok(str(P[k])) ? problems.push(`${k}: ${msg}`) : null;
need("site_name", (v) => v.length > 0 && v.length <= 60, "1–60 characters");
need(
  "short_name",
  (v) => v.length > 0 && v.length <= 12,
  "1–12 characters (home-screen label)",
);
need(
  "description",
  (v) => v.length >= 20 && v.length <= 300,
  "20–300 characters",
);
need(
  "site_url",
  (v) => /^https:\/\/[^\s]+[^/]$/.test(v),
  "https address, no trailing slash",
);
need(
  "api_url",
  (v) => /^https:\/\/[^\s/]+$/.test(v),
  "https address of the API server (no path)",
);
need("theme_color", (v) => HEX.test(v), "#rrggbb");
need("background_color", (v) => HEX.test(v), "#rrggbb");
need(
  "timezone",
  (v) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  },
  "a time zone name like America/Chicago",
);

// Shared address: exactly one folder per ministry, never a reserved name.
let sharedHost = P.shared_host === true;
try {
  const u = new URL(str(P.site_url));
  if (SHARED_HOSTS.includes(u.hostname)) {
    sharedHost = true;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length !== 1 || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(parts[0]))
      problems.push(
        `site_url: on ${u.hostname} use one folder of lowercase letters, digits and dashes (e.g. https://${u.hostname}/grace-church)`,
      );
    else if (RESERVED.includes(parts[0]))
      problems.push(
        `site_url: "${parts[0]}" is reserved on ${u.hostname}; choose another folder name`,
      );
  }
} catch {
  /* reported by the site_url check */
}

// PNG width/height from the file header (no image library needed).
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.toString("ascii", 1, 4) !== "PNG") return null;
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
const fileIn = (name) =>
  fs.existsSync(path.join(DIR, name)) ? path.join(DIR, name) : "";
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
]) {
  const f = fileIn(name);
  if (!f) problems.push(`${name}: required (square PNG, ${size}×${size})`);
  else {
    const d = pngSize(f);
    if (!d || d[0] !== size || d[1] !== size)
      problems.push(
        `${name}: must be a ${size}×${size} PNG (is ${d ? d.join("×") : "not a PNG"})`,
      );
  }
}
for (const [name, size] of [
  ["maskable-192.png", 192],
  ["maskable-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  const f = fileIn(name);
  if (f) {
    const d = pngSize(f);
    if (!d || d[0] !== size || d[1] !== size)
      problems.push(`${name}: must be a ${size}×${size} PNG`);
  }
}
if (problems.length)
  fail(`client profile needs fixing:\n  - ${problems.join("\n  - ")}`);
if (CHECK) {
  log(`✓ profile OK for ${P.site_name}`);
  process.exit(0);
}

const siteUrl = str(P.site_url);
const apiUrl = str(P.api_url);
const esc = (v) =>
  str(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// 1. index.html from the template
const tpl = fs.readFileSync(
  path.join(__dirname, "index.template.html"),
  "utf8",
);
const html = tpl
  .split("{{SITE_NAME}}")
  .join(esc(P.site_name))
  .split("{{SHORT_NAME}}")
  .join(esc(P.short_name))
  .split("{{DESCRIPTION}}")
  .join(esc(P.description))
  .split("{{SITE_URL}}")
  .join(esc(siteUrl))
  .split("{{API_ORIGIN}}")
  .join(esc(apiUrl))
  .split("{{THEME_COLOR}}")
  .join(esc(P.theme_color));
fs.writeFileSync(path.join(PUB, "index.html"), html);

// 2. icons, logo, share image
const copy = (from, to) => fs.copyFileSync(from, path.join(PUB, to));
copy(fileIn("icon-192.png"), "pwa-icon-192.png");
copy(fileIn("icon-512.png"), "pwa-icon-512.png");
copy(
  fileIn("maskable-192.png") || fileIn("icon-192.png"),
  "pwa-maskable-192.png",
);
copy(
  fileIn("maskable-512.png") || fileIn("icon-512.png"),
  "pwa-maskable-512.png",
);
copy(
  fileIn("apple-touch-icon.png") || fileIn("icon-192.png"),
  "apple-touch-icon.png",
);
copy(fileIn("favicon.png") || fileIn("icon-192.png"), "favicon.png");
copy(fileIn("share-image.png") || fileIn("icon-512.png"), "share-image.png");
const logoOut = path.join(PUB, "brand-logo.png");
if (fileIn("logo.png")) copy(fileIn("logo.png"), "brand-logo.png");
else if (fs.existsSync(logoOut)) fs.unlinkSync(logoOut); // header shows the name as text

// Offline screen (shown by the installed app without a connection)
const offlineFile = path.join(PUB, "offline.html");
if (fs.existsSync(offlineFile)) {
  const o = fs
    .readFileSync(offlineFile, "utf8")
    .replace(
      /<title>[^<]*<\/title>/,
      `<title>${esc(P.site_name)} — offline</title>`,
    )
    .replace(
      /<meta name="theme-color" content="[^"]*"/,
      `<meta name="theme-color" content="${esc(P.theme_color)}"`,
    );
  fs.writeFileSync(offlineFile, o);
}

// Files from the first ministry's build that nothing uses any more: removed so
// they never ship with another ministry's site.
for (const old of [
  "bishop-robertson-tv.png",
  "bishop-robertson-tv-512.png",
  "bishop-robertson-tv-icon-192.png",
  "bishop-robertson-tv-icon-512.png",
  "publicbishop-robertson-tv-192.png",
]) {
  const f = path.join(PUB, old);
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

// 3. manifest (home-screen app)
const manifest = {
  id: "./",
  name: str(P.site_name),
  short_name: str(P.short_name),
  description: str(P.app_description) || str(P.description),
  lang: str(P.lang) || "en",
  start_url: "./?source=app",
  scope: "./",
  display: "standalone",
  orientation: "any",
  theme_color: str(P.theme_color),
  background_color: str(P.background_color),
  categories: ["entertainment", "lifestyle", "education"],
  icons: [
    {
      src: "pwa-icon-192.png",
      type: "image/png",
      sizes: "192x192",
      purpose: "any",
    },
    {
      src: "pwa-icon-512.png",
      type: "image/png",
      sizes: "512x512",
      purpose: "any",
    },
    {
      src: "pwa-maskable-192.png",
      type: "image/png",
      sizes: "192x192",
      purpose: "maskable",
    },
    {
      src: "pwa-maskable-512.png",
      type: "image/png",
      sizes: "512x512",
      purpose: "maskable",
    },
  ],
};
fs.writeFileSync(
  path.join(PUB, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);

// 4. this site's own pictures and default wording: public/content = profile content
const contentOut = path.join(PUB, "content");
fs.rmSync(contentOut, { recursive: true, force: true });
fs.mkdirSync(contentOut, { recursive: true });
const contentIn = path.join(DIR, "content");
if (fs.existsSync(contentIn))
  for (const f of fs.readdirSync(contentIn))
    if (fs.statSync(path.join(contentIn, f)).isFile())
      fs.copyFileSync(path.join(contentIn, f), path.join(contentOut, f));
if (!fs.existsSync(path.join(contentOut, "defaults.json")))
  fs.writeFileSync(path.join(contentOut, "defaults.json"), "{}\n");

// 5. build settings read by the app (src/config/site.js, src/api.js, calendar)
const env = [
  "# Generated by scripts/apply-profile.js from client-profile/profile.json — do not edit.",
  `REACT_APP_SITE_NAME=${str(P.site_name)}`,
  `REACT_APP_SITE_SHORT_NAME=${str(P.short_name)}`,
  `REACT_APP_SITE_URL=${siteUrl}`,
  `REACT_APP_SITE_DESCRIPTION=${str(P.description).replace(/\n/g, " ")}`,
  `REACT_APP_API_BASE_URL=${apiUrl}/api`,
  `REACT_APP_CALENDAR_TIMEZONE=${str(P.timezone)}`,
  // Several ministries on one address: keep each one's browser storage separate.
  `REACT_APP_SHARED_HOST=${sharedHost ? "1" : "0"}`,
  "",
].join("\n");
fs.writeFileSync(path.join(ROOT, ".env.production.local"), env);

// 6. the address the site is served from (sets the paths inside the build)
const pkgFile = path.join(ROOT, "package.json");
const raw = fs.readFileSync(pkgFile, "utf8");
const pkg = JSON.parse(raw);
if (pkg.homepage !== siteUrl) {
  pkg.homepage = siteUrl;
  const nl = raw.includes("\r\n") ? "\r\n" : "\n";
  fs.writeFileSync(
    pkgFile,
    JSON.stringify(pkg, null, 2).replace(/\n/g, nl) + nl,
  );
}

log(`✓ applied profile: ${P.site_name} (${siteUrl})`);
