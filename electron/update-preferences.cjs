const fs = require("node:fs");
const path = require("node:path");

function readAcceptBetaUpdates(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")).acceptBetaUpdates === true;
  } catch {
    return false;
  }
}

function writeAcceptBetaUpdates(filePath, enabled) {
  if (typeof enabled !== "boolean") throw new TypeError("Beta update preference must be a boolean.");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify({ acceptBetaUpdates: enabled }), "utf8");
  fs.renameSync(temporaryPath, filePath);
}

module.exports = { readAcceptBetaUpdates, writeAcceptBetaUpdates };
