const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const crypto = require("node:crypto");
const { createExtensionHost, decodeFiles } = require("./extension-host.cjs");
const { forbiddenAddress, validateDownloadUrl, fetchExtensionPackage } = require("./extension-download.cjs");

test("rejects package traversal, platform aliases, duplicate names and missing entry", () => {
  const file = { encoding: "utf8", data: "module.exports={}" };
  for (const name of ["../out.cjs", "/out.cjs", "C:/out.cjs", "nested\\out.cjs", "con.cjs", "nested./out.cjs", "a/../out.cjs"]) {
    assert.throws(() => decodeFiles({ [name]: file }, name), /path/);
  }
  assert.throws(() => decodeFiles({ "a.cjs": file, "A.cjs": file }, "a.cjs"), /Duplicate/);
  assert.throws(() => decodeFiles({ "a.cjs": file }, "other.cjs"), /entry/);
  assert.throws(() => decodeFiles(Object.fromEntries(Array.from({ length: 513 }, (_, i) => [`f${i}.cjs`, file])), "f0.cjs"), /count/);
  assert.throws(() => decodeFiles({ "a.cjs": { encoding: "base64", data: "!!!!" } }, "a.cjs"), /base64/);
});

test("desktop RPC isolates owners, unloads on stop and rejects pending work on exit", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "navopath-extension-test-"));
  const processes = [];
  const utilityProcess = { fork: (_runner, args) => {
    const process = new EventEmitter();
    process.entry = args[0];
    process.postMessage = (message) => {
      if (message.method === "pending") return;
      queueMicrotask(() => process.emit("message", { id: message.id, result: message.type === "stop" ? null : message.payload }));
    };
    process.kill = () => { process.killed = true; process.emit("exit", 0); };
    processes.push(process);
    queueMicrotask(() => process.emit("message", { type: "ready" }));
    return process;
  } };
  const host = createExtensionHost({ rootDirectory: () => directory, utilityProcess, shell: {} });
  const owner = Object.assign(new EventEmitter(), { id: 1 });
  const other = Object.assign(new EventEmitter(), { id: 2 });
  try {
    const files = { "entry.cjs": { encoding: "utf8", data: "module.exports={}" } };
    await assert.rejects(host.start(owner, "test.plugin", "a".repeat(64), files, "entry.cjs"), /hash mismatch/);
    await host.start(owner, "test.plugin", crypto.createHash("sha256").update(JSON.stringify(files)).digest("hex"), files, "entry.cjs");
    assert.ok(processes[0].entry.startsWith(directory + path.sep));
    assert.ok(processes[0].entry.length - directory.length < 90, "native runtime paths must remain short enough for Windows cwd spawning");
    assert.deepEqual(await host.invoke(owner, "test.plugin", "echo", { value: 1 }), { value: 1 });
    await assert.rejects(host.invoke(other, "test.plugin", "echo", {}), /not running/);
    await assert.rejects(host.invoke(owner, "test.plugin", "onUnload", {}), /Invalid/);
    const pending = host.invoke(owner, "test.plugin", "pending", null);
    const rejected = assert.rejects(pending, /exited|stopped/);
    await host.stop(owner, "test.plugin");
    await rejected;
    assert.equal(processes[0].killed, true);
    await assert.rejects(host.invoke(owner, "test.plugin", "echo", {}), /not running/);
  } finally { host.dispose(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test("extension downloads reject local hosts and DNS rebinding before sending a request", async () => {
  for (const value of ["http://example.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://[::1]/x", "https://user:password@example.com/x", "https://example.com:8443/x"]) assert.throws(() => validateDownloadUrl(value));
  for (const value of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "::1", "::ffff:7f00:1", "2001:db8::1"]) assert.equal(forbiddenAddress(value), true);
  assert.equal(forbiddenAddress("8.8.8.8"), false);
  assert.equal(forbiddenAddress("2606:4700:4700::1111"), false);
  await assert.rejects(fetchExtensionPackage("https://example.com/file", { lookup: async () => [{ address: "127.0.0.1", family: 4 }], request: () => assert.fail("No private request may be sent") }), /Private/);
});
