const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createDesktopUpdater } = require("./desktop-updater.cjs");

function harness(options = {}) {
  const updater = new EventEmitter();
  const calls = { checks: 0, downloads: 0, confirmations: [], installs: [], deferred: [], states: [] };
  updater.checkForUpdates = async () => {
    calls.checks++;
    if (options.check) return options.check(updater);
    updater.emit("update-available", { version: "1.4.8" });
  };
  updater.downloadUpdate = async () => {
    calls.downloads++;
    if (options.download) return options.download(updater);
    updater.emit("download-progress", { percent: 42.2 });
    updater.emit("update-downloaded", { version: "1.4.8" });
  };
  updater.quitAndInstall = (...args) => calls.installs.push(args);
  const service = createDesktopUpdater({
    isPackaged: options.isPackaged ?? true,
    currentVersion: "1.4.7",
    getUpdater: () => updater,
    confirmUpdate: async (version) => {
      calls.confirmations.push(version);
      return options.confirm ? options.confirm() : true;
    },
    onState: (state) => calls.states.push(state),
    defer: (callback) => calls.deferred.push(callback),
  });
  return { service, updater, calls, flush: () => calls.deferred.splice(0).forEach((callback) => callback()) };
}

for (const manual of [false, true]) {
  test(`${manual ? "manual" : "automatic"} check confirms once, downloads, silently installs and restarts`, async () => {
    const h = harness();
    await h.service.check(manual);
    assert.deepEqual(h.calls.confirmations, ["1.4.8"]);
    assert.equal(h.calls.checks, 1);
    assert.equal(h.calls.downloads, 1);
    assert.deepEqual(h.calls.states.map((state) => state.status), ["checking", "available", "downloading", "downloading", "downloaded"]);
    assert.equal(h.calls.states[3].progress, 42);
    assert.equal(h.calls.installs.length, 0);
    h.flush();
    assert.deepEqual(h.calls.installs, [[true, true]]);
    assert.equal(h.updater.autoDownload, false);
    assert.equal(h.updater.autoInstallOnAppQuit, false);
  });
}

test("Later defers the update without downloads, repeated prompts or installation on quit", async () => {
  let accept = false;
  const h = harness({ confirm: () => accept });
  await h.service.check();
  await h.service.check();
  assert.equal(h.service.getState().status, "available");
  assert.equal(h.calls.confirmations.length, 1);
  assert.equal(h.calls.downloads, 0);
  assert.equal(h.calls.deferred.length, 0);
  accept = true;
  await h.service.check(true);
  h.flush();
  assert.equal(h.calls.checks, 2);
  assert.equal(h.calls.downloads, 1);
  assert.deepEqual(h.calls.installs, [[true, true]]);
});

test("automatic checks discover a newer release after deferring an earlier version", async () => {
  let version = "1.4.8";
  const h = harness({
    check: (updater) => updater.emit("update-available", { version }),
    confirm: () => false,
  });
  await h.service.check();
  version = "1.4.9";
  await h.service.check();
  assert.deepEqual(h.calls.confirmations, ["1.4.8", "1.4.9"]);
  assert.equal(h.service.getState().availableVersion, "1.4.9");
});

test("overlapping automatic and manual checks share one check, confirmation and download", async () => {
  let finishCheck;
  const h = harness({ check: (updater) => new Promise((resolve) => {
    finishCheck = () => { updater.emit("update-available", { version: "1.4.8" }); resolve(); };
  }) });
  const first = h.service.check();
  const second = h.service.check(true);
  assert.equal(first, second);
  finishCheck();
  await Promise.all([first, second]);
  await h.service.check(true);
  h.flush();
  assert.equal(h.calls.checks, 1);
  assert.equal(h.calls.confirmations.length, 1);
  assert.equal(h.calls.downloads, 1);
  assert.equal(h.calls.installs.length, 1);
});

test("repeated clicks while the confirmation is open share one dialog", async () => {
  let answer;
  const h = harness({ confirm: () => new Promise((resolve) => { answer = resolve; }) });
  const first = h.service.check(true);
  await new Promise(setImmediate);
  const second = h.service.check(true);
  answer(true);
  await Promise.all([first, second]);
  h.flush();
  assert.equal(h.calls.confirmations.length, 1);
  assert.equal(h.calls.downloads, 1);
  assert.equal(h.calls.installs.length, 1);
});

test("current versions stay quiet", async () => {
  const h = harness({ check: (updater) => updater.emit("update-not-available") });
  await h.service.check(true);
  assert.equal(h.service.getState().status, "current");
  assert.equal(h.calls.confirmations.length, 0);
});

test("unpackaged development never loads or configures the updater", async () => {
  const h = harness({ isPackaged: false });
  h.service.configure();
  await h.service.check(true);
  assert.equal(h.service.getState().status, "unsupported");
  assert.equal(h.calls.checks, 0);
  assert.equal(h.updater.listenerCount("update-available"), 0);
});

test("failed check can be retried", async () => {
  const h = harness({ check: () => { throw new Error("offline"); } });
  await h.service.check();
  assert.equal(h.service.getState().status, "error");
  assert.equal(h.service.getState().message, "offline");
  await h.service.check(true);
  assert.equal(h.calls.checks, 2);
});

test("download rejection never installs and a manual retry checks again", async () => {
  let reject = true;
  const h = harness({ download: (updater) => {
    if (reject) throw new Error("download failed");
    updater.emit("update-downloaded", { version: "1.4.8" });
  } });
  await h.service.check(true);
  assert.equal(h.service.getState().status, "error");
  assert.equal(h.calls.deferred.length, 0);
  reject = false;
  await h.service.check(true);
  h.flush();
  assert.equal(h.calls.checks, 2);
  assert.equal(h.calls.installs.length, 1);
});

test("an updater error event without a verified download never installs", async () => {
  const h = harness({ download: (updater) => updater.emit("error", new Error("checksum mismatch")) });
  await h.service.check(true);
  h.flush();
  assert.equal(h.service.getState().status, "error");
  assert.equal(h.service.getState().message, "checksum mismatch");
  assert.equal(h.calls.installs.length, 0);
});

test("resolving a download without update-downloaded never installs", async () => {
  const h = harness({ download: () => {} });
  await h.service.check(true);
  assert.equal(h.calls.deferred.length, 0);
});

test("installer errors are visible and permit a retry", async () => {
  const h = harness();
  h.updater.quitAndInstall = () => { throw new Error("installer unavailable"); };
  await h.service.check(true);
  h.flush();
  assert.equal(h.service.getState().status, "error");
  assert.equal(h.service.getState().message, "installer unavailable");
  h.updater.quitAndInstall = (...args) => h.calls.installs.push(args);
  await h.service.check(true);
  h.flush();
  assert.equal(h.calls.installs.length, 1);
});
