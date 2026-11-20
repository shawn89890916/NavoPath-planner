import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Arch, Platform, build } from "electron-builder";
import { getPath7za } from "app-builder-lib/out/toolsets/7zip.js";

const run = promisify(execFile);
const scratch = await mkdtemp(path.join(os.tmpdir(), "navopath-nsis-"));
const archives = new Map();

async function compressPayload(source) {
  const sevenZip = await getPath7za();
  const work = await mkdtemp(path.join(scratch, "payload-"));
  const staged = path.join(work, "files");
  const archive = path.join(work, path.basename(source));
  const appArchive = "resources/app.asar";
  const switches = ["-mx=9", "-mmt=2", "-mf=BCJ", "-ms=off", "-mtc=off", "-mtm=off", "-mta=off", "-bd"];

  await run(sevenZip, ["x", source, "-o" + staged, "-y", "-bd"]);
  // Keep the per-file streams and the NSIS-compatible BCJ filter. The runtime
  // benefits from a larger dictionary. The more frequently changed ASAR keeps
  // the upstream 1 MiB dictionary for differential updates.
  await run(sevenZip, ["a", archive, ".", "-x!" + appArchive, "-md=64m", "-mfb=273", ...switches], { cwd: staged });
  await run(sevenZip, ["a", archive, appArchive, "-md=1m", ...switches], { cwd: staged });
  await run(sevenZip, ["t", archive, "-bd"]);

  const hash = createHash("sha512");
  for await (const chunk of createReadStream(archive)) hash.update(chunk);
  return { archive, sha512: hash.digest("hex").toUpperCase() };
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
