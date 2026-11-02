import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assertBetaReleasePolicy, desktopReleaseAssets, prepareDesktopRelease } from "./prepare-desktop-release.mjs";

const pkg = { version: "1.5.2-beta.1", build: { publish: { provider: "github", releaseType: "prerelease" } } };

test("release policy requires numbered Beta semver and GitHub prerelease publication", () => {
  assert.doesNotThrow(() => assertBetaReleasePolicy(pkg));
  for (const version of ["1.5.2", "1.5.2-beta", "1.5.2-alpha.1", "1.5.2-beta.0", "v1.5.2-beta.1", "01.5.2-beta.1"]) {
    assert.throws(() => assertBetaReleasePolicy({ ...pkg, version }), /beta.N/);
  }
  assert.throws(() => assertBetaReleasePolicy({ ...pkg, build: { publish: { provider: "github", releaseType: "release" } } }), /prerelease/);
});

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "navopath-beta-release-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const installer = Buffer.from("installer fixture");
  const hash = createHash("sha512").update(installer).digest("base64");
  const metadata = `version: ${pkg.version}\nfiles:\n  - url: NavoPath-Setup.exe\n    sha512: ${hash}\n    size: ${installer.length}\npath: NavoPath-Setup.exe\nsha512: ${hash}\n`;
  await writeFile(path.join(directory, "latest.yml"), metadata);
  await writeFile(path.join(directory, "NavoPath-Setup.exe"), installer);
  await writeFile(path.join(directory, "NavoPath-Setup.exe.blockmap"), "blockmap");
  await writeFile(path.join(directory, "NavoPath-Portable.exe"), "portable");
  return { directory, metadata };
}

test("prepares matching beta.yml and latest.yml with the complete updater asset contract", async (t) => {
  const { directory, metadata } = await fixture(t);
  assert.deepEqual(await prepareDesktopRelease(pkg, directory), desktopReleaseAssets);
  assert.equal(await readFile(path.join(directory, "beta.yml"), "utf8"), metadata);
  assert.equal(await readFile(path.join(directory, "latest.yml"), "utf8"), metadata);
});

test("rejects stale manifests, changed installer content and missing updater assets", async (t) => {
  const { directory, metadata } = await fixture(t);
  await writeFile(path.join(directory, "latest.yml"), metadata.replace(pkg.version, "1.5.1"));
  await assert.rejects(prepareDesktopRelease(pkg, directory), /version/);
  await writeFile(path.join(directory, "latest.yml"), metadata);
  await writeFile(path.join(directory, "NavoPath-Setup.exe"), "installer changed");
  await assert.rejects(prepareDesktopRelease(pkg, directory), /size|checksum/);
  await writeFile(path.join(directory, "NavoPath-Setup.exe"), "installer fixture");
  await rm(path.join(directory, "NavoPath-Setup.exe.blockmap"));
  await assert.rejects(prepareDesktopRelease(pkg, directory), /ENOENT/);
});
