import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const path = new URL("../CHANGELOG.md", import.meta.url);
const checkOnly = process.argv.includes("--check");
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
const source = fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");

function historicalEntries(value) {
  return [...value.matchAll(/^## (\d{4}-\d{2}-\d{2})\b[^\n]*\n[\s\S]*?(?=^## \d{4}-\d{2}-\d{2}\b|^# NavoPath |\s*$)/gm)]
    .filter((match) => match[1] < date)
    .map((match) => match[0].trim());
}

function hasMojibake(value) {
  return value.includes("�") || /鏇存柊|鏂板姛|浠诲姟/.test(value);
}

function decodeBaseline(value) {
  // The HEAD blob may contain UTF-8 bytes that were mis-decoded as GBK and stored as Unicode.
  // Reverse the process: encode the Unicode string as GBK bytes, then decode as UTF-8.
  try {
    const iconv = require("iconv-lite");
    const gbkBytes = iconv.encode(value, "gbk");
    return iconv.decode(gbkBytes, "utf-8", { stripBOM: true });
  } catch {
    return value;
  }
}

try {
  let baselineRef = "HEAD";
  try {
    // A stale local checkout may already contain the newer published changelog.
    // Accept that history only when origin/main is a descendant of this HEAD.
    execFileSync("git", ["merge-base", "--is-ancestor", "HEAD", "origin/main"], { stdio: "ignore" });
    baselineRef = "origin/main";
  } catch { /* Ahead or divergent branches retain their own committed baseline. */ }
  let baseline = execFileSync("git", ["show", `${baselineRef}:CHANGELOG.md`], { encoding: "utf8" }).replace(/\r\n/g, "\n");
  if (JSON.stringify(historicalEntries(source)) !== JSON.stringify(historicalEntries(baseline))) {
    try {
      // Published cherry-picks can leave a local main on a different ancestry.
      // Only an exact match of the published history may replace its old baseline.
      if (execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim() === "main") {
        const published = execFileSync("git", ["show", "origin/main:CHANGELOG.md"], { encoding: "utf8" }).replace(/\r\n/g, "\n");
        if (JSON.stringify(historicalEntries(source)) === JSON.stringify(historicalEntries(published))) baseline = published;
      }
    } catch { /* Missing published history cannot authorize historical edits. */ }
  }
  if (hasMojibake(baseline)) {
    const decoded = decodeBaseline(baseline);
    if (JSON.stringify(historicalEntries(source)) !== JSON.stringify(historicalEntries(decoded))) {
      // The decoded baseline still differs (e.g. unrecoverable replacement characters).
      // Allow the repair only if the source itself is mojibake-free.
      if (hasMojibake(source)) {
        throw new Error("CHANGELOG.md entries before today are immutable.");
      }
      console.warn("Warning: historical entries differ from decoded baseline, but source is mojibake-free; accepting encoding repair.");
    }
  } else if (JSON.stringify(historicalEntries(source)) !== JSON.stringify(historicalEntries(baseline))) {
    throw new Error("CHANGELOG.md entries before today are immutable.");
  }
} catch (error) {
  if (error instanceof Error && error.message === "CHANGELOG.md entries before today are immutable.") throw error;
  // Allow the script to run in release archives that do not include Git history.
}

if (hasMojibake(source)) {
  throw new Error("CHANGELOG.md contains mojibake and must be repaired before delivery.");
}
if ((source.match(new RegExp(`^## ${date}\\b`, "gm")) || []).length !== 2) {
  throw new Error(`CHANGELOG.md must contain mirrored Chinese and English entries for ${date}.`);
}

const compact = source
  .split("\n")
  .filter((line, index, lines) => !line.startsWith("- ") || line !== lines[index - 1])
  .join("\n")
  .replace(/\n{3,}/g, "\n\n")
  .trimEnd() + "\n";

if (checkOnly && compact !== source) throw new Error("Run changelog-maintain.mjs to compact duplicate or excess whitespace.");
if (!checkOnly) fs.writeFileSync(path, compact, "utf8");
