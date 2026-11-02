const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { fetchExtensionPackage } = require("./extension-download.cjs");
const MAX_EXPANDED_BYTES = 32 * 1024 * 1024;
function validateKey(key) {
  if (typeof key !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199}$/.test(key)) throw new Error("Invalid extension key");
}
function validateFilePath(name) {
  if (typeof name !== "string" || name.length > 240 || !name || name.includes("\\") || name.includes(":" ) || name.startsWith("/")
    || name.split("/").some((part) => !part || part === "." || part === ".." || /[. ]$/.test(part)
      || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part) || /[\x00-\x1f<>"|?*]/.test(part))) throw new Error("Invalid extension file path");
  return name;
}
function decodeFiles(files, entry) {
  if (!files || typeof files !== "object" || Array.isArray(files)) throw new Error("Invalid extension files");
  validateFilePath(entry);
  if (!/\.(?:c?js|mjs)$/.test(entry) || !Object.hasOwn(files, entry)) throw new Error("Desktop entry must be a package JavaScript file");
  const entries = Object.entries(files);
  if (!entries.length || entries.length > 512) throw new Error("Extension file count exceeds limit");
  const seen = new Set();
  let size = 0;
  return entries.map(([name, file]) => {
    validateFilePath(name);
    const canonical = name.toLowerCase();
    if (seen.has(canonical)) throw new Error("Duplicate extension file path");
    seen.add(canonical);
    if (!file || typeof file.data !== "string" || !["utf8", "base64"].includes(file.encoding)) throw new Error("Invalid extension file encoding");
    if (file.data.length > MAX_EXPANDED_BYTES * 2) throw new Error("Extension files exceed 32 MB");
    if (file.encoding === "base64" && !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data)) throw new Error("Invalid extension base64");
    const bytes = Buffer.from(file.data, file.encoding);
    size += bytes.length;
    if (size > MAX_EXPANDED_BYTES) throw new Error("Extension files exceed 32 MB");
    return [name, bytes];
  });
}
function createExtensionHost({ rootDirectory, utilityProcess, shell }) {
  const workers = new Map();
  const operations = new Map();
  const owners = new WeakSet();
  let disposed = false;
  let sequence = 0;
  function ownedKey(owner, key) { validateKey(key); return `${owner.id}:${key}`; }
  function serialize(owner, key, operation) {
    const id = ownedKey(owner, key);
    const previous = operations.get(id) || Promise.resolve();
    const next = previous.catch(() => {}).then(operation);
    operations.set(id, next);
    void next.finally(() => { if (operations.get(id) === next) operations.delete(id); }).catch(() => {});
    return next;
  }
  function request(worker, message, timeout = 30_000) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { worker.pending.delete(id); reject(new Error("Extension request timed out")); }, timeout);
      worker.pending.set(id, { resolve: (result) => { clearTimeout(timer); resolve(result); }, reject: (error) => { clearTimeout(timer); reject(error); } });
      try { worker.process.postMessage({ ...message, id }); } catch (error) { worker.pending.get(id).reject(error); worker.pending.delete(id); }
    });
  }
  async function stop(owner, key) {
    const id = ownedKey(owner, key);
    const worker = workers.get(id);
    if (!worker) return;
    workers.delete(id);
    try { await request(worker, { type: "stop" }, 2000); } catch { /* force termination on unresponsive unload */ }
    if (!worker.exited) await new Promise((resolve) => {
      const timer = setTimeout(resolve, 2000);
      worker.process.once("exit", () => { clearTimeout(timer); resolve(); });
      worker.process.kill();
    });
    for (const pending of worker.pending.values()) pending.reject(new Error("Extension stopped"));
    worker.pending.clear();
  }
  async function start(owner, key, hash, files, entry) {
    const id = ownedKey(owner, key);
    if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid extension package hash");
    const decoded = decodeFiles(files, entry);
    // The renderer separately verifies the complete installed archive hash.
    // Verify this native payload too so its version directory identifies exactly
    // the files executed by the utility process, across the IPC boundary.
    if (crypto.createHash("sha256").update(JSON.stringify(files)).digest("hex") !== hash) throw new Error("Desktop extension files hash mismatch");
    await stop(owner, key);
    if (disposed || owner.isDestroyed?.()) throw new Error("Extension owner is unavailable");
    // Derive directories exclusively from hashes, never from caller paths. A fresh
    // extraction prevents a previous plugin from planting symlinks for a restart.
    // Windows utilityProcess cannot spawn with a cwd beyond MAX_PATH. Keep
    // directory labels short; the full payload hash was verified above and
    // mkdtemp supplies a fresh directory even when hash prefixes coincide.
    const root = rootDirectory();
    fs.mkdirSync(root, { recursive: true });
    const label = `run-${crypto.createHash("sha256").update(key).digest("hex").slice(0, 12)}-${hash.slice(0, 12)}-`;
    const directory = fs.mkdtempSync(path.join(root, label));
    for (const [name, bytes] of decoded) {
      const destination = path.resolve(directory, name);
      if (!destination.startsWith(`${path.resolve(directory)}${path.sep}`)) throw new Error("Extension path escaped package");
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, bytes, { flag: "wx" });
    }
    const process = utilityProcess.fork(path.join(__dirname, "extension-worker.cjs"), [path.join(directory, entry)], { cwd: directory, serviceName: `NavoPath extension ${key}`, stdio: "ignore" });
    const worker = { process, owner, key, pending: new Map() };
    workers.set(id, worker);
    const ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Extension startup timed out")), 15_000);
      worker.readyReject = reject;
      process.on("message", (message) => {
        if (message?.type === "ready") { clearTimeout(timer); resolve(); }
        else if (message?.type === "startup-error") { clearTimeout(timer); reject(new Error(message.error)); }
        else {
          const pending = worker.pending.get(message?.id);
          if (!pending) return;
          worker.pending.delete(message.id);
          if (message.error) pending.reject(new Error(message.error)); else pending.resolve(message.result);
        }
      });
      process.once("exit", () => {
        worker.exited = true;
        clearTimeout(timer);
        reject(new Error("Extension process exited"));
        if (workers.get(id) === worker) workers.delete(id);
        for (const pending of worker.pending.values()) pending.reject(new Error("Extension process exited"));
        worker.pending.clear();
      });
    });
    if (!owners.has(owner)) {
      owners.add(owner);
      owner.once("destroyed", () => {
        for (const active of workers.values()) if (active.owner === owner) void stop(owner, active.key);
      });
    }
    try { await ready; } catch (error) { await stop(owner, key); throw error; }
  }
  return {
    start: (owner, key, hash, files, entry) => serialize(owner, key, () => start(owner, key, hash, files, entry)),
    stop: (owner, key) => serialize(owner, key, () => stop(owner, key)),
    async invoke(owner, key, method, payload) {
      const worker = workers.get(ownedKey(owner, key));
      if (!worker) throw new Error("Desktop extension is not running");
      if (typeof method !== "string" || method.length > 120 || ["onLoad", "onUnload", "constructor", "__proto__", "prototype"].includes(method)) throw new Error("Invalid extension method");
      return request(worker, { type: "invoke", method, payload });
    },
    async fetch(url) { return Array.from(await fetchExtensionPackage(url)); },
    async openDirectory() { const directory = rootDirectory(); fs.mkdirSync(directory, { recursive: true }); const error = await shell.openPath(directory); if (error) throw new Error(error); },
    dispose() { disposed = true; for (const worker of workers.values()) { worker.process.kill(); for (const pending of worker.pending.values()) pending.reject(new Error("Application closed")); } workers.clear(); },
  };
}
module.exports = { createExtensionHost, validateKey, validateFilePath, decodeFiles };
