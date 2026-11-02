import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { load } = require("js-yaml");
const root = fileURLToPath(new URL("../", import.meta.url));
export const desktopReleaseAssets = ["latest.yml", "beta.yml", "NavoPath-Setup.exe", "NavoPath-Setup.exe.blockmap", "NavoPath-Portable.exe"];

export function assertBetaReleasePolicy(pkg) {
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-beta\.[1-9]\d*$/.test(pkg.version)) {
    throw new Error("New releases must use x.x.x-beta.N until the user explicitly approves stable releases.");
  }
  if (pkg.build?.publish?.provider !== "github" || pkg.build.publish.releaseType !== "prerelease") {
    throw new Error("Desktop releases must retain the GitHub provider and use prerelease publication.");
  }
}

export async function prepareDesktopRelease(pkg, outputDir) {
  assertBetaReleasePolicy(pkg);
  // The installed electron-builder GitHub provider emits one channel manifest.
  // Keep latest.yml for the protected asset contract and beta.yml for opt-in clients.
  const sourceName = pkg.build.publish.channel === "beta" ? "beta.yml" : "latest.yml";
  const sourcePath = path.join(outputDir, sourceName);
  const metadata = load(await readFile(sourcePath, "utf8"));
  if (metadata?.version !== pkg.version) throw new Error("Desktop manifest version does not match package.json.");
  const installer = metadata.files?.find((file) => file.url === "NavoPath-Setup.exe");
  if (!installer) throw new Error("Desktop manifest must reference NavoPath-Setup.exe.");
  const installerPath = path.join(outputDir, "NavoPath-Setup.exe");
  if ((await stat(installerPath)).size !== installer.size) throw new Error("Desktop installer size does not match its manifest.");
  const hash = createHash("sha512");
  for await (const chunk of createReadStream(installerPath)) hash.update(chunk);
  if (hash.digest("base64") !== installer.sha512) throw new Error("Desktop installer checksum does not match its manifest.");
  await copyFile(sourcePath, path.join(outputDir, sourceName === "latest.yml" ? "beta.yml" : "latest.yml"));
  for (const name of desktopReleaseAssets) {
    if (!(await stat(path.join(outputDir, name))).size) throw new Error(`Desktop release asset is empty: ${name}`);
  }
  return desktopReleaseAssets;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assertBetaReleasePolicy(pkg);
  if (!process.argv.includes("--check-policy")) {
    await prepareDesktopRelease(pkg, path.resolve(pkg.build.directories.output));
    console.log(`Prepared ${pkg.version}: ${desktopReleaseAssets.join(", ")}`);
  }
}
