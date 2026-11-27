#!/usr/bin/env node
// admin-panel/scripts/check-ministries.js
//
// Checks every ministry hosted on tv.nolimitsmedia.com (ministries/<folder>/):
// profile valid, folder name = the address's folder, no duplicates.
// Prints the folder names (one per line) for the deploy workflow.
//   node scripts/check-ministries.js            all ministries
//   node scripts/check-ministries.js grace-tv   just one
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "ministries");
const only = process.argv.slice(2).filter(Boolean);
const folders = fs.existsSync(DIR)
  ? fs
      .readdirSync(DIR)
      // folders starting with "_" or "." are notes/examples, never deployed
      .filter((f) => !/^[_.]/.test(f) && fs.statSync(path.join(DIR, f)).isDirectory())
  : [];
const problems = [];
const ok = [];
const seen = new Map();
for (const f of folders) {
  if (only.length && !only.includes(f)) continue;
  const file = path.join(DIR, f, "profile.json");
  if (!fs.existsSync(file)) {
    problems.push(`${f}: no profile.json`);
    continue;
  }
  let p;
  try {
    p = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    problems.push(`${f}: profile.json is not valid JSON (${e.message})`);
    continue;
  }
  let folder = "";
  try {
    const u = new URL(String(p.site_url || ""));
    folder = u.pathname.split("/").filter(Boolean).join("/");
    if (u.hostname !== "tv.nolimitsmedia.com")
      problems.push(`${f}: site_url must be on https://tv.nolimitsmedia.com/ (is ${u.hostname})`);
  } catch {
    problems.push(`${f}: site_url missing or invalid`);
  }
  if (folder && folder !== f)
    problems.push(`${f}: folder name must match the address (site_url ends in /${folder})`);
  if (seen.has(folder)) problems.push(`${f}: same address as ${seen.get(folder)}`);
  seen.set(folder, f);
  // Full profile rules (sizes, colors, reserved names…) from apply-profile.
  try {
    execFileSync(process.execPath, [path.join(__dirname, "apply-profile.js"), "--check"], {
      env: { ...process.env, PROFILE_DIR: path.join("ministries", f) },
      stdio: "pipe",
    });
  } catch (e) {
    problems.push(`${f}: ${String(e.stderr || e.stdout || e.message).replace(/\[profile\] ✗ /, "").trim()}`);
    continue;
  }
  ok.push(f);
}
for (const o of only) if (!folders.includes(o)) problems.push(`${o}: no folder ministries/${o}`);
if (problems.length) {
  console.error(`✗ Ministry profiles need fixing:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
process.stdout.write(ok.join("\n") + (ok.length ? "\n" : ""));
