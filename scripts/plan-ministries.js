#!/usr/bin/env node
// admin-panel/scripts/plan-ministries.js
// Which ministries the deploy workflow should build and upload.
//   node scripts/plan-ministries.js --one grace-tv           (run by hand)
//   node scripts/plan-ministries.js --all
//   git diff --name-only A B | node scripts/plan-ministries.js --changed
// Changes only inside ministries/<x>/ → just those; any shared code change
// (src/, public/, scripts/, package files…) → all. Prints a JSON list.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const check = (names) => {
  let out;
  try {
    out = execFileSync(process.execPath, [path.join(__dirname, "check-ministries.js"), ...names], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    });
  } catch {
    process.exit(1); // check-ministries already printed what to fix
  }
  return out.split("\n").filter(Boolean);
};
const exists = (f) => fs.existsSync(path.join(ROOT, "ministries", f, "profile.json"));

let list;
if (args[0] === "--one" && args[1]) list = check([args[1]]);
else if (args[0] === "--changed") {
  const files = fs.readFileSync(0, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
  const shared = files.some((f) => !f.startsWith("ministries/") && !f.startsWith("client-profile/") && !/\.md$/i.test(f));
  if (shared) list = check([]);
  else {
    const touched = [...new Set(files.filter((f) => f.startsWith("ministries/")).map((f) => f.split("/")[1]))];
    const still = touched.filter(exists); // a removed ministry has nothing to build
    list = still.length ? check(still) : [];
  }
} else list = check([]);
process.stdout.write(JSON.stringify(list));
