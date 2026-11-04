import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assertDesktopReleasePolicy, desktopReleaseAssets, prepareDesktopRelease } from "./prepare-desktop-release.mjs";

const betaPkg = { version: "1.6.0-beta.1", build: { publish: { provider: "github", releaseType: "prerelease", channel: "beta" } } };
const stablePkg = { version: "1.6.0", build: { publish: { provider: "github", releaseType: "release", channel: "latest" } } };

test("release policy accepts stable semver on latest and numbered Beta semver on beta", () => {
  assert.doesNotThrow(() => assertDesktopReleasePolicy(betaPkg));
  assert.doesNotThrow(() => assertDesktopReleasePolicy(stablePkg));
  for (const version of ["1.6", "1.6.0-beta", "1.6.0-alpha.1", "1.6.0-beta.0", "v1.6.0", "01.6.0"]) {
    assert.throws(() => assertDesktopReleasePolicy({ ...stablePkg, version }), /semver/);
  }
  assert.throws(() => assertDesktopReleasePolicy({ ...betaPkg, build: { publish: { provider: "github", releaseType: "release", channel: "latest" } } }), /Beta/);
  assert.throws(() => assertDesktopReleasePolicy({ ...stablePkg, build: { publish: { provider: "github", releaseType: "prerelease", channel: "beta" } } }), /stable/);
  assert.throws(() => assertDesktopReleasePolicy({ ...stablePkg, build: { publish: { provider: "generic", releaseType: "release", channel: "latest" } } }), /GitHub/);
});

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "navopath-beta-release-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const installer = Buffer.from("installer fixture");
  const hash = createHash("sha512").update(installer).digest("base64");
  const metadata = `version: ${betaPkg.version}\nfiles:\n  - url: NavoPath-Setup.exe\n    sha512: ${hash}\n    size: ${installer.length}\npath: NavoPath-Setup.exe\nsha512: ${hash}\n`;
  await writeFile(path.join(directory, "latest.yml"), metadata);
  await writeFile(path.join(directory, "beta.yml"), metadata);
  await writeFile(path.join(directory, "NavoPath-Setup.exe"), installer);
  await writeFile(path.join(directory, "NavoPath-Setup.exe.blockmap"), "blockmap");
  await writeFile(path.join(directory, "NavoPath-Portable.exe"), "portable");
  return { directory, metadata };
}

test("prepares matching beta.yml and latest.yml with the complete updater asset contract", async (t) => {
  const { directory, metadata } = await fixture(t);
  assert.deepEqual(await prepareDesktopRelease(betaPkg, directory), desktopReleaseAssets);
  assert.equal(await readFile(path.join(directory, "beta.yml"), "utf8"), metadata);
  assert.equal(await readFile(path.join(directory, "latest.yml"), "utf8"), metadata);
});

test("prepares matching stable latest.yml and beta.yml manifests", async (t) => {
  const { directory, metadata } = await fixture(t);
  const stableMetadata = metadata.replace(betaPkg.version, stablePkg.version);
  await writeFile(path.join(directory, "latest.yml"), stableMetadata);
  assert.deepEqual(await prepareDesktopRelease(stablePkg, directory), desktopReleaseAssets);
  assert.equal(await readFile(path.join(directory, "latest.yml"), "utf8"), stableMetadata);
  assert.equal(await readFile(path.join(directory, "beta.yml"), "utf8"), stableMetadata);
});

test("rejects stale manifests, changed installer content and missing updater assets", async (t) => {
  const { directory, metadata } = await fixture(t);
  await writeFile(path.join(directory, "beta.yml"), metadata.replace(betaPkg.version, "1.5.1"));
  await assert.rejects(prepareDesktopRelease(betaPkg, directory), /version/);
  await writeFile(path.join(directory, "beta.yml"), metadata);
  await writeFile(path.join(directory, "NavoPath-Setup.exe"), "installer changed");
  await assert.rejects(prepareDesktopRelease(betaPkg, directory), /size|checksum/);
  await writeFile(path.join(directory, "NavoPath-Setup.exe"), "installer fixture");
  await rm(path.join(directory, "NavoPath-Setup.exe.blockmap"));
  await assert.rejects(prepareDesktopRelease(betaPkg, directory), /ENOENT/);
});
