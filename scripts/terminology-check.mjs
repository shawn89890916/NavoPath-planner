import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const docs = read("docs/terminology.md");
const catalog = read("src/terminology.ts");
const i18n = read("src/i18n.ts");
const sharedUi = [
  "src/components/UiPrimitives.tsx",
  "src/components/SettingsControls.tsx",
  "src/InAppDialog.tsx",
].map(read).join("\n");

const rows = [...docs.matchAll(/^\| `([^`]+)` \| ([^|]+) \| ([^|]+) \|/gm)];
if (rows.length === 0) throw new Error("docs/terminology.md has no terminology table rows.");

for (const [, key, zh, en] of rows) {
  const entry = new RegExp(`\\b${key}\\s*:\\s*\\{[^}]*zh:\\s*"([^"]+)"[^}]*en:\\s*"([^"]+)"`).exec(catalog);
  if (!entry) throw new Error(`Missing runtime terminology entry for ${key}.`);
  if (entry[1] !== zh.trim() || entry[2] !== en.trim()) {
    throw new Error(`Documentation/runtime mismatch for ${key}.`);
  }
}

const aiPanelZh = /aiPanel:\s*\{\s*zh:\s*\{([\s\S]*?)\},\s*en:/m.exec(i18n)?.[1] || "";
if (aiPanelZh.includes('createScheduled: "Create scheduled tasks"')) {
  throw new Error("The Chinese createScheduled label must not be English.");
}

if (/[×✕]/u.test(sharedUi)) {
  throw new Error("Shared UI controls must use CloseButton/Lucide X instead of text close marks.");
}

const directHighRisk = />(?:Adopt(?: All)?|采纳)</u;
if (directHighRisk.test(read("src/main.tsx")) || directHighRisk.test(read("src/PlanningView.tsx"))) {
  throw new Error("High-risk Apply wording must come from the terminology/i18n layer.");
}

console.log(`Terminology check passed (${rows.length} documented terms).`);
