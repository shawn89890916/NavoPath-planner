const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { readAcceptBetaUpdates, writeAcceptBetaUpdates } = require("./update-preferences.cjs");

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
