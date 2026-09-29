import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { macPlist, syncOnce, validateSnapshot, windowsTaskArgs } from "./bridge.mjs";

const snapshot = {
  version: 1,
  accountId: "user-1",
  updatedAt: "2026-09-29T12:00:00Z",
  data: { version: 1, tasks: [], projects: [], sync: { deleted: {} } },
  settings: { theme: "paper" },
};

async function removeTestDir(folder) {
  assert.ok(folder.startsWith(tmpdir()) && folder.includes("navopath-"));
  await rm(folder, { recursive: true, force: true });
}

test("creates and reads a cloud folder snapshot without a repeated cloud write", async () => {
  const folder = await mkdtemp(join(tmpdir(), "navopath-bridge-"));
  const originalFetch = globalThis.fetch;
  const methods = [];
  globalThis.fetch = async (_url, init) => {
    methods.push(init.method);
    return new Response(JSON.stringify(snapshot), { headers: { "content-type": "application/json" } });
  };
  try {
    const config = { endpoint: "https://example.com", folder };
    await syncOnce(config, "nvp_test");
    assert.deepEqual(validateSnapshot(JSON.parse(await readFile(join(folder, "navopath-workspace.json"), "utf8"))), snapshot);
    await syncOnce(config, "nvp_test");
    assert.deepEqual(methods, ["GET", "POST"]);
    await writeFile(join(folder, "navopath-workspace.json"), "not json");
    await assert.rejects(syncOnce(config, "nvp_test"), /not valid JSON/);
    assert.equal(await readFile(join(folder, "navopath-workspace.json"), "utf8"), "not json");
  } finally {
    globalThis.fetch = originalFetch;
    await removeTestDir(folder);
  }
});

test("stops on provider conflict copies and never merges another account", async () => {
  const folder = await mkdtemp(join(tmpdir(), "navopath-bridge-"));
  try {
    await writeFile(join(folder, "navopath-workspace (conflict copy).json"), "{}");
    await assert.rejects(syncOnce({ endpoint: "https://example.com", folder }, "token"), /conflict copy/);
    assert.throws(() => validateSnapshot({ ...snapshot, accountId: undefined }));
  } finally {
    await removeTestDir(folder);
  }
});

test("Windows and macOS startup definitions quote paths and keep tokens out of them", () => {
  const args = windowsTaskArgs("C:\\Program Files\\node.exe", "C:\\Navo Path\\bridge.mjs");
  assert.equal(args[args.indexOf("/TR") + 1], '"C:\\Program Files\\node.exe" "C:\\Navo Path\\bridge.mjs" run');
  const plist = macPlist("/Applications/Node & Tools/node", "/Users/me/<bridge>/bridge.mjs");
  assert.match(plist, /Node &amp; Tools/);
  assert.match(plist, /&lt;bridge&gt;/);
  assert.doesNotMatch(plist, /nvp_/);
});

test("Windows setup stores an encrypted user secret outside the cloud folder", { skip: process.platform !== "win32" }, async () => {
  const localAppData = await mkdtemp(join(tmpdir(), "navopath-setup-"));
  const folder = join(localAppData, "cloud");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(folder);
  const token = `nvp_${"a".repeat(64)}`;
  try {
    const modernPwsh = join(process.env.LOCALAPPDATA || "", "Programs", "PowerShell", "7.6.6", "pwsh.exe");
    const setup = spawnSync(process.execPath, [fileURLToPath(new URL("./bridge.mjs", import.meta.url)), "setup", "--folder", folder], {
      input: token, encoding: "utf8", env: { ...process.env, LOCALAPPDATA: localAppData, ...(existsSync(modernPwsh) ? { NAVOPATH_PWSH_PATH: modernPwsh } : {}) }, timeout: 15_000,
    });
    assert.equal(setup.status, 0, setup.stderr);
    const stored = await readFile(join(localAppData, "NavoPath", "sync-bridge.secret"), "utf8");
    assert.doesNotMatch(stored, /nvp_/);
    const config = JSON.parse(await readFile(join(localAppData, "NavoPath", "sync-bridge.json"), "utf8"));
    assert.equal(config.folder, folder);
  } finally {
    await removeTestDir(localAppData);
  }
});
