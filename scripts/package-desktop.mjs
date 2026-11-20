import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Arch, Platform, build } from "electron-builder";
import { getPath7za } from "app-builder-lib/out/toolsets/7zip.js";
import { getMakeNsisPath, getNsisPluginsPath } from "app-builder-lib/out/toolsets/windows.js";
import { spawnAndWriteWithOutput } from "builder-util";

const run = promisify(execFile);
const scratch = await mkdtemp(path.join(os.tmpdir(), "navopath-nsis-"));
const archives = new Map();

async function sha512(file) {
  const hash = createHash("sha512");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex").toUpperCase();
}

async function verifyNsisExtraction(work, archive, staged) {
  const { build: config } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const [compiler, plugins] = await Promise.all([
    getMakeNsisPath(config.toolsets?.nsis, config.nsis.customNsisBinary),
    getNsisPluginsPath(config.toolsets?.nsis, config.nsis.customNsisResources),
  ]);
  const output = path.join(work, "decoded");
  const quote = (value) => `"${value.replaceAll("$", () => "$$")}"`;
  const script = [
    "Unicode true",
    'Name "NavoPath payload verification"',
    'OutFile "decode.exe"',
    "RequestExecutionLevel user",
    "SilentInstall silent",
    `!addplugindir /x86-unicode ${quote(path.join(plugins, "x86-unicode"))}`,
    "Section",
    `  SetOutPath ${quote(output)}`,
    `  Nsis7z::Extract ${quote(archive)}`,
    "SectionEnd",
  ].join("\n");
  await spawnAndWriteWithOutput(compiler.path, ["-WX", "-INPUTCHARSET", "UTF8", "-"], script, {
    cwd: work,
    env: { ...process.env, ...compiler.env },
  });
  await run(path.join(work, "decode.exe"), [], { windowsHide: true, timeout: 120_000 });
  const entries = await readdir(staged, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const original = path.join(entry.parentPath, entry.name);
    const relative = path.relative(staged, original);
    if (await sha512(original) !== await sha512(path.join(output, relative))) {
      throw new Error(`NSIS changed the bytes of ${relative}`);
    }
  }
}

async function compressPayload(source) {
  const sevenZip = await getPath7za();
  const work = await mkdtemp(path.join(scratch, "payload-"));
  const staged = path.join(work, "files");
  const archive = path.join(work, path.basename(source));
  const appArchive = "resources/app.asar";
  const executable = "NavoPath.exe";
  const runtimeFilter = process.platform === "win32" ? "-mf=BCJ2" : "-mf=BCJ";
  const switches = ["-mx=9", "-mmt=2", "-ms=off", "-mtc=off", "-mtm=off", "-mta=off", "-bd"];

  await run(sevenZip, ["x", source, "-o" + staged, "-y", "-bd"]);
  // Keep per-file streams and the 1 MiB dictionary for the frequently changed
  // ASAR. Verify the exact BCJ2 stream with the release's own NSIS decoder.
  await run(sevenZip, ["a", archive, ".", "-x!" + appArchive, "-x!" + executable, "-md=64m", "-mfb=273", "-mf=BCJ", ...switches], { cwd: staged });
  await run(sevenZip, ["a", archive, executable, "-md=64m", "-mfb=273", runtimeFilter, ...switches], { cwd: staged });
  await run(sevenZip, ["a", archive, appArchive, "-md=1m", "-mf=BCJ", ...switches], { cwd: staged });
  await run(sevenZip, ["t", archive, "-bd"]);
  if (process.platform === "win32") await verifyNsisExtraction(work, archive, staged);
  return { archive, sha512: await sha512(archive) };
}

try {
  await build({
    targets: Platform.WINDOWS.createTarget(["nsis", "portable"], Arch.x64),
    publish: "never",
    effectiveOptionComputed: async ([defines]) => {
      const source = defines.APP_64;
      if (!source || defines.APP_32 || defines.APP_ARM64) throw new Error("Expected an offline x64 NSIS archive");
      if (!archives.has(source)) archives.set(source, compressPayload(source));
      const { archive, sha512 } = await archives.get(source);
      defines.APP_64 = archive;
      defines.APP_64_NAME = path.basename(archive);
      defines.APP_64_HASH = sha512;
      return false;
    },
  });
} finally {
  await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}
