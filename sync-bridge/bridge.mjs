#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { homedir, hostname, platform, userInfo } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ENDPOINT = "https://navopath-mcp.shawn89890916.workers.dev";
const CONFIG_DIR = platform() === "win32"
  ? join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "NavoPath")
  : join(homedir(), ".config", "navopath");
const CONFIG_PATH = join(CONFIG_DIR, "sync-bridge.json");
const SECRET_PATH = join(CONFIG_DIR, "sync-bridge.secret");
const STATE_PATH = join(CONFIG_DIR, "sync-bridge-state.json");
const SERVICE_NAME = "NavoPath Sync Bridge";
const FILE_NAME = "navopath-workspace.json";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const COLLECTIONS = ["goals", "projects", "tasks", "events", "habits", "habitDailyStates", "timeEntries", "longTasks", "notes", "drafts", "aiConversations", "aiMemories", "scheduleTemplates"];

function exec(file, args, input) {
  const child = spawnSync(file, args, { encoding: "utf8", input, windowsHide: true });
  if (child.status !== 0) throw new Error((child.stderr || child.stdout || `${file} failed`).trim());
  return child.stdout.trim();
}

function powershell(script, input) {
  const installs = join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "Programs", "PowerShell");
  const versions = existsSync(installs)
    ? readdirSync(installs).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    : [];
  const modern = versions.map((version) => join(installs, version, "pwsh.exe")).find(existsSync);
  const configured = process.env.NAVOPATH_PWSH_PATH;
  return exec(configured && existsSync(configured) ? configured : (modern || "powershell.exe"), ["-NoProfile", "-NonInteractive", "-Command", `$ErrorActionPreference='Stop'; ${script}`], input);
}

async function storeToken(token) {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  if (platform() === "darwin") {
    if (!process.stdin.isTTY) throw new Error("Run setup from an interactive terminal to enter the macOS Keychain password.");
    const child = spawnSync("security", ["add-generic-password", "-U", "-a", userInfo().username, "-s", "com.navopath.sync-bridge", "-w"], { stdio: "inherit" });
    if (child.status !== 0) throw new Error("Could not save the token in macOS Keychain.");
    token = loadToken();
    if (!/^nvp_[a-f0-9]{64}$/.test(token)) throw new Error("The Keychain item is not a complete NavoPath MCP token.");
  } else if (platform() === "win32") {
    if (!/^nvp_[a-f0-9]{64}$/.test(token)) throw new Error("Enter a complete NavoPath MCP token beginning with nvp_.");
    const script = `$value = [Console]::In.ReadToEnd().Trim(); $secure = ConvertTo-SecureString $value -AsPlainText -Force; $secure | ConvertFrom-SecureString | Set-Content -LiteralPath '${SECRET_PATH.replace(/'/g, "''")}'`;
    powershell(script, token);
  } else {
    throw new Error("Automatic credential storage currently supports Windows and macOS.");
  }
}

function loadToken() {
  if (platform() === "darwin") {
    return exec("security", ["find-generic-password", "-a", userInfo().username, "-s", "com.navopath.sync-bridge", "-w"]);
  }
  if (platform() === "win32") {
    const script = `$secure = Get-Content -LiteralPath '${SECRET_PATH.replace(/'/g, "''")}' | ConvertTo-SecureString; $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }`;
    return powershell(script);
  }
  throw new Error("Automatic credential storage currently supports Windows and macOS.");
}

async function readTokenFromTerminal() {
  if (!process.stdin.isTTY) {
    let value = "";
    for await (const chunk of process.stdin) value += chunk.toString();
    return value.trim();
  }
  process.stdout.write("Paste the one-time MCP token: ");
  return new Promise((resolveToken, rejectToken) => {
    let token = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const finish = (error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
      if (error) rejectToken(error); else resolveToken(token.trim());
    };
    const onData = (chunk) => {
      for (const char of chunk.toString()) {
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u0003") return finish(new Error("Setup cancelled"));
        if (char === "\u007f") { token = token.slice(0, -1); continue; }
        token += char;
      }
    };
    process.stdin.on("data", onData);
  });
}

function options(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    if (!args[index].startsWith("--") || !args[index + 1]) throw new Error(`Invalid argument: ${args[index]}`);
    parsed[args[index].slice(2)] = args[++index];
  }
  return parsed;
}

export function validateSnapshot(value) {
  if (!value || value.version !== 1 || typeof value.accountId !== "string" || !value.data || !Array.isArray(value.data.tasks)
    || !Array.isArray(value.data.projects) || !value.settings || typeof value.settings !== "object"
    || Array.isArray(value.settings) || !Number.isFinite(Date.parse(value.updatedAt))) {
    throw new Error("The sync file is damaged or has an unsupported format. It was left untouched.");
  }
  if (COLLECTIONS.some((collection) => value.data[collection] !== undefined && !Array.isArray(value.data[collection]))) {
    throw new Error("The sync file contains a damaged collection. It was left untouched.");
  }
  return value;
}

async function setup(args) {
  const input = options(args);
  if (!input.folder) throw new Error("Choose an existing cloud-synced folder with --folder.");
  const folder = resolve(input.folder);
  if (!(await stat(folder)).isDirectory()) throw new Error("The selected path is not a folder.");
  const configRelative = relative(folder, CONFIG_DIR);
  if (!configRelative || (configRelative !== ".." && !configRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(configRelative))) {
    throw new Error("Choose a cloud folder that does not contain the local NavoPath configuration and encrypted credential.");
  }
  const endpoint = new URL(input.endpoint || DEFAULT_ENDPOINT);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) throw new Error("The MCP endpoint must use HTTPS.");
  const token = platform() === "darwin" ? "" : await readTokenFromTerminal();
  await storeToken(token);
  const config = {
    version: 1,
    deviceId: randomUUID(),
    deviceName: (input.name || hostname()).slice(0, 100),
    folder,
    endpoint: endpoint.origin,
    intervalSeconds: 30,
  };
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
  process.stdout.write(`Configured ${FILE_NAME} in ${folder}. Run "node bridge.mjs install" to start background sync.\n`);
}

export function macPlist(nodePath, scriptPath) {
  const escape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>com.navopath.sync-bridge</string><key>ProgramArguments</key><array><string>${escape(nodePath)}</string><string>${escape(scriptPath)}</string><string>run</string></array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>StandardOutPath</key><string>${escape(join(CONFIG_DIR, "bridge.log"))}</string><key>StandardErrorPath</key><string>${escape(join(CONFIG_DIR, "bridge-error.log"))}</string></dict></plist>`;
}

export function windowsTaskArgs(nodePath, scriptPath) {
  const task = `"${nodePath}" "${scriptPath}" run`;
  return ["/Create", "/F", "/SC", "ONLOGON", "/TN", SERVICE_NAME, "/TR", task];
}

async function install() {
  await readFile(CONFIG_PATH, "utf8");
  const scriptPath = fileURLToPath(import.meta.url);
  if (platform() === "win32") {
    exec("schtasks.exe", windowsTaskArgs(process.execPath, scriptPath));
    exec("schtasks.exe", ["/Run", "/TN", SERVICE_NAME]);
  } else if (platform() === "darwin") {
    const agentPath = join(homedir(), "Library", "LaunchAgents", "com.navopath.sync-bridge.plist");
    await mkdir(dirname(agentPath), { recursive: true });
    try { exec("launchctl", ["unload", agentPath]); } catch { /* first installation */ }
    await writeFile(agentPath, macPlist(process.execPath, scriptPath), { mode: 0o600 });
    exec("launchctl", ["load", "-w", agentPath]);
  } else {
    throw new Error("Automatic startup currently supports Windows and macOS.");
  }
  process.stdout.write("Background sync installed and started.\n");
}

async function request(config, token, path, method = "GET", payload) {
  const response = await fetch(`${config.endpoint}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(payload ? { "content-type": "application/json" } : {}) },
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(response.status === 401 ? "MCP token was revoked. Generate a new token and run setup again." : (body.error || `Server returned ${response.status}`));
  return body;
}

async function readLocalSnapshot(file) {
  try {
    const info = await stat(file);
    if (info.size > MAX_FILE_BYTES) throw new Error("The sync file exceeds 20 MB. It was left untouched.");
    return validateSnapshot(JSON.parse(await readFile(file, "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    if (error instanceof SyntaxError) throw new Error("The sync file is not valid JSON. It was left untouched.");
    throw error;
  }
}

async function assertNoConflictCopies(folder) {
  const entries = await readdir(folder);
  const conflict = entries.find((entry) => entry.toLowerCase().includes("navopath-workspace")
    && entry !== FILE_NAME && !entry.endsWith(".tmp"));
  if (conflict) throw new Error(`Cloud storage created a conflict copy (${conflict}). Resolve it before sync continues.`);
}

async function writeSnapshot(file, snapshot) {
  const existing = await readLocalSnapshot(file);
  const content = JSON.stringify({ version: 1, accountId: snapshot.accountId, updatedAt: snapshot.updatedAt, data: snapshot.data, settings: snapshot.settings }, null, 2);
  if (existing && JSON.stringify(existing) === JSON.stringify(JSON.parse(content))) return;
  if (existing) await copyFile(file, join(CONFIG_DIR, "sync-bridge-previous.json"));
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, file);
}

export async function syncOnce(config, token) {
  const file = join(config.folder, FILE_NAME);
  await assertNoConflictCopies(config.folder);
  const local = await readLocalSnapshot(file);
  const remote = local
    ? await request(config, token, "/api/sync/snapshot", "POST", local)
    : await request(config, token, "/api/sync/snapshot");
  const snapshot = validateSnapshot(remote);
  await writeSnapshot(file, snapshot);
  return new Date().toISOString();
}

async function report(config, token, status, lastSuccessAt, error) {
  try {
    await request(config, token, "/api/sync/status", "POST", {
      deviceId: config.deviceId,
      deviceName: config.deviceName,
      folderPath: config.folder,
      status,
      lastSuccessAt,
      error,
    });
  } catch { /* A network failure must not stop local retry. */ }
}

async function run() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const token = loadToken();
  if (!config.folder || !config.endpoint || !token) throw new Error("Bridge setup is incomplete.");
  let failures = 0;
  let lastSuccessAt = null;
  try { lastSuccessAt = JSON.parse(await readFile(STATE_PATH, "utf8")).lastSuccessAt || null; } catch { /* First run. */ }
  while (true) {
    try {
      lastSuccessAt = await syncOnce(config, token);
      await writeFile(STATE_PATH, JSON.stringify({ lastSuccessAt }), { mode: 0o600 });
      failures = 0;
      await report(config, token, "running", lastSuccessAt, null);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${new Date().toISOString()} ${message}\n`);
      await report(config, token, "error", lastSuccessAt, message);
    }
    const delay = Math.min(600_000, config.intervalSeconds * 1000 * 2 ** Math.min(failures, 5));
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  const action = command === "setup" ? setup(process.argv.slice(3)) : command === "install" ? install() : command === "run" ? run() : null;
  if (!action) {
    process.stderr.write("Usage: node bridge.mjs setup --folder <cloud-folder> [--name <device>] | install | run\n");
    process.exitCode = 1;
  } else {
    action.catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
  }
}
