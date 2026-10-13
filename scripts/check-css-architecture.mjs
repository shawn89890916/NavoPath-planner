import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import postcss from "postcss";
import { fileURLToPath } from "node:url";

const historicalSheets = ["app-redesign.css", "workspace-v0.css", "execute-review.css", "styles.css"];
const canonicalSheets = new Set(["app.css", "ui-primitives.css"]);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function splitSelectors(selectorText) {
  const selectors = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  for (let index = 0; index < selectorText.length; index += 1) {
    const character = selectorText[index];
    if (quote) {
      if (character === quote && selectorText[index - 1] !== "\\") quote = "";
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "(" || character === "[") depth += 1;
    else if (character === ")" || character === "]") depth -= 1;
    else if (character === "," && depth === 0) {
      selectors.push(selectorText.slice(start, index).trim());
      start = index + 1;
    }
  }
  const finalSelector = selectorText.slice(start).trim();
  if (finalSelector) selectors.push(finalSelector);
  return selectors;
}

function normalizeSelector(selector) {
  return selector.replace(/\s+/g, " ").trim();
}

function cascadeContext(rule) {
  const context = [];
  let parent = rule.parent;
  while (parent) {
    if (parent.type === "atrule") context.unshift(`@${parent.name} ${parent.params}`);
    if (parent.type === "rule") context.unshift(`nest ${normalizeSelector(parent.selector)}`);
    parent = parent.parent;
  }
  return context.join(" > ") || "root";
}

export function checkCssArchitecture(repoRoot = resolve(import.meta.dirname, "..")) {
  const srcRoot = join(repoRoot, "src");
  const cssFiles = walk(srcRoot).filter((file) => extname(file) === ".css");
  const sourceText = walk(srcRoot)
    .filter((file) => [".ts", ".tsx", ".js", ".jsx"].includes(extname(file)) && !/\.(?:test|node-test)\./.test(file))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n")
    + "\n"
    + readFileSync(join(repoRoot, "index.html"), "utf8");
  const errors = [];
  const reports = [];

  for (const file of cssFiles) {
    const canonical = canonicalSheets.has(file.split(/[\\/]/).pop());
    const css = readFileSync(file, "utf8");
    if (historicalSheets.some((sheet) => css.includes(sheet))) {
      errors.push(`${relative(repoRoot, file)} references a historical stylesheet`);
    }

    const root = postcss.parse(css, { from: file });
    const seen = new Map();
    let importantCount = 0;
    root.walkDecls((declaration) => {
      if (declaration.important) importantCount += 1;
    });

    if (canonical) root.walkRules((rule) => {
      for (const selector of splitSelectors(rule.selector)) {
        const context = cascadeContext(rule);
        const key = `${context}::${normalizeSelector(selector)}`;
        if (!context.includes("@keyframes") && seen.has(key)) errors.push(`${relative(repoRoot, file)}:${rule.source?.start.line || "?"} duplicates ${selector} in ${context}`);
        seen.set(key, true);

        const tokens = [...selector.matchAll(/[.#]([A-Za-z_][A-Za-z0-9_-]*)/g)].map((match) => match[1]);
        const hasDynamicEscape = /\[(?:data|aria)-|::(?:before|after|marker|selection|backdrop)/.test(selector);
        if (tokens.length > 0 && !hasDynamicEscape) {
          const missing = tokens.filter((token) => !sourceText.includes(token) && !/^(theme|mode|type|onboarding-step|is|i|color)-/.test(token));
          if (missing.length > 0) errors.push(`${relative(repoRoot, file)}:${rule.source?.start.line || "?"} has no JSX/TSX callsite for ${missing.join(", ")}`);
        }
      }
    });

    reports.push({ file: relative(repoRoot, file), importantCount, canonical });
  }

  for (const file of cssFiles) {
    const name = file.split(/[\\/]/).pop();
    if (historicalSheets.includes(name)) errors.push(`${relative(repoRoot, file)} is a retired historical stylesheet`);
  }

  const importantCount = reports.filter((report) => report.canonical).reduce((total, report) => total + report.importantCount, 0);
  if (importantCount > 24) errors.push(`Application styles contain ${importantCount} !important declarations; keep the combined count at 24 or fewer`);
  return { errors, reports };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, reports } = checkCssArchitecture();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`CSS architecture OK: ${reports.filter((report) => report.canonical).length} canonical stylesheets checked; ${reports.length} stylesheets parsed`);
    for (const report of reports) console.log(`- ${report.file}: ${report.importantCount} !important declarations`);
  }
}
