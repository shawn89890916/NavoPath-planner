const fs = require("node:fs");
const path = require("node:path");

function readBooleanPreference(filePath, key) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))?.[key] === true;
  } catch {
    return false;
  }
}

function writeBooleanPreference(filePath, key, enabled) {
  if (typeof enabled !== "boolean") throw new TypeError("Desktop preference must be a boolean.");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify({ [key]: enabled }), "utf8");
  fs.renameSync(temporaryPath, filePath);
}

module.exports = {
  readAcceptBetaUpdates: (filePath) => readBooleanPreference(filePath, "acceptBetaUpdates"),
  writeAcceptBetaUpdates: (filePath, enabled) => writeBooleanPreference(filePath, "acceptBetaUpdates", enabled),
  readLowMemoryMode: (filePath) => readBooleanPreference(filePath, "lowMemoryMode"),
  writeLowMemoryMode: (filePath, enabled) => writeBooleanPreference(filePath, "lowMemoryMode", enabled),
};
