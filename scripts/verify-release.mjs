#!/usr/bin/env node
/** Verify real GitHub release metadata and both Beta updater manifests. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { desktopReleaseAssets } from "./prepare-desktop-release.mjs";

const tag = process.argv[2];
if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-beta\.[1-9]\d*)?$/.test(tag || "")) {
  console.error("Usage: node scripts/verify-release.mjs <tag> (e.g. v1.5.2-beta.1)");
  process.exit(1);
}

const repo = "shawn89890916/NavoPath-planner";
const expectedVersion = tag.slice(1);
const isBeta = expectedVersion.includes("-beta.");
let failures = 0;
function fail(message) { console.error(`  FAIL  ${message}`); failures++; }
function ok(message) { console.log(`  OK    ${message}`); }

console.log(`Verifying release ${tag}...`);
let release;
try {
  release = JSON.parse(execFileSync("gh", ["release", "view", tag, "--repo", repo, "--json", "tagName,isDraft,isPrerelease,assets"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
} catch {
  console.error("Could not fetch release metadata. Is gh authenticated?");
  process.exit(2);
}
if (release.tagName !== tag) fail("release tag does not match the requested tag");
if (release.isDraft) fail("release is still a draft");
else ok("release is published");
if (release.isPrerelease !== isBeta) fail(isBeta ? "Beta release must be marked prerelease" : "stable release must not be marked prerelease");
else ok(isBeta ? "Beta release is marked prerelease" : "stable release is not a prerelease");

const required = desktopReleaseAssets.filter((name) => isBeta || name !== "beta.yml");
for (const name of required) {
  const asset = release.assets.find((item) => item.name === name);
  if (!asset) fail(`missing asset: ${name}`);
  else if (asset.state !== "uploaded" || asset.size <= 0) fail(`asset is incomplete: ${name}`);
  else if (/untagged-/.test(asset.url || "")) fail(`asset is on an untagged URL: ${name}`);
  else ok(`asset present: ${name} (${asset.size} bytes)`);
}

const manifests = isBeta ? ["latest.yml", "beta.yml"] : ["latest.yml"];
const directory = mkdtempSync(path.join(os.tmpdir(), "navopath-release-"));
const contents = [];
try {
  for (const name of manifests) {
    const file = path.join(directory, name);
    try {
      execFileSync("gh", ["release", "download", tag, "--repo", repo, "--pattern", name, "--output", file], { stdio: "ignore" });
      const yml = readFileSync(file, "utf8");
      contents.push(yml);
      if (yml.match(/^version:\s*(.+)$/m)?.[1]?.trim() !== expectedVersion) fail(`${name} version does not match ${tag}`);
      else ok(`${name} version matches ${tag}`);
      if (!/^sha512:\s*\S+/m.test(yml)) fail(`${name} is missing sha512`);
      const size = Number(yml.match(/^\s+size:\s*(\d+)/m)?.[1]);
      const installer = release.assets.find((item) => item.name === "NavoPath-Setup.exe");
      if (!size || installer?.size !== size) fail(`${name} installer size does not match the release asset`);
    } catch (error) {
      fail(`could not inspect ${name}: ${error.message}`);
    } finally {
      try { unlinkSync(file); } catch { /* download may not have created a file */ }
    }
  }
} finally {
  rmdirSync(directory);
}
if (isBeta && contents.length === 2 && contents[0] !== contents[1]) fail("Beta and latest manifests describe different installers");
if (failures) {
  console.error(`${failures} release check(s) failed.`);
  process.exit(1);
}
console.log("All release and update-channel checks passed.");
