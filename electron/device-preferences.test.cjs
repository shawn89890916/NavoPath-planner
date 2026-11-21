const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { readAcceptBetaUpdates, writeAcceptBetaUpdates, readLowMemoryMode, writeLowMemoryMode } = require("./device-preferences.cjs");

test("device Beta preference defaults off and survives process restarts", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "navopath-updates-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "preferences.json");
  assert.equal(readAcceptBetaUpdates(file), false);
  writeAcceptBetaUpdates(file, true);
  assert.equal(readAcceptBetaUpdates(file), true);
  writeAcceptBetaUpdates(file, false);
  assert.equal(readAcceptBetaUpdates(file), false);
  assert.equal(fs.existsSync(`${file}.tmp`), false);
  for (const value of ["{", '{"acceptBetaUpdates":"true"}', "null", "[]"]) {
    fs.writeFileSync(file, value);
    assert.equal(readAcceptBetaUpdates(file), false);
  }
  assert.throws(() => writeAcceptBetaUpdates(file, 1), /boolean/);
});

test("low-memory mode is opt-in and persists independently from Beta updates", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "navopath-rendering-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const rendering = path.join(dir, "rendering-preferences.json");
  const updates = path.join(dir, "update-preferences.json");
  assert.equal(readLowMemoryMode(rendering), false);
  writeAcceptBetaUpdates(updates, true);
  writeLowMemoryMode(rendering, true);
  assert.equal(readLowMemoryMode(rendering), true);
  writeLowMemoryMode(rendering, false);
  assert.equal(readLowMemoryMode(rendering), false);
  assert.equal(readAcceptBetaUpdates(updates), true);
  fs.writeFileSync(rendering, '{"lowMemoryMode":"true"}');
  assert.equal(readLowMemoryMode(rendering), false);
});
